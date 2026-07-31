// ========== ОЧИСТКА КЕША ==========
(function() {
  const KEY = 'mdt_cache_v13';
  if (localStorage.getItem(KEY) === 'true') return;
  console.log('🧹 v13 — очистка');
  try {
    const favs = localStorage.getItem('mdt_favorites_v1');
    const gh = localStorage.getItem('mdt_github_v13');
    localStorage.clear();
    if (favs) localStorage.setItem('mdt_favorites_v1', favs);
    if (gh) localStorage.setItem('mdt_github_v13', gh);
    localStorage.setItem(KEY, 'true');
  } catch(e) {}
})();

// ========== КОНСТАНТЫ ==========
const AUTH = { user: "anastasia_zy_zy", pass: "anastasia_zy_zy" };
const LS_KEY = "mdt_watches_v2";
const FAV_KEY = "mdt_favorites_v1";
const GH_KEY = "mdt_github_v13";
const DATA_URL = 'data.json';

let canUseStorage = false;
try { localStorage.setItem('__t','1'); localStorage.removeItem('__t'); canUseStorage = true; } catch (e) {}

let isAuthed = false;
let currentCategory = "all";
let priceFilterMin = null, priceFilterMax = null;
let favorites = [];
let catalogData = [];

// ========== ЗАГРУЗКА ДАННЫХ ==========
async function loadDataFromFile() {
  try {
    const r = await fetch(DATA_URL + '?_=' + Date.now());
    if (r.ok) {
      catalogData = migrateData(await r.json());
      if (canUseStorage) localStorage.setItem(LS_KEY, JSON.stringify(catalogData));
      return catalogData;
    }
  } catch (e) {}
  
  if (canUseStorage) {
    try { const ls = localStorage.getItem(LS_KEY); if (ls) { catalogData = migrateData(JSON.parse(ls)); return catalogData; } } catch (e) {}
  }
  
  catalogData = loadFromEmbedded();
  return catalogData;
}

function loadFromEmbedded() {
  try {
    const el = document.getElementById("catalog-data");
    return el ? migrateData(JSON.parse(el.textContent.trim() || "[]")) : [];
  } catch (e) { return []; }
}

function loadWatchesSync() { return catalogData; }

function migrateData(list) {
  return list.map(w => {
    if (!w.images) { w.images = w.img ? [w.img] : []; delete w.img; }
    if (!w.category) w.category = "men";
    if (!w.name) w.name = w.desc || '';
    return w;
  });
}

// ========== ИЗБРАННОЕ ==========
function loadFavorites() {
  if (!canUseStorage) return [];
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]").filter(a => a?.trim()); } catch (e) { return []; }
}

function saveFavorites() {
  favorites = favorites.filter(a => a?.trim());
  if (canUseStorage) localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
  updateFavCount();
}

function updateFavCount() {
  document.querySelectorAll('.fav-count').forEach(el => {
    el.textContent = favorites.length;
    el.style.animation = 'none'; el.offsetHeight; el.style.animation = 'countPop 0.3s ease';
  });
}

function isFav(article) { return article?.trim() ? favorites.includes(article) : false; }

