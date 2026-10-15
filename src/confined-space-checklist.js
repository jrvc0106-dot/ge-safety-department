// G&E confined-space PPE checklist; use with a site-specific hazard assessment.
// OSHA 29 CFR 1926.1204(d), 1926.1206(n), 1926.1211.
export const confinedSpacePPE=[
 ['hard_hat','Hard hat','Casco'],
 ['eyes','Safety glasses / goggles','Lentes de protección'],
 ['gloves','Hazard-appropriate gloves','Guantes según el riesgo'],
 ['boots','Safety footwear','Botas de seguridad'],
 ['vest','High-visibility apparel','Ropa de alta visibilidad'],
 ['harness','Full-body harness (where required)','Arnés integral (cuando corresponda)'],
 ['retrieval','Retrieval line / tripod / winch where required','Línea de extracción / trípode / torno cuando corresponda'],
 ['monitor','Gas testing and continuous monitoring equipment','Detector de gases y monitoreo continuo'],
 ['respiratory','Approved respirator under respiratory protection program, if needed','Respirador autorizado bajo programa de protección respiratoria, si se requiere'],
 ['hearing','Hearing protection as needed','Protección auditiva según exposición'],
 ['lights','Appropriate lighting / electrical protection','Iluminación adecuada / protección eléctrica'],
 ['radio','Communication equipment','Equipo de comunicación'],
 ['ventilation','Ventilation and failure detection equipment','Ventilación y detección de fallas']
];
export const confinedSpaceCheckItems=[
 ['evaluated','Space classification and hazards assessed','Espacio clasificado y riesgos evaluados'],
 ['isolation','LOTO and hazard isolation verified','LOTO y aislamiento verificados'],
 ['testing','Pre-entry atmospheric testing recorded','Pruebas atmosféricas iniciales registradas'],
 ['monitoring','Monitoring and ventilation-failure detection established','Monitoreo y detección de fallas de ventilación'],
 ['attendant','Attendant assigned outside space','Vigía designado afuera'],
 ['rescue','Rescue service capability, availability and contact verified','Capacidad, disponibilidad y contacto de rescate verificados'],
 ['communication','Communication and personnel accountability verified','Comunicación y control de personal verificados'],
 ['barricade','Entry controls and barriers installed','Barreras y controles de acceso instalados'],
 ['equipment','PPE and retrieval equipment inspected','PPE y extracción inspeccionados'],
 ['permits','Additional applicable work permits reviewed','Otros permisos de trabajo revisados']
];
export function confinedSpaceStatus(record,now=Date.now()){
 if(!record || !record.authorizedBySupervisor || !record.signatureVerified)return 'not_authorized';
 if(record.cancelledAt)return 'cancelled';
 if(record.closedAt)return 'closed';
 const end=Date.parse(record.expiresAt);
 if(!Number.isFinite(end)||end<=now)return 'expired';
 const start=Date.parse(record.startsAt);
 if(!Number.isFinite(start)||start>now)return 'not_yet_valid';
 return record.hazardsControlled&&record.rescueVerified&&record.atmosphereVerified?'authorized':'not_authorized';
}
