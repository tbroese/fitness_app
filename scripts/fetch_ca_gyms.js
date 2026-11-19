/**
 * Fetches fitness centers & gyms in California from OpenStreetMap Overpass API
 * and writes:
 *   1. supabase/ca_gyms_seed.sql (ready to run in Supabase SQL Editor)
 *   2. Optionally upserts directly into Supabase if SUPABASE_SERVICE_ROLE_KEY is set.
 *
 * Usage:
 *   node scripts/fetch_ca_gyms.js
 */
const fs = require('fs');
const path = require('path');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const QUERY = `
[out:json][timeout:90];
area["ISO3166-2"="US-CA"][admin_level=4]->.ca;
(
  node["leisure"="fitness_centre"](area.ca);
  way["leisure"="fitness_centre"](area.ca);
  node["amenity"="gym"](area.ca);
  way["amenity"="gym"](area.ca);
);
out center tags;
`;

function escapeSql(val) {
  if (val === null || val === undefined || val === '') return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

function buildAddress(tags) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const city = tags['addr:city'] || '';
  const state = tags['addr:state'] || 'CA';
  const zip = tags['addr:postcode'] || '';
  const parts = [street, city, [state, zip].filter(Boolean).join(' ')].filter(Boolean);
  return parts.join(', ');
}

async function main() {
  console.log('Querying OpenStreetMap Overpass API for California gyms...');
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'InertiaFitnessApp/1.0 (tannerbroese@gmail.com)',
    },
    body: `data=${encodeURIComponent(QUERY)}`,
  });

  if (!res.ok) {
    throw new Error(`Overpass API failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const elements = json.elements || [];
  console.log(`Received ${elements.length} raw elements from Overpass.`);

  const seen = new Set();
  const gyms = [];

  for (const el of elements) {
    const tags = el.tags || {};
    const name = (tags.name || '').trim();
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!name || typeof lat !== 'number' || typeof lon !== 'number') continue;

    const id = `osm_${el.type}_${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);

    gyms.push({
      id,
      name,
      address: buildAddress(tags) || null,
      city: tags['addr:city'] || null,
      state: tags['addr:state'] || 'CA',
      postal_code: tags['addr:postcode'] || null,
      latitude: lat,
      longitude: lon,
    });
  }

  console.log(`Filtered to ${gyms.length} named California gyms with coordinates.`);

  const outPath = path.resolve(__dirname, '../supabase/ca_gyms_seed.sql');
  const lines = [
    '-- Auto-generated California gyms from OpenStreetMap (Overpass API)',
    `-- Total gyms: ${gyms.length}`,
    '',
  ];

  // Include curated Axioms Fitness first
  lines.push(
    `INSERT INTO public.gyms (id, name, address, city, state, postal_code, latitude, longitude, is_partnered, source) VALUES`,
    `('partner_axioms_fitness_anaheim', 'Axioms Fitness', '5628 E La Palma Ave, Anaheim, CA 92807', 'Anaheim', 'CA', '92807', 33.85877397760535, -117.79206834908676, TRUE, 'curated')`,
    `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;`,
    ''
  );

  const CHUNK = 500;
  for (let i = 0; i < gyms.length; i += CHUNK) {
    const batch = gyms.slice(i, i + CHUNK);
    lines.push(
      'INSERT INTO public.gyms (id, name, address, city, state, postal_code, latitude, longitude, is_partnered, source) VALUES'
    );
    const values = batch.map(
      (g) =>
        `(${escapeSql(g.id)}, ${escapeSql(g.name)}, ${escapeSql(g.address)}, ${escapeSql(
          g.city
        )}, ${escapeSql(g.state)}, ${escapeSql(g.postal_code)}, ${g.latitude}, ${
          g.longitude
        }, TRUE, 'osm')`
    );
    lines.push(values.join(',\n'));
    lines.push(
      'ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address, city = EXCLUDED.city, state = EXCLUDED.state, postal_code = EXCLUDED.postal_code, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;',
      ''
    );
  }

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`Wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
