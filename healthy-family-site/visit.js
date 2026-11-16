// Приём врача по полочкам: жалобы, диагноз, назначения препаратов, рекомендации, направления, следующий приём.
// Из назначений одним нажатием получаются лекарства в «Принимать» и в список «Купить».
const VISIT_TYPES = new Set(['visit', 'ultrasound', 'imaging', 'procedure']);
const hasVisit = v => !!v && !!(v.complaints || v.anamnesis || v.exam || v.diagnosis || (v.prescriptions || []).length || (v.recommendations || []).length || (v.referrals || []).length || v.nextVisit);

// «2 раза в день», «утром и вечером», «на ночь», «3 р/д» → время приёма
function scheduleTimes(s) {
  s = String(s || '').toLowerCase();
  const n = +(s.match(/(\d)\s*(?:раз|р\.?\s*\/?\s*д|р\/сут|р\s*в\s*д)/) || [])[1] || (/тр[её]х|трижды/.test(s) ? 3 : /дважды|два раза|утром и вечером/.test(s) ? 2 : /четыр/.test(s) ? 4 : 0);
  if (n >= 4) return ['08:00', '12:00', '16:00', '20:00'];
  if (n === 3) return ['08:00', '14:00', '20:00'];
  if (n === 2) return ['09:00', '21:00'];
  if (/на ночь|перед сном|вечер/.test(s)) return ['21:00'];
  if (/обед|днём|днем/.test(s)) return ['13:00'];
  return ['09:00'];
}
// «10 дней», «2 недели», «1 месяц», «3 мес» → дней курса; «постоянно», «длительно» → null
function durationDays(s) {
  s = String(s || '').toLowerCase().replace(',', '.');
  if (!s || /постоянн|длительн|пожизн/.test(s)) return null;
  const m = s.match(/(\d+(?:\.\d+)?)\s*(д|сут|нед|мес|г)/);
  if (!m) return null;
  const k = { д: 1, с: 1, н: 7, м: 30, г: 365 }[m[2][0]];
  return Math.round(+m[1] * k) || null;
}

const listText = a => (a || []).map(x => String(x).trim()).filter(Boolean).join('\n');
const textList = t => String(t || '').split('\n').map(x => x.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean);

