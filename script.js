// ========== МИНИМАЛЬНАЯ ОЧИСТКА КЕША ==========
(function() {
  const CACHE_CLEARED_KEY = 'mdt_cache_cleared_v4';
  if (localStorage.getItem(CACHE_CLEARED_KEY) === 'true') return;
  console.log('🧹 Очистка кеша...');
  try {
    const favs = localStorage.getItem('mdt_favorites_v1');
    localStorage.clear();
    if (favs) localStorage.setItem('mdt_favorites_v1', favs);
    localStorage.setItem(CACHE_CLEARED_KEY, 'true');
    console.log('✅ Кеш очищен');
  } catch(e) { console.warn('Ошибка очистки:', e); }
})();

// ========== НАСТРОЙКИ GITHUB (вшиты) ==========
const GITHUB_CONFIG = {
  username: 'TempusKZ',
  repo: 'Tempus_KZ',
  token: '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',
  branch: 'main'
};

// ========== КОНСТАНТЫ ==========
const AUTH = { user: "anastasia_zy_zy", pass: "anastasia_zy_zy" };
const LS_KEY = "mdt_watches_v2";
const FAV_KEY = "mdt_favorites_v1";
const DATA_URL = 'data.json';

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
let catalogData = [];

// ========== ЗАГРУЗКА ДАННЫХ ==========
async function loadDataFromFile() {
  try {
    const response = await fetch(DATA_URL + '?_=' + Date.now());
    if (response.ok) {
      catalogData = await response.json();
      catalogData = migrateData(catalogData);
      console.log('📦 Загружено из data.json:', catalogData.length, 'моделей');
      if (canUseStorage) localStorage.setItem(LS_KEY, JSON.stringify(catalogData));
      return catalogData;
    }
  } catch (e) { console.warn('⚠️ data.json не загружен'); }
  
  if (canUseStorage) {
    try {
      const ls = localStorage.getItem(LS_KEY);
      if (ls) { catalogData = migrateData(JSON.parse(ls)); return catalogData; }
    } catch (e) {}
  }
  
  catalogData = loadFromEmbedded();
  return catalogData;
}

function loadFromEmbedded() {
  try {
    const el = document.getElementById("catalog-data");
    if (!el) return [];
    return migrateData(JSON.parse(el.textContent.trim() || "[]"));
  } catch (e) { return []; }
}

async function loadWatches() {
  if (catalogData.length > 0) return catalogData;
  return await loadDataFromFile();
}

function loadWatchesSync() { return catalogData; }

// ========== ИЗБРАННОЕ ==========
function loadFavorites() {
  if (!canUseStorage) return [];
  try { const f = localStorage.getItem(FAV_KEY); return f ? JSON.parse(f) : []; } catch (e) { return []; }
}

function saveFavorites() {
  if (canUseStorage) {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favorites)); } catch (e) {}
  }
  updateFavCount();
}

function updateFavCount() {
  const counters = document.querySelectorAll('[id^="favCount"]');
  counters.forEach(el => { el.textContent = favorites.length; });
}

function isFav(article) { return favorites.includes(article); }

function toggleFav(article) {
  const idx = favorites.indexOf(article);
  if (idx >= 0) favorites.splice(idx, 1);
  else favorites.push(article);
  saveFavorites();
  
  const escapedArticle = article.replace(/"/g, '\\"');
  const btn = document.querySelector(`[data-fav="${escapedArticle}"]`);
  if (btn) {
    const isActive = isFav(article);
    btn.classList.toggle('active', isActive);
    btn.textContent = isActive ? '❤️' : '🤍';
    btn.title = isActive ? 'Убрать из избранного' : 'В избранное';
    btn.classList.remove('animating');
    void btn.offsetWidth;
    btn.classList.add('animating');
  }
  
  const card = document.querySelector(`[data-article="${escapedArticle}"]`);
  if (card) card.classList.toggle('fav-active', isFav(article));
  
  updateFavCount();
  
  const favModal = document.getElementById("favModal");
  if (favModal && favModal.classList.contains("open")) openFavModal();
}

// ========== МИГРАЦИЯ ==========
function migrateData(list) {
  return list.map(w => {
    if (!w.images) { w.images = w.img ? [w.img] : []; delete w.img; }
    if (!w.category) w.category = "men";
    if (!w.name) w.name = w.desc || '';
    return w;
  });
}

// ========== СОХРАНЕНИЕ ==========
function saveWatches(list) {
  catalogData = list;
  if (canUseStorage) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch (e) {}
  }
  hasUnsavedChanges = true;
  updateSaveBanner();
}

