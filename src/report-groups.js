export function groupWalkReportsByCreator(rows=[],unknownCreator='Unknown creator'){
 const groups=new Map();
 for(const row of rows){
  const name=String(row?.creator?.name||'').trim()||unknownCreator;
  const key=name.normalize('NFKC').toLocaleLowerCase('en-US');
  if(!groups.has(key))groups.set(key,{name,reports:[]});
  groups.get(key).reports.push(row);
 }
 return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base'}));
}
