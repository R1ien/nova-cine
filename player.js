/* ═══════════════════════════════════════════
   NovaCiné — player.js  (Plyr 3.8.4)
   ═══════════════════════════════════════════ */

var _currentVideoUrl = '';
var _plyr            = null;

var IS_IOS    = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
var IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function isEmbed(url) {
  return /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/.test(url);
}

function videoMime(url) {
  var ext = (url || '').split('?')[0].split('.').pop().toLowerCase();
  return ({mp4:'video/mp4',webm:'video/webm',ogv:'video/ogg',ogg:'video/ogg',
    m4v:'video/mp4',mov:'video/quicktime',mkv:'video/x-matroska',
    avi:'video/x-msvideo',flv:'video/x-flv'})[ext] || 'video/mp4';
}

function showFallback(wrap, url, reason) {
  var msg = {
    download: 'Ce lien force le téléchargement. Utilisez un lien mp4/webm direct.',
    type:     'Ce lien ne pointe pas vers un fichier vidéo lisible.',
    error:    'Impossible de lire cette vidéo.',
  }[reason] || 'Impossible de lire cette vidéo.';
  wrap.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'aspect-ratio:16/9;background:#000;gap:1rem;padding:2rem;text-align:center;' +
    'font-family:\'DM Sans\',sans-serif;">' +
    '<div style="font-size:2rem;">📽️</div>' +
    '<div style="color:rgba(220,232,247,.8);font-size:.86rem;line-height:1.6;max-width:340px;">' + msg + '</div>' +
    '</div>';
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

/* ════════════════════════════════════
   BUILD PLAYER — crée ou met à jour
════════════════════════════════════ */
async function buildPlayer(url, resumeAt) {
  _currentVideoUrl = url;
  resumeAt = resumeAt || 0;

  var wrap = document.getElementById('player-wrap');
  if (!wrap) return;

  /* ── EMBEDS iframe ── */
  if (isEmbed(url)) {
    // Pour les embeds : toujours détruire et recréer
    if (_plyr) { try { _plyr.destroy(); } catch(e) {} _plyr = null; }

    var id, src;
    if (/youtube\.com|youtu\.be/.test(url)) {
      id = (url.match(/(?:v=|youtu\.be\/)([^&?]+)/) || [])[1];
      src = 'https://www.youtube.com/embed/' + id + '?autoplay=1&start=' + Math.floor(resumeAt);
    } else if (/vimeo\.com/.test(url)) {
      id = (url.match(/vimeo\.com\/(\d+)/) || [])[1];
      src = 'https://player.vimeo.com/video/' + id + '?autoplay=1#t=' + Math.floor(resumeAt) + 's';
    } else if (/dailymotion\.com/.test(url)) {
      id = (url.match(/dailymotion\.com\/video\/([^_?]+)/) || [])[1];
      src = 'https://www.dailymotion.com/embed/video/' + id + '?autoplay=1&start=' + Math.floor(resumeAt);
    }
    if (src) {
      wrap.innerHTML = '<div style="aspect-ratio:16/9;background:#000;">' +
        '<iframe style="width:100%;height:100%;border:none;display:block;" src="' + src +
        '" allow="autoplay;fullscreen" allowfullscreen></iframe></div>';
    }
    return;
  }

  /* ── LIEN DIRECT ── */

  // Vérification réseau (sans toucher au DOM)
  var check = await checkVideoUrl(url);
  if (check.ok === false) {
    if (_plyr) { try { _plyr.destroy(); } catch(e) {} _plyr = null; }
    wrap.innerHTML = '';
    showFallback(wrap, url, check.reason);
    return;
  }

  /* Cas 1 : Plyr existe déjà → changer la source à chaud */
  if (_plyr) {
    _plyr.source = {
      type: 'video',
      sources: [{ src: url, type: videoMime(url) }]
    };
    if (resumeAt > 0) {
      _plyr.once('canplay', function() {
        if (_plyr) _plyr.currentTime = resumeAt;
      });
    }
    _plyr.play().catch(function(){});
    return;
  }

  /* Cas 2 : Premier chargement → créer Plyr */
  wrap.innerHTML = '';

  var video = document.createElement('video');
  video.id = 'plyr-video';
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
    controls: ['play-large','play','rewind','fast-forward','progress',
               'current-time','duration','mute','volume','settings','fullscreen'],
    settings:   ['speed'],
    speed:      { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
    keyboard:   { focused: true, global: true },
    tooltips:   { controls: true, seek: true },
    captions:   { active: false },
    autoplay:   true,
    resetOnEnd: false,
    invertTime: false,
    i18n: {
      play:'Lecture', pause:'Pause', rewind:'Reculer 10s', fastForward:'Avancer 10s',
      mute:'Muet', unmute:'Son', volume:'Volume',
      fullscreen:'Plein écran', exitFullscreen:'Quitter le plein écran',
      speed:'Vitesse', normal:'Normale', settings:'Paramètres',
      currentTime:'Temps actuel', duration:'Durée',
    },
  });

  if (resumeAt > 0) {
    _plyr.once('canplay', function() {
      if (_plyr) _plyr.currentTime = resumeAt;
    });
  }

  _plyr.once('error', function() {
    showFallback(wrap, url, 'error');
  });

  /* iOS : intercepter le bouton fullscreen pour lecteur natif */
  if (IS_IOS) {
    _plyr.on('ready', function() {
      var fsBtn = wrap.querySelector('.plyr__control[data-plyr="fullscreen"]');
      if (fsBtn) {
        fsBtn.addEventListener('click', function(e) {
          e.stopImmediatePropagation();
          var vid = wrap.querySelector('video');
          if (vid && vid.webkitEnterFullscreen) vid.webkitEnterFullscreen();
        }, true);
      }
    });
  }
}

/* ── API PUBLIQUE ── */
function playerCurrentTime() { return _plyr ? _plyr.currentTime : 0; }
function playerDuration()    { return _plyr ? _plyr.duration    : 0; }
function playerDispose() {
  if (_plyr) { try { _plyr.destroy(); } catch(e) {} _plyr = null; }
}

function playerTogglePlay() { if (_plyr) _plyr.togglePlay(); }
function playerSkip(s)      { if (_plyr) _plyr.currentTime = Math.max(0, _plyr.currentTime + s); }
function playerSetVol(v)    { if (_plyr) { _plyr.volume = parseFloat(v); _plyr.muted = (v==0); } }
function playerToggleMute() { if (_plyr) _plyr.muted = !_plyr.muted; }
function playerToggleFS() {
  var el = document.getElementById('player-wrap');
  if (!el) return;
  if (IS_IOS) { var v = el.querySelector('video'); if (v && v.webkitEnterFullscreen) { v.webkitEnterFullscreen(); return; } }
  document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen && el.requestFullscreen();
}
function playerKeydown(e) {}

// Stubs compatibilité
function updateProg() {} function togglePlay() { playerTogglePlay(); }
function skip(s)      { playerSkip(s); } function setVol(v) { playerSetVol(v); }
function toggleMute() { playerToggleMute(); } function toggleFS() { playerToggleFS(); }
function seekV()      {} function setPlaying() {}
