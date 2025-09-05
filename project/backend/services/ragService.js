const { PythonShell } = require('python-shell');
const path = require('path');
const Document = require('../models/Document');
const logger = require('../config/logger');

class RAGService {
  constructor() {
    logger.info('📘 RAGService initialized with SentenceTransformer integration');
  }

  async generateEmbedding(text) {
    try {
      if (!text || typeof text !== 'string') {
        throw new Error('Invalid input: Text must be a non-empty string');
      }

      const options = {
        mode: 'text',
        pythonPath: process.env.PYTHON_PATH || 'python',
        pythonOptions: ['-u'],
        scriptPath: path.join(__dirname, '..', 'services'),
        args: [text]
      };

      const results = await PythonShell.run('embedder.py', options);
      if (!results || results.length === 0) {
        throw new Error('No embedding returned from Python script');
      }

      const embedding = JSON.parse(results[0]);
      if (!Array.isArray(embedding) || embedding.length !== 384) { // ปรับตามมิติของ all-MiniLM-L6-v2
        throw new Error('Invalid embedding format');
      }

      logger.info(`✅ Generated embedding for text (length: ${text.length})`);
      return embedding;
    } catch (error) {
      logger.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  async searchSimilarChunks(queryEmbedding, tier = null, limit = 5) {
    try {
      const pipeline = [
        { $unwind: '$chunks' },
        {
          $addFields: {
            similarity: {
              $let: {
                vars: {
                  dotProduct: {
                    $reduce: {
                      input: { $range: [0, { $size: '$chunks.embedding' }] },
                      initialValue: 0,
                      in: {
                        $add: [
                          '$$value',
                          {
                            $multiply: [
                              { $arrayElemAt: ['$chunks.embedding', '$$this'] },
                              { $arrayElemAt: [queryEmbedding, '$$this'] }
                            ]
                          }
                        ]
                      }
                    }
                  }
                },
                in: '$$dotProduct'
              }
            }
          }
        },
        {
          $match: {
            similarity: { $gte: 0.7 },
            ...(tier && { tier })
          }
        },
        { $sort: { similarity: -1 } },
        { $limit: limit },
        {
          $project: {
            documentId: '$_id',
            filename: '$filename',
            tier: '$tier',
            chunkText: '$chunks.text',
            chunkIndex: '$chunks.chunkIndex',
            similarity: 1
          }
        }
      ];

      const results = await Document.aggregate(pipeline);
      logger.info(`🔍 Found ${results.length} similar chunks for query`);
      return results;
    } catch (error) {
      logger.error('Error searching similar chunks:', error);
      throw new Error(`Failed to search similar chunks: ${error.message}`);
    }
  }

  async searchKnowledgeBase(question) {
    try {
      const questionEmbedding = await this.generateEmbedding(question);
      const tiers = ['A', 'B', 'C'];
      let allResults = [];

      for (const tier of tiers) {
        const tierResults = await this.searchSimilarChunks(questionEmbedding, tier, 3);
        if (tierResults.length > 0) {
          allResults = allResults.concat(tierResults);
          if (tier === 'A' && tierResults.length >= 2) break;
          if (tier === 'B' && allResults.length >= 4) break;
        }
      }

      allResults.sort((a, b) => b.similarity - a.similarity);
      const topResults = allResults.slice(0, 5);

      logger.info(`🔍 Search completed with ${topResults.length} results`);
      return {
        found: topResults.length > 0,
        snippets: topResults.map(result => ({
          text: result.chunkText,
          source: result.filename,
          tier: result.tier,
          similarity: result.similarity,
          documentId: result.documentId,
          chunkIndex: result.chunkIndex
        })),
        confidence: topResults.length > 0 ? topResults[0].similarity : 0
      };
    } catch (error) {
      logger.error('Error searching knowledge base:', error);
      return {
        found: false,
        snippets: [],
        confidence: 0,
        error: error.message
      };
    }
  }

  async addDocument(filename, content, tier = 'B') {
    try {
      logger.info(`📄 Adding document: ${filename}, Tier: ${tier}`);
      const chunks = this.splitIntoChunks(content);

      const chunksWithEmbeddings = [];
      for (let i = 0; i < chunks.length; i++) {
        logger.info(`📑 Generating embedding for chunk ${i + 1}/${chunks.length}`);
        const embedding = await this.generateEmbedding(chunks[i]);
        chunksWithEmbeddings.push({
          text: chunks[i],
          embedding,
          chunkIndex: i
        });
      }

      const document = new Document({
        filename,
        originalName: decodeURIComponent(filename), // แก้ไขชื่อไฟล์
        content,
        tier,
        chunks: chunksWithEmbeddings,
        metadata: {
          processingStatus: 'completed'
        }
      });

      await document.save();
      logger.info(`✅ Document ${filename} added successfully with ${chunks.length} chunks`);
      return document;
    } catch (error) {
      logger.error('Error adding document:', error);
      throw new Error(`Failed to add document: ${error.message}`);
    }
  }

  splitIntoChunks(text, chunkSize = 1000, overlap = 200) {
    try {
      const chunks = [];
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      let currentChunk = '';

      for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        if (currentChunk.length + trimmedSentence.length > chunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          const words = currentChunk.split(' ');
          const overlapWords = words.slice(-Math.floor(overlap / 10));
          currentChunk = overlapWords.join(' ') + ' ' + trimmedSentence;
        } else {
          currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
        }
      }

      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }

      const filteredChunks = chunks.filter(chunk => chunk.length > 50);
      logger.info(`✂️ Split text into ${filteredChunks.length} chunks`);
      return filteredChunks;
    } catch (error) {
      logger.error('Error splitting into chunks:', error);
      throw new Error(`Failed to split text into chunks: ${error.message}`);
    }
  }
}

module.exports = new RAGService();