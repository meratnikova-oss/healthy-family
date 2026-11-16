// «По датам»: все записи человека одной лентой — по годам и месяцам, с поиском и фильтром по типу.
// Удобно, когда за год или месяц прошли много врачей: видно всё подряд, независимо от раздела.
const MONTHS_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const TL = { type: 'all', year: 'all', q: '' };

async function datesView(p, box) {
  const records = (await db.records.where('profileId').equals(p.id).toArray()).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const sections = Object.fromEntries((await db.sections.where('profileId').equals(p.id).toArray()).map(s => [s.id, s]));
  const clinics = Object.fromEntries((await db.clinics.toArray()).map(c => [c.id, c.name]));
  const doctors = Object.fromEntries((await db.doctors.toArray()).map(c => [c.id, c.name]));
  const flagged = {}, resNames = {};
  for (const r of await db.results.where('profileId').equals(p.id).toArray()) {
    if (r.status === 'low' || r.status === 'high') flagged[r.recordId] = (flagged[r.recordId] || 0) + 1;
    (resNames[r.recordId] = resNames[r.recordId] || []).push(r.rawName || '');
  }
  const years = [...new Set(records.map(r => (r.date || '').slice(0, 4)).filter(Boolean))].sort().reverse();
  const types = [...new Set(records.map(r => r.type || 'document'))];
  const draw = () => {
    const q = TL.q.trim().toLowerCase();
    const list = records.filter(r => (TL.type === 'all' || (r.type || 'document') === TL.type)
      && (TL.year === 'all' || (r.date || '').startsWith(TL.year))
      && (!q || [r.title, r.conclusion, clinics[r.clinicId], doctors[r.doctorId], r.visit?.diagnosis, ...(resNames[r.id] || []), ...(r.sectionIds || []).map(i => sections[i]?.name)]
        .some(x => String(x || '').toLowerCase().includes(q))));
    // группы: год → месяц
    const groups = new Map();
    for (const r of list) {
      const y = (r.date || '').slice(0, 4) || 'none', m = r.date ? +r.date.slice(5, 7) : 0;
      if (!groups.has(y)) groups.set(y, new Map());
      const ym = groups.get(y); if (!ym.has(m)) ym.set(m, []); ym.get(m).push(r);
    }
    const row = r => {
      const [, , dd] = (r.date || '').split('-');
      const secs = (r.sectionIds || []).map(i => sections[i]).filter(Boolean);
      return `<a class="dl-row" href="#/record/${r.id}">
        <span class="dl-day">${dd ? +dd : '—'}</span>
        <span class="grow" style="min-width:0"><span class="dl-title">${esc(r.title || RECORD_TYPES[r.type] || 'Документ')}</span>
          <span class="sub">${esc([RECORD_TYPES[r.type] || 'Документ', doctors[r.doctorId], clinics[r.clinicId]].filter(Boolean).join(' · '))}</span>
          ${secs.length ? `<span class="dl-secs">${secs.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</span>` : ''}</span>
        ${flagged[r.id] ? `<span class="tag high">${flagged[r.id]} вне нормы</span>` : ''}</a>`;
    };
    const firstYear = [...groups.keys()][0];
    $('#dlist').innerHTML = list.length ? [...groups.entries()].map(([y, months]) => {
      const n = [...months.values()].reduce((a, x) => a + x.length, 0);
      return `<details class="dl-year" ${y === firstYear || TL.year !== 'all' || q ? 'open' : ''}>
        <summary><span>${y === 'none' ? 'Без даты' : y}</span><span class="sub">${n} ${plural(n, 'запись', 'записи', 'записей')}</span></summary>
        ${[...months.entries()].map(([m, rs]) => `<div class="dl-month">${m ? MONTHS_FULL[m - 1] : ''}${m ? ` <span class="sub">· ${rs.length}</span>` : ''}</div>
          <div class="card" style="padding:4px 14px;gap:0">${rs.map(row).join('')}</div>`).join('')}
      </details>`;
    }).join('') : `<div class="card"><p class="empty" style="margin:0">${records.length ? 'Ничего не нашлось — измените поиск или фильтр.' : 'Записей пока нет.'}</p></div>`;
    $$('[data-tltype]').forEach(b => b.classList.toggle('on', b.dataset.tltype === TL.type));
    $$('[data-tlyear]').forEach(b => b.classList.toggle('on', b.dataset.tlyear === TL.year));
    $('#tlcount').textContent = list.length === records.length ? '' : `Найдено: ${list.length}`;
  };
  box.innerHTML = `
    <input class="in" id="tlq" type="search" value="${esc(TL.q)}" placeholder="Поиск: врач, клиника, анализ, диагноз" autocomplete="off">
    <div class="chips">${[['all', 'Всё'], ...types.map(t => [t, RECORD_TYPES[t] || 'Документ'])].map(([k, t]) => `<button type="button" class="pill" data-tltype="${k}">${esc(t)}</button>`).join('')}</div>
    ${years.length > 1 ? `<div class="chips">${[['all', 'Все годы'], ...years.map(y => [y, y])].map(([k, t]) => `<button type="button" class="pill" data-tlyear="${k}">${t}</button>`).join('')}</div>` : ''}
    <span class="sub" id="tlcount"></span>
    <div id="dlist" class="stack" style="gap:10px"></div>`;
  $('#tlq').oninput = e => { TL.q = e.target.value; clearTimeout(draw._t); draw._t = setTimeout(draw, 150); };
  $$('[data-tltype]').forEach(b => b.onclick = () => { TL.type = b.dataset.tltype; draw(); });
  $$('[data-tlyear]').forEach(b => b.onclick = () => { TL.year = b.dataset.tlyear; draw(); });
  draw();
}
