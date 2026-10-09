import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function b64url(value: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < value.length; i += 0x8000) {
    binary += String.fromCharCode(...value.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function gmailAccessToken() {
  const clientId = Deno.env.get("GMAIL_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_OAUTH_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_OAUTH_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Gmail OAuth is not configured in Supabase Function Secrets");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const result = await response.json();
  if (!response.ok || typeof result.access_token !== "string") {
    // Never include token endpoint request/response credentials in errors or logs.
    const reason = typeof result.error === "string" ? result.error : "token_refresh_failed";
    throw new Error(`Google could not authorize email delivery (${reason})`);
  }
  return result.access_token as string;
}

async function sendInviteEmail(args: {
  to: string;
  name: string;
  role: string;
  projectName: string;
  actionLink: string;
}) {
  const sender = Deno.env.get("GMAIL_SENDER_EMAIL")?.trim().toLowerCase();
  if (!sender || !/^[^\s<>@]+@gmail\.com$/.test(sender)) {
    throw new Error("GMAIL_SENDER_EMAIL must be the Gmail address authorized for sending");
  }

  const safe = (s: string) => s.replace(/[\r\n]/g, " ").trim();
  const name = safe(args.name);
  const project = safe(args.projectName);
  const role = safe(args.role.replaceAll("_", " "));
  const plainText = [
    `Hello ${name},`,
    "",
    `You have been invited to join the G&E Safety Department team as ${role}.`,
    `Project: ${project}`,
    "",
    "Use this secure link to accept the invitation and finish setting up your account:",
    args.actionLink,
    "",
    "If you were not expecting this invitation, you can ignore this email.",
  ].join("\r\n");
  const mime = [
    `From: G&E Safety Department <${sender}>`,
    `To: ${args.to}`,
    "Subject: Invitation to G&E Safety Department",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(String.fromCharCode(...new TextEncoder().encode(plainText))),
  ].join("\r\n");

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await gmailAccessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: b64url(new TextEncoder().encode(mime)) }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const reason = result?.error?.status || result?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Gmail rejected the invitation email (${String(reason).slice(0, 180)})`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !service) throw new Error("Supabase server configuration is incomplete");
    const admin = createClient(url, service, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userErr } = await admin.auth.getUser(auth.slice(7));
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: caller, error: callerErr } = await admin
      .from("profiles").select("role,removed_at").eq("id", user.id).single();
    if (callerErr || caller?.role !== "admin" || caller.removed_at) {
      return json({ error: "Admin access required" }, 403);
    }

    const { email, name, role, project_id, redirect_to } = await req.json();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanName = String(name || "").trim();
    const allowed = ["safety_director", "safety", "supervisor", "worker"];
    if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      return json({ error: "A valid email address is required" }, 400);
    }
    if (!cleanName || cleanName.length > 120) return json({ error: "A valid name is required" }, 400);
    if (!allowed.includes(role) || !project_id) return json({ error: "Role and project are required" }, 400);

    const { data: project, error: projectError } = await admin
      .from("projects").select("id,name").eq("id", project_id).maybeSingle();
    if (projectError) throw projectError;
    if (!project) return json({ error: "Authorized project was not found" }, 400);

    let found: any;
    for (let page = 1; !found; page++) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (listErr) throw listErr;
      found = list.users.find((u) => u.email?.toLowerCase() === cleanEmail);
      if (list.users.length < 1000) break;
    }

    let profileExists = false;
    let existing = false;
    let inviteSent = false;
    let uid: string | undefined;
    let actionLink: string | undefined;

    if (found) {
      const { data: oldProfile, error: oldError } = await admin
        .from("profiles").select("role,removed_at").eq("id", found.id).maybeSingle();
      if (oldError) throw oldError;
      if (oldProfile?.role === "admin") {
        throw new Error("Administrator accounts cannot be changed through team invitations");
      }
      if (oldProfile?.removed_at) {
        const { error: cleanupError } = await admin.auth.admin.deleteUser(found.id, true);
        if (cleanupError) throw cleanupError;
        found = undefined;
      } else {
        profileExists = !!oldProfile;
        existing = true;
      }
    }

    let safeRedirect: string | undefined;
    if (redirect_to) {
      try {
        const parsed = new URL(String(redirect_to));
        if (["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password) {
          safeRedirect = parsed.origin;
        }
      } catch { /* Keep Supabase's configured Site URL. */ }
    }

    if (!found) {
      if (!cleanEmail.endsWith("@geflcontractors.com")) {
        const { error: allowError } = await admin.from("admin_invite_allowlist").upsert({
          email: cleanEmail,
          created_by: user.id,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        }, { onConflict: "email" });
        if (allowError) throw allowError;
      }

      const { data: invited, error: inviteError } = await admin.auth.admin.generateLink({
        type: "invite",
        email: cleanEmail,
        options: { data: { name: cleanName }, ...(safeRedirect ? { redirectTo: safeRedirect } : {}) },
      });
      if (inviteError) throw inviteError;
      uid = invited.user?.id;
      actionLink = invited.properties?.action_link;
      if (!uid || !actionLink) throw new Error("Supabase could not generate the secure invitation link");
      inviteSent = true;
    } else {
      uid = found.id;
      if (!found.email_confirmed_at) {
        const { data: generated, error: generateError } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email: cleanEmail,
          options: safeRedirect ? { redirectTo: safeRedirect } : undefined,
        });
        if (generateError) throw generateError;
        actionLink = generated.properties?.action_link;
        if (!actionLink) throw new Error("Supabase could not generate the secure sign-in link");
        inviteSent = true;
      }
    }

    if (!uid) throw new Error("Team member account was not available");
    if (!profileExists || !found?.email_confirmed_at) {
      const { error: profileError } = await admin.from("profiles").upsert({
        id: uid, email: cleanEmail, name: cleanName, role,
      }, { onConflict: "id" });
      if (profileError) throw profileError;
    }

    const { error: memberError } = await admin.from("project_members").upsert({
      project_id, user_id: uid,
    }, { onConflict: "project_id,user_id" });
    if (memberError) throw memberError;

    // Send only after the auth user and project membership are ready.
    let deliveryError: string | undefined;
    if (inviteSent && actionLink) {
      try {
        await sendInviteEmail({
          to: cleanEmail,
          name: cleanName,
          role,
          projectName: String(project.name || "G&E Safety Department"),
          actionLink,
        });
      } catch (error) {
        // The account and project access are already provisioned. Keep the
        // one-time Supabase link available to this authenticated admin so the
        // invite can still be delivered manually while email is repaired.
        deliveryError = error instanceof Error ? error.message : "Email delivery failed";
      }
    }

    return json({
      ok: true,
      email: cleanEmail,
      existing,
      action: deliveryError ? "invitation_link_ready" : inviteSent ? "invitation_email_sent" : "project_access_added",
      email_sent: inviteSent && !deliveryError,
      ...(deliveryError && actionLink ? { invite_link: actionLink, delivery_error: deliveryError } : {}),
    });
  } catch (e) {
    return json({
      error: e instanceof Error ? e.message : String(e),
      code: (e as { code?: string })?.code,
    }, 400);
  }
});
