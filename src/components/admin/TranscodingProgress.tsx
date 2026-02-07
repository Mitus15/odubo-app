/**
 * Transcoding Progress Component
 *
 * Real-time visual progress indicator for FFmpeg video transcoding.
 * Polls job status every 2 seconds and displays:
 * - Status badge (Queued → Analyzing → Transcoding → Complete/Failed)
 * - Progress bar with percentage
 * - Detailed info (file sizes, duration, time elapsed)
 * - Error messages if failed
 *
 * Usage:
 * <TranscodingProgress
 *   jobId={123}
 *   videoId={456}
 *   onComplete={() => fetchVideos()}
 *   onError={(err) => showError(err)}
 * />
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { CheckCircle, XCircle, Loader2, Video, FileVideo, Clock, HardDrive } from 'lucide-react';

interface TranscodingJob {
  job_id: number;
  video_id: number;
  status: 'queued' | 'analyzing' | 'transcoding' | 'complete' | 'failed';
  progress: number;
  source_url: string;
  output_url: string | null;
  source_size: number | null;
  output_size: number | null;
  duration_seconds: number | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TranscodingProgressProps {
  jobId: number;
  videoId: number;
  onComplete?: (outputUrl: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

const STATUS_CONFIG = {
  queued: {
    label: 'Queued',
    icon: Clock,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30',
  },
  analyzing: {
    label: 'Analyzing',
    icon: Loader2,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
  },
  transcoding: {
    label: 'Transcoding',
    icon: FileVideo,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30',
  },
  complete: {
    label: 'Complete',
    icon: CheckCircle,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
  },
};

export default function TranscodingProgress({
  jobId,
  videoId,
  onComplete,
  onError,
  className = '',
}: TranscodingProgressProps) {
  const [job, setJob] = useState<TranscodingJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('0s');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  // Fetch job status
  const fetchJobStatus = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const res = await fetch(`/api/arsenal/transcode/${jobId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch job status: ${res.statusText}`);
      }

      const data: TranscodingJob = await res.json();
      setJob(data);

      // Handle completion
      if (data.status === 'complete' && data.output_url) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        onComplete?.(data.output_url);
      }

      // Handle failure
      if (data.status === 'failed') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const errorMsg = data.error_message || 'Transcoding failed';
        setError(errorMsg);
        onError?.(errorMsg);
      }
    } catch (err: any) {
      console.error('[TranscodingProgress] Fetch error:', err);
      setError(err.message);
      onError?.(err.message);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };

  // Update elapsed time
  const updateElapsedTime = () => {
    if (!startTimeRef.current) return;

    const now = new Date();
    const elapsed = Math.floor((now.getTime() - startTimeRef.current.getTime()) / 1000);

    if (elapsed < 60) {
      setElapsedTime(`${elapsed}s`);
    } else if (elapsed < 3600) {
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      setElapsedTime(`${minutes}m ${seconds}s`);
    } else {
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      setElapsedTime(`${hours}h ${minutes}m`);
    }
  };

  // Start polling on mount
  useEffect(() => {
    startTimeRef.current = new Date();
    fetchJobStatus(); // Initial fetch

    // Poll every 2 seconds
    intervalRef.current = setInterval(fetchJobStatus, 2000);

    // Update elapsed time every second
    timerRef.current = setInterval(updateElapsedTime, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [jobId]);

  if (error) {
    return (
      <div className={`p-4 rounded-lg border border-red-500/30 bg-red-500/10 ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <XCircle className="w-5 h-5 text-red-400" />
          <span className="text-sm font-medium text-red-400">Transcoding Failed</span>
        </div>
        <p className="text-xs text-red-300/80">{error}</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className={`p-4 rounded-lg border border-[#502d26]/30 bg-[#502d26]/10 ${className}`}>
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#726d6c]" />
          <span className="text-sm text-[#726d6c]">Loading job status...</span>
        </div>
      </div>
    );
  }

  const config = STATUS_CONFIG[job.status];
  const Icon = config.icon;

  return (
    <div className={`p-4 rounded-lg border ${config.borderColor} ${config.bgColor} ${className}`}>
      {/* Status Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${config.color} ${job.status === 'analyzing' || job.status === 'transcoding' ? 'animate-spin' : ''}`} />
          <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#726d6c]">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{elapsedTime}</span>
          </div>
          {job.status === 'transcoding' && (
            <span className="font-mono">{job.progress}%</span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {(job.status === 'analyzing' || job.status === 'transcoding') && (
        <div className="mb-3">
          <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden">
            <div
              className={`h-full ${config.bgColor} transition-all duration-300 ease-out`}
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Detailed Info */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {job.duration_seconds && (
          <div className="flex items-center gap-1 text-[#726d6c]">
            <Video className="w-3 h-3" />
            <span>{Math.round(job.duration_seconds)}s duration</span>
          </div>
        )}
        {job.source_size && (
          <div className="flex items-center gap-1 text-[#726d6c]">
            <HardDrive className="w-3 h-3" />
            <span>{formatBytes(job.source_size)} source</span>
          </div>
        )}
        {job.output_size && (
          <div className="flex items-center gap-1 text-[#726d6c]">
            <HardDrive className="w-3 h-3" />
            <span>{formatBytes(job.output_size)} output</span>
          </div>
        )}
      </div>

      {/* Success Message */}
      {job.status === 'complete' && job.output_url && (
        <div className="mt-3 pt-3 border-t border-green-500/20">
          <p className="text-xs text-green-300/80">
            ✓ Video transcoded successfully. Ready to deploy to PostForMe.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Math.round(bytes / Math.pow(k, i) * 10) / 10} ${sizes[i]}`;
}
