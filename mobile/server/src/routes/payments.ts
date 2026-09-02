import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorizeAdmin, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { createNotification, createAdminNotification } from '../lib/notifications';
import { checkVehicleAvailability } from '../lib/booking-availability';

const router = Router();

// Customer: Submit Payment
router.post('/:id/submit', authenticate, upload.single('proof'), async (req: AuthRequest, res) => {
  const { amount, paymentType, referenceNumber } = req.body;
  const bookingId = req.params.id;

  try {
    const booking = await prisma.booking.findUnique({ 
      where: { id: bookingId },
      include: { customer: true }
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Ownership check
    if (booking.customerId !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized to submit payment for this booking' });
    }

    // Re-check availability before payment
    const availability = await checkVehicleAvailability(
      booking.vehicleId, 
      booking.startDate, 
      booking.endDate, 
      bookingId
    );

    if (!availability.available) {
      return res.status(409).json({ 
        error: `Vehicle is no longer available for your dates: ${availability.message}` 
      });
    }

    // Optional Duplicate Reference Check
    if (referenceNumber) {
      const existing = await prisma.paymentProof.findFirst({
        where: { referenceNumber }
      });
      if (existing) {
        return res.status(400).json({ error: 'This reference number has already been used.' });
      }
    }

    // Enforce amount on backend
    let validatedAmount = Number(booking.totalAmount);
    if (paymentType === 'DOWNPAYMENT_GCASH') {
      validatedAmount = Math.round(Number(booking.totalAmount) * 0.3);
    }

    const payment = await prisma.payment.create({
      data: {
        bookingId,
        amount: validatedAmount,
        paymentType,
        status: 'SUBMITTED',
        proofs: {
          create: {
            proofUrl: req.file ? req.file.path.replace(/\\/g, '/') : '',
            referenceNumber: referenceNumber || null
          }
        }
      }
    });

    // Update booking status
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: paymentType === 'FULL_GCASH' ? 'FULL_PAYMENT_SUBMITTED' : 'DOWNPAYMENT_SUBMITTED' }
    });

    // Notify Admin
    await createAdminNotification(
      'Payment Submitted',
      `${booking.customer.fullName} submitted a ${paymentType.replace('_', ' ').toLowerCase()} for booking #${bookingId.slice(0, 8)}`
    );

    res.status(201).json(payment);
  } catch (error) {
    console.error('Payment submission error:', error);
    res.status(500).json({ error: 'Payment submission failed' });
  }
});

// Admin: Get Payments by Status
router.get('/list', authenticate, authorizeAdmin, async (req, res) => {
  const { status, startDate, endDate, paymentType } = req.query;
  try {
    const whereClause: any = {};
    if (status) whereClause.status = status as string;
    if (paymentType && paymentType !== 'ALL') {
      whereClause.paymentType = { contains: paymentType as string };
    }
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = end;
      }
    }
    const payments = await prisma.payment.findMany({
      where: whereClause,
      include: { 
        booking: { 
          include: { 
            customer: { select: { fullName: true, email: true } }, 
            vehicle: true 
          } 
        },
        proofs: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Admin: Get Payment Summary (KPIs)
router.get('/summary', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const [
      pendingCount,
      verifiedCount,
      rejectedCount,
      reservedBookings,
      revenueQuery,
      todayRevenueQuery
    ] = await Promise.all([
      prisma.payment.count({ where: { status: 'SUBMITTED' } }),
      prisma.payment.count({ where: { status: { in: ['VERIFIED', 'PAID_IN_PERSON'] } } }),
      prisma.payment.count({ where: { status: 'REJECTED' } }),
      prisma.booking.count({ where: { status: 'RESERVED' } }), // Cash collections
      prisma.payment.aggregate({
        where: { status: { in: ['VERIFIED', 'PAID_IN_PERSON'] } },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: { 
          status: { in: ['VERIFIED', 'PAID_IN_PERSON'] },
          verifiedAt: { gte: new Date(new Date().setHours(0,0,0,0)) }
        },
        _sum: { amount: true }
      })
    ]);

    res.json({
      pendingVerification: pendingCount,
      verifiedHistory: verifiedCount,
      rejected: rejectedCount,
      cashCollections: reservedBookings,
      totalRevenue: revenueQuery._sum.amount || 0,
      todayRevenue: todayRevenueQuery._sum.amount || 0
    });
  } catch (error) {
    console.error('Payment summary error:', error);
    res.status(500).json({ error: 'Failed to fetch payment summary' });
  }
});

// Admin: Get Cash at Pickup (RESERVED bookings waiting for balance)
router.get('/cash-at-pickup', authenticate, authorizeAdmin, async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const whereClause: any = { status: 'RESERVED' };
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = end;
      }
    }
    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: { 
        customer: { select: { fullName: true, email: true, phoneNumber: true } },
        vehicle: true,
        payments: true
      },
      orderBy: { startDate: 'asc' }
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reserved bookings' });
  }
});

