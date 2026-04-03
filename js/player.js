/* ═══════════════════════════════════════════
   NovaCiné — player.js (Plyr Edition v3)
   Fixes :
   - Boutons skip 10s custom UNIQUEMENT (pas de doublons)
   - Auto-hide barre 4s (géré manuellement, fonctionne aussi en fullscreen)
   - Bulles derrière la vidéo
   ═══════════════════════════════════════════ */

var _currentVideoUrl = '';
var _plyrPlayer      = null;
var _hideTimer       = null;  // timer auto-hide barre

var IS_IOS    = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
var IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/* ══════════════════════════════
   INJECT Plyr (lazy, once)
══════════════════════════════ */
var _plyrLoaded = false;
function loadPlyrAssets() {
  return new Promise(function(resolve) {
    if (_plyrLoaded && typeof Plyr !== 'undefined') { resolve(); return; }
    if (!document.getElementById('plyr-css')) {
      var link = document.createElement('link');
      link.id = 'plyr-css'; link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/plyr/3.7.8/plyr.min.css';
      document.head.appendChild(link);
    }
    if (!document.getElementById('plyr-js')) {
      var script = document.createElement('script');
      script.id  = 'plyr-js';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/plyr/3.7.8/plyr.min.js';
      script.onload = function() { _plyrLoaded = true; injectNovaCineTheme(); resolve(); };
      document.head.appendChild(script);
    } else if (typeof Plyr !== 'undefined') {
      _plyrLoaded = true; resolve();
    } else {
      var chk = setInterval(function() {
        if (typeof Plyr !== 'undefined') { clearInterval(chk); _plyrLoaded = true; resolve(); }
      }, 80);
    }
  });
}

