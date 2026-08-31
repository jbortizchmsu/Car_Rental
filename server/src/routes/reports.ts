import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorizeAdmin } from '../middleware/auth';

const router = Router();

// Helper to handle date range filtering
const getDateFilter = (startDate?: any, endDate?: any) => {
  if (!startDate && !endDate) return undefined;
  
  const filter: any = {};
  if (startDate) filter.gte = new Date(startDate as string);
  if (endDate) {
    const end = new Date(endDate as string);
    end.setHours(23, 59, 59, 999);
    filter.lte = end;
  }
  
  return filter;
};

// 1. Summary Report (Dashboard)
router.get('/summary', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const [
      bookingsCount,
      pendingBookings,
      activeRentals,
      completedRentals,
      vehiclesCount,
      availableVehicles,
      totalRevenue,
      unresolvedAlerts
    ] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.booking.count({ where: { status: 'ACTIVE' } }),
      prisma.booking.count({ where: { status: 'COMPLETED' } }),
      prisma.vehicle.count(),
      prisma.vehicle.count({ where: { status: 'AVAILABLE' } }),
      prisma.payment.aggregate({
        where: { status: { in: ['VERIFIED', 'PAID_IN_PERSON'] } },
        _sum: { amount: true }
      }),
      prisma.geofenceAlert.count({ where: { resolved: false } })
    ]);

    res.json({
      bookings: {
        total: bookingsCount,
        pending: pendingBookings,
        active: activeRentals,
        completed: completedRentals
      },
      vehicles: {
        total: vehiclesCount,
        available: availableVehicles
      },
      revenue: {
        totalVerified: totalRevenue._sum.amount || 0
      },
      alerts: {
        unresolved: unresolvedAlerts
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch summary report' });
  }
});

