// Уход: лекарства, прививки и обработки, напоминания, общий календарь и «Ближайшее».

// ---------- шаблоны прививок ----------
// Национальный календарь профилактических прививок РФ (приказ Минздрава № 1122н).
// Сроки в месяцах от рождения. Новые прививки (ветрянка, ротавирус, менингококк, ВПЧ) в нацкалендарь
// пока не включены — они ниже, в списке дополнительных.
const NAT_CALENDAR = [
  ['Гепатит B — 1', 'Гепатит B', 0, 'В первые 24 часа жизни'],
  ['Туберкулёз (БЦЖ)', 'Туберкулёз', 0, 'На 3–7 день жизни'],
  ['Гепатит B — 2', 'Гепатит B', 1],
  ['Пневмококк — 1', 'Пневмококковая инфекция', 2],
  ['АКДС — 1', 'Дифтерия, коклюш, столбняк', 3],
  ['Полиомиелит — 1', 'Полиомиелит', 3],
  ['Гемофильная инфекция — 1', 'Гемофильная инфекция типа b', 3],
  ['Пневмококк — 2', 'Пневмококковая инфекция', 4.5],
  ['АКДС — 2', 'Дифтерия, коклюш, столбняк', 4.5],
  ['Полиомиелит — 2', 'Полиомиелит', 4.5],
  ['Гемофильная инфекция — 2', 'Гемофильная инфекция типа b', 4.5],
  ['Гепатит B — 3', 'Гепатит B', 6],
  ['АКДС — 3', 'Дифтерия, коклюш, столбняк', 6],
  ['Полиомиелит — 3', 'Полиомиелит', 6],
  ['Гемофильная инфекция — 3', 'Гемофильная инфекция типа b', 6],
  ['Грипп', 'Грипп', 6, 'Затем ежегодно перед сезоном', 12],
  ['Корь, краснуха, паротит', 'Корь, краснуха, эпидемический паротит', 12],
  ['Пневмококк — ревакцинация', 'Пневмококковая инфекция', 15],
  ['АКДС — ревакцинация 1', 'Дифтерия, коклюш, столбняк', 18],
  ['Полиомиелит — ревакцинация 1', 'Полиомиелит', 18],
  ['Гемофильная инфекция — ревакцинация', 'Гемофильная инфекция типа b', 18],
  ['Полиомиелит — ревакцинация 2', 'Полиомиелит', 20],
  ['Корь, краснуха, паротит — ревакцинация', 'Корь, краснуха, эпидемический паротит', 72],
  ['Полиомиелит — ревакцинация 3', 'Полиомиелит', 72],
  ['АДС-М — ревакцинация 2', 'Дифтерия, столбняк', 72, '6–7 лет'],
  ['Туберкулёз — ревакцинация', 'Туберкулёз', 72, '6–7 лет, по решению врача'],
  ['АДС-М — ревакцинация 3', 'Дифтерия, столбняк', 168, '14 лет, далее каждые 10 лет', 120]
];
const EXTRA_VACCINES = [
  ['Ветряная оспа', 'Ветряная оспа', 'Не входит в нацкалендарь; с 12 месяцев, по решению врача'],
  ['Ротавирус', 'Ротавирусная инфекция', 'Не входит в нацкалендарь; с 6 недель, по решению врача'],
  ['Менингококк', 'Менингококковая инфекция', 'Не входит в нацкалендарь; по решению врача'],
  ['ВПЧ', 'Вирус папилломы человека', 'Не входит в нацкалендарь; чаще в 9–14 лет'],
  ['Клещевой энцефалит', 'Клещевой вирусный энцефалит', 'Для эндемичных регионов, в т. ч. Ленинградской области'],
  ['Гепатит A', 'Гепатит A', 'По показаниям и перед поездками'],
  ['COVID-19', 'COVID-19', 'По решению врача']
];
const ADULT_VACCINES = [
  ['АДС-М', 'Дифтерия, столбняк', 'Каждые 10 лет после последней', 120],
  ['Грипп', 'Грипп', 'Ежегодно перед сезоном', 12],
  ['Корь', 'Корь', 'До 35 лет, если не болели и не привиты или привиты однократно'],
  ['Гепатит B', 'Гепатит B', 'Если не прививались ранее'],
  ['Краснуха', 'Краснуха', 'Женщинам до 25 лет, если не болели и не привиты']
];
// Питомцы: типовая схема, точную назначает ветеринар
const PET_SCHEMES = {
  'Собака': [
    ['Комплексная — 1', 'Чума, парвовироз, аденовироз, парагрипп, лептоспироз', 2, 'vaccine'],
    ['Комплексная — 2', 'Чума, парвовироз, аденовироз, парагрипп, лептоспироз', 3, 'vaccine'],
    ['Бешенство', 'Бешенство', 3, 'vaccine', 12],
    ['Комплексная — ежегодно', 'Чума, парвовироз, аденовироз, парагрипп, лептоспироз', 15, 'vaccine', 12]
  ],
  'Кошка': [
    ['Комплексная — 1', 'Панлейкопения, калицивироз, ринотрахеит', 2, 'vaccine'],
    ['Комплексная — 2', 'Панлейкопения, калицивироз, ринотрахеит', 3, 'vaccine'],
    ['Бешенство', 'Бешенство', 3, 'vaccine', 12],
    ['Комплексная — ежегодно', 'Панлейкопения, калицивироз, ринотрахеит', 15, 'vaccine', 12]
  ]
};
const PET_TREATMENTS = [
  ['Глистогонное', 'Обработка от гельминтов', 'treatment', 3],
  ['От клещей и блох', 'Обработка от эктопаразитов', 'treatment', 1]
];

