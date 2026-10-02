
'use strict';
const $=id=>document.getElementById(id);
const padColors=['#0ea5ff','#7b3cff','#00d99a','#12d8ff','#ff8618','#ff2380','#9b35ff','#12d8ff','#ffd21a','#ff3b4b','#7b4cff','#12d8ff','#ff2fb3','#168cff','#00d084'];
const padNames=['Jingle Opening','Backing Track 01','Crowd Ambience','Siren','Applause','Sweep Down','Stinger','Laser','Kickbeat','Snare','Promo Video','Background Music','Effect 01','Effect 02','Instrumental'];
const pads=[];
const shortcutKeys=['1','2','3','4','5','6','7','8','9','0','q','w','e','r','t'];
let allPadsLocked=false, lastPlayedIndex=-1;
const padLocks=Array(15).fill(false);
function setLastPlayed(i){lastPlayedIndex=i;const el=$('lastPlayedText');if(el)el.textContent='PAD '+(i+1)+' • '+($('name'+i)?.textContent||'Audio');}
function updatePadLockUI(i){const locked=allPadsLocked||padLocks[i];const pad=$('pads')?.children[i];if(!pad)return;pad.classList.toggle('padLocked',locked);const btn=$('lock'+i);if(btn){btn.setAttribute('aria-pressed',String(locked));btn.title=locked?'Buka kunci Pad '+(i+1):'Kunci Pad '+(i+1);}const controls=pad.querySelectorAll('button,input,label');controls.forEach(el=>{if(el!==btn)el.disabled=locked;});pad.setAttribute('aria-disabled',String(locked));}
function setAllPadLock(v){allPadsLocked=v;for(let i=0;i<15;i++)updatePadLockUI(i);const b=$('lockAllPads');if(b){b.classList.toggle('active',v);b.setAttribute('aria-pressed',String(v));const t=b.querySelector('.lockText');if(t)t.textContent=v?'LOCKED':'LOCK EDIT';}}
function updateActivePads(){const list=$('activePadsList'),count=$('activePadsCount');if(!list||!count)return;const active=pads.map((p,i)=>({p,i})).filter(x=>x.p&&x.p.audio&&(!x.p.audio.paused||fadeJobs.has(x.p.audio)));count.textContent=String(active.length);list.innerHTML=active.length?active.map(({i})=>{const name=escapeHtml($('name'+i)?.textContent||'Audio');return `<span class="activePadChip" title="PAD ${i+1}"><span class="activePadText" data-full="PAD ${i+1} · ${name}">PAD ${i+1} · ${name}</span></span>`}).join(''):'<span class="activePadsEmpty">Tidak ada pad yang aktif</span>';requestAnimationFrame(()=>{list.querySelectorAll('.activePadText').forEach(el=>{if(el.scrollWidth>el.clientWidth){el.classList.add('running');el.style.setProperty('--marquee-shift',(el.scrollWidth-el.clientWidth)+'px');}});});}
function renderShortcutCard(){}
function triggerPadShortcut(i){ if(Number.isInteger(i)&&pads[i]&&!allPadsLocked&&!padLocks[i]) playPadWithCrossfade(i); }
let masterGain=.7, muted=false, fadeDuration=1500, masterFadeRunning=false;
function fmt(s){if(!Number.isFinite(s)||s<0)s=0;return String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0')}
function status(msg){const e=$('playbackStatus');if(!e)return;e.textContent=msg||'';e.style.display=msg?'block':'none';e.style.cssText=msg?'position:relative;z-index:30;display:block;font-size:12px;color:#ffd0d0;padding:6px 10px;background:#35131a;border-bottom:1px solid #7b303b':'position:relative;z-index:2;display:none'}
function mediaError(label,m){const e=m&&m.error;let detail='';if(e){const codes={1:'aborted',2:'network',3:'decode',4:'format tidak didukung'};detail=' ['+(codes[e.code]||('code '+e.code))+']'}status(label+' gagal diputar'+detail+'. Coba MP3/WAV/M4A/OGG. Pastikan volume perangkat tidak mute.');}
function makeAudio(label){
  const a=document.createElement('audio');
  a.preload='auto'; a.autoplay=false; a.muted=false; a.defaultMuted=false; a.volume=.7;
  a.setAttribute('playsinline',''); a.setAttribute('webkit-playsinline',''); a.setAttribute('x-webkit-airplay','allow');
  a.controls=false; a.setAttribute('aria-hidden','true'); a.tabIndex=-1; a.style.position='fixed'; a.style.left='-10000px'; a.style.top='-10000px'; a.style.width='1px'; a.style.height='1px'; a.style.opacity='0.01'; a.dataset.pacLabel=label||'Audio';
  a.addEventListener('error',()=>mediaError(a.dataset.pacLabel,a));
  document.body.appendChild(a);
  return a;
}
function revokeMediaURL(media){if(media&&media.__pacURL){try{URL.revokeObjectURL(media.__pacURL)}catch(e){}media.__pacURL=null}}
function setSource(media,file,label){
  if(!media||!file)return false;
  try{
    cancelFade(media);
    media.pause();
    revokeMediaURL(media);
    media.removeAttribute('src');
    media.load();
    const u=URL.createObjectURL(file);
    media.__pacURL=u;
    media.__pacLabel=label||file.name;
    media.muted=false; media.defaultMuted=false; media.autoplay=false; media.preload='auto';
    media.src=u;
    media.load();
    return true;
  }catch(e){status('Gagal memuat '+(label||file.name)+'.');return false}
}
async function playNative(media,label){
  // Initialize/resume the analyzer BEFORE playback so the visualizer receives the same audio stream.
  try{ await resumeVizAudio(media); }catch(e){}
  if(!media||!media.src){status('Belum ada file pada '+(label||'player')+'. Pilih file audio terlebih dahulu.');return false}
  try{
    media.muted=false;
    media.defaultMuted=false;
    media.autoplay=false;
    media.setAttribute('playsinline','');
    // Pastikan elemen benar-benar siap sebelum playback.
    if(media.readyState===0) media.load();
    let promise;
    try{ promise=media.play(); }catch(err){ promise=null; throw err; }
    if(promise&&typeof promise.then==='function') await promise;
    status('');
    return true;
  }catch(err){
    // Beberapa browser perlu satu kali reload source setelah file lokal selesai dipilih.
    try{
      if(media.readyState<2){
        await new Promise((resolve,reject)=>{
          let done=false;
          const ok=()=>{if(done)return;done=true;cleanup();resolve()};
          const bad=()=>{if(done)return;done=true;cleanup();reject(media.error||new Error('media error'))};
          const timer=setTimeout(()=>{if(done)return;done=true;cleanup();reject(new Error('timeout'))},2500);
          function cleanup(){clearTimeout(timer);media.removeEventListener('canplay',ok);media.removeEventListener('error',bad)}
          media.addEventListener('canplay',ok,{once:true});
          media.addEventListener('error',bad,{once:true});
          media.load();
        });
      }
      media.muted=false;
      const retry=media.play();
      if(retry&&typeof retry.then==='function') await retry;
      status('');
      return true;
    }catch(retryErr){
      const name=(retryErr&&retryErr.name)||(err&&err.name)||'PlaybackError';
      const code=media&&media.error&&media.error.code;
      const detail=code===4?'Format audio tidak didukung browser.':code===3?'File audio gagal di-decode.':name==='NotAllowedError'?'Browser memblokir playback. Tekan PLAY sekali lagi setelah memilih file.':'Pastikan file audio valid dan volume perangkat tidak mute.';
      status((label||'Media')+' tidak dapat diputar — '+detail);
      return false;
    }
  }
}
function targetPadVolume(i){return muted?0:Math.max(0,Math.min(1,(parseFloat($('vol'+i).value)||0)*masterGain))}
function targetMusicVolume(){return muted?0:Math.max(0,Math.min(1,(parseFloat($('musicVol').value)||0)*masterGain))}

// Robust fade engine: every media element gets a generation token so an old
// fade callback can never restore/stop a pad after a newer PLAY/STOP action.
const fadeJobs=new WeakMap();
const fadeSeq=new WeakMap();
function nextFadeSeq(m){const n=(fadeSeq.get(m)||0)+1;fadeSeq.set(m,n);return n}
function cancelFade(m){if(!m)return;nextFadeSeq(m);const j=fadeJobs.get(m);if(j){j.cancelled=true;fadeJobs.delete(m)}}
function fadeOut(m,dur,reset=true){
  if(!m)return false;
  const active=!m.paused || fadeJobs.has(m);
  if(!active)return false;
  const restore=targetVolumeForMedia(m);
  fadeTo(m,0,dur,()=>{
    // Only this fade may stop the media. A newer PLAY cancels this callback.
    m.pause();
    if(reset){try{m.currentTime=0}catch(e){}}
    m.volume=muted?0:restore;
  });
  return true;
}
function targetVolumeForMedia(m){
  const p=pads.find(x=>x.audio===m);
  if(p){const i=pads.indexOf(p);return targetPadVolume(i)}
  return targetMusicVolume();
}

function crossfadeToPad(except){
  const dur=Math.max(80,Number(fadeDuration)||1000);
  pads.forEach((p,i)=>{
    if(i===except||!p||!p.audio)return;
    const a=p.audio;
    // A pad is considered active while playing OR while its previous fade is
    // still running. This makes Pad A -> B -> C reliable even when pressed fast.
    if(a.paused && !fadeJobs.has(a))return;
    const restore=targetPadVolume(i);
    fadeTo(a,0,dur,()=>{
      a.pause();
      try{a.currentTime=0}catch(e){}
      setMediaGain(a,restore);
      updatePad(i);
    });
  });
}

function playPadWithCrossfade(i){
  const p=pads[i],a=p&&p.audio;
  const lp=$('lastPlayedText'); if(lp) lp.textContent=$('name'+i)?.textContent || ('PAD '+(i+1));
  if(!a)return false;
  if(!a.src){$('file'+i).click();return false}

  // PLAY on an already playing pad = fade it out.
  if(!a.paused){fadeOut(a,fadeDuration,false);return true}

  // Cancel any stale fade on the destination pad before starting it.
  cancelFade(a);
  if(a.ended || (Number.isFinite(a.duration)&&a.currentTime>=Math.max(0,a.duration-.05))){try{a.currentTime=0}catch(e){}}

  // First fade every other active pad down. The destination is excluded.
  crossfadeToPad(i);

  const target=targetPadVolume(i);
  a.muted=false;a.defaultMuted=false;a.autoplay=false;
  const st=ensureAnalyzer(a); if(st&&st.ctx.state==='suspended'){try{st.ctx.resume()}catch(e){}}
  setMediaGain(a,0);

  // Do not await anything before calling play(): preserve the user's click
  // gesture on Android/mobile browsers.
  let pr;
  try{
    if(a.readyState===0)a.load();
    pr=a.play();
  }catch(err){
    setMediaGain(a,target);
    status('Pad '+(i+1)+' tidak dapat diputar. Coba PLAY lagi atau muat ulang file audio.');
    return false;
  }

  const startFade=()=>{
    if(a.paused){
      // If playback was rejected/stopped before the promise settled, don't
      // leave the pad silently sitting at zero volume.
      setMediaGain(a,target);
      updatePad(i);
      return;
    }
    status('');
    if(target>0)fadeTo(a,target,fadeDuration,()=>updatePad(i));
    else setMediaGain(a,0);
    updatePad(i);
  };
  if(pr&&typeof pr.then==='function'){
    pr.then(startFade).catch(err=>{
      setMediaGain(a,target);
      const name=err&&err.name||'';
      status('Pad '+(i+1)+' tidak dapat mengeluarkan suara — '+(name==='NotAllowedError'?'browser memblokir playback. Tekan PLAY lagi.':'file audio belum siap/format tidak didukung.'));
      updatePad(i);
    });
  }else startFade();
  return true;
}

// REAL-TIME AUDIO VISUALIZER ENGINE
// Uses Web Audio AnalyserNode when supported, while keeping native HTML5 Audio
// as the playback fallback. The analyzer reads the actual audio spectrum rather
// than generating decorative bars from currentTime, so the animation follows
// bass/mids/highs and reacts to transients in the material.
const vizState = new WeakMap();
let vizAudioCtx = null;
function getVizContext(){
  if(vizAudioCtx) return vizAudioCtx;
  try{ vizAudioCtx = new (window.AudioContext||window.webkitAudioContext)(); }
  catch(e){ vizAudioCtx = null; }
  return vizAudioCtx;
}
function ensureAnalyzer(audio){
  if(!audio) return null;
  let st=vizState.get(audio);
  if(st) return st;
  const ctx=getVizContext();
  if(!ctx) return null;
  try{
    const source=ctx.createMediaElementSource(audio);
    const analyser=ctx.createAnalyser();
    const gain=ctx.createGain();
    analyser.fftSize=1024;
    analyser.minDecibels=-100;
    analyser.maxDecibels=-10;
    analyser.smoothingTimeConstant=.38;
    gain.gain.value=Number.isFinite(audio.volume)?audio.volume:.7;
    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);
    st={ctx,source,analyser,gain,freq:new Uint8Array(analyser.frequencyBinCount),time:new Uint8Array(analyser.fftSize),bass:0,mid:0,high:0,peak:0,energy:0,beat:0};
    vizState.set(audio,st);
    // Once Web Audio owns the output, keep the element at unity and control
    // loudness through the GainNode. This makes fade and visualizer use one path.
    audio.volume=1;
    return st;
  }catch(e){ return null; }
}
function setMediaGain(audio,value){
  const v=Math.max(0,Math.min(1,Number(value)||0));
  const st=vizState.get(audio);
  if(st&&st.gain){
    const now=st.ctx.currentTime;
    try{st.gain.gain.cancelScheduledValues(now);st.gain.gain.setValueAtTime(v,now)}catch(e){st.gain.gain.value=v}
    audio.volume=1;
  }else audio.volume=v;
}
function getMediaGain(audio){
  const st=vizState.get(audio);
  return st&&st.gain?st.gain.gain.value:(Number.isFinite(audio?.volume)?audio.volume:0);
}
function fadeTo(m,to,dur,done){
  if(!m)return;
  const token=nextFadeSeq(m);
  const target=Math.max(0,Math.min(1,Number(to)||0));
  const from=getMediaGain(m);
  const ms=Math.max(80,Number(dur)||1000);
  const job={cancelled:false,token}; fadeJobs.set(m,job);
  const t0=performance.now();
  const step=t=>{
    if(job.cancelled || fadeSeq.get(m)!==token)return;
    const q=Math.min(1,(t-t0)/ms);
    setMediaGain(m,from+(target-from)*q);
    if(q<1){requestAnimationFrame(step);return}
    setMediaGain(m,target);
    if(fadeJobs.get(m)===job)fadeJobs.delete(m);
    if(fadeSeq.get(m)===token&&typeof done==='function')done();
  };
  requestAnimationFrame(step);
}
async function resumeVizAudio(audio){
  const st=ensureAnalyzer(audio);
  if(st&&st.ctx.state==='suspended'){
    try{st.ctx.resume()}catch(e){}
  }
  return st;
}

