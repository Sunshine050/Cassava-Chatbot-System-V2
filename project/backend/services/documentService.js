const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { createWorker } = require('tesseract.js');
const { fromPath } = require('pdf2pic');
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
      logger.info('Created directories', { uploadsDir: this.uploadsDir, tempDir: this.tempDir });
    } catch (error) {
      logger.error('Error creating directories', { message: error.message });
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
          text = await this.ocrPDF(filePath, pdfData.numpages || 1);
        }

        if (!text) logger.warn('No text extracted from PDF', { filePath });
        return text.trim();
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword'
      ) {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value.trim();
      } else if (mimeType.startsWith('image/')) {
        if (!options.skipOCR) {
          logger.info('Processing image with OCR', { filePath });
          return await this.ocrImage(filePath);
        }
        logger.warn('Skipping OCR for image', { filePath });
        return '';
      } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      logger.error('Error extracting text', { message: error.message });
      throw error;
    }
  }

  async ocrImage(filePath) {
    const worker = createWorker({ logger: m => logger.debug('Tesseract', m) });
    try {
      await worker.load();
      await worker.loadLanguage('eng+tha');
      await worker.initialize('eng+tha');

      const { data: { text } } = await worker.recognize(filePath);
      return text.trim();
    } catch (error) {
      logger.error('OCR image error', { message: error.message });
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
    const worker = createWorker({ logger: m => logger.debug('Tesseract', m) });

    try {
      await worker.load();
      await worker.loadLanguage('eng+tha');
      await worker.initialize('eng+tha');

      for (let page = 1; page <= numPages; page++) {
        try {
          const image = await converter(page);
          const { data: { text } } = await worker.recognize(image.path);
          fullText += text + '\n';
          await fs.unlink(image.path).catch(() => logger.warn('Failed to delete temp image', { page }));
        } catch (pageErr) {
          logger.error(`OCR error on page ${page}`, { message: pageErr.message });
        }
      }

      return fullText.trim();
    } catch (error) {
      logger.error('OCR PDF error', { message: error.message });
      throw error;
    } finally {
      await worker.terminate();
    }
  }

  async processUploadedFile(file, tier, options = { skipOCR: false }) {
    try {
      const filePath = path.join(this.uploadsDir, file.filename);
      const originalName = Buffer.from(file.originalname, 'binary').toString('utf8');
      logger.info('File upload started', { filename: file.filename, originalName });

      const text = await this.extractTextFromFile(filePath, file.mimetype, options);

      const document = new Document({
        filename: file.filename,
        originalName,
        content: text,
        tier: tier || 'B',
        metadata: {
          fileSize: file.size,
          mimeType: file.mimetype,
          processingStatus: 'processing',
        },
      });

      await document.save();
      logger.info('Document saved', { documentId: document._id, originalName });

      this.processDocumentEmbeddings(document._id, text).catch((err) => {
        logger.error('Background processing error', { documentId: document._id, message: err.message });
        Document.findByIdAndUpdate(document._id, { 'metadata.processingStatus': 'failed' }).catch(() => {});
      });

      return document;
    } catch (error) {
      logger.error('Error processing file', { message: error.message });
      throw error;
    } finally {
      try {
        if (await fs.access(file.path).then(() => true).catch(() => false)) {
          await fs.unlink(file.path);
          logger.info('Cleaned up file', { path: file.path });
        }
      } catch (cleanupError) {
        logger.warn('Cleanup error', { message: cleanupError.message });
      }
    }
  }

  async processDocumentEmbeddings(documentId, content) {
    try {
      const chunks = ragService.splitIntoChunks(content);
      logger.info('Processing embeddings', { documentId, chunkCount: chunks.length });

      const chunksWithEmbeddings = chunks.map((chunk, idx) => ({
        text: chunk,
        embedding: [], // สำหรับตอนนี้เว้นว่าง
        chunkIndex: idx,
      }));

      await Document.findByIdAndUpdate(documentId, {
        chunks: chunksWithEmbeddings,
        'metadata.processingStatus': 'completed',
      });

      logger.info(`Document ${documentId} processed with ${chunks.length} chunks`);
    } catch (error) {
      logger.error('Error processing embeddings', { message: error.message });
      await Document.findByIdAndUpdate(documentId, { 'metadata.processingStatus': 'failed' });
      throw error;
    }
  }
}

module.exports = new DocumentService();