function birthPlus(birth, months) {
  const d = new Date(birth + 'T12:00:00');
  d.setDate(d.getDate() + Math.round(months * 30.44));
  return d.toISOString().slice(0, 10);
}

// Заполнить план прививок по шаблону (без дублей)
async function seedVaccines(profileId, force = false) {
  const p = await db.profiles.get(profileId);
  if (!p) return 0;
  const existing = await db.vaccines.where('profileId').equals(profileId).toArray();
  if (existing.length && !force) return 0;
  const have = new Set(existing.map(v => v.name));
  const add = [];
  if (p.kind === 'child' && p.birth) {
    for (const [name, disease, m, note, rep] of NAT_CALENDAR)
      if (!have.has(name)) add.push({ profileId, name, disease, kind: 'vaccine', status: 'planned', plannedDate: birthPlus(p.birth, m), note: note || '', repeatMonths: rep || null, source: 'nat' });
  } else if (p.kind === 'adult') {
    for (const [name, disease, note, rep] of ADULT_VACCINES.slice(0, 2))
      if (!have.has(name)) add.push({ profileId, name, disease, kind: 'vaccine', status: 'planned', plannedDate: name === 'Грипп' ? nextAutumn() : null, note, repeatMonths: rep, source: 'adult' });
  } else if (p.kind === 'pet') {
    const scheme = PET_SCHEMES[p.species] || [];
    for (const [name, disease, m, kind, rep] of scheme)
      if (!have.has(name)) add.push({ profileId, name, disease, kind, status: 'planned', plannedDate: p.birth ? birthPlus(p.birth, m) : null, note: 'Типовая схема — уточните у ветеринара', repeatMonths: rep || null, source: 'pet' });
    for (const [name, disease, kind, rep] of PET_TREATMENTS)
      if (!have.has(name)) add.push({ profileId, name, disease, kind, status: 'planned', plannedDate: todayISO(), note: 'Интервал и препарат — по схеме ветеринара', repeatMonths: rep, source: 'pet' });
  }
  if (add.length) await db.vaccines.bulkAdd(add);
  return add.length;
}
function nextAutumn() {
  const d = new Date(); const y = d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear();
  return `${y}-09-15`;
}

