# 🌱 Cassava Chatbot System

ระบบแชทบอทเฉพาะทางด้านมันสำปะหลัง พร้อม RAG (Retrieval Augmented Generation) และ Mistral AI Agent สำหรับเกษตรกรไทย

## 🏗️ Architecture

```
cassava-chatbot/
├── backend/                 # Node.js + Express API Server
│   ├── server.js           # Main server file
│   ├── config/             # Configuration files
│   │   ├── database.js     # MongoDB connection
│   │   └── logger.js       # Winston logging setup
│   ├── models/             # MongoDB/Mongoose models
│   │   ├── Document.js         # Document & embeddings
│   │   ├── ConversationLog.js  # Chat logs
│   │   └── User.js            # User profiles
│   ├── services/           # Business logic services
│   │   ├── ragService.js      # RAG & vector search
│   │   ├── mistralService.js  # Mistral AI integration
│   │   ├── agentService.js    # AI agent workflow
│   │   ├── weatherService.js  # Weather API integration
│   │   ├── logService.js      # Logging & analytics
│   │   └── documentService.js # Document processing
│   ├── logs/               # Application logs
│   └── routes/               # API endpoints
│       ├── webhook.js        # LINE webhook
│       ├── ask.js           # Direct queries
│       ├── upload-doc.js    # File uploads
│       └── logs.js          # Monitoring
├── src/                    # React Admin Dashboard
│   ├── components/         # React components
│   └── App.tsx            # Main app component
├── vercel.json             # Vercel deployment config
├── render.yaml             # Render deployment config
└── package.json           # Project dependencies
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account with Vector Search enabled
- Mistral AI API key
- OpenWeatherMap API key

### Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd cassava-chatbot

# 2. Install all dependencies
npm run setup

# 3. Configure environment variables
cp backend/.env.example backend/.env
cp .env.example .env

# Edit backend/.env with your API keys:
# - MONGODB_URI
# - MISTRAL_API_KEY
# - OPENWEATHER_API_KEY
```

### Running the Application

```bash
# Option 1: Run both frontend and backend together
npm run start:all

# Option 2: Run separately (recommended for development)
npm run backend    # Terminal 1 - Backend API (port 3001)
npm run dev        # Terminal 2 - Admin Dashboard (port 5173)
```

### Testing the System

```bash
# Test API endpoints
npm run test:api

# Test chatbot directly
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "มันสำปะหลังควรปลูกเมื่อไหร่", "userId": "test-user"}'

# Test LINE webhook simulation
curl -X POST http://localhost:3001/api/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"message": "สวัสดี", "userId": "line-user-123"}'
```

## 📡 API Endpoints

### Core Chatbot APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ask` | POST | Direct chatbot query |
| `/api/ask/batch` | POST | Batch questions processing |
| `/api/webhook` | POST | LINE OA webhook receiver |
| `/api/webhook/test` | POST | Test webhook simulation |

### Document Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload-doc` | POST | Upload single document |
| `/api/upload-doc/batch` | POST | Upload multiple documents |
| `/api/upload-doc` | GET | List documents |
| `/api/upload-doc/:id` | DELETE | Delete document |

### Monitoring & Logs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/logs` | GET | Get conversation logs |
| `/api/logs/analytics` | GET | Get analytics data |
| `/api/logs/export/csv` | GET | Export logs as CSV |
| `/health` | GET | Server health check |

## 🤖 Chatbot Workflow

1. **Question Reception** - รับคำถามจาก LINE OA หรือ API
2. **RAG Search** - ค้นหาในฐานความรู้แบบ Tiered (A → B → C)
3. **AI Processing** - ส่งข้อมูลไปยัง Mistral AI พร้อม context
4. **Fallback Mechanism** - หากไม่พบข้อมูล ใช้ External APIs (เช่น อากาศ)
5. **Response & Logging** - ตอบกลับและบันทึก log ทุกการสนทนา

## 📊 Knowledge Base (RAG)

### Tier System
- **Tier A**: ข้อมูลสำคัญสูงสุด (คู่มือหลัก, งานวิจัยล่าสุด)
- **Tier B**: ข้อมูลทั่วไป (บทความ, คำแนะนำ)
- **Tier C**: ข้อมูลเสริม (FAQ, ข้อมูลพื้นฐาน)

### Vector Search
- ใช้ Mistral AI embeddings สำหรับ vector embeddings
- MongoDB Atlas Vector Search สำหรับการค้นหา
- Similarity threshold: 0.7+
- Top 5 relevant chunks per query

## 🎯 AI Agent Configuration

```
System Prompt: "คุณคือผู้ช่วยด้านมันสำปะหลังสำหรับเกษตรกรไทย
ตอบแบบเข้าใจง่าย กระชับ 
อ้างอิงข้อมูลจากเอกสารที่มีอยู่ก่อน ถ้าไม่มีจึงหาข้อมูลจากภายนอก"
```

## 🌤️ External APIs

- **OpenWeatherMap**: ข้อมูลสภาพอากาศสำหรับคำแนะนำการเกษตร
- **Fallback Mechanism**: เมื่อ RAG ไม่พบข้อมูลที่เกี่ยวข้อง

