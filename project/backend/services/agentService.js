const mistralService = require('./mistralService');
const ragService = require('./ragService');
const weatherService = require('./weatherService');
const logger = require('../config/logger');

class AgentService {
  async processQuestion(question, userId = 'anonymous') {
    const startTime = Date.now();
    
    try {
      logger.info('Processing question', {
        userId,
        questionLength: question.length,
        question: question.substring(0, 100) + (question.length > 100 ? '...' : '')
      });

      // Step 1: Search knowledge base using RAG
      const ragResult = await ragService.searchKnowledgeBase(question);
      
      logger.info('RAG search completed', {
        userId,
        found: ragResult.found,
        snippetsCount: ragResult.snippets.length,
        confidence: ragResult.confidence
      });

      let externalData = null;
      let finalAnswer = '';
      let source = 'RAG';
      let confidence = ragResult.confidence;

      // Step 2: Prepare context from RAG results
      const context = mistralService.prepareContext(ragResult.snippets);

      // Step 3: Check if external data is needed
      if (!ragResult.found || mistralService.needsExternalData(question)) {
        try {
          logger.info('Fetching external weather data', { userId });
          externalData = await weatherService.getCurrentWeather();
          
          if (!ragResult.found) {
            source = 'External';
          } else {
            source = 'Hybrid';
          }
          
          logger.info('External data fetched successfully', {
            userId,
            location: externalData.location,
            temperature: externalData.temperature
          });
        } catch (weatherError) {
          logger.logError(weatherError, {
            service: 'AgentService',
            method: 'processQuestion',
            step: 'fetchWeatherData',
            userId
          });
        }
      }

      // Step 4: Generate response using Mistral AI
      const aiResult = await mistralService.generateResponse(question, context, externalData);
      finalAnswer = aiResult.response;

      // Step 5: Calculate final confidence score
      confidence = mistralService.calculateConfidenceScore(ragResult.snippets, externalData);

      const totalDuration = Date.now() - startTime;

      logger.info('Question processing completed', {
        userId,
        source,
        confidence,
        duration: `${totalDuration}ms`,
        answerLength: finalAnswer.length,
        tokensUsed: aiResult.usage?.totalTokens || 0
      });

      return {
        answer: finalAnswer,
        source,
        confidence,
        sourceDetails: {
          ragDocuments: ragResult.snippets.map(snippet => ({
            documentId: snippet.documentId,
            chunkIndex: snippet.chunkIndex,
            similarity: snippet.similarity,
            tier: snippet.tier
          })),
          externalApi: externalData ? 'OpenWeatherMap' : null,
          tier: ragResult.snippets.length > 0 ? ragResult.snippets[0].tier : null
        },
        usage: aiResult.usage
      };

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      
      logger.logError(error, {
        service: 'AgentService',
        method: 'processQuestion',
        userId,
        duration: `${totalDuration}ms`,
        questionLength: question.length
      });

      // Fallback response
      return {
        answer: 'ขออภัย เกิดข้อผิดพลาดในการประมวลผลคำถาม กรุณาลองใหม่อีกครั้งหรือติดต่อผู้ดูแลระบบ',
        source: 'Error',
        confidence: 0,
        sourceDetails: {
          error: error.message
        }
      };
    }
  }

  async processBatchQuestions(questions, userId = 'anonymous') {
    logger.info('Processing batch questions', {
      userId,
      questionsCount: questions.length
    });

    const results = [];
    
    for (let i = 0; i < questions.length; i++) {
      try {
        const result = await this.processQuestion(questions[i], userId);
        results.push({
          question: questions[i],
          ...result,
          batchIndex: i
        });
      } catch (error) {
        logger.logError(error, {
          service: 'AgentService',
          method: 'processBatchQuestions',
          userId,
          batchIndex: i,
          question: questions[i]
        });

        results.push({
          question: questions[i],
          answer: 'เกิดข้อผิดพลาดในการประมวลผลคำถามนี้',
          source: 'Error',
          confidence: 0,
          batchIndex: i
        });
      }
    }

    logger.info('Batch processing completed', {
      userId,
      totalQuestions: questions.length,
      successfulResults: results.filter(r => r.source !== 'Error').length
    });

    return results;
  }
}

module.exports = new AgentService();