/* ═══════════════════════════════════════════
   NovaCiné — player.js
   Lecteur vidéo partagé :
   - Barre de progression draggable (mouse + touch)
   - Contrôles auto-masqués en plein écran
   - Détection des liens incompatibles mobile (Content-Disposition)
   - Fallback propre pour iOS/Android
   - Formatage h:mm:ss
   ═══════════════════════════════════════════ */

var vidEl = null;
var _progressDragging = false;
var _fsHideTimer = null;
var _ctrlHideTimer = null;
var _currentVideoUrl = '';

/* ══════════════════════════════
   DÉTECTION MOBILE
══════════════════════════════ */
var IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
var IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
var IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

/* ══════════════════════════════
   VÉRIFICATION DU LIEN AVANT LECTURE
   Fait un HEAD request pour voir si le serveur
   force le téléchargement (Content-Disposition: attachment)
══════════════════════════════ */
async function checkVideoUrl(url) {
  // Pas de vérification pour les embeds
  if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/.test(url)) {
    return { ok: true, type: 'embed' };
  }

  try {
    var res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined });
    var cd = res.headers.get('content-disposition') || '';
    var ct = res.headers.get('content-type') || '';

    // Forcé en téléchargement par le serveur
    if (cd.toLowerCase().includes('attachment')) {
      return { ok: false, reason: 'download', url: url };
    }
    // Pas un type vidéo (ex: text/html = page de redirection)
    if (ct && !ct.startsWith('video/') && !ct.includes('octet-stream') && !ct.includes('mp4') && !ct.includes('webm')) {
      return { ok: false, reason: 'type', contentType: ct, url: url };
    }
    return { ok: true, type: 'direct', contentType: ct };
  } catch(e) {
    // CORS ou réseau — on tente quand même mais on avertit sur mobile
    return { ok: null, reason: 'cors', url: url };
  }
}

/* ══════════════════════════════
   BUILD PLAYER
══════════════════════════════ */
function videoType(url) {
  var e = url.split('.').pop().split('?')[0].toLowerCase();
  return ({ mp4:'video/mp4', mkv:'video/x-matroska', mov:'video/quicktime',
    avi:'video/x-msvideo', webm:'video/webm', ogv:'video/ogg',
    m4v:'video/mp4', flv:'video/x-flv' })[e] || 'video/mp4';
}

async function buildPlayer(url, resumeAt) {
  var wrap = document.getElementById('player-wrap');
  _currentVideoUrl = url;
  wrap.innerHTML = ''; vidEl = null;
  resumeAt = resumeAt || 0;

  /* ── EMBEDS ── */
  if (/youtube\.com|youtu\.be/.test(url)) {
    var id = (url.match(/(?:v=|youtu\.be\/)([^&?]+)/) || [])[1];
    if (id) wrap.innerHTML = '<iframe src="https://www.youtube.com/embed/'+id+'?autoplay=1&start='+Math.floor(resumeAt)+'" allow="autoplay;fullscreen" allowfullscreen></iframe>';
    return;
  }
  if (/vimeo\.com/.test(url)) {
    var id = (url.match(/vimeo\.com\/(\d+)/) || [])[1];
    if (id) wrap.innerHTML = '<iframe src="https://player.vimeo.com/video/'+id+'?autoplay=1#t='+Math.floor(resumeAt)+'s" allow="autoplay;fullscreen" allowfullscreen></iframe>';
    return;
  }
  if (/dailymotion\.com/.test(url)) {
    var id = (url.match(/dailymotion\.com\/video\/([^_?]+)/) || [])[1];
    if (id) wrap.innerHTML = '<iframe src="https://www.dailymotion.com/embed/video/'+id+'?autoplay=1&start='+Math.floor(resumeAt)+'" allow="autoplay;fullscreen" allowfullscreen></iframe>';
    return;
  }

  /* ── VÉRIFICATION DU LIEN (surtout utile sur mobile) ── */
  showLoadingState(wrap, url);

  var check = await checkVideoUrl(url);

  /* Lien force le téléchargement → afficher fallback */
  if (check.ok === false) {
    showVideoFallback(wrap, url, check.reason, check.contentType);
    return;
  }

  /* Sur iOS Safari : si CORS bloqué ou type inconnu, avertir en avance */
  if (IS_IOS && check.ok === null) {
    buildNativePlayer(wrap, url, resumeAt, true);
    return;
  }

  buildNativePlayer(wrap, url, resumeAt, false);
}

