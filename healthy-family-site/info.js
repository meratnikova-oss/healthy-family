// Обучение при первом входе, принятие условий и «Вопросы и ответы».
const TOUR_ICONS = {
  family: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="22" cy="20" r="7"/><circle cx="44" cy="24" r="5.5"/><path d="M8 50c1-9 7-15 14-15s13 6 14 15M34 50c.8-7 5-11 10-11s9.2 4 10 11"/><path d="M50 8c-4 0-7 3-7 7 3 0 7-3 7-7z"/></svg>',
  phone: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="18" y="6" width="28" height="52" rx="5"/><path d="M28 50h8"/><rect x="25" y="24" width="14" height="11" rx="2"/><path d="M28 24v-3a4 4 0 0 1 8 0v3"/></svg>',
  stack: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="16" width="30" height="40" rx="3"/><path d="M20 10h28a3 3 0 0 1 3 3v35"/><path d="M21 28h16M21 35h16M21 42h10"/></svg>',
  spark: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M32 8l5 14 14 5-14 5-5 14-5-14-14-5 14-5z"/><path d="M50 42l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></svg>',
  chart: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 54h48"/><path d="M12 44l12-14 10 7 16-20"/><circle cx="50" cy="17" r="3"/><rect x="40" y="36" width="14" height="12" rx="2"/><path d="M44 36v-3M50 36v-3"/></svg>',
  doctor: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10v14a12 12 0 0 0 24 0V10"/><path d="M32 36v6a10 10 0 0 0 20 0v-4"/><circle cx="52" cy="34" r="4"/></svg>'
};
const TOUR = [
  ['family', 'Здоровье всей семьи в одном месте', 'Анализы, УЗИ, приёмы врачей, полисы и прививки — для вас, детей и питомцев. По разделам и по годам.'],
  ['phone', 'Всё хранится только на вашем телефоне', 'Нет регистрации и аккаунтов. Разработчик не видит ваш архив. Копию в облаке, если включите, шифрует ваш пароль.'],
  ['stack', 'Снимайте бланк пачкой', 'Фото подряд, сразу много снимков из галереи или PDF из почты через «Поделиться». До 40 страниц за раз.'],
  ['spark', 'Плюс: ИИ сам заполнит показатели', 'Перед отправкой телефон вырезает ФИО, дату рождения, адрес и номера документов. ИИ видит только таблицу показателей.'],
  ['chart', 'Динамика, прививки, лекарства', 'Графики показателей за годы, календарь прививок по нацкалендарю, напоминания о пересдаче и приёме лекарств.'],
  ['doctor', 'Помогает, но не лечит', 'Приложение подсвечивает значения вне нормы из бланка и объясняет термины. Выводы и лечение — вместе с врачом.']
];

const Tour = {
  get done() { return localStorage.getItem('tourDone') === '1'; },
  finish() { localStorage.setItem('tourDone', '1'); }
};
const Terms = {
  get accepted() { return +localStorage.getItem('termsVersion') >= HF_CONFIG.termsVersion; },
  accept() { localStorage.setItem('termsVersion', String(HF_CONFIG.termsVersion)); localStorage.setItem('termsAt', new Date().toISOString()); }
};

function viewTour(again = false) {
  app.innerHTML = `
    <div class="tour">
      <div class="tour-top"><span class="tour-brand">Healthy Family</span><button type="button" class="linkbtn" id="tskip">${again ? 'Закрыть' : 'Пропустить'}</button></div>
      <div class="tour-track" id="track">${TOUR.map(([ic, t, d], i) => `
        <section class="tour-slide" aria-label="Шаг ${i + 1} из ${TOUR.length}">
          <div class="tour-art">${TOUR_ICONS[ic]}</div>
          <h1>${t}</h1><p>${d}</p>
        </section>`).join('')}</div>
      <div class="tour-foot">
        <div class="tour-dots" role="tablist">${TOUR.map((_, i) => `<button type="button" data-dot="${i}" aria-label="Шаг ${i + 1}"></button>`).join('')}</div>
        <button type="button" class="btn" id="tnext">Далее</button>
      </div>
    </div>`;
  const track = $('#track');
  let idx = 0;
  const go = i => track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
  const sync = () => {
    idx = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    $$('[data-dot]').forEach((b, i) => b.classList.toggle('on', i === idx));
    $('#tnext').textContent = idx === TOUR.length - 1 ? (again ? 'Готово' : 'Начать') : 'Далее';
  };
  track.addEventListener('scroll', () => { clearTimeout(sync._t); sync._t = setTimeout(sync, 60); }, { passive: true });
  $$('[data-dot]').forEach(b => b.onclick = () => go(+b.dataset.dot));
  const end = () => { Tour.finish(); if (again) location.hash = '#/faq'; else render(); };
  $('#tnext').onclick = () => idx < TOUR.length - 1 ? go(idx + 1) : end();
  $('#tskip').onclick = end;
  sync();
}

