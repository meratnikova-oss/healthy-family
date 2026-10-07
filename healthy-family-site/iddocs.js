// Документы профиля: полисы ОМС и ДМС, СНИЛС, паспорт, свидетельство о рождении, ветпаспорт и т.д.
// Номера и фото документов хранятся только на телефоне и НЕ отправляются в ИИ.

const DOC_TYPES = {
  oms:      { title: 'Полис ОМС', number: 'Номер полиса (16 цифр)', issuer: 'Страховая компания', validTo: true, phone: 'Телефон страховой' },
  dms:      { title: 'Полис ДМС', number: 'Номер полиса', issuer: 'Страховая компания', validFrom: true, validTo: true, phone: 'Телефон пульта / ассистанса', program: 'Программа и клиники по полису' },
  snils:    { title: 'СНИЛС', number: 'Номер СНИЛС' },
  passport: { title: 'Паспорт', series: true, number: 'Номер', issuer: 'Кем выдан', validFrom: 'Дата выдачи' },
  birth:    { title: 'Свидетельство о рождении', series: true, number: 'Номер', issuer: 'Кем выдано', validFrom: 'Дата выдачи', only: p => p.kind !== 'pet' },
  vaccine:  { title: 'Сертификат о прививках', number: 'Номер (если есть)' },
  vetpass:  { title: 'Ветеринарный паспорт', number: 'Номер', issuer: 'Клиника, выдавшая паспорт', only: p => p.kind === 'pet' },
  chip:     { title: 'Чип / клеймо', number: 'Номер чипа', validFrom: 'Дата установки', only: p => p.kind === 'pet' },
  other:    { title: 'Другой документ', name: true, number: 'Номер', issuer: 'Кем выдан', validTo: true, phone: 'Телефон' }
};

const docTitle = d => (d.type === 'other' && d.title) ? d.title : (DOC_TYPES[d.type] || DOC_TYPES.other).title;
const daysLeft = d => d.validTo ? Math.ceil((new Date(d.validTo) - new Date(new Date().toDateString())) / 864e5) : null;

function expiryTag(d) {
  const n = daysLeft(d);
  if (n === null) return '';
  if (n < 0) return '<span class="tag high">Истёк</span>';
  if (n <= 30) return `<span class="tag high">Истекает через ${n} ${plural(n, 'день', 'дня', 'дней')}</span>`;
  return `<span class="sub">до ${fmtDate(d.validTo)}</span>`;
}

// Для главной: документы всей семьи, которые истекли или истекают в ближайшие 30 дней
async function expiringDocs() {
  const all = await db.idDocs.toArray();
  return all.filter(d => { const n = daysLeft(d); return n !== null && n <= 30; });
}

async function docsCard(p) {
  const docs = await db.idDocs.where('profileId').equals(p.id).toArray();
  return `<section class="card">
    <div class="between"><h2>Документы</h2><a href="#/docs/${p.id}" style="font-size:13px;text-decoration:none;font-weight:500">Все ›</a></div>
    ${docs.length ? docs.slice(0, 4).map(d => `<a class="row hist" href="#/doc/${d.id}"><span class="grow">${esc(docTitle(d))}</span>${expiryTag(d)}</a>`).join('')
      : '<p class="empty" style="margin:0">Полис ОМС, ДМС, СНИЛС и другие документы.</p>'}
    <a class="linkbtn" style="text-decoration:none;align-self:flex-start" href="#/doc/new/${p.id}">+ Добавить документ</a>
  </section>`;
}

