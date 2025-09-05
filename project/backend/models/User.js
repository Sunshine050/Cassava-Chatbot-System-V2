const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  lineUserId: {
    type: String,
    required: true,
    unique: true,
    sparse: true
  },
  displayName: String,
  profilePicture: String,
  preferences: {
    language: {
      type: String,
      default: 'th'
    },
    farmingRegion: String,
    cropType: [String]
  },
  statistics: {
    totalQuestions: {
      type: Number,
      default: 0
    },
    lastActive: Date,
    averageResponseTime: Number
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index เฉพาะที่จำเป็น
userSchema.index({ 'statistics.lastActive': -1 });

module.exports = mongoose.model('User', userSchema);