// Read-only check: run this AFTER the import script, against the same database, to
// independently confirm the expected GeofenceZone template rows actually exist —
// never assume the import worked just because it exited without error.
//
// Run with: npx ts-node scripts/verify-destination-geofences.ts

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const dataPath = path.join(__dirname, 'data', 'destination-geofences.json');
  const expected: Array<{ destinationName: string }> = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  const rows = await prisma.geofenceZone.findMany({
    where: { destinationName: { not: null } },
    select: { destinationName: true, vehicleId: true, bookingId: true, isActive: true, polygonCoordinates: true },
  });

  console.log(`Found ${rows.length} template zone(s) with a destinationName set (expected ${expected.length}).`);

  const foundNames = new Set(rows.map(r => r.destinationName));
  const missing = expected.filter(e => !foundNames.has(e.destinationName));
  if (missing.length > 0) {
    console.log(`\nMISSING (${missing.length}):`);
    missing.forEach(m => console.log(`  - ${m.destinationName}`));
  } else {
    console.log('\nAll expected destinations are present.');
  }

  const badRows = rows.filter(r => r.vehicleId !== null || r.bookingId !== null);
  if (badRows.length > 0) {
    console.log(`\nWARNING — ${badRows.length} row(s) have destinationName set but ALSO a vehicleId/bookingId (should never happen for a template row):`);
    badRows.forEach(r => console.log(`  - ${r.destinationName}`));
  }

  const badPolygons = rows.filter(r => {
    try {
      const p = JSON.parse(r.polygonCoordinates);
      return !Array.isArray(p) || p.length < 3;
    } catch {
      return true;
    }
  });
  if (badPolygons.length > 0) {
    console.log(`\nWARNING — ${badPolygons.length} row(s) have invalid/degenerate polygonCoordinates:`);
    badPolygons.forEach(r => console.log(`  - ${r.destinationName}`));
  }

  const inactive = rows.filter(r => !r.isActive);
  if (inactive.length > 0) {
    console.log(`\nNOTE — ${inactive.length} row(s) are isActive: false (won't be used by the release-time lookup):`);
    inactive.forEach(r => console.log(`  - ${r.destinationName}`));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