function avgBand(data,a,b){
  let sum=0,n=0; const end=Math.min(data.length,b);
  for(let i=Math.max(0,a);i<end;i++){sum+=data[i];n++}
  return n?sum/n/255:0;
}
function drawGraph(canvas,audio,accent,active){
  const c=canvas?.getContext('2d'); if(!c)return;
  const dpr=window.devicePixelRatio||1;
  const w=Math.max(1,Math.floor(canvas.clientWidth*dpr)),h=Math.max(1,Math.floor(canvas.clientHeight*dpr));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
  c.clearRect(0,0,w,h);
  const st=vizState.get(audio);
  let bass=0,mid=0,high=0,energy=0,beat=0;
  if(st){
    try{
      st.analyser.getByteFrequencyData(st.freq);
      st.analyser.getByteTimeDomainData(st.time);
      const n=st.freq.length;
      bass=avgBand(st.freq,1,Math.max(8,Math.floor(n*.055)));
      mid=avgBand(st.freq,Math.floor(n*.055),Math.floor(n*.30));
      high=avgBand(st.freq,Math.floor(n*.30),n);
      energy=bass*.62+mid*.28+high*.10;
      const rise=Math.max(0,energy-(st.energy||0));
      st.energy += (energy-st.energy)*(energy>st.energy?.48:.12);
      st.bass += (bass-st.bass)*.38;
      st.mid += (mid-st.mid)*.30;
      st.high += (high-st.high)*.24;
      st.beat=Math.max(st.beat*.80,Math.min(1,rise*8));
      beat=st.beat;
    }catch(e){}
  }
  const live=!!(active&&st);
  const style=window.pacVizStyle||'bars';
  const count=Math.max(36,Math.min(96,Math.floor(w/(4*dpr))));
  const values=[];
  for(let i=0;i<count;i++){
    const f=i/(count-1);
    const bin=st?Math.min(st.freq.length-1,Math.floor(Math.pow(f,1.65)*(st.freq.length-1))):0;
    const raw=st?(st.freq[bin]/255):0;
    const band=f<.28?(st?.bass||0):f<.70?(st?.mid||0):(st?.high||0);
    values.push(Math.max(.025,Math.min(1,.06+raw*.58+band*.42+beat*(f<.35?1.25:.55))));
  }
  c.globalAlpha=1;c.shadowBlur=0;
  if(style==='wave'){
    c.beginPath();
    for(let x=0;x<w;x++){
      const idx=Math.min((st?.time?.length||1)-1,Math.floor(x/w*(st?.time?.length||1)));
      const y=live&&st?h*.5+(st.time[idx]-128)/128*h*.34:h*.5;
      if(x===0)c.moveTo(x,y);else c.lineTo(x,y);
    }
    c.strokeStyle=accent;c.lineWidth=Math.max(1.5,2*dpr);c.globalAlpha=live?.95:.15;c.shadowBlur=live?8*dpr:0;c.shadowColor=accent;c.stroke();
  }else if(style==='mirror'){
    const gap=Math.max(1*dpr,w/(count*20)),bw=Math.max(1.2*dpr,(w-gap*(count-1))/count);
    values.forEach((v,i)=>{
      const bh=v*h*.42, x=i*(bw+gap);
      c.fillStyle=accent;c.globalAlpha=live?Math.min(1,.45+v*.5):.10;c.fillRect(x,h/2-bh,bw,bh);c.fillRect(x,h/2,bw,bh);
    });
  }else if(style==='pulse'){
    const cx=w/2,cy=h/2, maxR=Math.min(w,h)*.42;
    c.strokeStyle=accent;c.lineWidth=Math.max(1.5,2*dpr);
    for(let k=0;k<12;k++){
      const v=values[Math.floor(k*count/12)]||0;
      const r=(maxR*(.18+k*.065))*(live?(1+v*.22):.72);
      c.globalAlpha=live?Math.min(1,.12+v*.65):.08;
      c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.stroke();
    }
    c.globalAlpha=live?.9:.12;c.fillStyle=accent;c.beginPath();c.arc(cx,cy,Math.max(3*dpr,8*dpr*(.35+beat)),0,Math.PI*2);c.fill();
  }else if(style==='matrix'){
    const cols=Math.max(24,Math.min(64,Math.floor(w/(7*dpr)))), cw=w/cols;
    for(let i=0;i<cols;i++){
      const v=values[Math.floor(i*count/cols)]||.025, rows=10, activeRows=Math.max(1,Math.floor(v*rows));
      for(let r=0;r<rows;r++){
        c.fillStyle=accent;c.globalAlpha=live&&r>=rows-activeRows?(.22+.07*(r%3)):.035;
        c.fillRect(i*cw+1*dpr,h-(r+1)*(h/(rows+1)),Math.max(1,cw-2*dpr),Math.max(1,h/(rows+1)-2*dpr));
      }
    }
  }else{
    const gap=Math.max(1*dpr,w/(count*20)),bw=Math.max(1.2*dpr,(w-gap*(count-1))/count);
    values.forEach((v,i)=>{
      const bh=v*h*.92,x=i*(bw+gap),y=(h-bh)/2;
      c.fillStyle=accent;c.globalAlpha=live?Math.min(1,.38+v*.58):.12;c.shadowBlur=live?(3+beat*14)*dpr:0;c.shadowColor=accent;c.fillRect(x,y,bw,bh);
    });
    if(live&&st){
      c.beginPath();
      for(let x=0;x<w;x++){
        const idx=Math.min(st.time.length-1,Math.floor(x/w*st.time.length));
        const y=h*.5+(st.time[idx]-128)/128*h*.22;
        if(x===0)c.moveTo(x,y);else c.lineTo(x,y);
      }
      c.globalAlpha=.65;c.strokeStyle=accent;c.lineWidth=Math.max(1,dpr);c.shadowBlur=3*dpr;c.stroke();
    }
  }
  c.globalAlpha=1;c.shadowBlur=0;
}
function renderVisualizers(){
  pads.forEach((p,i)=>{if(!p.audio.paused)ensureAnalyzer(p.audio);drawGraph($('canvas'+i),p.audio,p.color,!p.audio.paused);});
  if(!music.paused)ensureAnalyzer(music);
  drawGraph($('musicVisualizer'),music,'#12d8ff',!music.paused);
  requestAnimationFrame(renderVisualizers);
}
function updatePad(i){const p=pads[i],a=p.audio,d=Number.isFinite(a.duration)?a.duration:0,c=a.currentTime||0;const isPlaying=!a.paused&&d>0;const padEl=$('pads')?.children[i];if(padEl)padEl.classList.toggle('padPlaying',isPlaying);$('time'+i).textContent=fmt(c)+' / '+fmt(d);const rem=Math.max(0,d-c);$('tc'+i).textContent='TIME -'+fmt(rem);$('tc'+i).classList.toggle('on',isPlaying);$('tc'+i).classList.toggle('warn',isPlaying&&rem<=10&&rem>3);$('tc'+i).classList.toggle('danger',isPlaying&&rem<=3);$('prog'+i).style.width=(d?c/d*100:0)+'%';$('play'+i).textContent=a.paused?'▶ PLAY':'❚❚ PAUSE';$('play'+i).classList.toggle('active',isPlaying);$('fadeState'+i).classList.toggle('on',isPlaying);updateActivePads();}
function padTemplate(i){return `<article class="pad" style="--accent:${padColors[i]}" data-i="${i}"><div class="dropBadge">DROP AUDIO HERE • PAD ${i+1}</div><div class="padhead"><div class="num">${i+1}</div><span class="fadeState" id="fadeState${i}">FADE</span><div class="name" id="name${i}">${padNames[i]}</div><button class="rename" title="Rename">✎</button><button class="padLock" id="lock${i}" title="Lock pad editing" aria-label="Lock pad editing"></button></div><div class="wave"><canvas id="canvas${i}"></canvas><div class="meter"></div><span class="vizLabel">LIVE AUDIO</span></div><div class="timeRow"><span class="time" id="time${i}">00:00 / 00:00</span><span class="timecode" id="tc${i}">TIME -00:00</span></div><div class="progress"><i id="prog${i}"></i></div><div class="controls"><button class="play" id="play${i}">▶ PLAY</button><button class="stop" id="stop${i}">■ STOP</button><button id="cue${i}">◉ CUE</button></div><div class="padVolume"><span>VOL</span><input id="vol${i}" type="range" min="0" max="1" step=".01" value=".7"><b id="volText${i}">70%</b></div><div class="subcontrols"><button id="fade${i}">♧ FADE</button><button id="loop${i}">↻ LOOP</button></div><label class="load">▱ LOAD AUDIO<input id="file${i}" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.webm,.flac"></label></article>`}
$('pads').innerHTML=Array.from({length:15},(_,i)=>padTemplate(i)).join('');
function isAudioFile(f){return !!f && ((f.type||'').startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|oga|webm|flac)$/i.test(f.name||''));}
function setPadFile(i,f){
  if(allPadsLocked||padLocks[i]) return false;
  if(!isAudioFile(f)) { status('Pad '+(i+1)+': file harus berupa audio.'); return false; }
  const a=pads[i]?.audio; if(!a) return false;
  try{
    cancelFade(a); a.pause();
    if(a.__pacURL){try{URL.revokeObjectURL(a.__pacURL)}catch(err){} a.__pacURL=null;}
    pads[i].file=f; const url=URL.createObjectURL(f); a.__pacURL=url; a.src=url; a.preload='auto'; a.muted=false; a.defaultMuted=false; ensureAnalyzer(a); setMediaGain(a,targetPadVolume(i)); a.load();
    $('name'+i).textContent=(f.name||'Audio').replace(/\.[^.]+$/,'');
    updatePad(i); return true;
  }catch(err){status('Gagal memuat audio Pad '+(i+1)+'.'); return false;}
}
function addMusicFiles(fs){
  const audioFiles=[...fs].filter(isAudioFile);
  if(!audioFiles.length){status('Tidak ada file audio yang ditemukan.'); return 0;}
  audioFiles.forEach(f=>tracks.push({source:'local',name:f.name,url:URL.createObjectURL(f)}));
  renderPlaylist(); if(cur<0) selectTrack(0,false); return audioFiles.length;
}
function bindFileDrop(zone,handler){
  if(!zone) return;
  ['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{
    if(!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault(); e.stopPropagation(); zone.classList.add('fileDropActive');
  }));
  ['dragleave','dragend'].forEach(ev=>zone.addEventListener(ev,e=>{
    if(e.relatedTarget && zone.contains(e.relatedTarget)) return;
    zone.classList.remove('fileDropActive');
  }));
  zone.addEventListener('drop',e=>{
    if(!e.dataTransfer || !e.dataTransfer.files?.length) return;
    e.preventDefault(); e.stopPropagation(); zone.classList.remove('fileDropActive'); handler([...e.dataTransfer.files]);
  });
}
for(let i=0;i<15;i++){
  // Audio Pad engine intentionally uses the same simple native HTML5 Audio
  // pattern as the known-working reference file: new Audio() + object URL +
  // direct play() from the user's click event. No Web Audio routing is used.
  const a=makeAudio('Pad '+(i+1));
  a.preload='auto';
  a.autoplay=false;
  a.muted=false;
  a.defaultMuted=false;
  a.__pacURL=null;
  a.volume=1;
  const p={audio:a,loop:false,color:padColors[i],file:null};
  pads.push(p);

  $('file'+i).addEventListener('change',e=>{if(allPadsLocked||padLocks[i]){e.target.value='';return;}const f=e.target.files&&e.target.files[0];if(f)setPadFile(i,f);e.target.value='';});
  bindFileDrop($('pads').querySelector('.pad[data-i="'+i+'"]'),files=>{if(allPadsLocked||padLocks[i])return;setPadFile(i,files[0]);});

  $('pads').children[i].addEventListener('dblclick',e=>{
    if(e.target.closest('button,input,label,.rename')) return;
    if(allPadsLocked||padLocks[i]) return;
    playPadWithCrossfade(i);
  });

  $('play'+i).onclick=()=>{
    if(allPadsLocked||padLocks[i]) return;
    status('');
    playPadWithCrossfade(i);
  };

  $('stop'+i).onclick=()=>{
    if(allPadsLocked||padLocks[i]) return;
    cancelFade(a);
    a.pause();
    try{a.currentTime=0}catch(e){}
    setMediaGain(a,targetPadVolume(i));
    updatePad(i);
  };

  $('cue'+i).onclick=()=>{
    if(allPadsLocked||padLocks[i]) return;
    status('');
    void resumeVizAudio(a);
       crossfadeToPad(i);
    cancelFade(a);
    try{a.currentTime=0}catch(e){}
    a.muted=false;
    setMediaGain(a,targetPadVolume(i));
    let pr;
    try{pr=a.play()}catch(err){status('Pad '+(i+1)+' tidak dapat diputar.');return;}
    if(pr&&typeof pr.catch==='function')pr.catch(err=>status('Pad '+(i+1)+' tidak dapat mengeluarkan suara.'));
  };

  $('fade'+i).onclick=()=>{if(allPadsLocked||padLocks[i])return;fadeOut(a,fadeDuration,true)};
  $('loop'+i).onclick=()=>{if(allPadsLocked||padLocks[i])return;p.loop=!p.loop;$('loop'+i).style.background=p.loop?'#17608a':''};
  $('vol'+i).oninput=e=>{
    if(allPadsLocked||padLocks[i])return;
    const v=Math.max(0,Math.min(1,parseFloat(e.target.value)||0));
    $('volText'+i).textContent=Math.round(v*100)+'%';
    if(!muted&&!a.paused&&!fadeJobs.has(a))setMediaGain(a,v*masterGain);
    else if(a.paused)setMediaGain(a,targetPadVolume(i));
  };
  $('pads').children[i].querySelector('.rename').onclick=()=>{if(allPadsLocked||padLocks[i])return;
    const n=prompt('Nama pad:',$('name'+i).textContent);
    if(n&&n.trim())$('name'+i).textContent=n.trim();
  };
  $('lock'+i).onclick=()=>{padLocks[i]=!padLocks[i];updatePadLockUI(i);};
  const padEl=$('pads').children[i];
  a.addEventListener('ended',()=>{
    cancelFade(a);
    if(p.loop){
      try{a.currentTime=0}catch(e){}
      const target=targetPadVolume(i);
      setMediaGain(a,0);
      const pr=a.play();
      const restart=()=>{if(!a.paused&&target>0)fadeTo(a,target,fadeDuration);else setMediaGain(a,target);updatePad(i)};
      if(pr&&typeof pr.then==='function')pr.then(restart).catch(()=>{setMediaGain(a,target);updatePad(i)});else restart();
    }
    updatePad(i);
  });
  a.addEventListener('stalled',()=>{ if(!a.paused) status('Pad '+(i+1)+' sedang menunggu data audio…'); });
  a.addEventListener('canplay',()=>{ if(!a.paused) status(''); });
  a.addEventListener('error',()=>mediaError('Pad '+(i+1),a));
  ['timeupdate','loadedmetadata','durationchange','play','pause','volumechange'].forEach(ev=>a.addEventListener(ev,()=>updatePad(i)));
  updatePad(i);
}
// Keyboard hotkeys: 1–9 = Pads 1–9, 0 = Pad 10, Q/W/E/R/T = Pads 11–15.
document.addEventListener('keydown',e=>{
  const tag=(e.target?.tagName||'').toLowerCase();
  if(e.ctrlKey||e.altKey||e.metaKey||['input','textarea','select','button'].includes(tag)||e.target?.isContentEditable)return;
  if(e.repeat)return;
  const k=(e.key||'').toLowerCase(); const i=shortcutKeys.indexOf(k);
  if(i>=0&&i<15){e.preventDefault(); triggerPadShortcut(i);}
});
$('lockAllPads').onclick=()=>setAllPadLock(!allPadsLocked);
let tracks=[],cur=-1;const music=makeAudio('Music Player');music.volume=.7;
const musicPfl=makeAudio('Music Player PFL');musicPfl.volume=0;
let pflEnabled=false;
let pflTrackIndex=-1;
let pflSinkSupported=false;
let dragFrom=-1;
try{pflSinkSupported=typeof AudioContext!=='undefined'&&typeof AudioContext.prototype.setSinkId==='function'}catch(e){pflSinkSupported=false}

