const APP_VERSION = '0.8.0';
const app = document.getElementById('app');

// ---------- утилиты ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const fmtDate = d => { if (!d) return 'без даты'; const [y, m, dd] = d.split('-'); return `${+dd} ${MONTHS[+m - 1]} ${y}`; };
const fmtNum = n => n === null || n === undefined ? '' : String(n).replace('.', ',');
const RECORD_TYPES = { analysis: 'Анализ', ultrasound: 'УЗИ', imaging: 'Снимок / МРТ / КТ', visit: 'Приём врача', procedure: 'Процедура', document: 'Документ' };
const STATUS_TEXT = { low: '↓ Ниже референса', high: '↑ Выше референса', normal: 'В норме' };

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2800);
}

const settings = {
  get apiUrl() { return localStorage.getItem('apiUrl') || ''; },
  get apiToken() { return localStorage.getItem('apiToken') || ''; },
  get profileId() { return +localStorage.getItem('profileId') || null; },
  set profileId(v) { localStorage.setItem('profileId', v); },
  get space() { return localStorage.getItem('space') === 'pets' ? 'pets' : 'people'; },
  set space(v) { localStorage.setItem('space', v); }
};

async function api(action, payload) {
  if (!settings.apiUrl) throw new Error('Не указан адрес сервера распознавания. Откройте «Настройки».');
  let r;
  try { r = await fetch(settings.apiUrl.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, // простой запрос: браузер не делает предварительную проверку
    body: JSON.stringify({ action, ...payload, code: settings.apiToken })
  }); } catch (e) {
    throw new Error('Нет связи с сервером распознавания. Проверьте интернет, адрес сервера и переменную ALLOWED_ORIGIN у функции.');
  }
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) throw new Error('Код доступа не принят. Проверьте его в «Настройках».');
  if (r.status === 429) throw new Error(data.error || 'Лимит распознаваний на этот месяц исчерпан.');
  if (r.status === 403) throw new Error('Облако ответило 403: проверьте, что у функции включено «Public function».');
  if (!r.ok) throw new Error(data.error || 'Сервер распознавания ответил ошибкой ' + r.status);
  return data;
}

// Два пространства: «Семья» (люди) и «Питомцы». Питомцы не смешиваются с людьми.
const spaceOf = p => (p && p.kind === 'pet' ? 'pets' : 'people');
const isFemale = p => p && p.kind !== 'pet' && p.sex === 'f';
async function spaceProfiles(space = settings.space) {
  return (await db.profiles.toArray()).filter(p => spaceOf(p) === space);
}
async function currentProfile() {
  const all = await spaceProfiles();
  if (!all.length) return null;
  return all.find(p => p.id === settings.profileId) || all[0];
}
function spaceSwitch(counts) {
  const sp = settings.space;
  return `<div class="pad" style="margin-top:4px"><div class="seg" role="tablist">
    <button type="button" class="${sp === 'people' ? 'on' : ''}" data-space="people">Семья${counts.people ? ' · ' + counts.people : ''}</button>
    <button type="button" class="${sp === 'pets' ? 'on' : ''}" data-space="pets">Питомцы${counts.pets ? ' · ' + counts.pets : ''}</button></div></div>`;
}
async function spaceCounts() {
  const all = await db.profiles.toArray();
  return { people: all.filter(p => spaceOf(p) === 'people').length, pets: all.filter(p => spaceOf(p) === 'pets').length };
}
function bindSpaceSwitch() {
  $$('[data-space]').forEach(b => b.onclick = () => { settings.space = b.dataset.space; render(); });
}
function emptySpace() {
  const pets = settings.space === 'pets';
  return `<div class="pad stack"><section class="card">
    <h2>${pets ? 'Питомцев пока нет' : 'В семье пока никого'}</h2>
    <p class="sub" style="margin:0">${pets ? 'Добавьте собаку, кошку или другого питомца — у него будут свои разделы, прививки, обработки и лекарства.' : 'Добавьте себя или членов семьи.'}</p>
    <a class="btn" href="#/profile/new?space=${settings.space}">${pets ? 'Добавить питомца' : 'Добавить профиль'}</a></section></div>`;
}

const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  sections: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  dynamics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-6 4 3 6-8 3 3"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
};
function nav(active) {
  const items = [['#/', 'home', 'Главная'], ['#/sections', 'sections', 'Разделы'], ['#/calendar', 'calendar', 'Календарь'], ['#/dynamics', 'dynamics', 'Динамика'], ['#/settings', 'settings', 'Ещё']];
  return `<nav class="bottom">${items.map(([h, k, t]) => `<a href="${h}" class="${active === k ? 'on' : ''}">${ICONS[k]}${t}</a>`).join('')}</nav>`;
}
function backLink(href) { return `<a class="back" href="${href}" aria-label="Назад">‹</a>`; }

function profileChips(profiles, current, hrefBase) {
  return `<div class="chips">${profiles.map(p => `
    <button type="button" class="chip ${p.id === current.id ? 'on' : ''}" data-profile="${p.id}">
      <span class="av">${esc((p.name || '?')[0].toUpperCase())}</span>${esc(p.name)}</button>`).join('')}
    <a class="chip add" href="#/profile/new?space=${settings.space}" aria-label="${settings.space === 'pets' ? 'Добавить питомца' : 'Добавить профиль'}">+</a></div>`;
}
function bindProfileChips() {
  $$('[data-profile]').forEach(b => b.onclick = () => { settings.profileId = +b.dataset.profile; render(); });
}

function rangeBar(r) {
  const lo = r.refLow, hi = r.refHigh, v = r.num;
  if (v === null || (lo === null && hi === null)) return '';
  let pos;
  if (lo !== null && hi !== null) pos = 25 + ((v - lo) / ((hi - lo) || 1)) * 50;
  else if (hi !== null) pos = 75 * (v / (hi || 1));
  else pos = v < lo ? 15 : 50;
  pos = Math.max(3, Math.min(97, pos));
  const color = r.status === 'low' ? 'var(--low)' : r.status === 'high' ? 'var(--high)' : 'var(--ok)';
  const ref = lo !== null && hi !== null ? `${fmtNum(lo)}–${fmtNum(hi)}` : hi !== null ? `до ${fmtNum(hi)}` : `от ${fmtNum(lo)}`;
  return `<div class="row" style="gap:10px"><div class="bar"><div class="band"></div><div class="dot" style="left:${pos}%;background:${color};box-shadow:0 0 0 1px ${color}"></div></div><span class="ref">${ref}</span></div>`;
}
function resultRow(r, href) {
  const name = Metrics.nameFor(r.metricId, r.rawName);
  return `<a class="metric" href="${href}">
    <div class="between"><span style="flex:1;font-weight:500">${esc(name)}</span>
      <span class="val ${r.status}">${esc(r.num !== null ? fmtNum(r.num) : r.value)}</span>
      <span class="sub">${esc(r.unit)}</span></div>
    ${rangeBar(r)}
    ${r.status === 'low' || r.status === 'high' ? `<span class="tag ${r.status}" style="align-self:flex-start">${STATUS_TEXT[r.status]}</span>` : ''}
    ${!r.refLow && !r.refHigh && r.refText ? `<span class="sub">Норма: ${esc(r.refText)}</span>` : ''}
  </a>`;
}

// ---------- экраны ----------
async function viewOnboarding() {
  app.innerHTML = `
    <div class="top"><h1>Healthy Family</h1></div>
    <div class="pad stack">
      <p class="sub" style="font-size:15px">Архив анализов и медицинских документов для вас и семьи. Всё хранится на этом телефоне.</p>
      <a class="btn ghost" href="#/backup/restore">У меня уже есть данные — восстановить из облака</a>
      ${Install.card()}
      ${profileForm('Создать профиль')}
    </div>`;
  bindProfileForm('people'); Install.bind();
}

