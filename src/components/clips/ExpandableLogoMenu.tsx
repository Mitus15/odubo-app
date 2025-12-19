'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { useUnifiedMedia } from '@/contexts/UnifiedMediaContext';
import { useOmniShop } from '@/contexts/OmniShopContext';
import { useAuthModal } from '@/contexts/AuthModalContext';

/**
 * Master Button - Draggable Navigation Menu
 *
 * POSITIONS (3 fixed points):
 *
 *   [middle-left] ←—————→ [middle-right]   (DEFAULT)
 *                               ↑
 *                               │
 *                         [bottom-right]
 *
 * MOVEMENT RULES:
 * - bottom-right: flick UP → middle-right
 * - middle-right: flick DOWN → bottom-right, flick LEFT → middle-left
 * - middle-left: flick RIGHT → middle-right
 *
 * Diagonal movements and movements to non-designated positions are ignored.
 */

type SnapPosition = 'bottom-right' | 'middle-right' | 'middle-left';

const STORAGE_KEY = 'odubo-menu-position';
const BUTTON_SIZE = 56;
const EDGE_MARGIN = 16;

// Thresholds for gesture detection
const FLICK_VELOCITY = 200;    // px/s - minimum velocity to count as a flick
const DRAG_DISTANCE = 30;      // px - minimum distance to trigger a move
const DIRECTION_TOLERANCE = 0.7; // cos(45°) ≈ 0.707 - how strict diagonal detection is

interface ExpandableLogoMenuProps {
  clipId?: number;
  clipTitle?: string;
  clipArtist?: string;
}

