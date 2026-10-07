// Офлайн-оболочка приложения. VERSION меняйте при каждом выпуске — так очищается старый кэш.
const VERSION = 'v0.5.0';
const SHARE_CACHE = 'share-inbox'; // файлы, пришедшие через «Поделиться»
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'db.js', 'metrics.js', 'extract.js', 'anamnesis.js', 'mailbox.js', 'iddocs.js', 'icd10.json', 'icd10-aliases.json',
  'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
  'dexie.min.js', 'pdf.min.js', 'pdf.worker.min.js', 'mammoth.browser.min.js', 'xlsx.full.min.js',
  'onest-cyrillic-400-normal.woff2', 'onest-cyrillic-500-normal.woff2', 'onest-cyrillic-600-normal.woff2', 'onest-cyrillic-700-normal.woff2'];

// Установка не ломается из-за одного недоступного файла: кэшируем по одному
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== SHARE_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// «Поделиться» → приложение: Android присылает файлы POST-запросом, мы складываем их во временный кэш
async function handleShare(request) {
  const fd = await request.formData();
  const files = fd.getAll('files').filter(f => f && typeof f !== 'string');
  const cache = await caches.open(SHARE_CACHE);
  for (const k of await cache.keys()) await cache.delete(k);
  let i = 0;
  for (const f of files) {
    await cache.put(new URL('__shared/' + (i++), self.registration.scope), new Response(f, {
      headers: { 'content-type': f.type || 'application/octet-stream', 'x-name': encodeURIComponent(f.name || ('файл-' + i)) }
    }));
  }
  return Response.redirect(new URL('./#/upload?shared=' + Date.now(), self.registration.scope).href, 303);
}

// Сначала сеть: при интернете всегда свежая версия. Сохранённая копия — только без сети.
// Крупные библиотеки и шрифты не меняются между версиями — их берём из кэша, чтобы не тратить трафик.
const STATIC = /\.(woff2|png|svg)$|(dexie|pdf|pdf\.worker|mammoth\.browser|xlsx\.full)\.min\.js$/;
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.origin === location.origin && url.pathname.endsWith('/share-target')) {
    e.respondWith(handleShare(e.request));
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // сервер распознавания не трогаем
  if (STATIC.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); return r; })));
    return;
  }
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('index.html')))
  );
});
