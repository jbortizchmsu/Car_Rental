import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from './auth';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sanitizeUuid = (value: unknown): string =>
  typeof value === 'string' && UUID_REGEX.test(value) ? value : 'unknown';

const storage = multer.diskStorage({
  destination: (req: AuthRequest, file, cb) => {
    const { type } = req.body;
    const bookingId = sanitizeUuid(req.body.bookingId);
    const userId = sanitizeUuid(req.user?.id);

    if (!req.user?.id) {
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
    const allowedMimeTypes = /^(image\/jpeg|image\/png|image\/webp)$/;
    const allowedExtensions = /^\.(jpg|jpeg|png|webp)$/;
    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimeTypes.test(file.mimetype);

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
    const allowedMimeTypes = /^(image\/jpeg|image\/png|image\/webp|application\/pdf)$/;
    const allowedExtensions = /^\.(jpg|jpeg|png|webp|pdf)$/;
    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimeTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (jpeg, jpg, png, webp) and PDFs are allowed'));
    }
  }
});
