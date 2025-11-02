'use client';

import React, { createContext, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface Toast {
  id: string;
  title?: string;
  message: string;
  tone?: 'error' | 'info' | 'success';
}

const ToastCtx = createContext<{ pushToast: (t: Omit<Toast, 'id'>) => void } | null>(null);

export function useToasts() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToasts must be used within <Toasts />');
  return ctx;
}

export default function Toasts() {
  const [items, setItems] = useState<Toast[]>([]);

  const pushToast = (t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = { id, ...t };
    setItems(prev => [...prev, toast]);
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), 3500);
  };

  return (
    <ToastCtx.Provider value={{ pushToast }}>
      <div className="fixed bottom-20 right-4 z-[100] space-y-2">
        <AnimatePresence>
          {items.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={`px-3 py-2 rounded-lg shadow-lg border text-sm ${
                t.tone === 'error' ? 'bg-[#3a1c1c] border-red-600/30 text-red-200' : t.tone === 'success' ? 'bg-[#193a2a] border-emerald-600/30 text-emerald-200' : 'bg-[#1f1c1a] border-[#502d26]/30 text-[#ede8df]'
              }`}
            >
              {t.title && <div className="font-medium mb-0.5">{t.title}</div>}
              <div>{t.message}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {/* Invisible child to expose context to tree */}
      <div style={{ display: 'none' }} />
    </ToastCtx.Provider>
  );
}
