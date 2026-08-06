// ========== ОЧИСТКА КЕША ==========
(function(){
  const CURRENT_VERSION = '2.0.8';
  const VERSION_KEY = 'tempus_kz_ver';
  const RELOAD_KEY = 'tempus_kz_reloaded';
  const savedVersion = localStorage.getItem(VERSION_KEY);
  if (savedVersion !== CURRENT_VERSION) {
    console.log('🔄 Новая версия! Полная очистка...');
    let favs = null;
    try { favs = localStorage.getItem('mdt_favorites_v1'); } catch(e) {}
    localStorage.clear();
    sessionStorage.clear();
    if ('caches' in window) { caches.keys().then(names => names.forEach(name => caches.delete(name))); }
    document.cookie.split(";").forEach(c => { document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date(0).toUTCString() + ";path=/"); });
    if ('indexedDB' in window) { indexedDB.databases().then(dbs => dbs.forEach(db => indexedDB.deleteDatabase(db.name))).catch(() => {}); }
    if (favs) localStorage.setItem('mdt_favorites_v1', favs);
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    if (!sessionStorage.getItem(RELOAD_KEY)) { sessionStorage.setItem(RELOAD_KEY, '1'); setTimeout(() => { window.location.reload(true); }, 150); throw new Error('RELOAD'); }
  }
  console.log('✅ v' + CURRENT_VERSION);
})();

// ========== КОНСТАНТЫ ==========
const AUTH = { user: "anastasia_zy_zy", pass: "anastasia_zy_zy" };
const LS_KEY = "mdt_watches_v2", FAV_KEY = "mdt_favorites_v1", GH_KEY = "mdt_github_v17", DATA_URL = 'data.json';
const ITEMS_PER_PAGE = 12;
let canUseStorage = false;
try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); canUseStorage = true; } catch (e) {}
let isAuthed = false, currentCategory = "all", priceFilterMin = null, priceFilterMax = null, searchQuery = '', sortOrder = 'default';
let favorites = [], catalogData = [], currentPage = 1, totalPages = 1;

// ========== ЗАГРУЗКА ДАННЫХ ==========
async function loadDataFromFile() {
  try { const r = await fetch(DATA_URL + '?_=' + Date.now()); if (r.ok) { catalogData = migrateData(await r.json()); if (canUseStorage) localStorage.setItem(LS_KEY, JSON.stringify(catalogData)); return catalogData; } } catch (e) {}
  if (canUseStorage) { try { const ls = localStorage.getItem(LS_KEY); if (ls) { catalogData = migrateData(JSON.parse(ls)); return catalogData; } } catch (e) {} }
  catalogData = loadFromEmbedded(); return catalogData;
}
function loadFromEmbedded() { try { const el = document.getElementById("catalog-data"); return el ? migrateData(JSON.parse(el.textContent.trim() || "[]")) : []; } catch (e) { return []; } }
function loadWatchesSync() { return catalogData; }
function migrateData(list) { return list.map((w, index) => { if (!w.images) { w.images = w.img ? [w.img] : []; delete w.img; } if (!w.category) w.category = "men"; if (!w.name) w.name = w.desc || ''; if (!w.createdAt) { const daysAgo = list.length - index; w.createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(); } return w; }); }

// ========== КНОПКА ОЧИСТКИ КЕША ==========
function hardReset() {
  if (confirm('Полностью очистить кеш и перезагрузить страницу?\n\nИзбранное сохранится.')) {
    const favs = localStorage.getItem('mdt_favorites_v1'); const github = localStorage.getItem('mdt_github_v17');
    localStorage.clear(); sessionStorage.clear();
    document.cookie.split(";").forEach(c => { document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date(0).toUTCString() + ";path=/"); });
    if ('caches' in window) { caches.keys().then(names => names.forEach(name => caches.delete(name))); }
    if ('indexedDB' in window) { indexedDB.databases().then(dbs => dbs.forEach(db => indexedDB.deleteDatabase(db.name))).catch(() => {}); }
    if (favs) localStorage.setItem('mdt_favorites_v1', favs);
    if (github) localStorage.setItem('mdt_github_v17', github);
    localStorage.setItem('tempus_kz_ver', '2.0.8');
    window.location.reload(true);
  }
}

// ========== ИЗБРАННОЕ ==========
function loadFavorites() { if (!canUseStorage) return []; try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]").filter(a => a?.trim()); } catch (e) { return []; } }
function saveFavorites() { favorites = favorites.filter(a => a?.trim()); if (canUseStorage) localStorage.setItem(FAV_KEY, JSON.stringify(favorites)); updateFavCount(); }
function updateFavCount() { document.querySelectorAll('.fav-count').forEach(el => { el.textContent = favorites.length; }); }
function isFav(article) { return article?.trim() ? favorites.includes(article) : false; }
function toggleFav(article) {
  if (!article?.trim()) return; const idx = favorites.indexOf(article); if (idx >= 0) favorites.splice(idx, 1); else favorites.push(article);
  saveFavorites(); const esc = article.replace(/"/g, '\\"');
  const btn = document.querySelector(`[data-fav="${esc}"]`); if (btn) { const a = isFav(article); btn.classList.toggle('active', a); btn.innerHTML = a ? '❤️' : '🤍'; }
  const card = document.querySelector(`[data-article="${esc}"]`); if (card) card.classList.toggle('fav-active', isFav(article));
  updateFavCount(); if (document.getElementById("favModal")?.classList.contains("open")) openFavModal();
}

// ========== СОХРАНЕНИЕ ==========
function saveWatches(list) { catalogData = list; try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch (e) {} }

// ========== ИЗОБРАЖЕНИЯ ==========
function compressImage(file, maxWidth = 400, quality = 0.6) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = e => { const img = new Image(); img.onload = () => { const canvas = document.createElement('canvas'); let w = img.width, h = img.height; if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; } canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h); resolve(canvas.toDataURL('image/jpeg', quality)); }; img.onerror = reject; img.src = e.target.result; }; reader.onerror = reject; reader.readAsDataURL(file); }); }
async function compressFiles(files) { const r = []; for (const f of files) { try { r.push(await compressImage(f)); } catch (e) {} } return r; }

