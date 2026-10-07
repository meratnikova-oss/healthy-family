// Анамнез: заболевания (МКБ-10), операции, травмы, аллергии, беременности и роды, наследственность.
// Справочник МКБ-10 — официальный справочник НСИ Минздрава (OID 1.2.643.5.1.13.13.11.1005),
// в России действует именно МКБ-10. Лежит локально в icd10.json, подсказки работают без интернета.

const ICD = (() => {
  let list = null, aliases = {}, byCode = new Map(), loading = null;
  const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[\[\]().,;:«»"*]/g, ' ').replace(/\s+/g, ' ').trim();

  function load() {
    if (!loading) loading = Promise.all([
      fetch('icd10.json').then(r => r.json()),
      fetch('icd10-aliases.json').then(r => r.json()).catch(() => ({}))
    ]).then(([rows, al]) => {
      list = rows.map(([c, n]) => ({ code: c, name: n, nn: norm(n), cl: c.toLowerCase() }));
      list.forEach(x => byCode.set(x.code, x));
      aliases = al;
    });
    return loading;
  }

  function search(q, limit = 12) {
    if (!list) return [];
    const nq = norm(q);
    if (nq.length < 2) return [];
    const out = [], used = new Set();
    const push = (x, hint) => { if (x && !used.has(x.code)) { used.add(x.code); out.push({ ...x, hint }); } };

    // код: «I10», «k29.5»
    if (/^[a-z]\d/.test(nq)) {
      list.filter(x => x.cl.startsWith(nq)).slice(0, limit).forEach(x => push(x));
      return out;
    }
    // бытовые названия: «давление», «щитовидка», «ветрянка»
    for (const [k, codes] of Object.entries(aliases)) {
      if (k.startsWith(nq) || (nq.length >= 4 && nq.startsWith(k))) codes.forEach(c => push(byCode.get(c), k));
    }
    // поиск по названию: все слова запроса должны встретиться
    const tokens = nq.split(' ');
    const scored = [];
    for (const x of list) {
      if (!tokens.every(t => x.nn.includes(t))) continue;
      let s = x.nn.startsWith(nq) ? 0 : (' ' + x.nn).includes(' ' + tokens[0]) ? 1 : 2;
      if (x.code.length > 3) s += 0.5;
      scored.push([s + x.nn.length / 1000, x]);
    }
    scored.sort((a, b) => a[0] - b[0]).slice(0, limit).forEach(([, x]) => push(x));
    return out.slice(0, limit);
  }

  return { load, search, get: c => byCode.get(c), ready: () => !!list };
})();

const SURGERIES = [
  'Аппендэктомия (удаление аппендикса)', 'Холецистэктомия (удаление желчного пузыря)', 'Лапароскопическая холецистэктомия',
  'Грыжесечение паховой грыжи', 'Грыжесечение пупочной грыжи', 'Кесарево сечение', 'Диагностическая лапароскопия',
  'Удаление кисты яичника', 'Миомэктомия (удаление миомы)', 'Гистерэктомия (удаление матки)', 'Гистероскопия', 'Выскабливание полости матки',
  'Конизация шейки матки', 'Удаление полипа эндометрия', 'Тонзиллэктомия (удаление миндалин)', 'Аденотомия (удаление аденоидов)',
  'Септопластика (исправление носовой перегородки)', 'Гайморотомия', 'Шунтирование ушной перепонки', 'Удаление зуба мудрости',
  'Имплантация зуба', 'Синус-лифтинг', 'Артроскопия коленного сустава', 'Пластика крестообразной связки',
  'Эндопротезирование тазобедренного сустава', 'Эндопротезирование коленного сустава', 'Остеосинтез (фиксация перелома)',
  'Удаление металлоконструкции', 'Удаление грыжи межпозвоночного диска', 'Флебэктомия (удаление варикозных вен)',
  'Лазерная коагуляция вен', 'Удаление щитовидной железы (тиреоидэктомия)', 'Резекция щитовидной железы',
  'Удаление новообразования кожи', 'Удаление родинки', 'Удаление липомы', 'Секторальная резекция молочной железы',
  'Мастэктомия', 'Маммопластика', 'Лазерная коррекция зрения', 'Удаление катаракты (факоэмульсификация)',
  'Коронарное шунтирование', 'Стентирование коронарных артерий', 'Установка кардиостимулятора', 'Геморроидэктомия',
  'Удаление камней из почки', 'Обрезание', 'Вазэктомия', 'Пластика пупочного кольца', 'Ринопластика', 'Блефаропластика',
  'Стерилизация (для животных)', 'Кастрация (для животных)', 'Санация ротовой полости под наркозом (для животных)'
];

const RELATIVES = ['Мать', 'Отец', 'Бабушка по маме', 'Дедушка по маме', 'Бабушка по папе', 'Дедушка по папе', 'Брат', 'Сестра', 'Ребёнок', 'Другой родственник'];
const HISTORY_KINDS = {
  diagnosis: { title: 'Заболевания', add: 'Добавить заболевание', icd: true },
  surgery:   { title: 'Операции', add: 'Добавить операцию' },
  injury:    { title: 'Травмы', add: 'Добавить травму', icd: true },
  allergy:   { title: 'Аллергии и непереносимость', add: 'Добавить аллергию' },
  pregnancy: { title: 'Беременности и роды', add: 'Добавить беременность', only: p => p.kind === 'adult' && p.sex !== 'm' },
  family:    { title: 'Наследственность', add: 'Добавить заболевание родственника', icd: true, only: p => p.kind !== 'pet' }
};
const OUTCOMES = { birth: 'Роды естественные', cesarean: 'Кесарево сечение', miscarriage: 'Выкидыш', missed: 'Замершая беременность', abortion: 'Прерывание', ectopic: 'Внематочная', current: 'Идёт сейчас' };
const STATUSES = { chronic: 'Хроническое', past: 'Перенесённое', current: 'Лечится сейчас' };

// ---------- автоподстановка ----------
function attachAutocomplete(input, { source, onPick, onFree }) {
  const wrap = input.parentElement; wrap.style.position = 'relative';
  const box = document.createElement('div');
  box.className = 'ac'; box.setAttribute('role', 'listbox'); box.hidden = true;
  wrap.appendChild(box);
  input.setAttribute('autocomplete', 'off'); input.setAttribute('role', 'combobox'); input.setAttribute('aria-expanded', 'false');
  let items = [], active = -1, t;

  const searchSurgery = q => {
    const nq = q.toLowerCase().replace(/ё/g, 'е').trim();
    if (nq.length < 2) return [];
    return SURGERIES.filter(s => s.toLowerCase().replace(/ё/g, 'е').includes(nq)).slice(0, 10).map(name => ({ name }));
  };

  async function update() {
    const q = input.value;
    if (source === 'icd' && !ICD.ready()) { box.hidden = false; box.innerHTML = '<div class="ac-note">Загружаю справочник МКБ-10…</div>'; await ICD.load(); }
    items = source === 'icd' ? ICD.search(q) : searchSurgery(q);
    active = -1;
    if (q.trim().length < 2) { box.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
    box.innerHTML = items.map((x, i) => `<button type="button" class="ac-item" role="option" data-i="${i}">
        ${x.code ? `<span class="ac-code">${esc(x.code)}</span>` : ''}<span>${esc(x.name)}${x.hint ? `<span class="ac-hint"> · «${esc(x.hint)}»</span>` : ''}</span></button>`).join('')
      + `<div class="ac-foot">
          ${source === 'icd' ? '<button type="button" class="linkbtn" data-ai>Подобрать по описанию с ИИ</button>' : ''}
          <button type="button" class="linkbtn" data-free>Записать как есть: «${esc(q.trim())}»</button></div>`;
    box.hidden = false; input.setAttribute('aria-expanded', 'true');
    $$('.ac-item', box).forEach(b => b.onmousedown = e => { e.preventDefault(); pick(items[+b.dataset.i]); });
    const free = $('[data-free]', box); free.onmousedown = e => { e.preventDefault(); close(); onFree && onFree(input.value.trim()); };
    const ai = $('[data-ai]', box); if (ai) ai.onmousedown = e => { e.preventDefault(); aiSuggest(); };
  }
  async function aiSuggest() {
    box.innerHTML = '<div class="ac-note">Подбираю коды МКБ-10…</div>';
    try {
      const r = await api('icd_suggest', { text: input.value.trim() });
      await ICD.load();
      items = (r.codes || []).map(c => ICD.get(String(c).toUpperCase())).filter(Boolean);
      box.innerHTML = (items.length ? items.map((x, i) => `<button type="button" class="ac-item" data-i="${i}"><span class="ac-code">${esc(x.code)}</span><span>${esc(x.name)}</span></button>`).join('')
        : '<div class="ac-note">Подходящих кодов не нашлось — можно записать как есть.</div>')
        + `<div class="ac-foot"><button type="button" class="linkbtn" data-free>Записать как есть: «${esc(input.value.trim())}»</button></div>`;
      $$('.ac-item', box).forEach(b => b.onmousedown = e => { e.preventDefault(); pick(items[+b.dataset.i]); });
      $('[data-free]', box).onmousedown = e => { e.preventDefault(); close(); onFree && onFree(input.value.trim()); };
    } catch (e) { box.innerHTML = `<div class="ac-note">${esc(e.message)}</div>`; }
  }
  function pick(x) { close(); input.value = x.name; onPick(x); }
  function close() { box.hidden = true; input.setAttribute('aria-expanded', 'false'); }

  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(update, 120); });
  input.addEventListener('focus', () => { if (source === 'icd') ICD.load(); });
  input.addEventListener('blur', () => setTimeout(close, 150));
  input.addEventListener('keydown', e => {
    const opts = $$('.ac-item', box);
    if (box.hidden || !opts.length) return;
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, opts.length - 1); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); e.preventDefault(); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(items[active]); return; }
    else if (e.key === 'Escape') { close(); return; }
    opts.forEach((o, i) => o.classList.toggle('on', i === active));
  });
}

