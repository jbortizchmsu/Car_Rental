import { prisma } from './prisma';

export interface OilChangeStatus {
  status: 'HEALTHY' | 'DUE_SOON' | 'DUE_NOW';
  nextDueKm: number;
  remainingKm: number;
}

export const calculateOilChangeStatus = (vehicle: any): OilChangeStatus => {
  const nextDueKm = (Number(vehicle.lastOilChangeOdometerKm) || 0) + (Number(vehicle.oilChangeIntervalKm) || 5000);
  const currentOdometer = Number(vehicle.currentOdometerKm) || 0;
  const remainingKm = nextDueKm - currentOdometer;

  let status: 'HEALTHY' | 'DUE_SOON' | 'DUE_NOW' = 'HEALTHY';
  if (remainingKm <= 0) {
    status = 'DUE_NOW';
  } else if (remainingKm <= 500) {
    status = 'DUE_SOON';
  }

  return { status, nextDueKm, remainingKm };
};

export const checkVehicleOilChangeDue = async (vehicleId: string) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return;

  const { status, nextDueKm } = calculateOilChangeStatus(vehicle);
  
  if (status === 'DUE_NOW' || status === 'DUE_SOON') {
    await createOilChangeNotificationIfNeeded(vehicle, status, nextDueKm);
  }
};

export const createOilChangeNotificationIfNeeded = async (vehicle: any, status: string, nextDueKm: number) => {
  const title = status === 'DUE_NOW' ? 'Oil Change Due' : 'Oil Change Due Soon';
  const message = `${title} for ${vehicle.brand} ${vehicle.model} (${vehicle.licensePlate}). Current: ${vehicle.currentOdometerKm} km. Due at: ${nextDueKm} km.`;

  // Check for existing unread notification of same type for same vehicle
  const existing = await prisma.notification.findFirst({
    where: {
      user: { role: 'admin' },
      title,
      message: { contains: vehicle.licensePlate },
      isRead: false
    }
  });

  if (existing) return;

  // Find all admins
  const admins = await prisma.user.findMany({ where: { role: 'admin' } });
  
  for (const admin of admins) {
    await prisma.notification.create({
      data: {
        userId: admin.id,
        title,
        message,
        isRead: false
      }
    });
  }
};