// ========== ФИЛЬТРАЦИЯ + СОРТИРОВКА ==========
function getFilteredWatches() {
  let w = loadWatchesSync(); if (currentCategory !== "all") w = w.filter(x => x.category === currentCategory);
  if (priceFilterMin !== null) w = w.filter(x => x.price >= priceFilterMin); if (priceFilterMax !== null) w = w.filter(x => x.price <= priceFilterMax);
  if (searchQuery) { const q = searchQuery.toLowerCase(); w = w.filter(x => (x.name || '').toLowerCase().includes(q) || (x.desc || '').toLowerCase().includes(q) || (x.article || '').toLowerCase().includes(q)); }
  if (sortOrder === 'default') { w.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)); }
  else if (sortOrder === 'price_asc') { w.sort((a, b) => (a.price || 0) - (b.price || 0)); }
  else if (sortOrder === 'price_desc') { w.sort((a, b) => (b.price || 0) - (a.price || 0)); }
  return w;
}
function getPageWatches() { const filtered = getFilteredWatches(); totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1; if (currentPage > totalPages) currentPage = totalPages; const start = (currentPage - 1) * ITEMS_PER_PAGE; return filtered.slice(start, start + ITEMS_PER_PAGE); }

// ========== HTML ==========
async function saveToFile() { try { const watches = loadWatchesSync(); let html = "<!DOCTYPE html>\n" + document.documentElement.outerHTML; html = html.replace(/<script id="catalog-data" type="application\/json">[\s\S]*?<\/script>/, `<script id="catalog-data" type="application\/json">${JSON.stringify(watches).replace(/<\//g, "<\\/")}<\/script>`); const blob = new Blob([html], { type: "text/html;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "index.html"; a.click(); URL.revokeObjectURL(url); alert("✅ index.html скачан!"); } catch (e) { alert("Ошибка: " + e.message); } }

// ========== EXCEL ==========
function downloadExcel() { const watches = loadWatchesSync(); const rows = [['Артикул', 'Название', 'Описание', 'Категория', 'Цена (₸)', 'Количество', 'Наличие']]; watches.forEach(w => { rows.push([w.article || '', w.name || '', w.desc || '', w.category === 'women' ? 'Женские' : 'Мужские', w.price || 0, w.qty || 0, w.qty > 3 ? 'В наличии' : w.qty > 0 ? 'Заканчивается' : 'Нет']); }); let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n<Styles>\n'; xml += '<Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2"/></Borders><Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#1a1a1a"/><Interior ss:Color="#d4af37" ss:Pattern="Solid"/></Style>\n'; xml += '<Style ss:ID="Normal"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e0e0e0"/></Borders><Font ss:FontName="Calibri" ss:Size="11"/></Style>\n'; xml += '<Style ss:ID="Price"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><NumberFormat ss:Format="#,##0"/><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/></Style>\n'; xml += '<Style ss:ID="Center"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>\n'; xml += '<Style ss:ID="InStock"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#2ecc71"/></Style>\n'; xml += '<Style ss:ID="LowStock"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#e6b85c"/></Style>\n'; xml += '<Style ss:ID="OutStock"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#e74c3c"/></Style>\n'; xml += '</Styles>\n<Worksheet ss:Name="Каталог часов">\n<Table>\n'; xml += '<Column ss:Width="120"/><Column ss:Width="200"/><Column ss:Width="350"/><Column ss:Width="100"/><Column ss:Width="120"/><Column ss:Width="80"/><Column ss:Width="120"/>\n'; rows.forEach((row, rowIdx) => { xml += '<Row>\n'; row.forEach((cell, colIdx) => { let style = 'Normal'; if (rowIdx === 0) style = 'Header'; else if (colIdx === 4) style = 'Price'; else if (colIdx === 3 || colIdx === 5) style = 'Center'; else if (colIdx === 6) { if (cell === 'В наличии') style = 'InStock'; else if (cell === 'Заканчивается') style = 'LowStock'; else style = 'OutStock'; } const safe = String(cell).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); const type = (rowIdx > 0 && (colIdx === 4 || colIdx === 5)) ? 'Number' : 'String'; xml += `<Cell ss:StyleID="${style}"><Data ss:Type="${type}">${safe}</Data></Cell>\n`; }); xml += '</Row>\n'; }); xml += '</Table>\n</Worksheet>\n</Workbook>'; const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'tempus_kz_catalog.xls'; a.click(); URL.revokeObjectURL(url); }
function uploadExcel() { const el = document.getElementById("excelFileInput"); if (el) el.click(); }
function handleExcelUpload(event) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function(e) { try { const data = e.target.result; let rows = []; if (data.includes('<?xml') || data.includes('<Workbook')) rows = parseXmlExcel(data); else rows = parseCSV(data); if (rows.length < 2) { alert('❌ Файл пуст'); return; } const newWatches = [], existingWatches = loadWatchesSync(); let updated = 0, added = 0; for (let i = 1; i < rows.length; i++) { const row = rows[i]; if (!row[0] && !row[1]) continue; const article = String(row[0] || '').trim(), name = String(row[1] || '').trim(), desc = String(row[2] || '').trim(); const category = String(row[3] || '').toLowerCase().includes('жен') ? 'women' : 'men'; const price = parseInt(String(row[4] || '0').replace(/[^\d]/g, '')) || 0, qty = parseInt(String(row[5] || '0').replace(/[^\d]/g, '')) || 0; const existingIdx = existingWatches.findIndex(w => w.article === article && article !== ''); if (existingIdx >= 0) { existingWatches[existingIdx] = { ...existingWatches[existingIdx], name: name || existingWatches[existingIdx].name, desc: desc || existingWatches[existingIdx].desc, category, price, qty }; updated++; } else { newWatches.push({ article: article || ('TK-' + new Date().getFullYear() + '-' + String(Math.random()).substring(2, 6)), name: name || 'Новая модель', desc: desc || '', category, price, qty, images: [], createdAt: new Date().toISOString() }); added++; } } saveWatches([...existingWatches, ...newWatches]); currentPage = 1; render(); alert(`✅ Готово!\n\n📝 Обновлено: ${updated}\n➕ Добавлено: ${added}\n📦 Всего: ${existingWatches.length + newWatches.length}`); } catch (err) { console.error(err); alert('❌ Ошибка чтения файла.'); } }; reader.readAsText(file, 'UTF-8'); event.target.value = ''; }
function parseXmlExcel(xml) { const rows = []; const rr = /<Row[^>]*>([\s\S]*?)<\/Row>/gi; let rm; while ((rm = rr.exec(xml)) !== null) { const cells = []; const cr = /<Cell[^>]*>(?:<Data[^>]*>)?([\s\S]*?)(?:<\/Data>)?<\/Cell>/gi; let cm; while ((cm = cr.exec(rm[1])) !== null) { let v = (cm[1] || '').replace(/<[^>]+>/g, '').trim(); v = v.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'); cells.push(v); } if (cells.length) rows.push(cells); } return rows; }
function parseCSV(csv) { const rows = []; csv.split(/\r?\n/).forEach(line => { if (!line.trim()) return; const cells = []; let cur = '', inQ = false; for (const ch of line) { if (ch === '"') inQ = !inQ; else if ((ch === ';' || ch === ',') && !inQ) { cells.push(cur.trim()); cur = ''; } else cur += ch; } cells.push(cur.trim()); if (cells.length) rows.push(cells); }); return rows; }

// ========== GITHUB ==========
function getGhSettings() { try { const s = localStorage.getItem(GH_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
async function pushToGhWithRetry(settings, path, content, retryCount = 0) {
  if (retryCount > 3) throw new Error('Превышено количество попыток.');
  const token = settings.token.trim(); const apiUrl = `https://api.github.com/repos/${settings.username}/${settings.repo}/contents/${path}`; const encoded = btoa(unescape(encodeURIComponent(content)));
  console.log(`📤 ${path} (попытка ${retryCount + 1}/3)...`);
  try {
    const getHeaders = new Headers(); getHeaders.append('Authorization', `Bearer ${token}`); getHeaders.append('Accept', 'application/vnd.github.v3+json'); getHeaders.append('X-GitHub-Api-Version', '2022-11-28');
    const response = await fetch(apiUrl + '?ref=' + (settings.branch || 'main') + '&_=' + Date.now(), { method: 'GET', headers: getHeaders });
    let sha = null; if (response.ok) { sha = (await response.json()).sha; } else if (response.status === 404) { console.log(`📄 ${path} будет создан`); } else if (response.status === 401) { throw new Error('Неверный токен'); }
    const putHeaders = new Headers(); putHeaders.append('Authorization', `Bearer ${token}`); putHeaders.append('Accept', 'application/vnd.github.v3+json'); putHeaders.append('Content-Type', 'application/json'); putHeaders.append('X-GitHub-Api-Version', '2022-11-28');
    const body = { message: `Update ${path} [${new Date().toLocaleString('ru-RU')}]`, content: encoded, branch: settings.branch || 'main' }; if (sha) body.sha = sha;
    const putResponse = await fetch(apiUrl, { method: 'PUT', headers: putHeaders, body: JSON.stringify(body) });
    if (!putResponse.ok) { const errData = await putResponse.json().catch(() => ({})); if (putResponse.status === 422 && errData.message?.includes('does not match')) { console.warn(`🔄 SHA не совпал...`); await new Promise(r => setTimeout(r, 1000)); return pushToGhWithRetry(settings, path, content, retryCount + 1); } if (putResponse.status === 401) throw new Error('Неверный токен'); throw new Error(errData.message || `HTTP ${putResponse.status}`); }
    console.log(`✅ ${path} отправлен`);
  } catch (error) { if (error.message === 'Failed to fetch' || error.name === 'TypeError') { console.warn(`⚠️ Сеть, повтор через ${(retryCount + 1) * 2}с...`); await new Promise(r => setTimeout(r, (retryCount + 1) * 2000)); return pushToGhWithRetry(settings, path, content, retryCount + 1); } throw error; }
}
async function saveToGithub() { const s = getGhSettings(); if (!s?.token?.trim()) { openModal("githubModal"); return; } const progress = document.getElementById("githubProgress"); if (progress) progress.classList.add("show"); try { const watches = loadWatchesSync(); const watchesWithImages = watches.map(w => ({ ...w, images: w.images || [] })); catalogData = watchesWithImages; if (canUseStorage) localStorage.setItem(LS_KEY, JSON.stringify(catalogData)); const dataJsonContent = JSON.stringify(watchesWithImages, null, 2); let html = "<!DOCTYPE html>\n" + document.documentElement.outerHTML; html = html.replace(/<script id="catalog-data" type="application\/json">[\s\S]*?<\/script>/, `<script id="catalog-data" type="application\/json">${JSON.stringify(watchesWithImages).replace(/<\//g, "<\\/")}<\/script>`); await pushToGhWithRetry(s, 'data.json', dataJsonContent); await pushToGhWithRetry(s, 'index.html', html); if (progress) progress.classList.remove("show"); alert('✅ Сохранено на GitHub!\n\nhttps://' + s.username + '.github.io/' + s.repo + '/'); } catch (e) { if (progress) progress.classList.remove("show"); console.error('❌ GitHub:', e); alert('❌ ' + e.message); } }

// ========== ФОРМАТИРОВАНИЕ ==========
function fmtPrice(n) { return Number(n).toLocaleString("ru-RU") + " ₸"; }
function stockInfo(qty) { const q = Number(qty); if (!q) return { cls: "out", text: "Нет в наличии" }; if (q <= 3) return { cls: "low", text: `В наличии: ${q} шт.` }; return { cls: "in", text: `В наличии: ${q} шт.` }; }
function placeholderSVG() { return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f5d98a"/><stop offset="100%" stop-color="#d4af37"/></linearGradient></defs><circle cx="50" cy="50" r="28" fill="none" stroke="url(#g)" stroke-width="2.5"/><circle cx="50" cy="50" r="22" fill="none" stroke="url(#g)" stroke-width="1" opacity=".6"/><line x1="50" y1="50" x2="50" y2="34" stroke="url(#g)" stroke-width="2" stroke-linecap="round"/><line x1="50" y1="50" x2="62" y2="50" stroke="url(#g)" stroke-width="2" stroke-linecap="round"/></svg>'; }
function escapeHtml(s) { if (!s) return ""; return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

// ========== ЛАЙТБОКС ==========
let lbImages = [], lbIdx = 0, lbArticle = "", lbPrice = "";
function openLightbox(images, article, price, startIdx) { if (!images?.length) return; lbImages = images; lbIdx = startIdx || 0; lbArticle = article || ""; lbPrice = price || ""; renderLightbox(); const el = document.getElementById("lightbox"); if (el) el.classList.add("open"); document.body.style.overflow = "hidden"; }
function closeLightbox() { const el = document.getElementById("lightbox"); if (el) el.classList.remove("open"); document.body.style.overflow = ""; }
function renderLightbox() { const img = document.getElementById("lightboxImg"); if (img) img.src = lbImages[lbIdx]; const art = document.getElementById("lightboxArticle"); if (art) art.textContent = lbArticle ? "Артикул: " + lbArticle : ""; const pr = document.getElementById("lightboxPrice"); if (pr) pr.textContent = lbPrice; const dots = document.getElementById("lightboxDots"); if (dots && lbImages.length > 1) { dots.innerHTML = lbImages.map((_, k) => `<button class="lightbox-dot${k === lbIdx ? ' active' : ''}" data-k="${k}"></button>`).join(""); dots.style.display = "flex"; const prev = document.getElementById("lightboxPrev"); if (prev) prev.style.display = "flex"; const next = document.getElementById("lightboxNext"); if (next) next.style.display = "flex"; dots.querySelectorAll(".lightbox-dot").forEach(d => d.onclick = () => { lbIdx = +d.getAttribute("data-k"); renderLightbox(); }); } else { if (dots) dots.style.display = "none"; const prev = document.getElementById("lightboxPrev"); if (prev) prev.style.display = "none"; const next = document.getElementById("lightboxNext"); if (next) next.style.display = "none"; } }
function lbPrev() { lbIdx = (lbIdx - 1 + lbImages.length) % lbImages.length; renderLightbox(); }
function lbNext() { lbIdx = (lbIdx + 1) % lbImages.length; renderLightbox(); }

// ========== МОДАЛКИ ==========
function openModal(id) { const el = document.getElementById(id); if (el) el.classList.add("open"); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove("open"); }

// ========== ИЗБРАННОЕ МОДАЛКА ==========
function openFavModal() { const list = document.getElementById("favList"), copyArea = document.getElementById("favCopyArea"), copyBtn = document.getElementById("copyFavBtn"); const all = loadWatchesSync(); if (!favorites.length) { if (list) list.innerHTML = '<div class="empty-fav">Список пуст.</div>'; if (copyArea) copyArea.style.display = "none"; if (copyBtn) copyBtn.style.display = "none"; openModal("favModal"); return; } let html = "", arts = []; favorites.forEach(article => { const w = all.find(x => x.article === article); if (w) { arts.push(w.article); const img = w.images?.[0] ? `<img src="${w.images[0]}" alt="">` : placeholderSVG(); html += `<div class="fav-item"><div class="fav-item-img">${img}</div><div class="fav-item-info"><div class="fav-item-article">${escapeHtml(w.article)}</div><div class="fav-item-desc">${escapeHtml(w.name || w.desc)}</div><div class="fav-item-price">${fmtPrice(w.price)}</div></div><button class="fav-remove" data-article="${escapeHtml(w.article)}">×</button></div>`; } }); if (list) list.innerHTML = html; if (copyArea) { copyArea.textContent = arts.join(", "); copyArea.style.display = "block"; } if (copyBtn) copyBtn.style.display = "inline-block"; if (list) list.querySelectorAll(".fav-remove").forEach(b => b.onclick = () => toggleFav(b.getAttribute("data-article"))); openModal("favModal"); }
function fallbackCopy(text) { const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;left:-9999px"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} document.body.removeChild(ta); const btn = document.getElementById("copyFavBtn"); if (btn) { btn.textContent = "✅ Скопировано!"; setTimeout(() => btn.textContent = "📋 Скопировать артикулы", 2000); } }

// ========== ПАГИНАЦИЯ ==========
function renderPagination(container) { if (totalPages <= 1) { container.innerHTML = ''; return; } let html = '<div class="pagination">'; html += `<button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹</button>`; for (let i = 1; i <= totalPages; i++) { if (totalPages <= 7 || i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) { html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`; } else if (i === 2 || i === totalPages - 1) { html += '<span class="page-dots">…</span>'; } } html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>›</button>`; html += `<span class="page-info">${currentPage}/${totalPages}</span></div>`; container.innerHTML = html; }
function goToPage(page) { if (page < 1 || page > totalPages) return; currentPage = page; render(); window.scrollTo({ top: document.getElementById("grid").offsetTop - 100, behavior: 'smooth' }); }

// ========== РЕНДЕР ==========
async function render() {
  const grid = document.getElementById("grid"); if (!grid) return; if (!catalogData.length) await loadDataFromFile();
  const watches = getPageWatches(), allFiltered = getFilteredWatches();
  if (isAuthed) { document.body.classList.add("authed"); } else { document.body.classList.remove("authed"); }
  const info = document.getElementById("resultsInfo"); if (info) info.innerHTML = (currentCategory !== "all" || priceFilterMin !== null || priceFilterMax !== null || searchQuery || sortOrder !== 'default') ? `Найдено: <b>${allFiltered.length}</b> (стр. ${currentPage}/${totalPages})` : `Всего: <b>${allFiltered.length}</b>`;
  if (!watches.length) { grid.innerHTML = '<div class="empty">Ничего не найдено.</div>'; const pagDiv = document.getElementById("pagination"); if (pagDiv) pagDiv.innerHTML = ''; return; }
  let html = '';
  watches.forEach((w, i) => { const s = stockInfo(w.qty), images = w.images || [], multi = images.length > 1; const article = w.article || "", favActive = isFav(article); const sc = images.length ? images.map(src => `<div class="slide"><img src="${src}" alt="" draggable="false"></div>`).join("") : `<div class="placeholder">${placeholderSVG()}</div>`; const dots = multi ? `<div class="slider-dots">${images.map((_, k) => `<button class="slider-dot${k === 0 ? ' active' : ''}" data-k="${k}"></button>`).join("")}</div>` : ""; const arrows = multi ? `<button class="slider-arrow prev" data-dir="-1">‹</button><button class="slider-arrow next" data-dir="1">›</button>` : ""; html += `<article class="card${favActive ? ' fav-active' : ''}" data-article="${escapeHtml(article)}"><button class="fav-btn${favActive ? ' active' : ''}" data-fav="${escapeHtml(article)}">${favActive ? '❤️' : '🤍'}</button><div class="card-actions"><button class="icon-btn edit" data-edit-article="${escapeHtml(article)}">✎</button><button class="icon-btn del" data-del-article="${escapeHtml(article)}">✕</button></div><div class="slider${multi ? ' has-multi' : ''}" data-slider="${i}"><div class="slides">${sc}</div>${arrows}${dots}</div><div class="body">${w.category ? `<span class="category-badge ${w.category}">${w.category === 'women' ? 'Женские' : 'Мужские'}</span>` : ''}${article ? `<div class="article">Артикул: ${escapeHtml(article)}</div>` : ''}${w.name ? `<p class="name">${escapeHtml(w.name)}</p>` : ''}<p class="desc">${escapeHtml(w.desc)}</p><div class="price-wrap"><div class="price">${fmtPrice(w.price)}</div><div class="stock ${s.cls}">${s.text}</div></div></div></article>`; });
  grid.innerHTML = html; let pagDiv = document.getElementById("pagination"); if (!pagDiv) { pagDiv = document.createElement('div'); pagDiv.id = 'pagination'; grid.parentNode.insertBefore(pagDiv, grid.nextSibling); } renderPagination(pagDiv);
  initSliders(); initCardEvents(); updateFavCount();
}

// ========== КАРТОЧКИ + КНОПКА "ПОДРОБНЕЕ" ==========
// ========== КНОПКА "ПОДРОБНЕЕ" (ИСПРАВЛЕНО) ==========
function setupDescToggle() {
  document.querySelectorAll(".desc").forEach(desc => {
    // Удаляем старые обработчики
    const oldToggle = desc.parentNode.querySelector('.desc-toggle');
    if (oldToggle) oldToggle.remove();
    desc.classList.remove('expanded');
    
    // Находим карточку
    const card = desc.closest('.card');
    if (card) card.classList.remove('has-expanded');
    
    // Проверяем, превышает ли текст 3 строки
    const isOverflowing = desc.scrollHeight > desc.clientHeight + 2;
    
    if (isOverflowing) {
      const toggle = document.createElement('span');
      toggle.className = 'desc-toggle';
      toggle.textContent = '▼ Подробнее';
      
      // Вставляем кнопку после описания
      desc.parentNode.insertBefore(toggle, desc.nextSibling);
      
      // Обработчик клика
      toggle.onclick = function(e) {
        e.stopPropagation();
        e.preventDefault();
        
        const isExpanded = desc.classList.contains('expanded');
        
        if (isExpanded) {
          // СВОРАЧИВАЕМ
          desc.classList.remove('expanded');
          toggle.textContent = '▼ Подробнее';
          if (card) {
            card.classList.remove('has-expanded');
            // Прокручиваем описание к началу
            desc.scrollTop = 0;
          }
        } else {
          // РАЗВОРАЧИВАЕМ
          // Сначала закрываем все остальные
          document.querySelectorAll('.desc.expanded').forEach(d => {
            if (d !== desc) {
              d.classList.remove('expanded');
              const t = d.parentNode.querySelector('.desc-toggle');
              if (t) t.textContent = '▼ Подробнее';
              const c = d.closest('.card');
              if (c) c.classList.remove('has-expanded');
              d.scrollTop = 0;
            }
          });
          
          desc.classList.add('expanded');
          toggle.textContent = '▲ Свернуть';
          if (card) {
            card.classList.add('has-expanded');
            // Прокручиваем описание к началу
            desc.scrollTop = 0;
          }
        }
      };
    }
  });
}
function initCardEvents() { document.querySelectorAll(".card").forEach(card => { card.onclick = function(e) { if (e.target.closest(".fav-btn,.icon-btn,.slider-arrow,.slider-dot")) return; const w = loadWatchesSync().find(w => w.article === this.getAttribute("data-article")); if (w?.images?.length) openLightbox(w.images, w.article, fmtPrice(w.price), 0); }; }); document.querySelectorAll(".fav-btn").forEach(b => b.onclick = function(e) { e.stopPropagation(); e.preventDefault(); toggleFav(this.getAttribute("data-fav")); return false; }); document.querySelectorAll("[data-edit-article]").forEach(b => b.onclick = function(e) { e.stopPropagation(); const i = loadWatchesSync().findIndex(w => w.article === this.getAttribute("data-edit-article")); if (i >= 0) openEdit(i); }); document.querySelectorAll("[data-del-article]").forEach(b => b.onclick = function(e) { e.stopPropagation(); if (confirm("Удалить?")) { const list = loadWatchesSync(); const i = list.findIndex(w => w.article === this.getAttribute("data-del-article")); if (i >= 0) { list.splice(i, 1); saveWatches(list); render(); } } }); setupDescToggle(); }

// ========== СЛАЙДЕРЫ ==========
function initSliders() { document.querySelectorAll("[data-slider]").forEach(slider => { const slides = slider.querySelector(".slides"), dots = slider.querySelectorAll(".slider-dot"), arrows = slider.querySelectorAll(".slider-arrow"); if (!slides || slides.children.length < 2) return; const total = slides.children.length; let idx = 0; let counter = slider.querySelector('.photo-counter'); if (!counter) { counter = document.createElement('div'); counter.className = 'photo-counter'; slider.appendChild(counter); } const go = n => { idx = (n + total) % total; if (idx < 0) idx = total - 1; slides.style.transform = `translateX(-${idx * 100}%)`; dots.forEach((d, k) => d.classList.toggle("active", k === idx)); counter.textContent = `${idx + 1}/${total}`; }; counter.textContent = `1/${total}`; arrows.forEach(a => a.onclick = e => { e.stopPropagation(); go(idx + parseInt(a.getAttribute("data-dir"))); }); dots.forEach((d, j) => d.onclick = e => { e.stopPropagation(); go(j); }); let sx = 0, dx = 0, dragging = false; slides.addEventListener("touchstart", e => { sx = e.touches[0].clientX; dx = 0; dragging = true; slides.style.transition = "none"; }, { passive: true }); slides.addEventListener("touchmove", e => { if (!dragging) return; dx = e.touches[0].clientX - sx; slides.style.transform = `translateX(${-idx * slides.offsetWidth + dx}px)`; }, { passive: true }); slides.addEventListener("touchend", () => { if (!dragging) return; dragging = false; slides.style.transition = "transform 0.3s ease-out"; if (dx < -slides.offsetWidth * 0.2) go(idx + 1); else if (dx > slides.offsetWidth * 0.2) go(idx - 1); else go(idx); }, { passive: true }); }); }

// ========== АВТОРИЗАЦИЯ ==========
function updateAuthUI() { const area = document.getElementById("authArea"); if (!area) return; const banner = document.getElementById("saveBanner"); if (isAuthed) { area.innerHTML = `<button class="btn btn-fav" id="favBtnAuthed">❤️ Избранное<span class="fav-count">${favorites.length}</span></button><button class="btn btn-gold" id="addBtn">+ Добавить</button><button class="btn btn-gold" id="githubBtnTop">🚀 СОХРАНИТЬ!!!</button><button class="btn" id="excelBtnTop">📥Скачать Excel</button><button class="btn" id="uploadExcelBtnTop">📤Загрузить свой Excel</button><button class="btn" id="hardResetBtn" style="background:#c0392b;color:#fff;border:1px solid #c0392b;">🧹 Сброс</button><button class="btn" id="logoutBtn">Выйти</button>`; const addBtn = document.getElementById("addBtn"); if (addBtn) addBtn.onclick = openAddModal; const githubBtnTop = document.getElementById("githubBtnTop"); if (githubBtnTop) githubBtnTop.onclick = saveToGithub; const excelBtnTop = document.getElementById("excelBtnTop"); if (excelBtnTop) excelBtnTop.onclick = downloadExcel; const uploadExcelBtnTop = document.getElementById("uploadExcelBtnTop"); if (uploadExcelBtnTop) uploadExcelBtnTop.onclick = uploadExcel; const saveBtnTop = document.getElementById("saveBtnTop"); if (saveBtnTop) saveBtnTop.onclick = saveToFile; const hardResetBtn = document.getElementById("hardResetBtn"); if (hardResetBtn) hardResetBtn.onclick = hardReset; const logoutBtn = document.getElementById("logoutBtn"); if (logoutBtn) { logoutBtn.onclick = function() { isAuthed = false; document.body.classList.remove("authed"); updateAuthUI(); render(); }; } const favBtnAuthed = document.getElementById("favBtnAuthed"); if (favBtnAuthed) favBtnAuthed.onclick = openFavModal; document.body.classList.add("authed"); if (banner) banner.style.display = "block"; } else { area.innerHTML = `<button class="btn btn-fav" id="favBtnGuest">❤️ Избранное<span class="fav-count">${favorites.length}</span></button><button class="btn" id="loginBtn">Войти</button>`; const loginBtn = document.getElementById("loginBtn"); if (loginBtn) loginBtn.onclick = function() { openModal("loginModal"); }; const favBtnGuest = document.getElementById("favBtnGuest"); if (favBtnGuest) favBtnGuest.onclick = openFavModal; document.body.classList.remove("authed"); if (banner) banner.style.display = "none"; } }

// ========== ДОБАВЛЕНИЕ/РЕДАКТИРОВАНИЕ ==========
let pendingAddImages = []; function openAddModal() { pendingAddImages = []; document.getElementById("fCategory").value = "men"; "fArticle fName fDesc fPrice fQty fImgFile".split(" ").forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; }); document.getElementById("addErr").textContent = ""; renderAddThumbs(); openModal("addModal"); }
function renderAddThumbs() { const box = document.getElementById("addThumbs"); if (!box) return; box.innerHTML = pendingAddImages.map((s, k) => `<div class="thumb-item"><img src="${s}"><button class="thumb-remove" data-k="${k}">×</button></div>`).join(""); box.querySelectorAll(".thumb-remove").forEach(b => b.onclick = () => { pendingAddImages.splice(+b.getAttribute("data-k"), 1); renderAddThumbs(); }); }
let editingIndex = -1, editExisting = [], editNew = []; function openEdit(i) { const w = loadWatchesSync()[i]; if (!w) return; editingIndex = i; editExisting = (w.images || []).slice(); editNew = []; document.getElementById("eCategory").value = w.category || "men"; document.getElementById("eArticle").value = w.article || ""; document.getElementById("eName").value = w.name || ""; document.getElementById("eDesc").value = w.desc || ""; document.getElementById("ePrice").value = w.price; document.getElementById("eQty").value = w.qty; document.getElementById("eImgFile").value = ""; document.getElementById("editErr").textContent = ""; renderEditThumbs(); renderEditNewThumbs(); openModal("editModal"); }
function renderEditThumbs() { const box = document.getElementById("editThumbs"); if (!box) return; if (!editExisting.length) { box.innerHTML = '<div style="color:#8a8a94;font-size:12px">Нет фото</div>'; return; } box.innerHTML = editExisting.map((s, k) => `<div class="thumb-item"><img src="${s}"><button class="thumb-remove" data-k="${k}">×</button></div>`).join(""); box.querySelectorAll(".thumb-remove").forEach(b => b.onclick = () => { if (confirm('Удалить фото?')) { editExisting.splice(+b.getAttribute("data-k"), 1); renderEditThumbs(); } }); }
function renderEditNewThumbs() { const box = document.getElementById("editNewThumbs"); if (!box) return; box.innerHTML = editNew.map((s, k) => `<div class="thumb-item"><img src="${s}"><button class="thumb-remove" data-k="${k}">×</button></div>`).join(""); box.querySelectorAll(".thumb-remove").forEach(b => b.onclick = () => { editNew.splice(+b.getAttribute("data-k"), 1); renderEditNewThumbs(); }); }

// ========== DRAG & DROP / КНОПКА НАВЕРХ / ПОИСК ==========
function setupDragDrop() { document.querySelectorAll('.file-input').forEach(zone => { zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); }); zone.addEventListener('dragleave', () => zone.classList.remove('dragover')); zone.addEventListener('drop', async e => { e.preventDefault(); zone.classList.remove('dragover'); const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')); if (!files.length) return; const compressed = await compressFiles(files); const input = zone.querySelector('input[type="file"]'); if (input) { if (input.id === 'fImgFile') { pendingAddImages = pendingAddImages.concat(compressed); renderAddThumbs(); } else if (input.id === 'eImgFile') { editNew = editNew.concat(compressed); renderEditNewThumbs(); } } }); }); }
function setupScrollTop() { const btn = document.getElementById("scrollTopBtn"); if (!btn) return; window.addEventListener('scroll', () => btn.classList.toggle('show', window.scrollY > 500)); btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' })); }
function setupSearch() { const inp = document.getElementById("searchInput"); if (!inp) return; inp.addEventListener('input', function() { searchQuery = this.value.trim(); currentPage = 1; render(); }); }
function hidePreloader() { setTimeout(() => { const el = document.getElementById('preloader'); if (el) el.classList.add('hidden'); }, 300); }

// ========== ИНИЦИАЛИЗАЦИЯ ==========
async function initApp() { isAuthed = false; sessionStorage.clear(); if (canUseStorage) { try { localStorage.removeItem('mdt_authed'); } catch (e) {} } favorites = loadFavorites(); saveFavorites(); updateAuthUI(); const banner = document.getElementById("saveBanner"); if (banner) banner.style.display = "none"; document.body.classList.remove("authed"); await render(); hidePreloader(); }

// ========== ОБРАБОТЧИКИ ==========
function bindEvents() { const $ = id => document.getElementById(id); const on = (id, ev, fn) => { const el = $(id); if (el) el[ev] = fn; }; on("lightboxClose", "onclick", closeLightbox); on("lightboxPrev", "onclick", e => { e.stopPropagation(); lbPrev(); }); on("lightboxNext", "onclick", e => { e.stopPropagation(); lbNext(); }); const lb = $("lightbox"); if (lb) lb.onclick = e => { if (e.target === e.currentTarget) closeLightbox(); }; on("copyFavBtn", "onclick", function() { const t = $("favCopyArea"); if (!t) return; const text = t.textContent; (navigator.clipboard?.writeText ? navigator.clipboard.writeText(text).then(() => { this.textContent = "✅ Скопировано!"; setTimeout(() => this.textContent = "📋 Скопировать артикулы", 2000); }) : Promise.reject()).catch(() => fallbackCopy(text)); }); on("closeFav", "onclick", () => closeModal("favModal")); on("closeLogin", "onclick", () => closeModal("loginModal")); on("closeAdd", "onclick", () => closeModal("addModal")); on("closeEdit", "onclick", () => closeModal("editModal")); on("closeGithub", "onclick", () => closeModal("githubModal")); on("doLogin", "onclick", function() { const err = $("loginErr"); if (err) err.textContent = ""; const u = $("loginUser"), p = $("loginPass"); if (!u || !p) return; if (u.value.trim() === AUTH.user && p.value === AUTH.pass) { isAuthed = true; closeModal("loginModal"); u.value = ""; p.value = ""; updateAuthUI(); render(); } else if (err) err.textContent = "Неверный логин или пароль"; }); on("fImgFile", "onchange", async function() { const files = Array.from(this.files || []); if (!files.length) return; pendingAddImages = pendingAddImages.concat(await compressFiles(files)); renderAddThumbs(); this.value = ""; }); on("doAdd", "onclick", function() { const err = $("addErr"); if (err) err.textContent = ""; const name = $("fName")?.value?.trim() || '', desc = $("fDesc")?.value?.trim() || '', price = $("fPrice")?.value || ''; if (!name && !desc) { if (err) err.textContent = "Укажите название или описание"; return; } if (price === "" || +price < 0) { if (err) err.textContent = "Укажите цену"; return; } loadWatchesSync().push({ category: $("fCategory")?.value || 'men', article: $("fArticle")?.value?.trim() || '', name, desc, price: +price, qty: $("fQty")?.value === "" ? 0 : +$("fQty").value, images: pendingAddImages.slice(), createdAt: new Date().toISOString() }); saveWatches(loadWatchesSync()); closeModal("addModal"); currentPage = Math.ceil(getFilteredWatches().length / ITEMS_PER_PAGE); render(); }); on("eImgFile", "onchange", async function() { const files = Array.from(this.files || []); if (!files.length) return; editNew = editNew.concat(await compressFiles(files)); renderEditNewThumbs(); this.value = ""; }); on("doEdit", "onclick", function() { const err = $("editErr"); if (err) err.textContent = ""; const name = $("eName")?.value?.trim() || '', desc = $("eDesc")?.value?.trim() || '', price = $("ePrice")?.value || ''; if (!name && !desc) { if (err) err.textContent = "Укажите название или описание"; return; } if (price === "" || +price < 0) { if (err) err.textContent = "Укажите цену"; return; } const list = loadWatchesSync(); if (!list[editingIndex]) { if (err) err.textContent = "Карточка не найдена"; return; } list[editingIndex] = { ...list[editingIndex], category: $("eCategory")?.value || 'men', article: $("eArticle")?.value?.trim() || '', name, desc, price: +price, qty: $("eQty")?.value === "" ? 0 : +$("eQty").value, images: editExisting.concat(editNew) }; saveWatches(list); closeModal("editModal"); render(); }); on("saveBtn", "onclick", saveToFile); on("excelBtn", "onclick", downloadExcel); on("uploadExcelBtn", "onclick", uploadExcel); on("excelFileInput", "onchange", handleExcelUpload); on("githubBtn", "onclick", saveToGithub); on("hardResetBtn", "onclick", hardReset); on("hardResetBtn2", "onclick", hardReset); on("saveGithub", "onclick", async function() { const err = $("githubErr"); const u = $("ghUser"), r = $("ghRepo"), t = $("ghToken"), b = $("ghBranch"); if (!u || !r || !t || !b) return; const s = { username: u.value.trim(), repo: r.value.trim(), token: t.value.trim(), branch: b.value.trim() || "main" }; if (!s.username || !s.repo || !s.token) { if (err) err.textContent = "Заполните все поля"; return; } if (!s.token.startsWith('ghp_') && !s.token.startsWith('github_pat_')) { if (err) err.textContent = "Токен должен начинаться с ghp_ или github_pat_"; return; } localStorage.setItem(GH_KEY, JSON.stringify(s)); if (err) err.textContent = ""; closeModal("githubModal"); await saveToGithub(); }); const catMenu = $("categoryMenu"); if (catMenu) catMenu.onclick = function(e) { const btn = e.target.closest(".cat-btn"); if (!btn) return; document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active")); btn.classList.add("active"); currentCategory = btn.getAttribute("data-cat"); currentPage = 1; render(); }; on("applyFilter", "onclick", () => { const min = $("priceMin")?.value || '', max = $("priceMax")?.value || ''; priceFilterMin = min === "" ? null : +min; priceFilterMax = max === "" ? null : +max; currentPage = 1; render(); }); on("resetFilter", "onclick", () => { const mn = $("priceMin"), mx = $("priceMax"); if (mn) mn.value = ""; if (mx) mx.value = ""; priceFilterMin = null; priceFilterMax = null; sortOrder = 'default'; document.querySelectorAll(".sort-btn").forEach(b => b.classList.remove("active")); const def = document.querySelector(".sort-btn[data-sort='default']"); if (def) def.classList.add("active"); currentPage = 1; render(); }); const filterBar = document.querySelector(".filter-bar"); if (filterBar) filterBar.addEventListener("click", function(e) { const btn = e.target.closest(".sort-btn"); if (!btn) return; document.querySelectorAll(".sort-btn").forEach(b => b.classList.remove("active")); btn.classList.add("active"); sortOrder = btn.getAttribute("data-sort"); currentPage = 1; render(); }); const gs = getGhSettings(); if (gs) { const u = $("ghUser"); if (u) u.value = gs.username || ""; const r = $("ghRepo"); if (r) r.value = gs.repo || ""; const t = $("ghToken"); if (t) t.value = gs.token || ""; const b = $("ghBranch"); if (b) b.value = gs.branch || "main"; } setupDragDrop(); setupScrollTop(); setupSearch(); }

// ========== ЗАПУСК ==========
console.log('🚀 TEMPUS KZ v2.0.8 — описание с кнопкой Подробнее');
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { bindEvents(); initApp(); });
else { bindEvents(); initApp(); }