async function viewDocs(profileId) {
  const p = await db.profiles.get(+profileId);
  if (!p) { location.hash = '#/'; return; }
  const docs = await db.idDocs.where('profileId').equals(p.id).toArray();
  const order = Object.keys(DOC_TYPES);
  docs.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  const thumbs = {};
  for (const d of docs) {
    const f = await db.files.where('docId').equals(d.id).first();
    if (f && f.mime?.startsWith('image/')) thumbs[d.id] = URL.createObjectURL(f.blob);
  }
  app.innerHTML = `
    <div class="top">${backLink('#/profile/' + p.id)}<div class="grow"><div class="sub">${esc(p.name)}</div><h1>Документы</h1></div></div>
    <div class="pad stack">
      ${docs.map(d => `
        <a class="card doccard" href="#/doc/${d.id}">
          <div class="row">
            ${thumbs[d.id] ? `<img src="${thumbs[d.id]}" alt="" class="docthumb">` : `<span class="docthumb docicon">${esc(docTitle(d).slice(0, 1))}</span>`}
            <div class="grow"><div style="font-weight:600">${esc(docTitle(d))}</div>
              <div class="sub">${esc([d.issuer, d.number ? maskNum(d.number) : ''].filter(Boolean).join(' · '))}</div></div>
          </div>
          ${expiryTag(d) ? `<div>${expiryTag(d)}</div>` : ''}
        </a>`).join('') || '<div class="card"><p class="empty">Добавьте полисы и документы — у регистратуры их можно будет показать прямо с телефона.</p></div>'}
      <a class="btn" href="#/doc/new/${p.id}">Добавить документ</a>
      <p class="sub" style="margin:0">Номера и фото документов хранятся только на этом телефоне и не отправляются на распознавание.</p>
    </div>
    ${nav('')}`;
}
const maskNum = n => { const s = String(n); return s.length > 6 ? '•••• ' + s.slice(-4) : s; };

async function viewDoc(id) {
  const d = await db.idDocs.get(+id);
  if (!d) { location.hash = '#/'; return; }
  const p = await db.profiles.get(d.profileId);
  const t = DOC_TYPES[d.type] || DOC_TYPES.other;
  const files = await db.files.where('docId').equals(d.id).toArray();
  const urls = files.map(f => ({ ...f, url: URL.createObjectURL(f.blob) }));
  const field = (label, val, extra = '') => val ? `<div><div class="sub">${label}</div><div style="font-weight:500;word-break:break-word">${extra || esc(val)}</div></div>` : '';
  app.innerHTML = `
    <div class="top">${backLink('#/docs/' + p.id)}<div class="grow"><div class="sub">${esc(p.name)}</div><h1>${esc(docTitle(d))}</h1></div>
      <a class="pill" href="#/doc/edit/${d.id}" style="text-decoration:none;color:inherit">Изменить</a></div>
    <div class="pad stack">
      ${urls.filter(f => f.mime?.startsWith('image/')).map(f => `<img src="${f.url}" alt="${esc(f.name)}" class="docimg" data-open="${f.id}">`).join('')}
      ${urls.filter(f => !f.mime?.startsWith('image/')).map(f => `<button type="button" class="pill" data-open="${f.id}">${esc(f.name)}</button>`).join('')}
      <section class="card">
        ${d.number ? `<div><div class="sub">${esc((t.number || 'Номер').replace(/ \(.*\)/, ''))}</div>
          <div class="row"><span class="val grow" style="font-size:20px;letter-spacing:.04em;word-break:break-all">${esc([d.series, d.number].filter(Boolean).join(' '))}</span>
          <button type="button" class="pill" id="copynum">Скопировать</button></div></div>` : ''}
        ${field(t.issuer || 'Кем выдан', d.issuer)}
        ${field(t.validFrom === true ? 'Действует с' : (t.validFrom || 'Действует с'), d.validFrom && fmtDate(d.validFrom))}
        ${d.validTo ? field('Действует до', d.validTo, `${fmtDate(d.validTo)} ${expiryTag(d).includes('tag') ? expiryTag(d) : ''}`) : ''}
        ${field(t.phone || 'Телефон', d.phone, `<a href="tel:${esc(d.phone.replace(/[^\d+]/g, ''))}">${esc(d.phone)}</a>`)}
        ${field('Программа и клиники', d.program, `<span class="prose">${esc(d.program)}</span>`)}
        ${field('Заметка', d.note, `<span class="prose">${esc(d.note)}</span>`)}
      </section>
      <button type="button" class="btn ghost" id="present">Показать в регистратуре</button>
    </div>
    ${nav('')}`;
  const cp = $('#copynum');
  if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(String(d.number)); toast('Номер скопирован'); } catch (e) { toast('Не удалось скопировать'); } };
  $$('[data-open]').forEach(el => el.onclick = () => { const f = urls.find(x => x.id === +el.dataset.open); window.open(f.url, '_blank'); });
  // крупный экран: номер и фото, чтобы показать сотруднику
  $('#present').onclick = () => {
    const img = urls.find(f => f.mime?.startsWith('image/'));
    const ov = document.createElement('div');
    ov.className = 'present';
    ov.innerHTML = `<div class="sub" style="color:#cfd3da">${esc(p.name)} · ${esc(docTitle(d))}</div>
      ${d.number ? `<div class="presnum">${esc([d.series, d.number].filter(Boolean).join(' '))}</div>` : ''}
      ${img ? `<img src="${img.url}" alt="">` : ''}
      <button type="button" class="btn" style="margin-top:auto">Закрыть</button>`;
    ov.querySelector('button').onclick = () => ov.remove();
    document.body.appendChild(ov);
  };
}