// ---------- лекарства ----------
const medTimes = m => (m.times || []).filter(Boolean);
function medEndDate(m) { return m.days ? birthPlusDays(m.start, m.days - 1) : null; }
function birthPlusDays(d, n) { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + +n); return x.toISOString().slice(0, 10); }
function medActiveOn(m, date) {
  if (m.active === false || !m.start || m.start > date) return false;
  const end = medEndDate(m);
  return !end || date <= end;
}
function medStockDays(m) {
  if (m.stock === null || m.stock === undefined || m.stock === '') return null;
  const perDay = (+m.perDose || 1) * Math.max(1, medTimes(m).length);
  return Math.floor(+m.stock / perDay);
}
async function todayMeds(p) {
  const t = todayISO();
  const meds = (await db.meds.where('profileId').equals(p.id).toArray()).filter(m => medActiveOn(m, t));
  const out = [];
  for (const m of meds) {
    const logs = await db.medLogs.where('[medId+date]').equals([m.id, t]).toArray();
    for (const time of (medTimes(m).length ? medTimes(m) : ['—'])) out.push({ med: m, time, taken: logs.some(l => l.time === time) });
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}
async function toggleTaken(medId, time, on) {
  const t = todayISO(), m = await db.meds.get(medId);
  const logs = await db.medLogs.where('[medId+date]').equals([medId, t]).toArray();
  const has = logs.find(l => l.time === time);
  const per = +m.perDose || 1;
  if (on && !has) {
    await db.medLogs.add({ medId, profileId: m.profileId, date: t, time, takenAt: new Date().toISOString() });
    if (m.stock !== null && m.stock !== undefined && m.stock !== '') await db.meds.update(medId, { stock: Math.max(0, +m.stock - per) });
  } else if (!on && has) {
    await db.medLogs.delete(has.id);
    if (m.stock !== null && m.stock !== undefined && m.stock !== '') await db.meds.update(medId, { stock: +m.stock + per });
  }
  const left = medStockDays(await db.meds.get(medId));
  if (on && left !== null && left <= 5) toast(`${m.name}: осталось на ${left} ${plural(left, 'день', 'дня', 'дней')} — пора купить`);
}
function medProgress(m) {
  const t = todayISO();
  const parts = [];
  if (m.days) {
    const n = Math.min(m.days, Math.max(0, daysBetween(m.start, t) + 1));
    parts.push(t > medEndDate(m) ? `Курс завершён ${fmtDate(medEndDate(m))}` : m.start > t ? `Начало ${fmtDate(m.start)}` : `День ${n} из ${m.days}`);
  } else parts.push(m.start ? `Постоянно · с ${fmtDate(m.start)}` : 'Постоянно');
  const left = medStockDays(m);
  if (left !== null) parts.push(left <= 5 ? `осталось ${m.stock} шт — пора купить` : `осталось ${m.stock} шт`);
  return { text: parts.join(' · '), pct: m.days ? Math.min(100, Math.max(0, (daysBetween(m.start, t) + 1) / m.days * 100)) : 100, low: left !== null && left <= 5 };
}

async function viewMeds(profileId) {
  const p = await db.profiles.get(+profileId);
  if (!p) { location.hash = '#/'; return; }
  const meds = await db.meds.where('profileId').equals(p.id).toArray();
  const t = todayISO();
  const active = meds.filter(m => m.active !== false && (!medEndDate(m) || medEndDate(m) >= t));
  const past = meds.filter(m => !active.includes(m));
  const card = m => { const pr = medProgress(m); return `<a class="card" href="#/med/${m.id}" style="text-decoration:none;color:inherit;gap:8px">
      <div class="between"><span style="font-weight:600">${esc(m.name)}${m.dose ? ' · ' + esc(m.dose) : ''}</span><span class="sub">${esc(medTimes(m).join(', '))}</span></div>
      <div style="height:6px;border-radius:3px;background:var(--soft);overflow:hidden"><div style="height:100%;width:${pr.pct}%;background:${pr.low ? 'var(--high)' : 'var(--accent)'}"></div></div>
      <span class="sub" style="${pr.low ? 'color:var(--high);font-weight:600' : ''}">${esc(pr.text)}</span></a>`; };
  app.innerHTML = `<div class="top">${backLink('#/profile/' + p.id)}<div class="grow"><div class="sub">${esc(p.name)}</div><h1>Лекарства</h1></div></div>
    <div class="pad stack">
      ${active.length ? active.map(card).join('') : '<div class="card"><p class="empty" style="margin:0">Добавьте лекарство или добавку — приложение покажет, что принять сегодня, и предупредит, когда пора купить.</p></div>'}
      <a class="btn" href="#/med/new/${p.id}">Добавить лекарство</a>
      ${past.length ? `<h2 style="margin-top:8px">Завершённые</h2>${past.map(card).join('')}` : ''}
    </div>${nav('')}`;
}

async function viewMedForm(mode, arg) {
  const isNew = mode === 'new';
  const m = isNew ? { profileId: +arg, times: ['09:00'], start: todayISO(), perDose: 1 } : await db.meds.get(+arg);
  if (!m) { location.hash = '#/'; return; }
  const p = await db.profiles.get(m.profileId);
  app.innerHTML = `<div class="top">${backLink(isNew ? '#/meds/' + p.id : '#/meds/' + p.id)}<div class="grow"><div class="sub">${esc(p.name)}</div><h1>${isNew ? 'Новое лекарство' : 'Лекарство'}</h1></div></div>
    <form id="mf" class="pad stack">
      <section class="card">
        <label class="f">Название<input class="in" name="name" required value="${esc(m.name || '')}" placeholder="Например, Железо"></label>
        <label class="f">Дозировка<input class="in" name="dose" value="${esc(m.dose || '')}" placeholder="Например, 100 мг"></label>
        <label class="f">Время приёма через запятую<input class="in" name="times" value="${esc(medTimes(m).join(', '))}" placeholder="09:00, 21:00"></label>
        <div class="grid2">
          <label class="f">Начало<input class="in" type="date" name="start" value="${esc(m.start || '')}"></label>
          <label class="f">Дней курса (пусто — постоянно)<input class="in" name="days" inputmode="numeric" value="${esc(m.days || '')}"></label>
          <label class="f">Осталось, шт<input class="in" name="stock" inputmode="numeric" value="${esc(m.stock ?? '')}" placeholder="Необязательно"></label>
          <label class="f">Штук за приём<input class="in" name="perDose" inputmode="decimal" value="${esc(m.perDose ?? 1)}"></label>
        </div>
        <label class="f">Заметка<textarea class="in" name="note" placeholder="Кто назначил, до или после еды, с чем не сочетать">${esc(m.note || '')}</textarea></label>
      </section>
      <button class="btn" type="submit">Сохранить</button>
      ${isNew ? '' : `<button type="button" class="btn ghost" id="mics">Добавить напоминания в календарь телефона</button>
        <button type="button" class="btn ghost" id="mstop">${m.active === false ? 'Возобновить приём' : 'Закончить приём'}</button>
        <button type="button" class="btn danger" id="mdel">Удалить</button>`}
    </form>${nav('')}`;
  $('#mf').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, num = v => (String(v).trim() === '' ? null : +String(v).replace(',', '.'));
    const times = f.times.value.split(/[,;\s]+/).map(x => x.trim()).filter(x => /^\d{1,2}[:.]\d{2}$/.test(x)).map(x => x.replace('.', ':').padStart(5, '0'));
    const data = { profileId: p.id, name: f.name.value.trim(), dose: f.dose.value.trim(), times, start: f.start.value || todayISO(), days: num(f.days.value), stock: num(f.stock.value), perDose: num(f.perDose.value) || 1, note: f.note.value.trim(), active: m.active !== false };
    if (isNew) await db.meds.add(data); else await db.meds.update(m.id, data);
    toast('Сохранено'); location.hash = '#/meds/' + p.id;
  };
  if (!isNew) {
    $('#mdel').onclick = async () => { if (!confirm('Удалить лекарство и историю приёма?')) return; await db.medLogs.where('medId').equals(m.id).delete(); await db.meds.delete(m.id); location.hash = '#/meds/' + p.id; };
    $('#mstop').onclick = async () => { await db.meds.update(m.id, { active: m.active === false }); location.hash = '#/meds/' + p.id; };
    $('#mics').onclick = () => downloadICS(`${m.name}.ics`, medTimes(m).map(time => ({
      title: `${m.name}${m.dose ? ' ' + m.dose : ''} — ${p.name}`, date: m.start, time, days: m.days || 365, alarm: 0
    })));
  }
}