function updateSaveBanner() {
  const banner = document.getElementById("saveBanner");
  if (banner) banner.classList.toggle("show", hasUnsavedChanges && isAuthed);
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
  for (const f of files) { try { result.push(await compressImage(f)); } catch (e) {} }
  return result;
}

// ========== СОХРАНЕНИЕ В ФАЙЛ ==========
async function saveToFile() {
  try {
    const watches = loadWatchesSync();
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
  } catch (e) { alert("Ошибка: " + e.message); }
}

// ========== GITHUB API ==========
async function pushToGithub(path, content) {
  const encoded = btoa(unescape(encodeURIComponent(content)));
  const apiUrl = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/${path}`;
  
  let sha = null;
  try {
    const getResp = await fetch(apiUrl + '?ref=' + GITHUB_CONFIG.branch, {
      headers: {
        'Authorization': `token ${GITHUB_CONFIG.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (getResp.ok) {
      const fileData = await getResp.json();
      sha = fileData.sha;
    }
  } catch (e) {}
  
  const body = {
    message: `Update ${path} - ${new Date().toISOString()}`,
    content: encoded,
    branch: GITHUB_CONFIG.branch
  };
  if (sha) body.sha = sha;
  
  const putResp = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${GITHUB_CONFIG.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  if (!putResp.ok) {
    const errData = await putResp.json();
    throw new Error(errData.message || 'Ошибка отправки ' + path);
  }
}

async function updateGithub() {
  showGithubStatus('⏳ Отправка на GitHub...');
  
  try {
    const watches = loadWatchesSync();
    
    // Обновляем index.html
    const html = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
    const dataJson = JSON.stringify(watches);
    const escaped = dataJson.replace(/<\//g, "<\\/");
    const updatedHtml = html.replace(
      /<script id="catalog-data" type="application\/json">[\s\S]*?<\/script>/,
      `<script id="catalog-data" type="application\/json">${escaped}<\/script>`
    );
    
    await pushToGithub('index.html', updatedHtml);
    await pushToGithub('data.json', JSON.stringify(watches, null, 2));
    
    hasUnsavedChanges = false;
    updateSaveBanner();
    alert("✅ Файлы обновлены на GitHub!\nСайт обновится через 1-2 минуты.\nhttps://tempuskz.github.io/Tempus_KZ/");
  } catch (e) {
    alert("❌ Ошибка GitHub: " + e.message);
  }
}

function showGithubStatus(msg) {
  const banner = document.getElementById("saveBanner");
  if (banner) {
    const span = banner.querySelector('span');
    if (span) span.innerHTML = msg;
    banner.classList.add("show");
  }
}

// ========== ФОРМАТИРОВАНИЕ ==========
function fmtPrice(n) { return Number(n).toLocaleString("ru-RU") + " ₸"; }

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
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function getFilteredWatches() {
  let watches = loadWatchesSync();
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
      d.onclick = function() { lightboxIdx = parseInt(this.getAttribute("data-k")); renderLightbox(); };
    });
  } else {
    dots.style.display = "none";
    document.getElementById("lightboxPrev").style.display = "none";
    document.getElementById("lightboxNext").style.display = "none";
  }
}

function lightboxPrev() { lightboxIdx = (lightboxIdx - 1 + lightboxImages.length) % lightboxImages.length; renderLightbox(); }
function lightboxNext() { lightboxIdx = (lightboxIdx + 1) % lightboxImages.length; renderLightbox(); }

