import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { vehicleImageUpload } from '../middleware/upload';
import path from 'path';
import fs from 'fs';

const router = Router();

// Get all vehicles
router.get('/', async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { brand: 'asc' }
    });
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// GET /api/vehicles/:id/image - Publicly serve vehicle image
router.get('/:id/image', async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: req.params.id }
    });

    if (!vehicle || !vehicle.imageUrl) {
      return res.status(404).send('No image found for this vehicle.');
    }

    // Check if it's an external URL or internal path
    if (vehicle.imageUrl.startsWith('http')) {
      return res.redirect(vehicle.imageUrl);
    }

    const filePath = path.resolve(vehicle.imageUrl);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Image file not found on server.');
    }

    res.sendFile(filePath);
  } catch (error) {
    res.status(500).send('Error serving image.');
  }
});

// Get available vehicles with optional date filtering
router.get('/available', async (req, res) => {
  const { pickupDate, returnDate } = req.query;
  
  try {
    const where: any = { status: 'AVAILABLE' };

    if (pickupDate && returnDate) {
      const start = new Date(pickupDate as string);
      const end = new Date(returnDate as string);

      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        where.bookings = {
          none: {
            status: { notIn: ['REJECTED', 'CANCELLED', 'COMPLETED'] },
            AND: [
              { startDate: { lt: end } },
              { endDate: { gt: start } }
            ]
          }
        };
      }
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: { dailyRate: 'asc' }
    });
    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching available vehicles:', error);
    res.status(500).json({ error: 'Failed to fetch available vehicles' });
  }
});

router.post('/', authenticate, authorizeAdmin, vehicleImageUpload.single('vehicleImage'), async (req, res) => {
  const {
    model, brand, category, year, licensePlate, dailyRate, description, imageUrl,
    currentOdometerKm, lastOilChangeOdometerKm, oilChangeIntervalKm, status,
    seats, transmission, fuelType
  } = req.body;

  // Validation
  const allowedInitialStatuses = ['AVAILABLE', 'UNDER_MAINTENANCE'];
  const finalStatus = status || 'AVAILABLE';

  if (!allowedInitialStatuses.includes(finalStatus)) {
    return res.status(400).json({
      error: 'New vehicles can only be added as Available or Under Maintenance.'
    });
  }

  try {
    // Parse numeric fields with safe conversion
    const yearParsed = year ? parseInt(year, 10) : null;
    const dailyRateParsed = parseFloat(dailyRate);
    const seatsParsed = seats ? parseInt(seats, 10) : null;
    const currentOdometerKmParsed = currentOdometerKm ? parseFloat(currentOdometerKm) : 0;
    const lastOilChangeOdometerKmParsed = lastOilChangeOdometerKm ? parseFloat(lastOilChangeOdometerKm) : 0;
    const oilChangeIntervalKmParsed = oilChangeIntervalKm ? parseFloat(oilChangeIntervalKm) : 5000;

    // Validate required numeric fields
    if (isNaN(dailyRateParsed)) {
      return res.status(400).json({ error: 'Daily Rate must be a valid number.' });
    }
    if (yearParsed !== null && isNaN(yearParsed)) {
      return res.status(400).json({ error: 'Year must be a valid number.' });
    }
    if (seatsParsed !== null && isNaN(seatsParsed)) {
      return res.status(400).json({ error: 'Seats must be a valid number.' });
    }

    // If a file was uploaded, use its path as imageUrl
    let finalImageUrl = imageUrl;
    if (req.file) {
      finalImageUrl = req.file.path; // Store relative path like ".uploads/vehicle-images/..."
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        model, brand, category, year: yearParsed, licensePlate, dailyRate: dailyRateParsed, description, imageUrl: finalImageUrl,
        status: finalStatus,
        seats: seatsParsed,
        transmission,
        fuelType,
        currentOdometerKm: currentOdometerKmParsed,
        lastOilChangeOdometerKm: lastOilChangeOdometerKmParsed,
        oilChangeIntervalKm: oilChangeIntervalKmParsed
      }
    });
    res.status(201).json(vehicle);
  } catch (error) {
    console.error('Vehicle creation error:', error);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
});

// Admin: Update vehicle
router.put('/:id', authenticate, authorizeAdmin, vehicleImageUpload.single('vehicleImage'), async (req, res) => {
  try {
    const data = { ...req.body };

    // Parse numeric fields - only if provided and not empty strings
    if (data.year !== undefined && data.year !== '') {
      const yearParsed = parseInt(data.year, 10);
      if (isNaN(yearParsed)) {
        return res.status(400).json({ error: 'Year must be a valid number.' });
      }
      data.year = yearParsed;
    } else {
      delete data.year;
    }

    if (data.dailyRate !== undefined && data.dailyRate !== '') {
      const dailyRateParsed = parseFloat(data.dailyRate);
      if (isNaN(dailyRateParsed)) {
        return res.status(400).json({ error: 'Daily Rate must be a valid number.' });
      }
      data.dailyRate = dailyRateParsed;
    } else {
      delete data.dailyRate;
    }

    if (data.seats !== undefined && data.seats !== '') {
      const seatsParsed = parseInt(data.seats, 10);
      if (isNaN(seatsParsed)) {
        return res.status(400).json({ error: 'Seats must be a valid number.' });
      }
      data.seats = seatsParsed;
    } else if (data.seats === '') {
      data.seats = null;
    }

    if (data.currentOdometerKm !== undefined && data.currentOdometerKm !== '') {
      const odometerParsed = parseFloat(data.currentOdometerKm);
      if (isNaN(odometerParsed)) {
        return res.status(400).json({ error: 'Current Odometer must be a valid number.' });
      }
      data.currentOdometerKm = odometerParsed;
    } else {
      delete data.currentOdometerKm;
    }

    if (data.lastOilChangeOdometerKm !== undefined && data.lastOilChangeOdometerKm !== '') {
      const oilOdometerParsed = parseFloat(data.lastOilChangeOdometerKm);
      if (isNaN(oilOdometerParsed)) {
        return res.status(400).json({ error: 'Last Oil Change Odometer must be a valid number.' });
      }
      data.lastOilChangeOdometerKm = oilOdometerParsed;
    } else {
      delete data.lastOilChangeOdometerKm;
    }

    if (data.oilChangeIntervalKm !== undefined && data.oilChangeIntervalKm !== '') {
      const intervalParsed = parseFloat(data.oilChangeIntervalKm);
      if (isNaN(intervalParsed)) {
        return res.status(400).json({ error: 'Oil Change Interval must be a valid number.' });
      }
      data.oilChangeIntervalKm = intervalParsed;
    } else {
      delete data.oilChangeIntervalKm;
    }

    // Prevent manual setting of RESERVED, RENTED or RETIRED
    if (data.status && ['RESERVED', 'RENTED', 'RETIRED'].includes(data.status)) {
      return res.status(400).json({
        error: 'Reserved, Rented, and Retired statuses are managed by system actions.'
      });
    }

    // If a new image file was uploaded
    if (req.file) {
      data.imageUrl = req.file.path;
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data
    });
    res.json(vehicle);
  } catch (error: any) {
    console.error('Vehicle Update Error (Backend):', error);

    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'A vehicle with this license plate already exists.'
      });
    }

    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update vehicle due to an internal error.'
    });
  }
});

// Admin: Retire vehicle (Archive)
router.post('/:id/retire', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: { status: 'RETIRED' }
    });
    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retire vehicle' });
  }
});

export default router;