// ---------- прививки ----------
async function viewVaccines(profileId) {
  const p = await db.profiles.get(+profileId);
  if (!p) { location.hash = '#/'; return; }
  const pet = p.kind === 'pet';
  const all = await db.vaccines.where('profileId').equals(p.id).toArray();
  const t = todayISO();
  const done = all.filter(v => v.status === 'done').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const planned = all.filter(v => v.status !== 'done' && v.status !== 'skipped');
  const overdue = planned.filter(v => v.plannedDate && v.plannedDate < t).sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  const upcoming = planned.filter(v => v.plannedDate && v.plannedDate >= t).sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  const nodate = planned.filter(v => !v.plannedDate);
  const row = v => `<div class="row" style="min-height:48px">
      <button type="button" class="grow" data-vac="${v.id}" style="border:none;background:none;text-align:left;padding:0;cursor:pointer;color:inherit">
        <div style="font-weight:500">${esc(v.name)}${v.kind === 'treatment' ? ' <span class="tag kind">обработка</span>' : ''}</div>
        <div class="sub">${v.status === 'done' ? 'Сделано ' + fmtDate(v.date) + (v.brand ? ' · ' + esc(v.brand) : '') : v.plannedDate ? fmtDate(v.plannedDate) + ' · ' + relDays(v.plannedDate) : esc(v.note || 'Дата не задана')}</div></button>
      ${v.status !== 'done' ? `<button type="button" class="pill" data-ok="${v.id}">Сделано</button>` : ''}</div>`;
  const block = (title, list, extra = '') => list.length ? `<section class="card"><div class="between"><h2>${title}</h2>${extra}</div>${list.map(row).join('')}</section>` : '';
  const isChild = p.kind === 'child';
  app.innerHTML = `<div class="top">${backLink('#/profile/' + p.id)}<div class="grow"><div class="sub">${esc(p.name)}</div><h1>${pet ? 'Прививки и обработки' : 'Прививки'}</h1></div></div>
    <div class="pad stack">
      ${!all.length ? `<section class="card"><p class="empty" style="margin:0">${pet ? 'Заполните типовую схему для ' + (p.species === 'Кошка' ? 'кошки' : 'собаки') + ' — даты посчитаются от дня рождения. Точную схему назначает ветеринар.' : isChild ? 'Заполните план по национальному календарю — даты посчитаются от дня рождения.' : 'Добавьте прививки взрослого: АДС-М каждые 10 лет, грипп ежегодно и другие.'}</p>
        <button type="button" class="btn" id="seed">${pet ? 'Заполнить типовую схему' : isChild ? 'Заполнить по нацкалендарю' : 'Добавить основные прививки'}</button></section>` : ''}
      ${block('Проверьте прошедшие', overdue, overdue.length > 1 ? '<button type="button" class="linkbtn" id="alldone">Все сделаны</button>' : '')}
      ${block('Предстоящие', upcoming)}
      ${block('Без даты', nodate)}
      ${block('Сделано', done)}
      <a class="btn" href="#/vaccine/new/${p.id}">Добавить ${pet ? 'прививку или обработку' : 'прививку'}</a>
      ${!pet ? `<section class="card"><h2>Дополнительные прививки</h2><span class="sub" style="margin-top:-6px">Вне нацкалендаря. Решение — вместе с врачом.</span>
        ${(isChild ? EXTRA_VACCINES : [...ADULT_VACCINES.slice(2), ...EXTRA_VACCINES.slice(4)]).map(([n, d, note], i) => `<div class="row"><div class="grow"><div style="font-weight:500">${esc(n)}</div><div class="sub">${esc(note)}</div></div><button type="button" class="pill" data-extra="${i}">+</button></div>`).join('')}</section>` : ''}
      <p class="sub" style="margin:0">${pet ? 'Типовая схема — ориентир. Препараты, интервалы и сроки определяет ветеринар.' : 'План построен по национальному календарю прививок РФ (приказ Минздрава № 1122н). Окончательные сроки и показания определяет врач.'}</p>
    </div>${nav('')}`;
  const seed = $('#seed');
  if (seed) seed.onclick = async () => {
    if (!pet && isChild && !p.birth) { toast('Укажите дату рождения в профиле'); location.hash = '#/profile/edit/' + p.id; return; }
    const n = await seedVaccines(p.id, true); toast(`Добавлено: ${n}`); viewVaccines(p.id);
  };
  $$('[data-vac]').forEach(b => b.onclick = () => { location.hash = '#/vaccine/' + b.dataset.vac; });
  $$('[data-ok]').forEach(b => b.onclick = async () => { await markVaccineDone(+b.dataset.ok, todayISO()); viewVaccines(p.id); });
  const ad = $('#alldone');
  if (ad) ad.onclick = async () => {
    if (!confirm('Отметить все прошедшие как сделанные в плановую дату? Потом каждую можно поправить.')) return;
    for (const v of overdue) await db.vaccines.update(v.id, { status: 'done', date: v.plannedDate });
    viewVaccines(p.id);
  };
  const list = isChild ? EXTRA_VACCINES : [...ADULT_VACCINES.slice(2), ...EXTRA_VACCINES.slice(4)];
  $$('[data-extra]').forEach(b => b.onclick = async () => {
    const [name, disease, note] = list[+b.dataset.extra];
    await db.vaccines.add({ profileId: p.id, name, disease, kind: 'vaccine', status: 'planned', plannedDate: null, note, source: 'extra' });
    toast('Добавлено'); viewVaccines(p.id);
  });
}
async function markVaccineDone(id, date) {
  const v = await db.vaccines.get(id);
  await db.vaccines.update(id, { status: 'done', date });
  if (v.repeatMonths) {
    const next = addMonths(date, v.repeatMonths);
    const dup = await db.vaccines.where('profileId').equals(v.profileId).filter(x => x.name === v.name && x.status === 'planned').first();
    if (dup) await db.vaccines.update(dup.id, { plannedDate: next });
    else await db.vaccines.add({ ...v, id: undefined, status: 'planned', date: null, plannedDate: next, brand: '', batch: '' });
  }
  toast('Отмечено' + (v.repeatMonths ? `, следующая — ${fmtDate(addMonths(date, v.repeatMonths))}` : ''));
}