// ========== МОДАЛКИ ==========
function openModal(id) { const modal = document.getElementById(id); if (modal) modal.classList.add("open"); }
function closeModal(id) { const modal = document.getElementById(id); if (modal) modal.classList.remove("open"); }

// ========== ИЗБРАННОЕ МОДАЛКА ==========
function openFavModal() {
  const list = document.getElementById("favList");
  const copyArea = document.getElementById("favCopyArea");
  const copyBtn = document.getElementById("copyFavBtn");
  const allWatches = loadWatchesSync();
  
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
      html += `<div class="fav-item">
        <div class="fav-item-img">${imgHtml}</div>
        <div class="fav-item-info">
          <div class="fav-item-article">${escapeHtml(w.article)}</div>
          <div class="fav-item-desc">${escapeHtml(w.name || w.desc)}</div>
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
    btn.onclick = function() { toggleFav(this.getAttribute("data-article")); };
  });
  
  openModal("favModal");
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.left = "-9999px";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  document.body.removeChild(ta);
  const btn = document.getElementById("copyFavBtn");
  if (btn) { btn.textContent = "✅ Скопировано!"; setTimeout(() => { btn.textContent = "📋 Скопировать артикулы"; }, 2000); }
}

// ========== РЕНДЕР ==========
async function render() {
  const grid = document.getElementById("grid");
  if (!grid) return;
  
  if (catalogData.length === 0) await loadDataFromFile();
  
  const watches = getFilteredWatches();
  const allWatches = loadWatchesSync();
  
  document.body.classList.toggle("authed", isAuthed);
  
  const resultsInfo = document.getElementById("resultsInfo");
  if (resultsInfo) {
    if (currentCategory !== "all" || priceFilterMin !== null || priceFilterMax !== null) {
      resultsInfo.innerHTML = `Найдено: <b>${watches.length}</b> из <b>${allWatches.length}</b> моделей`;
    } else { resultsInfo.innerHTML = ""; }
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
    
    let sliderContent = images.length === 0
      ? `<div class="placeholder">${placeholderSVG()}</div>`
      : images.map(src => `<div class="slide"><img src="${src}" alt="Часы" draggable="false"></div>`).join("");
    
    const dots = multi ? `<div class="slider-dots">${images.map((_, k) => `<button class="slider-dot${k === 0 ? ' active' : ''}" data-k="${k}"></button>`).join("")}</div>` : "";
    const arrows = multi ? `<button class="slider-arrow prev" data-dir="-1">‹</button><button class="slider-arrow next" data-dir="1">›</button>` : "";
    const articleHtml = article ? `<div class="article">Артикул: ${escapeHtml(article)}</div>` : '';
    const nameHtml = w.name ? `<p class="name">${escapeHtml(w.name)}</p>` : '';
    
    html += `<article class="card${favActive ? ' fav-active' : ''}" data-article="${escapeHtml(article)}">
      <button class="fav-btn${favActive ? ' active' : ''}" data-fav="${escapeHtml(article)}" title="В избранное">${favActive ? '❤️' : '🤍'}</button>
      <div class="card-actions">
        <button class="icon-btn edit" data-edit-article="${escapeHtml(article)}" title="Редактировать">✎</button>
        <button class="icon-btn del" data-del-article="${escapeHtml(article)}" title="Удалить">✕</button>
      </div>
      <div class="slider ${multi ? 'has-multi' : ''}" data-slider="${i}">
        <div class="slides">${sliderContent}</div>
        ${arrows}${dots}
      </div>
      <div class="body">
        ${articleHtml}${nameHtml}
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
      if (e.target.closest(".fav-btn") || e.target.closest(".icon-btn") || e.target.closest(".slider-arrow") || e.target.closest(".slider-dot")) return;
      const article = this.getAttribute("data-article");
      const w = loadWatchesSync().find(w => w.article === article);
      if (w && w.images && w.images.length > 0) openLightbox(w.images, w.article, fmtPrice(w.price), 0);
    };
  });
  
  document.querySelectorAll(".fav-btn").forEach(btn => {
    btn.onclick = function(e) { e.stopPropagation(); e.preventDefault(); toggleFav(this.getAttribute("data-fav")); return false; };
  });
  
  document.querySelectorAll("[data-edit-article]").forEach(btn => {
    btn.onclick = function(e) {
      e.stopPropagation();
      const idx = loadWatchesSync().findIndex(w => w.article === this.getAttribute("data-edit-article"));
      if (idx >= 0) openEdit(idx);
    };
  });
  
  document.querySelectorAll("[data-del-article]").forEach(btn => {
    btn.onclick = function(e) {
      e.stopPropagation();
      if (confirm("Удалить эту модель?")) {
        const list = loadWatchesSync();
        const idx = list.findIndex(w => w.article === this.getAttribute("data-del-article"));
        if (idx >= 0) { list.splice(idx, 1); saveWatches(list); render(); }
      }
    };
  });
}

