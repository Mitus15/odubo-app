import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PerformanceMonitor from '../PerformanceMonitor';

// Mock Performance API
const mockPerformance = {
  getEntriesByType: jest.fn(() => []),
  mark: jest.fn(),
  measure: jest.fn(),
  now: jest.fn(() => Date.now()),
};

Object.defineProperty(window, 'performance', {
  writable: true,
  value: mockPerformance,
});

// Mock PerformanceObserver
global.PerformanceObserver = class PerformanceObserver {
  static supportedEntryTypes: string[] = ['resource', 'mark', 'measure'];
  constructor(callback: any) {}
  observe() {}
  disconnect() {}
  takeRecords() { return []; }
};

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockPerformance.getEntriesByType.mockReturnValue([]);
  });

  it('renders performance button when not visible', () => {
    render(<PerformanceMonitor />);
    
    const button = screen.getByText('📊 Performance');
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-blue-600');
  });

  it('shows performance monitor when button is clicked', () => {
    render(<PerformanceMonitor />);
    
    const button = screen.getByText('📊 Performance');
    fireEvent.click(button);
    
    expect(screen.getByText('📊 Performance Monitor')).toBeInTheDocument();
    expect(screen.getByText('Core Web Vitals & Performance Metrics')).toBeInTheDocument();
  });

  it('displays start/stop monitoring button', () => {
    render(<PerformanceMonitor />);
    
    const button = screen.getByText('📊 Performance');
    fireEvent.click(button);
    
    const startButton = screen.getByText('Start');
    expect(startButton).toBeInTheDocument();
    expect(startButton).toHaveClass('bg-green-100');
  });

  it('toggles monitoring state when start/stop button is clicked', async () => {
    render(<PerformanceMonitor />);
    
    const button = screen.getByText('📊 Performance');
    fireEvent.click(button);
    
    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('Stop')).toBeInTheDocument();
    });
    
    const stopButton = screen.getByText('Stop');
    fireEvent.click(stopButton);
    
    await waitFor(() => {
      expect(screen.getByText('Start')).toBeInTheDocument();
    });
  });

  it('displays close button and closes monitor', () => {
    render(<PerformanceMonitor />);
    
    const button = screen.getByText('📊 Performance');
    fireEvent.click(button);
    
    const closeButton = screen.getByText('✕');
    expect(closeButton).toBeInTheDocument();
    
    fireEvent.click(closeButton);
    
    // Should show the performance button again
    expect(screen.getByText('📊 Performance')).toBeInTheDocument();
    expect(screen.queryByText('📊 Performance Monitor')).not.toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<PerformanceMonitor />);
    
    const button = screen.getByText('📊 Performance');
    fireEvent.click(button);
    
    expect(screen.getByText('Collecting performance metrics...')).toBeInTheDocument();
  });

  it('displays Core Web Vitals section', () => {
    render(<PerformanceMonitor />);
    
    const button = screen.getByText('📊 Performance');
    fireEvent.click(button);
    
    expect(screen.getByText('Core Web Vitals')).toBeInTheDocument();
  });

  it('displays Performance Status section', () => {
    render(<PerformanceMonitor />);
    
    const button = screen.getByText('📊 Performance');
    fireEvent.click(button);
    
    expect(screen.getByText('Performance Status')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<PerformanceMonitor />);
    
    const button = screen.getByText('📊 Performance');
    expect(button).toHaveAttribute('aria-label', 'Open performance monitor');
  });

  it('handles monitoring interval cleanup', async () => {
    jest.useFakeTimers();
    
    render(<PerformanceMonitor />);
    
    const button = screen.getByText('📊 Performance');
    fireEvent.click(button);
    
    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);
    
    // Fast-forward time to trigger interval
    jest.advanceTimersByTime(5000);
    
    // Cleanup
    jest.useRealTimers();
  });
});
