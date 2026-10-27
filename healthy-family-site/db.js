// Локальная база на телефоне (IndexedDB через Dexie).
// ВАЖНО: схему меняем только добавлением новой версии db.version(N+1) —
// так у всех пользователей данные мигрируют, а не теряются.
const db = new Dexie('moi-analizy');

db.version(1).stores({
  profiles: '++id',                     // {name, kind: adult|child|pet, sex: f|m, birth, species}
  sections: '++id, profileId',          // {profileId, name, color, order}
  records:  '++id, profileId, date, *sectionIds', // {profileId, date, type, title, clinicId, doctorId, sectionIds[], conclusion, text, notes, explanation, createdAt}
  files:    '++id, recordId',           // {recordId, name, mime, size, blob}
  results:  '++id, recordId, profileId, metricId, [profileId+metricId], date', // {recordId, profileId, date, metricId, rawName, value, num, unit, refLow, refHigh, refText, status}
  clinics:  '++id, &name',
  doctors:  '++id, &name',
  kv:       'key'                       // служебные значения: {key, value}
});

// v2: анамнез — заболевания, операции, травмы, аллергии, беременности, наследственность
db.version(2).stores({
  history: '++id, profileId, kind'      // {profileId, kind, code, name, status, year, relative, outcome, weeks, weight, allergenType, reaction, anesthesia, clinic, note}
});

// v3: документы профиля — полисы ОМС и ДМС, СНИЛС, паспорт, ветпаспорт и любые другие.
// Фото и сканы документов лежат в той же таблице files, но с docId вместо recordId.
db.version(3).stores({
  idDocs: '++id, profileId, type, validTo',   // {profileId, type, title, number, series, issuer, validFrom, validTo, phone, program, note, createdAt}
  files:  '++id, recordId, docId'
});

// v4: лекарства и их приём, прививки, напоминания, плановые обследования, женский цикл.
// Результаты без записи (ручные измерения: вес, рост, давление) хранятся в results с recordId = 0.
db.version(4).stores({
  meds:      '++id, profileId',              // {profileId, name, dose, times[], start, days, stock, perDose, note, active}
  medLogs:   '++id, medId, date, [medId+date]', // {medId, profileId, date, time, takenAt}
  vaccines:  '++id, profileId, status, date', // {profileId, name, disease, status: planned|done, date, plannedDate, brand, batch, clinic, note, repeatMonths, source}
  reminders: '++id, profileId, date',         // {profileId, date, title, kind: retest|other, metricId, done}
  plans:     '++id, profileId, sectionId',    // {profileId, sectionId, name, everyMonths, lastDate, nextDate, note}
  cycles:    '++id, profileId, start'         // {profileId, start, end}
});

const DEFAULT_SECTIONS = {
  adult_f: ['Анализы крови', 'Гинекология', 'Эндокринология', 'Кардиология', 'ЛОР', 'Офтальмология', 'Стоматология', 'Неврология', 'Опорно-двигательная система', 'Дерматология', 'Прочее'],
  adult_m: ['Анализы крови', 'Урология', 'Эндокринология', 'Кардиология', 'ЛОР', 'Офтальмология', 'Стоматология', 'Неврология', 'Опорно-двигательная система', 'Дерматология', 'Прочее'],
  child:   ['Анализы', 'Педиатр', 'ЛОР', 'Офтальмология', 'Стоматология', 'Неврология', 'Ортопедия', 'Прочее'],
  pet:     ['Анализы', 'Осмотры', 'Вакцинация', 'Обработки от паразитов', 'Зубы', 'Кожа и шерсть', 'Хирургия', 'Прочее']
};
const SECTION_COLORS = ['#C0392B', '#B5547F', '#8A6BB8', '#D2603A', '#3F8FB0', '#2C7A8C', '#6E8B3D', '#5A6FB5', '#9A7B4F', '#B07A3A', '#6B7280'];

async function createProfile(p) {
  const id = await db.profiles.add(p);
  const key = p.kind === 'adult' ? 'adult_' + (p.sex || 'f') : p.kind;
  const names = DEFAULT_SECTIONS[key] || DEFAULT_SECTIONS.adult_f;
  await db.sections.bulkAdd(names.map((name, i) => ({ profileId: id, name, color: SECTION_COLORS[i % SECTION_COLORS.length], order: i })));
  return id;
}

// Удалить профиль целиком, со всеми записями, файлами и данными
async function deleteProfile(id) {
  await db.transaction('rw', db.tables, async () => {
    const recIds = await db.records.where('profileId').equals(id).primaryKeys();
    for (const r of recIds) await db.files.where('recordId').equals(r).delete();
    const docIds = await db.idDocs.where('profileId').equals(id).primaryKeys();
    for (const d of docIds) await db.files.where('docId').equals(d).delete();
    const medIds = await db.meds.where('profileId').equals(id).primaryKeys();
    for (const m of medIds) await db.medLogs.where('medId').equals(m).delete();
    for (const t of ['records', 'results', 'sections', 'history', 'idDocs', 'meds', 'vaccines', 'reminders', 'plans', 'cycles'])
      await db[t].where('profileId').equals(id).delete();
    await db.profiles.delete(id);
  });
}

async function getOrCreateByName(table, name) {
  name = (name || '').trim();
  if (!name) return null;
  const found = await table.where('name').equals(name).first();
  return found ? found.id : table.add({ name });
}

async function deleteRecord(id) {
  await db.transaction('rw', db.records, db.files, db.results, async () => {
    await db.files.where('recordId').equals(id).delete();
    await db.results.where('recordId').equals(id).delete();
    await db.records.delete(id);
  });
}

// Полный экспорт архива одним файлом (страховка до появления облачного бэкапа)
// Ключи, которые живут только на этом телефоне: не попадают в архив и не затираются при восстановлении
const LOCAL_ONLY_KEYS = ['mailKey', 'backupKey', 'backupMeta', 'uploadTray'];

async function exportAll() {
  const out = { app: 'moi-analizy', schema: db.verno, exportedAt: new Date().toISOString(), tables: {} };
  for (const t of db.tables) {
    let rows = await t.toArray();
    if (t.name === 'kv') rows = rows.filter(r => !LOCAL_ONLY_KEYS.includes(r.key)); // ключи шифрования не покидают телефон
    if (t.name === 'files') {
      out.tables.files = await Promise.all(rows.map(async r => ({ ...r, blob: undefined, b64: await blobToB64(r.blob) })));
    } else out.tables[t.name] = rows;
  }
  return new Blob([JSON.stringify(out)], { type: 'application/json' });
}

async function importAll(file) {
  const data = typeof file === 'string' ? JSON.parse(file) : JSON.parse(await file.text());
  if (data.app !== 'moi-analizy') throw new Error('Это не архив приложения Healthy Family');
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      if (t.name === 'kv') await t.filter(r => !LOCAL_ONLY_KEYS.includes(r.key)).delete();
      else await t.clear();
    }
    for (const [name, rows0] of Object.entries(data.tables)) {
      if (!db[name]) continue;
      const rows = name === 'kv' ? rows0.filter(r => !LOCAL_ONLY_KEYS.includes(r.key)) : rows0;
      if (name === 'files') {
        await db.files.bulkAdd(rows.map(r => { const { b64, ...rest } = r; return { ...rest, blob: b64ToBlob(b64, r.mime) }; }));
      } else await db[name].bulkAdd(rows);
    }
  });
}

function blobToB64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}
function b64ToBlob(b64, mime) {
  const bin = atob(b64 || '');
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime || 'application/octet-stream' });
}
