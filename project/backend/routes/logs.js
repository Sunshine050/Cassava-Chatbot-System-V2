const express = require('express');
const logService = require('../services/logService');

const router = express.Router();

// Get conversation logs
router.get('/', async (req, res) => {
  try {
    const { userId, source, startDate, endDate, page, limit, search } = req.query;
    const result = await logService.getConversationLogs({
      userId,
      source,
      startDate,
      endDate,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      search
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs', message: error.message });
  }
});

// Get analytics
router.get('/analytics', async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query;
    const analytics = await logService.getAnalytics(timeRange);
    res.json({ success: true, analytics, timeRange });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics', message: error.message });
  }
});

// Get top questions
router.get('/top-questions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topQuestions = await logService.getTopQuestions(limit);
    res.json({ success: true, data: topQuestions });
  } catch (error) {
    console.error('Error fetching top questions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch top questions', message: error.message });
  }
});

// Get conversation by ID
router.get('/:logId', async (req, res) => {
  try {
    const ConversationLog = require('../models/ConversationLog');
    const log = await ConversationLog.findById(req.params.logId).lean();
    if (!log) return res.status(404).json({ error: 'Conversation log not found' });
    res.json({ success: true, log });
  } catch (error) {
    console.error('Error fetching conversation log:', error);
    res.status(500).json({ error: 'Failed to fetch conversation log', message: error.message });
  }
});

// Export logs as CSV
router.get('/export/csv', async (req, res) => {
  try {
    const { userId, source, startDate, endDate, limit = 1000 } = req.query;
    const result = await logService.getConversationLogs({
      userId,
      source,
      startDate,
      endDate,
      page: 1,
      limit: parseInt(limit)
    });

    const csvHeader = 'Date,User ID,Question,Answer,Source,Confidence,Response Time (ms)\n';
    const csvRows = result.logs.map(log => {
      const date = new Date(log.createdAt).toISOString();
      const question = `"${log.question.replace(/"/g, '""')}"`;
      const answer = `"${log.answer.replace(/"/g, '""')}"`;
      return `${date},${log.userId},${question},${answer},${log.source},${log.confidence || 0},${log.responseTime || 0}`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=conversation-logs.csv');
    res.send(csvHeader + csvRows);
  } catch (error) {
    console.error('Error exporting logs:', error);
    res.status(500).json({ error: 'Failed to export logs', message: error.message });
  }
});

module.exports = router;