## 📈 Admin Dashboard Features

- **📄 Document Manager**: อัปโหลดและจัดการเอกสาร PDF/DOC (Responsive Design)
- **💬 Conversation Logs**: ดูประวัติการสนทนาและกรองข้อมูล
- **📊 Analytics**: สถิติการใช้งาน, อัตราความสำเร็จ RAG (Interactive Charts)
- **🎛️ Real-time Monitoring**: ติดตามการทำงานของระบบ (Mobile-First Design)
- **📱 Responsive Interface**: ใช้งานได้ทุกอุปกรณ์ (Desktop, Tablet, Mobile)

## 🔧 Development

### Project Structure

```
backend/
├── config/database.js      # MongoDB connection
├── models/                 # Mongoose schemas
│   ├── Document.js         # Document & embeddings
│   ├── ConversationLog.js  # Chat logs
│   └── User.js            # User profiles
├── services/              # Business logic
│   ├── ragService.js      # RAG & vector search
│   ├── agentService.js    # AI agent workflow
│   ├── weatherService.js  # Weather API integration
│   ├── logService.js      # Logging & analytics
│   └── documentService.js # Document processing
└── routes/               # API endpoints
    ├── webhook.js        # LINE webhook
    ├── ask.js           # Direct queries
    ├── upload-doc.js    # File uploads
    └── logs.js          # Monitoring
```

### Environment Variables

**Backend (.env)**:
```env
MONGODB_URI=mongodb+srv://...
MISTRAL_API_KEY=...
OPENWEATHER_API_KEY=...
PORT=3001
NODE_ENV=production
LOG_LEVEL=info
```

**Frontend (.env)**:
```env
VITE_API_BASE_URL=http://localhost:3001/api
```

## 🚀 Production Deployment

### Vercel Deployment
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Configure environment variables in Vercel dashboard
# 3. Deploy
npm run deploy:vercel
```

### Render Deployment
```bash
# 1. Connect GitHub repository to Render
# 2. Configure environment variables in Render dashboard
# 3. Deploy using render.yaml configuration
npm run deploy:render
```

### Environment Variables for Production
```env
# Backend
MONGODB_URI=mongodb+srv://...
MISTRAL_API_KEY=...
OPENWEATHER_API_KEY=...
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.vercel.app

# Frontend
VITE_API_BASE_URL=https://your-backend-domain.vercel.app/api
```

## 🧪 Testing

### API Testing Examples

```bash
# Test basic chatbot
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "มันสำปะหลังควรปลูกเมื่อไหร่", "userId": "test"}'

# Test document upload
curl -X POST http://localhost:3001/api/upload-doc \
  -F "document=@cassava-guide.pdf" \
  -F "tier=A"

# Test webhook simulation
curl -X POST http://localhost:3001/api/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"message": "สภาพอากาศวันนี้เป็นอย่างไร", "userId": "line-123"}'
```

## 📱 LINE OA Integration

### Webhook URL Setup
```
https://your-domain.com/api/webhook
```

### Supported Message Types
- Text messages
- Quick replies
- Rich menus (future enhancement)

## 🔍 Monitoring & Analytics

- **Comprehensive Logging**: Winston logger with file rotation
- **Real-time Logs**: ทุกการสนทนาถูกบันทึกพร้อม metadata
- **Source Tracking**: ติดตามว่าคำตอบมาจาก RAG หรือ External API
- **Performance Metrics**: เวลาตอบสนอง, อัตราความสำเร็จ, API usage
- **User Analytics**: สถิติการใช้งานของผู้ใช้แต่ละคน
- **Error Tracking**: Detailed error logging with context
- **Rate Limiting**: Protection against API abuse

## 🛠️ Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   ```bash
   # Check MongoDB URI in .env
   # Ensure IP whitelist in MongoDB Atlas
   # Verify Vector Search index is created
   ```

2. **Mistral AI API Errors**
   ```bash
   # Verify API key in .env
   # Check API quota and billing
   # Monitor rate limits
   ```

3. **File Upload Issues**
   ```bash
   # Check uploads/ directory permissions
   # Verify file size limits (10MB max)
   # Check disk space availability
   ```

### Logs Location
- Application logs: `backend/logs/app.log`
- Error logs: `backend/logs/error.log`
- Conversation logs: MongoDB `conversationlogs` collection
- Request logs: Winston HTTP request logging

## 🚀 Production Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Use production MongoDB cluster
3. Configure proper CORS origins
4. Enable rate limiting
5. Set up SSL certificates
6. Configure reverse proxy (nginx/Vercel/Render)
7. Enable compression and security headers

### Performance Optimization
- Enable MongoDB connection pooling
- Implement caching for frequent queries
- Use CDN for static assets
- Monitor memory usage for large document processing
- Enable gzip compression
- Implement proper error boundaries
- Use Winston log rotation

## 📄 License

MIT License - ดูรายละเอียดใน LICENSE file

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

---

**สร้างโดย**: AI Assistant  
**เวอร์ชัน**: 1.0.0  
**อัปเดตล่าสุด**: 2025
**AI Model**: Mistral AI Large
**Database**: MongoDB Atlas with Vector Search