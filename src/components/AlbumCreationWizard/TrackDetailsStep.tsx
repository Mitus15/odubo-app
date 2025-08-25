
"use client";

import { useState } from 'react';
import WizardStep from './WizardStep';

interface TrackDetailsStepProps {
  trackUploads: any[]; // Changed from TrackUpload to any[] as TrackUpload type was removed
  updateTrackUpload: (index: number, field: keyof any, value: any) => void; // Changed from TrackUpload to any
}

export default function TrackDetailsStep({ trackUploads, updateTrackUpload }: TrackDetailsStepProps) {
  const [editingTrack, setEditingTrack] = useState<number | null>(null);

  return (
    <WizardStep title="Track Details & Order" description="Set track titles and arrange the order. Click on a track to edit details.">
      <div className="space-y-3 max-h-96 overflow-y-auto scrollable-container">
        {trackUploads.map((track, index) => (
          <div key={index} className="bg-[#171616]/50 border border-[#502d26]/40 rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
                <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                  <span className="text-[#843c2d] font-bold text-xs sm:text-sm w-6 sm:w-8">#{track.track_number}</span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={track.title}
                    onChange={(e) => updateTrackUpload(index, 'title', e.target.value)}
                    className="w-full bg-transparent text-[#ede8df] font-medium focus:outline-none border-b border-transparent focus:border-[#843c2d] pb-1 text-sm sm:text-base truncate"
                    placeholder="Track title"
                  />
                  <div className="text-[#726d6c] text-xs mt-1 truncate">{track.file.name}</div>
                </div>
              </div>
              
              <button
                onClick={() => setEditingTrack(editingTrack === index ? null : index)}
                className="px-2 sm:px-3 py-1 bg-[#843c2d]/20 text-[#843c2d] rounded-lg hover:bg-[#843c2d]/30 text-xs sm:text-sm transition-colors flex-shrink-0 ml-2"
              >
                {editingTrack === index ? 'Close' : 'Edit'}
              </button>
            </div>

            {editingTrack === index && (
              <div className="mt-4 pt-4 border-t border-[#502d26]/40">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#b2a491] text-xs font-medium mb-1">Duration (seconds)</label>
                    <input
                      type="number"
                      value={track.duration}
                      onChange={(e) => updateTrackUpload(index, 'duration', parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-[#302927]/60 border border-[#502d26]/40 rounded-lg text-[#ede8df] text-sm focus:outline-none focus:ring-2 focus:ring-[#843c2d]"
                      min="1"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={track.explicit_content}
                        onChange={(e) => updateTrackUpload(index, 'explicit_content', e.target.checked)}
                        className="mr-2 w-3 h-3 text-[#843c2d] bg-[#302927] border-[#502d26] rounded focus:ring-[#843c2d]"
                      />
                      <span className="text-[#ede8df] text-sm">Explicit Content</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </WizardStep>
  );
}
