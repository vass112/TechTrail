const CACHE_NAME = 'techtrail-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './morse.js',
    './manifest.json',
    'https://unpkg.com/html5-qrcode',
    'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Share+Tech+Mono&display=swap'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
