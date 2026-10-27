// Зашифрованная резервная копия в облаке.
// Архив шифруется на телефоне ключом из пароля пользователя (PBKDF2 → AES-256-GCM) и только потом уходит в облако.
// Пароль никуда не отправляется. Без пароля копию не прочитать — ни нам, ни Яндексу.
// Формат файла: "HFB1" (4 байта) + соль (16) + IV (12) + зашифрованные данные.

const Backup = (() => {
  const ITER = 310000;
  const enc = new TextEncoder();
  const meta = async () => ((await db.kv.get('backupMeta')) || {}).value || {};
  const setMeta = async patch => db.kv.put({ key: 'backupMeta', value: { ...(await meta()), ...patch } });
  const markDirty = () => { try { localStorage.setItem('backupDirty', '1'); } catch (e) {} };
  let running = false;

  async function derive(password, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const b64 = u8 => { let s = ''; u8.forEach(b => s += String.fromCharCode(b)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  async function enable(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await derive(password, salt);
    await db.kv.put({ key: 'backupKey', value: key }); // ключ неизвлекаемый: его нельзя достать даже из приложения
    await setMeta({ enabled: true, salt: b64(salt), error: null });
    markDirty();
  }
  async function disable() {
    await db.kv.delete('backupKey');
    await setMeta({ enabled: false });
  }

  async function encryptBlob(blob) {
    const m = await meta(), k = await db.kv.get('backupKey');
    if (!m.enabled || !k) throw new Error('Резервная копия не включена');
    const salt = unb64(m.salt), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k.value, await blob.arrayBuffer()));
    const out = new Uint8Array(4 + 16 + 12 + ct.length);
    out.set(enc.encode('HFB1'), 0); out.set(salt, 4); out.set(iv, 20); out.set(ct, 32);
    return new Blob([out], { type: 'application/octet-stream' });
  }
  async function decryptBuf(buf, password) {
    const u8 = new Uint8Array(buf);
    if (new TextDecoder().decode(u8.slice(0, 4)) !== 'HFB1') throw new Error('Это не резервная копия Healthy Family');
    const salt = u8.slice(4, 20), iv = u8.slice(20, 32);
    const key = await derive(password, salt);
    try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, u8.slice(32))); }
    catch (e) { throw new Error('Неверный пароль резервной копии'); }
  }

  async function run({ silent = false } = {}) {
    if (running) return false;
    const m = await meta();
    if (!m.enabled || !settings.apiUrl) return false;
    running = true;
    try {
      localStorage.removeItem('backupDirty'); // изменения во время выгрузки снова пометят «грязно»
      const blob = await encryptBlob(await exportAll());
      const { url } = await api('backup_put', {});
      const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: blob });
      if (!r.ok) throw new Error('Хранилище не приняло файл (' + r.status + ')');
      await setMeta({ last: new Date().toISOString(), lastSize: blob.size, error: null });
      if (!silent) toast('Резервная копия сохранена');
      return true;
    } catch (e) {
      markDirty();
      await setMeta({ error: e.message, errorAt: new Date().toISOString() });
      if (!silent) toast(e.message);
      return false;
    } finally { running = false; }
  }

  // Автоматически: есть изменения и с прошлой копии прошло больше 10 минут
  async function auto() {
    const m = await meta();
    if (!m.enabled || localStorage.getItem('backupDirty') !== '1' || !navigator.onLine) return;
    if (m.last && Date.now() - new Date(m.last) < 10 * 60 * 1000) return;
    run({ silent: true });
  }

  function init() {
    for (const t of db.tables) {
      if (t.name === 'kv') continue;
      t.hook('creating', markDirty); t.hook('updating', markDirty); t.hook('deleting', markDirty);
    }
    setTimeout(auto, 8000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') auto(); });
    setInterval(auto, 15 * 60 * 1000);
  }

  async function list() { return (await api('backup_list', {})).items || []; }
  async function restore(id, password) {
    const { url } = await api('backup_get', { id });
    const r = await fetch(url);
    if (!r.ok) throw new Error('Не удалось скачать копию (' + r.status + ')');
    const json = await decryptBuf(await r.arrayBuffer(), password);
    await importAll(json);
    await enable(password); // продолжаем делать копии с тем же паролем
    localStorage.removeItem('backupDirty');
    await setMeta({ last: new Date().toISOString(), error: null });
  }
  return { meta, enable, disable, run, auto, init, list, restore };
})();

