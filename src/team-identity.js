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
function normalizedName(value){
 return String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
}
export function matchOrientationWarnings(orientation,records=[]){
 const employeeId=String(orientation?.employee_profile_id??'').trim();
 if(employeeId)return records.filter(record=>String(record?.employee_id??'')===employeeId);
 const employeeName=normalizedName(orientation?.employee_name);
 if(!employeeName)return [];
 return records.filter(record=>normalizedName(record?.employee_name||record?.employee?.name)===employeeName);
}
