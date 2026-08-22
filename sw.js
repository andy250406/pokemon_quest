// 🌟 포켓Tasks PWA 서비스 워커 (크로미움 & 삼성 인터넷 PWA 설치 필수 요구조건 충족)
const CACHE_NAME = 'pokettasks-pwa-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './snake_untangle.html',
  './sudoku.html',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// 🌟 크로미움 / 삼성 인터넷 PWA 설치 검증 핵심 필수 조건: fetch 핸들러
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Google Apps Script API 요청은 네트워크 직접 통신
  if (event.request.url.includes('script.google.com') || event.request.url.includes('onesignal.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