/* ── LOADING STATE ── */
function showLoadingState(wrap, url) {
  wrap.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:1rem;color:rgba(220,232,247,.7);font-family:\'DM Sans\',sans-serif;">'
    + '<div style="width:36px;height:36px;border:3px solid rgba(255,255,255,.15);border-top-color:#e8a020;border-radius:50%;animation:spin .8s linear infinite;"></div>'
    + '<span style="font-size:.85rem;">Vérification du lien…</span>'
    + '</div>'
    + '<style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
}

/* ── FALLBACK quand le lien n'est pas lisible directement ── */
function showVideoFallback(wrap, url, reason, contentType) {
  var msg = reason === 'download'
    ? 'Ce lien force le téléchargement et ne peut pas être lu directement.'
    : 'Ce lien ne semble pas pointer vers un fichier vidéo lisible.';

  if (IS_MOBILE) {
    msg = reason === 'download'
      ? 'Ce lien force le téléchargement.\nSur mobile, utilisez un lien de streaming direct (mp4, webm…) ou un hébergeur comme YouTube, Vimeo ou Dailymotion.'
      : 'Format non supporté sur mobile.';
  }

  wrap.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:1.2rem;padding:1.5rem;text-align:center;font-family:\'DM Sans\',sans-serif;">'
    + '<div style="font-size:2.5rem;">⚠️</div>'
    + '<div style="color:rgba(220,232,247,.9);font-size:.88rem;line-height:1.6;max-width:380px;">' + msg.replace(/\n/g, '<br>') + '</div>'
    + (IS_MOBILE
      ? '<a href="'+url+'" style="background:#e8a020;color:#000;font-weight:700;padding:.7rem 1.4rem;border-radius:8px;text-decoration:none;font-size:.9rem;display:inline-block;">Ouvrir dans le navigateur</a>'
      : '')
    + '<div style="color:rgba(220,232,247,.4);font-size:.72rem;word-break:break-all;max-width:340px;">'+url+'</div>'
    + '</div>';
}

/* ── AVERTISSEMENT iOS CORS ── */
function showIosWarning(wrap) {
  var banner = document.createElement('div');
  banner.style.cssText = 'position:absolute;top:0;left:0;right:0;background:rgba(232,160,32,.15);border-bottom:1px solid rgba(232,160,32,.3);padding:.5rem 1rem;display:flex;align-items:center;justify-content:space-between;gap:.8rem;z-index:5;font-family:\'DM Sans\',sans-serif;';
  banner.innerHTML =
    '<span style="font-size:.75rem;color:rgba(220,232,247,.85);line-height:1.4;">Si la vidéo ne charge pas, le lien n\'est peut-être pas compatible mobile.</span>'
    + '<a href="'+_currentVideoUrl+'" style="flex-shrink:0;background:#e8a020;color:#000;font-weight:700;padding:.35rem .8rem;border-radius:6px;text-decoration:none;font-size:.75rem;white-space:nowrap;">Ouvrir ↗</a>';
  wrap.style.position = 'relative';
  wrap.insertBefore(banner, wrap.firstChild);
  // Auto-dismiss après 6s si la vidéo charge
  setTimeout(function() {
    if (vidEl && vidEl.readyState >= 2) banner.remove();
  }, 6000);
}

