import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';

const dir=resolve('artifacts/pdf-quality'),file=join(dir,'nonquick-six-evidence-photos.pdf'),compactFile=join(dir,'nonquick-compact-six-evidence-photos.pdf');
await mkdir(dir,{recursive:true});
const port=4178,receiverPort=4181;
const receiver=createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:'+port);
 res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Content-Type');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
 if(req.method!=='POST'||!['/upload','/upload-compact'].includes(req.url)){res.writeHead(404);res.end();return}
 try{
  const chunks=[];let bytes=0;
  for await(const chunk of req){
   bytes+=chunk.length;
   if(bytes>25*1024*1024)throw Error('Visual PDF exceeds 25 MB test limit');
   chunks.push(chunk);
  }
  const pdf=Buffer.concat(chunks);
  if(pdf.length<10000||!pdf.subarray(0,8).toString().startsWith('%PDF-')||
    !/%%EOF\s*$/.test(pdf.subarray(-2048).toString()))throw Error('Incomplete PDF artifact');
  await writeFile(req.url==='/upload-compact'?compactFile:file,pdf);
  res.writeHead(200);res.end('saved');
 }catch(error){console.error('PDF artifact error:',error.message);res.writeHead(500);res.end('invalid')}
});
await new Promise((ok,fail)=>receiver.once('error',fail).listen(receiverPort,'127.0.0.1',ok));
const candidates=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/snap/bin/chromium'].filter(Boolean);
const chrome=candidates.find(existsSync);
if(!chrome){receiver.close();throw Error('Browser smoke test requires installed Chrome/Chromium');}
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']});
let serverErrors='';
vite.stderr.on('data',buf=>serverErrors+=buf.toString());
async function stop(){
 vite.kill('SIGTERM');
 await new Promise(resolve=>receiver.close(resolve));
}
try{
 let online=false;
 for(let i=0;i<60;i++){
  if(vite.exitCode!==null)throw Error('Vite exited early: '+serverErrors);
  try{const r=await fetch('http://127.0.0.1:'+port+'/tests/fixtures/pdf-quality-browser.html');if(r.ok){online=true;break}}catch{}
  await new Promise(ok=>setTimeout(ok,250));
 }
 if(!online)throw Error('Vite browser QA server failed to start: '+serverErrors);
 const args=['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-extensions',
  '--disable-background-networking','--no-first-run','--hide-scrollbars','--virtual-time-budget=30000',
  '--window-size=1200,1800','--dump-dom',
  'http://127.0.0.1:'+port+'/tests/fixtures/pdf-quality-browser.html'];
 const html=await new Promise((ok,fail)=>{
  const browser=spawn(chrome,args,{stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';
  browser.stdout.on('data',chunk=>stdout+=chunk.toString());
  browser.stderr.on('data',chunk=>stderr=(stderr+chunk.toString()).slice(-12000));
  const timer=setTimeout(()=>browser.kill('SIGKILL'),90000);
  browser.on('error',err=>{clearTimeout(timer);fail(err)});
  browser.on('close',(code)=>{
   clearTimeout(timer);
   if(code!==0)return fail(Error('Chrome browser smoke exited '+code+': '+stderr.slice(-2000)));
   ok(stdout);
  });
 });
 const match=html.match(/<pre id="smoke-result" data-status="(pass|fail|running)">([^<]*)<\/pre>/);
 if(!match||match[1]!=='pass')throw Error('PDF browser smoke failed: '+(match?.[2]||html.slice(-1200)));
 const saved=await readFile(file),info=await stat(file);
 const compact=await readFile(compactFile),compactInfo=await stat(compactFile);
 if(!saved.subarray(0,8).toString().startsWith('%PDF-')||info.size<10000||
   !compact.subarray(0,8).toString().startsWith('%PDF-')||compactInfo.size<10000)
   throw Error('Browser did not produce both verified PDF examples');
 console.log('Non-Quick PDF real Chromium smoke: PASS; 2-page and compact examples:',info.size,compactInfo.size);
 console.log('Chrome details:',match[2]);
 console.log('PDF artifacts:',file,compactFile);
}finally{await stop()}
