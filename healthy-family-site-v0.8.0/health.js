// Цикл, пыльца, экстренная карта, сводка для врача, динамика и ручные измерения.

// ---------- женский цикл (только для женских профилей людей) ----------
async function cycleStats(profileId) {
  const list = (await db.cycles.where('profileId').equals(profileId).toArray()).sort((a, b) => a.start.localeCompare(b.start));
  const gaps = [];
  for (let i = 1; i < list.length; i++) { const g = daysBetween(list[i - 1].start, list[i].start); if (g >= 15 && g <= 60) gaps.push(g); }
  const recent = gaps.slice(-6);
  const cycleLen = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : 28;
  const lens = list.filter(c => c.end).map(c => daysBetween(c.start, c.end) + 1).filter(n => n > 0 && n < 15).slice(-6);
  const periodLen = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 5;
  const last = list[list.length - 1] || null;
  const predictions = [];
  if (last) {
    let s = addDaysISO(last.start, cycleLen);
    while (s < todayISO()) s = addDaysISO(s, cycleLen); // если отметки давно не вносились
    for (let i = 0; i < 4; i++) { const st = addDaysISO(s, i * cycleLen); const ov = addDaysISO(st, -14); predictions.push({ start: st, end: addDaysISO(st, periodLen - 1), ovulation: ov, fertileFrom: addDaysISO(ov, -5), fertileTo: addDaysISO(ov, 1) }); }
  }
  const dayOfCycle = last && last.start <= todayISO() ? daysBetween(last.start, todayISO()) + 1 : null;
  return { list, cycleLen, periodLen, last, predictions, dayOfCycle, enough: gaps.length >= 2 };
}
async function cycleEvents(p, from, to) {
  const st = await cycleStats(p.id);
  const ev = [];
  for (const pr of st.predictions) {
    if (pr.start >= from && pr.start <= to) ev.push({ date: pr.start, kind: 'cycle', title: 'Месячные (прогноз)', sub: p.name, href: '#/cycle/' + p.id, done: true, profileId: p.id });
    if (pr.ovulation >= from && pr.ovulation <= to) ev.push({ date: pr.ovulation, kind: 'cycle', title: 'Овуляция (прогноз)', sub: p.name, href: '#/cycle/' + p.id, done: true, profileId: p.id, private: true });
  }
  return ev;
}
async function viewCycle(profileId, ym) {
  const p = await db.profiles.get(+profileId);
  if (!p || !isFemale(p)) { location.hash = '#/'; return; }
  const st = await cycleStats(p.id);
  const now = new Date();
  ym = ym || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [y, m] = ym.split('-').map(Number);
  const nDays = new Date(y, m, 0).getDate(), startDow = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const inRange = (d, a, b) => d >= a && d <= b;
  const open = st.last && !st.last.end;
  const dayClass = d => {
    for (const c of st.list) if (inRange(d, c.start, c.end || (open && c === st.last ? todayISO() : addDaysISO(c.start, st.periodLen - 1)))) return 'cy-period';
    for (const pr of st.predictions) {
      if (inRange(d, pr.start, pr.end)) return 'cy-pred';
      if (d === pr.ovulation) return 'cy-ovu';
      if (inRange(d, pr.fertileFrom, pr.fertileTo)) return 'cy-fert';
    }
    return '';
  };
  let cells = '';
  for (let i = 0; i < startDow; i++) cells += '<span></span>';
  for (let d = 1; d <= nDays; d++) { const iso = `${ym}-${String(d).padStart(2, '0')}`; cells += `<button type="button" class="calday ${dayClass(iso)}${iso === todayISO() ? ' today' : ''}" data-day="${iso}"><span>${d}</span></button>`; }
  const monthName = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'][m - 1];
  const shift = n => { const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const next = st.predictions[0];
  app.innerHTML = `<div class="top">${backLink('#/profile/' + p.id)}<div class="grow"><div class="sub">${esc(p.name)}</div><h1>Цикл</h1></div></div>
    <div class="pad stack">
      <section class="card" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px">
        <div><div class="sub">День цикла</div><div style="font-weight:700;font-size:22px">${st.dayOfCycle || '—'}</div></div>
        <div><div class="sub">Следующие</div><div style="font-weight:600">${next ? fmtDate(next.start) : '—'}</div><div class="sub">${next ? relDays(next.start) : 'нужна хотя бы одна отметка'}</div></div>
        <div><div class="sub">Длина цикла</div><div style="font-weight:600">${st.cycleLen} дн.${st.enough ? '' : ' <span class="sub">(по умолчанию)</span>'}</div></div>
        <div><div class="sub">Длительность</div><div style="font-weight:600">${st.periodLen} дн.</div></div>
      </section>
      <div class="row">
        ${open ? `<button type="button" class="btn" id="cend" style="flex:1">Закончились сегодня</button>` : `<button type="button" class="btn" id="cstart" style="flex:1">Начались сегодня</button>`}
      </div>
      <section class="card" style="padding:12px 10px">
        <div class="between" style="padding:0 6px"><button type="button" class="pill" data-ym="${shift(-1)}" aria-label="Предыдущий месяц">‹</button><span style="font-weight:600">${monthName} ${y}</span><button type="button" class="pill" data-ym="${shift(1)}" aria-label="Следующий месяц">›</button></div>
        <div class="calgrid">${['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map(d => `<span class="dow">${d}</span>`).join('')}${cells}</div>
        <div class="row" style="flex-wrap:wrap;gap:10px;padding:4px 6px 0;font-size:12px">
          <span><i class="lg cy-period"></i>Месячные</span><span><i class="lg cy-pred"></i>Прогноз</span><span><i class="lg cy-fert"></i>Фертильные дни</span><span><i class="lg cy-ovu"></i>Овуляция</span></div>
        <span class="sub" style="padding:0 6px">Нажмите на день, чтобы отметить начало месячных задним числом.</span>
      </section>
      <section class="card"><h2>История</h2>
        ${st.list.length ? st.list.slice().reverse().map(c => `<div class="row"><span class="grow">${fmtDate(c.start)} — ${c.end ? fmtDate(c.end) : 'идут'}<span class="sub">${c.end ? ' · ' + (daysBetween(c.start, c.end) + 1) + ' дн.' : ''}</span></span><button type="button" class="pill" data-cedit="${c.id}">Изменить</button></div>`).join('') : '<p class="empty" style="margin:0">Отметок пока нет. Внесите 2–3 последних цикла, чтобы прогноз стал точнее.</p>'}
      </section>
      <p class="sub" style="margin:0">Прогноз — среднее по вашим отметкам. Он приблизительный и не подходит как метод контрацепции. Нерегулярный цикл — повод обсудить с гинекологом.</p>
    </div>${nav('')}`;
  $$('[data-ym]').forEach(b => b.onclick = () => viewCycle(profileId, b.dataset.ym));
  const cs = $('#cstart'); if (cs) cs.onclick = async () => { await db.cycles.add({ profileId: p.id, start: todayISO(), end: null }); toast('Отмечено'); viewCycle(profileId, ym); };
  const ce = $('#cend'); if (ce) ce.onclick = async () => { await db.cycles.update(st.last.id, { end: todayISO() }); toast('Отмечено'); viewCycle(profileId, ym); };
  $$('[data-day]').forEach(b => b.onclick = () => cycleDialog(p.id, null, b.dataset.day, () => viewCycle(profileId, ym)));
  $$('[data-cedit]').forEach(b => b.onclick = async () => cycleDialog(p.id, await db.cycles.get(+b.dataset.cedit), null, () => viewCycle(profileId, ym)));
}
function cycleDialog(profileId, c, day, done) {
  const ov = document.createElement('div');
  ov.className = 'sheet';
  ov.innerHTML = `<form class="card sheet-card"><h2>${c ? 'Изменить отметку' : 'Отметить месячные'}</h2>
    <div class="grid2"><label class="f">Начало<input class="in" type="date" name="start" required value="${esc(c?.start || day || '')}"></label>
    <label class="f">Конец<input class="in" type="date" name="end" value="${esc(c?.end || '')}"></label></div>
    <div class="row"><button type="button" class="btn ghost" id="cc" style="flex:1">Отмена</button><button class="btn" type="submit" style="flex:1">Сохранить</button></div>
    ${c ? '<button type="button" class="btn danger" id="cdel">Удалить отметку</button>' : ''}</form>`;
  document.body.appendChild(ov);
  const f = ov.querySelector('form');
  ov.querySelector('#cc').onclick = () => ov.remove();
  f.onsubmit = async e => {
    e.preventDefault();
    if (f.end.value && f.end.value < f.start.value) { toast('Конец раньше начала'); return; }
    const data = { profileId, start: f.start.value, end: f.end.value || null };
    if (c) await db.cycles.update(c.id, data); else await db.cycles.add(data);
    ov.remove(); done();
  };
  const d = ov.querySelector('#cdel'); if (d) d.onclick = async () => { await db.cycles.delete(c.id); ov.remove(); done(); };
}

// ---------- пыльца ----------
// Примерные сезоны пыления по месяцам (0 — нет, 1 — слабо, 2 — умеренно, 3 — высоко).
// Обобщение многолетних наблюдений; в конкретный год сроки сдвигаются на 1–3 недели в зависимости от погоды.
const POLLEN_PLANTS = {
  alder: ['Ольха', /ольх/], hazel: ['Лещина (орешник)', /лещин|орешн|фундук/], birch: ['Берёза', /берез|берёз/], willow: ['Ива', /\bив[аы]/],
  oak: ['Дуб', /дуб/], pine: ['Сосна, ель', /сосн|ель|хвой/], cypress: ['Кипарисовые', /кипарис|туя|можжев/], grass: ['Злаковые травы', /злак|тимофеевк|ежа|овсяниц|мятлик|трав/],
  wormwood: ['Полынь', /полын/], chenopod: ['Маревые (лебеда)', /лебед|марев/], ragweed: ['Амброзия', /амброз/]
};
const POLLEN_REGIONS = {
  nw: ['Северо-Запад', { alder: [0, 0, 2, 3, 1], hazel: [0, 0, 2, 2], birch: [0, 0, 0, 1, 3, 1], willow: [0, 0, 0, 2, 1], oak: [0, 0, 0, 0, 2, 1], pine: [0, 0, 0, 0, 1, 2], grass: [0, 0, 0, 0, 0, 3, 3, 1], wormwood: [0, 0, 0, 0, 0, 0, 2, 3, 1], chenopod: [0, 0, 0, 0, 0, 0, 1, 2, 1] }],
  center: ['Центр', { alder: [0, 0, 2, 3], hazel: [0, 0, 2, 2], birch: [0, 0, 0, 2, 3], willow: [0, 0, 0, 2, 1], oak: [0, 0, 0, 0, 2], pine: [0, 0, 0, 0, 2, 1], grass: [0, 0, 0, 0, 0, 3, 3, 1], wormwood: [0, 0, 0, 0, 0, 0, 2, 3, 1], chenopod: [0, 0, 0, 0, 0, 0, 1, 2, 1], ragweed: [0, 0, 0, 0, 0, 0, 0, 1, 1] }],
  volga: ['Поволжье', { alder: [0, 0, 1, 3], hazel: [0, 0, 1, 2], birch: [0, 0, 0, 2, 3], oak: [0, 0, 0, 0, 2], grass: [0, 0, 0, 0, 1, 3, 2], wormwood: [0, 0, 0, 0, 0, 0, 2, 3, 1], chenopod: [0, 0, 0, 0, 0, 0, 1, 2, 1], ragweed: [0, 0, 0, 0, 0, 0, 0, 2, 2] }],
  south: ['Юг', { alder: [0, 2, 3], hazel: [0, 2, 2], cypress: [0, 0, 2, 1], birch: [0, 0, 0, 3], oak: [0, 0, 0, 2, 1], grass: [0, 0, 0, 0, 3, 3, 1], wormwood: [0, 0, 0, 0, 0, 0, 1, 2, 2], chenopod: [0, 0, 0, 0, 0, 0, 1, 2, 1], ragweed: [0, 0, 0, 0, 0, 0, 0, 3, 3, 1] }],
  siberia: ['Урал и Сибирь', { alder: [0, 0, 0, 2, 1], birch: [0, 0, 0, 0, 3, 1], willow: [0, 0, 0, 0, 1], pine: [0, 0, 0, 0, 0, 2], grass: [0, 0, 0, 0, 0, 2, 3], wormwood: [0, 0, 0, 0, 0, 0, 2, 3], chenopod: [0, 0, 0, 0, 0, 0, 0, 2] }]
};
async function myPollenAllergens(p) {
  const set = new Set(p.pollenAllergens || []);
  const allergies = (await db.history.where('profileId').equals(p.id).toArray()).filter(h => h.kind === 'allergy');
  for (const h of allergies) for (const [k, [, re]] of Object.entries(POLLEN_PLANTS)) if (re.test(String(h.name || '').toLowerCase())) set.add(k);
  return set;
}
async function viewPollen(profileId) {
  const p = await db.profiles.get(+profileId);
  if (!p || p.kind === 'pet') { location.hash = '#/'; return; }
  const region = localStorage.getItem('pollenRegion') || 'nw';
  const [rname, data] = POLLEN_REGIONS[region];
  const mine = await myPollenAllergens(p);
  const mNow = new Date().getMonth();
  const plants = Object.keys(data).sort((a, b) => (mine.has(b) - mine.has(a)) || data[a].findIndex(x => x) - data[b].findIndex(x => x));
  const now = plants.filter(k => (data[k][mNow] || 0) >= 1).sort((a, b) => (data[b][mNow] || 0) - (data[a][mNow] || 0));
  const lv = ['', 'слабо', 'умеренно', 'высоко'];
  const mn = ['я', 'ф', 'м', 'а', 'м', 'и', 'и', 'а', 'с', 'о', 'н', 'д'];
  app.innerHTML = `<div class="top">${backLink('#/profile/' + p.id)}<div class="grow"><div class="sub">${esc(p.name)}</div><h1>Календарь пыльцы</h1></div></div>
    <div class="pad stack">
      <label class="f">Регион<select class="in" id="preg">${Object.entries(POLLEN_REGIONS).map(([k, [n]]) => `<option value="${k}" ${k === region ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <section class="card"><h2>Сейчас обычно пылит</h2>
        ${now.length ? now.map(k => `<div class="between"><span style="${mine.has(k) ? 'font-weight:700;color:var(--high)' : ''}">${POLLEN_PLANTS[k][0]}${mine.has(k) ? ' — ваш аллерген' : ''}</span><span class="sub">${lv[data[k][mNow]]}</span></div>`).join('') : '<p class="empty" style="margin:0">В этом месяце в регионе обычно спокойно.</p>'}
      </section>
      <section class="card" style="padding:12px">
        <div class="pgrid"><span></span>${mn.map((x, i) => `<span class="pm${i === mNow ? ' now' : ''}">${x}</span>`).join('')}
        ${plants.map(k => `<span class="pn${mine.has(k) ? ' mine' : ''}">${POLLEN_PLANTS[k][0]}</span>${Array.from({ length: 12 }, (_, i) => `<span class="pc l${data[k][i] || 0}${i === mNow ? ' now' : ''}" title="${lv[data[k][i] || 0] || 'нет'}"></span>`).join('')}`).join('')}
        </div>
        <div class="row" style="gap:10px;font-size:12px;flex-wrap:wrap"><span><i class="lg pc l1"></i>слабо</span><span><i class="lg pc l2"></i>умеренно</span><span><i class="lg pc l3"></i>высоко</span></div>
      </section>
      <section class="card"><h2>Мои аллергены</h2>
        <span class="sub" style="margin-top:-6px">Отмеченные подсвечиваются. Пыльцевые аллергии из анамнеза отмечаются сами.</span>
        <div class="row" style="flex-wrap:wrap;gap:8px">${Object.entries(POLLEN_PLANTS).map(([k, [n]]) => `<button type="button" class="pill ${mine.has(k) ? 'on' : ''}" data-pl="${k}">${n}</button>`).join('')}</div>
      </section>
      <p class="sub" style="margin:0">Сроки примерные: по многолетним наблюдениям, в конкретный год цветение сдвигается из-за погоды. Прогноз на сегодня — на сайте <a href="https://pollen.club" target="_blank" rel="noopener">pollen.club</a>. Как готовиться к сезону, решайте с аллергологом.</p>
    </div>${nav('')}`;
  $('#preg').onchange = e => { localStorage.setItem('pollenRegion', e.target.value); viewPollen(profileId); };
  $$('[data-pl]').forEach(b => b.onclick = async () => {
    const cur = new Set(p.pollenAllergens || []); const k = b.dataset.pl;
    if (cur.has(k)) cur.delete(k); else cur.add(k);
    await db.profiles.update(p.id, { pollenAllergens: [...cur] }); viewPollen(profileId);
  });
}

// ---------- общие данные для экстренной карты и сводки ----------
function ageText(birth) {
  if (!birth) return '';
  const b = new Date(birth), n = new Date();
  let y = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) y--;
  if (y >= 1) return `${y} ${plural(y, 'год', 'года', 'лет')}`;
  const m = Math.max(0, (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth());
  return `${m} мес`;
}
async function profileFacts(p) {
  const hist = await db.history.where('profileId').equals(p.id).toArray();
  const t = todayISO();
  const meds = (await db.meds.where('profileId').equals(p.id).toArray()).filter(m => medActiveOn(m, t));
  const docs = await db.idDocs.where('profileId').equals(p.id).toArray();
  return {
    allergies: hist.filter(h => h.kind === 'allergy'),
    chronic: hist.filter(h => h.kind === 'diagnosis' && (h.status === 'chronic' || h.status === 'current')),
    past: hist.filter(h => h.kind === 'diagnosis' && h.status === 'past'),
    surgeries: hist.filter(h => h.kind === 'surgery'),
    injuries: hist.filter(h => h.kind === 'injury'),
    family: hist.filter(h => h.kind === 'family'),
    pregnancies: hist.filter(h => h.kind === 'pregnancy'),
    meds, docs
  };
}

// ---------- экстренная карта ----------
async function viewEmergency(profileId) {
  const p = await db.profiles.get(+profileId);
  if (!p) { location.hash = '#/'; return; }
  const f = await profileFacts(p);
  const pet = p.kind === 'pet';
  const oms = f.docs.find(d => d.type === 'oms'), dms = f.docs.find(d => d.type === 'dms'), chip = f.docs.find(d => d.type === 'chip');
  const line = (label, val) => val ? `<div class="em-row"><div class="em-l">${label}</div><div class="em-v">${val}</div></div>` : '';
  app.innerHTML = `<div class="emergency">
    <div class="between"><span class="em-l">ЭКСТРЕННАЯ КАРТА</span><a href="#/profile/${p.id}" class="em-close" aria-label="Закрыть">✕</a></div>
    <h1 style="color:#fff;font-size:30px">${esc(p.name)}</h1>
    <div class="em-l" style="margin-top:-8px">${pet ? esc([p.species, p.breed, p.sex === 'f' ? 'девочка' : 'мальчик'].filter(Boolean).join(' · ')) : esc([p.sex === 'f' ? 'женщина' : 'мужчина', p.birth ? fmtDate(p.birth) : ''].filter(Boolean).join(' · '))}${p.birth ? ' · ' + ageText(p.birth) : ''}</div>
    ${!pet ? line('Группа крови', esc([p.blood, p.rh].filter(Boolean).join(' ')) || 'не указана') : ''}
    ${line('Аллергии', f.allergies.length ? f.allergies.map(a => `<b>${esc(a.name)}</b>${a.reaction ? ' — ' + esc(a.reaction) : ''}`).join('<br>') : 'не указаны')}
    ${line('Хронические заболевания', f.chronic.map(d => esc(d.name) + (d.code ? ` <span class="em-l">${esc(d.code)}</span>` : '')).join('<br>'))}
    ${line('Принимает сейчас', f.meds.map(m => esc(m.name) + (m.dose ? ', ' + esc(m.dose) : '')).join('<br>'))}
    ${line('Операции', f.surgeries.map(s => esc(s.name) + (s.year ? ' (' + esc(s.year) + ')' : '')).join('<br>'))}
    ${pet && chip ? line('Чип', esc(chip.number || '')) : ''}
    ${!pet && oms ? line('Полис ОМС', esc(oms.number || '') + (oms.issuer ? '<br><span class="em-l">' + esc(oms.issuer) + '</span>' : '')) : ''}
    ${!pet && dms ? line('Полис ДМС', esc(dms.number || '') + (dms.phone ? `<br><a href="tel:${esc(dms.phone.replace(/[^\d+]/g, ''))}" style="color:#9CC7BE">${esc(dms.phone)}</a>` : '')) : ''}
    ${line(pet ? 'Владелец' : 'Экстренный контакт', p.contact ? esc(p.contact).replace(/(\+?[\d][\d\s()-]{6,}\d)/, m => `<a href="tel:${m.replace(/[^\d+]/g, '')}" style="color:#9CC7BE">${m}</a>`) : `<a href="#/profile/edit/${p.id}" style="color:#9CC7BE">Добавить контакт</a>`)}
    <p class="em-l" style="margin-top:auto">Данные внесены владельцем телефона в приложении Healthy Family. Для медицинских решений сверяйтесь с документами.</p>
  </div>`;
}

// ---------- сводка для врача (печать / PDF) ----------
async function viewSummary(profileId) {
  const p = await db.profiles.get(+profileId);
  if (!p) { location.hash = '#/'; return; }
  const sections = (await db.sections.where('profileId').equals(p.id).toArray()).sort((a, b) => a.order - b.order);
  const secId = +(new URLSearchParams(location.hash.split('?')[1] || '').get('s')) || 0;
  const f = await profileFacts(p);
  const pet = p.kind === 'pet';
  const since = addMonths(todayISO(), -12);
  let records = (await db.records.where('profileId').equals(p.id).toArray()).filter(r => (r.date || '') >= since);
  if (secId) records = records.filter(r => (r.sectionIds || []).includes(secId));
  records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const recIds = new Set(records.map(r => r.id));
  const res = (await db.results.where('profileId').equals(p.id).toArray()).filter(r => secId ? recIds.has(r.recordId) : true);
  const byM = new Map(); res.forEach(r => (byM.get(r.metricId) || byM.set(r.metricId, []).get(r.metricId)).push(r));
  const metricRows = [...byM.entries()].map(([id, list]) => { list.sort((a, b) => (b.date || '').localeCompare(a.date || '')); return { id, last: list[0], prev: list[1] }; })
    .filter(x => x.last.num !== null).sort((a, b) => ((b.last.status === 'low' || b.last.status === 'high') - (a.last.status === 'low' || a.last.status === 'high')) || (b.last.date || '').localeCompare(a.last.date || ''));
  const vac = (await db.vaccines.where('profileId').equals(p.id).toArray()).filter(v => v.status === 'done').sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 12);
  const list = (arr, fn) => arr.length ? `<ul>${arr.map(x => `<li>${fn(x)}</li>`).join('')}</ul>` : '<p class="sub">нет данных</p>';
  const births = f.pregnancies.filter(x => x.outcome === 'birth' || x.outcome === 'cesarean').length;
  app.innerHTML = `<div class="top noprint">${backLink('#/profile/' + p.id)}<h1 class="grow">Сводка для врача</h1></div>
    <div class="pad stack noprint">
      <label class="f">Для какого врача<select class="in" id="ssec"><option value="0">Все разделы</option>${sections.map(s => `<option value="${s.id}" ${s.id === secId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="f">Мои вопросы врачу (попадут в сводку)<textarea class="in" id="sq" placeholder="Например: почему снижается ферритин? нужно ли пересдать?">${esc(localStorage.getItem('sq-' + p.id) || '')}</textarea></label>
      <button type="button" class="btn" id="sprint">Печать или сохранить в PDF</button>
      <span class="sub">В окне печати выберите «Сохранить как PDF», чтобы отправить файл врачу.</span>
    </div>
    <article class="summary">
      <h1>${esc(p.name)}</h1>
      <p>${pet ? esc([p.species, p.breed, p.sex === 'f' ? 'девочка' : 'мальчик'].filter(Boolean).join(', ')) : esc(p.sex === 'f' ? 'Женщина' : 'Мужчина')}${p.birth ? ', ' + fmtDate(p.birth) + ' (' + ageText(p.birth) + ')' : ''}${!pet && (p.blood || p.rh) ? ' · группа крови ' + esc([p.blood, p.rh].filter(Boolean).join(' ')) : ''}</p>
      <p class="sub">Сводка за 12 месяцев${secId ? ' · раздел «' + esc((sections.find(s => s.id === secId) || {}).name || '') + '»' : ''} · составлена ${fmtDate(todayISO())}</p>
      <h2>Аллергии</h2>${list(f.allergies, a => `<b>${esc(a.name)}</b>${a.allergenType ? ' (' + esc(a.allergenType) + ')' : ''}${a.reaction ? ' — ' + esc(a.reaction) : ''}`)}
      <h2>Текущие и хронические заболевания</h2>${list(f.chronic, d => `${esc(d.name)}${d.code ? ' — ' + esc(d.code) : ''}${d.year ? ', с ' + esc(d.year) : ''}`)}
      <h2>Принимает сейчас</h2>${list(f.meds, m => `${esc(m.name)}${m.dose ? ', ' + esc(m.dose) : ''}${medTimes(m).length ? ' — ' + esc(medTimes(m).join(', ')) : ''}${m.days ? ` (курс ${m.days} дн. с ${fmtDate(m.start)})` : ''}`)}
      ${metricRows.length ? `<h2>Показатели (последние значения)</h2><table><thead><tr><th>Показатель</th><th>Последнее</th><th>Норма</th><th>Предыдущее</th></tr></thead><tbody>
        ${metricRows.slice(0, 40).map(({ id, last, prev }) => `<tr class="${last.status}"><td>${esc(Metrics.nameFor(id, last.rawName))}</td><td><b>${fmtNum(last.num)}</b> ${esc(last.unit)}${last.status === 'low' ? ' ↓' : last.status === 'high' ? ' ↑' : ''}<br><small>${fmtDate(last.date)}</small></td><td>${last.refLow !== null || last.refHigh !== null ? `${fmtNum(last.refLow ?? '')}–${fmtNum(last.refHigh ?? '')}` : esc(last.refText || '')}</td><td>${prev ? `${fmtNum(prev.num)} <small>${fmtDate(prev.date)}</small>` : '—'}</td></tr>`).join('')}</tbody></table>` : ''}
      <h2>Обращения и исследования</h2>${list(records, r => `${fmtDate(r.date)} — ${esc(r.title || RECORD_TYPES[r.type])}${r.conclusion ? `<br><small>${esc(r.conclusion.slice(0, 300))}</small>` : ''}`)}
      <h2>Перенесённые заболевания, операции, травмы</h2>${list([...f.past, ...f.surgeries, ...f.injuries], h => `${esc(h.name)}${h.code ? ' — ' + esc(h.code) : ''}${h.year ? ' (' + esc(h.year) + ')' : ''}`)}
      ${!pet && f.pregnancies.length ? `<h2>Беременности и роды</h2><p>Беременностей: ${f.pregnancies.length}, родов: ${births}</p>` : ''}
      ${!pet && f.family.length ? `<h2>Наследственность</h2>${list(f.family, h => `${esc(h.relative || '')}: ${esc(h.name)}`)}` : ''}
      <h2>Прививки${pet ? ' и обработки' : ''}</h2>${list(vac, v => `${fmtDate(v.date)} — ${esc(v.name)}${v.brand ? ' (' + esc(v.brand) + ')' : ''}`)}
      <div id="sqout"></div>
      <p class="sub">Составлено в приложении Healthy Family по данным, внесённым пациентом.</p>
    </article>${nav('')}`;
  const drawQ = () => { const q = $('#sq').value.trim(); $('#sqout').innerHTML = q ? `<h2>Вопросы к врачу</h2><p style="white-space:pre-wrap">${esc(q)}</p>` : ''; };
  drawQ();
  $('#sq').oninput = e => { localStorage.setItem('sq-' + p.id, e.target.value); drawQ(); };
  $('#ssec').onchange = e => { location.hash = `#/summary/${p.id}?s=${e.target.value}`; };
  $('#sprint').onclick = () => window.print();
}

// ---------- вкладка «Динамика» и ручные измерения ----------
const MANUAL_METRICS = [['Вес', 'кг'], ['Рост', 'см'], ['Давление верхнее', 'мм рт. ст.'], ['Давление нижнее', 'мм рт. ст.'], ['Пульс', 'уд/мин'], ['Температура', '°C'], ['Окружность талии', 'см'], ['Глюкоза', 'ммоль/л'], ['Сатурация', '%']];
function spark(vals) {
  if (vals.length < 2) return '';
  const W = 64, H = 22, min = Math.min(...vals), max = Math.max(...vals), k = max - min || 1;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline fill="none" stroke="#5B6270" stroke-width="1.5" points="${vals.map((v, i) => `${(i / (vals.length - 1) * (W - 4) + 2).toFixed(1)},${(H - 2 - (v - min) / k * (H - 4)).toFixed(1)}`).join(' ')}"/></svg>`;
}
async function viewDynamics() {
  const counts = await spaceCounts();
  const profiles = await spaceProfiles();
  const p = await currentProfile();
  if (!p) { app.innerHTML = `<div class="top"><h1 class="grow">Динамика</h1></div>${spaceSwitch(counts)}${emptySpace()}${nav('dynamics')}`; bindSpaceSwitch(); return; }
  const res = (await db.results.where('profileId').equals(p.id).toArray()).filter(r => r.num !== null);
  const byM = new Map(); res.forEach(r => (byM.get(r.metricId) || byM.set(r.metricId, []).get(r.metricId)).push(r));
  const groups = {};
  for (const [id, list] of byM) {
    list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const g = (Metrics.byId(id) || {}).group || (list.some(r => !r.recordId) ? 'Измерения' : 'Другие показатели');
    (groups[g] = groups[g] || []).push({ id, list, last: list[list.length - 1] });
  }
  app.innerHTML = `<div class="top"><h1 class="grow">Динамика</h1><a class="pill" href="#/measure/new" style="text-decoration:none;color:inherit">+ Измерение</a></div>
    ${spaceSwitch(counts)}${profileChips(profiles, p)}
    <div class="pad stack">
      <label class="in" style="display:flex;align-items:center;gap:8px"><span aria-hidden="true">⌕</span><input id="dq" placeholder="Найти показатель" style="border:none;outline:none;flex:1;background:transparent;font:inherit"></label>
      ${byM.size ? Object.entries(groups).sort().map(([g, items]) => `<section class="card dgroup"><h2>${esc(g)}</h2>
        ${items.sort((a, b) => Metrics.nameFor(a.id, a.last.rawName).localeCompare(Metrics.nameFor(b.id, b.last.rawName), 'ru')).map(({ id, list, last }) => `<a class="row dmetric" data-q="${esc(Metrics.nameFor(id, last.rawName).toLowerCase())}" href="#/metric/${encodeURIComponent(id)}" style="text-decoration:none;color:inherit;min-height:48px">
          <div class="grow"><div style="font-weight:500">${esc(Metrics.nameFor(id, last.rawName))}</div><div class="sub">${list.length} ${plural(list.length, 'значение', 'значения', 'значений')} · ${fmtDate(last.date)}</div></div>
          ${spark(list.slice(-8).map(r => r.num))}
          <span class="val ${last.status}">${fmtNum(last.num)}</span><span class="sub">${esc(last.unit)}</span></a>`).join('')}</section>`).join('')
      : `<section class="card"><p class="empty" style="margin:0">Здесь появятся все показатели из загруженных анализов с графиками по годам. Вес, давление, рост ${p.kind === 'pet' ? 'питомца' : 'ребёнка'} можно записывать вручную — кнопка «+ Измерение».</p></section>`}
    </div>${nav('dynamics')}`;
  bindProfileChips(); bindSpaceSwitch();
  $('#dq').oninput = e => { const q = e.target.value.trim().toLowerCase(); $$('.dmetric').forEach(a => a.style.display = !q || a.dataset.q.includes(q) ? '' : 'none'); };
}
async function viewMeasureNew() {
  const p = await currentProfile();
  if (!p) { location.hash = '#/'; return; }
  app.innerHTML = `<div class="top">${backLink('#/dynamics')}<div class="grow"><div class="sub">${esc(p.name)}</div><h1>Новое измерение</h1></div></div>
    <form id="msf" class="pad stack"><section class="card">
      <label class="f">Что измеряли<input class="in" name="name" list="mlist" required placeholder="Например, Вес"></label>
      <datalist id="mlist">${MANUAL_METRICS.map(([n]) => `<option value="${n}">`).join('')}</datalist>
      <div class="grid2"><label class="f">Значение<input class="in" name="value" inputmode="decimal" required></label>
      <label class="f">Единицы<input class="in" name="unit"></label></div>
      <label class="f">Дата<input class="in" type="date" name="date" value="${todayISO()}"></label>
    </section><button class="btn" type="submit">Сохранить</button></form>${nav('dynamics')}`;
  const f = $('#msf');
  f.name.oninput = () => { const m = MANUAL_METRICS.find(([n]) => n.toLowerCase() === f.name.value.trim().toLowerCase()); if (m && !f.unit.value) f.unit.value = m[1]; };
  f.onsubmit = async e => {
    e.preventDefault();
    const n = Metrics.normalizeResult({ name: f.name.value.trim(), value: f.value.value.trim(), unit: f.unit.value.trim() }, p);
    if (n.num === null) { toast('Введите число'); return; }
    await db.results.add({ recordId: 0, profileId: p.id, date: f.date.value || todayISO(), ...n });
    toast('Сохранено'); location.hash = '#/metric/' + encodeURIComponent(n.metricId);
  };
}