// Блок для экрана проверки и правки записи
function visitEditor(v, show) {
  v = v || {};
  const rx = v.prescriptions || [];
  return `<section class="card" id="visitbox" ${show ? '' : 'hidden'}>
    <h2>Приём по полочкам</h2>
    <label class="f">Жалобы<textarea class="in" name="v_complaints" rows="2" placeholder="С чем пришли к врачу">${esc(v.complaints || '')}</textarea></label>
    <label class="f">Диагноз<textarea class="in" name="v_diagnosis" rows="2" placeholder="Как в документе">${esc(v.diagnosis || '')}</textarea></label>
    ${v.icd ? `<span class="sub">Код МКБ-10: <span class="ac-code">${esc(v.icd)}</span></span><input type="hidden" name="v_icd" value="${esc(v.icd)}">` : ''}
    <div class="stack" style="gap:8px"><div class="between"><span class="sub" style="color:var(--ink);font-weight:600">Назначения препаратов</span><button type="button" class="linkbtn" id="addrx">+ Добавить</button></div>
      <div id="rxrows" class="stack" style="gap:8px">${rx.map(rxRow).join('')}</div>
      <span class="sub">Отмеченное «Принимать» появится в лекарствах с напоминаниями, «Купить» — в списке покупок.</span></div>
    <label class="f">Рекомендации — каждая с новой строки<textarea class="in" name="v_recommendations" rows="3">${esc(listText(v.recommendations))}</textarea></label>
    <label class="f">Направления и обследования — каждое с новой строки<textarea class="in" name="v_referrals" rows="2">${esc(listText(v.referrals))}</textarea></label>
    <label class="f">Следующий приём<input class="in" type="date" name="v_next" value="${esc(v.nextVisit || '')}"></label>
    ${v.anamnesis || v.exam ? `<details><summary class="sub">Анамнез и осмотр</summary>
      <label class="f">Анамнез<textarea class="in" name="v_anamnesis" rows="2">${esc(v.anamnesis || '')}</textarea></label>
      <label class="f">Объективно (осмотр)<textarea class="in" name="v_exam" rows="2">${esc(v.exam || '')}</textarea></label></details>` : ''}
  </section>`;
}
function rxRow(x = {}) {
  const done = x.medId ? ' · уже в лекарствах' : '';
  return `<div class="rxrow" data-rxrow>
    <input class="in" data-k="drug" value="${esc(x.drug || '')}" placeholder="Препарат">
    <div class="grid2" style="gap:6px"><input class="in" data-k="dose" value="${esc(x.dose || '')}" placeholder="Дозировка"><input class="in" data-k="duration" value="${esc(x.duration || '')}" placeholder="Курс: 10 дней"></div>
    <input class="in" data-k="schedule" value="${esc(x.schedule || '')}" placeholder="Как принимать: 2 раза в день после еды">
    <div class="row" style="gap:14px;flex-wrap:wrap">
      <label class="check"><input type="checkbox" data-k="take" ${x.take === false || x.medId ? '' : 'checked'} ${x.medId ? 'disabled' : ''}> <span>Принимать${done}</span></label>
      <label class="check"><input type="checkbox" data-k="buy" ${x.buy === false || x.medId ? '' : 'checked'} ${x.medId ? 'disabled' : ''}> <span>Купить</span></label>
      <button type="button" class="linkbtn" data-rxdel style="margin-left:auto">Убрать</button>
    </div>
    ${x.medId ? `<input type="hidden" data-k="medId" value="${x.medId}">` : ''}
    ${x.note ? `<input type="hidden" data-k="note" value="${esc(x.note)}">` : ''}
  </div>`;
}
function bindVisitEditor(typeSelect) {
  const box = $('#visitbox'); if (!box) return;
  if (typeSelect) typeSelect.addEventListener('change', () => { if (VISIT_TYPES.has(typeSelect.value)) box.hidden = false; });
  const bindDel = () => $$('[data-rxdel]').forEach(b => b.onclick = () => b.closest('[data-rxrow]').remove());
  $('#addrx').onclick = () => { $('#rxrows').insertAdjacentHTML('beforeend', rxRow({})); bindDel(); };
  bindDel();
}
function readVisit(fd) {
  if (!$('#visitbox')) return null;
  const prescriptions = $$('[data-rxrow]').map(r => {
    const g = k => r.querySelector(`[data-k="${k}"]`);
    const o = { drug: g('drug').value.trim(), dose: g('dose').value.trim(), schedule: g('schedule').value.trim(), duration: g('duration').value.trim(), take: g('take').checked, buy: g('buy').checked };
    if (g('medId')) o.medId = +g('medId').value;
    if (g('note')) o.note = g('note').value;
    return o;
  }).filter(x => x.drug);
  const v = {
    complaints: (fd.get('v_complaints') || '').trim(), diagnosis: (fd.get('v_diagnosis') || '').trim(), icd: fd.get('v_icd') || '',
    anamnesis: (fd.get('v_anamnesis') || '').trim(), exam: (fd.get('v_exam') || '').trim(),
    prescriptions, recommendations: textList(fd.get('v_recommendations')), referrals: textList(fd.get('v_referrals')), nextVisit: fd.get('v_next') || null
  };
  return hasVisit(v) ? v : null;
}

// После сохранения: назначения → лекарства, следующий приём → напоминание
async function applyVisit(profileId, recordId, v, doctorName, date) {
  if (!v) return 0;
  let n = 0;
  for (const x of v.prescriptions || []) {
    if (x.medId || (!x.take && !x.buy)) continue;
    const days = durationDays(x.duration);
    const note = [x.schedule, x.note, doctorName ? 'Назначил(а): ' + doctorName : '', date ? 'Приём ' + fmtDate(date) : ''].filter(Boolean).join(' · ');
    x.medId = await db.meds.add({ profileId, name: x.drug, dose: x.dose, times: scheduleTimes(x.schedule), start: todayISO(), days, stock: null, perDose: 1, note, active: !!x.take, toBuy: !!x.buy, recordId });
    n++;
  }
  if (v.nextVisit && v.nextVisit >= todayISO() && !v.reminderId) {
    v.reminderId = await db.reminders.add({ profileId, date: v.nextVisit, title: 'Повторный приём' + (doctorName ? ' — ' + doctorName : ''), kind: 'other', done: false });
  }
  await db.records.update(recordId, { visit: v });
  return n;
}