const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' МБ' : Math.max(1, Math.round(n / 1024)) + ' КБ';
const fmtStamp = iso => { if (!iso) return '—'; const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

// Карточка в «Настройках»
async function backupCard() {
  const m = await Backup.meta();
  if (!m.enabled) return `<section class="card" id="bkcard"><h2>Резервная копия в облаке</h2>
    <p class="sub" style="margin:0">Сейчас все данные хранятся только в этом телефоне. Включите копию — приложение будет само сохранять зашифрованный архив в облако после изменений. Если телефон потеряется, всё восстановится на новом.</p>
    <label class="f">Придумайте пароль копии<input class="in" type="password" id="bkp1" autocomplete="new-password" minlength="8"></label>
    <label class="f">Повторите пароль<input class="in" type="password" id="bkp2" autocomplete="new-password"></label>
    <p class="sub" style="margin:0;color:var(--high)">Сохраните пароль в менеджере паролей. Его невозможно восстановить: без него копию не откроет никто, включая автора приложения.</p>
    <button type="button" class="btn" id="bkon">Включить и сделать первую копию</button>
    <a class="btn ghost" href="#/backup/restore">Восстановить из облака</a></section>`;
  const age = m.last ? Math.round((Date.now() - new Date(m.last)) / 3600000) : null;
  return `<section class="card" id="bkcard"><h2>Резервная копия в облаке</h2>
    <div class="between"><span>Последняя копия</span><span class="sub">${fmtStamp(m.last)}${m.lastSize ? ' · ' + fmtSize(m.lastSize) : ''}</span></div>
    <div class="between"><span>Статус</span><span class="tag ${m.error ? 'high' : 'normal'}">${m.error ? 'Ошибка' : age === null ? 'Ещё не было' : 'Включена'}</span></div>
    ${m.error ? `<p class="sub" style="margin:0;color:var(--high)">${esc(m.error)}</p>` : ''}
    <span class="sub">Копии делаются сами после изменений. Хранятся последние 7, зашифрованные вашим паролем.</span>
    <button type="button" class="btn" id="bknow">Сделать копию сейчас</button>
    <a class="btn ghost" href="#/backup/restore">Восстановить из облака</a>
    <div class="row"><button type="button" class="btn ghost" id="bkpw" style="flex:1">Сменить пароль</button><button type="button" class="btn ghost" id="bkoff" style="flex:1">Выключить</button></div></section>`;
}
function bindBackupCard(redraw) {
  const on = $('#bkon');
  if (on) on.onclick = async () => {
    const a = $('#bkp1').value, b = $('#bkp2').value;
    if (a.length < 8) { toast('Пароль — не короче 8 символов'); return; }
    if (a !== b) { toast('Пароли не совпадают'); return; }
    if (!settings.apiUrl) { toast('Сначала укажите адрес сервера и код доступа'); return; }
    on.disabled = true; on.textContent = 'Шифрую и сохраняю…';
    await Backup.enable(a);
    await Backup.run();
    redraw();
  };
  const now = $('#bknow');
  if (now) now.onclick = async () => { now.disabled = true; now.textContent = 'Сохраняю…'; await Backup.run(); redraw(); };
  const off = $('#bkoff');
  if (off) off.onclick = async () => { if (!confirm('Выключить облачную копию? Уже сохранённые копии останутся в облаке.')) return; await Backup.disable(); redraw(); };
  const pw = $('#bkpw');
  if (pw) pw.onclick = async () => {
    const a = prompt('Новый пароль копии (не короче 8 символов). Старые копии по-прежнему открываются старым паролем.');
    if (!a) return; if (a.length < 8) { toast('Слишком короткий пароль'); return; }
    if (prompt('Повторите новый пароль') !== a) { toast('Пароли не совпадают'); return; }
    await Backup.enable(a); await Backup.run(); redraw();
  };
}

// Экран восстановления: работает и на новом телефоне до создания профилей
async function viewBackupRestore() {
  const back = (await db.profiles.count()) ? '#/settings' : '#/';
  app.innerHTML = `<div class="top">${backLink(back)}<h1 class="grow">Восстановить из облака</h1></div>
    <div class="pad stack">
      ${!settings.apiUrl || !settings.apiToken ? `<section class="card"><h2>Подключение</h2>
        <label class="f">Адрес сервера<input class="in" id="rurl" value="${esc(settings.apiUrl)}" inputmode="url"></label>
        <label class="f">Код доступа<input class="in" id="rtok" value="${esc(settings.apiToken)}" autocomplete="off"></label>
        <button type="button" class="btn" id="rsave">Подключиться</button></section>` : ''}
      <div id="rlist"></div>
      <p class="sub" style="margin:0">Восстановление заменит данные на этом телефоне данными из копии.</p>
    </div>`;
  const rs = $('#rsave');
  if (rs) { rs.onclick = () => { localStorage.setItem('apiUrl', $('#rurl').value.trim()); localStorage.setItem('apiToken', $('#rtok').value.trim()); viewBackupRestore(); }; return; }
  const box = $('#rlist');
  box.innerHTML = '<p class="progress">Ищу копии…</p>';
  let items;
  try { items = await Backup.list(); } catch (e) { box.innerHTML = `<div class="card"><p class="empty" style="margin:0">${esc(e.message)}</p></div>`; return; }
  if (!items.length) { box.innerHTML = '<div class="card"><p class="empty" style="margin:0">В облаке пока нет копий для этого кода доступа.</p></div>'; return; }
  box.innerHTML = `<section class="card"><h2>Копии</h2>${items.map((it, i) => `<div class="row" style="min-height:48px"><div class="grow"><div style="font-weight:500">${fmtStamp(it.at)}${i === 0 ? ' · последняя' : ''}</div><div class="sub">${fmtSize(it.size)}</div></div><button type="button" class="pill" data-rid="${esc(it.id)}">Восстановить</button></div>`).join('')}</section>`;
  $$('[data-rid]').forEach(b => b.onclick = () => {
    const ov = document.createElement('div');
    ov.className = 'sheet';
    ov.innerHTML = `<form class="card sheet-card"><h2>Пароль копии</h2>
      <label class="f">Пароль, который вы задали при включении копии<input class="in" type="password" name="pw" required autocomplete="current-password"></label>
      <div class="row"><button type="button" class="btn ghost" id="rc" style="flex:1">Отмена</button><button class="btn" type="submit" style="flex:1">Восстановить</button></div>
      <p class="progress" id="rprog"></p></form>`;
    document.body.appendChild(ov);
    ov.querySelector('#rc').onclick = () => ov.remove();
    ov.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      if ((await db.profiles.count()) && !confirm('Данные на этом телефоне будут заменены данными из копии. Продолжить?')) return;
      const prog = ov.querySelector('#rprog'); prog.textContent = 'Скачиваю и расшифровываю…';
      try {
        await Backup.restore(b.dataset.rid, e.target.pw.value);
        ov.remove(); toast('Данные восстановлены'); settings.space = 'people'; location.hash = '#/';
        render();
      } catch (err) { prog.textContent = err.message; }
    };
  });
}
