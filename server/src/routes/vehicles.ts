import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
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
const IMAGE_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

router.get('/:id/image', async (req, res) => {
  try {
    console.log('=== IMAGE REQUEST ===');
    console.log('Vehicle ID:', req.params.id);

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: req.params.id },
      select: { imageUrl: true }
    });

    console.log('Vehicle found:', !!vehicle);
    console.log('imageUrl from DB:', vehicle?.imageUrl);

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const imageUrl = vehicle.imageUrl;

    // No image stored
    if (!imageUrl || imageUrl.trim() === '') {
      console.log('No imageUrl — returning 404');
      return res.status(404).json({ error: 'No image available' });
    }

    // External URL — redirect
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      console.log('External URL — redirecting to:', imageUrl);
      return res.redirect(imageUrl);
    }

    // Local file
    const cleanPath = imageUrl.replace(/\\/g, '/').replace(/^\.?\/?/, '');
    console.log('Clean path:', cleanPath);

    let filePath = path.resolve(process.cwd(), cleanPath.startsWith('uploads/') ? cleanPath : `uploads/${cleanPath}`);

    // Fallback check for legacy .uploads directory if not found in uploads
    if (!fs.existsSync(filePath)) {
      const fallbackPath = path.resolve(process.cwd(), cleanPath.startsWith('uploads/') ? cleanPath.replace(/^uploads\//, '.uploads/') : `.uploads/${cleanPath}`);
      if (fs.existsSync(fallbackPath)) {
        filePath = fallbackPath;
      }
    }
    console.log('Resolved filePath:', filePath);

    if (!fs.existsSync(filePath)) {
      console.log('FILE NOT FOUND at:', filePath);
      return res.status(404).json({ error: 'Image file not found' });
    }

    console.log('Serving file:', filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = IMAGE_MIME_TYPES[ext] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.sendFile(filePath);

  } catch (err: any) {
    console.error('Image endpoint error:', err.message);
    return res.status(500).json({ error: 'Failed to serve image' });
  }
});

// Get available vehicles with optional date filtering
router.get('/available', async (req, res) => {
  const { pickupDate, returnDate } = req.query;

  try {
    let where: any;

    if (pickupDate && returnDate) {
      const start = new Date(pickupDate as string);
      const end = new Date(returnDate as string);

      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        // With valid dates: include AVAILABLE and RENTED vehicles,
        // exclude those whose bookings overlap the requested range.
        // Always exclude UNDER_MAINTENANCE and RETIRED regardless of dates.
        where = {
          status: { notIn: ['UNDER_MAINTENANCE', 'RETIRED'] },
          bookings: {
            none: {
              status: { notIn: ['REJECTED', 'CANCELLED', 'COMPLETED'] },
              AND: [
                { startDate: { lt: end } },
                { endDate: { gt: start } }
              ]
            }
          }
        };
      } else {
        // Invalid date strings — safe fallback
        where = { status: 'AVAILABLE' };
      }
    } else {
      // No dates provided — show only AVAILABLE vehicles (safe default)
      where = { status: 'AVAILABLE' };
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

    // If a file was uploaded, normalize backslashes so path.join resolves correctly on all platforms
    let finalImageUrl = imageUrl;
    if (req.file) {
      finalImageUrl = req.file.path.replace(/\\/g, '/').replace(/^\.?\/?/, '');
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
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = error.meta?.target;
      const isLicensePlate = Array.isArray(target)
        ? target.includes('licensePlate')
        : typeof target === 'string'
          ? target.includes('licensePlate')
          : false;

      if (isLicensePlate) {
        return res.status(400).json({ error: 'A vehicle with this license plate already exists.' });
      }
    }
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

    // Debug logging — confirm what multer received
    console.log('req.file:', req.file ? `File received: ${req.file.filename}` : 'No file uploaded');
    console.log('req.body.imageUrl:', req.body.imageUrl);

    // Only update imageUrl when a new file was uploaded — never overwrite with body value
    if (req.file) {
      data.imageUrl = req.file.path.replace(/\\/g, '/').replace(/^\.?\/?/, '');
      console.log('Image uploaded, saving imageUrl:', data.imageUrl);
    } else {
      // Remove imageUrl from data entirely so Prisma leaves the existing DB value unchanged
      delete data.imageUrl;
    }

    console.log('data.imageUrl after assignment:', data.imageUrl);

    // Remove the multer file-field key — it is not a Prisma model field
    delete data.vehicleImage;

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