// ---------- экраны ----------
function historyLine(h) {
  const year = h.year ? ` · ${esc(h.year)}` : '';
  switch (h.kind) {
    case 'diagnosis': return `${h.code ? `<span class="ac-code">${esc(h.code)}</span>` : ''}<span class="grow">${esc(h.name)}<span class="sub"> · ${STATUSES[h.status] || ''}${h.year ? ', с ' + esc(h.year) : ''}</span></span>`;
    case 'family': return `${h.code ? `<span class="ac-code">${esc(h.code)}</span>` : ''}<span class="grow">${esc(h.name)}<span class="sub"> · ${esc(h.relative || '')}</span></span>`;
    case 'injury': return `${h.code ? `<span class="ac-code">${esc(h.code)}</span>` : ''}<span class="grow">${esc(h.name)}<span class="sub">${year}</span></span>`;
    case 'surgery': return `<span class="grow">${esc(h.name)}<span class="sub">${year}${h.anesthesia ? ' · ' + esc(h.anesthesia) : ''}</span></span>`;
    case 'allergy': return `<span class="grow">${esc(h.name)}<span class="sub"> · ${esc(h.allergenType || '')}${h.reaction ? ', ' + esc(h.reaction) : ''}</span></span>`;
    case 'pregnancy': return `<span class="grow">${esc(OUTCOMES[h.outcome] || '')}<span class="sub">${year}${h.weeks ? ' · ' + esc(h.weeks) + ' нед.' : ''}${h.weight ? ' · ' + esc(h.weight) + ' г' : ''}</span></span>`;
  }
  return esc(h.name);
}

