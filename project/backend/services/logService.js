const ConversationLog = require('../models/ConversationLog');
const User = require('../models/User');

class LogService {
  async saveConversation(data) {
    try {
      const {
        userId,
        question,
        answer,
        source,
        sourceDetails = {},
        confidence = 0,
        responseTime = 0,
        metadata = {}
      } = data;

      // Create conversation log
      const log = new ConversationLog({
        userId,
        question,
        answer,
        source,
        sourceDetails,
        confidence,
        responseTime,
        metadata: {
          platform: 'LINE',
          ...metadata
        }
      });

      await log.save();

      // Update user statistics
      await this.updateUserStats(userId);

      return log;
    } catch (error) {
      console.error('Error saving conversation:', error);
      throw error;
    }
  }

  async updateUserStats(userId) {
    try {
      await User.findOneAndUpdate(
        { lineUserId: userId },
        {
          $inc: { 'statistics.totalQuestions': 1 },
          $set: { 'statistics.lastActive': new Date() }
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error('Error updating user stats:', error);
    }
  }

  async getConversationLogs(filters = {}) {
    try {
      const {
        userId,
        source,
        startDate,
        endDate,
        page = 1,
        limit = 50,
        search
      } = filters;

      const query = {};

      if (userId) query.userId = userId;
      if (source) query.source = source;
      
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      if (search) {
        query.$or = [
          { question: { $regex: search, $options: 'i' } },
          { answer: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        ConversationLog.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ConversationLog.countDocuments(query)
      ]);

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error fetching conversation logs:', error);
      throw error;
    }
  }

  async getAnalytics(timeRange = '7d') {
    try {
      const now = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '1d':
          startDate.setDate(now.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }

      const [
        totalConversations,
        sourceBreakdown,
        topQuestions,
        averageConfidence,
        averageResponseTime,
        dailyStats
      ] = await Promise.all([
        // Total conversations
        ConversationLog.countDocuments({
          createdAt: { $gte: startDate }
        }),

        // Source breakdown
        ConversationLog.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          { $group: { _id: '$source', count: { $sum: 1 } } }
        ]),

        // Top questions
        ConversationLog.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          { $group: { _id: '$question', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),

        // Average confidence
        ConversationLog.aggregate([
          { $match: { createdAt: { $gte: startDate }, confidence: { $gt: 0 } } },
          { $group: { _id: null, avgConfidence: { $avg: '$confidence' } } }
        ]),

        // Average response time
        ConversationLog.aggregate([
          { $match: { createdAt: { $gte: startDate }, responseTime: { $gt: 0 } } },
          { $group: { _id: null, avgResponseTime: { $avg: '$responseTime' } } }
        ]),

        // Daily statistics
        ConversationLog.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
              },
              count: { $sum: 1 },
              ragCount: {
                $sum: { $cond: [{ $eq: ['$source', 'RAG'] }, 1, 0] }
              },
              externalCount: {
                $sum: { $cond: [{ $eq: ['$source', 'External'] }, 1, 0] }
              }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ])
      ]);

      return {
        totalConversations,
        sourceBreakdown: sourceBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        topQuestions: topQuestions.map(item => ({
          question: item._id,
          count: item.count
        })),
        averageConfidence: averageConfidence[0]?.avgConfidence || 0,
        averageResponseTime: averageResponseTime[0]?.avgResponseTime || 0,
        dailyStats: dailyStats.map(stat => ({
          date: `${stat._id.year}-${String(stat._id.month).padStart(2, '0')}-${String(stat._id.day).padStart(2, '0')}`,
          total: stat.count,
          rag: stat.ragCount,
          external: stat.externalCount
        }))
      };
    } catch (error) {
      console.error('Error getting analytics:', error);
      throw error;
    }
  }
}

module.exports = new LogService();