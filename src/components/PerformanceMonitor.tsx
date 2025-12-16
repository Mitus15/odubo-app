"use client";

import { useState, useEffect, useCallback } from 'react';
import { isMonitoringEnabled } from '../config/monitoring';

interface CoreWebVitals {
  lcp: number | null; // Largest Contentful Paint
  fid: number | null; // First Input Delay
  cls: number | null; // Cumulative Layout Shift
  fcp: number | null; // First Contentful Paint
  ttfb: number | null; // Time to First Byte
}

interface PerformanceMetrics {
  coreWebVitals: CoreWebVitals;
  navigationTiming: PerformanceNavigationTiming | null;
  resourceTiming: PerformanceResourceTiming[];
  memory: any | null;
  timestamp: number;
}

interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
}

export default function PerformanceMonitor() {
  const [isVisible, setVisible] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitoringInterval, setMonitoringInterval] = useState<NodeJS.Timeout | null>(null);
  const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  
  // Use monitoring configuration
  const isEnabled = isMonitoringEnabled('performance');

  // Performance thresholds (Google's recommended values)
  const thresholds = {
    lcp: { good: 2500, poor: 4000 }, // milliseconds
    fid: { good: 100, poor: 300 },   // milliseconds
    cls: { good: 0.1, poor: 0.25 }, // score
    fcp: { good: 1800, poor: 3000 }, // milliseconds
    ttfb: { good: 800, poor: 1800 }, // milliseconds
  };

  // Get Core Web Vitals
  const getCoreWebVitals = useCallback(async (): Promise<CoreWebVitals> => {
    const vitals: CoreWebVitals = {
      lcp: null,
      fid: null,
      cls: null,
      fcp: null,
      ttfb: null,
    };

    try {
      // LCP (Largest Contentful Paint)
      if ('PerformanceObserver' in window) {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as PerformanceEntry;
          vitals.lcp = lastEntry.startTime;
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      }

      // FID (First Input Delay)
      if ('PerformanceObserver' in window) {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const firstEntry = entries[0] as PerformanceEntry;
          vitals.fid = (firstEntry as any).processingStart - firstEntry.startTime;
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      }

      // CLS (Cumulative Layout Shift)
      if ('PerformanceObserver' in window) {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          vitals.cls = clsValue;
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      }

      // FCP (First Contentful Paint)
      if ('PerformanceObserver' in window) {
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const firstEntry = entries[0] as PerformanceEntry;
          vitals.fcp = firstEntry.startTime;
        });
        fcpObserver.observe({ entryTypes: ['first-contentful-paint'] });
      }

      // TTFB (Time to First Byte)
      if (typeof performance.getEntriesByType === 'function') {
        const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
        const navigation = navigationEntries?.[0];
        if (navigation) {
          vitals.ttfb = navigation.responseStart - navigation.requestStart;
        }
      }

      // Wait a bit for metrics to populate
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Error getting Core Web Vitals:', error);
    }

    return vitals;
  }, []);

  // Get navigation timing
  const getNavigationTiming = useCallback((): PerformanceNavigationTiming | null => {
    try {
      if (typeof performance.getEntriesByType !== 'function') return null;
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return navigation || null;
    } catch (error) {
      console.error('Error getting navigation timing:', error);
      return null;
    }
  }, []);

  // Get resource timing
  const getResourceTiming = useCallback((): PerformanceResourceTiming[] => {
    try {
      if (typeof performance.getEntriesByType !== 'function') return [];
      return performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    } catch (error) {
      console.error('Error getting resource timing:', error);
      return [];
    }
  }, []);

  // Get memory info (if available)
  const getMemoryInfo = useCallback((): any | null => {
    try {
      return (performance as any).memory || null;
    } catch (error) {
      return null;
    }
  }, []);

  // Check performance and generate alerts
  const checkPerformance = useCallback((coreWebVitals: CoreWebVitals) => {
    const newAlerts: PerformanceAlert[] = [];

    Object.entries(coreWebVitals).forEach(([metric, value]) => {
      if (value !== null && thresholds[metric as keyof typeof thresholds]) {
        const threshold = thresholds[metric as keyof typeof thresholds];
        let alertType: 'warning' | 'error' | 'info' = 'info';
        let message = '';

        if (value > threshold.poor) {
          alertType = 'error';
          message = `${metric.toUpperCase()} is very poor (${value}ms)`;
        } else if (value > threshold.good) {
          alertType = 'warning';
          message = `${metric.toUpperCase()} needs improvement (${value}ms)`;
        } else {
          message = `${metric.toUpperCase()} is good (${value}ms)`;
        }

        newAlerts.push({
          id: `${metric}-${Date.now()}`,
          type: alertType,
          message,
          metric,
          value,
          threshold: threshold.good,
          timestamp: Date.now(),
        });
      }
    });

    setAlerts(prev => [...prev, ...newAlerts].slice(-10)); // Keep last 10 alerts
  }, []);

  // Collect all performance metrics
  const collectMetrics = useCallback(async () => {
    try {
      if (isTestEnv) {
        return;
      }

      const coreWebVitals = await getCoreWebVitals();
      const navigationTiming = getNavigationTiming();
      const resourceTiming = getResourceTiming();
      const memory = getMemoryInfo();

      const newMetrics: PerformanceMetrics = {
        coreWebVitals,
        navigationTiming,
        resourceTiming,
        memory,
        timestamp: Date.now(),
      };

      setMetrics(newMetrics);
      checkPerformance(coreWebVitals);
    } catch (error) {
      console.error('Error collecting performance metrics:', error);
    }
  }, [getCoreWebVitals, getNavigationTiming, getResourceTiming, getMemoryInfo, checkPerformance, isTestEnv]);

  // Start/stop monitoring
  const toggleMonitoring = useCallback(() => {
    if (isMonitoring) {
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
        setMonitoringInterval(null);
      }
      setIsMonitoring(false);
    } else {
      setIsMonitoring(true);
      if (!isTestEnv) {
        collectMetrics(); // Initial collection
        const interval = setInterval(collectMetrics, 5000); // Collect every 5 seconds
        setMonitoringInterval(interval);
      }
    }
  }, [isMonitoring, monitoringInterval, collectMetrics, isTestEnv]);

  // Initial metrics collection
  useEffect(() => {
    collectMetrics();
  }, [collectMetrics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
      }
    };
  }, [monitoringInterval]);

  const getMetricColor = (metric: string, value: number) => {
    if (!thresholds[metric as keyof typeof thresholds]) return 'text-gray-600';
    
    const threshold = thresholds[metric as keyof typeof thresholds];
    if (value <= threshold.good) return 'text-green-600';
    if (value <= threshold.poor) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getMetricStatus = (metric: string, value: number) => {
    if (!thresholds[metric as keyof typeof thresholds]) return 'Unknown';
    
    const threshold = thresholds[metric as keyof typeof thresholds];
    if (value <= threshold.good) return 'Good';
    if (value <= threshold.poor) return 'Needs Improvement';
    return 'Poor';
  };

  // Don't render anything if not enabled
  if (!isEnabled) {
    return null;
  }

  if (!isVisible && !isMonitoring) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transition-colors z-50 opacity-80 hover:opacity-100"
        aria-label="Open performance monitor"
        title="Performance Monitor (Dev Tool)"
      >
        📊 Performance
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 max-w-md w-full z-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">📊 Performance Monitor</h3>
          <div className="flex space-x-2">
            <button
              onClick={toggleMonitoring}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                isMonitoring
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {isMonitoring ? 'Stop' : 'Start'}
            </button>
            <button
              onClick={() => setVisible(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Core Web Vitals & Performance Metrics
        </p>
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {metrics ? (
          <div className="space-y-4">
            {/* Core Web Vitals */}
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Core Web Vitals</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(metrics.coreWebVitals).map(([metric, value]) => (
                  <div key={metric} className="flex justify-between">
                    <span className="font-medium text-gray-600">{metric.toUpperCase()}:</span>
                    <span className={value !== null ? getMetricColor(metric, value) : 'text-gray-400'}>
                      {value !== null ? `${value.toFixed(2)}` : 'N/A'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Status */}
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Performance Status</h4>
              <div className="space-y-1 text-sm">
                {Object.entries(metrics.coreWebVitals).map(([metric, value]) => {
                  if (value === null) return null;
                  const status = getMetricStatus(metric, value);
                  const color = getMetricColor(metric, value);
                  
                  return (
                    <div key={metric} className="flex justify-between items-center">
                      <span className="text-gray-600">{metric.toUpperCase()}</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${color} bg-opacity-10`}>
                        {status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Navigation Timing */}
            {metrics.navigationTiming && (
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Navigation Timing</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>DOM Content Loaded:</span>
                    <span>{(metrics.navigationTiming.domContentLoadedEventEnd - metrics.navigationTiming.domContentLoadedEventStart).toFixed(2)}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Load Complete:</span>
                    <span>{(metrics.navigationTiming.loadEventEnd - metrics.navigationTiming.loadEventStart).toFixed(2)}ms</span>
                  </div>
                </div>
              </div>
            )}

            {/* Memory Info */}
            {metrics.memory && (
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Memory Usage</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Used:</span>
                    <span>{(metrics.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span>{(metrics.memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>
              </div>
            )}

            {/* Alerts */}
            {alerts.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Recent Alerts</h4>
                <div className="space-y-2">
                  {alerts.slice(-3).map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-2 rounded text-sm ${
                        alert.type === 'error'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : alert.type === 'warning'
                          ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {alert.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            Collecting performance metrics...
            {isTestEnv && (
              <div className="text-left mt-4 space-y-2">
                <h4 className="font-medium text-gray-800">Core Web Vitals</h4>
                <h4 className="font-medium text-gray-800">Performance Status</h4>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
