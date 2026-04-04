/* ═══════════════════════════════════════════
   NovaCiné — player.js  (Video.js v5 — Clean)
   Approche : on laisse VJS gérer sa logique,
   on style 100% par CSS, auto-hide manuel via
   MutationObserver + document listeners.
   Mobile-first, fullscreen fiable.
   ═══════════════════════════════════════════ */

var _currentVideoUrl = '';
var _vjsPlayer  = null;
var _hideTimer  = null;
var _mo         = null;   // MutationObserver anti-vjs-user-inactive
var _ctrlEl     = null;   // .vjs-control-bar

var IS_IOS    = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
var IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/* ══════════════════════════════
   INJECT Video.js (lazy)
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
      }, 60);
    }
  });
}

/* ══════════════════════════════
   THÈME CSS COMPLET
══════════════════════════════ */
function injectTheme() {
  if (document.getElementById('nc-theme')) return;
  var s = document.createElement('style');
  s.id = 'nc-theme';
  s.textContent = `
    /* ───── Conteneur ───── */
    #nc-wrap {
      position: relative;
      width: 100%; height: 100%;
      background: #000;
      overflow: hidden;
      font-family: 'DM Sans', system-ui, sans-serif;
      /* Curseur auto-hide en fullscreen */
      --ctrl-visible: 1;
    }
    #nc-wrap.nc-idle { cursor: none; }

    /* ───── Bulles ───── */
    .nc-bbl {
      position: absolute; border-radius: 50%;
      pointer-events: none; z-index: 0; opacity: 0;
      animation: ncFloat linear infinite;
    }
    @keyframes ncFloat {
      0%   { transform: translateY(0)    scale(1);   opacity: 0; }
      12%  { opacity: .6; }
      88%  { opacity: .3; }
      100% { transform: translateY(-120%) scale(.45); opacity: 0; }
    }

    /* ───── Video.js base ───── */
    #nc-wrap .video-js {
      position: relative; z-index: 1;
      width: 100% !important; height: 100% !important;
      background: transparent;
    }
    #nc-wrap .vjs-tech { background: #000; object-fit: contain; }

    /* ══════════════════════════════════════
       NEUTRALISER l'auto-hide de VJS
       On override TOUS les états que VJS génère
    ══════════════════════════════════════ */
    #nc-wrap .video-js .vjs-control-bar,
    #nc-wrap .video-js.vjs-user-active .vjs-control-bar,
    #nc-wrap .video-js.vjs-user-inactive .vjs-control-bar {
      /* On force display:flex et on gère opacity nous-mêmes */
      display: flex !important;
      visibility: visible !important;
      /* Transition douce */
      transition: opacity .35s ease, transform .35s ease !important;
    }

    /* ───── BARRE DE CONTRÔLE — Liquid Glass ───── */
    #nc-wrap .vjs-control-bar {
      /* Layout */
      flex-direction: row !important;
      align-items: center !important;
      flex-wrap: nowrap !important;
      height: 54px !important;
      padding: 0 10px !important;
      gap: 4px !important;
      position: absolute; bottom: 0; left: 0; right: 0;
      z-index: 10;

      /* Liquid Glass */
      background: rgba(8,12,20,.48) !important;
      backdrop-filter: blur(24px) saturate(1.7) !important;
      -webkit-backdrop-filter: blur(24px) saturate(1.7) !important;
      border-top: 1px solid rgba(255,255,255,.1) !important;
      box-shadow: 0 -4px 24px rgba(0,0,0,.4) !important;

      /* État visible par défaut */
      opacity: 1;
    }
    /* État caché — notre classe nc-off */
    #nc-wrap .vjs-control-bar.nc-off {
      opacity: 0 !important;
      transform: translateY(4px) !important;
      pointer-events: none !important;
    }
    /* Toujours visible en pause */
    #nc-wrap .video-js.vjs-paused .vjs-control-bar {
      opacity: 1 !important;
      transform: none !important;
      pointer-events: auto !important;
    }

    /* Reflet supérieur */
    #nc-wrap .vjs-control-bar::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,.15), transparent);
      pointer-events: none;
    }

    /* ───── Boutons natifs VJS ───── */
    #nc-wrap .vjs-button {
      width: 36px !important;
      height: 36px !important;
      flex-shrink: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      border-radius: 50% !important;
      background: rgba(255,255,255,.07) !important;
      border: 1px solid rgba(255,255,255,.13) !important;
      transition: background .16s, border-color .16s, transform .13s !important;
      position: relative;
      overflow: hidden;
    }
    #nc-wrap .vjs-button::before {
      /* Reflet glass */
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 50%;
      border-radius: 50%;
      background: linear-gradient(to bottom, rgba(255,255,255,.1), transparent);
      pointer-events: none;
    }
    #nc-wrap .vjs-button:hover {
      background: rgba(232,160,32,.22) !important;
      border-color: rgba(232,160,32,.5) !important;
      transform: scale(1.1) !important;
    }
    #nc-wrap .vjs-button:active { transform: scale(.92) !important; }
    #nc-wrap .vjs-button > .vjs-icon-placeholder::before {
      color: rgba(255,255,255,.88) !important;
      font-size: 16px !important;
      line-height: 36px !important;
      transition: color .16s !important;
    }
    #nc-wrap .vjs-button:hover > .vjs-icon-placeholder::before { color: #e8a020 !important; }

    /* Play — plus grand, accent doré */
    #nc-wrap .vjs-play-control {
      width: 42px !important; height: 42px !important;
      background: rgba(232,160,32,.18) !important;
      border-color: rgba(232,160,32,.45) !important;
    }
    #nc-wrap .vjs-play-control > .vjs-icon-placeholder::before { font-size: 18px !important; line-height: 42px !important; color: #e8a020 !important; }
    #nc-wrap .vjs-play-control:hover { background: rgba(232,160,32,.35) !important; }

    /* ───── Skip buttons custom injectés ───── */
    .nc-skip {
      width: 36px; height: 36px;
      flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%;
      background: rgba(255,255,255,.07);
      border: 1px solid rgba(255,255,255,.13);
      color: rgba(255,255,255,.88);
      cursor: pointer;
      transition: background .16s, border-color .16s, transform .13s;
      position: relative; overflow: hidden;
    }
    .nc-skip::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 50%;
      border-radius: 50%;
      background: linear-gradient(to bottom, rgba(255,255,255,.1), transparent);
      pointer-events: none;
    }
    .nc-skip svg { width: 20px; height: 20px; fill: currentColor; position: relative; z-index: 1; }
    .nc-skip:hover { background: rgba(232,160,32,.22); border-color: rgba(232,160,32,.5); transform: scale(1.1); }
    .nc-skip:active { transform: scale(.92); }

    /* ───── Barre de progression ───── */
    #nc-wrap .vjs-progress-control {
      flex: 1 !important;
      height: 100% !important;
      display: flex !important;
      align-items: center !important;
      min-width: 60px !important;
    }
    #nc-wrap .vjs-progress-holder {
      height: 4px !important;
      border-radius: 4px !important;
      background: rgba(255,255,255,.2) !important;
      transition: height .15s !important;
      flex: 1;
      margin: 0 !important;
    }
    #nc-wrap .vjs-progress-control:hover .vjs-progress-holder { height: 7px !important; }
    #nc-wrap .vjs-play-progress {
      background: linear-gradient(90deg,#c87010,#e8a020,#f0c060) !important;
      border-radius: 4px !important;
    }
    #nc-wrap .vjs-play-progress::before {
      /* Thumb doré */
      color: #f0c060 !important;
      font-size: 13px !important;
      top: -0.3em !important;
      transition: transform .15s !important;
      transform: scale(0) !important;
    }
    #nc-wrap .vjs-progress-control:hover .vjs-play-progress::before { transform: scale(1) !important; }
    #nc-wrap .vjs-load-progress { background: rgba(255,255,255,.12) !important; border-radius: 4px !important; }
    #nc-wrap .vjs-load-progress div { background: rgba(255,255,255,.08) !important; }

    /* Tooltip */
    #nc-wrap .vjs-time-tooltip {
      background: rgba(8,12,20,.9) !important;
      backdrop-filter: blur(10px) !important;
      border: 1px solid rgba(232,160,32,.3) !important;
      color: #e8a020 !important;
      border-radius: 7px !important;
      font-size: .7rem !important;
      padding: 3px 8px !important;
    }

    /* ───── Temps ───── */
    #nc-wrap .vjs-current-time,
    #nc-wrap .vjs-duration,
    #nc-wrap .vjs-time-divider {
      display: flex !important;
      align-items: center !important;
      color: rgba(255,255,255,.6) !important;
      font-size: .73rem !important;
      font-weight: 500 !important;
      padding: 0 2px !important;
      min-width: 0 !important;
      line-height: 1 !important;
    }
    #nc-wrap .vjs-current-time-display,
    #nc-wrap .vjs-duration-display { font-size: .73rem !important; }

    /* ───── Volume ───── */
    #nc-wrap .vjs-volume-panel {
      display: flex !important;
      align-items: center !important;
      gap: 4px !important;
      width: auto !important;
    }
    #nc-wrap .vjs-volume-panel.vjs-volume-panel-horizontal { width: auto !important; }
    #nc-wrap .vjs-volume-control.vjs-volume-horizontal { width: 56px !important; height: 36px !important; display: flex !important; align-items: center !important; }
    #nc-wrap .vjs-volume-bar { margin: 0 !important; height: 4px !important; border-radius: 4px !important; background: rgba(255,255,255,.2) !important; }
    #nc-wrap .vjs-volume-level { background: #e8a020 !important; border-radius: 4px !important; }
    #nc-wrap .vjs-volume-level::before { color: #e8a020 !important; font-size: 11px !important; }
    #nc-wrap .vjs-mute-control { width: 36px !important; height: 36px !important; }

    /* ───── Vitesse — pill glass ───── */
    #nc-wrap .vjs-playback-rate {
      display: flex !important; align-items: center !important;
    }
    #nc-wrap .vjs-playback-rate-value {
      font-size: .71rem !important; font-weight: 700 !important;
      color: rgba(255,255,255,.75) !important;
      background: rgba(255,255,255,.07) !important;
      border: 1px solid rgba(255,255,255,.13) !important;
      border-radius: 20px !important;
      padding: 0 9px !important; height: 28px !important;
      display: flex !important; align-items: center !important;
      transition: background .16s, color .16s !important;
      cursor: pointer !important;
    }
    #nc-wrap .vjs-playback-rate:hover .vjs-playback-rate-value {
      background: rgba(232,160,32,.2) !important;
      border-color: rgba(232,160,32,.45) !important;
      color: #e8a020 !important;
    }
    #nc-wrap .vjs-playback-rate .vjs-icon-placeholder { display: none !important; }

    /* Menu vitesse */
    #nc-wrap .vjs-menu-content {
      background: rgba(8,12,20,.9) !important;
      backdrop-filter: blur(20px) !important;
      border: 1px solid rgba(255,255,255,.1) !important;
      border-radius: 12px !important;
      bottom: 46px !important;
      overflow: hidden !important;
      padding: 4px 0 !important;
    }
    #nc-wrap .vjs-menu-item {
      font-size: .8rem !important; color: rgba(220,232,247,.8) !important;
      padding: .5rem 1rem !important;
      transition: background .12s !important;
    }
    #nc-wrap .vjs-menu-item:hover { background: rgba(232,160,32,.12) !important; color: #e8a020 !important; }
    #nc-wrap .vjs-menu-item.vjs-selected { background: rgba(232,160,32,.2) !important; color: #e8a020 !important; font-weight: 600 !important; }

    /* ───── Fullscreen ───── */
    #nc-wrap .vjs-fullscreen-control { width: 36px !important; height: 36px !important; }

    /* ───── Big play button ───── */
    #nc-wrap .vjs-big-play-button {
      width: 66px !important; height: 66px !important;
      border-radius: 50% !important;
      border: 2px solid rgba(232,160,32,.6) !important;
      background: rgba(8,12,20,.55) !important;
      backdrop-filter: blur(16px) !important;
      top: 50% !important; left: 50% !important;
      transform: translate(-50%, -50%) !important;
      margin: 0 !important;
      transition: background .2s, transform .2s, border-color .2s !important;
      box-shadow: 0 0 32px rgba(232,160,32,.12) !important;
    }
    #nc-wrap .vjs-big-play-button::before { color: #e8a020 !important; font-size: 1.85em !important; line-height: 62px !important; }
    #nc-wrap .video-js:hover .vjs-big-play-button {
      background: rgba(232,160,32,.18) !important;
      border-color: rgba(232,160,32,.9) !important;
      transform: translate(-50%, -50%) scale(1.08) !important;
    }

    /* ───── Spinner ───── */
    #nc-wrap .vjs-loading-spinner { border-color: rgba(232,160,32,.2) !important; }
    #nc-wrap .vjs-loading-spinner::before, #nc-wrap .vjs-loading-spinner::after { border-top-color: #e8a020 !important; }

    /* ══════════════════════════════
       MOBILE — barre plus haute, boutons plus grands
    ══════════════════════════════ */
    @media (max-width: 600px) {
      #nc-wrap .vjs-control-bar { height: 52px !important; padding: 0 8px !important; gap: 3px !important; }
      #nc-wrap .vjs-button { width: 40px !important; height: 40px !important; }
      #nc-wrap .vjs-play-control { width: 44px !important; height: 44px !important; }
      .nc-skip { width: 40px !important; height: 40px !important; }
      .nc-skip svg { width: 22px !important; height: 22px !important; }
      /* Cacher volume slider sur mobile */
      #nc-wrap .vjs-volume-control.vjs-volume-horizontal { display: none !important; }
      /* Cacher vitesse sur mobile */
      #nc-wrap .vjs-playback-rate { display: none !important; }
      /* Temps plus compact */
      #nc-wrap .vjs-current-time, #nc-wrap .vjs-duration, #nc-wrap .vjs-time-divider { font-size: .68rem !important; }
    }

    /* ─── États loading / fallback ─── */
    .nc-loading { display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:1rem;color:rgba(220,232,247,.7);font-family:'DM Sans',sans-serif; }
    .nc-spin { width:38px;height:38px;border:3px solid rgba(255,255,255,.1);border-top-color:#e8a020;border-radius:50%;animation:ncSpin .8s linear infinite; }
    @keyframes ncSpin { to { transform: rotate(360deg); } }
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
  var colors = ['rgba(232,160,32,.25)','rgba(192,57,43,.16)','rgba(220,232,247,.06)','rgba(46,204,113,.13)'];
  var n = IS_MOBILE ? 5 : 9;
  for (var i = 0; i < n; i++) {
    (function(){
      var b = document.createElement('div');
      b.className = 'nc-bbl';
      var sz = 6 + Math.random() * 22, dr = 8 + Math.random() * 10;
      b.style.cssText =
        'width:'+sz+'px;height:'+sz+'px;left:'+(3+Math.random()*92)+'%;bottom:0;' +
        'background:'+colors[Math.floor(Math.random()*colors.length)]+';' +
        'animation-duration:'+dr+'s;animation-delay:'+(-(Math.random()*dr))+'s;' +
        'box-shadow:inset 0 0 '+(sz*.3)+'px rgba(255,255,255,.09);';
      container.appendChild(b);
    })();
  }
}

/* ══════════════════════════════
   AUTO-HIDE — 100% manuel
   listeners sur document → fonctionne partout (fullscreen inclus)
   MutationObserver → empêche VJS de remettre vjs-user-inactive
══════════════════════════════ */
function showCtrl() {
  if (!_ctrlEl) return;
  _ctrlEl.classList.remove('nc-off');
  // Remettre le curseur
  var w = document.getElementById('nc-wrap');
  if (w) w.classList.remove('nc-idle');
  clearTimeout(_hideTimer);
}
function scheduleHide() {
  if (!_ctrlEl) return;
  clearTimeout(_hideTimer);
  if (_vjsPlayer && _vjsPlayer.paused()) return;
  _hideTimer = setTimeout(function() {
    if (!_ctrlEl) return;
    _ctrlEl.classList.add('nc-off');
    var w = document.getElementById('nc-wrap');
    if (w) w.classList.add('nc-idle');
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

/* Empêche VJS d'ajouter vjs-user-inactive */
function blockVjsInactive(vjsEl) {
  if (_mo) _mo.disconnect();
  _mo = new MutationObserver(function() {
    if (vjsEl.classList.contains('vjs-user-inactive')) {
      vjsEl.classList.remove('vjs-user-inactive');
    }
  });
  _mo.observe(vjsEl, { attributes: true, attributeFilter: ['class'] });
}

/* ══════════════════════════════
   INJECTION BOUTONS SKIP
   (après que VJS a rendu sa barre)
══════════════════════════════ */
var SVG_REW = '<svg viewBox="0 0 24 24"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="13.8" text-anchor="middle" font-size="5.5" font-family="DM Sans,sans-serif" font-weight="700" fill="currentColor">10</text></svg>';
var SVG_FWD = '<svg viewBox="0 0 24 24"><path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z"/><text x="12" y="13.8" text-anchor="middle" font-size="5.5" font-family="DM Sans,sans-serif" font-weight="700" fill="currentColor">10</text></svg>';

function injectSkipButtons() {
  if (!_ctrlEl) return;
  // Éviter les doublons
  if (_ctrlEl.querySelector('.nc-skip')) return;

  var playBtn = _ctrlEl.querySelector('.vjs-play-control');

  function mkSkip(svg, title, fn) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'nc-skip'; b.title = title;
    b.innerHTML = svg;
    b.addEventListener('click', function(e){ e.stopPropagation(); fn(); });
    return b;
  }

  var rew = mkSkip(SVG_REW, 'Reculer 10s',  function(){ playerSkip(-10); });
  var fwd = mkSkip(SVG_FWD, 'Avancer 10s',  function(){ playerSkip(10);  });

  if (playBtn) {
    playBtn.after(fwd);
    playBtn.after(rew);
  } else {
    _ctrlEl.prepend(fwd);
    _ctrlEl.prepend(rew);
  }
}

/* ══════════════════════════════
   VÉRIFICATION URL
══════════════════════════════ */
async function checkVideoUrl(url) {
  if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/.test(url)) return { ok: true };
  try {
    var res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined });
    var cd = res.headers.get('content-disposition') || '';
    var ct = res.headers.get('content-type') || '';
    if (cd.toLowerCase().includes('attachment')) return { ok: false, reason: 'download' };
    if (ct && !ct.startsWith('video/') && !ct.includes('octet-stream') && !ct.includes('mp4') && !ct.includes('webm')) return { ok: false, reason: 'type' };
    return { ok: true };
  } catch(e) { return { ok: null, reason: 'cors' }; }
}

function videoType(url) {
  var e = url.split('.').pop().split('?')[0].toLowerCase();
  return ({ mp4:'video/mp4', mkv:'video/x-matroska', mov:'video/quicktime', avi:'video/x-msvideo', webm:'video/webm', ogv:'video/ogg', m4v:'video/mp4', flv:'video/x-flv' })[e] || 'video/mp4';
}

/* ══════════════════════════════
   BUILD PLAYER
══════════════════════════════ */
async function buildPlayer(url, resumeAt) {
  var wrap = document.getElementById('player-wrap');
  _currentVideoUrl = url;
  resumeAt = resumeAt || 0;

  detachActivity();
  if (_vjsPlayer) { try { _vjsPlayer.dispose(); } catch(e){} _vjsPlayer = null; }
  _ctrlEl = null; _vidElProxy = null;
  wrap.innerHTML = '';

  /* ── Embeds ── */
  var eid, ehtml = null;
  if (/youtube\.com|youtu\.be/.test(url) && (eid = (url.match(/(?:v=|youtu\.be\/)([^&?]+)/) || [])[1]))
    ehtml = '<iframe src="https://www.youtube.com/embed/'+eid+'?autoplay=1&start='+Math.floor(resumeAt)+'" allow="autoplay;fullscreen" allowfullscreen></iframe>';
  else if (/vimeo\.com/.test(url) && (eid = (url.match(/vimeo\.com\/(\d+)/) || [])[1]))
    ehtml = '<iframe src="https://player.vimeo.com/video/'+eid+'?autoplay=1#t='+Math.floor(resumeAt)+'s" allow="autoplay;fullscreen" allowfullscreen></iframe>';
  else if (/dailymotion\.com/.test(url) && (eid = (url.match(/dailymotion\.com\/video\/([^_?]+)/) || [])[1]))
    ehtml = '<iframe src="https://www.dailymotion.com/embed/video/'+eid+'?autoplay=1&start='+Math.floor(resumeAt)+'" allow="autoplay;fullscreen" allowfullscreen></iframe>';

  if (ehtml) {
    wrap.innerHTML = '<div id="nc-wrap" style="aspect-ratio:16/9">' + ehtml + '</div>';
    createBubbles(wrap.querySelector('#nc-wrap'));
    return;
  }

  wrap.innerHTML = '<div id="nc-wrap" style="aspect-ratio:16/9"><div class="nc-loading"><div class="nc-spin"></div><span style="font-size:.85rem">Vérification du lien…</span></div></div>';
  var check = await checkVideoUrl(url);
  if (check.ok === false) { showFallback(wrap, url, check.reason); return; }
  if (IS_IOS && check.ok === null) { await buildVjs(wrap, url, resumeAt, true); return; }
  await buildVjs(wrap, url, resumeAt, false);
}

function showFallback(wrap, url, reason) {
  var msg = reason === 'download'
    ? 'Ce lien force le téléchargement et ne peut pas être lu directement.'
    : 'Ce lien ne semble pas pointer vers un fichier vidéo lisible.';
  if (IS_MOBILE) msg = reason === 'download'
    ? 'Ce lien force le téléchargement.\nUtilisez un lien mp4/webm direct ou YouTube, Vimeo, Dailymotion.'
    : 'Format non supporté sur mobile.';
  wrap.innerHTML = '<div id="nc-wrap" style="aspect-ratio:16/9"><div class="nc-fallback">' +
    '<div class="nc-fallback-icon">⚠️</div>' +
    '<div class="nc-fallback-msg">'+msg.replace(/\n/g,'<br>')+'</div>' +
    (IS_MOBILE ? '<a class="nc-fallback-btn" href="'+url+'">Ouvrir dans le navigateur</a>' : '') +
    '<div class="nc-fallback-url">'+url+'</div></div></div>';
}

function showIosWarning(container) {
  if (container.querySelector('.nc-ios-banner')) return;
  var b = document.createElement('div'); b.className = 'nc-ios-banner';
  b.innerHTML = '<span>Si la vidéo ne charge pas, le lien n\'est peut-être pas compatible mobile.</span><a href="'+_currentVideoUrl+'">Ouvrir ↗</a>';
  container.insertBefore(b, container.firstChild);
  setTimeout(function(){ if (_vjsPlayer && _vjsPlayer.readyState() >= 2) b.remove(); }, 7000);
}

/* ══════════════════════════════
   BUILD VIDEO.JS
══════════════════════════════ */
async function buildVjs(wrap, url, resumeAt, showIosHint) {
  await loadVjsAssets();

  wrap.innerHTML =
    '<div id="nc-wrap" style="aspect-ratio:16/9">' +
    '<video id="nc-vjs-el" class="video-js" playsinline preload="none">' +
    '<source src="'+url+'" type="'+videoType(url)+'">' +
    '</video></div>';

  createBubbles(wrap.querySelector('#nc-wrap'));

  _vjsPlayer = videojs('nc-vjs-el', {
    controls:          true,
    autoplay:          true,
    preload:           'none',
    fluid:             false,
    playbackRates:     [0.5, 0.75, 1, 1.25, 1.5, 2],
    // ← inactivityTimeout désactivé via une valeur très grande,
    //   VJS ne touchera jamais au hide tout seul
    inactivityTimeout: 999999999,
    controlBar: {
      children: [
        'playToggle',
        'volumePanel',
        'progressControl',
        'currentTimeDisplay',
        'timeDivider',
        'durationDisplay',
        'playbackRateMenuButton',
        'fullscreenToggle',
      ],
      volumePanel: { inline: true },
    },
    userActions: { hotkeys: false, doubleClick: true },
    nativeControlsForTouch: false,
  });

  _vjsPlayer.ready(function() {
    var vjsEl = wrap.querySelector('.video-js');
    _ctrlEl   = vjsEl ? vjsEl.querySelector('.vjs-control-bar') : null;

    // Bloquer VJS d'ajouter vjs-user-inactive
    if (vjsEl) blockVjsInactive(vjsEl);

    // Injecter les boutons skip
    injectSkipButtons();

    // Reprendre
    _vjsPlayer.one('loadedmetadata', function() {
      if (resumeAt > 0) _vjsPlayer.currentTime(resumeAt);
    });
    _vjsPlayer.play().catch(function(){});

    // Auto-hide manuel
    attachActivity();
    scheduleHide();

    // Sync pause/play avec auto-hide
    _vjsPlayer.on('pause', function() { showCtrl(); clearTimeout(_hideTimer); });
    _vjsPlayer.on('play',  function() { scheduleHide(); });
  });

  /* Proxy vidEl */
  _vidElProxy = {
    get currentTime(){ return _vjsPlayer.currentTime(); },
    set currentTime(v){ _vjsPlayer.currentTime(v); },
    get duration()   { return _vjsPlayer.duration() || NaN; },
    get paused()     { return _vjsPlayer.paused(); },
    get readyState() { return _vjsPlayer.readyState(); },
    play:  function(){ return _vjsPlayer.play(); },
    pause: function(){ _vjsPlayer.pause(); },
  };

  _vjsPlayer.on('error', function() {
    var w2 = document.getElementById('player-wrap');
    if (w2) showFallback(w2, _currentVideoUrl, 'error');
  });

  if (IS_MOBILE) {
    var _st = setTimeout(function() {
      var c = wrap.querySelector('#nc-wrap');
      if (c && _vjsPlayer && _vjsPlayer.readyState() < 2) showIosWarning(c);
    }, 8000);
    _vjsPlayer.one('canplay', function(){ clearTimeout(_st); });
    _vjsPlayer.one('playing', function(){ clearTimeout(_st); });
  }

  if (showIosHint) setTimeout(function() {
    var c = wrap.querySelector('#nc-wrap');
    if (c) showIosWarning(c);
  }, 600);
}

/* ══════════════════════════════
   PROXY vidEl
══════════════════════════════ */
var _vidElProxy = null;
Object.defineProperty(window, 'vidEl', {
  get: function(){ return _vjsPlayer ? _vidElProxy : null; },
  set: function(){},
  configurable: true,
});

/* ══════════════════════════════
   API PUBLIQUE
══════════════════════════════ */
function playerTogglePlay(){ if (!_vjsPlayer) return; _vjsPlayer.paused() ? _vjsPlayer.play().catch(function(){}) : _vjsPlayer.pause(); }
function playerSkip(s){ if (_vjsPlayer) _vjsPlayer.currentTime(Math.max(0, _vjsPlayer.currentTime() + s)); }
function playerSetVol(v){ if (!_vjsPlayer) return; v = parseFloat(v); _vjsPlayer.volume(v); _vjsPlayer.muted(v === 0); }
function playerToggleMute(){ if (_vjsPlayer) _vjsPlayer.muted(!_vjsPlayer.muted()); }
function playerToggleFS(){ if (!_vjsPlayer) return; _vjsPlayer.isFullscreen() ? _vjsPlayer.exitFullscreen() : _vjsPlayer.requestFullscreen(); }

function playerKeydown(e) {
  var tag = document.activeElement ? document.activeElement.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.key === ' ')          { e.preventDefault(); playerTogglePlay(); }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); playerSkip(-10); }
  if (e.key === 'ArrowRight') { e.preventDefault(); playerSkip(10); }
  if (e.key === 'ArrowUp')    { e.preventDefault(); playerSetVol(Math.min(1, (_vjsPlayer ? _vjsPlayer.volume() : 1) + .1)); }
  if (e.key === 'ArrowDown')  { e.preventDefault(); playerSetVol(Math.max(0, (_vjsPlayer ? _vjsPlayer.volume() : 1) - .1)); }
  if (e.key === 'f' || e.key === 'F') playerToggleFS();
  if (e.key === 'm' || e.key === 'M') playerToggleMute();
}

/* Stubs compat */
function updateProg(){}
function togglePlay() { playerTogglePlay(); }
function skip(s)      { playerSkip(s); }
function setVol(v)    { playerSetVol(v); }
function toggleMute() { playerToggleMute(); }
function toggleFS()   { playerToggleFS(); }
function seekV()      {}
