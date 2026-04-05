/* ═══════════════════════════════════════════
   NovaCiné — app.js  (partagé par toutes les pages)
   ═══════════════════════════════════════════ */

// ── CRYPTO ──
async function sha256(str) {
  var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
}

// ── STORAGE ──
function lsave(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
function lload(k, def) {
  try { var r = JSON.parse(localStorage.getItem(k)); return r !== null && r !== undefined ? r : (def !== undefined ? def : null); }
  catch(e) { return def !== undefined ? def : null; }
}

// ── SUPABASE ──
var SB = null;
function initSB() {
  SB = null;
  if (typeof initSupabaseClient === 'function') { SB = initSupabaseClient(); if (SB) return; }
  var url = localStorage.getItem('nc_url'), key = localStorage.getItem('nc_key');
  if (url && key && url.startsWith('https://')) {
    try { SB = window.supabase.createClient(url, key); } catch(e) { SB = null; }
  }
}

// ── SESSION ──
function getSession() { return lload('nc_session', null); }
function setSession(user) { lsave('nc_session', user); }
function clearSession() { lsave('nc_session', null); }
function requireAuth() {
  // Call on pages that need a logged-in user (optional, guests allowed)
  // Returns user or null
  return getSession();
}

// ── DATA: FILMS ──
var films = [];
async function loadFilms() {
  if (SB) {
    var r = await SB.from('films').select('*').order('created_at', { ascending: false });
    if (!r.error && r.data) { films = r.data; lsave('nc_films', films); return; }
  }
  films = lload('nc_films', []);
}
async function dbSaveFilm(f) {
  if (SB) {
    if (f.id) { var r = await SB.from('films').update(f).eq('id', f.id); if (r.error) throw r.error; }
    else { var r = await SB.from('films').insert([f]).select().single(); if (r.error) throw r.error; f.id = r.data.id; }
  } else {
    if (!f.id) f.id = 'l' + Date.now();
    var i = films.findIndex(function(x){ return x.id === f.id; });
    if (i >= 0) films[i] = f; else films.unshift(f);
    lsave('nc_films', films);
  }
}
async function dbDelFilm(id) {
  if (SB) { var r = await SB.from('films').delete().eq('id', id); if (r.error) throw r.error; }
  films = films.filter(function(f){ return f.id !== id; });
  lsave('nc_films', films);
}

// ── DATA: SERIES ──
var series = [];
async function loadSeries() {
  if (SB) {
    var r = await SB.from('series').select('*').order('created_at', { ascending: false });
    if (!r.error && r.data) { series = r.data; lsave('nc_series', series); return; }
  }
  series = lload('nc_series', []);
}
async function dbSaveSeries(s) {
  if (SB) {
    if (s.id) { var r = await SB.from('series').update(s).eq('id', s.id); if (r.error) throw r.error; }
    else { var r = await SB.from('series').insert([s]).select().single(); if (r.error) throw r.error; s.id = r.data.id; }
  } else {
    if (!s.id) s.id = 'l' + Date.now();
    var i = series.findIndex(function(x){ return x.id === s.id; });
    if (i >= 0) series[i] = s; else series.unshift(s);
    lsave('nc_series', series);
  }
}
async function dbDelSeries(id) {
  if (SB) { var r = await SB.from('series').delete().eq('id', id); if (r.error) throw r.error; }
  series = series.filter(function(s){ return s.id !== id; });
  lsave('nc_eps', lload('nc_eps', []).filter(function(e){ return e.series_id !== id; }));
  lsave('nc_series', series);
}

// ── DATA: EPISODES ──
async function loadEps(sid) {
  if (SB) {
    var r = await SB.from('episodes').select('*').eq('series_id', sid).order('season_number').order('episode_number');
    if (!r.error && r.data) {
      var rest = lload('nc_eps', []).filter(function(e){ return e.series_id !== sid; });
      lsave('nc_eps', rest.concat(r.data)); return r.data;
    }
  }
  return lload('nc_eps', []).filter(function(e){ return e.series_id === sid; });
}
async function loadAllEps() {
  if (SB) { var r = await SB.from('episodes').select('*'); if (!r.error && r.data) { lsave('nc_eps', r.data); return r.data; } }
  return lload('nc_eps', []);
}
async function dbSaveEp(ep) {
  if (SB) {
    var isLocal = !ep.id || ep.id.startsWith('l');
    if (!isLocal) { var r = await SB.from('episodes').update(ep).eq('id', ep.id); if (r.error) throw r.error; }
    else { var ins = Object.assign({}, ep); delete ins.id; var r = await SB.from('episodes').insert([ins]).select().single(); if (r.error) throw r.error; ep.id = r.data.id; }
  } else {
    if (!ep.id) ep.id = 'l' + Date.now();
    var all = lload('nc_eps', []);
    var i = all.findIndex(function(x){ return x.id === ep.id; });
    if (i >= 0) all[i] = ep; else all.push(ep);
    lsave('nc_eps', all);
  }
}
async function dbDelEp(id) {
  if (SB) { var r = await SB.from('episodes').delete().eq('id', id); if (r.error) throw r.error; }
  lsave('nc_eps', lload('nc_eps', []).filter(function(e){ return e.id !== id; }));
}

// ── DATA: USERS ──
async function dbCreateUser(username, pwHash) {
  if (SB) {
    var chk = await SB.from('nc_users').select('id').eq('username', username);
    if (chk.data && chk.data.length > 0) throw new Error('Nom d\'utilisateur déjà pris.');
    var r = await SB.from('nc_users').insert([{ username: username, password_hash: pwHash }]).select().single();
    if (r.error) { if (r.error.code === '23505') throw new Error('Nom d\'utilisateur déjà pris.'); throw r.error; }
    return { id: r.data.id, username: r.data.username };
  } else {
    var users = lload('nc_local_users', []);
    if (users.find(function(u){ return u.username === username; })) throw new Error('Nom d\'utilisateur déjà pris.');
    var nu = { id: 'l' + Date.now(), username: username, password_hash: pwHash };
    users.push(nu); lsave('nc_local_users', users);
    return { id: nu.id, username: nu.username };
  }
}
async function dbLoginUser(username, pwHash) {
  if (SB) {
    var r = await SB.from('nc_users').select('id,username,password_hash').eq('username', username).single();
    if (r.error || !r.data) return null;
    if (r.data.password_hash !== pwHash) return null;
    return { id: r.data.id, username: r.data.username };
  } else {
    var users = lload('nc_local_users', []);
    var u = users.find(function(x){ return x.username === username && x.password_hash === pwHash; });
    return u ? { id: u.id, username: u.username } : null;
  }
}

// ── PROGRESS ──
var allProgress = {};
async function loadUserProgress(userId) {
  allProgress = {};
  if (SB) {
    var r = await SB.from('progress').select('*').eq('user_id', userId);
    if (!r.error && r.data) {
      r.data.forEach(function(p){
        var key = p.film_id || p.episode_id;
        allProgress[key] = { id: p.id, position: p.position, duration: p.duration, percent: p.percent, completed: p.completed, film_id: p.film_id, episode_id: p.episode_id, updated_at: p.updated_at };
      });
      lsave('nc_progress_' + userId, allProgress); return;
    }
  }
  allProgress = lload('nc_progress_' + userId, {});
}
function getProgress(id) { return allProgress[id] || null; }
async function saveProgress(userId, contentId, isFilm, position, duration) {
  if (!userId || !contentId) return;
  var percent = duration > 0 ? (position / duration) * 100 : 0;
  var completed = percent > 90;
  var entry = allProgress[contentId] || {};
  entry.position = position; entry.duration = duration; entry.percent = percent;
  entry.completed = completed; entry.updated_at = Date.now();
  if (isFilm) entry.film_id = contentId; else entry.episode_id = contentId;
  allProgress[contentId] = entry;
  lsave('nc_progress_' + userId, allProgress);
  if (SB) {
    var row = { user_id: userId, position: position, duration: duration, percent: percent, completed: completed, updated_at: new Date().toISOString() };
    if (isFilm) row.film_id = contentId; else row.episode_id = contentId;
    if (entry.id) { await SB.from('progress').update(row).eq('id', entry.id); }
    else { var r = await SB.from('progress').insert([row]).select().single(); if (!r.error && r.data) allProgress[contentId].id = r.data.id; }
  }
}

// ── UTILS ──
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmt(s) {
  s = Math.max(0, Math.floor(s));
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  if (h > 0) return h + ':' + String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
  return m + ':' + String(sec).padStart(2,'0');
}
function svgFilm() { return '<svg width="36" height="36" fill="currentColor" viewBox="0 0 16 16"><path d="M0 1a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1zm4 0v6h8V1zm8 8H4v6h8zM1 1v2h2V1zm2 3H1v2h2zM1 7v2h2V7zm2 3H1v2h2zm-2 3v2h2v-2zM15 1h-2v2h2zm-2 3v2h2V4zm2 3h-2v2h2zm-2 3v2h2v-2zm2 3h-2v2h2z"/></svg>'; }
function svgSeries() { return '<svg width="36" height="36" fill="currentColor" viewBox="0 0 16 16"><path d="M2.5 13.5A.5.5 0 0 1 3 13h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zM14 2H2C0 2 0 4 0 4v6c0 2 2 2 2 2h12c2 0 2-2 2-2V4c0-2-2-2-2-2z"/></svg>'; }

function notif(msg, type) {
  type = type || 'ok';
  var el = document.getElementById('notif');
  if (!el) return;
  el.textContent = msg; el.className = 'notif ' + type + ' show';
  setTimeout(function(){ el.className = 'notif'; }, 3200);
}

// ── NAV HELPERS ──
function updateNavUser() {
  var user = getSession();
  var badge = document.getElementById('user-badge');
  if (!badge) return;
  if (user) {
    badge.classList.add('visible');
    var av = document.getElementById('user-avatar');
    var nm = document.getElementById('user-name-display');
    if (av) av.textContent = user.username.charAt(0).toUpperCase();
    if (nm) nm.textContent = user.username;
  } else {
    badge.classList.remove('visible');
  }
}
function doLogout() {
  clearSession();
  window.location.href = 'login.html';
}
