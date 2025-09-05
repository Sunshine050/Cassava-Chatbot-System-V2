const MistralClient = require('@mistralai/mistralai').default;
const logger = require('../config/logger');

class MistralService {
  constructor() {
    if (!process.env.MISTRAL_API_KEY) {
      logger.error('Mistral API key not configured');
      throw new Error('MISTRAL_API_KEY environment variable is required');
    }

    this.client = new MistralClient(process.env.MISTRAL_API_KEY);
    
    this.systemPrompt = `คุณคือผู้ช่วยด้านมันสำปะหลังสำหรับเกษตรกรไทย 
ตอบแบบเข้าใจง่าย กระชับ และเป็นประโยชน์
อ้างอิงข้อมูลจากเอกสารที่มีอยู่ก่อน ถ้าไม่มีจึงหาข้อมูลจากภายนอก

หลักการตอบคำถาม:
1. ใช้ข้อมูลจากเอกสารเป็นหลัก
2. ตอบแบบเข้าใจง่าย ไม่ซับซ้อน
3. ให้คำแนะนำที่ practical และใช้ได้จริง
4. หากไม่แน่ใจ ให้แนะนำให้ปรึกษาผู้เชี่ยวชาญเพิ่มเติม
5. ตอบเป็นภาษาไทยเสมอ`;

    logger.info('Mistral AI service initialized successfully');
  }

  async generateResponse(question, context = '', externalData = null) {
    const startTime = Date.now();
    
    try {
      logger.info('Generating Mistral AI response', {
        questionLength: question.length,
        hasContext: !!context,
        hasExternalData: !!externalData
      });

      let prompt = `คำถาม: ${question}`;

      if (context) {
        prompt += `\n\nข้อมูลจากฐานความรู้:\n${context}`;
      }

      if (externalData) {
        prompt += `\n\nข้อมูลเพิ่มเติม (อากาศ/สภาพแวดล้อม):\n${JSON.stringify(externalData, null, 2)}`;
      }

      const chatResponse = await this.client.chat({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        maxTokens: 800
      });

      const response = chatResponse.choices[0].message.content;
      const duration = Date.now() - startTime;

      logger.logApiCall('Mistral AI', 'chat/completions', duration, true, {
        model: 'mistral-large-latest',
        tokensUsed: chatResponse.usage?.totalTokens || 0,
        responseLength: response.length
      });

      return {
        response,
        usage: chatResponse.usage,
        model: 'mistral-large-latest'
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.logApiCall('Mistral AI', 'chat/completions', duration, false, {
        error: error.message
      });
      
      logger.logError(error, {
        service: 'MistralService',
        method: 'generateResponse',
        questionLength: question.length
      });
      
      throw new Error('Failed to generate AI response');
    }
  }

  calculateConfidenceScore(chunks, externalData) {
    let confidence = 0.3; // Base confidence

    if (chunks && chunks.length > 0) {
      // Higher confidence with more relevant chunks
      const avgSimilarity = chunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / chunks.length;
      confidence += avgSimilarity * 0.6;

      // Bonus for tier A knowledge
      const tierACount = chunks.filter(chunk => chunk.tier === 'A').length;
      confidence += tierACount * 0.1;
    }

    if (externalData) {
      confidence += 0.2; // Bonus for external data
    }

    return Math.min(confidence, 1.0); // Cap at 1.0
  }

  needsExternalData(question) {
    const weatherKeywords = ['อากาศ', 'ฝน', 'แดด', 'ความชื้น', 'อุณหภูมิ', 'ดินแห้ง', 'น้ำท่วม'];
    const questionLower = question.toLowerCase();
    
    return weatherKeywords.some(keyword => questionLower.includes(keyword));
  }

  prepareContext(chunks) {
    if (!chunks || chunks.length === 0) {
      return '';
    }

    return chunks
      .map((chunk, index) => `[${chunk.tier}${index + 1}] ${chunk.text}`)
      .join('\n\n');
  }
}

module.exports = new MistralService();