async function viewProfile(id) {
  const p = await db.profiles.get(+id);
  if (!p) { location.hash = '#/'; return; }
  const all = await db.history.where('profileId').equals(p.id).toArray();
  const preg = all.filter(h => h.kind === 'pregnancy');
  const births = preg.filter(h => h.outcome === 'birth' || h.outcome === 'cesarean').length;
  app.innerHTML = `
    <div class="top">${backLink('#/')}<div class="grow"><div class="sub">Профиль и анамнез</div><h1>${esc(p.name)}</h1></div></div>
    <div class="pad stack">
      <section class="card">
        <div class="between"><h2>Основное</h2></div>
        <div class="grid2" style="gap:10px">
          <label class="f">Группа крови<select class="in" id="blood">${['', '0 (I)', 'A (II)', 'B (III)', 'AB (IV)'].map(v => `<option ${p.blood === v ? 'selected' : ''} value="${v}">${v || 'Не знаю'}</option>`).join('')}</select></label>
          <label class="f">Резус<select class="in" id="rh">${['', 'Rh+', 'Rh−'].map(v => `<option ${p.rh === v ? 'selected' : ''} value="${v}">${v || 'Не знаю'}</option>`).join('')}</select></label>
        </div>
        ${p.kind === 'adult' && p.sex !== 'm' && preg.length ? `<span class="sub">Беременностей: ${preg.length}, родов: ${births}</span>` : ''}
      </section>
      ${await docsCard(p)}
      ${Object.entries(HISTORY_KINDS).filter(([, k]) => !k.only || k.only(p)).map(([kind, k]) => {
        const items = all.filter(h => h.kind === kind).sort((a, b) => String(b.year || '').localeCompare(String(a.year || '')));
        return `<section class="card">
          <h2>${k.title}</h2>
          ${items.map(h => `<a class="row hist" href="#/history/${h.id}">${historyLine(h)}</a>`).join('') || '<p class="empty" style="margin:0">Пока ничего не добавлено.</p>'}
          <a class="linkbtn" style="text-decoration:none;align-self:flex-start" href="#/history/new/${kind}/${p.id}">+ ${k.add}</a>
        </section>`;
      }).join('')}
    </div>
    ${nav('')}`;
  const save = () => db.profiles.update(p.id, { blood: $('#blood').value, rh: $('#rh').value }).then(() => toast('Сохранено'));
  $('#blood').onchange = save; $('#rh').onchange = save;
}