async function viewVaccineForm(mode, arg) {
  const isNew = mode === 'new';
  const v = isNew ? { profileId: +arg, status: 'planned', kind: 'vaccine' } : await db.vaccines.get(+arg);
  if (!v) { location.hash = '#/'; return; }
  const p = await db.profiles.get(v.profileId);
  const pet = p.kind === 'pet';
  app.innerHTML = `<div class="top">${backLink('#/vaccines/' + p.id)}<div class="grow"><div class="sub">${esc(p.name)}</div><h1>${isNew ? 'Новая запись' : esc(v.name)}</h1></div></div>
    <form id="vf" class="pad stack">
      <section class="card">
        ${pet ? `<label class="f">Что это<select class="in" name="kind"><option value="vaccine" ${v.kind !== 'treatment' ? 'selected' : ''}>Прививка</option><option value="treatment" ${v.kind === 'treatment' ? 'selected' : ''}>Обработка (глисты, клещи, блохи)</option></select></label>` : ''}
        <label class="f">Название<input class="in" name="name" required value="${esc(v.name || '')}" placeholder="${pet ? 'Например, Нобивак DHPPi+L' : 'Например, Грипп'}"></label>
        <label class="f">От чего<input class="in" name="disease" value="${esc(v.disease || '')}"></label>
        <label class="f">Статус<select class="in" name="status"><option value="planned" ${v.status === 'planned' ? 'selected' : ''}>Запланирована</option><option value="done" ${v.status === 'done' ? 'selected' : ''}>Сделана</option><option value="skipped" ${v.status === 'skipped' ? 'selected' : ''}>Не делаем</option></select></label>
        <div class="grid2">
          <label class="f">Дата, когда сделали<input class="in" type="date" name="date" value="${esc(v.date || '')}"></label>
          <label class="f">Плановая дата<input class="in" type="date" name="plannedDate" value="${esc(v.plannedDate || '')}"></label>
        </div>
        <label class="f">Препарат<input class="in" name="brand" value="${esc(v.brand || '')}" placeholder="Название вакцины или средства"></label>
        <div class="grid2">
          <label class="f">Серия<input class="in" name="batch" value="${esc(v.batch || '')}"></label>
          <label class="f">Повторять раз в, мес<input class="in" name="repeatMonths" inputmode="numeric" value="${esc(v.repeatMonths || '')}" placeholder="Например, 12"></label>
        </div>
        <label class="f">${pet ? 'Ветклиника' : 'Клиника'}<input class="in" name="clinic" value="${esc(v.clinic || '')}"></label>
        <label class="f">Заметка<textarea class="in" name="note" placeholder="Реакция, кто назначил">${esc(v.note || '')}</textarea></label>
      </section>
      <button class="btn" type="submit">Сохранить</button>
      ${isNew ? '' : `<button type="button" class="btn ghost" id="vics">Добавить в календарь телефона</button><button type="button" class="btn danger" id="vdel">Удалить</button>`}
    </form>${nav('')}`;
  $('#vf').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target), data = { profileId: p.id };
    for (const [k, val] of fd.entries()) data[k] = String(val).trim();
    data.kind = data.kind || 'vaccine';
    data.repeatMonths = data.repeatMonths ? +data.repeatMonths : null;
    data.date = data.date || null; data.plannedDate = data.plannedDate || null;
    if (data.status === 'done' && !data.date) data.date = todayISO();
    if (isNew) { const id = await db.vaccines.add(data); if (data.status === 'done' && data.repeatMonths) await markVaccineDone(id, data.date); }
    else {
      const wasDone = v.status === 'done';
      await db.vaccines.update(v.id, data);
      if (!wasDone && data.status === 'done' && data.repeatMonths) await markVaccineDone(v.id, data.date);
    }
    toast('Сохранено'); location.hash = '#/vaccines/' + p.id;
  };
  if (!isNew) {
    $('#vdel').onclick = async () => { if (!confirm('Удалить запись о прививке?')) return; await db.vaccines.delete(v.id); location.hash = '#/vaccines/' + p.id; };
    $('#vics').onclick = () => { const d = v.plannedDate || v.date; if (!d) { toast('Сначала укажите дату'); return; } downloadICS(`${v.name}.ics`, [{ title: `${v.name} — ${p.name}`, date: d, allDay: true, alarm: 1440 }]); };
  }
}

