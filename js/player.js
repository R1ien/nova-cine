/* ═══════════════════════════════════════════
   NovaCiné — player.js  (Plyr 3.8.4)
   ═══════════════════════════════════════════ */

var _currentVideoUrl = '';
var _plyr            = null;

var IS_IOS    = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
var IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/* ── Fallback / Spinner ── */
function showSpinner(wrap) {
  wrap.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'aspect-ratio:16/9;background:#000;gap:1rem;color:rgba(220,232,247,.65);' +
    'font-family:\'DM Sans\',sans-serif;">' +
    '<div style="width:38px;height:38px;border:3px solid rgba(255,255,255,.1);' +
    'border-top-color:#e8a020;border-radius:50%;animation:ncSpin .8s linear infinite;"></div>' +
    '<span style="font-size:.82rem;">Vérification du lien…</span>' +
    '</div><style>@keyframes ncSpin{to{transform:rotate(360deg)}}</style>';
}

function showFallback(wrap, url, reason) {
  var msg = {
    download: 'Ce lien force le téléchargement.<br>Utilisez un lien mp4/webm direct, ou YouTube, Vimeo, Dailymotion.',
    type:     'Ce lien ne pointe pas vers un fichier vidéo lisible.',
    error:    'Impossible de lire cette vidéo. Le lien est peut-être inaccessible ou le format non supporté.',
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

/* ── Vérification lien ── */
function isEmbed(url) {
  return /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/.test(url);
}
function videoMime(url) {
  var ext = url.split('?')[0].split('.').pop().toLowerCase();
  return ({mp4:'video/mp4',webm:'video/webm',ogv:'video/ogg',ogg:'video/ogg',
    m4v:'video/mp4',mov:'video/quicktime',mkv:'video/x-matroska',
    avi:'video/x-msvideo',flv:'video/x-flv'})[ext] || 'video/mp4';
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

/* ── BUILD PLAYER ── */
async function buildPlayer(url, resumeAt) {
  _currentVideoUrl = url;
  resumeAt = resumeAt || 0;

  var wrap = document.getElementById('player-wrap');
  if (!wrap) return;

  // Détruire l'instance précédente
  if (_plyr) {
    try { _plyr.destroy(); } catch(e) {}
    _plyr = null;
  }
  wrap.innerHTML = '';

  /* ── EMBEDS ── */
  function makeIframe(src) {
    return '<div style="aspect-ratio:16/9;background:#000;">' +
      '<iframe style="width:100%;height:100%;border:none;display:block;" ' +
      'src="' + src + '" allow="autoplay;fullscreen" allowfullscreen></iframe></div>';
  }

  if (/youtube\.com|youtu\.be/.test(url)) {
    var id = (url.match(/(?:v=|youtu\.be\/)([^&?]+)/) || [])[1];
    if (id) wrap.innerHTML = makeIframe('https://www.youtube.com/embed/' + id + '?autoplay=1&start=' + Math.floor(resumeAt));
    return;
  }
  if (/vimeo\.com/.test(url)) {
    var id = (url.match(/vimeo\.com\/(\d+)/) || [])[1];
    if (id) wrap.innerHTML = makeIframe('https://player.vimeo.com/video/' + id + '?autoplay=1#t=' + Math.floor(resumeAt) + 's');
    return;
  }
  if (/dailymotion\.com/.test(url)) {
    var id = (url.match(/dailymotion\.com\/video\/([^_?]+)/) || [])[1];
    if (id) wrap.innerHTML = makeIframe('https://www.dailymotion.com/embed/video/' + id + '?autoplay=1&start=' + Math.floor(resumeAt));
    return;
  }

  /* ── Vérification réseau ── */
  showSpinner(wrap);
  var check = await checkVideoUrl(url);
  if (check.ok === false) { showFallback(wrap, url, check.reason); return; }

  /* ── PLYR ── */
  wrap.innerHTML = '';

  var video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.setAttribute('preload', 'none');
  video.setAttribute('autoplay', '');
  var source = document.createElement('source');
  source.src  = url;
  source.type = videoMime(url);
  video.appendChild(source);
  wrap.appendChild(video);

  if (typeof Plyr === 'undefined') {
    showFallback(wrap, url, 'error');
    return;
  }

  _plyr = new Plyr(video, {
    controls: [
      'play-large',
      'play', 'rewind', 'fast-forward',
      'progress',
      'current-time', 'duration',
      'mute', 'volume',
      'settings',
      'fullscreen',
    ],
    settings:  ['speed', 'quality'],
    speed:     { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
    keyboard:  { focused: true, global: true },
    tooltips:  { controls: true, seek: true },
    captions:  { active: false },
    autoplay:  true,
    resetOnEnd: false,
    invertTime: false,
    i18n: {
      play:         'Lecture',
      pause:        'Pause',
      rewind:       'Reculer de 10s',
      fastForward:  'Avancer de 10s',
      mute:         'Muet',
      unmute:       'Son',
      volume:       'Volume',
      fullscreen:   'Plein écran',
      exitFullscreen: 'Quitter le plein écran',
      speed:        'Vitesse',
      normal:       'Normale',
      settings:     'Paramètres',
      currentTime:  'Temps actuel',
      duration:     'Durée',
    },
  });

  // Reprendre à la position sauvegardée
  if (resumeAt > 0) {
    _plyr.once('canplay', function() {
      _plyr.currentTime = resumeAt;
    });
  }

  _plyr.once('error', function() {
    showFallback(wrap, url, 'error');
  });

  /* Réattacher le bouton ✕ avec capture:true pour passer avant Plyr */
  var closeBtn = document.querySelector('.modal-close');
  if (closeBtn) {
    var newBtn = closeBtn.cloneNode(true); // clone = retire tous les anciens listeners
    closeBtn.parentNode.replaceChild(newBtn, closeBtn);
    newBtn.addEventListener('click', function(e) {
      e.stopImmediatePropagation();
      if (typeof closePlayer === 'function') closePlayer();
    }, true);
  }

  /* Sur iOS : intercepter le bouton fullscreen de Plyr
     pour utiliser le lecteur natif iOS à la place */
  if (IS_IOS) {
    _plyr.on('ready', function() {
      var fsBtn = wrap.querySelector('.plyr__control[data-plyr="fullscreen"]');
      if (fsBtn) {
        /* Remplacer le listener Plyr par notre appel webkit */
        fsBtn.addEventListener('click', function(e) {
          e.stopImmediatePropagation();
          var vid = wrap.querySelector('video');
          if (vid && vid.webkitEnterFullscreen) vid.webkitEnterFullscreen();
        }, true); /* capture: true → s'exécute avant le listener Plyr */
      }
    });
  }
}

/* ── API PUBLIQUE ── */
function playerCurrentTime() { return _plyr ? _plyr.currentTime : 0; }
function playerDuration()    { return _plyr ? _plyr.duration    : 0; }
function playerDispose()     { if (_plyr) { try { _plyr.destroy(); } catch(e) {} _plyr = null; } }

function playerTogglePlay()  { if (_plyr) _plyr.togglePlay(); }
function playerSkip(s)       { if (_plyr) _plyr.currentTime = Math.max(0, _plyr.currentTime + s); }
function playerSetVol(v)     { if (_plyr) { _plyr.volume = parseFloat(v); _plyr.muted = (v == 0); } }
function playerToggleMute()  { if (_plyr) _plyr.toggleControls(); }
function playerToggleFS() {
  if (!_plyr) return;
  if (IS_IOS) {
    /* Sur iOS : plein écran natif Apple via webkitEnterFullscreen sur la <video> de Plyr */
    var vid = document.querySelector('#player-wrap video');
    if (vid && vid.webkitEnterFullscreen) { vid.webkitEnterFullscreen(); return; }
  }
  _plyr.fullscreen.toggle();
}
function playerKeydown(e)    {}

// Stubs compatibilité
function updateProg() {}
function togglePlay() { playerTogglePlay(); }
function skip(s)      { playerSkip(s); }
function setVol(v)    { playerSetVol(v); }
function toggleMute() { if (_plyr) _plyr.muted = !_plyr.muted; }
function toggleFS()   { playerToggleFS(); }
function seekV()      {}
function setPlaying() {}