function updatePflUI(){const b=$('musicPfl'),st=$('musicPflStatus');if(b){b.classList.toggle('active',pflEnabled);b.setAttribute('aria-pressed',pflEnabled?'true':'false')}if(st){st.classList.toggle('on',pflEnabled);st.textContent=pflEnabled?'PFL ON • PREVIEW AKTIF':'PFL OFF • PREVIEW MUSIC PLAYER'}}
function stopPfl(){pflEnabled=false;pflTrackIndex=-1;cancelFade(musicPfl);musicPfl.pause();try{musicPfl.currentTime=0}catch(e){}setMediaGain(musicPfl,0);updatePflUI()}
function playPflForTrack(i){const t=tracks[i];if(!t)return false; pflTrackIndex=i; cancelFade(musicPfl);musicPfl.pause();try{musicPfl.currentTime=0}catch(e){} musicPfl.__pacURL=t.url;musicPfl.src=t.url;musicPfl.preload='auto';musicPfl.muted=false;musicPfl.load(); ensureAnalyzer(musicPfl); setMediaGain(musicPfl,0); const pr=musicPfl.play(); const start=()=>{pflEnabled=true;updatePflUI();fadeTo(musicPfl,targetMusicVolume(),250)}; if(pr&&typeof pr.then==='function')pr.then(start).catch(()=>{setMediaGain(musicPfl,0);updatePflUI()}); else start(); return true}

