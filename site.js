/* Consolidated browser code for the temple website. */


/* Shared seva and calendar data stores. */
if (document.body.matches('.admin-page, .booking-page, .sevas-page')) {

// Centralized Sevas Database & Storage Handler (Server API + Local Storage Backup)

window.escapeHTML = function(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

(function(window) {
  const STORAGE_KEY = 'temple_sevas_data_v1';
  const API_BASE = '/api/sevas';

  const DEFAULT_SUBSECTIONS = [
    { id: 'general', name: 'General Sevas', icon: '🙏' },
    { id: 'ganapathi', name: 'Ganapathi', icon: '🐘' },
    { id: 'hanuman', name: 'Hanuman', icon: '🚩' },
    { id: 'garuda', name: 'Garuda', icon: '🦅' },
    { id: 'mahalakshmi', name: 'Maha Lakshmi', icon: '🪷' },
    { id: 'durga', name: 'Durga', icon: '🔱' },
    { id: 'shiva', name: 'Shiva', icon: '🕉️' },
    { id: 'nagaraja', name: 'Nagaraja Vasuki', icon: '🐍' },
    { id: 'nagayakshi', name: 'Naga Yakshi', icon: '🐍' }
  ];

  let cachedSevas = [];

  function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function notifyAdminSessionExpired(response) {
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('temple:admin-session-expired'));
    }
  }
  window.notifyAdminSessionExpired = notifyAdminSessionExpired;

  function loadSevasLocal() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  }

  function saveSevasLocal(sevas) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sevas));
    } catch (e) {}
  }

  async function fetchSevas(callback) {
    const res = await fetch(API_BASE, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load sevas from the server.');
    cachedSevas = data;
    saveSevasLocal(data);
    if (callback) callback(data);
    return data;
  }

  function loadSevasSync() {
    if (cachedSevas.length > 0) return cachedSevas;
    return loadSevasLocal();
  }

  async function addSeva(sevaData, callback) {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getCsrfToken() },
      body: JSON.stringify(sevaData)
    });
    const newSeva = await res.json();
    notifyAdminSessionExpired(res);
    if (!res.ok) throw new Error(newSeva.error || 'Could not save seva.');
    await fetchSevas();
    if (callback) callback(newSeva);
    return newSeva;
  }

  async function deleteSeva(id, callback) {
    const res = await fetch(`${API_BASE}?id=${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: { 'X-XSRF-TOKEN': getCsrfToken() }
    });
    const result = await res.json();
    notifyAdminSessionExpired(res);
    if (!res.ok) throw new Error(result.error || 'Could not delete seva.');
    await fetchSevas();
    if (callback) callback();
  }

  async function resetSevas(callback) {
    const res = await fetch(`${API_BASE}/reset`, { method: 'POST', headers: { 'X-XSRF-TOKEN': getCsrfToken() } });
    const data = await res.json();
    notifyAdminSessionExpired(res);
    if (!res.ok) throw new Error(data.error || 'Could not reset sevas.');
    cachedSevas = data;
    saveSevasLocal(data);
    if (callback) callback(data);
    return data;
  }

  function getSevaById(id) {
    const sevas = loadSevasSync();
    return sevas.find(s => s.id === id);
  }

  window.SevaStore = {
    subsections: DEFAULT_SUBSECTIONS,
    getCsrfToken: getCsrfToken,
    fetchSevas: fetchSevas,
    loadSevas: loadSevasSync,
    addSeva: addSeva,
    deleteSeva: deleteSeva,
    resetSevas: resetSevas,
    getSevaById: getSevaById
  };

  // ==========================================
  // Calendar "Special of the Day" Store
  // ==========================================
  const CALENDAR_STORAGE_KEY = 'temple_calendar_specials_v1';
  const SERVER_ORIGIN = (typeof window !== 'undefined' && window.location && (window.location.protocol === 'http:' || window.location.protocol === 'https:'))
    ? ''
    : 'http://localhost:3000';
  const CALENDAR_API = SERVER_ORIGIN + '/api/calendar';
  let cachedCalendar = {};

  function normalizeDate(d) {
    if (!d) return '';
    const parts = String(d).trim().split('-');
    if (parts.length === 3) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    return d.trim();
  }

  function loadCalendarLocal() {
    try {
      const stored = localStorage.getItem(CALENDAR_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return {};
  }

  function saveCalendarLocal(data) {
    try {
      localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  async function fetchCalendar(callback) {
    const res = await fetch(CALENDAR_API, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not load Panchangam specials from Neon.');
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('The Panchangam API returned invalid data.');
    }

    cachedCalendar = data;
    saveCalendarLocal(data);
    if (callback) callback(data);
    return data;
  }

  function getCalendarSync() {
    if (Object.keys(cachedCalendar).length > 0) return cachedCalendar;
    return loadCalendarLocal();
  }

  async function addSpecial(date, special, callback) {
    const normDate = normalizeDate(date);
    const text = String(special || '').trim();
    if (!normDate || !text) return;

    const headers = { 'Content-Type': 'application/json' };
    const csrf = getCsrfToken();
    if (csrf) headers['X-XSRF-TOKEN'] = csrf;

    const res = await fetch(CALENDAR_API, {
      method: 'POST',
      headers,
      body: JSON.stringify({ date: normDate, special: text })
    });
    const resObj = await res.json().catch(() => ({}));
    notifyAdminSessionExpired(res);
    if (!res.ok) throw new Error(resObj.error || 'Could not save this special to Neon.');

    const cal = { ...getCalendarSync(), [normDate]: resObj.specials || [] };
    cachedCalendar = cal;
    saveCalendarLocal(cal);
    if (callback) callback(resObj);
    return resObj;
  }

  async function deleteSpecial(date, specialOrIndex, callback) {
    const normDate = normalizeDate(date);
    if (!normDate) {
      if (callback) callback();
      return;
    }

    let query = `?date=${encodeURIComponent(normDate)}`;
    let targetSpecialText = null;
    let targetIndex = null;

    if (typeof specialOrIndex === 'object' && specialOrIndex !== null) {
      if (specialOrIndex.special) targetSpecialText = String(specialOrIndex.special).trim();
      if (specialOrIndex.index !== undefined && specialOrIndex.index !== null) targetIndex = parseInt(specialOrIndex.index, 10);
    } else if (typeof specialOrIndex === 'number') {
      targetIndex = specialOrIndex;
    } else if (typeof specialOrIndex === 'string' && specialOrIndex.trim()) {
      targetSpecialText = specialOrIndex.trim();
    }

    if (targetSpecialText) {
      query += `&special=${encodeURIComponent(targetSpecialText)}`;
    }
    if (targetIndex !== null && !isNaN(targetIndex)) {
      query += `&index=${targetIndex}`;
    }

    const headers = {};
    const csrf = getCsrfToken();
    if (csrf) headers['X-XSRF-TOKEN'] = csrf;

    const res = await fetch(`${CALENDAR_API}${query}`, { method: 'DELETE', headers });
    const resObj = await res.json().catch(() => ({}));
    notifyAdminSessionExpired(res);
    if (!res.ok) throw new Error(resObj.error || 'Could not remove this special from Neon.');

    const cal = { ...getCalendarSync() };
    if (resObj.specials && resObj.specials.length > 0) cal[normDate] = resObj.specials;
    else delete cal[normDate];
    cachedCalendar = cal;
    saveCalendarLocal(cal);

    if (callback) callback(resObj);
    return resObj;
  }

  window.CalendarStore = {
    fetchCalendar: fetchCalendar,
    getCalendarSync: getCalendarSync,
    addSpecial: addSpecial,
    deleteSpecial: deleteSpecial,
    normalizeDate: normalizeDate
  };

  // Calendar data remains on its existing API; sevas load when a page requests them.
  fetchCalendar().catch((error) => console.error('Could not load Panchangam specials:', error));
})(window);


}

/* Landing-page interactions and Three.js visual effects. */
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SACRED TEMPLE â€” Main JavaScript
   Three.js background, parallax, scroll reveals,
   floating particles, and navigation.
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

(function () {
  'use strict';

  // The main landing page is the only page with the Three.js canvas.
  if (!document.getElementById('three-canvas')) return;

  // â”€â”€â”€ PRELOADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    setTimeout(() => {
      preloader.classList.add('hidden');
      document.body.style.overflow = '';
      initParticles();
    }, 1200);
  });

  document.body.style.overflow = 'hidden';

  // â”€â”€â”€ THREE.JS INTERACTIVE BACKGROUND â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const canvas = document.getElementById('three-canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.z = 2.5;

  // Mouse tracking
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

  document.addEventListener('mousemove', (e) => {
    mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // Load temple texture
  const textureLoader = new THREE.TextureLoader();
  const templeTexture = textureLoader.load('assets/temple.jpg', (tex) => {
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
  });

  // Custom shader material for the shifting background
  const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: templeTexture },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uResolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      uOpacity: { value: 0.55 },
      uScrollProgress: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform float uTime;
      uniform vec2 uMouse;
      uniform vec2 uResolution;
      uniform float uOpacity;
      uniform float uScrollProgress;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv;

        // Subtle wave distortion driven by mouse + time
        float wave = sin(uv.y * 4.0 + uTime * 0.3 + uMouse.x * 2.0) * 0.008;
        float wave2 = cos(uv.x * 3.0 + uTime * 0.2 + uMouse.y * 1.5) * 0.006;
        uv.x += wave + uMouse.x * 0.02;
        uv.y += wave2 + uMouse.y * 0.015;

        // Subtle zoom shift based on scroll
        float zoom = 1.0 - uScrollProgress * 0.08;
        uv = (uv - 0.5) * zoom + 0.5;

        vec4 tex = texture2D(uTexture, uv);

        // Dark tint with golden hue
        vec3 goldTint = vec3(0.76, 0.6, 0.16);
        vec3 darkTint = vec3(0.04, 0.04, 0.06);
        vec3 color = mix(darkTint, tex.rgb, 0.45);
        color = mix(color, color * goldTint * 1.6, 0.15);

        // Vignette
        float dist = distance(vUv, vec2(0.5));
        float vignette = smoothstep(0.9, 0.3, dist);
        color *= vignette;

        // Fade out as user scrolls
        float fadeOut = 1.0 - smoothstep(0.0, 0.6, uScrollProgress);
        float alpha = uOpacity * fadeOut;

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
  });

  // Full-screen plane for the background
  const imgAspect = 1024 / 683;                        // approximate temple photo aspect
  const planeHeight = 3.8;
  const planeWidth = planeHeight * imgAspect;
  const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, 32, 32);
  const mesh = new THREE.Mesh(geometry, shaderMaterial);
  scene.add(mesh);

  // Animation loop
  let scrollY = 0;
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    // Smooth mouse lerp
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;

    // Update uniforms
    shaderMaterial.uniforms.uTime.value = elapsed;
    shaderMaterial.uniforms.uMouse.value.set(mouse.x, mouse.y);

    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const scrollProgress = Math.min(scrollY / Math.max(maxScroll, 1), 1);
    shaderMaterial.uniforms.uScrollProgress.value = scrollProgress;

    // Subtle camera sway
    camera.position.x += (mouse.x * 0.15 - camera.position.x) * 0.03;
    camera.position.y += (-mouse.y * 0.1 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();

  // Scroll listener
  window.addEventListener('scroll', () => {
    scrollY = window.pageYOffset;
  }, { passive: true });

  // Resize
  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    shaderMaterial.uniforms.uResolution.value.set(w, h);
  });

  // â”€â”€â”€ PARALLAX IMAGES ON SCROLL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const parallaxImages = document.querySelectorAll('[data-parallax-img]');

  function updateParallax() {
    const viewportH = window.innerHeight;

    parallaxImages.forEach((img) => {
      const rect = img.closest('.deity-image-wrapper').getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const offset = (center - viewportH / 2) / viewportH;
      // Move image between -15% and +15%
      const translate = offset * 20;
      img.style.transform = `translateY(${translate}%)`;
    });

    requestAnimationFrame(updateParallax);
  }
  updateParallax();

  // â”€â”€â”€ SCROLL REVEAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const revealElements = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
  );

  revealElements.forEach((el) => revealObserver.observe(el));

  // â”€â”€â”€ NAVBAR SCROLL STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const navbar = document.getElementById('navbar');

  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 80) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }, { passive: true });

  // â”€â”€â”€ MOBILE NAV â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const hamburger = document.getElementById('nav-hamburger');
  const mobileNav = document.getElementById('mobile-nav');

  const closeMobileMenu = () => {
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    mobileNav.classList.remove('active');
  };

  hamburger.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('active');
    hamburger.classList.toggle('active', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
  });

  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMobileMenu);
  });

  document.addEventListener('click', (event) => {
    if (mobileNav.classList.contains('active') &&
        !mobileNav.contains(event.target) &&
        !hamburger.contains(event.target)) {
      closeMobileMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMobileMenu();
  });

  // â”€â”€â”€ FLOATING GOLDEN PARTICLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function initParticles() {
    const container = document.getElementById('particles-container');
    const count = 25;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.classList.add('particle');
      const size = Math.random() * 3 + 1;
      const left = Math.random() * 100;
      const duration = Math.random() * 12 + 10;
      const delay = Math.random() * 15;
      const opacity = Math.random() * 0.4 + 0.1;

      p.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${left}%;
        animation-duration: ${duration}s;
        animation-delay: ${delay}s;
        opacity: ${opacity};
      `;
      container.appendChild(p);
    }
  }

  // â”€â”€â”€ SMOOTH SCROLL FOR CTA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        const top = target.getBoundingClientRect().top + window.pageYOffset - 60;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });



  // ==========================================================================
  // UPI PAYMENT MODAL & DIRECT REDIRECTION LOGIC
  // ==========================================================================
  const upiModal = document.getElementById('upi-modal');
  const upiModalClose = document.getElementById('upi-modal-close');
  const modalPoojaTitle = document.getElementById('modal-pooja-title');
  const modalPoojaAmount = document.getElementById('modal-pooja-amount');
  const directUpiPayLink = document.getElementById('direct-upi-pay-link');
  const upiQrImg = document.getElementById('upi-qr-img');
  const copyUpiBtn = document.getElementById('copy-upi-btn');
  const copyBtnText = document.getElementById('copy-btn-text');
  const devoteeNameInput = document.getElementById('devotee-name');
  const devoteeStarInput = document.getElementById('devotee-star');

  const TEMPLE_UPI_ID = 'asvdcherai@sbi';
  const TEMPLE_NAME = 'Azheekkal Sree Varaha Devaswam';

  function createPaymentReference() {
    return `ASVD${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  let currentPaymentReference = createPaymentReference();

  function buildUpiUri(poojaName, amount) {
    const devoteeName = devoteeNameInput ? devoteeNameInput.value.trim() : '';
    const devoteeStar = devoteeStarInput ? devoteeStarInput.value.trim() : '';

    let note = `${poojaName} Pooja`;
    if (devoteeName) {
      note += ` - ${devoteeName}`;
      if (devoteeStar) note += ` (${devoteeStar})`;
    }

    // Google Pay's UPI flow supports transaction notes up to 80 characters.
    note = Array.from(note).slice(0, 80).join('');

    const params = new URLSearchParams({
      pa: TEMPLE_UPI_ID,
      pn: TEMPLE_NAME,
      tr: currentPaymentReference,
      am: parseFloat(amount).toFixed(2),
      cu: 'INR',
      tn: note
    });

    // URLSearchParams uses `+` for spaces, but some UPI apps interpret that
    // literally in the payee name and payment note. Use percent-encoded spaces.
    const encodedParams = params.toString().replace(/\+/g, '%20');
    return `upi://pay?${encodedParams}`;
  }

  function updatePaymentState(poojaName, amount) {
    const upiUri = buildUpiUri(poojaName, amount);

    if (modalPoojaTitle) modalPoojaTitle.textContent = `${poojaName} Pooja`;
    if (modalPoojaAmount) modalPoojaAmount.textContent = `â‚¹ ${amount}`;
    if (directUpiPayLink) directUpiPayLink.setAttribute('href', upiUri);

    // Update QR Code
    if (upiQrImg) {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(upiUri)}`;
      upiQrImg.src = qrApiUrl;
    }
  }

  let currentPooja = 'Pushpanjali';
  let currentAmount = '300';

  // Attach click events to all Pay Buttons under Special Poojas
  document.querySelectorAll('.pay-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      currentPooja = btn.getAttribute('data-pooja') || 'Special Pooja';
      currentAmount = btn.getAttribute('data-amount') || '300';
      currentPaymentReference = createPaymentReference();

      updatePaymentState(currentPooja, currentAmount);

      // Open Modal
      if (upiModal) {
        upiModal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }

      // Directly attempt UPI redirect on mobile / supported devices
      const upiUri = buildUpiUri(currentPooja, currentAmount);
      window.location.href = upiUri;
    });
  });

  // Re-generate UPI URI & QR Code live when devotee enters name or star
  if (devoteeNameInput) {
    devoteeNameInput.addEventListener('input', () => {
      updatePaymentState(currentPooja, currentAmount);
    });
  }
  if (devoteeStarInput) {
    devoteeStarInput.addEventListener('input', () => {
      updatePaymentState(currentPooja, currentAmount);
    });
  }

  // Close Modal
  if (upiModalClose) {
    upiModalClose.addEventListener('click', () => {
      upiModal.classList.remove('active');
      document.body.style.overflow = '';
    });
  }

  if (upiModal) {
    upiModal.addEventListener('click', (e) => {
      if (e.target === upiModal) {
        upiModal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  // Copy UPI ID
  if (copyUpiBtn) {
    copyUpiBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(TEMPLE_UPI_ID).then(() => {
        if (copyBtnText) copyBtnText.textContent = 'Copied!';
        setTimeout(() => {
          if (copyBtnText) copyBtnText.textContent = 'Copy';
        }, 2000);
      });
    });
  }

  // ðŸ“– STORY BOOK MODAL, MULTI-LANGUAGE & ZOOM CONTROLLER ðŸ“–
  const openStoryBtn = document.getElementById('open-story-btn');
  const storyModal = document.getElementById('story-modal');
  const storyModalClose = document.getElementById('story-modal-close');
  const closedBookTrigger = document.getElementById('closed-book-trigger');
  const closedBookCoverImg = document.getElementById('closed-book-cover-img');
  if (closedBookCoverImg) {
    closedBookCoverImg.addEventListener('error', () => {
      closedBookCoverImg.src = 'assets/story/pages/page_1.jpg';
    }, { once: true });
  }
  const storyEditionTitle = document.getElementById('story-edition-title');
  const storyLangBtns = document.querySelectorAll('.story-lang-btn');
  const openBookContainer = document.getElementById('open-book-container');
  const flipbookZoomWrapper = document.getElementById('flipbook-zoom-wrapper');
  const flipbook = document.getElementById('flipbook');
  const prevBtn = document.getElementById('book-prev');
  const nextBtn = document.getElementById('book-next');
  const pageIndicatorEl = document.getElementById('book-page-badge');

  // Zoom controls
  const zoomInBtn = document.getElementById('book-zoom-in');
  const zoomOutBtn = document.getElementById('book-zoom-out');
  const zoomResetBtn = document.getElementById('book-zoom-reset');
  const zoomValEl = document.getElementById('book-zoom-val');

  // Multi-Language Book Editions Configuration
  const STORY_BOOKS = {
    ml: {
      id: 'ml',
      name: 'Malayalam',
      nativeName: '\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02',
      editionTitle: '\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02 \u0D2A\u0D24\u0D3F\u0D2A\u0D4D\u0D2A\u0D4D \u2022 Malayalam Edition',
      instructionSub: '\u0D2A\u0D41\u0D38\u0D4D\u0D24\u0D15\u0D02 \u0D24\u0D41\u0D31\u0D15\u0D4D\u0D15\u0D3E\u0D7B \u0D15\u0D4D\u0D32\u0D3F\u0D15\u0D4D\u0D15\u0D4D \u0D1A\u0D46\u0D2F\u0D4D\u0D2F\u0D41\u0D15',
      cover: 'assets/story-cover.jpg',
      totalPages: 32,
      pagePath: (i) => `assets/story/pages/page_${i}.jpg`
    },
    en: {
      id: 'en',
      name: 'English',
      nativeName: 'English',
      editionTitle: 'English Edition \u2022 \u0D07\u0D02\u0D17\u0D4D\u0D32\u0D40\u0D37\u0D4D \u0D2A\u0D24\u0D3F\u0D2A\u0D4D\u0D2A\u0D4D',
      instructionSub: 'Click anywhere on the book to read',
      cover: 'assets/story/english/cover.jpg',
      totalPages: 33, // 32 inner story pages + back cover
      pagePath: (i) => `assets/story/english/pages/page_${i}.jpg`
    }
  };

  let currentBookLang = localStorage.getItem('asvd_story_book_lang') || 'ml';
  if (!STORY_BOOKS[currentBookLang]) currentBookLang = 'ml';

  let currentBookPage = 0;
  let bookPages = [];
  let isBookInitialized = false;

  // Zoom & Pan state
  let currentZoom = 1.0;
  let currentPanX = 0;
  let currentPanY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startPanX = 0;
  let startPanY = 0;
  let initialPinchDist = null;
  let initialPinchZoom = 1.0;

  function applyZoomTransform(animate = true) {
    if (!flipbookZoomWrapper) return;

    if (animate) {
      flipbookZoomWrapper.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
    } else {
      flipbookZoomWrapper.style.transition = 'none';
    }

    if (currentZoom <= 1.0) {
      currentPanX = 0;
      currentPanY = 0;
      flipbookZoomWrapper.classList.remove('is-zoomed');
    } else {
      flipbookZoomWrapper.classList.add('is-zoomed');
      const maxPanX = (window.innerWidth * (currentZoom - 1)) / 1.5;
      const maxPanY = (window.innerHeight * (currentZoom - 1)) / 1.5;
      currentPanX = Math.max(-maxPanX, Math.min(maxPanX, currentPanX));
      currentPanY = Math.max(-maxPanY, Math.min(maxPanY, currentPanY));
    }

    flipbookZoomWrapper.style.transform = `translate(${currentPanX}px, ${currentPanY}px) scale(${currentZoom})`;

    if (zoomValEl) {
      zoomValEl.textContent = `${Math.round(currentZoom * 100)}%`;
    }
    if (zoomOutBtn) {
      zoomOutBtn.disabled = currentZoom <= 1.0;
    }
    if (zoomInBtn) {
      zoomInBtn.disabled = currentZoom >= 2.5;
    }
  }

  function zoomIn() {
    if (currentZoom < 2.5) {
      currentZoom = Math.min(2.5, Math.round((currentZoom + 0.25) * 100) / 100);
      applyZoomTransform(true);
    }
  }

  function zoomOut() {
    if (currentZoom > 1.0) {
      currentZoom = Math.max(1.0, Math.round((currentZoom - 0.25) * 100) / 100);
      if (currentZoom === 1.0) {
        currentPanX = 0;
        currentPanY = 0;
      }
      applyZoomTransform(true);
    }
  }

  function resetZoom() {
    currentZoom = 1.0;
    currentPanX = 0;
    currentPanY = 0;
    applyZoomTransform(true);
  }

  function setBookLanguage(lang, preservePage = true) {
    if (!STORY_BOOKS[lang]) return;
    currentBookLang = lang;
    try {
      localStorage.setItem('asvd_story_book_lang', lang);
    } catch (_) {}

    // Update active state on language switcher buttons
    storyLangBtns.forEach(btn => {
      const isActive = btn.dataset.lang === lang;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });

    const bookConfig = STORY_BOOKS[lang];

    // Update closed book cover and titles
    if (closedBookCoverImg) {
      closedBookCoverImg.src = bookConfig.cover;
    }
    if (storyEditionTitle) {
      storyEditionTitle.textContent = bookConfig.editionTitle;
    }
    const instructionSub = document.querySelector('.instruction-sub');
    if (instructionSub) {
      instructionSub.textContent = bookConfig.instructionSub;
    }

    // If flipbook is already open, immediately re-render with new language
    if (openBookContainer && openBookContainer.style.display !== 'none') {
      if (flipbook) { flipbook.style.opacity = '0'; flipbook.style.transition = 'opacity 0.2s ease'; }
      setTimeout(function() { renderBookPages(false); if (flipbook) { flipbook.style.opacity = '1'; } }, 220);
    }
  }

  function renderBookPages(preservePage = false) {
    const bookConfig = STORY_BOOKS[currentBookLang];
    const total = bookConfig.totalPages;

    if (!preservePage) {
      currentBookPage = 0;
    } else {
      currentBookPage = Math.min(currentBookPage, total);
    }

    let html = '';

    // Cover sheet (Index 0)
    html += `
      <div class="flipbook-page" style="z-index: 100;">
        <div class="page-front">
          <img src="${bookConfig.cover}" class="page-img" alt="${bookConfig.name} Cover" loading="lazy">
        </div>
        <div class="page-back">
          <div style="width:100%; height:100%; background:#f4e8d3;"></div>
        </div>
      </div>
    `;

    // Inner pages 1 to total
    for (let i = 1; i <= total; i++) {
      const zIndex = 100 - i;
      html += `
        <div class="flipbook-page" style="z-index: ${zIndex};">
          <div class="page-front">
            <img src="${bookConfig.pagePath(i)}" class="page-img" alt="Page ${i}" loading="lazy">
          </div>
          <div class="page-back">
            <div style="width:100%; height:100%; background:#f4e8d3;"></div>
          </div>
        </div>
      `;
    }

    if (flipbook) {
      flipbook.innerHTML = html;
      const coverImage = flipbook.querySelector('.flipbook-page .page-front img');
      if (coverImage) {
        coverImage.addEventListener('error', () => {
          coverImage.src = bookConfig.pagePath(1);
        }, { once: true });
      }
      bookPages = document.querySelectorAll('.flipbook-page');
      isBookInitialized = true;
      updateBookState();
    }
  }

  function updateBookState(direction) {
    const total = STORY_BOOKS[currentBookLang].totalPages;

    bookPages.forEach((page, index) => {
      if (index < currentBookPage) {
        page.classList.add('flipped');
        page.style.zIndex = index + 1;
      } else {
        page.classList.remove('flipped');
        page.style.zIndex = bookPages.length - index;
      }
    });

    // Elevate the actively flipping page so it stays on top of both stacks during animation
    if (direction === 'forward' && currentBookPage > 0) {
      bookPages[currentBookPage - 1].style.zIndex = 100;
    } else if (direction === 'backward' && currentBookPage < bookPages.length) {
      bookPages[currentBookPage].style.zIndex = 100;
    }

    if (prevBtn) prevBtn.disabled = currentBookPage === 0;
    if (nextBtn) nextBtn.disabled = currentBookPage === bookPages.length;

    if (pageIndicatorEl) {
      pageIndicatorEl.textContent = currentBookPage === 0 ? 'Cover Page' : String(currentBookPage);
    }
  }

  // Setup language switcher click events
  storyLangBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lang = btn.dataset.lang;
      if (lang === currentBookLang) return;
      setBookLanguage(lang, true);
    });
  });

  if (closedBookTrigger) {
    closedBookTrigger.addEventListener('click', () => {
      closedBookTrigger.style.display = 'none';
      if (openBookContainer) openBookContainer.style.display = 'flex';
      renderBookPages(false);
      resetZoom();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentBookPage > 0) {
        currentBookPage--;
        updateBookState('backward');
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentBookPage < bookPages.length) {
        currentBookPage++;
        updateBookState('forward');
      }
    });
  }

  // Zoom control buttons
  if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetZoom);
  if (zoomValEl) zoomValEl.addEventListener('click', resetZoom);

  // Zoom wrapper interactive events (Panning, Wheel, Double Click, Touch Pinch)
  if (flipbookZoomWrapper) {
    // Mouse drag for panning when zoomed
    flipbookZoomWrapper.addEventListener('mousedown', (e) => {
      if (currentZoom <= 1.0) return;
      if (e.target.closest('.book-nav') || e.target.closest('.book-zoom-bar')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startPanX = currentPanX;
      startPanY = currentPanY;
      flipbookZoomWrapper.classList.add('is-dragging');
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      currentPanX = startPanX + dx;
      currentPanY = startPanY + dy;
      applyZoomTransform(false);
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        flipbookZoomWrapper.classList.remove('is-dragging');
        applyZoomTransform(true);
      }
    });

    // Mouse wheel zoom
    flipbookZoomWrapper.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        currentZoom = Math.min(2.5, Math.round((currentZoom + 0.2) * 100) / 100);
      } else {
        currentZoom = Math.max(1.0, Math.round((currentZoom - 0.2) * 100) / 100);
        if (currentZoom === 1.0) {
          currentPanX = 0;
          currentPanY = 0;
        }
      }
      applyZoomTransform(true);
    }, { passive: false });

    // Double click to toggle zoom
    flipbookZoomWrapper.addEventListener('dblclick', (e) => {
      if (e.target.closest('.book-nav') || e.target.closest('.book-zoom-bar')) return;
      if (currentZoom > 1.0) {
        resetZoom();
      } else {
        currentZoom = 1.6;
        applyZoomTransform(true);
      }
    });

    // Touch events for mobile dragging & pinch-to-zoom
    flipbookZoomWrapper.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        if (currentZoom <= 1.0) return;
        isDragging = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startPanX = currentPanX;
        startPanY = currentPanY;
        flipbookZoomWrapper.classList.add('is-dragging');
      } else if (e.touches.length === 2) {
        isDragging = false;
        initialPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialPinchZoom = currentZoom;
      }
    }, { passive: false });

    flipbookZoomWrapper.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && isDragging) {
        e.preventDefault();
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        currentPanX = startPanX + dx;
        currentPanY = startPanY + dy;
        applyZoomTransform(false);
      } else if (e.touches.length === 2 && initialPinchDist) {
        e.preventDefault();
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scaleFactor = currentDist / initialPinchDist;
        currentZoom = Math.min(2.5, Math.max(1.0, Math.round(initialPinchZoom * scaleFactor * 100) / 100));
        applyZoomTransform(false);
      }
    }, { passive: false });

    flipbookZoomWrapper.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        isDragging = false;
        initialPinchDist = null;
        flipbookZoomWrapper.classList.remove('is-dragging');
        applyZoomTransform(true);
      }
    });
  }

  // Keyboard navigation & zoom shortcuts
  window.addEventListener('keydown', (e) => {
    if (!storyModal || !storyModal.classList.contains('active')) return;

    if (openBookContainer && openBookContainer.style.display !== 'none') {
      if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        zoomOut();
      } else if (e.key === '0') {
        resetZoom();
      } else if (e.key === 'ArrowLeft') {
        if (prevBtn && !prevBtn.disabled) prevBtn.click();
      } else if (e.key === 'ArrowRight') {
        if (nextBtn && !nextBtn.disabled) nextBtn.click();
      }
    }
    if (e.key === 'Escape') {
      closeStoryModal();
    }
  });

  function closeStoryModal() {
    if (storyModal) {
      storyModal.classList.remove('active');
      document.body.style.overflow = '';
      var nbEl = document.querySelector('.navbar'); if (nbEl) nbEl.style.display = '';

      // Reset back to closed book state after animation
      setTimeout(() => {
        if (closedBookTrigger) closedBookTrigger.style.display = 'flex';
        if (openBookContainer) openBookContainer.style.display = 'none';
        currentBookPage = 0;
        resetZoom();
        if (isBookInitialized) updateBookState();
      }, 400);
    }
  }

  if (openStoryBtn && storyModal) {
    openStoryBtn.addEventListener('click', () => {
      setBookLanguage(currentBookLang, false);
      storyModal.classList.add('active');
      document.body.style.overflow = 'hidden';
      var nb = document.querySelector('.navbar'); if (nb) nb.style.display = 'none';
    });
  }

  if (storyModalClose) {
    storyModalClose.addEventListener('click', closeStoryModal);
  }

  if (storyModal) {
    storyModal.addEventListener('click', (e) => {
      if (e.target.closest('#story-top-controls') || e.target.closest('#closed-book-trigger') || e.target.closest('#open-book-container')) return;
      if (e.target === storyModal || e.target.classList.contains('story-modal-content')) {
        closeStoryModal();
      }
    });
  }

  // Initial language setup from localStorage/default
  setBookLanguage(currentBookLang, false);

})();


  // Page-specific code consolidated from admin.html.
  if (document.body.classList.contains('admin-page')) {
document.addEventListener('DOMContentLoaded', () => {
      const loginSection = document.getElementById('login-section');
      const dashboardSection = document.getElementById('dashboard-section');
      const loginForm = document.getElementById('admin-login-form');
      const logoutBtn = document.getElementById('admin-logout-btn');
      const logoutNavItem = document.getElementById('logout-nav-item');

      // Sevas Elements
      const addSevaForm = document.getElementById('add-seva-form');
      const sevasTbody = document.getElementById('admin-sevas-tbody');
      const filterSelect = document.getElementById('filter-category');
      const resetBtn = document.getElementById('reset-default-btn');

      // Calendar Specials Elements
      const addSpecialForm = document.getElementById('add-calendar-special-form');
      const specialDateInput = document.getElementById('special-date');
      const specialNameInput = document.getElementById('special-name');
      const specialsTbody = document.getElementById('calendar-specials-tbody');
      const filterSpecialsSearch = document.getElementById('filter-specials-search');
      const refreshSpecialsBtn = document.getElementById('refresh-specials-btn');

      // Tab Buttons & Panes
      const tabBtnCalendar = document.getElementById('tab-btn-calendar');
      const tabBtnSevas = document.getElementById('tab-btn-sevas');
      const tabBtnBookedSevas = document.getElementById('tab-btn-booked-sevas');
      const calendarTabPane = document.getElementById('calendar-tab-pane');
      const sevasTabPane = document.getElementById('sevas-tab-pane');
      const bookedSevasTabPane = document.getElementById('booked-sevas-tab-pane');
      const bookedSevasTbody = document.getElementById('booked-sevas-tbody');
      const bookedSevasSearch = document.getElementById('filter-booked-sevas');
      const refreshBookedSevasBtn = document.getElementById('refresh-booked-sevas-btn');
      const openCalendarModalBtn = document.getElementById('open-calendar-modal-btn');
      let bookedSevas = [];
      let bookedSevasLoading = false;

      const AUTH_KEY = 'temple_admin_auth';

      function checkAuth() {
        return localStorage.getItem(AUTH_KEY) === 'true';
      }

      function updateUIState(authenticated = checkAuth()) {
        if (authenticated) {
          loginSection.style.display = 'none';
          dashboardSection.style.display = 'block';
          logoutNavItem.style.display = 'block';
          renderSevasTable(filterSelect.value);
          renderSpecialsTable();
          renderBookedSevas();
        } else {
          loginSection.style.display = 'flex';
          dashboardSection.style.display = 'none';
          logoutNavItem.style.display = 'none';
        }
      }

      async function syncAuthState() {
        if (!checkAuth()) {
          updateUIState(false);
          return;
        }
        try {
          const response = await fetch('/api/admin/session', { cache: 'no-store', credentials: 'same-origin' });
          const result = await response.json();
          if (!response.ok || !result.authenticated) {
            localStorage.removeItem(AUTH_KEY);
            updateUIState(false);
            return;
          }
          updateUIState(true);
        } catch {
          localStorage.removeItem(AUTH_KEY);
          updateUIState(false);
        }
      }

      window.addEventListener('temple:admin-session-expired', () => {
        localStorage.removeItem(AUTH_KEY);
        updateUIState(false);
        showNotification('Your admin session expired. Please log in again.', true);
      });

      // Tab Switching
      function switchTab(activeTab) {
        if (activeTab === 'calendar') {
          tabBtnCalendar.classList.add('active');
          tabBtnSevas.classList.remove('active');
          tabBtnBookedSevas.classList.remove('active');
          calendarTabPane.style.display = 'block';
          sevasTabPane.style.display = 'none';
          bookedSevasTabPane.style.display = 'none';
          renderSpecialsTable();
        } else if (activeTab === 'sevas') {
          tabBtnSevas.classList.add('active');
          tabBtnCalendar.classList.remove('active');
          tabBtnBookedSevas.classList.remove('active');
          sevasTabPane.style.display = 'block';
          calendarTabPane.style.display = 'none';
          bookedSevasTabPane.style.display = 'none';
          renderSevasTable(filterSelect.value);
        } else {
          tabBtnBookedSevas.classList.add('active');
          tabBtnCalendar.classList.remove('active');
          tabBtnSevas.classList.remove('active');
          bookedSevasTabPane.style.display = 'block';
          calendarTabPane.style.display = 'none';
          sevasTabPane.style.display = 'none';
          renderBookedSevas();
        }
      }

      tabBtnCalendar.addEventListener('click', () => switchTab('calendar'));
      tabBtnSevas.addEventListener('click', () => switchTab('sevas'));
      tabBtnBookedSevas.addEventListener('click', () => switchTab('booked-sevas'));

      // Quick Date Buttons
      function formatDateToISO(d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }

      // Default date to today
      const todayISO = formatDateToISO(new Date());
      if (specialDateInput && !specialDateInput.value) {
        specialDateInput.value = todayISO;
      }

      document.getElementById('quick-date-today').addEventListener('click', () => {
        specialDateInput.value = formatDateToISO(new Date());
      });

      document.getElementById('quick-date-tomorrow').addEventListener('click', () => {
        const tom = new Date();
        tom.setDate(tom.getDate() + 1);
        specialDateInput.value = formatDateToISO(tom);
      });

      document.getElementById('quick-date-calendar').addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof window.openTempleCalendar === 'function') {
          window.openTempleCalendar();
        } else {
          const calFab = document.getElementById('calendar-btn');
          if (calFab) calFab.click();
        }
      });

      // Quick Tag suggestions
      document.querySelectorAll('.quick-tag-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const tag = chip.getAttribute('data-tag');
          if (!specialNameInput.value.trim()) {
            specialNameInput.value = tag;
          } else {
            specialNameInput.value += ', ' + tag;
          }
          specialNameInput.focus();
        });
      });

      // Global hook for selecting a date from the calendar modal
      window.selectAdminSpecialDate = function(dateStr) {
        switchTab('calendar');
        specialDateInput.value = dateStr;
        specialNameInput.focus();
        specialNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };

      if (openCalendarModalBtn) {
        openCalendarModalBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (typeof window.openTempleCalendar === 'function') {
            window.openTempleCalendar();
          } else {
            const calFab = document.getElementById('calendar-btn');
            if (calFab) calFab.click();
          }
        });
      }

      // ==========================================
      // CALENDAR SPECIALS TABLE RENDERING & LOGIC
      // ==========================================
      function renderSpecialsTable() {
        if (!window.CalendarStore) return;
        const query = (filterSpecialsSearch.value || '').toLowerCase().trim();

        window.CalendarStore.fetchCalendar((data) => {
          const entries = Object.keys(data || {}).sort();

          const filtered = entries.filter(dateKey => {
            if (!query) return true;
            if (dateKey.toLowerCase().includes(query)) return true;
            const specials = data[dateKey] || [];
            return specials.some(s => s.toLowerCase().includes(query));
          });

          if (filtered.length === 0) {
            specialsTbody.innerHTML = `
              <tr>
                <td colspan="4" class="empty-msg" style="text-align:center; padding: 2rem;">
                  No scheduled specials of the day found. Use the form above to add a special to any calendar date!
                </td>
              </tr>
            `;
            return;
          }

          specialsTbody.innerHTML = filtered.map(dateKey => {
            const specials = data[dateKey] || [];
            const tagsHtml = specials.map((s, idx) => `
              <span class="special-tag-item">
                <span>🌟 ${escapeHTML(s)}</span>
                <button type="button" class="delete-tag-btn btn-remove-special" data-date="${escapeHTML(dateKey)}" data-index="${idx}" data-special="${escapeHTML(s)}" title="Remove this special program">✕ Remove</button>
              </span>
            `).join(' ');

            return `
              <tr>
                <td>
                  <strong style="color: var(--gold-300); font-family: monospace; font-size: 0.95rem;">
                    ${escapeHTML(dateKey)}
                  </strong>
                </td>
                <td>
                  <div class="specials-tags-list">
                    ${tagsHtml}
                  </div>
                </td>
                <td style="text-align: center;">
                  <span class="category-tag">${specials.length} Program${specials.length > 1 ? 's' : ''}</span>
                </td>
                <td>
                  <div class="calendar-action-btns">
                    <button type="button" class="btn-table-action btn-add-more" data-date="${escapeHTML(dateKey)}" title="Add another special for this date">
                      ➕ Add More
                    </button>
                    <button type="button" class="btn-table-action btn-view-cal" data-date="${escapeHTML(dateKey)}" title="View on Temple Calendar">
                      📅 View
                    </button>
                    <button type="button" class="delete-btn btn-clear-date btn-remove-date" data-date="${escapeHTML(dateKey)}" title="Remove all specials for this date">
                      🗑️ Remove Date
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('');
        }).catch((error) => {
          specialsTbody.innerHTML = `<tr><td colspan="4" class="empty-msg" style="text-align:center; padding: 2rem;">Could not load specials from Neon: ${escapeHTML(error.message)}</td></tr>`;
        });
      }

      // In-page Toast Notification Helper
      function showNotification(msg, isError = false) {
        let toast = document.getElementById('admin-toast');
        if (!toast) {
          toast = document.createElement('div');
          toast.id = 'admin-toast';
          document.body.appendChild(toast);
        }
        toast.style.cssText = 'position:fixed; bottom:25px; right:25px; z-index:999999; background:rgba(20, 18, 12, 0.96); border:1px solid ' + (isError ? '#ff4d4d' : '#ffd700') + '; color:' + (isError ? '#ff8080' : '#ffd700') + '; padding:12px 22px; border-radius:8px; box-shadow:0 10px 35px rgba(0,0,0,0.85); font-family:sans-serif; font-size:0.92rem; pointer-events:none; transition:opacity 0.3s ease; display:block; opacity:1;';
        toast.textContent = msg;
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
          toast.style.opacity = '0';
          setTimeout(() => { toast.style.display = 'none'; }, 300);
        }, 3200);
      }

      // Add Special Handler
      addSpecialForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const dateVal = specialDateInput.value ? specialDateInput.value.trim() : '';
        const specialVal = specialNameInput.value ? specialNameInput.value.trim() : '';

        if (!dateVal || !specialVal) {
          showNotification('⚠️ Please specify both a Date and a Special program name.', true);
          return;
        }

        window.CalendarStore.addSpecial(dateVal, specialVal, () => {
          showNotification(`✅ Added "${specialVal}" for ${dateVal}!`);
          specialNameInput.value = '';
          renderSpecialsTable();
          if (window.refreshCalendarData) {
            window.refreshCalendarData();
          }
        }).catch((error) => showNotification(`❌ ${error.message}`, true));
      });

      // Specials Actions delegation (remove single tag, remove date, add more, view)
      specialsTbody.addEventListener('click', (e) => {
        // Remove single special program
        const removeTagBtn = e.target.closest('.delete-tag-btn, .btn-remove-special');
        if (removeTagBtn) {
          e.preventDefault();
          e.stopPropagation();
          const date = removeTagBtn.getAttribute('data-date');
          const index = parseInt(removeTagBtn.getAttribute('data-index'), 10);
          const specialText = removeTagBtn.getAttribute('data-special') || '';
          if (date) {
            window.CalendarStore.deleteSpecial(date, { index: isNaN(index) ? null : index, special: specialText }, () => {
              showNotification(`🗑️ Special removed from ${date}`);
              renderSpecialsTable();
              if (window.refreshCalendarData) window.refreshCalendarData();
            }).catch((error) => showNotification(`❌ ${error.message}`, true));
          }
          return;
        }

        // Remove all specials for date
        const clearBtn = e.target.closest('.btn-clear-date, .btn-remove-date');
        if (clearBtn) {
          e.preventDefault();
          e.stopPropagation();
          const date = clearBtn.getAttribute('data-date');
          if (date) {
            window.CalendarStore.deleteSpecial(date, null, () => {
              showNotification(`🗑️ All specials removed for ${date}`);
              renderSpecialsTable();
              if (window.refreshCalendarData) window.refreshCalendarData();
            }).catch((error) => showNotification(`❌ ${error.message}`, true));
          }
          return;
        }

        // Add more specials for this date
        const addMoreBtn = e.target.closest('.btn-add-more');
        if (addMoreBtn) {
          e.preventDefault();
          const date = addMoreBtn.getAttribute('data-date');
          specialDateInput.value = date;
          specialNameInput.focus();
          specialNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }

        // View date in calendar modal
        const viewCalBtn = e.target.closest('.btn-view-cal');
        if (viewCalBtn) {
          e.preventDefault();
          const date = viewCalBtn.getAttribute('data-date');
          if (typeof window.openCalendarToDate === 'function') {
            window.openCalendarToDate(date);
          } else if (typeof window.openTempleCalendar === 'function') {
            window.openTempleCalendar();
          } else {
            const calFab = document.getElementById('calendar-btn');
            if (calFab) calFab.click();
          }
          return;
        }
      });

      filterSpecialsSearch.addEventListener('input', () => {
        renderSpecialsTable();
      });

      refreshSpecialsBtn.addEventListener('click', () => {
        renderSpecialsTable();
      });

      // ==========================================
      // SEVAS TABLE RENDERING & LOGIC
      // ==========================================
      async function renderSevasTable(catFilter) {
        if (!window.SevaStore) return;
        try {
          await window.SevaStore.fetchSevas((sevas) => {
          const filtered = catFilter === 'all' ? sevas : sevas.filter(s => s.category === catFilter);

          if (filtered.length === 0) {
            sevasTbody.innerHTML = '<tr><td colspan="5" class="empty-msg">No Sevas found under this subsection.</td></tr>';
            return;
          }

          sevasTbody.innerHTML = filtered.map(s => `
            <tr>
              <td><strong>${escapeHTML(s.name)}</strong></td>
              <td><span class="category-tag">${escapeHTML(s.categoryName || s.category)}</span></td>
              <td><strong class="price-val">₹ ${escapeHTML(s.price)}</strong></td>
              <td class="desc-col">${escapeHTML(s.desc || 'No description provided.')}</td>
              <td>
                <button class="delete-btn btn-delete-seva" data-id="${escapeHTML(s.id)}">Delete</button>
              </td>
            </tr>
          `).join('');
          });
        } catch (error) {
          sevasTbody.innerHTML = `<tr><td colspan="5" class="empty-msg">${escapeHTML(error.message)}</td></tr>`;
        }
      }

      function normalizeBookedSeva(booking) {
        let offerings = booking.sevas ?? booking.items ?? [];
        if (typeof offerings === 'string') {
          try { offerings = JSON.parse(offerings); } catch { offerings = []; }
        }
        if (!Array.isArray(offerings)) offerings = [];

        return {
          id: booking.id,
          uniqueId: booking.uniqueId ?? booking.unique_id ?? '',
          sevaDate: booking.sevaDate || booking.seva_date || booking.date || '',
          devoteeName: booking.devoteeName || booking.devotee_name || booking.name || '',
          email: booking.email || '',
          nakshatra: booking.nakshatra || booking.star || '',
          phone: booking.phone || '',
          address: booking.address || '',
          prayerNotes: booking.prayerNotes || booking.prayer_notes || '',
          totalAmount: booking.totalAmount ?? booking.total_amount ?? booking.amount ?? 0,
          paymentStatus: booking.paymentStatus || booking.payment_status || 'unverified',
          sevas: offerings.map(item => {
            const quantity = Number(item.quantity ?? item.qty ?? 1);
            const unitPrice = Number(item.unitPrice ?? item.unit_price ?? item.price ?? 0);
            return {
              ...item,
              name: item.name || item.seva_name || item.title || 'Seva',
              quantity,
              lineTotal: item.lineTotal ?? item.line_total ?? unitPrice * quantity
            };
          })
        };
      }

      function drawBookedSevas() {
        const query = (bookedSevasSearch.value || '').trim().toLowerCase();
        const filtered = bookedSevas.filter(booking => {
          if (!query) return true;
          const offerings = (booking.sevas || []).map(item => item.name).join(' ');
          return [booking.uniqueId, booking.sevaDate, booking.devoteeName, booking.email, booking.nakshatra,
            booking.phone, booking.address, booking.prayerNotes, offerings]
            .some(value => String(value || '').toLowerCase().includes(query));
        });

        if (!filtered.length) {
          bookedSevasTbody.innerHTML = `<tr><td colspan="8" class="empty-msg">${query ? 'No bookings match your search.' : 'No active seva bookings.'}</td></tr>`;
          return;
        }

        const formatSevaDate = value => {
          const [year, month, day] = String(value).split('-').map(Number);
          return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
          });
        };
        bookedSevasTbody.innerHTML = filtered.map(booking => {
          const offerings = (booking.sevas || []).map(item =>
            `<div><strong>${escapeHTML(item.name)}</strong> ×${escapeHTML(item.quantity)} <span class="booking-line-price">₹ ${escapeHTML(item.lineTotal)}</span></div>`
          ).join('');
          const prayer = booking.prayerNotes
            ? `<div class="booking-prayer-note"><strong>Prayer:</strong> ${escapeHTML(booking.prayerNotes)}</div>` : '';
          return `
            <tr>
              <td><strong>${escapeHTML(booking.uniqueId || '—')}</strong></td>
              <td><strong>${escapeHTML(formatSevaDate(booking.sevaDate))}</strong></td>
              <td class="booking-offerings">${offerings}</td>
              <td><strong>${escapeHTML(booking.devoteeName)}</strong><div class="booking-secondary">${escapeHTML(booking.nakshatra)}</div></td>
              <td><a href="mailto:${escapeHTML(booking.email)}">${escapeHTML(booking.email)}</a><div class="booking-secondary">${escapeHTML(booking.phone)}</div></td>
              <td class="booking-address">${escapeHTML(booking.address)}${prayer}</td>
              <td><strong>₹ ${escapeHTML(Number(booking.totalAmount).toFixed(2))}</strong><div class="booking-payment-status">Payment unverified</div><div class="booking-review-status">Review: ${escapeHTML(booking.reviewStatus || 'pending')}</div></td>
              <td class="booking-actions">
                ${(!booking.reviewStatus || booking.reviewStatus === 'pending') ? `
                  <button type="button" class="btn-secondary-gold btn-review-booking" data-id="${escapeHTML(booking.id)}" data-decision="approved">Approve</button>
                  <button type="button" class="delete-btn btn-review-booking" data-id="${escapeHTML(booking.id)}" data-decision="rejected">Reject</button>
                ` : ''}
                <button type="button" class="delete-btn btn-delete-booking" data-id="${escapeHTML(booking.id)}">Delete</button>
              </td>
            </tr>
          `;
        }).join('');
      }

      async function renderBookedSevas() {
        if (!bookedSevasTbody || bookedSevasLoading) return;
        bookedSevasLoading = true;
        if (!bookedSevas.length) {
          bookedSevasTbody.innerHTML = '<tr><td colspan="8" class="empty-msg">Loading bookings…</td></tr>';
        }
        try {
          const response = await fetch('/api/bookings', { cache: 'no-store', credentials: 'same-origin' });
          const result = await response.json();
          window.notifyAdminSessionExpired(response);
          if (!response.ok) throw new Error(result.error || 'Could not load booked sevas.');
          const rows = Array.isArray(result) ? result
            : Array.isArray(result.bookings) ? result.bookings
              : Array.isArray(result.data) ? result.data : null;
          if (!rows) throw new Error('The bookings response was not in a recognized format.');
          bookedSevas = rows.map(normalizeBookedSeva);
          drawBookedSevas();
        } catch (error) {
          bookedSevasTbody.innerHTML = `<tr><td colspan="8" class="empty-msg">${escapeHTML(error.message)}</td></tr>`;
        } finally {
          bookedSevasLoading = false;
        }
      }

      bookedSevasTbody.addEventListener('click', async event => {
        const reviewButton = event.target.closest('.btn-review-booking');
        if (reviewButton) {
          const id = reviewButton.getAttribute('data-id');
          const decision = reviewButton.getAttribute('data-decision');
          const booking = bookedSevas.find(item => item.id === id);
          const actionLabel = decision === 'approved' ? 'approve' : 'reject';
          if (!booking || !confirm(`Are you sure you want to ${actionLabel} ${booking.devoteeName}'s Seva booking and email the decision with the booking details to ${booking.email}?`)) return;
          const rowButtons = [...reviewButton.closest('tr').querySelectorAll('.btn-review-booking')];
          rowButtons.forEach(button => { button.disabled = true; });
          try {
            const response = await fetch('/api/bookings', {
              method: 'PATCH',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': window.SevaStore.getCsrfToken() },
              body: JSON.stringify({ id, decision })
            });
            const result = await response.json();
            notifyAdminSessionExpired(response);
            if (!response.ok) throw new Error(result.error || 'Could not update this booking.');
            showNotification(`Booking ${decision} and email sent to ${booking.email}.`);
            await renderBookedSevas();
          } catch (error) {
            await renderBookedSevas();
            showNotification(error.message, true);
          }
          return;
        }
        const button = event.target.closest('.btn-delete-booking');
        if (!button) return;
        const id = button.getAttribute('data-id');
        if (!id || !confirm('Delete this seva booking?')) return;
        button.disabled = true;
        try {
          const response = await fetch(`/api/bookings?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
            credentials: 'same-origin',
            headers: { 'X-XSRF-TOKEN': window.SevaStore.getCsrfToken() }
          });
          const result = await response.json();
          window.notifyAdminSessionExpired(response);
          if (!response.ok) throw new Error(result.error || 'Could not delete this booking.');
          showNotification('Booking deleted.');
          await renderBookedSevas();
        } catch (error) {
          button.disabled = false;
          showNotification(error.message, true);
        }
      });

      bookedSevasSearch.addEventListener('input', drawBookedSevas);
      refreshBookedSevasBtn.addEventListener('click', () => renderBookedSevas());
      window.setInterval(() => {
        if (checkAuth() && !document.hidden && bookedSevasTabPane.style.display !== 'none') {
          renderBookedSevas();
        }
      }, 15000);
      window.addEventListener('focus', () => {
        if (checkAuth() && bookedSevasTabPane.style.display !== 'none') renderBookedSevas();
      });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && checkAuth() && bookedSevasTabPane.style.display !== 'none') {
          renderBookedSevas();
        }
      });

      // Delete Seva listener
      sevasTbody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-delete-seva')) {
          const id = e.target.getAttribute('data-id');
          if (confirm('Are you sure you want to delete this Seva?')) {
            window.SevaStore.deleteSeva(id, () => {
              renderSevasTable(filterSelect.value);
            }).catch(error => alert(error.message));
          }
        }
      });

      // Add Seva handler
      addSevaForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('seva-name').value;
        const category = document.getElementById('seva-category').value;
        const price = document.getElementById('seva-price').value;
        const desc = document.getElementById('seva-desc').value;

        if (!name || !category || !price) {
          alert('Please fill in Name, Subsection, and Price.');
          return;
        }

        window.SevaStore.addSeva({ name, category, price, desc }, () => {
          alert(`Successfully added Seva "${name}" under ${category}!`);
          addSevaForm.reset();
          renderSevasTable(filterSelect.value);
        }).catch(error => alert(error.message));
      });

      // Filter change listener
      filterSelect.addEventListener('change', () => {
        renderSevasTable(filterSelect.value);
      });

      // Reset listener
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset to default initial Sevas list?')) {
          window.SevaStore.resetSevas(() => {
            renderSevasTable('all');
          }).catch(error => alert(error.message));
        }
      });

      // Login handler
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('admin-user').value.trim();
        const pass = document.getElementById('admin-pass').value.trim();

        try {
          const response = await fetch('/api/admin/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ username: user, password: pass })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Login failed.');
          localStorage.setItem(AUTH_KEY, 'true');
          await syncAuthState();
          if (!checkAuth()) throw new Error('The phone did not retain the secure admin session. Please allow site cookies and try again.');
        } catch (error) {
          alert(error.message);
        }
      });

      // Logout handler
      logoutBtn.addEventListener('click', async () => {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { 'X-XSRF-TOKEN': window.SevaStore.getCsrfToken() },
          credentials: 'same-origin'
        });
        localStorage.removeItem(AUTH_KEY);
        updateUIState();
      });

      syncAuthState();
    });
  }


  // Page-specific code consolidated from booking.html.
  if (document.body.classList.contains('booking-page')) {
document.addEventListener('DOMContentLoaded', () => {
      localStorage.removeItem('templePendingSevaBooking');
      const categoryTabsEl = document.getElementById('booking-category-tabs');
      const sevaSelectGrid = document.getElementById('seva-select-grid');
      const sevaSearch = document.getElementById('booking-seva-search');
      const selectedSummaryBar = document.getElementById('selected-summary-bar');
      const selectedCountBadge = document.getElementById('selected-count-badge');
      const selectedAmountPreview = document.getElementById('selected-amount-preview');
      const proceedBtn = document.getElementById('proceed-to-details-btn');
      const scrollDownBtn = document.getElementById('booking-scroll-down');
      const step1 = document.getElementById('step-select-sevas');
      const step2 = document.getElementById('step-devotee-details');
      const selectedSevasReview = document.getElementById('selected-sevas-review');
      const totalPriceEl = document.getElementById('booking-seva-price');
      const form = document.getElementById('booking-form');
      const bookingDateInput = document.getElementById('devotee-date');
      const bookingDateDisplay = document.getElementById('devotee-date-display');
      const bookingDatePicker = document.getElementById('booking-date-picker');
      const bookingDateToggle = document.getElementById('booking-date-toggle');
      const bookingCalendar = document.getElementById('booking-date-calendar');
      const bookingCalendarMonth = document.getElementById('booking-calendar-month');
      const bookingCalendarDays = document.getElementById('booking-calendar-days');
      const bookingCalendarPrev = document.getElementById('booking-calendar-prev');
      const bookingCalendarNext = document.getElementById('booking-calendar-next');
      const backBtn = document.getElementById('back-to-step1-btn');
      const payButton = document.getElementById('pay-submit-btn');
      const payButtonLabel = payButton.querySelector('span');
      let minimumBookingDate = '';
      let calendarMonth = null;

      function getScrollDownTarget() {
        if (selectedSummaryBar.style.display !== 'none') return selectedSummaryBar;
        return sevaSelectGrid.lastElementChild || step1;
      }

      function updateScrollDownButton() {
        const target = getScrollDownTarget();
        if (step1.style.display === 'none' || !target || document.documentElement.scrollHeight <= window.innerHeight + 1) {
          scrollDownBtn.hidden = true;
          return;
        }

        const targetBounds = target.getBoundingClientRect();
        const clearViewportBottom = window.innerHeight - 88;
        scrollDownBtn.hidden = targetBounds.top >= 0 && targetBounds.bottom <= clearViewportBottom;
      }

      scrollDownBtn.addEventListener('click', () => {
        const target = getScrollDownTarget();
        if (!target) return;

        target.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'center'
        });

        const focusTarget = target === selectedSummaryBar
          ? proceedBtn
          : target.querySelector('.seva-checkbox');
        if (focusTarget) focusTarget.focus({ preventScroll: true });
      });

      window.addEventListener('scroll', updateScrollDownButton, { passive: true });
      window.addEventListener('resize', updateScrollDownButton);

      function dateToKey(date) {
        return [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, '0'),
          String(date.getDate()).padStart(2, '0')
        ].join('-');
      }

      function dateFromKey(dateKey) {
        if (!dateKey) return null;
        const [year, month, day] = dateKey.split('-').map(Number);
        return new Date(year, month - 1, day);
      }

      function updateBookingDateMinimum() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        minimumBookingDate = dateToKey(tomorrow);
        if (bookingDateInput.value && bookingDateInput.value < minimumBookingDate) {
          bookingDateInput.value = '';
          bookingDateDisplay.value = '';
        }
      }

      updateBookingDateMinimum();

      function setCalendarExpanded(expanded) {
        const state = String(expanded);
        bookingDateDisplay.setAttribute('aria-expanded', state);
        bookingDateToggle.setAttribute('aria-expanded', state);
        bookingCalendar.hidden = !expanded;
      }

      function renderBookingCalendar() {
        updateBookingDateMinimum();
        const firstOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
        const monthStartKey = dateToKey(firstOfMonth).slice(0, 7);
        const minimumMonthKey = minimumBookingDate.slice(0, 7);
        bookingCalendarMonth.textContent = firstOfMonth.toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric'
        });
        bookingCalendarPrev.disabled = monthStartKey <= minimumMonthKey;

        const dayOffset = firstOfMonth.getDay();
        const daysInMonth = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth() + 1, 0).getDate();
        const visibleDayCount = Math.ceil((dayOffset + daysInMonth) / 7) * 7;
        const gridStart = new Date(firstOfMonth);
        gridStart.setDate(gridStart.getDate() - dayOffset);
        const selectedDate = bookingDateInput.value;
        const todayKey = dateToKey(new Date());

        bookingCalendarDays.innerHTML = '';
        for (let index = 0; index < visibleDayCount; index++) {
          const date = new Date(gridStart);
          date.setDate(gridStart.getDate() + index);
          const dateKey = dateToKey(date);
          const isCurrentMonth = date.getMonth() === firstOfMonth.getMonth();
          const dayButton = document.createElement('button');
          dayButton.type = 'button';
          dayButton.className = 'booking-calendar-day';
          if (!isCurrentMonth) dayButton.classList.add('outside-month');
          if (dateKey === todayKey) dayButton.classList.add('today');
          if (dateKey === selectedDate) dayButton.classList.add('selected');
          dayButton.disabled = !isCurrentMonth || dateKey < minimumBookingDate;
          dayButton.dataset.date = dateKey;
          dayButton.setAttribute('aria-label', date.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          }));
          dayButton.setAttribute('aria-pressed', String(dateKey === selectedDate));
          dayButton.textContent = String(date.getDate());
          bookingCalendarDays.appendChild(dayButton);
        }
      }

      function openBookingCalendar() {
        updateBookingDateMinimum();
        const focusDate = dateFromKey(bookingDateInput.value || minimumBookingDate);
        calendarMonth = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
        renderBookingCalendar();
        setCalendarExpanded(true);
        const initialDay = bookingCalendarDays.querySelector(`[data-date="${bookingDateInput.value || minimumBookingDate}"]`);
        if (initialDay && !initialDay.disabled) initialDay.focus();
      }

      function closeBookingCalendar(returnFocus = false) {
        if (bookingCalendar.hidden) return;
        setCalendarExpanded(false);
        if (returnFocus) bookingDateDisplay.focus();
      }

      function moveCalendarMonth(offset) {
        if (!calendarMonth) return;
        calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1);
        renderBookingCalendar();
      }

      bookingDateDisplay.addEventListener('click', openBookingCalendar);
      bookingDateDisplay.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
          event.preventDefault();
          openBookingCalendar();
        }
      });
      bookingDateToggle.addEventListener('click', () => {
        if (bookingCalendar.hidden) openBookingCalendar();
        else closeBookingCalendar(true);
      });
      bookingCalendarPrev.addEventListener('click', () => moveCalendarMonth(-1));
      bookingCalendarNext.addEventListener('click', () => moveCalendarMonth(1));
      bookingCalendarDays.addEventListener('click', event => {
        const dayButton = event.target.closest('[data-date]');
        if (!dayButton || dayButton.disabled) return;
        bookingDateInput.value = dayButton.dataset.date;
        bookingDateDisplay.value = dateFromKey(dayButton.dataset.date).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        closeBookingCalendar(true);
      });
      bookingCalendarDays.addEventListener('keydown', event => {
        const dayButton = event.target.closest('[data-date]');
        if (!dayButton || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const date = dateFromKey(dayButton.dataset.date);
        const offset = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -7 : 7;
        date.setDate(date.getDate() + offset);
        const nextKey = dateToKey(date);
        if (nextKey < minimumBookingDate) return;
        calendarMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        renderBookingCalendar();
        bookingCalendarDays.querySelector(`[data-date="${nextKey}"]`)?.focus();
      });
      bookingDatePicker.addEventListener('click', event => event.stopPropagation());
      document.addEventListener('click', event => {
        if (!bookingDatePicker.contains(event.target)) closeBookingCalendar();
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !bookingCalendar.hidden) {
          event.preventDefault();
          closeBookingCalendar(true);
        }
      });

      // Map: sevaId -> { seva, quantity }
      let selectedSevas = {};
      let allSevasData = [];
      let currentCat = 'all';
      let searchTerm = '';
      const subsections = SevaStore.subsections;

      // Build category tabs
      subsections.forEach(sub => {
        const btn = document.createElement('button');
        btn.className = 'bk-tab';
        btn.setAttribute('data-cat', sub.id);
        btn.textContent = sub.name;
        categoryTabsEl.appendChild(btn);
      });

      categoryTabsEl.addEventListener('click', e => {
        const tab = e.target.closest('.bk-tab');
        if (!tab) return;
        document.querySelectorAll('.bk-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentCat = tab.getAttribute('data-cat');
        renderSevaSelectGrid(currentCat);
      });

      sevaSearch.addEventListener('input', () => {
        searchTerm = sevaSearch.value.trim().toLocaleLowerCase();
        renderSevaSelectGrid(currentCat);
      });

      function getTotal() {
        return Object.values(selectedSevas).reduce((sum, s) => sum + (parseFloat(s.seva.price) * s.qty), 0);
      }

      function getSelectedCount() {
        return Object.values(selectedSevas).filter(s => s.qty > 0).length;
      }

      function updateSummaryBar() {
        const count = getSelectedCount();
        const total = getTotal();
        if (count > 0) {
          selectedSummaryBar.style.display = 'flex';
          selectedCountBadge.textContent = `${count} seva${count > 1 ? 's' : ''} selected`;
          selectedAmountPreview.textContent = `\u20B9 ${total.toFixed(0)}`;
        } else {
          selectedSummaryBar.style.display = 'none';
        }
        updateScrollDownButton();
      }

      function renderSevaSelectGrid(cat) {
        const categoryFiltered = (cat === 'all')
          ? allSevasData
          : allSevasData.filter(s => s.category === cat);
        const filtered = searchTerm
          ? categoryFiltered.filter(seva => [seva.name, seva.desc, seva.categoryName]
            .some(value => String(value || '').toLocaleLowerCase().includes(searchTerm)))
          : categoryFiltered;

        if (filtered.length === 0) {
          sevaSelectGrid.innerHTML = `<div class="no-sevas-msg">${searchTerm ? 'No Sevas match your search in this category.' : 'No Sevas available in this category.'}</div>`;
          updateScrollDownButton();
          return;
        }

        sevaSelectGrid.innerHTML = filtered.map(seva => {
          const sel = selectedSevas[seva.id];
          const qty = sel ? sel.qty : 0;
          const isChecked = qty > 0;
          return `
            <div class="seva-select-card ${isChecked ? 'seva-selected' : ''}" data-id="${escapeHTML(seva.id)}">
              <div class="seva-select-check">
                <input type="checkbox" class="seva-checkbox" id="chk-${escapeHTML(seva.id)}" data-id="${escapeHTML(seva.id)}" ${isChecked ? 'checked' : ''}>
                <label for="chk-${escapeHTML(seva.id)}" class="seva-select-info">
                  <span class="seva-select-pill">${escapeHTML(seva.categoryName || 'General')}</span>
                  <span class="seva-select-name">${escapeHTML(seva.name)}</span>
                  <span class="seva-select-desc">${escapeHTML(seva.desc || 'Sacred Vedic offering for devotee wellbeing.')}</span>
                </label>
              </div>
              <div class="seva-select-right">
                <span class="seva-select-price">\u20B9 ${escapeHTML(seva.price)}</span>
                <div class="qty-control ${isChecked ? '' : 'qty-hidden'}" id="qty-ctrl-${escapeHTML(seva.id)}">
                  <button class="qty-btn qty-minus" data-id="${escapeHTML(seva.id)}">&#8722;</button>
                  <span class="qty-val" id="qty-${escapeHTML(seva.id)}">${qty || 1}</span>
                  <button class="qty-btn qty-plus" data-id="${escapeHTML(seva.id)}">&#43;</button>
                </div>
              </div>
            </div>
          `;
        }).join('');

        // Attach listeners
        sevaSelectGrid.querySelectorAll('.seva-checkbox').forEach(chk => {
          chk.addEventListener('change', e => {
            const id = e.target.getAttribute('data-id');
            const seva = allSevasData.find(s => s.id === id);
            const card = sevaSelectGrid.querySelector(`.seva-select-card[data-id="${id}"]`);
            const qtyCtrl = document.getElementById(`qty-ctrl-${id}`);
            const qtyEl = document.getElementById(`qty-${id}`);

            if (e.target.checked) {
              selectedSevas[id] = { seva, qty: parseInt(qtyEl.textContent) || 1 };
              card.classList.add('seva-selected');
              qtyCtrl.classList.remove('qty-hidden');
            } else {
              delete selectedSevas[id];
              card.classList.remove('seva-selected');
              qtyCtrl.classList.add('qty-hidden');
            }
            updateSummaryBar();
          });
        });

        sevaSelectGrid.querySelectorAll('.qty-plus').forEach(btn => {
          btn.addEventListener('click', e => {
            const id = e.target.getAttribute('data-id');
            if (selectedSevas[id]) {
              selectedSevas[id].qty++;
              document.getElementById(`qty-${id}`).textContent = selectedSevas[id].qty;
              updateSummaryBar();
            }
          });
        });

        sevaSelectGrid.querySelectorAll('.qty-minus').forEach(btn => {
          btn.addEventListener('click', e => {
            const id = e.target.getAttribute('data-id');
            if (selectedSevas[id] && selectedSevas[id].qty > 1) {
              selectedSevas[id].qty--;
              document.getElementById(`qty-${id}`).textContent = selectedSevas[id].qty;
              updateSummaryBar();
            }
          });
        });

        updateScrollDownButton();
      }

      // Load sevas and render
      SevaStore.fetchSevas(data => {
        allSevasData = data;
        renderSevaSelectGrid('all');
      }).catch(error => {
        document.getElementById('seva-select-grid').innerHTML = `<div class="sevas-loading">${escapeHTML(error.message)}</div>`;
        updateScrollDownButton();
      });

      // Proceed to step 2
      proceedBtn.addEventListener('click', () => {
        const count = getSelectedCount();
        if (count === 0) {
          alert('Please select at least one Seva to proceed.');
          return;
        }

        // Build review
        const items = Object.values(selectedSevas).filter(s => s.qty > 0);
        const total = getTotal();
        selectedSevasReview.innerHTML = `
          <div class="review-sevas-list">
            <h4 class="review-title">Selected Sevas</h4>
            ${items.map(s => `
              <div class="review-seva-row">
                <div class="review-seva-info">
                  <span class="review-seva-pill">${escapeHTML(s.seva.categoryName || 'General')}</span>
                  <span class="review-seva-name">${escapeHTML(s.seva.name)}</span>
                  ${s.qty > 1 ? `<span class="review-qty-badge">x${s.qty}</span>` : ''}
                </div>
                <span class="review-seva-amt">\u20B9 ${(parseFloat(s.seva.price) * s.qty).toFixed(0)}</span>
              </div>
            `).join('')}
          </div>
        `;
        totalPriceEl.textContent = `\u20B9 ${total.toFixed(0)}`;

        step1.style.display = 'none';
        step2.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      // Back to step 1
      backBtn.addEventListener('click', () => {
        step2.style.display = 'none';
        step1.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      // Form submission
      form.addEventListener('submit', async e => {
        e.preventDefault();

        const name = document.getElementById('devotee-name').value.trim();
        const email = document.getElementById('devotee-email').value.trim();
        const star = document.getElementById('devotee-star').value.trim();
        const phone = document.getElementById('devotee-phone').value.trim();
        const bookingDate = bookingDateInput.value;
        const address = document.getElementById('devotee-address').value.trim();
        const notes = document.getElementById('devotee-notes').value.trim();

        updateBookingDateMinimum();
        if (!name || !email || !star || !phone || !address || !bookingDate || bookingDate < minimumBookingDate) {
          alert('Please enter Name, Email, Nakshatra, Phone Number, Address, and a valid Seva Date.');
          return;
        }

        const items = Object.values(selectedSevas).filter(s => s.qty > 0);
        if (!items.length) {
          alert('Please select at least one Seva to proceed.');
          return;
        }

        payButton.disabled = true;
        payButtonLabel.textContent = 'Saving booking…';
        let openingPaymentApp = false;
        try {
          const response = await fetch('/api/bookings', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              devoteeName: name,
              email,
              nakshatra: star,
              phone,
              sevaDate: bookingDate,
              address,
              prayerNotes: notes,
              items: items.map(item => ({ id: item.seva.id, quantity: item.qty }))
            })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Could not save the booking. Please try again.');

          const params = new URLSearchParams({
            pa: 'asvdcherai@sbi',
            pn: 'Azheekkal Sree Varaha Devaswam',
            tr: `ASVD${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            am: Number(result.amount).toFixed(2),
            cu: 'INR'
          });
          openingPaymentApp = true;
          payButtonLabel.textContent = 'Opening UPI app…';
          // UPI apps may treat form-style `+` spaces as literal plus signs.
          const encodedParams = params.toString().replace(/\+/g, '%20');
          window.location.href = `upi://pay?${encodedParams}`;
        } catch (error) {
          alert(error.message);
        } finally {
          if (!openingPaymentApp) {
            payButton.disabled = false;
            payButtonLabel.textContent = 'Continue to UPI app';
          }
        }
      });

    });
  }


  // Page-specific code consolidated from donate.html.
  if (document.body.classList.contains('donate-page')) {
const hamburger = document.getElementById('nav-hamburger');
    const mobileNav = document.getElementById('mobile-nav');

    hamburger.addEventListener('click', () => {
      const isOpen = hamburger.classList.toggle('active');
      mobileNav.classList.toggle('active', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
    });

    mobileNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        mobileNav.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }


  // Page-specific code consolidated from sevas.html.
  if (document.body.classList.contains('sevas-page')) {
document.addEventListener('DOMContentLoaded', () => {
      const gridContainer = document.getElementById('sevas-grid');
      const subGrid = document.getElementById('subsections-grid');
      const categoryTitle = document.getElementById('current-category-title');
      const sevasCount = document.getElementById('sevas-count');
      const sevaSearch = document.getElementById('seva-search');

      // 1. Render Subsection Tabs
      const subsections = SevaStore.subsections;
      subsections.forEach(sub => {
        const btn = document.createElement('button');
        btn.className = 'sub-tab';
        btn.setAttribute('data-category', sub.id);
        btn.innerHTML = `
          <span class="sub-icon">${sub.icon}</span>
          <span class="sub-name">${sub.name}</span>
        `;
        subGrid.appendChild(btn);
      });

      let currentCategory = 'all';
      let searchTerm = '';
      let latestSevas = [];

      function renderSevas(cat, sevas = null) {
        const renderList = (allSevas) => {
          latestSevas = allSevas;
          const categoryFiltered = (cat === 'all')
            ? allSevas
            : allSevas.filter(s => s.category === cat);
          const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
          const filtered = normalizedSearch
            ? categoryFiltered.filter(seva => [seva.name, seva.desc, seva.categoryName]
              .some(value => String(value || '').toLocaleLowerCase().includes(normalizedSearch)))
            : categoryFiltered;

          if (cat === 'all') {
            categoryTitle.textContent = 'All Temple Sevas';
          } else {
            const subObj = subsections.find(s => s.id === cat);
            categoryTitle.textContent = subObj ? `${subObj.icon} ${subObj.name} Sevas` : 'Sevas';
          }

          sevasCount.textContent = `${filtered.length} Offering${filtered.length === 1 ? '' : 's'} Available`;

          if (filtered.length === 0) {
            gridContainer.innerHTML = `
              <div class="no-sevas-msg">${normalizedSearch ? 'No Sevas match your search.' : 'No Sevas have been added yet'}</div>
            `;
            return;
          }

          gridContainer.innerHTML = filtered.map(seva => `
            <div class="seva-card">
              <div class="seva-card-top">
                <span class="seva-category-pill">${escapeHTML(seva.categoryName || 'General Seva')}</span>
                <h3 class="seva-title">${escapeHTML(seva.name)}</h3>
                <p class="seva-description">${escapeHTML(seva.desc || 'Sacred offering performed with ancient Vedic rituals for devotee wellbeing.')}</p>
              </div>
              
              <div class="seva-card-bottom">
                <div class="seva-price-box">
                  <span class="price-lbl">Offering Amount</span>
                  <span class="price-val">&#x20B9; ${escapeHTML(seva.price)}</span>
                </div>
              </div>
            </div>
          `).join('');
        };

        if (sevas) {
          renderList(sevas);
          return;
        }

        SevaStore.fetchSevas(renderList).catch((error) => {
          gridContainer.innerHTML = `<div class="no-sevas-msg">${escapeHTML(error.message)}</div>`;
          sevasCount.textContent = 'Unable to load offerings';
        });
      }

      // Tab Click Listener
      subGrid.addEventListener('click', (e) => {
        const tab = e.target.closest('.sub-tab');
        if (!tab) return;

        document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        currentCategory = tab.getAttribute('data-category');
        renderSevas(currentCategory);
      });

      sevaSearch.addEventListener('input', () => {
        searchTerm = sevaSearch.value;
        renderSevas(currentCategory, latestSevas);
      });

      // Initial Load
      renderSevas('all');

      // Auto polling every 4 seconds to sync live across devices
      setInterval(() => {
        renderSevas(currentCategory);
      }, 4000);

      // Mobile Nav
      const hamburger = document.getElementById('nav-hamburger');
      const mobileNav = document.getElementById('mobile-nav');
      if (hamburger && mobileNav) {
        hamburger.addEventListener('click', () => {
          hamburger.classList.toggle('active');
          mobileNav.classList.toggle('active');
        });
      }
    });
  }


  // Page-specific code consolidated from ulsavam-details.html.
  if (document.body.classList.contains('ulsavam-details-page')) {
const hamburger = document.getElementById('nav-hamburger');
    const mobileNav = document.getElementById('mobile-nav');
    hamburger.addEventListener('click', () => {
      const isOpen = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', String(!isOpen));
      hamburger.classList.toggle('active', !isOpen);
      mobileNav.classList.toggle('active', !isOpen);
    });
  }


/* Temple calendar modal. */
if (document.body.classList.contains('admin-page')) {
function initCalendar() {
  const calendarBtn = document.getElementById("calendar-btn");
  const calendarModal = document.getElementById("calendar-modal");
  const closeBtn = document.querySelector(".close-calendar");
  const calendarGrid = document.getElementById("calendar-grid");
  const monthYearDisplay = document.getElementById("calendar-month-year");
  const prevMonthBtn = document.getElementById("prev-month");
  const nextMonthBtn = document.getElementById("next-month");
  const programDetails = document.getElementById("program-details");
  const programDateTitle = document.getElementById("program-date-title");
  const programDateMalayalam = document.getElementById("program-date-malayalam");
  const programList = document.getElementById("program-list");
  const openCalendarModalBtn = document.getElementById("open-calendar-modal-btn");
  const quickDateCalBtn = document.getElementById("quick-date-calendar");

  let currentDate = new Date();
  let calendarSpecials = {};
  let malayalamCalendarData = {};

  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g,
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  function loadSpecials() {
    if (window.CalendarStore) {
      window.CalendarStore.fetchCalendar((data) => {
        calendarSpecials = data || {};
        if (calendarModal && (calendarModal.classList.contains("active") || calendarModal.style.display === "flex")) {
          renderCalendar();
        }
      }).catch((err) => console.warn('Could not load Panchangam specials:', err));
    } else {
      fetch('/api/calendar', { cache: 'no-store' })
        .then(res => {
          if (!res.ok) throw new Error('Could not load Panchangam specials.');
          return res.json();
        })
        .then(data => {
          calendarSpecials = data || {};
          if (calendarModal && (calendarModal.classList.contains("active") || calendarModal.style.display === "flex")) {
            renderCalendar();
          }
        })
        .catch(err => console.warn('Could not load calendar specials', err));
    }
  }

  loadSpecials();

  // Malayalam calendar data loading
  fetch('malayalam_calendar.json')
    .then(res => res.json())
    .then(data => {
      data.forEach(d => {
        malayalamCalendarData[d.date] = d;
      });
      if (calendarModal && (calendarModal.classList.contains("active") || calendarModal.style.display === "flex")) {
        renderCalendar();
      }
    })
    .catch(err => console.error("Failed to load malayalam calendar data:", err));

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const malDaysOfWeek = ["ഞാ", "തി", "ചൊ", "ബു", "വ്യാ", "വെ", "ശ"];
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  const malMonths = [
    { name: "Makaram", start: 14, prev: "Dhanu" },
    { name: "Kumbham", start: 13, prev: "Makaram" },
    { name: "Meenam", start: 14, prev: "Kumbham" },
    { name: "Medam", start: 14, prev: "Meenam" },
    { name: "Edavam", start: 15, prev: "Medam" },
    { name: "Midhunam", start: 15, prev: "Edavam" },
    { name: "Karkidakam", start: 17, prev: "Midhunam" },
    { name: "Chingam", start: 17, prev: "Karkidakam" },
    { name: "Kanni", start: 17, prev: "Chingam" },
    { name: "Thulam", start: 17, prev: "Kanni" },
    { name: "Vrischikam", start: 17, prev: "Thulam" },
    { name: "Dhanu", start: 16, prev: "Vrischikam" }
  ];

  function getMalayalamDate(gregorianDate) {
    const year = gregorianDate.getFullYear();
    const month = gregorianDate.getMonth();
    const day = gregorianDate.getDate();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    if (malayalamCalendarData[dateStr]) {
      const data = malayalamCalendarData[dateStr];
      return { month_ml: data.malayalam_month_ml, month_en: data.malayalam_month, date: data.malayalam_day };
    }

    const malData = malMonths[month];
    if (day < malData.start) {
      const prevMonthLen = 30;
      const diff = malData.start - day;
      const malDay = prevMonthLen - diff + 1;
      return { month_ml: malData.prev, month_en: malData.prev, date: malDay };
    } else {
      const malDay = day - malData.start + 1;
      return { month_ml: malData.name, month_en: malData.name, date: malDay };
    }
  }

  function getSpecialsForDate(year, monthIndex, dayNum) {
    const isoDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const unpaddedDate = `${year}-${monthIndex + 1}-${dayNum}`;
    return calendarSpecials[isoDate] || calendarSpecials[unpaddedDate] || [];
  }

  function showPrograms(engDate, month, year, malStr, specials, isoDate) {
    if (!programDetails) return;
    programDetails.style.display = "block";
    if (programDateTitle) programDateTitle.textContent = `${monthNames[month]} ${engDate}, ${year}`;
    if (programDateMalayalam) programDateMalayalam.textContent = `${malStr}`;

    if (programList) {
      programList.innerHTML = "";
      if (specials && specials.length > 0) {
        specials.forEach((ev) => {
          const li = document.createElement("li");
          li.className = "program-list-item";
          li.innerHTML = `<strong>🌟 Special of the Day:</strong> ${escapeHTML(ev)}`;
          programList.appendChild(li);
        });
      } else {
        const li = document.createElement("li");
        li.className = "program-list-item empty-special";
        li.textContent = "Regular poojas and rituals are scheduled for this day.";
        programList.appendChild(li);
      }

      // Quick admin shortcut if logged in
      const isAdmin = localStorage.getItem('temple_admin_auth') === 'true';
      if (isAdmin) {
        const adminAction = document.createElement("div");
        adminAction.className = "calendar-modal-admin-actions";
        adminAction.innerHTML = `
          <button type="button" class="btn-quick-add-special" data-date="${isoDate}">
            ➕ Add Special for ${isoDate}
          </button>
        `;
        const addBtn = adminAction.querySelector('.btn-quick-add-special');
        if (addBtn) {
          addBtn.addEventListener('click', () => {
            closeCalendar();
            if (window.selectAdminSpecialDate) {
              window.selectAdminSpecialDate(isoDate);
            }
          });
        }
        programList.appendChild(adminAction);
      }
    }
  }

  function renderCalendar() {
    if (!calendarGrid) return;
    calendarGrid.innerHTML = "";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (monthYearDisplay) {
      monthYearDisplay.textContent = `${monthNames[month]} ${year}`;
    }

    // Headers
    for (let i = 0; i < 7; i++) {
      const header = document.createElement("div");
      header.className = "calendar-day-header";
      header.innerHTML = `${daysOfWeek[i]}<br><span style="font-size:0.75rem">${malDaysOfWeek[i]}</span>`;
      calendarGrid.appendChild(header);
    }

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Empty spaces for start day
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement("div");
      empty.className = "calendar-day empty";
      calendarGrid.appendChild(empty);
    }

    // Days
    for (let i = 1; i <= daysInMonth; i++) {
      const dayEl = document.createElement("div");
      dayEl.className = "calendar-day";

      const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const specials = getSpecialsForDate(year, month, i);

      if (specials.length > 0) {
        dayEl.classList.add("has-special");
      }

      const malDateInfo = getMalayalamDate(new Date(year, month, i));
      const malStr = `${malDateInfo.month_en} / ${malDateInfo.month_ml} ${malDateInfo.date}`;

      let specialTagHtml = '';
      if (specials.length > 0) {
        specialTagHtml = `<div class="calendar-special-pill" title="${escapeHTML(specials.join(', '))}">★ ${escapeHTML(specials[0])}</div>`;
      }

      dayEl.innerHTML = `
        <div class="eng-date">${escapeHTML(i)}</div>
        <div class="mal-date">${escapeHTML(malStr)}</div>
        ${specialTagHtml}
      `;

      dayEl.addEventListener("click", () => {
        document.querySelectorAll(".calendar-day").forEach(el => el.classList.remove("selected-day"));
        dayEl.classList.add("selected-day");
        showPrograms(i, month, year, malStr, specials, isoDate);
      });

      calendarGrid.appendChild(dayEl);
    }

    if (programDetails) {
      programDetails.style.display = "none";
    }
  }

  function openCalendar() {
    loadSpecials();
    if (calendarModal) {
      calendarModal.style.display = "flex";
      // Force repaint so opacity transition activates smoothly
      void calendarModal.offsetWidth;
      calendarModal.classList.add("active");
    }
    renderCalendar();
  }

  function closeCalendar() {
    if (calendarModal) {
      calendarModal.classList.remove("active");
      setTimeout(() => {
        if (!calendarModal.classList.contains("active")) {
          calendarModal.style.display = "none";
        }
      }, 350);
    }
  }

  window.openTempleCalendar = openCalendar;
  window.closeTempleCalendar = closeCalendar;

  // Navigation
  if (prevMonthBtn) {
    prevMonthBtn.addEventListener("click", (e) => {
      e.preventDefault();
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar();
    });
  }

  if (nextMonthBtn) {
    nextMonthBtn.addEventListener("click", (e) => {
      e.preventDefault();
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderCalendar();
    });
  }

  if (calendarBtn) {
    calendarBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openCalendar();
    });
  }

  if (openCalendarModalBtn) {
    openCalendarModalBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openCalendar();
    });
  }

  if (quickDateCalBtn) {
    quickDateCalBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openCalendar();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeCalendar();
    });
  }

  if (calendarModal) {
    calendarModal.querySelectorAll(".close-calendar, .upi-modal-close").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        closeCalendar();
      });
    });
  }

  window.addEventListener("click", (e) => {
    if (calendarModal && e.target === calendarModal) {
      closeCalendar();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && calendarModal && (calendarModal.classList.contains("active") || calendarModal.style.display === "flex")) {
      closeCalendar();
    }
  });

  window.refreshCalendarData = function() {
    loadSpecials();
    renderCalendar();
  };

  window.openCalendarToDate = function(targetDateStr) {
    if (!targetDateStr) return;
    const parts = targetDateStr.split('-');
    if (parts.length === 3) {
      currentDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
    }
    openCalendar();
    setTimeout(() => {
      const dayNum = parseInt(parts[2], 10);
      if (calendarGrid) {
        const dayEls = calendarGrid.querySelectorAll('.calendar-day:not(.empty)');
        if (dayEls[dayNum - 1]) {
          dayEls[dayNum - 1].click();
        }
      }
    }, 100);
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCalendar);
} else {
  initCalendar();
}


}

