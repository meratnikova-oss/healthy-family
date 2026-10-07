const APP_VERSION = '0.4.4';
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
  set profileId(v) { localStorage.setItem('profileId', v); }
};

async function api(action, payload) {
  if (!settings.apiUrl) throw new Error('Не указан адрес сервера распознавания. Откройте «Настройки».');
  const r = await fetch(settings.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Access-Code': settings.apiToken },
    body: JSON.stringify({ action, ...payload, code: settings.apiToken })
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) throw new Error('Код доступа не принят. Проверьте его в «Настройках».');
  if (r.status === 429) throw new Error(data.error || 'Лимит распознаваний на этот месяц исчерпан.');
  if (!r.ok) throw new Error(data.error || 'Сервер распознавания ответил ошибкой ' + r.status);
  return data;
}

async function currentProfile() {
  const all = await db.profiles.toArray();
  if (!all.length) return null;
  return all.find(p => p.id === settings.profileId) || all[0];
}

const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  sections: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
};
function nav(active) {
  const items = [['#/', 'home', 'Главная'], ['#/sections', 'sections', 'Разделы'], ['#/upload', 'upload', 'Загрузить'], ['#/settings', 'settings', 'Настройки']];
  return `<nav class="bottom">${items.map(([h, k, t]) => `<a href="${h}" class="${active === k ? 'on' : ''}">${ICONS[k]}${t}</a>`).join('')}</nav>`;
}
function backLink(href) { return `<a class="back" href="${href}" aria-label="Назад">‹</a>`; }

