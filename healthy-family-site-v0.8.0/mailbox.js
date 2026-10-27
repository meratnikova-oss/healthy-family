// Файлы извне: «Поделиться» из почты и почтовый агент.
// Почтовый агент кладёт письма в облако зашифрованными ПУБЛИЧНЫМ ключом этого телефона.
// Закрытый ключ создаётся на телефоне, не извлекается и никуда не уходит — прочитать письма может только он.

const Shared = {
  async take() {
    if (!('caches' in window)) return [];
    const cache = await caches.open('share-inbox');
    const keys = await cache.keys();
    const files = [];
    for (const k of keys) {
      const r = await cache.match(k);
      const blob = await r.blob();
      const name = decodeURIComponent(r.headers.get('x-name') || 'файл');
      files.push(new File([blob], name, { type: r.headers.get('content-type') || blob.type }));
      await cache.delete(k);
    }
    return files;
  }
};

const MailKey = {
  async get() { const r = await db.kv.get('mailKey'); return r ? r.value : null; },
  async create() {
    const kp = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      false, ['encrypt', 'decrypt']); // закрытый ключ нельзя экспортировать даже из приложения
    await db.kv.put({ key: 'mailKey', value: kp });
    return kp;
  },
  async publicB64(kp) {
    const spki = new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey));
    let s = ''; spki.forEach(b => s += String.fromCharCode(b));
    return btoa(s);
  },
  // Формат: [2 байта длина][RSA-OAEP(ключ AES)][12 байт IV][AES-GCM шифротекст + тег]
  async decrypt(buf) {
    const kp = await this.get();
    if (!kp) throw new Error('На этом телефоне нет ключа почты. Создайте его в «Настройках».');
    const u8 = new Uint8Array(buf);
    const len = (u8[0] << 8) | u8[1];
    const encKey = u8.slice(2, 2 + len), iv = u8.slice(2 + len, 14 + len), data = u8.slice(14 + len);
    const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, kp.privateKey, encKey);
    const aes = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aes, data);
    return JSON.parse(new TextDecoder().decode(plain));
  }
};

const MailInbox = {
  async count() {
    if (!settings.apiUrl || !(await MailKey.get())) return 0;
    try { const r = await api('inbox_list', {}); return (r.items || []).length; } catch (e) { return 0; }
  },
  async list() { const r = await api('inbox_list', {}); return r.items || []; },
  async open(id) {
    const { url } = await api('inbox_url', { id });
    const res = await fetch(url);
    if (!res.ok) throw new Error('Не удалось скачать письмо из облака');
    const msg = await MailKey.decrypt(await res.arrayBuffer());
    msg.files = (msg.files || []).map(f => new File([b64ToBlob(f.b64, f.mime)], f.name, { type: f.mime }));
    return msg;
  },
  ack(id) { return api('inbox_ack', { id }); }
};

async function viewInbox() {
  app.innerHTML = `<div class="top">${backLink('#/')}<h1 class="grow">Из почты</h1></div><div class="pad stack" id="ib"><p class="progress">Проверяю почтовый ящик…</p></div>${nav('')}`;
  const box = $('#ib');
  let items;
  try { items = await MailInbox.list(); } catch (e) { box.innerHTML = `<div class="card"><p class="empty">${esc(e.message)}</p></div>`; return; }
  if (!items.length) { box.innerHTML = '<div class="card"><p class="empty">Новых писем с анализами нет. Агент проверяет ящик каждые 30 минут.</p></div>'; return; }
  box.innerHTML = '<p class="progress">Расшифровываю…</p>';
  const opened = [];
  for (const it of items) {
    try { opened.push({ id: it.id, ...(await MailInbox.open(it.id)) }); }
    catch (e) { opened.push({ id: it.id, error: e.message }); }
  }
  box.innerHTML = opened.map((m, i) => `
    <section class="card">
      ${m.error ? `<p class="empty">${esc(m.error)}</p>` : `
        <div><div style="font-weight:600">${esc(m.subject || 'Без темы')}</div>
          <div class="sub">${esc(m.from || '')}${m.date ? ' · ' + esc(new Date(m.date).toLocaleDateString('ru-RU')) : ''}</div></div>
        <div class="row" style="flex-wrap:wrap;gap:6px">${m.files.map(f => `<span class="pill" style="cursor:default">${esc(f.name)}</span>`).join('')}</div>
        ${m.note ? `<span class="sub">${esc(m.note)}</span>` : ''}`}
      <div class="row">
        ${m.error ? '' : `<button type="button" class="btn" style="flex:1" data-take="${i}">Разобрать</button>`}
        <button type="button" class="btn ghost" style="flex:1" data-skip="${i}">${m.error ? 'Убрать' : 'Пропустить'}</button>
      </div>
    </section>`).join('');
  $$('[data-take]').forEach(b => b.onclick = async () => {
    const m = opened[+b.dataset.take];
    const p = await currentProfile();
    draft = { stage: 'pick', profileId: p.id, files: m.files, fromInbox: m.id };
    location.hash = '#/upload?prefilled=1';
  });
  $$('[data-skip]').forEach(b => b.onclick = async () => {
    const m = opened[+b.dataset.skip];
    if (!m.error && !confirm('Убрать письмо из входящих? Само письмо в почте останется.')) return;
    await MailInbox.ack(m.id).catch(() => {});
    viewInbox();
  });
}