export default function ExpandableLogoMenu({
  clipId,
  clipTitle,
  clipArtist,
}: ExpandableLogoMenuProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shareToast, setShareToast] = useState<'copied' | 'shared' | 'failed' | null>(null);
  const [position, setPosition] = useState<SnapPosition>('middle-right'); // DEFAULT
  const [isDragging, setIsDragging] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const dragStartTime = useRef<number>(0);

  // Motion values for smooth position transitions
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const { openHub } = useUnifiedMedia();
  const { openMaison, cartCount } = useOmniShop();
  const { openSignIn } = useAuthModal();

  // ============================================================================
  // Position Management
  // ============================================================================

  // Load position from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && ['bottom-right', 'middle-right', 'middle-left'].includes(saved)) {
        setPosition(saved as SnapPosition);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save position to localStorage
  const savePosition = useCallback((pos: SnapPosition) => {
    setPosition(pos);
    try {
      localStorage.setItem(STORAGE_KEY, pos);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Get CSS positioning for each snap position
  const getPositionStyle = useCallback((pos: SnapPosition): React.CSSProperties => {
    const safeBottom = 'max(env(safe-area-inset-bottom, 0px), 16px)';

    switch (pos) {
      case 'bottom-right':
        return {
          position: 'fixed',
          right: EDGE_MARGIN,
          bottom: `calc(${safeBottom} + ${EDGE_MARGIN}px)`,
          left: 'auto',
          top: 'auto',
        };
      case 'middle-right':
        return {
          position: 'fixed',
          right: EDGE_MARGIN,
          top: '50%',
          left: 'auto',
          bottom: 'auto',
          transform: 'translateY(-50%)',
        };
      case 'middle-left':
        return {
          position: 'fixed',
          left: EDGE_MARGIN,
          top: '50%',
          right: 'auto',
          bottom: 'auto',
          transform: 'translateY(-50%)',
        };
    }
  }, []);

  // ============================================================================
  // Movement Logic - The Core of the "Idiot-Proof" System
  // ============================================================================

  /**
   * Determine the next position based on gesture direction.
   * Returns null if the movement is not allowed from the current position.
   */
  const getNextPosition = useCallback((
    currentPos: SnapPosition,
    deltaX: number,
    deltaY: number,
    velocityX: number,
    velocityY: number
  ): SnapPosition | null => {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const absVelX = Math.abs(velocityX);
    const absVelY = Math.abs(velocityY);

    // Calculate gesture magnitude
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const velocity = Math.sqrt(velocityX * velocityX + velocityY * velocityY);

    // Ignore tiny gestures
    if (distance < 10 && velocity < 50) return null;

    // Determine if gesture is primarily horizontal or vertical
    // Using the higher of distance ratio or velocity ratio
    const isHorizontal = absX > absY * 1.5 || absVelX > absVelY * 1.5;
    const isVertical = absY > absX * 1.5 || absVelY > absVelX * 1.5;

    // If diagonal (neither clearly horizontal nor vertical), ignore
    if (!isHorizontal && !isVertical) return null;

    // Check if gesture meets minimum thresholds (either distance OR velocity)
    const hasEnoughDistance = distance >= DRAG_DISTANCE;
    const hasEnoughVelocity = velocity >= FLICK_VELOCITY;

    if (!hasEnoughDistance && !hasEnoughVelocity) return null;

    // Determine direction
    const isUp = isVertical && (deltaY < 0 || velocityY < -FLICK_VELOCITY);
    const isDown = isVertical && (deltaY > 0 || velocityY > FLICK_VELOCITY);
    const isLeft = isHorizontal && (deltaX < 0 || velocityX < -FLICK_VELOCITY);
    const isRight = isHorizontal && (deltaX > 0 || velocityX > FLICK_VELOCITY);

    // Apply movement rules based on current position
    switch (currentPos) {
      case 'bottom-right':
        // Can ONLY go UP to middle-right
        if (isUp) return 'middle-right';
        return null;

      case 'middle-right':
        // Can go DOWN to bottom-right OR LEFT to middle-left
        if (isDown) return 'bottom-right';
        if (isLeft) return 'middle-left';
        return null;

      case 'middle-left':
        // Can ONLY go RIGHT to middle-right
        if (isRight) return 'middle-right';
        return null;
    }
  }, []);

  // ============================================================================
  // Drag Handlers
  // ============================================================================

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    dragStartTime.current = Date.now();
    if (isExpanded) setIsExpanded(false);
  }, [isExpanded]);

  const handleDragEnd = useCallback((
    event: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }
  ) => {
    const { offset, velocity } = info;

    // Determine next position
    const nextPos = getNextPosition(
      position,
      offset.x,
      offset.y,
      velocity.x,
      velocity.y
    );

    // Animate back to origin first (spring snap)
    animate(x, 0, { type: 'spring', stiffness: 500, damping: 35 });
    animate(y, 0, { type: 'spring', stiffness: 500, damping: 35 });

    // If valid movement, change position after a tiny delay for visual feedback
    if (nextPos && nextPos !== position) {
      savePosition(nextPos);
    }

    // Reset state
    setTimeout(() => setIsDragging(false), 50);
  }, [position, getNextPosition, savePosition, x, y]);

  // ============================================================================
  // Menu Toggle
  // ============================================================================

  const expand = useCallback(() => setIsExpanded(true), []);
  const collapse = useCallback(() => setIsExpanded(false), []);

  const handleTap = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();

    // If we just finished dragging, don't toggle
    const timeSinceDragStart = Date.now() - dragStartTime.current;
    if (isDragging || timeSinceDragStart < 100) return;

    setIsExpanded(prev => !prev);
  }, [isDragging]);

  // Click outside to close
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        collapse();
      }
    };

    const timeout = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isExpanded, collapse]);

  // ============================================================================
  // Action Handlers
  // ============================================================================

  const handleMedia = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    collapse();
    openHub();
  }, [collapse, openHub]);

  const handleShop = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    collapse();
    openMaison();
  }, [collapse, openMaison]);

  const handleAccount = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    collapse();
    openSignIn();
  }, [collapse, openSignIn]);

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    collapse();

    const url = clipId ? `${window.location.origin}/?clip=${clipId}` : window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: clipTitle || 'Odubo',
          text: clipTitle && clipArtist ? `${clipTitle} • ${clipArtist}` : 'Check this out',
          url
        });
        setShareToast('shared');
      } else {
        await navigator.clipboard.writeText(url);
        setShareToast('copied');
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        setShareToast('failed');
      }
    }
    setTimeout(() => setShareToast(null), 2000);
  }, [clipId, clipTitle, clipArtist, collapse]);

  // ============================================================================
  // Animation Variants
  // ============================================================================

  const menuVariants = {
    collapsed: {
      transition: { staggerChildren: 0.03, staggerDirection: -1 },
    },
    expanded: {
      transition: { staggerChildren: 0.05, staggerDirection: 1, delayChildren: 0.05 },
    },
  };

  const itemVariants = {
    collapsed: {
      opacity: 0,
      scale: 0.8,
      transition: { type: 'spring', stiffness: 400, damping: 25 },
    },
    expanded: {
      opacity: 1,
      scale: 1,
      transition: { type: 'spring', stiffness: 400, damping: 25 },
    },
  };

  const logoVariants = {
    collapsed: { rotate: 0, scale: 1 },
    expanded: { rotate: 45, scale: 1.05 },
  };

  // Determine menu direction based on position
  const menuDirection = position === 'bottom-right' ? 'up' : 'down';
  const isOnLeft = position === 'middle-left';

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <motion.div
      ref={menuRef}
      className="fixed z-50"
      style={{
        ...getPositionStyle(position),
        touchAction: 'none',
        x,
        y,
      }}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.15}
      dragMomentum={false}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="relative flex flex-col items-center gap-2">
        {/* Share toast */}
        <AnimatePresence>
          {shareToast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute bottom-full mb-4 px-4 py-2 rounded-full bg-black/70 backdrop-blur-sm text-white text-sm font-medium whitespace-nowrap"
            >
              {shareToast === 'copied' && 'Link copied'}
              {shareToast === 'shared' && 'Shared'}
              {shareToast === 'failed' && 'Share failed'}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notification badge - positioned relative to container, not button */}
        {!isExpanded && cartCount > 0 && (
          <span className="absolute -top-1 -right-1 w-[18px] h-[18px] flex items-center justify-center bg-[#ede8df] text-[#1a1817] text-[10px] font-bold rounded-full shadow-lg border border-[#1a1817]/20 z-10 pointer-events-none">
            {cartCount > 9 ? '9+' : cartCount}
          </span>
        )}

        {/* Main logo button */}
        <motion.button
          onClick={handleTap}
          className="holo-button holo-button-lg relative overflow-hidden"
          initial="collapsed"
          animate={isExpanded ? 'expanded' : 'collapsed'}
          variants={logoVariants}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          aria-label={isExpanded ? 'Close menu' : 'Open menu'}
          aria-expanded={isExpanded}
          style={{
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        >
          <img
            src="/odubo_logo_emboss.png"
            alt=""
            className="w-7 h-7 object-contain"
            draggable={false}
          />

          {/* Glow effect when expanded */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent pointer-events-none"
              />
            )}
          </AnimatePresence>
        </motion.button>

        {/* Expanded menu items */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              variants={menuVariants}
              className={`absolute flex flex-col items-center gap-2 ${
                menuDirection === 'up' ? 'bottom-full mb-3' : 'top-full mt-3'
              }`}
              style={{
                flexDirection: menuDirection === 'up' ? 'column-reverse' : 'column',
              }}
            >
              {/* Shop button with BAAD logo */}
              <motion.button
                variants={itemVariants}
                onClick={handleShop}
                className="holo-button holo-button-accent relative"
                aria-label="Shop"
              >
                <img
                  src="/brand-logos/baad.png"
                  alt=""
                  className="w-6 h-6 object-contain"
                  draggable={false}
                />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center bg-[#b2a491] text-[#1a1817] text-[9px] font-semibold rounded-full shadow-sm">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </motion.button>

              {/* Media button */}
              <motion.button
                variants={itemVariants}
                onClick={handleMedia}
                className="holo-button"
                aria-label="Media"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
              </motion.button>

              {/* Share button */}
              <motion.button
                variants={itemVariants}
                onClick={handleShare}
                className="holo-button"
                aria-label="Share"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </motion.button>

              {/* Account button */}
              <motion.button
                variants={itemVariants}
                onClick={handleAccount}
                className="holo-button"
                aria-label="Account"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
