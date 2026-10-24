import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safetyPdfFilename,safetyReportSnapshot,createSafetyIntelligencePdf,periodicReportTitles,PERIODIC_REPORT_AUTHOR,PERIODIC_REPORT_ROLE,fullPageGeWatermarkLayout} from '../src/safety-intelligence-report.js';

const run={
 cadence:'weekly',period_start:'2026-10-11T00:00:00.000Z',period_end:'2026-10-18T00:00:00.000Z',computed_at:'2026-10-18T02:00:00.000Z',
 ai_status:'complete',
 metrics:{period_days:7,open_observations_now:2,limited:false,
 current:{
  observations:{count:5,high:2,closed:3,categories:[{label:'Fall Protection',count:3},{label:'Housekeeping',count:2}]},
  daily_reports:{count:4,unsafe:1},incidents:{count:2},
  equipment_inspections:{count:3,defects:1},disciplinary_actions:{count:1},safety_tools:{count:2}
 },
 previous:{observations:{count:4},daily_reports:{count:2},incidents:{count:1},equipment_inspections:{count:1},disciplinary_actions:{count:0},safety_tools:{count:1}}},
 insights:[{title:'Repeated observation category',summary:'Fall Protection was the most frequent documented observation.',question:'Verify field controls and documented follow-ups.'}]
};

test('PDF summary uses only the selected saved project snapshot and correctly compares periods',()=>{
 const p=safetyReportSnapshot(run,'Miramar Cove');
 assert.equal(p.project,'Miramar Cove');
 assert.equal(p.total,17);
 assert.equal(p.prior,9);
 assert.equal(p.change,8);
 assert.equal(p.openObservations,2);
 assert.equal(p.breakdown.length,6);
 assert.equal(p.insights.length,1);
 assert.equal(p.highPriority,2);
});
test('filename is stable, human-readable, period-qualified and sanitized',()=>{
 assert.equal(safetyPdfFilename('Miramar Cove',run),'Weekly Safety Trends Report Miramar Cove 10.18.2026 By G&E.pdf');
 assert.equal(safetyPdfFilename('Miramar Cove',{...run,cadence:'monthly'}),'Monthly Safety Trends Report Miramar Cove 10.18.2026 By G&E.pdf');
 assert.ok(!safetyPdfFilename('../@Danger 🤖', {...run,cadence:'monthly'}).includes('..'));
});
test('PDF headings follow the saved weekly or monthly cadence and show the requested author',()=>{
 assert.deepEqual(periodicReportTitles('weekly'),{es:'REPORTE SEMANAL',en:'WEEKLY REPORT'});
 assert.deepEqual(periodicReportTitles('monthly'),{es:'REPORTE MENSUAL',en:'MONTHLY REPORT'});
 assert.equal(PERIODIC_REPORT_AUTHOR,'Jairo Valdivia');
 assert.equal(PERIODIC_REPORT_ROLE,'Safety Director');
 assert.equal(periodicReportTitles('weekly').es.includes('INTELLIGENCE'),false);
 assert.equal(periodicReportTitles('monthly').es.includes('INTELLIGENCE'),false);
});
test('AI missing: preserve aggregate facts, explicitly no fabricated AI findings',()=>{
 const p=safetyReportSnapshot({...run,ai_status:'insufficient',insights:[{title:'invalid'}]},'Domus II');
 assert.equal(p.aiStatus,'insufficient');
 assert.equal(p.insights.length,0);
 assert.equal(p.total,17);
});
test('high-quality vector PDF exports with dynamic pagination, no screenshot dependency',async()=>{
 const expanded={...run,metrics:{...run.metrics,current:{...run.metrics.current,observations:{
  ...run.metrics.current.observations,
  categories:Array.from({length:8},(_,i)=>({label:'Fall protection / housekeeping category '+(i+1),count:20-i}))
 }}},insights:Array.from({length:3},(_,i)=>({
  title:'Finding '+(i+1),
  summary:'Documented aggregate records require professional review. '.repeat(9),
  question:'Which controls should be checked and documented by qualified Safety personnel? '.repeat(4)
 }))};
 const pdf=await createSafetyIntelligencePdf(expanded,'G&E Florida - Safety Audit');
 assert.equal(pdf.type,'application/pdf');
 assert.ok(pdf.size>5000,'must contain a substantive report');
 const data=Buffer.from(await pdf.arrayBuffer());
 assert.equal(data.subarray(0,5).toString(),'%PDF-');
 const pages=(data.toString('latin1').match(/\/Type \/Page\b/g)||[]).length;
 assert.ok(pages>=2,'long insights should automatically paginate, got '+pages);
});

test('monthly PDF embeds the monthly report name and Jairo Valdivia as author, not Safety Intelligence',async()=>{
 const blob=await createSafetyIntelligencePdf({...run,cadence:'monthly'},'Miramar Cove');
 const data=Buffer.from(await blob.arrayBuffer()).toString('latin1');
 assert.match(data,/Jairo Valdivia/);
 assert.match(data,/REPORTE MENSUAL/);
 assert.doesNotMatch(data,/Safety Intelligence/i);
});

test('G&E full-page watermark is centered, proportional and 6% opaque on portrait Letter pages',()=>{
 const sizes=[[900,300],[300,900],[700,700]];
 for(const [width,height] of sizes){
  const placement=fullPageGeWatermarkLayout(width,height,612,792);
  assert.equal(placement.opacity,.06);
  assert.ok(placement.width>=0&&placement.height>=0);
  assert.ok(placement.x>=19.99&&placement.y>=19.99);
  assert.ok(placement.x+placement.width<=592.01);
  assert.ok(placement.y+placement.height<=772.01);
  assert.ok(Math.abs(placement.width/placement.height-width/height)<1e-10,'original logo ratio must not change');
  assert.ok(Math.abs((placement.x+placement.width/2)-306)<.01);
  assert.ok(Math.abs((placement.y+placement.height/2)-396)<.01);
  assert.ok(Math.abs(placement.width-572)<.01||Math.abs(placement.height-752)<.01,'watermark should fill almost all page width or height');
 }
 const landscape=fullPageGeWatermarkLayout(900,300,612,792);
 assert.ok(landscape.width>550,'landscape GE watermark must be almost double the old 290pt width');
});