function renderPlaylist(){
  const box=$('playlist');
  box.innerHTML=tracks.map((t,i)=>`<div class="track ${i===cur?'active':''}" draggable="true" data-track="${i}" title="Geser untuk mengubah urutan"><span class="dragHandle" aria-hidden="true">☷</span><span class="idx">${String(i+1).padStart(2,'0')}</span><span class="tnWrap"><span class="tn">${escapeHtml(t.name||'Untitled')}</span><small class="sourceBadge">LOCAL</small></span><button class="removeTrack" data-remove="${i}" aria-label="Hapus" title="Hapus lagu">×</button></div>`).join('');
  box.querySelectorAll('button[data-i]').forEach(b=>b.onclick=()=>selectTrack(Number(b.dataset.i),true));
  box.querySelectorAll('button[data-remove]').forEach(b=>b.onclick=e=>{e.stopPropagation();removeTrack(Number(b.dataset.remove))});
  box.querySelectorAll('button[data-up]').forEach(b=>b.onclick=e=>{e.stopPropagation();moveTrack(Number(b.dataset.up),-1)});
  box.querySelectorAll('button[data-down]').forEach(b=>b.onclick=e=>{e.stopPropagation();moveTrack(Number(b.dataset.down),1)});
  box.querySelectorAll('.track').forEach(row=>{
    row.addEventListener('dblclick',e=>{
      // Double-click the playlist row (not its action buttons) to load and play that track.
      if(e.target.closest('button')) return;
      const i=Number(row.dataset.track);
      if(Number.isInteger(i) && i>=0 && i<tracks.length){
        selectTrack(i,true);
      }
    });
    row.addEventListener('dragstart',e=>{dragFrom=Number(row.dataset.track);row.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(dragFrom))});
    row.addEventListener('dragend',()=>{dragFrom=-1;box.querySelectorAll('.track').forEach(x=>x.classList.remove('dragging','dropTarget'))});
    row.addEventListener('dragover',e=>{e.preventDefault();if(Number(row.dataset.track)!==dragFrom)row.classList.add('dropTarget');e.dataTransfer.dropEffect='move'});
    row.addEventListener('dragleave',()=>row.classList.remove('dropTarget'));
    row.addEventListener('drop',e=>{e.preventDefault();const to=Number(row.dataset.track);row.classList.remove('dropTarget');if(dragFrom>=0&&to!==dragFrom)moveTrack(dragFrom,to-dragFrom)});
  });
}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
function moveTrack(from,delta){const to=from+delta;if(from<0||from>=tracks.length||to<0||to>=tracks.length)return;const wasCurrent=cur===from;const [item]=tracks.splice(from,1);tracks.splice(to,0,item);if(cur===from)cur=to;else if(cur>from&&cur<=to)cur--;else if(cur<from&&cur>=to)cur++;renderPlaylist();status('URUTAN PLAYLIST DIPINDAHKAN');setTimeout(()=>status(''),900)}