// ========== СЛАЙДЕРЫ ==========
function initSliders() {
  document.querySelectorAll("[data-slider]").forEach(slider => {
    const slides = slider.querySelector(".slides");
    const dots = slider.querySelectorAll(".slider-dot");
    const arrows = slider.querySelectorAll(".slider-arrow");
    if (!slides || slides.children.length < 2) return;
    
    const total = slides.children.length;
    let idx = 0;
    
    function goTo(n) {
      idx = (n + total) % total;
      if (idx < 0) idx = total - 1;
      slides.style.transform = `translateX(-${idx * 100}%)`;
      dots.forEach((d, k) => d.classList.toggle("active", k === idx));
    }
    
    arrows.forEach(a => { a.onclick = function(e) { e.stopPropagation(); goTo(idx + parseInt(this.getAttribute("data-dir"))); }; });
    dots.forEach((d, j) => { d.onclick = function(e) { e.stopPropagation(); goTo(j); }; });
    
    let startX = 0, dx = 0, dragging = false;
    slides.addEventListener("touchstart", function(e) { startX = e.touches[0].clientX; dx = 0; dragging = true; slides.style.transition = "none"; }, { passive: true });
    slides.addEventListener("touchmove", function(e) { if (!dragging) return; dx = e.touches[0].clientX - startX; slides.style.transform = `translateX(${-idx * slides.offsetWidth + dx}px)`; }, { passive: true });
    slides.addEventListener("touchend", function() {
      if (!dragging) return;
      dragging = false;
      slides.style.transition = "transform 0.3s ease-out";
      if (dx < -slides.offsetWidth * 0.2) goTo(idx + 1);
      else if (dx > slides.offsetWidth * 0.2) goTo(idx - 1);
      else goTo(idx);
    }, { passive: true });
  });
}

// ========== АВТОРИЗАЦИЯ ==========
function updateAuthUI() {
  const area = document.getElementById("authArea");
  if (!area) return;
  
  if (isAuthed) {
    area.innerHTML = `<button class="btn btn-fav" id="favBtnAuthed">❤️ Избранное<span class="fav-count" id="favCountAuthed">${favorites.length}</span></button>
      <button class="btn btn-gold" id="addBtn">+ Добавить</button>
      <button class="btn" id="logoutBtn">Выйти</button>`;
    document.getElementById("addBtn").onclick = openAddModal;
    document.getElementById("logoutBtn").onclick = function() { isAuthed = false; updateAuthUI(); updateSaveBanner(); render(); };
    document.getElementById("favBtnAuthed").onclick = openFavModal;
  } else {
    area.innerHTML = `<button class="btn btn-fav" id="favBtnGuest">❤️ Избранное<span class="fav-count" id="favCountGuest">${favorites.length}</span></button>
      <button class="btn" id="loginBtn">Войти</button>`;
    document.getElementById("loginBtn").onclick = function() { openModal("loginModal"); };
    document.getElementById("favBtnGuest").onclick = openFavModal;
  }
}

