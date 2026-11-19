/**
 * Fetches fitness centers & gyms across all 50 US states + DC from OpenStreetMap Overpass API,
 * deduplicates by OSM element ID, and writes chunked SQL seed files into `supabase/us_gyms/`
 * (kept ~3,000 rows per file so Supabase SQL Editor executes them cleanly without timing out).
 *
 * Usage:
 *   node scripts/fetch_us_gyms.js
 */
const fs = require('fs');
const path = require('path');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OUT_DIR = path.resolve(__dirname, '../supabase/us_gyms');

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
];

function escapeSql(val) {
  if (val === null || val === undefined || val === '') return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

function buildAddress(tags, defaultState) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const city = tags['addr:city'] || '';
  if (!street && !city) return null;
  const state = tags['addr:state'] || defaultState;
  const zip = tags['addr:postcode'] || '';
  const parts = [street, city, [state, zip].filter(Boolean).join(' ')].filter(Boolean);
  return parts.join(', ');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchStateGyms(stateCode, attempt = 1) {
  const query = `
[out:json][timeout:90];
area["ISO3166-2"="US-${stateCode}"][admin_level=4]->.st;
(
  nwr["leisure"="fitness_centre"](area.st);
  nwr["amenity"="gym"](area.st);
  nwr["sport"~"fitness|weightlifting|powerlifting|bodybuilding|crossfit",i](area.st);
  nwr["leisure"="sports_centre"]["name"~"gym|fitness|barbell|powerlifting|crossfit|iron",i](area.st);
);
out center tags;
`;

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'InertiaFitnessApp/1.0 (tannerbroese@gmail.com)',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if ((res.status === 429 || res.status === 504 || res.status === 502) && attempt <= 3) {
    const waitMs = attempt * 4000;
    console.log(`  [${stateCode}] HTTP ${res.status}, retrying in ${waitMs / 1000}s...`);
    await sleep(waitMs);
    return fetchStateGyms(stateCode, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`[${stateCode}] Overpass API failed: ${res.status}`);
  }

  const json = await res.json();
  return json.elements || [];
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const seen = new Set();
  const allGyms = [
    {
      id: 'partner_axioms_fitness_anaheim',
      name: 'Axioms Fitness',
      address: '5628 E La Palma Ave, Anaheim, CA 92807',
      city: 'Anaheim',
      state: 'CA',
      postal_code: '92807',
      latitude: 33.85877397760535,
      longitude: -117.79206834908676,
      source: 'curated',
    },
  ];
  seen.add('partner_axioms_fitness_anaheim');

  for (let i = 0; i < US_STATES.length; i++) {
    const st = US_STATES[i];
    try {
      const elements = await fetchStateGyms(st);
      let added = 0;
      for (const el of elements) {
        const tags = el.tags || {};
        const name = (tags.name || '').trim();
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (!name || typeof lat !== 'number' || typeof lon !== 'number') continue;

        const id = `osm_${el.type}_${el.id}`;
        if (seen.has(id)) continue;
        seen.add(id);

        allGyms.push({
          id,
          name,
          address: buildAddress(tags, st) || null,
          city: tags['addr:city'] || null,
          state: tags['addr:state'] || st,
          postal_code: tags['addr:postcode'] || null,
          latitude: lat,
          longitude: lon,
          source: 'osm',
        });
        added++;
      }
      console.log(`[${i + 1}/${US_STATES.length}] US-${st}: +${added} gyms (total: ${allGyms.length})`);
    } catch (err) {
      console.warn(`Skipped US-${st}: ${err.message}`);
    }
    await sleep(1200);
  }

  // Write chunked SQL files (3,000 rows per file, 500 rows per INSERT batch)
  const FILE_ROWS = 3000;
  const BATCH_ROWS = 500;
  let fileIndex = 1;

  for (let fStart = 0; fStart < allGyms.length; fStart += FILE_ROWS) {
    const fileSlice = allGyms.slice(fStart, fStart + FILE_ROWS);
    const lines = [
      `-- US Gyms Seed Part ${fileIndex} (rows ${fStart + 1}..${fStart + fileSlice.length} of ${allGyms.length})`,
      '',
    ];

    for (let bStart = 0; bStart < fileSlice.length; bStart += BATCH_ROWS) {
      const batch = fileSlice.slice(bStart, bStart + BATCH_ROWS);
      lines.push(
        'INSERT INTO public.gyms (id, name, address, city, state, postal_code, latitude, longitude, is_partnered, source) VALUES'
      );
      const values = batch.map(
        (g) =>
          `(${escapeSql(g.id)}, ${escapeSql(g.name)}, ${escapeSql(g.address)}, ${escapeSql(
            g.city
          )}, ${escapeSql(g.state)}, ${escapeSql(g.postal_code)}, ${g.latitude}, ${
            g.longitude
          }, TRUE, ${escapeSql(g.source)})`
      );
      lines.push(values.join(',\n'));
      lines.push(
        'ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = COALESCE(EXCLUDED.address, public.gyms.address), city = COALESCE(EXCLUDED.city, public.gyms.city), state = COALESCE(EXCLUDED.state, public.gyms.state), postal_code = COALESCE(EXCLUDED.postal_code, public.gyms.postal_code), latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;',
        ''
      );
    }

    const filePath = path.join(OUT_DIR, `us_gyms_part_${String(fileIndex).padStart(2, '0')}.sql`);
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`Wrote ${path.basename(filePath)} (${fileSlice.length} rows)`);
    fileIndex++;
  }

  console.log(`\nFinished! Total US gyms exported: ${allGyms.length} across ${fileIndex - 1} SQL files.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