function removeTrack(i){if(i<0||i>=tracks.length)return;const wasCurrent=i===cur;const wasPlaying=!music.paused;const [removed]=tracks.splice(i,1);try{if(removed&&removed.url)URL.revokeObjectURL(removed.url)}catch(e){}
  if(!tracks.length){cancelFade(music);music.pause();try{music.currentTime=0}catch(e){}music.removeAttribute('src');music.load();music.__pacURL=null;cur=-1;renderPlaylist();$('musicTime').textContent='00:00 / 00:00';$('musicTc').textContent='TIME -00:00';$('musicTc').classList.remove('on');$('musicSeek').value=0;$('musicSeekCurrent').textContent='00:00';$('musicSeekDuration').textContent='00:00';return}
  if(i<cur)cur--;
  else if(i===cur){cur=Math.min(i,tracks.length-1);cancelFade(music);music.pause();try{music.currentTime=0}catch(e){}music.removeAttribute('src');music.load();music.__pacURL=null;selectTrack(cur,wasPlaying)}
  renderPlaylist();}
function currentTrack(){return cur>=0?tracks[cur]:null}
function selectTrack(i,autoplay){
  const t=tracks[i];if(!t)return;
  cur=i;renderPlaylist();
  if(pflEnabled) playPflForTrack(i);
  cancelFade(music);music.pause();music.removeAttribute('src');music.load();music.__pacURL=t.url;music.src=t.url;music.preload='auto';music.muted=false;music.load();music.volume=targetMusicVolume();
  if(autoplay){ void playNative(music,'Music Player'); }
}
function clearAllMusic(){
  stopPfl();
  cancelFade(music);music.pause();try{music.currentTime=0}catch(e){}
  tracks.forEach(t=>{try{if(t.url)URL.revokeObjectURL(t.url)}catch(e){}});
  tracks=[];cur=-1;music.removeAttribute('src');music.load();music.__pacURL=null;music.volume=targetMusicVolume();$('musicFiles').value='';renderPlaylist();$('musicTime').textContent='00:00 / 00:00';$('musicTc').textContent='TIME -00:00';$('musicTc').classList.remove('on');$('musicSeek').value=0;$('musicSeekCurrent').textContent='00:00';$('musicSeekDuration').textContent='00:00';status('')
}
$('musicFiles').onchange=e=>{const fs=[...(e.target.files||[])];if(fs.length)addMusicFiles(fs);e.target.value='';};
bindFileDrop($('musicPlayerDropZone'),files=>addMusicFiles(files));
$('clearAllMusic').onclick=clearAllMusic;
const noteKey='pac_operator_notes_v2';
const musicNotes=$('musicNotes'),clearNote=$('clearNote');
try{
  const saved=localStorage.getItem(noteKey);
  if(saved)musicNotes.innerHTML=saved;
  else {const legacy=localStorage.getItem('pac_operator_notes_v1');if(legacy)musicNotes.textContent=legacy;}
}catch(e){}
function saveNotes(){try{localStorage.setItem(noteKey,musicNotes.innerHTML)}catch(e){}}
function formatNote(cmd,value=null){musicNotes.focus();try{document.execCommand(cmd,false,value)}catch(e){}saveNotes()}
document.querySelectorAll('.noteToolbar [data-cmd]').forEach(btn=>btn.addEventListener('click',()=>formatNote(btn.dataset.cmd)));
$('noteFontSize').addEventListener('change',e=>formatNote('fontSize',e.target.value));
musicNotes.addEventListener('input',saveNotes);
musicNotes.addEventListener('blur',saveNotes);
clearNote.onclick=()=>{musicNotes.innerHTML='';try{localStorage.removeItem(noteKey);localStorage.removeItem('pac_operator_notes_v1')}catch(e){}musicNotes.focus()};

