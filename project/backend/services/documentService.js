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
          try {
            text = await this.ocrPDF(filePath, pdfData.numpages || 1);
          } catch (ocrErr) {
            logger.error('OCR failed, using fallback', { message: ocrErr.message });
            text = '[OCR failed]';
          }
        }

        return text.trim() || '[OCR failed]';
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword'
      ) {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value.trim() || '[No text extracted]';
      } else if (mimeType.startsWith('image/')) {
        if (!options.skipOCR) {
          logger.info('Processing image with OCR', { filePath });
          try {
            return await this.ocrImage(filePath);
          } catch (ocrErr) {
            logger.error('OCR image failed, using fallback', { message: ocrErr.message });
            return '[OCR failed]';
          }
        }
        logger.warn('Skipping OCR for image', { filePath });
        return '[OCR skipped]';
      } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      logger.error('Error extracting text', { message: error.message });
      return '[Error extracting text]';
    }
  }

  async ocrImage(filePath) {
    const worker = createWorker({ logger: m => logger.debug('Tesseract', m) });
    try {
      const { data: { text } } = await worker.recognize(filePath, 'eng+tha');
      return text.trim() || '[OCR failed]';
    } finally {
      await worker.terminate();
    }
  }

  async ocrPDF(filePath, numPages) {
    let fullText = '';
    const pdf2picOptions = {
      density: 150,
      format: 'png',
      width: 1240,
      height: 1754,
      saveFilename: 'temp_page',
      savedir: this.tempDir,
    };
    const converter = fromPath(filePath, pdf2picOptions);

    for (let page = 1; page <= numPages; page++) {
      let image;
      try {
        image = await converter(page);
      } catch (convErr) {
        logger.error(`PDF to image conversion failed for page ${page}`, { message: convErr.message });
        fullText += `[PDF page ${page} conversion failed]\n`;
        continue;
      }

      const worker = createWorker({ logger: m => logger.debug('Tesseract', m) });
      try {
        const { data: { text } } = await worker.recognize(image.path, 'eng+tha');
        fullText += text.trim() ? text + '\n' : `[OCR failed on page ${page}]\n`;
      } catch (ocrErr) {
        logger.error(`OCR error on page ${page}`, { message: ocrErr.message });
        fullText += `[OCR failed on page ${page}]\n`;
      } finally {
        await worker.terminate();
        await fs.unlink(image.path).catch(() => logger.warn('Failed to delete temp image', { page }));
      }
    }

    return fullText.trim() || '[OCR failed for all pages]';
  }

  async processUploadedFile(file, tier, options = { skipOCR: false }) {
    const filePath = path.join(this.uploadsDir, file.filename);
    const originalName = Buffer.from(file.originalname, 'binary').toString('utf8');

    let text = '[No text]';
    try {
      text = await this.extractTextFromFile(filePath, file.mimetype, options);
    } catch (err) {
      logger.error('Error extracting text, using fallback', { message: err.message });
    }

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

    try {
      await document.save();
      logger.info('Document saved', { documentId: document._id, originalName });
    } catch (saveErr) {
      logger.error('Error saving document', { message: saveErr.message });
      throw saveErr;
    }

    // background embeddings
    this.processDocumentEmbeddings(document._id, text).catch((err) => {
      logger.error('Background processing error', { documentId: document._id, message: err.message });
      Document.findByIdAndUpdate(document._id, { 'metadata.processingStatus': 'failed' }).catch(() => {});
    });

    // cleanup upload
    try {
      if (await fs.access(file.path).then(() => true).catch(() => false)) {
        await fs.unlink(file.path);
        logger.info('Cleaned up file', { path: file.path });
      }
    } catch (cleanupError) {
      logger.warn('Cleanup error', { message: cleanupError.message });
    }

    return document;
  }

  async processDocumentEmbeddings(documentId, content) {
    try {
      const chunks = ragService.splitIntoChunks(content);
      logger.info('Processing embeddings', { documentId, chunkCount: chunks.length });

      const chunksWithEmbeddings = chunks.map((chunk, idx) => ({
        text: chunk,
        embedding: [],
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
