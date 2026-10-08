const reportTime=report=>{const value=Date.parse(report?.created_at||'');return Number.isFinite(value)?value:0};

export function groupWalkReportsByCreator(rows=[],unknownCreator='Unknown creator'){
 const groups=new Map();
 for(const row of rows){
  const name=String(row?.creator?.name||'').trim()||unknownCreator;
  const key=name.normalize('NFKC').toLocaleLowerCase('en-US');
  if(!groups.has(key))groups.set(key,{name,reports:[]});
  groups.get(key).reports.push(row);
 }
 const result=[...groups.values()];
 for(const group of result)group.reports.sort((a,b)=>reportTime(b)-reportTime(a));
 return result.sort((a,b)=>reportTime(b.reports[0])-reportTime(a.reports[0])||a.name.localeCompare(b.name,undefined,{sensitivity:'base'}));
}

export function groupFinalWalkReportsByCreator(rows=[],documents=[],unknownCreator='Unknown creator'){
 const latestStatusByReport=new Map();
 for(const document of documents||[]){
  if(document?.report_type!=='daily_safety_walk'||!document?.source_id)continue;
  const sourceId=String(document.source_id),timestamp=reportTime(document);
  const previous=latestStatusByReport.get(sourceId);
  if(!previous||timestamp>=previous.timestamp)latestStatusByReport.set(sourceId,{status:document.document_status,timestamp});
 }
 return groupWalkReportsByCreator((rows||[]).filter(row=>latestStatusByReport.get(String(row?.id||''))?.status==='final'),unknownCreator);
}