/* ══════════════════════════════
   THÈME NOVACINÉ
══════════════════════════════ */
function injectNovaCineTheme() {
  if (document.getElementById('nc-plyr-theme')) return;
  var s = document.createElement('style');
  s.id = 'nc-plyr-theme';
  s.textContent = `
    #nc-player-container {
      position: relative; width: 100%; height: 100%;
      background: #000; overflow: hidden;
    }

    /* Bulles — z-index 0, derrière tout */
    .nc-bubble {
      position: absolute; border-radius: 50%;
      pointer-events: none; z-index: 0; opacity: 0;
      animation: nc-float linear infinite;
    }
    @keyframes nc-float {
      0%   { transform: translateY(0) scale(1);     opacity: 0; }
      15%  { opacity: .7; }
      85%  { opacity: .4; }
      100% { transform: translateY(-115%) scale(.5); opacity: 0; }
    }

    /* Plyr — z-index 1 */
    #nc-player-container .plyr {
      position: relative; z-index: 1;
      width: 100% !important; height: 100% !important;
      --plyr-color-main: #e8a020;
      --plyr-video-background: #000;
      --plyr-control-spacing: 10px;
      --plyr-range-fill-background: #e8a020;
      --plyr-video-control-color: rgba(255,255,255,.85);
      --plyr-video-control-color-hover: #e8a020;
      --plyr-control-icon-size: 18px;
      --plyr-font-family: 'DM Sans', sans-serif;
      --plyr-font-size-base: 13px;
      --plyr-tooltip-background: rgba(8,12,20,.92);
      --plyr-tooltip-color: #e8a020;
      --plyr-tooltip-radius: 5px;
    }

    /* Barre de contrôle — transition opacity gérée par notre JS */
    #nc-player-container .plyr__controls {
      background: linear-gradient(to top, rgba(0,0,0,.92) 0%, transparent 100%) !important;
      padding: 8px 10px !important;
      transition: opacity .35s ease !important;
      opacity: 1;
    }
    /* Quand on cache la barre */
    #nc-player-container .plyr.nc-ctrl-hidden .plyr__controls {
      opacity: 0 !important;
      pointer-events: none !important;
    }
    #nc-player-container .plyr.nc-ctrl-hidden {
      cursor: none;
    }

    /* Barre de progression */
    #nc-player-container .plyr__progress input[type=range]::-webkit-slider-thumb { background: #e8a020; }
    #nc-player-container .plyr__progress input[type=range]::-moz-range-thumb      { background: #e8a020; }

    /* Bouton play central */
    #nc-player-container .plyr__control--overlaid {
      background: rgba(8,12,20,.72) !important;
      border: 2px solid #e8a020 !important;
      color: #e8a020 !important;
      border-radius: 50% !important;
      width: 64px; height: 64px;
      backdrop-filter: blur(6px);
      transition: background .2s, transform .2s !important;
    }
    #nc-player-container .plyr__control--overlaid:hover {
      background: rgba(232,160,32,.18) !important;
      transform: scale(1.1) !important;
    }
    #nc-player-container .plyr__control--overlaid svg { color: #e8a020; }

    /* Boutons skip custom */
    .nc-skip-btn {
      background: none; border: none;
      color: rgba(255,255,255,.85);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      padding: 4px 6px; border-radius: 5px;
      transition: color .15s;
    }
    .nc-skip-btn:hover { color: #e8a020; }
    .nc-skip-btn svg   { width: 20px; height: 20px; fill: currentColor; display: block; }

    /* Menu vitesse */
    #nc-player-container .plyr__menu__container {
      background: rgba(8,12,20,.95);
      border: 1px solid rgba(31,45,69,.9);
      border-radius: 8px;
    }
    #nc-player-container .plyr__menu__container .plyr__control {
      color: rgba(220,232,247,.8); font-size: .82rem;
    }
    #nc-player-container .plyr__menu__container .plyr__control:hover,
    #nc-player-container .plyr__menu__container .plyr__control[aria-checked=true] {
      background: rgba(232,160,32,.15); color: #e8a020;
    }

    /* Iframe embeds */
    #nc-player-container iframe {
      position: relative; z-index: 1;
      width: 100%; height: 100%; border: none; display: block;
    }

    /* Loading */
    .nc-loading {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      height: 100%; gap: 1rem;
      color: rgba(220,232,247,.7); font-family: 'DM Sans', sans-serif;
    }
    .nc-loading-spinner {
      width: 38px; height: 38px;
      border: 3px solid rgba(255,255,255,.12);
      border-top-color: #e8a020; border-radius: 50%;
      animation: nc-spin .8s linear infinite;
    }
    @keyframes nc-spin { to { transform: rotate(360deg); } }

    /* Fallback */
    .nc-fallback {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      height: 100%; gap: 1.2rem; padding: 1.5rem;
      text-align: center; font-family: 'DM Sans', sans-serif;
    }
    .nc-fallback-icon { font-size: 2.5rem; }
    .nc-fallback-msg  { color: rgba(220,232,247,.9); font-size: .88rem; line-height: 1.6; max-width: 380px; }
    .nc-fallback-btn  { background: #e8a020; color: #000; font-weight: 700; padding: .7rem 1.4rem; border-radius: 8px; text-decoration: none; font-size: .9rem; display: inline-block; }
    .nc-fallback-url  { color: rgba(220,232,247,.4); font-size: .72rem; word-break: break-all; max-width: 340px; }

    /* Banner iOS */
    .nc-ios-banner {
      position: absolute; top: 0; left: 0; right: 0; z-index: 30;
      background: rgba(232,160,32,.13);
      border-bottom: 1px solid rgba(232,160,32,.3);
      padding: .5rem 1rem;
      display: flex; align-items: center; justify-content: space-between; gap: .8rem;
      font-family: 'DM Sans', sans-serif;
      animation: nc-slideDown .3s ease;
    }
    @keyframes nc-slideDown { from { transform: translateY(-100%); } to { transform: none; } }
    .nc-ios-banner span { font-size: .75rem; color: rgba(220,232,247,.85); line-height: 1.4; }
    .nc-ios-banner a    { flex-shrink: 0; background: #e8a020; color: #000; font-weight: 700; padding: .35rem .8rem; border-radius: 6px; text-decoration: none; font-size: .75rem; white-space: nowrap; }
  `;
  document.head.appendChild(s);
}

/* ══════════════════════════════
   AUTO-HIDE BARRE — géré manuellement
   Fonctionne en mode normal ET en fullscreen
══════════════════════════════ */
var _plyrEl = null;  // référence à l'élément .plyr

function showControls() {
  if (!_plyrEl) return;
  _plyrEl.classList.remove('nc-ctrl-hidden');
  clearTimeout(_hideTimer);
}

function scheduleHide() {
  if (!_plyrEl) return;
  clearTimeout(_hideTimer);
  // Ne pas cacher si en pause
  if (_plyrPlayer && _plyrPlayer.paused) return;
  _hideTimer = setTimeout(function() {
    if (_plyrEl) _plyrEl.classList.add('nc-ctrl-hidden');
  }, 4000); // 4 secondes d'inactivité
}

function onActivity() {
  showControls();
  scheduleHide();
}

