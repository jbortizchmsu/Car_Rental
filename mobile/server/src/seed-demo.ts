import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting demo seeding...');

  // 1. Users
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@jdcarrental.com' },
    update: {
      passwordHash: adminPassword,
      fullName: 'JD Admin Manager',
      phoneNumber: '09123456789',
      emailVerified: true,
    },
    create: {
      email: 'admin@jdcarrental.com',
      passwordHash: adminPassword,
      fullName: 'JD Admin Manager',
      role: 'admin',
      phoneNumber: '09123456789',
      emailVerified: true,
    }
  });

  const customerPassword = await bcrypt.hash('Customer123!', 10);
  const customer = await prisma.user.upsert({
    where: { email: 'customer@jdcarrental.com' },
    update: {
      passwordHash: customerPassword,
      fullName: 'John Customer Doe',
      phoneNumber: '09987654321',
      address: '123 Sample St, Manila',
      emailVerified: true,
    },
    create: {
      email: 'customer@jdcarrental.com',
      passwordHash: customerPassword,
      fullName: 'John Customer Doe',
      role: 'customer',
      phoneNumber: '09987654321',
      address: '123 Sample St, Manila',
      emailVerified: true,
    }
  });

  console.log('✅ Users created');

  // 2. Vehicles
  const vehicles = [
    { brand: 'Toyota', model: 'Vios', category: 'Sedan', year: 2023, licensePlate: 'ABC 1234', dailyRate: 1500, status: 'AVAILABLE', description: 'Economical and reliable sedan.' },
    { brand: 'Mitsubishi', model: 'Xpander', category: 'MPV', year: 2022, licensePlate: 'XYZ 7890', dailyRate: 2500, status: 'RENTED', description: 'Spacious family car.' },
    { brand: 'Ford', model: 'Ranger', category: 'Pickup', year: 2023, licensePlate: 'FRD 555', dailyRate: 3500, status: 'AVAILABLE', description: 'Powerful pickup for all terrains.' },
    { brand: 'Honda', model: 'Civic', category: 'Sedan', year: 2023, licensePlate: 'HND 888', dailyRate: 2800, status: 'MAINTENANCE', description: 'Sporty and comfortable drive.' },
    { brand: 'Nissan', model: 'Terra', category: 'SUV', year: 2022, licensePlate: 'NSN 444', dailyRate: 4000, status: 'AVAILABLE', description: 'Premium SUV experience.' },
  ];

  for (const v of vehicles) {
    await prisma.vehicle.upsert({
      where: { licensePlate: v.licensePlate },
      update: { status: v.status },
      create: v
    });
  }

  const vios = await prisma.vehicle.findFirst({ where: { model: 'Vios' } });
  const xpander = await prisma.vehicle.findFirst({ where: { model: 'Xpander' } });
  const terra = await prisma.vehicle.findFirst({ where: { model: 'Terra' } });

  console.log('✅ Vehicles created');

  // 3. Bookings in different states
  
  // Pending Booking
  const pendingBooking = await prisma.booking.create({
    data: {
      customerId: customer.id,
      vehicleId: vios!.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000 * 3),
      totalAmount: Number(vios!.dailyRate) * 3,
      status: 'PENDING_REVIEW',
      pickupLocation: 'Main Office'
    }
  });

  // Approved Booking (awaiting payment)
  const approvedBooking = await prisma.booking.create({
    data: {
      customerId: customer.id,
      vehicleId: xpander!.id,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000 * 2),
      totalAmount: Number(xpander!.dailyRate) * 3,
      status: 'APPROVED_FOR_PAYMENT',
      pickupLocation: 'Airport'
    }
  });

  // Active Rental
  const activeBooking = await prisma.booking.create({
    data: {
      customerId: customer.id,
      vehicleId: xpander!.id,
      startDate: new Date(Date.now() - 86400000 * 2),
      endDate: new Date(Date.now() + 86400000),
      totalAmount: Number(xpander!.dailyRate) * 3,
      status: 'ACTIVE',
      pickupLocation: 'Main Office',
      releasedAt: new Date(Date.now() - 86400000 * 2),
      trackingSession: {
        create: { isActive: true }
      }
    }
  });

  // Completed Rental
  const completedBooking = await prisma.booking.create({
    data: {
      customerId: customer.id,
      vehicleId: terra!.id,
      startDate: new Date(Date.now() - 86400000 * 10),
      endDate: new Date(Date.now() - 86400000 * 7),
      totalAmount: Number(terra!.dailyRate) * 3,
      status: 'COMPLETED',
      pickupLocation: 'Main Office',
      releasedAt: new Date(Date.now() - 86400000 * 10),
      returnedAt: new Date(Date.now() - 86400000 * 7),
      completedAt: new Date(Date.now() - 86400000 * 7)
    }
  });

  console.log('✅ Bookings created');

  // 4. Payments
  await prisma.payment.create({
    data: {
      bookingId: activeBooking.id,
      amount: Number(activeBooking.totalAmount),
      paymentType: 'FULL_GCASH',
      status: 'VERIFIED',
      verifiedById: admin.id,
      verifiedAt: new Date(Date.now() - 86400000 * 2)
    }
  });

  await prisma.payment.create({
    data: {
      bookingId: completedBooking.id,
      amount: Number(completedBooking.totalAmount),
      paymentType: 'FULL_GCASH',
      status: 'VERIFIED',
      verifiedById: admin.id,
      verifiedAt: new Date(Date.now() - 86400000 * 10)
    }
  });

  console.log('✅ Payments created');

  // 5. Geofence Alert
  const session = await prisma.trackingSession.findFirst({ where: { bookingId: activeBooking.id } });
  await prisma.geofenceAlert.create({
    data: {
      bookingId: activeBooking.id,
      vehicleId: activeBooking.vehicleId,
      trackingSessionId: session!.id,
      message: 'Vehicle left the Manila area geofence.',
      alertType: 'OUT_OF_ZONE',
      severity: 'CRITICAL',
      latitude: 14.5995,
      longitude: 120.9842
    }
  });

  console.log('✅ Alerts created');

  // 6. Notifications
  await prisma.notification.create({
    data: {
      userId: customer.id,
      title: 'Welcome to JD Car Rental!',
      message: 'Your account is now active. Browse our fleet and start your journey.',
      isRead: true
    }
  });

  await prisma.notification.create({
    data: {
      userId: admin.id,
      title: 'New Booking Request',
      message: 'A new rental request has been submitted for Toyota Vios.',
      isRead: false
    }
  });

  console.log('✅ Notifications created');
  console.log('🏁 Demo seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
