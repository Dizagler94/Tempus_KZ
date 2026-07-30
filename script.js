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

function loadFavorites() {
    if (!canUseStorage) return [];
    try {
        const f = window.localStorage.getItem(FAV_KEY);
        return f ? JSON.parse(f) : [];
    } catch (e) { return []; }
}

function saveFavorites() {
    if (canUseStorage) {
        try { window.localStorage.setItem(FAV_KEY, JSON.stringify(favorites)); } catch (e) { }
    }
    updateFavCount();
}

function updateFavCount() {
    const el = document.getElementById("favCount");
    if (el) el.textContent = favorites.length;
}

function isFav(article) {
    return favorites.includes(article);
}

function toggleFav(article) {
    const idx = favorites.indexOf(article);
    if (idx >= 0) favorites.splice(idx, 1);
    else favorites.push(article);
    saveFavorites();
    render();
}

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
    if (hasUnsavedChanges && isAuthed) banner.classList.add("show");
    else banner.classList.remove("show");
}

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
    for (const f of files) { try { result.push(await compressImage(f)); } catch (e) { } }
    return result;
}

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
        hasUnsavedChanges = false; updateSaveBanner();
        alert("✅ Файл скачан!");
    } catch (e) { alert("Ошибка: " + e.message); }
}

function getGithubSettings() {
    if (!canUseStorage) return null;
    try { const s = window.localStorage.getItem(GITHUB_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}

function saveGithubSettings(settings) {
    if (!canUseStorage) return;
    try { window.localStorage.setItem(GITHUB_KEY, JSON.stringify(settings)); } catch (e) { }
}

async function updateGithub() {
    const settings = getGithubSettings();
    if (!settings) { openModal("githubModal"); return; }
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
        if (getFileResponse.ok) { const fileData = await getFileResponse.json(); sha = fileData.sha; }
        const putUrl = `https://api.github.com/repos/${settings.username}/${settings.repo}/contents/index.html`;
        const body = { message: "Update catalog - " + new Date().toISOString(), content: content, branch: settings.branch };
        if (sha) body.sha = sha;
        const putResponse = await fetch(putUrl, {
            method: 'PUT',
            headers: { 'Authorization': `token ${settings.token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (putResponse.ok) {
            err.textContent = ""; hasUnsavedChanges = false; updateSaveBanner();
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

function fmtPrice(n) { return Number(n).toLocaleString("ru-RU") + " "; }

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
    let watches = loadWatches();
    if (currentCategory !== "all") watches = watches.filter(w => w.category === currentCategory);
    if (priceFilterMin !== null) watches = watches.filter(w => w.price >= priceFilterMin);
    if (priceFilterMax !== null) watches = watches.filter(w => w.price <= priceFilterMax);
    return watches;
}

// Лайтбокс
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
            d.addEventListener("click", function () {
                lightboxIdx = parseInt(this.getAttribute("data-k"));
                renderLightbox();
            });
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

document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
document.getElementById("lightboxPrev").addEventListener("click", function (e) { e.stopPropagation(); lightboxPrev(); });
document.getElementById("lightboxNext").addEventListener("click", function (e) { e.stopPropagation(); lightboxNext(); });
document.getElementById("lightbox").addEventListener("click", function (e) {
    if (e.target === this) closeLightbox();
});

// Избранное модалка
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
        btn.addEventListener("click", function () {
            const art = this.getAttribute("data-article");
            toggleFav(art);
            openFavModal();
        });
    });

    openModal("favModal");
}

document.getElementById("copyFavBtn").addEventListener("click", function () {
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
});

function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { }
    document.body.removeChild(ta);
    const btn = document.getElementById("copyFavBtn");
    btn.textContent = "✅ Скопировано!";
    setTimeout(() => { btn.textContent = "📋 Скопировать артикулы"; }, 2000);
}

document.getElementById("closeFav").addEventListener("click", function () { closeModal("favModal"); });
document.getElementById("favBtn").addEventListener("click", openFavModal);

function render() {
    const grid = document.getElementById("grid");
    const watches = getFilteredWatches();
    const allWatches = loadWatches();
    if (isAuthed) document.body.classList.add("authed");
    else document.body.classList.remove("authed");

    const resultsInfo = document.getElementById("resultsInfo");
    if (currentCategory !== "all" || priceFilterMin !== null || priceFilterMax !== null) {
        resultsInfo.innerHTML = `Найдено: <b>${watches.length}</b> из <b>${allWatches.length}</b> моделей`;
    } else { resultsInfo.innerHTML = ""; }

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

        html += `
      <article class="card${favActive ? ' fav-active' : ''}" data-idx="${i}">
        <button class="fav-btn${favActive ? ' active' : ''}" data-fav="${escapeHtml(article)}" title="В избранное">${favActive ? '❤️' : '🤍'}</button>
        <div class="card-actions">
          <button class="icon-btn edit" data-edit="${i}" title="Редактировать">✎</button>
          <button class="icon-btn del" data-del="${i}" title="Удалить">✕</button>
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

function initCardEvents() {
    document.querySelectorAll(".card").forEach(card => {
        card.addEventListener("click", function (e) {
            if (e.target.closest(".fav-btn") || e.target.closest(".icon-btn") ||
                e.target.closest(".slider-arrow") || e.target.closest(".slider-dot")) return;

            const idx = parseInt(this.getAttribute("data-idx"));
            const watches = getFilteredWatches();
            const w = watches[idx];
            if (w && w.images && w.images.length > 0) {
                openLightbox(w.images, w.article, fmtPrice(w.price), 0);
            }
        });
    });

    document.querySelectorAll(".fav-btn").forEach(btn => {
        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            const article = this.getAttribute("data-fav");
            toggleFav(article);
        });
    });

    document.querySelectorAll("[data-edit]").forEach(btn => {
        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            openEdit(parseInt(this.getAttribute("data-edit")));
        });
    });

    document.querySelectorAll("[data-del]").forEach(btn => {
        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            const idx = parseInt(this.getAttribute("data-del"));
            if (confirm("Удалить эту модель?")) {
                const list = loadWatches();
                list.splice(idx, 1);
                saveWatches(list);
                render();
            }
        });
    });
}

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
            arrows[j].addEventListener("click", function (e) {
                e.stopPropagation();
                goTo(idx + parseInt(this.getAttribute("data-dir")));
            });
        }
        for (let j = 0; j < dots.length; j++) {
            dots[j].addEventListener("click", function (e) {
                e.stopPropagation();
                goTo(parseInt(this.getAttribute("data-k")));
            });
        }
        let startX = 0, dx = 0, dragging = false;
        slides.addEventListener("touchstart", function (e) {
            startX = e.touches[0].clientX; dx = 0; dragging = true;
            slides.style.transition = "none";
        }, { passive: true });
        slides.addEventListener("touchmove", function (e) {
            if (!dragging) return;
            dx = e.touches[0].clientX - startX;
            slides.style.transform = `translateX(${-idx * slides.offsetWidth + dx}px)`;
        }, { passive: true });
        slides.addEventListener("touchend", function () {
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

function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

function initApp() {
    isAuthed = false;
    favorites = loadFavorites();
    updateFavCount();
    updateAuthUI();
    updateSaveBanner();
    render();
}

function updateAuthUI() {
    const area = document.getElementById("authArea");
    if (isAuthed) {
        area.innerHTML = `
      <button class="btn btn-fav" id="favBtn2">❤️ Избранное<span class="fav-count" id="favCount2">${favorites.length}</span></button>
      <button class="btn btn-gold" id="addBtn">+ Добавить</button>
      <button class="btn" id="logoutBtn">Выйти</button>`;
        document.getElementById("addBtn").addEventListener("click", openAddModal);
        document.getElementById("logoutBtn").addEventListener("click", function () {
            isAuthed = false; updateAuthUI(); updateSaveBanner(); render();
        });
        document.getElementById("favBtn2").addEventListener("click", openFavModal);
    } else {
        area.innerHTML = `
      <button class="btn btn-fav" id="favBtn3">❤️ Избранное<span class="fav-count" id="favCount3">${favorites.length}</span></button>
      <button class="btn" id="loginBtn">Войти</button>`;
        document.getElementById("loginBtn").addEventListener("click", function () { openModal("loginModal"); });
        document.getElementById("favBtn3").addEventListener("click", openFavModal);
    }
}

document.getElementById("doLogin").addEventListener("click", function () {
    const u = document.getElementById("loginUser").value.trim();
    const p = document.getElementById("loginPass").value;
    const err = document.getElementById("loginErr");
    err.textContent = "";
    if (u === AUTH.user && p === AUTH.pass) {
        isAuthed = true;
        closeModal("loginModal");
        document.getElementById("loginUser").value = "";
        document.getElementById("loginPass").value = "";
        updateAuthUI(); updateSaveBanner(); render();
    } else { err.textContent = "Неверный логин или пароль"; }
});
document.getElementById("closeLogin").addEventListener("click", function () { closeModal("loginModal"); });
document.getElementById("closeAdd").addEventListener("click", function () { closeModal("addModal"); });
document.getElementById("closeEdit").addEventListener("click", function () { closeModal("editModal"); });
document.getElementById("saveBtn").addEventListener("click", saveToFile);
document.getElementById("githubBtn").addEventListener("click", updateGithub);

document.getElementById("categoryMenu").addEventListener("click", function (e) {
    const btn = e.target.closest(".cat-btn");
    if (!btn) return;
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentCategory = btn.getAttribute("data-cat");
    render();
});
document.getElementById("applyFilter").addEventListener("click", function () {
    const min = document.getElementById("priceMin").value;
    const max = document.getElementById("priceMax").value;
    priceFilterMin = min === "" ? null : Number(min);
    priceFilterMax = max === "" ? null : Number(max);
    render();
});
document.getElementById("resetFilter").addEventListener("click", function () {
    document.getElementById("priceMin").value = "";
    document.getElementById("priceMax").value = "";
    priceFilterMin = null; priceFilterMax = null;
    render();
});

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
    box.innerHTML = pendingAddImages.map((src, k) =>
        `<div class="thumb-item"><img src="${src}" alt=""><button type="button" class="thumb-remove" data-k="${k}">×</button></div>`
    ).join("");
}
document.getElementById("addThumbs").addEventListener("click", function (e) {
    const removeBtn = e.target.closest(".thumb-remove");
    if (!removeBtn) return;
    pendingAddImages.splice(parseInt(removeBtn.getAttribute("data-k")), 1);
    renderAddThumbs();
});
document.getElementById("fImgFile").addEventListener("change", async function () {
    const files = Array.from(this.files || []);
    if (!files.length) return;
    pendingAddImages = pendingAddImages.concat(await compressFiles(files));
    renderAddThumbs();
    this.value = "";
});
document.getElementById("doAdd").addEventListener("click", function () {
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
});

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
    if (!editExistingImages.length) {
        box.innerHTML = `<div style="color:#8a8a94;font-size:12px">Фото пока нет</div>`;
        return;
    }
    box.innerHTML = editExistingImages.map((src, k) =>
        `<div class="thumb-item"><img src="${src}" alt=""><button type="button" class="thumb-remove" data-k="${k}">×</button></div>`
    ).join("");
}
function renderEditNewThumbs() {
    const box = document.getElementById("editNewThumbs");
    box.innerHTML = editNewImages.map((src, k) =>
        `<div class="thumb-item"><img src="${src}" alt=""><button type="button" class="thumb-remove" data-k="${k}">×</button></div>`
    ).join("");
}
document.getElementById("editThumbs").addEventListener("click", function (e) {
    const removeBtn = e.target.closest(".thumb-remove");
    if (!removeBtn) return;
    editExistingImages.splice(parseInt(removeBtn.getAttribute("data-k")), 1);
    renderEditThumbs();
});
document.getElementById("editNewThumbs").addEventListener("click", function (e) {
    const removeBtn = e.target.closest(".thumb-remove");
    if (!removeBtn) return;
    editNewImages.splice(parseInt(removeBtn.getAttribute("data-k")), 1);
    renderEditNewThumbs();
});
document.getElementById("eImgFile").addEventListener("change", async function () {
    const files = Array.from(this.files || []);
    if (!files.length) return;
    editNewImages = editNewImages.concat(await compressFiles(files));
    renderEditNewThumbs();
    this.value = "";
});
document.getElementById("doEdit").addEventListener("click", function () {
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
});

document.getElementById("closeGithub").addEventListener("click", function () { closeModal("githubModal"); });
document.getElementById("saveGithub").addEventListener("click", function () {
    const username = document.getElementById("ghUsername").value.trim();
    const repo = document.getElementById("ghRepo").value.trim();
    const token = document.getElementById("ghToken").value.trim();
    const branch = document.getElementById("ghBranch").value.trim() || "main";
    const err = document.getElementById("githubErr");
    if (!username || !repo || !token) { err.textContent = "Заполните все поля"; return; }
    saveGithubSettings({ username, repo, token, branch });
    err.textContent = "";
    closeModal("githubModal");
    alert("✅ Настройки GitHub сохранены!");
});
const ghSettings = getGithubSettings();
if (ghSettings) {
    document.getElementById("ghUsername").value = ghSettings.username || "";
    document.getElementById("ghRepo").value = ghSettings.repo || "";
    document.getElementById("ghToken").value = ghSettings.token || "";
    document.getElementById("ghBranch").value = ghSettings.branch || "main";
}

initApp();