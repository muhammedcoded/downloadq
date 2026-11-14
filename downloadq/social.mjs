import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export class MediaError extends Error {
  constructor(message, status = 422) { super(message); this.name = 'MediaError'; this.status = status; }
}
const platforms = [
  {id:'youtube', hosts:['youtube.com','youtu.be','youtube-nocookie.com'], label:'YouTube'},
  {id:'tiktok', hosts:['tiktok.com'], label:'TikTok'},
  {id:'instagram', hosts:['instagram.com'], label:'Instagram'},
  {id:'facebook', hosts:['facebook.com','fb.watch'], label:'Facebook'},
  {id:'x', hosts:['x.com','twitter.com'], label:'X'},
  {id:'linkedin', hosts:['linkedin.com'], label:'LinkedIn'},
];
export function identifySocial(raw) {
  let u; try { u = new URL(raw); } catch { throw new MediaError('Paste a valid video link, including https://'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) throw new MediaError('Only HTTPS social-media links are supported.');
  const host = u.hostname.toLowerCase().replace(/^www\./,'').replace(/^m\./,'');
  const found = platforms.find(p => p.hosts.some(h => host === h || host.endsWith('.'+h)));
  if (!found) throw new MediaError('This link is not from a supported social platform.');
  if (raw.length > 2000) throw new MediaError('Link is too long.');
  if (/\/(?:playlist|channel|@[^/]+\/?$)/i.test(u.pathname) && found.id==='youtube') throw new MediaError('Paste a single video, not an entire playlist or channel.');
  const youtube = found.id === 'youtube';
  if (youtube) {
    let videoId = '';
    if (host==='youtu.be') videoId=u.pathname.split('/')[1]||'';
    else if (u.pathname==='/watch') videoId=u.searchParams.get('v')||'';
    else if (/^\/(shorts|live|embed)\//.test(u.pathname)) videoId=u.pathname.split('/')[2]||'';
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new MediaError('Paste an individual YouTube video or Shorts link.');
    return {platform:found.id, label:found.label, url:'https://www.youtube.com/watch?v='+videoId};
  }
  // Reject platform homepages, profile-only URLs and private dashboard links.
  if (u.pathname==='/' || u.pathname.length < 3) throw new MediaError('Paste a link to a specific post or video, not a homepage.');
  if (found.id==='tiktok' && !(/\/video\/\d+/.test(u.pathname) || ['vm.tiktok.com','vt.tiktok.com'].includes(host) || /^\/t\//.test(u.pathname))) throw new MediaError('Paste a TikTok video or its official short share link.');
  if (found.id==='instagram' && !/^\/(reel|reels|p|tv)\//.test(u.pathname)) throw new MediaError('Paste an Instagram Reel or post link.');
  if (found.id==='x' && !/\/status\/\d+/.test(u.pathname)) throw new MediaError('Paste the link to a specific X video post.');
  if (found.id==='linkedin' && !/\/(posts|feed\/update|video)\//.test(u.pathname)) throw new MediaError('Paste a LinkedIn post/video URL. Some posts require account permission.');
  u.hash='';
  return {platform:found.id,label:found.label,url:u.href};
}
const OUTPUT_LIMIT = 3 * 1024 * 1024;
export function extractorCommand() {
  if(process.env.YTDLP_BIN) return {cmd:process.env.YTDLP_BIN, prefix:[]};
  return {cmd:process.env.PYTHON_BIN || (process.platform==='win32'?'py':'python3'), prefix:['-m','yt_dlp']};
}
export function extractorBaseArgs() {
  return ['--ignore-config','--no-playlist','--no-progress','--no-warnings','--js-runtimes','node','--socket-timeout','15','--retries','2','--fragment-retries','2','--no-cache-dir'];
}
export function runExtractor(args,{timeoutMs=45000,outputLimit=OUTPUT_LIMIT}={}) {
  const {cmd,prefix}=extractorCommand();
  return new Promise((resolve,reject)=>{
    const child=spawn(cmd,[...prefix,...extractorBaseArgs(),...args],{stdio:['ignore','pipe','pipe'],windowsHide:true});
    let stdout='',stderr='',ended=false;
    const finish=(error,value)=>{if(ended)return;ended=true;clearTimeout(timer);if(error)reject(error);else resolve(value);};
    const timer=setTimeout(()=>{child.kill('SIGKILL');finish(new MediaError('The provider took too long to respond.',504));},timeoutMs);
    for(const [stream,which] of [[child.stdout,'out'],[child.stderr,'err']])stream.on('data',buf=>{
      if(which==='out')stdout+=buf.toString();else stderr+=buf.toString();
      if(stdout.length>outputLimit||stderr.length>outputLimit){child.kill('SIGKILL');finish(new MediaError('Provider response exceeded the safety limit.'));}
    });
    child.on('error',e=>finish(new MediaError(e.code==='ENOENT'?'The server media extractor is not installed. Contact the site administrator.':`Cannot start media extractor: ${e.message}`,503)));
    child.on('close',code=>{
      if(ended)return;
      if(code!==0){
        const lines=stderr.replace(/\x1b\[[0-9;]*m/g,'').split('\n');
        const detail=lines.filter(s=>/ERROR:|Error:|WARNING:/.test(s)).slice(-2).join(' ').replace(/ERROR:\s*/g,'').slice(0,270).trim();
        finish(new MediaError(detail||'This video is unavailable, restricted, or not accessible from this server.'));
      }else finish(null,{stdout,stderr});
    });
  });
}
export async function inspectSocial(raw, runner=runExtractor){
  const requested=identifySocial(raw);
  const {stdout}=await runner(['--dump-single-json','--skip-download','--no-playlist',requested.url],{timeoutMs:60000});
  let meta;try{meta=JSON.parse(stdout);}catch{throw new MediaError('The platform returned invalid media information.');}
  if(meta.is_live||meta.live_status==='is_live')throw new MediaError('Live streams are not currently supported.');
  if(meta._type==='playlist'||Array.isArray(meta.entries))throw new MediaError('Paste a single video or post, not a playlist.');
  if(meta.duration>3600)throw new MediaError('Videos over 60 minutes are not supported.');
  return {
    platform:requested.platform,label:requested.label,url:requested.url,
    title:String(meta.title||meta.description||'Untitled video').slice(0,180),
    creator:String(meta.uploader||meta.channel||meta.creator||'').slice(0,110),
    thumbnail:typeof meta.thumbnail==='string'&&meta.thumbnail.startsWith('https://')?meta.thumbnail:null,
    duration:Number(meta.duration)||null,
    formats:[{id:'mp4',label:'Download video (MP4)'},{id:'mp3',label:'Extract audio (MP3)'}]
  };
}
export async function downloadSocial(raw, format='mp4', runner=runExtractor){
  const requested=identifySocial(raw);
  if(!['mp4','mp3'].includes(format))throw new MediaError('Choose MP4 or MP3.');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'downloadq-'));
  try{
    const args=['--max-filesize','200M','--no-overwrites','--output',path.join(dir,'video.%(ext)s')];
    if(format==='mp3')args.push('-f','bestaudio/best','--extract-audio','--audio-format','mp3','--audio-quality','5');
    else args.push('-f','bv*[height<=720]+ba/b[height<=720]/best','--merge-output-format','mp4','--recode-video','mp4');
    await runner([...args,requested.url],{timeoutMs:180000,outputLimit:512*1024});
    const files=(await fs.readdir(dir)).filter(f=>f==='video.mp4'||f==='video.mp3');
    if(!files.length)throw new MediaError('The provider returned no playable file. Try another video or format.');
    const file=path.join(dir,files[0]),size=(await fs.stat(file)).size;
    if(size<1||size>200*1024*1024)throw new MediaError('File is empty or exceeds the 200 MB limit.');
    return {file,size,dir,format,platform:requested.platform,name:`downloadq-${requested.platform}.${format}`};
  }catch(e){await fs.rm(dir,{recursive:true,force:true});throw e;}
}
