const mongoose = require('mongoose');

const conversationLogSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  question: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  source: {
    type: String,
    enum: ['RAG', 'External', 'Fallback'],
    required: true
  },
  sourceDetails: {
    ragDocuments: [{
      documentId: mongoose.Schema.Types.ObjectId,
      chunkIndex: Number,
      similarity: Number
    }],
    externalApi: String,
    tier: String
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1
  },
  responseTime: {
    type: Number // milliseconds
  },
  metadata: {
    platform: {
      type: String,
      default: 'LINE'
    },
    sessionId: String,
    userAgent: String
  }
}, {
  timestamps: true
});

// Indexes for analytics
conversationLogSchema.index({ createdAt: -1 });
conversationLogSchema.index({ source: 1 });
conversationLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ConversationLog', conversationLogSchema);