function profileChips(profiles, current, hrefBase) {
  return `<div class="chips">${profiles.map(p => `
    <button type="button" class="chip ${p.id === current.id ? 'on' : ''}" data-profile="${p.id}">
      <span class="av">${esc((p.name || '?')[0].toUpperCase())}</span>${esc(p.name)}</button>`).join('')}
    <a class="chip add" href="#/profile/new" aria-label="Добавить профиль">+</a></div>`;
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
      ${profileForm('Создать профиль')}
    </div>`;
  bindProfileForm();
}

function profileForm(cta) {
  return `<form id="pform" class="card">
    <h2>Первый профиль</h2>
    <label class="f">Имя<input class="in" name="name" required placeholder="Например, Мария"></label>
    <label class="f">Кто это<select class="in" name="kind"><option value="adult">Взрослый</option><option value="child">Ребёнок</option><option value="pet">Питомец</option></select></label>
    <label class="f" id="sexf">Пол<select class="in" name="sex"><option value="f">Женский</option><option value="m">Мужской</option></select></label>
    <label class="f">Дата рождения<input class="in" type="date" name="birth"></label>
    <label class="f" id="speciesf" hidden>Вид и порода<input class="in" name="species" placeholder="Например, собака, лабрадор"></label>
    <button class="btn" type="submit">${cta}</button>
  </form>`;
}
function bindProfileForm() {
  const f = $('#pform');
  f.kind.onchange = () => { $('#speciesf').hidden = f.kind.value !== 'pet'; };
  f.onsubmit = async e => {
    e.preventDefault();
    const p = { name: f.name.value.trim(), kind: f.kind.value, sex: f.sex.value, birth: f.birth.value || null, species: f.species.value.trim() || null };
    const id = await createProfile(p);
    settings.profileId = id;
    location.hash = '#/';
    render();
  };
}

async function viewProfileNew() {
  app.innerHTML = `<div class="top">${backLink('#/')}<h1 class="grow">Новый профиль</h1></div><div class="pad">${profileForm('Добавить')}</div>${nav('')}`;
  $('#pform h2').textContent = 'Кого добавляем';
  bindProfileForm();
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
  const profiles = await db.profiles.toArray();
  if (!profiles.length) return viewOnboarding();
  const p = await currentProfile();
  const flags = await latestFlags(p.id);
  const recent = await db.records.where('profileId').equals(p.id).reverse().sortBy('date');
  const sections = await db.sections.where('profileId').equals(p.id).toArray();
  const secName = id => (sections.find(s => s.id === id) || {}).name || '';
  app.innerHTML = `
    <div class="top"><div class="grow"><div class="sub">${p.kind === 'pet' ? 'Питомец' : p.kind === 'child' ? 'Ребёнок' : 'Профиль'}</div><h1>${esc(p.name)}</h1></div>
      <a class="pill" href="#/profile/${p.id}" style="text-decoration:none;color:inherit">Анамнез и документы</a></div>
    ${profileChips(profiles, p)}
    <div class="pad stack">
      <section class="card">
        <h2>Требуют внимания</h2>
        ${flags.length ? flags.map(r => `
          <a class="row ${r.status}" href="#/metric/${encodeURIComponent(r.metricId)}" style="text-decoration:none;color:inherit">
            <span class="badge">${r.status === 'low' ? '↓' : '↑'}</span>
            <div class="grow"><div style="font-weight:500">${esc(Metrics.nameFor(r.metricId, r.rawName))}</div>
              <div class="sub">${r.status === 'low' ? 'Ниже' : 'Выше'} референса · ${fmtDate(r.date)}</div></div>
            <span class="val">${esc(fmtNum(r.num))} <span class="sub">${esc(r.unit)}</span></span>
          </a>`).join('') : '<p class="empty">Последние значения всех показателей в пределах референса — или анализов пока нет.</p>'}
      </section>
      <section class="card">
        <div class="between"><h2>Последние записи</h2><a href="#/sections" style="font-size:13px;text-decoration:none">Все разделы</a></div>
        ${recent.length ? recent.slice(0, 6).map(r => `
          <a class="row" href="#/record/${r.id}" style="text-decoration:none;color:inherit">
            <div class="grow"><div style="font-weight:500">${esc(r.title || RECORD_TYPES[r.type])}</div>
              <div class="sub">${fmtDate(r.date)} · ${esc(r.sectionIds.map(secName).filter(Boolean).join(', '))}</div></div>
            <span class="tag kind">${esc(RECORD_TYPES[r.type] || 'Документ')}</span>
          </a>`).join('') : '<p class="empty">Загрузите первый анализ или документ — кнопка внизу справа.</p>'}
      </section>
    </div>
    <a class="fab" href="#/upload">+ Загрузить</a>
    ${nav('home')}`;
  bindProfileChips();
  expiringDocs().then(async docs => {
    if (!docs.length || !$('.pad.stack')) return;
    const names = Object.fromEntries((await db.profiles.toArray()).map(x => [x.id, x.name]));
    const a = document.createElement('section');
    a.className = 'card'; a.style.background = 'var(--high-soft)';
    a.innerHTML = '<h2>Документы</h2>' + docs.map(d => `<a class="row hist" href="#/doc/${d.id}"><span class="grow">${esc(docTitle(d))} · ${esc(names[d.profileId] || '')}</span>${expiryTag(d)}</a>`).join('');
    $('.pad.stack').prepend(a);
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
  const profiles = await db.profiles.toArray();
  if (!profiles.length) return viewOnboarding();
  const p = await currentProfile();
  const sections = (await db.sections.where('profileId').equals(p.id).toArray()).sort((a, b) => a.order - b.order);
  const counts = {};
  for (const s of sections) counts[s.id] = await db.records.where('sectionIds').equals(s.id).count();
  app.innerHTML = `
    <div class="top"><h1 class="grow">Разделы</h1></div>
    ${profileChips(profiles, p)}
    <div class="pad grid2">
      ${sections.map(s => `
        <a class="tile" href="#/section/${s.id}">
          <div class="row" style="gap:8px"><span class="dotc" style="background:${s.color}"></span><span style="font-weight:600;font-size:14px">${esc(s.name)}</span></div>
          <span class="sub">${counts[s.id] ? counts[s.id] + ' ' + plural(counts[s.id], 'запись', 'записи', 'записей') : 'Пусто'}</span>
        </a>`).join('')}
      <button type="button" class="tile" id="addsec" style="border:1.5px dashed #9AA0AA;background:transparent;cursor:pointer;justify-content:center;align-items:center">+ Свой раздел</button>
    </div>
    ${nav('sections')}`;
  bindProfileChips();
  $('#addsec').onclick = async () => {
    const name = prompt('Название раздела');
    if (!name) return;
    await db.sections.add({ profileId: p.id, name: name.trim(), color: SECTION_COLORS[sections.length % SECTION_COLORS.length], order: sections.length });
    render();
  };
}
function plural(n, a, b, c) { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; }

async function viewSection(id) {
  const s = await db.sections.get(+id);
  if (!s) { location.hash = '#/sections'; return; }
  const records = (await db.records.where('sectionIds').equals(s.id).toArray()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const clinics = await db.clinics.toArray(), doctors = await db.doctors.toArray();
  const nm = (arr, id) => (arr.find(x => x.id === id) || {}).name || '';
  app.innerHTML = `
    <div class="top">${backLink('#/sections')}<div class="grow"><div class="row" style="gap:10px"><span class="dotc" style="width:12px;height:12px;border-radius:6px;background:${s.color}"></span><h1>${esc(s.name)}</h1></div></div></div>
    <div class="pad">
      ${records.length ? records.map(r => `
        <div class="tl"><div class="rail"><i style="background:${s.color}"></i><b></b></div>
          <a href="#/record/${r.id}">
            <div class="between"><span class="tag kind">${esc(RECORD_TYPES[r.type] || 'Документ')}</span><span class="sub">${fmtDate(r.date)}</span></div>
            <span style="font-weight:500">${esc(r.title || RECORD_TYPES[r.type])}</span>
            <span class="sub">${esc([nm(doctors, r.doctorId), nm(clinics, r.clinicId)].filter(Boolean).join(' · '))}</span>
          </a></div>`).join('') : '<div class="card"><p class="empty">В разделе пока нет записей. Загрузите протокол осмотра, УЗИ, анализ или любой другой документ.</p></div>'}
      <div style="margin-top:16px"><a class="btn" href="#/upload?section=${s.id}">Добавить запись в раздел</a></div>
    </div>
    ${nav('sections')}`;
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
    <div class="top">${backLink(sections[0] ? '#/section/' + sections[0].id : '#/')}<span class="sub grow">${esc(sections.filter(Boolean).map(s => s.name).join(', '))}</span></div>
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
        <span class="sub">Файлы — оригиналы хранятся полностью</span>
        <div class="row" style="flex-wrap:wrap;gap:8px">${files.map(f => `<button type="button" class="pill" data-file="${f.id}">${esc(f.name)}</button>`).join('') || '<span class="empty">Нет файлов</span>'}</div>
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
  $$('[data-file]').forEach(b => b.onclick = async () => {
    const f = await db.files.get(+b.dataset.file);
    const url = URL.createObjectURL(f.blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
  $('#del').onclick = async () => {
    if (!confirm('Удалить запись вместе с файлами и показателями?')) return;
    await deleteRecord(r.id);
    toast('Запись удалена');
    location.hash = sections[0] ? '#/section/' + sections[0].id : '#/';
  };
}

async function viewMetric(metricId) {
  const p = await currentProfile();
  const rows = (await db.results.where('[profileId+metricId]').equals([p.id, metricId]).toArray())
    .filter(r => r.num !== null).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
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
      <section class="card">${rows.length > 1 ? chart(rows) : '<p class="empty">График появится, когда будет хотя бы два значения.</p>'}</section>
      <section class="card" id="info"></section>
      ${m?.tip ? `<section class="card"><h2>Как отслеживать</h2><p style="margin:0;font-size:14px;line-height:1.5">${esc(m.tip)}</p><span class="sub">Подсказка не заменяет консультацию врача.</span></section>` : ''}
      <section class="card"><h2>Все значения</h2>
        ${rows.slice().reverse().map(r => `<a class="row" href="#/record/${r.recordId}" style="text-decoration:none;color:inherit;min-height:44px">
          <span class="grow">${fmtDate(r.date)}</span><span class="val ${r.status}">${fmtNum(r.num)}</span><span class="sub">${esc(r.unit)}</span></a>`).join('') || '<p class="empty">Значений пока нет.</p>'}
      </section>
    </div>
    ${nav('')}`;
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

async function viewUpload() {
  const profiles = await db.profiles.toArray();
  if (!profiles.length) return viewOnboarding();
  let p = await currentProfile();
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const preSection = +q.get('section') || null;
  if (draft && draft.stage === 'review') return viewReview();
  const keep = q.has('prefilled') && draft && draft.files?.length ? draft : null;
  draft = keep || { stage: 'pick', profileId: p.id, files: [], preSection };
  if (q.has('shared')) draft.files = await Shared.take();
  p = profiles.find(x => x.id === draft.profileId) || p;
  app.innerHTML = `
    <div class="top">${backLink('#/')}<h1 class="grow">Новая запись</h1></div>
    <div class="pad stack">
      <div class="stack" style="gap:8px"><span class="sub">Чья запись</span>
        <div class="row" style="flex-wrap:wrap;gap:8px">${profiles.map(x => `<button type="button" class="pill ${x.id === p.id ? 'on' : ''}" data-who="${x.id}">${esc(x.name)}</button>`).join('')}</div></div>
      <label class="drop">
        <input type="file" id="files" multiple accept="image/*,.pdf,.docx,.doc,.xlsx,.xls,.csv,.txt">
        <span class="badge" style="width:48px;height:48px;border-radius:14px;background:var(--accent-soft);color:var(--accent)">${ICONS.upload.replace('<svg', '<svg width="24" height="24"')}</span>
        <span><span style="font-weight:600;display:block">Фото, PDF, Word или Excel</span><span class="sub">Можно несколько файлов с одного приёма — они станут одной записью</span></span>
      </label>
      ${draft.fromInbox ? '<span class="sub">Файлы из письма — выберите, чья это запись, и нажмите «Распознать».</span>' : ''}
      <ul class="files" id="flist" style="margin:0;padding-left:18px"></ul>
      <button type="button" class="btn" id="recognize" disabled>Распознать</button>
      <button type="button" class="btn ghost" id="justsave" disabled>Сохранить без распознавания</button>
      <p class="progress" id="prog"></p>
    </div>
    ${nav('upload')}`;
  $$('[data-who]').forEach(b => b.onclick = () => { draft.profileId = +b.dataset.who; $$('[data-who]').forEach(x => x.classList.toggle('on', x === b)); });
  const showFiles = () => {
    $('#flist').innerHTML = draft.files.map(f => `<li>${esc(f.name)} <span class="sub">${(f.size / 1024 / 1024).toFixed(1)} МБ</span></li>`).join('');
    $('#recognize').disabled = $('#justsave').disabled = !draft.files.length;
  };
  $('#files').onchange = e => { draft.files = draft.files.concat([...e.target.files]); showFiles(); };
  showFiles();
  $('#recognize').onclick = recognize;
  $('#justsave').onclick = () => { draft.parsed = { docType: 'document', results: [] }; draft.text = ''; draft.stage = 'review'; viewReview(); };
}

async function recognize() {
  const prog = $('#prog'); const btns = [$('#recognize'), $('#justsave')];
  btns.forEach(b => b.disabled = true);
  try {
    let text = '', notes = [];
    for (const [i, f] of draft.files.entries()) {
      prog.textContent = `Читаю файл ${i + 1} из ${draft.files.length}: ${f.name}`;
      let out;
      try { out = await Extract.run(f); } catch (e) { notes.push(`${f.name}: не удалось прочитать (${e.message})`); continue; }
      if (out.unsupported) { notes.push(`${f.name}: ${out.unsupported}`); continue; }
      if (out.text) text += `\n\n=== ${f.name} ===\n${out.text}`;
      if (out.images) for (const [j, img] of out.images.entries()) {
        prog.textContent = `Распознаю ${f.name}, страница ${j + 1} из ${out.images.length}`;
        const r = await api('ocr', { image: img });
        text += `\n\n=== ${f.name}, стр. ${j + 1} ===\n${r.text || ''}`;
      }
    }
    if (!text.trim()) throw new Error(notes.join('\n') || 'В файлах не нашлось текста.');
    prog.textContent = 'Разбираю показатели…';
    const p = await db.profiles.get(draft.profileId);
    const sections = await db.sections.where('profileId').equals(p.id).toArray();
    const parsed = await api('parse', { text: text.slice(0, 30000), profileKind: p.kind, sections: sections.map(s => s.name) });
    draft.text = text.trim(); draft.parsed = parsed; draft.notes = notes; draft.stage = 'review';
    viewReview();
  } catch (e) {
    prog.textContent = '';
    toast(e.message);
    btns.forEach(b => b.disabled = false);
  }
}

async function viewReview() {
  const d = draft, pz = d.parsed || {};
  const p = await db.profiles.get(d.profileId);
  const sections = (await db.sections.where('profileId').equals(p.id).toArray()).sort((a, b) => a.order - b.order);
  const clinics = await db.clinics.toArray(), doctors = await db.doctors.toArray();
  const hints = (pz.sectionHints || []).map(h => String(h).toLowerCase());
  const pre = new Set(sections.filter(s => s.id === d.preSection || hints.includes(s.name.toLowerCase())).map(s => s.id));
  if (!pre.size) {
    // если ИИ не подсказал — берём раздел первого распознанного показателя
    const m = (pz.results || []).map(r => Metrics.match(r.name)).find(Boolean);
    const s = m && sections.find(s => s.name === m.section) || sections.find(s => /анализ/i.test(s.name));
    if (s && (pz.results || []).length) pre.add(s.id);
  }
  const unsure = new Set(pz.uncertain || []);
  d.rows = d.rows || (pz.results || []).map(r => ({ ...r }));
  app.innerHTML = `
    <div class="top"><button type="button" class="back linkbtn" id="cancel" aria-label="Отменить" style="color:var(--ink)">✕</button><h1 class="grow">Проверьте запись</h1></div>
    <form id="rev" class="pad stack">
      ${d.notes?.length ? `<div class="card" style="background:var(--high-soft)"><span style="font-size:14px">${d.notes.map(esc).join('<br>')}</span></div>` : ''}
      <section class="card">
        <span class="sub">${esc(p.name)} · файлов: ${d.files.length}</span>
        ${pz.patientName ? `<span class="sub">Пациент в документе: <b>${esc(pz.patientName)}</b>. Если это не ${esc(p.name)}, вернитесь назад и выберите другой профиль.</span>` : ''}
        <label class="f ${unsure.has('title') ? 'warn' : ''}">Название<input class="in" name="title" value="${esc(pz.title || '')}" placeholder="Например, Общий анализ крови"></label>
        <label class="f">Тип<select class="in" name="type">${Object.entries(RECORD_TYPES).map(([k, v]) => `<option value="${k}" ${k === (pz.docType || 'document') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="f ${unsure.has('date') ? 'warn' : ''}">Дата ${unsure.has('date') ? '— проверьте, распознано неуверенно' : ''}<input class="in" type="date" name="date" value="${esc(pz.date || '')}"></label>
        <label class="f ${unsure.has('clinic') ? 'warn' : ''}">Клиника ${unsure.has('clinic') ? '— проверьте' : ''}<input class="in" name="clinic" list="clist" value="${esc(pz.clinic || '')}"></label>
        <label class="f ${unsure.has('doctor') ? 'warn' : ''}">Врач ${unsure.has('doctor') ? '— проверьте' : ''}<input class="in" name="doctor" list="dlist" value="${esc(pz.doctor || '')}"></label>
        <datalist id="clist">${clinics.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>
        <datalist id="dlist">${doctors.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>
        ${pz.conclusion !== undefined ? `<label class="f">Заключение<textarea class="in" name="conclusion">${esc(pz.conclusion || '')}</textarea></label>` : ''}
      </section>
      <section class="card"><h2>Разделы</h2>
        <div class="row" style="flex-wrap:wrap;gap:8px">${sections.map(s => `<label class="pill ${pre.has(s.id) ? 'on' : ''}"><input type="checkbox" name="sec" value="${s.id}" ${pre.has(s.id) ? 'checked' : ''} hidden>${esc(s.name)}</label>`).join('')}</div>
      </section>
      <section class="card">
        <div class="between"><h2>Показатели · ${d.rows.length}</h2><button type="button" class="linkbtn" id="addrow">+ Добавить</button></div>
        <div class="rtable" id="rows"></div>
      </section>
      <button class="btn" type="submit">Сохранить в архив</button>
    </form>`;
  drawRows(p);
  $$('label.pill input[name=sec]').forEach(i => i.onchange = () => i.parentElement.classList.toggle('on', i.checked));
  $('#addrow').onclick = () => { syncRows(); d.rows.push({ name: '', value: '', unit: '', refLow: '', refHigh: '' }); drawRows(p); };
  $('#cancel').onclick = () => { if (confirm('Отменить загрузку?')) { draft = null; location.hash = '#/'; render(); } };
  $('#rev').onsubmit = async e => { e.preventDefault(); syncRows(); await saveDraft(new FormData(e.target)); };
}

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
  $$('#rows .rrow input').forEach(i => i.onchange = () => { syncRows(); drawRows(p); });
}
function syncRows() {
  $$('#rows .rrow').forEach(row => {
    const r = draft.rows[+row.dataset.i];
    $$('input[data-k]', row).forEach(inp => r[inp.dataset.k] = inp.value);
  });
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
  // копим нераспознанные названия — позже (с согласия) уйдут в общий справочник без значений
  if (unknown.length) {
    const kv = (await db.kv.get('unknownMetrics')) || { key: 'unknownMetrics', value: [] };
    kv.value = [...new Set([...kv.value, ...unknown])];
    await db.kv.put(kv);
  }
  if (d.fromInbox) await MailInbox.ack(d.fromInbox).catch(() => {});
  draft = null;
  toast('Сохранено в архив');
  location.hash = sectionIds[0] ? '#/section/' + sectionIds[0] : '#/';
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
      <section class="card"><h2>Данные на телефоне</h2>
        <div class="between"><span>Занято</span><span class="sub">${usage || '—'}</span></div>
        <div class="between"><span>Защита от автоочистки</span><span class="tag ${persisted ? 'normal' : 'high'}">${persisted ? 'Включена' : 'Не включена'}</span></div>
        ${persisted ? '' : '<button type="button" class="btn ghost" id="persist">Включить защиту</button><span class="sub">Если браузер не разрешает — установите приложение на главный экран и попробуйте снова.</span>'}
        <button type="button" class="btn ghost" id="export">Скачать весь архив одним файлом</button>
        <label class="btn ghost" style="cursor:pointer">Восстановить из файла<input type="file" id="import" accept=".json,application/json" hidden></label>
        <span class="sub">Пока нет облачного бэкапа, скачивайте архив после крупных загрузок и храните файл в надёжном месте.</span>
      </section>
      <section class="card"><h2>Профили</h2>
        ${profiles.map(x => `<a class="between" href="#/profile/${x.id}" style="text-decoration:none;color:inherit;min-height:40px;align-items:center"><span>${esc(x.name)}</span><span class="sub">${x.kind === 'pet' ? 'питомец' : x.kind === 'child' ? 'ребёнок' : 'взрослый'} · анамнез ›</span></a>`).join('')}
        <a class="btn ghost" href="#/profile/new">Добавить профиль</a>
      </section>
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
  [/^#\/metric\/(.+)$/, m => viewMetric(decodeURIComponent(m))],
  [/^#\/upload/, viewUpload],
  [/^#\/settings$/, viewSettings],
  [/^#\/inbox$/, viewInbox],
  [/^#\/docs\/(\d+)$/, viewDocs],
  [/^#\/doc\/new\/(\d+)$/, pid => viewDocForm('new', pid)],
  [/^#\/doc\/edit\/(\d+)$/, id => viewDocForm('edit', id)],
  [/^#\/doc\/(\d+)$/, viewDoc],
  [/^#\/profile\/new$/, viewProfileNew],
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

(async function start() {
  await Metrics.load();
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  render();
})();
