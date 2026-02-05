'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { useUnifiedMedia } from '@/contexts/UnifiedMediaContext';
import { useOmniShop } from '@/contexts/OmniShopContext';
import { useStore } from '@/contexts/StoreContext';
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
  clipProductHandle?: string;
}

export default function ExpandableLogoMenu({
  clipId,
  clipTitle,
  clipArtist,
  clipProductHandle,
}: ExpandableLogoMenuProps) {
  // Check if current clip has a shoppable product
  const hasProduct = !!(clipProductHandle && clipProductHandle.trim());
  const [isExpanded, setIsExpanded] = useState(false);
  const [linkTreeOpen, setLinkTreeOpen] = useState(false);
  const [position, setPosition] = useState<SnapPosition>('middle-right'); // DEFAULT
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false); // For backdrop-blur optimization
  const [isOpeningStore, setIsOpeningStore] = useState(false); // Track store opening to prevent badge flash

  const menuRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  // Motion values for smooth position transitions
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const { openHub } = useUnifiedMedia();
  const { openMaison, closeAll: closeAllModals, cartCount: legacyCartCount, storeAccessible: legacyStoreAccessible, checkingStoreAccess: legacyCheckingAccess } = useOmniShop();
  
  // New store system
  const { openStore, isStoreAccessible, isCheckingAccess, cartItemCount, view: storeView } = useStore();
  
  // Use new store values with fallback to legacy
  const storeAccessible = isStoreAccessible || legacyStoreAccessible;
  const checkingStoreAccess = isCheckingAccess && legacyCheckingAccess;
  const cartCount = cartItemCount || legacyCartCount;

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

  const handleShop = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Set flag BEFORE collapse to prevent badge flash
    setIsOpeningStore(true);
    collapse();
    // Use requestAnimationFrame to prevent stuttering on production
    requestAnimationFrame(() => {
      // Close any legacy modals first, then open new Store
      closeAllModals();
      openStore();
      // Reset flag after store is open
      setTimeout(() => setIsOpeningStore(false), 100);
    });
  }, [collapse, closeAllModals, openStore]);

  const handleConnect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    collapse();
    setLinkTreeOpen(true);
  }, [collapse]);

  // ============================================================================
  // Determine Active Buttons & Single-Button Mode
  // ============================================================================
  
  // Count active buttons in the dropdown
  const shopButtonActive = !checkingStoreAccess && storeAccessible;
  const connectButtonActive = true; // Always active
  
  const activeButtonCount = (shopButtonActive ? 1 : 0) + (connectButtonActive ? 1 : 0);
  
  // If only one button, show it directly instead of dropdown
  const singleButtonMode = activeButtonCount === 1;

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

  // SINGLE BUTTON MODE: If only one button (Connect), show it directly
  if (singleButtonMode) {
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
        {/* Single Connect button - styled like the master button */}
        <div
          className={`relative w-14 h-14 flex items-center justify-center rounded-full
                     border border-white/20
                     shadow-[0_12px_32px_rgba(0,0,0,0.6)]
                     ${isAnimating ? 'bg-black/40' : 'bg-black/15 backdrop-blur-xl'}`}
          style={{
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
          }}
        >
          <motion.button
            onClick={handleConnect}
            className="group relative overflow-hidden w-full h-full flex items-center justify-center rounded-full"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Connect"
            style={{
              cursor: isDragging ? 'grabbing' : 'grab',
              willChange: 'transform',
              backfaceVisibility: 'hidden',
            }}
          >
            <svg className="w-6 h-6 text-white/90" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          </motion.button>
        </div>

        {/* LinkTree Modal */}
        <LinkTreeModal isOpen={linkTreeOpen} onClose={() => setLinkTreeOpen(false)} />
      </motion.div>
    );
  }

  // MULTI-BUTTON MODE: Show master button with dropdown
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
        {/* Only show when menu collapsed AND store is completely closed AND not opening */}
        {!isExpanded && !isOpeningStore && storeView === 'closed' && cartCount > 0 && storeAccessible && (
          <span className="absolute -top-1 -right-1 w-[18px] h-[18px] flex items-center justify-center bg-[#ede8df] text-[#1a1817] text-[10px] font-bold rounded-full shadow-lg border border-[#1a1817]/20 z-10 pointer-events-none">
            {cartCount > 9 ? '9+' : cartCount}
          </span>
        )}

        {/* Main logo button - wrapper has shadow (doesn't rotate), inner content rotates */}
        <div
          className={`relative w-14 h-14 flex items-center justify-center rounded-full
                     border border-white/20
                     shadow-[0_12px_32px_rgba(0,0,0,0.6)]
                     ${isAnimating ? 'bg-black/40' : 'bg-black/15 backdrop-blur-xl'}`}
          style={{
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
          }}
        >
          <motion.button
            onClick={handleTap}
            className={`group relative overflow-hidden w-full h-full flex items-center justify-center rounded-full
                       ${hasProduct && !isExpanded && storeAccessible ? 'animate-subtle-shake' : ''}`}
            initial="collapsed"
            animate={isExpanded ? 'expanded' : 'collapsed'}
            variants={logoVariants}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label={isExpanded ? 'Close menu' : 'Open menu'}
            aria-expanded={isExpanded}
            style={{
              cursor: isDragging ? 'grabbing' : 'grab',
              willChange: 'transform',
              backfaceVisibility: 'hidden',
            }}
          >
            <img
              src="/brand-logos/baad-logo.png"
              alt=""
              className="w-8 h-8 object-contain"
              draggable={false}
            />
          </motion.button>
        </div>

        {/* Expanded menu items */}
        <AnimatePresence mode="sync">
          {isExpanded && (
            <>
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
                <motion.div
                  variants={itemVariants}
                  className="relative"
                >
                  <button
                    onClick={handleShop}
                    className="holo-button holo-button-accent"
                    aria-label="Shop"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <img
                      src="/brand-logos/baad.png"
                      alt=""
                      className="w-6 h-6 object-contain"
                      draggable={false}
                    />
                  </button>
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-[#ede8df] text-[#1a1817] text-[10px] font-bold rounded-full shadow-lg border border-[#1a1817]/20 z-20 pointer-events-none">
                      {cartCount > 9 ? '9+' : cartCount}
                    </span>
                  )}
                </motion.div>
              )}

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
