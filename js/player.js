/* ═══════════════════════════════════════════
   NovaCiné — player.js  (Video.js v8)
   ─ Détection format incompatible mobile
   ─ MKV/AVI/MOV : message d'erreur ciblé
   ─ HLS (.m3u8) : hls.js via VHS intégré
   ─ MP4/WebM : lecture native
   ─ YouTube/Vimeo/Dailymotion : iframe
   ═══════════════════════════════════════════ */

var _vjsPlayer    = null;
var _currentUrl   = '';
var IS_IOS        = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
var IS_MOBILE     = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/* Formats incompatibles avec les navigateurs mobiles */
var MOBILE_UNSUPPORTED = ['mkv', 'avi', 'flv', 'wmv', 'ts'];
/* Formats que iOS Safari ne supporte pas mais Chrome/Firefox Android si */
var IOS_UNSUPPORTED    = ['mkv', 'avi', 'flv', 'wmv', 'webm', 'ogv'];

/* ═══════════════════════════════════════════
   DÉTECTION FORMAT
═══════════════════════════════════════════ */
function getExt(url) {
  return url.split('?')[0].split('#')[0].split('.').pop().toLowerCase();
}

function isEmbed(url) {
  return /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/.test(url);
}

function isHLS(url) {
  var ext = getExt(url);
  return ext === 'm3u8' || /\.m3u8(\?|$)/.test(url);
}

function videoMime(url) {
  var map = {
    mp4:'video/mp4', m4v:'video/mp4', mov:'video/quicktime',
    webm:'video/webm', ogv:'video/ogg', ogg:'video/ogg',
    mkv:'video/x-matroska', avi:'video/x-msvideo',
    flv:'video/x-flv', wmv:'video/x-ms-wmv',
    m3u8:'application/x-mpegURL'
  };
  return map[getExt(url)] || 'video/mp4';
}

/* Vérifie si le format est lisible sur l'appareil actuel */
function checkFormatSupport(url) {
  if (isEmbed(url) || isHLS(url)) return { ok: true };
  var ext = getExt(url);

  if (IS_IOS && IOS_UNSUPPORTED.indexOf(ext) >= 0) {
    return { ok: false, ext: ext, device: 'ios' };
  }
  if (IS_MOBILE && MOBILE_UNSUPPORTED.indexOf(ext) >= 0) {
    return { ok: false, ext: ext, device: 'android' };
  }
  return { ok: true };
}

/* ═══════════════════════════════════════════
   VÉRIFICATION RÉSEAU (Content-Disposition)
═══════════════════════════════════════════ */
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
    if (ct && !ct.startsWith('video/') && !ct.startsWith('application/') &&
        !ct.includes('octet-stream') && !ct.includes('mp4') && !ct.includes('webm') && !ct.includes('mpegurl'))
      return { ok: false, reason: 'type' };
    return { ok: true };
  } catch(e) {
    return { ok: null }; // CORS ou réseau — on tente quand même
  }
}

/* ═══════════════════════════════════════════
   AFFICHAGE ERREURS
═══════════════════════════════════════════ */
function showError(wrap, url, type, ext) {
  var icon, title, body;

  if (type === 'format_mobile') {
    icon = '📱';
    title = 'Format non supporté sur mobile';
    var extUp = (ext || 'MKV').toUpperCase();
    body = 'Les fichiers <strong>' + extUp + '</strong> ne peuvent pas être lus directement sur '
         + (IS_IOS ? 'iOS Safari' : 'Chrome Android') + '.<br><br>'
         + 'Pour regarder ce contenu sur mobile, <strong>convertissez le fichier en MP4</strong> '
         + 'ou hébergez-le sur <strong>YouTube, Vimeo ou Dailymotion</strong> qui se chargent de la conversion automatiquement.';
  } else if (type === 'download') {
    icon = '⬇️';
    title = 'Lien de téléchargement';
    body = 'Ce lien force le téléchargement du fichier au lieu de le diffuser.<br><br>'
         + 'Utilisez un lien de streaming direct (<code>mp4</code>, <code>webm</code>) '
         + 'ou hébergez la vidéo sur YouTube, Vimeo ou Dailymotion.';
  } else {
    icon = '⚠️';
    title = 'Impossible de lire cette vidéo';
    body = 'Le fichier est peut-être inaccessible, dans un format non supporté, '
         + 'ou le serveur bloque la lecture directe.<br><br>'
         + 'Formats recommandés : <strong>MP4 (H.264), WebM, M3U8 (HLS)</strong>, ou un lien YouTube/Vimeo.';
  }

  wrap.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:160px;gap:1rem;padding:1.8rem;text-align:center;font-family:\'DM Sans\',sans-serif;background:#000;">'
    + '<div style="font-size:2.5rem;line-height:1;">' + icon + '</div>'
    + '<div style="color:#dce8f7;font-size:.95rem;font-weight:600;">' + title + '</div>'
    + '<div style="color:rgba(220,232,247,.65);font-size:.82rem;line-height:1.7;max-width:380px;">' + body + '</div>'
    + '<div style="color:rgba(220,232,247,.25);font-size:.68rem;word-break:break-all;max-width:340px;margin-top:.3rem;">' + url + '</div>'
    + '</div>';
}

