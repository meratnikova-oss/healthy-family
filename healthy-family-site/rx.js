// Рецепты: бланк или электронный рецепт со сроком действия. Фото рецепта хранится рядом.
// Срок по умолчанию — по приказу Минздрава № 1094н: обычный рецепт 60 дней, льготный 30 или 90 дней,
// для хронических больных — до года; ветеринарный — по рецепту.
const RX_KINDS = {
  common: ['Обычный (107-1/у)', 60],
  e: ['Электронный', 60],
  benefit: ['Льготный (148-1/у-04)', 30],
  benefit90: ['Льготный, 90 дней', 90],
  year: ['На год (хронические)', 365],
  narcotic: ['Особый учёт (107/у-НП, 148-1/у-88)', 15],
  vet: ['Ветеринарный', 30]
};
const rxActive = x => !x.used && (!x.validTo || x.validTo >= todayISO());
function rxTag(x) {
  if (x.used) return '<span class="tag">Использован</span>';
  if (!x.validTo) return '';
  const d = daysBetween(todayISO(), x.validTo);
  if (d < 0) return '<span class="tag high">Истёк</span>';
  if (d <= 7) return `<span class="tag high">Ещё ${d} ${plural(d, 'день', 'дня', 'дней')}</span>`;
  return `<span class="tag">до ${fmtDate(x.validTo)}</span>`;
}

async function viewRx(profileId) {
  const p = await db.profiles.get(+profileId);
  if (!p) { location.hash = '#/'; return; }
  const all = (await db.rx.where('profileId').equals(p.id).toArray()).sort((a, b) => (b.issued || '').localeCompare(a.issued || ''));
  const active = all.filter(rxActive), past = all.filter(x => !rxActive(x));
  const row = x => `<a class="row hist" href="#/rx/${x.id}"><span class="grow"><b>${esc(x.drug)}</b>${x.dose ? ' · ' + esc(x.dose) : ''}<span class="sub"> · ${esc((RX_KINDS[x.kind] || RX_KINDS.common)[0])}${x.issued ? ', выписан ' + fmtDate(x.issued) : ''}</span></span>${rxTag(x)}</a>`;
  app.innerHTML = `<div class="top">${backLink('#/profile/' + p.id)}<div class="grow"><div class="sub">${esc(p.name)}</div><h1>Рецепты</h1></div></div>
    <div class="pad stack">
      <section class="card"><h2>Действующие</h2>${active.map(row).join('') || '<p class="empty" style="margin:0">Сфотографируйте рецепт от врача — приложение напомнит, пока он не истёк, и добавит лекарство в «Купить».</p>'}</section>
      <a class="btn" href="#/rx/new/${p.id}">Добавить рецепт</a>
      ${past.length ? `<section class="card"><h2>Использованные и истёкшие</h2>${past.map(row).join('')}</section>` : ''}
    </div>${nav('')}`;
}

