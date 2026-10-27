// Справочник показателей: синонимы, единицы, запасные нормы, подсказки.
// Лежит отдельным файлом metrics.json, чтобы обновлять его без новой версии приложения.
const Metrics = (() => {
  let dict = [];
  let index = new Map();

  const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, '').replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/[,:;]+$/g, '').replace(/\s+/g, ' ').trim();

  async function load() {
    try {
      const r = await fetch('metrics.json', { cache: 'no-cache' });
      const data = await r.json();
      dict = data.metrics || [];
    } catch (e) { dict = dict || []; }
    index = new Map();
    for (const m of dict) {
      index.set(norm(m.name), m);
      for (const s of m.synonyms || []) index.set(norm(s), m);
    }
  }

  function match(rawName) {
    const n = norm(rawName);
    if (index.has(n)) return index.get(n);
    // запасной вариант: название начинается с синонима ("Ферритин сыв." → ферритин)
    let best = null, bestLen = 0;
    for (const [key, m] of index) {
      if (key.length >= 3 && (n.startsWith(key + ' ') || n === key) && key.length > bestLen) { best = m; bestLen = key.length; }
    }
    return best;
  }

  const byId = id => dict.find(m => m.id === id) || null;
  const idFor = rawName => { const m = match(rawName); return m ? m.id : 'raw:' + norm(rawName); };
  const nameFor = (id, fallback) => (byId(id) || {}).name || fallback || id.replace(/^raw:/, '');

  function toNum(v) {
    if (v === null || v === undefined || v === '') return null;
    const s = String(v).replace(',', '.').replace(/[^\d.\-]/g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }

  // Приводим значение к единицам справочника, если знаем коэффициент
  function convert(m, num, unit) {
    if (!m || num === null || !unit) return { num, unit };
    const u = norm(unit);
    if (norm(m.unit) === u) return { num, unit: m.unit };
    const f = m.conv && Object.entries(m.conv).find(([k]) => norm(k) === u);
    return f ? { num: +(num * f[1]).toFixed(3), unit: m.unit } : { num, unit };
  }

  function status(num, low, high) {
    if (num === null) return 'unknown';
    if (low !== null && low !== undefined && num < low) return 'low';
    if (high !== null && high !== undefined && num > high) return 'high';
    if ((low === null || low === undefined) && (high === null || high === undefined)) return 'unknown';
    return 'normal';
  }

  // Строка из распознавания → готовый результат для базы
  function normalizeResult(r, profile) {
    const m = match(r.name);
    let num = toNum(r.value);
    let low = toNum(r.refLow), high = toNum(r.refHigh);
    let unit = r.unit || '';
    if (m && num !== null) {
      const c = convert(m, num, unit);
      if (c.unit !== unit && low !== null) low = convert(m, low, unit).num;
      if (c.unit !== unit && high !== null) high = convert(m, high, unit).num;
      num = c.num; unit = c.unit;
    }
    // норма из бланка в приоритете; справочник — только для взрослых и только если в бланке пусто
    if (low === null && high === null && m && m.ref && profile && profile.kind === 'adult') {
      const ref = m.ref[profile.sex === 'm' ? 'm' : 'f'];
      if (ref) { low = ref[0]; high = ref[1]; }
    }
    return {
      metricId: m ? m.id : 'raw:' + norm(r.name),
      rawName: r.name, value: String(r.value ?? ''), num, unit,
      refLow: low, refHigh: high, refText: r.refText || '',
      status: status(num, low, high)
    };
  }

  return { load, match, byId, idFor, nameFor, toNum, normalizeResult, status, all: () => dict };
})();
