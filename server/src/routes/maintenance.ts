import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorizeAdmin, AuthRequest } from '../middleware/auth';
import { calculateOilChangeStatus } from '../lib/maintenance-alerts';

const router = Router();

// GET /api/admin/maintenance/summary
router.get('/summary', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const criticalAttentionCount = await prisma.damageReport.count({
      where: { severity: 'CRITICAL', status: { not: 'RESOLVED' } }
    });

    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    const upcomingServiceCount = await prisma.maintenanceLog.count({
      where: { 
        nextServiceDate: { 
          gte: now, 
          lte: nextWeek 
        },
        status: { not: 'COMPLETED' }
      }
    });

    const healthyFleetCount = await prisma.vehicle.count({
      where: { 
        status: 'AVAILABLE' 
      }
    });

    const underMaintenanceCount = await prisma.vehicle.count({
      where: { status: 'UNDER_MAINTENANCE' }
    });

    const recentDamageReportsCount = await prisma.damageReport.count({
      where: { status: 'PENDING' }
    });

    const damageEstimates = await prisma.damageReport.aggregate({
      where: { status: { not: 'RESOLVED' } },
      _sum: { estimatedCost: true }
    });

    const maintenanceEstimates = await prisma.maintenanceLog.aggregate({
      where: { status: { not: 'COMPLETED' } },
      _sum: { cost: true }
    });

    const totalEstimatedRepairCost = 
      (Number(damageEstimates._sum.estimatedCost) || 0) + 
      (Number(maintenanceEstimates._sum.cost) || 0);

    const vehicles = await prisma.vehicle.findMany({
      where: { status: { not: 'RETIRED' } }
    });

    let oilChangeDueCount = 0;
    let oilChangeSoonCount = 0;

    for (const v of vehicles) {
      const { status } = calculateOilChangeStatus(v);
      if (status === 'DUE_NOW') oilChangeDueCount++;
      else if (status === 'DUE_SOON') oilChangeSoonCount++;
    }

    res.json({
      criticalAttentionCount,
      upcomingServiceCount,
      healthyFleetCount,
      underMaintenanceCount,
      recentDamageReportsCount,
      totalEstimatedRepairCost,
      oilChangeDueCount,
      oilChangeSoonCount
    });
  } catch (error) {
    console.error('Maintenance summary error:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance summary' });
  }
});

