import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('HTTP preview and video download flow with a controlled extractor, no checkbox',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'downloadq-flow-'));
 const mock=path.join(dir,'fake-yt-dlp');
 const body=`#!/usr/bin/env node
const fs=require('node:fs'); const path=require('node:path');
const args=process.argv.slice(2);
if(args.includes('--dump-single-json')) { console.log(JSON.stringify({title:'Sample creator video',uploader:'Test creator',duration:18,thumbnail:'https://example.com/thumb.jpg'}));process.exit(0);}
const p=args[args.indexOf('--output')+1];
if(!p) process.exit(2);
const ext=args.includes('--extract-audio')?'mp3':'mp4';
fs.writeFileSync(p.replace('%(ext)s',ext),Buffer.from('SAMPLE_VIDEO_FILE_CONTENT'));
`;
 await fs.writeFile(mock,body,{mode:0o755});
 const port=38000+Math.floor(Math.random()*4000);
 const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,YTDLP_BIN:mock,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 try{
  let ready=false;
  for(let i=0;i<50;i++) {try {const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok){ready=true;break;}}catch{} await new Promise(r=>setTimeout(r,60));}
  assert.ok(ready,'test server starts');
  const link='https://www.tiktok.com/@creator/video/7313919063179267333';
  const preview=await fetch(`http://127.0.0.1:${port}/api/social/inspect`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:link})});
  assert.equal(preview.status,200,await preview.text());
  // Request another preview because Response body was consumed only if assertion failed.
  const fresh=await fetch(`http://127.0.0.1:${port}/api/social/inspect`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:link})});
  const meta=await fresh.json();assert.equal(meta.title,'Sample creator video');
  const result=await fetch(`http://127.0.0.1:${port}/api/social/download?url=${encodeURIComponent(link)}&format=mp4`);
  assert.equal(result.status,200);assert.match(result.headers.get('content-disposition'),/\.mp4/);
  assert.equal((await result.arrayBuffer()).byteLength,25);
  const homepage=await (await fetch(`http://127.0.0.1:${port}/`)).text();
  assert.doesNotMatch(homepage,/id="confirmRights"/);
 }finally{child.kill('SIGTERM');await fs.rm(dir,{recursive:true,force:true});}
});
