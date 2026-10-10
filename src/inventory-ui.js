export function simplifyInventoryForm(form,tr){
 const submit=form.querySelector('button[type="submit"]');
 const section=(title,names,optional=false)=>{
  const container=document.createElement(optional?'details':'fieldset');
  container.className='inventory-form-section wide';
  const heading=document.createElement(optional?'summary':'legend');heading.textContent=title;container.append(heading);
  const fields=document.createElement('div');fields.className='inventory-section-fields';container.append(fields);
  for(const name of names){const control=form.elements.namedItem(name),label=control?.closest('label');if(label)fields.append(label)}
  form.insertBefore(container,submit);return container;
 };
 const basics=section(tr('Quick inventory · item, quantity & condition','Inventario rápido · artículo, cantidad y condición'),['category','item_name','quantity','condition']);
 const more=section(tr('Optional details · status, location, assigned person, brand, ID & inspections','Detalles opcionales · estado, ubicación, responsable, marca, ID e inspecciones'),['status','location','assigned_to','brand','model','serial_number','asset_id','last_inspection_at','next_inspection_date'],true);
 const photo=form.querySelector('.inventory-photo-box');
 if(photo){photo.querySelector('strong').textContent=tr('Optional photos & evidence','Fotos y evidencia opcionales');form.insertBefore(photo,submit)}
 const notes=section(tr('Notes (optional)','Notas (opcional)'),['notes'],true);
 form.prepend(basics,more);
 const warning=form.querySelector('.inventory-safety-note');if(warning)form.insertBefore(warning,submit);
 const quick=document.createElement('button');quick.type='submit';quick.className='secondary wide';quick.dataset.inventoryAddAnother='true';quick.textContent=tr('Save & add another item','Guardar y agregar otro artículo');submit.before(quick);
 for(const name of ['camera_photo','photos']){
  const input=form.elements.namedItem(name);if(!input)continue;
  const feedback=document.createElement('span');feedback.className='inventory-photo-feedback';feedback.setAttribute('role','status');
  const label=input.closest('label'),wrapper=document.createElement('div');label.before(wrapper);wrapper.append(label,feedback);
  input.addEventListener('change',()=>{const count=input.files?.length||0;feedback.textContent=count?count+' '+tr('photo(s) selected','foto(s) seleccionadas'):''});
 }
}
