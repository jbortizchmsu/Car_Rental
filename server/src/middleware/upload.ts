import multer from 'multer';
import path from 'path';

// Memory storage keeps file buffers in memory for direct cloud upload (Supabase Storage)
const storage = multer.memoryStorage();

export const vehicleImageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = /^(image\/jpeg|image\/png|image\/webp)$/;
    const allowedExtensions = /^\.(jpg|jpeg|png|webp)$/;
    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimeTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, or WEBP images up to 10MB are allowed.'));
    }
  }
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = /^(image\/jpeg|image\/png|image\/webp|application\/pdf)$/;
    const allowedExtensions = /^\.(jpg|jpeg|png|webp|pdf)$/;
    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimeTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (jpeg, jpg, png, webp) and PDFs up to 10MB are allowed'));
    }
  }
});
