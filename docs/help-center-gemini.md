# G&E ONE Help Center — Gemini free-tier setup

The Help Center is a new Home shortcut and an authenticated Vercel serverless endpoint (`/api/help`).

## One-time activation

1. Sign in to [Google AI Studio](https://aistudio.google.com/apikey) and create an API key on a **free-tier project with billing disabled**. Do not share the key in chat or GitHub.
2. In **Vercel → G&E ONE project → Settings → Environment Variables**, add `GEMINI_API_KEY` as an encrypted/sensitive **server-side** environment variable for Production (and Preview if testing).
3. Redeploy the verified build to make the environment variable available.
4. Test a harmless question inside Help Center. The requested model is exactly `gemini-2.5-flash-lite`. Google may deny 2.5 model access to new projects; if unavailable, the Help Center shows a transparent error rather than silently switching to a paid model.
5. Confirm the project's Google AI Studio **Usage** dashboard and free-tier rate limits. No automatic paid fallback or paid tier is configured by this code.

## Privacy and safeguards

- Requires a valid logged-in Supabase user session. The browser never receives the Gemini API key.
- Chat history is kept only in the open page, not written to a database by this feature.
- Optional screenshot attachments must be JPG/PNG/WebP under 2 MB. Users must redact confidential or personal information before sending.
- Do not send medical records, employee identities, passwords, API keys, or sensitive work documents. Google free-tier data policies may permit data use to improve products.
- The endpoint limits message size, output length, screenshot size, and requests per user per minute in a **best-effort in-memory** limiter. Serverless instances do not share this limiter; Google quotas remain the authoritative limit.
- Help Center cannot inspect logs or repair the application. All fixes require authorized developer/administrator action.
- If Gemini is unavailable or quota exhausted, it displays a clear error and basic guidance.

This feature does not modify existing modules or PDF formats.
