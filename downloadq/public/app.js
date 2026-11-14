const $=(s)=>document.querySelector(s);
const status=$('#status'),results=$('#results');
const platformInfo={
 youtube:{name:'YouTube',text:'Paste a public video or Shorts link above. Availability depends on the specific video and YouTube access restrictions.'},
 tiktok:{name:'TikTok',text:'Paste a public TikTok video or official short share link. Some videos cannot be extracted from cloud servers.'},
 instagram:{name:'Instagram',text:'Paste a public Reel or post URL. Posts requiring login or private access cannot be processed.'},
 facebook:{name:'Facebook',text:'Paste a public Facebook video or post link. Private or login-only posts are unavailable.'},
 x:{name:'X / Twitter',text:'Paste a public X video post. Restricted posts may not work.'},
 linkedin:{name:'LinkedIn',text:'Paste a public LinkedIn video post. Login restrictions can prevent downloads.'}
};
function notice(msg,isError=false){status.textContent=msg;status.hidden=false;status.className='status'+(isError?' error':'');}
function clear(){status.hidden=true;results.hidden=true;results.replaceChildren();}
function fileSize(n){if(!Number.isFinite(n)||n<=0)return 'Size unavailable';return n>=1048576?(n/1048576).toFixed(1)+' MB':(n/1024).toFixed(1)+' KB';}
function detect(url){try{let host=new URL(url).hostname.toLowerCase().replace(/^www\./,'');const domains={youtube:['youtube.com','youtu.be'],tiktok:['tiktok.com'],instagram:['instagram.com'],facebook:['facebook.com','fb.watch'],x:['x.com','twitter.com'],linkedin:['linkedin.com']};return Object.keys(domains).find(k=>domains[k].some(x=>host===x||host.endsWith('.'+x)))||null;}catch{return null;}}
function makeResult({name,size,type,preview,download,link=true}){
 const card=document.createElement('div');card.className='result';
 const thumb=preview&&type?.startsWith('image/')?document.createElement('img'):document.createElement('div');thumb.className='thumb';if(thumb.tagName==='IMG'){thumb.src=preview;thumb.alt='Media preview';}else{thumb.style.display='grid';thumb.style.placeItems='center';thumb.style.fontSize='25px';thumb.textContent=type?.startsWith('video/')?'▶':type?.startsWith('audio/')?'♫':'▣';}
 const info=document.createElement('div');info.className='result-info';const title=document.createElement('strong');title.textContent=name;const sub=document.createElement('small');sub.textContent=`${type||'Media file'} • ${fileSize(size)}`;info.append(title,sub);
 const btn=document.createElement(link?'a':'button');btn.className='action';btn.textContent='↓ Download';if(link){btn.href=download;btn.download=name;}else{btn.addEventListener('click',download);}card.append(thumb,info,btn);results.append(card);results.hidden=false;
}
function showSocialVideo(data){
 const card=document.createElement('div');card.className='yt-meta';
 if(data.thumbnail){const img=document.createElement('img');img.src=data.thumbnail;img.alt='Video thumbnail';img.referrerPolicy='no-referrer';card.append(img);}
 const details=document.createElement('div');const badge=document.createElement('small');badge.textContent=(data.label||data.platform||'Video')+' · Ready to download';badge.className='result-badge';const title=document.createElement('strong');title.textContent=data.title;const sub=document.createElement('small');sub.textContent=[data.creator||data.channel,data.duration?Math.floor(data.duration/60)+'m '+Math.round(data.duration%60)+'s':''].filter(Boolean).join(' · ');details.append(badge,title,sub);card.append(details);results.append(card);
 const actions=document.createElement('div');actions.className='yt-actions';
 for(const fmt of data.formats){const a=document.createElement('a');a.textContent='↓ '+fmt.label;a.href='/api/social/download?url='+encodeURIComponent(data.url)+'&format='+encodeURIComponent(fmt.id)+'&confirm=yes';a.addEventListener('click',()=>notice('Preparing '+fmt.id.toUpperCase()+' on the server. Your download should begin when it is ready.'));actions.append(a);}
 results.append(actions);results.hidden=false;
}
function showPlatform(id){const v=platformInfo[id];if(!v)return;const target=$('#platformDetails');target.replaceChildren();const h=document.createElement('h3');h.textContent=v.name+' downloader';const p=document.createElement('p');p.textContent=v.text;target.append(h,p);target.hidden=false;document.querySelectorAll('[data-platform]').forEach(b=>b.classList.toggle('active',b.dataset.platform===id));$('#mediaUrl').focus();}
for(const btn of document.querySelectorAll('[data-platform]'))btn.addEventListener('click',()=>{showPlatform(btn.dataset.platform);document.querySelector('#downloader').scrollIntoView({block:'center',behavior:'smooth'});});
$('#linkForm').addEventListener('submit',async e=>{
 e.preventDefault();clear();const url=$('#mediaUrl').value.trim();const platform=detect(url);
 if(platform&&!$('#confirmRights').checked){notice('Please confirm that you own this video or have permission to download it.',true);return;}
 const btn=$('#checkBtn');btn.disabled=true;btn.textContent='Checking video…';notice('Connecting to the video provider. This may take a moment…');
 try{
  const endpoint=platform?'/api/social/inspect':'/api/inspect';
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,confirmRights:$('#confirmRights').checked})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to inspect video.');
  status.hidden=true;
  if(platform)showSocialVideo(data);else makeResult({...data,download:'/api/download?url='+encodeURIComponent(url),link:true});
 }catch(err){notice(err.message,true);}finally{btn.disabled=false;btn.innerHTML='Check link <span>→</span>';}
});
$('#theme').addEventListener('click',()=>{document.body.classList.toggle('dark');$('#theme').textContent=document.body.classList.contains('dark')?'☀':'☾';});$('#menu').addEventListener('click',()=>$('#nav').classList.toggle('open'));document.querySelectorAll('#nav a').forEach(a=>a.addEventListener('click',()=>$('#nav').classList.remove('open')));
$('#termsBtn').addEventListener('click',()=>$('#termsDialog').showModal());$('#closeDialog').addEventListener('click',()=>$('#termsDialog').close());$('#agreeDialog').addEventListener('click',()=>$('#termsDialog').close());$('#year').textContent=new Date().getFullYear();