async function viewDocForm(mode, arg) {
  const isNew = mode === 'new';
  const d = isNew ? { profileId: +arg, type: '' } : await db.idDocs.get(+arg);
  if (!d) { location.hash = '#/'; return; }
  const p = await db.profiles.get(d.profileId);
  const types = Object.entries(DOC_TYPES).filter(([, t]) => !t.only || t.only(p));
  if (!d.type) d.type = p.kind === 'pet' ? 'vetpass' : 'oms';
  const oldFiles = isNew ? [] : await db.files.where('docId').equals(d.id).toArray();
  let newFiles = [], removed = new Set();

  const draw = () => {
    const t = DOC_TYPES[d.type];
    const inp = (name, label, attrs = '') => `<label class="f">${label}<input class="in" name="${name}" value="${esc(d[name] || '')}" ${attrs}></label>`;
    $('#dfields').innerHTML = `
      ${t.name ? inp('title', 'Название документа', 'placeholder="Например, справка для бассейна" required') : ''}
      ${t.series ? `<div class="grid2">${inp('series', 'Серия')}${inp('number', t.number)}</div>` : t.number ? inp('number', t.number, 'inputmode="text" autocomplete="off"') : ''}
      ${t.issuer ? inp('issuer', t.issuer, 'list="insurers"') : ''}
      ${t.validFrom || t.validTo ? `<div class="grid2">
        ${t.validFrom ? `<label class="f">${t.validFrom === true ? 'Действует с' : t.validFrom}<input class="in" type="date" name="validFrom" value="${esc(d.validFrom || '')}"></label>` : ''}
        ${t.validTo ? `<label class="f">Действует до<input class="in" type="date" name="validTo" value="${esc(d.validTo || '')}"></label>` : ''}</div>` : ''}
      ${t.validTo && d.type === 'oms' ? '<span class="sub">Полисы ОМС нового образца обычно бессрочные — дату можно не заполнять.</span>' : ''}
      ${t.phone ? inp('phone', t.phone, 'inputmode="tel"') : ''}
      ${t.program ? `<label class="f">${t.program}<textarea class="in" name="program" placeholder="Что входит, к каким клиникам прикреплён, лимиты">${esc(d.program || '')}</textarea></label>` : ''}
      <label class="f">Заметка<textarea class="in" name="note">${esc(d.note || '')}</textarea></label>`;
  };
  const drawFiles = () => {
    const list = [...oldFiles.filter(f => !removed.has(f.id)).map(f => ({ key: 'o' + f.id, name: f.name })), ...newFiles.map((f, i) => ({ key: 'n' + i, name: f.name }))];
    $('#dfiles').innerHTML = list.map(f => `<span class="pill" style="gap:8px">${esc(f.name)}<button type="button" class="linkbtn" data-rm="${f.key}" aria-label="Убрать файл" style="padding:0">✕</button></span>`).join('') || '<span class="sub">Фото лицевой и обратной стороны, скан или PDF.</span>';
    $$('[data-rm]').forEach(b => b.onclick = () => {
      const k = b.dataset.rm;
      if (k[0] === 'o') removed.add(+k.slice(1)); else newFiles.splice(+k.slice(1), 1);
      drawFiles();
    });
  };

  app.innerHTML = `
    <div class="top">${backLink(isNew ? '#/docs/' + p.id : '#/doc/' + d.id)}<div class="grow"><div class="sub">${esc(p.name)}</div><h1>${isNew ? 'Новый документ' : 'Изменить'}</h1></div></div>
    <form id="df" class="pad stack">
      <section class="card">
        <label class="f">Тип документа<select class="in" name="type" id="dtype">${types.map(([k, t]) => `<option value="${k}" ${d.type === k ? 'selected' : ''}>${t.title}</option>`).join('')}</select></label>
        <div id="dfields" class="stack" style="gap:12px"></div>
        <datalist id="insurers">${['СОГАЗ-Мед', 'Капитал МС', 'Ингосстрах-М', 'АльфаСтрахование-ОМС', 'РЕСО-Мед', 'Альфастрахование', 'Ингосстрах', 'РЕСО-Гарантия', 'СОГАЗ', 'Ренессанс страхование', 'Согласие', 'Сбербанк страхование', 'ВСК'].map(n => `<option value="${n}">`).join('')}</datalist>
      </section>
      <section class="card">
        <h2>Фото и файлы</h2>
        <div class="row" id="dfiles" style="flex-wrap:wrap;gap:8px"></div>
        <div class="row">
          <label class="btn ghost" style="flex:1;cursor:pointer">Сфотографировать<input type="file" accept="image/*" capture="environment" hidden id="dcam"></label>
          <label class="btn ghost" style="flex:1;cursor:pointer">Выбрать файл<input type="file" accept="image/*,.pdf" multiple hidden id="dpick"></label>
        </div>
      </section>
      <button class="btn" type="submit">Сохранить</button>
      ${isNew ? '' : '<button type="button" class="btn danger" id="ddel">Удалить документ</button>'}
    </form>`;
  draw(); drawFiles();
  $('#dtype').onchange = e => {
    // переносим уже введённое при смене типа
    for (const [k, v] of new FormData($('#df')).entries()) if (typeof v === 'string') d[k] = v;
    d.type = e.target.value; draw();
  };
  const addFiles = e => { newFiles = newFiles.concat([...e.target.files]); e.target.value = ''; drawFiles(); };
  $('#dcam').onchange = addFiles; $('#dpick').onchange = addFiles;
  $('#df').onsubmit = async e => {
    e.preventDefault();
    const data = { ...d };
    for (const k of ['title', 'series', 'number', 'issuer', 'validFrom', 'validTo', 'phone', 'program', 'note']) delete data[k];
    for (const [k, v] of new FormData(e.target).entries()) if (typeof v === 'string' && v.trim()) data[k] = v.trim();
    let id = d.id;
    await db.transaction('rw', db.idDocs, db.files, async () => {
      if (isNew) { data.createdAt = new Date().toISOString(); id = await db.idDocs.add(data); }
      else await db.idDocs.put(data);
      for (const fid of removed) await db.files.delete(fid);
      for (const f of newFiles) await db.files.add({ docId: id, name: f.name, mime: f.type, size: f.size, blob: f });
    });
    toast('Сохранено');
    location.hash = '#/doc/' + id;
  };
  const del = $('#ddel');
  if (del) del.onclick = async () => {
    if (!confirm('Удалить документ вместе с фото?')) return;
    await db.transaction('rw', db.idDocs, db.files, async () => {
      await db.files.where('docId').equals(d.id).delete();
      await db.idDocs.delete(d.id);
    });
    location.hash = '#/docs/' + p.id;
  };
}
