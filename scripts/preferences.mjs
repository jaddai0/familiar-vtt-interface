export const DEFAULTS = Object.freeze({
  tabs: ['chat', 'combat', 'scenes', 'actors', 'journal', 'compendium'],
  layers: ['tokens', 'drawings', 'templates'],
  tools: {}, width: 360, density: 'comfortable',
});
export function clampWidth(value, viewport = 1920) {
  return Math.round(Math.max(300, Math.min(600, Math.max(300, viewport - 360), Number(value) || DEFAULTS.width)));
}
export function normalizePreferences(value = {}) {
  const list = (v, fallback, max) => Array.isArray(v)
    ? [...new Set(v.filter(x => typeof x === 'string' && x.length < 120))].slice(0, max) : [...fallback];
  return {
    tabs: list(value.tabs, DEFAULTS.tabs, 6), layers: list(value.layers, DEFAULTS.layers, 5),
    tools: Object.fromEntries(Object.entries(value.tools && typeof value.tools === 'object' ? value.tools : {})
      .filter(([k]) => k.length < 120).map(([k, v]) => [k, list(v, [], 5)])),
    width: clampWidth(value.width), density: value.density === 'compact' ? 'compact' : 'comfortable',
  };
}
export function loadPreferences(storage, key) {
  try { return normalizePreferences(JSON.parse(storage.getItem(key) || '{}') || {}); }
  catch { return normalizePreferences(); }
}
export function savePreferences(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(normalizePreferences(value))); return true; }
  catch { return false; }
}
