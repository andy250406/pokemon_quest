// 🌟 포켓Tasks PWA 서비스 워커 (최신 버전 자동 갱신 및 캐시 버스팅)
const CACHE_NAME = 'pokettasks-pwa-v20260823-3';
const ASSETS_TO_CACHE = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 🌟 네트워크 우선 전략 (Network-First): 최신 HTML/JS 코드를 서버에서 항상 즉시 가져옴
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (event.request.url.includes('script.google.com') || event.request.url.includes('onesignal.com')) {
    return;
  }

  // HTML 문서 및 주요 스크립트는 네트워크 우선
  event.respondWith(
    fetch(event.request)
      .then(response => {
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