/* ── LECTEUR NATIF ── */
function buildNativePlayer(wrap, url, resumeAt, showIosHint) {
  wrap.innerHTML =
    '<video id="vid" preload="none" playsinline controls="false">'
      + '<source src="'+url+'" type="'+videoType(url)+'">'
    + '</video>'
    + '<div class="vctrls" id="vctrls">'
      + '<div class="pbar" id="pbar">'
        + '<div class="pbar-track" id="pbar-track">'
          + '<div class="pfill" id="pfill" style="width:0%"></div>'
          + '<div class="pthumb" id="pthumb"></div>'
        + '</div>'
      + '</div>'
      + '<div class="crow">'
        + '<button class="cbtn" id="play-btn" onclick="playerTogglePlay()" title="Lecture/Pause">'
            + '<svg id="play-ico" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M10.804 8 5 4.633v6.734L10.804 8zm.792-.696a.802.802 0 0 1 0 1.392l-6.363 3.692C4.713 12.69 4 12.345 4 11.692V4.308c0-.653.713-.998 1.233-.696l6.363 3.692z"/></svg>'
          + '</button>'
        + '<button class="cbtn" onclick="playerSkip(-10)" title="-10s">'
            + '<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 3.5A.5.5 0 0 1 1 4v3.248l6.267-3.636c.52-.302 1.233.043 1.233.696v2.94l6.267-3.636c.52-.302 1.233.043 1.233.696v7.384c0 .653-.713.998-1.233.696L8.5 8.752v2.94c0 .653-.713.998-1.233.696L1 8.752V12a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5z"/></svg>'
          + '</button>'
        + '<button class="cbtn" onclick="playerSkip(10)" title="+10s">'
            + '<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M15.5 3.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V8.752l-6.267 3.636c-.52.302-1.233-.043-1.233-.696v-2.94l-6.267 3.636C.713 12.69 0 12.345 0 11.692V4.308c0-.653.713-.998 1.233-.696L7.5 7.248V4.308c0-.653.713-.998 1.233-.696L15 7.248V4a.5.5 0 0 1 .5-.5z"/></svg>'
          + '</button>'
        + '<input type="range" class="vslider" id="vslider" min="0" max="1" step="0.05" value="1" oninput="playerSetVol(this.value)">'
        + '<span class="tdisp" id="tdisp">0:00 / 0:00</span>'
        + '<div class="cr">'
          + '<button class="cbtn" id="mute-btn" onclick="playerToggleMute()" title="Muet">'
              + '<svg id="vol-ico" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M11.536 14.01A8.473 8.473 0 0 0 14.026 8a8.473 8.473 0 0 0-2.49-6.01l-.708.707A7.476 7.476 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707zm-1.414-1.414A6.491 6.491 0 0 0 12.025 8a6.491 6.491 0 0 0-1.903-4.596l-.707.707A5.494 5.494 0 0 1 11.025 8a5.494 5.494 0 0 1-1.61 3.889l.707.707zM8 3.5a.5.5 0 0 0-.812-.39L3.825 6H1.5A.5.5 0 0 0 1 6.5v3a.5.5 0 0 0 .5.5h2.325l3.363 2.89A.5.5 0 0 0 8 12.5v-9z"/></svg>'
            + '</button>'
          + '<button class="cbtn" onclick="playerToggleFS()" title="Plein écran">'
              + '<svg id="fs-ico" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M1.5 1h4a.5.5 0 0 1 0 1h-4v4a.5.5 0 0 1-1 0v-4A.5.5 0 0 1 1 1h.5zm0 13h4a.5.5 0 0 1 0 1H1a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 1 0v4zm13 0h-4a.5.5 0 0 1 0-1h4v-4a.5.5 0 0 1 1 0v4a.5.5 0 0 1-.5.5H14.5zm0-13h-4a.5.5 0 0 1 0-1H15a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0v-4z"/></svg>'
            + '</button>'
        + '</div>'
      + '</div>'
    + '</div>';

  vidEl = document.getElementById('vid');

  /* Détecter erreur de chargement (lien mort, CORS, format…) */
  vidEl.addEventListener('error', function(e) {
    var wrap2 = document.getElementById('player-wrap');
    if (wrap2) {
      var msg = IS_MOBILE
        ? 'Impossible de lire cette vidéo sur mobile.\nLe lien doit être un fichier mp4/webm accessible directement (sans redirection ni téléchargement forcé).\nYouTube, Vimeo et Dailymotion sont toujours compatibles.'
        : 'Impossible de lire ce fichier vidéo.\nVérifiez que le lien est direct et accessible.';
      showVideoFallback(wrap2, _currentVideoUrl, 'error');
    }
  });

  /* Stalled / timeout : avertir sur mobile après 8s sans données */
  var _stallTimer = null;
  if (IS_MOBILE) {
    _stallTimer = setTimeout(function() {
      if (vidEl && vidEl.readyState < 2) {
        showIosWarning(wrap);
      }
    }, 8000);
    vidEl.addEventListener('canplay', function() { clearTimeout(_stallTimer); });
    vidEl.addEventListener('playing', function() { clearTimeout(_stallTimer); });
  }

  /* events */
  vidEl.addEventListener('timeupdate', playerUpdateProg);
  vidEl.addEventListener('loadedmetadata', function() {
    playerUpdateProg();
    if (resumeAt > 0) vidEl.currentTime = resumeAt;
  });
  vidEl.addEventListener('play',  function() { setPlayIcon(false); });
  vidEl.addEventListener('pause', function() { setPlayIcon(true); });
  vidEl.addEventListener('ended', function() { setPlayIcon(true); });

  /* Affiche le banner iOS si CORS incertain */
  if (showIosHint) {
    setTimeout(function() { showIosWarning(wrap); }, 500);
  }

  /* Draggable progress */
  initProgressBar();

  /* Tap sur la vidéo → toggle contrôles */
  wrap.addEventListener('click', function(e) {
    if (e.target.closest('.cbtn, .pbar, .vslider')) return;
    if (IS_MOBILE) playerTogglePlay();
    showCtrlsTemporarily();
  });

  /* Fullscreen auto-hide */
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  vidEl.play().catch(function() {
    /* Autoplay bloqué (politique navigateur) → pause icon */
    setPlayIcon(true);
  });
}

