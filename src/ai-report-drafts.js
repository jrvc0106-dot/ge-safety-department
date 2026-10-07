export function filterAiReportDraftSuggestions(requestedFields,suggestions){
 if(!Array.isArray(requestedFields)||!Array.isArray(suggestions))return [];
 const allowed=new Map(requestedFields.filter(field=>field&&typeof field.name==="string"&&Number.isInteger(field.max_length)&&field.max_length>0).map(field=>[field.name,field]));
 const seen=new Set(),accepted=[];
 for(const item of suggestions){
  const fieldName=typeof item?.field_name==="string"?item.field_name:"",field=allowed.get(fieldName),text=typeof item?.text==="string"?item.text.trim():"";
  if(!field||seen.has(fieldName)||!text||text.length>field.max_length)continue;
  seen.add(fieldName);accepted.push({field_name:fieldName,text});
 }
 return accepted;
}