function attachActivityListeners() {
  // On écoute sur le document pour couvrir le fullscreen aussi
  document.addEventListener('mousemove', onActivity, { passive: true });
  document.addEventListener('touchstart', onActivity, { passive: true });
  document.addEventListener('keydown', onActivity, { passive: true });
  // Toujours montrer la barre en pause
  if (_plyrPlayer) {
    _plyrPlayer.on('pause', function() { showControls(); clearTimeout(_hideTimer); });
    _plyrPlayer.on('play',  function() { scheduleHide(); });
  }
}

function detachActivityListeners() {
  document.removeEventListener('mousemove', onActivity);
  document.removeEventListener('touchstart', onActivity);
  document.removeEventListener('keydown', onActivity);
  clearTimeout(_hideTimer);
  _hideTimer = null;
}

/* ══════════════════════════════
   BULLES FLOTTANTES
══════════════════════════════ */
function createBubbles(container) {
  container.querySelectorAll('.nc-bubble').forEach(function(b){ b.remove(); });
  var colors = ['rgba(232,160,32,.28)','rgba(192,57,43,.2)','rgba(220,232,247,.07)','rgba(46,204,113,.16)'];
  var count  = IS_MOBILE ? 5 : 10;
  for (var i = 0; i < count; i++) {
    (function(){
      var b   = document.createElement('div');
      b.className = 'nc-bubble';
      var sz  = 6 + Math.random() * 22;
      var dur = 7 + Math.random() * 10;
      b.style.cssText =
        'width:'+sz+'px;height:'+sz+'px;' +
        'left:'+(3+Math.random()*92)+'%;bottom:0;' +
        'background:'+colors[Math.floor(Math.random()*colors.length)]+';' +
        'animation-duration:'+dur+'s;' +
        'animation-delay:'+(-(Math.random()*dur))+'s;' +
        'box-shadow:inset 0 0 '+(sz*.4)+'px rgba(255,255,255,.12);';
      container.appendChild(b);
    })();
  }
}

/* ══════════════════════════════
   VÉRIFICATION URL
══════════════════════════════ */
async function checkVideoUrl(url) {
  if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/.test(url)) return { ok: true, type: 'embed' };
  try {
    var res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined });
    var cd  = res.headers.get('content-disposition') || '';
    var ct  = res.headers.get('content-type') || '';
    if (cd.toLowerCase().includes('attachment')) return { ok: false, reason: 'download' };
    if (ct && !ct.startsWith('video/') && !ct.includes('octet-stream') && !ct.includes('mp4') && !ct.includes('webm')) return { ok: false, reason: 'type' };
    return { ok: true, type: 'direct' };
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

  detachActivityListeners();
  if (_plyrPlayer) { try { _plyrPlayer.destroy(); } catch(e) {} _plyrPlayer = null; }
  _vidElProxy = null;
  _plyrEl     = null;
  wrap.innerHTML = '';

  /* ── EMBEDS ── */
  if (/youtube\.com|youtu\.be/.test(url)) {
    var id = (url.match(/(?:v=|youtu\.be\/)([^&?]+)/) || [])[1];
    if (id) { wrap.innerHTML = '<div id="nc-player-container" style="aspect-ratio:16/9"><iframe src="https://www.youtube.com/embed/'+id+'?autoplay=1&start='+Math.floor(resumeAt)+'" allow="autoplay;fullscreen" allowfullscreen></iframe></div>'; createBubbles(wrap.querySelector('#nc-player-container')); }
    return;
  }
  if (/vimeo\.com/.test(url)) {
    var id = (url.match(/vimeo\.com\/(\d+)/) || [])[1];
    if (id) { wrap.innerHTML = '<div id="nc-player-container" style="aspect-ratio:16/9"><iframe src="https://player.vimeo.com/video/'+id+'?autoplay=1#t='+Math.floor(resumeAt)+'s" allow="autoplay;fullscreen" allowfullscreen></iframe></div>'; createBubbles(wrap.querySelector('#nc-player-container')); }
    return;
  }
  if (/dailymotion\.com/.test(url)) {
    var id = (url.match(/dailymotion\.com\/video\/([^_?]+)/) || [])[1];
    if (id) { wrap.innerHTML = '<div id="nc-player-container" style="aspect-ratio:16/9"><iframe src="https://www.dailymotion.com/embed/video/'+id+'?autoplay=1&start='+Math.floor(resumeAt)+'" allow="autoplay;fullscreen" allowfullscreen></iframe></div>'; createBubbles(wrap.querySelector('#nc-player-container')); }
    return;
  }

  showLoadingState(wrap);
  var check = await checkVideoUrl(url);
  if (check.ok === false) { showVideoFallback(wrap, url, check.reason); return; }
  if (IS_IOS && check.ok === null) { await buildPlyrPlayer(wrap, url, resumeAt, true); return; }
  await buildPlyrPlayer(wrap, url, resumeAt, false);
}

