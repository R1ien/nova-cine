/* ═══════════════════════════════════════════
   NovaCiné — Shared Nav Component
   ═══════════════════════════════════════════ */

// Called once DOM is ready — pass current page key e.g. 'home'
function initNav(activePage) {
  var session = getSession();

  // Highlight active links
  document.querySelectorAll('.nav-links a, .mobile-menu a[data-page]').forEach(function(a) {
    if (a.dataset.page === activePage) a.classList.add('active');
  });

  // Login button: show/hide
  var loginBtns = document.querySelectorAll('.nav-login-btn');
  loginBtns.forEach(function(btn) {
    if (session) btn.classList.add('hidden');
    else btn.classList.remove('hidden');
  });

  // User badge
  updateNavUser();

  // Hamburger
  var ham = document.getElementById('hamburger');
  var drawer = document.getElementById('mobile-menu');
  if (ham && drawer) {
    ham.addEventListener('click', function() {
      var open = drawer.classList.toggle('open');
      ham.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    // Close drawer on link click
    drawer.querySelectorAll('a').forEach(function(a) {
      a.addEventListener('click', function() {
        drawer.classList.remove('open');
        ham.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }
}

// Lazy load images: add .loaded class when image finishes loading
function initLazyImages() {
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          img.addEventListener('load', function() { img.classList.add('loaded'); }, { once: true });
          io.unobserve(img);
        }
      });
    }, { rootMargin: '200px' });

    document.querySelectorAll('img[data-src]').forEach(function(img) { io.observe(img); });
  } else {
    // Fallback: load immediately
    document.querySelectorAll('img[data-src]').forEach(function(img) {
      img.src = img.dataset.src;
      img.classList.add('loaded');
    });
  }
}

// Touch-friendly: show player controls on tap
function initPlayerTouchControls() {
  var wrap = document.getElementById('player-wrap');
  if (!wrap) return;
  wrap.addEventListener('click', function(e) {
    if (e.target.closest('.cbtn,.pbar,.vslider')) return;
    wrap.classList.toggle('show-ctrl');
    // Auto-hide after 3s
    clearTimeout(wrap._ctrlTimer);
    if (wrap.classList.contains('show-ctrl')) {
      wrap._ctrlTimer = setTimeout(function() { wrap.classList.remove('show-ctrl'); }, 3000);
    }
  });
}
