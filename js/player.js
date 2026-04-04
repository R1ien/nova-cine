/* ═══════════════════════════════════════════
   NovaCiné — player.js  (Video.js + Liquid Glass UI v4)
   - Barre flottante sans fond global, boutons glass individuels
   - Auto-hide géré 100% manuellement sur _ctrlEl directement
   - VJS inactivityTimeout neutralisé via MutationObserver
   - Fullscreen fiable (listeners sur document)
   ═══════════════════════════════════════════ */

var _currentVideoUrl = '';
var _vjsPlayer       = null;
var _hideTimer       = null;
var _ctrlEl          = null;   // div.vjs-control-bar — cible directe du hide
var _vjsEl           = null;   // div.video-js
var _mo              = null;   // MutationObserver anti-vjs-user-inactive

var IS_IOS    = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
var IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/* ══════════════════════════════
   INJECT Video.js (lazy, once)
══════════════════════════════ */
var _vjsLoaded = false;
function loadVjsAssets() {
  return new Promise(function(resolve) {
    if (_vjsLoaded && typeof videojs !== 'undefined') { resolve(); return; }
    if (!document.getElementById('vjs-css')) {
      var l = document.createElement('link');
      l.id = 'vjs-css'; l.rel = 'stylesheet';
      l.href = 'https://cdnjs.cloudflare.com/ajax/libs/video.js/8.10.0/video-js.min.css';
      document.head.appendChild(l);
    }
    if (!document.getElementById('vjs-js')) {
      var s = document.createElement('script');
      s.id = 'vjs-js';
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/video.js/8.10.0/video.min.js';
      s.onload = function() { _vjsLoaded = true; injectTheme(); resolve(); };
      document.head.appendChild(s);
    } else if (typeof videojs !== 'undefined') {
      _vjsLoaded = true; resolve();
    } else {
      var c = setInterval(function() {
        if (typeof videojs !== 'undefined') { clearInterval(c); _vjsLoaded = true; resolve(); }
      }, 80);
    }
  });
}

