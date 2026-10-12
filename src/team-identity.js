export function normalizeMemberEmail(value){
 const email=String(value??'').trim().toLowerCase();
 if(!email||email.length>254||/\s/.test(email))return null;
 const parts=email.split('@');if(parts.length!==2)return null;
 const [local,domain]=parts;
 if(!local||local.length>64||local.startsWith('.')||local.endsWith('.')||local.includes('..'))return null;
 const labels=domain.split('.');
 if(labels.length<2||labels.some(label=>! /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)))return null;
 return email;
}
export function matchOrientationWarnings(orientation,records=[]){
 const orientationId=String(orientation?.id??'').trim();
 if(!orientationId)return [];
 return records.filter(record=>String(record?.employee_orientation_id??'').trim()===orientationId);
}

export function summarizeOrientationWarnings(records=[]){
 const counts=new Map();
 for(const record of records){
  const type=String(record?.violation_type??'').trim()||'Unspecified';
  counts.set(type,(counts.get(type)||0)+1);
 }
 return [...counts].map(([type,count])=>({type,count})).sort((a,b)=>b.count-a.count||a.type.localeCompare(b.type));
}

const FORMAL_WARNING_LEVELS=new Set(['verbal_warning','written_warning','final_warning']);
export function isFormalOrientationWarning(record){
 return FORMAL_WARNING_LEVELS.has(String(record?.action_level??''));
}
