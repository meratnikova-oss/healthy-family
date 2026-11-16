// Бесплатная версия — архив. Плюс — ИИ по обезличенному тексту и облачная копия.
// Ключ Плюс не связан с именем или почтой: сервер видит только сам ключ.
const Plan = {
  get state() { try { return JSON.parse(localStorage.getItem('plan') || 'null'); } catch (e) { return null; } },
  set state(v) { if (v) localStorage.setItem('plan', JSON.stringify(v)); else localStorage.removeItem('plan'); },
  get key() { return settings.apiToken; },
  // Плюс включён, если введён ключ и сервер не сказал, что он недействителен или истёк
  isPlus() {
    if (!this.key) return false;
    const s = this.state;
    if (!s) return true; // ключ есть, сервер ещё не спрашивали — проверка будет при первом запросе
    if (s.plan === 'none') return false;
    if (s.until && s.until < todayISO()) return false;
    return true;
  },
  isOwner() { return this.isPlus() && this.state?.plan === 'owner'; },
  get untilText() { const s = this.state; return s?.plan === 'owner' ? 'без срока — ключ владельца' : s?.until ? 'до ' + fmtDate(s.until) : ''; },
  async refresh() {
    if (!this.key || !settings.apiUrl) return;
    try {
      const r = await api('ping', {});
      this.state = { plan: r.plan || 'plus', until: r.until || null, at: Date.now() };
    } catch (e) {
      if (e.status === 401) this.state = { plan: 'none', at: Date.now() };
      if (e.status === 402) this.state = { plan: 'plus', until: e.until || '2000-01-01', at: Date.now() };
    }
  },
  async activate(key) {
    localStorage.setItem('apiToken', key.trim());
    this.state = null;
    const r = await api('ping', {});
    this.state = { plan: r.plan || 'plus', until: r.until || null, at: Date.now() };
    return this.state;
  },
  deactivate() {
    localStorage.removeItem('apiToken');
    localStorage.removeItem('aiConsent');
    this.state = null;
  },
  get consented() { return +localStorage.getItem('aiConsent') >= 1; },
  // Перед первой отправкой в ИИ: проверить Плюс и согласие. Возвращает true, если можно отправлять.
  async gate(feature) {
    if (!this.isPlus()) { location.hash = '#/plus?f=' + encodeURIComponent(feature || ''); return false; }
    if (this.consented) return true;
    return aiConsentDialog();
  }
};

function aiConsentDialog() {
  return new Promise(resolve => {
    const d = document.createElement('div');
    d.className = 'sheet';
    d.innerHTML = `<div class="card sheet-card" role="dialog" aria-modal="true" aria-labelledby="aicT">
      <h2 id="aicT">Перед первым распознаванием</h2>
      <p style="margin:0">Чтобы ИИ перенёс показатели, приложение отправит ему текст документа. Перед отправкой прямо на телефоне из текста удаляются <b>ФИО, дата рождения, адрес, телефон, номера полиса, СНИЛС и паспорта</b>. Фото на сервер не уходят — они распознаются здесь, на телефоне.</p>
      <div class="anon-demo"><div><span class="sub">В документе</span><p>Пациент: Иванова Мария Петровна<br>Дата рождения: 12.04.1987<br>Гемоглобин 128 г/л 117–160</p></div><div><span class="sub">Уходит в ИИ</span><p>Пациент: [скрыто]<br>Дата рождения: [скрыто]<br>Гемоглобин 128 г/л 117–160</p></div></div>
      <label class="check"><input type="checkbox" id="aicOk"> <span>Даю <a href="#/legal/ai" target="_blank" rel="noopener">согласие на передачу обезличенных данных в ИИ</a></span></label>
      <button type="button" class="btn" id="aicYes" disabled>Продолжить</button>
      <button type="button" class="btn ghost" id="aicNo">Не сейчас</button>
    </div>`;
    document.body.appendChild(d);
    const done = v => { d.remove(); resolve(v); };
    d.querySelector('#aicOk').onchange = e => { d.querySelector('#aicYes').disabled = !e.target.checked; };
    d.querySelector('#aicYes').onclick = () => { localStorage.setItem('aiConsent', '1'); localStorage.setItem('aiConsentAt', new Date().toISOString()); done(true); };
    d.querySelector('#aicNo').onclick = () => done(false);
    d.querySelector('a').onclick = e => { e.preventDefault(); const w = document.createElement('div'); w.className = 'sheet'; w.innerHTML = `<div class="card sheet-card legal">${Legal.DOCS.ai.html()}<button type="button" class="btn">Понятно</button></div>`; document.body.appendChild(w); w.querySelector('button').onclick = () => w.remove(); };
  });
}

// Небольшая плашка вместо ИИ-функции в бесплатной версии
function plusTeaser(text, feature) {
  return `<a class="plus-teaser" href="#/plus?f=${encodeURIComponent(feature || '')}"><span class="plus-badge">Плюс</span><span>${text}</span><span aria-hidden="true">›</span></a>`;
}