/* ══════════════════════════════
   THÈME LIQUID GLASS
══════════════════════════════ */
function injectTheme() {
  if (document.getElementById('nc-vjs-lg')) return;
  var s = document.createElement('style');
  s.id = 'nc-vjs-lg';
  s.textContent = `
    /* ── Conteneur ── */
    #nc-wrap {
      position: relative; width: 100%; height: 100%;
      background: #000; overflow: hidden;
      font-family: 'DM Sans', system-ui, sans-serif;
    }

    /* ── Bulles ── */
    .nc-bbl {
      position: absolute; border-radius: 50%;
      pointer-events: none; z-index: 0; opacity: 0;
      animation: ncFloat linear infinite;
    }
    @keyframes ncFloat {
      0%   { transform: translateY(0) scale(1);    opacity: 0; }
      12%  { opacity: .65; }
      88%  { opacity: .35; }
      100% { transform: translateY(-118%) scale(.45); opacity: 0; }
    }

    /* ── Video.js reset ── */
    #nc-wrap .video-js {
      position: relative; z-index: 1;
      width: 100% !important; height: 100% !important;
      background: transparent;
    }
    /* Annuler TOUT ce que VJS fait avec vjs-user-inactive */
    #nc-wrap .video-js.vjs-user-inactive .vjs-control-bar,
    #nc-wrap .video-js.vjs-user-active .vjs-control-bar {
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: auto !important;
      transform: none !important;
    }
    #nc-wrap .vjs-tech { background: #000; object-fit: contain; }

    /* ─────────────────────────────────────────
       BARRE DE CONTRÔLE — flottante, sans fond global
       Le fond est sur la 2e ligne seulement (boutons glass individuels)
    ───────────────────────────────────────── */
    #nc-wrap .vjs-control-bar {
      background: transparent !important;
      display: flex !important;
      flex-direction: column;
      gap: 4px;
      height: auto !important;
      padding: 0 12px 12px;
      position: absolute; bottom: 0; left: 0; right: 0;
      z-index: 10;
      /* Notre transition, pas celle de VJS */
      transition: opacity .3s ease, transform .3s ease !important;
      opacity: 1 !important;
    }

    /* ── État caché — sur _ctrlEl directement via classe nc-off ── */
    #nc-wrap .vjs-control-bar.nc-off {
      opacity: 0 !important;
      transform: translateY(8px) !important;
      pointer-events: none !important;
    }

    /* Toujours visible en pause */
    #nc-wrap .video-js.vjs-paused .vjs-control-bar {
      opacity: 1 !important;
      transform: none !important;
      pointer-events: auto !important;
    }

    /* ─── Ligne 1 : barre de progression ─── */
    #nc-wrap .vjs-progress-control {
      width: 100% !important;
      height: 16px;
      display: flex; align-items: center;
      cursor: pointer;
    }
    #nc-wrap .vjs-progress-holder {
      flex: 1; height: 4px;
      border-radius: 4px;
      background: rgba(255,255,255,.2);
      transition: height .15s;
      position: relative; overflow: visible;
    }
    #nc-wrap .vjs-progress-control:hover .vjs-progress-holder { height: 7px; }
    #nc-wrap .vjs-play-progress {
      background: linear-gradient(90deg, #c87010, #e8a020, #f0c060);
      border-radius: 4px;
    }
    #nc-wrap .vjs-play-progress::before {
      content: '';
      position: absolute; right: -5px; top: 50%;
      transform: translateY(-50%) scale(0);
      width: 13px; height: 13px;
      background: #f0c060; border-radius: 50%;
      box-shadow: 0 0 8px rgba(240,192,96,.6);
      transition: transform .15s;
    }
    #nc-wrap .vjs-progress-control:hover .vjs-play-progress::before { transform: translateY(-50%) scale(1); }
    #nc-wrap .vjs-load-progress { background: rgba(255,255,255,.12); border-radius: 4px; }
    #nc-wrap .vjs-load-progress div { background: rgba(255,255,255,.08); }
    #nc-wrap .vjs-time-tooltip {
      background: rgba(8,12,20,.9);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(232,160,32,.35);
      color: #e8a020; border-radius: 8px;
      font-size: .72rem; padding: 3px 8px;
    }
    #nc-wrap .vjs-mouse-display { display: none; }

    /* ─── Ligne 2 : boutons flottants ─── */
    /* Chaque bouton = pill glass individuel, pas de fond commun */
    .nc-btn {
      display: inline-flex;
      align-items: center; justify-content: center;
      width: 38px; height: 38px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,.18);
      background: rgba(15,22,35,.55);
      backdrop-filter: blur(20px) saturate(1.6);
      -webkit-backdrop-filter: blur(20px) saturate(1.6);
      box-shadow:
        0 2px 12px rgba(0,0,0,.35),
        inset 0 1px 0 rgba(255,255,255,.12);
      color: rgba(255,255,255,.9);
      cursor: pointer;
      transition: background .18s, border-color .18s, transform .14s, box-shadow .18s;
      position: relative; overflow: hidden;
      flex-shrink: 0;
    }
    /* Reflet glass interne */
    .nc-btn::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 50%;
      border-radius: 50% 50% 0 0;
      background: linear-gradient(to bottom, rgba(255,255,255,.14), transparent);
      pointer-events: none;
    }
    .nc-btn svg { width: 18px; height: 18px; fill: currentColor; position: relative; z-index: 1; }
    .nc-btn:hover {
      background: rgba(232,160,32,.25);
      border-color: rgba(232,160,32,.55);
      box-shadow: 0 2px 18px rgba(232,160,32,.2), inset 0 1px 0 rgba(255,255,255,.15);
      transform: scale(1.1);
    }
    .nc-btn:active { transform: scale(.93); }

    /* Play — légèrement plus grand */
    .nc-btn.nc-play {
      width: 44px; height: 44px;
      background: rgba(232,160,32,.2);
      border-color: rgba(232,160,32,.5);
      box-shadow: 0 2px 16px rgba(232,160,32,.18), inset 0 1px 0 rgba(255,255,255,.15);
    }
    .nc-btn.nc-play svg { width: 20px; height: 20px; }
    .nc-btn.nc-play:hover { background: rgba(232,160,32,.38); }

    /* Temps */
    .nc-time {
      color: rgba(255,255,255,.65);
      font-size: .74rem; font-weight: 500;
      padding: 0 6px; white-space: nowrap;
      text-shadow: 0 1px 4px rgba(0,0,0,.6);
    }

    /* Volume slider */
    .nc-vol-range {
      width: 58px;
      accent-color: #e8a020;
      cursor: pointer;
    }

    /* Pill vitesse */
    .nc-speed {
      height: 30px; padding: 0 11px;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,.18);
      background: rgba(15,22,35,.55);
      backdrop-filter: blur(20px) saturate(1.6);
      box-shadow: 0 2px 10px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.1);
      color: rgba(255,255,255,.8);
      font-size: .72rem; font-weight: 600;
      cursor: pointer;
      transition: background .18s, border-color .18s;
      font-family: inherit;
    }
    .nc-speed:hover {
      background: rgba(232,160,32,.22);
      border-color: rgba(232,160,32,.5);
      color: #e8a020;
    }

    /* Big play button */
    #nc-wrap .vjs-big-play-button {
      width: 68px; height: 68px; border-radius: 50%;
      border: 2px solid rgba(232,160,32,.6) !important;
      background: rgba(8,12,20,.55) !important;
      backdrop-filter: blur(16px);
      top: 50%; left: 50%;
      transform: translate(-50%, -50%); margin: 0;
      transition: background .2s, transform .2s, border-color .2s;
    }
    #nc-wrap .vjs-big-play-button::before { color: #e8a020 !important; font-size: 1.9em; line-height: 64px; }
    #nc-wrap .video-js:hover .vjs-big-play-button {
      background: rgba(232,160,32,.2) !important;
      border-color: rgba(232,160,32,.9) !important;
      transform: translate(-50%, -50%) scale(1.08);
    }

    /* Spinner */
    #nc-wrap .vjs-loading-spinner { border-color: rgba(232,160,32,.25); }
    #nc-wrap .vjs-loading-spinner::before,
    #nc-wrap .vjs-loading-spinner::after { border-top-color: #e8a020; }

    /* Cacher les contrôles VJS natifs */
    #nc-wrap .vjs-play-control,
    #nc-wrap .vjs-mute-control,
    #nc-wrap .vjs-fullscreen-control,
    #nc-wrap .vjs-volume-panel,
    #nc-wrap .vjs-current-time,
    #nc-wrap .vjs-time-divider,
    #nc-wrap .vjs-duration,
    #nc-wrap .vjs-playback-rate,
    #nc-wrap .vjs-skip-backward,
    #nc-wrap .vjs-skip-forward,
    #nc-wrap .vjs-remaining-time { display: none !important; }

    /* Loading */
    .nc-loading { display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:1rem;color:rgba(220,232,247,.7);font-family:'DM Sans',sans-serif; }
    .nc-spin { width:38px;height:38px;border:3px solid rgba(255,255,255,.1);border-top-color:#e8a020;border-radius:50%;animation:ncSpin .8s linear infinite; }
    @keyframes ncSpin { to { transform: rotate(360deg); } }

    /* Fallback */
    .nc-fallback { display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:1.2rem;padding:1.5rem;text-align:center;font-family:'DM Sans',sans-serif; }
    .nc-fallback-icon { font-size:2.5rem; }
    .nc-fallback-msg  { color:rgba(220,232,247,.9);font-size:.88rem;line-height:1.6;max-width:380px; }
    .nc-fallback-btn  { background:#e8a020;color:#000;font-weight:700;padding:.7rem 1.4rem;border-radius:12px;text-decoration:none;font-size:.9rem;display:inline-block; }
    .nc-fallback-url  { color:rgba(220,232,247,.35);font-size:.72rem;word-break:break-all;max-width:340px; }

    /* Banner iOS */
    .nc-ios-banner { position:absolute;top:0;left:0;right:0;z-index:30;background:rgba(232,160,32,.12);backdrop-filter:blur(12px);border-bottom:1px solid rgba(232,160,32,.28);padding:.5rem 1rem;display:flex;align-items:center;justify-content:space-between;gap:.8rem;font-family:'DM Sans',sans-serif;animation:ncSlideDown .3s ease; }
    @keyframes ncSlideDown { from { transform:translateY(-100%); } to { transform:none; } }
    .nc-ios-banner span { font-size:.75rem;color:rgba(220,232,247,.85);line-height:1.4; }
    .nc-ios-banner a    { flex-shrink:0;background:#e8a020;color:#000;font-weight:700;padding:.35rem .8rem;border-radius:8px;text-decoration:none;font-size:.75rem; }

    /* Iframe */
    #nc-wrap iframe { position:relative;z-index:1;width:100%;height:100%;border:none;display:block; }
  `;
  document.head.appendChild(s);
}

