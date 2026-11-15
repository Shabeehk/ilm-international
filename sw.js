/* ILM International portal — shows the class reminders sent by the academy. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var m = {};
  try { m = e.data ? e.data.json() : {}; } catch (err) { m = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(m.title || 'ILM International', {
    body: m.body || '',
    icon: 'icon-192.png',
    badge: 'icon-badge.png',
    tag: m.tag || 'ilm',
    renotify: true,
    requireInteraction: true,
    data: { url: m.url || 'portal.html' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || 'portal.html';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url === url && 'focus' in list[i]) return list[i].focus();
    }
    return self.clients.openWindow(url);
  }));
});