// ---------- напоминания о пересдаче ----------
function reminderDialog(profileId, metricId, name) {
  const def = addMonths(todayISO(), 3);
  const ov = document.createElement('div');
  ov.className = 'sheet';
  ov.innerHTML = `<form class="card sheet-card"><h2>Напомнить о пересдаче</h2>
    <label class="f">Что<input class="in" name="title" value="Пересдать: ${esc(name)}"></label>
    <label class="f">Когда<input class="in" type="date" name="date" value="${def}"></label>
    <div class="row">${[1, 3, 6, 12].map(n => `<button type="button" class="pill" data-m="${n}">${n === 12 ? 'Год' : n + ' мес'}</button>`).join('')}</div>
    <div class="row"><button type="button" class="btn ghost" id="rc" style="flex:1">Отмена</button><button class="btn" type="submit" style="flex:1">Сохранить</button></div>
    <button type="button" class="btn ghost" id="rics">Сохранить и добавить в календарь телефона</button></form>`;
  document.body.appendChild(ov);
  const f = ov.querySelector('form');
  ov.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { f.date.value = addMonths(todayISO(), +b.dataset.m); });
  ov.querySelector('#rc').onclick = () => ov.remove();
  const save = async () => { await db.reminders.add({ profileId, metricId, title: f.title.value.trim(), date: f.date.value, kind: 'retest', done: false }); ov.remove(); toast('Напоминание добавлено в календарь приложения'); };
  f.onsubmit = async e => { e.preventDefault(); await save(); };
  ov.querySelector('#rics').onclick = async () => { const p = await db.profiles.get(profileId); downloadICS('Пересдача.ics', [{ title: `${f.title.value} — ${p.name}`, date: f.date.value, allDay: true, alarm: 1440 }]); await save(); };
}

