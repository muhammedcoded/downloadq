import test from 'node:test';
import assert from 'node:assert/strict';
import {identifySocial, inspectSocial, downloadSocial, extractorBaseArgs} from '../social.mjs';

test('recognizes valid public TikTok video',()=>{
 const x=identifySocial('https://www.tiktok.com/@creator/video/7313919063179267333');
 assert.equal(x.platform,'tiktok');assert.match(x.url,/7313919063179267333/);
});
test('supports TikTok short links',()=>assert.equal(identifySocial('https://vm.tiktok.com/ZSAbCD123/').platform,'tiktok'));
test('supports YouTube video and shorts',()=>{
 assert.equal(identifySocial('https://youtu.be/abcdefghijk?t=3').url,'https://www.youtube.com/watch?v=abcdefghijk');
 assert.equal(identifySocial('https://www.youtube.com/shorts/abcdefghijk').platform,'youtube');
});
test('supports Instagram reels, Facebook video and X post',()=>{
 assert.equal(identifySocial('https://www.instagram.com/reel/CqPabc123/').platform,'instagram');
 assert.equal(identifySocial('https://www.facebook.com/watch/?v=123456').platform,'facebook');
 assert.equal(identifySocial('https://x.com/sample/status/1234567890123456789').platform,'x');
});
test('rejects unsafe, unknown, and playlist URLs',()=>{
 for(const link of ['http://tiktok.com/@user/video/123','https://example.com/test','https://127.0.0.1/file','https://www.youtube.com/playlist?list=123','https://www.instagram.com/'])assert.throws(()=>identifySocial(link));
});
test('preview resolves TikTok video metadata',async()=>{
 const data=await inspectSocial('https://www.tiktok.com/@creator/video/7313919063179267333',async(args)=>{
  assert.ok(args.some(v=>v.includes('tiktok.com')));
  return {stdout:JSON.stringify({title:'My video',uploader:'Creator',duration:28,thumbnail:'https://example.com/thumb.jpg'})};
 });
 assert.equal(data.platform,'tiktok');assert.equal(data.title,'My video');assert.equal(data.formats.length,2);
});
test('previews reject live video and playlist',async()=>{
 await assert.rejects(inspectSocial('https://youtu.be/abcdefghijk',async()=>({stdout:JSON.stringify({is_live:true})})),/Live streams/);
 await assert.rejects(inspectSocial('https://youtu.be/abcdefghijk',async()=>({stdout:JSON.stringify({_type:'playlist',entries:[]})})),/single video/);
});
test('download fails safely when extractor produces no file',async()=>{
 await assert.rejects(downloadSocial('https://www.tiktok.com/@creator/video/7313919063179267333','mp4',async()=>({stdout:'ok'})),/no playable file/);
});
test('Node runtime is enabled for YouTube',()=>assert.deepEqual(extractorBaseArgs().slice(4,6),['--js-runtimes','node']));
