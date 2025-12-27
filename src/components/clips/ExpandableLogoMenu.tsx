'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { useUnifiedMedia } from '@/contexts/UnifiedMediaContext';
import { useOmniShop } from '@/contexts/OmniShopContext';
import LinkTreeModal from '@/components/linktree/LinkTreeModal';

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
  const [linkTreeOpen, setLinkTreeOpen] = useState(false);
  const [position, setPosition] = useState<SnapPosition>('middle-right'); // DEFAULT
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false); // For backdrop-blur optimization

  const menuRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  // Motion values for smooth position transitions
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const { openHub } = useUnifiedMedia();
  const { openMaison, cartCount, storeAccessible, checkingStoreAccess } = useOmniShop();

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

  const handleDragStart = useCallback((
    event: MouseEvent | TouchEvent | PointerEvent,
    info: { point: { x: number; y: number } }
  ) => {
    setIsDragging(true);
    setIsAnimating(true); // Disable expensive backdrop-blur during drag
    dragStartPos.current = { x: info.point.x, y: info.point.y };
    if (isExpanded) setIsExpanded(false);
  }, [isExpanded]);

  const handleDragEnd = useCallback((
    event: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }
  ) => {
    const { offset, velocity } = info;

    // Animate back to origin (optimized: higher stiffness = fewer frames needed)
    animate(x, 0, { type: 'spring', stiffness: 500, damping: 50, mass: 0.5 });
    animate(y, 0, { type: 'spring', stiffness: 500, damping: 50, mass: 0.5 });

    // Determine next position based on gesture
    const nextPos = getNextPosition(
      position,
      offset.x,
      offset.y,
      velocity.x,
      velocity.y
    );

    // If valid movement, change position
    if (nextPos && nextPos !== position) {
      savePosition(nextPos);
    }

    // Reset state after animation settles
    setTimeout(() => {
      setIsDragging(false);
      setIsAnimating(false); // Re-enable backdrop-blur
      dragStartPos.current = null;
    }, 300);
  }, [position, getNextPosition, savePosition, x, y]);

  // ============================================================================
  // Menu Toggle
  // ============================================================================

  const collapse = useCallback(() => setIsExpanded(false), []);

  const handleTap = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    // Don't toggle if actively dragging
    if (isDragging) return;
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

  const handleMoments = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    collapse();
    // Use requestAnimationFrame to prevent stuttering on production
    requestAnimationFrame(() => {
      openHub('moments');
    });
  }, [collapse, openHub]);

  const handleShop = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    collapse();
    // Use requestAnimationFrame to prevent stuttering on production
    requestAnimationFrame(() => {
      openMaison();
    });
  }, [collapse, openMaison]);

  const handleAccount = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    collapse();
    // Redirect directly to Shopify account portal
    window.location.href = 'https://account.odubo.studio';
  }, [collapse]);

  const handleConnect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    collapse();
    setLinkTreeOpen(true);
  }, [collapse]);

  // ============================================================================
  // Animation Variants (memoized for performance)
  // ============================================================================

  const menuVariants = useMemo(() => ({
    collapsed: {
      transition: {
        staggerChildren: 0.025, // Slightly faster stagger on close
        staggerDirection: -1,
        when: 'afterChildren',
      },
    },
    expanded: {
      transition: {
        staggerChildren: 0.03,
        staggerDirection: 1,
        delayChildren: 0.08,
      },
    },
  }), []);

  // Optimized: Use tween instead of spring for menu items (faster calculations)
  const itemVariants = useMemo(() => ({
    collapsed: {
      opacity: 0,
      scale: 0.95,
      y: -6,
      transition: {
        type: 'tween',
        duration: 0.18,
        ease: [0.4, 0, 0.2, 1], // Smoother ease-out for closing
      },
    },
    expanded: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'tween',
        duration: 0.2,
        ease: [0.32, 0.72, 0, 1],
      },
    },
  }), []);

  // Optimized: faster spring with lower mass, smoother close
  const logoVariants = useMemo(() => ({
    collapsed: {
      rotate: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 500,
        damping: 35,
        mass: 0.4,
      },
    },
    expanded: {
      rotate: 45,
      scale: 1.03,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 40,
        mass: 0.5,
      },
    },
  }), []);

  const connectingLineVariants = useMemo(() => ({
    collapsed: {
      opacity: 0,
      scaleY: 0,
      transition: {
        duration: 0.2,
        ease: [0.34, 1.56, 0.64, 1],
      },
    },
    expanded: {
      opacity: 1,
      scaleY: 1,
      transition: {
        duration: 0.3,
        delay: 0.05,
        ease: [0.34, 1.56, 0.64, 1],
      },
    },
  }), []);

  // Memoize derived values
  const menuDirection = useMemo(() => position === 'bottom-right' ? 'up' : 'down', [position]);
  const positionStyle = useMemo(() => getPositionStyle(position), [position, getPositionStyle]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <motion.div
      ref={menuRef}
      className="fixed z-50"
      style={{
        ...positionStyle,
        touchAction: 'none',
        x,
        y,
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.15}
      dragMomentum={false}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="relative flex flex-col items-center gap-2">
        {/* Notification badge - positioned relative to container, not button */}
        {/* Only show when store is accessible */}
        {!isExpanded && cartCount > 0 && storeAccessible && (
          <span className="absolute -top-1 -right-1 w-[18px] h-[18px] flex items-center justify-center bg-[#ede8df] text-[#1a1817] text-[10px] font-bold rounded-full shadow-lg border border-[#1a1817]/20 z-10 pointer-events-none">
            {cartCount > 9 ? '9+' : cartCount}
          </span>
        )}

        {/* Main logo button */}
        <motion.button
          onClick={handleTap}
          className={`group relative overflow-hidden
                     w-14 h-14 flex items-center justify-center rounded-full
                     border border-white/20
                     shadow-[0_12px_32px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.4)]
                     ${isAnimating ? 'bg-black/40' : 'bg-black/15 backdrop-blur-xl'}`}
          initial="collapsed"
          animate={isExpanded ? 'expanded' : 'collapsed'}
          variants={logoVariants}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label={isExpanded ? 'Close menu' : 'Open menu'}
          aria-expanded={isExpanded}
          style={{
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
            cursor: isDragging ? 'grabbing' : 'grab',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
          }}
        >
          <img
            src="/odubo_logo_emboss.png"
            alt=""
            className="w-7 h-7 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
            draggable={false}
          />

          {/* Glow effect when expanded - no AnimatePresence overhead */}
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent pointer-events-none"
            animate={{ opacity: isExpanded ? 1 : 0, scale: isExpanded ? 1 : 0.8 }}
            transition={{ duration: 0.15 }}
          />
        </motion.button>

        {/* Expanded menu items */}
        <AnimatePresence mode="sync">
          {isExpanded && (
            <>
              {/* Connecting line/gradient indicator */}
              <motion.div
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
                variants={connectingLineVariants}
                className={`absolute ${menuDirection === 'up' ? 'bottom-full' : 'top-full'} w-[2px] pointer-events-none`}
                style={{
                  height: '12px',
                  background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.05))',
                  transformOrigin: menuDirection === 'up' ? 'bottom' : 'top',
                  [menuDirection === 'up' ? 'bottom' : 'top']: BUTTON_SIZE / 2,
                }}
              />
              
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
              {/* Shop button with BAAD logo - conditionally rendered */}
              {!checkingStoreAccess && storeAccessible && (
                <motion.button
                  variants={itemVariants}
                  onClick={handleShop}
                  className="holo-button holo-button-accent relative"
                  aria-label="Shop"
                  style={{ touchAction: 'manipulation', willChange: 'transform, opacity', transform: 'translateZ(0)' }}
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
              )}

              {/* Moments Camera button */}
              <motion.button
                variants={itemVariants}
                onClick={handleMoments}
                className="holo-button"
                aria-label="Moments"
                style={{ touchAction: 'manipulation', willChange: 'transform, opacity', transform: 'translateZ(0)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
              </motion.button>

              {/* Connect button - LinkTree / Digital Presence Hub */}
              <motion.button
                variants={itemVariants}
                onClick={handleConnect}
                className="holo-button"
                aria-label="Connect"
                style={{ touchAction: 'manipulation', willChange: 'transform, opacity', transform: 'translateZ(0)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              </motion.button>

              {/* Account button - only shown when store is enabled */}
              {!checkingStoreAccess && storeAccessible && (
                <motion.button
                  variants={itemVariants}
                  onClick={handleAccount}
                  className="holo-button"
                  aria-label="Account"
                  style={{ touchAction: 'manipulation', willChange: 'transform, opacity', transform: 'translateZ(0)' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </motion.button>
              )}
            </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* LinkTree Modal */}
      <LinkTreeModal isOpen={linkTreeOpen} onClose={() => setLinkTreeOpen(false)} />
    </motion.div>
  );
}
