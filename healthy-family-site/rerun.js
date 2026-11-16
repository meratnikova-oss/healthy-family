// Распознать заново пачкой: старые записи перераспознаются по своим оригиналам.
// Заметки, разделы, файлы и расшифровка остаются. Показатели заменяются, только если новых не меньше половины старых,
// пустые поля (название, дата, клиника, заключение, приём по полочкам) дозаполняются.
let rerunJob = null;

async function rerunCandidates(onlyPhotos) {
  const recs = await db.records.toArray();
  const out = [];
  for (const r of recs) {
    const files = await db.files.where('recordId').equals(r.id).toArray();
    if (!files.length) continue;
    const photo = files.some(f => /^image\//.test(f.mime || ''));
    if (onlyPhotos && !photo) continue;
    out.push({ r, files });
  }
  return out.sort((a, b) => (b.r.date || '').localeCompare(a.r.date || ''));
}

async function rerunOne(r, files) {
  const p = await db.profiles.get(r.profileId);
  const asFiles = files.map(f => new File([f.blob], f.name || 'файл', { type: f.mime }));
  const res = await recognizeFiles(asFiles, p, (t) => { if (rerunJob) { rerunJob.stepText = t; drawRerun(); } });
  const pz = res.parsed || {};
  const old = await db.results.where('recordId').equals(r.id).toArray();
  const rows = (pz.results || []).filter(x => String(x.name).trim() && String(x.value).trim());
  const replace = rows.length && rows.length >= Math.ceil(old.length / 2);
  const patch = { text: res.text || r.text };
  if (!r.title && pz.title) patch.title = pz.title;
  if (!r.date && pz.date) patch.date = pz.date;
  if (!r.conclusion && pz.conclusion) patch.conclusion = pz.conclusion;
  if (!r.clinicId && pz.clinic) patch.clinicId = await getOrCreateByName(db.clinics, pz.clinic);
  if ((!r.type || r.type === 'document') && pz.docType && pz.docType !== 'document') patch.type = pz.docType;
  const date = patch.date || r.date || null;
  await db.transaction('rw', db.records, db.results, async () => {
    await db.records.update(r.id, patch);
    if (replace) {
      await db.results.where('recordId').equals(r.id).delete();
      for (const row of rows) await db.results.add({ recordId: r.id, profileId: p.id, date, ...Metrics.normalizeResult(row, p) });
    }
  });
  if (!hasVisit(r.visit) && hasVisit(pz.visit)) {
    pz.visit.prescriptions.forEach(x => { x.take = false; x.buy = false; }); // в лекарства — только по кнопке в записи
    await db.records.update(r.id, { visit: pz.visit });
  }
  return { before: old.length, after: replace ? rows.length : old.length, replaced: !!replace, found: rows.length };
}

async function viewRerun() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const onlyPhotos = q.get('all') !== '1';
  if (rerunJob) return drawRerun(true);
  const list = await rerunCandidates(onlyPhotos);
  const names = Object.fromEntries((await db.profiles.toArray()).map(p => [p.id, p.name]));
  app.innerHTML = `<div class="top">${backLink('#/settings')}<h1 class="grow">Распознать заново</h1></div>
    <div class="pad stack" id="rrbox">
      <p class="sub" style="font-size:15px;color:var(--ink)">Записи перераспознаются по своим оригиналам. Заметки, разделы и файлы останутся. Показатели заменятся новыми; если новых нашлось сильно меньше, старые сохранятся.</p>
      <div class="seg"><button type="button" class="${onlyPhotos ? 'on' : ''}" data-rr="0">С фото · ${onlyPhotos ? list.length : '…'}</button><button type="button" class="${onlyPhotos ? '' : 'on'}" data-rr="1">Все с файлами${onlyPhotos ? '' : ' · ' + list.length}</button></div>
      <section class="card" style="gap:2px">${list.map(({ r }) => `<label class="row" style="min-height:44px"><input type="checkbox" data-rrid="${r.id}" checked style="width:20px;height:20px;accent-color:var(--accent)">
        <span class="grow">${esc(r.title || RECORD_TYPES[r.type] || 'Документ')}<span class="sub"> · ${esc(names[r.profileId] || '')} · ${fmtDate(r.date)}</span></span></label>`).join('') || '<p class="empty" style="margin:0">Таких записей нет.</p>'}</section>
      ${list.length ? `<button type="button" class="btn" id="rrgo">Распознать заново: ${list.length}</button><span class="sub">Не закрывайте приложение, пока идёт распознавание. Одна запись — 10–40 секунд.</span>` : ''}
    </div>${nav('settings')}`;
  $$('[data-rr]').forEach(b => b.onclick = () => { location.hash = '#/rerun' + (b.dataset.rr === '1' ? '?all=1' : ''); });
  const upd = () => { const n = $$('[data-rrid]').filter(c => c.checked).length; const g = $('#rrgo'); if (g) { g.textContent = `Распознать заново: ${n}`; g.disabled = !n; } };
  $$('[data-rrid]').forEach(c => c.onchange = upd);
  const go = $('#rrgo');
  if (go) go.onclick = async () => {
    if (!(await Plan.gate('Распознать заново'))) return;
    const ids = new Set($$('[data-rrid]').filter(c => c.checked).map(c => +c.dataset.rrid));
    rerunJob = { items: list.filter(x => ids.has(x.r.id)).map(x => ({ ...x, status: 'wait' })), i: 0, stop: false, stepText: '' };
    drawRerun(true);
    runRerun();
  };
}