/* ══════════════════════════════
   BARRE DE PROGRESSION DRAGGABLE
══════════════════════════════ */
function initProgressBar() {
  var pbar = document.getElementById('pbar');
  if (!pbar) return;

  function getPct(clientX) {
    var r = pbar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  }
  function applySeek(pct) {
    if (!vidEl || isNaN(vidEl.duration)) return;
    var t = pct * vidEl.duration;
    vidEl.currentTime = t;
    updateFillPct(pct * 100);
    var td = document.getElementById('tdisp');
    if (td) td.textContent = fmt(t) + ' / ' + fmt(vidEl.duration);
  }

  /* MOUSE */
  pbar.addEventListener('mousedown', function(e) {
    e.preventDefault();
    _progressDragging = true;
    pbar.classList.add('dragging');
    applySeek(getPct(e.clientX));
    function onMove(ev) { if (_progressDragging) applySeek(getPct(ev.clientX)); }
    function onUp() {
      _progressDragging = false;
      pbar.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  /* TOUCH */
  pbar.addEventListener('touchstart', function(e) {
    e.preventDefault();
    _progressDragging = true;
    pbar.classList.add('dragging');
    applySeek(getPct(e.touches[0].clientX));
    function onMove(ev) {
      ev.preventDefault();
      if (_progressDragging) applySeek(getPct(ev.touches[0].clientX));
    }
    function onEnd() {
      _progressDragging = false;
      pbar.classList.remove('dragging');
      pbar.removeEventListener('touchmove', onMove);
      pbar.removeEventListener('touchend', onEnd);
      pbar.removeEventListener('touchcancel', onEnd);
    }
    pbar.addEventListener('touchmove', onMove, { passive: false });
    pbar.addEventListener('touchend', onEnd);
    pbar.addEventListener('touchcancel', onEnd);
  }, { passive: false });
}

function updateFillPct(pct) {
  var fill = document.getElementById('pfill');
  var thumb = document.getElementById('pthumb');
  if (fill) fill.style.width = pct + '%';
  if (thumb) thumb.style.left = pct + '%';
}

function playerUpdateProg() {
  if (!vidEl || isNaN(vidEl.duration) || _progressDragging) return;
  var pct = (vidEl.currentTime / vidEl.duration) * 100;
  updateFillPct(pct);
  var td = document.getElementById('tdisp');
  if (td) td.textContent = fmt(vidEl.currentTime) + ' / ' + fmt(vidEl.duration);
}

/* ══════════════════════════════
   ICÔNES
══════════════════════════════ */
var PLAY_PATH  = 'M10.804 8 5 4.633v6.734L10.804 8zm.792-.696a.802.802 0 0 1 0 1.392l-6.363 3.692C4.713 12.69 4 12.345 4 11.692V4.308c0-.653.713-.998 1.233-.696l6.363 3.692z';
var PAUSE_PATH = 'M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z';
var VOL_PATH   = 'M11.536 14.01A8.473 8.473 0 0 0 14.026 8a8.473 8.473 0 0 0-2.49-6.01l-.708.707A7.476 7.476 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707zm-1.414-1.414A6.491 6.491 0 0 0 12.025 8a6.491 6.491 0 0 0-1.903-4.596l-.707.707A5.494 5.494 0 0 1 11.025 8a5.494 5.494 0 0 1-1.61 3.889l.707.707zM8 3.5a.5.5 0 0 0-.812-.39L3.825 6H1.5A.5.5 0 0 0 1 6.5v3a.5.5 0 0 0 .5.5h2.325l3.363 2.89A.5.5 0 0 0 8 12.5v-9z';
var MUTE_PATH  = 'M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06zm7.137 2.096a.5.5 0 0 1 0 .708L12.207 8l1.647 1.646a.5.5 0 0 1-.708.708L11.5 8.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 8 9.146 6.354a.5.5 0 1 1 .708-.708L11.5 7.293l1.646-1.647a.5.5 0 0 1 .708 0z';
var FS_IN      = 'M1.5 1h4a.5.5 0 0 1 0 1h-4v4a.5.5 0 0 1-1 0v-4A.5.5 0 0 1 1 1h.5zm0 13h4a.5.5 0 0 1 0 1H1a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 1 0v4zm13 0h-4a.5.5 0 0 1 0-1h4v-4a.5.5 0 0 1 1 0v4a.5.5 0 0 1-.5.5H14.5zm0-13h-4a.5.5 0 0 1 0-1H15a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0v-4z';
var FS_OUT     = 'M5.5 0a.5.5 0 0 1 .5.5v4A1.5 1.5 0 0 1 4.5 6h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5zm5 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 10 4.5v-4a.5.5 0 0 1 .5-.5zM0 10.5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 6 11.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zm10 1a1.5 1.5 0 0 1 1.5-1.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4z';

function setPlayIcon(paused) {
  var el = document.getElementById('play-ico');
  if (el) el.querySelector('path').setAttribute('d', paused ? PLAY_PATH : PAUSE_PATH);
}
function setVolIcon(muted) {
  var el = document.getElementById('vol-ico');
  if (el) el.querySelector('path').setAttribute('d', muted ? MUTE_PATH : VOL_PATH);
}
function setFsIcon(inFs) {
  var el = document.getElementById('fs-ico');
  if (el) el.querySelector('path').setAttribute('d', inFs ? FS_OUT : FS_IN);
}

/* ══════════════════════════════
   CONTRÔLES
══════════════════════════════ */
function playerTogglePlay() {
  if (!vidEl) return;
  vidEl.paused ? vidEl.play().catch(function(){}) : vidEl.pause();
}
function playerSkip(s)      { if (vidEl) vidEl.currentTime = Math.max(0, vidEl.currentTime + s); }
function playerSetVol(v)    {
  if (!vidEl) return;
  v = parseFloat(v);
  vidEl.volume = v; vidEl.muted = (v === 0);
  setVolIcon(v === 0);
}
function playerToggleMute() {
  if (!vidEl) return;
  vidEl.muted = !vidEl.muted;
  setVolIcon(vidEl.muted);
  var sl = document.getElementById('vslider');
  if (sl) sl.value = vidEl.muted ? 0 : vidEl.volume;
}
function playerToggleFS() {
  var w = document.getElementById('player-wrap');
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    /* iOS Safari : utiliser le fullscreen natif de la vidéo */
    if (IS_IOS && vidEl && vidEl.webkitEnterFullscreen) {
      vidEl.webkitEnterFullscreen(); return;
    }
    if (w.requestFullscreen) w.requestFullscreen();
    else if (w.webkitRequestFullscreen) w.webkitRequestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }
}

/* ══════════════════════════════
   PLEIN ÉCRAN — auto-hide contrôles
══════════════════════════════ */
function onFsChange() {
  var inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  setFsIcon(inFs);
  var wrap = document.getElementById('player-wrap');
  if (!wrap) return;
  if (inFs) {
    wrap.addEventListener('mousemove', onFsMouseMove);
    wrap.addEventListener('touchstart', onFsMouseMove);
    scheduleHideCtrl(wrap);
  } else {
    wrap.removeEventListener('mousemove', onFsMouseMove);
    wrap.removeEventListener('touchstart', onFsMouseMove);
    clearTimeout(_fsHideTimer);
    wrap.classList.remove('fs-idle');
    wrap.style.cursor = '';
  }
}
function onFsMouseMove() {
  var wrap = document.getElementById('player-wrap');
  if (!wrap) return;
  wrap.classList.remove('fs-idle');
  wrap.style.cursor = '';
  clearTimeout(_fsHideTimer);
  scheduleHideCtrl(wrap);
}
function scheduleHideCtrl(wrap) {
  _fsHideTimer = setTimeout(function() {
    wrap.classList.add('fs-idle');
    wrap.style.cursor = 'none';
  }, 3000);
}

function showCtrlsTemporarily() {
  var wrap = document.getElementById('player-wrap');
  if (!wrap) return;
  var inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  if (inFs) { onFsMouseMove(); return; }
  wrap.classList.toggle('show-ctrl');
  clearTimeout(_ctrlHideTimer);
  if (wrap.classList.contains('show-ctrl')) {
    _ctrlHideTimer = setTimeout(function() { wrap.classList.remove('show-ctrl'); }, 3000);
  }
}

/* ══════════════════════════════
   RACCOURCIS CLAVIER
══════════════════════════════ */
function playerKeydown(e) {
  var tag = document.activeElement ? document.activeElement.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.key === ' ')          { e.preventDefault(); playerTogglePlay(); }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); playerSkip(-10); }
  if (e.key === 'ArrowRight') { e.preventDefault(); playerSkip(10); }
  if (e.key === 'ArrowUp')    { e.preventDefault(); playerSetVol(Math.min(1, (vidEl ? vidEl.volume : 1) + 0.1)); }
  if (e.key === 'ArrowDown')  { e.preventDefault(); playerSetVol(Math.max(0, (vidEl ? vidEl.volume : 1) - 0.1)); }
  if (e.key === 'f' || e.key === 'F') playerToggleFS();
  if (e.key === 'm' || e.key === 'M') playerToggleMute();
}
