export function installConnectivityStatus({window:win=window,document:doc=document,getLanguage=()=> 'en',onlineDismissMs=5000}={}) {
 if(!doc?.body||!win?.addEventListener)return ()=>{};
 const existing=doc.getElementById('ge-connectivity-status');
 if(existing)return ()=>{};
 const bar=doc.createElement('div');
 bar.id='ge-connectivity-status';
 bar.setAttribute('role','status');
 bar.setAttribute('aria-live','polite');
 bar.hidden=true;
 doc.body.append(bar);
 let timer=null;
 const text=(offline)=>{
  const spanish=getLanguage()==='es';
  bar.className=offline?'is-offline':'is-online';
  bar.textContent=offline
   ?(spanish?'Sin conexión. Los borradores y las fotos guardados localmente se sincronizarán al volver la conexión.':'Offline. Drafts and photos saved on this device will sync when the connection returns.')
   :(spanish?'Conexión restablecida. La sincronización de borradores se reanudará.':'Connection restored. Draft synchronization is resuming.');
  bar.hidden=false;
 };
 const offline=()=>{if(timer!==null)win.clearTimeout(timer);timer=null;text(true)};
 const online=()=>{if(timer!==null)win.clearTimeout(timer);text(false);timer=win.setTimeout(()=>{bar.hidden=true;timer=null},onlineDismissMs)};
 win.addEventListener('offline',offline);
 win.addEventListener('online',online);
 if(win.navigator?.onLine===false)offline();
 return ()=>{
  if(timer!==null)win.clearTimeout(timer);
  win.removeEventListener('offline',offline);
  win.removeEventListener('online',online);
  bar.remove();
 };
}
