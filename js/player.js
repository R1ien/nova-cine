/* ═══════════════════════════════════════════
   NovaCiné — player.js  (Video.js FINAL)
   Stratégie définitive :
   1. Après chargement VJS, on supprime les règles
      CSS internes de VJS qui gèrent l'auto-hide
   2. Auto-hide 100% CSS :hover sur player-wrap
   3. Fullscreen natif sur player-wrap (desktop)
      webkitEnterFullscreen sur video (iOS)
   ═══════════════════════════════════════════ */

var _currentVideoUrl = '';
var _vjsPlayer       = null;
var _ctrlEl          = null;

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
      var sc = document.createElement('script');
      sc.id = 'vjs-js';
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/video.js/8.10.0/video.min.js';
      sc.onload = function() {
        _vjsLoaded = true;
        purgeVjsHideRules(); // ← supprimer les règles d'auto-hide VJS
        injectTheme();
        resolve();
      };
      document.head.appendChild(sc);
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
   PURGER LES RÈGLES CSS DE VJS
   qui gèrent .vjs-user-inactive et les transitions
   de la control-bar — on les supprime du CSSOM
══════════════════════════════ */
function purgeVjsHideRules() {
  // Attendre que la feuille VJS soit chargée
  setTimeout(function() {
    try {
      for (var i = 0; i < document.styleSheets.length; i++) {
        var sheet = document.styleSheets[i];
        var href = sheet.href || '';
        if (!href.includes('video-js')) continue;
        var rules;
        try { rules = sheet.cssRules || sheet.rules; } catch(e) { continue; }
        if (!rules) continue;
        // Supprimer en partant de la fin pour ne pas décaler les indices
        for (var j = rules.length - 1; j >= 0; j--) {
          var rule = rules[j];
          var txt = rule.cssText || '';
          // Cibler les règles qui cachent la control-bar
          if (
            (txt.includes('vjs-user-inactive') && txt.includes('control-bar')) ||
            (txt.includes('vjs-has-started') && txt.includes('control-bar') && txt.includes('opacity')) ||
            (txt.includes('vjs-playing') && txt.includes('control-bar') && txt.includes('opacity'))
          ) {
            try { sheet.deleteRule(j); } catch(e) {}
          }
        }
        break;
      }
    } catch(e) {}
  }, 300);
}

