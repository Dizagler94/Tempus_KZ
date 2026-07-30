// sw.js - Service Worker для полного контроля кеша
const CACHE_NAME = 'mdt-watches-v2.1.0';
const ASSETS = [
    '/',
    '/index.html',
    // Добавьте все ваши CSS и JS файлы
];

// Устанавливаем Service Worker
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.delete(CACHE_NAME).then(function () {
            return caches.open(CACHE_NAME).then(function (cache) {
                return cache.addAll(ASSETS);
            });
        })
    );
    self.skipWaiting();
});

// Перехватываем запросы и всегда проверяем наличие обновлений
self.addEventListener('fetch', function (event) {
    event.respondWith(
        caches.match(event.request).then(function (cachedResponse) {
            if (cachedResponse) {
                // Проверяем обновления в фоне
                fetch(event.request).then(function (networkResponse) {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then(function (cache) {
                            cache.put(event.request, networkResponse.clone());
                        });
                    }
                });
                return cachedResponse;
            }
            return fetch(event.request);
        })
    );
});

// Активируем и очищаем старые кеши
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames.map(function (cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});