$('musicOnlyPanel')?.addEventListener('dblclick',e=>{
  if(e.target.closest('button,input,label,.playlist,.notesBlock,.track,.noteToolbar')) return;
  if(!music.src) return;
  if(music.paused){
    if(music.ended)try{music.currentTime=0}catch(err){}
    music.volume=targetMusicVolume();
    void resumeVizAudio(music);
    void playNative(music,'Music Player');
  }else{
    fadeOutMusicPlayer();
  }
});

$('musicPfl').onclick=()=>{
  if(!tracks.length){$('musicFiles').click();return;}
  if(pflEnabled){stopPfl();return;}
  const idx=cur>=0?cur:0; playPflForTrack(idx);
};

$('musicPlay').onclick=()=>{if(musicFadeTimer){clearInterval(musicFadeTimer);musicFadeTimer=null;}status('');if(!tracks.length){$('musicFiles').click();return}if(cur<0){selectTrack(0,false);return}if(music.paused){if(music.ended)try{music.currentTime=0}catch(e){}music.volume=targetMusicVolume();void resumeVizAudio(music);void playNative(music,'Music Player')}else music.pause()};
$('musicStop').onclick=()=>{if(musicFadeTimer){clearInterval(musicFadeTimer);musicFadeTimer=null;}cancelFade(music);music.pause();try{music.currentTime=0}catch(e){}music.volume=targetMusicVolume()};
$('next').onclick=()=>{if(tracks.length)selectTrack((cur+1)%tracks.length,true)};
$('prev').onclick=()=>{if(tracks.length)selectTrack((cur-1+tracks.length)%tracks.length,true)};
let shuffleEnabled=false;
$('shuffle').onclick=()=>{shuffleEnabled=!shuffleEnabled;$('shuffle').classList.toggle('active',shuffleEnabled);$('shuffle').setAttribute('aria-pressed',shuffleEnabled?'true':'false')};
$('musicLoop').onclick=()=>{music.loop=!music.loop;$('musicLoop').style.background=music.loop?'#17608a':''};
let musicFadeTimer=null;
function fadeOutMusicPlayer(){
  if(!music || music.paused) return;
  if(musicFadeTimer){clearInterval(musicFadeTimer);musicFadeTimer=null;}
  const start=Math.max(0,Math.min(1,Number.isFinite(music.volume)?music.volume:targetMusicVolume()));
  const target=0;
  const duration=Math.max(100,Number(fadeDuration)||1000);
  const started=performance.now();
  setMediaGain(music,start);
  musicFadeTimer=setInterval(()=>{
    const q=Math.min(1,(performance.now()-started)/duration);
    setMediaGain(music,start+(target-start)*q);
    if(q>=1){
      clearInterval(musicFadeTimer);
      musicFadeTimer=null;
      music.pause();
      setMediaGain(music,targetMusicVolume());
    }
  },20);
}
$('musicFade').onclick=fadeOutMusicPlayer;
$('musicVol').oninput=e=>{
  const v=Math.max(0,Math.min(1,parseFloat(e.target.value)||0));$('musicVolText').textContent=Math.round(v*100)+'%';
  if(!muted){ensureAnalyzer(music);setMediaGain(music,v*masterGain)}
};
$('musicSeek').oninput=e=>{
  const d=Number.isFinite(music.duration)?music.duration:0;
  if(d>0){const pos=(parseFloat(e.target.value)||0)/1000*d;music.currentTime=pos;updateMusic(true)}
};
music.addEventListener('play',()=>{$('musicPlay').textContent='❚❚ PAUSE'});
music.addEventListener('pause',()=>$('musicPlay').textContent='▶ PLAY');
music.addEventListener('ended',()=>{
  if(music.loop){try{music.currentTime=0}catch(e){};void resumeVizAudio(music);void playNative(music,'Music Player');return;}
  if(!tracks.length)return;
  let nextIndex;
  if(shuffleEnabled&&tracks.length>1){do{nextIndex=Math.floor(Math.random()*tracks.length)}while(nextIndex===cur)}else nextIndex=(cur+1)%tracks.length;
  selectTrack(nextIndex,true);
});
musicPfl.addEventListener('ended',()=>{pflEnabled=false;pflTrackIndex=-1;setMediaGain(musicPfl,0);updatePflUI()});
musicPfl.addEventListener('error',()=>mediaError('Music Player PFL',musicPfl));
music.addEventListener('error',()=>mediaError('Music Player',music));
function updateMusic(force=false){
  const d=Number.isFinite(music.duration)?music.duration:0,c=music.currentTime||0;
  $('musicTime').textContent=fmt(c)+' / '+fmt(d);$('musicTc').textContent='TIME -'+fmt(Math.max(0,d-c));$('musicTc').classList.toggle('on',!music.paused&&d>0);$('musicSeek').value=d?Math.round(c/d*1000):0;$('musicSeekCurrent').textContent=fmt(c);$('musicSeekDuration').textContent=fmt(d);
  $('musicPlay').textContent=music.paused?'▶ PLAY':'❚❚ PAUSE';
  requestAnimationFrame(updateMusic)
}
requestAnimationFrame(updateMusic);
requestAnimationFrame(renderVisualizers);

