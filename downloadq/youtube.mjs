import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const maxOutput = 2 * 1024 * 1024;
export class YouTubeError extends Error { constructor(message, status=422){ super(message); this.status=status; } }
export function youtubeVideoUrl(raw) {
 let u; try { u=new URL(raw); } catch { throw new YouTubeError('Enter a valid YouTube video URL.'); }
 if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.port) throw new YouTubeError('Invalid YouTube URL.');
 const host=u.hostname.toLowerCase().replace(/^www\./,'').replace(/^m\./,'');
 let id='';
 if (host==='youtu.be') id=u.pathname.split('/')[1]||'';
 else if (['youtube.com','youtube-nocookie.com'].includes(host)) {
  if(u.pathname==='/watch') id=u.searchParams.get('v')||'';
  else if(/^\/(shorts|live|embed)\//.test(u.pathname)) id=u.pathname.split('/')[2]||'';
 }
 if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) throw new YouTubeError('Only individual YouTube video links are supported (not channels or playlists).');
 return `https://www.youtube.com/watch?v=${id}`;
}
export function ytCommand(){
 if(process.env.YTDLP_BIN) return {cmd:process.env.YTDLP_BIN, args:[]};
 return {cmd:process.env.PYTHON_BIN || (process.platform==='win32'?'py':'python3'),args:['-m','yt_dlp']};
}
export function baseArgs(){ return ['--ignore-config','--no-playlist','--no-progress','--no-warnings','--js-runtimes','node','--socket-timeout','15','--retries','2','--fragment-retries','2','--no-cache-dir']; }
export function runYtdlp(args,{timeoutMs=45000,outputLimit=maxOutput}={}){
 const {cmd,args:prefix}=ytCommand();
 return new Promise((resolve,reject)=>{
  const child=spawn(cmd,[...prefix,...baseArgs(),...args],{windowsHide:true,env:{...process.env,PYTHONUNBUFFERED:'1'},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',settled=false;
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else resolve(value);};
  const timer=setTimeout(()=>{child.kill('SIGKILL');finish(new YouTubeError('YouTube processing timed out. Please try a shorter public video.',504));},timeoutMs);
  for(const [stream,kind] of [[child.stdout,'out'],[child.stderr,'err']])stream.on('data',b=>{
   if(kind==='out')stdout+=b.toString();else stderr+=b.toString();
   if(stdout.length>outputLimit||stderr.length>outputLimit){child.kill('SIGKILL');finish(new YouTubeError('YouTube returned too much data.'));}
  });
  child.on('error',e=>finish(new YouTubeError(e.code==='ENOENT'?'yt-dlp is not installed. Follow the README installation steps.':`Could not start yt-dlp: ${e.message}`,503)));
  child.on('close',code=>{
   if(settled)return;
   if(code!==0){const message=stderr.replace(/\x1b\[[0-9;]*m/g,'').split('\n').filter(x=>/ERROR:|Error:|WARNING:/.test(x)).slice(-2).join(' ').replace(/ERROR:\s*/g,'').trim();finish(new YouTubeError(message.slice(0,350)||'Video is unavailable or blocked by YouTube.'));}
   else finish(null,{stdout,stderr});
  });
 });
}
export async function inspectYouTube(raw,runner=runYtdlp){
 const url=youtubeVideoUrl(raw);
 const {stdout}=await runner(['--dump-single-json','--skip-download',url]);
 let data;try{data=JSON.parse(stdout);}catch{throw new YouTubeError('Could not read YouTube video details.');}
 if(data.is_live || data.live_status==='is_live')throw new YouTubeError('Live streams are not supported.');
 return {platform:'youtube',title:String(data.title||'YouTube video').slice(0,180),channel:String(data.uploader||'').slice(0,120),duration:Number(data.duration)||null,thumbnail: /^https:\/\//.test(data.thumbnail||'')?data.thumbnail:null,url,formats:[{id:'mp4',label:'MP4 video (up to 720p)'},{id:'mp3',label:'MP3 audio'}]};
}
export async function prepareYouTubeDownload(raw,format='mp4',runner=runYtdlp){
 const url=youtubeVideoUrl(raw);
 if(!['mp4','mp3'].includes(format))throw new YouTubeError('Choose MP4 or MP3.');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'downloadq-'));
 try{
  const args=['--max-filesize','200M','--no-overwrites','--output',path.join(dir,'download.%(ext)s')];
  if(format==='mp3')args.push('-f','bestaudio/best','--extract-audio','--audio-format','mp3');
  else args.push('-f','bv*[height<=720]+ba/b[height<=720]/best','--merge-output-format','mp4','--recode-video','mp4');
  await runner([...args,url],{timeoutMs:180000,outputLimit:512*1024});
  const files=(await fs.readdir(dir)).filter(f=>f==='download.mp4'||f==='download.mp3');
  if(!files.length) throw new YouTubeError('The media could not be converted. Make sure FFmpeg is installed and try again.');
  const file=path.join(dir,files[0]);const size=(await fs.stat(file)).size;
  if(size===0||size>200*1024*1024)throw new YouTubeError('This file is empty or exceeds the 200 MB download limit.');
  return {file,size,name:files[0],dir,format};
 }catch(e){await fs.rm(dir,{recursive:true,force:true});throw e;}
}
