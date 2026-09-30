// Standard uncompressed ZIP, supported by Files and desktop archive tools.
const encoder = new TextEncoder();
const crcTable = Uint32Array.from({length:256}, (_, n) => {
  for(let i=0;i<8;i++) n=(n&1)?0xedb88320^(n>>>1):n>>>1;
  return n>>>0;
});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export function createBackupZip(entries){
  if(entries.length>65535)throw Error('Too many files for a local ZIP.');
  const parts=[],central=[];let offset=0,centralSize=0;const seen=new Set();
  for(const entry of entries){
    if(!entry.name||entry.name.startsWith('/')||entry.name.includes('\\')||entry.name.split('/').some(x=>!x||x==='.'||x==='..')||seen.has(entry.name))throw Error('Invalid archive filename.');
    seen.add(entry.name);const name=encoder.encode(entry.name),bytes=entry.bytes,crc=crc32(bytes);
    if(name.length>65535||bytes.length>0xffffffff||offset+30+name.length+bytes.length>0xffffffff)throw Error('Backup exceeds ZIP limits.');
    const header=new Uint8Array(30),v=new DataView(header.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);
    v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);
    parts.push(header,name,bytes);
    const directory=new Uint8Array(46),d=new DataView(directory.buffer);
    d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,33,true);
    d.setUint32(16,crc,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);
    central.push(directory,name);centralSize+=46+name.length;offset+=30+name.length+bytes.length;
  }
  const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
  return new Blob([...parts,...central,end],{type:'application/zip'});
}
export async function prepareLocalBackup(result,progress=()=>{}){
  if(result.total_bytes>200*1024*1024)throw Error('Local backup limit is 200 MB. Use a cloud destination for larger backups. / Límite local: 200 MB. Usa la nube para respaldos mayores.');
  const entries=[];let total=0;
  for(const file of result.files){
    const response=await fetch(file.url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Backup file download failed. Retry. / Descarga fallida. Inténtalo de nuevo.');
    const bytes=new Uint8Array(await response.arrayBuffer());total+=bytes.length;
    if(total>200*1024*1024)throw Error('Local backup exceeds 200 MB.');
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
    if(bytes.length!==file.size||hash!==file.sha256)throw Error('Backup verification failed. / Falló la verificación del respaldo.');
    entries.push({name:file.name,bytes});progress(entries.length,result.files.length);
  }
  return {blob:createBackupZip(entries),name:result.backup_number+'.zip'};
}