/* ══════════════════════════════
   BULLES
══════════════════════════════ */
function createBubbles(container) {
  container.querySelectorAll('.nc-bbl').forEach(function(b){ b.remove(); });
  var colors = ['rgba(232,160,32,.26)','rgba(192,57,43,.18)','rgba(220,232,247,.06)','rgba(46,204,113,.14)'];
  var n = IS_MOBILE ? 5 : 10;
  for (var i = 0; i < n; i++) {
    (function(){
      var b = document.createElement('div');
      b.className = 'nc-bbl';
      var sz = 6 + Math.random() * 22, dr = 8 + Math.random() * 10;
      b.style.cssText =
        'width:'+sz+'px;height:'+sz+'px;left:'+(3+Math.random()*92)+'%;bottom:0;' +
        'background:'+colors[Math.floor(Math.random()*colors.length)]+';' +
        'animation-duration:'+dr+'s;animation-delay:'+(-(Math.random()*dr))+'s;' +
        'box-shadow:inset 0 0 '+(sz*.35)+'px rgba(255,255,255,.1);';
      container.appendChild(b);
    })();
  }
}

/* ══════════════════════════════
   AUTO-HIDE — cible _ctrlEl.classList directement
   + MutationObserver pour neutraliser vjs-user-inactive
══════════════════════════════ */
function showCtrl() {
  if (!_ctrlEl) return;
  _ctrlEl.classList.remove('nc-off');
  clearTimeout(_hideTimer);
}
function scheduleHide() {
  if (!_ctrlEl) return;
  clearTimeout(_hideTimer);
  if (_vjsPlayer && _vjsPlayer.paused()) return;
  _hideTimer = setTimeout(function() {
    if (_ctrlEl) _ctrlEl.classList.add('nc-off');
  }, 4000);
}
function onActivity() { showCtrl(); scheduleHide(); }

