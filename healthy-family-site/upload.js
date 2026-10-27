// Загрузка: лоток снимков и файлов, пакетный режим, распознавание больших документов частями.
//
// Почему частями: ИИ отвечает ограниченной длиной. Если отдать ему 10+ страниц разом, ответ обрывается
// на середине и разбор падает. Поэтому страницы распознаются параллельно (по 3), а текст уходит в ИИ
// кусками по ~6000 символов (2–3 страницы бланка). Результаты кусков склеиваются в одну запись.

const BATCH = {
  maxPages: 40,     // страниц в одном документе за одну загрузку
  maxFiles: 30,     // файлов в пакетном режиме «каждый файл отдельно»
  chunkChars: 6000, // размер куска текста для ИИ
  ocrParallel: 3    // сколько страниц распознаётся одновременно
};

// ---------- лоток: переживает перезапуск страницы после камеры ----------
// На Android после съёмки браузер иногда перезагружает страницу — снимки при этом не теряются.
async function traySave() {
  if (!draft || !draft.files) return;
  try {
    await db.kv.put({ key: 'uploadTray', value: { profileId: draft.profileId, at: Date.now(), mode: draft.mode || null,
      files: draft.files.map(f => ({ name: f.name, type: f.type, blob: f, pages: f._pages || null })) } });
  } catch (e) {}
}
async function trayLoad() {
  try {
    const t = (await db.kv.get('uploadTray'))?.value;
    if (!t || !t.files?.length || Date.now() - t.at > 3 * 864e5) return null;
    return { profileId: t.profileId, mode: t.mode, files: t.files.map(x => { const f = new File([x.blob], x.name, { type: x.type }); if (x.pages) f._pages = x.pages; return f; }) };
  } catch (e) { return null; }
}
const trayClear = () => db.kv.delete('uploadTray').catch(() => {});

const CAM_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const isImageFile = f => Extract.kindOf(f) === 'image';
const fileExt = f => (f.name.split('.').pop() || 'файл').slice(0, 4).toUpperCase();
const pagesOf = f => f._pages || 1;
const totalPages = files => files.reduce((n, f) => n + pagesOf(f), 0);

