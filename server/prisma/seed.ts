import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Create Admin
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@jdcarrental.com' },
    update: {},
    create: {
      email: 'admin@jdcarrental.com',
      password: adminPassword,
      fullName: 'Sample Admin',
      role: 'admin'
    }
  });
  console.log('✅ Admin user seeded');

  // 2. Create Customer
  const customerPassword = await bcrypt.hash('Customer123!', 10);
  const customer = await prisma.user.upsert({
    where: { email: 'customer@jdcarrental.com' },
    update: {},
    create: {
      email: 'customer@jdcarrental.com',
      password: customerPassword,
      fullName: 'Sample Customer',
      role: 'customer'
    }
  });
  console.log('✅ Customer user seeded');

  // 3. Create Vehicles
  const vehicles = [
    {
      brand: 'Toyota',
      model: 'Fortuner',
      category: 'SUV',
      licensePlate: 'ABC-1234',
      dailyRate: 3500,
      status: 'AVAILABLE',
      imageUrl: 'https://images.unsplash.com/photo-1594568284297-7c64464062b1?auto=format&fit=crop&q=80&w=800'
    },
    {
      brand: 'Mitsubishi',
      model: 'Montero Sport',
      category: 'SUV',
      licensePlate: 'XYZ-5678',
      dailyRate: 3300,
      status: 'RESERVED',
      imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800'
    },
    {
      brand: 'Honda',
      model: 'Civic RS',
      category: 'Sedan',
      licensePlate: 'HND-0011',
      dailyRate: 2800,
      status: 'RENTED',
      imageUrl: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&q=80&w=800'
    },
    {
      brand: 'Hyundai',
      model: 'Staria',
      category: 'Van',
      licensePlate: 'VAN-2024',
      dailyRate: 4500,
      status: 'UNDER_MAINTENANCE',
      imageUrl: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=800'
    }
  ];

  for (const v of vehicles) {
    await prisma.vehicle.upsert({
      where: { licensePlate: v.licensePlate },
      update: {},
      create: v
    });
  }
  console.log('✅ Sample vehicles seeded');

  console.log('✨ Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
