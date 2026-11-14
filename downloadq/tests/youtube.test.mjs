import test from 'node:test';
import assert from 'node:assert/strict';
import {youtubeVideoUrl, inspectYouTube, prepareYouTubeDownload, YouTubeError, ytCommand} from '../youtube.mjs';
test('YouTube formats normalize to one video URL',()=>{
 for(const v of ['https://youtu.be/dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ','https://m.youtube.com/shorts/dQw4w9WgXcQ'])assert.equal(youtubeVideoUrl(v),'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});
test('rejects playlists, unsafe schemes and unrelated domains',()=>{
 for(const v of ['https://www.youtube.com/playlist?list=PL123','file:///etc/passwd','https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ','https://youtube.com/watch?v=invalid','https://localhost/watch?v=dQw4w9WgXcQ'])assert.throws(()=>youtubeVideoUrl(v),YouTubeError);
});
test('metadata is extracted and restricted fields sanitized',async()=>{
 const inspected=await inspectYouTube('https://youtu.be/dQw4w9WgXcQ',async args=>{assert.ok(args.includes('--dump-single-json'));return {stdout:JSON.stringify({title:'Demo',uploader:'Creator',duration:92,thumbnail:'https://example.org/img.jpg'})};});
 assert.equal(inspected.title,'Demo');assert.equal(inspected.duration,92);assert.equal(inspected.formats.length,2);
});
test('live video is rejected',async()=>await assert.rejects(()=>inspectYouTube('https://youtu.be/dQw4w9WgXcQ',async()=>({stdout:JSON.stringify({is_live:true})})),YouTubeError));
test('invalid download format rejected before starting the tool',async()=>await assert.rejects(()=>prepareYouTubeDownload('https://youtu.be/dQw4w9WgXcQ','exe'),YouTubeError));