async function viewUpload() {
  if (!(await db.profiles.count())) return viewOnboarding();
  const profiles = await spaceProfiles();
  if (!profiles.length) { location.hash = '#/'; return; }
  let p = await currentProfile();
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const preSection = +q.get('section') || null;
  if (draft && draft.stage === 'review') return viewReview();
  const keep = q.has('prefilled') && draft && draft.files?.length ? draft : null;
  draft = keep || { stage: 'pick', profileId: p.id, files: [], preSection };
  let restored = false;
  if (q.has('shared')) draft.files = await Shared.take();
  else if (!keep) {
    const t = await trayLoad();
    if (t && profiles.some(x => x.id === t.profileId)) { draft.files = t.files; draft.profileId = t.profileId; draft.mode = t.mode; restored = true; }
  }
  p = profiles.find(x => x.id === draft.profileId) || p;
  app.innerHTML = `
    <div class="top">${backLink('#/')}<h1 class="grow">Новая запись</h1></div>
    <div class="pad stack">
      <div class="stack" style="gap:8px"><span class="sub">Чья запись</span>
        <div class="row" style="flex-wrap:wrap;gap:8px">${profiles.map(x => `<button type="button" class="pill ${x.id === p.id ? 'on' : ''}" data-who="${x.id}">${esc(x.name)}</button>`).join('')}</div></div>
      ${restored ? '<div class="card" style="background:var(--accent-soft);padding:12px 14px"><span class="sub" style="color:var(--ink)">Вернула снимки, которые вы сделали раньше. <button type="button" class="linkbtn" id="trayclear">Начать заново</button></span></div>' : ''}
      ${draft.fromInbox ? '<span class="sub">Файлы из письма — выберите, чья это запись, и нажмите «Распознать».</span>' : ''}
      <section class="card" style="gap:10px">
        <div class="tray-row" id="tray"></div>
        <div class="row" style="gap:8px">
          <button type="button" class="btn" id="shoot" style="flex:1;padding:0 10px;white-space:nowrap;gap:6px">${CAM_ICON} <span id="shootlbl">Снять фото</span></button>
          <button type="button" class="btn ghost" id="pickbtn" style="flex:1;padding:0 10px;white-space:nowrap">Выбрать файлы</button>
        </div>
        <input type="file" id="cam" accept="image/*" capture="environment" hidden>
        <input type="file" id="pick" multiple accept="image/*,.pdf,.docx,.doc,.xlsx,.xls,.csv,.txt" hidden>
        <span class="sub" id="limitline">Фото, PDF, Word, Excel. Снимайте страницы по порядку — до ${BATCH.maxPages} страниц за раз.</span>
      </section>
      <section class="card" id="modebox" hidden style="gap:8px">
        <h2>Как сохранить</h2>
        <div class="seg" role="radiogroup">
          <button type="button" data-mode="one">Один документ</button>
          <button type="button" data-mode="many">Каждый файл отдельно</button>
        </div>
        <span class="sub" id="modehint"></span>
      </section>
      <button type="button" class="btn" id="recognize" disabled>Распознать</button>
      <button type="button" class="btn ghost" id="justsave" disabled>Сохранить без распознавания</button>
      <div id="progbox" hidden class="stack" style="gap:6px"><div class="pbar"><i id="pfill"></i></div><p class="progress" id="prog" style="margin:0"></p></div>
    </div>
    ${nav('upload')}`;
  $$('[data-who]').forEach(b => b.onclick = () => { draft.profileId = +b.dataset.who; $$('[data-who]').forEach(x => x.classList.toggle('on', x === b)); traySave(); });
  const tc = $('#trayclear'); if (tc) tc.onclick = () => { draft.files = []; trayClear(); tc.closest('.card').remove(); drawTray(); };
  $('#shoot').onclick = () => $('#cam').click();
  $('#pickbtn').onclick = () => $('#pick').click();
  const add = list => {
    const room = BATCH.maxFiles - draft.files.length;
    const arr = [...list];
    if (arr.length > room) toast(`За один раз — не больше ${BATCH.maxFiles} файлов. Остальные загрузите следующей пачкой.`);
    draft.files = draft.files.concat(arr.slice(0, Math.max(0, room)));
    traySave(); drawTray();
    setTimeout(() => { const t = $('#tray'); if (t) t.scrollLeft = t.scrollWidth; }, 60);
  };
  $('#cam').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) add([new File([f], `Страница ${draft.files.length + 1}.jpg`, { type: f.type || 'image/jpeg' })]); };
  $('#pick').onchange = e => { const fs = [...e.target.files]; e.target.value = ''; add(fs); };
  $$('[data-mode]').forEach(b => b.onclick = () => { draft.mode = b.dataset.mode; draft.modeChosen = true; traySave(); drawTray(); });
  $('#recognize').onclick = startRecognition;
  $('#justsave').onclick = () => {
    if (draft.mode === 'many' && draft.files.length > 1) { startQueue(false); return; }
    draft.parsed = { docType: 'document', results: [] }; draft.text = ''; draft.stage = 'review'; viewReview();
  };
  drawTray();
}

function defaultMode(files) {
  if (files.length < 2) return 'one';
  return files.every(isImageFile) ? 'one' : 'many';
}