// GET /api/admin/maintenance/vehicles
router.get('/vehicles', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { brand: 'asc' },
      include: {
        maintenanceLogs: {
          orderBy: { serviceDate: 'desc' },
          take: 1
        },
        bookings: {
          where: { damageReports: { some: {} } },
          include: {
            damageReports: {
              orderBy: { reportedAt: 'desc' },
              take: 1
            }
          },
          orderBy: { returnedAt: 'desc' },
          take: 1
        }
      }
    });

    const formattedVehicles = vehicles.map(v => {
      const latestLog = v.maintenanceLogs[0] || null;
      const latestBookingWithDamage = v.bookings[0] || null;
      const latestDamage = latestBookingWithDamage?.damageReports[0] || null;
      
      const oilStatus = calculateOilChangeStatus(v);

      return {
        id: v.id,
        brand: v.brand,
        model: v.model,
        year: v.year,
        plateNumber: v.licensePlate,
        status: v.status,
        dailyRate: v.dailyRate,
        currentOdometerKm: v.currentOdometerKm,
        lastOilChangeOdometerKm: v.lastOilChangeOdometerKm,
        oilChangeIntervalKm: v.oilChangeIntervalKm,
        nextOilChangeDueKm: oilStatus.nextDueKm,
        kmUntilOilChange: oilStatus.remainingKm,
        oilChangeStatus: oilStatus.status,
        latestDamageReport: latestDamage,
        latestMaintenanceLog: latestLog,
        maintenanceStatus: v.status === 'UNDER_MAINTENANCE' ? 'NEEDS_SERVICE' : 'HEALTHY'
      };
    });

    res.json(formattedVehicles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// GET /api/admin/maintenance/damage-reports
router.get('/damage-reports', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const reports = await prisma.damageReport.findMany({
      include: {
        booking: {
          include: {
            vehicle: true,
            customer: {
              select: { fullName: true, email: true }
            }
          }
        }
      },
      orderBy: { reportedAt: 'desc' }
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch damage reports' });
  }
});

// GET /api/admin/maintenance/logs
router.get('/logs', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const logs = await prisma.maintenanceLog.findMany({
      include: {
        vehicle: true
      },
      orderBy: { serviceDate: 'desc' }
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch maintenance logs' });
  }
});

// POST /api/admin/maintenance/logs
router.post('/logs', authenticate, authorizeAdmin, async (req, res) => {
  const { vehicleId, bookingId, serviceType, description, cost, serviceDate, nextServiceDate, status } = req.body;
  
  if (!vehicleId || !serviceType || !description) {
    return res.status(400).json({ error: 'Vehicle ID, service type, and description are required.' });
  }

  try {
    const log = await (prisma.maintenanceLog as any).create({
      data: {
        vehicleId,
        bookingId: bookingId || null,
        serviceType,
        description,
        cost: cost ? Number(cost) : null,
        odometerKm: req.body.odometerKm ? Number(req.body.odometerKm) : null,
        serviceDate: serviceDate ? new Date(serviceDate) : new Date(),
        nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : null,
        completedAt: status === 'COMPLETED' ? new Date() : null,
        status: status || 'COMPLETED'
      },
      include: { vehicle: true }
    });

    // Handle Oil Change completion
    if (status === 'COMPLETED' && serviceType === 'OIL_CHANGE') {
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: { 
          lastOilChangeOdometerKm: req.body.odometerKm ? Number(req.body.odometerKm) : log.vehicle.currentOdometerKm,
          lastServiceDate: new Date()
        }
      });
    }

    // If status is IN_PROGRESS, optionally mark vehicle as UNDER_MAINTENANCE
    if (status === 'IN_PROGRESS') {
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: { status: 'UNDER_MAINTENANCE' }
      });
    }

    res.status(201).json(log);
  } catch (error) {
    console.error('Error creating maintenance log:', error);
    res.status(500).json({ error: 'Failed to create maintenance log' });
  }
});

// PUT /api/admin/maintenance/logs/:id
router.put('/logs/:id', authenticate, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  const { serviceType, description, cost, serviceDate, nextServiceDate, status } = req.body;

  try {
    const log = await (prisma.maintenanceLog as any).update({
      where: { id },
      data: {
        serviceType,
        description,
        cost: cost ? Number(cost) : undefined,
        odometerKm: req.body.odometerKm ? Number(req.body.odometerKm) : undefined,
        serviceDate: serviceDate ? new Date(serviceDate) : undefined,
        nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : undefined,
        completedAt: status === 'COMPLETED' ? new Date() : undefined,
        status
      },
      include: { vehicle: true }
    });

    // Handle Oil Change completion
    if (status === 'COMPLETED' && log.serviceType === 'OIL_CHANGE') {
      await prisma.vehicle.update({
        where: { id: log.vehicleId },
        data: { 
          lastOilChangeOdometerKm: (log as any).odometerKm || log.vehicle.currentOdometerKm,
          lastServiceDate: new Date()
        }
      });
    }

    // If status is marked COMPLETED, we don't automatically mark vehicle AVAILABLE 
    // because there might be other issues. Admin should do that explicitly.

    res.json(log);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update maintenance log' });
  }
});

// POST /api/admin/maintenance/vehicles/:vehicleId/mark-maintenance
router.post('/vehicles/:vehicleId/mark-maintenance', authenticate, authorizeAdmin, async (req, res) => {
  const { vehicleId } = req.params;
  try {
    const vehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: 'UNDER_MAINTENANCE' }
    });
    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update vehicle status' });
  }
});

// POST /api/admin/maintenance/vehicles/:vehicleId/mark-available
router.post('/vehicles/:vehicleId/mark-available', authenticate, authorizeAdmin, async (req, res) => {
  const { vehicleId } = req.params;
  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    if (vehicle.status === 'RETIRED') {
      return res.status(400).json({ error: 'Retired vehicles cannot be marked as available through maintenance.' });
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: 'AVAILABLE' }
    });
    res.json(updatedVehicle);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update vehicle status' });
  }
});

export default router;
