"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface UserRightsManagerProps {
  isVisible: boolean;
  onClose: () => void;
}

interface DataExport {
  id: string;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt: number;
}

export default function UserRightsManager({ isVisible, onClose }: UserRightsManagerProps) {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [dataExports, setDataExports] = useState<DataExport[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');

  if (!isVisible) return null;

  const handleDataExport = async () => {
    if (!user) return;
    
    setIsProcessing(true);
    setMessage('Initiating data export...');
    
    try {
      const response = await fetch('/api/users/data-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.userId }),
      });
      
      if (response.ok) {
        const exportData = await response.json() as any;
        setDataExports(prev => [...prev, exportData]);
        setMessage('Data export initiated successfully. You will receive an email when ready.');
      } else {
        setMessage('Failed to initiate data export. Please try again.');
      }
    } catch (error) {
      setMessage('Error initiating data export. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDataDeletion = async () => {
    if (!user) return;
    
    if (!confirm('Are you sure you want to delete your account and all associated data? This action cannot be undone.')) {
      return;
    }
    
    setIsProcessing(true);
    setMessage('Processing account deletion...');
    
    try {
      const response = await fetch('/api/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.userId }),
      });
      
      if (response.ok) {
        setMessage('Account deleted successfully. You will be logged out.');
        setTimeout(() => {
          logout();
          onClose();
        }, 2000);
      } else {
        setMessage('Failed to delete account. Please try again.');
      }
    } catch (error) {
      setMessage('Error deleting account. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDataPortability = async () => {
    if (!user) return;
    
    setIsProcessing(true);
    setMessage('Preparing data for portability...');
    
    try {
      const response = await fetch('/api/users/data-portability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.userId }),
      });
      
      if (response.ok) {
        const data = await response.json();
        // Create downloadable file
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `odubo-data-${user.userId}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        setMessage('Data portability file downloaded successfully.');
      } else {
        setMessage('Failed to prepare data for portability. Please try again.');
      }
    } catch (error) {
      setMessage('Error preparing data for portability. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConsentWithdrawal = async () => {
    if (!user) return;
    
    setIsProcessing(true);
    setMessage('Processing consent withdrawal...');
    
    try {
      const response = await fetch('/api/users/consent-withdrawal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.userId }),
      });
      
      if (response.ok) {
        setMessage('Consent withdrawn successfully. Some features may be limited.');
        // Clear cookie consent
        localStorage.removeItem('gdpr-consent');
      } else {
        setMessage('Failed to withdraw consent. Please try again.');
      }
    } catch (error) {
      setMessage('Error withdrawing consent. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-800">🔐 User Rights Management</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Manage your data and exercise your GDPR rights.
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'data-export', label: 'Data Export', icon: '📤' },
              { id: 'data-deletion', label: 'Data Deletion', icon: '🗑️' },
              { id: 'data-portability', label: 'Data Portability', icon: '📁' },
              { id: 'consent', label: 'Consent Management', icon: '✅' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-blue-800 mb-2">Your GDPR Rights</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• <strong>Right to Access:</strong> Request a copy of your personal data</li>
                  <li>• <strong>Right to Rectification:</strong> Correct inaccurate personal data</li>
                  <li>• <strong>Right to Erasure:</strong> Request deletion of your personal data</li>
                  <li>• <strong>Right to Portability:</strong> Receive your data in a portable format</li>
                  <li>• <strong>Right to Withdraw Consent:</strong> Withdraw consent for data processing</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-2">Data Export</h4>
                  <p className="text-sm text-gray-600 mb-3">Download all your personal data</p>
                  <button
                    onClick={() => setActiveTab('data-export')}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Export Data
                  </button>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-2">Data Portability</h4>
                  <p className="text-sm text-gray-600 mb-3">Transfer your data to another service</p>
                  <button
                    onClick={() => setActiveTab('data-portability')}
                    className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Download Data
                  </button>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-2">Account Deletion</h4>
                  <p className="text-sm text-gray-600 mb-3">Permanently delete your account</p>
                  <button
                    onClick={() => setActiveTab('data-deletion')}
                    className="w-full px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Data Export Tab */}
          {activeTab === 'data-export' && (
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-yellow-800 mb-2">Data Export</h3>
                <p className="text-sm text-yellow-700">
                  Request a complete export of all your personal data. This process may take up to 30 days.
                  You will receive an email when your data is ready for download.
                </p>
              </div>

              <button
                onClick={handleDataExport}
                disabled={isProcessing}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? 'Processing...' : 'Request Data Export'}
              </button>

              {dataExports.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-800 mb-3">Export History</h4>
                  <div className="space-y-3">
                    {dataExports.map((exportItem) => (
                      <div key={exportItem.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                        <div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(exportItem.status)}`}>
                            {exportItem.status}
                          </span>
                          <span className="ml-3 text-sm text-gray-600">
                            Requested on {formatDate(exportItem.timestamp)}
                          </span>
                        </div>
                        {exportItem.status === 'completed' && exportItem.downloadUrl && (
                          <a
                            href={exportItem.downloadUrl}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                          >
                            Download
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Data Deletion Tab */}
          {activeTab === 'data-deletion' && (
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-red-800 mb-2">⚠️ Account Deletion Warning</h3>
                <p className="text-sm text-red-700">
                  <strong>This action cannot be undone.</strong> Deleting your account will permanently remove:
                </p>
                <ul className="text-sm text-red-700 mt-2 space-y-1">
                  <li>• All your personal data</li>
                  <li>• Your account and profile</li>
                  <li>• All uploaded content (music, videos, etc.)</li>
                  <li>• Your preferences and settings</li>
                  <li>• All associated data and relationships</li>
                </ul>
              </div>

              <button
                onClick={handleDataDeletion}
                disabled={isProcessing}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? 'Processing...' : 'Permanently Delete Account'}
              </button>
            </div>
          )}

          {/* Data Portability Tab */}
          {activeTab === 'data-portability' && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-green-800 mb-2">Data Portability</h3>
                <p className="text-sm text-green-700">
                  Download your personal data in a machine-readable format. This allows you to transfer your data
                  to another service or keep a local copy.
                </p>
              </div>

              <button
                onClick={handleDataPortability}
                disabled={isProcessing}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? 'Processing...' : 'Download Data'}
              </button>
            </div>
          )}

          {/* Consent Management Tab */}
          {activeTab === 'consent' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-blue-800 mb-2">Consent Management</h3>
                <p className="text-sm text-blue-700">
                  Manage your consent for data processing activities. You can withdraw consent at any time,
                  though this may limit some features.
                </p>
              </div>

              <button
                onClick={handleConsentWithdrawal}
                disabled={isProcessing}
                className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? 'Processing...' : 'Withdraw All Consent'}
              </button>
            </div>
          )}

          {/* Message Display */}
          {message && (
            <div className="mt-4 p-3 bg-gray-100 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-700">{message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