async function viewHistoryForm(idOrNew, kindArg, profileArg) {
  const isNew = idOrNew === 'new';
  const h = isNew ? { kind: kindArg, profileId: +profileArg, status: 'chronic' } : await db.history.get(+idOrNew);
  if (!h) { location.hash = '#/'; return; }
  const p = await db.profiles.get(h.profileId);
  const k = HISTORY_KINDS[h.kind];
  const clinics = await db.clinics.toArray();
  const yearField = (label = 'Год') => `<label class="f">${label}<input class="in" name="year" inputmode="numeric" maxlength="4" placeholder="Например, 2019" value="${esc(h.year || '')}"></label>`;
  const noteField = `<label class="f">Заметка<textarea class="in" name="note" placeholder="Подробности, которые важно помнить">${esc(h.note || '')}</textarea></label>`;
  const icdField = (label, ph) => `<label class="f">${label}<input class="in" id="ac" name="name" value="${esc(h.name || '')}" placeholder="${ph}"></label>
      <div class="row" id="codebox" style="gap:8px;${h.code ? '' : 'display:none'}"><span class="ac-code" id="codeval">${esc(h.code || '')}</span><span class="sub grow">Код по МКБ-10</span><button type="button" class="linkbtn" id="clearcode">Убрать код</button></div>`;
  let fields = '';
  if (h.kind === 'diagnosis') fields = icdField('Диагноз', 'Начните вводить: «гастрит», «давление», «K29»…')
    + `<label class="f">Статус<select class="in" name="status">${Object.entries(STATUSES).map(([v, t]) => `<option value="${v}" ${h.status === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` + yearField('С какого года') + noteField;
  if (h.kind === 'family') fields = `<label class="f">Кто<select class="in" name="relative">${RELATIVES.map(r => `<option ${h.relative === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>`
    + icdField('Заболевание', 'Например, «диабет», «инфаркт», «рак молочной железы»') + noteField;
  if (h.kind === 'injury') fields = icdField('Травма', 'Например, «перелом лучевой кости», «сотрясение»') + yearField() + noteField;
  if (h.kind === 'surgery') fields = `<label class="f">Операция<input class="in" id="ac" name="name" value="${esc(h.name || '')}" placeholder="Например, «аппендэктомия», «кесарево», «миндалины»"></label>`
    + yearField() + `<label class="f">Наркоз<select class="in" name="anesthesia">${['', 'Общий', 'Спинальный / эпидуральный', 'Местный', 'Не знаю'].map(v => `<option ${h.anesthesia === v ? 'selected' : ''} value="${v}">${v || '—'}</option>`).join('')}</select></label>`
    + `<label class="f">Клиника<input class="in" name="clinic" list="clist2" value="${esc(h.clinic || '')}"></label><datalist id="clist2">${clinics.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>` + noteField;
  if (h.kind === 'allergy') fields = `<label class="f">На что<input class="in" name="name" value="${esc(h.name || '')}" placeholder="Например, пенициллин, арахис, берёза" required></label>`
    + `<label class="f">Тип<select class="in" name="allergenType">${['Лекарство', 'Пища', 'Пыльца', 'Животные', 'Укусы насекомых', 'Латекс', 'Другое'].map(v => `<option ${h.allergenType === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`
    + `<label class="f">Реакция<select class="in" name="reaction">${['', 'Сыпь, зуд', 'Отёк', 'Насморк, чихание', 'Затруднённое дыхание', 'Анафилаксия', 'Желудочно-кишечные', 'Другое'].map(v => `<option ${h.reaction === v ? 'selected' : ''} value="${v}">${v || '—'}</option>`).join('')}</select></label>` + noteField;
  if (h.kind === 'pregnancy') fields = `<label class="f">Исход<select class="in" name="outcome">${Object.entries(OUTCOMES).map(([v, t]) => `<option value="${v}" ${h.outcome === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`
    + yearField() + `<div class="grid2"><label class="f">Срок, недель<input class="in" name="weeks" inputmode="numeric" value="${esc(h.weeks || '')}"></label><label class="f">Вес ребёнка, г<input class="in" name="weight" inputmode="numeric" value="${esc(h.weight || '')}"></label></div>`
    + `<label class="f">Особенности и осложнения<textarea class="in" name="note">${esc(h.note || '')}</textarea></label>`;

  app.innerHTML = `
    <div class="top">${backLink('#/profile/' + p.id)}<div class="grow"><div class="sub">${esc(p.name)}</div><h1>${isNew ? k.add : k.title}</h1></div></div>
    <form id="hf" class="pad stack">
      <section class="card">${fields}</section>
      <button class="btn" type="submit">Сохранить</button>
      ${isNew ? '' : '<button type="button" class="btn danger" id="hdel">Удалить</button>'}
    </form>`;

  let code = h.code || null;
  const ac = $('#ac');
  if (ac) {
    const setCode = c => { code = c; $('#codebox') && ($('#codebox').style.display = c ? 'flex' : 'none'); $('#codeval') && ($('#codeval').textContent = c || ''); };
    attachAutocomplete(ac, {
      source: k.icd ? 'icd' : 'surgery',
      onPick: x => setCode(x.code || null),
      onFree: () => setCode(null)
    });
    ac.addEventListener('input', () => { if (code) setCode(null); });
    const cc = $('#clearcode'); if (cc) cc.onclick = () => setCode(null);
  }
  $('#hf').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = { ...h, code };
    for (const [key, v] of fd.entries()) data[key] = String(v).trim();
    if (h.kind !== 'pregnancy' && !data.name) { toast('Заполните название'); return; }
    if (data.clinic) await getOrCreateByName(db.clinics, data.clinic);
    if (isNew) { data.createdAt = new Date().toISOString(); await db.history.add(data); } else await db.history.put(data);
    toast('Сохранено');
    location.hash = '#/profile/' + p.id;
  };
  const del = $('#hdel');
  if (del) del.onclick = async () => { if (!confirm('Удалить запись из анамнеза?')) return; await db.history.delete(h.id); location.hash = '#/profile/' + p.id; };
}