// ---------- события для календаря и «Ближайшего» ----------
const EVENT_KINDS = { vaccine: ['Прививка', '#8A3A1A', '#F1E9E4'], treatment: ['Обработка', '#6E5A1A', '#F4EEDC'], plan: ['Осмотр', '#0E6B66', '#E6F0EF'], retest: ['Анализ', '#2457A6', '#E3EBF7'], med: ['Лекарства', '#6B4FA0', '#EEE8F7'], cycle: ['Цикл', '#B5547F', '#F3E4EC'] };
async function collectEvents(profiles, from, to) {
  const ids = new Set(profiles.map(p => p.id)), name = Object.fromEntries(profiles.map(p => [p.id, p.name]));
  const ev = [];
  for (const v of await db.vaccines.toArray()) {
    if (!ids.has(v.profileId) || v.status === 'skipped') continue;
    const d = v.status === 'done' ? v.date : v.plannedDate;
    if (d && d >= from && d <= to) ev.push({ date: d, kind: v.kind === 'treatment' ? 'treatment' : 'vaccine', title: v.name, sub: name[v.profileId] + (v.status === 'done' ? ' · сделано' : v.repeatMonths ? ` · раз в ${monthsText(v.repeatMonths)}` : ''), href: '#/vaccine/' + v.id, done: v.status === 'done', profileId: v.profileId });
  }
  for (const pl of await db.plans.toArray()) {
    if (!ids.has(pl.profileId) || !pl.nextDate || pl.nextDate < from || pl.nextDate > to) continue;
    const s = await db.sections.get(pl.sectionId);
    ev.push({ date: pl.nextDate, kind: 'plan', title: pl.name, sub: name[pl.profileId] + (s ? ' · ' + s.name : ''), href: '#/section/' + pl.sectionId, profileId: pl.profileId });
  }
  for (const r of await db.reminders.toArray()) {
    if (!ids.has(r.profileId) || r.done || r.date < from || r.date > to) continue;
    ev.push({ date: r.date, kind: 'retest', title: r.title, sub: name[r.profileId], href: r.metricId ? '#/metric/' + encodeURIComponent(r.metricId) + '?p=' + r.profileId : '#/calendar', reminderId: r.id, profileId: r.profileId });
  }
  for (const m of await db.meds.toArray()) {
    if (!ids.has(m.profileId) || m.active === false) continue;
    const end = medEndDate(m);
    if (m.start >= from && m.start <= to) ev.push({ date: m.start, kind: 'med', title: 'Начать: ' + m.name, sub: name[m.profileId], href: '#/med/' + m.id, profileId: m.profileId });
    if (end && end >= from && end <= to) ev.push({ date: end, kind: 'med', title: 'Последний день: ' + m.name, sub: name[m.profileId], href: '#/med/' + m.id, profileId: m.profileId });
    const left = medStockDays(m);
    if (left !== null && left <= 5 && medActiveOn(m, todayISO())) { const d = todayISO(); if (d >= from && d <= to) ev.push({ date: d, kind: 'med', title: `Купить: ${m.name}`, sub: `${name[m.profileId]} · осталось ${m.stock} шт`, href: '#/med/' + m.id, profileId: m.profileId }); }
  }
  if (typeof cycleEvents === 'function') for (const p of profiles) if (isFemale(p)) ev.push(...(await cycleEvents(p, from, to)));
  return ev.sort((a, b) => a.date.localeCompare(b.date));
}
async function upcomingEvents(profiles, days) {
  const t = todayISO();
  const ev = await collectEvents(profiles, addDaysISO(t, -30), addDaysISO(t, days));
  // прошлое показываем только если не сделано (просрочено)
  return ev.filter(e => e.date >= t || (!e.done && e.kind !== 'cycle' && e.kind !== 'med'));
}
async function homeEvents(profiles, days) {
  return (await upcomingEvents(profiles, days)).filter(e => !e.private);
}
function addDaysISO(d, n) { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }
function eventRow(e) {
  const [label, fg, bg] = EVENT_KINDS[e.kind] || EVENT_KINDS.plan;
  const [, mm, dd] = e.date.split('-');
  const late = e.date < todayISO() && !e.done;
  return `<a class="row" href="${e.href}" style="text-decoration:none;color:inherit;min-height:48px">
    <div style="width:44px;height:44px;border-radius:12px;background:${late ? 'var(--high-soft)' : bg};color:${late ? 'var(--high)' : fg};display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;flex:none">
      <span style="font-size:16px;font-weight:700">${+dd}</span><span style="font-size:10px;font-weight:500">${MONTHS[+mm - 1]}</span></div>
    <div class="grow"><div style="font-weight:500">${esc(e.title)}</div><div class="sub">${late ? '<b style="color:var(--high)">Просрочено</b> · ' : ''}${esc(label)} · ${esc(e.sub || '')}</div></div></a>`;
}

