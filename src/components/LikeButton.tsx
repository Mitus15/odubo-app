'use client';

import { useState, useEffect } from 'react';

interface LikeButtonProps {
  userId: string;
  itemId: string;
  itemType: 'track' | 'video' | 'album';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  onLikeChange?: (liked: boolean) => void;
}

export default function LikeButton({
  userId,
  itemId,
  itemType,
  size = 'md',
  showLabel = false,
  className = '',
  onLikeChange
}: LikeButtonProps) {
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Size variants
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const buttonSizeClasses = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-3'
  };

  // Check initial like status
  useEffect(() => {
    const checkLikeStatus = async () => {
      if (!userId) {
        setChecking(false);
        return;
      }

      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const response = await fetch(
          `/api/likes/check?item_id=${itemId}&type=${itemType}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }
        );
        const data = await response.json() as { success: boolean; liked: boolean };

        if (data.success) {
          setLiked(data.liked);
        }
      } catch (error) {
        console.error('Error checking like status:', error);
      } finally {
        setChecking(false);
      }
    };

    checkLikeStatus();
  }, [userId, itemId, itemType]);

  const handleToggleLike = async () => {
    if (!userId || loading) return;

    setLoading(true);
    try {
      const method = liked ? 'DELETE' : 'POST';
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const response = await fetch('/api/likes', {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          item_id: itemId,
          type: itemType
        }),
      });

      const data = await response.json() as { success: boolean; error?: string };

      if (data.success) {
        const newLikedState = !liked;
        setLiked(newLikedState);
        onLikeChange?.(newLikedState);
      } else {
        console.error('Error toggling like:', data.error);
        // Show error to user (you could add a toast notification here)
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <button
        disabled
        className={`
          inline-flex items-center justify-center rounded-full transition-colors
          ${buttonSizeClasses[size]}
          bg-gray-800 text-gray-500
          ${className}
        `}
      >
        <svg
          className={`${sizeClasses[size]} animate-spin`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={handleToggleLike}
      disabled={loading || !userId}
      className={`
        inline-flex items-center justify-center rounded-full transition-all duration-200
        ${buttonSizeClasses[size]}
        ${liked 
          ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/25' 
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-red-400'
        }
        ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
        ${!userId ? 'opacity-50 cursor-not-allowed' : ''}
        focus:outline-none focus:ring-2 focus:ring-red-500/50
        ${className}
      `}
      title={`${liked ? 'Unlike' : 'Like'} this ${itemType}`}
    >
      <div className="flex items-center space-x-2">
        {loading ? (
          <svg
            className={`${sizeClasses[size]} animate-spin`}
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <svg
            className={`${sizeClasses[size]} transition-transform duration-200 ${liked ? 'scale-110' : ''}`}
            fill={liked ? 'currentColor' : 'none'}
            stroke={liked ? 'none' : 'currentColor'}
            strokeWidth={liked ? 0 : 2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
            />
          </svg>
        )}
        {showLabel && (
          <span className="text-sm font-medium">
            {liked ? 'Liked' : 'Like'}
          </span>
        )}
      </div>
    </button>
  );
}

// Helper component for displaying like count
interface LikeCountProps {
  itemId: string;
  itemType: 'track' | 'video' | 'album';
  className?: string;
}

export function LikeCount({ itemId, itemType, className = '' }: LikeCountProps) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchLikeCount = async () => {
      try {
        // We'll need to create an endpoint for this
        const response = await fetch(`/api/likes/count?item_id=${itemId}&type=${itemType}`);
        const data = await response.json() as { success: boolean; count: number };
        
        if (data.success) {
          setCount(data.count);
        }
      } catch (error) {
        console.error('Error fetching like count:', error);
      }
    };

    fetchLikeCount();
  }, [itemId, itemType]);

  if (count === null) {
    return null;
  }

  if (count === 0) {
    return null;
  }

  return (
    <span className={`text-sm text-gray-500 ${className}`}>
      {count} {count === 1 ? 'like' : 'likes'}
    </span>
  );
}
