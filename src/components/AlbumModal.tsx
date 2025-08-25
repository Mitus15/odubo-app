'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Album, Track, TrackCredit } from '@/types/music';

interface AlbumModalProps {
  album: Album;
  tracks: Track[];
  onClose: () => void;
}

interface TrackUpload {
  file: File;
  title: string;
  track_number: number;
  duration: number;
  explicit_content: boolean;
  credits: TrackCredit[];
}

interface CreditForm {
  role: string;
  name: string;
  is_featured: boolean;
}

export default function AlbumModal({ album, tracks, onClose }: AlbumModalProps) {
  const [trackUploads, setTrackUploads] = useState<TrackUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [reorderedTracks, setReorderedTracks] = useState<Track[]>(tracks);
  const [draggedTrack, setDraggedTrack] = useState<Track | null>(null);
  const [editingCredits, setEditingCredits] = useState<string | null>(null);
  const [editingTrackCredits, setEditingTrackCredits] = useState<{[trackId: string]: TrackCredit[]}>({});
  const [savingCredits, setSavingCredits] = useState<string | null>(null);
  const trackFilesRef = useRef<HTMLInputElement>(null);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleTrackFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newTrackUploads: TrackUpload[] = files.map((file, index) => ({
      file,
      title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
      track_number: tracks.length + trackUploads.length + index + 1,
      duration: 180, // Default 3 minutes, user can adjust
      explicit_content: false,
      credits: []
    }));
    setTrackUploads([...trackUploads, ...newTrackUploads]);
  };

  const updateTrackUpload = (index: number, field: keyof TrackUpload, value: any) => {
    const updated = [...trackUploads];
    updated[index] = { ...updated[index], [field]: value };
    setTrackUploads(updated);
  };

  const removeTrackUpload = (index: number) => {
    setTrackUploads(trackUploads.filter((_, i) => i !== index));
  };

  // Track reordering functions
  const handleDragStart = (e: React.DragEvent, track: Track) => {
    setDraggedTrack(track);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (!draggedTrack) return;

    const dragIndex = reorderedTracks.findIndex(t => t.id === draggedTrack.id);
    if (dragIndex === dropIndex) return;

    const newTracks = [...reorderedTracks];
    const [removed] = newTracks.splice(dragIndex, 1);
    newTracks.splice(dropIndex, 0, removed);

    // Update track numbers
    const updatedTracks = newTracks.map((track, index) => ({
      ...track,
      track_number: index + 1
    }));

    setReorderedTracks(updatedTracks);
    setDraggedTrack(null);
  };

  const saveTrackOrder = async () => {
    try {
      const updatePromises = reorderedTracks.map((track, index) => 
        fetch(`/api/tracks/${track.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ track_number: index + 1 })
        })
      );

      await Promise.all(updatePromises);
      alert('Track order updated successfully!');
      window.location.reload();
    } catch (error) {
      console.error('Error updating track order:', error);
      alert('Failed to update track order');
    }
  };

  // Credits management functions
  const addCreditToTrackUpload = (trackIndex: number) => {
    const updated = [...trackUploads];
    updated[trackIndex].credits.push({
      track_id: '', // Will be set when track is created
      role: '',
      name: '',
      is_featured: false
    });
    setTrackUploads(updated);
  };

  const updateTrackUploadCredit = (trackIndex: number, creditIndex: number, field: keyof TrackCredit, value: any) => {
    const updated = [...trackUploads];
    updated[trackIndex].credits[creditIndex] = {
      ...updated[trackIndex].credits[creditIndex],
      [field]: value
    };
    setTrackUploads(updated);
  };

  const removeTrackUploadCredit = (trackIndex: number, creditIndex: number) => {
    const updated = [...trackUploads];
    updated[trackIndex].credits.splice(creditIndex, 1);
    setTrackUploads(updated);
  };

  // Existing track credits management
  const startEditingTrackCredits = (trackId: string, credits: TrackCredit[]) => {
    setEditingTrackCredits(prev => ({
      ...prev,
      [trackId]: [...credits]
    }));
    setEditingCredits(trackId);
  };

  const addCreditToExistingTrack = (trackId: string) => {
    setEditingTrackCredits(prev => ({
      ...prev,
      [trackId]: [
        ...(prev[trackId] || []),
        {
          track_id: trackId,
          role: '',
          name: '',
          is_featured: false
        }
      ]
    }));
  };

  const updateExistingTrackCredit = (trackId: string, creditIndex: number, field: keyof TrackCredit, value: any) => {
    setEditingTrackCredits(prev => ({
      ...prev,
      [trackId]: prev[trackId].map((credit, index) => 
        index === creditIndex ? { ...credit, [field]: value } : credit
      )
    }));
  };

  const removeExistingTrackCredit = (trackId: string, creditIndex: number) => {
    setEditingTrackCredits(prev => ({
      ...prev,
      [trackId]: prev[trackId].filter((_, index) => index !== creditIndex)
    }));
  };

  const saveExistingTrackCredits = async (trackId: string) => {
    setSavingCredits(trackId);
    try {
      const credits = editingTrackCredits[trackId] || [];
      
      const response = await fetch(`/api/tracks/${trackId}/credits`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits })
      });

      const result = await response.json() as { success: boolean; error?: string };

      if (result.success) {
        // Update the local track data
        setReorderedTracks(prev => 
          prev.map(track => 
            track.id === trackId 
              ? { ...track, credits }
              : track
          )
        );
        setEditingCredits(null);
        setEditingTrackCredits(prev => {
          const updated = { ...prev };
          delete updated[trackId];
          return updated;
        });
        alert('Credits updated successfully!');
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error saving credits:', error);
      alert('Failed to save credits');
    } finally {
      setSavingCredits(null);
    }
  };

  const cancelEditingTrackCredits = (trackId: string) => {
    setEditingCredits(null);
    setEditingTrackCredits(prev => {
      const updated = { ...prev };
      delete updated[trackId];
      return updated;
    });
  };

  // Bulk credit management for uploads
  const copyCreditsToAllTracks = (sourceIndex: number) => {
    if (!trackUploads[sourceIndex] || trackUploads[sourceIndex].credits.length === 0) {
      alert('No credits to copy from this track');
      return;
    }

    const sourceCredits = trackUploads[sourceIndex].credits;
    const updated = trackUploads.map((track, index) => 
      index === sourceIndex ? track : {
        ...track,
        credits: [...sourceCredits]
      }
    );
    setTrackUploads(updated);
    alert(`Credits copied to ${trackUploads.length - 1} other tracks`);
  };

  const clearAllCreditsFromTrack = (trackIndex: number) => {
    if (confirm('Are you sure you want to remove all credits from this track?')) {
      const updated = [...trackUploads];
      updated[trackIndex].credits = [];
      setTrackUploads(updated);
    }
  };

  const uploadTracks = async () => {
    if (trackUploads.length === 0) return;

    setUploading(true);
    try {
      const results = [];
      for (const trackUpload of trackUploads) {
        try {
          const formData = new FormData();
          formData.append('title', trackUpload.title);
          formData.append('album_id', album.id);
          formData.append('track_number', trackUpload.track_number.toString());
          formData.append('disc_number', '1');
          formData.append('duration', trackUpload.duration.toString());
          formData.append('explicit_content', trackUpload.explicit_content.toString());
          formData.append('audio_file', trackUpload.file);
          
          // Add credits as JSON
          if (trackUpload.credits.length > 0) {
            formData.append('credits', JSON.stringify(trackUpload.credits));
          }

          console.log('Uploading track:', trackUpload.title);
          const response = await fetch('/api/tracks', {
            method: 'POST',
            body: formData
          });

          const result = await response.json() as { success: boolean; error?: string; trackId?: string };
          console.log('Track upload response:', result);

          if (!response.ok || !result.success) {
            throw new Error(result.error || `HTTP ${response.status}: Failed to upload track: ${trackUpload.title}`);
          }
          
          results.push({ track: trackUpload.title, success: true });
        } catch (trackError) {
          console.error('Error uploading track:', trackUpload.title, trackError);
          results.push({ track: trackUpload.title, success: false, error: trackError });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      if (successful > 0) {
        if (failed === 0) {
          alert(`All ${successful} tracks uploaded successfully!`);
        } else {
          alert(`${successful} tracks uploaded successfully, ${failed} failed. Check console for details.`);
        }
        window.location.reload();
      } else {
        alert('All track uploads failed. Please check the console for details.');
        results.filter(r => !r.success).forEach(r => {
          console.error(`Failed to upload ${r.track}:`, r.error);
        });
      }
    } catch (error) {
      console.error('Error uploading tracks:', error);
      alert('Failed to upload tracks. Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-2xl font-bold">{album.title}</h3>
            <p className="text-gray-400">{album.artist_name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Album Info */}
          <div>
            {album.cover_art_url && (
              <Image
                src={album.cover_art_url}
                alt={album.title}
                width={200}
                height={200}
                className="rounded-md object-cover mb-4"
              />
            )}
            
            <div className="space-y-2 text-sm">
              <div><strong>Type:</strong> {album.release_type}</div>
              <div><strong>Release Date:</strong> {album.release_date || 'Not set'}</div>
              <div><strong>Label:</strong> {album.record_label || 'Not set'}</div>
              <div><strong>Genre:</strong> {album.genre || 'Not set'}</div>
              <div><strong>Tracks:</strong> {tracks.length}</div>
            </div>
          </div>

          {/* Existing Tracks */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-bold">Current Tracks ({reorderedTracks.length})</h4>
              {reorderedTracks.length > 1 && (
                <button
                  onClick={saveTrackOrder}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Save Order
                </button>
              )}
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {reorderedTracks.map((track, index) => (
                <div 
                  key={track.id} 
                  className="bg-gray-800 p-3 rounded cursor-move hover:bg-gray-750 transition-colors"
                  draggable
                  onDragStart={(e) => handleDragStart(e, track)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400 text-sm">⋮⋮</span>
                        <p className="font-medium">{track.track_number}. {track.title}</p>
                      </div>
                      <p className="text-xs text-gray-400">{formatDuration(track.duration)}</p>
                      {track.credits && track.credits.length > 0 && (
                        <div className="mt-1">
                          <p className="text-xs text-gray-500">
                            Credits: {track.credits.map(c => `${c.name} (${c.role})`).join(', ')}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        track.audio_status === 'ready' ? 'bg-green-600' :
                        track.audio_status === 'error' ? 'bg-red-600' : 'bg-yellow-600'
                      }`}>
                        {track.audio_status}
                      </span>
                      <button
                        onClick={() => {
                          if (editingCredits === track.id) {
                            cancelEditingTrackCredits(track.id);
                          } else {
                            startEditingTrackCredits(track.id, track.credits || []);
                          }
                        }}
                        className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                      >
                        {editingCredits === track.id ? 'Cancel' : 'Edit Credits'}
                      </button>
                    </div>
                  </div>
                  
                  {editingCredits === track.id && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="flex justify-between items-center mb-2">
                        <h6 className="text-sm font-medium">Edit Track Credits</h6>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => addCreditToExistingTrack(track.id)}
                            className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                          >
                            Add Credit
                          </button>
                          <button
                            onClick={() => saveExistingTrackCredits(track.id)}
                            disabled={savingCredits === track.id}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {savingCredits === track.id ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                      
                      {editingTrackCredits[track.id]?.length > 0 ? (
                        <div className="space-y-2">
                          {editingTrackCredits[track.id].map((credit, creditIndex) => (
                            <div key={creditIndex} className="grid grid-cols-4 gap-2 items-end">
                              <div>
                                <label className="block text-xs font-medium mb-1">Name</label>
                                <input
                                  type="text"
                                  placeholder="Artist name"
                                  value={credit.name}
                                  onChange={(e) => updateExistingTrackCredit(track.id, creditIndex, 'name', e.target.value)}
                                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1">Role</label>
                                <select
                                  value={credit.role}
                                  onChange={(e) => updateExistingTrackCredit(track.id, creditIndex, 'role', e.target.value)}
                                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
                                >
                                  <option value="">Select role</option>
                                  <option value="Artist">Artist</option>
                                  <option value="Producer">Producer</option>
                                  <option value="Songwriter">Songwriter</option>
                                  <option value="Composer">Composer</option>
                                  <option value="Engineer">Engineer</option>
                                  <option value="Mixer">Mixer</option>
                                  <option value="Mastering Engineer">Mastering Engineer</option>
                                  <option value="Vocalist">Vocalist</option>
                                  <option value="Instrumentalist">Instrumentalist</option>
                                  <option value="Featured Artist">Featured Artist</option>
                                </select>
                              </div>
                              <div>
                                <label className="flex items-center text-xs">
                                  <input
                                    type="checkbox"
                                    checked={credit.is_featured}
                                    onChange={(e) => updateExistingTrackCredit(track.id, creditIndex, 'is_featured', e.target.checked)}
                                    className="mr-1"
                                  />
                                  Featured
                                </label>
                              </div>
                              <div>
                                <button
                                  onClick={() => removeExistingTrackCredit(track.id, creditIndex)}
                                  className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">No credits added yet</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {reorderedTracks.length === 0 && (
                <p className="text-gray-400 text-center py-4">No tracks yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Track Upload Section */}
        <div className="mt-8">
          <h4 className="text-lg font-bold mb-4">Add New Tracks</h4>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Select Audio Files</label>
            <input
              type="file"
              ref={trackFilesRef}
              multiple
              accept="audio/*"
              onChange={handleTrackFilesChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {trackUploads.length > 0 && (
            <div className="space-y-4">
              <h5 className="font-medium">Track Details</h5>
              {trackUploads.map((track, index) => (
                <div key={index} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                  <div className="flex justify-between items-center mb-3">
                    <h6 className="text-sm font-medium text-gray-300">
                      Track {track.track_number}: {track.title || 'Untitled'}
                    </h6>
                    <div className="flex items-center space-x-2">
                      {track.credits.length > 0 && (
                        <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">
                          {track.credits.length} credit{track.credits.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {track.explicit_content && (
                        <span className="text-xs bg-red-600 text-white px-2 py-1 rounded">
                          Explicit
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">Title</label>
                      <input
                        type="text"
                        value={track.title}
                        onChange={(e) => updateTrackUpload(index, 'title', e.target.value)}
                        className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Track #</label>
                      <input
                        type="number"
                        value={track.track_number}
                        onChange={(e) => updateTrackUpload(index, 'track_number', parseInt(e.target.value))}
                        className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Duration (seconds)</label>
                      <input
                        type="number"
                        value={track.duration}
                        onChange={(e) => updateTrackUpload(index, 'duration', parseInt(e.target.value))}
                        className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                        min="1"
                      />
                    </div>
                    <div className="flex items-end space-x-2">
                      <label className="flex items-center text-xs">
                        <input
                          type="checkbox"
                          checked={track.explicit_content}
                          onChange={(e) => updateTrackUpload(index, 'explicit_content', e.target.checked)}
                          className="mr-1"
                        />
                        Explicit
                      </label>
                      <button
                        onClick={() => removeTrackUpload(index)}
                        className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Credits Section */}
                  <div className="border-t border-gray-700 pt-3">
                    <div className="flex justify-between items-center mb-2">
                      <h6 className="text-sm font-medium">Credits</h6>
                      <div className="flex space-x-1">
                        {track.credits.length > 0 && trackUploads.length > 1 && (
                          <button
                            onClick={() => copyCreditsToAllTracks(index)}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                            title="Copy these credits to all other tracks"
                          >
                            Copy to All
                          </button>
                        )}
                        {track.credits.length > 0 && (
                          <button
                            onClick={() => clearAllCreditsFromTrack(index)}
                            className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                            title="Remove all credits from this track"
                          >
                            Clear All
                          </button>
                        )}
                        <button
                          onClick={() => addCreditToTrackUpload(index)}
                          className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                        >
                          Add Credit
                        </button>
                      </div>
                    </div>
                    
                    {track.credits.length > 0 ? (
                      <div className="space-y-2">
                        {track.credits.map((credit, creditIndex) => (
                          <div key={creditIndex} className="bg-gray-750 p-2 rounded border border-gray-600">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                              <div>
                                <label className="block text-xs font-medium mb-1">Name</label>
                                <input
                                  type="text"
                                  placeholder="Artist name"
                                  value={credit.name}
                                  onChange={(e) => updateTrackUploadCredit(index, creditIndex, 'name', e.target.value)}
                                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1">Role</label>
                                <select
                                  value={credit.role}
                                  onChange={(e) => updateTrackUploadCredit(index, creditIndex, 'role', e.target.value)}
                                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                                >
                                  <option value="">Select role</option>
                                  <option value="Artist">Artist</option>
                                  <option value="Producer">Producer</option>
                                  <option value="Songwriter">Songwriter</option>
                                  <option value="Composer">Composer</option>
                                  <option value="Engineer">Engineer</option>
                                  <option value="Mixer">Mixer</option>
                                  <option value="Mastering Engineer">Mastering Engineer</option>
                                  <option value="Vocalist">Vocalist</option>
                                  <option value="Instrumentalist">Instrumentalist</option>
                                  <option value="Featured Artist">Featured Artist</option>
                                </select>
                              </div>
                              <div className="flex items-end">
                                <label className="flex items-center text-xs">
                                  <input
                                    type="checkbox"
                                    checked={credit.is_featured}
                                    onChange={(e) => updateTrackUploadCredit(index, creditIndex, 'is_featured', e.target.checked)}
                                    className="mr-1"
                                  />
                                  Featured
                                </label>
                              </div>
                              <div className="flex items-end">
                                <button
                                  onClick={() => removeTrackUploadCredit(index, creditIndex)}
                                  className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 w-full"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 border-2 border-dashed border-gray-600 rounded">
                        <p className="text-xs text-gray-500 mb-2">No credits added</p>
                        <button
                          onClick={() => addCreditToTrackUpload(index)}
                          className="text-xs text-purple-400 hover:text-purple-300"
                        >
                          + Add first credit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              <div className="flex space-x-4">
                <button
                  onClick={uploadTracks}
                  disabled={uploading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : `Upload ${trackUploads.length} Track${trackUploads.length !== 1 ? 's' : ''}`}
                </button>
                <button
                  onClick={() => setTrackUploads([])}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