// ---------- вкладка «Календарь» ----------
async function viewCalendar() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const counts = await spaceCounts();
  const profiles = await spaceProfiles();
  if (!profiles.length) { app.innerHTML = `<div class="top"><h1 class="grow">Календарь</h1></div>${spaceSwitch(counts)}${emptySpace()}${nav('calendar')}`; bindSpaceSwitch(); return; }
  const now = new Date();
  const ym = q.get('m') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const filter = q.get('f') || 'all';
  const [y, m] = ym.split('-').map(Number);
  const nDaysM = new Date(y, m, 0).getDate();
  const first = `${ym}-01`, last = `${ym}-${String(nDaysM).padStart(2, '0')}`;
  const hasFemale = profiles.some(isFemale);
  const pass = e => (filter === 'all' && !e.private) || (filter === 'tests' && (e.kind === 'plan' || e.kind === 'retest')) || (filter === 'vac' && (e.kind === 'vaccine' || e.kind === 'treatment')) || (filter === 'med' && e.kind === 'med') || (filter === 'cycle' && e.kind === 'cycle');
  const monthEv = (await collectEvents(profiles, first, last)).filter(pass);
  const byDay = {}; monthEv.forEach(e => (byDay[e.date] = byDay[e.date] || []).push(e));
  const startDow = (new Date(y, m - 1, 1).getDay() + 6) % 7, nDays = nDaysM;
  const t = todayISO(), sel = q.get('d');
  const monthName = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'][m - 1];
  const shift = n => { const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const link = (o) => '#/calendar?' + new URLSearchParams({ m: ym, f: filter, ...o }).toString();
  let cells = '';
  for (let i = 0; i < startDow; i++) cells += '<span></span>';
  for (let d = 1; d <= nDays; d++) {
    const iso = `${ym}-${String(d).padStart(2, '0')}`, evs = byDay[iso] || [];
    const kinds = [...new Set(evs.map(e => e.kind))].slice(0, 3);
    cells += `<a href="${link({ d: iso })}" class="calday${iso === t ? ' today' : ''}${iso === sel ? ' sel' : ''}" aria-label="${d} ${monthName}${evs.length ? ', событий: ' + evs.length : ''}">
      <span>${d}</span><span class="dots">${kinds.map(k => `<i style="background:${(EVENT_KINDS[k] || EVENT_KINDS.plan)[1]}"></i>`).join('')}</span></a>`;
  }
  const upcoming = (await upcomingEvents(profiles, 90)).filter(pass);
  const dayList = sel ? (byDay[sel] || []) : null;
  const meds = filter === 'med' ? (await db.meds.toArray()).filter(x => profiles.some(p => p.id === x.profileId) && x.active !== false && (!medEndDate(x) || medEndDate(x) >= t)) : [];
  const pname = Object.fromEntries(profiles.map(p => [p.id, p.name]));
  const filters = [['all', 'Все'], ['tests', 'Анализы'], ['vac', settings.space === 'pets' ? 'Прививки' : 'Прививки'], ['med', 'Лекарства'], ...(hasFemale ? [['cycle', 'Цикл']] : [])];
  app.innerHTML = `
    <div class="top"><h1 class="grow">Календарь</h1></div>
    ${spaceSwitch(counts)}
    <div class="pad stack">
      <div class="chips" style="padding:0;margin:0">${filters.map(([k, n]) => `<a class="pill ${filter === k ? 'on' : ''}" href="#/calendar?${new URLSearchParams({ m: ym, f: k })}" style="text-decoration:none">${n}</a>`).join('')}</div>
      <section class="card" style="padding:12px 10px">
        <div class="between" style="padding:0 6px"><a class="pill" href="#/calendar?${new URLSearchParams({ m: shift(-1), f: filter })}" aria-label="Предыдущий месяц" style="text-decoration:none">‹</a>
          <span style="font-weight:600">${monthName} ${y}</span>
          <a class="pill" href="#/calendar?${new URLSearchParams({ m: shift(1), f: filter })}" aria-label="Следующий месяц" style="text-decoration:none">›</a></div>
        <div class="calgrid">${['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map(d => `<span class="dow">${d}</span>`).join('')}${cells}</div>
      </section>
      ${dayList ? `<section class="card"><h2>${fmtDate(sel)}</h2>${dayList.length ? dayList.map(eventRow).join('') : '<p class="empty" style="margin:0">Событий нет.</p>'}</section>` : ''}
      ${filter === 'med' ? `<section class="card"><h2>Курсы препаратов</h2>${meds.length ? meds.map(x => { const pr = medProgress(x); return `<a href="#/med/${x.id}" style="text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:6px">
          <div class="between"><span style="font-weight:500">${esc(x.name)}${x.dose ? ' · ' + esc(x.dose) : ''}</span><span class="sub">${esc(pname[x.profileId])}</span></div>
          <div style="height:6px;border-radius:3px;background:var(--soft);overflow:hidden"><div style="height:100%;width:${pr.pct}%;background:${pr.low ? 'var(--high)' : 'var(--accent)'}"></div></div>
          <span class="sub">${esc(pr.text)}</span></a>`; }).join('') : '<p class="empty" style="margin:0">Активных курсов нет.</p>'}</section>` : ''}
      <section class="card"><h2>Ближайшие 3 месяца</h2>${upcoming.length ? upcoming.map(eventRow).join('') : '<p class="empty" style="margin:0">Ничего не запланировано.</p>'}</section>
      ${upcoming.length ? '<button type="button" class="btn ghost" id="allics">Добавить всё в календарь телефона</button>' : ''}
    </div>
    ${nav('calendar')}`;
  bindSpaceSwitch();
  const ai = $('#allics');
  if (ai) ai.onclick = () => downloadICS('Healthy Family.ics', upcoming.filter(e => e.date >= t && e.kind !== 'cycle').map(e => ({ title: `${e.title} — ${e.sub}`, date: e.date, allDay: true, alarm: 1440 })));
}

// ---------- экспорт в календарь телефона (.ics) ----------
function downloadICS(filename, events) {
  if (!events.length) { toast('Нет событий для календаря'); return; }
  const pad = n => String(n).padStart(2, '0');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const escI = s => String(s).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Healthy Family//RU', 'CALSCALE:GREGORIAN'];
  events.forEach((e, i) => {
    const d = e.date.replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:hf-${Date.now()}-${i}@healthy-family`, `DTSTAMP:${stamp}`, `SUMMARY:${escI(e.title)}`);
    if (e.allDay || !e.time) {
      const next = addDaysISO(e.date, 1).replace(/-/g, '');
      lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`);
    } else {
      const [hh, mm] = e.time.split(':');
      lines.push(`DTSTART:${d}T${pad(hh)}${pad(mm)}00`, `DURATION:PT10M`);
      if (e.days) lines.push(`RRULE:FREQ=DAILY;COUNT=${e.days}`);
    }
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escI(e.title)}`, `TRIGGER:-PT${e.alarm || 0}M`, 'END:VALARM', 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  toast('Файл календаря скачан — откройте его, чтобы добавить события');
}