function attachActivity() {
  document.addEventListener('mousemove',  onActivity, { passive: true });
  document.addEventListener('touchstart', onActivity, { passive: true });
  document.addEventListener('keydown',    onActivity, { passive: true });
}
function detachActivity() {
  document.removeEventListener('mousemove',  onActivity);
  document.removeEventListener('touchstart', onActivity);
  document.removeEventListener('keydown',    onActivity);
  clearTimeout(_hideTimer);
  _hideTimer = null;
  if (_mo) { _mo.disconnect(); _mo = null; }
}

/* Bloque VJS d'ajouter vjs-user-inactive sur .video-js */
function watchVjsClasses() {
  if (!_vjsEl) return;
  if (_mo) _mo.disconnect();
  _mo = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      if (m.attributeName === 'class' && _vjsEl.classList.contains('vjs-user-inactive')) {
        _vjsEl.classList.remove('vjs-user-inactive');
      }
    });
  });
  _mo.observe(_vjsEl, { attributes: true, attributeFilter: ['class'] });
}

/* ══════════════════════════════
   SVG ICÔNES
══════════════════════════════ */
var IC = {
  play:  '<svg viewBox="0 0 24 24"><path d="M8 5.14v13.72L19 12 8 5.14z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
  rew:   '<svg viewBox="0 0 24 24"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="13.8" text-anchor="middle" font-size="5.5" font-family="DM Sans,sans-serif" font-weight="700" fill="currentColor">10</text></svg>',
  fwd:   '<svg viewBox="0 0 24 24"><path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z"/><text x="12" y="13.8" text-anchor="middle" font-size="5.5" font-family="DM Sans,sans-serif" font-weight="700" fill="currentColor">10</text></svg>',
  volOn: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
  volOff:'<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
  fsIn:  '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
  fsOut: '<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',
};

