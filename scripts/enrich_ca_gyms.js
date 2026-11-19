/**
 * Enriches rows in supabase/ca_gyms_seed.sql that are missing a city or street address
 * using ArcGIS reverse geocoding (free, no API key required for individual reverse lookups).
 *
 * Usage:
 *   node scripts/enrich_ca_gyms.js
 */
const fs = require('fs');
const path = require('path');

const SEED_PATH = path.resolve(__dirname, '../supabase/ca_gyms_seed.sql');

function escapeSql(val) {
  if (val === null || val === undefined || val === '') return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

// Parse SQL tuple: ('id', 'name', 'addr'|NULL, 'city'|NULL, 'state'|NULL, 'zip'|NULL, lat, lon, TRUE, 'osm')
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
      state: unesc(match[5]) || 'CA',
      postal_code: unesc(match[6]),
      latitude: parseFloat(match[7]),
      longitude: parseFloat(match[8]),
      is_partnered: match[9] === 'TRUE',
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
    const state = a.RegionAbbr || 'CA';
    const zip = a.Postal || '';
    const formatted = [street, city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return {
      address: formatted || a.LongLabel || null,
      city: city || null,
      state: state || 'CA',
      postal_code: zip || null,
    };
  } catch {
    return null;
  }
}

async function main() {
  const raw = fs.readFileSync(SEED_PATH, 'utf8');
  const rows = parseSqlValues(raw);
  console.log(`Parsed ${rows.length} rows from ca_gyms_seed.sql.`);

  const missingIndices = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.city || !r.address || r.address === 'CA') {
      missingIndices.push(i);
    }
  }
  console.log(`Rows missing street/city address: ${missingIndices.length}`);

  const CONCURRENCY = 20;
  let completed = 0;
  let enriched = 0;

  for (let i = 0; i < missingIndices.length; i += CONCURRENCY) {
    const batch = missingIndices.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (idx) => {
        const r = rows[idx];
        const geo = await reverseGeocode(r.latitude, r.longitude);
        if (geo && geo.address) {
          r.address = geo.address;
          r.city = r.city || geo.city;
          r.state = r.state || geo.state;
          r.postal_code = r.postal_code || geo.postal_code;
          enriched++;
        }
        completed++;
      })
    );
    if (completed % 200 === 0 || i + CONCURRENCY >= missingIndices.length) {
      console.log(`Progress: ${completed}/${missingIndices.length} (enriched ${enriched})`);
    }
  }

  // Write updated SQL
  const lines = [
    '-- Auto-generated & reverse-geocoded California gyms (OpenStreetMap + ArcGIS)',
    `-- Total gyms: ${rows.length}`,
    '',
  ];

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    lines.push(
      'INSERT INTO public.gyms (id, name, address, city, state, postal_code, latitude, longitude, is_partnered, source) VALUES'
    );
    const values = chunk.map(
      (g) =>
        `(${escapeSql(g.id)}, ${escapeSql(g.name)}, ${escapeSql(g.address)}, ${escapeSql(
          g.city
        )}, ${escapeSql(g.state)}, ${escapeSql(g.postal_code)}, ${g.latitude}, ${
          g.longitude
        }, ${g.is_partnered ? 'TRUE' : 'FALSE'}, ${escapeSql(g.source)})`
    );
    lines.push(values.join(',\n'));
    lines.push(
      'ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address, city = EXCLUDED.city, state = EXCLUDED.state, postal_code = EXCLUDED.postal_code, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;',
      ''
    );
  }

  fs.writeFileSync(SEED_PATH, lines.join('\n'), 'utf8');
  console.log(`Updated ${SEED_PATH} (${(fs.statSync(SEED_PATH).size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
