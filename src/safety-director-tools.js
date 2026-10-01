export const SAFETY_DIRECTOR_TOOLS=[
 {id:'offline',icon:'⇩',en:'Offline Work',es:'Trabajo sin conexión',group:'operations'},
 {id:'report-status',icon:'◷',en:'Report Status',es:'Estado de reportes',group:'reports'},
 {id:'correction-deadlines',icon:'⏱',en:'Correction Deadlines',es:'Fechas límite de correcciones',group:'operations',route:'corrections'},
 {id:'critical-priority',icon:'!',en:'Critical Priority',es:'Prioridad crítica',group:'operations',route:'observations'},
 {id:'activity-jha',icon:'☑',en:'JHA by Activity',es:'JHA por actividad',group:'reports',route:'safetyWalk'},
 {id:'toolbox-talk',icon:'▣',en:'Toolbox Talk & Attendance',es:'Toolbox Talk y asistencia',group:'training'},
 {id:'certifications',icon:'✓',en:'Certificates & Authorizations',es:'Certificados y autorizaciones',group:'training',route:'team'},
 {id:'out-of-service',icon:'⊘',en:'Out-of-Service Equipment',es:'Equipos fuera de servicio',group:'equipment',route:'equipmentInspection'},
 {id:'safety-net',icon:'⌗',en:'Safety Net Control',es:'Control de Safety Nets',group:'operations'},
 {id:'emergency-plan',icon:'✚',en:'Project Emergency Plan',es:'Plan de emergencia del proyecto',group:'operations'},
 {id:'incidents-near-miss',icon:'⚠',en:'Incidents & Near Misses',es:'Incidentes y Near Misses',group:'reports',route:'incident'},
 {id:'change-history',icon:'↺',en:'Change History',es:'Historial de cambios',group:'reports',route:'reportCenter'},
 {id:'director-dashboard',icon:'▦',en:'Safety Director Dashboard',es:'Dashboard del Safety Director',group:'management'},
 {id:'qr',icon:'▦',en:'Employee & Equipment QR',es:'QR de empleados y equipos',group:'management'},
 {id:'quick-hazard',icon:'⚡',en:'Quick Hazard Report',es:'Reporte rápido de peligro',group:'operations',route:'new'}
];
export function safetyDirectorToolsMarkup(tr){
 return '<section class="card safety-director-tools"><div class="section-heading"><div><small>G&E SAFETY</small><h2>'+tr('Safety Director Tools','Herramientas del Safety Director')+'</h2></div></div><p>'+tr('Advanced safety controls for the current project.','Controles avanzados de seguridad para el proyecto actual.')+'</p><div class="safety-tools-grid">'+SAFETY_DIRECTOR_TOOLS.map(tool=>'<button type="button" class="safety-tool-card" data-safety-tool="'+tool.id+'"><span class="safety-tool-icon">'+tool.icon+'</span><span>'+tr(tool.en,tool.es)+'</span></button>').join('')+'</div></section>';
}