function showLoadingState(wrap) {
  wrap.innerHTML = '<div id="nc-player-container" style="aspect-ratio:16/9"><div class="nc-loading"><div class="nc-loading-spinner"></div><span style="font-size:.85rem;">Vérification du lien…</span></div></div>';
}
function showVideoFallback(wrap, url, reason) {
  var msg = reason === 'download' ? 'Ce lien force le téléchargement et ne peut pas être lu directement.' : 'Ce lien ne semble pas pointer vers un fichier vidéo lisible.';
  if (IS_MOBILE) msg = reason === 'download' ? 'Ce lien force le téléchargement.\nUtilisez un lien direct mp4/webm ou YouTube, Vimeo, Dailymotion.' : 'Format non supporté sur mobile.';
  wrap.innerHTML = '<div id="nc-player-container" style="aspect-ratio:16/9"><div class="nc-fallback"><div class="nc-fallback-icon">⚠️</div><div class="nc-fallback-msg">'+msg.replace(/\n/g,'<br>')+'</div>'+(IS_MOBILE?'<a class="nc-fallback-btn" href="'+url+'">Ouvrir dans le navigateur</a>':'')+'<div class="nc-fallback-url">'+url+'</div></div></div>';
}
function showIosWarning(container) {
  if (container.querySelector('.nc-ios-banner')) return;
  var b = document.createElement('div');
  b.className = 'nc-ios-banner';
  b.innerHTML = '<span>Si la vidéo ne charge pas, le lien n\'est peut-être pas compatible mobile.</span><a href="'+_currentVideoUrl+'">Ouvrir ↗</a>';
  container.insertBefore(b, container.firstChild);
  setTimeout(function(){ if (_plyrPlayer && _plyrPlayer.media.readyState >= 2) b.remove(); }, 7000);
}

/* ══════════════════════════════
   ICÔNES SVG — boutons skip 10s
══════════════════════════════ */
// Flèche reculer avec "10" intégré
var SVG_REW = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="11.8" y="14" text-anchor="middle" font-size="5.8" font-family="DM Sans,Arial,sans-serif" font-weight="700" fill="currentColor">10</text></svg>';
// Flèche avancer avec "10" intégré
var SVG_FWD = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="12.2" y="14" text-anchor="middle" font-size="5.8" font-family="DM Sans,Arial,sans-serif" font-weight="700" fill="currentColor">10</text></svg>';

