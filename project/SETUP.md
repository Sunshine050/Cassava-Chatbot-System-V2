# 🔧 Setup Instructions - MongoDB Version

## ขั้นตอนการติดตั้งและใช้งาน Cassava Chatbot System

### 1. 📋 Prerequisites

ก่อนเริ่มต้น ตรวจสอบให้แน่ใจว่าคุณมี:

- **Node.js 18+** - [ดาวน์โหลด](https://nodejs.org/)
- **MongoDB Atlas Account** - [สมัครฟรี](https://www.mongodb.com/cloud/atlas)
- **OpenAI API Key** - [สมัครที่นี่](https://platform.openai.com/)
- **OpenWeatherMap API Key** - [สมัครฟรี](https://openweathermap.org/api)

### 2. 🗄️ MongoDB Atlas Setup

#### สร้าง Cluster
1. เข้า [MongoDB Atlas](https://cloud.mongodb.com/)
2. สร้าง New Project → "Cassava Chatbot"
3. Build Database → Shared (Free) → Create Cluster
4. เลือก Region ใกล้ที่สุด (Singapore แนะนำ)

#### ตั้งค่า Database Access
1. Database Access → Add New Database User
2. Username: `cassava-admin`
3. Password: สร้าง secure password
4. Database User Privileges: Read and write to any database

#### ตั้งค่า Network Access
1. Network Access → Add IP Address
2. เลือก "Allow access from anywhere" (0.0.0.0/0)
3. หรือเพิ่ม IP เฉพาะของคุณ

#### ดึง Connection String
1. Clusters → Connect → Connect your application
2. Driver: Node.js, Version: 4.1 or later
3. คัดลอก Connection String
4. แทนที่ `<password>` ด้วยรหัสผ่านจริง

### 3. 🔑 API Keys Setup

#### OpenAI API Key
1. เข้า [OpenAI Platform](https://platform.openai.com/)
2. API Keys → Create new secret key
3. คัดลอกและเก็บไว้ปลอดภัย

#### OpenWeatherMap API Key
1. เข้า [OpenWeatherMap](https://openweathermap.org/api)
2. Sign up → API keys
3. คัดลอก API key

### 4. 💻 Project Installation

```bash
# Clone repository
git clone <repository-url>
cd cassava-chatbot

# Install dependencies
npm run setup

# หรือติดตั้งแยกส่วน
npm install                    # Frontend dependencies
cd backend && npm install      # Backend dependencies
cd ..
```

### 5. ⚙️ Environment Configuration

#### Backend Environment (.env)
```bash
# คัดลอกไฟล์ตัวอย่าง
cp backend/.env.example backend/.env

# แก้ไขไฟล์ backend/.env
nano backend/.env
```

**ใส่ข้อมูลจริง**:
```env
# MongoDB Configuration
MONGODB_URI=mongodb+srv://cassava-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/cassava-chatbot?retryWrites=true&w=majority
MONGODB_DB_NAME=cassava-chatbot

# OpenAI Configuration  
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Weather API Configuration
OPENWEATHER_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
FRONTEND_URL=http://localhost:5173
```

#### Frontend Environment (.env)
```bash
# คัดลอกไฟล์ตัวอย่าง
cp .env.example .env

# แก้ไขไฟล์ .env
nano .env
```

**ใส่ข้อมูล**:
```env
VITE_API_BASE_URL=http://localhost:3001/api
```

### 6. 🚀 Start the Application

#### วิธีที่ 1: รันทั้งคู่พร้อมกัน
```bash
npm run start:all
```

#### วิธีที่ 2: รันแยกส่วน (แนะนำสำหรับ Development)
```bash
# Terminal 1: Backend
npm run backend

# Terminal 2: Frontend  
npm run dev
```

### 7. ✅ Verify Installation

#### ตรวจสอบ Backend
```bash
# Health check
curl http://localhost:3001/health

# ควรได้ response:
{
  "status": "OK",
  "timestamp": "2025-01-02T...",
  "database": "connected",
  "environment": "development"
}
```

#### ตรวจสอบ Frontend
เปิดเบราว์เซอร์ไปที่: http://localhost:5173

### 8. 🧪 Test the System

#### ทดสอบ Chatbot
```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "มันสำปะหลังควรปลูกเมื่อไหร่",
    "userId": "test-user"
  }'
```

#### ทดสอบ LINE Webhook
```bash
curl -X POST http://localhost:3001/api/webhook/test \
  -H "Content-Type: application/json" \
  -d '{
    "message": "สวัสดี ช่วยแนะนำการปลูกมันสำปะหลังหน่อย",
    "userId": "line-user-123"
  }'
```

#### ทดสอบ Document Upload
```bash
# สร้างไฟล์ทดสอบ
echo "มันสำปะหลังเป็นพืชเศรษฐกิจที่สำคัญของไทย" > test-doc.txt

# อัปโหลดผ่าน API
curl -X POST http://localhost:3001/api/upload-doc \
  -F "document=@test-doc.txt" \
  -F "tier=B"
```

### 9. 📊 Access Admin Dashboard

เปิดเบราว์เซอร์ไปที่: **http://localhost:5173**

**Features ที่ใช้ได้**:
- 📄 **Document Manager**: อัปโหลดและจัดการเอกสาร
- 💬 **Conversation Logs**: ดูประวัติการสนทนา
- 📈 **Analytics**: สถิติและกราฟการใช้งาน
- 🔍 **Search & Filter**: ค้นหาและกรองข้อมูล

### 10. 🔧 Troubleshooting

#### MongoDB Connection Issues
```bash
# ตรวจสอบ connection string
echo $MONGODB_URI

# ทดสอบการเชื่อมต่อ
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));
"
```

#### OpenAI API Issues
```bash
# ทดสอบ API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

#### Port Conflicts
```bash
# หา process ที่ใช้ port 3001
lsof -i :3001

# หยุด process
kill -9 <PID>
```

### 11. 📝 Next Steps

1. **อัปโหลดเอกสาร**: ใช้ Admin Dashboard อัปโหลดไฟล์ PDF/DOC เกี่ยวกับมันสำปะหลัง
2. **ทดสอบ Chatbot**: ลองถามคำถามผ่าน `/api/ask` endpoint
3. **ตั้งค่า LINE OA**: เชื่อมต่อ webhook กับ LINE Official Account
4. **Monitor Logs**: ดูสถิติการใช้งานใน Admin Dashboard

### 🆘 Need Help?

หากพบปัญหา:
1. ตรวจสอบ console logs
2. ดู error messages ใน browser developer tools
3. ตรวจสอบ API keys และ connection strings
4. ลองรีสตาร์ทเซิร์ฟเวอร์

---

**Happy Coding! 🌱**