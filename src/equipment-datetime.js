// Equipment inspection timestamps are recorded and displayed in Florida jobsite time.
// Use an explicit zone rather than trusting the iPad/browser clock zone.
export const EQUIPMENT_TIME_ZONE='America/New_York';
const pad=value=>String(value).padStart(2,'0');
const formatter=new Intl.DateTimeFormat('en-US',{
 timeZone:EQUIPMENT_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',
 hour:'2-digit',minute:'2-digit',hourCycle:'h23'
});
function partsAt(instant){
 const parts=formatter.formatToParts(new Date(instant));
 return Object.fromEntries(parts.filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
}
export function equipmentDateTimeInput(instant=new Date()){
 const p=partsAt(instant);
 return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute;
}
export function equipmentDay(instant=new Date()){return equipmentDateTimeInput(instant).slice(0,10)}
export function equipmentInspectionUtc(value){
 const match=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/.exec(String(value||''));
 if(!match)throw Error('Enter a valid inspection date and time.');
 const [,y,m,d,h,min]=match.map(Number);
 const target=Date.UTC(y,m-1,d,h,min);
 if(!Number.isFinite(target)||new Date(target).toISOString().slice(0,16)!==value)throw Error('Invalid inspection date and time.');
 let candidate=target;
 for(let step=0;step<5;step++){
  const p=partsAt(candidate);
  const actual=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute));
  const difference=target-actual;
  candidate+=difference;
  if(difference===0)break;
 }
 const result=new Date(candidate);
 if(equipmentDateTimeInput(result)!==value)throw Error('This time does not exist in Florida because of the daylight saving time change.');
 return result.toISOString();
}
export function equipmentReportDate(instant,language='en'){
 if(!instant)return '—';
 const date=new Date(instant);
 if(!Number.isFinite(date.getTime()))return '—';
 return new Intl.DateTimeFormat(language==='es'?'es-US':'en-US',{
  timeZone:EQUIPMENT_TIME_ZONE,dateStyle:'medium',timeStyle:'short',timeZoneName:'short'
 }).format(date);
}
export function restoredEquipmentDate(saved,now=new Date()){
 return typeof saved==='string'&&saved.slice(0,10)!==equipmentDay(now)?equipmentDateTimeInput(now):saved;
}