/* ═══════════════════════════════════════════
   SPINNER
═══════════════════════════════════════════ */
function showSpinner(wrap) {
  wrap.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:160px;background:#000;">'
    + '<div style="width:38px;height:38px;border:3px solid rgba(255,255,255,.08);border-top-color:#e8a020;border-radius:50%;animation:ncSpin .8s linear infinite;"></div>'
    + '</div>'
    + '<style>@keyframes ncSpin{to{transform:rotate(360deg)}}</style>';
}

/* ═══════════════════════════════════════════
   BUILD PLAYER
═══════════════════════════════════════════ */
async function buildPlayer(url, resumeAt) {
  _currentUrl = url;
  resumeAt    = resumeAt || 0;
  var wrap    = document.getElementById('player-wrap');
  if (!wrap) return;

  /* Détruire l'instance précédente */
  if (_vjsPlayer) {
    try { _vjsPlayer.dispose(); } catch(e) {}
    _vjsPlayer = null;
  }
  wrap.innerHTML = '';

  /* ─── EMBEDS ─── */
  if (/youtube\.com|youtu\.be/.test(url)) {
    var id = (url.match(/(?:v=|youtu\.be\/)([^&?]+)/) || [])[1];
    if (id) wrap.innerHTML = '<iframe style="width:100%;height:100%;border:none;display:block;" src="https://www.youtube.com/embed/'+id+'?autoplay=1&start='+Math.floor(resumeAt)+'" allow="autoplay;fullscreen" allowfullscreen></iframe>';
    return;
  }
  if (/vimeo\.com/.test(url)) {
    var id = (url.match(/vimeo\.com\/(\d+)/) || [])[1];
    if (id) wrap.innerHTML = '<iframe style="width:100%;height:100%;border:none;display:block;" src="https://player.vimeo.com/video/'+id+'?autoplay=1#t='+Math.floor(resumeAt)+'s" allow="autoplay;fullscreen" allowfullscreen></iframe>';
    return;
  }
  if (/dailymotion\.com/.test(url)) {
    var id = (url.match(/dailymotion\.com\/video\/([^_?]+)/) || [])[1];
    if (id) wrap.innerHTML = '<iframe style="width:100%;height:100%;border:none;display:block;" src="https://www.dailymotion.com/embed/video/'+id+'?autoplay=1&start='+Math.floor(resumeAt)+'" allow="autoplay;fullscreen" allowfullscreen></iframe>';
    return;
  }

  /* ─── VÉRIFICATION FORMAT MOBILE (avant tout chargement réseau) ─── */
  var fmtCheck = checkFormatSupport(url);
  if (!fmtCheck.ok) {
    showError(wrap, url, 'format_mobile', fmtCheck.ext);
    return;
  }

  /* ─── VÉRIFICATION RÉSEAU ─── */
  showSpinner(wrap);
  var netCheck = await checkVideoUrl(url);
  if (netCheck.ok === false) {
    showError(wrap, url, netCheck.reason);
    return;
  }

  /* ─── VIDEO.JS ─── */
  wrap.innerHTML = '';
  if (typeof videojs === 'undefined') {
    showError(wrap, url, 'error');
    return;
  }

  var videoEl = document.createElement('video');
  videoEl.id        = 'vjs-main';
  videoEl.className = 'video-js vjs-novacine';
  videoEl.setAttribute('playsinline', '');
  videoEl.setAttribute('preload', 'none');
  wrap.appendChild(videoEl);

  _vjsPlayer = videojs('vjs-main', {
    fluid: true,
    responsive: true,
    aspectRatio: '16:9',
    autoplay: true,
    controls: true,
    preload: 'none',
    playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
    children: ['mediaLoader','posterImage','loadingSpinner','bigPlayButton','liveTracker','controlBar','errorDisplay','resizeManager'],
    controlBar: {
      children: ['playToggle','skipBackward','skipForward','volumePanel','currentTimeDisplay','timeDivider','durationDisplay','progressControl','customControlSpacer','playbackRateMenuButton','fullscreenToggle']
    },
    html5: {
      vhs: { overrideNative: !IS_IOS },
      nativeVideoTracks: IS_IOS,
      nativeAudioTracks: IS_IOS,
      nativeTextTracks:  IS_IOS
    },
    sources: [{ src: url, type: videoMime(url) }],
    userActions: {
      hotkeys: function(e) {
        if (e.which === 32) { this.paused() ? this.play() : this.pause(); e.preventDefault(); }
        if (e.which === 37) { this.currentTime(Math.max(0, this.currentTime() - 10)); }
        if (e.which === 39) { this.currentTime(this.currentTime() + 10); }
        if (e.which === 38) { this.volume(Math.min(1, this.volume() + 0.1)); }
        if (e.which === 40) { this.volume(Math.max(0, this.volume() - 0.1)); }
        if (e.which === 70)  { this.isFullscreen() ? this.exitFullscreen() : this.requestFullscreen(); }
        if (e.which === 77)  { this.muted(!this.muted()); }
      }
    }
  });

  /* Reprise */
  if (resumeAt > 0) {
    _vjsPlayer.one('loadedmetadata', function() { _vjsPlayer.currentTime(resumeAt); });
  }

  /* Erreur Video.js → afficher message propre */
  _vjsPlayer.on('error', function() {
    var err = _vjsPlayer ? _vjsPlayer.error() : null;
    var ext = getExt(url);
    /* Si c'est un format potentiellement problématique, message ciblé */
    if (IS_MOBILE && ['mkv','avi','flv','wmv'].indexOf(ext) >= 0) {
      showError(wrap, url, 'format_mobile', ext);
    } else {
      showError(wrap, url, 'error');
    }
  });

  /* iOS : stall détecté après 8s → message doux */
  if (IS_IOS) {
    var stallTimer = setTimeout(function() {
      if (_vjsPlayer && _vjsPlayer.readyState() < 2) {
        var banner = document.createElement('div');
        banner.style.cssText = 'position:absolute;top:0;left:0;right:0;background:rgba(232,160,32,.12);border-bottom:1px solid rgba(232,160,32,.2);padding:.6rem 1rem;font-family:\'DM Sans\',sans-serif;font-size:.75rem;color:rgba(220,232,247,.85);line-height:1.5;z-index:10;text-align:center;';
        banner.textContent = 'La vidéo ne démarre pas ? iOS ne supporte que les fichiers MP4 (H.264) et les liens HLS/YouTube/Vimeo.';
        wrap.style.position = 'relative';
        wrap.insertBefore(banner, wrap.firstChild);
        _vjsPlayer.one('playing', function() { banner.remove(); });
      }
    }, 8000);
    _vjsPlayer.one('playing', function() { clearTimeout(stallTimer); });
  }
}

/* ═══════════════════════════════════════════
   API PROGRESSION
═══════════════════════════════════════════ */
function playerCurrentTime() { return _vjsPlayer ? _vjsPlayer.currentTime() : 0; }
function playerDuration()    { return _vjsPlayer ? _vjsPlayer.duration()    : 0; }
function playerDispose() {
  if (_vjsPlayer) { try { _vjsPlayer.dispose(); } catch(e) {} _vjsPlayer = null; }
}

/* Raccourcis clavier — géré via userActions.hotkeys dans VJS */
function playerKeydown(e) {}
