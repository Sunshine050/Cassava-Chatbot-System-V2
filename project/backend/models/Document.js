const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  tier: {
    type: String,
    enum: ['A', 'B', 'C'],
    default: 'B'
  },
  chunks: [{
    text: String,
    embedding: {
      type: [Number],
      validate: {
        validator: function(v) {
          return v.length === 384; // ปรับตามมิติของ sentence-transformers
        },
        message: 'Embedding must have 384 dimensions'
      }
    },
    chunkIndex: Number
  }],
  metadata: {
    fileSize: Number,
    mimeType: String,
    uploadedBy: String,
    processingStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    }
  }
}, {
  timestamps: true
});

// Indexes
documentSchema.index({ tier: 1 });
documentSchema.index({ 'metadata.processingStatus': 1 });

module.exports = mongoose.model('Document', documentSchema);