// Разбор файлов на телефоне. В облако уходит только то, что нельзя прочитать локально (фото и сканы).
const Extract = (() => {
  const loaded = {};
  function loadScript(src) {
    if (!loaded[src]) loaded[src] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Не удалось загрузить ' + src));
      document.head.appendChild(s);
    });
    return loaded[src];
  }


  function kindOf(file) {
    const n = file.name.toLowerCase();
    if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/.test(n)) return 'image';
    if (file.type === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
    if (n.endsWith('.docx')) return 'docx';
    if (/\.(xlsx|xls|csv)$/.test(n)) return 'sheet';
    if (n.endsWith('.txt')) return 'txt';
    if (n.endsWith('.doc')) return 'doc';
    return 'other';
  }

  // Сжимаем изображение до разумного размера, чтобы уложиться в лимиты запроса и цену
  async function imageToJpegB64(source, maxSide = 2000) {
    let bmp;
    if (source instanceof HTMLCanvasElement) bmp = source;
    else bmp = await createImageBitmap(source);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', 0.85);
    return url.split(',')[1];
  }

  // PDF: текстовый слой читаем сразу; если это скан — отдаём функцию, которая рендерит страницу по запросу.
  // Так 30–40 страниц не держатся в памяти разом: каждая страница рендерится прямо перед распознаванием.
  async function pdf(file, maxPages) {
    await loadScript('pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
    const data = await file.arrayBuffer();
    let doc;
    try { doc = await pdfjsLib.getDocument({ data: data.slice(0) }).promise; }
    catch (e) {
      if (e.name !== 'PasswordException') throw e;
      // лаборатории иногда закрывают PDF паролем (часто — дата рождения)
      const pw = prompt(`Файл «${file.name}» защищён паролем. Введите пароль из письма лаборатории:`);
      if (!pw) throw new Error('файл защищён паролем');
      doc = await pdfjsLib.getDocument({ data: data.slice(0), password: pw }).promise;
    }
    const total = doc.numPages, pages = Math.min(total, maxPages);
    const texts = [];
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      // собираем строки по координате Y, чтобы таблицы не превращались в кашу
      const lines = new Map();
      for (const it of tc.items) {
        const y = Math.round(it.transform[5]);
        lines.set(y, (lines.get(y) || []).concat({ x: it.transform[4], s: it.str }));
      }
      texts.push([...lines.entries()].sort((a, b) => b[0] - a[0]).map(([, items]) => items.sort((a, b) => a.x - b.x).map(i => i.s).join('  ')).join('\n'));
    }
    const truncated = total > pages ? total - pages : 0;
    if (texts.join('').replace(/\s/g, '').length > 80 * pages) return { pageTexts: texts, pageCount: pages, truncated };
    return {
      pageCount: pages, truncated,
      renderPage: async i => {
        const page = await doc.getPage(i + 1);
        const vp = page.getViewport({ scale: 1.8 });
        const c = document.createElement('canvas');
        c.width = vp.width; c.height = vp.height;
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        const b64 = await imageToJpegB64(c);
        c.width = c.height = 0; // сразу освобождаем память
        return b64;
      }
    };
  }

  // Число страниц без распознавания — чтобы заранее показать лимит
  async function countPages(file) {
    const k = kindOf(file);
    if (k !== 'pdf') return 1;
    try {
      await loadScript('pdf.min.js');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
      const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const n = doc.numPages; doc.destroy(); return n;
    } catch (e) { return 1; }
  }

  async function docx(file) {
    await loadScript('mammoth.browser.min.js');
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { text: r.value };
  }

  async function sheet(file) {
    await loadScript('xlsx.full.min.js');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    return { text: wb.SheetNames.map(n => '# ' + n + '\n' + XLSX.utils.sheet_to_csv(wb.Sheets[n], { FS: ' ; ' })).join('\n\n') };
  }

  // Единый ответ: { pageTexts[] } — текст по страницам, или { pageCount, renderPage(i) } — картинки для OCR
  async function run(file, maxPages = 40) {
    const k = kindOf(file);
    if (k === 'image') return { pageCount: 1, renderPage: () => imageToJpegB64(file) };
    if (k === 'pdf') return pdf(file, maxPages);
    if (k === 'docx') return { pageTexts: [(await docx(file)).text] };
    if (k === 'sheet') return { pageTexts: [(await sheet(file)).text] };
    if (k === 'txt') return { pageTexts: [await file.text()] };
    if (k === 'doc') return { unsupported: 'Старый формат .doc не читается — сохраните файл как .docx или PDF. Сам файл в архив сохранится.' };
    return { unsupported: 'Этот формат пока не распознаётся, но файл сохранится в архиве.' };
  }

  return { run, kindOf, countPages };
})();
