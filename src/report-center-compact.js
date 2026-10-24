// Compact Daily Report / Report Center presentation. Author is the actual
// report creator's profile, never the active viewer or an employee subject.
export function reportCompactDate(value,language='en'){
 const date=new Date(value||'');
 if(!Number.isFinite(date.getTime()))return '—';
 // Keep the existing MM.DD.YYYY policy stable in either app language.
 const mm=String(date.getMonth()+1).padStart(2,'0'),dd=String(date.getDate()).padStart(2,'0');
 return mm+'.'+dd+'.'+date.getFullYear();
}
export function compactReportRow({kind,id,title,creator,createdAt,language='en'},tr=(a)=>a,esc=(s)=>String(s)){
 const date=new Date(createdAt||'');
 const timestamp=Number.isFinite(date.getTime())?date.getTime():0;
 const author=String(creator||'').trim()||tr('Creator not recorded','Creador no registrado');
 return '<button type="button" class="report-record report-compact-record" data-time="'+timestamp+'" data-kind="'+esc(kind)+'" data-id="'+esc(id)+'" aria-label="'+esc(tr('Open report','Abrir reporte')+': '+title)+'">'+
  '<span class="report-compact-copy"><strong>'+esc(title)+'</strong><small>'+esc(author)+' · '+esc(reportCompactDate(createdAt,language))+'</small></span></button>';
}
