/* ═══════════════════════════════════════════
   NovaCiné — player.js  (Vidstack)
   Lecteur Vidstack via CDN + Default Layout
   Embeds YouTube / Vimeo / Dailymotion via iframe
   ═══════════════════════════════════════════ */

var _currentVideoUrl = '';
var _vstPlayer       = null;   // instance VidstackPlayer

var IS_IOS    = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
var IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/* ══════════════════════════════
   CHARGEMENT VIDSTACK (lazy)
══════════════════════════════ */
var _vstLoaded = false;

function loadVidstackAssets() {
  return new Promise(function(resolve) {
    if (_vstLoaded && typeof VidstackPlayer !== 'undefined') { resolve(); return; }

    var BASE = 'https://cdn.vidstack.io/player';

    // CSS theme
    if (!document.getElementById('vst-theme')) {
      ['base','default'].forEach(function(name) {
        var l = document.createElement('link');
        l.id = 'vst-' + name;
        l.rel = 'stylesheet';
        l.href = BASE + '/' + name + '.css';
        document.head.appendChild(l);
      });
    }

    // JS bundle
    if (!document.getElementById('vst-js')) {
      var sc = document.createElement('script');
      sc.id   = 'vst-js';
      sc.type = 'module';
      sc.textContent =
        'import { VidstackPlayer, VidstackPlayerLayout } from "' + BASE + '/index.js";' +
        'window.VidstackPlayer = VidstackPlayer;' +
        'window.VidstackPlayerLayout = VidstackPlayerLayout;' +
        'window.dispatchEvent(new Event("vidstack-ready"));';
      document.head.appendChild(sc);

      window.addEventListener('vidstack-ready', function() {
        _vstLoaded = true;
        resolve();
      }, { once: true });
    } else {
      var wait = setInterval(function() {
        if (typeof VidstackPlayer !== 'undefined') {
          clearInterval(wait);
          _vstLoaded = true;
          resolve();
        }
      }, 50);
    }
  });
}

/* ══════════════════════════════
   AFFICHAGE LOADING / FALLBACK
══════════════════════════════ */
function showSpinner(wrap) {
  wrap.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'height:100%;aspect-ratio:16/9;background:#000;gap:1rem;color:rgba(220,232,247,.7);' +
    'font-family:\'DM Sans\',sans-serif;">' +
    '<div style="width:38px;height:38px;border:3px solid rgba(255,255,255,.1);' +
    'border-top-color:#e8a020;border-radius:50%;animation:ncSpin .8s linear infinite;"></div>' +
    '<span style="font-size:.84rem;">Chargement…</span>' +
    '</div>' +
    '<style>@keyframes ncSpin{to{transform:rotate(360deg)}}</style>';
}

function showFallback(wrap, url, reason) {
  var msgs = {
    download: 'Ce lien force le téléchargement et ne peut pas être lu directement.<br>Utilisez un lien mp4/webm direct, ou YouTube, Vimeo, Dailymotion.',
    type:     'Ce lien ne pointe pas vers un fichier vidéo lisible.',
    error:    'Impossible de lire cette vidéo. Le lien est peut-être inaccessible ou dans un format non supporté.',
  };
  wrap.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'height:100%;aspect-ratio:16/9;background:#000;gap:1.2rem;padding:2rem;text-align:center;' +
    'font-family:\'DM Sans\',sans-serif;">' +
    '<div style="font-size:2.5rem;">📽️</div>' +
    '<div style="color:rgba(220,232,247,.85);font-size:.88rem;line-height:1.65;max-width:360px;">' +
    (msgs[reason] || msgs.error) + '</div>' +
    '<div style="color:rgba(220,232,247,.28);font-size:.7rem;word-break:break-all;max-width:320px;">' +
    url + '</div>' +
    '</div>';
}

/* ══════════════════════════════
   VÉRIFICATION DU LIEN
══════════════════════════════ */
function isEmbed(url) {
  return /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/.test(url);
}

async function checkVideoUrl(url) {
  if (isEmbed(url)) return { ok: true };
  try {
    var ctl = new AbortController();
    var tid = setTimeout(function() { ctl.abort(); }, 5000);
    var res = await fetch(url, { method: 'HEAD', signal: ctl.signal });
    clearTimeout(tid);
    var cd = res.headers.get('content-disposition') || '';
    var ct = res.headers.get('content-type') || '';
    if (cd.toLowerCase().includes('attachment')) return { ok: false, reason: 'download' };
    if (ct && !ct.startsWith('video/') && !ct.includes('octet-stream') &&
        !ct.includes('mp4') && !ct.includes('webm') && !ct.includes('mpegurl'))
      return { ok: false, reason: 'type' };
    return { ok: true };
  } catch(e) {
    return { ok: null };
  }
}

