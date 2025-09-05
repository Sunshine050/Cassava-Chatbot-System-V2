import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, MessageSquare, Clock, Target, Eye } from 'lucide-react';

interface Conversation {
  id: string;
  user_id: string;
  question: string;
  answer: string;
  source_type: string;
  confidence_score: number;
  response_time_ms: number;
  created_at: string;
  chunks_used: string[];
  external_data: any;
}

const ConversationLogs: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0
  });

  useEffect(() => {
    fetchConversations();
  }, [searchKeyword, sourceFilter, pagination.offset]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString()
      });

      if (searchKeyword) params.append('keyword', searchKeyword);
      if (sourceFilter) params.append('sourceType', sourceFilter);

      const response = await fetch(`${apiUrl}/logs?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        setConversations(data.data || []);
        setPagination(prev => ({
          ...prev,
          total: data.pagination?.total || 0
        }));
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      const params = new URLSearchParams({ format: 'csv' });
      if (searchKeyword) params.append('keyword', searchKeyword);
      if (sourceFilter) params.append('sourceType', sourceFilter);

      const response = await fetch(`${apiUrl}/logs/export?${params}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversations_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const getSourceBadgeColor = (sourceType: string) => {
    switch (sourceType) {
      case 'RAG': return 'bg-green-100 text-green-700 border-green-200';
      case 'EXTERNAL': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'HYBRID': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">บันทึกการสนทนา</h2>
        <p className="text-gray-600 mt-1">ตรวจสอบและวิเคราะห์การสนทนาของแชทบอท</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ค้นหาในคำถามหรือคำตอบ
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="พิมพ์คำค้นหา..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              แหล่งข้อมูล
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">ทั้งหมด</option>
              <option value="RAG">RAG เท่านั้น</option>
              <option value="EXTERNAL">External API</option>
              <option value="HYBRID">RAG + External</option>
            </select>
          </div>
          
          <div className="flex items-end lg:col-span-1">
            <button
              onClick={handleExport}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 lg:p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            บันทึกการสนทนา ({pagination.total.toLocaleString()})
          </h3>
        </div>

        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-6 lg:p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">กำลังโหลด...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 lg:p-8 text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">ไม่พบบันทึกการสนทนา</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div key={conv.id} className="p-4 lg:p-6 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between space-y-4 lg:space-y-0">
                  <div className="flex-1 space-y-3">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                      <span className="text-sm text-gray-600 truncate">User: {conv.user_id}</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getSourceBadgeColor(conv.source_type)}`}>
                        {conv.source_type}
                      </span>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{conv.response_time_ms}ms</span>
                      </div>
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <Target className="w-3 h-3" />
                        <span>{Math.round(conv.confidence_score * 100)}%</span>
                      </div>
                      </div>
                    </div>

                    {/* Question */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">คำถาม:</p>
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{conv.question}</p>
                    </div>

                    {/* Answer Preview */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">คำตอบ:</p>
                      <p className="text-gray-900 bg-blue-50 p-3 rounded-lg text-sm lg:text-base">
                        {conv.answer.length > 200 
                          ? conv.answer.substring(0, 200) + '...'
                          : conv.answer
                        }
                      </p>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-1 sm:space-y-0 text-xs text-gray-500">
                      <span>{formatDate(conv.created_at)}</span>
                      <div className="flex items-center space-x-4 text-xs">
                        {conv.chunks_used?.length > 0 && (
                          <span>{conv.chunks_used.length} chunks used</span>
                        )}
                        {Object.keys(conv.external_data || {}).length > 0 && (
                          <span>มีข้อมูลภายนอก</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedConversation(conv)}
                    className="self-end lg:self-start lg:ml-4 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="ดูรายละเอียด"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {conversations.length > 0 && (
          <div className="p-4 lg:p-6 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
            <div className="text-sm text-gray-600 text-center sm:text-left">
              แสดง {pagination.offset + 1}-{Math.min(pagination.offset + pagination.limit, pagination.total)} จาก {pagination.total.toLocaleString()} รายการ
            </div>
            <div className="flex justify-center space-x-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                disabled={pagination.offset === 0}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
              >
                ก่อนหน้า
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                disabled={pagination.offset + pagination.limit >= pagination.total}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Conversation Detail Modal */}
      {selectedConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 lg:p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] lg:max-h-[80vh] overflow-y-auto">
            <div className="p-4 lg:p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">รายละเอียดการสนทนา</h3>
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-4 lg:p-6 space-y-6">
              {/* Metadata */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">User ID</p>
                  <p className="font-medium text-sm truncate">{selectedConversation.user_id}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">แหล่งข้อมูล</p>
                  <p className="font-medium">{selectedConversation.source_type}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">ความมั่นใจ</p>
                  <p className="font-medium">{Math.round(selectedConversation.confidence_score * 100)}%</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">เวลาตอบ</p>
                  <p className="font-medium">{selectedConversation.response_time_ms}ms</p>
                </div>
              </div>

              {/* Question and Answer */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">คำถาม:</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-900">{selectedConversation.question}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">คำตอบ:</h4>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-gray-900 whitespace-pre-wrap text-sm lg:text-base">{selectedConversation.answer}</p>
                  </div>
                </div>
              </div>

              {/* Additional Data */}
              {selectedConversation.chunks_used?.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Chunks ที่ใช้:</h4>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-700">
                      ใช้ {selectedConversation.chunks_used.length} chunks จากฐานความรู้
                    </p>
                  </div>
                </div>
              )}

              {selectedConversation.external_data && Object.keys(selectedConversation.external_data).length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">ข้อมูลภายนอก:</h4>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <pre className="text-xs lg:text-sm text-gray-700 whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(selectedConversation.external_data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500 border-t pt-4">
                สร้างเมื่อ: {formatDate(selectedConversation.created_at)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationLogs;