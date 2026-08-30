import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function exportData() {
  console.log('Starting data export from SQLite dev.db...');

  try {
    const users = await prisma.user.findMany();
    const vehicles = await prisma.vehicle.findMany();
    const bookings = await prisma.booking.findMany();
    const bookingDocuments = await prisma.bookingDocument.findMany();
    const payments = await prisma.payment.findMany();
    const paymentProofs = await prisma.paymentProof.findMany();
    const trackingSessions = await prisma.trackingSession.findMany();
    const vehicleLocations = await prisma.vehicleLocation.findMany();
    const geofenceZones = await prisma.geofenceZone.findMany();
    const geofenceAlerts = await prisma.geofenceAlert.findMany();
    const maintenanceLogs = await prisma.maintenanceLog.findMany();
    const damageReports = await prisma.damageReport.findMany();
    const notifications = await prisma.notification.findMany();
    const pricingRules = await prisma.pricingRule.findMany();
    const systemSettings = await prisma.systemSettings.findMany();

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      counts: {
        users: users.length,
        vehicles: vehicles.length,
        bookings: bookings.length,
        bookingDocuments: bookingDocuments.length,
        payments: payments.length,
        paymentProofs: paymentProofs.length,
        trackingSessions: trackingSessions.length,
        vehicleLocations: vehicleLocations.length,
        geofenceZones: geofenceZones.length,
        geofenceAlerts: geofenceAlerts.length,
        maintenanceLogs: maintenanceLogs.length,
        damageReports: damageReports.length,
        notifications: notifications.length,
        pricingRules: pricingRules.length,
        systemSettings: systemSettings.length,
      },
      data: {
        users,
        vehicles,
        bookings,
        bookingDocuments,
        payments,
        paymentProofs,
        trackingSessions,
        vehicleLocations,
        geofenceZones,
        geofenceAlerts,
        maintenanceLogs,
        damageReports,
        notifications,
        pricingRules,
        systemSettings,
      },
    };

    const outputPath = path.join(__dirname, '..', 'data-export.json');
    fs.writeFileSync(outputPath, JSON.stringify(exportPayload, null, 2), 'utf-8');

    console.log('\n========================================');
    console.log('DATA EXPORT SUMMARY');
    console.log('========================================');
    console.table(exportPayload.counts);
    console.log(`\nSuccessfully exported data to: ${outputPath}`);
  } catch (error) {
    console.error('Error during data export:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

exportData();
