// ========== ОЧИСТКА КЕША БЕЗ ПЕРЕЗАГРУЗКИ ==========
(function() {
  console.log('🚀 Очистка кеша без перезагрузки...');
  
  // Проверяем, была ли уже очистка
  if (sessionStorage.getItem('mdt_cleaned') === 'true') {
    console.log('✅ Кеш уже очищен');
    return;
  }
  
  // 1. Очищаем localStorage (сохраняем важное)
  try {
    const favs = localStorage.getItem('mdt_favorites_v1');
    const github = localStorage.getItem('mdt_github_settings');
    
    localStorage.clear();
    
    if (favs) localStorage.setItem('mdt_favorites_v1', favs);
    if (github) localStorage.setItem('mdt_github_settings', github);
    
    console.log('✅ localStorage очищен');
  } catch(e) {
    console.warn('⚠️ Ошибка очистки localStorage:', e);
  }
  
  // 2. Очищаем sessionStorage
  try {
    sessionStorage.clear();
    console.log('✅ sessionStorage очищен');
  } catch(e) {
    console.warn('⚠️ Ошибка очистки sessionStorage:', e);
  }
  
  // 3. Очищаем Cache API
  if ('caches' in window && window.caches) {
    try {
      caches.keys().then(function(names) {
        for (let name of names) {
          caches.delete(name);
          console.log('✅ Кеш удален:', name);
        }
      }).catch(function(err) {
        console.warn('⚠️ Ошибка при очистке кешей:', err);
      });
    } catch(e) {
      console.warn('⚠️ Ошибка доступа к Cache API:', e);
    }
  }
  
  // 4. Отключаем Service Workers
  if ('serviceWorker' in navigator && navigator.serviceWorker) {
    try {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for (let registration of registrations) {
          registration.unregister();
          console.log('✅ Service Worker отключен');
        }
      }).catch(function(err) {
        console.warn('⚠️ Ошибка при отключении SW:', err);
      });
    } catch(e) {
      console.warn('⚠️ Ошибка доступа к Service Worker:', e);
    }
  }
  
  // 5. Отмечаем, что очистка выполнена
  sessionStorage.setItem('mdt_cleaned', 'true');
  
  console.log('✅ Очистка кеша завершена (без перезагрузки)');
})();

// ========== ОСТАЛЬНОЙ ВАШ КОД ==========

const AUTH = { user: "anastasia_zy_zy", pass: "anastasia_zy_zy" };
const LS_KEY = "mdt_watches_v2";
const FAV_KEY = "mdt_favorites_v1";
const GITHUB_KEY = "mdt_github_settings";

let canUseStorage = false;
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('__test__', '1');
    window.localStorage.removeItem('__test__');
    canUseStorage = true;
  }
} catch (e) { canUseStorage = false; }

let isAuthed = false;
let hasUnsavedChanges = false;
let currentCategory = "all";
let priceFilterMin = null;
let priceFilterMax = null;
let favorites = [];

// ========== ИЗБРАННОЕ ==========
function loadFavorites() {
  if (!canUseStorage) return [];
  try {
    const f = window.localStorage.getItem(FAV_KEY);
    return f ? JSON.parse(f) : [];
  } catch (e) { return []; }
}

function saveFavorites() {
  if (canUseStorage) {
    try { window.localStorage.setItem(FAV_KEY, JSON.stringify(favorites)); } catch (e) {}
  }
  updateFavCount();
}

function updateFavCount() {
  const counters = document.querySelectorAll('[id^="favCount"]');
  counters.forEach(el => {
    el.textContent = favorites.length;
  });
}

function isFav(article) {
  return favorites.includes(article);
}

