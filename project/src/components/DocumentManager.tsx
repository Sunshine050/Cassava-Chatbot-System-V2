import React, { useState, useEffect } from 'react';
import { Upload, FileText, Trash2, AlertCircle, CheckCircle, Clock, Filter } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  tier: string;
  processed: boolean;
  chunk_count: number;
  upload_date: string;
}

const DocumentManager: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedTier, setSelectedTier] = useState('B');
  const [filterTier, setFilterTier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, [filterTier]);

  const fetchDocuments = async (retries = 3) => {
    while (retries > 0) {
      try {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
        const url = filterTier ? `${apiUrl}/upload-doc?tier=${filterTier}` : `${apiUrl}/upload-doc`;

        const response = await fetch(url, {
          headers: { Accept: 'application/json; charset=utf-8' },
        });
        const data = await response.json();

        console.log('Response headers:', response.headers.get('Content-Type'));
        console.log('Raw documents:', data.documents);

        if (response.ok) {
          setDocuments(
            data.documents?.map((doc: any) => {
              return {
                id: doc.documentId || doc._id,
                title: doc.originalName || doc.title || 'ไม่ระบุชื่อ', // ✅ ใช้ชื่อไฟล์จริง
                file_name: doc.filename, // ใช้ backend อ้างอิงเท่านั้น
                file_type: doc.mimeType || 'unknown',
                tier: doc.tier,
                processed: doc.status === 'completed' || doc.processed,
                chunk_count: doc.chunksCount || doc.chunk_count || 0,
                upload_date: doc.createdAt || doc.uploadedAt,
              };
            }) || []
          );
          setError(null);
          return;
        } else {
          throw new Error(data.message || 'ไม่สามารถโหลดเอกสารได้');
        }
      } catch (err) {
        console.error('Error fetching documents:', err);
        retries--;
        if (retries === 0) {
          setError('ไม่สามารถโหลดรายการเอกสารได้ กรุณาลองใหม่');
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append('document', file);
      formData.append('tier', selectedTier);

      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/upload-doc`, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json; charset=utf-8' },
      });

      const data = await response.json();

      if (response.ok) {
        const decodedTitle = data.document.originalName || data.document.title || data.document.filename;
        setSuccess(`อัปโหลดเอกสาร "${decodedTitle}" สำเร็จ`);
        await fetchDocuments();
        event.target.value = '';
      } else {
        throw new Error(data.message || 'การอัปโหลดล้มเหลว');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(`ไม่สามารถอัปโหลดไฟล์ได้: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string, title: string) => {
    if (!confirm(`ต้องการลบเอกสาร "${title}" หรือไม่?`)) {
      return;
    }

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/upload-doc/${documentId}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json; charset=utf-8' },
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`ลบเอกสาร "${title}" สำเร็จ`);
        await fetchDocuments();
      } else {
        throw new Error(data.message || 'การลบล้มเหลว');
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError(`ไม่สามารถลบเอกสารได้: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'A':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'B':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'C':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getTierDescription = (tier: string) => {
    switch (tier) {
      case 'A':
        return 'สำคัญมาก - โรค, แมลง, ดูแลเร่งด่วน';
      case 'B':
        return 'ปกติ - การปลูก, การเก็บเกี่ยว, การแปรรูป';
      case 'C':
        return 'เสริม - ข้อมูลตลาด, งานวิจัย, เทคนิคทั่วไป';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">จัดการเอกสารความรู้</h2>
        <p className="text-gray-600 mt-1">อัปโหลดและจัดการเอกสารสำหรับฐานความรู้ RAG</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-700 flex-1 text-sm lg:text-base">{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 text-lg">
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-700 flex-1 text-sm lg:text-base">{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800 text-lg">
            ×
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Upload className="w-5 h-5 mr-2 text-green-600" />
          อัปโหลดเอกสารใหม่
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">เลือกระดับความสำคัญ (Tier)</label>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="A">Tier A - สำคัญมาก</option>
              <option value="B">Tier B - ปกติ</option>
              <option value="C">Tier C - เสริม</option>
            </select>
            <p className="text-sm text-gray-600 mt-1">{getTierDescription(selectedTier)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">เลือกไฟล์ (PDF, DOC, DOCX)</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileUpload}
              disabled={uploading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
          </div>

          {uploading && (
            <div className="flex items-center space-x-2 text-green-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
              <span className="text-sm">กำลังประมวลผล...</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 lg:p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-600" />
              เอกสารทั้งหมด ({documents.length})
            </h3>

            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">ทุก Tier</option>
                <option value="A">Tier A</option>
                <option value="B">Tier B</option>
                <option value="C">Tier C</option>
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-6 lg:p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">กำลังโหลด...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="p-6 lg:p-8 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">ยังไม่มีเอกสารในระบบ</p>
              <p className="text-sm text-gray-400 mt-1">อัปโหลดเอกสารแรกเพื่อเริ่มต้นสร้างฐานความรู้</p>
            </div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="p-4 lg:p-6 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mb-2">
                      <h4 className="text-base lg:text-lg font-medium text-gray-900">{doc.title}</h4>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full border ${getTierBadgeColor(
                          doc.tier
                        )}`}
                      >
                        Tier {doc.tier}
                      </span>
                      {doc.processed ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-600" />
                      )}
                    </div>

                    <p className="text-sm text-gray-600 mb-1">ไฟล์: {doc.title}</p>
                    <p className="text-sm text-gray-600 mb-2 hidden sm:block">
                      อัปโหลดเมื่อ:{' '}
                      {new Date(doc.upload_date).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>

                    <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 text-sm">
                      <span
                        className={`flex items-center space-x-1 ${
                          doc.processed ? 'text-green-600' : 'text-yellow-600'
                        }`}
                      >
                        {doc.processed ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        <span>{doc.processed ? 'ประมวลผลแล้ว' : 'กำลังประมวลผล'}</span>
                      </span>

                      {doc.processed && <span className="text-gray-600">{doc.chunk_count} chunks</span>}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteDocument(doc.id, doc.title)}
                    className="self-end lg:self-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="ลบเอกสาร"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentManager;