const PLUS_FEATURES = [
  ['ИИ сам переносит показатели', 'Снимите бланк или выберите PDF — значения, нормы, дата и клиника заполнятся сами. До 40 страниц за раз.'],
  ['Имена не уходят с телефона', 'Перед отправкой приложение вырезает ФИО, дату рождения, адрес, номера полиса и паспорта. Фото распознаются прямо на телефоне.'],
  ['Расшифровка простыми словами', 'Термины из протоколов УЗИ и заключений, справка о любом показателе, вопросы к врачу.'],
  ['Копия в облаке под вашим паролем', 'Если телефон потеряется, архив восстановится на новом. Пароль знаете только вы.']
];

async function viewPlus() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const on = Plan.isPlus(), owner = Plan.isOwner();
  app.innerHTML = `
    <div class="top">${backLink('#/settings')}<h1 class="grow">Healthy Family Плюс</h1></div>
    <div class="pad stack">
      ${on ? `<section class="card" style="background:var(--accent-soft)"><h2>Плюс включён</h2><span class="sub" style="color:var(--ink)">${esc(Plan.untilText || 'ключ принят')}</span></section>` : ''}
      ${!on && q.get('f') ? `<p class="sub" style="font-size:15px;color:var(--ink)">${esc(q.get('f'))} — в Плюс. В бесплатной версии все записи, файлы и показатели можно вести вручную.</p>` : ''}
      <section class="card plus-list">${PLUS_FEATURES.map(([t, d]) => `<div><b>${t}</b><p class="sub" style="margin:2px 0 0">${d}</p></div>`).join('')}</section>
      ${!on ? `<section class="card"><div class="between"><h2>Стоимость</h2><b>${esc(HF_CONFIG.plusPrice)}</b></div>
        ${HF_CONFIG.buyUrl ? `<a class="btn" href="${esc(HF_CONFIG.buyUrl)}" target="_blank" rel="noopener">Купить ключ</a>` : '<span class="sub">Покупка откроется скоро.</span>'}
        <span class="sub">После оплаты придёт ключ — введите его ниже. Покупая, вы принимаете <a href="#/legal/offer">соглашение</a>.</span></section>` : ''}
      <section class="card"><h2>${on ? 'Ключ' : 'У меня есть ключ'}</h2>
        <label class="f">Ключ Плюс<input class="in" id="pkey" value="${esc(on ? Plan.key : '')}" placeholder="HFP-XXXXX-XXXXX-XXXXX-XXXXX" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
        <button type="button" class="btn${on ? ' ghost' : ''}" id="pact">${on ? 'Проверить ключ' : 'Включить Плюс'}</button>
        ${on ? '<button type="button" class="btn ghost" id="poff">Отключить ИИ на этом телефоне</button><span class="sub">Ключ и согласие удалятся с телефона, в ИИ больше ничего не уходит. Архив остаётся.</span>' : ''}
      </section>
      <details class="card"><summary><b>Для владельца приложения</b></summary>
        <label class="f">Адрес сервера${HF_CONFIG.apiUrl ? ' (по умолчанию — из config.js)' : ''}<input class="in" id="purl" value="${esc(localStorage.getItem('apiUrl') || '')}" placeholder="${esc(HF_CONFIG.apiUrl || 'https://functions.yandexcloud.net/…')}" inputmode="url"></label>
        <span class="sub">Ключ владельца — это код доступа из переменной TOKENS функции. С ним работают почтовый агент и облачное распознавание фото.</span>
        ${owner ? `<label class="check"><input type="checkbox" id="pcloud" ${localStorage.getItem('cloudOcr') === '1' ? 'checked' : ''}> <span>Распознавать фото в облаке (точнее, но снимок с именем уходит на сервер). Только для себя.</span></label>` : ''}
        <button type="button" class="btn ghost" id="psaveurl">Сохранить адрес</button>
      </details>
      <p class="sub" style="text-align:center"><a href="#/legal/ai">Согласие на передачу в ИИ</a> · <a href="#/legal/privacy">Политика</a> · <a href="#/faq">Вопросы</a></p>
    </div>
    ${nav('settings')}`;
  $('#pact').onclick = async () => {
    const k = $('#pkey').value.trim();
    if (!k) { toast('Введите ключ'); return; }
    if (!settings.apiUrl) { toast('Не указан адрес сервера — откройте «Для владельца»'); return; }
    $('#pact').disabled = true;
    try { await Plan.activate(k); toast('Плюс включён'); viewPlus(); }
    catch (e) { toast(e.message); $('#pact').disabled = false; }
  };
  const off = $('#poff');
  if (off) off.onclick = () => { if (confirm('Отключить ИИ на этом телефоне?')) { Plan.deactivate(); toast('ИИ отключён'); viewPlus(); } };
  $('#psaveurl').onclick = () => { localStorage.setItem('apiUrl', $('#purl').value.trim()); toast('Адрес сохранён'); };
  const cl = $('#pcloud');
  if (cl) cl.onchange = () => localStorage.setItem('cloudOcr', cl.checked ? '1' : '0');
}

// Имена, которые точно нельзя отправлять: из профилей семьи и из списка врачей
async function anonNames() {
  const ps = await db.profiles.toArray(), ds = await db.doctors.toArray();
  return [...ps.map(p => p.name), ...ds.map(d => d.name)].filter(Boolean);
}
async function anonText(t) { return Anon.scrub(t, { names: await anonNames() }).text; }