function toggleFav(article) {
  const idx = favorites.indexOf(article);
  if (idx >= 0) {
    favorites.splice(idx, 1);
  } else {
    favorites.push(article);
  }
  saveFavorites();
  
  // ТОЧЕЧНОЕ ОБНОВЛЕНИЕ БЕЗ ПЕРЕРИСОВКИ
  const escapedArticle = article.replace(/"/g, '\\"');
  
  // Обновляем кнопку
  const btn = document.querySelector(`[data-fav="${escapedArticle}"]`);
  if (btn) {
    const isActive = isFav(article);
    btn.classList.toggle('active', isActive);
    btn.textContent = isActive ? '❤️' : '🤍';
    btn.title = isActive ? 'Убрать из избранного' : 'В избранное';
    
    // Легкая анимация через CSS класс
    btn.classList.remove('animating');
    void btn.offsetWidth; // принудительный reflow для перезапуска анимации
    btn.classList.add('animating');
  }
  
  // Обновляем рамку карточки
  const card = document.querySelector(`[data-article="${escapedArticle}"]`);
  if (card) {
    card.classList.toggle('fav-active', isFav(article));
  }
  
  // Обновляем счетчик
  updateFavCount();
  
  // Если открыта модалка избранного — обновляем её
  const favModal = document.getElementById("favModal");
  if (favModal && favModal.classList.contains("open")) {
    openFavModal();
  }
}

// ========== ДАННЫЕ КАТАЛОГА ==========
function migrateData(list) {
  return list.map(w => {
    if (!w.images) { w.images = w.img ? [w.img] : []; delete w.img; }
    if (!w.category) w.category = "men";
    return w;
  });
}

function loadFromEmbedded() {
  try {
    const el = document.getElementById("catalog-data");
    if (!el) return [];
    return migrateData(JSON.parse(el.textContent.trim() || "[]"));
  } catch (e) { return []; }
}

function loadWatches() {
  if (canUseStorage) {
    try {
      const ls = window.localStorage.getItem(LS_KEY);
      if (ls !== null) return migrateData(JSON.parse(ls));
    } catch (e) { canUseStorage = false; }
  }
  return loadFromEmbedded();
}

function saveWatches(list) {
  if (canUseStorage) {
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(list)); }
    catch (e) { canUseStorage = false; }
  }
  hasUnsavedChanges = true;
  updateSaveBanner();
}

function updateSaveBanner() {
  const banner = document.getElementById("saveBanner");
  if (banner) {
    if (hasUnsavedChanges && isAuthed) banner.classList.add("show");
    else banner.classList.remove("show");
  }
}

