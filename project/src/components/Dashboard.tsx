import React, { useState, useEffect } from 'react';
import { MessageSquare, FileText, TrendingUp, Zap, Clock, Target, Database, Upload, Search } from 'lucide-react';

interface DashboardStats {
  totalConversations: number;
  totalDocuments: number;
  avgResponseTime: number;
  avgConfidenceScore: number;
  knowledgeBase: {
    totalChunks: number;
    tierStats: {
      A: { documents: number; chunks: number };
      B: { documents: number; chunks: number };
      C: { documents: number; chunks: number };
    };
  };
  recentActivity: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch analytics data
      const analyticsResponse = await fetch('http://localhost:3001/api/logs/analytics?timeRange=7d');
      const analyticsData = await analyticsResponse.json();
      
      // Fetch knowledge base stats
      const kbResponse = await fetch('http://localhost:3001/api/upload-doc/stats');
      const kbData = await kbResponse.json();
      
      // Fetch recent documents
      const docsResponse = await fetch('http://localhost:3001/api/upload-doc?limit=5');
      const docsData = await docsResponse.json();

      const dashboardStats: DashboardStats = {
        totalConversations: analyticsData.data?.totalConversations || 0,
        totalDocuments: kbData.data?.totalDocuments || 0,
        avgResponseTime: analyticsData.data?.avgResponseTime || 0,
        avgConfidenceScore: analyticsData.data?.avgConfidenceScore || 0,
        knowledgeBase: {
          totalChunks: kbData.data?.totalChunks || 0,
          tierStats: kbData.data?.tierStats || { A: { documents: 0, chunks: 0 }, B: { documents: 0, chunks: 0 }, C: { documents: 0, chunks: 0 } }
        },
        recentActivity: docsData.documents?.slice(0, 5).map((doc: any) => ({
          type: 'document',
          message: `อัปโหลดเอกสาร "${doc.title}" (Tier ${doc.tier})`,
          timestamp: doc.created_at
        })) || []
      };

      setStats(dashboardStats);
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('ไม่สามารถโหลดข้อมูลแดชบอร์ดได้');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-3 text-gray-600">กำลังโหลดข้อมูล...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-700">{error}</p>
        <button 
          onClick={fetchDashboardData}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          ลองใหม่
        </button>
      </div>
    );
  }

  const statCards = [
    {
      title: 'การสนทนาทั้งหมด',
      value: stats?.totalConversations.toLocaleString() || '0',
      icon: MessageSquare,
      color: 'blue'
    },
    {
      title: 'เอกสารในระบบ',
      value: stats?.totalDocuments.toLocaleString() || '0',
      icon: FileText,
      color: 'green'
    },
    {
      title: 'เวลาตอบสนองเฉลี่ย',
      value: `${Math.round(stats?.avgResponseTime || 0)}ms`,
      icon: Clock,
      color: 'yellow'
    },
    {
      title: 'คะแนนความมั่นใจ',
      value: `${Math.round((stats?.avgConfidenceScore || 0) * 100)}%`,
      icon: Target,
      color: 'purple'
    }
  ];

  const colorMap = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500'
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">แดชบอร์ดหลัก</h2>
        <p className="text-gray-600 mt-1">ภาพรวมของระบบแชทบอทมันสำปะหลัง</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-xl lg:text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div className={`w-10 h-10 lg:w-12 lg:h-12 ${colorMap[card.color]} rounded-lg flex items-center justify-center`}>
                  <Icon className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Knowledge Base Overview */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Database className="w-5 h-5 mr-2 text-green-600" />
            ฐานความรู้
          </h3>
          
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-2xl lg:text-3xl font-bold text-green-600">{stats?.knowledgeBase.totalChunks}</p>
              <p className="text-sm text-gray-600">ข้อมูลทั้งหมด (chunks)</p>
            </div>
            
            <div className="space-y-3">
              {Object.entries(stats?.knowledgeBase.tierStats || {}).map(([tier, data]) => (
                <div key={tier} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      tier === 'A' ? 'bg-red-500' : 
                      tier === 'B' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}></div>
                    <span className="font-medium">Tier {tier}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{data.documents} เอกสาร</p>
                    <p className="text-xs text-gray-600 hidden sm:block">{data.chunks} chunks</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Zap className="w-5 h-5 mr-2 text-blue-600" />
            กิจกรรมล่าสุด
          </h3>
          
          <div className="space-y-3">
            {stats?.recentActivity.length === 0 ? (
              <p className="text-gray-500 text-center py-8">ยังไม่มีกิจกรรม</p>
            ) : (
              stats?.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start space-x-3 p-2 lg:p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <FileText className="w-4 h-4 text-green-600 mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{activity.message}</p>
                    <p className="text-xs text-gray-500 mt-1 hidden sm:block">
                      {new Date(activity.timestamp).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">การดำเนินการด่วน</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => setActiveTab('documents')}
            className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors group"
          >
            <Upload className="w-6 h-6 text-green-600 group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <p className="font-medium text-green-900">อัปโหลดเอกสาร</p>
              <p className="text-sm text-green-700 hidden sm:block">เพิ่มความรู้ใหม่เข้าระบบ</p>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('conversations')}
            className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors group"
          >
            <Search className="w-6 h-6 text-blue-600 group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <p className="font-medium text-blue-900">ค้นหาบันทึก</p>
              <p className="text-sm text-blue-700 hidden sm:block">ตรวจสอบการสนทนา</p>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('analytics')}
            className="flex items-center space-x-3 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors group"
          >
            <TrendingUp className="w-6 h-6 text-purple-600 group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <p className="font-medium text-purple-900">ดูสถิติ</p>
              <p className="text-sm text-purple-700 hidden sm:block">วิเคราะห์ประสิทธิภาพ</p>
            </div>
          </button>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">สถานะระบบ</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-700">Backend API: ออนไลน์</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-700">ฐานข้อมูล: เชื่อมต่อแล้ว</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-700">Mistral AI: พร้อมใช้งาน</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;