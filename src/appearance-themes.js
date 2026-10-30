/**
 * G&E ONE appearance system.
 * Three strictly visual, per-device preferences. Never changes report templates,
 * authentication, stored project, document data, or access controls.
 */
export const APPEARANCE_KEY='ge_one_appearance_theme_v1';
export const APPEARANCE_THEMES=Object.freeze({
 original:Object.freeze({name:'Original',nameEs:'Original',description:'Original G&E corporate design',descriptionEs:'Diseño corporativo original G&E',
  bg:'#f3f4f5',surface:'#ffffff',subtle:'#f5f6f7',text:'#202b33',muted:'#50616e',border:'#d7dee3',accent:'#273c4b',accentText:'#ffffff',bar:'#f7f9fa'}),
 gray:Object.freeze({name:'Gray',nameEs:'Gris',description:'Elegant neutral gray',descriptionEs:'Grises neutros y elegantes',
  bg:'#e4e7e9',surface:'#f6f7f8',subtle:'#e4e8eb',text:'#222c33',muted:'#4f606b',border:'#bec7ce',accent:'#354957',accentText:'#ffffff',bar:'#eceff1'}),
 mix:Object.freeze({name:'Color Mix',nameEs:'Colores',description:'Balanced colors by module',descriptionEs:'Colores equilibrados por módulo',
  bg:'#edf2f8',surface:'#ffffff',subtle:'#f0f5fa',text:'#17324b',muted:'#4e6477',border:'#cad9e6',accent:'#184d82',accentText:'#ffffff',bar:'#f8fafc'})
});
export const APPEARANCE_THEME_IDS=Object.freeze(Object.keys(APPEARANCE_THEMES));
export const validAppearance=value=>Object.hasOwn(APPEARANCE_THEMES,value)?value:'original';

export function contrastRatio(foreground,background){
 const luminance=hex=>{
  const channels=hex.replace('#','').match(/.{2}/g)?.map(code=>{
   const n=parseInt(code,16)/255;return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4;
  });
  if(!channels||channels.length!==3)throw Error('Invalid RGB hexadecimal color');
  return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
 };
 const a=luminance(foreground),b=luminance(background);
 return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

export function installAppearanceTheme({win=window,doc=document,storage=win.localStorage}={}){
 let selected='original';
 try{selected=validAppearance(storage?.getItem(APPEARANCE_KEY))}catch{}
 const themeColor=doc.querySelector('meta[name="theme-color"]');
 const apply=()=>{
  doc.documentElement.setAttribute('data-ge-theme',selected);
  doc.documentElement.style.colorScheme='light';
  if(themeColor)themeColor.setAttribute('content',APPEARANCE_THEMES[selected].bg);
  return selected;
 };
 apply();
 return {
  getTheme:()=>selected,
  setTheme:value=>{
   selected=validAppearance(value);
   try{storage?.setItem(APPEARANCE_KEY,selected)}catch{/* Session selection still applies. */}
   apply();
   return selected;
  }
 };
}

const thumb=(doc,id)=>{
 const root=doc.createElement('span');
 root.className='ge-theme-thumbnail ge-theme-thumbnail-'+id;
 root.setAttribute('aria-hidden','true');
 for(const cls of ['brand','line long','line','tiles']){
  const element=doc.createElement('span');element.className='ge-preview-'+cls.replace(' ', ' ge-preview-');root.append(element);
 }
 return root;
};

export function mountAppearanceSettings({doc=document,appearance,tr=(en)=>en,invitation=false}={}){
 if(!appearance||invitation||doc.querySelector('#ge-theme-settings'))return false;
 const language=doc.querySelector('#settings-language');
 if(!language)return false;
 const section=doc.createElement('section');
 section.id='ge-theme-settings';
 section.className='ge-theme-settings';
 section.setAttribute('aria-labelledby','ge-theme-title');
 const title=doc.createElement('h2');title.id='ge-theme-title';
 title.textContent=tr('Theme & Appearance','Tema y apariencia');
 const intro=doc.createElement('p');
 intro.textContent=tr('Choose the appearance on this device. Your reports and PDFs keep their corporate format.','Seleccione la apariencia en este dispositivo. Los reportes y PDF conservan su formato corporativo.');
 const options=doc.createElement('div');
 options.className='ge-theme-grid';
 options.setAttribute('role','group');
 options.setAttribute('aria-label',tr('Available themes','Temas disponibles'));
 const buttons=[];
 for(const id of APPEARANCE_THEME_IDS){
  const config=APPEARANCE_THEMES[id];
  const button=doc.createElement('button');
  button.type='button';button.className='ge-theme-choice';button.dataset.theme=id;
  button.setAttribute('aria-pressed','false');
  button.append(thumb(doc,id));
  const name=doc.createElement('strong');name.textContent=tr(config.name,config.nameEs);
  const description=doc.createElement('small');description.textContent=tr(config.description,config.descriptionEs);
  button.append(name,description);
  options.append(button);buttons.push(button);
 }
 const preview=doc.createElement('div');
 preview.className='ge-theme-live-preview';
 preview.setAttribute('aria-label',tr('Theme preview, sample only','Vista previa del tema, solo ejemplo'));
 const previewTitle=doc.createElement('div');
 previewTitle.className='ge-theme-preview-heading';
 const pTitle=doc.createElement('strong');pTitle.textContent=tr('Live Preview','Vista previa');
 const sample=doc.createElement('span');sample.textContent=tr('Sample design · no real project data','Diseño de ejemplo · sin datos reales');
 previewTitle.append(pTitle,sample);
 const mock=doc.createElement('div');mock.className='ge-theme-preview-window';
 const bar=doc.createElement('div');bar.className='ge-theme-preview-bar';bar.textContent='G&E ONE';
 const previewStats=doc.createElement('div');previewStats.className='ge-theme-preview-stats';
 const labels=[
  ['Observations','Observaciones'],['Daily JHA','JHA diario'],
  ['Incidents','Incidentes'],['Team Field','Equipo de campo']
 ];
 labels.forEach(([en,es],i)=>{
  const tile=doc.createElement('div');tile.className='ge-theme-preview-stat ge-theme-preview-stat-'+i;
  const icon=doc.createElement('span');icon.textContent=['◧','▤','⚠','♙'][i];
  const label=doc.createElement('strong');label.textContent=tr(en,es);
  tile.append(icon,label);previewStats.append(tile);
 });
 mock.append(bar,previewStats);
 preview.append(previewTitle,mock);
 const foot=doc.createElement('p');foot.className='ge-theme-help';
 foot.textContent=tr('Changes apply immediately. You can switch back to Original at any time.','Los cambios se aplican al instante. Puede volver a Original cuando desee.');
 section.append(title,intro,options,preview,foot);
 const update=()=>buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.theme===appearance.getTheme())));
 buttons.forEach(button=>button.addEventListener('click',()=>{
  appearance.setTheme(button.dataset.theme);
  update();
 }));
 update();
 language.closest('label')?.after(section);
 return true;
}