function toggleFav(article) {
  if (!article?.trim()) return;
  const idx = favorites.indexOf(article);
  if (idx >= 0) favorites.splice(idx, 1); else favorites.push(article);
  saveFavorites();
  
  const esc = article.replace(/"/g, '\\"');
  const btn = document.querySelector(`[data-fav="${esc}"]`);
  if (btn) {
    const a = isFav(article);
    btn.classList.toggle('active', a);
    btn.innerHTML = a ? '❤️' : '🤍';
    btn.title = a ? 'Убрать' : 'В избранное';
    btn.classList.remove('animating'); void btn.offsetWidth; btn.classList.add('animating');
  }
  const card = document.querySelector(`[data-article="${esc}"]`);
  if (card) card.classList.toggle('fav-active', isFav(article));
  updateFavCount();
  if (document.getElementById("favModal")?.classList.contains("open")) openFavModal();
}

// ========== СОХРАНЕНИЕ ==========
function saveWatches(list) {
  catalogData = list;
  if (canUseStorage) localStorage.setItem(LS_KEY, JSON.stringify(list));
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
  const r = [];
  for (const f of files) { try { r.push(await compressImage(f)); } catch (e) {} }
  return r;
}

// ========== СОХРАНЕНИЕ В ФАЙЛ ==========
async function saveToFile() {
  try {
    const watches = loadWatchesSync();
    let html = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
    html = html.replace(
      /<script id="catalog-data" type="application\/json">[\s\S]*?<\/script>/,
      `<script id="catalog-data" type="application\/json">${JSON.stringify(watches).replace(/<\//g, "<\\/")}<\/script>`
    );
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "index.html"; a.click();
    URL.revokeObjectURL(url);
    alert("✅ index.html скачан!");
  } catch (e) { alert("Ошибка: " + e.message); }
}

// ========== EXCEL ==========
// ========== EXCEL (КРАСИВЫЙ CSV) ==========
function downloadExcel() {
  const watches = loadWatchesSync();
  
  // Данные для таблицы
  const rows = [];
  
  // Заголовки
  rows.push(['Артикул', 'Название', 'Описание', 'Категория', 'Цена (₸)', 'Количество', 'Наличие']);
  
  // Данные
  watches.forEach(w => {
    const stock = w.qty > 3 ? 'В наличии' : w.qty > 0 ? 'Заканчивается' : 'Нет';
    
    rows.push([
      w.article || '',
      w.name || '',
      w.desc || '',
      w.category === 'women' ? 'Женские' : 'Мужские',
      w.price || 0,
      w.qty || 0,
      stock
    ]);
  });
  
  // Создаём XML для Excel (формат SpreadsheetML)
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  
  // Стили
  xml += '<Styles>\n';
  xml += '  <Style ss:ID="Header">\n';
  xml += '    <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>\n';
  xml += '    <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2"/></Borders>\n';
  xml += '    <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#1a1a1a"/>\n';
  xml += '    <Interior ss:Color="#d4af37" ss:Pattern="Solid"/>\n';
  xml += '  </Style>\n';
  xml += '  <Style ss:ID="Normal">\n';
  xml += '    <Alignment ss:Vertical="Center" ss:WrapText="1"/>\n';
  xml += '    <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e0e0e0"/></Borders>\n';
  xml += '    <Font ss:FontName="Calibri" ss:Size="11"/>\n';
  xml += '  </Style>\n';
  xml += '  <Style ss:ID="Price">\n';
  xml += '    <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>\n';
  xml += '    <NumberFormat ss:Format="#,##0"/>\n';
  xml += '    <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>\n';
  xml += '  </Style>\n';
  xml += '  <Style ss:ID="Center">\n';
  xml += '    <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>\n';
  xml += '    <Font ss:FontName="Calibri" ss:Size="11"/>\n';
  xml += '  </Style>\n';
  xml += '  <Style ss:ID="InStock">\n';
  xml += '    <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>\n';
  xml += '    <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#2ecc71"/>\n';
  xml += '  </Style>\n';
  xml += '  <Style ss:ID="LowStock">\n';
  xml += '    <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>\n';
  xml += '    <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#e6b85c"/>\n';
  xml += '  </Style>\n';
  xml += '  <Style ss:ID="OutStock">\n';
  xml += '    <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>\n';
  xml += '    <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#e74c3c"/>\n';
  xml += '  </Style>\n';
  xml += '</Styles>\n';
  
  // Лист
  xml += '<Worksheet ss:Name="Каталог часов">\n';
  xml += '<Table>\n';
  
  // Колонки с шириной
  xml += '<Column ss:Width="120"/>\n';  // Артикул
  xml += '<Column ss:Width="200"/>\n';  // Название
  xml += '<Column ss:Width="350"/>\n';  // Описание
  xml += '<Column ss:Width="100"/>\n';  // Категория
  xml += '<Column ss:Width="120"/>\n';  // Цена
  xml += '<Column ss:Width="80"/>\n';   // Количество
  xml += '<Column ss:Width="120"/>\n';  // Наличие
  
  rows.forEach((row, rowIdx) => {
    xml += '<Row>\n';
    row.forEach((cell, colIdx) => {
      let style = 'Normal';
      
      if (rowIdx === 0) {
        style = 'Header';
      } else if (colIdx === 4) {
        style = 'Price';
      } else if (colIdx === 3 || colIdx === 5) {
        style = 'Center';
      } else if (colIdx === 6) {
        if (cell === 'В наличии') style = 'InStock';
        else if (cell === 'Заканчивается') style = 'LowStock';
        else style = 'OutStock';
      }
      
      // Экранируем XML
      const safeCell = String(cell).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      
      if (rowIdx === 0) {
        xml += `<Cell ss:StyleID="${style}"><Data ss:Type="String">${safeCell}</Data></Cell>\n`;
      } else if (colIdx === 4) {
        xml += `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${cell}</Data></Cell>\n`;
      } else if (colIdx === 5) {
        xml += `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${cell}</Data></Cell>\n`;
      } else {
        xml += `<Cell ss:StyleID="${style}"><Data ss:Type="String">${safeCell}</Data></Cell>\n`;
      }
    });
    xml += '</Row>\n';
  });
  
  xml += '</Table>\n';
  xml += '</Worksheet>\n';
  xml += '</Workbook>';
  
  // Сохраняем как .xls (Excel откроет)
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tempus_kz_catalog.xls';
  a.click();
  URL.revokeObjectURL(url);
}

// ========== GITHUB ==========
function getGhSettings() {
  try { const s = localStorage.getItem(GH_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}

async function pushToGh(path, content) {
  const s = getGhSettings();
  if (!s?.token?.trim()) throw new Error('Настройте GitHub');
  
  const token = s.token.trim();
  const apiUrl = `https://api.github.com/repos/${s.username}/${s.repo}/contents/${path}`;
  const encoded = btoa(unescape(encodeURIComponent(content)));
  
  let sha = null;
  try {
    const r = await fetch(apiUrl + '?ref=' + (s.branch || 'main'), {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json', 'X-GitHub-Api-Version': '2022-11-28' }
    });
    if (r.ok) sha = (await r.json()).sha;
    else if (r.status === 401) throw new Error('Неверный токен');
  } catch (e) { if (e.message === 'Неверный токен') throw e; }
  
  const body = { message: `Update ${path}`, content: encoded, branch: s.branch || 'main' };
  if (sha) body.sha = sha;
  
  const r = await fetch(apiUrl, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify(body)
  });
  
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    if (r.status === 401) throw new Error('Неверный токен. Создайте новый с правами repo.');
    throw new Error(err.message || 'HTTP ' + r.status);
  }
}

async function saveToGithub() {
  const s = getGhSettings();
  if (!s?.token?.trim()) { openModal("githubModal"); return; }
  
  try {
    const watches = loadWatchesSync();
    let html = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
    html = html.replace(
      /<script id="catalog-data" type="application\/json">[\s\S]*?<\/script>/,
      `<script id="catalog-data" type="application\/json">${JSON.stringify(watches).replace(/<\//g, "<\\/")}<\/script>`
    );
    
    await pushToGh('data.json', JSON.stringify(watches, null, 2));
    await pushToGh('index.html', html);
    alert('✅ Сохранено на GitHub!\n\nhttps://' + s.username + '.github.io/' + s.repo + '/');
  } catch (e) { alert('❌ ' + e.message); }
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
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f5d98a"/><stop offset="100%" stop-color="#d4af37"/></linearGradient></defs><circle cx="50" cy="50" r="28" fill="none" stroke="url(#g)" stroke-width="2.5"/><circle cx="50" cy="50" r="22" fill="none" stroke="url(#g)" stroke-width="1" opacity=".6"/><line x1="50" y1="50" x2="50" y2="34" stroke="url(#g)" stroke-width="2" stroke-linecap="round"/><line x1="50" y1="50" x2="62" y2="50" stroke="url(#g)" stroke-width="2" stroke-linecap="round"/></svg>`;
}

function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function getFilteredWatches() {
  let w = loadWatchesSync();
  if (currentCategory !== "all") w = w.filter(x => x.category === currentCategory);
  if (priceFilterMin !== null) w = w.filter(x => x.price >= priceFilterMin);
  if (priceFilterMax !== null) w = w.filter(x => x.price <= priceFilterMax);
  return w;
}

// ========== ЛАЙТБОКС ==========
let lbImages=[], lbIdx=0, lbArticle="", lbPrice="";

function openLightbox(images, article, price, startIdx) {
  if (!images?.length) return;
  lbImages=images; lbIdx=startIdx||0; lbArticle=article||""; lbPrice=price||"";
  renderLightbox();
  document.getElementById("lightbox").classList.add("open");
  document.body.style.overflow="hidden";
}

function closeLightbox() {
  document.getElementById("lightbox").classList.remove("open");
  document.body.style.overflow="";
}

function renderLightbox() {
  document.getElementById("lightboxImg").src=lbImages[lbIdx];
  document.getElementById("lightboxArticle").textContent=lbArticle?"Артикул: "+lbArticle:"";
  document.getElementById("lightboxPrice").textContent=lbPrice;
  const dots=document.getElementById("lightboxDots");
  if(lbImages.length>1){
    dots.innerHTML=lbImages.map((_,k)=>`<button class="lightbox-dot${k===lbIdx?' active':''}" data-k="${k}"></button>`).join("");
    dots.style.display="flex";
    document.getElementById("lightboxPrev").style.display="flex";
    document.getElementById("lightboxNext").style.display="flex";
    dots.querySelectorAll(".lightbox-dot").forEach(d=>d.onclick=()=>{lbIdx=+d.getAttribute("data-k");renderLightbox();});
  }else{
    dots.style.display="none";
    document.getElementById("lightboxPrev").style.display="none";
    document.getElementById("lightboxNext").style.display="none";
  }
}

function lbPrev(){lbIdx=(lbIdx-1+lbImages.length)%lbImages.length;renderLightbox();}
function lbNext(){lbIdx=(lbIdx+1)%lbImages.length;renderLightbox();}

// ========== МОДАЛКИ ==========
function openModal(id){document.getElementById(id)?.classList.add("open");}
function closeModal(id){document.getElementById(id)?.classList.remove("open");}

// ========== ИЗБРАННОЕ МОДАЛКА ==========
function openFavModal(){
  const list=document.getElementById("favList"),copyArea=document.getElementById("favCopyArea"),copyBtn=document.getElementById("copyFavBtn");
  const all=loadWatchesSync();
  if(!favorites.length){
    list.innerHTML='<div class="empty-fav">Список пуст.<br>Нажмите ❤️ на карточке.</div>';
    copyArea.style.display="none";copyBtn.style.display="none";
    openModal("favModal");return;
  }
  let html="",arts=[];
  favorites.forEach(article=>{
    const w=all.find(x=>x.article===article);
    if(w){
      arts.push(w.article);
      const img=w.images?.[0]?`<img src="${w.images[0]}" alt="">`:placeholderSVG();
      html+=`<div class="fav-item"><div class="fav-item-img">${img}</div><div class="fav-item-info"><div class="fav-item-article">${escapeHtml(w.article)}</div><div class="fav-item-desc">${escapeHtml(w.name||w.desc)}</div><div class="fav-item-price">${fmtPrice(w.price)}</div></div><button class="fav-remove" data-article="${escapeHtml(w.article)}">×</button></div>`;
    }
  });
  list.innerHTML=html;
  copyArea.textContent=arts.join(", ");
  copyArea.style.display="block";copyBtn.style.display="inline-block";
  list.querySelectorAll(".fav-remove").forEach(b=>b.onclick=()=>toggleFav(b.getAttribute("data-article")));
  openModal("favModal");
}

function fallbackCopy(text){
  const ta=document.createElement("textarea");
  ta.value=text;ta.style.cssText="position:fixed;left:-9999px";
  document.body.appendChild(ta);ta.select();
  try{document.execCommand("copy");}catch(e){}
  document.body.removeChild(ta);
  const btn=document.getElementById("copyFavBtn");
  if(btn){btn.textContent="✅ Скопировано!";setTimeout(()=>btn.textContent="📋 Скопировать артикулы",2000);}
}

// ========== РЕНДЕР ==========
async function render(){
  const grid=document.getElementById("grid");
  if(!grid)return;
  if(!catalogData.length)await loadDataFromFile();
  
  const watches=getFilteredWatches(),all=loadWatchesSync();
  document.body.classList.toggle("authed",isAuthed);
  
  const info=document.getElementById("resultsInfo");
  if(info)info.innerHTML=(currentCategory!=="all"||priceFilterMin!==null||priceFilterMax!==null)?`Найдено: <b>${watches.length}</b> из <b>${all.length}</b>`:"";
  
  if(!watches.length){grid.innerHTML='<div class="empty">Ничего не найдено.</div>';return;}
  
  let html='';
  watches.forEach((w,i)=>{
    const s=stockInfo(w.qty),images=w.images||[],multi=images.length>1;
    const article=w.article||"",favActive=isFav(article);
    const sc=images.length?images.map(src=>`<div class="slide"><img src="${src}" alt="" draggable="false"></div>`).join(""):`<div class="placeholder">${placeholderSVG()}</div>`;
    const dots=multi?`<div class="slider-dots">${images.map((_,k)=>`<button class="slider-dot${k===0?' active':''}" data-k="${k}"></button>`).join("")}</div>`:"";
    const arrows=multi?`<button class="slider-arrow prev" data-dir="-1">‹</button><button class="slider-arrow next" data-dir="1">›</button>`:"";
    
    html+=`<article class="card${favActive?' fav-active':''}" data-article="${escapeHtml(article)}">
      <button class="fav-btn${favActive?' active':''}" data-fav="${escapeHtml(article)}">${favActive?'❤️':'🤍'}</button>
      <div class="card-actions"><button class="icon-btn edit" data-edit-article="${escapeHtml(article)}">✎</button><button class="icon-btn del" data-del-article="${escapeHtml(article)}">✕</button></div>
      <div class="slider${multi?' has-multi':''}" data-slider="${i}"><div class="slides">${sc}</div>${arrows}${dots}</div>
      <div class="body">
        ${article?`<div class="article">Артикул: ${escapeHtml(article)}</div>`:''}
        ${w.name?`<p class="name">${escapeHtml(w.name)}</p>`:''}
        <p class="desc">${escapeHtml(w.desc)}</p>
        <div class="price-wrap">
          <div class="price">${fmtPrice(w.price)}</div>
          <div class="stock ${s.cls}">${s.text}</div>
        </div>
      </div>
    </article>`;
  });
  
  grid.innerHTML=html;
  initSliders();
  initCardEvents();
  updateFooter();
  updateFavCount();
}

function updateFooter(){
  const f=document.getElementById("mainFooter");
  if(!f)return;
  f.innerHTML='© 2026 TEMPUS KZ · Оффлайн-каталог';
}

// ========== КАРТОЧКИ ==========
function initCardEvents(){
  document.querySelectorAll(".card").forEach(card=>{
    card.onclick=function(e){
      if(e.target.closest(".fav-btn,.icon-btn,.slider-arrow,.slider-dot"))return;
      const w=loadWatchesSync().find(w=>w.article===this.getAttribute("data-article"));
      if(w?.images?.length)openLightbox(w.images,w.article,fmtPrice(w.price),0);
    };
  });
  document.querySelectorAll(".fav-btn").forEach(b=>b.onclick=function(e){e.stopPropagation();e.preventDefault();toggleFav(this.getAttribute("data-fav"));return false;});
  document.querySelectorAll("[data-edit-article]").forEach(b=>b.onclick=function(e){e.stopPropagation();const i=loadWatchesSync().findIndex(w=>w.article===this.getAttribute("data-edit-article"));if(i>=0)openEdit(i);});
  document.querySelectorAll("[data-del-article]").forEach(b=>b.onclick=function(e){e.stopPropagation();if(confirm("Удалить?")){const list=loadWatchesSync();const i=list.findIndex(w=>w.article===this.getAttribute("data-del-article"));if(i>=0){list.splice(i,1);saveWatches(list);render();}}});
}

// ========== СЛАЙДЕРЫ ==========
function initSliders(){
  document.querySelectorAll("[data-slider]").forEach(slider=>{
    const slides=slider.querySelector(".slides"),dots=slider.querySelectorAll(".slider-dot"),arrows=slider.querySelectorAll(".slider-arrow");
    if(!slides||slides.children.length<2)return;
    const total=slides.children.length;
    let idx=0;
    const go=n=>{idx=(n+total)%total;if(idx<0)idx=total-1;slides.style.transform=`translateX(-${idx*100}%)`;dots.forEach((d,k)=>d.classList.toggle("active",k===idx));};
    arrows.forEach(a=>a.onclick=e=>{e.stopPropagation();go(idx+parseInt(a.getAttribute("data-dir")));});
    dots.forEach((d,j)=>d.onclick=e=>{e.stopPropagation();go(j);});
    let sx=0,dx=0,dragging=false;
    slides.addEventListener("touchstart",e=>{sx=e.touches[0].clientX;dx=0;dragging=true;slides.style.transition="none";},{passive:true});
    slides.addEventListener("touchmove",e=>{if(!dragging)return;dx=e.touches[0].clientX-sx;slides.style.transform=`translateX(${-idx*slides.offsetWidth+dx}px)`;},{passive:true});
    slides.addEventListener("touchend",()=>{if(!dragging)return;dragging=false;slides.style.transition="transform 0.3s ease-out";if(dx<-slides.offsetWidth*0.2)go(idx+1);else if(dx>slides.offsetWidth*0.2)go(idx-1);else go(idx);},{passive:true});
  });
}

// ========== АВТОРИЗАЦИЯ ==========
function updateAuthUI(){
  const area=document.getElementById("authArea");
  if(!area)return;
  
  if(isAuthed){
    area.innerHTML=`
      <button class="btn btn-fav" id="favBtnAuthed">❤️ Избранное<span class="fav-count">${favorites.length}</span></button>
      <button class="btn btn-gold" id="addBtn">+ Добавить</button>
      <button class="btn btn-gold" id="githubBtnTop">🚀 На GitHub</button>
      <button class="btn" id="excelBtnTop">📥 Excel</button>
      <button class="btn" id="saveBtnTop">💾 HTML</button>
      <button class="btn" id="logoutBtn">Выйти</button>`;
    
    document.getElementById("addBtn").onclick=openAddModal;
    document.getElementById("githubBtnTop").onclick=saveToGithub;
    document.getElementById("excelBtnTop").onclick=downloadExcel;
    document.getElementById("saveBtnTop").onclick=saveToFile;
    document.getElementById("logoutBtn").onclick=()=>{isAuthed=false;updateAuthUI();render();};
    document.getElementById("favBtnAuthed").onclick=openFavModal;
    
    // Показываем баннер
    document.getElementById("saveBanner").style.display="block";
  }else{
    area.innerHTML=`
      <button class="btn btn-fav" id="favBtnGuest">❤️ Избранное<span class="fav-count">${favorites.length}</span></button>
      <button class="btn" id="loginBtn">Войти</button>`;
    document.getElementById("loginBtn").onclick=()=>openModal("loginModal");
    document.getElementById("favBtnGuest").onclick=openFavModal;
    document.getElementById("saveBanner").style.display="none";
  }
}

// ========== ДОБАВЛЕНИЕ/РЕДАКТИРОВАНИЕ ==========
let pendingAddImages=[];

function openAddModal(){
  pendingAddImages=[];
  document.getElementById("fCategory").value="men";
  "fArticle fName fDesc fPrice fQty fImgFile".split(" ").forEach(id=>document.getElementById(id).value="");
  document.getElementById("addErr").textContent="";
  renderAddThumbs();
  openModal("addModal");
}

function renderAddThumbs(){
  const box=document.getElementById("addThumbs");
  if(!box)return;
  box.innerHTML=pendingAddImages.map((s,k)=>`<div class="thumb-item"><img src="${s}"><button class="thumb-remove" data-k="${k}">×</button></div>`).join("");
  box.querySelectorAll(".thumb-remove").forEach(b=>b.onclick=()=>{pendingAddImages.splice(+b.getAttribute("data-k"),1);renderAddThumbs();});
}

let editingIndex=-1,editExisting=[],editNew=[];

function openEdit(i){
  const w=loadWatchesSync()[i];
  if(!w)return;
  editingIndex=i;editExisting=(w.images||[]).slice();editNew=[];
  document.getElementById("eCategory").value=w.category||"men";
  document.getElementById("eArticle").value=w.article||"";
  document.getElementById("eName").value=w.name||"";
  document.getElementById("eDesc").value=w.desc||"";
  document.getElementById("ePrice").value=w.price;
  document.getElementById("eQty").value=w.qty;
  document.getElementById("eImgFile").value="";
  document.getElementById("editErr").textContent="";
  renderEditThumbs();renderEditNewThumbs();
  openModal("editModal");
}

function renderEditThumbs(){
  const box=document.getElementById("editThumbs");
  if(!box)return;
  if(!editExisting.length){box.innerHTML='<div style="color:#8a8a94;font-size:12px">Нет фото</div>';return;}
  box.innerHTML=editExisting.map((s,k)=>`<div class="thumb-item"><img src="${s}"><button class="thumb-remove" data-k="${k}">×</button></div>`).join("");
  box.querySelectorAll(".thumb-remove").forEach(b=>b.onclick=()=>{editExisting.splice(+b.getAttribute("data-k"),1);renderEditThumbs();});
}

function renderEditNewThumbs(){
  const box=document.getElementById("editNewThumbs");
  if(!box)return;
  box.innerHTML=editNew.map((s,k)=>`<div class="thumb-item"><img src="${s}"><button class="thumb-remove" data-k="${k}">×</button></div>`).join("");
  box.querySelectorAll(".thumb-remove").forEach(b=>b.onclick=()=>{editNew.splice(+b.getAttribute("data-k"),1);renderEditNewThumbs();});
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
async function initApp(){
  isAuthed=false;
  favorites=loadFavorites();
  saveFavorites();
  updateAuthUI();
  await render();
}

// ========== ОБРАБОТЧИКИ ==========
function bindEvents(){
  document.getElementById("lightboxClose").onclick=closeLightbox;
  document.getElementById("lightboxPrev").onclick=e=>{e.stopPropagation();lbPrev();};
  document.getElementById("lightboxNext").onclick=e=>{e.stopPropagation();lbNext();};
  document.getElementById("lightbox").onclick=e=>{if(e.target===e.currentTarget)closeLightbox();};
  
  document.getElementById("copyFavBtn").onclick=function(){
    const t=document.getElementById("favCopyArea").textContent;
    (navigator.clipboard?.writeText?navigator.clipboard.writeText(t).then(()=>{this.textContent="✅ Скопировано!";setTimeout(()=>this.textContent="📋 Скопировать артикулы",2000);}):Promise.reject()).catch(()=>fallbackCopy(t));
  };
  
  document.getElementById("closeFav").onclick=()=>closeModal("favModal");
  document.getElementById("closeLogin").onclick=()=>closeModal("loginModal");
  document.getElementById("closeAdd").onclick=()=>closeModal("addModal");
  document.getElementById("closeEdit").onclick=()=>closeModal("editModal");
  document.getElementById("closeGithub").onclick=()=>closeModal("githubModal");
  
  document.getElementById("doLogin").onclick=function(){
    const err=document.getElementById("loginErr");err.textContent="";
    if(document.getElementById("loginUser").value.trim()===AUTH.user&&document.getElementById("loginPass").value===AUTH.pass){
      isAuthed=true;
      closeModal("loginModal");
      document.getElementById("loginUser").value="";
      document.getElementById("loginPass").value="";
      updateAuthUI();render();
    }else err.textContent="Неверный логин или пароль";
  };
  
  document.getElementById("fImgFile").onchange=async function(){
    const files=Array.from(this.files||[]);if(!files.length)return;
    pendingAddImages=pendingAddImages.concat(await compressFiles(files));
    renderAddThumbs();this.value="";
  };
  
  document.getElementById("doAdd").onclick=function(){
    const err=document.getElementById("addErr");err.textContent="";
    const name=document.getElementById("fName").value.trim();
    const desc=document.getElementById("fDesc").value.trim();
    const price=document.getElementById("fPrice").value;
    if(!name&&!desc){err.textContent="Укажите название или описание";return;}
    if(price===""||+price<0){err.textContent="Укажите цену";return;}
    loadWatchesSync().push({
      category:document.getElementById("fCategory").value,
      article:document.getElementById("fArticle").value.trim(),
      name,desc,price:+price,
      qty:document.getElementById("fQty").value===""?0:+document.getElementById("fQty").value,
      images:pendingAddImages.slice()
    });
    saveWatches(loadWatchesSync());closeModal("addModal");render();
  };
  
  document.getElementById("eImgFile").onchange=async function(){
    const files=Array.from(this.files||[]);if(!files.length)return;
    editNew=editNew.concat(await compressFiles(files));
    renderEditNewThumbs();this.value="";
  };
  
  document.getElementById("doEdit").onclick=function(){
    const err=document.getElementById("editErr");err.textContent="";
    const name=document.getElementById("eName").value.trim();
    const desc=document.getElementById("eDesc").value.trim();
    const price=document.getElementById("ePrice").value;
    if(!name&&!desc){err.textContent="Укажите название или описание";return;}
    if(price===""||+price<0){err.textContent="Укажите цену";return;}
    const list=loadWatchesSync();
    if(!list[editingIndex]){err.textContent="Карточка не найдена";return;}
    list[editingIndex]={...list[editingIndex],category:document.getElementById("eCategory").value,article:document.getElementById("eArticle").value.trim(),name,desc,price:+price,qty:document.getElementById("eQty").value===""?0:+document.getElementById("eQty").value,images:editExisting.concat(editNew)};
    saveWatches(list);closeModal("editModal");render();
  };
  
  document.getElementById("saveBtn").onclick=saveToFile;
  document.getElementById("excelBtn").onclick=downloadExcel;
  document.getElementById("githubBtn").onclick=saveToGithub;
  
  document.getElementById("saveGithub").onclick=async function(){
    const err=document.getElementById("githubErr");
    const settings={
      username:document.getElementById("ghUser").value.trim(),
      repo:document.getElementById("ghRepo").value.trim(),
      token:document.getElementById("ghToken").value.trim(),
      branch:document.getElementById("ghBranch").value.trim()||"main"
    };
    
    if(!settings.username||!settings.repo||!settings.token){err.textContent="Заполните все поля";return;}
    if(!settings.token.startsWith('ghp_')&&!settings.token.startsWith('github_pat_')){err.textContent="Токен должен начинаться с ghp_ или github_pat_";return;}
    
    localStorage.setItem(GH_KEY,JSON.stringify(settings));
    err.textContent="";
    closeModal("githubModal");
    await saveToGithub();
  };
  
  document.getElementById("categoryMenu").onclick=function(e){
    const btn=e.target.closest(".cat-btn");if(!btn)return;
    document.querySelectorAll(".cat-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");currentCategory=btn.getAttribute("data-cat");render();
  };
  
  document.getElementById("applyFilter").onclick=()=>{
    const min=document.getElementById("priceMin").value,max=document.getElementById("priceMax").value;
    priceFilterMin=min===""?null:+min;priceFilterMax=max===""?null:+max;render();
  };
  
  document.getElementById("resetFilter").onclick=()=>{
    document.getElementById("priceMin").value="";document.getElementById("priceMax").value="";
    priceFilterMin=null;priceFilterMax=null;render();
  };
  
  const gs=getGhSettings();
  if(gs){
    document.getElementById("ghUser").value=gs.username||"";
    document.getElementById("ghRepo").value=gs.repo||"";
    document.getElementById("ghToken").value=gs.token||"";
    document.getElementById("ghBranch").value=gs.branch||"main";
  }
}

// ========== ЗАПУСК ==========
console.log('🚀 TEMPUS KZ v13 — Excel + цена прибита к низу');
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{bindEvents();initApp();});
else{bindEvents();initApp();}
