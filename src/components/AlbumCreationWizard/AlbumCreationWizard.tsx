
"use client";

import { useState } from 'react';
import { AlbumFormData } from '@/types/music';
import UploadTracksStep from './UploadTracksStep';
import AlbumInfoStep from './AlbumInfoStep';
import TrackDetailsStep from './TrackDetailsStep';
import MetadataStep from './MetadataStep';
import ReviewStep from './ReviewStep';

const steps = [
  { id: 1, title: 'Upload Tracks', description: 'Add your audio files' },
  { id: 2, title: 'Album Info', description: 'Basic album details' },
  { id: 3, title: 'Track Details', description: 'Song titles & order' },
  { id: 4, title: 'Metadata', description: 'Credits & settings' },
  { id: 5, title: 'Review', description: 'Final review & publish' },
];

export default function AlbumCreationWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [trackUploads, setTrackUploads] = useState<any[]>([]); // Changed from TrackUpload[]
  const [coverArtFile, setCoverArtFile] = useState<File | null>(null);
  const [coverArtPreview, setCoverArtPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState<AlbumFormData>({
    title: '',
    artist_name: '',
    release_type: 'album',
    release_date: '',
    record_label: '',
    genre: '',
    subgenre: '',
    explicit_content: false,
    featured: false,
    description: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const updateTrackUpload = (index: number, field: keyof any, value: any) => { // Changed from TrackUpload
    const updated = [...trackUploads];
    updated[index] = { ...updated[index], [field]: value };
    setTrackUploads(updated);
  };

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return trackUploads.length > 0;
      case 2: return formData.title && formData.artist_name;
      case 3: return trackUploads.every(track => track.title.trim());
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    setUploadProgress('Creating album...');
    try {
      const albumPayload = {
        ...formData,
        total_tracks: trackUploads.length,
        total_duration: trackUploads.reduce((sum, track) => sum + track.duration, 0),
      };

      const albumResponse = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(albumPayload),
      });

      if (!albumResponse.ok) throw new Error('Failed to create album');

      const albumResult = await albumResponse.json() as any;
      const createdAlbumId = albumResult.id;

      if (coverArtFile) {
        setUploadProgress('Uploading cover art...');
        const coverArtFormData = new FormData();
        coverArtFormData.append('file', coverArtFile);
        coverArtFormData.append('fileType', 'album-cover');
        coverArtFormData.append('albumId', createdAlbumId);
        const coverUploadRes = await fetch('/api/upload', { method: 'POST', body: coverArtFormData });
        const coverUploadJson = await coverUploadRes.json() as { success: boolean; url?: string; key?: string };
        if (coverUploadJson.success && coverUploadJson.url && coverUploadJson.key) {
          await fetch(`/api/albums/${createdAlbumId}/update-cover`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cover_art_url: coverUploadJson.url, cover_art_key: coverUploadJson.key })
          });
        }
      }

      for (let i = 0; i < trackUploads.length; i++) {
        const track = trackUploads[i];
        setUploadProgress(`Uploading track ${i + 1} of ${trackUploads.length}: ${track.title}`);
        const trackFormData = new FormData();
        trackFormData.append('file', track.file);
        trackFormData.append('fileType', 'track');
        trackFormData.append('albumId', createdAlbumId);
        const audioUploadResponse = await fetch('/api/upload', { method: 'POST', body: trackFormData });
        const audioUploadResult = await audioUploadResponse.json() as { success: boolean; url?: string };

        const trackPayload = {
          ...track,
          album_id: createdAlbumId,
          audio_url: audioUploadResult.url,
        };

        await fetch('/api/tracks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(trackPayload),
        });
      }

      alert('Album created successfully!');
      // Reset state or redirect here
    } catch (error) {
      console.error('Album creation error:', error);
      alert('Failed to create album. Please try again.');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="w-full bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927]">
      <div className="sticky top-0 z-10 bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] backdrop-blur-sm border-b border-[#502d26]/40">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide pb-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl whitespace-nowrap transition-all flex-shrink-0 ${
                  currentStep === step.id
                    ? 'bg-[#843c2d] text-[#ede8df] cursor-default'
                    : currentStep > step.id
                    ? 'bg-[#302927]/60 text-[#ede8df] border border-[#502d26]/40 cursor-pointer hover:bg-[#502d26]/60'
                    : 'bg-[#302927]/30 text-[#726d6c] border border-[#502d26]/20 cursor-not-allowed'
                }`}
                onClick={() => currentStep > step.id && setCurrentStep(step.id)}
              >
                <span className="text-xs sm:text-sm">{step.id}</span>
                <span className="text-xs font-medium hidden sm:inline">{step.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {currentStep === 1 && <UploadTracksStep trackUploads={trackUploads} setTrackUploads={setTrackUploads} artistName={formData.artist_name} />}
        {currentStep === 2 && <AlbumInfoStep formData={formData} handleInputChange={handleInputChange} coverArtFile={coverArtFile} setCoverArtFile={setCoverArtFile} coverArtPreview={coverArtPreview} setCoverArtPreview={setCoverArtPreview} />}
        {currentStep === 3 && <TrackDetailsStep trackUploads={trackUploads} updateTrackUpload={updateTrackUpload} />}
        {currentStep === 4 && <MetadataStep trackUploads={trackUploads} updateTrackUpload={updateTrackUpload} />}
        {currentStep === 5 && <ReviewStep formData={formData} trackUploads={trackUploads} coverArtPreview={coverArtPreview} />}
      </div>

      <div className="flex-shrink-0 sticky bottom-0 z-20 px-4 sm:px-6 py-4 sm:py-6 border-t border-[#502d26]/40 bg-[#1a1513]/80 backdrop-blur-sm">
        <div className="flex justify-between items-center gap-4">
          <button onClick={prevStep} disabled={currentStep === 1} className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium transition-all duration-200 text-sm sm:text-base bg-[#302927]/50 border border-[#502d26]/40 text-[#b2a491] hover:bg-[#502d26]/60 hover:text-[#ede8df] disabled:cursor-not-allowed disabled:opacity-50">
            Previous
          </button>
          {currentStep < steps.length ? (
            <button onClick={nextStep} disabled={!canProceed()} className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium transition-all duration-200 text-sm sm:text-base bg-[#843c2d] hover:bg-[#843c2d]/80 text-[#ede8df] disabled:cursor-not-allowed disabled:opacity-50">
              Next
            </button>
          ) : (
            <button onClick={handleFinalSubmit} disabled={loading} className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium transition-all duration-200 text-sm sm:text-base bg-gradient-to-r from-[#843c2d] to-[#a0472f] text-[#ede8df] disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? 'Publishing...' : 'Publish Album'}
            </button>
          )}
        </div>
        {loading && uploadProgress && <p className="text-center mt-2 text-sm text-[#b2a491]">{uploadProgress}</p>}
      </div>
    </div>
  );
}