function applyVolumes(){pads.forEach((p,i)=>{if(!fadeJobs.has(p.audio)){ensureAnalyzer(p.audio);setMediaGain(p.audio,targetPadVolume(i))}});ensureAnalyzer(music);setMediaGain(music,targetMusicVolume());ensureAnalyzer(musicPfl);if(!pflEnabled)setMediaGain(musicPfl,0)}
$('master').oninput=e=>{masterGain=parseFloat(e.target.value)||0;$('masterText').textContent=Math.round(masterGain*100)+'%';if(!muted)applyVolumes()};

const FADE_TIME_MIN=1.0;
const FADE_TIME_MAX=10.0;
const FADE_TIME_STEP=0.5;
let masterFadeSeconds=1.0;
fadeDuration=Math.round(masterFadeSeconds*1000);
function setFadeTime(seconds){
  const snapped=Math.round((Number(seconds)||FADE_TIME_MIN)/FADE_TIME_STEP)*FADE_TIME_STEP;
  masterFadeSeconds=Math.max(FADE_TIME_MIN,Math.min(FADE_TIME_MAX,snapped));
  fadeDuration=Math.round(masterFadeSeconds*1000);
  updateFadeText();
}
function updateFadeText(){
  const el=$('masterFadeText');
  if(el) el.textContent=masterFadeSeconds.toFixed(1)+'s';
}
$('fadeMinus').onclick=()=>setFadeTime(masterFadeSeconds-FADE_TIME_STEP);
$('fadePlus').onclick=()=>setFadeTime(masterFadeSeconds+FADE_TIME_STEP);
updateFadeText();
function clearAllPads(){
  if(!pads.length)return;
  pads.forEach((p,i)=>{
    cancelFade(p.audio);
    p.audio.pause();
    try{p.audio.currentTime=0}catch(e){}
    revokeMediaURL(p.audio);
    p.file=null;
    p.audio.removeAttribute('src');
    p.audio.load();
    p.audio.volume=targetPadVolume(i);
    p.loop=false;
    const file=$('file'+i);
    if(file)file.value='';
    const name=$('name'+i);
    if(name)name.textContent=padNames[i];
    const loopBtn=$('loop'+i);
    if(loopBtn)loopBtn.style.background='';
    updatePad(i);
  });
  masterFadeRunning=false;
  $('masterFadeBtn')?.classList.remove('active');
}
$('clearAllPads').onclick=clearAllPads;

