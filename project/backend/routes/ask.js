const express = require('express');
const agentService = require('../services/agentService');
const logService = require('../services/logService');

const router = express.Router();

// Direct ask endpoint
router.post('/', async (req, res) => {
  try {
    const startTime = Date.now();
    const { question, userId = 'anonymous', sessionId } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        error: 'Question is required and must be a string'
      });
    }

    if (question.trim().length === 0) {
      return res.status(400).json({
        error: 'Question cannot be empty'
      });
    }

    // Process question through chatbot workflow
    const result = await agentService.processQuestion(question, userId);
    const responseTime = Date.now() - startTime;

    // Log conversation
    await logService.saveConversation({
      userId,
      question,
      answer: result.answer,
      source: result.source,
      sourceDetails: result.sourceDetails,
      confidence: result.confidence,
      responseTime,
      metadata: {
        platform: 'API',
        sessionId,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      success: true,
      question,
      answer: result.answer,
      source: result.source,
      confidence: result.confidence,
      responseTime: responseTime + 'ms',
      sourceDetails: {
        documentsUsed: result.sourceDetails.ragDocuments?.length || 0,
        tier: result.sourceDetails.tier,
        externalApi: result.sourceDetails.externalApi
      }
    });

  } catch (error) {
    console.error('Ask endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Batch ask endpoint for multiple questions
router.post('/batch', async (req, res) => {
  try {
    const { questions, userId = 'anonymous' } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({
        error: 'Questions must be an array'
      });
    }

    if (questions.length === 0) {
      return res.status(400).json({
        error: 'At least one question is required'
      });
    }

    if (questions.length > 10) {
      return res.status(400).json({
        error: 'Maximum 10 questions per batch'
      });
    }

    const results = [];
    
    for (const question of questions) {
      try {
        const startTime = Date.now();
        const result = await agentService.processQuestion(question, userId);
        const responseTime = Date.now() - startTime;

        // Log each conversation
        await logService.saveConversation({
          userId,
          question,
          answer: result.answer,
          source: result.source,
          sourceDetails: result.sourceDetails,
          confidence: result.confidence,
          responseTime,
          metadata: {
            platform: 'API_BATCH',
            batchIndex: results.length
          }
        });

        results.push({
          question,
          answer: result.answer,
          source: result.source,
          confidence: result.confidence,
          responseTime: responseTime + 'ms'
        });

      } catch (error) {
        console.error(`Error processing question "${question}":`, error);
        results.push({
          question,
          error: 'Failed to process question',
          source: 'Error'
        });
      }
    }

    res.json({
      success: true,
      results,
      totalProcessed: results.length
    });

  } catch (error) {
    console.error('Batch ask endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;