// Admin: Confirm Cash Payment (transition RESERVED -> READY_FOR_PICKUP)
router.post('/booking/:id/confirm-cash', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  try {
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Create payment record
    await prisma.payment.create({
      data: {
        bookingId: id,
        amount: Number(amount),
        paymentType: 'REMAINING_CASH',
        status: 'PAID_IN_PERSON',
        verifiedById: req.user!.id,
        verifiedAt: new Date()
      }
    });

    // Update booking status
    const updated = await prisma.booking.update({
      where: { id },
      data: { 
        status: 'READY_FOR_PICKUP',
        remainingBalancePaidAt: new Date()
      }
    });

    // Notify Customer
    await createNotification(
      booking.customerId,
      'Payment Verified',
      'Your remaining cash balance has been verified. Your vehicle is now ready for pickup!'
    );

    res.json(updated);
  } catch (error) {
    console.error('Confirm cash error:', error);
    res.status(500).json({ error: 'Failed to confirm cash payment' });
  }
});

// Admin: Verify Payment
router.post('/:id/verify', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
  try {
    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data: { 
        status: 'VERIFIED', 
        verifiedById: req.user!.id,
        verifiedAt: new Date()
      },
      include: { booking: true }
    });

    // Final Booking Status Logic
    // Full Payment -> READY_FOR_PICKUP
    // Downpayment -> RESERVED (Remaining balance due at pickup)
    const isFull = payment.paymentType === 'FULL_GCASH';
    const finalBookingStatus = isFull ? 'READY_FOR_PICKUP' : 'RESERVED';
    
    const updateData: any = { status: finalBookingStatus };
    if (!isFull) {
      // Calculate remaining balance (approx 70%)
      updateData.remainingBalancePaidAt = null; // Ensure it's null until cash is paid
    } else {
      updateData.remainingBalancePaidAt = new Date(); // Full payment covers everything
    }

    await prisma.booking.update({
      where: { id: payment.bookingId },
      data: updateData
    });

    // Vehicle status becomes RESERVED
    await prisma.vehicle.update({
      where: { id: payment.booking.vehicleId },
      data: { status: 'RESERVED' }
    });

    // Notify Customer
    const amountStr = Number(payment.amount).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    const message = isFull 
      ? `Your payment of ${amountStr} has been verified. Your vehicle is now READY FOR PICKUP!`
      : `Your downpayment of ${amountStr} has been verified. Your booking is RESERVED. Please pay the remaining balance in cash at the rental shop during pickup.`;

    await createNotification(
      payment.booking.customerId,
      'Payment Verified',
      message
    );

    res.json(payment);
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Admin: Reject Payment
router.post('/:id/reject', authenticate, authorizeAdmin, async (req, res) => {
  const { reason } = req.body;
  const rejectionMessage = (reason && reason.trim()) ? reason.trim() : 'Proof of payment invalid or unclear.';

  try {
    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED' },
      include: { booking: true }
    });

    // Roll back booking status so the customer can resubmit
    // Only roll back from payment-submitted states — never touch ACTIVE/COMPLETED/etc.
    const rollbackMap: Record<string, string> = {
      'FULL_PAYMENT_SUBMITTED': 'APPROVED_FOR_PAYMENT',
      'DOWNPAYMENT_SUBMITTED': 'APPROVED_FOR_PAYMENT',
    };
    const rollbackStatus = rollbackMap[payment.booking.status];
    if (rollbackStatus) {
      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: rollbackStatus }
      });
    }

    // Notify Customer — include resubmission guidance
    await createNotification(
      payment.booking.customerId,
      'Payment Rejected',
      `Your payment submission was rejected. Reason: ${rejectionMessage}. Your booking has been reset — please resubmit your payment proof to continue with your booking.`
    );

    res.json(payment);
  } catch (error) {
    console.error('Payment rejection error:', error);
    res.status(500).json({ error: 'Rejection failed' });
  }
});

// Customer: Get Booking for Payment
router.get('/booking/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { vehicle: true }
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Ownership check
    if (booking.customerId !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch booking details' });
  }
});