/* ══════════════════════════════
   CONSTRUIRE BARRE CUSTOM
══════════════════════════════ */
function buildCustomControls(wrap) {
  _vjsEl  = wrap.querySelector('.video-js');
  _ctrlEl = _vjsEl ? _vjsEl.querySelector('.vjs-control-bar') : null;
  if (!_ctrlEl) return;

  // Vider la barre native
  _ctrlEl.innerHTML = '';

  /* ── Ligne 1 : barre de progression (garde les classes VJS) ── */
  var prog = document.createElement('div');
  prog.className = 'vjs-progress-control vjs-control';
  prog.innerHTML =
    '<div class="vjs-progress-holder vjs-slider vjs-slider-horizontal" role="slider" aria-label="Progression">' +
    '<div class="vjs-load-progress"></div>' +
    '<div class="vjs-play-progress vjs-slider-bar"><span class="vjs-control-text" aria-live="off"></span></div>' +
    '</div>';
  _ctrlEl.appendChild(prog);

  /* ── Ligne 2 : boutons flottants ── */
  var row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:7px;';

  function mkBtn(extraClass, html, title, fn) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'nc-btn' + (extraClass ? ' ' + extraClass : '');
    b.title = title; b.innerHTML = html;
    b.addEventListener('click', function(e){ e.stopPropagation(); fn(); });
    return b;
  }

  var playBtn = mkBtn('nc-play', IC.play, 'Lecture/Pause', playerTogglePlay);
  playBtn.id = 'nc-play-btn';
  var rewBtn  = mkBtn('', IC.rew,  'Reculer 10s',  function(){ playerSkip(-10); });
  var fwdBtn  = mkBtn('', IC.fwd,  'Avancer 10s',  function(){ playerSkip(10);  });

  var timeEl = document.createElement('span');
  timeEl.className = 'nc-time'; timeEl.id = 'nc-time';
  timeEl.textContent = '0:00 / 0:00';

  var sp = document.createElement('div'); sp.style.flex = '1';

  var volBtn = mkBtn('', IC.volOn, 'Muet', playerToggleMute);
  volBtn.id = 'nc-vol-btn';

  var volRange = document.createElement('input');
  volRange.type = 'range'; volRange.min = 0; volRange.max = 1;
  volRange.step = 0.05; volRange.value = 1;
  volRange.className = 'nc-vol-range';
  volRange.addEventListener('input', function(){ playerSetVol(this.value); });

  var speedBtn = document.createElement('button');
  speedBtn.type = 'button'; speedBtn.className = 'nc-speed'; speedBtn.title = 'Vitesse';
  speedBtn.textContent = '1×';
  var _speeds = [0.5,0.75,1,1.25,1.5,2], _si = 2;
  speedBtn.addEventListener('click', function(e){
    e.stopPropagation();
    _si = (_si+1) % _speeds.length;
    if (_vjsPlayer) _vjsPlayer.playbackRate(_speeds[_si]);
    speedBtn.textContent = _speeds[_si]+'×';
  });

  var fsBtn = mkBtn('', IC.fsIn, 'Plein écran', playerToggleFS);
  fsBtn.id = 'nc-fs-btn';

  row.append(playBtn, rewBtn, fwdBtn, timeEl, sp, volBtn, volRange, speedBtn, fsBtn);
  _ctrlEl.appendChild(row);

  /* ── Sync VJS events ── */
  _vjsPlayer.on('play',  function(){ var b=document.getElementById('nc-play-btn'); if(b) b.innerHTML=IC.pause; });
  _vjsPlayer.on('pause', function(){ var b=document.getElementById('nc-play-btn'); if(b) b.innerHTML=IC.play; showCtrl(); clearTimeout(_hideTimer); });
  _vjsPlayer.on('ended', function(){ var b=document.getElementById('nc-play-btn'); if(b) b.innerHTML=IC.play; });
  _vjsPlayer.on('timeupdate', function(){
    var cur=_vjsPlayer.currentTime(), dur=_vjsPlayer.duration();
    if (isNaN(dur)) return;
    var el=document.getElementById('nc-time');
    if (el) el.textContent = fmtTime(cur)+' / '+fmtTime(dur);
  });
  _vjsPlayer.on('volumechange', function(){
    var b=document.getElementById('nc-vol-btn');
    if (b) b.innerHTML=(_vjsPlayer.muted()||_vjsPlayer.volume()===0)?IC.volOff:IC.volOn;
  });
  _vjsPlayer.on('fullscreenchange', function(){
    var b=document.getElementById('nc-fs-btn');
    if (b) b.innerHTML=_vjsPlayer.isFullscreen()?IC.fsOut:IC.fsIn;
  });
}

