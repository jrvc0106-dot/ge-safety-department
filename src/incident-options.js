export const ACCIDENT_MECHANISMS=[
 ['fall_height','Fall from height','Caída desde altura'],
 ['slip_trip','Slip / trip / same-level fall','Resbalón / tropiezo / caída al mismo nivel'],
 ['falling_object','Falling object','Objeto que cae'],
 ['struck_by','Struck by object / equipment','Golpe por objeto / equipo'],
 ['caught_between','Caught in / between','Atrapamiento entre objetos'],
 ['electrical','Electrical contact / arc','Contacto eléctrico / arco'],
 ['lifting','Lifting / overexertion / strain','Levantamiento / sobreesfuerzo'],
 ['cut_puncture','Cut / puncture / sharp edge','Corte / perforación / borde filoso'],
 ['eye_exposure','Eye exposure / foreign object','Exposición ocular / objeto extraño'],
 ['heat','Heat exposure','Exposición al calor'],
 ['chemical','Chemical exposure / spill','Exposición química / derrame'],
 ['dust','Dust / silica / inhalation','Polvo / sílice / inhalación'],
 ['burn_fire','Burn / fire / explosion','Quemadura / incendio / explosión'],
 ['vehicle','Vehicle / traffic / MOT','Vehículo / tráfico / MOT'],
 ['mobile_equipment','Forklift / heavy equipment','Forklift / equipo pesado'],
 ['crane_rigging','Crane / rigging / suspended load','Grúa / rigging / carga suspendida'],
 ['ladder_scaffold','Ladder / scaffold / platform','Escalera / andamio / plataforma'],
 ['structural','Structural / formwork failure','Falla estructural / formaleta'],
 ['excavation','Excavation / trench collapse','Excavación / colapso de zanja'],
 ['tool','Power tool / machinery','Herramienta eléctrica / maquinaria'],
 ['confined_space','Confined space / oxygen deficiency','Espacio confinado / falta de oxígeno'],
 ['weather','Lightning / severe weather','Rayos / clima severo'],
 ['other','Other / describe in narrative','Otro / describir en los hechos']
];
export function accidentMechanismLabel(value,tr){const row=ACCIDENT_MECHANISMS.find(x=>x[0]===value);return row?tr(row[1],row[2]):value||tr('Not specified','Sin especificar')}
export function incidentTypeLabel(value,tr){const labels={injury:['Injury / accident','Lesión / accidente'],illness:['Occupational illness','Enfermedad ocupacional'],near_miss:['Near Miss / Close Call','Near Miss / Casi accidente'],property_damage:['Property damage','Daño a propiedad'],environmental:['Environmental incident','Incidente ambiental']};return labels[value]?tr(...labels[value]):value||tr('Not specified','Sin especificar')}
export function attachIncidentOptions(form,tr){
 const type=form.elements.namedItem('incident_type');
 const update=()=>{const near=type.value==='near_miss';for(const button of form.querySelectorAll('[data-event-mode]'))button.setAttribute('aria-pressed',String(button.dataset.eventMode===type.value));const potential=form.querySelector('[data-near-miss]');if(potential)potential.hidden=!near;const label=form.querySelector('[data-severity-label]');if(label)label.textContent=near?tr('Potential severity','Severidad potencial'):tr('Severity','Severidad');};
 for(const button of form.querySelectorAll('[data-event-mode]'))button.onclick=()=>{type.value=button.dataset.eventMode;type.dispatchEvent(new Event('change',{bubbles:true}));};
 form.addEventListener('change',update);update();
}