function viewTerms() {
  const update = +localStorage.getItem('termsVersion') > 0;
  app.innerHTML = `
    <div class="top"><h1>${update ? 'Условия обновились' : 'Перед началом'}</h1></div>
    <div class="pad stack">
      <p class="sub" style="font-size:15px;color:var(--ink)">${update ? 'Мы обновили документы. Чтобы продолжить, примите новую редакцию.' : 'Healthy Family хранит архив на этом телефоне. Чтобы начать, примите условия использования.'}</p>
      <section class="card stack" style="gap:12px">
        <a class="between doclink" href="#/legal/offer"><span><b>Пользовательское соглашение</b><br><span class="sub">лицензионный договор — оферта</span></span><span aria-hidden="true">›</span></a>
        <a class="between doclink" href="#/legal/privacy"><span><b>Политика конфиденциальности</b><br><span class="sub">какие данные и где обрабатываются</span></span><span aria-hidden="true">›</span></a>
      </section>
      <label class="check"><input type="checkbox" id="tok1"> <span>Принимаю соглашение и подтверждаю, что ознакомлен(а) с политикой конфиденциальности</span></label>
      <label class="check"><input type="checkbox" id="tok2"> <span>Понимаю, что приложение не ставит диагнозы и не заменяет врача</span></label>
      <button type="button" class="btn" id="tgo" disabled>Принимаю</button>
      <span class="sub">Согласие на передачу обезличенных данных в ИИ спросим отдельно — только если включите Плюс.</span>
    </div>`;
  const chk = () => { $('#tgo').disabled = !($('#tok1').checked && $('#tok2').checked); };
  $('#tok1').onchange = chk; $('#tok2').onchange = chk;
  $('#tgo').onclick = () => { Terms.accept(); render(); };
}

