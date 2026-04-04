/* ═══════════════════════════════════════════
   NovaCiné — player.js  (Vidstack 1.x CDN)
   ═══════════════════════════════════════════ */

var _currentVideoUrl = '';
var _player          = null;   // <media-player> element

var IS_IOS    = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
var IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/* ─── Attendre que Vidstack soit prêt ─── */
function waitForVidstack() {
  return new Promise(function(resolve) {
    // Le bundle CDN de Vidstack enregistre les custom elements dès le chargement
    // On attend que <media-player> soit défini
    if (customElements.get('media-player')) { resolve(); return; }
    customElements.whenDefined('media-player').then(resolve);
  });
}

/* ─── Fallback / Spinner ─── */
function showSpinner(wrap) {
  wrap.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'aspect-ratio:16/9;background:#000;gap:1rem;color:rgba(220,232,247,.65);font-family:\'DM Sans\',sans-serif;">' +
    '<div style="width:38px;height:38px;border:3px solid rgba(255,255,255,.1);' +
    'border-top-color:#e8a020;border-radius:50%;animation:ncSpin .8s linear infinite;"></div>' +
    '<span style="font-size:.82rem;">Chargement du lecteur…</span>' +
    '</div><style>@keyframes ncSpin{to{transform:rotate(360deg)}}</style>';
}

function showFallback(wrap, url, reason) {
  var msg = {
    download: 'Ce lien force le téléchargement.<br>Utilisez un lien mp4/webm direct, ou YouTube, Vimeo, Dailymotion.',
    type    : 'Ce lien ne pointe pas vers un fichier vidéo lisible.',
    error   : 'Impossible de lire cette vidéo. Le lien est peut-être inaccessible ou le format non supporté.',
  }[reason] || 'Impossible de lire cette vidéo.';

  wrap.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'aspect-ratio:16/9;background:#000;gap:1.1rem;padding:2rem;text-align:center;' +
    'font-family:\'DM Sans\',sans-serif;">' +
    '<div style="font-size:2.4rem;">📽️</div>' +
    '<div style="color:rgba(220,232,247,.85);font-size:.88rem;line-height:1.65;max-width:360px;">' + msg + '</div>' +
    '<div style="color:rgba(220,232,247,.25);font-size:.68rem;word-break:break-all;max-width:320px;">' + url + '</div>' +
    '</div>';
}

/* ─── Vérification du lien ─── */
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
  } catch(e) { return { ok: null }; }
}

/* ─── BUILD PLAYER ─── */
async function buildPlayer(url, resumeAt) {
  _currentVideoUrl = url;
  resumeAt = resumeAt || 0;

  var wrap = document.getElementById('player-wrap');
  if (!wrap) return;

  // Nettoyer l'instance précédente
  _player = null;
  wrap.innerHTML = '';

  /* ── Embeds ── */
  function embedHtml(src) {
    return '<div style="aspect-ratio:16/9;background:#000;">' +
      '<iframe style="width:100%;height:100%;border:none;display:block;" ' +
      'src="' + src + '" allow="autoplay;fullscreen" allowfullscreen></iframe></div>';
  }

  if (/youtube\.com|youtu\.be/.test(url)) {
    var id = (url.match(/(?:v=|youtu\.be\/)([^&?]+)/) || [])[1];
    if (id) wrap.innerHTML = embedHtml('https://www.youtube.com/embed/' + id + '?autoplay=1&start=' + Math.floor(resumeAt));
    return;
  }
  if (/vimeo\.com/.test(url)) {
    var id = (url.match(/vimeo\.com\/(\d+)/) || [])[1];
    if (id) wrap.innerHTML = embedHtml('https://player.vimeo.com/video/' + id + '?autoplay=1#t=' + Math.floor(resumeAt) + 's');
    return;
  }
  if (/dailymotion\.com/.test(url)) {
    var id = (url.match(/dailymotion\.com\/video\/([^_?]+)/) || [])[1];
    if (id) wrap.innerHTML = embedHtml('https://www.dailymotion.com/embed/video/' + id + '?autoplay=1&start=' + Math.floor(resumeAt));
    return;
  }

  /* ── Vérification réseau ── */
  showSpinner(wrap);
  var check = await checkVideoUrl(url);
  if (check.ok === false) { showFallback(wrap, url, check.reason); return; }

  /* ── Attendre Vidstack ── */
  try {
    await Promise.race([
      waitForVidstack(),
      new Promise(function(_, reject) { setTimeout(function() { reject(new Error('timeout')); }, 8000); })
    ]);
  } catch(e) {
    showFallback(wrap, url, 'error');
    return;
  }

  /* ── Créer le lecteur via Web Components ── */
  wrap.innerHTML = '';

  // Créer <media-player>
  var player = document.createElement('media-player');
  player.setAttribute('src', url);
  player.setAttribute('autoplay', '');
  player.setAttribute('playsinline', '');
  player.style.width  = '100%';
  player.style.height = '100%';
  player.style.display = 'block';

  // Créer <media-provider>
  var provider = document.createElement('media-provider');
  player.appendChild(provider);

  // Créer le Default Layout vidéo
  var layout = document.createElement('media-video-layout');
  player.appendChild(layout);

  wrap.appendChild(player);
  _player = player;

  // Reprendre à la position sauvegardée
  if (resumeAt > 0) {
    player.addEventListener('can-play', function handler() {
      player.removeEventListener('can-play', handler);
      player.currentTime = resumeAt;
    });
  }

  // Erreur
  player.addEventListener('error', function() {
    showFallback(wrap, url, 'error');
  });
}

/* ─── API PUBLIQUE ─── */
function playerCurrentTime() { return _player ? _player.currentTime : 0; }
function playerDuration()    { return _player ? _player.duration    : 0; }
function playerDispose()     { _player = null; }

// Stubs compatibilité pages existantes
function playerTogglePlay()  { if (_player) _player.paused ? _player.play() : _player.pause(); }
function playerSkip(s)       { if (_player) _player.currentTime = Math.max(0, _player.currentTime + s); }
function playerSetVol(v)     { if (_player) { _player.volume = parseFloat(v); _player.muted = (v == 0); } }
function playerToggleMute()  { if (_player) _player.muted = !_player.muted; }
function playerToggleFS() {
  var el = document.getElementById('player-wrap');
  if (!el) return;
  if (IS_IOS) { var v = el.querySelector('video'); if (v && v.webkitEnterFullscreen) { v.webkitEnterFullscreen(); return; } }
  document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen();
}
function playerKeydown(e) {}
function updateProg()    {}
function togglePlay()    { playerTogglePlay(); }
function skip(s)         { playerSkip(s); }
function setVol(v)       { playerSetVol(v); }
function toggleMute()    { playerToggleMute(); }
function toggleFS()      { playerToggleFS(); }
function seekV()         {}
function setPlaying()    {}
