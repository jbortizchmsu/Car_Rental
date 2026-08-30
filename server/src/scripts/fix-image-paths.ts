import { prisma } from '../lib/prisma';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`=== VEHICLE IMAGE PATH MIGRATION SCRIPT (${isDryRun ? 'DRY-RUN MODE' : 'APPLY MODE'}) ===\n`);

  const vehicles = await prisma.vehicle.findMany({
    where: {
      imageUrl: {
        startsWith: '.'
      }
    }
  });

  console.log(`Found ${vehicles.length} vehicle(s) with leading dot in imageUrl.`);

  if (vehicles.length === 0) {
    console.log('No vehicle image records need updating.');
    await prisma.$disconnect();
    return;
  }

  for (const vehicle of vehicles) {
    const oldPath = vehicle.imageUrl || '';
    // Strip leading dots and slashes to convert e.g. .uploads/... or ./uploads/... -> uploads/...
    const newPath = oldPath.replace(/^\.?\/?/, '');
    console.log(`[Vehicle ${vehicle.id}] ${vehicle.brand} ${vehicle.model}:`);
    console.log(`  OLD: "${oldPath}"`);
    console.log(`  NEW: "${newPath}"`);

    if (!isDryRun) {
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { imageUrl: newPath }
      });
      console.log(`  -> RECORD UPDATED IN DATABASE`);
    } else {
      console.log(`  -> DRY-RUN: NO DATABASE CHANGE MADE`);
    }
    console.log('');
  }

  console.log(`=== MIGRATION SCRIPT COMPLETED (${isDryRun ? 'DRY-RUN' : 'APPLIED'}) ===`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
