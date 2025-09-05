import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, MessageSquare, Clock, Target, RefreshCw } from 'lucide-react';

interface AnalyticsData {
  totalConversations: number;
  sourceTypeDistribution: {
    RAG: number;
    EXTERNAL: number;
    HYBRID: number;
  };
  avgConfidenceScore: number;
  avgResponseTime: number;
  dailyStats: Record<string, {
    count: number;
    sources: {
      RAG: number;
      EXTERNAL: number;
      HYBRID: number;
    };
  }>;
}

interface TopQuestion {
  question: string;
  count: number;
}

const Analytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [topQuestions, setTopQuestions] = useState<TopQuestion[]>([]);
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAnalytics();
    fetchTopQuestions();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/logs/analytics?timeRange=${timeRange}`);
      const data = await response.json();
      
      if (response.ok) {
        setAnalytics(data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopQuestions = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/logs/top-questions?limit=10`);
      const data = await response.json();
      
      if (response.ok) {
        setTopQuestions(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching top questions:', error);
    }
  };

  const sourceDistributionData = analytics ? [
    { name: 'RAG Only', value: analytics.sourceTypeDistribution.RAG, color: '#10b981' },
    { name: 'External API', value: analytics.sourceTypeDistribution.EXTERNAL, color: '#3b82f6' },
    { name: 'Hybrid', value: analytics.sourceTypeDistribution.HYBRID, color: '#8b5cf6' }
  ].filter(item => item.value > 0) : [];

  const dailyConversationsData = analytics ? Object.entries(analytics.dailyStats).map(([date, stats]) => ({
    date: new Date(date).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }),
    conversations: stats.count,
    RAG: stats.sources.RAG,
    EXTERNAL: stats.sources.EXTERNAL,
    HYBRID: stats.sources.HYBRID
  })).slice(-7) : [];

  const timeRangeOptions = [
    { value: '1d', label: '24 ชั่วโมง' },
    { value: '7d', label: '7 วัน' },
    { value: '30d', label: '30 วัน' }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">วิเคราะห์ข้อมูล</h2>
          <p className="text-gray-600 mt-1">สถิติและประสิทธิภาพของระบบแชทบอท</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {timeRangeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          
          <button
            onClick={() => { fetchAnalytics(); fetchTopQuestions(); }}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>รีเฟรช</span>
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">การสนทนาทั้งหมด</p>
              <p className="text-xl lg:text-2xl font-bold text-gray-900 mt-1">
                {analytics?.totalConversations.toLocaleString() || '0'}
              </p>
            </div>
            <MessageSquare className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">เวลาตอบเฉลี่ย</p>
              <p className="text-xl lg:text-2xl font-bold text-gray-900 mt-1">
                {Math.round(analytics?.avgResponseTime || 0)}ms
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">ความมั่นใจเฉลี่ย</p>
              <p className="text-xl lg:text-2xl font-bold text-gray-900 mt-1">
                {Math.round((analytics?.avgConfidenceScore || 0) * 100)}%
              </p>
            </div>
            <Target className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">RAG Success Rate</p>
              <p className="text-xl lg:text-2xl font-bold text-gray-900 mt-1">
                {analytics ? Math.round(
                  ((analytics.sourceTypeDistribution.RAG + analytics.sourceTypeDistribution.HYBRID) / 
                   analytics.totalConversations) * 100
                ) : 0}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        {/* Source Distribution Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">การกระจายแหล่งข้อมูล</h3>
          
          {sourceDistributionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={sourceDistributionData}
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  dataKey="value"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {sourceDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 lg:h-64 flex items-center justify-center text-gray-500 text-sm lg:text-base">
              ไม่มีข้อมูลในช่วงเวลาที่เลือก
            </div>
          )}
        </div>

        {/* Daily Conversations Line Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">การสนทนารายวัน</h3>
          
          {dailyConversationsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyConversationsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="conversations" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 lg:h-64 flex items-center justify-center text-gray-500 text-sm lg:text-base">
              ไม่มีข้อมูลในช่วงเวลาที่เลือก
            </div>
          )}
        </div>
      </div>

      {/* Top Questions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">คำถามยอดนิยม</h3>
        
        {topQuestions.length > 0 ? (
          <div className="space-y-3">
            {topQuestions.map((question, index) => (
              <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 lg:p-4 bg-gray-50 rounded-lg space-y-2 sm:space-y-0">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <p className="text-gray-900 text-sm lg:text-base flex-1">{question.question}</p>
                </div>
                <span className="text-sm font-medium text-gray-600 self-end sm:self-center">{question.count} ครั้ง</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 lg:py-8 text-gray-500">
            ไม่มีข้อมูลคำถามยอดนิยม
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;