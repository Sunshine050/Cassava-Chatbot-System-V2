const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Document = require('../models/Document');
const documentService = require('../services/documentService');
const logger = require('../config/logger');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../Uploads');
    fs.mkdir(uploadPath, { recursive: true })
      .then(() => cb(null, uploadPath))
      .catch((err) => cb(err));
  },
  filename: (req, file, cb) => {
    // ใช้ชื่อไฟล์ดั้งเดิมโดยแปลง UTF-8 และจัดการตัวอักษรพิเศษอย่างชัดเจน
    let safeName = Buffer.from(decodeURIComponent(file.originalname), 'utf8')
      .toString('utf8')
      .normalize('NFC');
    safeName = safeName.replace(/[^\w\s.-ก-๙]/gi, '_');
    const uniqueSuffix = `-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${safeName}${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024 },
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
    logger.info('Received file upload', {
      originalName: req.file.originalname,
      decodedOriginalName: decodeURIComponent(req.file.originalname),
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    const tier = req.body.tier || 'B';
    const skipOCR = req.body.skipOCR === 'true' ? true : false;

    const document = await documentService.processUploadedFile(req.file, tier, { skipOCR }).catch((err) => {
      logger.error('Error processing file in service:', { error: err.message, stack: err.stack });
      throw err;
    });

    res.json({
      success: true,
      message: 'เริ่มการประมวลผลไฟล์เรียบร้อยแล้ว',
      document: {
        documentId: document._id,
        filename: decodeURIComponent(req.file.originalname),
        title: decodeURIComponent(req.file.originalname).replace(/\.[^/.]+$/, ''),
        tier: document.tier,
        status: document.metadata.processingStatus,
        textLength: document.content?.length || 0,
        chunksCount: document.chunks?.length || 0,
        createdAt: document.createdAt,
        mimeType: req.file.mimetype,
      },
    });
  } catch (error) {
    logger.error('Upload error:', { message: error.message, stack: error.stack });
    try {
      if (req.file && (await fs.access(req.file.path).then(() => true).catch(() => false))) {
        await fs.unlink(req.file.path);
        logger.info('Cleaned up file after error', { path: req.file.path });
      }
    } catch (cleanupError) {
      logger.error('Error cleaning up file:', cleanupError);
    }
    res.status(500).json({ error: 'การอัปโหลดล้มเหลว', message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { tier, limit } = req.query;
    const query = tier ? { tier } : {};
    const documents = await Document.find(query)
      .limit(parseInt(limit) || 0)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      documents: documents.map((doc) => ({
        documentId: doc._id,
        filename: doc.originalName || doc.filename,
        title: (doc.originalName || doc.filename).replace(/\.[^/.]+$/, ''),
        tier: doc.tier,
        status: doc.metadata.processingStatus,
        chunksCount: doc.chunks?.length || 0,
        createdAt: doc.createdAt,
        mimeType: doc.metadata.mimeType,
      })),
    });
  } catch (error) {
    logger.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents', message: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await Document.aggregate([
      { $group: {
        _id: '$tier',
        count: { $sum: 1 },
        totalSize: { $sum: { $ifNull: ['$metadata.fileSize', 0] } },
        chunksCount: { $sum: { $size: { $ifNull: ['$chunks', []] } } },
        processingStatus: { $push: '$metadata.processingStatus' },
      }},
    ]);

    res.json({
      success: true,
      stats: stats.map((stat) => ({
        tier: stat._id,
        count: stat.count,
        totalSize: stat.totalSize,
        chunksCount: stat.chunksCount,
        processingStatus: stat.processingStatus.reduce((acc, status) => {
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {}),
      })),
    });
  } catch (error) {
    logger.error('Error fetching stats:', error);
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
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    logger.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document', message: error.message });
  }
});

module.exports = router;