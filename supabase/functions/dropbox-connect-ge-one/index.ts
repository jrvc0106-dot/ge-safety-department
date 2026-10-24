import {createClient} from "npm:@supabase/supabase-js@2.117.2";
const env=(k:string)=>Deno.env.get(k)||"";
const admin=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false}});
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
function page(){
 const nonce=Array.from(crypto.getRandomValues(new Uint8Array(18)),b=>b.toString(16).padStart(2,"0")).join("");
 const key=JSON.stringify(env("SUPABASE_ANON_KEY")).replace(/</g,"\\u003c");
 const base=JSON.stringify(env("SUPABASE_URL")).replace(/</g,"\\u003c");
 const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GE ONE | Dropbox</title>
<style nonce="@@NONCE@@">
*{box-sizing:border-box}body{margin:0;background:#eef1f3;color:#233945;font:16px system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.5}main{max-width:700px;background:#fff;margin:22px auto;padding:26px;border-radius:16px;box-shadow:0 8px 28px #26455918}h1{font-size:27px;margin:6px 0}h2{font-size:19px}small{color:#5e737e}p{margin:8px 0 16px}label{display:block;font-weight:650;margin:12px 0 5px}input,select{display:block;width:100%;padding:12px;font:inherit;border:1px solid #acbdc7;border-radius:7px;background:white;color:#1b3140}button,a.action{display:inline-block;padding:12px 17px;margin:12px 0;border:0;border-radius:8px;background:#344f63;color:white;font:inherit;font-weight:650;cursor:pointer;text-decoration:none}button:disabled{opacity:.5}button.secondary,a.secondary{background:#e8eef2;color:#274357}section{margin:18px 0}ol{padding-left:21px}li{margin:8px 0}code{overflow-wrap:anywhere;font-size:12px}.flex{display:flex;align-items:center;gap:10px}.flex input{min-width:0;font-size:12px}.flex button{white-space:nowrap}.muted{font-size:13px;color:#556e7c}.status{font-weight:650;color:#2b5f43;min-height:24px}#connect[hidden],#login[hidden]{display:none}@media(max-width:730px){main{margin:0;min-height:100vh;border-radius:0;padding:18px}.flex{flex-direction:column;align-items:stretch}}
</style></head><body><main><small>G&E ONE · SAFETY DEPARTMENT</small><h1>Conectar Dropbox</h1><p>Esta pantalla vincula tu Dropbox directamente al sistema de respaldo de GE ONE.</p>
<section id="login"><h2>1. Entrar como administrador</h2><p class="muted">Usa tu correo y contraseña de GE ONE. Se verifican directamente en el servicio de autenticación de GE ONE. No introduzcas tu contraseña de Dropbox aquí.</p><form id="loginForm"><label for="email">Correo de GE ONE</label><input id="email" type="email" autocomplete="username" required><label for="password">Contraseña de GE ONE</label><input id="password" type="password" autocomplete="current-password" required><button id="loginButton">Entrar</button></form></section>
<section id="connect" hidden><h2>2. Preparar Dropbox</h2><p>Este paso se hace una sola vez. Si ya tienes una App Key, ve directamente al formulario.</p><a class="action secondary" href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer">Abrir Dropbox App Console ↗</a>
<ol><li>Pulsa <b>Create app</b> y selecciona <b>Scoped access</b> y <b>App folder</b>.</li><li>En <b>Permissions</b> habilita y guarda: <code>files.content.write</code>, <code>files.metadata.read</code>, <code>account_info.read</code>.</li><li>En <b>Settings → OAuth 2 → Redirect URIs</b> añade esta dirección:</li></ol>
<div class="flex"><input id="callback" readonly aria-label="Dirección de redirección de Dropbox"><button class="secondary" id="copy" type="button">Copiar</button></div>
<form id="connectForm"><label for="project">Proyecto GE ONE</label><select id="project" required></select><label for="key">Dropbox App Key</label><input id="key" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="64" placeholder="Pega aquí el código App Key" required><p class="muted">Solo App Key. Nunca App Secret ni contraseña de Dropbox.</p><button id="connectButton">Conectar mi Dropbox</button></form><p class="muted">Se abrirá Dropbox oficial para que pulses <b>Permitir / Allow</b>. Los PDF, incluidos los médicos, se enviarán mediante el servidor de GE ONE después de autorizarlo.</p></section>
<p class="status" id="status" role="status" aria-live="polite"></p>
</main><script nonce="@@NONCE@@">
(function(){
 const base=@@BASE@@,pub=@@PUBLIC@@,callback=base+"/functions/v1/backup-cloud?callback=1";
 let access="";
 const el=id=>document.getElementById(id);
 const status=(value,bad)=>{el("status").textContent=String(value);el("status").style.color=bad?"#a22222":"#2b5f43";};
 el("callback").value=callback;
 const req=async(url,method,body,auth)=>{
  const headers={"Content-Type":"application/json","apikey":pub};
  if(auth)headers.Authorization="Bearer "+access;
  const response=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined,credentials:"omit",cache:"no-store"});
  let data={};try{data=await response.json()}catch{}
  if(!response.ok||data.error)throw Error(typeof data.error==="string"?data.error:data.error_description||data.msg||"El servidor no completó la conexión.");
  return data;
 };
 el("loginForm").addEventListener("submit",async event=>{
  event.preventDefault();el("loginButton").disabled=true;status("Verificando GE ONE...");
  try{
   const data=await req(base+"/auth/v1/token?grant_type=password","POST",{email:el("email").value.trim(),password:el("password").value},false);
   el("password").value="";
   if(!data.access_token)throw Error("No se pudo verificar la cuenta.");
   access=data.access_token;
   const projects=await req(base+"/functions/v1/dropbox-connect-ge-one?projects=1","GET",null,true);
   if(!Array.isArray(projects.projects)||!projects.projects.length)throw Error("No hay proyectos disponibles.");
   el("project").replaceChildren();
   for(const project of projects.projects){
    const o=document.createElement("option");o.value=project.id;o.textContent=project.name;el("project").append(o);
   }
   el("login").hidden=true;el("connect").hidden=false;
   status("Administrador verificado. Continúa con Dropbox.");
  }catch(error){el("password").value="";status(error.message,true)}
  finally{el("loginButton").disabled=false}
 });
 el("copy").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(callback);status("Dirección copiada. Pégala en Dropbox → Settings → OAuth 2.")}
  catch{el("callback").focus();el("callback").select();status("Dirección seleccionada; cópiala.");}
 });
 el("connectForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const key=el("key").value.trim(),project_id=el("project").value;
  if(!/^[A-Za-z0-9]{6,64}$/.test(key)){status("La App Key no parece válida.",true);return}
  el("connectButton").disabled=true;status("Preparando autorización...");
  try{
   await req(base+"/functions/v1/backup-cloud","POST",{action:"setup_dropbox",project_id,provider:"dropbox",app_key:key},true);
   const answer=await req(base+"/functions/v1/backup-cloud","POST",{action:"connect",project_id,provider:"dropbox"},true);
   const target=new URL(answer.authorization_url);
   if(target.protocol!=="https:"||target.hostname!=="www.dropbox.com"||target.pathname!=="/oauth2/authorize")throw Error("Enlace de autorización incorrecto.");
   window.location.assign(target.href);
  }catch(error){status(error.message||"No se pudo conectar.",true);el("connectButton").disabled=false}
 });
})();
</script></body></html>`;
 return new Response(html.replaceAll("@@NONCE@@",nonce).replace("@@BASE@@",base).replace("@@PUBLIC@@",key),{headers:{
 "Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store, private",
 "Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff",
 "Content-Security-Policy":"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none';"
 }});
}
Deno.serve(async req=>{
 if(req.method!=="GET")return json({error:"Method not allowed"},405);
 const url=new URL(req.url);
 if(url.searchParams.get("projects")==="1"){
  try{
   const bearer=req.headers.get("Authorization")||"";
   const client=createClient(env("SUPABASE_URL"),env("SUPABASE_ANON_KEY"),{global:{headers:{Authorization:bearer}},auth:{persistSession:false}});
   const current=await client.auth.getUser();
   if(current.error||!current.data.user)return json({error:"Inicia sesión de nuevo."},401);
   const role=await admin.from("profiles").select("role").eq("id",current.data.user.id).single();
   if(role.error||role.data?.role!=="admin")return json({error:"Solo Admin de GE ONE puede conectar Dropbox."},403);
   const projects=await admin.from("projects").select("id,name").order("name").limit(200);
   if(projects.error)return json({error:"No se pudieron cargar los proyectos."},500);
   return json({projects:projects.data||[]});
  }catch{return json({error:"No se pudo verificar tu acceso."},500)}
 }
 return page();
});
