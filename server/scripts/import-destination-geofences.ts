// One-time import: creates one permanent, reusable GeofenceZone "template" row per
// preset destination, using official PSA/NAMRIA municipal boundary polygons (see the
// data file below for provenance). These template zones have destinationName set and
// vehicleId/bookingId left null — bookings.ts clones one of these at release time
// instead of computing a shop-centered circle, when a match exists for the booking's
// destinationName.
//
// Safe to re-run: uses upsert on the unique destinationName, so running this again
// (e.g. after adding more destinations to the data file) only adds/updates rows, it
// never duplicates or removes anything.
//
// Run with: npx ts-node scripts/import-destination-geofences.ts

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface DestinationGeofence {
  destinationName: string;
  province: string;
  datasetName: string;
  geomType: string;
  pointCount: number;
  polygon: Array<{ lat: number; lng: number }>;
}

async function main() {
  const dataPath = path.join(__dirname, 'data', 'destination-geofences.json');
  const destinations: DestinationGeofence[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  console.log(`📍 Importing ${destinations.length} destination geofence templates...`);

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const dest of destinations) {
    if (!Array.isArray(dest.polygon) || dest.polygon.length < 3) {
      console.error(`  ✗ Skipping "${dest.destinationName}" — polygon has fewer than 3 points.`);
      failed++;
      continue;
    }

    try {
      const existing = await prisma.geofenceZone.findUnique({
        where: { destinationName: dest.destinationName },
      });

      await prisma.geofenceZone.upsert({
        where: { destinationName: dest.destinationName },
        update: {
          polygonCoordinates: JSON.stringify(dest.polygon),
          name: `${dest.destinationName} (Official Boundary)`,
        },
        create: {
          destinationName: dest.destinationName,
          name: `${dest.destinationName} (Official Boundary)`,
          polygonCoordinates: JSON.stringify(dest.polygon),
          vehicleId: null,
          bookingId: null,
          isActive: true,
        },
      });

      if (existing) {
        updated++;
        console.log(`  ↻ Updated "${dest.destinationName}" (${dest.pointCount} points)`);
      } else {
        created++;
        console.log(`  ✓ Created "${dest.destinationName}" (${dest.pointCount} points)`);
      }
    } catch (err) {
      failed++;
      console.error(`  ✗ Failed "${dest.destinationName}":`, err);
    }
  }

  console.log('');
  console.log(`Done. Created: ${created}, Updated: ${updated}, Failed: ${failed}, Total in data file: ${destinations.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
