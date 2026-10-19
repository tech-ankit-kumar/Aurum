/* =====================================================
   AURUM — Main Script v5
   360° view · Gender filter · Footer nav fix
   ===================================================== */
(function () {
  'use strict';

  const LS = {
    get: (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
    del: (k) => localStorage.removeItem(k)
  };

  const state = {
    cart: LS.get('aurum_cart', []),
    wishlist: LS.get('aurum_wish', []),
    users: LS.get('aurum_users', []),
    currentUser: null,
    orders: LS.get('aurum_orders', []),
    filter: 'all',
    categoryFilter: 'all',
    genderFilter: 'all',
    priceRange: null,
    sort: 'featured',
    visibleCount: 12,
    heroIndex: 0,
    sessionReady: false
  };

  const $  = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));
  const money = n => '₹' + Number(n).toLocaleString('en-IN');
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const API = '/api';
  async function apiFetch(path, options = {}) { const res=await fetch(API+path,{...options,credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})}}); const raw=await res.text(); let data={}; try{data=raw?JSON.parse(raw):{};}catch{data={error:raw?.slice(0,220)||`Server returned HTTP ${res.status}`};} if(!res.ok) throw new Error(data.error||`Request failed (HTTP ${res.status})`); return data; }

  /* ============ NAVBAR ============ */
  const nav = $('#nav');
  const navLinks = $$('.nav-menu a[data-nav]');

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 30);
    const sections = $$('section[id]');
    let current = 'home';
    const scrollY = window.scrollY + 140;
    sections.forEach(sec => {
      if (scrollY >= sec.offsetTop && scrollY < sec.offsetTop + sec.offsetHeight) {
        current = sec.id;
      }
    });
    navLinks.forEach(a => {
      const href = a.getAttribute('href')?.replace('#','');
      a.classList.toggle('active', href === current);
    });
  }, { passive: true });

  navLinks.forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        navLinks.forEach(x => x.classList.remove('active'));
        a.classList.add('active');
      }
    });
  });

  const menuBtn = $('#menuToggle');
  const navMenu = $('#navMenu');
  menuBtn.addEventListener('click', () => {
    menuBtn.classList.toggle('active');
    navMenu.classList.toggle('open');
  });
  navLinks.forEach(a => a.addEventListener('click', () => {
    menuBtn.classList.remove('active');
    navMenu.classList.remove('open');
  }));

  /* ============ HERO ============ */
  function renderHero() {
    const slidesEl = $('#heroSlides'), dotsEl = $('#heroDots');
    if (!slidesEl) return;
    slidesEl.innerHTML = HERO_SLIDES.map((s, i) =>
      `<div class="hero-slide ${i === 0 ? 'active' : ''}"><img src="${s.image}" alt="${s.brand}"></div>`
    ).join('');
    dotsEl.innerHTML = HERO_SLIDES.map((_, i) =>
      `<span class="hero-dot ${i === 0 ? 'active' : ''}" data-i="${i}"></span>`
    ).join('');
    $$('#heroDots .hero-dot').forEach(d => d.addEventListener('click', () => setHero(+d.dataset.i)));
    updateHeroLabels();
    setInterval(() => setHero((state.heroIndex + 1) % HERO_SLIDES.length), 4200);
  }
  function setHero(i) {
    state.heroIndex = i;
    $$('.hero-slide').forEach((el, idx) => el.classList.toggle('active', idx === i));
    $$('#heroDots .hero-dot').forEach((el, idx) => el.classList.toggle('active', idx === i));
    updateHeroLabels();
  }
  function updateHeroLabels() {
    const s = HERO_SLIDES[state.heroIndex];
    $('#heroBrand').textContent = s.brand;
    $('#heroModel').textContent = s.model;
    $('#heroPrice').textContent = money(s.price);
  }

  /* ============ TRUST MARQUEE ============ */
  function renderTrustMarquee() {
    const track = $('#trustTrack'); if (!track) return;
    const items = [];
    for (let r = 0; r < 2; r++) {
      TRUST_BRANDS.forEach((b, i) => {
        const filled = (i + r) % 2 === 0 ? 'filled' : '';
        items.push(`<span class="trust-item ${filled}">${b}</span><span class="trust-sep">✦</span>`);
      });
    }
    track.innerHTML = items.join('');
  }

  /* ============ FEATURED — PRICE RANGE CARDS ============ */
  function renderFeatured() {
    const grid = $('#featuredGrid'); if (!grid) return;
    grid.innerHTML = FEATURED_RANGES.map((r, i) => {
      const items = PRODUCTS.filter(p => p.price >= r.min && p.price < r.max);
      const from = items.length ? Math.min(...items.map(p => p.price)) : 0;
      const sample = items[0] || PRODUCTS[0];
      return `
        <article class="featured-card reveal" data-price-range="${i}">
          <div class="featured-img">
            <img src="${sample.image}" alt="${r.label}" loading="lazy">
            <span class="price-range-tag">${r.tag}</span>
          </div>
          <div class="featured-cat">${items.length} products</div>
          <h3 class="featured-name">${r.label}</h3>
          <div class="featured-bottom">
            <span class="featured-price">From ${money(from)}</span>
            <span class="featured-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
          </div>
        </article>
      `;
    }).join('');
    $$('.featured-card', grid).forEach(card => {
      card.addEventListener('click', () => {
        state.priceRange = FEATURED_RANGES[+card.dataset.priceRange];
        state.filter = 'all';
        state.categoryFilter = 'all';
        state.genderFilter = 'all';
        state.visibleCount = 12;
        $$('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === 'all'));
        renderProducts();
        $('#shop').scrollIntoView({ behavior: 'smooth' });
        showToast(`Showing ${state.priceRange.label}`);
      });
    });
  }

  /* ============ PRODUCTS ============ */
  function renderProducts() {
    const grid = $('#productGrid'); if (!grid) return;

    let items = [...PRODUCTS];
    if (state.filter !== 'all') items = items.filter(p => p.brandId === state.filter);
    if (state.categoryFilter !== 'all') items = items.filter(p => p.category === state.categoryFilter);
    if (state.genderFilter !== 'all') items = items.filter(p => p.gender === state.genderFilter || (state.genderFilter === 'Men' && p.gender === 'Unisex') || (state.genderFilter === 'Women' && p.gender === 'Unisex'));
    if (state.priceRange) items = items.filter(p => p.price >= state.priceRange.min && p.price < state.priceRange.max);

    switch (state.sort) {
      case 'low':    items.sort((a,b) => a.price - b.price); break;
      case 'high':   items.sort((a,b) => b.price - a.price); break;
      case 'rating': items.sort((a,b) => b.rating - a.rating); break;
    }

    const visible = items.slice(0, state.visibleCount);
    const shopCount = $('#shopCount');
    if (shopCount) {
      const parts = [];
      if (state.filter !== 'all') parts.push(BRANDS_DATA.find(b => b.id === state.filter)?.name || state.filter);
      if (state.categoryFilter !== 'all') parts.push(state.categoryFilter);
      if (state.genderFilter !== 'all') parts.push(state.genderFilter);
      if (state.priceRange) parts.push(state.priceRange.label);
      const label = parts.length ? ` · ${parts.join(' · ')}` : ' · all brands';
      shopCount.textContent = `Showing ${visible.length} of ${items.length} products${label}`;
    }

    if (!visible.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 0;">
        <p style="font-family:'Fraunces',serif;font-size:22px;color:var(--dark);margin-bottom:6px;">No products found</p>
        <small style="color:var(--muted);">Try a different filter</small>
      </div>`;
      $('#loadMore').style.display = 'none';
      return;
    }

    grid.innerHTML = visible.map((p, i) => {
      const inWish = state.wishlist.includes(p.id);
      const outOfStock = Number(p.stock) <= 0;
      const badgeHTML = p.badge && !outOfStock ? `<span class="badge ${p.badgeClass}">${p.badge}</span>` : '';
      const oldHTML = p.oldPrice ? `<span class="old">${money(p.oldPrice)}</span>` : '';
      return `
        <article class="product-card" data-open="${p.id}" style="animation-delay:${(i % 12) * 0.02}s">
          <div class="product-badges">${badgeHTML}</div>
          <button class="product-wish ${inWish ? 'active' : ''}" data-wish="${p.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
          </button>
          <div class="product-img"><img src="${p.image}" alt="${p.name}" loading="lazy"></div>
          <div class="product-brand">${p.brand} · ${p.gender}</div>
          <h3 class="product-name">${p.name}</h3>
          <div class="product-stock-label ${outOfStock ? 'is-out' : 'is-in'}">${outOfStock ? 'Out of Stock' : 'In Stock'}</div>
          <div class="product-footer">
            <div>
              <div class="product-price">${money(p.price)}${oldHTML}</div>
              <div class="product-rating"><span class="star">★</span> ${p.rating} · ${p.reviews}</div>
            </div>
            <button class="product-add" data-add="${p.id}" ${outOfStock ? 'disabled title="Out of Stock" aria-label="Out of Stock"' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
        </article>
      `;
    }).join('');

    $$('[data-wish]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation(); toggleWishlist(+btn.dataset.wish, btn);
    }));
    $$('[data-add]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation(); addToCart(+btn.dataset.add);
    }));
    attachOpenHandlers(grid);

    const btn = $('#loadMore');
    btn.style.display = state.visibleCount >= items.length ? 'none' : 'inline-flex';
    observeReveals();
  }

  function attachOpenHandlers(scope) {
    $$('[data-open]', scope).forEach(el =>
      el.addEventListener('click', () => openProduct(+el.dataset.open))
    );
  }

  function setupFilters() {
    $$('.filter-tab').forEach(tab => tab.addEventListener('click', () => {
      $$('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.filter = tab.dataset.filter;
      state.categoryFilter = 'all';
      state.genderFilter = 'all';
      state.priceRange = null;
      state.visibleCount = 12;
      renderProducts();
    }));
    $('#sortSelect').addEventListener('change', e => { state.sort = e.target.value; renderProducts(); });
    $('#loadMore').addEventListener('click', () => { state.visibleCount += 12; renderProducts(); });

    // Collection cards
    $$('.collection-card').forEach(card => card.addEventListener('click', () => {
      const cat = card.dataset.cat;
      state.categoryFilter = cat;
      state.filter = 'all';
      state.genderFilter = 'all';
      state.priceRange = null;
      state.visibleCount = 12;
      $$('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === 'all'));
      renderProducts();
      $('#shop').scrollIntoView({ behavior: 'smooth' });
      showToast(`Showing ${cat} collection`);
    }));

    // Gender cards
    $$('.gender-card').forEach(card => card.addEventListener('click', () => {
      const g = card.dataset.gender;
      state.genderFilter = g;
      state.filter = 'all';
      state.categoryFilter = 'all';
      state.priceRange = null;
      state.visibleCount = 12;
      $$('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === 'all'));
      renderProducts();
      $('#shop').scrollIntoView({ behavior: 'smooth' });
      showToast(`Showing ${g}'s collection`);
    }));

    // Ad cards
    $$('.ad-card').forEach(card => card.addEventListener('click', () => {
      const cat = card.dataset.cat;
      state.categoryFilter = cat;
      state.filter = 'all';
      state.genderFilter = 'all';
      state.priceRange = null;
      state.visibleCount = 12;
      $$('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === 'all'));
      renderProducts();
      $('#shop').scrollIntoView({ behavior: 'smooth' });
    }));

    // ✅ FOOTER LINK FIXES
    $$('[data-gender-link]').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      const g = a.dataset.genderLink;
      state.genderFilter = g;
      state.filter = 'all';
      state.categoryFilter = 'all';
      state.priceRange = null;
      state.visibleCount = 12;
      $$('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === 'all'));
      renderProducts();
      $('#shop').scrollIntoView({ behavior: 'smooth' });
      showToast(`Showing ${g}'s collection`);
    }));

    $$('[data-cat-link]').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = a.dataset.catLink;
      state.categoryFilter = cat;
      state.filter = 'all';
      state.genderFilter = 'all';
      state.priceRange = null;
      state.visibleCount = 12;
      $$('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === 'all'));
      renderProducts();
      $('#shop').scrollIntoView({ behavior: 'smooth' });
      showToast(`Showing ${cat}`);
    }));

    $$('[data-filter-link]').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      const f = a.dataset.filterLink;
      state.filter = f;
      state.categoryFilter = 'all';
      state.genderFilter = 'all';
      state.priceRange = null;
      state.visibleCount = 12;
      $$('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === f));
      renderProducts();
      $('#shop').scrollIntoView({ behavior: 'smooth' });
    }));
  }

  /* ============ BRANDS ============ */
  function renderWorldBrands() {
    const grid = $('#brandsGrid'); if (!grid) return;
    grid.innerHTML = BRANDS_DATA.map(b => `
      <div class="brand-card reveal" data-brand="${b.id}">
        <div>
          <div class="brand-logo-wrap">
            <div class="brand-logo-svg">${b.logo}</div>
            <div class="brand-logo-text">${b.name}</div>
          </div>
          <div class="brand-card-count">${b.count}+ Products</div>
        </div>
        <div class="brand-quote" data-quote-idx="0">"${b.quotes[0]}"</div>
      </div>
    `).join('');

    $$('.brand-card').forEach(card => card.addEventListener('click', () => {
      const id = card.dataset.brand;
      $$('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === id));
      state.filter = id;
      state.categoryFilter = 'all';
      state.genderFilter = 'all';
      state.priceRange = null;
      state.visibleCount = 12;
      renderProducts();
      $('#shop').scrollIntoView({ behavior: 'smooth' });
    }));

    setInterval(() => {
      $$('.brand-card').forEach(card => {
        const id = card.dataset.brand;
        const brand = BRANDS_DATA.find(b => b.id === id);
        if (!brand) return;
        const q = card.querySelector('.brand-quote');
        const cur = +(q.dataset.quoteIdx || 0);
        const next = (cur + 1) % brand.quotes.length;
        q.classList.add('fade');
        setTimeout(() => {
          q.textContent = `"${brand.quotes[next]}"`;
          q.dataset.quoteIdx = next;
          q.classList.remove('fade');
        }, 260);
      });
    }, 3600);
  }

  /* ============ PRODUCT MODAL with 360° VIEW ============ */
  const productModal = $('#productModal');
  const productModalContent = $('#productModalContent');
  let pmActiveSize = null, pmActiveColor = 0, pmProduct = null;
  let rotY360 = 0, rotX360 = 0, isDragging360 = false, lastX360 = 0, lastY360 = 0;
  let autoSpinTimer = null;

  function openProduct(id) {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p) return;
    pmProduct = p;
    pmActiveSize = p.sizes[Math.floor(p.sizes.length / 2)];
    pmActiveColor = 0;
    rotY360 = 0; rotX360 = 0;

    const discount = p.oldPrice ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100) : 0;
    const activeColor = p.colors[0];
    const activeFilter = activeColor.filter || 'none';

    productModalContent.innerHTML = `
      <div class="pm-gallery">
        <div class="pm-360-stage" id="pm360Stage">
          <img id="pmMainImg" src="${p.image}" alt="${p.name}" style="filter:${activeFilter};">
          <div class="pm-360-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>
            <span>360°</span>
          </div>
        </div>
        <div class="pm-360-controls">
          <button class="pm-360-btn" id="pmAutoSpin">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>
            Auto Rotate
          </button>
          <span class="pm-360-hint">Drag image to rotate</span>
        </div>
        ${p.colors.length > 1 ? `
          <div class="pm-color-previews">
            ${p.colors.map((c, i) => `
              <div class="pm-color-preview ${i === 0 ? 'active' : ''}" data-prev="${i}">
                <div class="pm-color-swatch" style="background:${c.value}"></div>
                <img src="${p.image}" alt="" style="filter:${c.filter};">
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      <div class="pm-info">
        <div class="pm-brand">${p.brand} · ${p.gender}</div>
        <h2 class="pm-name">${p.name}</h2>
        <div class="pm-rating">
          <span class="stars">${'★'.repeat(Math.round(p.rating))}${'☆'.repeat(5 - Math.round(p.rating))}</span>
          <span><strong>${p.rating}</strong></span>
          <span class="dot-sep">•</span><span>${p.reviews} reviews</span>
        </div>
        <div class="pm-price-block">
          <div class="pm-price">${money(p.price)}</div>
          ${p.oldPrice ? `<div class="pm-old">${money(p.oldPrice)}</div>` : ''}
          ${discount ? `<div class="pm-discount">-${discount}% OFF</div>` : ''}
        </div>
        <p class="pm-desc">${p.description}</p>
        <div class="pm-section">
          <span class="pm-section-label">Select Size (US)</span>
          <div class="pm-sizes">
            ${p.sizes.map(s => `<button class="pm-size ${s === pmActiveSize ? 'active' : ''}" data-size="${s}">${s}</button>`).join('')}
          </div>
        </div>
        <div class="pm-section">
          <span class="pm-section-label">Select Color — <span id="pmColorName">${activeColor.name}</span></span>
          <div class="pm-colors">
            ${p.colors.map((c, i) => `<span class="pm-color ${i === 0 ? 'active' : ''}" data-color="${i}" title="${c.name}" style="background:${c.value}"></span>`).join('')}
          </div>
        </div>
        <div class="pm-stock-status" id="pmStockStatus" style="margin:12px 0;color:${Number(p.stock) <= 0 ? '#b42318' : '#21834a'};font-weight:600;">${Number(p.stock) <= 0 ? 'Out of Stock' : `${Number(p.stock)} in stock`}</div>
        <div class="pm-actions">
          <button class="btn btn-outline" id="pmAdd" ${Number(p.stock) <= 0 ? 'disabled' : ''}>${Number(p.stock) <= 0 ? 'Out of Stock' : 'Add to Cart'}</button>
          <button class="btn btn-dark" id="pmBuy" ${Number(p.stock) <= 0 ? 'disabled' : ''}>${Number(p.stock) <= 0 ? 'Out of Stock' : 'Buy Now →'}</button>
        </div>
        <div class="pm-perks">
          <div class="pm-perk"><span class="pm-perk-icon">🚚</span><span>Free express shipping on orders over ₹15,000</span></div>
          <div class="pm-perk"><span class="pm-perk-icon">↩</span><span>30-day easy returns & exchanges</span></div>
          <div class="pm-perk"><span class="pm-perk-icon">✓</span><span>100% authentic — sourced from official partners</span></div>
        </div>
      </div>
    `;

    // 360 setup
    setup360View();

    $$('.pm-size').forEach(btn => btn.addEventListener('click', () => {
      $$('.pm-size').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); pmActiveSize = +btn.dataset.size;
    }));

    $$('.pm-color').forEach(btn => btn.addEventListener('click', () => {
      const i = +btn.dataset.color; pmActiveColor = i;
      $$('.pm-color').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyColor(p.colors[i]);
    }));

    $$('.pm-color-preview').forEach(el => el.addEventListener('click', () => {
      const i = +el.dataset.prev; pmActiveColor = i;
      $$('.pm-color-preview').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      $$('.pm-color').forEach((b, idx) => b.classList.toggle('active', idx === i));
      applyColor(p.colors[i]);
    }));

    function applyColor(c) {
      const img = $('#pmMainImg'); if (img) img.style.filter = c.filter || 'none';
      const nameEl = $('#pmColorName'); if (nameEl) nameEl.textContent = c.name;
    }

    $('#pmAdd').addEventListener('click', async () => { if (await addToCart(p.id, pmActiveSize, pmActiveColor)) closeProduct(); });
    $('#pmBuy').addEventListener('click', async () => {
      if (!(await addToCart(p.id, pmActiveSize, pmActiveColor))) return;
      closeProduct();
      setTimeout(openCart, 320);
    });

    productModal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  /* ============ 360° VIEW LOGIC ============ */
  function setup360View() {
    const stage = $('#pm360Stage');
    const img = $('#pmMainImg');
    const autoBtn = $('#pmAutoSpin');
    if (!stage || !img) return;

    const applyTransform = () => {
      img.style.transform = `rotateY(${rotY360}deg) rotateX(${rotX360}deg) scale(1.02)`;
    };

    const startDrag = (e) => {
      isDragging360 = true;
      const point = e.touches ? e.touches[0] : e;
      lastX360 = point.clientX;
      lastY360 = point.clientY;
      stopAutoSpin();
      stage.style.cursor = 'grabbing';
    };

    const moveDrag = (e) => {
      if (!isDragging360) return;
      const point = e.touches ? e.touches[0] : e;
      const dx = point.clientX - lastX360;
      const dy = point.clientY - lastY360;
      // Full 360 rotation on Y axis
      rotY360 += dx * 0.6;
      rotX360 = Math.max(-30, Math.min(30, rotX360 - dy * 0.4));
      applyTransform();
      lastX360 = point.clientX;
      lastY360 = point.clientY;
    };

    const endDrag = () => {
      isDragging360 = false;
      stage.style.cursor = 'grab';
    };

    stage.addEventListener('mousedown', startDrag);
    stage.addEventListener('touchstart', startDrag, { passive: true });
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('touchmove', moveDrag, { passive: true });
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);

    // Auto spin
    if (autoBtn) {
      autoBtn.addEventListener('click', () => {
        if (autoSpinTimer) {
          stopAutoSpin();
        } else {
          autoBtn.classList.add('active');
          autoBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Stop`;
          autoSpinTimer = setInterval(() => {
            rotY360 += 2;
            applyTransform();
          }, 30);
        }
      });
    }
  }

  function stopAutoSpin() {
    if (autoSpinTimer) {
      clearInterval(autoSpinTimer);
      autoSpinTimer = null;
      const autoBtn = $('#pmAutoSpin');
      if (autoBtn) {
        autoBtn.classList.remove('active');
        autoBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg> Auto Rotate`;
      }
    }
  }

  function closeProduct() {
    stopAutoSpin();
    productModal.classList.remove('show');
    checkBodyLock();
  }

  function checkBodyLock() {
    const anyOpen = productModal.classList.contains('show') ||
                    authModal.classList.contains('show') ||
                    searchModal.classList.contains('show') ||
                    checkoutModal.classList.contains('show') ||
                    ordersModal.classList.contains('show') ||
                    cartDrawer.classList.contains('open');
    if (!anyOpen) document.body.style.overflow = '';
  }

  $('#closeProduct').addEventListener('click', closeProduct);
  productModal.addEventListener('click', e => { if (e.target === productModal) closeProduct(); });

  /* ============ CART ============ */
  const cartDrawer = $('#cartDrawer');
  const overlay = $('#overlay');

  function cartKey(id, size, color) { return `${id}-${size || 'ns'}-${color || 0}`; }

  async function addToCart(id, size, color) {
    if (!(await requireCustomerLogin())) return false;
    const p = PRODUCTS.find(x => Number(x.id) === Number(id)); if (!p) return false;
    // Always verify current server stock before adding, not only at checkout.
    try {
      const liveProduct = await apiFetch(`/products/${encodeURIComponent(id)}`);
      p.stock = Math.max(0, Number(liveProduct.stock) || 0);
    } catch (_) {
      showToast('Could not check stock. Please try again.');
      return false;
    }
    const colorObj = p.colors[color || 0] || { name: 'Default', filter: 'none', value: '#111' };
    const key = cartKey(id, size, color);
    const existing = state.cart.find(c => c.key === key);
    const alreadyInCart = state.cart.filter(c => Number(c.id) === Number(id)).reduce((sum, c) => sum + Number(c.qty || 0), 0);
    if (p.stock <= 0 || alreadyInCart >= p.stock) {
      showToast(p.stock <= 0 ? 'Out of Stock' : `Only ${p.stock} available in stock`);
      renderProducts();
      const status = $('#pmStockStatus');
      if (status && pmProduct && Number(pmProduct.id) === Number(id)) status.textContent = 'Out of Stock';
      ['#pmAdd', '#pmBuy'].forEach(sel => { const b = $(sel); if (b) { b.disabled = true; b.textContent = 'Out of Stock'; } });
      return false;
    }
    if (existing) existing.qty++;
    else state.cart.push({
      key, id, name: p.name, brand: p.brand, image: p.image, imageFilter: colorObj.filter,
      price: p.price, size: size || null, colorName: colorObj.name, colorValue: colorObj.value, qty: 1
    });
    saveCart(); updateCartUI();
    showToast(`${p.name} added to bag`);
    return true;
  }

  function removeFromCart(key) { state.cart = state.cart.filter(c => c.key !== key); saveCart(); updateCartUI(); }
  function changeQty(key, delta) {
    const item = state.cart.find(c => c.key === key); if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) { removeFromCart(key); return; }
    saveCart(); updateCartUI();
  }
  function saveCart() { LS.set('aurum_cart', state.cart); }

  function updateCartUI() {
    const count = state.cart.reduce((s, i) => s + i.qty, 0);
    const badge = $('#cartCount');
    if (badge) { badge.textContent = count; badge.classList.toggle('show', state.sessionReady && count > 0); }
    $('#cartItemCount').textContent = `(${count})`;

    const body = $('#cartBody');
    if (!state.cart.length) {
      body.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">🛍</div><p>Your bag is empty</p><small>Add some premium kicks to get started.</small></div>`;
    } else {
      body.innerHTML = state.cart.map(item => `
        <div class="cart-item">
          <div class="cart-item-img"><img src="${item.image}" style="filter:${item.imageFilter || 'none'}"></div>
          <div class="cart-item-info">
            <div class="cart-item-brand">${item.brand}</div>
            <h4>${item.name}</h4>
            <div style="font-size:11px;color:var(--muted);margin-bottom:6px;">
              ${item.colorName ? `Color: ${item.colorName}` : ''}${item.size ? ` · Size US ${item.size}` : ''}
            </div>
            <div class="cart-item-price">${money(item.price * item.qty)}</div>
            <div class="qty-controls">
              <button class="qty-btn" data-qty="${item.key}" data-delta="-1">−</button>
              <span class="qty-value">${item.qty}</span>
              <button class="qty-btn" data-qty="${item.key}" data-delta="1">+</button>
            </div>
          </div>
          <button class="remove-btn" data-remove="${item.key}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        </div>
      `).join('');
      $$('[data-qty]').forEach(b => b.addEventListener('click', () => changeQty(b.dataset.qty, +b.dataset.delta)));
      $$('[data-remove]').forEach(b => b.addEventListener('click', () => removeFromCart(b.dataset.remove)));
    }

    const subtotal = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
    $('#cartSubtotal').textContent = money(subtotal);
    $('#cartTotal').textContent = money(subtotal);
  }

  async function openCart() {
    if (!(await requireCustomerLogin())) return;
    cartDrawer.classList.add('open');
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeCart() {
    cartDrawer.classList.remove('open');
    overlay.classList.remove('show');
    checkBodyLock();
  }

  $('#cartBtn').addEventListener('click', openCart);
  $('#closeCart').addEventListener('click', closeCart);
  overlay.addEventListener('click', closeCart);

  $('#checkoutBtn').addEventListener('click', async () => {
    if (!state.cart.length) { showToast('Your bag is empty'); return; }
    try { const me=await apiFetch('/auth/me'); loginUser(me.user); }
    catch { state.currentUser=null; state.sessionReady=true; LS.del('aurum_user'); updateUserUI(); updateCartUI(); updateWishCount(); showToast('Please login to checkout'); closeCart(); setTimeout(openAuth,300); return; }
    closeCart();
    setTimeout(openCheckout, 200);
  });

  /* ============ WISHLIST ============ */
  async function toggleWishlist(id, btn) {
    if (!(await requireCustomerLogin())) return;
    const i = state.wishlist.indexOf(id);
    if (i > -1) { state.wishlist.splice(i, 1); btn.classList.remove('active'); showToast('Removed from wishlist'); }
    else { state.wishlist.push(id); btn.classList.add('active'); showToast('Added to wishlist ♥'); }
    LS.set('aurum_wish', state.wishlist);
    updateWishCount();
  }
  function updateWishCount() {
    const b = $('#wishCount'); if (!b) return;
    b.textContent = state.wishlist.length;
    b.classList.toggle('show', state.sessionReady && state.wishlist.length > 0);
  }
  const wishlistModal = $('#wishlistModal');
  async function openWishlist(){
    if (!(await requireCustomerLogin())) return;
    renderWishlist();
    wishlistModal.classList.add('show');
    document.body.style.overflow='hidden';
  }
  function closeWishlist(){ wishlistModal.classList.remove('show'); checkBodyLock(); }
  function renderWishlist(){
    const list=$('#wishlistList');
    const items=state.wishlist.map(id=>PRODUCTS.find(p=>Number(p.id)===Number(id))).filter(Boolean);
    if(!items.length){
      list.innerHTML='<div class="wishlist-empty"><div class="wishlist-empty-icon">♡</div><h4>Your wishlist is empty</h4><p>Save products you love and find them here anytime.</p><button class="btn btn-dark" id="wishlistShopBtn">Start Shopping →</button></div>';
      $('#wishlistShopBtn')?.addEventListener('click',closeWishlist);
      return;
    }
    list.innerHTML=items.map(p=>`<article class="wishlist-item">
      <button class="wishlist-remove" data-wish-remove="${p.id}" aria-label="Remove ${escapeHtml(p.name)}">×</button>
      <div class="wishlist-img"><img src="${p.image}" alt="${escapeHtml(p.name)}"></div>
      <div class="wishlist-info"><span>${escapeHtml(p.brand)} · ${escapeHtml(p.gender)}</span><h4>${escapeHtml(p.name)}</h4><strong>${money(p.price)}</strong></div>
      <button class="btn btn-dark wishlist-add" data-wish-add="${p.id}">Add to Bag</button>
    </article>`).join('');
    $$('[data-wish-remove]',list).forEach(b=>b.addEventListener('click',()=>{const id=Number(b.dataset.wishRemove);state.wishlist=state.wishlist.filter(x=>Number(x)!==id);LS.set('aurum_wish',state.wishlist);updateWishCount();renderWishlist();renderProducts();}));
    $$('[data-wish-add]',list).forEach(b=>b.addEventListener('click',()=>{const p=PRODUCTS.find(x=>Number(x.id)===Number(b.dataset.wishAdd));if(p){addToCart(p.id);showToast(`${p.name} added to bag`);}}));
  }
  $('#wishBtn').addEventListener('click', openWishlist);
  $('#closeWishlist').addEventListener('click', closeWishlist);
  wishlistModal.addEventListener('click',e=>{if(e.target===wishlistModal)closeWishlist();});

  /* ============ SEARCH ============ */
  const searchModal = $('#searchModal');
  const searchInput = $('#searchInput');
  const searchResults = $('#searchResults');
  const searchHints = $('#searchHints');

  function openSearch() {
    searchModal.classList.add('show');
    document.body.style.overflow = 'hidden';
    setTimeout(() => searchInput.focus(), 200);
    renderSearch('');
  }
  function closeSearch() { searchModal.classList.remove('show'); searchInput.value = ''; checkBodyLock(); }

  function renderSearch(q) {
    const query = q.trim().toLowerCase();
    let results = [];
    if (query) {
      results = PRODUCTS.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.brand.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        (p.gender && p.gender.toLowerCase().includes(query))
      ).slice(0, 20);
    } else {
      results = PRODUCTS.slice(0, 8);
    }

    if (!results.length) {
      searchResults.innerHTML = `<div class="search-empty">No products matched "<strong>${q}</strong>"</div>`;
      return;
    }

    searchResults.innerHTML = results.map(p => `
      <div class="search-result" data-open-search="${p.id}">
        <div class="search-result-img"><img src="${p.image}"></div>
        <div class="search-result-info">
          <div class="search-result-brand">${p.brand} · ${p.gender}</div>
          <div class="search-result-name">${p.name}</div>
          <div class="search-result-price">${money(p.price)}</div>
        </div>
      </div>
    `).join('');

    $$('[data-open-search]').forEach(el => el.addEventListener('click', () => {
      closeSearch(); setTimeout(() => openProduct(+el.dataset.openSearch), 220);
    }));
  }

  searchInput.addEventListener('input', e => {
    searchHints.style.display = e.target.value ? 'none' : 'flex';
    renderSearch(e.target.value);
  });
  $$('.search-chip').forEach(c => c.addEventListener('click', () => {
    searchInput.value = c.dataset.search;
    searchHints.style.display = 'none';
    renderSearch(c.dataset.search);
  }));
  $('#searchBtn').addEventListener('click', openSearch);
  $('#closeSearch').addEventListener('click', closeSearch);
  searchModal.addEventListener('click', e => { if (e.target === searchModal) closeSearch(); });

  /* ============ AUTH ============ */
  const authModal = $('#authModal');
  const loginBtn = $('#loginBtn');
  const userMenu = $('#userMenu');

  function openAuth() { authModal.classList.add('show'); document.body.style.overflow = 'hidden'; }
  function closeAuth() { authModal.classList.remove('show'); checkBodyLock(); }

  // Shopping actions require a real customer session; localStorage alone is never treated as login.
  async function requireCustomerLogin() {
    try {
      const data = await apiFetch('/auth/me');
      loginUser(data.user);
      return true;
    } catch (_) {
      state.currentUser = null;
      state.sessionReady = true;
      state.cart = [];
      state.wishlist = [];
      LS.del('aurum_user');
      LS.del('aurum_cart');
      LS.del('aurum_wish');
      updateUserUI();
      updateCartUI();
      updateWishCount();
      renderProducts();
      showToast('Please login or create an account to continue');
      openAuth();
      return false;
    }
  }

  loginBtn.addEventListener('click', openAuth);
  $('#closeAuth').addEventListener('click', closeAuth);
  authModal.addEventListener('click', e => { if (e.target === authModal) closeAuth(); });

  $$('.auth-tab').forEach(tab => tab.addEventListener('click', () => {
    $$('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    $$('.auth-form').forEach(f => f.classList.remove('active'));
    $(tab.dataset.tab === 'login' ? '#loginForm' : '#signupForm').classList.add('active');
  }));

  $$('[data-switch]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const target = a.dataset.switch;
    $$('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === target));
    $$('.auth-form').forEach(f => f.classList.remove('active'));
    $(target === 'login' ? '#loginForm' : '#signupForm').classList.add('active');
  }));

  $('#signupForm').addEventListener('submit', async function(e){e.preventDefault();const name=$('#signupName').value.trim(),email=$('#signupEmail').value.trim().toLowerCase(),password=$('#signupPassword').value;if(!name||!email||!password){showToast('Please fill all fields');return;}if(password.length<8){showToast('Password must be 8+ characters');return;}try{const data=await apiFetch('/auth/signup',{method:'POST',body:JSON.stringify({name,email,password})});loginUser(data.user);this.reset();closeAuth();showToast(`Welcome to AURUM, ${name.split(' ')[0]}! ✨`);}catch(err){showToast(err.message);}});

  $('#loginForm').addEventListener('submit', async function(e){e.preventDefault();const email=$('#loginEmail').value.trim().toLowerCase(),password=$('#loginPassword').value;try{const data=await apiFetch('/auth/login',{method:'POST',body:JSON.stringify({email,password})});loginUser(data.user);this.reset();closeAuth();showToast(`Welcome back, ${data.user.name.split(' ')[0]}! ✨`);}catch(err){showToast(err.message);}});

  function loginUser(user){state.currentUser=user;state.sessionReady=true;LS.del('aurum_user');updateUserUI();updateCartUI();updateWishCount();}
  function logoutUser(){apiFetch('/auth/logout',{method:'POST'}).catch(()=>{});state.currentUser=null;state.sessionReady=true;state.orders=[];LS.del('aurum_user');updateUserUI();updateCartUI();updateWishCount();showToast('Signed out successfully');}
  function updateUserUI() {
    if (state.currentUser) {
      loginBtn.style.display = 'none';
      userMenu.style.display = 'flex';
      const initial = state.currentUser.name.charAt(0).toUpperCase();
      $('#userAvatar').textContent = initial;
      $('#userAvatarLg').textContent = initial;
      $('#userName').textContent = state.currentUser.name.split(' ')[0];
      $('#userNameFull').textContent = state.currentUser.name;
      $('#userEmailDisplay').textContent = state.currentUser.email;
    } else {
      loginBtn.style.display = 'inline-flex';
      userMenu.style.display = 'none';
    }
  }

  const userBtn = $('#userBtn');
  const userDropdown = $('#userDropdown');
  userBtn.addEventListener('click', (e) => { e.stopPropagation(); userDropdown.classList.toggle('show'); });
  document.addEventListener('click', (e) => { if (!userMenu.contains(e.target)) userDropdown.classList.remove('show'); });
  $('#logoutBtn').addEventListener('click', () => { userDropdown.classList.remove('show'); logoutUser(); });
  $('#myOrdersBtn').addEventListener('click', () => { userDropdown.classList.remove('show'); openOrders(); });

  /* ============ CHECKOUT ============ */
  const checkoutModal = $('#checkoutModal');

  const INDIA_STATES = [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana',
    'Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
    'Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
    'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
    'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi',
    'Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'
  ];

  let savedAddresses = [];

  function populateStateDropdown(selected = '') {
    const select = $('#ckState');
    if (!select) return;
    select.innerHTML = '<option value="">Select state / UT</option>' +
      INDIA_STATES.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    if (selected) select.value = selected;
  }

  function addressFromForm() {
    return {
      fullName: $('#ckName').value.trim(),
      phone: $('#ckPhone').value.trim(),
      line1: $('#ckAddress').value.trim(),
      city: $('#ckCity').value.trim(),
      state: $('#ckState').value.trim(),
      pincode: $('#ckPin').value.trim(),
      label: 'Home',
      isDefault: true
    };
  }

  function fillCheckoutAddress(a) {
    if (!a) return;
    $('#ckName').value = a.fullName || '';
    $('#ckPhone').value = a.phone || '';
    $('#ckAddress').value = a.line1 || '';
    $('#ckCity').value = a.city || '';
    populateStateDropdown(a.state || '');
    $('#ckPin').value = a.pincode || '';
  }

  function renderSavedAddresses() {
    const select = $('#savedAddressSelect');
    if (!select) return;
    select.innerHTML = '<option value="">New address</option>' + savedAddresses.map(a => {
      const label = a.label || 'Saved address';
      const place = [a.city, a.state].filter(Boolean).join(', ');
      return `<option value="${a.id}">${escapeHtml(label)} — ${escapeHtml(a.fullName)}${place ? ` · ${escapeHtml(place)}` : ''}${a.isDefault ? ' · Default' : ''}</option>`;
    }).join('');
    const preferred = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
    if (preferred) {
      select.value = String(preferred.id);
      fillCheckoutAddress(preferred);
      $('#saveAddress').checked = false;
    }
  }

  async function loadSavedAddresses() {
    if (!state.currentUser) return;
    try {
      savedAddresses = await apiFetch('/addresses');
      renderSavedAddresses();
    } catch (e) {
      savedAddresses = [];
      renderSavedAddresses();
    }
  }

  async function openCheckout(){
    renderCheckoutSummary();
    const grid = checkoutModal.querySelector('.checkout-grid');
    if (grid && (grid.dataset.upi === '1' || grid.dataset.success === '1')) location.reload();
    populateStateDropdown();
    checkoutModal.classList.add('show');
    document.body.style.overflow='hidden';
    if ($('#ckEmail') && state.currentUser) $('#ckEmail').value = state.currentUser.email || '';
    await loadSavedAddresses();
  }

  function closeCheckout() {
    const grid = checkoutModal.querySelector('.checkout-grid');
    checkoutModal.classList.remove('show'); checkBodyLock();
    if (grid && (grid.dataset.success === '1' || grid.dataset.upi === '1')) location.reload();
  }

  function renderCheckoutSummary() {
    const items = $('#checkoutItems'), totals = $('#checkoutTotals');
    if (!items || !totals) return;
    items.innerHTML = state.cart.map(item => `
      <div class="checkout-item">
        <div class="checkout-item-img"><img src="${item.image}" style="filter:${item.imageFilter || 'none'}"></div>
        <div class="checkout-item-info">
          <h5>${escapeHtml(item.name)}</h5>
          <small>${escapeHtml(item.colorName || '')}${item.size ? ` · US ${escapeHtml(item.size)}` : ''} · Qty ${item.qty}</small>
        </div>
        <div class="checkout-item-price">${money(item.price * item.qty)}</div>
      </div>
    `).join('');
    const subtotal = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
    const shipping = subtotal >= 15000 ? 0 : 199;
    const tax = Math.round(subtotal * 0.05);
    const total = subtotal + shipping + tax;
    totals.innerHTML = `
      <div><span>Subtotal</span><span>${money(subtotal)}</span></div>
      <div><span>Shipping</span><span>${shipping ? money(shipping) : 'FREE'}</span></div>
      <div><span>Tax (5%)</span><span>${money(tax)}</span></div>
      <div class="total-row"><span>Total</span><span>${money(total)}</span></div>
    `;
  }

  $('#savedAddressSelect').addEventListener('change', e => {
    const id = e.target.value;
    if (!id) {
      $('#checkoutForm').reset();
      if (state.currentUser) $('#ckEmail').value = state.currentUser.email || '';
      populateStateDropdown();
      $('#saveAddress').checked = true;
      return;
    }
    const address = savedAddresses.find(a => String(a.id) === String(id));
    if (address) {
      fillCheckoutAddress(address);
      $('#saveAddress').checked = false;
      showToast('Saved address selected ✓');
    }
  });

  $('#closeCheckout').addEventListener('click', closeCheckout);
  checkoutModal.addEventListener('click', e => { if (e.target === checkoutModal) closeCheckout(); });

  $('#checkoutForm').addEventListener('submit',async function(e){
    e.preventDefault();
    if(!state.cart.length){showToast('Your bag is empty');return;}
    if(!state.currentUser){showToast('Please login first');closeCheckout();setTimeout(openAuth,300);return;}

    const address=addressFromForm();
    if (!address.state) { showToast('Please select your state / UT'); $('#ckState').focus(); return; }
    if (!/^\d{6}$/.test(address.pincode)) { showToast('Please enter a valid 6-digit pincode'); $('#ckPin').focus(); return; }

    const paymentMethod=document.querySelector('input[name="payment"]:checked')?.value||'cod';
    const saveThisAddress = $('#saveAddress')?.checked;
    const selectedAddressId = $('#savedAddressSelect')?.value;
    const btn=this.querySelector('.place-order-btn');
    btn.disabled=true;btn.textContent='Creating order…';
    try{
      if (saveThisAddress && !selectedAddressId) {
        await apiFetch('/addresses',{method:'POST',body:JSON.stringify(address)});
        await loadSavedAddresses();
      }
      const data=await apiFetch('/orders',{method:'POST',body:JSON.stringify({items:state.cart,address,paymentMethod})});
      if(paymentMethod==='cod'){showOrderSuccess(data.order.id,data.order.total);return;}
      await showUpiPayment(data.order,data.upi);
    }catch(err){showToast(err.message);btn.disabled=false;btn.textContent='Place Order →';}
  });

  async function showUpiPayment(order,upi){
    const grid=checkoutModal.querySelector('.checkout-grid');
    let qr='';
    try{const q=await apiFetch('/store/upi-qr/'+order.id);qr=q.qr;}catch(e){throw new Error(e.message||'Could not load UPI QR');}
    grid.dataset.upi='1';
    grid.innerHTML=`<div class="upi-payment-screen">
      <div class="upi-payment-head"><div class="upi-icon">₹</div><h3>Pay securely with UPI</h3><p>Scan the QR using GPay, PhonePe, Paytm or any UPI app.</p></div>
      <div class="upi-pay-card">
        <div class="upi-amount-label">Amount to pay</div><div class="upi-amount">${money(order.total)}</div>
        <img class="upi-qr" src="${qr}" alt="AURUM UPI QR Code">
        <div class="upi-merchant">${escapeHtml(upi?.upiName||'AURUM Store')}</div>
        <div class="upi-id-row"><span id="upiIdText">${escapeHtml(upi?.upiId||'')}</span><button type="button" class="btn btn-outline btn-copy-upi" id="copyUpiBtn">Copy UPI ID</button></div>
      </div>
      <div class="upi-instructions"><strong>After payment</strong><span>Enter the UTR / Transaction ID from your UPI app. Your order will be verified by the store.</span></div>
      <form id="upiUtrForm" class="upi-utr-form"><label for="upiUtr">UTR / Transaction ID</label><input id="upiUtr" required maxlength="35" placeholder="e.g. 123456789012" autocomplete="off"><button class="btn btn-dark btn-full" type="submit">Submit Payment Details →</button></form>
      <div class="upi-order-ref">Order ID: <strong>${order.id}</strong></div>
    </div>`;
    $('#copyUpiBtn').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(upi?.upiId||'');showToast('UPI ID copied');}catch(_){showToast('UPI ID: '+(upi?.upiId||''));}});
    $('#upiUtrForm').addEventListener('submit',async e=>{
      e.preventDefault();const form=e.currentTarget;const submit=form.querySelector('button');submit.disabled=true;submit.textContent='Submitting…';
      try{await apiFetch('/payments/upi/submit',{method:'POST',body:JSON.stringify({orderId:order.id,utr:$('#upiUtr').value.trim()})});showPaymentPending(order.id,order.total);}catch(err){showToast(err.message);submit.disabled=false;submit.textContent='Submit Payment Details →';}
    });
  }

  function showPaymentPending(orderId,total){
    const grid=checkoutModal.querySelector('.checkout-grid');grid.dataset.success='1';grid.dataset.upi='0';grid.innerHTML=`<div class="order-success"><div class="order-success-icon">✓</div><h3>Payment Submitted</h3><p>Your UTR has been received successfully.</p><p>We will verify the payment and update your order.</p><div class="order-id">Order ID: ${orderId}</div><p style="font-size:14px;color:var(--dark);font-weight:600;margin-top:8px;">Total: ${money(total)}</p><div class="payment-pending-note">Payment status: <strong>Verification pending</strong></div><div style="display:flex;gap:10px;justify-content:center;margin-top:26px;flex-wrap:wrap;"><button class="btn btn-outline" id="viewOrderBtn" type="button">View Order</button><button class="btn btn-dark" id="continueBtn" type="button">Continue Shopping →</button></div></div>`;
    state.cart=[];saveCart();updateCartUI();showToast('Payment details submitted ✓');
    $('#continueBtn').addEventListener('click',()=>{checkoutModal.classList.remove('show');location.reload();});
    $('#viewOrderBtn').addEventListener('click',()=>{checkoutModal.classList.remove('show');setTimeout(openOrders,200);});
  }

  function showOrderSuccess(orderId,total){const grid=checkoutModal.querySelector('.checkout-grid');grid.dataset.success='1';grid.dataset.upi='0';grid.innerHTML=`<div class="order-success"><div class="order-success-icon">✓</div><h3>Order Placed!</h3><p>Thank you for shopping with AURUM.</p><p>Your order has been confirmed.</p><div class="order-id">Order ID: ${orderId}</div><p style="font-size:14px;color:var(--dark);font-weight:600;margin-top:8px;">Total: ${money(total)}</p><div style="display:flex;gap:10px;justify-content:center;margin-top:26px;flex-wrap:wrap;"><button class="btn btn-outline" id="viewOrderBtn" type="button">View Order</button><button class="btn btn-dark" id="continueBtn" type="button">Continue Shopping →</button></div></div>`;state.cart=[];saveCart();updateCartUI();showToast('Order placed successfully 🎉');$('#continueBtn').addEventListener('click',()=>{checkoutModal.classList.remove('show');location.reload();});$('#viewOrderBtn').addEventListener('click',()=>{checkoutModal.classList.remove('show');setTimeout(openOrders,200);});}

  /* ============ ORDERS ============ */
  const ordersModal = $('#ordersModal');
  async function openOrders(){
    try{
      const me=await apiFetch('/auth/me');
      loginUser(me.user);
      state.orders=await apiFetch('/orders');
      renderOrders();
      ordersModal.classList.add('show');
      document.body.style.overflow='hidden';
    }catch(err){
      state.currentUser=null; state.sessionReady=true; LS.del('aurum_user'); updateUserUI(); updateCartUI(); updateWishCount();
      showToast('Please login to view your orders');
      openAuth();
    }
  }
  function closeOrders() { ordersModal.classList.remove('show'); checkBodyLock(); }

  function renderOrders() {
    const list = $('#ordersList');
    const myOrders = state.orders;
    if (!myOrders.length) {
      list.innerHTML = `
        <div class="orders-empty">
          <div class="orders-empty-icon">📦</div>
          <h4>No orders yet</h4>
          <p>Your order history will appear here once you place an order.</p>
          <button class="btn btn-dark" id="startShopping">Start Shopping →</button>
        </div>`;
      const s = $('#startShopping');
      if (s) s.addEventListener('click', () => { closeOrders(); setTimeout(() => $('#shop').scrollIntoView({ behavior: 'smooth' }), 200); });
      return;
    }
    myOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
    list.innerHTML = myOrders.map(o => {
      const d = new Date(o.date);
      const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      return `
        <div class="order-card">
          <div class="order-card-head">
            <div>
              <div class="order-id-line">Order <strong>#${o.id}</strong></div>
              <div class="order-date">${dateStr} · ${o.items.length} item${o.items.length > 1 ? 's' : ''}</div>
            </div>
            <div class="order-status ${o.status}">${(o.cancelRequestStatus==='requested'?'CANCELLATION REQUESTED':o.cancelRequestStatus==='rejected'?'CANCELLATION REJECTED':o.cancelRequestStatus==='approved'?'CANCELLED':o.returnRequestStatus==='requested'?(String(o.returnType||'return').toUpperCase()+' REQUESTED'):o.returnRequestStatus==='approved'?(String(o.returnType||'return').toUpperCase()+' ACCEPTED'):o.returnRequestStatus==='rejected'?(String(o.returnType||'return').toUpperCase()+' REJECTED'):o.status.replaceAll('_',' ')).toUpperCase()}</div>
          </div>
          <div class="order-items">
            ${o.items.map(it => `
              <div class="order-item">
                <div class="order-item-img"><img src="${it.image}" style="filter:${it.imageFilter || 'none'}"></div>
                <div class="order-item-info">
                  <h5>${it.name}</h5>
                  <small>${it.colorName || ''}${it.size ? ` · US ${it.size}` : ''} · Qty ${it.qty}</small>
                </div>
                <div class="order-item-price">${money(it.price * it.qty)}</div>
              </div>
            `).join('')}
          </div>
          <div class="order-card-foot">
            <div class="order-pay-method">Payment: <strong>${o.paymentMethod === 'cod' ? 'Cash on Delivery' : 'UPI'} · ${escapeHtml(String(o.paymentStatus || '').replaceAll('_',' '))}</strong></div>
            <div class="order-total">Total: <strong>${money(o.total)}</strong></div>
            <button class="btn btn-outline order-detail-btn" data-order-detail="${escapeHtml(o.id)}" type="button">View Details</button>
          </div>
        </div>
      `;
    }).join('');
    $$('[data-order-detail]', list).forEach(b=>b.addEventListener('click',()=>openOrderDetail(b.dataset.orderDetail)));
  }
  async function openOrderDetail(id){
    try{
      const o=await apiFetch('/orders/'+encodeURIComponent(id));
      const detail=document.createElement('div'); detail.className='modal-backdrop show'; detail.id='orderDetailModal';
      detail.innerHTML=`<div class="modal-box order-detail-modal-box"><button class="modal-close" id="closeOrderDetail" type="button">×</button><div class="order-detail-wrap"><div class="order-detail-head"><div><span class="eyebrow">ORDER DETAILS</span><h3>#${escapeHtml(o.id)}</h3><p>${new Date(o.date).toLocaleString('en-IN')}</p></div><span class="order-status ${escapeHtml(o.status)}">${escapeHtml((o.cancelRequestStatus==='requested'?'CANCELLATION REQUESTED':o.cancelRequestStatus==='rejected'?'CANCELLATION REJECTED':o.cancelRequestStatus==='approved'?'CANCELLED':o.returnRequestStatus==='requested'?String(o.returnType||'return').toUpperCase()+' REQUESTED':o.returnRequestStatus==='approved'?String(o.returnType||'return').toUpperCase()+' ACCEPTED':o.returnRequestStatus==='rejected'?String(o.returnType||'return').toUpperCase()+' REJECTED':o.status.replaceAll('_',' ')).toUpperCase())}</span></div><div class="order-detail-items">${o.items.map(it=>`<div class="order-detail-item"><img src="${it.image}" alt="${escapeHtml(it.name)}"><div><strong>${escapeHtml(it.name)}</strong><small>Qty ${it.qty}${it.size?` · US ${escapeHtml(it.size)}`:''}</small></div><b>${money(it.price*it.qty)}</b></div>`).join('')}</div><div class="order-detail-grid"><div><span>Shipping Address</span><strong>${escapeHtml(o.address.fullName)}</strong><p>${escapeHtml(o.address.line1)}, ${escapeHtml(o.address.city)}, ${escapeHtml(o.address.state)} - ${escapeHtml(o.address.pincode)}<br>${escapeHtml(o.address.phone)}</p></div><div><span>Payment</span><strong>${o.paymentMethod==='cod'?'Cash on Delivery':'UPI'}</strong><p>Status: ${escapeHtml(String(o.paymentStatus).replaceAll('_',' '))}${o.paymentUtr?`<br>UTR: ${escapeHtml(o.paymentUtr)}`:''}</p></div></div><div class="order-detail-total"><span>Total</span><strong>${money(o.total)}</strong></div><div class="order-request-panel" style="margin-top:18px;padding-top:14px;border-top:1px solid #e6dfd3"><p><strong>Cancellation:</strong> ${escapeHtml(String(o.cancelRequestStatus||'none').replaceAll('_',' ').toUpperCase())}${o.cancelReason?` — ${escapeHtml(o.cancelReason)}`:''}</p><p><strong>Return/Replacement:</strong> ${escapeHtml(String(o.returnRequestStatus||'none').replaceAll('_',' ').toUpperCase())}${o.returnType?` (${escapeHtml(o.returnType)})`:''}${o.returnReason?` — ${escapeHtml(o.returnReason)}`:''}</p>${o.adminNote?`<p><strong>Admin note:</strong> ${escapeHtml(o.adminNote)}</p>`:''}${(['pending','confirmed','packed','pending_payment'].includes(o.status)&&!['requested','approved'].includes(o.cancelRequestStatus)?`<button class="btn btn-outline" id="requestCancelBtn" type="button">Request Cancellation</button>`:'')}${(o.status==='delivered'&&(!o.returnRequestStatus||['none','rejected'].includes(o.returnRequestStatus))?`<button class="btn btn-outline" id="requestReturnBtn" type="button">Return / Replacement</button>`:'')}</div></div></div>`;
      document.body.appendChild(detail); document.body.style.overflow='hidden';
      const cancelBtn=detail.querySelector('#requestCancelBtn'); if(cancelBtn) cancelBtn.addEventListener('click',async()=>{const reason=prompt('Please enter the cancellation reason:');if(!reason||!reason.trim())return;try{await apiFetch('/orders/'+encodeURIComponent(o.id)+'/cancel-request',{method:'POST',body:JSON.stringify({reason:reason.trim()})});showToast('Cancellation request submitted');detail.remove();state.orders=await apiFetch('/orders');renderOrders();openOrderDetail(o.id);}catch(err){showToast(err.message);}});
      const returnBtn=detail.querySelector('#requestReturnBtn'); if(returnBtn) returnBtn.addEventListener('click',async()=>{const type=prompt('Type RETURN or REPLACEMENT:','RETURN');if(!type)return;const normalized=type.trim().toLowerCase();if(!['return','replacement'].includes(normalized)){showToast('Enter RETURN or REPLACEMENT');return;}const reason=prompt('Please enter the reason:');if(!reason||!reason.trim())return;try{await apiFetch('/orders/'+encodeURIComponent(o.id)+'/return-request',{method:'POST',body:JSON.stringify({type:normalized,reason:reason.trim()})});showToast('Return/replacement request submitted');detail.remove();state.orders=await apiFetch('/orders');renderOrders();openOrderDetail(o.id);}catch(err){showToast(err.message);}});
      detail.querySelector('#closeOrderDetail').addEventListener('click',()=>{detail.remove();checkBodyLock();});
      detail.addEventListener('click',e=>{if(e.target===detail){detail.remove();checkBodyLock();}});
    }catch(e){showToast(e.message);}
  }
  $('#closeOrders').addEventListener('click', closeOrders);
  ordersModal.addEventListener('click', e => { if (e.target === ordersModal) closeOrders(); });

  /* ============ NEWSLETTER ============ */
  $('#newsletterForm').addEventListener('submit', e => {
    e.preventDefault();
    showToast('Subscribed! Welcome to the AURUM circle ✨');
    e.target.reset();
  });

  /* ============ TOAST ============ */
  let toastTimer;
  function showToast(msg) {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  /* ============ REVEAL ============ */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  function observeReveals() {
    $$('.reveal:not(.visible)').forEach((el, i) => {
      el.style.transitionDelay = ((i % 6) * 0.06) + 's';
      revealObserver.observe(el);
    });
  }

  /* ============ ESC ============ */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeProduct(); closeAuth(); closeCart(); closeSearch(); closeCheckout(); closeOrders(); closeWishlist(); document.getElementById('orderDetailModal')?.remove(); checkBodyLock(); }
  });

  /* ============ INIT ============ */
  async function loadProductStock() {
    try {
      const liveProducts = await apiFetch('/products');
      const byId = new Map(liveProducts.map(p => [Number(p.id), p])); let changed=false;
      PRODUCTS.forEach(p => { const live=byId.get(Number(p.id)); if(live){const next=Math.max(0,Number(live.stock)||0);if(Number(p.stock)!==next)changed=true;p.stock=next;} });
      if(changed){renderProducts();renderFeatured();}
    } catch (err) { console.warn('Could not load live product inventory:', err.message); }
  }
  async function restoreSession(){try{const data=await apiFetch('/auth/me');loginUser(data.user);}catch(_){state.currentUser=null;state.sessionReady=true;state.cart=[];state.wishlist=[];LS.del('aurum_user');LS.del('aurum_cart');LS.del('aurum_wish');updateUserUI();updateCartUI();updateWishCount();renderProducts();}}

  async function init(){await restoreSession(); await loadProductStock(); window.setInterval(()=>{if(!document.hidden)loadProductStock();},5000); document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadProductStock();});
    renderHero();
    renderTrustMarquee();
    renderFeatured();
    setupFilters();
    renderProducts();
    renderWorldBrands();
    updateCartUI();
    updateWishCount();
    updateUserUI();
    observeReveals();
  }

  document.addEventListener('DOMContentLoaded', init);
})();