// Просмотр в записи
function visitView(r) {
  const v = r.visit; if (!hasVisit(v)) return '';
  const block = (t, body) => body ? `<div class="vblock"><div class="vh">${t}</div>${body}</div>` : '';
  const ul = a => (a || []).length ? `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  return `<section class="card visit">
    ${block('Жалобы', v.complaints ? `<p>${esc(v.complaints)}</p>` : '')}
    ${block('Диагноз', v.diagnosis ? `<p>${v.icd ? `<span class="ac-code">${esc(v.icd)}</span> ` : ''}${esc(v.diagnosis)}</p>` : '')}
    ${block('Назначения', (v.prescriptions || []).length ? v.prescriptions.map((x, i) => `<div class="vrx">
        <div class="grow"><b>${esc(x.drug)}</b>${x.dose ? ' · ' + esc(x.dose) : ''}<div class="sub">${esc([x.schedule, x.duration].filter(Boolean).join(' · '))}</div></div>
        ${x.medId ? `<a class="pill" href="#/med/${x.medId}" style="text-decoration:none;color:inherit">В лекарствах ›</a>` : `<button type="button" class="pill" data-vtake="${i}">Принимать</button><button type="button" class="pill" data-vbuy="${i}">Купить</button>`}
      </div>`).join('') : '')}
    ${block('Рекомендации', ul(v.recommendations))}
    ${block('Направления и обследования', ul(v.referrals))}
    ${block('Следующий приём', v.nextVisit ? `<p>${fmtDate(v.nextVisit)}${v.reminderId ? ' · напоминание стоит' : ''}</p>` : '')}
    ${v.anamnesis || v.exam ? `<details><summary class="sub">Анамнез и осмотр</summary>${v.anamnesis ? `<p>${esc(v.anamnesis)}</p>` : ''}${v.exam ? `<p>${esc(v.exam)}</p>` : ''}</details>` : ''}
  </section>`;
}
function bindVisitView(r, refresh) {
  const go = async (i, take) => {
    const x = r.visit.prescriptions[i];
    x.take = take; x.buy = !take || x.buy !== false;
    if (!take) x.buy = true;
    const doctor = r.doctorId ? (await db.doctors.get(r.doctorId))?.name : '';
    await applyVisit(r.profileId, r.id, r.visit, doctor, r.date);
    toast(take ? 'Добавлено в лекарства' : 'Добавлено в «Купить»');
    refresh();
  };
  $$('[data-vtake]').forEach(b => b.onclick = () => go(+b.dataset.vtake, true));
  $$('[data-vbuy]').forEach(b => b.onclick = () => go(+b.dataset.vbuy, false));
}

// Список «Купить»: лекарства с toBuy и рецепты, по которым ещё не купили
async function buyList(profileId) {
  const meds = (await db.meds.where('profileId').equals(profileId).toArray()).filter(m => m.toBuy);
  return meds;
}
function buyCard(meds, profileId) {
  if (!meds.length) return '';
  return `<section class="card"><div class="between"><h2>Купить</h2><a href="#/meds/${profileId}" style="font-size:13px;text-decoration:none">Лекарства</a></div>
    ${meds.map(m => `<label class="row" style="min-height:44px"><input type="checkbox" data-bought="${m.id}" style="width:22px;height:22px;accent-color:var(--accent)">
      <span class="grow">${esc(m.name)}${m.dose ? ' · ' + esc(m.dose) : ''}</span></label>`).join('')}
    <span class="sub">Отметьте, когда купите.</span></section>`;
}
function bindBuyCard(after) {
  $$('[data-bought]').forEach(c => c.onchange = async () => {
    await db.meds.update(+c.dataset.bought, { toBuy: false });
    toast('Куплено'); setTimeout(after, 300);
  });
}
