'use client';

import { useState } from 'react';
import AlbumCreationWizard from './AlbumCreationWizard/AlbumCreationWizard';

export default function AlbumCreationForm() {
  const [showWizard, setShowWizard] = useState(false);

  if (showWizard) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-[#502d26]/40">
          <div className="flex items-center justify-between p-4 border-b border-[#502d26]/40">
            <h2 className="text-xl font-bold text-[#ede8df]">Create New Album</h2>
            <button
              onClick={() => setShowWizard(false)}
              className="p-2 text-[#726d6c] hover:text-[#ede8df] transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="h-full">
            <AlbumCreationWizard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowWizard(true)}
      className="px-4 py-2 bg-[#843c2d] hover:bg-[#843c2d]/80 text-[#ede8df] rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
    >
      <span className="text-lg">+</span>
      Create Album
    </button>
  );
}