// Admin: Get Payments with Aggregates per Status
router.get('/admin/aggregates', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { startDate, endDate, paymentType } = req.query;

    const paymentWhere: any = {};
    if (paymentType && paymentType !== 'ALL') {
      paymentWhere.paymentType = { contains: paymentType as string };
    }
    if (startDate || endDate) {
      paymentWhere.createdAt = {};
      if (startDate) paymentWhere.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        paymentWhere.createdAt.lte = end;
      }
    }

    const reservedWhere: any = { status: 'RESERVED' };
    if (startDate || endDate) {
      reservedWhere.createdAt = {};
      if (startDate) reservedWhere.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        reservedWhere.createdAt.lte = end;
      }
    }

    const [
      pendingCount,
      verifiedCount,
      rejectedCount,
      pendingAmount,
      verifiedAmount,
      rejectedAmount,
      thisMonthAmount,
      lastMonthAmount,
      outstandingBookings,
      reservedBookings
    ] = await Promise.all([
      prisma.payment.count({ where: { ...paymentWhere, status: 'SUBMITTED' } }),
      prisma.payment.count({ where: { ...paymentWhere, status: { in: ['VERIFIED', 'PAID_IN_PERSON'] } } }),
      prisma.payment.count({ where: { ...paymentWhere, status: 'REJECTED' } }),
      prisma.payment.aggregate({
        where: { ...paymentWhere, status: 'SUBMITTED' },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: { ...paymentWhere, status: { in: ['VERIFIED', 'PAID_IN_PERSON'] } },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: { ...paymentWhere, status: 'REJECTED' },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: {
          status: { in: ['VERIFIED', 'PAID_IN_PERSON'] },
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
          }
        },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: {
          status: { in: ['VERIFIED', 'PAID_IN_PERSON'] },
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
            lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        },
        _sum: { amount: true }
      }),
      prisma.booking.count({
        where: {
          status: 'COMPLETED',
          payments: {
            none: { status: { in: ['VERIFIED', 'PAID_IN_PERSON'] } }
          }
        }
      }),
      prisma.booking.findMany({
        where: reservedWhere,
        include: { payments: true }
      })
    ]);

    const cashPickupsCount = reservedBookings.length;
    const cashPickupsAmount = reservedBookings.reduce((sum, b) => {
      const paid = (b.payments || []).reduce((pSum, p) => pSum + Number(p.amount), 0);
      return sum + Math.max(0, Number(b.totalAmount) - paid);
    }, 0);

    const thisMonthValue = Number(thisMonthAmount._sum.amount) || 0;
    const lastMonthValue = Number(lastMonthAmount._sum.amount) || 0;
    const monthChange = lastMonthValue > 0
      ? ((thisMonthValue - lastMonthValue) / lastMonthValue) * 100
      : 0;

    res.json({
      counts: {
        pending: pendingCount,
        verified: verifiedCount,
        rejected: rejectedCount,
        cashPickups: cashPickupsCount
      },
      amounts: {
        pending: Number(pendingAmount._sum.amount) || 0,
        verified: Number(verifiedAmount._sum.amount) || 0,
        rejected: Number(rejectedAmount._sum.amount) || 0,
        cashPickups: cashPickupsAmount
      },
      revenue: {
        thisMonth: thisMonthValue,
        lastMonth: lastMonthValue,
        monthChange: parseFloat(monthChange.toFixed(2)),
        outstanding: outstandingBookings
      }
    });
  } catch (error) {
    console.error('Error fetching aggregates:', error);
    res.status(500).json({ error: 'Failed to fetch payment aggregates' });
  }
});

// Admin: Export Payments as CSV
router.get('/export', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { status } = req.query;

    const payments = await prisma.payment.findMany({
      where: status ? { status: status as string } : {},
      include: {
        booking: {
          include: {
            customer: { select: { fullName: true } },
            vehicle: { select: { brand: true, model: true, licensePlate: true } }
          }
        },
        proofs: true,
        verifiedBy: { select: { fullName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Build CSV
    const headers = ['Date', 'Customer', 'Vehicle', 'Plate', 'Booking ID', 'Payment Type', 'Amount', 'Reference', 'Status', 'Verified By'];
    const rows = payments.map(p => [
      new Date(p.createdAt).toLocaleDateString('en-PH'),
      p.booking?.customer?.fullName || 'N/A',
      `${p.booking?.vehicle?.brand} ${p.booking?.vehicle?.model}` || 'N/A',
      p.booking?.vehicle?.licensePlate || 'N/A',
      `#${p.bookingId.slice(0, 8).toUpperCase()}`,
      p.paymentType.replace(/_/g, ' '),
      Number(p.amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      p.proofs[0]?.referenceNumber || 'N/A',
      p.status,
      p.verifiedBy?.fullName || 'Pending'
    ]);

    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payments-${status || 'all'}-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

export default router;

