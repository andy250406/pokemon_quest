// =======================================================
// 🚀 포켓Tasks PWA 통합 서비스 워커 (v2026.08.27-v2)
// - App Shell 초고속 오프라인 캐싱 (0ms 실행)
// - 자체 백그라운드 퀘스트 정밀 알림 스케줄러 (SW Alarm Engine)
// - 인터랙티브 알림 액션 ([✓ 완료], [✕ 10분 뒤]) 백그라운드 처리
// =======================================================

const CACHE_NAME = 'pokettasks-app-shell-v20260901-v1';
const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './shortcut-add.png',
  './shortcut-quest.png',
  './shortcut-arcade.png',
  './snake_untangle.html',
  './sudoku.html',
  './game_2048.html',
  './minesweeper.html',
  './images/items/poke-ball.png',
  './images/items/great-ball.png',
  './images/items/master-ball.png',
  './images/items/razz-berry.png',
  './images/items/nanab-berry.png',
  './images/items/pinap-berry.png',
  './images/items/silver-pinap.png',
  './images/items/golden-razz.png'
];

const GAS_API_ENDPOINT = "https://script.google.com/macros/s/AKfycbxVbpj0MyIAMzd_c7PcWgx94yoNkFFlQ3kcjnk81BMv7TcRJH3KLNeHIB7lJBepOlAtjw/exec";

// 📦 서비스 워커 설치 & App Shell 사전 캐싱
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL_ASSETS).catch(err => {
        console.warn("[SW] App Shell 일부 캐싱 건너뜀:", err);
      });
    })
  );
});

// 🔄 서비스 워커 활성화 & 이전 구버전 캐시 즉시 정리
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log("[SW] 구버전 캐시 정리:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ⚡ Fetch 전략: App Shell은 Stale-While-Revalidate, 외부 API는 네트워크 직접 통신
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Google Apps Script API 및 외부 API 요청은 네트워크 직접 통신
  if (url.includes('script.google.com') || url.includes('google.com') || url.includes('githubusercontent.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {});

      return cachedResponse || fetchPromise;
    })
  );
});

// =======================================================
// 🔔 자체 백그라운드 퀘스트 알람 스케줄러 (SW Alarm Engine)
// =======================================================

let scheduledQuests = [];
const notifiedTodaySet = new Set();

// 📩 메인 페이지로부터의 메시지 수신
self.addEventListener('message', event => {
  if (!event.data) return;

  // 1) 퀘스트 시간표 동기화
  if (event.data.type === 'SYNC_QUEST_SCHEDULE') {
    scheduledQuests = event.data.quests || [];
    checkAndTriggerDueQuests();
  }
  // 2) 즉시 알림 표시
  else if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, questId, rewardXp, data } = event.data;
    showLocalNotification(title, body, tag, questId, rewardXp, data);
  } 
  // 3) 알림 취소
  else if (event.data.type === 'CANCEL_NOTIFICATION') {
    const tag = event.data.tag;
    self.registration.getNotifications({ tag }).then(notifications => {
      notifications.forEach(n => n.close());
    });
  }
});

// ⏰ 서비스 워커 내부 정밀 시간 감시 엔진 (30초 주기)
setInterval(() => {
  checkAndTriggerDueQuests();
}, 30000);

function checkAndTriggerDueQuests() {
  if (!scheduledQuests || scheduledQuests.length === 0) return;

  const now = new Date();
  // 한국 표준시 기준 시/분
  const kstHours = String((now.getUTCHours() + 9) % 24).padStart(2, '0');
  const kstMinutes = String(now.getUTCMinutes()).padStart(2, '0');
  const currentTime = `${kstHours}:${kstMinutes}`;
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

  scheduledQuests.forEach(q => {
    if (!q.notifyTime || !q.notifyTime.includes(':')) return;

    // 오늘 이미 완료된 퀘스트는 제외
    if (q.isCompletedToday || q.isSingleCompleted) return;

    const notifKey = `${q.id}_${todayStr}_${q.notifyTime}`;

    // 설정된 시간과 현재 시간이 일치하고, 오늘 아직 알림을 안 보낸 경우!
    if (currentTime === q.notifyTime && !notifiedTodaySet.has(notifKey)) {
      notifiedTodaySet.add(notifKey);

      showLocalNotification(
        `⏰ [포켓Tasks] ${q.name}`,
        `'${q.name}' 실천할 시간입니다! 완료하고 포켓몬에게 XP를 선물하세요! 🎁`,
        `quest_${q.id}`,
        q.id,
        q.rewardXp || 20,
        { notifyTime: q.notifyTime }
      );
    }
  });
}

// 🔔 안드로이드 시스템 알림 표시 함수
function showLocalNotification(title, body, tag, questId, rewardXp, extraData = {}) {
  const options = {
    body: body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: tag || ('quest_' + (questId || Date.now())),
    renotify: true,
    requireInteraction: true,
    vibrate: [250, 100, 250, 100, 350],
    data: {
      questId: questId,
      rewardXp: rewardXp || 20,
      url: './index.html',
      timestamp: Date.now(),
      ...extraData
    },
    actions: [
      { action: 'complete', title: '✓ 완료 (+XP)', icon: './icon-192.png' },
      { action: 'later', title: '✕ 10분 뒤', icon: './icon-192.png' }
    ]
  };

  return self.registration.showNotification(title, options);
}

// 🎯 알림 클릭 및 액션 버튼 핸들러
self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  const questId = data.questId;

  notification.close();

  // 1) [✓ 완료] 액션 버튼 클릭 시: 앱을 열지 않고 백그라운드에서 즉시 완료 처리
  if (action === 'complete') {
    event.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        let handledInClient = false;
        for (const client of clients) {
          client.postMessage({
            type: 'NOTIFICATION_ACTION_COMPLETE',
            questId: questId,
            rewardXp: data.rewardXp
          });
          handledInClient = true;
        }

        if (questId && !handledInClient) {
          try {
            await fetch(GAS_API_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ action: 'completeQuest', questId: questId })
            });
          } catch (e) {
            console.warn('[SW] 백그라운드 퀘스트 완료 동기화 지연:', e);
          }
        }
      })()
    );
    return;
  }

  // 2) [✕ 10분 뒤] 액션 버튼 클릭 시: 10분 뒤로 알림 재예약
  if (action === 'later') {
    setTimeout(() => {
      showLocalNotification(
        notification.title,
        `[리마인더] ${notification.body}`,
        notification.tag,
        questId,
        data.rewardXp,
        data
      );
    }, 10 * 60 * 1000);
    return;
  }

  // 3) 알림 본문 클릭 시: 포켓Tasks 앱 창 열기 또는 기존 창 포커스
  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windowClients) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./index.html');
      }
    })()
  );
});
