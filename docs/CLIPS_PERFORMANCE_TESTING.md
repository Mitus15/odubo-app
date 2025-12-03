# Clips Performance Testing Guide

## TikTok-Style Optimizations Implementation

This document outlines the testing process for validating the TikTok-inspired performance improvements to the Clips feed.

## What Was Implemented

### 1. **Sliding Window Virtualization**
- Only renders `activeIndex ± 2` clips in full (5 total video players max)
- Off-screen clips replaced with lightweight poster placeholders
- Maintains scroll height and document structure
- **Expected Impact:** 60-80% reduction in memory usage for long sessions

### 2. **Aggressive HLS Preloading**
- Next video (`activeIndex + 1`) starts buffering while current video plays
- 2-second lazy destruction delay for smooth back-scrolling
- Separate "preload-only" mode with smaller buffer (3s vs 8s)
- **Expected Impact:** 50-90% reduction in time-to-play on scroll

### 3. **Adaptive Buffering**
- Network-aware buffer sizing via `navigator.connection.effectiveType`
- Slow networks (2G/3G): 4-8s buffer
- Fast networks (4G+): 8-12s buffer
- Preload mode: 3-6s buffer (lightweight)
- **Expected Impact:** Better balance between quality and startup time

### 4. **Mobile-First UX**
- `overscroll-behavior-y: none` prevents iOS rubber-banding
- `touch-action: pan-y` disables horizontal swipe gestures
- Manual poster overlay with smooth fade on `canplay` event
- **Expected Impact:** Native app-like feel on mobile devices

---

## Testing Protocols

### Phase 1: Development Environment Testing

#### A. Enable Performance Debugger
1. Open `/clips` in development mode
2. Press `Cmd+Shift+P` (Mac) or click the 📊 icon
3. Monitor real-time metrics:
   - **FPS:** Should stay at 55-60 during scroll
   - **Memory:** Should stabilize under 150MB after scrolling 20+ clips
   - **Buffer Health:** Should show 3-8s for active video
   - **Active Videos:** Should always be 1 (only current clip playing)
   - **Scroll Jank:** Should be 0-2 drops/second
   - **Time-to-Play:** Should be < 200ms on fast connections

#### B. Manual Testing Patterns
1. **Fast Scroll Test**
   - Rapidly scroll through 10 clips (1 second per clip)
   - Monitor: FPS should stay > 50, no buffering spinners
   
2. **Slow Scroll Test**
   - Slowly scroll through 10 clips (5+ seconds per clip)
   - Monitor: Each video should start instantly (< 100ms)
   
3. **Back-Scroll Test**
   - Scroll down 5 clips, then scroll back up 3 clips
   - Monitor: Previously viewed clips should resume instantly (no re-buffering)
   
4. **Long Session Test**
   - Scroll through 50+ clips continuously
   - Monitor: Memory should not exceed 200MB, no memory leak pattern

#### C. Network Throttling Tests
Use Chrome DevTools > Network tab to simulate:

| Profile | Expected Buffer | Expected Time-to-Play |
|---------|----------------|---------------------|
| Fast 3G | 4-6s | 300-500ms |
| Slow 3G | 4s | 500-800ms |
| Offline | N/A | Graceful error |
| Fast 4G | 8-10s | < 200ms |

---

### Phase 2: Real Device Testing

#### A. Test Devices (Priority Order)
1. **iPhone SE (2nd gen)** - Low memory, conservative performance
2. **Android Mid-Range** - Samsung Galaxy A series, Pixel 6a
3. **iPad (landscape mode)** - Different aspect ratio
4. **High-end devices** - iPhone 15 Pro, flagship Android

#### B. Metrics to Collect

##### Quantitative:
- **Time-to-First-Play:** From page load to first video playing
- **Time-to-Next-Play:** From scroll completion to next video playing
- **Memory Growth:** Initial memory → Memory after 50 clips
- **Scroll Jank:** Visual stuttering during scroll (yes/no)
- **Battery Impact:** Battery % after 10 minutes of use

##### Qualitative:
- Does it feel "instant" like TikTok?
- Do videos buffer during scroll?
- Is the scroll snap smooth or jarring?
- Does rubber-banding occur on iOS?
- Any visual glitches (black flashes, poster issues)?

#### C. Testing Checklist

```
iPhone SE Testing:
[ ] Load /clips page
[ ] First video plays within 1 second
[ ] Scroll to 10 clips - all play instantly
[ ] Back-scroll works smoothly
[ ] No rubber-banding when pulling down
[ ] No memory warnings after 50 clips
[ ] Mute toggle works
[ ] Share button works

Android Mid-Range Testing:
[ ] Same checklist as iPhone
[ ] Test with Chrome mobile
[ ] Test with Samsung Internet (if applicable)

Tablet Testing:
[ ] Landscape mode displays correctly
[ ] Safe area insets respected
[ ] Video aspect ratio correct
```

---

### Phase 3: A/B Comparison Testing

#### Setup:
1. Create a feature flag to toggle new optimizations
2. Test with 5-10 users (internal team)
3. Collect feedback on "feel"

#### Comparison Metrics:
| Metric | Before (Old) | After (New) | Target Improvement |
|--------|--------------|-------------|-------------------|
| Memory (50 clips) | ~400MB | ~120MB | 70% reduction |
| Time-to-Play | 800ms | < 200ms | 75% reduction |
| Active Video Elements | 50+ | 3-5 | 90% reduction |
| Scroll FPS | 30-45 | 55-60 | 40% improvement |

