import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from './auth';

const storage = multer.diskStorage({
  destination: (req: AuthRequest, file, cb) => {
    const { type, bookingId } = req.body;
    const userId = req.user?.id;

    console.log(`[Multer] Destination Check - Type: ${type}, BookingId: ${bookingId}, User: ${userId}`);

    if (!userId) {
      return cb(new Error('Unauthorized upload attempt'), '');
    }

    let uploadPath = '.uploads/';

    // Mapping upload types to specific directory structures
    switch (type) {
      case 'valid_id':
        uploadPath += `booking-documents/${userId}/${bookingId}/valid-id/`;
        break;
      case 'drivers_license':
        uploadPath += `booking-documents/${userId}/${bookingId}/drivers-license/`;
        break;
      case 'payment_proof':
        uploadPath += `payment-proofs/${userId}/${bookingId}/`;
        break;
      case 'vehicle_image':
        uploadPath += `vehicle-images/`;
        break;
      case 'damage_photo':
        uploadPath += `damage-reports/${bookingId}/`;
        break;
      default:
        uploadPath += `misc/${userId}/`;
    }

    // Ensure directory exists
    const fullPath = path.resolve(uploadPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// Specialized storage for vehicle images
const vehicleStorage = multer.diskStorage({
  destination: (req: AuthRequest, file, cb) => {
    const uploadPath = '.uploads/vehicle-images/';
    const fullPath = path.resolve(uploadPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `vehicle-${uniqueSuffix}${ext}`);
  }
});

export const vehicleImageUpload = multer({
  storage: vehicleStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, or WEBP images up to 5MB are allowed.'));
    }
  }
});

export const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (jpeg, jpg, png, webp) and PDFs are allowed'));
    }
  }
});
