/* Service worker · CDSS Hernia inguinal del prematuro
   Estrategia: la app (index.html) se sirve desde caché al instante y se actualiza en segundo plano.
   Así abre sin conexión y nunca se queda "cargando" esperando la red.
   Al publicar una versión nueva, cambia VERSION. */
const VERSION = 'hernia-prem-v1.0';
const SHELL = ['./', './index.html'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION).then(cache =>
      Promise.all(SHELL.map(url =>
        fetch(url, { cache: 'reload' })
          .then(res => { if (res.ok) return cache.put(url, res); })
          .catch(() => {})
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function refresh(request, cache, key) {
  return fetch(request)
    .then(res => {
      if (res && res.ok && res.type === 'basic') cache.put(key || request, res.clone());
      return res;
    })
    .catch(() => null);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navegación: caché primero (index.html), red en segundo plano
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = (await cache.match(req, { ignoreSearch: true })) ||
                     (await cache.match('./index.html')) ||
                     (await cache.match('./'));
      const update = refresh(req, cache, './index.html');
      if (cached) { event.waitUntil(update); return cached; }
      const net = await update;
      return net || new Response(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
        '<body style="background:#0a0c26;color:#eef0ff;font-family:-apple-system,sans-serif;padding:40px;text-align:center">' +
        '<h2>Sin conexión</h2><p>Abre la app una vez con internet para guardarla en el dispositivo.</p></body>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    })());
    return;
  }

  // Resto de archivos del mismo origen: caché primero, luego red
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) { event.waitUntil(refresh(req, cache)); return cached; }
    const net = await refresh(req, cache);
    return net || Response.error();
  })());
});