function fmtTime(s) {
  s=Math.max(0,Math.floor(s));
  var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
  if(h>0) return h+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
  return m+':'+String(sec).padStart(2,'0');
}

/* ══════════════════════════════
   VÉRIFICATION URL
══════════════════════════════ */
async function checkVideoUrl(url) {
  if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/.test(url)) return {ok:true,type:'embed'};
  try {
    var res=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout?AbortSignal.timeout(5000):undefined});
    var cd=res.headers.get('content-disposition')||'',ct=res.headers.get('content-type')||'';
    if (cd.toLowerCase().includes('attachment')) return {ok:false,reason:'download'};
    if (ct&&!ct.startsWith('video/')&&!ct.includes('octet-stream')&&!ct.includes('mp4')&&!ct.includes('webm')) return {ok:false,reason:'type'};
    return {ok:true};
  } catch(e) { return {ok:null,reason:'cors'}; }
}
function videoType(url) {
  var e=url.split('.').pop().split('?')[0].toLowerCase();
  return ({mp4:'video/mp4',mkv:'video/x-matroska',mov:'video/quicktime',avi:'video/x-msvideo',webm:'video/webm',ogv:'video/ogg',m4v:'video/mp4',flv:'video/x-flv'})[e]||'video/mp4';
}

/* ══════════════════════════════
   BUILD PLAYER
══════════════════════════════ */
async function buildPlayer(url, resumeAt) {
  var wrap=document.getElementById('player-wrap');
  _currentVideoUrl=url; resumeAt=resumeAt||0;

  detachActivity();
  if (_vjsPlayer){try{_vjsPlayer.dispose();}catch(e){} _vjsPlayer=null;}
  _vjsEl=null; _ctrlEl=null; _vidElProxy=null;
  wrap.innerHTML='';

  /* Embeds */
  var embedHtml=null;
  if (/youtube\.com|youtu\.be/.test(url)){var id=(url.match(/(?:v=|youtu\.be\/)([^&?]+)/)||[])[1];if(id)embedHtml='<iframe src="https://www.youtube.com/embed/'+id+'?autoplay=1&start='+Math.floor(resumeAt)+'" allow="autoplay;fullscreen" allowfullscreen></iframe>';}
  else if (/vimeo\.com/.test(url)){var id=(url.match(/vimeo\.com\/(\d+)/)||[])[1];if(id)embedHtml='<iframe src="https://player.vimeo.com/video/'+id+'?autoplay=1#t='+Math.floor(resumeAt)+'s" allow="autoplay;fullscreen" allowfullscreen></iframe>';}
  else if (/dailymotion\.com/.test(url)){var id=(url.match(/dailymotion\.com\/video\/([^_?]+)/)||[])[1];if(id)embedHtml='<iframe src="https://www.dailymotion.com/embed/video/'+id+'?autoplay=1&start='+Math.floor(resumeAt)+'" allow="autoplay;fullscreen" allowfullscreen></iframe>';}
  if (embedHtml){wrap.innerHTML='<div id="nc-wrap" style="aspect-ratio:16/9">'+embedHtml+'</div>';createBubbles(wrap.querySelector('#nc-wrap'));return;}

  wrap.innerHTML='<div id="nc-wrap" style="aspect-ratio:16/9"><div class="nc-loading"><div class="nc-spin"></div><span style="font-size:.85rem">Vérification du lien…</span></div></div>';
  var check=await checkVideoUrl(url);
  if (check.ok===false){showFallback(wrap,url,check.reason);return;}
  if (IS_IOS&&check.ok===null){await buildVjs(wrap,url,resumeAt,true);return;}
  await buildVjs(wrap,url,resumeAt,false);
}

