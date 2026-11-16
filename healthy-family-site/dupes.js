// Одинаковые документы: один и тот же файл, загруженный дважды, или одна и та же запись с теми же показателями.
async function fileHash(blob) {
  const buf = await blob.arrayBuffer();
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function ensureHash(f) {
  if (f.hash || !f.blob) return f.hash;
  f.hash = await fileHash(f.blob);
  await db.files.update(f.id, { hash: f.hash });
  return f.hash;
}

// Есть ли уже запись с таким же файлом? Сравниваем только файлы того же размера — это быстро.
async function findSameFile(files) {
  for (const f of files) {
    const same = (await db.files.where('size').equals(f.size).toArray()).filter(x => x.recordId);
    if (!same.length) continue;
    const h = f._hash || (f._hash = await fileHash(f));
    for (const x of same) if ((await ensureHash(x)) === h) {
      const r = await db.records.get(x.recordId);
      if (r) return r;
    }
  }
  return null;
}

async function duplicateGroups() {
  const records = await db.records.toArray();
  const files = await db.files.toArray();
  const byRec = new Map();
  for (const f of files) if (f.recordId) {
    if (!byRec.has(f.recordId)) byRec.set(f.recordId, []);
    byRec.get(f.recordId).push(await ensureHash(f));
  }
  const results = await db.results.toArray();
  const resBy = new Map();
  for (const r of results) if (r.recordId) {
    if (!resBy.has(r.recordId)) resBy.set(r.recordId, []);
    resBy.get(r.recordId).push(`${r.metricId}=${r.value}`);
  }
  const groups = new Map();
  for (const r of records) {
    const fh = (byRec.get(r.id) || []).sort().join(',');
    const rs = (resBy.get(r.id) || []).sort().join(';');
    // ключ: те же файлы, либо тот же человек, дата, название и все показатели
    const keys = [];
    if (fh) keys.push(r.profileId + '|f|' + fh);
    if (rs) keys.push(r.profileId + '|r|' + (r.date || '') + '|' + String(r.title || '').toLowerCase().trim() + '|' + rs);
    for (const k of keys) { if (!groups.has(k)) groups.set(k, new Set()); groups.get(k).add(r.id); }
  }
  // объединяем пересекающиеся группы
  const seen = new Set(), out = [];
  for (const ids of groups.values()) {
    if (ids.size < 2) continue;
    const arr = [...ids].filter(id => !seen.has(id));
    if (arr.length < 2) continue;
    arr.forEach(id => seen.add(id));
    out.push(arr.map(id => records.find(r => r.id === id)).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')));
  }
  return out;
}

async function viewDupes() {
  app.innerHTML = `<div class="top">${backLink('#/settings')}<h1 class="grow">Одинаковые документы</h1></div><div class="pad stack"><p class="progress">Ищу совпадения…</p></div>${nav('settings')}`;
  const groups = await duplicateGroups();
  const names = Object.fromEntries((await db.profiles.toArray()).map(p => [p.id, p.name]));
  const secs = Object.fromEntries((await db.sections.toArray()).map(s => [s.id, s.name]));
  const line = (r, keep) => `<div class="row" style="min-height:48px">
      <a class="grow" href="#/record/${r.id}" style="text-decoration:none;color:inherit"><div style="font-weight:500">${esc(r.title || RECORD_TYPES[r.type] || 'Документ')}</div>
      <div class="sub">${esc(names[r.profileId] || '')} · ${fmtDate(r.date)} · ${esc((r.sectionIds || []).map(i => secs[i]).filter(Boolean).join(', '))}</div></a>
      ${keep ? '<span class="tag">оставить</span>' : `<button type="button" class="pill" data-ddel="${r.id}">Удалить</button>`}</div>`;
  $('.pad.stack').innerHTML = groups.length ? `
    <p class="sub" style="font-size:15px;color:var(--ink)">Нашлось ${groups.length} ${plural(groups.length, 'документ', 'документа', 'документов')} с копиями. Первая загруженная запись остаётся, копии можно удалить.</p>
    ${groups.map(g => `<section class="card" style="gap:4px">${g.map((r, i) => line(r, i === 0)).join('')}</section>`).join('')}
    <button type="button" class="btn" id="dall">Удалить все копии (${groups.reduce((n, g) => n + g.length - 1, 0)})</button>`
    : '<section class="card"><p class="empty" style="margin:0">Одинаковых документов нет.</p></section>';
  $$('[data-ddel]').forEach(b => b.onclick = async () => { await deleteRecord(+b.dataset.ddel); toast('Копия удалена'); viewDupes(); });
  const all = $('#dall');
  if (all) all.onclick = async () => {
    if (!confirm('Удалить все копии? Первые записи останутся.')) return;
    for (const g of groups) for (const r of g.slice(1)) await deleteRecord(r.id);
    toast('Копии удалены'); viewDupes();
  };
}
