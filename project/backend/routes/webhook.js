const express = require('express');
const agentService = require('../services/agentService');
const logService = require('../services/logService');

const router = express.Router();

// LINE Webhook endpoint
router.post('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Simulate LINE webhook payload structure
    const { events } = req.body;
    
    if (!events || !Array.isArray(events)) {
      return res.status(400).json({
        error: 'Invalid webhook payload format'
      });
    }

    const responses = [];

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        const question = event.message.text;
        
        try {
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
              platform: 'LINE',
              replyToken: event.replyToken
            }
          });

          responses.push({
            replyToken: event.replyToken,
            messages: [{
              type: 'text',
              text: result.answer
            }]
          });

        } catch (error) {
          console.error('Error processing message:', error);
          
          responses.push({
            replyToken: event.replyToken,
            messages: [{
              type: 'text',
              text: 'ขออภัย เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง'
            }]
          });
        }
      }
    }

    res.json({
      success: true,
      responses,
      processedEvents: events.length
    });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Test endpoint for webhook simulation
router.post('/test', async (req, res) => {
  try {
    const { message, userId = 'test-user' } = req.body;
    
    if (!message) {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    const startTime = Date.now();
    
    // Simulate LINE webhook event
    const simulatedEvent = {
      events: [{
        type: 'message',
        message: {
          type: 'text',
          text: message
        },
        source: {
          userId: userId
        },
        replyToken: 'test-reply-token-' + Date.now()
      }]
    };

    // Process through webhook
    const result = await agentService.processQuestion(message, userId);
    const responseTime = Date.now() - startTime;

    // Log conversation
    await logService.saveConversation({
      userId,
      question: message,
      answer: result.answer,
      source: result.source,
      sourceDetails: result.sourceDetails,
      confidence: result.confidence,
      responseTime,
      metadata: {
        platform: 'TEST',
        testMode: true
      }
    });

    res.json({
      success: true,
      question: message,
      answer: result.answer,
      source: result.source,
      confidence: result.confidence,
      responseTime: responseTime + 'ms',
      userId
    });

  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;