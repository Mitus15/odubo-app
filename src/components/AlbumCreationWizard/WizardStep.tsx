
"use client";

import { motion } from 'framer-motion';

interface WizardStepProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function WizardStep({ title, description, children }: WizardStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="h-full overflow-y-auto scrollable-container px-4 sm:px-6 py-4 sm:py-6"
    >
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#302927]/60 border border-[#502d26]/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
          <h4 className="text-base sm:text-lg font-bold text-[#ede8df] mb-2">{title}</h4>
          <p className="text-[#b2a491] text-xs sm:text-sm mb-4 sm:mb-6">{description}</p>
          {children}
        </div>
      </div>
    </motion.div>
  );
}
