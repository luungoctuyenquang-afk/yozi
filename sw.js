// Service Worker - 强制更新 + WorldBook缓存
const CACHE_NAME = 'worldbook-v1';
const urlsToCache = [
    'public/worldbook/index.global.js',
    'public/worldbook/index.mjs',
    'public/worldbook/samples/travel.worldbook.json',
    'js/worldbook.integration.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching WorldBook files');
                return cache.addAll(urlsToCache);
            })
            .catch(err => {
                console.warn('[SW] Cache failed:', err);
            })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // 保留 WorldBook 缓存，删除其他旧缓存
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 添加 fetch 事件处理，优先使用缓存
self.addEventListener('fetch', event => {
    if (event.request.url.includes('/worldbook/')) {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    // 如果缓存中有，返回缓存
                    if (response) {
                        return response;
                    }
                    // 否则从网络获取
                    return fetch(event.request);
                })
        );
    }
});
