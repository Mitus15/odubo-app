
"use client";

import { useRef } from 'react';
import WizardStep from './WizardStep';

interface UploadTracksStepProps {
  trackUploads: any[];
  setTrackUploads: (uploads: any[]) => void;
  artistName: string;
}

export default function UploadTracksStep({ trackUploads, setTrackUploads, artistName }: UploadTracksStepProps) {
  const trackFilesRef = useRef<HTMLInputElement>(null);

  const handleTrackFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newTrackUploads: any[] = files.map((file, index) => ({
      file,
      title: file.name.replace(/\.[^/.]+$/, ""),
      track_number: trackUploads.length + index + 1,
      duration: 180, // Placeholder, will be updated later
      explicit_content: false,
      main_artist: artistName || '',
      featured_artists: '',
      credits: ''
    }));
    setTrackUploads([...trackUploads, ...newTrackUploads]);
  };

  const updateTrackTitle = (index: number, title: string) => {
    const updated = [...trackUploads];
    updated[index].title = title;
    setTrackUploads(updated);
  };

  const handleTrackTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextIndex = index + 1;
      if (nextIndex < trackUploads.length) {
        const nextInput = document.querySelector(`input[data-track-index="${nextIndex}"]`) as HTMLInputElement;
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
    }
  };

  const removeTrackUpload = (index: number) => {
    setTrackUploads(trackUploads.filter((_, i) => i !== index));
  };

  const moveTrack: (fromIndex: number, toIndex: number) => void = (fromIndex: number, toIndex: number) => {
    const updated = [...trackUploads];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    updated.forEach((track, index) => {
      track.track_number = index + 1;
    });
    setTrackUploads(updated);
  };

  return (
    <WizardStep title="Upload Your Tracks" description="Add your audio files. You can reorder them and edit titles here.">
      {trackUploads.length === 0 ? (
        <div className="mb-4">
          <div className="border-2 border-dashed border-[#502d26]/40 rounded-xl p-4 sm:p-6 text-center hover:border-[#843c2d]/60 transition-colors">
            <input
              type="file"
              ref={trackFilesRef}
              multiple
              accept="audio/*"
              onChange={handleTrackFilesChange}
              className="hidden"
              id="track-files-upload"
            />
            <label htmlFor="track-files-upload" className="cursor-pointer">
              <span className="text-2xl sm:text-3xl block mb-2">🎶</span>
              <span className="text-[#ede8df] block text-sm sm:text-base font-medium">Drop audio files here</span>
              <span className="text-[#726d6c] text-xs mt-1 block">or click to browse</span>
            </label>
          </div>
        </div>
      ) : (
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[#b2a491] text-xs sm:text-sm">Add more tracks</span>
          <div>
            <input
              type="file"
              ref={trackFilesRef}
              multiple
              accept="audio/*"
              onChange={handleTrackFilesChange}
              className="hidden"
              id="track-files-upload"
            />
            <label
              htmlFor="track-files-upload"
              className="cursor-pointer px-3 py-2 rounded-md text-xs sm:text-sm bg-[#302927] border border-[#502d26]/40 text-[#ede8df] hover:bg-[#502d26]/60"
            >
              + Add Files
            </label>
          </div>
        </div>
      )}

      {trackUploads.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-[#ede8df] font-medium text-sm sm:text-base">Uploaded Tracks</h5>
            <span className="text-[#b2a491] text-xs sm:text-sm">{trackUploads.length} track{trackUploads.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2 max-h-[50vh] md:max-h-[55vh] lg:max-h-[60vh] overflow-y-auto pr-2 pb-56 scroll-pb-56">
            {trackUploads.map((track, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-[#171616]/50 rounded-xl">
                <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                  <div className="flex flex-col items-center space-y-1 flex-shrink-0">
                    <span className="text-[#843c2d] font-bold text-xs sm:text-sm">#{track.track_number}</span>
                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={() => moveTrack(index, Math.max(0, index - 1))}
                        disabled={index === 0}
                        className={`text-xs ${index === 0 ? 'text-[#726d6c]/50 cursor-not-allowed' : 'text-[#726d6c] hover:text-[#ede8df]'}`}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveTrack(index, Math.min(trackUploads.length - 1, index + 1))}
                        disabled={index === trackUploads.length - 1}
                        className={`text-xs ${index === trackUploads.length - 1 ? 'text-[#726d6c]/50 cursor-not-allowed' : 'text-[#726d6c] hover:text-[#ede8df]'}`}
                        title="Move down"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="relative group">
                      <input
                        type="text"
                        value={track.title}
                        onChange={(e) => updateTrackTitle(index, e.target.value)}
                        onKeyDown={(e) => handleTrackTitleKeyDown(e, index)}
                        data-track-index={index}
                        className="w-full bg-transparent text-[#ede8df] text-xs sm:text-sm font-medium focus:outline-none border-b border-transparent focus:border-[#843c2d] pb-1 hover:border-[#843c2d]/40 transition-colors pr-6"
                        placeholder="Enter track title"
                      />
                      <span className="absolute right-0 top-0 text-[#726d6c] group-hover:text-[#843c2d] transition-colors text-xs opacity-60 group-hover:opacity-100">
                        ✏️
                      </span>
                    </div>
                    <div className="text-[#726d6c] text-xs truncate">{track.file.name}</div>
                  </div>
                </div>
                <button
                  onClick={() => removeTrackUpload(index)}
                  className="text-red-400 hover:text-red-300 text-xs sm:text-sm flex-shrink-0 ml-2"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </WizardStep>
  );
}
