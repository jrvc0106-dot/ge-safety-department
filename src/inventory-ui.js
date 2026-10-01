export function simplifyInventoryForm(form,tr){
 const submit=form.querySelector('button[type="submit"]');
 const group=(title,names,optional=false)=>{
  const section=document.createElement(optional?'details':'fieldset');
  section.className='inventory-form-section wide';
  const heading=document.createElement(optional?'summary':'legend');heading.textContent=title;section.append(heading);
  const fields=document.createElement('div');fields.className='inventory-section-fields';section.append(fields);
  for(const name of names){const control=form.elements.namedItem(name),label=control?.closest('label');if(label)fields.append(label)}
  form.insertBefore(section,submit);return section;
 };
 const basics=group(tr('1. Item & condition','1. Artículo y condición'),['category','item_name','quantity','condition','status']);
 const location=group(tr('2. Location & responsible person','2. Ubicación y responsable'),['location','assigned_to']);
 const photo=form.querySelector('.inventory-photo-box');
 if(photo){photo.querySelector('strong').textContent=tr('3. Photos & evidence','3. Fotos y evidencia');form.insertBefore(photo,submit)}
 group(tr('Additional details · brand, ID & inspections','Detalles adicionales · marca, ID e inspecciones'),['brand','model','serial_number','asset_id','last_inspection_at','next_inspection_date'],true);
 group(tr('Notes','Notas'),['notes']);
 form.prepend(basics,location);
 const note=form.querySelector('.inventory-safety-note');if(note)form.insertBefore(note,submit);
 for(const name of ['camera_photo','photos']){
  const input=form.elements.namedItem(name);if(!input)continue;
  const feedback=document.createElement('span');feedback.className='inventory-photo-feedback';feedback.setAttribute('role','status');const label=input.closest('label'),wrapper=document.createElement('div');label.before(wrapper);wrapper.append(label,feedback);
  input.addEventListener('change',()=>{const count=input.files?.length||0;feedback.textContent=count?count+' '+tr('photo(s) selected','foto(s) seleccionadas'):''});
 }
}
