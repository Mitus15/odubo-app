"use client";

import { useState, useEffect } from 'react';

interface AccessibilitySettings {
  highContrast: boolean;
  largeText: boolean;
  focusIndicators: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
}

export default function AccessibilityEnhancer() {
  const [isVisible, setVisible] = useState(false);
  const [settings, setSettings] = useState<AccessibilitySettings>({
    highContrast: false,
    largeText: false,
    focusIndicators: true,
    reducedMotion: false,
    screenReader: false,
  });

  // Apply accessibility settings to the document
  useEffect(() => {
    const root = document.documentElement;
    
    // High contrast mode
    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    // Large text mode
    if (settings.largeText) {
      root.classList.add('large-text');
    } else {
      root.classList.remove('large-text');
    }
    
    // Focus indicators
    if (settings.focusIndicators) {
      root.classList.add('focus-visible');
    } else {
      root.classList.remove('focus-visible');
    }
    
    // Reduced motion
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }
    
    // Screen reader optimizations
    if (settings.screenReader) {
      root.classList.add('screen-reader-optimized');
    } else {
      root.classList.remove('screen-reader-optimized');
    }
  }, [settings]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('accessibility-settings', JSON.stringify(settings));
  }, [settings]);

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('accessibility-settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading accessibility settings:', error);
      }
    }
  }, []);

  // Toggle setting
  const toggleSetting = (key: keyof AccessibilitySettings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Reset to defaults
  const resetToDefaults = () => {
    setSettings({
      highContrast: false,
      largeText: false,
      focusIndicators: true,
      reducedMotion: false,
      screenReader: false,
    });
  };

  // Announce changes to screen readers
  const announceChange = (setting: string, enabled: boolean) => {
    const message = `${setting} ${enabled ? 'enabled' : 'disabled'}`;
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  };

  // Handle setting change with announcement
  const handleSettingChange = (key: keyof AccessibilitySettings) => {
    const newValue = !settings[key];
    toggleSetting(key);
    
    const settingNames = {
      highContrast: 'High contrast mode',
      largeText: 'Large text mode',
      focusIndicators: 'Focus indicators',
      reducedMotion: 'Reduced motion',
      screenReader: 'Screen reader optimizations',
    };
    
    announceChange(settingNames[key], newValue);
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed bottom-4 left-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-lg transition-colors z-50"
        aria-label="Open accessibility settings"
      >
        ♿ Accessibility
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 bg-white rounded-lg shadow-lg border border-gray-200 max-w-md w-full z-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">♿ Accessibility Settings</h3>
          <button
            onClick={() => setVisible(false)}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close accessibility settings"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Customize your experience for better accessibility
        </p>
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        <div className="space-y-4">
          {/* High Contrast Mode */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-800">High Contrast Mode</h4>
              <p className="text-sm text-gray-600">
                Increases contrast for better visibility
              </p>
            </div>
            <button
              onClick={() => handleSettingChange('highContrast')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                settings.highContrast ? 'bg-blue-600' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={settings.highContrast}
              aria-label="Toggle high contrast mode"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.highContrast ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Large Text Mode */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-800">Large Text Mode</h4>
              <p className="text-sm text-gray-600">
                Increases font size for better readability
              </p>
            </div>
            <button
              onClick={() => handleSettingChange('largeText')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                settings.largeText ? 'bg-blue-600' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={settings.largeText}
              aria-label="Toggle large text mode"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.largeText ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Focus Indicators */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-800">Focus Indicators</h4>
              <p className="text-sm text-gray-600">
                Shows clear focus indicators for keyboard navigation
              </p>
            </div>
            <button
              onClick={() => handleSettingChange('focusIndicators')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                settings.focusIndicators ? 'bg-blue-600' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={settings.focusIndicators}
              aria-label="Toggle focus indicators"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.focusIndicators ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Reduced Motion */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-800">Reduced Motion</h4>
              <p className="text-sm text-gray-600">
                Reduces animations for motion sensitivity
              </p>
            </div>
            <button
              onClick={() => handleSettingChange('reducedMotion')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                settings.reducedMotion ? 'bg-blue-600' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={settings.reducedMotion}
              aria-label="Toggle reduced motion"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.reducedMotion ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Screen Reader Optimizations */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-800">Screen Reader Optimizations</h4>
              <p className="text-sm text-gray-600">
                Enhances screen reader compatibility
              </p>
            </div>
            <button
              onClick={() => handleSettingChange('screenReader')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                settings.screenReader ? 'bg-blue-600' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={settings.screenReader}
              aria-label="Toggle screen reader optimizations"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.screenReader ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Reset Button */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={resetToDefaults}
              className="w-full px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Reset to Defaults
            </button>
          </div>

          {/* Keyboard Shortcuts Info */}
          <div className="pt-4 border-t border-gray-200">
            <h4 className="font-medium text-gray-800 mb-2">Keyboard Shortcuts</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Tab</kbd> Navigate between elements</div>
              <div><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Enter</kbd> Activate buttons/links</div>
              <div><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Space</kbd> Toggle checkboxes</div>
              <div><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Escape</kbd> Close modals</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
