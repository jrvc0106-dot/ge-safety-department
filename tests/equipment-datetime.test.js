import {test} from 'node:test';
import assert from 'node:assert/strict';
import {equipmentInspectionUtc,equipmentDateTimeInput,equipmentDay,equipmentReportDate,restoredEquipmentDate} from '../src/equipment-datetime.js';

test('inspection date is preserved in Florida / Eastern, independent of device timezone',()=>{
 assert.equal(equipmentInspectionUtc('2026-10-22T09:34'),'2026-10-22T13:34:00.000Z');
 assert.equal(equipmentDateTimeInput('2026-10-22T13:34:00Z'),'2026-10-22T09:34');
 assert.equal(equipmentDay('2026-10-22T13:34:00Z'),'2026-10-22');
 assert.match(equipmentReportDate('2026-10-22T13:34:00Z'),/Oct 22, 2026/);
 assert.match(equipmentReportDate('2026-10-22T13:34:00Z'),/9:34.*EDT/);
});
test('Florida daylight saving and standard time correctly convert to UTC',()=>{
 assert.equal(equipmentInspectionUtc('2026-07-22T09:34'),'2026-07-22T13:34:00.000Z');
 assert.equal(equipmentInspectionUtc('2026-01-22T09:34'),'2026-01-22T14:34:00.000Z');
 assert.throws(()=>equipmentInspectionUtc('2026-03-08T02:30'),/daylight saving/);
 assert.throws(()=>equipmentInspectionUtc('2026-02-31T10:00'),/Invalid/);
});
test('a prior-day equipment draft resets only the inspection timestamp and never erases checklist fields',()=>{
 const now=new Date('2026-10-22T13:34:00Z');
 const payload={inspection_at:'2026-10-21T12:17',equipment_name:'Forklift #1',check_0:'fail'};
 const result={...payload,inspection_at:restoredEquipmentDate(payload.inspection_at,now)};
 assert.equal(result.inspection_at,'2026-10-22T09:34');
 assert.equal(result.equipment_name,'Forklift #1');
 assert.equal(result.check_0,'fail');
 assert.equal(restoredEquipmentDate('2026-10-22T07:15',now),'2026-10-22T07:15');
 assert.equal(restoredEquipmentDate(undefined,now),'2026-10-22T09:34');
});