// ========== ИЗОБРАЖЕНИЯ ==========
function compressImage(file, maxWidth = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressFiles(files) {
  const result = [];
  for (const f of files) { 
    try { result.push(await compressImage(f)); } catch (e) {} 
  }
  return result;
}

// ========== СОХРАНЕНИЕ ==========
function saveToFile() {
  try {
    const watches = loadWatches();
    const html = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
    const dataJson = JSON.stringify(watches);
    const escaped = dataJson.replace(/<\//g, "<\\/");
    const updated = html.replace(
      /<script id="catalog-data" type="application\/json">[\s\S]*?<\/script>/,
      `<script id="catalog-data" type="application\/json">${escaped}<\/script>`
    );
    const blob = new Blob([updated], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "index.html";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    hasUnsavedChanges = false; 
    updateSaveBanner();
    alert("✅ Файл скачан!");
  } catch (e) { 
    alert("Ошибка: " + e.message); 
  }
}

// ========== GITHUB ==========
function getGithubSettings() {
  if (!canUseStorage) return null;
  try { 
    const s = window.localStorage.getItem(GITHUB_KEY); 
    return s ? JSON.parse(s) : null; 
  } catch (e) { return null; }
}

function saveGithubSettings(settings) {
  if (!canUseStorage) return;
  try { window.localStorage.setItem(GITHUB_KEY, JSON.stringify(settings)); } catch (e) {}
}

async function updateGithub() {
  const settings = getGithubSettings();
  if (!settings) { 
    openModal("githubModal"); 
    return; 
  }
  const err = document.getElementById("githubErr");
  err.textContent = " Отправка на GitHub...";
  try {
    const watches = loadWatches();
    const html = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
    const dataJson = JSON.stringify(watches);
    const escaped = dataJson.replace(/<\//g, "<\\/");
    const updated = html.replace(
      /<script id="catalog-data" type="application\/json">[\s\S]*?<\/script>/,
      `<script id="catalog-data" type="application\/json">${escaped}<\/script>`
    );
    const content = btoa(unescape(encodeURIComponent(updated)));
    const getFileUrl = `https://api.github.com/repos/${settings.username}/${settings.repo}/contents/index.html?ref=${settings.branch}`;
    const getFileResponse = await fetch(getFileUrl, {
      headers: { 'Authorization': `token ${settings.token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    let sha = null;
    if (getFileResponse.ok) { 
      const fileData = await getFileResponse.json(); 
      sha = fileData.sha; 
    }
    const putUrl = `https://api.github.com/repos/${settings.username}/${settings.repo}/contents/index.html`;
    const body = { 
      message: "Update catalog - " + new Date().toISOString(), 
      content: content, 
      branch: settings.branch 
    };
    if (sha) body.sha = sha;
    const putResponse = await fetch(putUrl, {
      method: 'PUT',
      headers: { 
        'Authorization': `token ${settings.token}`, 
        'Accept': 'application/vnd.github.v3+json', 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(body)
    });
    if (putResponse.ok) {
      err.textContent = ""; 
      hasUnsavedChanges = false; 
      updateSaveBanner();
      alert("✅ Файл обновлён на GitHub!\nСайт обновится через 1-2 минуты.\nhttps://" + settings.username + ".github.io/" + settings.repo + "/");
    } else {
      const errorData = await putResponse.json();
      throw new Error(errorData.message || "Неизвестная ошибка");
    }
  } catch (e) {
    err.textContent = "❌ Ошибка: " + e.message;
    alert("Ошибка: " + e.message);
  }
}

// ========== ФОРМАТИРОВАНИЕ ==========
function fmtPrice(n) { 
  return Number(n).toLocaleString("ru-RU") + " ₸"; 
}

function stockInfo(qty) {
  const q = Number(qty);
  if (!q) return { cls: "out", text: "Нет в наличии" };
  if (q <= 3) return { cls: "low", text: `В наличии: ${q} шт.` };
  return { cls: "in", text: `В наличии: ${q} шт.` };
}

function placeholderSVG() {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f5d98a"/><stop offset="100%" stop-color="#d4af37"/>
    </linearGradient></defs>
    <circle cx="50" cy="50" r="28" fill="none" stroke="url(#g)" stroke-width="2.5"/>
    <circle cx="50" cy="50" r="22" fill="none" stroke="url(#g)" stroke-width="1" opacity=".6"/>
    <line x1="50" y1="50" x2="50" y2="34" stroke="url(#g)" stroke-width="2" stroke-linecap="round"/>
    <line x1="50" y1="50" x2="62" y2="50" stroke="url(#g)" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"']/g, c => ({ 
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" 
  }[c]));
}

function getFilteredWatches() {
  let watches = loadWatches();
  if (currentCategory !== "all") watches = watches.filter(w => w.category === currentCategory);
  if (priceFilterMin !== null) watches = watches.filter(w => w.price >= priceFilterMin);
  if (priceFilterMax !== null) watches = watches.filter(w => w.price <= priceFilterMax);
  return watches;
}

// ========== ЛАЙТБОКС ==========
let lightboxImages = [];
let lightboxIdx = 0;
let lightboxArticle = "";
let lightboxPrice = "";

function openLightbox(images, article, price, startIdx) {
  if (!images || images.length === 0) return;
  lightboxImages = images;
  lightboxIdx = startIdx || 0;
  lightboxArticle = article || "";
  lightboxPrice = price || "";
  renderLightbox();
  document.getElementById("lightbox").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  document.getElementById("lightbox").classList.remove("open");
  document.body.style.overflow = "";
}

function renderLightbox() {
  const img = document.getElementById("lightboxImg");
  img.src = lightboxImages[lightboxIdx];
  document.getElementById("lightboxArticle").textContent = lightboxArticle ? "Артикул: " + lightboxArticle : "";
  document.getElementById("lightboxPrice").textContent = lightboxPrice;
  
  const dots = document.getElementById("lightboxDots");
  if (lightboxImages.length > 1) {
    dots.innerHTML = lightboxImages.map((_, k) => 
      `<button class="lightbox-dot${k === lightboxIdx ? ' active' : ''}" data-k="${k}"></button>`
    ).join("");
    dots.style.display = "flex";
    document.getElementById("lightboxPrev").style.display = "flex";
    document.getElementById("lightboxNext").style.display = "flex";
    dots.querySelectorAll(".lightbox-dot").forEach(d => {
      d.onclick = function() {
        lightboxIdx = parseInt(this.getAttribute("data-k"));
        renderLightbox();
      };
    });
  } else {
    dots.style.display = "none";
    document.getElementById("lightboxPrev").style.display = "none";
    document.getElementById("lightboxNext").style.display = "none";
  }
}

function lightboxPrev() {
  lightboxIdx = (lightboxIdx - 1 + lightboxImages.length) % lightboxImages.length;
  renderLightbox();
}

function lightboxNext() {
  lightboxIdx = (lightboxIdx + 1) % lightboxImages.length;
  renderLightbox();
}

// ========== МОДАЛКИ ==========
function openModal(id) { 
  const modal = document.getElementById(id);
  if (modal) modal.classList.add("open"); 
}

function closeModal(id) { 
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("open"); 
}

// ========== ИЗБРАННОЕ МОДАЛКА ==========
function openFavModal() {
  const list = document.getElementById("favList");
  const copyArea = document.getElementById("favCopyArea");
  const copyBtn = document.getElementById("copyFavBtn");
  const allWatches = loadWatches();
  
  if (favorites.length === 0) {
    list.innerHTML = `<div class="empty-fav">Список избранного пуст.<br>Нажмите ❤️ на карточке, чтобы добавить часы.</div>`;
    copyArea.style.display = "none";
    copyBtn.style.display = "none";
    openModal("favModal");
    return;
  }
  
  let html = "";
  let articles = [];
  favorites.forEach(article => {
    const w = allWatches.find(x => x.article === article);
    if (w) {
      articles.push(w.article);
      const img = w.images && w.images[0] ? w.images[0] : "";
      const imgHtml = img ? `<img src="${img}" alt="">` : placeholderSVG();
      html += `
        <div class="fav-item">
          <div class="fav-item-img">${imgHtml}</div>
          <div class="fav-item-info">
            <div class="fav-item-article">${escapeHtml(w.article)}</div>
            <div class="fav-item-desc">${escapeHtml(w.desc)}</div>
            <div class="fav-item-price">${fmtPrice(w.price)}</div>
          </div>
          <button class="fav-remove" data-article="${escapeHtml(w.article)}">×</button>
        </div>`;
    }
  });
  
  list.innerHTML = html;
  copyArea.textContent = articles.join(", ");
  copyArea.style.display = "block";
  copyBtn.style.display = "inline-block";
  
  list.querySelectorAll(".fav-remove").forEach(btn => {
    btn.onclick = function() {
      const art = this.getAttribute("data-article");
      toggleFav(art);
    };
  });
  
  openModal("favModal");
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  document.body.removeChild(ta);
  const btn = document.getElementById("copyFavBtn");
  if (btn) {
    btn.textContent = "✅ Скопировано!";
    setTimeout(() => { btn.textContent = "📋 Скопировать артикулы"; }, 2000);
  }
}

// ========== РЕНДЕР ==========
function render() {
  const grid = document.getElementById("grid");
  if (!grid) return;
  
  const watches = getFilteredWatches();
  const allWatches = loadWatches();
  
  if (isAuthed) {
    document.body.classList.add("authed");
  } else {
    document.body.classList.remove("authed");
  }
  
  const resultsInfo = document.getElementById("resultsInfo");
  if (resultsInfo) {
    if (currentCategory !== "all" || priceFilterMin !== null || priceFilterMax !== null) {
      resultsInfo.innerHTML = `Найдено: <b>${watches.length}</b> из <b>${allWatches.length}</b> моделей`;
    } else {
      resultsInfo.innerHTML = "";
    }
  }
  
  if (!watches.length) {
    grid.innerHTML = `<div class="empty">По выбранным фильтрам ничего не найдено.</div>`;
    return;
  }
  
  let html = '';
  for (let i = 0; i < watches.length; i++) {
    const w = watches[i];
    const s = stockInfo(w.qty);
    const images = w.images || [];
    const multi = images.length > 1;
    const article = w.article || "";
    const favActive = isFav(article);
    
    let sliderContent;
    if (images.length === 0) {
      sliderContent = `<div class="placeholder">${placeholderSVG()}</div>`;
    } else {
      sliderContent = images.map(src => 
        `<div class="slide"><img src="${src}" alt="Часы" draggable="false"></div>`
      ).join("");
    }
    
    const dots = multi 
      ? `<div class="slider-dots">${images.map((_, k) => 
          `<button class="slider-dot${k === 0 ? ' active' : ''}" data-k="${k}"></button>`
        ).join("")}</div>` 
      : "";
    
    const arrows = multi 
      ? `<button class="slider-arrow prev" data-dir="-1">‹</button>
         <button class="slider-arrow next" data-dir="1">›</button>` 
      : "";
    
    const articleHtml = article 
      ? `<div class="article">Артикул: ${escapeHtml(article)}</div>` 
      : '';
    
    html += `
      <article class="card${favActive ? ' fav-active' : ''}" data-article="${escapeHtml(article)}">
        <button class="fav-btn${favActive ? ' active' : ''}" data-fav="${escapeHtml(article)}" title="В избранное">${favActive ? '❤️' : '🤍'}</button>
        <div class="card-actions">
          <button class="icon-btn edit" data-edit-article="${escapeHtml(article)}" title="Редактировать">✎</button>
          <button class="icon-btn del" data-del-article="${escapeHtml(article)}" title="Удалить">✕</button>
        </div>
        <div class="slider ${multi ? 'has-multi' : ''}" data-slider="${i}">
          <div class="slides">${sliderContent}</div>
          ${arrows}
          ${dots}
        </div>
        <div class="body">
          ${articleHtml}
          <p class="desc">${escapeHtml(w.desc)}</p>
          <div class="price">${fmtPrice(w.price)}</div>
          <div class="stock ${s.cls}">${s.text}</div>
        </div>
      </article>`;
  }
  
  grid.innerHTML = html;
  initSliders();
  initCardEvents();
}

// ========== СОБЫТИЯ КАРТОЧЕК ==========
function initCardEvents() {
  document.querySelectorAll(".card").forEach(card => {
    card.onclick = function(e) {
      if (e.target.closest(".fav-btn") || 
          e.target.closest(".icon-btn") || 
          e.target.closest(".slider-arrow") || 
          e.target.closest(".slider-dot")) {
        return;
      }
      
      const article = this.getAttribute("data-article");
      const allWatches = loadWatches();
      const w = allWatches.find(w => w.article === article);
      if (w && w.images && w.images.length > 0) {
        openLightbox(w.images, w.article, fmtPrice(w.price), 0);
      }
    };
  });
  
  document.querySelectorAll(".fav-btn").forEach(btn => {
    btn.onclick = function(e) {
      e.stopPropagation();
      e.preventDefault();
      const article = this.getAttribute("data-fav");
      toggleFav(article);
      return false;
    };
  });
  
  document.querySelectorAll("[data-edit-article]").forEach(btn => {
    btn.onclick = function(e) {
      e.stopPropagation();
      const article = this.getAttribute("data-edit-article");
      const allWatches = loadWatches();
      const idx = allWatches.findIndex(w => w.article === article);
      if (idx >= 0) openEdit(idx);
    };
  });
  
  document.querySelectorAll("[data-del-article]").forEach(btn => {
    btn.onclick = function(e) {
      e.stopPropagation();
      const article = this.getAttribute("data-del-article");
      if (confirm("Удалить эту модель?")) {
        const list = loadWatches();
        const idx = list.findIndex(w => w.article === article);
        if (idx >= 0) {
          list.splice(idx, 1);
          saveWatches(list);
          render();
        }
      }
    };
  });
}

// ========== СЛАЙДЕРЫ ==========
function initSliders() {
  const sliders = document.querySelectorAll("[data-slider]");
  
  for (let i = 0; i < sliders.length; i++) {
    const slider = sliders[i];
    const slides = slider.querySelector(".slides");
    const dots = slider.querySelectorAll(".slider-dot");
    const arrows = slider.querySelectorAll(".slider-arrow");
    
    if (!slides) continue;
    const total = slides.children.length;
    if (total < 2) continue;
    
    let idx = 0;
    
    function goTo(n) {
      idx = (n + total) % total;
      if (idx < 0) idx = total - 1;
      slides.style.transform = `translateX(-${idx * 100}%)`;
      for (let k = 0; k < dots.length; k++) {
        dots[k].classList.toggle("active", k === idx);
      }
    }
    
    for (let j = 0; j < arrows.length; j++) {
      arrows[j].onclick = function(e) {
        e.stopPropagation();
        goTo(idx + parseInt(this.getAttribute("data-dir")));
      };
    }
    
    for (let j = 0; j < dots.length; j++) {
      dots[j].onclick = function(e) {
        e.stopPropagation();
        goTo(parseInt(this.getAttribute("data-k")));
      };
    }
    
    let startX = 0, dx = 0, dragging = false;
    
    slides.addEventListener("touchstart", function(e) {
      startX = e.touches[0].clientX;
      dx = 0;
      dragging = true;
      slides.style.transition = "none";
    }, { passive: true });
    
    slides.addEventListener("touchmove", function(e) {
      if (!dragging) return;
      dx = e.touches[0].clientX - startX;
      slides.style.transform = `translateX(${-idx * slides.offsetWidth + dx}px)`;
    }, { passive: true });
    
    slides.addEventListener("touchend", function() {
      if (!dragging) return;
      dragging = false;
      slides.style.transition = "transform 0.3s ease-out";
      const threshold = slides.offsetWidth * 0.2;
      if (dx < -threshold) goTo(idx + 1);
      else if (dx > threshold) goTo(idx - 1);
      else goTo(idx);
    }, { passive: true });
  }
}

// ========== АВТОРИЗАЦИЯ ==========
function updateAuthUI() {
  const area = document.getElementById("authArea");
  if (!area) return;
  
  if (isAuthed) {
    area.innerHTML = `
      <button class="btn btn-fav" id="favBtnAuthed">❤️ Избранное<span class="fav-count" id="favCountAuthed">${favorites.length}</span></button>
      <button class="btn btn-gold" id="addBtn">+ Добавить</button>
      <button class="btn" id="logoutBtn">Выйти</button>`;
    
    const addBtn = document.getElementById("addBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const favBtnAuthed = document.getElementById("favBtnAuthed");
    
    if (addBtn) addBtn.onclick = openAddModal;
    if (logoutBtn) logoutBtn.onclick = function() {
      isAuthed = false;
      updateAuthUI();
      updateSaveBanner();
      render();
    };
    if (favBtnAuthed) favBtnAuthed.onclick = openFavModal;
  } else {
    area.innerHTML = `
      <button class="btn btn-fav" id="favBtnGuest">❤️ Избранное<span class="fav-count" id="favCountGuest">${favorites.length}</span></button>
      <button class="btn" id="loginBtn">Войти</button>`;
    
    const loginBtn = document.getElementById("loginBtn");
    const favBtnGuest = document.getElementById("favBtnGuest");
    
    if (loginBtn) loginBtn.onclick = function() {
      openModal("loginModal");
    };
    if (favBtnGuest) favBtnGuest.onclick = openFavModal;
  }
}

// ========== ДОБАВЛЕНИЕ / РЕДАКТИРОВАНИЕ ==========
let pendingAddImages = [];

function openAddModal() {
  pendingAddImages = [];
  document.getElementById("fCategory").value = "men";
  document.getElementById("fArticle").value = "";
  document.getElementById("fDesc").value = "";
  document.getElementById("fPrice").value = "";
  document.getElementById("fQty").value = "";
  document.getElementById("fImgFile").value = "";
  document.getElementById("addErr").textContent = "";
  renderAddThumbs();
  openModal("addModal");
}

function renderAddThumbs() {
  const box = document.getElementById("addThumbs");
  if (!box) return;
  box.innerHTML = pendingAddImages.map((src, k) =>
    `<div class="thumb-item">
      <img src="${src}" alt="">
      <button type="button" class="thumb-remove" data-k="${k}">×</button>
    </div>`
  ).join("");
  
  box.querySelectorAll(".thumb-remove").forEach(btn => {
    btn.onclick = function() {
      pendingAddImages.splice(parseInt(this.getAttribute("data-k")), 1);
      renderAddThumbs();
    };
  });
}

let editingIndex = -1;
let editExistingImages = [];
let editNewImages = [];

function openEdit(i) {
  const list = loadWatches();
  const w = list[i];
  if (!w) return;
  
  editingIndex = i;
  editExistingImages = (w.images || []).slice();
  editNewImages = [];
  
  document.getElementById("eCategory").value = w.category || "men";
  document.getElementById("eArticle").value = w.article || "";
  document.getElementById("eDesc").value = w.desc || "";
  document.getElementById("ePrice").value = w.price;
  document.getElementById("eQty").value = w.qty;
  document.getElementById("eImgFile").value = "";
  document.getElementById("editErr").textContent = "";
  
  renderEditThumbs();
  renderEditNewThumbs();
  openModal("editModal");
}

function renderEditThumbs() {
  const box = document.getElementById("editThumbs");
  if (!box) return;
  if (!editExistingImages.length) {
    box.innerHTML = `<div style="color:#8a8a94;font-size:12px">Фото пока нет</div>`;
    return;
  }
  box.innerHTML = editExistingImages.map((src, k) =>
    `<div class="thumb-item">
      <img src="${src}" alt="">
      <button type="button" class="thumb-remove" data-k="${k}">×</button>
    </div>`
  ).join("");
  
  box.querySelectorAll(".thumb-remove").forEach(btn => {
    btn.onclick = function() {
      editExistingImages.splice(parseInt(this.getAttribute("data-k")), 1);
      renderEditThumbs();
    };
  });
}

function renderEditNewThumbs() {
  const box = document.getElementById("editNewThumbs");
  if (!box) return;
  box.innerHTML = editNewImages.map((src, k) =>
    `<div class="thumb-item">
      <img src="${src}" alt="">
      <button type="button" class="thumb-remove" data-k="${k}">×</button>
    </div>`
  ).join("");
  
  box.querySelectorAll(".thumb-remove").forEach(btn => {
    btn.onclick = function() {
      editNewImages.splice(parseInt(this.getAttribute("data-k")), 1);
      renderEditNewThumbs();
    };
  });
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function initApp() {
  // Всегда выходим из аккаунта при загрузке
  isAuthed = false;
  
  // Чистим возможные флаги авторизации
  if (canUseStorage) {
    try {
      window.localStorage.removeItem('mdt_authed');
      window.localStorage.removeItem('mdt_session');
    } catch (e) {}
  }
  
  favorites = loadFavorites();
  updateAuthUI();
  updateSaveBanner();
  render();
}

// ========== НАВЕШИВАЕМ ВСЕ ОБРАБОТЧИКИ ==========
function bindEvents() {
  // Лайтбокс
  const lightboxClose = document.getElementById("lightboxClose");
  const lightboxPrevBtn = document.getElementById("lightboxPrev");
  const lightboxNextBtn = document.getElementById("lightboxNext");
  const lightbox = document.getElementById("lightbox");
  
  if (lightboxClose) lightboxClose.onclick = closeLightbox;
  if (lightboxPrevBtn) lightboxPrevBtn.onclick = function(e) { e.stopPropagation(); lightboxPrev(); };
  if (lightboxNextBtn) lightboxNextBtn.onclick = function(e) { e.stopPropagation(); lightboxNext(); };
  if (lightbox) lightbox.onclick = function(e) { if (e.target === this) closeLightbox(); };
  
  // Копирование избранного
  const copyFavBtn = document.getElementById("copyFavBtn");
  if (copyFavBtn) copyFavBtn.onclick = function() {
    const text = document.getElementById("favCopyArea").textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.textContent = "✅ Скопировано!";
        setTimeout(() => { this.textContent = "📋 Скопировать артикулы"; }, 2000);
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  };
  
  // Закрытие модалок
  const closeFav = document.getElementById("closeFav");
  const closeLogin = document.getElementById("closeLogin");
  const closeAdd = document.getElementById("closeAdd");
  const closeEdit = document.getElementById("closeEdit");
  const closeGithub = document.getElementById("closeGithub");
  
  if (closeFav) closeFav.onclick = function() { closeModal("favModal"); };
  if (closeLogin) closeLogin.onclick = function() { closeModal("loginModal"); };
  if (closeAdd) closeAdd.onclick = function() { closeModal("addModal"); };
  if (closeEdit) closeEdit.onclick = function() { closeModal("editModal"); };
  if (closeGithub) closeGithub.onclick = function() { closeModal("githubModal"); };
  
  // Логин
  const doLogin = document.getElementById("doLogin");
  if (doLogin) doLogin.onclick = function() {
    const u = document.getElementById("loginUser").value.trim();
    const p = document.getElementById("loginPass").value;
    const err = document.getElementById("loginErr");
    err.textContent = "";
    
    if (u === AUTH.user && p === AUTH.pass) {
      isAuthed = true;
      closeModal("loginModal");
      document.getElementById("loginUser").value = "";
      document.getElementById("loginPass").value = "";
      updateAuthUI();
      updateSaveBanner();
      render();
    } else {
      err.textContent = "Неверный логин или пароль";
    }
  };
  
  // Добавление фото
  const fImgFile = document.getElementById("fImgFile");
  if (fImgFile) fImgFile.onchange = async function() {
    const files = Array.from(this.files || []);
    if (!files.length) return;
    pendingAddImages = pendingAddImages.concat(await compressFiles(files));
    renderAddThumbs();
    this.value = "";
  };
  
  // Добавление модели
  const doAdd = document.getElementById("doAdd");
  if (doAdd) doAdd.onclick = function() {
    const err = document.getElementById("addErr");
    err.textContent = "";
    
    const desc = document.getElementById("fDesc").value.trim();
    const price = document.getElementById("fPrice").value;
    
    if (!desc) { err.textContent = "Укажите описание"; return; }
    if (price === "" || Number(price) < 0) { err.textContent = "Укажите цену"; return; }
    
    const list = loadWatches();
    list.push({
      category: document.getElementById("fCategory").value,
      article: document.getElementById("fArticle").value.trim(),
      desc: desc,
      price: Number(price),
      qty: document.getElementById("fQty").value === "" ? 0 : Number(document.getElementById("fQty").value),
      images: pendingAddImages.slice()
    });
    
    saveWatches(list);
    closeModal("addModal");
    render();
  };
  
  // Редактирование фото
  const eImgFile = document.getElementById("eImgFile");
  if (eImgFile) eImgFile.onchange = async function() {
    const files = Array.from(this.files || []);
    if (!files.length) return;
    editNewImages = editNewImages.concat(await compressFiles(files));
    renderEditNewThumbs();
    this.value = "";
  };
  
  // Сохранение редактирования
  const doEdit = document.getElementById("doEdit");
  if (doEdit) doEdit.onclick = function() {
    const err = document.getElementById("editErr");
    err.textContent = "";
    
    const desc = document.getElementById("eDesc").value.trim();
    const price = document.getElementById("ePrice").value;
    
    if (!desc) { err.textContent = "Укажите описание"; return; }
    if (price === "" || Number(price) < 0) { err.textContent = "Укажите цену"; return; }
    
    const list = loadWatches();
    if (!list[editingIndex]) { err.textContent = "Карточка не найдена"; return; }
    
    list[editingIndex] = {
      ...list[editingIndex],
      category: document.getElementById("eCategory").value,
      article: document.getElementById("eArticle").value.trim(),
      desc: desc,
      price: Number(price),
      qty: document.getElementById("eQty").value === "" ? 0 : Number(document.getElementById("eQty").value),
      images: editExistingImages.concat(editNewImages)
    };
    
    saveWatches(list);
    closeModal("editModal");
    render();
  };
  
  // Сохранение в файл
  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) saveBtn.onclick = saveToFile;
  
  // GitHub
  const githubBtn = document.getElementById("githubBtn");
  if (githubBtn) githubBtn.onclick = updateGithub;
  
  const saveGithub = document.getElementById("saveGithub");
  if (saveGithub) saveGithub.onclick = function() {
    const username = document.getElementById("ghUsername").value.trim();
    const repo = document.getElementById("ghRepo").value.trim();
    const token = document.getElementById("ghToken").value.trim();
    const branch = document.getElementById("ghBranch").value.trim() || "main";
    const err = document.getElementById("githubErr");
    
    if (!username || !repo || !token) {
      err.textContent = "Заполните все поля";
      return;
    }
    
    saveGithubSettings({ username, repo, token, branch });
    err.textContent = "";
    closeModal("githubModal");
    alert("✅ Настройки GitHub сохранены!");
  };
  
  // Категории
  const categoryMenu = document.getElementById("categoryMenu");
  if (categoryMenu) categoryMenu.onclick = function(e) {
    const btn = e.target.closest(".cat-btn");
    if (!btn) return;
    
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentCategory = btn.getAttribute("data-cat");
    render();
  };
  
  // Фильтры
  const applyFilter = document.getElementById("applyFilter");
  if (applyFilter) applyFilter.onclick = function() {
    const min = document.getElementById("priceMin").value;
    const max = document.getElementById("priceMax").value;
    priceFilterMin = min === "" ? null : Number(min);
    priceFilterMax = max === "" ? null : Number(max);
    render();
  };
  
  const resetFilter = document.getElementById("resetFilter");
  if (resetFilter) resetFilter.onclick = function() {
    document.getElementById("priceMin").value = "";
    document.getElementById("priceMax").value = "";
    priceFilterMin = null;
    priceFilterMax = null;
    render();
  };
  
  // Заполняем настройки GitHub если есть
  const ghSettings = getGithubSettings();
  if (ghSettings) {
    const ghUsername = document.getElementById("ghUsername");
    const ghRepo = document.getElementById("ghRepo");
    const ghToken = document.getElementById("ghToken");
    const ghBranch = document.getElementById("ghBranch");
    
    if (ghUsername) ghUsername.value = ghSettings.username || "";
    if (ghRepo) ghRepo.value = ghSettings.repo || "";
    if (ghToken) ghToken.value = ghSettings.token || "";
    if (ghBranch) ghBranch.value = ghSettings.branch || "main";
  }
}

// ========== ЗАПУСК ==========
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    bindEvents();
    initApp();
  });
} else {
  bindEvents();
  initApp();
}

console.log('✅ Приложение успешно загружено!');
console.log('📦 Версия:', '2.2.0');
console.log('💾 Хранилище:', canUseStorage ? 'доступно' : 'недоступно');
console.log('❤️ Избранное:', favorites.length, 'моделей');
