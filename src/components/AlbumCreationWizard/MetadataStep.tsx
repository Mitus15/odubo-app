
"use client";

import WizardStep from './WizardStep';

interface MetadataStepProps {
  trackUploads: any[];
  updateTrackUpload: (index: number, field: keyof any, value: any) => void;
}

export default function MetadataStep({ trackUploads, updateTrackUpload }: MetadataStepProps) {
  return (
    <WizardStep title="Credits & Metadata" description="Add artist credits and additional information for each track.">
      <div className="space-y-4 sm:space-y-6 max-h-96 overflow-y-auto scrollable-container">
        {trackUploads.map((track, index) => (
          <div key={index} className="bg-[#171616]/50 border border-[#502d26]/40 rounded-xl p-3 sm:p-4">
            <h5 className="text-[#ede8df] font-medium mb-3 text-sm sm:text-base truncate">#{track.track_number} {track.title}</h5>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-[#b2a491] text-xs font-medium mb-1">Main Artist</label>
                <input
                  type="text"
                  value={track.main_artist}
                  onChange={(e) => updateTrackUpload(index, 'main_artist', e.target.value)}
                  className="w-full px-3 py-2 bg-[#302927]/60 border border-[#502d26]/40 rounded-lg text-[#ede8df] text-sm focus:outline-none focus:ring-2 focus:ring-[#843c2d]"
                  placeholder="Main performing artist"
                />
              </div>
              
              <div>
                <label className="block text-[#b2a491] text-xs font-medium mb-1">Featured Artists</label>
                <input
                  type="text"
                  value={track.featured_artists}
                  onChange={(e) => updateTrackUpload(index, 'featured_artists', e.target.value)}
                  className="w-full px-3 py-2 bg-[#302927]/60 border border-[#502d26]/40 rounded-lg text-[#ede8df] text-sm focus:outline-none focus:ring-2 focus:ring-[#843c2d]"
                  placeholder="feat. Artist Name"
                />
              </div>
              
              <div>
                <label className="block text-[#b2a491] text-xs font-medium mb-1">Credits</label>
                <input
                  type="text"
                  value={track.credits}
                  onChange={(e) => updateTrackUpload(index, 'credits', e.target.value)}
                  className="w-full px-3 py-2 bg-[#302927]/60 border border-[#502d26]/40 rounded-lg text-[#ede8df] text-sm focus:outline-none focus:ring-2 focus:ring-[#843c2d]"
                  placeholder="Producer, Writer, Engineer credits..."
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </WizardStep>
  );
}
