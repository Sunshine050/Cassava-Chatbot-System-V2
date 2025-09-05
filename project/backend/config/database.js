const mongoose = require('mongoose');
const logger = require('./logger'); // สมมติคุณมี logger ตามที่ทำไว้

class Database {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
      if (this.connection) return this.connection;

      const mongoUri = process.env.MONGODB_URI;
      if (!mongoUri) throw new Error('MONGODB_URI environment variable is required');

      // เชื่อมต่อ MongoDB แบบ clean ไม่มี warning
      this.connection = await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      logger.info('✅ Connected to MongoDB successfully', { service: 'cassava-chatbot' });
      return this.connection;
    } catch (error) {
      logger.logError(error, { context: 'MongoDB connection' });
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await mongoose.disconnect();
      this.connection = null;
      logger.info('🔌 Disconnected from MongoDB', { service: 'cassava-chatbot' });
    }
  }

  async getDb() {
    if (!this.connection) await this.connect();
    return mongoose.connection.db;
  }

  isConnected() {
    return mongoose.connection.readyState === 1;
  }
}

module.exports = new Database();
