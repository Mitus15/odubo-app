'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

interface VerseInterludeProps {
  text: string;
  reference: string;
}

export default function VerseInterlude({ text, reference }: VerseInterludeProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-20%' });
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    if (isInView && !hasShown) {
      setHasShown(true);
    }
  }, [isInView, hasShown]);

  return (
    <section
      ref={ref}
      className="relative py-32 px-8 bg-[#0d0c0a] overflow-hidden"
    >
      {/* Accent Line */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={hasShown ? { scaleX: 1 } : {}}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-px bg-[#843c2d] origin-center"
      />

      {/* Verse Content */}
      <div className="max-w-4xl mx-auto text-center">
        <motion.blockquote
          initial={{ opacity: 0, y: 30 }}
          animate={hasShown ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-2xl xl:text-3xl text-[#ede8df]/90 font-light leading-relaxed mb-8"
        >
          "{text}"
        </motion.blockquote>

        <motion.p
          initial={{ opacity: 0 }}
          animate={hasShown ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-[#843c2d] text-sm font-medium uppercase tracking-[0.2em]"
        >
          {reference}
        </motion.p>
      </div>

      {/* Subtle Background Glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#843c2d]/5 rounded-full blur-[120px]" />
      </div>
    </section>
  );
}
