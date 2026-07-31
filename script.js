// ========== МИНИМАЛЬНАЯ ОЧИСТКА КЕША ==========
(function() {
  const CACHE_CLEARED_KEY = 'mdt_cache_cleared_v3';
  if (localStorage.getItem(CACHE_CLEARED_KEY) === 'true') return;
  
  console.log('🧹 Очистка кеша...');
  try {
    const favs = localStorage.getItem('mdt_favorites_v1');
    const github = localStorage.getItem('mdt_github_settings');
    localStorage.clear();
    if (favs) localStorage.setItem('mdt_favorites_v1', favs);
    if (github) localStorage.setItem('mdt_github_settings', github);
    localStorage.setItem(CACHE_CLEARED_KEY, 'true');
    console.log('✅ Кеш очищен');
  } catch(e) {
    console.warn('Ошибка очистки:', e);
  }
})();

// ========== КОНСТАНТЫ ==========
const AUTH = { user: "anastasia_zy_zy", pass: "anastasia_zy_zy" };
const LS_KEY = "mdt_watches_v2";
const FAV_KEY = "mdt_favorites_v1";
const GITHUB_KEY = "mdt_github_settings";
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
      if (canUseStorage) {
        localStorage.setItem(LS_KEY, JSON.stringify(catalogData));
      }
      return catalogData;
    }
  } catch (e) {
    console.warn('⚠️ data.json не загружен, использую localStorage');
  }
  
  if (canUseStorage) {
    try {
      const ls = localStorage.getItem(LS_KEY);
      if (ls) {
        catalogData = migrateData(JSON.parse(ls));
        return catalogData;
      }
    } catch (e) {}
  }
  
  catalogData = loadFromEmbedded();
  return catalogData;
}

function loadFromEmbedded() {
 
