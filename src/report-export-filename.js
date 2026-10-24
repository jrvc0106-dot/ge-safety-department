/**
 * Universal export names, independent of PDF content and storage paths.
 * Uses the report's original calendar date. Stored timestamps are translated
 * to the America/New_York date; date-only fields preserve their exact date.
 */
export const EXPORT_TIME_ZONE='America/New_York';
const pad=n=>String(n).padStart(2,'0');
const calendar=(year,month,day)=>{
 const y=Number(year),m=Number(month),d=Number(day);
 if(y<1900||y>2100||m<1||m>12||d<1||d>31)return '';
 const date=new Date(Date.UTC(y,m-1,d));
 if(date.getUTCFullYear()!==y||date.getUTCMonth()+1!==m||date.getUTCDate()!==d)return '';
 return pad(m)+'.'+pad(d)+'.'+y;
};
export function reportFileDate(input){
 if(input==null||input==='')return '';
 if(input instanceof Date||typeof input==='number'){
  const d=new Date(input);
  if(Number.isNaN(d.getTime()))return '';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
   timeZone:EXPORT_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(d).map(x=>[x.type,x.value]));
  return calendar(parts.year,parts.month,parts.day);
 }
 const raw=String(input).trim();
 let m=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
 if(m)return calendar(m[1],m[2],m[3]);
 m=raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
 if(m)return calendar(m[3],m[1],m[2]);
 m=raw.match(/^(\d{4})(\d{2})(\d{2})$/);
 if(m)return calendar(m[1],m[2],m[3]);
 if(/^\d{4}-\d{2}-\d{2}[T ]/.test(raw)){
  const date=new Date(raw);
  if(!Number.isNaN(date.getTime()))return reportFileDate(date);
 }
 return '';
}
export function reportName(label,{reportType,equipmentType}={}){
 let title=String(label||'').trim()
  .replace(/\.pdf$/i,'').replace(/\s+By\s+G\s*&\s*E\s*$/i,'')
  .replace(/\s+\d{1,2}[./]\d{1,2}[./]\d{4}$/,'')
  .replace(/\s+/g,' ').trim();
 if(reportType==='equipment_inspection'&&!/\b(report|inspection)\b/i.test(title)){
  const kind=String(equipmentType||title||'Equipment').trim();
  title=kind+' Daily Report';
 }
 if(!title){
  const fallback={
   daily_report:'Daily Safety Report',daily_safety_walk:'Daily Safety Report JHA',
   observation:'Safety Observation Report',disciplinary_action:'Disciplinary Action Report',
   incident:'Incident Report',near_miss:'Near Miss Report',equipment_inspection:'Equipment Inspection Report',
   inventory:'Inventory Report',training:'Safety Orientation Report',tool_toolbox:'Toolbox Talk Report'
  };
  title=fallback[reportType]||String(reportType||'Safety Report').replace(/[_-]+/g,' ');
 }
 return title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g,'-').replace(/\.{2,}/g,'.')
   .replace(/[^\p{L}\p{N}&() .,+'_-]/gu,'')
   .replace(/\s+/g,' ').replace(/^[-.\s]+|[-.\s]+$/g,'').slice(0,115).trim()||'Safety Report';
}
export function reportExportFilename({title,originalDate,reportType,equipmentType}={}){
 const date=reportFileDate(originalDate);
 if(!date)throw new Error('Original report date is required for the finalized PDF filename');
 return reportName(title,{reportType,equipmentType})+' '+date+' By G&E.pdf';
}
export function originalReportDateFromElement(report,{sourceDate,fallback}={}){
 const fromData=report?.dataset?.geReportDate||sourceDate;
 if(reportFileDate(fromData))return fromData;
 const text=String(report?.textContent||'').slice(0,12000);
 const date=text.match(/\b(20\d{2}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]20\d{2})\b/);
 if(date&&reportFileDate(date[1]))return date[1];
 const iso=text.match(/\b20\d{2}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})\b/);
 if(iso&&reportFileDate(iso[0]))return iso[0];
 return reportFileDate(fallback)?fallback:null;
}