---

### Phase 4: Automated Performance Testing

#### Using Lighthouse CI:
```bash
# Run performance audit
npm run lighthouse -- --url=http://localhost:3000/clips

# Key metrics to track:
# - First Contentful Paint (FCP): < 1.5s
# - Largest Contentful Paint (LCP): < 2.5s
# - Total Blocking Time (TBT): < 200ms
# - Cumulative Layout Shift (CLS): < 0.1
```

#### Custom Puppeteer Script:
```javascript
// scripts/test-clips-performance.js
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Enable performance monitoring
  await page.evaluateOnNewDocument(() => {
    window.performanceMetrics = [];
  });
  
  await page.goto('http://localhost:3000/clips');
  
  // Scroll simulation
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await page.waitForTimeout(2000);
  }
  
  // Collect metrics
  const metrics = await page.evaluate(() => {
    const perf = performance.memory;
    return {
      memory: Math.round(perf.usedJSHeapSize / 1024 / 1024),
      videoCount: document.querySelectorAll('video').length
    };
  });
  
  console.log('Performance Metrics:', metrics);
  await browser.close();
})();
```

---

## Fine-Tuning Thresholds

Based on test results, these values can be adjusted:

### In `ClipsFeed.tsx`:
```typescript
// Window size (currently ±2)
const isNearActive = Math.abs(activeIndex - index) <= 2;
// Try: ±1 (more aggressive) or ±3 (more conservative)

// Preload position (currently +1)
const shouldPreload = index === activeIndex + 1;
// Try: +2 for desktop, +1 for mobile (detect via UA)
```

### In `ClipCard.tsx`:
```typescript
// Lazy destruction delay (currently 2000ms)
destroyTimer = setTimeout(() => { ... }, 2000);
// Try: 1000ms (faster cleanup) or 3000ms (better back-scroll)
```

### In `hlsPlayer.ts`:
```typescript
// Buffer sizes
maxBufferLength: preloadOnly ? 3 : (isSlow ? 4 : 8)
// Try: Different values based on device memory
// Low memory: 2/3/6
// High memory: 4/6/10
```

---

## Known Issues & Workarounds

### Issue: Double HLS Connections in React 19 Strict Mode
**Symptom:** Two HLS instances attach briefly during development
**Solution:** Cleanup logic in `useEffect` prevents memory leak
**Impact:** Development only, production is unaffected

### Issue: iOS Safari Autoplay Policy
**Symptom:** First video may not autoplay on page load
**Solution:** Videos default to muted, user interaction triggers play
**Impact:** Expected behavior, matches TikTok

### Issue: Android Chrome Scroll Snap
**Symptom:** Scroll snap can feel "sticky" on some Android devices
**Solution:** May need to adjust `scroll-snap-type` or `scroll-snap-stop`
**Impact:** Device-specific, test on multiple devices

---

## Success Criteria

The implementation is considered successful if:

✅ **Memory:** < 200MB after scrolling 50 clips on iPhone SE  
✅ **Time-to-Play:** < 300ms average across all network conditions  
✅ **FPS:** Maintains 55+ FPS during scroll on mid-range devices  
✅ **UX:** No visible buffering during normal scroll (1-3 clips/sec)  
✅ **Mobile:** No rubber-banding on iOS, smooth scroll snap on Android  
✅ **Feel:** Internal team consensus: "Feels as smooth as TikTok"

---

## Rollout Strategy

1. **Alpha:** Deploy to staging, internal team testing (1-2 days)
2. **Beta:** Enable for 10% of users with feature flag (3-5 days)
3. **Monitoring:** Watch Sentry for errors, analytics for engagement drops
4. **Full Release:** Roll out to 100% if metrics are positive
5. **Iteration:** Collect feedback, fine-tune thresholds based on real data

---

## Monitoring in Production

### Sentry Custom Events:
```javascript
// Track time-to-play
Sentry.addBreadcrumb({
  category: 'clips',
  message: 'Video played',
  data: { timeToPlay: duration }
});

// Track memory warnings (if browser supports)
performance.memory && Sentry.captureMessage('High memory usage', {
  level: 'warning',
  extra: { memoryMB: performance.memory.usedJSHeapSize / 1024 / 1024 }
});
```

### Analytics Events:
- `clips_scroll_performance` - Track scroll speed and jank
- `clips_buffer_health` - Track buffering issues
- `clips_playback_error` - Track HLS errors

---

## Questions for Iteration

After initial testing:

1. **Should we preload ±2 clips on desktop/WiFi?**
   - Benefit: Even faster scroll
   - Cost: More bandwidth usage

2. **Should we implement video element pooling?**
   - Benefit: 50-100ms faster initialization
   - Cost: Significant complexity increase

3. **Should we add Service Worker caching for manifests?**
   - Benefit: Instant startup on repeat visits
   - Cost: Cache invalidation complexity

4. **Should buffer size adapt to device memory?**
   - Benefit: Better performance on low-end devices
   - Cost: Need to detect memory reliably

---

## References

- [TikTok Web Performance Analysis](https://web.dev/tiktok)
- [HLS.js Configuration Guide](https://github.com/video-dev/hls.js/blob/master/docs/API.md#fine-tuning)
- [Intersection Observer Best Practices](https://web.dev/intersectionobserver/)
- [Mobile Video Performance](https://developers.google.com/web/fundamentals/media/mobile-web-video-playback)
