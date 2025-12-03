import { useEffect, useState, RefObject } from 'react';

interface UseActiveClipOptions {
  rootRef: RefObject<HTMLElement | null>;
  navHeight: number;
  selector?: string;
}

export function useActiveClip({ rootRef, navHeight, selector = '[data-clip-id]' }: UseActiveClipOptions) {
  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const items = Array.from(root.querySelectorAll(selector)) as HTMLElement[];
    
    const obs = new IntersectionObserver((entries) => {
      // Pick entry with highest intersectionRatio
      const visible = entries.filter(e => e.isIntersecting);
      if (visible.length === 0) return;
      
      visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      const topEntry = visible[0];
      
      if (topEntry) {
        const idAttr = (topEntry.target as HTMLElement).dataset.clipId;
        const id = idAttr ? parseInt(idAttr, 10) : NaN;
        if (Number.isFinite(id)) {
          setActiveId(id);
        }
      }
    }, { 
      root, 
      threshold: [0.5, 0.7, 0.85], 
      rootMargin: `-${navHeight}px 0px 0px 0px` 
    });

    items.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [rootRef, navHeight, selector, /* Re-run when DOM likely changed */ rootRef.current?.childElementCount]);

  return activeId;
}