/* ══════════════════════════════
   NOS STYLES — injectés APRÈS le CSS VJS
   avec une priorité plus haute (style inline dans head)
══════════════════════════════ */
function injectTheme() {
  if (document.getElementById('nc-theme')) return;
  var s = document.createElement('style');
  s.id = 'nc-theme';
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
      12%  { opacity: .6; }
      88%  { opacity: .3; }
      100% { transform: translateY(-120%) scale(.45); opacity: 0; }
    }

    /* ── VJS base ── */
    #nc-wrap .video-js {
      position: relative; z-index: 1;
      width: 100% !important; height: 100% !important;
      background: transparent;
    }
    #nc-wrap .vjs-tech { background: #000; object-fit: contain; }

    /* ════════════════════════════════════════════
       CONTROL BAR — toujours visible par défaut
       On écrase TOUT ce que VJS peut faire
    ════════════════════════════════════════════ */
    #player-wrap .vjs-control-bar {
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      transform: translateY(0) !important;
      transition: opacity .2s ease !important;

      /* Liquid Glass */
      flex-direction: row !important;
      align-items: center !important;
      flex-wrap: nowrap !important;
      height: 54px !important;
      padding: 0 10px !important;
      gap: 4px !important;
      position: absolute !important;
      bottom: 0 !important; left: 0 !important; right: 0 !important;
      z-index: 10 !important;
      background: rgba(8,12,20,.52) !important;
      backdrop-filter: blur(24px) saturate(1.7) !important;
      -webkit-backdrop-filter: blur(24px) saturate(1.7) !important;
      border-top: 1px solid rgba(255,255,255,.1) !important;
      box-shadow: 0 -4px 24px rgba(0,0,0,.4) !important;
    }
    /* Reflet */
    #player-wrap .vjs-control-bar::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent);
      pointer-events: none;
    }

    /* ══════════════════════════════════════════
       AUTO-HIDE — 100% piloté par classes JS
       Aucun sélecteur :fullscreen/:hover — trop peu fiables
       
       nc-playing  = lecture en cours
       nc-fs       = fullscreen actif  
       nc-fs-active = souris bougée en fullscreen (barre visible)
    ══════════════════════════════════════════ */

    /* Hors fullscreen, en lecture : barre cachée, réapparaît au hover */
    #player-wrap.nc-playing:not(.nc-fs) .vjs-control-bar {
      opacity: 0 !important;
      pointer-events: none !important;
      transition: opacity .3s ease 2s !important;
    }
    #player-wrap.nc-playing:not(.nc-fs):hover .vjs-control-bar {
      opacity: 1 !important;
      pointer-events: auto !important;
      transition: opacity .1s ease !important;
    }

    /* Hors fullscreen, en lecture : curseur caché */
    #player-wrap.nc-playing:not(.nc-fs) { cursor: none; }
    #player-wrap.nc-playing:not(.nc-fs):hover { cursor: default; }

    /* En pause (hors fs) : toujours visible */
    #player-wrap:not(.nc-playing):not(.nc-fs) .vjs-control-bar {
      opacity: 1 !important;
      pointer-events: auto !important;
      transition: none !important;
    }

    /* Fullscreen en lecture : barre cachée par défaut */
    #player-wrap.nc-fs.nc-playing .vjs-control-bar {
      opacity: 0 !important;
      pointer-events: none !important;
      transition: opacity .25s ease !important;
    }
    /* Fullscreen en lecture, souris active : barre visible */
    #player-wrap.nc-fs.nc-playing.nc-fs-active .vjs-control-bar {
      opacity: 1 !important;
      pointer-events: auto !important;
      transition: opacity .12s ease !important;
    }
    /* Fullscreen en pause : toujours visible */
    #player-wrap.nc-fs:not(.nc-playing) .vjs-control-bar {
      opacity: 1 !important;
      pointer-events: auto !important;
      transition: opacity .12s ease !important;
    }

    /* Curseur fullscreen */
    #player-wrap.nc-fs.nc-playing { cursor: none; }
    #player-wrap.nc-fs.nc-playing.nc-fs-active { cursor: default; }
    #player-wrap.nc-fs:not(.nc-playing) { cursor: default; }

    /* Mobile : barre toujours visible */
    @media (max-width: 640px) {
      #player-wrap .vjs-control-bar {
        opacity: 1 !important;
        pointer-events: auto !important;
        transition: none !important;
      }
      #player-wrap { cursor: default !important; }
    }

    /* ── Boutons VJS ── */
    #player-wrap .vjs-button {
      width: 36px !important; height: 36px !important;
      flex-shrink: 0 !important;
      display: flex !important; align-items: center !important; justify-content: center !important;
      border-radius: 50% !important;
      background: rgba(255,255,255,.07) !important;
      border: 1px solid rgba(255,255,255,.13) !important;
      transition: background .15s, transform .12s !important;
      position: relative !important; overflow: hidden !important;
    }
    #player-wrap .vjs-button::after {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 50%;
      border-radius: 50% 50% 0 0;
      background: linear-gradient(to bottom,rgba(255,255,255,.1),transparent);
      pointer-events: none;
    }
    #player-wrap .vjs-button:hover {
      background: rgba(232,160,32,.22) !important;
      border-color: rgba(232,160,32,.5) !important;
      transform: scale(1.1) !important;
    }
    #player-wrap .vjs-button:active { transform: scale(.92) !important; }
    #player-wrap .vjs-button > .vjs-icon-placeholder::before {
      color: rgba(255,255,255,.88) !important;
      font-size: 16px !important; line-height: 36px !important;
      position: relative; z-index: 1;
    }
    #player-wrap .vjs-button:hover > .vjs-icon-placeholder::before { color: #e8a020 !important; }

    /* Play doré */
    #player-wrap .vjs-play-control {
      width: 42px !important; height: 42px !important;
      background: rgba(232,160,32,.18) !important;
      border-color: rgba(232,160,32,.45) !important;
    }
    #player-wrap .vjs-play-control > .vjs-icon-placeholder::before {
      font-size: 18px !important; line-height: 42px !important; color: #e8a020 !important;
    }
    #player-wrap .vjs-play-control:hover { background: rgba(232,160,32,.35) !important; }

    /* Boutons skip custom */
    .nc-skip, .nc-fs-btn {
      width: 36px; height: 36px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%;
      background: rgba(255,255,255,.07);
      border: 1px solid rgba(255,255,255,.13);
      color: rgba(255,255,255,.88); cursor: pointer;
      transition: background .15s, transform .12s;
      position: relative; overflow: hidden;
    }
    .nc-skip::after, .nc-fs-btn::after {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 50%;
      border-radius: 50% 50% 0 0;
      background: linear-gradient(to bottom,rgba(255,255,255,.1),transparent);
      pointer-events: none;
    }
    .nc-skip svg, .nc-fs-btn svg {
      width: 20px; height: 20px; fill: currentColor; position: relative; z-index: 1;
    }
    .nc-fs-btn svg { width: 18px; height: 18px; }
    .nc-skip:hover, .nc-fs-btn:hover {
      background: rgba(232,160,32,.22); border-color: rgba(232,160,32,.5); transform: scale(1.1);
    }
    .nc-skip:active, .nc-fs-btn:active { transform: scale(.92); }

    /* ── Progress ── */
    #player-wrap .vjs-progress-control {
      flex: 1 !important; height: 100% !important;
      display: flex !important; align-items: center !important; min-width: 60px !important;
    }
    #player-wrap .vjs-progress-holder {
      flex: 1; height: 4px !important; margin: 0 !important;
      border-radius: 4px !important; background: rgba(255,255,255,.2) !important;
      transition: height .15s !important;
    }
    #player-wrap .vjs-progress-control:hover .vjs-progress-holder { height: 7px !important; }
    #player-wrap .vjs-play-progress {
      background: linear-gradient(90deg,#c87010,#e8a020,#f0c060) !important;
      border-radius: 4px !important;
    }
    #player-wrap .vjs-play-progress::before { color: #f0c060 !important; font-size: 13px !important; top: -0.3em !important; }
    #player-wrap .vjs-load-progress { background: rgba(255,255,255,.12) !important; border-radius: 4px !important; }
    #player-wrap .vjs-load-progress div { background: rgba(255,255,255,.08) !important; }
    #player-wrap .vjs-time-tooltip {
      background: rgba(8,12,20,.9) !important; backdrop-filter: blur(10px) !important;
      border: 1px solid rgba(232,160,32,.3) !important; color: #e8a020 !important;
      border-radius: 7px !important; font-size: .7rem !important; padding: 3px 8px !important;
    }

    /* ── Temps ── */
    #player-wrap .vjs-current-time, #player-wrap .vjs-duration, #player-wrap .vjs-time-divider {
      display: flex !important; align-items: center !important;
      color: rgba(255,255,255,.6) !important; font-size: .73rem !important;
      font-weight: 500 !important; padding: 0 2px !important; min-width: 0 !important; line-height: 1 !important;
    }

    /* ── Volume ── */
    #player-wrap .vjs-volume-panel { display: flex !important; align-items: center !important; gap: 4px !important; width: auto !important; }
    #player-wrap .vjs-volume-panel.vjs-volume-panel-horizontal { width: auto !important; }
    #player-wrap .vjs-volume-control.vjs-volume-horizontal { width: 56px !important; height: 36px !important; display: flex !important; align-items: center !important; }
    #player-wrap .vjs-volume-bar { margin: 0 !important; height: 4px !important; border-radius: 4px !important; background: rgba(255,255,255,.2) !important; }
    #player-wrap .vjs-volume-level { background: #e8a020 !important; border-radius: 4px !important; }
    #player-wrap .vjs-volume-level::before { color: #e8a020 !important; font-size: 11px !important; }
    #player-wrap .vjs-mute-control { width: 36px !important; height: 36px !important; }

    /* ── Vitesse ── */
    #player-wrap .vjs-playback-rate { display: flex !important; align-items: center !important; }
    #player-wrap .vjs-playback-rate-value {
      font-size: .71rem !important; font-weight: 700 !important;
      color: rgba(255,255,255,.75) !important;
      background: rgba(255,255,255,.07) !important;
      border: 1px solid rgba(255,255,255,.13) !important;
      border-radius: 20px !important; padding: 0 9px !important; height: 28px !important;
      display: flex !important; align-items: center !important;
      transition: background .15s, color .15s !important; cursor: pointer !important;
    }
    #player-wrap .vjs-playback-rate:hover .vjs-playback-rate-value {
      background: rgba(232,160,32,.2) !important; border-color: rgba(232,160,32,.45) !important; color: #e8a020 !important;
    }
    #player-wrap .vjs-playback-rate .vjs-icon-placeholder { display: none !important; }
    #player-wrap .vjs-menu-content {
      background: rgba(8,12,20,.92) !important; backdrop-filter: blur(20px) !important;
      border: 1px solid rgba(255,255,255,.1) !important; border-radius: 12px !important;
      bottom: 46px !important; overflow: hidden !important; padding: 4px 0 !important;
    }
    #player-wrap .vjs-menu-item { font-size: .8rem !important; color: rgba(220,232,247,.8) !important; padding: .5rem 1rem !important; }
    #player-wrap .vjs-menu-item:hover { background: rgba(232,160,32,.12) !important; color: #e8a020 !important; }
    #player-wrap .vjs-menu-item.vjs-selected { background: rgba(232,160,32,.2) !important; color: #e8a020 !important; font-weight: 600 !important; }

    /* VJS fullscreen control caché */
    #player-wrap .vjs-fullscreen-control { display: none !important; }

    /* ── Big play ── */
    #player-wrap .vjs-big-play-button {
      width: 66px !important; height: 66px !important; border-radius: 50% !important;
      border: 2px solid rgba(232,160,32,.6) !important;
      background: rgba(8,12,20,.55) !important; backdrop-filter: blur(16px) !important;
      top: 50% !important; left: 50% !important;
      transform: translate(-50%,-50%) !important; margin: 0 !important;
      transition: background .2s, transform .2s, border-color .2s !important;
    }
    #player-wrap .vjs-big-play-button::before { color: #e8a020 !important; font-size: 1.85em !important; line-height: 62px !important; }
    #player-wrap .video-js:hover .vjs-big-play-button { background: rgba(232,160,32,.18) !important; border-color: rgba(232,160,32,.9) !important; transform: translate(-50%,-50%) scale(1.08) !important; }

    /* ── Spinner ── */
    #player-wrap .vjs-loading-spinner { border-color: rgba(232,160,32,.2) !important; }
    #player-wrap .vjs-loading-spinner::before, #player-wrap .vjs-loading-spinner::after { border-top-color: #e8a020 !important; }

    /* ── Fullscreen — class .nc-fs + sélecteurs natifs (double sécurité) ── */
    #player-wrap.nc-fs,
    #player-wrap:-webkit-full-screen,
    #player-wrap:fullscreen {
      background: #000 !important;
      width: 100vw !important; height: 100vh !important;
      max-width: none !important; aspect-ratio: unset !important;
      position: fixed !important; inset: 0 !important;
    }
    #player-wrap.nc-fs #nc-wrap,
    #player-wrap:-webkit-full-screen #nc-wrap,
    #player-wrap:fullscreen #nc-wrap {
      width: 100% !important; height: 100% !important;
      aspect-ratio: unset !important;
      position: absolute !important; inset: 0 !important;
    }
    #player-wrap.nc-fs .video-js,
    #player-wrap:-webkit-full-screen .video-js,
    #player-wrap:fullscreen .video-js {
      width: 100% !important; height: 100% !important;
      aspect-ratio: unset !important;
      position: absolute !important; inset: 0 !important;
    }
    #player-wrap.nc-fs .vjs-control-bar,
    #player-wrap:-webkit-full-screen .vjs-control-bar,
    #player-wrap:fullscreen .vjs-control-bar {
      position: fixed !important;
      bottom: 0 !important; left: 0 !important; right: 0 !important;
      z-index: 2147483647 !important;
    }
    /* Bulles cachées en fullscreen */
    #player-wrap.nc-fs .nc-bbl,
    #player-wrap:-webkit-full-screen .nc-bbl,
    #player-wrap:fullscreen .nc-bbl {
      display: none !important;
    }

    /* Fond modal noir */
    .player-modal { background: #000 !important; }

    /* ── Mobile ── */
    @media (max-width: 640px) {
      #player-wrap .vjs-control-bar { height: 52px !important; padding: 0 8px !important; gap: 3px !important; }
      #player-wrap .vjs-button { width: 40px !important; height: 40px !important; }
      #player-wrap .vjs-play-control { width: 44px !important; height: 44px !important; }
      .nc-skip, .nc-fs-btn { width: 40px !important; height: 40px !important; }
      .nc-skip svg { width: 22px !important; height: 22px !important; }
      #player-wrap .vjs-volume-control.vjs-volume-horizontal { display: none !important; }
      #player-wrap .vjs-playback-rate { display: none !important; }
      #player-wrap .vjs-current-time, #player-wrap .vjs-duration, #player-wrap .vjs-time-divider { font-size: .68rem !important; }
    }

    /* ── Loading / Fallback ── */
    .nc-loading { display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:1rem;color:rgba(220,232,247,.7);font-family:'DM Sans',sans-serif; }
    .nc-spin { width:38px;height:38px;border:3px solid rgba(255,255,255,.1);border-top-color:#e8a020;border-radius:50%;animation:ncSpin .8s linear infinite; }
    @keyframes ncSpin { to { transform:rotate(360deg); } }
    .nc-fallback { display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:1.2rem;padding:1.5rem;text-align:center;font-family:'DM Sans',sans-serif; }
    .nc-fallback-icon { font-size:2.5rem; }
    .nc-fallback-msg  { color:rgba(220,232,247,.9);font-size:.88rem;line-height:1.6;max-width:380px; }
    .nc-fallback-btn  { background:#e8a020;color:#000;font-weight:700;padding:.7rem 1.4rem;border-radius:12px;text-decoration:none;font-size:.9rem;display:inline-block; }
    .nc-fallback-url  { color:rgba(220,232,247,.35);font-size:.72rem;word-break:break-all;max-width:340px; }
    .nc-ios-banner { position:absolute;top:0;left:0;right:0;z-index:30;background:rgba(232,160,32,.12);backdrop-filter:blur(12px);border-bottom:1px solid rgba(232,160,32,.28);padding:.5rem 1rem;display:flex;align-items:center;justify-content:space-between;gap:.8rem;font-family:'DM Sans',sans-serif;animation:ncSlideDown .3s ease; }
    @keyframes ncSlideDown { from{transform:translateY(-100%);}to{transform:none;} }
    .nc-ios-banner span { font-size:.75rem;color:rgba(220,232,247,.85);line-height:1.4; }
    .nc-ios-banner a    { flex-shrink:0;background:#e8a020;color:#000;font-weight:700;padding:.35rem .8rem;border-radius:8px;text-decoration:none;font-size:.75rem; }
    #nc-wrap iframe { position:relative;z-index:1;width:100%;height:100%;border:none;display:block; }
  `;
  document.head.appendChild(s);
}

/* ══════════════════════════════
   BULLES
══════════════════════════════ */
function createBubbles(container) {
  container.querySelectorAll('.nc-bbl').forEach(function(b){ b.remove(); });
  var colors=['rgba(232,160,32,.25)','rgba(192,57,43,.16)','rgba(220,232,247,.06)','rgba(46,204,113,.13)'];
  var n=IS_MOBILE?5:9;
  for(var i=0;i<n;i++){(function(){
    var b=document.createElement('div');b.className='nc-bbl';
    var sz=6+Math.random()*22,dr=8+Math.random()*10;
    b.style.cssText='width:'+sz+'px;height:'+sz+'px;left:'+(3+Math.random()*92)+'%;bottom:0;background:'+colors[Math.floor(Math.random()*colors.length)]+';animation-duration:'+dr+'s;animation-delay:'+(-(Math.random()*dr))+'s;box-shadow:inset 0 0 '+(sz*.3)+'px rgba(255,255,255,.09);';
    container.appendChild(b);
  })();}
}

/* ══════════════════════════════
   nc-playing sur player-wrap
══════════════════════════════ */
function setPlaying(v) {
  var pw = document.getElementById('player-wrap');
  if (!pw) return;
  pw.classList.toggle('nc-playing', v);
  /* En fullscreen : chaque changement play/pause réactive la barre */
  if (_isFs) _fsShowBar();
}

/* ══════════════════════════════
   FULLSCREEN — logique simplifiée
   On track la position de la souris via setInterval.
   Pas de :fullscreen CSS, pas de listeners complexes.
══════════════════════════════ */
var _isFs        = false;
var _fsMouseX    = -1;
var _fsMouseY    = -1;
var _fsLastMove  = 0;
var _fsInterval  = null;
var _fsBarVisible = false;

function _fsShowBar() {
  var pw = document.getElementById('player-wrap');
  if (!pw) return;
  _fsLastMove = Date.now();
  if (!_fsBarVisible) {
    pw.classList.add('nc-fs-active');
    _fsBarVisible = true;
  }
}

function _fsHideBar() {
  var pw = document.getElementById('player-wrap');
  if (!pw) return;
  /* Ne cacher que si en lecture */
  if (pw.classList.contains('nc-playing')) {
    pw.classList.remove('nc-fs-active');
    _fsBarVisible = false;
  }
}

function setupFsListener() {
  /* Un seul listener global — pas d'accumulation */
  if (setupFsListener._done) return;
  setupFsListener._done = true;

  document.addEventListener('fullscreenchange',       _onFsChange);
  document.addEventListener('webkitfullscreenchange', _onFsChange);

  /* Tracker la position souris globalement */
  document.addEventListener('mousemove', function(e) {
    if (!_isFs) return;
    if (e.clientX !== _fsMouseX || e.clientY !== _fsMouseY) {
      _fsMouseX = e.clientX;
      _fsMouseY = e.clientY;
      _fsShowBar();
    }
  });
  document.addEventListener('touchstart', function() {
    if (_isFs) _fsShowBar();
  }, { passive: true });
  document.addEventListener('keydown', function() {
    if (_isFs) _fsShowBar();
  });
}

function _onFsChange() {
  var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  _isFs = !!fsEl;
  var btn = document.getElementById('nc-fs-btn');
  if (btn) btn.innerHTML = _isFs ? SVG_FS_OUT : SVG_FS_IN;
  var pw = document.getElementById('player-wrap');
  if (!pw) return;

  if (_isFs) {
    pw.classList.add('nc-fs');
    _fsBarVisible = false;
    _fsShowBar(); /* Montrer au départ */
    /* Vérifier toutes les 500ms si la barre doit se cacher */
    clearInterval(_fsInterval);
    _fsInterval = setInterval(function() {
      if (!_isFs) { clearInterval(_fsInterval); return; }
      var idle = Date.now() - _fsLastMove;
      if (idle > 3000) _fsHideBar();
    }, 500);
  } else {
    clearInterval(_fsInterval);
    pw.classList.remove('nc-fs');
    pw.classList.remove('nc-fs-active');
    _fsBarVisible = false;
  }
}

/* ══════════════════════════════
   SVG
══════════════════════════════ */
var SVG_REW   = '<svg viewBox="0 0 24 24"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="13.8" text-anchor="middle" font-size="5.5" font-family="DM Sans,sans-serif" font-weight="700" fill="currentColor">10</text></svg>';
var SVG_FWD   = '<svg viewBox="0 0 24 24"><path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z"/><text x="12" y="13.8" text-anchor="middle" font-size="5.5" font-family="DM Sans,sans-serif" font-weight="700" fill="currentColor">10</text></svg>';
var SVG_FS_IN = '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
var SVG_FS_OUT= '<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>';

/* ══════════════════════════════
   INJECTION BOUTONS
══════════════════════════════ */
function injectCustomButtons() {
  if (!_ctrlEl || _ctrlEl.querySelector('.nc-skip')) return;
  var playBtn = _ctrlEl.querySelector('.vjs-play-control');
  function mkBtn(cls,svg,title,fn) {
    var b=document.createElement('button');
    b.type='button';b.className=cls;b.title=title;b.innerHTML=svg;
    b.addEventListener('click',function(e){e.stopPropagation();fn();});
    return b;
  }
  var rew=mkBtn('nc-skip',  SVG_REW,  'Reculer 10s', function(){playerSkip(-10);});
  var fwd=mkBtn('nc-skip',  SVG_FWD,  'Avancer 10s', function(){playerSkip(10);});
  var fsb=mkBtn('nc-fs-btn',SVG_FS_IN,'Plein écran', playerToggleFS);
  fsb.id='nc-fs-btn';
  if(playBtn){playBtn.after(fwd);playBtn.after(rew);}
  else{_ctrlEl.prepend(fwd);_ctrlEl.prepend(rew);}
  _ctrlEl.appendChild(fsb);
}

/* ══════════════════════════════
   URL
══════════════════════════════ */
async function checkVideoUrl(url) {
  if(/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/.test(url))return{ok:true};
  try{
    var res=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout?AbortSignal.timeout(5000):undefined});
    var cd=res.headers.get('content-disposition')||'',ct=res.headers.get('content-type')||'';
    if(cd.toLowerCase().includes('attachment'))return{ok:false,reason:'download'};
    if(ct&&!ct.startsWith('video/')&&!ct.includes('octet-stream')&&!ct.includes('mp4')&&!ct.includes('webm'))return{ok:false,reason:'type'};
    return{ok:true};
  }catch(e){return{ok:null,reason:'cors'};}
}
function videoType(url){
  var e=url.split('.').pop().split('?')[0].toLowerCase();
  return({mp4:'video/mp4',mkv:'video/x-matroska',mov:'video/quicktime',avi:'video/x-msvideo',webm:'video/webm',ogv:'video/ogg',m4v:'video/mp4',flv:'video/x-flv'})[e]||'video/mp4';
}

/* ══════════════════════════════
   BUILD PLAYER
══════════════════════════════ */
async function buildPlayer(url,resumeAt) {
  var wrap=document.getElementById('player-wrap');
  _currentVideoUrl=url; resumeAt=resumeAt||0;
  if(_vjsPlayer){try{_vjsPlayer.dispose();}catch(e){}_vjsPlayer=null;}
  _ctrlEl=null;_vidElProxy=null;_isFs=false;
  setPlaying(false);
  wrap.innerHTML='';

  var eid,ehtml=null;
  if(/youtube\.com|youtu\.be/.test(url)&&(eid=(url.match(/(?:v=|youtu\.be\/)([^&?]+)/)||[])[1]))
    ehtml='<iframe src="https://www.youtube.com/embed/'+eid+'?autoplay=1&start='+Math.floor(resumeAt)+'" allow="autoplay;fullscreen" allowfullscreen></iframe>';
  else if(/vimeo\.com/.test(url)&&(eid=(url.match(/vimeo\.com\/(\d+)/)||[])[1]))
    ehtml='<iframe src="https://player.vimeo.com/video/'+eid+'?autoplay=1#t='+Math.floor(resumeAt)+'s" allow="autoplay;fullscreen" allowfullscreen></iframe>';
  else if(/dailymotion\.com/.test(url)&&(eid=(url.match(/dailymotion\.com\/video\/([^_?]+)/)||[])[1]))
    ehtml='<iframe src="https://www.dailymotion.com/embed/video/'+eid+'?autoplay=1&start='+Math.floor(resumeAt)+'" allow="autoplay;fullscreen" allowfullscreen></iframe>';

  if(ehtml){wrap.innerHTML='<div id="nc-wrap" style="aspect-ratio:16/9">'+ehtml+'</div>';createBubbles(wrap.querySelector('#nc-wrap'));return;}

  wrap.innerHTML='<div id="nc-wrap" style="aspect-ratio:16/9"><div class="nc-loading"><div class="nc-spin"></div><span style="font-size:.85rem">Vérification du lien…</span></div></div>';
  var check=await checkVideoUrl(url);
  if(check.ok===false){showFallback(wrap,url,check.reason);return;}
  if(IS_IOS&&check.ok===null){await buildVjs(wrap,url,resumeAt,true);return;}
  await buildVjs(wrap,url,resumeAt,false);
}

function showFallback(wrap,url,reason){
  var msg=reason==='download'?'Ce lien force le téléchargement.':'Ce lien ne semble pas pointer vers un fichier vidéo lisible.';
  if(IS_MOBILE)msg=reason==='download'?'Ce lien force le téléchargement.\nUtilisez un lien mp4/webm ou YouTube, Vimeo, Dailymotion.':'Format non supporté sur mobile.';
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
   BUILD VJS
══════════════════════════════ */
async function buildVjs(wrap,url,resumeAt,showIosHint) {
  await loadVjsAssets();

  wrap.innerHTML=
    '<div id="nc-wrap" style="aspect-ratio:16/9">'+
    '<video id="nc-vjs-el" class="video-js" playsinline preload="none">'+
    '<source src="'+url+'" type="'+videoType(url)+'">'+
    '</video></div>';

  createBubbles(wrap.querySelector('#nc-wrap'));
  setupFsListener();

  _vjsPlayer=videojs('nc-vjs-el',{
    controls:true,autoplay:true,preload:'none',fluid:false,
    playbackRates:[0.5,0.75,1,1.25,1.5,2],
    /* Désactiver complètement l'inactivité VJS */
    inactivityTimeout:0,
    controlBar:{
      children:['playToggle','volumePanel','progressControl','currentTimeDisplay','timeDivider','durationDisplay','playbackRateMenuButton'],
      volumePanel:{inline:true},
    },
    userActions:{hotkeys:false,doubleClick:true},
    nativeControlsForTouch:false,
  });

  _vjsPlayer.ready(function(){
    var vjsEl=wrap.querySelector('.video-js');
    _ctrlEl=vjsEl?vjsEl.querySelector('.vjs-control-bar'):null;

    /* Forcer userActive en permanence — VJS ne pourra pas passer en inactive */
    _vjsPlayer.userActive(true);
    _vjsPlayer.on('userinactive',function(){ _vjsPlayer.userActive(true); });

    injectCustomButtons();
    _vjsPlayer.one('loadedmetadata',function(){if(resumeAt>0)_vjsPlayer.currentTime(resumeAt);});
    _vjsPlayer.play().catch(function(){});

    _vjsPlayer.on('play',  function(){ setPlaying(true); });
    _vjsPlayer.on('pause', function(){ setPlaying(false); });
    _vjsPlayer.on('ended', function(){ setPlaying(false); });
  });

  _vidElProxy={
    get currentTime(){return _vjsPlayer.currentTime();},
    set currentTime(v){_vjsPlayer.currentTime(v);},
    get duration()   {return _vjsPlayer.duration()||NaN;},
    get paused()     {return _vjsPlayer.paused();},
    get readyState() {return _vjsPlayer.readyState();},
    play: function(){return _vjsPlayer.play();},
    pause:function(){_vjsPlayer.pause();},
  };

  _vjsPlayer.on('error',function(){var w2=document.getElementById('player-wrap');if(w2)showFallback(w2,_currentVideoUrl,'error');});

  if(IS_MOBILE){
    var _st=setTimeout(function(){var c=wrap.querySelector('#nc-wrap');if(c&&_vjsPlayer&&_vjsPlayer.readyState()<2)showIosWarning(c);},8000);
    _vjsPlayer.one('canplay',function(){clearTimeout(_st);});
    _vjsPlayer.one('playing',function(){clearTimeout(_st);});
  }
  if(showIosHint)setTimeout(function(){var c=wrap.querySelector('#nc-wrap');if(c)showIosWarning(c);},600);
}

/* ══════════════════════════════
   PROXY vidEl
══════════════════════════════ */
var _vidElProxy=null;
Object.defineProperty(window,'vidEl',{get:function(){return _vjsPlayer?_vidElProxy:null;},set:function(){},configurable:true});

/* ══════════════════════════════
   API PUBLIQUE
══════════════════════════════ */
function playerTogglePlay(){if(!_vjsPlayer)return;_vjsPlayer.paused()?_vjsPlayer.play().catch(function(){}):_vjsPlayer.pause();}
function playerSkip(s){if(_vjsPlayer)_vjsPlayer.currentTime(Math.max(0,_vjsPlayer.currentTime()+s));}
function playerSetVol(v){if(!_vjsPlayer)return;v=parseFloat(v);_vjsPlayer.volume(v);_vjsPlayer.muted(v===0);}
function playerToggleMute(){if(_vjsPlayer)_vjsPlayer.muted(!_vjsPlayer.muted());}

function playerToggleFS(){
  if(IS_IOS){var vid=document.getElementById('nc-vjs-el');if(vid&&vid.webkitEnterFullscreen)vid.webkitEnterFullscreen();return;}
  var pw=document.getElementById('player-wrap');if(!pw)return;

  /* Stopper les animations de bulles pendant la transition fullscreen
     pour éviter le glitch de repaint */
  var bubbles=pw.querySelectorAll('.nc-bbl');
  bubbles.forEach(function(b){b.style.animationPlayState='paused';});
  setTimeout(function(){
    bubbles.forEach(function(b){b.style.animationPlayState='';});
  },600);

  if(_isFs){
    if(document.exitFullscreen)document.exitFullscreen();
    else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
  } else {
    if(pw.requestFullscreen)pw.requestFullscreen();
    else if(pw.webkitRequestFullscreen)pw.webkitRequestFullscreen();
  }
}

function playerKeydown(e){
  var tag=document.activeElement?document.activeElement.tagName:'';
  if(tag==='INPUT'||tag==='TEXTAREA')return;
  if(e.key===' '){e.preventDefault();playerTogglePlay();}
  if(e.key==='ArrowLeft'){e.preventDefault();playerSkip(-10);}
  if(e.key==='ArrowRight'){e.preventDefault();playerSkip(10);}
  if(e.key==='ArrowUp'){e.preventDefault();playerSetVol(Math.min(1,(_vjsPlayer?_vjsPlayer.volume():1)+.1));}
  if(e.key==='ArrowDown'){e.preventDefault();playerSetVol(Math.max(0,(_vjsPlayer?_vjsPlayer.volume():1)-.1));}
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