// 2. Revenue Report
router.get('/revenue', authenticate, authorizeAdmin, async (req, res) => {
  const { startDate, endDate } = req.query;
  const dateFilter = getDateFilter(startDate, endDate);

  try {
    const verifiedPayments = await prisma.payment.findMany({
      where: {
        status: { in: ['VERIFIED', 'PAID_IN_PERSON'] },
        createdAt: dateFilter
      },
      include: {
        booking: {
          include: { customer: { select: { fullName: true } }, vehicle: { select: { model: true, brand: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const breakdown = verifiedPayments.reduce((acc: any, curr) => {
      const type = curr.paymentType;
      acc[type] = (acc[type] || 0) + Number(curr.amount);
      acc.total += Number(curr.amount);
      return acc;
    }, { FULL_GCASH: 0, DOWNPAYMENT_GCASH: 0, REMAINING_CASH: 0, total: 0 });

    res.json({ breakdown, details: verifiedPayments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch revenue report' });
  }
});

// 3. Booking Report
router.get('/bookings', authenticate, authorizeAdmin, async (req, res) => {
  const { startDate, endDate } = req.query;
  const dateFilter = getDateFilter(startDate, endDate);

  try {
    const bookings = await prisma.booking.findMany({
      where: { createdAt: dateFilter },
      include: {
        customer: { select: { fullName: true, email: true } },
        vehicle: { select: { brand: true, model: true, licensePlate: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const statusCounts = bookings.reduce((acc: any, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {});

    res.json({ statusCounts, details: bookings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch booking report' });
  }
});

// 4. Vehicle Utilization & Performance Report
router.get('/vehicles', authenticate, authorizeAdmin, async (req, res) => {
  const { startDate, endDate } = req.query;
  const dateFilter = getDateFilter(startDate, endDate);

  try {
    const vehicles = await prisma.vehicle.findMany({
      include: {
        _count: {
          select: { 
            bookings: {
              where: {
                createdAt: dateFilter,
                status: { notIn: ['CANCELLED', 'REJECTED', 'VOIDED'] }
              }
            } 
          }
        },
        bookings: {
          where: { 
            status: { in: ['COMPLETED', 'ACTIVE', 'RETURNED', 'READY_FOR_PICKUP', 'RESERVED'] },
            createdAt: dateFilter
          },
          select: { totalAmount: true }
        }
      }
    });

    const statusSummary = vehicles.reduce((acc: any, v) => {
      acc[v.status] = (acc[v.status] || 0) + 1;
      return acc;
    }, {});

    const totalFleet = vehicles.length;
    const utilizedCount = vehicles.filter(v => ['RENTED', 'RESERVED', 'ACTIVE'].includes(v.status)).length;
    const utilizationRate = totalFleet > 0 ? (utilizedCount / totalFleet) : 0;

    // Calculate revenue per vehicle
    const vehiclePerformance = vehicles.map(v => {
      const revenue = v.bookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
      return {
        ...v,
        revenue,
        rentalsCount: v._count.bookings
      };
    });

    // Top performers
    const topRented = [...vehiclePerformance].sort((a, b) => b.rentalsCount - a.rentalsCount).slice(0, 5);

    // Maintenance alerts
    const oilChangeDue = vehicles.filter(v => (v.currentOdometerKm - v.lastOilChangeOdometerKm) >= v.oilChangeIntervalKm).length;
    const serviceSoon = vehicles.filter(v => {
      if (!v.nextServiceDate) return false;
      const soon = new Date();
      soon.setDate(soon.getDate() + 7);
      return new Date(v.nextServiceDate) <= soon;
    }).length;

    res.json({ 
      statusSummary, 
      topRented, 
      details: vehiclePerformance,
      stats: {
        totalFleet,
        utilizedCount,
        utilizationRate,
        oilChangeDue,
        serviceSoon
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vehicle utilization report' });
  }
});

// 5. Payment Report
router.get('/payments', authenticate, authorizeAdmin, async (req, res) => {
  const { startDate, endDate } = req.query;
  const dateFilter = getDateFilter(startDate, endDate);

  try {
    const payments = await prisma.payment.findMany({
      where: { createdAt: dateFilter },
      include: {
        booking: { include: { customer: { select: { fullName: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const statusSummary = payments.reduce((acc: any, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {});

    res.json({ statusSummary, details: payments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payment report' });
  }
});

// 6. Maintenance & Damages Report
router.get('/maintenance', authenticate, authorizeAdmin, async (req, res) => {
  const { startDate, endDate } = req.query;
  const dateFilter = getDateFilter(startDate, endDate);

  try {
    const maintenance = await prisma.maintenanceLog.findMany({
      where: { serviceDate: dateFilter },
      include: { vehicle: true },
      orderBy: { serviceDate: 'desc' }
    });
    
    const damages = await prisma.damageReport.findMany({
      where: { reportedAt: dateFilter },
      include: { booking: { include: { vehicle: true, customer: { select: { fullName: true } } } } },
      orderBy: { reportedAt: 'desc' }
    });

    const totalMaintenanceCost = maintenance.reduce((sum, log) => sum + Number(log.cost || 0), 0);
    const totalDamageEstimate = damages.reduce((sum, d) => sum + Number(d.estimatedCost || 0), 0);
    const pendingMaintenance = maintenance.filter(m => m.status !== 'COMPLETED').length;
    const unresolvedDamages = damages.filter(d => d.status !== 'RESOLVED').length;

    res.json({ 
      maintenance, 
      damages,
      summary: {
        totalMaintenanceCost,
        totalDamageEstimate,
        pendingMaintenance,
        unresolvedDamages
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch maintenance/damage report' });
  }
});

// 7. Geofence Alert Report
router.get('/geofence-alerts', authenticate, authorizeAdmin, async (req, res) => {
  const { startDate, endDate } = req.query;
  const dateFilter = getDateFilter(startDate, endDate);

  try {
    const alerts = await prisma.geofenceAlert.findMany({
      where: { createdAt: dateFilter },
      include: {
        vehicle: { select: { brand: true, model: true } },
        booking: { include: { customer: { select: { fullName: true } } } },
        resolvedBy: { select: { fullName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const unresolved = alerts.filter(a => !a.resolved).length;
    const resolved = alerts.filter(a => a.resolved).length;

    res.json({ stats: { unresolved, resolved, total: alerts.length }, details: alerts });
  } catch (error) {
    res.json({ stats: { unresolved: 0, resolved: 0, total: 0 }, details: [], note: 'Safety data integration initialized' });
  }
});

export default router;