function showFallback(wrap,url,reason){
  var msg=reason==='download'?'Ce lien force le téléchargement et ne peut pas être lu directement.':'Ce lien ne semble pas pointer vers un fichier vidéo lisible.';
  if(IS_MOBILE)msg=reason==='download'?'Ce lien force le téléchargement.\nUtilisez un lien mp4/webm direct ou YouTube, Vimeo, Dailymotion.':'Format non supporté sur mobile.';
  wrap.innerHTML='<div id="nc-wrap" style="aspect-ratio:16/9"><div class="nc-fallback"><div class="nc-fallback-icon">⚠️</div><div class="nc-fallback-msg">'+msg.replace(/\n/g,'<br>')+'</div>'+(IS_MOBILE?'<a class="nc-fallback-btn" href="'+url+'">Ouvrir dans le navigateur</a>':'')+'<div class="nc-fallback-url">'+url+'</div></div></div>';
}
function showIosWarning(container){
  if(container.querySelector('.nc-ios-banner'))return;
  var b=document.createElement('div');b.className='nc-ios-banner';
  b.innerHTML='<span>Si la vidéo ne charge pas, le lien n\'est peut-être pas compatible mobile.</span><a href="'+_currentVideoUrl+'">Ouvrir ↗</a>';
  container.insertBefore(b,container.firstChild);
  setTimeout(function(){if(_vjsPlayer&&_vjsPlayer.readyState()>=2)b.remove();},7000);
}

