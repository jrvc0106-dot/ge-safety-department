/**
 * JHA checklist bulk SAFE selection, while keeping every row fully editable.
 * Never changes existing Unsafe / N/A answers, findings, photos, or signatures.
 * Re-tapping a selected radio clears only that item.
 */
export function attachDailyReportBulkStatus(form){
 if(!form)return;
 const selectAll=form.querySelector('[data-jha-select-all]');
 if(!selectAll)return;
 const radioSelector='.walk-status input[type="radio"][name^="status_"]';
 const groups=new Map();
 for(const radio of form.querySelectorAll(radioSelector)){
  const entries=groups.get(radio.name)||[];
  entries.push(radio);
  groups.set(radio.name,entries);
 }
 const fireChange=radio=>{
  const EventCtor=radio.ownerDocument.defaultView.Event;
  radio.dispatchEvent(new EventCtor('input',{bubbles:true}));
  radio.dispatchEvent(new EventCtor('change',{bubbles:true}));
 };
 selectAll.addEventListener('click',()=>{
  for(const entries of groups.values()){
   if(entries.some(r=>r.checked))continue; // Protect existing Unsafe / N/A decisions.
   const safe=entries.find(r=>r.value==='safe'&&!r.disabled);
   if(safe){safe.checked=true;fireChange(safe)}
  }
 });
 let selectedBeforeClick=null;
 const getRadio=target=>{
  if(target?.matches?.(radioSelector))return target;
  const label=target?.closest?.('.walk-status label');
  return label?.querySelector(radioSelector)||null;
 };
 form.addEventListener('pointerdown',event=>{
  const radio=getRadio(event.target);
  selectedBeforeClick=radio?{radio,wasChecked:radio.checked}:null;
 },true);
 form.addEventListener('keydown',event=>{
  if(event.key!==' '&&event.code!=='Space')return;
  const radio=getRadio(event.target);
  if(radio)selectedBeforeClick={radio,wasChecked:radio.checked};
 },true);
 form.addEventListener('click',event=>{
  const radio=event.target?.matches?.(radioSelector)?event.target:null;
  if(!radio)return; // Label clicks forward to a subsequent radio click.
  if(selectedBeforeClick?.radio===radio&&selectedBeforeClick.wasChecked){
   radio.checked=false;
   fireChange(radio);
  }
  selectedBeforeClick=null;
 });
}
