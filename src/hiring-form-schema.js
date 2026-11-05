// Mapping of the user's eight-page 2026 FORM APPLICATION master.
// Never alter the original document: values belong in a completed copy only.
export const HIRING_ORIGINAL_PAGE_COUNT=8;
export const HIRING_SOURCE_FIELDS={
  1:['WBS_Employee_Name','WBS_Client_Number'],
  2:['WBS_Employee_Signature_Typed','WBS_Sign_Date','WBS_Employee_Name','WBS_Birth_Date','WBS_Address','WBS_City_State_Zip','WBS_Phone','WBS_SSN','WBS_Email','WBS_Emergency_Contact','WBS_Emergency_Phone'],
  3:['WBS_Client_Employee_Name','WBS_Department','WBS_Job_Code','WBS_Rate_Of_Pay','WBS_Work_Comp_Code','WBS_Job_Description','WBS_Original_Hire_Date'],
  4:['W4_First_Name','W4_Last_Name','W4_SSN','W4_Address','W4_City_State_Zip','W4_Dep_Credits','W4_Other_Dependents','W4_Other_Income','W4_Deductions','W4_Extra_Withholding','W4_Employee_Signature_Typed','W4_Employee_Sign_Date'],
  5:['I9_Last_Name','I9_First_Name','I9_Middle_Initial','I9_Other_Names','I9_Address','I9_Apt','I9_City','I9_State','I9_Zip','I9_DOB','I9_SSN','I9_Email','I9_Phone','I9_Employee_Signature_Typed','I9_Todays_Date','I9_Employer_Name_Title','I9_Employer_Signature_Typed','I9_Employer_Date','I9_First_Day_Employment'],
  6:['Handbook_Print_Full_Name','Handbook_Employee_Signature_Typed','Handbook_Sign_Date'],
  7:['NonDisparagement_Employee_Name','NonDisparagement_Employee_Signature_Typed','NonDisparagement_Date'],
  8:[]
};
export const HIRING_EMPLOYER_FIELDS=new Set([
 'WBS_Client_Number','WBS_Client_Employee_Name','WBS_Department','WBS_Job_Code',
 'WBS_Rate_Of_Pay','WBS_Work_Comp_Code','WBS_Job_Description','WBS_Original_Hire_Date',
 'I9_Employer_Name_Title','I9_Employer_Signature_Typed','I9_Employer_Date','I9_First_Day_Employment'
]);
export const HIRING_SIGNATURE_FIELDS=new Set([
 'WBS_Employee_Signature_Typed','W4_Employee_Signature_Typed','I9_Employee_Signature_Typed',
 'I9_Employer_Signature_Typed','Handbook_Employee_Signature_Typed','NonDisparagement_Employee_Signature_Typed'
]);
export const HIRING_OPTIONAL_FIELDS=new Set([
 'I9_Middle_Initial','I9_Other_Names','I9_Apt',
 'W4_Dep_Credits','W4_Other_Dependents','W4_Other_Income','W4_Deductions','W4_Extra_Withholding'
]);
// W-4 elections, I-9 attestation choices, and I-9 employer document review are
// mandatory external compliance steps, not inferred from typed text fields.
export function hiringFieldAudit(values={},role='applicant'){
 const missing=[],optional=[],blocked=[];
 for(const [page,fields] of Object.entries(HIRING_SOURCE_FIELDS)){
  for(const field of fields){
   const owner=HIRING_EMPLOYER_FIELDS.has(field)?'employer':'applicant';
   if(owner!==role){blocked.push({page:Number(page),field});continue}
   if(HIRING_OPTIONAL_FIELDS.has(field)){optional.push({page:Number(page),field});continue}
   if(!String(values[field]??'').trim())missing.push({page:Number(page),field,signature:HIRING_SIGNATURE_FIELDS.has(field)});
  }
 }
 return {missing,optional,blocked,complete:missing.length===0};
}
export function hiringSafeFolderName(last,first){
 const clean=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9 -]/g,'').replace(/\s+/g,' ').trim().slice(0,70);
 const a=clean(last),b=clean(first);
 if(!a||!b)throw Error('First and last name are required.');
 return a+', '+b;
}