/* ══════════════════════════════
   BUILD VIDEO.JS
══════════════════════════════ */
async function buildVjs(wrap, url, resumeAt, showIosHint) {
  await loadVjsAssets();

  wrap.innerHTML=
    '<div id="nc-wrap" style="aspect-ratio:16/9">'+
    '<video id="nc-vjs-el" class="video-js" playsinline preload="none">'+
    '<source src="'+url+'" type="'+videoType(url)+'">'+
    '</video></div>';

  createBubbles(wrap.querySelector('#nc-wrap'));

  _vjsPlayer=videojs('nc-vjs-el',{
    controls:          true,
    autoplay:          true,
    preload:           'none',
    fluid:             false,
    inactivityTimeout: 1,  // 1ms = quasi désactivé, mais pas 0 (bug VJS)
    controlBar:{ children:['progressControl'] }, // minimal — on reconstruit tout
    userActions:{ hotkeys:false, doubleClick:true },
    nativeControlsForTouch: false,
  });

  _vjsPlayer.ready(function(){
    buildCustomControls(wrap);
    watchVjsClasses();      // bloque vjs-user-inactive via MutationObserver

    _vjsPlayer.one('loadedmetadata',function(){ if(resumeAt>0) _vjsPlayer.currentTime(resumeAt); });
    _vjsPlayer.play().catch(function(){});

    attachActivity();
    scheduleHide();
  });

  _vidElProxy={
    get currentTime(){ return _vjsPlayer.currentTime(); },
    set currentTime(v){ _vjsPlayer.currentTime(v); },
    get duration()   { return _vjsPlayer.duration()||NaN; },
    get paused()     { return _vjsPlayer.paused(); },
    get readyState() { return _vjsPlayer.readyState(); },
    play: function()  { return _vjsPlayer.play(); },
    pause:function()  { _vjsPlayer.pause(); },
  };

  _vjsPlayer.on('error',function(){ var w2=document.getElementById('player-wrap'); if(w2)showFallback(w2,_currentVideoUrl,'error'); });

  if (IS_MOBILE){
    var _st=setTimeout(function(){ var c=wrap.querySelector('#nc-wrap'); if(c&&_vjsPlayer&&_vjsPlayer.readyState()<2)showIosWarning(c); },8000);
    _vjsPlayer.one('canplay',function(){clearTimeout(_st);});
    _vjsPlayer.one('playing',function(){clearTimeout(_st);});
  }
  if (showIosHint) setTimeout(function(){ var c=wrap.querySelector('#nc-wrap'); if(c)showIosWarning(c); },600);
}

/* ══════════════════════════════
   PROXY vidEl
══════════════════════════════ */
var _vidElProxy=null;
Object.defineProperty(window,'vidEl',{
  get:function(){ return _vjsPlayer?_vidElProxy:null; },
  set:function(){},
  configurable:true,
});

/* ══════════════════════════════
   API PUBLIQUE
══════════════════════════════ */
function playerTogglePlay(){ if(!_vjsPlayer)return; _vjsPlayer.paused()?_vjsPlayer.play().catch(function(){}):_vjsPlayer.pause(); }
function playerSkip(s){ if(_vjsPlayer)_vjsPlayer.currentTime(Math.max(0,_vjsPlayer.currentTime()+s)); }
function playerSetVol(v){ if(!_vjsPlayer)return; v=parseFloat(v); _vjsPlayer.volume(v); _vjsPlayer.muted(v===0); }
function playerToggleMute(){ if(_vjsPlayer)_vjsPlayer.muted(!_vjsPlayer.muted()); }
function playerToggleFS(){ if(!_vjsPlayer)return; _vjsPlayer.isFullscreen()?_vjsPlayer.exitFullscreen():_vjsPlayer.requestFullscreen(); }

function playerKeydown(e){
  var tag=document.activeElement?document.activeElement.tagName:'';
  if(tag==='INPUT'||tag==='TEXTAREA')return;
  if(e.key===' ')         {e.preventDefault();playerTogglePlay();}
  if(e.key==='ArrowLeft') {e.preventDefault();playerSkip(-10);}
  if(e.key==='ArrowRight'){e.preventDefault();playerSkip(10);}
  if(e.key==='ArrowUp')   {e.preventDefault();playerSetVol(Math.min(1,(_vjsPlayer?_vjsPlayer.volume():1)+.1));}
  if(e.key==='ArrowDown') {e.preventDefault();playerSetVol(Math.max(0,(_vjsPlayer?_vjsPlayer.volume():1)-.1));}
  if(e.key==='f'||e.key==='F')playerToggleFS();
  if(e.key==='m'||e.key==='M')playerToggleMute();
}

function updateProg(){}
function togglePlay(){playerTogglePlay();}
function skip(s){playerSkip(s);}
function setVol(v){playerSetVol(v);}
function toggleMute(){playerToggleMute();}
function toggleFS(){playerToggleFS();}
function seekV(){}