function drawTray() {
  const box = $('#tray'); if (!box || !draft) return;
  const files = draft.files;
  box.innerHTML = files.map((f, i) => {
    if (isImageFile(f) && !f._u) f._u = URL.createObjectURL(f);
    const inner = isImageFile(f) ? `<img src="${f._u}" alt="">` : `<span class="text">${esc(fileExt(f))}${f._pages > 1 ? `<small>${f._pages} стр.</small>` : ''}</span>`;
    return `<div class="tthumb">${inner}<span class="tnum">${i + 1}</span>
      <button type="button" class="tdel" data-tdel="${i}" aria-label="Убрать файл ${i + 1}">×</button></div>`;
  }).join('') || '<span class="sub" style="align-self:center">Снимите страницы бланка или выберите файлы — можно сразу несколько.</span>';
  $$('[data-tdel]').forEach(b => b.onclick = () => { draft.files.splice(+b.dataset.tdel, 1); traySave(); drawTray(); });
  // считаем страницы PDF, чтобы честно показать лимит
  files.filter(f => !f._pages && Extract.kindOf(f) === 'pdf' && !f._counting).forEach(f => {
    f._counting = true;
    Extract.countPages(f).then(n => { f._pages = n; traySave(); drawTray(); });
  });
  const n = files.length, pages = totalPages(files);
  if (!draft.modeChosen || n < 2) draft.mode = defaultMode(files);
  const many = draft.mode === 'many' && n > 1;
  $('#shootlbl').textContent = n ? 'Ещё фото' : 'Снять фото';
  $('#modebox').hidden = n < 2;
  $$('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === draft.mode));
  $('#modehint').textContent = many
    ? `Каждый файл станет своей записью: ${n} ${plural(n, 'документ', 'документа', 'документов')}. Распознаю по очереди, а вы проверяете их один за другим.`
    : 'Все страницы — один документ, например многостраничный бланк анализов. Получится одна запись.';
  const over = !many && pages > BATCH.maxPages;
  const line = $('#limitline');
  line.innerHTML = !n ? `Фото, PDF, Word, Excel. Снимайте страницы по порядку — до ${BATCH.maxPages} страниц за раз.`
    : over ? `<b style="color:var(--high)">${pages} ${plural(pages, 'страница', 'страницы', 'страниц')} — больше лимита.</b> Распознаю первые ${BATCH.maxPages}, остальные сохранятся только как файлы. Лучше разделите на несколько загрузок${n > 1 ? ' или выберите «Каждый файл отдельно»' : ''}.`
    : many ? `${n} ${plural(n, 'файл', 'файла', 'файлов')} · до ${BATCH.maxPages} страниц в каждом, до ${BATCH.maxFiles} файлов за раз.`
    : `${pages} ${plural(pages, 'страница', 'страницы', 'страниц')} из ${BATCH.maxPages} возможных за раз.`;
  const btn = $('#recognize');
  btn.disabled = $('#justsave').disabled = !n;
  btn.textContent = !n ? 'Распознать' : many ? `Распознать ${n} ${plural(n, 'документ', 'документа', 'документов')}` : `Распознать: ${Math.min(pages, BATCH.maxPages)} ${plural(Math.min(pages, BATCH.maxPages), 'страница', 'страницы', 'страниц')}`;
}

function setProgress(text, frac) {
  const box = $('#progbox'); if (!box) return;
  box.hidden = false;
  $('#prog').textContent = text;
  if (frac !== undefined) $('#pfill').style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
}

// ---------- чтение и OCR: страницы по порядку, распознавание параллельно ----------
async function readPages(files, onProgress) {
  const blocks = [], jobs = [], notes = [];
  let budget = BATCH.maxPages, pageNo = 0, skipped = 0;
  for (const [i, f] of files.entries()) {
    if (budget <= 0) { skipped += pagesOf(f); continue; }
    onProgress(`Открываю файл ${i + 1} из ${files.length}`, 0);
    let out;
    try { out = await Extract.run(f, budget); }
    catch (e) { notes.push(`Файл ${i + 1}: не удалось прочитать (${e.message}). Сам файл сохранится.`); continue; }
    if (out.unsupported) { notes.push(`Файл ${i + 1}: ${out.unsupported}`); continue; }
    if (out.truncated) skipped += out.truncated;
    if (out.pageTexts) for (const t of out.pageTexts) { blocks.push({ n: ++pageNo, text: t }); budget--; }
    else for (let j = 0; j < out.pageCount; j++) { const b = { n: ++pageNo, text: null }; blocks.push(b); jobs.push({ b, render: () => out.renderPage(j) }); budget--; }
  }
  if (skipped) notes.push(`Распознаны первые ${BATCH.maxPages} страниц, ещё ${skipped} — нет (лимит за одну загрузку). Все файлы сохранятся в архиве; остальные страницы можно загрузить отдельной записью.`);
  // OCR: по 3 страницы одновременно
  let done = 0, failed = 0, next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      try {
        const img = await job.render();
        job.b.text = (await api('ocr', { image: img })).text || '';
      } catch (e) {
        if (/Код доступа|Лимит|Нет связи|адрес сервера/.test(e.message)) throw e;
        failed++; job.b.text = '';
      }
      done++;
      onProgress(`Распознаю страницы: ${done} из ${jobs.length}`, done / Math.max(1, jobs.length));
    }
  };
  if (jobs.length) await Promise.all(Array.from({ length: Math.min(BATCH.ocrParallel, jobs.length) }, worker));
  if (failed) notes.push(`${failed} ${plural(failed, 'страница не распозналась', 'страницы не распознались', 'страниц не распознались')} — возможно, снимок размыт. Проверьте показатели.`);
  return { blocks, notes };
}

