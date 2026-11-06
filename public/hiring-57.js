const HIRING_SOURCE_FIELDS={
  1:['WBS_Employee_Name','WBS_Client_Number'],
  2:['WBS_Employee_Signature_Typed','WBS_Sign_Date','WBS_Employee_Name','WBS_Birth_Date','WBS_Address','WBS_City_State_Zip','WBS_Phone','WBS_SSN','WBS_Email','WBS_Emergency_Contact','WBS_Emergency_Phone'],
  3:['WBS_Client_Employee_Name','WBS_Department','WBS_Job_Code','WBS_Rate_Of_Pay','WBS_Work_Comp_Code','WBS_Job_Description','WBS_Original_Hire_Date'],
  4:['W4_First_Name','W4_Last_Name','W4_SSN','W4_Address','W4_City_State_Zip','W4_Dep_Credits','W4_Other_Dependents','W4_Other_Income','W4_Deductions','W4_Extra_Withholding','W4_Employee_Signature_Typed','W4_Employee_Sign_Date'],
  5:['I9_Last_Name','I9_First_Name','I9_Middle_Initial','I9_Other_Names','I9_Address','I9_Apt','I9_City','I9_State','I9_Zip','I9_DOB','I9_SSN','I9_Email','I9_Phone','I9_Employee_Signature_Typed','I9_Todays_Date','I9_Employer_Name_Title','I9_Employer_Signature_Typed','I9_Employer_Date','I9_First_Day_Employment'],
  6:['Handbook_Print_Full_Name','Handbook_Employee_Signature_Typed','Handbook_Sign_Date'],
  7:['NonDisparagement_Employee_Name','NonDisparagement_Employee_Signature_Typed','NonDisparagement_Date'],
  8:[]
};
const HIRING_EMPLOYER_FIELDS=new Set([
 'WBS_Client_Number','WBS_Client_Employee_Name','WBS_Department','WBS_Job_Code',
 'WBS_Rate_Of_Pay','WBS_Work_Comp_Code','WBS_Job_Description','WBS_Original_Hire_Date',
 'I9_Employer_Name_Title','I9_Employer_Signature_Typed','I9_Employer_Date','I9_First_Day_Employment'
]);
const HIRING_SIGNATURE_FIELDS=new Set([
 'WBS_Employee_Signature_Typed','W4_Employee_Signature_Typed','I9_Employee_Signature_Typed',
 'I9_Employer_Signature_Typed','Handbook_Employee_Signature_Typed','NonDisparagement_Employee_Signature_Typed'
]);
const HIRING_OPTIONAL_FIELDS=new Set([
 'I9_Middle_Initial','I9_Other_Names','I9_Apt',
 'W4_Dep_Credits','W4_Other_Dependents','W4_Other_Income','W4_Deductions','W4_Extra_Withholding'
]);

const values={};let page=1;const root=document.querySelector('#fields'),status=document.querySelector('#status');
const sensitive=/SSN|Birth_Date|DOB/i;
const label=(name)=>name.replace(/^(WBS|W4|I9|Handbook|NonDisparagement)_/,'').replaceAll('_',' ');
function render(){
 root.replaceChildren();document.querySelector('#title').textContent='Page '+page+' of 8';
 const fields=HIRING_SOURCE_FIELDS[page]||[];
 if(!fields.length){const p=document.createElement('p');p.textContent='No digital fields were detected on this source page. It will be preserved in full in the PDF.';root.append(p)}
 for(const name of fields){
  const employer=HIRING_EMPLOYER_FIELDS.has(name),sign=HIRING_SIGNATURE_FIELDS.has(name),optional=HIRING_OPTIONAL_FIELDS.has(name);
  const wrap=document.createElement('label');wrap.className='field';
  const text=document.createElement('strong');text.textContent=label(name)+' · '+(employer?'G&E / Employer':'Applicant')+(sign?' · Signature verification pending':'')+(optional?' · Optional':'');
  const input=document.createElement('input');input.type=sensitive.test(name)?'password':'text';input.autocomplete='off';input.value=values[name]||'';input.placeholder=employer?'G&E staff only':sign?'Electronic signature setup required':'Complete field';
  if(employer){input.disabled=true}
  if(sign){input.disabled=true}
  input.oninput=()=>{values[name]=input.value;update(wrap,input,optional);progress()};
  wrap.append(text,input);if(sign){const note=document.createElement('small');note.textContent='This field requires an individual electronic signature. Typed text is not a substitute.';wrap.append(note)}
  update(wrap,input,optional);root.append(wrap);
 }
 document.querySelector('#back').disabled=page===1;document.querySelector('#next').disabled=page===8;progress();
}
function update(wrap,input,optional){const pending=!input.value.trim()&&!optional;wrap.classList.toggle('pending',pending);input.setAttribute('aria-invalid',String(pending&&!input.disabled))}
function progress(){const all=Object.values(HIRING_SOURCE_FIELDS).flat();const filled=all.filter(k=>String(values[k]||'').trim()).length;status.textContent=filled+' of 57 fields completed in this session. G&E-only fields and signatures require separate steps.'}
document.querySelector('#back').onclick=()=>{page--;render()};document.querySelector('#next').onclick=()=>{page++;render()};render();
