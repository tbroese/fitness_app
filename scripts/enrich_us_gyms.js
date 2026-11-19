/**
 * Enriches all rows in supabase/us_gyms/us_gyms_part_*.sql that are missing a city or street address
 * using:
 *   1. Already-enriched California rows from supabase/ca_gyms_seed.sql (instant cache)
 *   2. ArcGIS World Geocoder reverseGeocode for all remaining US rows missing city/address.
 *
 * Writes each part file immediately after enriching so progress is saved incrementally.
 *
 * Usage:
 *   node scripts/enrich_us_gyms.js
 */
const fs = require('fs');
const path = require('path');

const CA_SEED_PATH = path.resolve(__dirname, '../supabase/ca_gyms_seed.sql');
const US_DIR = path.resolve(__dirname, '../supabase/us_gyms');

function escapeSql(val) {
  if (val === null || val === undefined || val === '') return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

function parseSqlValues(content) {
  const rows = [];
  const tupleRegex = /^\('([^']*(?:''[^']*)*)',\s*'([^']*(?:''[^']*)*)',\s*(NULL|'[^']*(?:''[^']*)*'),\s*(NULL|'[^']*(?:''[^']*)*'),\s*(NULL|'[^']*(?:''[^']*)*'),\s*(NULL|'[^']*(?:''[^']*)*'),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(TRUE|FALSE),\s*'([^']*)'\)[,;]?$/gm;
  const unesc = (s) => (s === 'NULL' ? null : s.slice(1, -1).replace(/''/g, "'"));

  let match;
  while ((match = tupleRegex.exec(content)) !== null) {
    rows.push({
      id: match[1].replace(/''/g, "'"),
      name: match[2].replace(/''/g, "'"),
      address: unesc(match[3]),
      city: unesc(match[4]),
      state: unesc(match[5]),
      postal_code: unesc(match[6]),
      latitude: parseFloat(match[7]),
      longitude: parseFloat(match[8]),
      is_verified: match[9] === 'TRUE',
      source: match[10],
    });
  }
  return rows;
}

async function reverseGeocode(lat, lon) {
  const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=json&location=${lon},${lat}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address;
    if (!a) return null;

    const street = a.Address || '';
    const city = a.City || a.Subregion || '';
    const state = a.RegionAbbr || '';
    const zip = a.Postal || '';
    const formatted = [street, city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return {
      address: formatted || a.LongLabel || null,
      city: city || null,
      state: state || null,
      postal_code: zip || null,
    };
  } catch {
    return null;
  }
}

function writePartFile(filePath, partLabel, rows) {
  const lines = [
    `-- ${partLabel} (enriched, ${rows.length} rows)`,
    '',
  ];
  const BATCH_ROWS = 500;
  for (let i = 0; i < rows.length; i += BATCH_ROWS) {
    const batch = rows.slice(i, i + BATCH_ROWS);
    lines.push(
      'INSERT INTO public.gyms (id, name, address, city, state, postal_code, latitude, longitude, is_verified, source) VALUES'
    );
    const values = batch.map(
      (g) =>
        `(${escapeSql(g.id)}, ${escapeSql(g.name)}, ${escapeSql(g.address)}, ${escapeSql(
          g.city
        )}, ${escapeSql(g.state)}, ${escapeSql(g.postal_code)}, ${g.latitude}, ${
          g.longitude
        }, ${g.is_verified ? 'TRUE' : 'FALSE'}, ${escapeSql(g.source)})`
    );
    lines.push(values.join(',\n'));
    lines.push(
      'ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = COALESCE(EXCLUDED.address, public.gyms.address), city = COALESCE(EXCLUDED.city, public.gyms.city), state = COALESCE(EXCLUDED.state, public.gyms.state), postal_code = COALESCE(EXCLUDED.postal_code, public.gyms.postal_code), latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;',
      ''
    );
  }
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

async function main() {
  const caCache = new Map();
  if (fs.existsSync(CA_SEED_PATH)) {
    const caRows = parseSqlValues(fs.readFileSync(CA_SEED_PATH, 'utf8'));
    for (const r of caRows) {
      if (r.address && r.city) {
        caCache.set(r.id, r);
      }
    }
    console.log(`Loaded ${caCache.size} cached California addresses from ca_gyms_seed.sql.`);
  }

  const files = fs
    .readdirSync(US_DIR)
    .filter((f) => /^us_gyms_part_\d+\.sql$/.test(f))
    .sort();

  const CONCURRENCY = 30;
  let totalEnriched = 0;

  for (const file of files) {
    const filePath = path.join(US_DIR, file);
    const rows = parseSqlValues(fs.readFileSync(filePath, 'utf8'));
    const missing = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const cached = caCache.get(r.id);
      if (cached) {
        r.address = r.address || cached.address;
        r.city = r.city || cached.city;
        r.state = r.state || cached.state;
        r.postal_code = r.postal_code || cached.postal_code;
      }
      if (!r.city || !r.address) {
        missing.push(i);
      }
    }

    console.log(`[${file}] ${rows.length} rows, ${missing.length} needing reverse-geocode...`);
    let done = 0;
    let fileEnriched = 0;

    for (let i = 0; i < missing.length; i += CONCURRENCY) {
      const batch = missing.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (idx) => {
          const r = rows[idx];
          const geo = await reverseGeocode(r.latitude, r.longitude);
          if (geo && geo.address) {
            r.address = geo.address;
            r.city = r.city || geo.city;
            r.state = r.state || geo.state;
            r.postal_code = r.postal_code || geo.postal_code;
            fileEnriched++;
            totalEnriched++;
          }
          done++;
        })
      );
      if (done % 300 === 0 || i + CONCURRENCY >= missing.length) {
        console.log(`  [${file}] ${done}/${missing.length} (enriched ${fileEnriched})`);
      }
    }

    writePartFile(filePath, file.replace('.sql', ''), rows);
    console.log(`  Saved ${file}`);
  }

  console.log(`\nFinished! Total newly enriched US gym rows: ${totalEnriched}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
