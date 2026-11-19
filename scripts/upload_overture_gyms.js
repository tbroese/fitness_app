/**
 * Uploads all Overture Maps US gyms from `supabase/overture_us_gyms/overture_us_gyms_part_*.sql`
 * directly to Supabase via the REST API using your service_role key (zero extra dependencies).
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"; node scripts/upload_overture_gyms.js
 */
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = (
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://nzoarfnrnbnwfduftcvv.supabase.co'
)
  .trim()
  .replace(/\/$/, '');
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const IN_DIR = path.resolve(__dirname, '../supabase/overture_us_gyms');

if (!SERVICE_KEY) {
  console.error(
    'Missing SUPABASE_SERVICE_ROLE_KEY.\nRun in PowerShell:\n  $env:SUPABASE_SERVICE_ROLE_KEY="YOUR_KEY"; node scripts/upload_overture_gyms.js'
  );
  process.exit(1);
}

function parseSqlValues(content) {
  const rows = [];
  const tupleRegex = /^\('([^']*(?:''[^']*)*)',\s*'([^']*(?:''[^']*)*)',\s*(NULL|'[^']*(?:''[^']*)*'),\s*(NULL|'[^']*(?:''[^']*)*'),\s*(NULL|'[^']*(?:''[^']*)*'),\s*(NULL|'[^']*(?:''[^']*)*'),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(TRUE|FALSE),\s*'([^']*)'\)[,;]?$/gm;
  const unesc = (s) => (s === 'NULL' ? null : s.slice(1, -1).replace(/''/g, "'"));

  let m;
  while ((m = tupleRegex.exec(content)) !== null) {
    rows.push({
      id: m[1].replace(/''/g, "'"),
      name: m[2].replace(/''/g, "'"),
      address: unesc(m[3]),
      city: unesc(m[4]),
      state: unesc(m[5]),
      postal_code: unesc(m[6]),
      latitude: parseFloat(m[7]),
      longitude: parseFloat(m[8]),
      is_verified: m[9] === 'TRUE',
      source: m[10],
    });
  }
  return rows;
}

async function upsertBatch(batch) {
  const headers = {
    apikey: SERVICE_KEY,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  };
  if (SERVICE_KEY.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${SERVICE_KEY}`;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/gyms?on_conflict=id`, {
    method: 'POST',
    headers,
    body: JSON.stringify(batch),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
}

async function main() {
  const files = fs
    .readdirSync(IN_DIR)
    .filter((f) => /^overture_us_gyms_part_\d+\.sql$/.test(f))
    .sort();

  let totalUploaded = 0;
  for (const file of files) {
    const rows = parseSqlValues(fs.readFileSync(path.join(IN_DIR, file), 'utf8'));
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      await upsertBatch(rows.slice(i, i + BATCH));
      totalUploaded += Math.min(BATCH, rows.length - i);
    }
    console.log(`[${file}] Uploaded ${rows.length} rows (total: ${totalUploaded})`);
  }

  console.log(`\nDone! Uploaded ${totalUploaded} Overture US gyms to Supabase.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
