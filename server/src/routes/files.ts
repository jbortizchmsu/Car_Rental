import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs';

const router = Router();

// GET /api/files/:fileId
// Securely serve files based on permissions
router.get('/:fileId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { fileId } = req.params;

    // Check if it's a BookingDocument
    const doc = await prisma.bookingDocument.findUnique({
      where: { id: fileId },
      include: { booking: true }
    });

    if (doc) {
      // Permission: Admin OR Owner of the booking
      if (req.user!.role !== 'admin' && doc.booking.customerId !== req.user!.id) {
        return res.status(403).json({ error: 'Unauthorized to view this document' });
      }

      const filePath = path.join(__dirname, '..', '..', doc.fileUrl);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        let contentType = 'application/octet-stream';
        if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.webp') contentType = 'image/webp';
        else if (ext === '.pdf') contentType = 'application/pdf';

        res.setHeader('Content-Type', contentType);
        return res.sendFile(filePath);
      }
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Check if it's a PaymentProof
    const proof = await prisma.paymentProof.findUnique({
      where: { id: fileId },
      include: { payment: { include: { booking: true } } }
    });

    if (proof) {
      // Permission: Admin OR Owner of the booking
      if (req.user!.role !== 'admin' && proof.payment.booking.customerId !== req.user!.id) {
        return res.status(403).json({ error: 'Unauthorized to view this proof' });
      }

      let url = proof.proofUrl;
      if (url.startsWith('/uploads/.uploads/')) {
        url = url.replace('/uploads/.uploads/', '.uploads/');
      } else if (url.startsWith('/uploads/')) {
        url = url.replace('/uploads/', '.uploads/');
      }

      const filePath = path.join(__dirname, '..', '..', url);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        let contentType = 'application/octet-stream';
        if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.webp') contentType = 'image/webp';
        else if (ext === '.pdf') contentType = 'application/pdf';

        res.setHeader('Content-Type', contentType);
        return res.sendFile(filePath);
      }
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.status(404).json({ error: 'Document record not found' });
  } catch (error) {
    console.error('File serving error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

export default router;