// ========== ДОБАВЛЕНИЕ / РЕДАКТИРОВАНИЕ ==========
let pendingAddImages = [];

function openAddModal() {
  pendingAddImages = [];
  ['fCategory','fArticle','fName','fDesc','fPrice','fQty','fImgFile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'fCategory' ? 'men' : '';
  });
  document.getElementById("addErr").textContent = "";
  renderAddThumbs();
  openModal("addModal");
}

function renderAddThumbs() {
  const box = document.getElementById("addThumbs");
  if (!box) return;
  box.innerHTML = pendingAddImages.map((src, k) => `<div class="thumb-item"><img src="${src}" alt=""><button type="button" class="thumb-remove" data-k="${k}">×</button></div>`).join("");
  box.querySelectorAll(".thumb-remove").forEach(btn => { btn.onclick = function() { pendingAddImages.splice(parseInt(this.getAttribute("data-k")), 1); renderAddThumbs(); }; });
}

let editingIndex = -1, editExistingImages = [], editNewImages = [];

function openEdit(i) {
  const w = loadWatchesSync()[i];
  if (!w) return;
  editingIndex = i;
  editExistingImages = (w.images || []).slice();
  editNewImages = [];
  document.getElementById("eCategory").value = w.category || "men";
  document.getElementById("eArticle").value = w.article || "";
  document.getElementById("eName").value = w.name || "";
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
  if (!editExistingImages.length) { box.innerHTML = `<div style="color:#8a8a94;font-size:12px">Фото пока нет</div>`; return; }
  box.innerHTML = editExistingImages.map((src, k) => `<div class="thumb-item"><img src="${src}" alt=""><button type="button" class="thumb-remove" data-k="${k}">×</button></div>`).join("");
  box.querySelectorAll(".thumb-remove").forEach(btn => { btn.onclick = function() { editExistingImages.splice(parseInt(this.getAttribute("data-k")), 1); renderEditThumbs(); }; });
}

