/* ═══════════════════════════════════════════
   NovaCiné — player.js  (Video.js)
   Lecteur HTML5 Video.js personnalisé aux
   couleurs du site. Supporte mp4/webm/mkv/mov
   + YouTube/Vimeo/Dailymotion en iframe.
   ═══════════════════════════════════════════ */

var _vjsPlayer = null;
var _currentVideoUrl = '';
var IS_IOS    = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
var IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/* ── Vérification du lien (Content-Disposition) ── */
async function checkVideoUrl(url) {
  if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/.test(url)) return { ok: true };
  try {
    var ctl = new AbortController();
    var tid = setTimeout(function(){ ctl.abort(); }, 5000);
    var res = await fetch(url, { method: 'HEAD', signal: ctl.signal });
    clearTimeout(tid);
    var cd = res.headers.get('content-disposition') || '';
    var ct = res.headers.get('content-type') || '';
    if (cd.toLowerCase().includes('attachment')) return { ok: false, reason: 'download' };
    if (ct && !ct.startsWith('video/') && !ct.includes('octet-stream') && !ct.includes('mp4') && !ct.includes('webm'))
      return { ok: false, reason: 'type' };
    return { ok: true };
  } catch(e) {
    return { ok: null }; // CORS / réseau — on tente quand même
  }
}

/* ── Affichage d'erreur propre ── */
function showVideoError(wrap, url, reason) {
  var msg = {
    download: 'Ce lien force le téléchargement et ne peut pas être lu dans le navigateur.<br>Utilisez un lien mp4/webm direct, ou hébergez sur YouTube, Vimeo ou Dailymotion.',
    type:     'Ce lien ne pointe pas vers un fichier vidéo lisible.',
    error:    'Impossible de lire cette vidéo. Le fichier est peut-être inaccessible ou dans un format non supporté.',
  }[reason] || 'Impossible de lire cette vidéo.';

  wrap.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:1.2rem;padding:2rem;text-align:center;font-family:\'DM Sans\',sans-serif;background:#000;">'
    + '<div style="font-size:2.8rem;">📽️</div>'
    + '<div style="color:rgba(220,232,247,.85);font-size:.88rem;line-height:1.65;max-width:360px;">' + msg + '</div>'
    + '<div style="color:rgba(220,232,247,.3);font-size:.7rem;word-break:break-all;max-width:320px;">' + url + '</div>'
    + '</div>';
}

/* ── Type MIME ── */
function videoType(url) {
  var e = url.split('.').pop().split('?')[0].toLowerCase();
  return ({ mp4:'video/mp4', webm:'video/webm', ogv:'video/ogg',
    mkv:'video/x-matroska', mov:'video/quicktime',
    avi:'video/x-msvideo', m4v:'video/mp4', flv:'video/x-flv' })[e] || 'video/mp4';
}

/* ══════════════════════════════
   BUILD PLAYER principal
══════════════════════════════ */
async function buildPlayer(url, resumeAt) {
  _currentVideoUrl = url;
  resumeAt = resumeAt || 0;
  var wrap = document.getElementById('player-wrap');
  if (!wrap) return;

  /* Détruire l'instance précédente */
  if (_vjsPlayer) {
    try { _vjsPlayer.dispose(); } catch(e) {}
    _vjsPlayer = null;
  }
  wrap.innerHTML = '';

  /* ── EMBEDS (YouTube / Vimeo / Dailymotion) ── */
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

  /* ── VÉRIFICATION DU LIEN ── */
  wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#000;"><div style="width:36px;height:36px;border:3px solid rgba(255,255,255,.1);border-top-color:#e8a020;border-radius:50%;animation:vjsSpin .8s linear infinite;"></div></div><style>@keyframes vjsSpin{to{transform:rotate(360deg)}}</style>';

  var check = await checkVideoUrl(url);
  if (check.ok === false) {
    showVideoError(wrap, url, check.reason);
    return;
  }

  /* ── VIDEO.JS ── */
  wrap.innerHTML = '';

  /* Créer l'élément <video> */
  var videoEl = document.createElement('video');
  videoEl.id = 'vjs-main';
  videoEl.className = 'video-js vjs-novacine';
  videoEl.setAttribute('playsinline', '');
  videoEl.setAttribute('preload', 'none');
  wrap.appendChild(videoEl);

  /* Attendre que Video.js soit chargé */
  if (typeof videojs === 'undefined') {
    wrap.innerHTML = '<div style="color:rgba(220,232,247,.5);display:flex;align-items:center;justify-content:center;height:100%;font-size:.85rem;font-family:\'DM Sans\',sans-serif;">Chargement du lecteur…</div>';
    return;
  }

  _vjsPlayer = videojs('vjs-main', {
    fluid: true,
    responsive: true,
    aspectRatio: '16:9',
    autoplay: true,
    muted: false,
    controls: true,
    preload: 'none',
    playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
    html5: {
      vhs: { overrideNative: !IS_IOS },
      nativeVideoTracks: IS_IOS,
      nativeAudioTracks: IS_IOS,
      nativeTextTracks: IS_IOS
    },
    sources: [{ src: url, type: videoType(url) }],
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

  /* Reprendre là où on s'était arrêté */
  if (resumeAt > 0) {
    _vjsPlayer.one('loadedmetadata', function() {
      _vjsPlayer.currentTime(resumeAt);
    });
  }

  /* Erreur de lecture */
  _vjsPlayer.on('error', function() {
    var err = _vjsPlayer ? _vjsPlayer.error() : null;
    showVideoError(wrap, url, 'error');
  });

  /* Sur iOS : stall après 8s → message */
  if (IS_IOS) {
    var _stallTimer = setTimeout(function() {
      if (_vjsPlayer && _vjsPlayer.readyState() < 2) {
        var errDiv = document.createElement('div');
        errDiv.style.cssText = 'position:absolute;top:0;left:0;right:0;background:rgba(232,160,32,.12);border-bottom:1px solid rgba(232,160,32,.25);padding:.5rem 1rem;font-family:\'DM Sans\',sans-serif;font-size:.75rem;color:rgba(220,232,247,.85);line-height:1.5;z-index:10;';
        errDiv.textContent = 'Si la vidéo ne démarre pas, le lien n\'est peut-être pas compatible Safari iOS. Privilégiez des liens mp4 directs ou YouTube/Vimeo.';
        wrap.style.position = 'relative';
        wrap.insertBefore(errDiv, wrap.firstChild);
        _vjsPlayer.one('playing', function() { errDiv.remove(); });
      }
    }, 8000);
    _vjsPlayer.one('playing', function() { clearTimeout(_stallTimer); });
  }
}

/* ── Exposer pour la sauvegarde de progression ── */
function playerCurrentTime() {
  return _vjsPlayer ? _vjsPlayer.currentTime() : 0;
}
function playerDuration() {
  return _vjsPlayer ? _vjsPlayer.duration() : 0;
}
function playerOnTimeUpdate(cb) {
  if (_vjsPlayer) _vjsPlayer.on('timeupdate', cb);
}
function playerDispose() {
  if (_vjsPlayer) {
    try { _vjsPlayer.dispose(); } catch(e) {}
    _vjsPlayer = null;
  }
}

/* ── Raccourcis clavier (fallback si hotkeys VJS désactivés) ── */
function playerKeydown(e) {
  var tag = document.activeElement ? document.activeElement.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
}
