/**
 * 警校考研助手 — Service Worker
 * 缓存优先策略（Cache-First），确保离线可用
 */

var CACHE_NAME = 'ppsuc-v1';
var STATIC_FILES = [
  './',
  './index.html',
  './css/style.css',
  './manifest.json',
  './js/app.js',
  './js/db.js',
  './js/schools.js',
  './js/countdown.js',
  './js/plans.js',
  './js/notifications.js',
  './js/checkin.js',
  './js/photos.js',
  './assets/badge.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

/* ---- 安装：预缓存所有静态资源 ---- */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      console.log('[SW] 预缓存 ' + STATIC_FILES.length + ' 个文件');
      // 逐个缓存，单个失败不影响整体
      return Promise.allSettled(
        STATIC_FILES.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn('[SW] 缓存失败: ' + url, err);
          });
        })
      );
    })
  );
  // 跳过等待，立即激活
  self.skipWaiting();
});

/* ---- 激活：清理旧缓存 ---- */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  // 立即接管所有页面
  self.clients.claim();
});

/* ---- 请求拦截：缓存优先 ---- */
self.addEventListener('fetch', function (event) {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  // 跳过 IndexedDB 相关请求
  var url = event.request.url;
  if (url.indexOf('chrome-extension') !== -1) return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) {
        // 缓存命中，直接返回
        return cached;
      }

      // 缓存未命中，请求网络并缓存
      return fetch(event.request).then(function (response) {
        // 只缓存成功的响应
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        var cloned = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, cloned);
        });

        return response;
      }).catch(function () {
        // 网络失败，返回离线页面（仅对导航请求）
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        // 其他请求静默失败
      });
    })
  );
});
