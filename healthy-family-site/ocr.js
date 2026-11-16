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
      s.onload = res; s.onerror = () => rej(new Error('Не удалось загрузить распознавание — проверьте интернет. Если включён VPN, выключите его.'));
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
  // Распознать на телефоне и закрасить строки с личными данными.
  // Возвращает текст, распознанный на телефоне, и копию снимка, где ФИО, дата рождения, номера и подписи закрыты чёрным.
  // Строку закрываем целиком по ширине: в шапке бланка в одной строке часто две колонки.
  const PD_LINE = /пациент|ф\.?\s?и\.?\s?о|фамили|отчеств|дата\s+рожд|д\.\s?р\.|возраст|адрес|телефон|тел\.|e-?mail|почта|полис|омс|дмс|снилс|паспорт|карт[аы]|заявк|заказ|№|штрих|врач|выполнил|выдал|провел|подпись|владел|кличка|клиент/i;
  function loadImg(b64) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Не удалось открыть снимок')); im.src = 'data:image/jpeg;base64,' + b64; }); }
  async function analyze(b64, names, onProgress) {
    progressCb = onProgress || null;
    const w = await get();
    const im = await loadImg(b64);
    // мелкий текст распознаётся лучше, если увеличить снимок до ~3400 px по длинной стороне
    const up = Math.min(2.5, Math.max(1, 3400 / Math.max(im.width, im.height)));
    const big = document.createElement('canvas');
    big.width = Math.round(im.width * up); big.height = Math.round(im.height * up);
    const bx = big.getContext('2d'); bx.imageSmoothingQuality = 'high'; bx.drawImage(im, 0, 0, big.width, big.height);
    const { data } = await w.recognize(big, {}, { text: true, blocks: true });
    progressCb = null;
    const lines = data.lines || (data.blocks || []).flatMap(b => (b.paragraphs || []).flatMap(p => p.lines || []));
    // копия для облака — не больше 2400 px, чтобы уложиться в размер запроса
    const out = Math.min(1, 2400 / Math.max(im.width, im.height));
    const c = document.createElement('canvas');
    c.width = Math.round(im.width * out); c.height = Math.round(im.height * out);
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height);
    x.fillStyle = '#000';
    const k = out / up; let hidden = 0;
    const bands = [];
    for (const l of lines) {
      const t = String(l.text || '').trim();
      if (!t || !l.bbox) continue;
      const caps = /[А-ЯЁ]{3,}\s+[А-ЯЁ]{3,}/.test(t), twoNames = /[А-ЯЁ][а-яё]{2,}\s+[А-ЯЁ][а-яё]{2,}\s+[А-ЯЁ][а-яё]{2,}/.test(t);
      const flagged = PD_LINE.test(t) || caps || twoNames || Anon.scrub(t, { names }).removed > 0;
      if (!flagged) continue;
      const hgt = l.bbox.y1 - l.bbox.y0, pad = hgt * 0.35;
      bands.push({ y0: l.bbox.y0 - pad, y1: l.bbox.y1 + pad, h: hgt });
      hidden++;
    }
    // соседние закрашенные строки сливаем: между ними в шапке бланка часто строка, которую распознавание пропустило
    bands.sort((a, b) => a.y0 - b.y0);
    const merged = [];
    for (const bd of bands) {
      const last = merged[merged.length - 1];
      if (last && bd.y0 - last.y1 < Math.max(last.h, bd.h) * 3) { last.y1 = Math.max(last.y1, bd.y1); last.h = Math.max(last.h, bd.h); }
      else merged.push({ ...bd });
    }
    for (const bd of merged) x.fillRect(0, Math.max(0, bd.y0 * k), c.width, (bd.y1 - bd.y0) * k);
    return { text: data.text || '', redacted: c.toDataURL('image/jpeg', 0.85).split(',')[1], hidden };
  }
  async function stop() { if (worker) { const w = worker; worker = null; await w.terminate().catch(() => {}); } }
  return { recognize, analyze, stop, get ready() { return !!worker; } };
})();
