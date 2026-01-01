// Service Worker - Unregister Script
// This file exists to unregister any stale service workers

self.addEventListener('install', function(event) {
    console.log('Service worker: unregistering...');
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    console.log('Service worker: unregistration complete');
    event.waitUntil(
        self.registration.unregister().then(function() {
            console.log('Service worker: successfully unregistered');
            return self.clients.matchAll();
        }).then(function(clients) {
            clients.forEach(client => client.navigate(client.url));
        })
    );
});