const FAQ = [
  ['Данные и безопасность', [
    ['Где хранятся мои анализы и документы?', 'Только на вашем телефоне, в хранилище приложения. Регистрации нет, на сервер архив не загружается. Если включить облачную копию (Плюс), в облако уходит зашифрованный файл, который открывается только вашим паролем.'],
    ['Видит ли разработчик мои данные?', 'Нет. У разработчика нет доступа к телефону и нет ключа от облачной копии. В Плюс сервер на мгновение получает только обезличенный текст документа для распознавания и ничего не сохраняет.'],
    ['Что такое обезличивание и что уходит в ИИ?', 'Перед отправкой приложение прямо на телефоне вырезает из текста ФИО, имена из ваших профилей, дату рождения, возраст, адрес, телефон, почту, номера полиса, СНИЛС, паспорта, карты и заказа, подписи врачей. В ИИ уходят названия показателей, значения, нормы и заключение. После распознавания можно открыть «Что получил ИИ» и проверить.'],
    ['А фотографии документов?', 'Фото на сервер не отправляются. В Плюс они распознаются в текст прямо на телефоне — поэтому первое распознавание скачивает движок (около 11 МБ) и фото обрабатываются чуть дольше, чем PDF.'],
    ['Что будет, если я потеряю телефон или удалю приложение?', 'Данные на телефоне пропадут вместе с ним. Чтобы этого не случилось, включите облачную копию (Плюс) или время от времени скачивайте архив файлом: «Ещё» → «Скачать весь архив». На новом телефоне его можно восстановить.'],
    ['Можно ли вести данные детей и родителей?', 'Да, для этого и сделаны профили. Данные ребёнка вносит родитель. Для взрослых родственников — с их согласия.'],
    ['Как удалить всё?', '«Ещё» → «Удалить все данные на телефоне». Облачные копии удалим по письму на почту поддержки.']
  ]],
  ['Загрузка документов', [
    ['Как загрузить много страниц или файлов сразу?', 'На экране «Новая запись»: «Снять» — фотографируйте страницы подряд; «Галерея» — отметьте сразу несколько фото; «Файлы» — PDF, Word, Excel. За один раз — до 40 страниц в документе и до 30 файлов в пакете.'],
    ['Один документ или каждый файл отдельно?', 'Если файлов несколько, приложение спросит. «Один документ» — страницы одного бланка, получится одна запись. «Каждый файл отдельно» — разные анализы, каждый станет своей записью.'],
    ['Как добавить анализ из почты или мессенджера?', 'Откройте вложение → «Поделиться» → Healthy Family. Файл сразу попадёт на экран новой записи. На iPhone удобнее сохранить файл в «Файлы» и выбрать его в приложении.'],
    ['Что, если PDF защищён паролем?', 'Приложение спросит пароль — лаборатории обычно присылают его в письме, часто это дата рождения.'],
    ['ИИ ошибся в значении. Что делать?', 'Перед сохранением всё можно поправить на экране проверки, а позже — «Изменить» в записи. Оригинал документа всегда хранится полностью.']
  ]],
  ['Бесплатная версия и Плюс', [
    ['Что входит в бесплатную версию?', 'Весь архив: записи, файлы, разделы, ручной ввод показателей, динамика, анамнез, прививки, лекарства, цикл, карта экстренной помощи, сводка для врача, экспорт в файл.'],
    ['Что даёт Плюс?', 'ИИ сам переносит показатели из бланка, расшифровывает термины и объясняет показатели, подбирает код МКБ по описанию. Плюс — зашифрованная копия в облаке.'],
    ['Как включить Плюс?', '«Ещё» → «Healthy Family Плюс» → купите ключ и введите его. Ключ не связан с вашим именем или почтой.'],
    ['Как отказаться?', 'Просто не продлевайте ключ. Чтобы сразу прекратить передачу в ИИ — «Отключить ИИ на этом телефоне». Возврат за неиспользованный месяц — по письму, условия в соглашении.']
  ]],
  ['О приложении', [
    ['Это медицинское приложение? Оно ставит диагнозы?', 'Нет. Это личный архив. Пометки «выше» или «ниже» — сравнение с нормой, напечатанной в бланке лаборатории. Расшифровка — справка о терминах. Выводы и лечение — только с врачом.'],
    ['Как установить на телефон?', 'Android: откройте ссылку в Chrome → меню ⋮ → «Установить приложение». iPhone: Safari → «Поделиться» → «На экран „Домой“». Открывайте приложение только с иконки.'],
    ['Как обновлять?', 'Само: при открытии с интернетом приложение подтягивает новую версию и пишет «Обновлено». Вручную — «Ещё» → «Проверить обновления».'],
    ['Как перенести на новый телефон?', 'С облачной копией: на новом телефоне «Восстановить из облака» и ваш пароль копии. Без неё: «Скачать весь архив» на старом и «Восстановить из файла» на новом.']
  ]]
];

function viewFaq() {
  const mail = HF_CONFIG.seller.email;
  app.innerHTML = `
    <div class="top">${backLink('#/settings')}<h1 class="grow">Вопросы и ответы</h1></div>
    <div class="pad stack">
      ${FAQ.map(([group, items]) => `<section class="stack" style="gap:8px"><h2 class="faq-h">${group}</h2>
        <div class="card faq">${items.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></section>`).join('')}
      <button type="button" class="btn ghost" id="faqtour">Посмотреть обучение ещё раз</button>
      <section class="card stack" style="gap:10px"><h2>Документы</h2>
        <a class="between doclink" href="#/legal/offer"><span>Пользовательское соглашение</span><span>›</span></a>
        <a class="between doclink" href="#/legal/privacy"><span>Политика конфиденциальности</span><span>›</span></a>
        <a class="between doclink" href="#/legal/ai"><span>Согласие на передачу в ИИ</span><span>›</span></a>
      </section>
      ${/@/.test(mail) ? `<p class="sub" style="text-align:center">Не нашли ответа? Напишите: <a href="mailto:${esc(mail)}">${esc(mail)}</a></p>` : ''}
    </div>
    ${nav('settings')}`;
  $('#faqtour').onclick = () => viewTour(true);
}
