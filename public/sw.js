// Service worker de la app instalable (iPhone, Android y escritorio).
// La página siempre se pide a la red para recibir la versión nueva; si no hay conexión
// se usa la copia guardada. Los archivos de /assets llevan huella en el nombre, así que
// se guardan una vez y no cambian. Las llamadas a Supabase no pasan por aquí.

const CACHE = 'rendercrz-v1';
// la copia guardada sirve aunque la petición traiga otras cabeceras (Vary: Origin, Accept-Encoding…)
const ANY = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/')));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// archivos que la página ya había descargado antes de que este service worker tomara el control
self.addEventListener('message', (event) => {
  const files = event.data && event.data.cache;
  if (!Array.isArray(files)) return;
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        files.map(async (url) => {
          if (await cache.match(url, ANY)) return;
          try {
            const response = await fetch(url);
            if (response.ok) await cache.put(url, response);
          } catch {
            /* se guardará en la próxima visita */
          }
        }),
      ),
    ),
  );
});

async function fromNetwork(request, fallbackUrl) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(fallbackUrl ?? request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(fallbackUrl ?? request, ANY);
    if (cached) return cached;
    throw error;
  }
}

async function fromCache(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, ANY);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // cualquier pantalla de la app (incluidas las ligas /v/...) es la misma página
  if (request.mode === 'navigate') {
    event.respondWith(fromNetwork(request, '/'));
    return;
  }
  event.respondWith(url.pathname.startsWith('/assets/') ? fromCache(request) : fromNetwork(request));
});