function renderEditNewThumbs() {
  const box = document.getElementById("editNewThumbs");
  if (!box) return;
  box.innerHTML = editNewImages.map((src, k) => `<div class="thumb-item"><img src="${src}" alt=""><button type="button" class="thumb-remove" data-k="${k}">×</button></div>`).join("");
  box.querySelectorAll(".thumb-remove").forEach(btn => { btn.onclick = function() { editNewImages.splice(parseInt(this.getAttribute("data-k")), 1); renderEditNewThumbs(); }; });
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
async function initApp() {
  isAuthed = false;
  if (canUseStorage) { try { localStorage.removeItem('mdt_authed'); localStorage.removeItem('mdt_session'); } catch (e) {} }
  favorites = loadFavorites();
  updateAuthUI();
  updateSaveBanner();
  await render();
}

// ========== ОБРАБОТЧИКИ ==========
function bindEvents() {
  document.getElementById("lightboxClose").onclick = closeLightbox;
  document.getElementById("lightboxPrev").onclick = function(e) { e.stopPropagation(); lightboxPrev(); };
  document.getElementById("lightboxNext").onclick = function(e) { e.stopPropagation(); lightboxNext(); };
  document.getElementById("lightbox").onclick = function(e) { if (e.target === this) closeLightbox(); };
  
  document.getElementById("copyFavBtn").onclick = function() {
    const text = document.getElementById("favCopyArea").textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => { this.textContent = "✅ Скопировано!"; setTimeout(() => { this.textContent = "📋 Скопировать артикулы"; }, 2000); }).catch(() => fallbackCopy(text));
    } else fallbackCopy(text);
  };
  
  document.getElementById("closeFav").onclick = function() { closeModal("favModal"); };
  document.getElementById("closeLogin").onclick = function() { closeModal("loginModal"); };
  document.getElementById("closeAdd").onclick = function() { closeModal("addModal"); };
  document.getElementById("closeEdit").onclick = function() { closeModal("editModal"); };
  
  document.getElementById("doLogin").onclick = function() {
    const err = document.getElementById("loginErr"); err.textContent = "";
    if (document.getElementById("loginUser").value.trim() === AUTH.user && document.getElementById("loginPass").value === AUTH.pass) {
      isAuthed = true; closeModal("loginModal");
      document.getElementById("loginUser").value = ""; document.getElementById("loginPass").value = "";
      updateAuthUI(); updateSaveBanner(); render();
    } else err.textContent = "Неверный логин или пароль";
  };
  
  document.getElementById("fImgFile").onchange = async function() {
    const files = Array.from(this.files || []); if (!files.length) return;
    pendingAddImages = pendingAddImages.concat(await compressFiles(files)); renderAddThumbs(); this.value = "";
  };
  
  document.getElementById("doAdd").onclick = function() {
    const err = document.getElementById("addErr"); err.textContent = "";
    const name = document.getElementById("fName").value.trim();
    const desc = document.getElementById("fDesc").value.trim();
    const price = document.getElementById("fPrice").value;
    if (!name && !desc) { err.textContent = "Укажите название или описание"; return; }
    if (price === "" || Number(price) < 0) { err.textContent = "Укажите цену"; return; }
    loadWatchesSync().push({
      category: document.getElementById("fCategory").value,
      article: document.getElementById("fArticle").value.trim(),
      name, desc, price: Number(price),
      qty: document.getElementById("fQty").value === "" ? 0 : Number(document.getElementById("fQty").value),
      images: pendingAddImages.slice()
    });
    saveWatches(loadWatchesSync()); closeModal("addModal"); render();
  };
  
  document.getElementById("eImgFile").onchange = async function() {
    const files = Array.from(this.files || []); if (!files.length) return;
    editNewImages = editNewImages.concat(await compressFiles(files)); renderEditNewThumbs(); this.value = "";
  };
  
  document.getElementById("doEdit").onclick = function() {
    const err = document.getElementById("editErr"); err.textContent = "";
    const name = document.getElementById("eName").value.trim();
    const desc = document.getElementById("eDesc").value.trim();
    const price = document.getElementById("ePrice").value;
    if (!name && !desc) { err.textContent = "Укажите название или описание"; return; }
    if (price === "" || Number(price) < 0) { err.textContent = "Укажите цену"; return; }
    const list = loadWatchesSync();
    if (!list[editingIndex]) { err.textContent = "Карточка не найдена"; return; }
    list[editingIndex] = {
      ...list[editingIndex],
      category: document.getElementById("eCategory").value,
      article: document.getElementById("eArticle").value.trim(),
      name, desc, price: Number(price),
      qty: document.getElementById("eQty").value === "" ? 0 : Number(document.getElementById("eQty").value),
      images: editExistingImages.concat(editNewImages)
    };
    saveWatches(list); closeModal("editModal"); render();
  };
  
  document.getElementById("saveBtn").onclick = saveToFile;
  document.getElementById("githubBtn").onclick = updateGithub;
  
  document.getElementById("categoryMenu").onclick = function(e) {
    const btn = e.target.closest(".cat-btn"); if (!btn) return;
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active"); currentCategory = btn.getAttribute("data-cat"); render();
  };
  
  document.getElementById("applyFilter").onclick = function() {
    const min = document.getElementById("priceMin").value, max = document.getElementById("priceMax").value;
    priceFilterMin = min === "" ? null : Number(min); priceFilterMax = max === "" ? null : Number(max); render();
  };
  
  document.getElementById("resetFilter").onclick = function() {
    document.getElementById("priceMin").value = ""; document.getElementById("priceMax").value = "";
    priceFilterMin = null; priceFilterMax = null; render();
  };
}

// ========== ЗАПУСК ==========
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { bindEvents(); initApp(); });
} else {
  bindEvents(); initApp();
}
console.log('✅ TEMPUS KZ v4.0 · TempusKZ/Tempus_KZ');