/* Yearly Panchangam page. */
if (document.body.classList.contains('panchangam-page')) {
document.addEventListener("DOMContentLoaded", () => {
  const monthsGrid = document.getElementById("months-grid");
  const currentYearDisplay = document.getElementById("current-year-display");
  const prevYearBtn = document.getElementById("prev-year");
  const nextYearBtn = document.getElementById("next-year");
  
  const detailModal = document.getElementById("day-detail-modal");
  const closeDetailBtn = document.getElementById("close-detail");
  const detailDateTitle = document.getElementById("detail-date-title");
  const detailDateMalayalam = document.getElementById("detail-date-malayalam");
  const searchField = document.querySelector(".panchangam-search-field");
  const searchToggleBtn = document.getElementById("panchangam-search-toggle");
  const searchInput = document.getElementById("panchangam-search-input");
  const searchClearBtn = document.getElementById("panchangam-search-clear");
  const searchResults = document.getElementById("panchangam-search-results");

  let currentYear = 2026; // Set default to 2026 since we have data for it
  let panchangamMap = {};
  let panchangamDays = [];
  let malayalamCalendarData = {};
  let calendarSpecials = {};
  let calendarDataLoaded = false;

  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  
  // Hardcoded temple events removed
  const daysOfWeek = ["S", "M", "T", "W", "T", "F", "S"];
  
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  // Approximate Malayalam month starting Gregorian dates for fallback
  const malMonths = [
    { name: "Makaram", start: 14, prev: "Dhanu" },
    { name: "Kumbham", start: 13, prev: "Makaram" },
    { name: "Meenam", start: 14, prev: "Kumbham" },
    { name: "Medam", start: 14, prev: "Meenam" },
    { name: "Edavam", start: 15, prev: "Medam" },
    { name: "Midhunam", start: 15, prev: "Edavam" },
    { name: "Karkidakam", start: 17, prev: "Midhunam" },
    { name: "Chingam", start: 17, prev: "Karkidakam" },
    { name: "Kanni", start: 17, prev: "Chingam" },
    { name: "Thulam", start: 17, prev: "Kanni" },
    { name: "Vrischikam", start: 17, prev: "Thulam" },
    { name: "Dhanu", start: 16, prev: "Vrischikam" }
  ];

  function getMalayalamDate(gregorianDate) {
    const year = gregorianDate.getFullYear();
    const month = gregorianDate.getMonth();
    const day = gregorianDate.getDate();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    if (malayalamCalendarData[dateStr]) {
        const data = malayalamCalendarData[dateStr];
        return { month_ml: data.malayalam_month_ml, month_en: data.malayalam_month, date: data.malayalam_day };
    }
    
    const malData = malMonths[month];
    
    if (day < malData.start) {
      const prevMonthLen = 30; // Approximation
      const diff = malData.start - day;
      const malDay = prevMonthLen - diff + 1;
      return { month_ml: malData.prev, month_en: malData.prev, date: malDay };
    } else {
      const malDay = day - malData.start + 1;
      return { month_ml: malData.name, month_en: malData.name, date: malDay };
    }
  }

  function renderSearchResults() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    searchClearBtn.classList.toggle("visible", query.length > 0);

    if (!query) {
      searchResults.classList.remove("visible");
      searchResults.innerHTML = "";
      return;
    }

    searchResults.classList.add("visible");
    if (!calendarDataLoaded) {
      searchResults.innerHTML = '<p class="panchangam-search-empty">Loading Panchangam dates…</p>';
      return;
    }

    const matches = panchangamDays.filter(day => {
      const [year, month, date] = day.date.split("-").map(Number);
      const gregorianDate = new Date(year, month - 1, date);
      const dateLabel = gregorianDate.toLocaleDateString("en-IN", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
      });
      const malDateInfo = getMalayalamDate(gregorianDate);
      const tithi = day.tithi || {};
      const nakshatra = day.nakshatra || {};
      const specials = calendarSpecials[day.date] || [];
      const searchableText = [
        day.date,
        dateLabel,
        monthNames[month - 1],
        day.weekday,
        `nakshatra ${nakshatra.name || ""} ${nakshatra.name_ml || ""}`,
        `tithi ${tithi.name || ""} ${tithi.name_ml || ""} paksha ${tithi.paksha || ""} ${tithi.paksha_ml || ""}`,
        `malayalam ${malDateInfo.month_en || ""} ${malDateInfo.month_ml || ""} ${malDateInfo.date || ""}`,
        `sunrise ${day.sunrise_ist || ""}`,
        ...specials
      ].join(" ").toLocaleLowerCase();

      return query.split(/\s+/).every(term => searchableText.includes(term));
    });

    if (!matches.length) {
      searchResults.innerHTML = '<p class="panchangam-search-empty">No matching Panchangam dates found.</p>';
      return;
    }

    const limit = 30;
    const resultButtons = matches.slice(0, limit).map(day => {
      const [year, month, date] = day.date.split("-").map(Number);
      const dateLabel = new Date(year, month - 1, date).toLocaleDateString("en-IN", {
        weekday: "short", day: "numeric", month: "short", year: "numeric"
      });
      const tithi = day.tithi || {};
      const nakshatra = day.nakshatra || {};
      const specials = calendarSpecials[day.date] || [];
      const details = [
        nakshatra.name ? `Nakshatra: ${nakshatra.name}` : "",
        tithi.name ? `Tithi: ${tithi.name}${tithi.paksha ? ` (${tithi.paksha})` : ""}` : "",
        ...specials
      ].filter(Boolean).join(" · ");

      return `<button type="button" class="panchangam-search-result" data-search-date="${escapeHTML(day.date)}">
        <span class="panchangam-search-result-date">${escapeHTML(dateLabel)}</span>
        <span class="panchangam-search-result-details">${escapeHTML(details)}</span>
      </button>`;
    }).join("");

    const countText = matches.length > limit
      ? `Showing ${limit} of ${matches.length} matches`
      : `${matches.length} ${matches.length === 1 ? "match" : "matches"}`;
    searchResults.innerHTML = `<p class="panchangam-search-count">${countText}</p>${resultButtons}`;
  }

  searchInput.addEventListener("input", renderSearchResults);
  searchToggleBtn.addEventListener("click", () => {
    const expanded = !searchField.classList.contains("expanded");
    searchField.classList.toggle("expanded", expanded);
    searchToggleBtn.setAttribute("aria-expanded", String(expanded));
    searchToggleBtn.setAttribute("aria-label", expanded ? "Close Panchangam search" : "Open Panchangam search");

    if (expanded) {
      searchInput.focus();
      renderSearchResults();
    } else {
      searchResults.classList.remove("visible");
    }
  });

  searchClearBtn.addEventListener("click", () => {
    searchInput.value = "";
    renderSearchResults();
    searchInput.focus();
  });

  searchResults.addEventListener("click", event => {
    const result = event.target.closest("[data-search-date]");
    if (!result) return;

    const date = result.dataset.searchDate;
    currentYear = Number(date.slice(0, 4));
    renderYearlyCalendar(currentYear);

    const dayElement = document.getElementById(`panchangam-date-${date}`);
    if (dayElement) {
      dayElement.classList.add("search-match");
      dayElement.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => dayElement.classList.remove("search-match"), 2400);
    }

    searchResults.classList.remove("visible");
  });

  function renderYearlyCalendar(year) {
    currentYearDisplay.textContent = year;
    monthsGrid.innerHTML = "";
    
    if (year <= 2026) {
        prevYearBtn.style.opacity = '0.3';
        prevYearBtn.style.cursor = 'not-allowed';
    } else {
        prevYearBtn.style.opacity = '1';
        prevYearBtn.style.cursor = 'pointer';
    }
    
    for (let m = 0; m < 12; m++) {
      const monthCard = document.createElement("div");
      monthCard.className = "month-card";
      
      const monthTitle = document.createElement("h3");
      monthTitle.className = "month-title";
      monthTitle.textContent = monthNames[m];
      monthCard.appendChild(monthTitle);
      
      const grid = document.createElement("div");
      grid.className = "calendar-grid";
      
      // Headers
      for (let i = 0; i < 7; i++) {
        const header = document.createElement("div");
        header.className = "calendar-day-header";
        header.textContent = daysOfWeek[i];
        grid.appendChild(header);
      }

      const firstDay = new Date(year, m, 1).getDay();
      const daysInMonth = new Date(year, m + 1, 0).getDate();

      for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement("div");
        empty.className = "calendar-day empty";
        grid.appendChild(empty);
      }

      for (let i = 1; i <= daysInMonth; i++) {
        const dayEl = document.createElement("div");
        dayEl.className = "calendar-day";
        
        const malDateInfo = getMalayalamDate(new Date(year, m, i));
        const malStr = `${malDateInfo.month_en} / ${malDateInfo.month_ml} ${malDateInfo.date}`;

        const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        dayEl.id = `panchangam-date-${dateStr}`;
        const pData = panchangamMap[dateStr];
        const specials = calendarSpecials[dateStr] || [];
        if (specials.length > 0) {
          dayEl.classList.add("has-special");
        }

        let nakshatraStr = '';
        if (pData && pData.nakshatra) {
            nakshatraStr = `<div class="nakshatra">${escapeHTML(pData.nakshatra.name_ml || pData.nakshatra.name)}</div>`;
        }

        let specialBadgeStr = '';
        if (specials.length > 0) {
          specialBadgeStr = `<div class="calendar-special-pill" title="${escapeHTML(specials.join(', '))}">★ ${escapeHTML(specials[0])}</div>`;
        }

        dayEl.innerHTML = `
          <div class="eng-date">${escapeHTML(i)}</div>
          <div class="mal-date">${escapeHTML(malStr)}</div>
          ${nakshatraStr}
          ${specialBadgeStr}
        `;

        dayEl.addEventListener("click", () => {
          showDayDetails(i, m, year, malStr, pData, dateStr);
        });

        grid.appendChild(dayEl);
      }
      
      monthCard.appendChild(grid);
      monthsGrid.appendChild(monthCard);
    }
  }

  function showDayDetails(date, month, year, malStr, pData, dateStr) {
    detailDateTitle.textContent = `${monthNames[month]} ${date}, ${year}`;
    
    let extraInfo = '';
    if (pData) {
        extraInfo += `<br/><strong>Nakshatra:</strong> ${escapeHTML(pData.nakshatra.name_ml)} (${escapeHTML(pData.nakshatra.name)}) - ends at ${escapeHTML(pData.nakshatra.ends_ist)}`;
        extraInfo += `<br/><strong>Tithi:</strong> ${escapeHTML(pData.tithi.name_ml)} (${escapeHTML(pData.tithi.name)}) [${escapeHTML(pData.tithi.paksha_ml)}] - ends at ${escapeHTML(pData.tithi.ends_ist)}`;
        extraInfo += `<br/><strong>Sunrise:</strong> ${escapeHTML(pData.sunrise_ist)}`;
    }

    const specials = (dateStr && calendarSpecials[dateStr]) ? calendarSpecials[dateStr] : [];
    let specialsInfo = '';
    if (specials.length > 0) {
      specialsInfo = `<div class="day-specials-box" style="margin-top:12px; padding:12px; background:rgba(255,215,0,0.08); border-left:3px solid #ffd700; border-radius:6px;"><strong style="color:#ffd700; font-family:'Cinzel', serif;">🌟 Special of the Day:</strong><ul style="margin:6px 0 0 18px; padding:0; color:#fff;">${specials.map(s => `<li style="margin-bottom:4px;">${escapeHTML(s)}</li>`).join('')}</ul></div>`;
    }
    
    detailDateMalayalam.innerHTML = malStr + extraInfo + specialsInfo;
    
    detailModal.style.display = "flex";
  }

  // Navigation
  prevYearBtn.addEventListener("click", () => {
    if (currentYear > 2026) {
      currentYear--;
      renderYearlyCalendar(currentYear);
    }
  });

  nextYearBtn.addEventListener("click", () => {
    currentYear++;
    renderYearlyCalendar(currentYear);
  });

  closeDetailBtn.addEventListener("click", () => {
    detailModal.style.display = "none";
  });

  window.addEventListener("click", (e) => {
    if (e.target === detailModal) {
      detailModal.style.display = "none";
    }
  });
  
  // Mobile Nav (since we copied from sevas.html)
  const hamburger = document.getElementById('nav-hamburger');
  const mobileNav = document.getElementById('mobile-nav');
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      mobileNav.classList.toggle('active');
    });
  }

  // Render the local calendar data first so Neon cold starts do not block the page.
  Promise.all([
    fetch('panchangam.json').then(res => res.json()).catch(() => ({})),
    fetch('malayalam_calendar.json').then(res => res.json()).catch(() => ([]))
  ]).then(([panchangamData, malData]) => {
      if (panchangamData.days) {
          panchangamData.days.forEach(d => {
              panchangamMap[d.date] = d;
          });
      }
      if (malData.length) {
          malData.forEach(d => {
              malayalamCalendarData[d.date] = d;
          });
      }
      panchangamDays = panchangamData.days || [];
      calendarDataLoaded = true;
      renderYearlyCalendar(currentYear);
      renderSearchResults();

      // Add shared specials when Neon responds; the calendar is already visible.
      return fetch('/api/calendar', { cache: 'no-store' })
        .then(res => {
          if (!res.ok) throw new Error('Could not load Panchangam specials from Neon.');
          return res.json();
        })
        .then(calData => {
          if (calData && typeof calData === 'object' && !Array.isArray(calData)) {
            calendarSpecials = calData;
            renderYearlyCalendar(currentYear);
            renderSearchResults();
          }
        });
  }).catch(err => {
      console.error('Could not load Panchangam specials from Neon:', err);
  });
});

}
