
"use client";

import { AlbumFormData } from '@/types/music';
import WizardStep from './WizardStep';

interface ReviewStepProps {
  formData: AlbumFormData;
  trackUploads: any[];
  coverArtPreview: string | null;
}

export default function ReviewStep({ formData, trackUploads, coverArtPreview }: ReviewStepProps) {
  return (
    <WizardStep title="Review & Publish" description="Review all details before publishing your album.">
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-[#171616]/50 rounded-xl p-4">
          <h5 className="text-[#ede8df] font-medium mb-3 text-sm sm:text-base">Album Information</h5>
          <div className="flex flex-col lg:flex-row gap-4">
            {coverArtPreview && (
              <div className="flex-shrink-0">
                <img 
                  src={coverArtPreview} 
                  alt="Album cover"
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg object-cover"
                />
              </div>
            )}
            <div className="space-y-2 text-xs sm:text-sm flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center">
                <span className="text-[#b2a491] sm:w-24 flex-shrink-0">Title:</span> 
                <span className="text-[#ede8df] break-words">{formData.title}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center">
                <span className="text-[#b2a491] sm:w-24 flex-shrink-0">Artist:</span> 
                <span className="text-[#ede8df] break-words">{formData.artist_name}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center">
                <span className="text-[#b2a491] sm:w-24 flex-shrink-0">Type:</span> 
                <span className="text-[#ede8df]">{formData.release_type}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center">
                <span className="text-[#b2a491] sm:w-24 flex-shrink-0">Genre:</span> 
                <span className="text-[#ede8df]">{formData.genre || 'Not specified'}</span>
              </div>
              {formData.release_date && (
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <span className="text-[#b2a491] sm:w-24 flex-shrink-0">Release Date:</span> 
                  <span className="text-[#ede8df]">{formData.release_date}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-[#171616]/50 rounded-xl p-4">
          <h5 className="text-[#ede8df] font-medium mb-3 text-sm sm:text-base">Track List ({trackUploads.length} tracks)</h5>
          <div className="space-y-2 max-h-48 overflow-y-auto scrollable-container">
            {trackUploads.map((track, index) => (
              <div key={index} className="flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <span className="text-[#843c2d] font-bold w-6 flex-shrink-0">#{track.track_number}</span>
                  <span className="text-[#ede8df] truncate">{track.title}</span>
                  {track.explicit_content && <span className="text-red-400 text-xs flex-shrink-0">E</span>}
                </div>
                <span className="text-[#726d6c] text-xs flex-shrink-0 ml-2">
                  {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-[#171616]/50 rounded-xl">
        <div className="flex items-center space-x-3">
          <span className="text-xl sm:text-2xl">🚀</span>
          <div className="flex-1 min-w-0">
            <h6 className="text-[#ede8df] font-medium text-sm sm:text-base">Ready to Publish</h6>
            <p className="text-[#b2a491] text-xs sm:text-sm">Your album is ready to be uploaded to the platform.</p>
          </div>
        </div>
      </div>
    </WizardStep>
  );
}
