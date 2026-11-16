// Распознавание фото и сканов прямо на телефоне (Tesseract, русский + латиница).
// Снимок никуда не отправляется: из него получается текст, текст обезличивается, и только потом уходит в ИИ.
// Файлы движка и словарей (~11 МБ) скачиваются один раз при первом распознавании и дальше лежат в телефоне.
const LocalOCR = (() => {
  let worker = null, loading = null, progressCb = null;
  const base = () => new URL('./', location.href).href;
  function loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[data-src="${src}"]`)) return res();
      const s = document.createElement('script'); s.src = src; s.dataset.src = src;
      s.onload = res; s.onerror = () => rej(new Error('Не удалось загрузить распознавание — проверьте интернет'));
      document.head.appendChild(s);
    });
  }
  async function get() {
    if (worker) return worker;
    if (loading) return loading;
    loading = (async () => {
      await loadScript('tesseract.min.js');
      const w = await Tesseract.createWorker(['rus', 'eng'], 1, {
        workerPath: base() + 'worker.min.js',
        corePath: base(),
        langPath: base(),
        gzip: true,
        logger: m => { if (progressCb && m.status) progressCb(m); }
      });
      await w.setParameters({ preserve_interword_spaces: '1' });
      worker = w; return w;
    })();
    try { return await loading; } finally { loading = null; }
  }
  // b64 — JPEG без префикса data:
  async function recognize(b64, onProgress) {
    progressCb = onProgress || null;
    const w = await get();
    const { data } = await w.recognize('data:image/jpeg;base64,' + b64);
    progressCb = null;
    return (data && data.text) || '';
  }
  async function stop() { if (worker) { const w = worker; worker = null; await w.terminate().catch(() => {}); } }
  return { recognize, stop, get ready() { return !!worker; } };
})();
