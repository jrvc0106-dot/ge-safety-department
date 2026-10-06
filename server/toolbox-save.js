import {createHash} from 'node:crypto';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function saveCloudToolbox(db,user,body){
 const {record,draftPhotos=[]}=body||{};
 if(!record||record.kind!=='toolbox'||!uuid.test(record.id)||!uuid.test(record.project_id)||typeof record.report_number!=='string'||!record.report_number.startsWith('TB-')||record.report_number.length>100||!record.payload||Array.isArray(record.payload)||typeof record.payload!=='object'||Buffer.byteLength(JSON.stringify(record.payload))>=2000000||!Array.isArray(draftPhotos)||draftPhotos.length>12)throw Object.assign(new Error('Invalid Toolbox Talk report.'),{status:400});
 const prefix=`${user.id}/${record.project_id}/safety_tool_toolbox/default/photos/`;
 for(const photo of draftPhotos)if(typeof photo.path!=='string'||!photo.path.startsWith(prefix)||photo.path.slice(prefix.length).includes('/')||photo.path.includes('..')||!['image/jpeg','image/png','image/webp'].includes(photo.type)||!Number.isFinite(photo.size)||photo.size<=0||photo.size>10485760)throw Object.assign(new Error('Invalid draft evidence.'),{status:400});
 const existing=await db.from('safety_tool_records').select('id').eq('id',record.id).eq('project_id',record.project_id).maybeSingle();if(existing.error)throw existing.error;if(existing.data)return existing.data;
 const photos=[];
 for(const photo of draftPhotos){
  const hash=createHash('sha256').update(photo.path).digest('hex').slice(0,32),path=`${record.project_id}/${user.id}/${record.id}/${hash}.${photo.type.split('/')[1]}`;
  const result=await db.storage.from('draft-evidence').copy(photo.path,path,{destinationBucket:'safety-tool-evidence'});
  // Deterministic paths make retry safe after a lost copy response.
  if(result.error&&!['409','400'].includes(String(result.error.statusCode))&&result.error.error!=='Duplicate'&&result.error.code!=='Duplicate')throw result.error;
  if(result.error&&!/already exists|duplicate/i.test(result.error.message||''))throw result.error;
  photos.push({path,label:String(photo.name||'Photo').slice(0,500)});
 }
 const saved=await db.from('safety_tool_records').insert({id:record.id,project_id:record.project_id,created_by:user.id,kind:'toolbox',report_number:record.report_number,payload:record.payload,photos}).select('id').single();
 if(saved.error){const confirmed=await db.from('safety_tool_records').select('id').eq('id',record.id).eq('project_id',record.project_id).maybeSingle();if(confirmed.data)return confirmed.data;throw saved.error}
 return saved.data;
}
