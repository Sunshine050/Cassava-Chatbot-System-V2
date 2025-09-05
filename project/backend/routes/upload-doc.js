const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Document = require('../models/Document');
const documentService = require('../services/documentService');
const logger = require('../config/logger');

const router = express.Router();

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../Uploads');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'binary').toString('utf8');
    logger.debug('Filename processing', { raw: file.originalname, decoded: originalName });
    const safeName = originalName.replace(/[\/\\:*?"<>|]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${safeName}-${uniqueSuffix}${path.extname(originalName)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  },
});

router.post('/', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const originalName = Buffer.from(req.file.originalname, 'binary').toString('utf8');
    const tier = req.body.tier || 'B';
    const skipOCR = req.body.skipOCR === 'true';

    logger.info('File upload started', { originalName, filename: req.file.filename });

    const document = await documentService.processUploadedFile(req.file, tier, { skipOCR });

    res.set('Content-Type', 'application/json; charset=utf-8');
    res.json({
      success: true,
      message: 'File uploaded and processing started',
      document: {
        documentId: document._id,
        filename: originalName, // ไม่ encode
        title: originalName.replace(/\.[^/.]+$/, ''), // ไม่ encode
        tier: document.tier,
        status: document.metadata.processingStatus,
        textLength: document.content?.length || 0,
        chunksCount: document.chunks?.length || 0,
        createdAt: document.createdAt,
        mimeType: req.file.mimetype,
      },
    });
  } catch (error) {
    logger.error('Upload error', { message: error.message });
    try {
      if (req.file?.path && (await fs.access(req.file.path).then(() => true).catch(() => false))) {
        await fs.unlink(req.file.path);
      }
    } catch (cleanupError) {
      logger.error('Cleanup error', { message: cleanupError.message });
    }
    res.status(500).json({ error: 'การอัปโหลดล้มเหลว', message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { tier, limit, page } = req.query;
    const query = tier ? { tier } : {};
    const documents = await Document.find(query)
      .select('-chunks.embedding -content')
      .limit(parseInt(limit) || 20)
      .skip((parseInt(page) - 1) * parseInt(limit) || 0)
      .sort({ createdAt: -1 })
      .lean();

    res.set('Content-Type', 'application/json; charset=utf-8');
    res.json({
      success: true,
      documents: documents.map((doc) => {
        const originalName = doc.originalName || doc.filename; // ไม่ decode ไม่ encode
        logger.debug('Document retrieved', { documentId: doc._id, originalName });
        return {
          documentId: doc._id,
          filename: originalName,
          title: originalName.replace(/\.[^/.]+$/, ''),
          tier: doc.tier,
          status: doc.metadata.processingStatus,
          chunksCount: doc.chunks?.length || 0,
          createdAt: doc.createdAt,
          mimeType: doc.metadata.mimeType,
        };
      }),
    });
  } catch (error) {
    logger.error('Error fetching documents', { message: error.message });
    res.status(500).json({ error: 'Failed to fetch documents', message: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const documents = await Document.find()
      .select('tier metadata.processingStatus metadata.fileSize chunks')
      .lean();

    const tierStats = { A: { documents: 0, chunks: 0 }, B: { documents: 0, chunks: 0 }, C: { documents: 0, chunks: 0 } };
    let totalChunks = 0;

    documents.forEach((doc) => {
      const tier = doc.tier || 'B';
      const chunksCount = doc.chunks?.length || 0;
      tierStats[tier].documents += 1;
      tierStats[tier].chunks += chunksCount;
      totalChunks += chunksCount;
    });

    res.set('Content-Type', 'application/json; charset=utf-8');
    res.json({
      success: true,
      data: {
        totalDocuments: documents.length,
        totalChunks,
        tierStats,
      },
    });
  } catch (error) {
    logger.error('Error fetching stats', { message: error.message });
    res.status(500).json({ error: 'Failed to fetch stats', message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ error: 'Document not found' });

    const filePath = path.join(__dirname, '../Uploads', document.filename);
    if (await fs.access(filePath).then(() => true).catch(() => false)) {
      await fs.unlink(filePath);
      logger.info('Deleted file', { path: filePath });
    }

    await document.deleteOne();
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    logger.error('Error deleting document', { message: error.message });
    res.status(500).json({ error: 'Failed to delete document', message: error.message });
  }
});

module.exports = router;
