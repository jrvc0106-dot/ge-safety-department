import {HIRING_SOURCE_FIELDS,HIRING_EMPLOYER_FIELDS,HIRING_OPTIONAL_FIELDS,HIRING_SIGNATURE_FIELDS} from '../src/hiring-form-schema.js';
const values={};let page=1;const root=document.querySelector('#fields'),status=document.querySelector('#status');
const sensitive=/SSN|Birth_Date|DOB/i;
const label=(name)=>name.replace(/^(WBS|W4|I9|Handbook|NonDisparagement)_/,'').replaceAll('_',' ');
function render(){
 root.replaceChildren();document.querySelector('#title').textContent='Página '+page+' de 8';
 const fields=HIRING_SOURCE_FIELDS[page]||[];
 if(!fields.length){const p=document.createElement('p');p.textContent='Página original sin campos digitales detectados. Se conservará íntegra en el PDF.';root.append(p)}
 for(const name of fields){
  const employer=HIRING_EMPLOYER_FIELDS.has(name),sign=HIRING_SIGNATURE_FIELDS.has(name),optional=HIRING_OPTIONAL_FIELDS.has(name);
  const wrap=document.createElement('label');wrap.className='field';
  const text=document.createElement('strong');text.textContent=label(name)+' · '+(employer?'G&E / Empleador':'Solicitante')+(sign?' · Firma pendiente de validación':'')+(optional?' · Opcional':'');
  const input=document.createElement('input');input.type=sensitive.test(name)?'password':'text';input.autocomplete='off';input.value=values[name]||'';input.placeholder=employer?'Solo G&E / Employer only':sign?'Firma electrónica por configurar / E-sign setup required':'Completar / Fill in';
  if(employer){input.disabled=true}
  if(sign){input.disabled=true}
  input.oninput=()=>{values[name]=input.value;update(wrap,input,optional);progress()};
  wrap.append(text,input);if(sign){const note=document.createElement('small');note.textContent='Este espacio exige firma electrónica individual. No se sustituye por texto.';wrap.append(note)}
  update(wrap,input,optional);root.append(wrap);
 }
 document.querySelector('#back').disabled=page===1;document.querySelector('#next').disabled=page===8;progress();
}
function update(wrap,input,optional){const pending=!input.value.trim()&&!optional;wrap.classList.toggle('pending',pending);input.setAttribute('aria-invalid',String(pending&&!input.disabled))}
function progress(){const all=Object.values(HIRING_SOURCE_FIELDS).flat();const filled=all.filter(k=>String(values[k]||'').trim()).length;status.textContent=filled+' de 57 campos con datos en esta sesión. Campos de G&E y firmas requieren pasos separados.'}
document.querySelector('#back').onclick=()=>{page--;render()};document.querySelector('#next').onclick=()=>{page++;render()};render();
