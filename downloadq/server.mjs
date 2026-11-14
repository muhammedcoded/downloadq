import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { URL } from 'node:url';
import net from 'node:net';
import { inspectSocial, downloadSocial } from './social.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||3000);
const MAX_BYTES=100*1024*1024;
const TIMEOUT_MS=18000;
const MAX_REDIRECTS=3;
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};
const EXTENSIONS=new Set(['.mp4','.webm','.mp3','.wav','.m4a','.ogg','.jpg','.jpeg','.png','.webp','.gif','.mov','.pdf']);
const MEDIA_MIME=/^(video\/|audio\/|image\/)/i;
const RESTRICTED_HOSTS=[/^(?:localhost|localhost\.localdomain)$/i,/(?:^|\.)local$/i,/(?:^|\.)internal$/i,/(?:^|\.)localhost$/i];
const isPrivateIp=(ip)=>{
 if (net.isIP(ip)===4){const o=ip.split('.').map(Number);return o[0]===0||o[0]===10||o[0]===127||o[0]>=224||(o[0]===169&&o[1]===254)||(o[0]===172&&o[1]>=16&&o[1]<=31)||(o[0]===192&&o[1]===168)||(o[0]===100&&o[1]>=64&&o[1]<=127)||(o[0]===192&&o[1]===0)||(o[0]===198&&(o[1]===18||o[1]===19));}
 if(net.isIP(ip)===6){const x=ip.toLowerCase();return x==='::1'||x==='::'||x.startsWith('fc')||x.startsWith('fd')||x.startsWith('fe8')||x.startsWith('fe9')||x.startsWith('fea')||x.startsWith('feb')||x.startsWith('ff')||x.startsWith('2001:db8:')||x.startsWith('::ffff:')||x.startsWith('2001:0:');}
 return true;
};
export function validateUrl(raw){
 let u;try{u=new URL(raw);}catch{throw new Error('Enter a complete HTTPS direct media URL.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||!u.hostname||RESTRICTED_HOSTS.some(r=>r.test(u.hostname))||net.isIP(u.hostname))throw new Error('Only public HTTPS media URLs are allowed.');
 return u;
}
export async function resolvePublic(hostname){
 let addresses;try{addresses=await lookup(hostname,{all:true,verbatim:true});}catch{throw new Error('Could not resolve the media server.');}
 if(!addresses.length||addresses.some(a=>isPrivateIp(a.address)))throw new Error('Private or restricted network addresses are not allowed.');
 return addresses[0];
}
export function detectPlatform(raw){
 let host;try{host=new URL(raw).hostname.toLowerCase().replace(/^www\./,'');}catch{return null;}
 const map=[['youtube',['youtube.com','youtu.be']],['tiktok',['tiktok.com']],['instagram',['instagram.com']],['facebook',['facebook.com','fb.watch']],['x',['x.com','twitter.com']],['linkedin',['linkedin.com']]];
 for(const [id,domains] of map)if(domains.some(d=>host===d||host.endsWith('.'+d)))return id;
 return null;
}
function mediaName(u,type){
 const raw=decodeURIComponent(u.pathname.split('/').pop()||'download').replace(/[^\w.() -]/g,'_').slice(0,90);
 const ext=path.extname(raw).toLowerCase();const byMime={'video/mp4':'.mp4','video/webm':'.webm','audio/mpeg':'.mp3','audio/mp4':'.m4a','image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif'};
 const base=raw||'download';return EXTENSIONS.has(ext)?base:base.replace(/\.[^.]+$/,'')+(byMime[type?.split(';')[0].toLowerCase()]||'.bin');
}
function requestOnce(u,method,ip){
 return new Promise((resolve,reject)=>{
  const req=https.request(u,{method,headers:{'User-Agent':'DownloadQ/1.0 (+media utility)','Accept':'video/*,audio/*,image/*,application/octet-stream;q=0.8','Accept-Encoding':'identity'},lookup:(hostname,options,callback)=>callback(null,ip.address,ip.family),timeout:TIMEOUT_MS},resolve);
  req.on('timeout',()=>req.destroy(new Error('Media server timed out.')));req.on('error',reject);req.end();
 });
}
export async function openMedia(raw,method='GET'){
 let url=validateUrl(raw);
 for(let redirect=0;redirect<=MAX_REDIRECTS;redirect++){
  const ip=await resolvePublic(url.hostname);
  const response=await requestOnce(url,method,ip);
  const status=response.statusCode||0;
  if([301,302,303,307,308].includes(status)){
   const to=response.headers.location;response.resume();if(!to)throw new Error('Redirect missing destination.');if(redirect===MAX_REDIRECTS)throw new Error('Too many redirects.');url=validateUrl(new URL(to,url).href);continue;
  }
  if(status<200||status>=300){response.resume();throw new Error(`Media server returned HTTP ${status}.`);}
  const contentType=String(response.headers['content-type']||'').toLowerCase();
  const ext=path.extname(url.pathname).toLowerCase();
  if(!MEDIA_MIME.test(contentType)&&!(EXTENSIONS.has(ext)&&/^(application\/octet-stream|binary\/octet-stream|)$/i.test(contentType))){response.resume();throw new Error('The URL does not point to a downloadable media file.');}
  const length=Number(response.headers['content-length']||0);
  if(length>MAX_BYTES){response.resume();throw new Error('File exceeds the 100 MB limit.');}
  return {response,url,contentType:contentType||'application/octet-stream',length,name:mediaName(url,contentType)};
 }
 throw new Error('Too many redirects.');
}
function sendJson(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'none'});res.end(JSON.stringify(data));}
function readBody(req){return new Promise((resolve,reject)=>{let str='';req.on('data',b=>{str+=b;if(str.length>4000){req.destroy();reject(new Error('Request too large.'));}});req.on('end',()=>{try{resolve(JSON.parse(str));}catch{reject(new Error('Invalid JSON.'));}});req.on('error',reject);});}
let activeSocialDownloads=0;
const RATE=new Map();function rateLimit(req){const key=req.socket.remoteAddress||'unknown';let item=RATE.get(key);if(!item||Date.now()-item.since>60000){item={since:Date.now(),count:0};RATE.set(key,item);}item.count++;return item.count<=45;}
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  if(u.pathname.startsWith('/api/')){
   if(!rateLimit(req))return sendJson(res,429,{error:'Too many requests. Please try again shortly.'});
   if(u.pathname==='/api/health')return sendJson(res,200,{ok:true,product:'DownloadQ'});
   if((u.pathname==='/api/social/inspect'||u.pathname==='/api/youtube/inspect')&&req.method==='POST'){
    const body=await readBody(req);
    if(body.confirmRights!==true)return sendJson(res,400,{error:'Please confirm you have permission to download this video.'});
    try{return sendJson(res,200,await inspectSocial(body.url));}
    catch(e){return sendJson(res,e.status||422,{error:e.message});}
   }
   if((u.pathname==='/api/social/download'||u.pathname==='/api/youtube/download')&&req.method==='GET'){
    if(activeSocialDownloads>=2)return sendJson(res,429,{error:'Downloads are busy. Please try again shortly.'});
    if(u.searchParams.get('confirm')!=='yes')return sendJson(res,400,{error:'Permission confirmation required.'});
    activeSocialDownloads++;
    try{
     const file=await downloadSocial(u.searchParams.get('url')||'',u.searchParams.get('format')||'mp4');
     try{
      res.writeHead(200,{'Content-Type':file.format==='mp3'?'audio/mpeg':'video/mp4','Content-Length':file.size,'Content-Disposition':`attachment; filename="${file.name}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      await pipeline(fs.createReadStream(file.file),res);
     }finally{await fs.promises.rm(file.dir,{force:true,recursive:true});}
    }catch(e){if(!res.headersSent)return sendJson(res,e.status||422,{error:e.message});res.destroy();}finally{activeSocialDownloads--;}return;
   }
   if(u.pathname==='/api/inspect'&&req.method==='POST'){
    const {url}=await readBody(req);if(detectPlatform(url))return sendJson(res,422,{error:'Social-platform pages require authorized provider integration. Use the platform tool for next steps.',platform:detectPlatform(url)});
    const result=await openMedia(url,'HEAD');result.response.resume();return sendJson(res,200,{name:result.name,type:result.contentType,size:result.length||null,downloadable:true,url});
   }
   if(u.pathname==='/api/download'&&req.method==='GET'){
    const raw=u.searchParams.get('url')||'';if(detectPlatform(raw))return sendJson(res,422,{error:'This platform page is not a direct media file.'});
    const result=await openMedia(raw,'GET');
    res.writeHead(200,{'Content-Type':result.contentType,'Content-Disposition':`attachment; filename="${result.name.replace(/["\\\r\n]/g,'_')}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    let received=0;const guard=new Transform({transform(chunk,enc,cb){received+=chunk.length;if(received>MAX_BYTES)cb(new Error('Maximum file size exceeded'));else cb(null,chunk);}});
    try{await pipeline(result.response,guard,res);}catch{res.destroy();}return;
   }
   return sendJson(res,404,{error:'API endpoint not found.'});
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  let file=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).replace(/^\/+/, '');
  if(file.includes('..')||file.includes('\\')){res.writeHead(403);res.end();return;}
  const filePath=path.join(ROOT,'public',file);if(!filePath.startsWith(path.join(ROOT,'public')+path.sep)){res.writeHead(403);res.end();return;}
  let stat;try{stat=await fs.promises.stat(filePath);}catch{res.writeHead(404);res.end('Not found');return;}
  if(!stat.isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});if(req.method==='HEAD'){res.end();return;}fs.createReadStream(filePath).pipe(res);
 }catch(e){if(!res.headersSent)sendJson(res,400,{error:e.message||'Unexpected error.'});else res.destroy();}
});
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))server.listen(PORT,()=>console.log(`DownloadQ ready at http://localhost:${PORT}`));
export {server};