async function viewRxForm(mode, arg) {
  const isNew = mode === 'new';
  const x = isNew ? { profileId: +arg, kind: +arg && (await db.profiles.get(+arg))?.kind === 'pet' ? 'vet' : 'common', issued: todayISO() } : await db.rx.get(+arg);
  if (!x) { location.hash = '#/'; return; }
  const p = await db.profiles.get(x.profileId);
  const files = isNew ? [] : await db.files.where('rxId').equals(x.id).toArray();
  let fresh = [];
  const doctors = await db.doctors.toArray(), clinics = await db.clinics.toArray();
  app.innerHTML = `<div class="top">${backLink('#/rx-list/' + p.id)}<div class="grow"><div class="sub">${esc(p.name)}</div><h1>${isNew ? 'Новый рецепт' : 'Рецепт'}</h1></div>${isNew ? '' : rxTag(x)}</div>
    <form id="rxf" class="pad stack">
      <section class="card">
        <div class="tray-row" id="rxtray"></div>
        <div class="row" style="gap:8px"><button type="button" class="btn ghost" id="rxcam" style="flex:1">${CAM_ICON} Снять</button><button type="button" class="btn ghost" id="rxgal" style="flex:1">${GAL_ICON} Из галереи</button></div>
        <input type="file" id="rxcamin" accept="image/*" capture="environment" hidden><input type="file" id="rxgalin" accept="image/*,application/pdf" multiple hidden>
      </section>
      <section class="card">
        <label class="f">Препарат<input class="in" name="drug" required value="${esc(x.drug || '')}" placeholder="Как написано в рецепте"></label>
        <div class="grid2"><label class="f">Дозировка<input class="in" name="dose" value="${esc(x.dose || '')}" placeholder="250 мг"></label>
          <label class="f">Количество<input class="in" name="qty" value="${esc(x.qty || '')}" placeholder="2 упаковки"></label></div>
        <label class="f">Вид рецепта<select class="in" name="kind">${Object.entries(RX_KINDS).map(([k, [t]]) => `<option value="${k}" ${k === x.kind ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <div class="grid2"><label class="f">Выписан<input class="in" type="date" name="issued" value="${esc(x.issued || '')}"></label>
          <label class="f">Действует до<input class="in" type="date" name="validTo" value="${esc(x.validTo || '')}"></label></div>
        <span class="sub" id="rxhint"></span>
        <label class="f">Врач<input class="in" name="doctor" list="rxd" value="${esc(x.doctor || '')}"></label>
        <label class="f">Клиника<input class="in" name="clinic" list="rxc" value="${esc(x.clinic || '')}"></label>
        <datalist id="rxd">${doctors.map(d => `<option value="${esc(d.name)}">`).join('')}</datalist><datalist id="rxc">${clinics.map(d => `<option value="${esc(d.name)}">`).join('')}</datalist>
        <label class="f">Номер рецепта или код электронного рецепта<input class="in" name="number" value="${esc(x.number || '')}" placeholder="Необязательно"></label>
        <label class="f">Заметка<textarea class="in" name="note" placeholder="Как принимать, где купить, что сказал врач">${esc(x.note || '')}</textarea></label>
        ${isNew ? '<label class="check"><input type="checkbox" name="tobuy" checked> <span>Добавить в «Купить»</span></label>' : ''}
      </section>
      <button class="btn" type="submit">Сохранить</button>
      ${isNew ? '' : `${x.medId ? `<a class="btn ghost" href="#/med/${x.medId}">Открыть в лекарствах</a>` : '<button type="button" class="btn ghost" id="rxmed">Начать принимать</button>'}
        <button type="button" class="btn ghost" id="rxused">${x.used ? 'Вернуть в действующие' : 'Отметить: купила по рецепту'}</button>
        <button type="button" class="btn danger" id="rxdel">Удалить</button>`}
    </form>${nav('')}`;
  const f = $('#rxf');
  const autoTo = () => {
    const days = (RX_KINDS[f.kind.value] || RX_KINDS.common)[1];
    if (f.issued.value) f.validTo.value = addDaysISO(f.issued.value, days - 1);
    $('#rxhint').textContent = `${(RX_KINDS[f.kind.value] || [''])[0]}: обычно действует ${days} ${plural(days, 'день', 'дня', 'дней')}. Если в рецепте указан другой срок — поправьте.`;
  };
  f.kind.onchange = autoTo; f.issued.onchange = autoTo;
  if (isNew || !x.validTo) autoTo(); else $('#rxhint').textContent = '';
  const drawTrayRx = () => {
    const all = [...files.map(z => ({ blob: z.blob, mime: z.mime, id: z.id })), ...fresh.map(z => ({ blob: z, mime: z.type, fresh: true }))];
    $('#rxtray').innerHTML = all.map((z, i) => { const img = /^image\//.test(z.mime || ''); const u = img ? URL.createObjectURL(z.blob) : ''; return `<button type="button" class="tthumb" data-rxopen="${i}">${img ? `<img src="${u}" alt="">` : '<span class="text">PDF</span>'}<span class="tnum">${i + 1}</span></button>`; }).join('')
      || '<span class="sub" style="align-self:center">Фото рецепта пригодится в аптеке.</span>';
    $$('[data-rxopen]').forEach(b => b.onclick = () => { const z = all[+b.dataset.rxopen]; const u = URL.createObjectURL(z.blob); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000); });
  };
  drawTrayRx();
  $('#rxcam').onclick = () => $('#rxcamin').click(); $('#rxgal').onclick = () => $('#rxgalin').click();
  $('#rxcamin').onchange = $('#rxgalin').onchange = e => { fresh = fresh.concat([...e.target.files]); e.target.value = ''; drawTrayRx(); };
  f.onsubmit = async e => {
    e.preventDefault();
    const data = { profileId: p.id, drug: f.drug.value.trim(), dose: f.dose.value.trim(), qty: f.qty.value.trim(), kind: f.kind.value, issued: f.issued.value || null, validTo: f.validTo.value || null,
      doctor: f.doctor.value.trim(), clinic: f.clinic.value.trim(), number: f.number.value.trim(), note: f.note.value.trim() };
    let id = x.id;
    if (isNew) {
      data.createdAt = new Date().toISOString(); data.used = false;
      if (f.tobuy && f.tobuy.checked) data.medId = await db.meds.add({ profileId: p.id, name: data.drug, dose: data.dose, times: ['09:00'], start: todayISO(), days: null, stock: null, perDose: 1, note: 'По рецепту' + (data.doctor ? ' · ' + data.doctor : ''), active: false, toBuy: true });
      id = await db.rx.add(data);
    } else await db.rx.update(x.id, data);
    for (const z of fresh) await db.files.add({ rxId: id, name: z.name, mime: z.type, size: z.size, blob: z });
    toast('Сохранено'); location.hash = '#/rx-list/' + p.id;
  };
  if (!isNew) {
    $('#rxdel').onclick = async () => { if (!confirm('Удалить рецепт?')) return; await db.files.where('rxId').equals(x.id).delete(); await db.rx.delete(x.id); location.hash = '#/rx-list/' + p.id; };
    $('#rxused').onclick = async () => { await db.rx.update(x.id, { used: !x.used }); if (!x.used && x.medId) await db.meds.update(x.medId, { toBuy: false }); toast('Готово'); viewRxForm('edit', x.id); };
    const m = $('#rxmed'); if (m) m.onclick = async () => {
      const medId = await db.meds.add({ profileId: p.id, name: x.drug, dose: x.dose, times: ['09:00'], start: todayISO(), days: null, stock: null, perDose: 1, note: [x.note, 'По рецепту'].filter(Boolean).join(' · '), active: true, toBuy: !x.used });
      await db.rx.update(x.id, { medId });
      location.hash = '#/med/' + medId;
    };
  }
}

// События календаря: рецепт скоро истекает
async function rxEvents(profiles, from, to) {
  const ev = [];
  for (const p of profiles) for (const x of await db.rx.where('profileId').equals(p.id).toArray()) {
    if (!rxActive(x) || !x.validTo) continue;
    const warn = addDaysISO(x.validTo, -5) < todayISO() ? todayISO() : addDaysISO(x.validTo, -5);
    if (warn >= from && warn <= to) ev.push({ date: x.validTo, kind: 'rx', title: `Рецепт истекает: ${x.drug}`, sub: p.name, href: '#/rx/' + x.id, done: false, profileId: p.id });
  }
  return ev;
}
