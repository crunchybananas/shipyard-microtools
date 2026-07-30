// Parse Realm actor-row manifests into the v2 two-slot model.
//
// Version 1 assigned one record to a logical row, so a candidate could
// overwrite the accepted production authority. Version 2 keeps independent
// production and candidate records. The read path remains v1-compatible so a
// checkout can be migrated intentionally by `scripts/sprite-row
// migrate-manifest`.

export function normalizeActorRowManifest(manifest, label = 'actor-row manifest') {
  if (!manifest || typeof manifest !== 'object' || !manifest.rows || typeof manifest.rows !== 'object') {
    throw new Error(`${label} must contain row metadata`);
  }

  if (manifest.version === 1) {
    const rows = {};
    for (const [key, item] of Object.entries(manifest.rows)) {
      if (!item || typeof item !== 'object') {
        throw new Error(`${key} has invalid v1 row metadata`);
      }
      if (item.status === 'accepted') rows[key] = { production: item };
      else if (item.status === 'candidate') rows[key] = { candidate: item };
      else throw new Error(`${key} has unsupported v1 row status ${JSON.stringify(item.status)}`);
    }
    return { ...manifest, version: 2, sourceVersion: 1, rows };
  }

  if (manifest.version !== 2) {
    throw new Error(`${label} must use version 1 or 2 row metadata`);
  }

  for (const [key, slots] of Object.entries(manifest.rows)) {
    if (!slots || typeof slots !== 'object' || Array.isArray(slots)) {
      throw new Error(`${key} row slots must be an object`);
    }
    const names = Object.keys(slots);
    const unexpected = names.filter((name) => !['production', 'candidate'].includes(name));
    if (unexpected.length) {
      throw new Error(`${key} has unsupported row slot(s): ${unexpected.join(', ')}`);
    }
    if (!names.includes('production') && !names.includes('candidate')) {
      throw new Error(`${key} has no production or candidate row`);
    }
    for (const [slot, status] of [['production', 'accepted'], ['candidate', 'candidate']]) {
      const item = slots[slot];
      if (item === undefined) continue;
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`${key}/${slot} metadata must be an object`);
      }
      if (item.status !== status) {
        throw new Error(`${key}/${slot} must have status ${JSON.stringify(status)}`);
      }
    }
  }
  return { ...manifest, sourceVersion: 2 };
}

export function actorRowRecords(manifest) {
  const records = [];
  for (const [key, slots] of Object.entries(manifest.rows)) {
    if (slots.production) records.push({ key, slot: 'production', item: slots.production });
    if (slots.candidate) records.push({ key, slot: 'candidate', item: slots.candidate });
  }
  return records;
}
