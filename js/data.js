// data.js — fetches ALL JSON data with ?v=1 and unwraps every wrapper object
// BEFORE any for...of (the V1/V2 TypeError lesson). DOM-free: safe to import in node.
import { SAVE_VERSION } from './logic.js?v=1';

export const DATA_V = 1;

const FILES = {
  families: 'data/families.json',
  crops: 'data/crops.json',
  orders: 'data/orders.json',
  pip: 'data/pip.json',
  decorations: 'data/decorations.json',
  land: 'data/land.json',
  milestones: 'data/milestones.json',
};

// Unwrap a wrapper object like {"families":[...]} -> [...].
// Throws a loud, specific error instead of the silent V1/V2 TypeError.
export function unwrap(wrapper, key) {
  if (!wrapper || typeof wrapper !== 'object') {
    throw new Error(`[data] unwrap failed: wrapper for "${key}" is not an object`);
  }
  const arr = wrapper[key];
  if (!Array.isArray(arr)) {
    throw new Error(`[data] unwrap failed: expected array at .${key}, got ${typeof arr}`);
  }
  return arr;
}

async function fetchJson(path) {
  const res = await fetch(`${path}?v=${DATA_V}`);
  if (!res.ok) throw new Error(`[data] failed to load ${path}: HTTP ${res.status}`);
  return res.json();
}

// Loads and unwraps EVERYTHING. Returns plain arrays/objects — no wrappers.
export async function loadData() {
  const raw = {};
  for (const [key, path] of Object.entries(FILES)) raw[key] = await fetchJson(path);

  const families = unwrap(raw.families, 'families');
  const crops = unwrap(raw.crops, 'crops');
  const ordersRaw = raw.orders;
  const visitors = unwrap(ordersRaw, 'visitors');
  const templates = unwrap(ordersRaw, 'templates');
  const chatter = unwrap(raw.pip, 'chatter');
  const tutorial = unwrap(raw.pip, 'tutorial');
  const hints = unwrap(raw.pip, 'hints');
  const decorations = unwrap(raw.decorations, 'decorations');
  const plots = unwrap(raw.land, 'plots');
  const milestones = unwrap(raw.milestones, 'milestones');

  // Build lookup maps (still from unwrapped arrays only)
  const familyById = {};
  for (const f of families) {
    if (!Array.isArray(f.tiers) || f.tiers.length !== 8) {
      throw new Error(`[data] family ${f.id} must have exactly 8 tiers`);
    }
    familyById[f.id] = f;
  }
  const cropById = {};
  for (const c of crops) cropById[c.id] = c;
  const decorById = {};
  for (const d of decorations) decorById[d.id] = d;

  return {
    families, crops, visitors, templates, chatter, tutorial, hints,
    decorations, plots, milestones,
    familyById, cropById, decorById,
    saveVersion: SAVE_VERSION,
  };
}
