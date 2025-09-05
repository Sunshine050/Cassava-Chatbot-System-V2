import React, { useState, useEffect } from 'react';
import { FileText, MessageSquare, BarChart3, Upload, Settings, Search, TrendingUp, Database, Zap, Menu, X } from 'lucide-react';
import Dashboard from './components/Dashboard';
import DocumentManager from './components/DocumentManager';
import ConversationLogs from './components/ConversationLogs';
import Analytics from './components/Analytics';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isConnected, setIsConnected] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Check backend connection
    checkBackendConnection();
  }, []);

  const checkBackendConnection = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      const response = await fetch(apiUrl.replace('/api', '/health'));
      if (response.ok) {
        setIsConnected(true);
      }
    } catch (error) {
      setIsConnected(false);
    }
  };

  const navigation = [
    { id: 'dashboard', name: 'แดชบอร์ด', icon: BarChart3 },
    { id: 'documents', name: 'จัดการเอกสาร', icon: FileText },
    { id: 'conversations', name: 'บันทึกการสนทนา', icon: MessageSquare },
    { id: 'analytics', name: 'วิเคราะห์ข้อมูล', icon: TrendingUp }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'documents':
        return <DocumentManager />;
      case 'conversations':
        return <ConversationLogs />;
      case 'analytics':
        return <Analytics />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Cassava Chatbot System</h1>
                <p className="text-xs text-gray-500 hidden sm:block">ระบบจัดการแชทบอทมันสำปะหลัง</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              
              {/* Connection status */}
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                isConnected 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="hidden sm:inline">{isConnected ? 'เชื่อมต่อแล้ว' : 'ไม่ได้เชื่อมต่อ'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className={`${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white shadow-sm transition-transform duration-300 ease-in-out lg:shadow-none`}>
          <nav className="mt-8 px-4 pb-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-4 py-3 text-left rounded-lg transition-all duration-200 ${
                        activeTab === item.id
                          ? 'bg-green-50 text-green-700 border-l-4 border-green-500'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        {/* Mobile overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 lg:p-8 lg:ml-0">
          {!isConnected && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 mx-auto max-w-4xl">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-yellow-600" />
                <p className="text-yellow-800 text-sm lg:text-base">
                  ไม่สามารถเชื่อมต่อกับ Backend API ได้ กรุณาตรวจสอบว่า Backend Server ทำงานอยู่ที่ port 3001
                </p>
              </div>
            </div>
          )}
          
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
