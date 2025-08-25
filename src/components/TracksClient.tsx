'use client';

import { useState, useRef } from 'react';
import { Track, TrackFormData, Album } from '@/types/music';

interface TracksClientProps {
  initialTracks: Track[];
  albums: Pick<Album, 'id' | 'title' | 'artist_name'>[];
}

export default function TracksClient({ initialTracks, albums }: TracksClientProps) {
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [filterAlbum, setFilterAlbum] = useState<string>('');
  const audioFileRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<TrackFormData>({
    title: '',
    album_id: '',
    track_number: 1,
    disc_number: 1,
    duration: 0,
    explicit_content: false,
    date_recorded: '',
    recording_studio: '',
    bpm: 0,
    key_signature: '',
    language: 'en',
    lyrics: '',
    isrc: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
             type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitFormData = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        submitFormData.append(key, value.toString());
      });

      if (audioFileRef.current?.files?.[0]) {
        submitFormData.append('audio_file', audioFileRef.current.files[0]);
      }

      const url = editingTrack ? `/api/tracks/${editingTrack.id}` : '/api/tracks';
      const method = editingTrack ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        body: submitFormData
      });

      const result = await response.json() as { success: boolean; error?: string };

      if (result.success) {
        // Refresh tracks list
        const tracksResponse = await fetch('/api/tracks');
        const tracksData = await tracksResponse.json() as { success: boolean; tracks: Track[] };
        if (tracksData.success) {
          setTracks(tracksData.tracks);
        }

        // Reset form
        setFormData({
          title: '',
          album_id: '',
          track_number: 1,
          disc_number: 1,
          duration: 0,
          explicit_content: false,
          date_recorded: '',
          recording_studio: '',
          bpm: 0,
          key_signature: '',
          language: 'en',
          lyrics: '',
          isrc: ''
        });
        setShowCreateForm(false);
        setEditingTrack(null);
        if (audioFileRef.current) {
          audioFileRef.current.value = '';
        }
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error saving track:', error);
      alert('Failed to save track');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (track: Track) => {
    setEditingTrack(track);
    setFormData({
      title: track.title,
      album_id: track.album_id || '',
      track_number: track.track_number,
      disc_number: track.disc_number,
      duration: track.duration,
      explicit_content: track.explicit_content,
      date_recorded: track.date_recorded || '',
      recording_studio: track.recording_studio || '',
      bpm: track.bpm || 0,
      key_signature: track.key_signature || '',
      language: track.language || 'en',
      lyrics: track.lyrics || '',
      isrc: track.isrc || ''
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (trackId: string) => {
    if (!confirm('Are you sure you want to delete this track?')) {
      return;
    }

    try {
      const response = await fetch(`/api/tracks/${trackId}`, {
        method: 'DELETE'
      });

      const result = await response.json() as { success: boolean; error?: string };

      if (result.success) {
        setTracks(tracks.filter(track => track.id !== trackId));
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting track:', error);
      alert('Failed to delete track');
    }
  };

  const filteredTracks = filterAlbum 
    ? tracks.filter(track => track.album_id === filterAlbum)
    : tracks;

  const getAlbumInfo = (albumId: string) => {
    return albums.find(album => album.id === albumId);
  };

  const TrackForm = () => (
    <div className="bg-gray-900 p-6 rounded-lg mb-6">
      <h3 className="text-xl font-bold mb-4">
        {editingTrack ? 'Edit Track' : 'Create New Track'}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Album</label>
            <select
              name="album_id"
              value={formData.album_id}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Album (optional)</option>
              {albums.map(album => (
                <option key={album.id} value={album.id}>
                  {album.title} - {album.artist_name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Track Number *</label>
            <input
              type="number"
              name="track_number"
              value={formData.track_number}
              onChange={handleInputChange}
              min="1"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Disc Number</label>
            <input
              type="number"
              name="disc_number"
              value={formData.disc_number}
              onChange={handleInputChange}
              min="1"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Duration (seconds) *</label>
            <input
              type="number"
              name="duration"
              value={formData.duration}
              onChange={handleInputChange}
              min="1"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">ISRC</label>
            <input
              type="text"
              name="isrc"
              value={formData.isrc}
              onChange={handleInputChange}
              placeholder="e.g., USRC17607839"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Date Recorded</label>
            <input
              type="date"
              name="date_recorded"
              value={formData.date_recorded}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Recording Studio</label>
            <input
              type="text"
              name="recording_studio"
              value={formData.recording_studio}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">BPM</label>
            <input
              type="number"
              name="bpm"
              value={formData.bpm}
              onChange={handleInputChange}
              min="0"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Key Signature</label>
            <input
              type="text"
              name="key_signature"
              value={formData.key_signature}
              onChange={handleInputChange}
              placeholder="e.g., C major, A minor"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Language</label>
            <select
              name="language"
              value={formData.language}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Audio File</label>
            <input
              type="file"
              ref={audioFileRef}
              accept="audio/*"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Lyrics</label>
          <textarea
            name="lyrics"
            value={formData.lyrics}
            onChange={handleInputChange}
            rows={6}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex items-center">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="explicit_content"
              checked={formData.explicit_content}
              onChange={handleInputChange}
              className="mr-2"
            />
            Explicit Content
          </label>
        </div>
        
        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : (editingTrack ? 'Update Track' : 'Create Track')}
          </button>
          
          <button
            type="button"
            onClick={() => {
              setShowCreateForm(false);
              setEditingTrack(null);
              setFormData({
                title: '',
                album_id: '',
                track_number: 1,
                disc_number: 1,
                duration: 0,
                explicit_content: false,
                date_recorded: '',
                recording_studio: '',
                bpm: 0,
                key_signature: '',
                language: 'en',
                lyrics: '',
                isrc: ''
              });
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );

  const TrackCard = ({ track }: { track: Track }) => {
    const albumInfo = track.album_id ? getAlbumInfo(track.album_id) : null;
    
    return (
      <div className="bg-gray-900 rounded-lg p-4 hover:bg-gray-800 transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-bold text-lg">{track.title}</h3>
            {albumInfo && (
              <p className="text-gray-400">{albumInfo.title} - {albumInfo.artist_name}</p>
            )}
            <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
              <span>Track {track.track_number}</span>
              <span>{formatDuration(track.duration)}</span>
              <span className={`px-2 py-1 rounded text-xs ${
                track.audio_status === 'ready' ? 'bg-green-600' :
                track.audio_status === 'error' ? 'bg-red-600' : 'bg-yellow-600'
              }`}>
                {track.audio_status}
              </span>
            </div>
            {track.explicit_content && (
              <span className="inline-block bg-red-600 text-xs px-2 py-1 rounded mt-1">
                Explicit
              </span>
            )}
          </div>
          
          <div className="flex flex-col space-y-2">
            <button
              onClick={() => setSelectedTrack(track)}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
            >
              View
            </button>
            <button
              onClick={() => handleEdit(track)}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(track.id)}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Tracks ({filteredTracks.length})</h2>
          <p className="text-gray-400">Manage your music tracks</p>
        </div>
        
        <div className="flex space-x-4">
          <select
            value={filterAlbum}
            onChange={(e) => setFilterAlbum(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Albums</option>
            {albums.map(album => (
              <option key={album.id} value={album.id}>
                {album.title}
              </option>
            ))}
          </select>
          
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {showCreateForm ? 'Cancel' : 'Add New Track'}
          </button>
        </div>
      </div>

      {showCreateForm && <TrackForm />}

      <div className="grid grid-cols-1 gap-4">
        {filteredTracks.map((track) => (
          <TrackCard key={track.id} track={track} />
        ))}
      </div>

      {filteredTracks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">No tracks found</p>
          <p className="text-gray-500">
            {filterAlbum ? 'No tracks found for selected album' : 'Create your first track to get started'}
          </p>
        </div>
      )}

      {selectedTrack && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold">Track Details</h3>
              <button
                onClick={() => setSelectedTrack(null)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Title:</strong> {selectedTrack.title}</div>
                  <div><strong>Track #:</strong> {selectedTrack.track_number}</div>
                  <div><strong>Duration:</strong> {formatDuration(selectedTrack.duration)}</div>
                  <div><strong>Status:</strong> {selectedTrack.audio_status}</div>
                  <div><strong>ISRC:</strong> {selectedTrack.isrc || 'Not set'}</div>
                  <div><strong>BPM:</strong> {selectedTrack.bpm || 'Not set'}</div>
                  <div><strong>Key:</strong> {selectedTrack.key_signature || 'Not set'}</div>
                  <div><strong>Language:</strong> {selectedTrack.language || 'Not set'}</div>
                </div>
                
                {selectedTrack.date_recorded && (
                  <div><strong>Recorded:</strong> {selectedTrack.date_recorded}</div>
                )}
                
                {selectedTrack.recording_studio && (
                  <div><strong>Studio:</strong> {selectedTrack.recording_studio}</div>
                )}
              </div>
              
              <div>
                {selectedTrack.lyrics && (
                  <div>
                    <strong>Lyrics:</strong>
                    <pre className="mt-1 text-gray-300 whitespace-pre-wrap text-sm max-h-64 overflow-y-auto bg-gray-800 p-3 rounded">
                      {selectedTrack.lyrics}
                    </pre>
                  </div>
                )}
              </div>
            </div>
            
            {selectedTrack.audio_url && (
              <div className="mt-4">
                <strong>Audio:</strong>
                <audio controls className="w-full mt-2">
                  <source src={selectedTrack.audio_url} />
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