const SPECIES = ['Собака', 'Кошка', 'Другое'];
function profileForm(cta, space = 'people', p = {}) {
  if (space === 'pets') return `<form id="pform" class="card">
    <h2>${p.id ? 'Данные питомца' : 'Новый питомец'}</h2>
    <label class="f">Кличка<input class="in" name="name" required value="${esc(p.name || '')}" placeholder="Например, Граф"></label>
    <label class="f">Вид<select class="in" name="species">${SPECIES.map(s => `<option ${p.species === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    <label class="f">Порода<input class="in" name="breed" value="${esc(p.breed || '')}" placeholder="Например, лабрадор"></label>
    <label class="f">Пол<select class="in" name="sex"><option value="m" ${p.sex === 'm' ? 'selected' : ''}>Мальчик</option><option value="f" ${p.sex === 'f' ? 'selected' : ''}>Девочка</option></select></label>
    <label class="f">Дата рождения<input class="in" type="date" name="birth" value="${esc(p.birth || '')}"></label>
    <label class="f">Контакт владельца для экстренной карты<input class="in" name="contact" value="${esc(p.contact || '')}" placeholder="Имя и телефон"></label>
    <button class="btn" type="submit">${cta}</button>
  </form>`;
  return `<form id="pform" class="card">
    <h2>${p.id ? 'Данные профиля' : 'Новый профиль'}</h2>
    <label class="f">Имя<input class="in" name="name" required value="${esc(p.name || '')}" placeholder="Например, Мария"></label>
    <label class="f">Кто это<select class="in" name="kind"><option value="adult" ${p.kind !== 'child' ? 'selected' : ''}>Взрослый</option><option value="child" ${p.kind === 'child' ? 'selected' : ''}>Ребёнок</option></select></label>
    <label class="f">Пол<select class="in" name="sex"><option value="f" ${p.sex !== 'm' ? 'selected' : ''}>Женский</option><option value="m" ${p.sex === 'm' ? 'selected' : ''}>Мужской</option></select></label>
    <label class="f">Дата рождения<input class="in" type="date" name="birth" value="${esc(p.birth || '')}"></label>
    <label class="f">Экстренный контакт<input class="in" name="contact" value="${esc(p.contact || '')}" placeholder="Например, Муж, +7 900 000-00-00"></label>
    <button class="btn" type="submit">${cta}</button>
  </form>`;
}
function bindProfileForm(space = 'people', existing = null) {
  const f = $('#pform');
  f.onsubmit = async e => {
    e.preventDefault();
    const v = n => (f[n] ? f[n].value.trim() : '');
    const data = space === 'pets'
      ? { name: v('name'), kind: 'pet', species: v('species'), breed: v('breed') || null, sex: v('sex'), birth: v('birth') || null, contact: v('contact') || null }
      : { name: v('name'), kind: v('kind'), sex: v('sex'), birth: v('birth') || null, contact: v('contact') || null };
    if (existing) {
      await db.profiles.update(existing.id, data);
      toast('Сохранено');
      location.hash = '#/profile/' + existing.id;
      return;
    }
    const id = await createProfile(data);
    settings.space = space; settings.profileId = id;
    if (typeof seedVaccines === 'function') await seedVaccines(id).catch(() => {});
    location.hash = '#/';
    render();
  };
}

async function viewProfileNew() {
  const space = new URLSearchParams(location.hash.split('?')[1] || '').get('space') === 'pets' ? 'pets' : 'people';
  app.innerHTML = `<div class="top">${backLink('#/')}<h1 class="grow">${space === 'pets' ? 'Новый питомец' : 'Новый профиль'}</h1></div><div class="pad">${profileForm('Добавить', space)}</div>${nav('')}`;
  bindProfileForm(space);
}
async function viewProfileEdit(id) {
  const p = await db.profiles.get(+id);
  if (!p) { location.hash = '#/'; return; }
  const space = spaceOf(p);
  app.innerHTML = `<div class="top">${backLink('#/profile/' + p.id)}<h1 class="grow">Изменить</h1></div>
    <div class="pad stack">${profileForm('Сохранить', space, p)}
    <button type="button" class="btn danger" id="pdel">Удалить ${space === 'pets' ? 'питомца' : 'профиль'} со всеми данными</button></div>${nav('')}`;
  bindProfileForm(space, p);
  $('#pdel').onclick = async () => {
    if (!confirm(`Удалить «${p.name}» вместе со всеми записями, файлами, документами и прививками? Это нельзя отменить.`)) return;
    await deleteProfile(p.id);
    toast('Удалено'); location.hash = '#/';
  };
}

async function latestFlags(profileId) {
  const res = await db.results.where('profileId').equals(profileId).toArray();
  const latest = new Map();
  for (const r of res) {
    const prev = latest.get(r.metricId);
    if (!prev || (r.date || '') > (prev.date || '')) latest.set(r.metricId, r);
  }
  return [...latest.values()].filter(r => r.status === 'low' || r.status === 'high');
}

async function viewHome() {
  const all = await db.profiles.toArray();
  if (!all.length) return viewOnboarding();
  const counts = await spaceCounts();
  const profiles = await spaceProfiles();
  const p = await currentProfile();
  if (!p) {
    app.innerHTML = `<div class="top"><h1 class="grow">Healthy Family</h1></div>${spaceSwitch(counts)}${emptySpace()}${nav('home')}`;
    bindSpaceSwitch(); return;
  }
  const pet = p.kind === 'pet';
  const flags = await latestFlags(p.id);
  const recent = (await db.records.where('profileId').equals(p.id).toArray()).sort((x, y) => (y.date || '').localeCompare(x.date || ''));
  const sections = await db.sections.where('profileId').equals(p.id).toArray();
  const secName = id => (sections.find(s => s.id === id) || {}).name || '';
  const upcoming = (await homeEvents(profiles, 60)).slice(0, 5);
  const today = await todayMeds(p);
  const kindLabel = pet ? [p.species, p.breed].filter(Boolean).join(' · ') || 'Питомец' : p.kind === 'child' ? 'Ребёнок' : 'Профиль';
  app.innerHTML = `
    <div class="top"><div class="grow"><div class="sub">${esc(kindLabel)}</div><h1>${esc(p.name)}</h1></div>
      <a class="pill" href="#/profile/${p.id}" style="text-decoration:none;color:inherit">Профиль</a></div>
    ${spaceSwitch(counts)}
    ${profileChips(profiles, p)}
    <div class="pad stack">
      ${flags.length ? `<section class="card">
        <h2>Требуют внимания</h2>
        ${flags.map(r => `
          <a class="row ${r.status}" href="#/metric/${encodeURIComponent(r.metricId)}" style="text-decoration:none;color:inherit">
            <span class="badge">${r.status === 'low' ? '↓' : '↑'}</span>
            <div class="grow"><div style="font-weight:500">${esc(Metrics.nameFor(r.metricId, r.rawName))}</div>
              <div class="sub">${r.status === 'low' ? 'Ниже' : 'Выше'} референса · ${fmtDate(r.date)}</div></div>
            <span class="val">${esc(fmtNum(r.num))} <span class="sub">${esc(r.unit)}</span></span>
          </a>`).join('')}
      </section>` : ''}
      <section class="card">
        <div class="between"><h2>Ближайшее</h2><a href="#/calendar" style="font-size:13px;text-decoration:none">Календарь</a></div>
        ${upcoming.length ? upcoming.map(eventRow).join('') : '<p class="empty" style="margin:0">Запланированных событий нет. Прививки, пересдачи и плановые осмотры появятся здесь.</p>'}
      </section>
      <section class="card">
        <div class="between"><h2>Сегодня принять</h2><a href="#/meds/${p.id}" style="font-size:13px;text-decoration:none">Все лекарства</a></div>
        ${today.length ? today.map(t => `<label class="row" style="min-height:44px">
            <input type="checkbox" data-take="${t.med.id}|${t.time}" ${t.taken ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--accent)">
            <span class="grow">${esc(t.med.name)}${t.med.dose ? ' · ' + esc(t.med.dose) : ''}</span><span class="sub">${esc(t.time)}</span></label>`).join('')
          : `<p class="empty" style="margin:0">На сегодня ничего. <a href="#/med/new/${p.id}">Добавить лекарство</a></p>`}
      </section>
      <section class="card">
        <div class="between"><h2>Последние записи</h2><a href="#/sections" style="font-size:13px;text-decoration:none">Все разделы</a></div>
        ${recent.length ? recent.slice(0, 5).map(r => `
          <a class="row" href="#/record/${r.id}" style="text-decoration:none;color:inherit">
            <div class="grow"><div style="font-weight:500">${esc(r.title || RECORD_TYPES[r.type])}</div>
              <div class="sub">${fmtDate(r.date)} · ${esc((r.sectionIds || []).map(secName).filter(Boolean).join(', '))}</div></div>
            <span class="tag kind">${esc(RECORD_TYPES[r.type] || 'Документ')}</span>
          </a>`).join('') : '<p class="empty" style="margin:0">Загрузите первый анализ или документ — кнопка внизу справа.</p>'}
      </section>
    </div>
    <a class="fab" href="#/upload">+ Загрузить</a>
    ${nav('home')}`;
  bindProfileChips(); bindSpaceSwitch();
  $$('[data-take]').forEach(c => c.onchange = async () => { const [m, t] = c.dataset.take.split('|'); await toggleTaken(+m, t, c.checked); });
  if (!Install.standalone) { $('.pad.stack').insertAdjacentHTML('afterbegin', Install.card()); Install.bind(); }
  expiringDocs().then(async docs => {
    if (!docs.length || !$('.pad.stack')) return;
    const names = Object.fromEntries((await db.profiles.toArray()).map(x => [x.id, x.name]));
    const a = document.createElement('section');
    a.className = 'card'; a.style.background = 'var(--high-soft)';
    a.innerHTML = '<h2>Документы</h2>' + docs.map(d => `<a class="row hist" href="#/doc/${d.id}"><span class="grow">${esc(docTitle(d))} · ${esc(names[d.profileId] || '')}</span>${expiryTag(d)}</a>`).join('');
    $('.pad.stack').prepend(a);
  });
  Backup.meta().then(async m => {
    if (!$('.pad.stack')) return;
    let html = '';
    if (m.enabled && m.error) html = `<a class="card" href="#/settings" style="text-decoration:none;color:inherit;background:var(--high-soft)"><h2>Резервная копия не сохранилась</h2><span class="sub">${esc(m.error)} · открыть настройки</span></a>`;
    else if (!m.enabled && (await db.records.count()) >= 3 && localStorage.getItem('bkNag') !== new Date().toISOString().slice(0, 7))
      html = `<section class="card" style="background:var(--high-soft)"><h2>Данные есть только в этом телефоне</h2><span class="sub">Включите зашифрованную копию в облаке, чтобы ничего не потерять.</span>
        <div class="row"><a class="btn" href="#/settings" style="flex:1">Включить</a><button type="button" class="btn ghost" id="bknag" style="flex:1">Позже</button></div></section>`;
    if (!html) return;
    $('.pad.stack').insertAdjacentHTML('afterbegin', html);
    const n = $('#bknag'); if (n) n.onclick = () => { localStorage.setItem('bkNag', new Date().toISOString().slice(0, 7)); n.closest('section').remove(); };
  });
  MailInbox.count().then(n => {
    if (!n || !$('.pad.stack')) return;
    const a = document.createElement('a');
    a.href = '#/inbox'; a.className = 'card'; a.style.cssText = 'text-decoration:none;color:inherit;background:var(--accent-soft)';
    a.innerHTML = `<div class="between"><h2>Из почты: ${n} ${plural(n, 'новое письмо', 'новых письма', 'новых писем')}</h2><span style="color:var(--accent);font-weight:600">Разобрать ›</span></div>`;
    $('.pad.stack').prepend(a);
  });
}

async function viewSections() {
  const all = await db.profiles.toArray();
  if (!all.length) return viewOnboarding();
  const counts = await spaceCounts();
  const profiles = await spaceProfiles();
  const p = await currentProfile();
  if (!p) { app.innerHTML = `<div class="top"><h1 class="grow">Разделы</h1></div>${spaceSwitch(counts)}${emptySpace()}${nav('sections')}`; bindSpaceSwitch(); return; }
  const sections = (await db.sections.where('profileId').equals(p.id).toArray()).sort((a, b) => a.order - b.order);
  const counts2 = {}, flagsBy = {};
  const flags = await latestFlags(p.id);
  for (const s of sections) counts2[s.id] = await db.records.where('sectionIds').equals(s.id).count();
  const plans = await db.plans.where('profileId').equals(p.id).toArray();
  const planBy = {}; for (const pl of plans) if (!planBy[pl.sectionId] || (pl.nextDate || '9') < (planBy[pl.sectionId].nextDate || '9')) planBy[pl.sectionId] = pl;
  for (const f of flags) { const m = Metrics.byId(f.metricId); const sname = m && m.section; const sid = (sections.find(s => s.name === sname) || {}).id; if (sid) flagsBy[sid] = (flagsBy[sid] || 0) + 1; }
  app.innerHTML = `
    <div class="top"><h1 class="grow">Разделы</h1><a class="pill" href="#/sections/edit" style="text-decoration:none;color:inherit">Изменить</a></div>
    ${spaceSwitch(counts)}
    ${profileChips(profiles, p)}
    <div class="pad stack" style="gap:10px">
      <div class="row" style="gap:8px">
        <a class="btn ghost" href="#/emergency/${p.id}" style="flex:1;min-height:44px;font-size:13px;background:var(--high-soft);border:none;color:#8A3A1A">Экстренная карта</a>
        <a class="btn ghost" href="#/summary/${p.id}" style="flex:1;min-height:44px;font-size:13px;background:var(--accent-soft);border:none;color:var(--accent)">Сводка для врача</a>
      </div>
      <div class="grid2">
      ${sections.map(s => {
        const pl = planBy[s.id];
        const status = flagsBy[s.id] ? `<span class="sub" style="color:var(--high);font-weight:600">${flagsBy[s.id]} вне нормы</span>` : pl && pl.nextDate ? `<span class="sub" style="color:var(--accent);font-weight:600">${esc(pl.name)} ${relDays(pl.nextDate)}</span>` : '';
        return `<a class="tile" href="#/section/${s.id}">
          <div class="row" style="gap:8px"><span class="dotc" style="background:${s.color}"></span><span style="font-weight:600;font-size:14px">${esc(s.name)}</span></div>
          <span class="sub">${counts2[s.id] ? counts2[s.id] + ' ' + plural(counts2[s.id], 'запись', 'записи', 'записей') : 'Пусто'}</span>${status}
        </a>`; }).join('')}
      <button type="button" class="tile" id="addsec" style="border:1.5px dashed #9AA0AA;background:transparent;cursor:pointer;justify-content:center;align-items:center">+ Свой раздел</button>
      </div>
    </div>
    ${nav('sections')}`;
  bindProfileChips(); bindSpaceSwitch();
  $('#addsec').onclick = async () => {
    const name = prompt('Название раздела');
    if (!name || !name.trim()) return;
    await db.sections.add({ profileId: p.id, name: name.trim(), color: SECTION_COLORS[sections.length % SECTION_COLORS.length], order: sections.length });
    render();
  };
}
function plural(n, a, b, c) { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; }
const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }
function relDays(date) {
  if (!date) return '';
  const n = daysBetween(todayISO(), date);
  if (n < 0) return 'просрочено';
  if (n === 0) return 'сегодня';
  if (n === 1) return 'завтра';
  if (n < 31) return `через ${n} ${plural(n, 'день', 'дня', 'дней')}`;
  const m = Math.round(n / 30.4);
  if (m < 12) return `через ${m} мес`;
  const y = Math.round(n / 365);
  return `через ${y} ${plural(y, 'год', 'года', 'лет')}`;
}
function addMonths(date, n) { const d = new Date(date + 'T12:00:00'); d.setMonth(d.getMonth() + +n); return d.toISOString().slice(0, 10); }

// Изменение разделов: переименовать, цвет, порядок, удалить
async function viewSectionsEdit() {
  const p = await currentProfile();
  if (!p) { location.hash = '#/sections'; return; }
  const draw = async () => {
    const sections = (await db.sections.where('profileId').equals(p.id).toArray()).sort((a, b) => a.order - b.order);
    app.innerHTML = `<div class="top">${backLink('#/sections')}<div class="grow"><div class="sub">${esc(p.name)}</div><h1>Изменить разделы</h1></div></div>
      <div class="pad stack" style="gap:10px">
        ${sections.map((s, i) => `<section class="card" style="gap:8px;padding:12px">
          <div class="row" style="gap:8px">
            <input class="in" data-name="${s.id}" value="${esc(s.name)}" aria-label="Название раздела" style="flex:1">
            <button type="button" class="pill" data-up="${s.id}" ${i === 0 ? 'disabled' : ''} aria-label="Выше">↑</button>
            <button type="button" class="pill" data-down="${s.id}" ${i === sections.length - 1 ? 'disabled' : ''} aria-label="Ниже">↓</button>
          </div>
          <div class="row" style="gap:6px;flex-wrap:wrap">${SECTION_COLORS.map(c => `<button type="button" data-color="${s.id}|${c}" aria-label="Цвет" style="width:28px;height:28px;border-radius:14px;border:${c === s.color ? '3px solid var(--ink)' : '1px solid #ddd'};background:${c};cursor:pointer"></button>`).join('')}
            <button type="button" class="linkbtn" data-del="${s.id}" style="margin-left:auto;color:var(--high)">Удалить</button></div>
        </section>`).join('')}
        <p class="sub" style="margin:0">Название сохраняется, когда вы выходите из поля. Записи удалённого раздела не пропадают: они остаются в других своих разделах или переходят в «Прочее».</p>
      </div>${nav('sections')}`;
    $$('[data-name]').forEach(i => i.onchange = async () => { if (i.value.trim()) { await db.sections.update(+i.dataset.name, { name: i.value.trim() }); toast('Переименовано'); } });
    $$('[data-color]').forEach(b => b.onclick = async () => { const [id, c] = b.dataset.color.split('|'); await db.sections.update(+id, { color: c }); draw(); });
    const move = async (id, dir) => {
      const i = sections.findIndex(s => s.id === id), j = i + dir;
      if (j < 0 || j >= sections.length) return;
      await db.sections.update(sections[i].id, { order: j }); await db.sections.update(sections[j].id, { order: i });
      sections.forEach(async (s, k) => { if (k !== i && k !== j && s.order !== k) await db.sections.update(s.id, { order: k }); });
      draw();
    };
    $$('[data-up]').forEach(b => b.onclick = () => move(+b.dataset.up, -1));
    $$('[data-down]').forEach(b => b.onclick = () => move(+b.dataset.down, 1));
    $$('[data-del]').forEach(b => b.onclick = async () => {
      const s = sections.find(x => x.id === +b.dataset.del);
      const n = await db.records.where('sectionIds').equals(s.id).count();
      if (!confirm(`Удалить раздел «${s.name}»?${n ? ` ${n} ${plural(n, 'запись останется', 'записи останутся', 'записей останутся')} в других разделах или в «Прочее».` : ''}`)) return;
      await removeSection(p.id, s.id);
      draw();
    });
  };
  draw();
}
async function removeSection(profileId, sectionId) {
  let other = await db.sections.where('profileId').equals(profileId).filter(x => x.name === 'Прочее' && x.id !== sectionId).first();
  const recs = await db.records.where('sectionIds').equals(sectionId).toArray();
  for (const r of recs) {
    let ids = (r.sectionIds || []).filter(x => x !== sectionId);
    if (!ids.length) {
      if (!other) { const oid = await db.sections.add({ profileId, name: 'Прочее', color: '#6B7280', order: 99 }); other = { id: oid }; }
      ids = [other.id];
    }
    await db.records.update(r.id, { sectionIds: ids });
  }
  await db.plans.where('sectionId').equals(sectionId).delete();
  await db.sections.delete(sectionId);
}

async function viewSection(id, tab = 'timeline') {
  const s = await db.sections.get(+id);
  if (!s) { location.hash = '#/sections'; return; }
  const p = await db.profiles.get(s.profileId);
  const records = (await db.records.where('sectionIds').equals(s.id).toArray()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const clinics = await db.clinics.toArray(), doctors = await db.doctors.toArray();
  const nm = (arr, id) => (arr.find(x => x.id === id) || {}).name || '';
  const plans = (await db.plans.where('sectionId').equals(s.id).toArray()).sort((a, b) => (a.nextDate || '9').localeCompare(b.nextDate || '9'));
  // ведущий врач — тот, кто чаще всего встречается в записях раздела
  const docCount = {}; records.forEach(r => { if (r.doctorId) docCount[r.doctorId] = (docCount[r.doctorId] || 0) + 1; });
  const lead = Object.entries(docCount).sort((a, b) => b[1] - a[1])[0];
  const leadRec = lead && records.find(r => r.doctorId === +lead[0]);
  const tabs = [['timeline', 'Хронология'], ['metrics', 'Показатели'], ['files', 'Документы']];
  app.innerHTML = `
    <div class="top">${backLink('#/sections')}<div class="grow"><div class="sub">${esc(p.name)}</div><div class="row" style="gap:10px"><span class="dotc" style="width:12px;height:12px;border-radius:6px;background:${s.color}"></span><h1>${esc(s.name)}</h1></div></div>
      <button type="button" class="pill" id="rename">Переименовать</button></div>
    <div class="pad stack">
      ${lead ? `<span class="sub" style="margin-top:-6px">Ведущий врач: ${esc(nm(doctors, +lead[0]))}${leadRec && leadRec.clinicId ? ' · ' + esc(nm(clinics, leadRec.clinicId)) : ''}</span>` : ''}
      <section class="card">
        <div class="between"><h2>Плановые обследования</h2><button type="button" class="linkbtn" id="addplan">+ Добавить</button></div>
        ${plans.length ? plans.map(pl => `<div class="row">
            <div class="grow"><div style="font-weight:500">${esc(pl.name)}</div><div class="sub">${pl.everyMonths ? 'Раз в ' + monthsText(pl.everyMonths) : 'Без повтора'}${pl.lastDate ? ' · было ' + fmtDate(pl.lastDate) : ''}</div></div>
            <span class="tag ${pl.nextDate && pl.nextDate < todayISO() ? 'high' : 'kind'}">${pl.nextDate ? relDays(pl.nextDate) : 'без даты'}</span>
            <button type="button" class="pill" data-plan="${pl.id}" aria-label="Изменить">…</button></div>`).join('')
          : '<p class="empty" style="margin:0">Например, «Осмотр раз в год». Интервал задаёте вы или врач — приложение только напомнит.</p>'}
      </section>
      <div class="seg" role="tablist">${tabs.map(([k, t]) => `<button type="button" class="${tab === k ? 'on' : ''}" data-stab="${k}">${t}</button>`).join('')}</div>
      <div id="stab"></div>
      <a class="btn" href="#/upload?section=${s.id}">Добавить запись в раздел</a>
    </div>
    ${nav('sections')}`;
  const box = $('#stab');
  if (tab === 'timeline') {
    box.innerHTML = records.length ? records.map(r => `
      <div class="tl"><div class="rail"><i style="background:${s.color}"></i><b></b></div>
        <a href="#/record/${r.id}">
          <div class="between"><span class="tag kind">${esc(RECORD_TYPES[r.type] || 'Документ')}</span><span class="sub">${fmtDate(r.date)}</span></div>
          <span style="font-weight:500">${esc(r.title || RECORD_TYPES[r.type])}</span>
          <span class="sub">${esc([nm(doctors, r.doctorId), nm(clinics, r.clinicId)].filter(Boolean).join(' · '))}</span>
        </a></div>`).join('') : '<div class="card"><p class="empty">В разделе пока нет записей.</p></div>';
  } else if (tab === 'metrics') {
    const recIds = new Set(records.map(r => r.id));
    const res = (await db.results.where('profileId').equals(p.id).toArray()).filter(r => recIds.has(r.recordId));
    const latest = new Map(); res.forEach(r => { const q = latest.get(r.metricId); if (!q || (r.date || '') > (q.date || '')) latest.set(r.metricId, r); });
    box.innerHTML = latest.size ? `<section class="card"><div>${[...latest.values()].map(r => resultRow(r, '#/metric/' + encodeURIComponent(r.metricId))).join('')}</div></section>`
      : '<div class="card"><p class="empty">В записях раздела нет числовых показателей.</p></div>';
  } else {
    const files = [];
    for (const r of records) for (const f of await db.files.where('recordId').equals(r.id).toArray()) files.push({ f, r });
    const byRec = new Map(); files.forEach(({ f, r }) => { if (!byRec.has(r.id)) byRec.set(r.id, { r, fs: [] }); byRec.get(r.id).fs.push(f); });
    box.innerHTML = byRec.size ? `<section class="card">${[...byRec.values()].map(({ r, fs }, k) => `<div class="stack" style="gap:6px"><a href="#/record/${r.id}" style="color:inherit;text-decoration:none;font-weight:600">${esc(r.title || RECORD_TYPES[r.type] || 'Документ')} <span class="sub" style="font-weight:400">· ${fmtDate(r.date)}</span></a>${originalThumbs(fs, k === 0)}</div>`).join('<div style="height:1px;background:var(--soft)"></div>')}</section>`
      : '<div class="card"><p class="empty">Файлов пока нет.</p></div>';
    bindOriginals();
  }
  $$('[data-stab]').forEach(b => b.onclick = () => viewSection(id, b.dataset.stab));
  $('#rename').onclick = async () => { const n = prompt('Новое название раздела', s.name); if (n && n.trim()) { await db.sections.update(s.id, { name: n.trim() }); viewSection(id, tab); } };
  $('#addplan').onclick = () => planDialog(p.id, s.id, null, () => viewSection(id, tab));
  $$('[data-plan]').forEach(b => b.onclick = async () => planDialog(p.id, s.id, await db.plans.get(+b.dataset.plan), () => viewSection(id, tab)));
}
const monthsText = n => +n === 12 ? 'год' : +n === 6 ? 'полгода' : +n === 24 ? '2 года' : `${n} мес`;

// Диалог планового обследования (простая форма поверх экрана)
function planDialog(profileId, sectionId, pl, done) {
  const ov = document.createElement('div');
  ov.className = 'sheet';
  ov.innerHTML = `<form class="card sheet-card">
    <h2>${pl ? 'Плановое обследование' : 'Новое плановое обследование'}</h2>
    <label class="f">Что<input class="in" name="name" required value="${esc(pl?.name || '')}" placeholder="Например, Осмотр гинеколога"></label>
    <label class="f">Как часто<select class="in" name="every">${[['', 'Один раз'], [3, 'Раз в 3 месяца'], [6, 'Раз в полгода'], [12, 'Раз в год'], [24, 'Раз в 2 года'], [36, 'Раз в 3 года']].map(([v, t]) => `<option value="${v}" ${String(pl?.everyMonths ?? 12) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="f">Когда было последний раз<input class="in" type="date" name="last" value="${esc(pl?.lastDate || '')}"></label>
    <label class="f">Следующий раз (если пусто — посчитается от прошлого)<input class="in" type="date" name="next" value="${esc(pl?.nextDate || '')}"></label>
    <div class="row">${pl ? '<button type="button" class="btn ghost" id="pldone" style="flex:1">Пройдено сегодня</button>' : ''}<button class="btn" type="submit" style="flex:1">Сохранить</button></div>
    <div class="row"><button type="button" class="btn ghost" id="plcancel" style="flex:1">Отмена</button>${pl ? '<button type="button" class="btn danger" id="pldel" style="flex:1">Удалить</button>' : ''}</div>
  </form>`;
  document.body.appendChild(ov);
  const f = ov.querySelector('form'), close = () => ov.remove();
  ov.querySelector('#plcancel').onclick = close;
  f.onsubmit = async e => {
    e.preventDefault();
    const every = f.every.value ? +f.every.value : null, last = f.last.value || null;
    const next = f.next.value || (last && every ? addMonths(last, every) : null);
    const data = { profileId, sectionId, name: f.name.value.trim(), everyMonths: every, lastDate: last, nextDate: next };
    if (pl) await db.plans.update(pl.id, data); else await db.plans.add(data);
    close(); done();
  };
  const d = ov.querySelector('#pldone');
  if (d) d.onclick = async () => { const t = todayISO(); await db.plans.update(pl.id, { lastDate: t, nextDate: pl.everyMonths ? addMonths(t, pl.everyMonths) : null }); close(); toast('Отмечено'); done(); };
  const x = ov.querySelector('#pldel');
  if (x) x.onclick = async () => { await db.plans.delete(pl.id); close(); done(); };
}

async function viewRecord(id, tab = 'results') {
  const r = await db.records.get(+id);
  if (!r) { location.hash = '#/'; return; }
  const files = await db.files.where('recordId').equals(r.id).toArray();
  const results = await db.results.where('recordId').equals(r.id).toArray();
  const clinic = r.clinicId ? await db.clinics.get(r.clinicId) : null;
  const doctor = r.doctorId ? await db.doctors.get(r.doctorId) : null;
  const sections = await db.sections.bulkGet(r.sectionIds || []);
  const flagged = results.filter(x => x.status === 'low' || x.status === 'high').length;
  const tabs = [['results', 'Показатели'], ['explain', 'Расшифровка'], ['text', 'Текст'], ['notes', 'Заметки']];
  app.innerHTML = `
    <div class="top">${backLink(sections[0] ? '#/section/' + sections[0].id : '#/')}<span class="sub grow">${esc(sections.filter(Boolean).map(s => s.name).join(', '))}</span>
      <a class="pill" href="#/record/edit/${r.id}" style="text-decoration:none;color:inherit">Изменить</a></div>
    <div class="pad stack">
      <div class="stack" style="gap:6px"><span class="tag kind" style="align-self:flex-start">${esc(RECORD_TYPES[r.type] || 'Документ')}</span>
        <h1>${esc(r.title || RECORD_TYPES[r.type])}</h1></div>
      <section class="card" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px">
        <div><div class="sub">Дата</div><div style="font-weight:500">${fmtDate(r.date)}</div></div>
        <div><div class="sub">Клиника</div><div style="font-weight:500">${esc(clinic?.name || '—')}</div></div>
        <div><div class="sub">Врач</div><div style="font-weight:500">${esc(doctor?.name || '—')}</div></div>
        <div><div class="sub">Вне референса</div><div style="font-weight:500">${results.length ? flagged : '—'}</div></div>
      </section>
      <section class="stack" style="gap:8px">
        ${files.length ? `<span class="sub">Оригинал${files.length > 1 ? ` · ${files.length} ${plural(files.length, 'файл', 'файла', 'файлов')}` : ''}</span>${originalThumbs(files)}` : '<span class="sub">Оригинала нет — запись заполнена вручную.</span>'}
      </section>
      <div class="seg" role="tablist">${tabs.map(([k, t]) => `<button type="button" role="tab" class="${tab === k ? 'on' : ''}" data-tab="${k}">${t}</button>`).join('')}</div>
      <section class="card" id="tabbody"></section>
      <button type="button" class="btn danger" id="del">Удалить запись</button>
    </div>
    ${nav('')}`;

  const body = $('#tabbody');
  if (tab === 'results') {
    body.innerHTML = results.length ? `<div>${results.map(x => resultRow(x, '#/metric/' + encodeURIComponent(x.metricId))).join('')}</div>`
      : '<p class="empty">В этой записи нет числовых показателей.</p>';
  } else if (tab === 'text') {
    body.innerHTML = `${r.conclusion ? `<div><div class="sub">Заключение</div><p class="prose" style="margin:4px 0 0;font-weight:500">${esc(r.conclusion)}</p></div>` : ''}
      <div><div class="sub">Распознанный текст</div><p class="prose" style="margin:4px 0 0">${esc(r.text || 'Текст не распознавался.')}</p></div>`;
  } else if (tab === 'notes') {
    body.innerHTML = `<label class="f">Ваши заметки (день цикла, самочувствие, что сказал врач)<textarea class="in" id="notes" rows="6">${esc(r.notes || '')}</textarea></label><span class="sub">Сохраняется автоматически.</span>`;
    $('#notes').oninput = e => { clearTimeout(viewRecord._t); viewRecord._t = setTimeout(() => db.records.update(r.id, { notes: e.target.value }), 400); };
  } else if (tab === 'explain') {
    if (r.explanation) {
      body.innerHTML = `${r.conclusion ? `<div><div class="sub">Заключение врача</div><p class="prose" style="margin:4px 0 0;font-weight:500">${esc(r.conclusion)}</p></div><div style="height:1px;background:var(--soft)"></div>` : ''}
        ${(r.explanation.terms || []).map(t => `<div><div class="between"><span style="font-weight:600">${esc(t.term)}</span><span class="sub">${esc(t.value || '')}</span></div><p style="margin:3px 0 0;font-size:14px;color:#3A404B">${esc(t.plain)}</p></div>`).join('')}
        ${(r.explanation.questions || []).length ? `<div style="background:#F7F2E9;border-radius:12px;padding:10px 12px"><div style="font-weight:600;font-size:14px">Вопросы к врачу</div><ul style="margin:4px 0 0;padding-left:18px;font-size:14px">${r.explanation.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul></div>` : ''}
        <span class="sub">Расшифровка объясняет термины и не заменяет заключение врача.</span>`;
    } else {
      body.innerHTML = `<p class="empty">Расшифровка объяснит термины из протокола простыми словами и подскажет, что уточнить у врача.</p>
        <button type="button" class="btn" id="doexplain" ${r.text ? '' : 'disabled'}>Расшифровать</button>
        ${r.text ? '' : '<span class="sub">Нужен распознанный текст документа.</span>'}`;
      const b = $('#doexplain');
      if (b) b.onclick = async () => {
        b.disabled = true; b.textContent = 'Расшифровываю…';
        try {
          const p = await db.profiles.get(r.profileId);
          const data = await api('explain', { text: r.text, conclusion: r.conclusion, profileKind: p?.kind });
          await db.records.update(r.id, { explanation: data });
          viewRecord(id, 'explain');
        } catch (e) { toast(e.message); b.disabled = false; b.textContent = 'Расшифровать'; }
      };
    }
  }
  $$('[data-tab]').forEach(b => b.onclick = () => viewRecord(id, b.dataset.tab));
  bindOriginals();
  $('#del').onclick = async () => {
    if (!confirm('Удалить запись вместе с файлами и показателями?')) return;
    await deleteRecord(r.id);
    toast('Запись удалена');
    location.hash = sections[0] ? '#/section/' + sections[0].id : '#/';
  };
}

// Правка записи: всё, что распознал ИИ, можно исправить; запись можно перенести или положить в несколько разделов
async function viewRecordEdit(id) {
  const r = await db.records.get(+id);
  if (!r) { location.hash = '#/'; return; }
  const p = await db.profiles.get(r.profileId);
  const sections = (await db.sections.where('profileId').equals(p.id).toArray()).sort((a, b) => a.order - b.order);
  const clinics = await db.clinics.toArray(), doctors = await db.doctors.toArray();
  const clinic = r.clinicId ? await db.clinics.get(r.clinicId) : null, doctor = r.doctorId ? await db.doctors.get(r.doctorId) : null;
  const results = await db.results.where('recordId').equals(r.id).toArray();
  const ref = x => x === null || x === undefined ? '' : String(x);
  draft = { stage: 'edit', profileId: p.id, rows: results.map(x => ({ name: x.rawName, value: x.value, unit: x.unit, refLow: ref(x.refLow), refHigh: ref(x.refHigh), refText: x.refText })) };
  const chosen = new Set(r.sectionIds || []);
  app.innerHTML = `
    <div class="top">${backLink('#/record/' + r.id)}<div class="grow"><div class="sub">${esc(p.name)}</div><h1>Изменить запись</h1></div></div>
    <form id="ref" class="pad stack">
      <section class="card">
        <label class="f">Название<input class="in" name="title" value="${esc(r.title || '')}"></label>
        <label class="f">Тип<select class="in" name="type">${Object.entries(RECORD_TYPES).map(([k, v]) => `<option value="${k}" ${k === r.type ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="f">Дата<input class="in" type="date" name="date" value="${esc(r.date || '')}"></label>
        <label class="f">Клиника<input class="in" name="clinic" list="clist" value="${esc(clinic?.name || '')}"></label>
        <label class="f">Врач<input class="in" name="doctor" list="dlist" value="${esc(doctor?.name || '')}"></label>
        <datalist id="clist">${clinics.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>
        <datalist id="dlist">${doctors.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>
        <label class="f">Заключение<textarea class="in" name="conclusion">${esc(r.conclusion || '')}</textarea></label>
      </section>
      <section class="card"><h2>Разделы</h2>
        <span class="sub" style="margin-top:-6px">Отметьте один или несколько. Снимите отметку, чтобы убрать запись из раздела.</span>
        <div class="row" style="flex-wrap:wrap;gap:8px">${sections.map(s => `<label class="pill ${chosen.has(s.id) ? 'on' : ''}"><input type="checkbox" name="sec" value="${s.id}" ${chosen.has(s.id) ? 'checked' : ''} hidden>${esc(s.name)}</label>`).join('')}</div>
      </section>
      <section class="card">
        <div class="between"><h2>Показатели · ${draft.rows.length}</h2><button type="button" class="linkbtn" id="addrow">+ Добавить</button></div>
        <div class="rtable" id="rows"></div>
      </section>
      <button class="btn" type="submit">Сохранить изменения</button>
    </form>`;
  drawRows(p);
  $$('label.pill input[name=sec]').forEach(i => i.onchange = () => i.parentElement.classList.toggle('on', i.checked));
  $('#addrow').onclick = () => { syncRows(); draft.rows.push({ name: '', value: '', unit: '', refLow: '', refHigh: '' }); drawRows(p); };
  $('#ref').onsubmit = async e => {
    e.preventDefault(); syncRows();
    const fd = new FormData(e.target);
    let sectionIds = fd.getAll('sec').map(Number);
    if (!sectionIds.length) { const other = sections.find(s => s.name === 'Прочее'); if (other) sectionIds = [other.id]; else { toast('Отметьте хотя бы один раздел'); return; } }
    const date = fd.get('date') || null;
    const clinicId = await getOrCreateByName(db.clinics, fd.get('clinic'));
    const doctorId = await getOrCreateByName(db.doctors, fd.get('doctor'));
    await db.transaction('rw', db.records, db.results, async () => {
      await db.records.update(r.id, { title: fd.get('title').trim(), type: fd.get('type'), date, clinicId, doctorId, conclusion: (fd.get('conclusion') || '').trim(), sectionIds });
      await db.results.where('recordId').equals(r.id).delete();
      for (const row of draft.rows.filter(x => String(x.name).trim() && String(x.value).trim()))
        await db.results.add({ recordId: r.id, profileId: p.id, date, ...Metrics.normalizeResult(row, p) });
    });
    draft = null;
    toast('Сохранено');
    location.hash = '#/record/' + r.id;
  };
}

async function viewMetric(arg, range = 'all') {
  const [metricId, qs] = arg.split('?');
  const pid = +new URLSearchParams(qs || '').get('p');
  if (pid) { const pp = await db.profiles.get(pid); if (pp) { settings.space = spaceOf(pp); settings.profileId = pid; } }
  const p = await currentProfile();
  if (!p) { location.hash = '#/'; return; }
  const allRows = (await db.results.where('[profileId+metricId]').equals([p.id, metricId]).toArray())
    .filter(r => r.num !== null).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const cut = range === '1y' ? addMonths(todayISO(), -12) : range === '3y' ? addMonths(todayISO(), -36) : '';
  const rows = allRows.filter(r => !cut || (r.date || '') >= cut);
  const reminders = (await db.reminders.where('profileId').equals(p.id).toArray()).filter(r => r.metricId === metricId && !r.done);
  const m = Metrics.byId(metricId);
  const name = Metrics.nameFor(metricId, rows[0]?.rawName);
  const last = rows[rows.length - 1];
  app.innerHTML = `
    <div class="top">${backLink('javascript:history.back()')}<span class="sub grow">${esc(p.name)}${m?.group ? ' · ' + esc(m.group) : ''}</span></div>
    <div class="pad stack">
      <div class="stack" style="gap:6px">
        <h1>${esc(name)}</h1>
        ${last ? `<div class="row" style="gap:8px;align-items:baseline"><span class="val ${last.status}" style="font-size:40px">${fmtNum(last.num)}</span><span class="sub" style="font-size:15px">${esc(last.unit)} · ${fmtDate(last.date)}</span></div>
          ${last.status === 'low' || last.status === 'high' ? `<span class="tag ${last.status}" style="align-self:flex-start">${STATUS_TEXT[last.status]}</span>` : ''}` : ''}
      </div>
      <section class="card">
        ${allRows.length > 1 ? `<div class="row" style="gap:6px">${[['1y', '1 год'], ['3y', '3 года'], ['all', 'Всё время']].map(([k, t]) => `<button type="button" class="pill ${range === k ? 'on' : ''}" data-range="${k}">${t}</button>`).join('')}</div>` : ''}
        ${rows.length > 1 ? chart(rows) : '<p class="empty">График появится, когда будет хотя бы два значения' + (allRows.length > 1 ? ' за этот период' : '') + '.</p>'}</section>
      ${reminders.map(r => `<section class="card" style="background:var(--accent-soft);flex-direction:row;align-items:center"><span class="grow"><b>${esc(r.title)}</b><br><span class="sub">${fmtDate(r.date)} · ${relDays(r.date)}</span></span><button type="button" class="pill" data-rdone="${r.id}">Сдано</button></section>`).join('')}
      <button type="button" class="btn ghost" id="remind">Напомнить о пересдаче</button>
      <section class="card" id="info"></section>
      ${m?.tip ? `<section class="card"><h2>Как отслеживать</h2><p style="margin:0;font-size:14px;line-height:1.5">${esc(m.tip)}</p><span class="sub">Подсказка не заменяет консультацию врача.</span></section>` : ''}
      <section class="card"><h2>Все значения</h2>
        ${allRows.slice().reverse().map(r => r.recordId ? `<a class="row" href="#/record/${r.recordId}" style="text-decoration:none;color:inherit;min-height:44px">
          <span class="grow">${fmtDate(r.date)}</span><span class="val ${r.status}">${fmtNum(r.num)}</span><span class="sub">${esc(r.unit)}</span></a>`
          : `<div class="row" style="min-height:44px"><span class="grow">${fmtDate(r.date)} <span class="sub">· вручную</span></span><span class="val ${r.status}">${fmtNum(r.num)}</span><span class="sub">${esc(r.unit)}</span><button type="button" class="pill" data-delres="${r.id}" aria-label="Удалить">✕</button></div>`).join('') || '<p class="empty">Значений пока нет.</p>'}
      </section>
    </div>
    ${nav('dynamics')}`;
  $$('[data-range]').forEach(b => b.onclick = () => viewMetric(arg, b.dataset.range));
  $('#remind').onclick = () => reminderDialog(p.id, metricId, name);
  $$('[data-rdone]').forEach(b => b.onclick = async () => { await db.reminders.update(+b.dataset.rdone, { done: true }); viewMetric(arg, range); });
  $$('[data-delres]').forEach(b => b.onclick = async () => { if (confirm('Удалить это измерение?')) { await db.results.delete(+b.dataset.delres); viewMetric(arg, range); } });
  renderMetricInfo(metricId, name, last?.unit || m?.unit || '', p.kind);
}

// «Что это за показатель»: ИИ-справка, кэшируется на телефоне — платим один раз за показатель
async function renderMetricInfo(metricId, name, unit, kind, force = false) {
  const box = $('#info'); if (!box) return;
  const audience = kind === 'pet' ? 'pet' : kind === 'child' ? 'child' : 'adult';
  const key = `info:${audience}:${metricId}`;
  let cached = force ? null : await db.kv.get(key);
  if (!cached) {
    box.innerHTML = `<h2>Что это за показатель</h2><p class="empty">Загружаю справку…</p>`;
    try {
      const data = await api('metric_info', { name, unit, profileKind: kind });
      cached = { key, value: data, at: new Date().toISOString() };
      await db.kv.put(cached);
    } catch (e) {
      box.innerHTML = `<h2>Что это за показатель</h2><p class="empty">${esc(e.message)}</p><button type="button" class="btn ghost" id="inforetry">Попробовать ещё раз</button>`;
      $('#inforetry').onclick = () => renderMetricInfo(metricId, name, unit, kind, true);
      return;
    }
  }
  if ($('#info') !== box) return; // пользователь уже ушёл с экрана
  const i = cached.value;
  const block = (title, text) => text ? `<div><div style="font-weight:600;font-size:14px">${title}</div><p style="margin:2px 0 0;font-size:14px;line-height:1.5;color:#2B303A">${esc(text)}</p></div>` : '';
  box.innerHTML = `
    <h2>Что это за показатель</h2>
    ${i.what ? `<p style="margin:0;font-size:14px;line-height:1.5">${esc(i.what)}</p>` : ''}
    ${block('Что показывает', i.why)}
    ${block('Бывает выше нормы', i.high)}
    ${block('Бывает ниже нормы', i.low)}
    ${block('Как подготовиться', i.prep)}
    ${(i.related || []).length ? `<div><div style="font-weight:600;font-size:14px">Обычно смотрят вместе</div><div class="row" style="flex-wrap:wrap;gap:6px;margin-top:6px">${i.related.map(r => {
      const rm = Metrics.match(r);
      return rm ? `<a class="pill" href="#/metric/${encodeURIComponent(rm.id)}" style="text-decoration:none;color:inherit">${esc(r)}</a>` : `<span class="pill" style="cursor:default">${esc(r)}</span>`;
    }).join('')}</div></div>` : ''}
    <div class="between"><span class="sub">Общая справка, не оценка вашего результата. Её стоит обсудить с врачом.</span>
      <button type="button" class="linkbtn" id="inforefresh" style="flex:none">Обновить</button></div>`;
  $('#inforefresh').onclick = () => renderMetricInfo(metricId, name, unit, kind, true);
}

function chart(rows) {
  const W = 340, H = 190, pl = 14, pr = 14, pt = 18, pb = 30;
  const vals = rows.map(r => r.num);
  const lo = rows[rows.length - 1].refLow, hi = rows[rows.length - 1].refHigh;
  let min = Math.min(...vals, lo ?? Infinity), max = Math.max(...vals, hi ?? -Infinity);
  if (hi !== null && hi > max * 1.6) max = Math.max(...vals) * 1.4; // не даём широкой норме сплющить график
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.12; min -= pad; max += pad;
  const x = i => pl + (rows.length === 1 ? 0 : i * (W - pl - pr) / (rows.length - 1));
  const y = v => pt + (H - pt - pb) * (1 - (v - min) / (max - min));
  const clampY = v => Math.max(pt, Math.min(H - pb, y(v)));
  const band = (lo !== null || hi !== null) ? `<rect x="${pl}" width="${W - pl - pr}" y="${clampY(hi ?? max)}" height="${Math.max(0, clampY(lo ?? min) - clampY(hi ?? max))}" fill="#E8F2EC"/>` : '';
  const color = s => s === 'low' ? '#2457A6' : s === 'high' ? '#A9470C' : '#2E7D5B';
  const label = d => { const [yy, mm] = (d || '').split('-'); return yy ? `${MONTHS[+mm - 1]} ${yy.slice(2)}` : ''; };
  const step = Math.ceil(rows.length / 6);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="График значений по датам">
    ${band}
    <polyline points="${rows.map((r, i) => `${x(i)},${y(r.num)}`).join(' ')}" fill="none" stroke="#5B6270" stroke-width="2" stroke-linejoin="round"/>
    ${rows.map((r, i) => `<circle cx="${x(i)}" cy="${y(r.num)}" r="4.5" fill="${color(r.status)}"/>
      <text x="${x(i)}" y="${y(r.num) - 9}" font-size="10" text-anchor="middle" fill="#5B6270">${fmtNum(r.num)}</text>
      ${i % step === 0 || i === rows.length - 1 ? `<text x="${x(i)}" y="${H - 8}" font-size="10" text-anchor="middle" fill="#5B6270">${label(r.date)}</text>` : ''}`).join('')}
  </svg>`;
}

// ---------- загрузка ----------
let draft = null;

function drawRows(p) {
  $('#rows').innerHTML = draft.rows.map((r, i) => {
    const n = Metrics.normalizeResult(r, p);
    const known = Metrics.match(r.name);
    return `<div class="rrow" data-i="${i}">
      <input class="in" data-k="name" value="${esc(r.name)}" aria-label="Показатель" placeholder="Показатель">
      <input class="in" data-k="value" value="${esc(r.value)}" aria-label="Значение" placeholder="Знач." style="font-weight:700;color:${n.status === 'low' ? 'var(--low)' : n.status === 'high' ? 'var(--high)' : 'inherit'}">
      <input class="in" data-k="unit" value="${esc(r.unit)}" aria-label="Единицы" placeholder="Ед.">
      <button type="button" class="x" data-del="${i}" aria-label="Удалить строку">✕</button>
      <div class="meta">Норма <input class="in" data-k="refLow" value="${esc(r.refLow ?? '')}" aria-label="Норма от" placeholder="от"> – <input class="in" data-k="refHigh" value="${esc(r.refHigh ?? '')}" aria-label="Норма до" placeholder="до">
        ${n.status === 'low' || n.status === 'high' ? `<span class="tag ${n.status}">${n.status === 'low' ? '↓' : '↑'}</span>` : ''}
        ${!known && r.name ? '<span class="tag" style="background:var(--soft)">новый</span>' : ''}${r.refText && r.refLow == null && r.refHigh == null ? ` ${esc(r.refText)}` : ''}</div>
    </div>`;
  }).join('') || '<p class="empty">Числовых показателей не найдено — это нормально для протоколов и заключений.</p>';
  $$('[data-del]').forEach(b => b.onclick = () => { syncRows(); draft.rows.splice(+b.dataset.del, 1); drawRows(p); });
  // перерисовку откладываем: change приходит в момент потери фокуса, и замена узлов прямо в нём ломает браузер
  $$('#rows .rrow input').forEach(i => i.onchange = () => { syncRows(); setTimeout(() => { if ($('#rows') && draft) drawRows(p); }, 0); });
}
function syncRows() {
  $$('#rows .rrow').forEach(row => {
    const r = draft.rows[+row.dataset.i];
    $$('input[data-k]', row).forEach(inp => r[inp.dataset.k] = inp.value);
  });
}

// ---------- настройки ----------
async function viewSettings() {
  let persisted = false, usage = '';
  if (navigator.storage?.persisted) persisted = await navigator.storage.persisted();
  if (navigator.storage?.estimate) { const e = await navigator.storage.estimate(); usage = (e.usage / 1024 / 1024).toFixed(1) + ' МБ'; }
  const profiles = await db.profiles.toArray();
  app.innerHTML = `
    <div class="top"><h1 class="grow">Настройки</h1></div>
    <div class="pad stack">
      <section class="card"><h2>Распознавание</h2>
        <label class="f">Адрес сервера<input class="in" id="url" value="${esc(settings.apiUrl)}" placeholder="https://functions.yandexcloud.net/…" inputmode="url"></label>
        <label class="f">Код доступа<input class="in" id="tok" value="${esc(settings.apiToken)}" autocomplete="off"></label>
        <div class="row"><button type="button" class="btn" id="save" style="flex:1">Сохранить</button><button type="button" class="btn ghost" id="ping" style="flex:1">Проверить</button></div>
      </section>
      <section class="card"><h2>Почта</h2>
        <p class="sub" style="margin:0">Почтовый агент сам забирает письма с анализами и шифрует их ключом этого телефона. Прочитать их может только этот телефон.</p>
        <div id="mailkey"></div>
        <a class="btn ghost" href="#/inbox">Входящие из почты</a>
        <span class="sub">Без агента: в почтовом приложении откройте вложение → «Поделиться» → «Healthy Family».</span>
      </section>
      ${await backupCard()}
      <section class="card"><h2>Данные на телефоне</h2>
        <div class="between"><span>Занято</span><span class="sub">${usage || '—'}</span></div>
        <div class="between"><span>Защита от автоочистки</span><span class="tag ${persisted ? 'normal' : 'high'}">${persisted ? 'Включена' : 'Не включена'}</span></div>
        ${persisted ? '' : '<button type="button" class="btn ghost" id="persist">Включить защиту</button><span class="sub">Если браузер не разрешает — установите приложение на главный экран и попробуйте снова.</span>'}
        <button type="button" class="btn ghost" id="export">Скачать весь архив одним файлом</button>
        <label class="btn ghost" style="cursor:pointer">Восстановить из файла<input type="file" id="import" accept=".json,application/json" hidden></label>
        <span class="sub">Файл архива — дополнительная страховка к облачной копии. Он не зашифрован, поэтому храните его в надёжном месте.</span>
      </section>
      <section class="card"><h2>Профили</h2>
        ${profiles.map(x => `<a class="between" href="#/profile/${x.id}" style="text-decoration:none;color:inherit;min-height:40px;align-items:center"><span>${esc(x.name)}</span><span class="sub">${x.kind === 'pet' ? 'питомец' : x.kind === 'child' ? 'ребёнок' : 'взрослый'} · анамнез ›</span></a>`).join('')}
        <a class="btn ghost" href="#/profile/new">Добавить профиль</a>
      </section>
      <button type="button" class="btn ghost" id="checkupd">Проверить обновления</button>
      <p class="sub" style="text-align:center">Версия ${APP_VERSION} · схема базы ${db.verno}</p>
    </div>
    ${nav('settings')}`;
  const drawKey = async () => {
    const kp = await MailKey.get();
    const box = $('#mailkey'); if (!box) return;
    if (!kp) {
      box.innerHTML = '<button type="button" class="btn" id="mkcreate" style="width:100%">Создать ключ почты</button>';
      $('#mkcreate').onclick = async () => { await MailKey.create(); drawKey(); };
      return;
    }
    const pub = await MailKey.publicB64(kp);
    box.innerHTML = `<label class="f">Публичный ключ — вставьте его в настройки почтового агента<textarea class="in" readonly rows="3" style="font-size:11px">${esc(pub)}</textarea></label>
      <button type="button" class="btn ghost" id="mkcopy" style="width:100%">Скопировать ключ</button>`;
    $('#mkcopy').onclick = async () => { try { await navigator.clipboard.writeText(pub); toast('Ключ скопирован'); } catch (e) { $('#mailkey textarea').select(); } };
  };
  drawKey();
  $('#save').onclick = () => { localStorage.setItem('apiUrl', $('#url').value.trim()); localStorage.setItem('apiToken', $('#tok').value.trim()); toast('Сохранено'); };
  $('#ping').onclick = async () => {
    localStorage.setItem('apiUrl', $('#url').value.trim()); localStorage.setItem('apiToken', $('#tok').value.trim());
    try { const r = await api('ping', {}); toast(`Связь есть${r.user ? ', ' + r.user : ''}`); } catch (e) { toast(e.message); }
  };
  const ps = $('#persist');
  if (ps) ps.onclick = async () => { const ok = await navigator.storage.persist(); toast(ok ? 'Защита включена' : 'Браузер пока не разрешил'); viewSettings(); };
  bindBackupCard(() => viewSettings());
  $('#checkupd').onclick = async () => {
    toast('Проверяю…');
    try {
      const r = await fetch('app.js', { cache: 'no-store' }); const t = await r.text();
      const v = (t.match(/APP_VERSION = '([^']+)'/) || [])[1];
      if (v && v !== APP_VERSION) { toast('Найдена версия ' + v + ', обновляю…'); if (swReg) await swReg.update(); setTimeout(() => location.reload(), 1500); }
      else toast('У вас последняя версия ' + APP_VERSION);
    } catch (e) { toast('Нет интернета — проверьте позже'); }
  };
  $('#export').onclick = async () => {
    toast('Готовлю архив…');
    const blob = await exportAll();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `healthy-family-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  };
  $('#import').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (!confirm('Текущие данные на телефоне будут заменены данными из файла. Продолжить?')) return;
    try { await importAll(f); toast('Архив восстановлен'); render(); } catch (err) { toast(err.message); }
  };
}

// ---------- роутер ----------
const routes = [
  [/^#?\/?$/, viewHome],
  [/^#\/sections$/, viewSections],
  [/^#\/section\/(\d+)$/, viewSection],
  [/^#\/record\/(\d+)$/, viewRecord],
  [/^#\/record\/edit\/(\d+)$/, viewRecordEdit],
  [/^#\/sections\/edit$/, viewSectionsEdit],
  [/^#\/profile\/edit\/(\d+)$/, viewProfileEdit],
  [/^#\/metric\/(.+)$/, m => viewMetric(decodeURIComponent(m))],
  [/^#\/calendar/, viewCalendar],
  [/^#\/backup\/restore$/, viewBackupRestore],
  [/^#\/dynamics$/, viewDynamics],
  [/^#\/measure\/new$/, viewMeasureNew],
  [/^#\/meds\/(\d+)$/, viewMeds],
  [/^#\/med\/new\/(\d+)$/, pid => viewMedForm('new', pid)],
  [/^#\/med\/(\d+)$/, id => viewMedForm('edit', id)],
  [/^#\/vaccines\/(\d+)$/, viewVaccines],
  [/^#\/vaccine\/new\/(\d+)$/, pid => viewVaccineForm('new', pid)],
  [/^#\/vaccine\/(\d+)$/, id => viewVaccineForm('edit', id)],
  [/^#\/cycle\/(\d+)$/, viewCycle],
  [/^#\/pollen\/(\d+)$/, viewPollen],
  [/^#\/emergency\/(\d+)$/, viewEmergency],
  [/^#\/summary\/(\d+)$/, viewSummary],
  [/^#\/upload/, viewUpload],
  [/^#\/settings$/, viewSettings],
  [/^#\/inbox$/, viewInbox],
  [/^#\/docs\/(\d+)$/, viewDocs],
  [/^#\/doc\/new\/(\d+)$/, pid => viewDocForm('new', pid)],
  [/^#\/doc\/edit\/(\d+)$/, id => viewDocForm('edit', id)],
  [/^#\/doc\/(\d+)$/, viewDoc],
  [/^#\/profile\/new/, viewProfileNew],
  [/^#\/profile\/(\d+)$/, viewProfile],
  [/^#\/history\/new\/(\w+)\/(\d+)$/, (k, pid) => viewHistoryForm('new', k, pid)],
  [/^#\/history\/(\d+)$/, id => viewHistoryForm(id)]
];
async function render() {
  const hash = location.hash || '#/';
  if (!hash.startsWith('#/upload') && draft && draft.stage !== 'review') draft = null;
  for (const [re, fn] of routes) {
    const m = hash.match(re);
    if (m) { window.scrollTo(0, 0); return fn(...m.slice(1)); }
  }
  location.hash = '#/';
}
window.addEventListener('hashchange', render);

// ---------- установка и обновления ----------
const Install = {
  prompt: null,
  get standalone() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; },
  get platform() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) {
      if (/SamsungBrowser|YaBrowser|YaApp|OPR|Firefox|Telegram|Instagram|FBAN|FBAV|VKAndroidApp|; wv\)/.test(ua)) return 'android-other';
      return 'android-chrome';
    }
    return 'desktop';
  },
  // карточка-подсказка: показывается, пока приложение открыто во вкладке браузера
  card() {
    if (this.standalone) return '';
    const p = this.platform;
    let body;
    if (p === 'android-chrome') body = this.prompt
      ? '<p class="sub" style="margin:0">Установите Healthy Family как отдельное приложение — с иконкой на рабочем столе и без адресной строки.</p><button type="button" class="btn" id="doinstall">Установить приложение</button>'
      : '<p class="sub" style="margin:0">Чтобы установить: меню <b>⋮</b> → <b>«Установить приложение»</b>. Если пункта нет, обновите страницу и подождите несколько секунд.</p>';
    else if (p === 'android-other') body = '<p class="sub" style="margin:0">Ссылка открыта не в Chrome — здесь приложение не установится. Скопируйте адрес и откройте его в <b>Google Chrome</b>.</p><button type="button" class="btn ghost" id="copyurl">Скопировать адрес</button>';
    else if (p === 'ios') body = '<p class="sub" style="margin:0">Откройте ссылку в <b>Safari</b> → кнопка <b>«Поделиться»</b> → <b>«На экран „Домой“»</b>. Пользуйтесь приложением только с иконки: так данные хранятся надёжно.</p>';
    else body = '<p class="sub" style="margin:0">Healthy Family рассчитано на телефон. Откройте этот адрес на телефоне в Chrome (Android) или Safari (iPhone).</p>';
    return `<section class="card" id="installcard" style="background:var(--accent-soft)"><h2>Установите приложение</h2>${body}</section>`;
  },
  bind() {
    const b = $('#doinstall');
    if (b) b.onclick = async () => { const p = this.prompt; this.prompt = null; await p.prompt(); render(); };
    const c = $('#copyurl');
    if (c) c.onclick = async () => { try { await navigator.clipboard.writeText(location.href.split('#')[0]); toast('Адрес скопирован — вставьте его в Chrome'); } catch (e) { toast(location.href.split('#')[0]); } };
  }
};
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); Install.prompt = e; if ($('#installcard')) render(); });
window.addEventListener('appinstalled', () => { Install.prompt = null; toast('Приложение установлено — открывайте его с иконки'); });

let swReg = null;
async function setupUpdates() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  // новая версия взяла управление → один раз перезагружаемся, чтобы показать её
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading || (draft && (draft.stage === 'review' || draft.busy))) return;
    reloading = true; location.reload();
  });
  try { swReg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }); } catch (e) { return; }
  // проверяем обновления при каждом возвращении в приложение и раз в час
  const check = () => swReg && swReg.update().catch(() => {});
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setInterval(check, 60 * 60 * 1000);
}
function announceVersion() {
  const prev = localStorage.getItem('seenVersion');
  if (prev && prev !== APP_VERSION) toast('Приложение обновлено до версии ' + APP_VERSION);
  localStorage.setItem('seenVersion', APP_VERSION);
}

(async function start() {
  await Metrics.load();
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  setupUpdates();
  Backup.init();
  render();
  announceVersion();
})();