// Делим текст на куски ~6000 символов по границам страниц (длинную страницу — по строкам)
function chunkBlocks(blocks) {
  const pieces = [];
  for (const b of blocks) {
    const t = (b.text || '').trim(); if (!t) continue;
    const head = `=== Стр. ${b.n} ===\n`;
    if (t.length <= BATCH.chunkChars) { pieces.push(head + t); continue; }
    let cur = head;
    for (const line of t.split('\n')) {
      if (cur.length + line.length > BATCH.chunkChars && cur.length > head.length) { pieces.push(cur); cur = `=== Стр. ${b.n} (продолжение) ===\n`; }
      cur += line + '\n';
    }
    pieces.push(cur);
  }
  const chunks = []; let cur = '';
  for (const pc of pieces) {
    if (cur && cur.length + pc.length > BATCH.chunkChars) { chunks.push(cur); cur = ''; }
    cur += (cur ? '\n\n' : '') + pc;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

async function parseChunks(chunks, p, onProgress) {
  const sections = (await db.sections.where('profileId').equals(p.id).toArray()).map(s => s.name);
  const parts = [], notes = [];
  const one = async (text, part, of) => {
    try { return await api('parse', { text, part, parts: of, profileKind: p.kind, sections }); }
    catch (e) {
      if (/Код доступа|Лимит|Нет связи|адрес сервера/.test(e.message)) throw e;
      // не уложилось — делим пополам и пробуем ещё раз
      if (text.length > 1500) {
        const half = Math.floor(text.length / 2), nl = text.lastIndexOf('\n', half), mid = nl > 200 ? nl : half;
        const a = await one(text.slice(0, mid), part, of), b = await one(text.slice(mid), part, of);
        return mergeParsed([a, b].filter(Boolean));
      }
      notes.push(`Часть ${part} из ${of} не разобралась — допишите её показатели вручную.`);
      return null;
    }
  };
  let done = 0;
  for (const [i, c] of chunks.entries()) {
    onProgress(chunks.length > 1 ? `Разбираю показатели: часть ${i + 1} из ${chunks.length}` : 'Разбираю показатели…', done / chunks.length);
    const r = await one(c, i + 1, chunks.length);
    if (r) parts.push(r);
    done++;
  }
  const merged = mergeParsed(parts);
  if (parts.some(x => x.truncated)) notes.push('Ответ ИИ по одной из частей оказался слишком длинным — часть показателей могла не попасть. Сверьте с оригиналом.');
  return { parsed: merged, notes };
}

function mergeParsed(list) {
  const out = { docType: null, title: '', date: null, clinic: '', doctor: '', patientName: '', conclusion: '', sectionHints: [], results: [], uncertain: [], truncated: false };
  const seen = new Set();
  for (const pz of list) {
    if (!pz) continue;
    for (const k of ['title', 'date', 'clinic', 'doctor', 'patientName']) if (!out[k] && pz[k]) out[k] = pz[k];
    if (!out.docType && pz.docType && pz.docType !== 'document') out.docType = pz.docType;
    if (pz.conclusion && !out.conclusion.includes(pz.conclusion)) out.conclusion += (out.conclusion ? '\n\n' : '') + pz.conclusion;
    out.sectionHints = [...new Set([...out.sectionHints, ...(pz.sectionHints || [])])];
    out.uncertain = [...new Set([...out.uncertain, ...(pz.uncertain || [])])];
    out.truncated = out.truncated || !!pz.truncated;
    for (const r of pz.results || []) {
      const key = [r.name, r.value, r.unit].map(x => String(x ?? '').toLowerCase().trim()).join('|');
      if (seen.has(key)) continue;
      seen.add(key); out.results.push(r);
    }
  }
  out.docType = out.docType || (list.find(x => x && x.docType)?.docType) || 'document';
  return out;
}

async function recognizeFiles(files, p, onProgress) {
  const { blocks, notes } = await readPages(files, (t, f) => onProgress(t, f * 0.6));
  const text = blocks.map(b => b.text ? `=== Стр. ${b.n} ===\n${b.text}` : '').filter(Boolean).join('\n\n');
  if (!text.trim()) return { text: '', parsed: { docType: 'document', results: [] }, notes: notes.length ? notes : ['В файлах не нашлось текста — сохраните запись и заполните вручную.'] };
  const chunks = chunkBlocks(blocks);
  const r = await parseChunks(chunks, p, (t, f) => onProgress(t, 0.6 + f * 0.4));
  return { text, parsed: r.parsed, notes: [...notes, ...r.notes] };
}

// ---------- запуск ----------
async function startRecognition() {
  if (draft.mode === 'many' && draft.files.length > 1) return startQueue(true);
  const btns = [$('#recognize'), $('#justsave'), $('#shoot'), $('#pickbtn')];
  btns.forEach(b => b.disabled = true);
  draft.busy = true;
  try {
    const p = await db.profiles.get(draft.profileId);
    const r = await recognizeFiles(draft.files, p, setProgress);
    draft.text = r.text; draft.parsed = r.parsed; draft.notes = r.notes; draft.stage = 'review'; draft.rows = undefined;
    viewReview();
  } catch (e) {
    draft.busy = false;
    $('#progbox').hidden = true;
    toast(e.message);
    btns.forEach(b => b.disabled = false);
  }
}

// Пакет «каждый файл отдельно»: распознаём по очереди в фоне, проверка идёт параллельно
function startQueue(withAI) {
  draft.queue = draft.files.map(f => ({ files: [f], status: withAI ? 'wait' : 'ready', text: '', parsed: { docType: 'document', results: [] }, notes: [] }));
  draft.qi = 0; draft.saved = 0; draft.stage = 'review'; draft._loaded = null;
  if (withAI) processQueue();
  viewReview();
}
async function processQueue() {
  const d = draft;
  const p = await db.profiles.get(d.profileId);
  for (const [i, it] of d.queue.entries()) {
    if (draft !== d) return; // загрузку отменили
    it.status = 'work';
    try {
      const r = await recognizeFiles(it.files, p, (t, f) => { it.progress = { t, f }; if (draft === d && d.qi === i && $('#qwait')) { $('#qprog').textContent = t; $('#qfill').style.width = Math.round(f * 100) + '%'; } });
      Object.assign(it, r, { status: 'ready' });
    } catch (e) {
      Object.assign(it, { status: 'ready', notes: [`Не удалось распознать: ${e.message}. Заполните вручную или пропустите.`] });
    }
    if (draft === d && d.qi === i && $('#qwait')) viewReview();
  }
}

// ---------- проверка ----------
async function viewReview() {
  const d = draft;
  if (d.queue) {
    const it = d.queue[d.qi];
    if (it.status !== 'ready') {
      app.innerHTML = `<div class="top"><button type="button" class="back linkbtn" id="cancel" aria-label="Остановить" style="color:var(--ink)">✕</button><h1 class="grow">Документ ${d.qi + 1} из ${d.queue.length}</h1></div>
        <div class="pad stack" id="qwait"><section class="card"><h2>Распознаю…</h2><div class="pbar"><i id="qfill" style="width:${Math.round((it.progress?.f || 0) * 100)}%"></i></div><p class="progress" id="qprog" style="margin:0">${esc(it.progress?.t || 'В очереди')}</p>
        <span class="sub">Можно не ждать на этом экране: распознавание идёт, пока приложение открыто.</span></section></div>`;
      $('#cancel').onclick = stopQueue;
      return;
    }
    if (d._loaded !== d.qi) { Object.assign(d, { files: it.files, text: it.text, parsed: it.parsed, notes: it.notes, rows: undefined, _loaded: d.qi }); }
  }
  const pz = d.parsed || {};
  const p = await db.profiles.get(d.profileId);
  const sections = (await db.sections.where('profileId').equals(p.id).toArray()).sort((a, b) => a.order - b.order);
  const clinics = await db.clinics.toArray(), doctors = await db.doctors.toArray();
  const hints = (pz.sectionHints || []).map(h => String(h).toLowerCase());
  const pre = new Set(sections.filter(s => s.id === d.preSection || hints.includes(s.name.toLowerCase())).map(s => s.id));
  if (!pre.size) {
    const m = (pz.results || []).map(r => Metrics.match(r.name)).find(Boolean);
    const s = m && sections.find(s => s.name === m.section) || sections.find(s => /анализ/i.test(s.name));
    if (s && (pz.results || []).length) pre.add(s.id);
  }
  const unsure = new Set(pz.uncertain || []);
  d.rows = d.rows || (pz.results || []).map(r => ({ ...r }));
  const q = d.queue, last = !q || d.qi === q.length - 1;
  const pages = totalPages(d.files);
  app.innerHTML = `
    <div class="top"><button type="button" class="back linkbtn" id="cancel" aria-label="Отменить" style="color:var(--ink)">✕</button><h1 class="grow">${q ? `Документ ${d.qi + 1} из ${q.length}` : 'Проверьте запись'}</h1></div>
    <form id="rev" class="pad stack">
      ${d.notes?.length ? `<div class="card" style="background:var(--high-soft)"><span style="font-size:14px">${d.notes.map(esc).join('<br>')}</span></div>` : ''}
      <div class="tray-row">${d.files.map((f, i) => { if (isImageFile(f) && !f._u) f._u = URL.createObjectURL(f); return `<button type="button" class="tthumb" data-open="${i}" aria-label="Открыть страницу ${i + 1}">${isImageFile(f) ? `<img src="${f._u}" alt="">` : `<span class="text">${esc(fileExt(f))}</span>`}<span class="tnum">${i + 1}</span></button>`; }).join('')}</div>
      <section class="card">
        <span class="sub">${esc(p.name)} · ${pages} ${plural(pages, 'страница', 'страницы', 'страниц')}</span>
        ${pz.patientName ? `<span class="sub">Пациент в документе: <b>${esc(pz.patientName)}</b>. Если это не ${esc(p.name)}, отмените и выберите другой профиль.</span>` : ''}
        <label class="f ${unsure.has('title') ? 'warn' : ''}">Название<input class="in" name="title" value="${esc(pz.title || '')}" placeholder="Например, Общий анализ крови"></label>
        <label class="f">Тип<select class="in" name="type">${Object.entries(RECORD_TYPES).map(([k, v]) => `<option value="${k}" ${k === (pz.docType || 'document') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="f ${unsure.has('date') ? 'warn' : ''}">Дата ${unsure.has('date') ? '— проверьте, распознано неуверенно' : ''}<input class="in" type="date" name="date" value="${esc(pz.date || '')}"></label>
        <label class="f ${unsure.has('clinic') ? 'warn' : ''}">Клиника ${unsure.has('clinic') ? '— проверьте' : ''}<input class="in" name="clinic" list="clist" value="${esc(pz.clinic || '')}"></label>
        <label class="f ${unsure.has('doctor') ? 'warn' : ''}">Врач ${unsure.has('doctor') ? '— проверьте' : ''}<input class="in" name="doctor" list="dlist" value="${esc(pz.doctor || '')}"></label>
        <datalist id="clist">${clinics.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>
        <datalist id="dlist">${doctors.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>
        <label class="f">Заключение<textarea class="in" name="conclusion">${esc(pz.conclusion || '')}</textarea></label>
      </section>
      <section class="card"><h2>Разделы</h2>
        <div class="row" style="flex-wrap:wrap;gap:8px">${sections.map(s => `<label class="pill ${pre.has(s.id) ? 'on' : ''}"><input type="checkbox" name="sec" value="${s.id}" ${pre.has(s.id) ? 'checked' : ''} hidden>${esc(s.name)}</label>`).join('')}</div>
      </section>
      <section class="card">
        <div class="between"><h2>Показатели · ${d.rows.length}</h2><button type="button" class="linkbtn" id="addrow">+ Добавить</button></div>
        <div class="rtable" id="rows"></div>
      </section>
      <button class="btn" type="submit">${q ? (last ? 'Сохранить и закончить' : 'Сохранить и дальше') : 'Сохранить в архив'}</button>
      ${q ? `<button type="button" class="btn ghost" id="skip">${last ? 'Пропустить и закончить' : 'Пропустить этот документ'}</button>` : ''}
    </form>`;
  drawRows(p);
  $$('label.pill input[name=sec]').forEach(i => i.onchange = () => i.parentElement.classList.toggle('on', i.checked));
  $$('[data-open]').forEach(b => b.onclick = () => { const f = d.files[+b.dataset.open]; const u = URL.createObjectURL(f); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000); });
  $('#addrow').onclick = () => { syncRows(); d.rows.push({ name: '', value: '', unit: '', refLow: '', refHigh: '' }); drawRows(p); };
  $('#cancel').onclick = q ? stopQueue : () => { if (confirm('Отменить загрузку? Снимки останутся в лотке, их можно распознать позже.')) { draft = null; location.hash = '#/'; render(); } };
  const sk = $('#skip'); if (sk) sk.onclick = () => nextInQueue();
  $('#rev').onsubmit = async e => { e.preventDefault(); syncRows(); await saveDraft(new FormData(e.target)); };
  window.scrollTo(0, 0);
}
function stopQueue() {
  const d = draft;
  if (!confirm(`Остановить? Уже сохранённые документы (${d.saved || 0}) останутся в архиве.`)) return;
  draft = null; trayClear(); location.hash = '#/'; render();
}
function nextInQueue() {
  const d = draft;
  if (d.qi < d.queue.length - 1) { d.qi++; d._loaded = null; viewReview(); return; }
  const n = d.saved || 0;
  draft = null; trayClear();
  toast(n ? `Сохранено ${n} ${plural(n, 'документ', 'документа', 'документов')}` : 'Ничего не сохранено');
  location.hash = '#/'; render();
}

async function saveDraft(fd) {
  const d = draft;
  const p = await db.profiles.get(d.profileId);
  const sectionIds = fd.getAll('sec').map(Number);
  if (!sectionIds.length) {
    const other = await db.sections.where('profileId').equals(p.id).filter(s => s.name === 'Прочее').first();
    if (other) sectionIds.push(other.id);
  }
  const date = fd.get('date') || null;
  const clinicId = await getOrCreateByName(db.clinics, fd.get('clinic'));
  const doctorId = await getOrCreateByName(db.doctors, fd.get('doctor'));
  const unknown = [];
  await db.transaction('rw', db.records, db.files, db.results, async () => {
    const recordId = await db.records.add({
      profileId: p.id, date, type: fd.get('type'), title: fd.get('title').trim(), clinicId, doctorId, sectionIds,
      conclusion: (fd.get('conclusion') || '').trim(), text: d.text || '', notes: '', explanation: null, createdAt: new Date().toISOString()
    });
    for (const f of d.files) await db.files.add({ recordId, name: f.name, mime: f.type, size: f.size, blob: f });
    const rows = d.rows.filter(r => String(r.name).trim() && String(r.value).trim());
    for (const r of rows) {
      const n = Metrics.normalizeResult(r, p);
      if (n.metricId.startsWith('raw:')) unknown.push(r.name);
      await db.results.add({ recordId, profileId: p.id, date, ...n });
    }
  });
  if (unknown.length) {
    const kv = (await db.kv.get('unknownMetrics')) || { key: 'unknownMetrics', value: [] };
    kv.value = [...new Set([...kv.value, ...unknown])];
    await db.kv.put(kv);
  }
  if (d.queue) { d.saved = (d.saved || 0) + 1; toast('Сохранено'); nextInQueue(); return; }
  if (d.fromInbox) await MailInbox.ack(d.fromInbox).catch(() => {});
  draft = null; trayClear();
  toast('Сохранено в архив');
  location.hash = sectionIds[0] ? '#/section/' + sectionIds[0] : '#/';
}

// ---------- оригиналы в записи: миниатюры без названий файлов ----------
const _origUrls = [];
function originalThumbs(files, fresh = true) {
  if (fresh) while (_origUrls.length) URL.revokeObjectURL(_origUrls.pop());
  return `<div class="tray-row">${files.map((f, i) => {
    const img = /^image\//.test(f.mime || '');
    let inner;
    if (img) { const u = URL.createObjectURL(f.blob); _origUrls.push(u); inner = `<img src="${u}" alt="">`; }
    else inner = `<span class="text">${esc(((f.name || '').split('.').pop() || 'файл').slice(0, 4).toUpperCase())}</span>`;
    return `<button type="button" class="tthumb" data-orig="${f.id}" aria-label="Открыть оригинал${files.length > 1 ? `, страница ${i + 1}` : ''}">${inner}${files.length > 1 ? `<span class="tnum">${i + 1}</span>` : ''}<span class="topen">↗</span></button>`;
  }).join('')}</div>`;
}
function bindOriginals() {
  $$('[data-orig]').forEach(b => b.onclick = async () => {
    const f = await db.files.get(+b.dataset.orig);
    const u = URL.createObjectURL(f.blob);
    window.open(u, '_blank');
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  });
}
