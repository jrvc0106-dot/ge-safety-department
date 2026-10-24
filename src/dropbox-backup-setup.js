// Admin-only Cloud Backup Center convenience view. No Dropbox passwords or app secrets.
export const isValidDropboxAppKey=value=>typeof value==='string'&&/^[A-Za-z0-9]{6,64}$/.test(value.trim());
export function dropboxSetupMarkup(callbackUrl,tr=(en)=>en,esc=value=>String(value)){
 const url=String(callbackUrl||"");
 return '<div class="backup-dropbox-setup">'+
  '<p><strong>'+tr('One-time Dropbox setup','Configuración inicial de Dropbox')+'</strong></p>'+
  '<ol><li><a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer">'+tr('Create a Dropbox app','Crear una app en Dropbox')+'</a>: <b>Scoped access → App folder</b>.</li>'+
  '<li>'+tr('Under Permissions select these three and save:','En Permissions marca estos tres permisos y guárdalos:')+' <code>files.content.write</code>, <code>files.metadata.read</code>, <code>account_info.read</code>.</li>'+
  '<li>'+tr('Under Settings → OAuth 2 → Redirect URIs, register this exact address:','En Settings → OAuth 2 → Redirect URIs, registra exactamente esta dirección:')+
  ' <code class="backup-dropbox-callback">'+esc(url)+'</code> <button type="button" class="secondary" id="backup-dropbox-copy-callback">'+tr('Copy address','Copiar dirección')+'</button></li>'+
  '<li>'+tr('Copy your App key from Settings and paste it below.','Copia la App key de Settings y pégala aquí abajo.')+'</li></ol>'+
  '<label for="backup-dropbox-key">'+tr('Dropbox App key (not App secret)','App key de Dropbox (no App secret)')+'</label>'+
  '<input id="backup-dropbox-key" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="64" placeholder="App key" aria-describedby="backup-dropbox-key-note">'+
  '<small id="backup-dropbox-key-note">'+tr('Do not enter your Dropbox password, access token or App Secret.','No introduzcas tu contraseña de Dropbox, token ni App Secret.')+'</small>'+
  '<button type="button" id="backup-dropbox-setup-connect">'+tr('Save key and connect Dropbox','Guardar clave y conectar Dropbox')+'</button>'+
  '</div>';
}
