"use client";

import { useEffect, useState } from 'react';
import { isMonitoringEnabled } from '../config/monitoring';

interface SecurityEvent {
  id: string;
  timestamp: number;
  type: 'rate_limit' | 'auth_failure' | 'xss_attempt' | 'sql_injection' | 'security_alert';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
}

interface SecurityStats {
  totalEvents: number;
  criticalEvents: number;
  highEvents: number;
  mediumEvents: number;
  lowEvents: number;
  last24Hours: number;
}

export default function SecurityMonitor() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<SecurityStats>({
    totalEvents: 0,
    criticalEvents: 0,
    highEvents: 0,
    mediumEvents: 0,
    lowEvents: 0,
    last24Hours: 0
  });
  const [isVisible, setIsVisible] = useState(false);
  
  // Use monitoring configuration
  const isEnabled = isMonitoringEnabled('security');

  // Mock security events for demonstration
  useEffect(() => {
    const mockEvents: SecurityEvent[] = [
      {
        id: '1',
        timestamp: Date.now() - 1000 * 60 * 5, // 5 minutes ago
        type: 'rate_limit',
        severity: 'medium',
        message: 'Rate limit exceeded for IP 192.168.1.100',
        ip: '192.168.1.100'
      },
      {
        id: '2',
        timestamp: Date.now() - 1000 * 60 * 15, // 15 minutes ago
        type: 'auth_failure',
        severity: 'high',
        message: 'Multiple failed login attempts for user admin@example.com',
        ip: '10.0.0.50',
        userId: 'admin@example.com'
      },
      {
        id: '3',
        timestamp: Date.now() - 1000 * 60 * 30, // 30 minutes ago
        type: 'security_alert',
        severity: 'low',
        message: 'Suspicious user agent detected',
        userAgent: 'Mozilla/5.0 (compatible; Bot/1.0)'
      }
    ];

    setEvents(mockEvents);
    
    // Calculate stats
    const now = Date.now();
    const last24Hours = mockEvents.filter(e => now - e.timestamp < 24 * 60 * 60 * 1000).length;
    
    setStats({
      totalEvents: mockEvents.length,
      criticalEvents: mockEvents.filter(e => e.severity === 'critical').length,
      highEvents: mockEvents.filter(e => e.severity === 'high').length,
      mediumEvents: mockEvents.filter(e => e.severity === 'medium').length,
      lowEvents: mockEvents.filter(e => e.severity === 'low').length,
      last24Hours
    });
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'rate_limit': return '🚫';
      case 'auth_failure': return '🔐';
      case 'xss_attempt': return '⚠️';
      case 'sql_injection': return '💉';
      case 'security_alert': return '🚨';
      default: return 'ℹ️';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  // Don't render anything if not enabled
  if (!isEnabled) {
    return null;
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-lg transition-colors z-50 opacity-80 hover:opacity-100"
        title="Security Monitor (Dev Tool)"
      >
        🔒 Security Monitor
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-96 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <h3 className="text-lg font-semibold text-gray-800">🔒 Security Monitor</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      {/* Stats */}
      <div className="p-4 border-b border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.criticalEvents}</div>
            <div className="text-gray-600">Critical</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.highEvents}</div>
            <div className="text-gray-600">High</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.mediumEvents}</div>
            <div className="text-gray-600">Medium</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.lowEvents}</div>
            <div className="text-gray-600">Low</div>
          </div>
        </div>
        <div className="mt-3 text-center text-sm text-gray-600">
          {stats.last24Hours} events in last 24 hours
        </div>
      </div>

      {/* Events List */}
      <div className="max-h-64 overflow-y-auto p-4">
        {events.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No security events detected
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getTypeIcon(event.type)}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(event.severity)}`}>
                      {event.severity}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{formatTimestamp(event.timestamp)}</span>
                </div>
                <div className="mt-2 text-sm text-gray-800">{event.message}</div>
                {event.ip && (
                  <div className="mt-1 text-xs text-gray-600">IP: {event.ip}</div>
                )}
                {event.userId && (
                  <div className="mt-1 text-xs text-gray-600">User: {event.userId}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
        <div className="text-xs text-gray-600 text-center">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