$('masterFadeBtn').onclick=()=>{
  if(masterFadeRunning)return;
  const active=pads.filter(p=>p&&p.audio&&(!p.audio.paused||fadeJobs.has(p.audio)));
  if(!active.length)return;
  masterFadeRunning=true;
  $('masterFadeBtn').classList.add('active');
  const dur=Math.max(80,Number(fadeDuration)||1000);
  // Take exclusive control of the active pads for this master fade so an
  // older per-pad fade cannot fight the master fade animation.
  active.forEach(p=>cancelFade(p.audio));
  const starts=active.map(p=>getMediaGain(p.audio));
  const t0=performance.now();
  function step(t){
    const q=Math.min(1,(t-t0)/dur);
    active.forEach((p,i)=>{
      const a=p.audio;
      // Fade the actual Web Audio gain used by the V26 audio engine.
      // Do not use HTMLMediaElement.volume here because setMediaGain()
      // keeps that property at 1 when the analyser/gain path is active.
      if(a) setMediaGain(a,starts[i]*(1-q));
      updatePad(pads.indexOf(p));
    });
    if(q<1){
      requestAnimationFrame(step);
      return;
    }
    active.forEach(p=>{
      const a=p.audio;
      if(!a)return;
      cancelFade(a);
      setMediaGain(a,0);
      a.pause();
      try{a.currentTime=0}catch(e){}
      setMediaGain(a,targetPadVolume(pads.indexOf(p)));
      updatePad(pads.indexOf(p));
    });
    masterFadeRunning=false;
    $('masterFadeBtn').classList.remove('active');
  }
  requestAnimationFrame(step);
};
$('stopAll').onclick=()=>{pads.forEach((p,i)=>{cancelFade(p.audio);p.audio.pause();try{p.audio.currentTime=0}catch(e){}});music.pause();try{music.currentTime=0}catch(e){};stopPfl();applyVolumes()};
$('muteAll').onclick=()=>{muted=!muted;applyVolumes();$('muteAll').textContent=muted?'🔊 UNMUTE':'🔇 MUTE';$('muteAll').classList.toggle('muted',muted)};
$('topStopAll').onclick=()=>$('stopAll').click(); $('topMute').onclick=()=>$('muteAll').click();

const playerSkinKey='pac_player_skin_v1';
function applyPlayerSkin(skin){const allowed=['neon','studio','purple','red','gold'];if(!allowed.includes(skin))skin='neon';const panel=document.querySelector('.musicOnlyPanel');if(panel){panel.classList.remove('playerSkin-neon','playerSkin-studio','playerSkin-purple','playerSkin-red','playerSkin-gold');panel.classList.add('playerSkin-'+skin)}document.querySelectorAll('.playerSkinOption').forEach(b=>b.classList.toggle('active',b.dataset.playerSkin===skin));try{localStorage.setItem(playerSkinKey,skin)}catch(e){}}
document.querySelectorAll('.playerSkinOption').forEach(b=>b.onclick=()=>{applyPlayerSkin(b.dataset.playerSkin);status('MUSIC PLAYER SKIN: '+b.querySelector('b').textContent.replace(/^\d+\s*•\s*/,''));setTimeout(()=>status(''),900)});
let savedPlayerSkin='neon';try{savedPlayerSkin=localStorage.getItem(playerSkinKey)||'neon'}catch(e){}applyPlayerSkin(savedPlayerSkin);
const skinKey='pac_skin_v1';
function applySkin(skin){const allowed=['broadcast','midnight','red','green','amber'];if(!allowed.includes(skin))skin='broadcast';document.body.classList.remove('skin-midnight','skin-red','skin-green','skin-amber');if(skin!=='broadcast')document.body.classList.add('skin-'+skin);document.querySelectorAll('.skinOption').forEach(b=>b.classList.toggle('active',b.dataset.skin===skin));try{localStorage.setItem(skinKey,skin)}catch(e){}}
function openSettings(){const m=$('settingsModal');m.classList.add('open');m.setAttribute('aria-hidden','false')}
function closeSettings(){const m=$('settingsModal');m.classList.remove('open');m.setAttribute('aria-hidden','true')}
$('settingsBtn').onclick=openSettings;$('settingsClose').onclick=closeSettings;$('settingsModal').addEventListener('click',e=>{if(e.target.id==='settingsModal')closeSettings()});document.querySelectorAll('.skinOption').forEach(b=>b.onclick=()=>{applySkin(b.dataset.skin);status('SKIN: '+b.querySelector('b').textContent.replace(/^\d+\s*•\s*/,''));setTimeout(()=>status(''),900)});let savedSkin='broadcast';try{savedSkin=localStorage.getItem(skinKey)||'broadcast'}catch(e){}applySkin(savedSkin);
function clock(){const d=new Date();$('clock').innerHTML=d.toLocaleTimeString('id-ID',{hour12:false})+'<small>'+d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})+'</small>'}clock();setInterval(clock,1000);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSettings()});

if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');

const vizStyleKey='pac_viz_style_v1';
let vizStyle='bars';try{vizStyle=localStorage.getItem(vizStyleKey)||'bars'}catch(e){} window.pacVizStyle=vizStyle
function setVizStyle(v){
 const ok=['bars','mirror','wave','pulse','matrix']; if(!ok.includes(v))v='bars';
 vizStyle=v; window.pacVizStyle=v; document.querySelectorAll('.vizOption').forEach(b=>b.classList.toggle('active',b.dataset.vizStyle===v));
 try{localStorage.setItem(vizStyleKey,v)}catch(e){}
}
document.querySelectorAll('.vizOption').forEach(b=>b.onclick=()=>setVizStyle(b.dataset.vizStyle));setVizStyle(vizStyle);
const fontKey='pac_font_v1';let savedFont='inter';try{savedFont=localStorage.getItem(fontKey)||'inter'}catch(e){}
function setFont(f){
 const ok=['inter','orbitron','rajdhani','mono','serif'];if(!ok.includes(f))f='inter';
 document.body.classList.remove(...ok.map(x=>'font-'+x));document.body.classList.add('font-'+f);
 document.querySelectorAll('.fontOption').forEach(b=>b.classList.toggle('active',b.dataset.font===f));
 try{localStorage.setItem(fontKey,f)}catch(e){}
}
document.querySelectorAll('.fontOption').forEach(b=>b.onclick=()=>setFont(b.dataset.font));setFont(savedFont);