/* ══════════════════════════════
   BUILD PLAYER
══════════════════════════════ */
async function buildPlayer(url, resumeAt) {
  _currentVideoUrl = url;
  resumeAt = resumeAt || 0;

  var wrap = document.getElementById('player-wrap');
  if (!wrap) return;

  // Détruire l'instance précédente
  if (_vstPlayer) {
    try { _vstPlayer.destroy(); } catch(e) {}
    _vstPlayer = null;
  }
  wrap.innerHTML = '';

  /* ── EMBEDS ── */
  if (/youtube\.com|youtu\.be/.test(url)) {
    var id = (url.match(/(?:v=|youtu\.be\/)([^&?]+)/) || [])[1];
    if (id) wrap.innerHTML =
      '<div style="aspect-ratio:16/9;background:#000;">' +
      '<iframe style="width:100%;height:100%;border:none;display:block;" ' +
      'src="https://www.youtube.com/embed/' + id + '?autoplay=1&start=' + Math.floor(resumeAt) + '" ' +
      'allow="autoplay;fullscreen" allowfullscreen></iframe></div>';
    return;
  }
  if (/vimeo\.com/.test(url)) {
    var id = (url.match(/vimeo\.com\/(\d+)/) || [])[1];
    if (id) wrap.innerHTML =
      '<div style="aspect-ratio:16/9;background:#000;">' +
      '<iframe style="width:100%;height:100%;border:none;display:block;" ' +
      'src="https://player.vimeo.com/video/' + id + '?autoplay=1#t=' + Math.floor(resumeAt) + 's" ' +
      'allow="autoplay;fullscreen" allowfullscreen></iframe></div>';
    return;
  }
  if (/dailymotion\.com/.test(url)) {
    var id = (url.match(/dailymotion\.com\/video\/([^_?]+)/) || [])[1];
    if (id) wrap.innerHTML =
      '<div style="aspect-ratio:16/9;background:#000;">' +
      '<iframe style="width:100%;height:100%;border:none;display:block;" ' +
      'src="https://www.dailymotion.com/embed/video/' + id + '?autoplay=1&start=' + Math.floor(resumeAt) + '" ' +
      'allow="autoplay;fullscreen" allowfullscreen></iframe></div>';
    return;
  }

  /* ── VÉRIFICATION ── */
  showSpinner(wrap);
  var check = await checkVideoUrl(url);
  if (check.ok === false) { showFallback(wrap, url, check.reason); return; }

  /* ── VIDSTACK ── */
  await loadVidstackAssets();

  wrap.innerHTML = '';
  // Conteneur cible pour Vidstack
  var target = document.createElement('div');
  target.id = 'vst-target';
  wrap.appendChild(target);

  try {
    _vstPlayer = await VidstackPlayer.create({
      target: target,
      src:    url,
      title:  '',
      autoplay: true,
      playsinline: true,
      load: 'eager',
      layout: new VidstackPlayerLayout(),
    });

    // Reprendre à la position sauvegardée
    if (resumeAt > 0) {
      _vstPlayer.subscribe(function(s) {
        if (s.canPlay && !_vstPlayer._seeked) {
          _vstPlayer._seeked = true;
          _vstPlayer.currentTime = resumeAt;
        }
      });
    }

    // Erreur de lecture
    _vstPlayer.listen('error', function() {
      showFallback(wrap, url, 'error');
    });

  } catch(e) {
    showFallback(wrap, url, 'error');
  }
}

/* ══════════════════════════════
   API PUBLIQUE (compatibilité avec les pages existantes)
══════════════════════════════ */
function playerCurrentTime() {
  return _vstPlayer ? _vstPlayer.currentTime : 0;
}
function playerDuration() {
  return _vstPlayer ? _vstPlayer.duration : 0;
}
function playerDispose() {
  if (_vstPlayer) {
    try { _vstPlayer.destroy(); } catch(e) {}
    _vstPlayer = null;
  }
}

// Stubs pour compatibilité avec les appels existants dans les pages
function playerTogglePlay()  { if (_vstPlayer) _vstPlayer.paused ? _vstPlayer.play() : _vstPlayer.pause(); }
function playerSkip(s)       { if (_vstPlayer) _vstPlayer.currentTime = Math.max(0, _vstPlayer.currentTime + s); }
function playerSetVol(v)     { if (_vstPlayer) { _vstPlayer.volume = parseFloat(v); _vstPlayer.muted = (v == 0); } }
function playerToggleMute()  { if (_vstPlayer) _vstPlayer.muted = !_vstPlayer.muted; }
function playerToggleFS()    {
  if (!_vstPlayer) return;
  if (IS_IOS) { var v = document.querySelector('#vst-target video'); if (v && v.webkitEnterFullscreen) { v.webkitEnterFullscreen(); return; } }
  var el = document.getElementById('player-wrap');
  if (!el) return;
  if (document.fullscreenElement) document.exitFullscreen && document.exitFullscreen();
  else el.requestFullscreen && el.requestFullscreen();
}
function playerKeydown(e) {
  var tag = document.activeElement ? document.activeElement.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  // Vidstack gère nativement espace, flèches, etc. — on laisse passer
}

// Alias pour compatibilité
function updateProg()    {}
function togglePlay()    { playerTogglePlay(); }
function skip(s)         { playerSkip(s); }
function setVol(v)       { playerSetVol(v); }
function toggleMute()    { playerToggleMute(); }
function toggleFS()      { playerToggleFS(); }
function seekV()         {}
function setPlaying()    {}
