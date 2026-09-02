import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function parseDates(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj)) {
    return new Date(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(parseDates);
  }
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      res[key] = parseDates(obj[key]);
    }
    return res;
  }
  return obj;
}

async function importData() {
  console.log('Starting data import to Supabase PostgreSQL...');

  const dataPath = path.join(__dirname, '..', 'data-export.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`Export file not found at: ${dataPath}`);
    process.exit(1);
  }

  const rawJson = fs.readFileSync(dataPath, 'utf-8');
  const exportPayload = parseDates(JSON.parse(rawJson));
  const { counts: expectedCounts, data } = exportPayload;

  const importedCounts: Record<string, number> = {};

  try {
    // 1. Users
    console.log(`Importing ${data.users.length} Users...`);
    for (const user of data.users) {
      await prisma.user.create({ data: user });
    }
    importedCounts.users = data.users.length;

    // 2. Vehicles
    console.log(`Importing ${data.vehicles.length} Vehicles...`);
    for (const vehicle of data.vehicles) {
      await prisma.vehicle.create({ data: vehicle });
    }
    importedCounts.vehicles = data.vehicles.length;

    // 3. Pricing Rules
    console.log(`Importing ${data.pricingRules.length} Pricing Rules...`);
    for (const rule of data.pricingRules) {
      await prisma.pricingRule.create({ data: rule });
    }
    importedCounts.pricingRules = data.pricingRules.length;

    // 4. Bookings
    console.log(`Importing ${data.bookings.length} Bookings...`);
    for (const booking of data.bookings) {
      await prisma.booking.create({ data: booking });
    }
    importedCounts.bookings = data.bookings.length;

    // 5. Booking Documents
    console.log(`Importing ${data.bookingDocuments.length} Booking Documents...`);
    for (const doc of data.bookingDocuments) {
      await prisma.bookingDocument.create({ data: doc });
    }
    importedCounts.bookingDocuments = data.bookingDocuments.length;

    // 6. Payments
    console.log(`Importing ${data.payments.length} Payments...`);
    for (const payment of data.payments) {
      await prisma.payment.create({ data: payment });
    }
    importedCounts.payments = data.payments.length;

    // 7. Payment Proofs
    console.log(`Importing ${data.paymentProofs.length} Payment Proofs...`);
    for (const proof of data.paymentProofs) {
      await prisma.paymentProof.create({ data: proof });
    }
    importedCounts.paymentProofs = data.paymentProofs.length;

    // 8. Tracking Sessions
    console.log(`Importing ${data.trackingSessions.length} Tracking Sessions...`);
    for (const session of data.trackingSessions) {
      await prisma.trackingSession.create({ data: session });
    }
    importedCounts.trackingSessions = data.trackingSessions.length;

    // 9. Vehicle Locations
    console.log(`Importing ${data.vehicleLocations.length} Vehicle Locations...`);
    for (const loc of data.vehicleLocations) {
      await prisma.vehicleLocation.create({ data: loc });
    }
    importedCounts.vehicleLocations = data.vehicleLocations.length;

    // 10. Geofence Zones
    console.log(`Importing ${data.geofenceZones.length} Geofence Zones...`);
    for (const zone of data.geofenceZones) {
      await prisma.geofenceZone.create({ data: zone });
    }
    importedCounts.geofenceZones = data.geofenceZones.length;

    // 11. Geofence Alerts
    console.log(`Importing ${data.geofenceAlerts.length} Geofence Alerts...`);
    for (const alert of data.geofenceAlerts) {
      await prisma.geofenceAlert.create({ data: alert });
    }
    importedCounts.geofenceAlerts = data.geofenceAlerts.length;

    // 12. Maintenance Logs
    console.log(`Importing ${data.maintenanceLogs.length} Maintenance Logs...`);
    for (const log of data.maintenanceLogs) {
      await prisma.maintenanceLog.create({ data: log });
    }
    importedCounts.maintenanceLogs = data.maintenanceLogs.length;

    // 13. Damage Reports
    console.log(`Importing ${data.damageReports.length} Damage Reports...`);
    for (const report of data.damageReports) {
      await prisma.damageReport.create({ data: report });
    }
    importedCounts.damageReports = data.damageReports.length;

    // 14. Notifications
    console.log(`Importing ${data.notifications.length} Notifications...`);
    for (const notif of data.notifications) {
      await prisma.notification.create({ data: notif });
    }
    importedCounts.notifications = data.notifications.length;

    // 15. System Settings
    console.log(`Importing ${data.systemSettings.length} System Settings...`);
    for (const setting of data.systemSettings) {
      await prisma.systemSettings.create({ data: setting });
    }
    importedCounts.systemSettings = data.systemSettings.length;

    console.log('\n========================================');
    console.log('DATA IMPORT VERIFICATION SUMMARY');
    console.log('========================================');
    const summaryTable: Record<string, { Expected: number; Imported: number; Status: string }> = {};
    for (const key of Object.keys(expectedCounts)) {
      const exp = expectedCounts[key];
      const imp = importedCounts[key] || 0;
      summaryTable[key] = {
        Expected: exp,
        Imported: imp,
        Status: exp === imp ? 'MATCH ✓' : 'MISMATCH ✗',
      };
    }
    console.table(summaryTable);
    console.log('\nSuccessfully imported all records to Supabase PostgreSQL!');
  } catch (error) {
    console.error('Error during data import:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

importData();
