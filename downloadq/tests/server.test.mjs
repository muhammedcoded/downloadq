import test from 'node:test';import assert from 'node:assert/strict';
import {validateUrl,detectPlatform,resolvePublic,server} from '../server.mjs';
test('rejects HTTP and credentials',()=>{assert.throws(()=>validateUrl('http://example.com/file.mp4'));assert.throws(()=>validateUrl('https://user:pass@example.com/a.mp4'));});
test('rejects private networks and localhost',()=>{assert.throws(()=>validateUrl('https://127.0.0.1/a.mp4'));assert.throws(()=>validateUrl('https://localhost/file.mp4'));assert.throws(()=>validateUrl('https://internal.local/file.mp4'));});
test('allows ordinary HTTPS file URL',()=>{assert.equal(validateUrl('https://cdn.example.com/file.mp4').hostname,'cdn.example.com');});
test('platform detection covers named platforms',()=>{for(const [url,id] of [['https://youtu.be/abc','youtube'],['https://www.tiktok.com/@me','tiktok'],['https://instagram.com/p/a','instagram'],['https://www.facebook.com/a','facebook'],['https://x.com/me','x'],['https://www.linkedin.com/feed/','linkedin']])assert.equal(detectPlatform(url),id);});
test('no unrelated domain falsely matches',()=>assert.equal(detectPlatform('https://youtube.com.evil.example/abc'),null));
test('rejects private resolved addresses',async()=>await assert.rejects(()=>resolvePublic('localhost')));
test('health endpoint works',async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{const port=server.address().port;const data=await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();assert.equal(data.ok,true);}finally{await new Promise(resolve=>server.close(resolve));}});
