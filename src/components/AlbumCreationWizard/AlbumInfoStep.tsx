
"use client";

import { AlbumFormData } from '@/types/music';
import WizardStep from './WizardStep';

interface AlbumInfoStepProps {
  formData: AlbumFormData;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  coverArtFile: File | null;
  setCoverArtFile: (file: File | null) => void;
  coverArtPreview: string | null;
  setCoverArtPreview: (preview: string | null) => void;
}

export default function AlbumInfoStep({ 
  formData, 
  handleInputChange, 
  coverArtFile, 
  setCoverArtFile,
  coverArtPreview,
  setCoverArtPreview
}: AlbumInfoStepProps) {

  const handleCoverArtChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverArtFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setCoverArtPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <WizardStep title="Album Information" description="Provide the basic details for your album.">
      <div className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-[#b2a491] text-xs sm:text-sm font-medium mb-2">Album Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#302927]/60 border border-[#502d26]/40 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-[#843c2d] focus:border-transparent text-[#ede8df] placeholder-[#726d6c] text-sm sm:text-base"
              placeholder="Enter album title"
              required
            />
          </div>
          
          <div>
            <label className="block text-[#b2a491] text-xs sm:text-sm font-medium mb-2">Main Artist *</label>
            <input
              type="text"
              name="artist_name"
              value={formData.artist_name}
              onChange={handleInputChange}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#302927]/60 border border-[#502d26]/40 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-[#843c2d] focus:border-transparent text-[#ede8df] placeholder-[#726d6c] text-sm sm:text-base"
              placeholder="Enter main artist name"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-[#b2a491] text-xs sm:text-sm font-medium mb-2">Release Type *</label>
            <select
              name="release_type"
              value={formData.release_type}
              onChange={handleInputChange}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#302927]/60 border border-[#502d26]/40 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-[#843c2d] focus:border-transparent text-[#ede8df] text-sm sm:text-base"
              required
            >
              <option value="album">Album</option>
              <option value="ep">EP</option>
              <option value="single">Single</option>
              <option value="compilation">Compilation</option>
              <option value="mixtape">Mixtape</option>
            </select>
          </div>
          
          <div>
            <label className="block text-[#b2a491] text-xs sm:text-sm font-medium mb-2">Release Date</label>
            <input
              type="date"
              name="release_date"
              value={formData.release_date}
              onChange={handleInputChange}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#302927]/60 border border-[#502d26]/40 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-[#843c2d] focus:border-transparent text-[#ede8df] text-sm sm:text-base"
            />
          </div>

          <div>
            <label className="block text-[#b2a491] text-xs sm:text-sm font-medium mb-2">Record Label</label>
            <input
              type="text"
              name="record_label"
              value={formData.record_label}
              onChange={handleInputChange}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#302927]/60 border border-[#502d26]/40 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-[#843c2d] focus:border-transparent text-[#ede8df] placeholder-[#726d6c] text-sm sm:text-base"
              placeholder="Enter record label"
            />
          </div>
        </div>

        <div>
          <label className="block text-[#b2a491] text-xs sm:text-sm font-medium mb-2">Cover Art</label>
          <div className="border-2 border-dashed border-[#502d26]/40 rounded-xl p-4 sm:p-6 text-center hover:border-[#843c2d]/60 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={handleCoverArtChange}
              className="hidden"
              id="cover-art-upload"
            />
            
            {coverArtPreview ? (
              <div className="relative">
                <img 
                  src={coverArtPreview} 
                  alt="Cover art preview" 
                  className="mx-auto max-w-32 max-h-32 rounded-lg object-cover"
                />
                <div className="mt-3">
                  <label htmlFor="cover-art-upload" className="cursor-pointer">
                    <span className="text-[#843c2d] text-sm hover:text-[#a0472f] transition-colors">
                      Change cover art
                    </span>
                  </label>
                  <div className="text-[#726d6c] text-xs mt-1">
                    {coverArtFile?.name}
                  </div>
                </div>
              </div>
            ) : (
              <label htmlFor="cover-art-upload" className="cursor-pointer">
                <span className="text-2xl sm:text-3xl block mb-2">🎨</span>
                <span className="text-[#ede8df] text-sm block">Click to upload cover art</span>
                <span className="block text-[#726d6c] text-xs mt-1">JPG, PNG • 1400x1400 recommended</span>
              </label>
            )}
          </div>
        </div>
      </div>
    </WizardStep>
  );
}
