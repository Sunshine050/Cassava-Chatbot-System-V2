const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { createWorker } = require('tesseract.js');
const { fromPath } = require('pdf2pic');
const iconv = require('iconv-lite'); // เพิ่มเพื่อจัดการ encoding ภาษาไทย
const Document = require('../models/Document');
const ragService = require('./ragService');
const logger = require('../config/logger');

class DocumentService {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../Uploads');
    this.tempDir = path.join(__dirname, '../temp');
    this.ensureDirs();
  }

  async ensureDirs() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
      logger.info('Created uploads and temp directories', { uploadsDir: this.uploadsDir, tempDir: this.tempDir });
    } catch (error) {
      logger.error('Error creating directories:', error);
    }
  }

  async extractTextFromFile(filePath, mimeType, options = { skipOCR: false }) {
    try {
      if (mimeType === 'application/pdf') {
        const dataBuffer = await fs.readFile(filePath);
        const pdfData = await pdfParse(dataBuffer);
        let text = pdfData.text.trim();

        if (!text && !options.skipOCR) {
          logger.warn('No text found in PDF, attempting OCR', { filePath });
          try {
            text = await this.ocrPDF(filePath, pdfData.numpages || 1);
          } catch (ocrErr) {
            logger.error('OCR failed:', { error: ocrErr.message, stack: ocrErr.stack });
            text = '';
          }
        }

        if (!text) {
          logger.warn('No text extracted from PDF', { filePath });
        }
        // แปลง encoding เป็น UTF-8 เพื่อให้แน่ใจว่าภาษาไทยถูกต้อง
        return iconv.decode(Buffer.from(text, 'utf8'), 'utf8').trim();

      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword'
      ) {
        const result = await mammoth.extractRawText({ path: filePath });
        // แปลง encoding เป็น UTF-8
        return iconv.decode(Buffer.from(result.value, 'utf8'), 'utf8').trim();
      } else if (mimeType === 'image/png' || mimeType === 'image/jpeg') {
        if (!options.skipOCR) {
          logger.info('Processing image file with OCR', { filePath, mimeType });
          try {
            const text = await this.ocrImage(filePath);
            return iconv.decode(Buffer.from(text, 'utf8'), 'utf8').trim();
          } catch (ocrErr) {
            logger.error('OCR failed for image:', { error: ocrErr.message, stack: ocrErr.stack });
            return '';
          }
        } else {
          logger.warn('Skipping OCR for image as per options', { filePath });
          return '';
        }
      } else {
        logger.error('Unsupported file type', { mimeType });
        return '';
      }
    } catch (error) {
      logger.error('Error extracting text from file:', { error: error.message, stack: error.stack });
      return '';
    }
  }

  async ocrImage(filePath) {
    const tesseractLogger = (m) => logger.info('Tesseract', m.payload);

    const worker = await createWorker({
      logger: tesseractLogger,
    });

    try {
      await worker.loadLanguage('tha+eng');
      await worker.initialize('tha+eng');
      await worker.setParameters({
        tessedit_char_whitelist: 'ก-๙a-zA-Z0-9\s',
        preserve_interword_spaces: '1', // รักษาช่องว่างระหว่างคำ
        tessedit_ocr_engine_mode: 1, // ใช้ LSTM OCR engine เพื่อความแม่นยำ
      });

      const { data: { text } } = await worker.recognize(filePath);
      return text.trim();
    } catch (error) {
      logger.error('Error during image OCR:', { error: error.message, stack: error.stack });
      throw error;
    } finally {
      await worker.terminate();
    }
  }

  async ocrPDF(filePath, numPages) {
    let fullText = '';
    const pdf2picOptions = {
      density: 300,
      format: 'png',
      width: 2480,
      height: 3508,
      saveFilename: 'temp_page',
      savedir: this.tempDir,
    };
    const converter = fromPath(filePath, pdf2picOptions);

    const tesseractLogger = (m) => logger.info('Tesseract', m.payload);

    const worker = await createWorker({
      logger: tesseractLogger,
    });

    try {
      await worker.loadLanguage('tha+eng');
      await worker.initialize('tha+eng');
      await worker.setParameters({
        tessedit_char_whitelist: 'ก-๙a-zA-Z0-9\s',
        preserve_interword_spaces: '1',
        tessedit_ocr_engine_mode: 1,
      });

      for (let page = 1; page <= numPages; page++) {
        try {
          const image = await converter(page).catch((err) => {
            logger.error(`Failed to convert page ${page} to image`, { error: err.message });
            return null;
          });
          if (image) {
            const { data: { text } } = await worker.recognize(image.path).catch((err) => {
              logger.error(`OCR failed on page ${page}`, { error: err.message });
              return { data: { text: '' } };
            });
            fullText += text + '\n';
            await fs.unlink(image.path).catch((err) => logger.warn('Failed to delete temp image', { path: image.path, error: err }));
          }
        } catch (pageErr) {
          logger.error(`OCR processing error on page ${page}:`, { error: pageErr.message, stack: pageErr.stack });
        }
      }
    } catch (error) {
      logger.error('Error during OCR PDF:', { error: error.message, stack: error.stack });
      throw error;
    } finally {
      await worker.terminate();
    }

    return iconv.decode(Buffer.from(fullText, 'utf8'), 'utf8').trim();
  }

  async processUploadedFile(file, tier, options = { skipOCR: false }) {
    try {
      const filePath = path.join(this.uploadsDir, file.filename);
      const text = await this.extractTextFromFile(filePath, file.mimetype, options);

      const document = new Document({
        filename: file.filename,
        originalName: file.originalname,
        content: text,
        tier: tier || 'B',
        metadata: {
          fileSize: file.size,
          mimeType: file.mimetype,
          processingStatus: 'pending',
        },
      });

      await document.save();
      logger.info('Document saved', { documentId: document._id });

      this.processDocumentEmbeddings(document._id).catch((err) => {
        logger.error('Background processing error for document', { documentId: document._id, error: err.message });
      });

      return document;
    } catch (error) {
      logger.error('Error processing uploaded file:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async processDocumentEmbeddings(documentId) {
    try {
      const document = await Document.findById(documentId);
      if (!document) throw new Error('Document not found');

      const text = document.content;
      if (!text) {
        document.metadata.processingStatus = 'failed';
        await document.save();
        logger.warn('No text available for embeddings', { documentId });
        return;
      }

      const chunks = ragService.splitIntoChunks(text);

      const chunksWithEmbeddings = [];
      for (let i = 0; i < chunks.length; i++) {
        try {
          logger.info(`Processing chunk ${i + 1}/${chunks.length}`, { documentId });
          const embedding = await ragService.generateEmbedding(chunks[i]);
          chunksWithEmbeddings.push({ text: chunks[i], embedding, chunkIndex: i });
        } catch (chunkErr) {
          logger.error(`Failed processing chunk ${i}`, { error: chunkErr.message });
        }
      }

      document.chunks = chunksWithEmbeddings;
      document.metadata.processingStatus = 'completed';
      await document.save();
      logger.info('Document embeddings processed', { documentId });
    } catch (error) {
      logger.error('Error processing document embeddings:', { error: error.message, stack: error.stack });
      const document = await Document.findById(documentId);
      if (document) {
        document.metadata.processingStatus = 'failed';
        await document.save();
      }
      throw error;
    }
  }
}

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection caught globally:', { reason: reason?.message || reason, promise });
});

module.exports = new DocumentService();