/* ══════════════════════════════
   BUILD PLYR
══════════════════════════════ */
async function buildPlyrPlayer(wrap, url, resumeAt, showIosHint) {
  await loadPlyrAssets();

  wrap.innerHTML =
    '<div id="nc-player-container" style="aspect-ratio:16/9">' +
    '<video id="nc-plyr-el" playsinline preload="none">' +
    '<source src="'+url+'" type="'+videoType(url)+'">' +
    '</video></div>';

  var container = wrap.querySelector('#nc-player-container');
  createBubbles(container);

  _plyrPlayer = new Plyr('#nc-plyr-el', {
    // ⚠️ PAS de 'rewind' / 'fast-forward' ici → on injecte nos boutons custom
    controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'fullscreen'],
    settings: ['speed'],
    speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
    seekTime: 10,
    autoplay: true,
    keyboard: { focused: true, global: false }, // on gère les raccourcis nous-mêmes
    tooltips: { controls: true, seek: true },
    hideControls: false,  // ← désactivé, on gère manuellement
    resetOnEnd: false,
    invertTime: false,
    toggleInvert: false,
  });

  _plyrPlayer.on('ready', function() {
    _plyrEl = wrap.querySelector('.plyr');
    if (!_plyrEl) return;

    var ctrlBar = _plyrEl.querySelector('.plyr__controls');
    if (!ctrlBar) return;

    // Bouton play dans la barre (pas le gros central)
    var playBtn = ctrlBar.querySelector('[data-plyr="play"]');

    // Créer bouton -10s
    var btnRew = document.createElement('button');
    btnRew.type = 'button';
    btnRew.className = 'nc-skip-btn';
    btnRew.title = 'Reculer 10s';
    btnRew.innerHTML = SVG_REW;
    btnRew.addEventListener('click', function(e) { e.stopPropagation(); if (_plyrPlayer) _plyrPlayer.rewind(10); });

    // Créer bouton +10s
    var btnFwd = document.createElement('button');
    btnFwd.type = 'button';
    btnFwd.className = 'nc-skip-btn';
    btnFwd.title = 'Avancer 10s';
    btnFwd.innerHTML = SVG_FWD;
    btnFwd.addEventListener('click', function(e) { e.stopPropagation(); if (_plyrPlayer) _plyrPlayer.forward(10); });

    // Insérer juste après le bouton play
    if (playBtn) {
      playBtn.after(btnRew);
      btnRew.after(btnFwd);
    } else {
      ctrlBar.prepend(btnFwd);
      ctrlBar.prepend(btnRew);
    }

    // Reprendre à la position sauvegardée
    if (resumeAt > 0) {
      _plyrPlayer.once('canplay', function() { _plyrPlayer.currentTime = resumeAt; });
    }

    // Lancer auto-hide manuel
    attachActivityListeners();
    scheduleHide();
  });

  /* Proxy vidEl */
  _vidElProxy = {
    get currentTime() { return _plyrPlayer ? _plyrPlayer.currentTime    : 0; },
    set currentTime(v){ if (_plyrPlayer) _plyrPlayer.currentTime = v; },
    get duration()    { return _plyrPlayer ? _plyrPlayer.duration       : NaN; },
    get paused()      { return _plyrPlayer ? _plyrPlayer.paused         : true; },
    get readyState()  { return _plyrPlayer ? _plyrPlayer.media.readyState : 0; },
    play:  function() { return _plyrPlayer ? _plyrPlayer.play()  : Promise.resolve(); },
    pause: function() { if (_plyrPlayer) _plyrPlayer.pause(); },
  };

  _plyrPlayer.on('error', function() {
    var w2 = document.getElementById('player-wrap');
    if (w2) showVideoFallback(w2, _currentVideoUrl, 'error');
  });

  if (IS_MOBILE) {
    var _st = setTimeout(function() {
      var c = wrap.querySelector('#nc-player-container');
      if (c && _plyrPlayer && _plyrPlayer.media.readyState < 2) showIosWarning(c);
    }, 8000);
    _plyrPlayer.once('canplay',  function() { clearTimeout(_st); });
    _plyrPlayer.once('playing',  function() { clearTimeout(_st); });
  }

  if (showIosHint) {
    setTimeout(function() {
      var c = wrap.querySelector('#nc-player-container');
      if (c) showIosWarning(c);
    }, 600);
  }
}

/* ══════════════════════════════
   PROXY vidEl (pour saveProgress du site)
══════════════════════════════ */
var _vidElProxy = null;
Object.defineProperty(window, 'vidEl', {
  get: function() { return _plyrPlayer ? _vidElProxy : null; },
  set: function()  {},
  configurable: true,
});

/* ══════════════════════════════
   API PUBLIQUE
══════════════════════════════ */
function playerTogglePlay() { if (_plyrPlayer) _plyrPlayer.togglePlay(); }
function playerSkip(s)      { if (_plyrPlayer) _plyrPlayer.currentTime = Math.max(0, _plyrPlayer.currentTime + s); }
function playerSetVol(v)    { if (!_plyrPlayer) return; v = parseFloat(v); _plyrPlayer.volume = v; _plyrPlayer.muted = (v === 0); }
function playerToggleMute() { if (_plyrPlayer) _plyrPlayer.toggleMute(); }
function playerToggleFS()   { if (_plyrPlayer) _plyrPlayer.fullscreen.toggle(); }

function playerKeydown(e) {
  var tag = document.activeElement ? document.activeElement.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.key === ' ')          { e.preventDefault(); playerTogglePlay(); }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); playerSkip(-10); }
  if (e.key === 'ArrowRight') { e.preventDefault(); playerSkip(10); }
  if (e.key === 'ArrowUp')    { e.preventDefault(); playerSetVol(Math.min(1, (_plyrPlayer ? _plyrPlayer.volume : 1) + 0.1)); }
  if (e.key === 'ArrowDown')  { e.preventDefault(); playerSetVol(Math.max(0, (_plyrPlayer ? _plyrPlayer.volume : 1) - 0.1)); }
  if (e.key === 'f' || e.key === 'F') playerToggleFS();
  if (e.key === 'm' || e.key === 'M') playerToggleMute();
}

/* Stubs compat index.html / films.html / series.html */
function updateProg() {}
function togglePlay()  { playerTogglePlay(); }
function skip(s)       { playerSkip(s); }
function setVol(v)     { playerSetVol(v); }
function toggleMute()  { playerToggleMute(); }
function toggleFS()    { playerToggleFS(); }
function seekV()       {}
