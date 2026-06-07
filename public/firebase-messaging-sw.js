// SabanOS Firebase Cloud Messaging Background Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

// Initialize of firebase within service worker scope
firebase.initializeApp({
  apiKey: "AIzaSyAQzXHpiSVBqbU1zXVXtl4tDtEPnqkdeUI",
  authDomain: "saban-ai-drive.firebaseapp.com",
  projectId: "saban-ai-drive",
  storageBucket: "saban-ai-drive.firebasestorage.app",
  messagingSenderId: "516446483197",
  appId: "1:516446483197:web:21fc622f56c4e2a3050494"
});

const messaging = firebase.messaging();

// Handle background push alerts
messaging.onBackgroundMessage((payload) => {
  console.log('[SabanOS SW] Background push notification received:', payload);

  const title = payload.notification?.title || 'סבן הובלות - התראה חדשה 🚛';
  const options = {
    body: payload.notification?.body || 'התקבלה הודעה חדשה במערכת SabanOS.',
    icon: '/assets/icon_192.png',
    badge: '/assets/icon_192.png',
    vibrate: [200, 100, 200],
    data: {
      url: payload.data?.click_action || '/'
    }
  };

  self.registration.showNotification(title, options);
});

// Handle notification click to focus or open corresponding URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