async function runRerun() {
  const job = rerunJob;
  for (; job.i < job.items.length; job.i++) {
    if (job.stop) break;
    const it = job.items[job.i];
    it.status = 'work'; drawRerun();
    try { Object.assign(it, await rerunOne(it.r, it.files), { status: 'done' }); }
    catch (e) {
      it.status = 'error'; it.error = e.message;
      if ([401, 402].includes(e.status) || /Нет связи|VPN/.test(e.message)) { job.fatal = e.message; break; }
    }
    drawRerun();
  }
  job.finished = true; drawRerun();
}

function drawRerun(full) {
  const job = rerunJob; if (!job || !location.hash.startsWith('#/rerun')) return;
  const done = job.items.filter(x => x.status === 'done' || x.status === 'error').length;
  const html = `
    <section class="card"><h2>${job.finished ? (job.fatal ? 'Остановлено' : 'Готово') : `Распознаю ${Math.min(job.i + 1, job.items.length)} из ${job.items.length}`}</h2>
      <div class="pbar"><i style="width:${Math.round(done / job.items.length * 100)}%"></i></div>
      ${!job.finished ? `<p class="progress" style="margin:0">${esc(job.stepText || '')}</p>` : ''}
      ${job.fatal ? `<span class="sub" style="color:var(--high)">${esc(job.fatal)}</span>` : ''}
    </section>
    <section class="card" style="gap:2px">${job.items.map(it => `<a class="row" href="#/record/${it.r.id}" style="min-height:44px;text-decoration:none;color:inherit">
      <span class="grow">${esc(it.r.title || RECORD_TYPES[it.r.type] || 'Документ')}<span class="sub"> · ${fmtDate(it.r.date)}</span></span>
      <span class="sub">${it.status === 'wait' ? 'в очереди' : it.status === 'work' ? '…' : it.status === 'error' ? 'ошибка' : it.replaced ? `показателей: ${it.before} → ${it.after}` : `оставлено ${it.before}`}</span></a>`).join('')}</section>
    ${job.finished ? '<button type="button" class="btn" id="rrdone">Готово</button><span class="sub">Откройте записи и сверьте значения с оригиналом.</span>' : '<button type="button" class="btn ghost" id="rrstop">Остановить после текущей</button>'}`;
  if (full || !$('#rrbox')) {
    app.innerHTML = `<div class="top">${backLink('#/settings')}<h1 class="grow">Распознать заново</h1></div><div class="pad stack" id="rrbox">${html}</div>${nav('settings')}`;
  } else $('#rrbox').innerHTML = html;
  const st = $('#rrstop'); if (st) st.onclick = () => { job.stop = true; st.disabled = true; st.textContent = 'Остановлю после текущей записи'; };
  const dn = $('#rrdone'); if (dn) dn.onclick = () => { rerunJob = null; location.hash = '#/settings'; };
}
