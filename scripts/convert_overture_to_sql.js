/**
 * Converts exported Overture Maps US gyms JSON into chunked SQL files in `supabase/overture_us_gyms/`,
 * deduplicating against existing OSM gyms in `supabase/us_gyms/` (same normalized name within ~150m).
 *
 * Usage:
 *   node scripts/convert_overture_to_sql.js <path-to-overture_us_gyms.json>
 */
const fs = require('fs');
const path = require('path');

const INPUT_JSON =
  process.argv[2] ||
  'C:/Users/Tanner/.gemini/antigravity/brain/cdc661a5-49d7-411c-9130-ba286fc0586b/scratch/overture_us_gyms.json';
const US_OSM_DIR = path.resolve(__dirname, '../supabase/us_gyms');
const OUT_DIR = path.resolve(__dirname, '../supabase/overture_us_gyms');

function escapeSql(val) {
  if (val === null || val === undefined || val === '') return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

function normName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function loadExistingOsmGyms() {
  const existing = [];
  if (!fs.existsSync(US_OSM_DIR)) return existing;
  const files = fs.readdirSync(US_OSM_DIR).filter((f) => /^us_gyms_part_\d+\.sql$/.test(f));
  const tupleRegex = /^\('([^']*(?:''[^']*)*)',\s*'([^']*(?:''[^']*)*)',\s*(NULL|'[^']*(?:''[^']*)*'),\s*(NULL|'[^']*(?:''[^']*)*'),\s*(NULL|'[^']*(?:''[^']*)*'),\s*(NULL|'[^']*(?:''[^']*)*'),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),/gm;
  for (const file of files) {
    const content = fs.readFileSync(path.join(US_OSM_DIR, file), 'utf8');
    let m;
    while ((m = tupleRegex.exec(content)) !== null) {
      existing.push({
        nameNorm: normName(m[2].replace(/''/g, "'")),
        lat: parseFloat(m[7]),
        lon: parseFloat(m[8]),
      });
    }
  }
  return existing;
}

function isDuplicateOfExisting(ov, existingBuckets) {
  const key = `${Math.round(ov.latitude * 100)}_${Math.round(ov.longitude * 100)}`;
  const n = normName(ov.name);
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLon = -1; dLon <= 1; dLon++) {
      const k = `${Math.round(ov.latitude * 100) + dLat}_${Math.round(ov.longitude * 100) + dLon}`;
      const list = existingBuckets.get(k);
      if (!list) continue;
      for (const ex of list) {
        const distApprox =
          Math.abs(ov.latitude - ex.lat) + Math.abs(ov.longitude - ex.lon);
        // ~0.0015 deg ≈ 150m; if same normalized name (or one contains the other) and within ~150m, skip duplicate
        if (
          distApprox < 0.0018 &&
          (ex.nameNorm === n ||
            (ex.nameNorm.length >= 5 && n.includes(ex.nameNorm)) ||
            (n.length >= 5 && ex.nameNorm.includes(n)))
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function main() {
  if (!fs.existsSync(INPUT_JSON)) {
    throw new Error(`Input JSON not found: ${INPUT_JSON}`);
  }
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const osmList = loadExistingOsmGyms();
  console.log(`Loaded ${osmList.length} existing OSM gyms for deduplication.`);

  const buckets = new Map();
  for (const g of osmList) {
    const k = `${Math.round(g.lat * 100)}_${Math.round(g.lon * 100)}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(g);
  }

  const ovRaw = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf8'));
  console.log(`Loaded ${ovRaw.length} Overture US gym rows.`);

  const deduped = [];
  let skippedDupes = 0;
  for (const r of ovRaw) {
    if (!r.name || typeof r.latitude !== 'number' || typeof r.longitude !== 'number') continue;
    if (isDuplicateOfExisting(r, buckets)) {
      skippedDupes++;
      continue;
    }
    // Also add to buckets so Overture doesn't self-duplicate
    const k = `${Math.round(r.latitude * 100)}_${Math.round(r.longitude * 100)}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push({ nameNorm: normName(r.name), lat: r.latitude, lon: r.longitude });

    const formattedAddress =
      [r.street, r.city, [r.state, r.postal_code].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ') || null;

    deduped.push({
      id: r.id,
      name: String(r.name).trim(),
      address: formattedAddress,
      city: r.city || null,
      state: r.state || null,
      postal_code: r.postal_code || null,
      latitude: r.latitude,
      longitude: r.longitude,
    });
  }

  console.log(
    `Kept ${deduped.length} new unique Overture gyms (skipped ${skippedDupes} duplicates).`
  );

  const FILE_ROWS = 4000;
  const BATCH_ROWS = 500;
  let fileIndex = 1;

  for (let fStart = 0; fStart < deduped.length; fStart += FILE_ROWS) {
    const fileSlice = deduped.slice(fStart, fStart + FILE_ROWS);
    const lines = [
      `-- Overture Maps US Gyms Part ${fileIndex} (rows ${fStart + 1}..${
        fStart + fileSlice.length
      } of ${deduped.length})`,
      '',
    ];

    for (let bStart = 0; bStart < fileSlice.length; bStart += BATCH_ROWS) {
      const batch = fileSlice.slice(bStart, bStart + BATCH_ROWS);
      lines.push(
        'INSERT INTO public.gyms (id, name, address, city, state, postal_code, latitude, longitude, is_partnered, source) VALUES'
      );
      lines.push(
        batch
          .map(
            (g) =>
              `(${escapeSql(g.id)}, ${escapeSql(g.name)}, ${escapeSql(g.address)}, ${escapeSql(
                g.city
              )}, ${escapeSql(g.state)}, ${escapeSql(g.postal_code)}, ${g.latitude}, ${
                g.longitude
              }, TRUE, 'overture')`
          )
          .join(',\n')
      );
      lines.push(
        'ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = COALESCE(EXCLUDED.address, public.gyms.address), city = COALESCE(EXCLUDED.city, public.gyms.city), state = COALESCE(EXCLUDED.state, public.gyms.state), postal_code = COALESCE(EXCLUDED.postal_code, public.gyms.postal_code), latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;',
        ''
      );
    }

    const outPath = path.join(
      OUT_DIR,
      `overture_us_gyms_part_${String(fileIndex).padStart(2, '0')}.sql`
    );
    fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
    console.log(`Wrote ${path.basename(outPath)} (${fileSlice.length} rows)`);
    fileIndex++;
  }
}

main();
