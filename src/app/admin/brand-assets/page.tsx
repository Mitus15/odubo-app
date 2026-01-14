'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  album_count: number;
}

interface Album {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  description: string | null;
  cover_asset_id: number | null;
  status: 'draft' | 'published';
  sort_order: number;
  asset_count: number;
  category_name?: string;
  category_slug?: string;
}

interface Asset {
  id: number;
  album_id: number;
  asset_type: 'image' | 'video';
  r2_key: string | null;
  r2_key_thumb: string | null;
  r2_key_web: string | null;
  stream_uid: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  title: string | null;
  description: string | null;
  alt_text: string | null;
  photographer: string | null;
  model_name: string | null;
  location: string | null;
  shoot_date: string | null;
  tags: string[];
  is_featured: boolean;
  sort_order: number;
  product_handle: string | null;
  moments_photo_id: number | null;
  album_name?: string;
  album_slug?: string;
  category_name?: string;
  category_slug?: string;
  created_at: string;
  updated_at: string;
}

type TypeFilter = 'all' | 'image' | 'video';

// Icons
const Icons = {
  folder: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  ),
  plus: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  image: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  ),
  video: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  star: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  starOutline: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  edit: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  ),
  trash: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  ),
  close: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  upload: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  ),
  search: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  tag: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
    </svg>
  ),
  link: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  ),
  back: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  ),
  menu: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  ),
};

// Format file size
function formatFileSize(bytes: number | null): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export default function BrandAssetsPage() {
  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [showNewAlbumModal, setShowNewAlbumModal] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Auth headers
  const getAuthHeaders = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/brand-assets/categories', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
        // Expand all categories by default
        setExpandedCategories(new Set((data.categories || []).map((c: Category) => c.id)));
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, [getAuthHeaders]);

  // Fetch albums
  const fetchAlbums = useCallback(async () => {
    try {
      let url = '/api/admin/brand-assets/albums';
      if (selectedCategory) {
        url += `?category_id=${selectedCategory}`;
      }
      const res = await fetch(url, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setAlbums(data.albums || []);
      }
    } catch (error) {
      console.error('Error fetching albums:', error);
    }
  }, [getAuthHeaders, selectedCategory]);

  // Fetch assets
  const fetchAssets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedAlbum) params.set('album_id', String(selectedAlbum));
      else if (selectedCategory) params.set('category_id', String(selectedCategory));
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/admin/brand-assets?${params}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, selectedAlbum, selectedCategory, typeFilter, searchQuery]);

  // Initial load
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Toggle category expansion
  const toggleCategory = (categoryId: number) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Get albums for a category
  const getAlbumsForCategory = (categoryId: number) => {
    return albums.filter((a) => a.category_id === categoryId);
  };

  // Get asset thumbnail URL
  const getAssetUrl = (asset: Asset): string => {
    if (asset.r2_key_thumb || asset.r2_key) {
      const key = asset.r2_key_thumb || asset.r2_key;
      const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://media.odubo.studio';
      return `${base}/${key}`;
    }
    if (asset.stream_uid) {
      return `https://customer-${process.env.NEXT_PUBLIC_CLOUDFLARE_CUSTOMER_CODE || 'xxx'}.cloudflarestream.com/${asset.stream_uid}/thumbnails/thumbnail.jpg`;
    }
    return '/placeholder-image.jpg';
  };

  // Delete asset
  const handleDeleteAsset = async (assetId: number) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;

    try {
      const res = await fetch(`/api/admin/brand-assets/${assetId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        fetchAssets();
      } else {
        alert('Failed to delete asset');
      }
    } catch (error) {
      console.error('Error deleting asset:', error);
      alert('Failed to delete asset');
    }
  };

  // Upload Modal Component
  const UploadModal = () => {
    const [files, setFiles] = useState<File[]>([]);
    const [uploadCategoryId, setUploadCategoryId] = useState<number | null>(selectedCategory || categories[0]?.id || null);
    const [uploadAlbumId, setUploadAlbumId] = useState<number | null>(selectedAlbum);
    const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
    const [newAlbumName, setNewAlbumName] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
      );
      setFiles((prev) => [...prev, ...droppedFiles]);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files);
        setFiles((prev) => [...prev, ...selectedFiles]);
      }
    };

    const removeFile = (index: number) => {
      setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
      if (files.length === 0) {
        alert('Please select files to upload');
        return;
      }

      let finalAlbumId = uploadAlbumId;
      const category = categories.find((c) => c.id === uploadCategoryId);

      // Create album if needed
      if (isCreatingAlbum && newAlbumName.trim()) {
        try {
          const albumRes = await fetch('/api/admin/brand-assets/albums', {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify({
              category_id: uploadCategoryId,
              name: newAlbumName.trim(),
              status: 'draft',
            }),
          });
          if (!albumRes.ok) {
            const err = await albumRes.json();
            throw new Error(err.error || 'Failed to create album');
          }
          const albumData = await albumRes.json();
          finalAlbumId = albumData.album?.id;
          await fetchAlbums();
        } catch (error: any) {
          alert(error.message || 'Failed to create album');
          return;
        }
      }

      if (!finalAlbumId) {
        alert('Please select or create an album');
        return;
      }

      const album = albums.find((a) => a.id === finalAlbumId);

      setUploading(true);
      setUploadProgress(0);

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setUploadProgress(Math.round(((i) / files.length) * 100));

          const isVideo = file.type.startsWith('video/');

          if (isVideo) {
            // Video upload to Cloudflare Stream
            // Step 1: Get direct upload URL
            const urlRes = await fetch('/api/admin/brand-assets/upload-video', {
              method: 'POST',
              headers: getAuthHeaders(),
              credentials: 'include',
              body: JSON.stringify({
                filename: file.name,
                category_slug: category?.slug || 'uncategorized',
                album_slug: album?.slug || 'uncategorized',
              }),
            });

            if (!urlRes.ok) {
              throw new Error(`Failed to get upload URL for ${file.name}`);
            }

            const { uploadURL, uid } = await urlRes.json();

            // Step 2: Upload directly to Cloudflare Stream using TUS
            const tusRes = await fetch(uploadURL, {
              method: 'POST',
              headers: {
                'Tus-Resumable': '1.0.0',
                'Upload-Length': String(file.size),
                'Content-Type': 'application/offset+octet-stream',
                'Upload-Offset': '0',
              },
              body: file,
            });

            if (!tusRes.ok && tusRes.status !== 204) {
              // Try alternative upload method
              const formUpload = new FormData();
              formUpload.append('file', file);
              await fetch(uploadURL, {
                method: 'POST',
                body: formUpload,
              });
            }

            // Step 3: Create asset record with stream UID
            const assetRes = await fetch('/api/admin/brand-assets', {
              method: 'POST',
              headers: getAuthHeaders(),
              credentials: 'include',
              body: JSON.stringify({
                album_id: finalAlbumId,
                asset_type: 'video',
                stream_uid: uid,
                original_filename: file.name,
                mime_type: file.type,
                file_size: file.size,
                title: file.name.replace(/\.[^.]+$/, ''),
              }),
            });

            if (!assetRes.ok) {
              console.error('Failed to create video asset record');
            }
          } else {
            // Image upload to R2
            const formData = new FormData();
            formData.append('file', file);
            formData.append('category_slug', category?.slug || 'uncategorized');
            formData.append('album_slug', album?.slug || 'uncategorized');

            const uploadRes = await fetch('/api/admin/brand-assets/upload', {
              method: 'POST',
              headers: {
                ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
              },
              credentials: 'include',
              body: formData,
            });

            if (!uploadRes.ok) {
              throw new Error(`Failed to upload ${file.name}`);
            }

            const uploadData = await uploadRes.json();

            // Create asset record
            const assetRes = await fetch('/api/admin/brand-assets', {
              method: 'POST',
              headers: getAuthHeaders(),
              credentials: 'include',
              body: JSON.stringify({
                album_id: finalAlbumId,
                asset_type: 'image',
                r2_key: uploadData.r2_key,
                r2_key_thumb: uploadData.r2_key_thumb,
                r2_key_web: uploadData.r2_key_web,
                original_filename: uploadData.original_filename,
                mime_type: uploadData.mime_type,
                file_size: uploadData.file_size,
                title: file.name.replace(/\.[^.]+$/, ''),
              }),
            });

            if (!assetRes.ok) {
              console.error('Failed to create image asset record');
            }
          }
        }

        setUploadProgress(100);
        setTimeout(() => {
          setShowUploadModal(false);
          fetchAssets();
          fetchAlbums();
        }, 500);
      } catch (error: any) {
        alert(error.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    };

    const availableAlbums = albums.filter((a) => a.category_id === uploadCategoryId);

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4"
        onClick={(e) => e.target === e.currentTarget && !uploading && setShowUploadModal(false)}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-[#171616] sm:rounded-2xl rounded-t-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#b2a491]/10">
            <h2 className="text-lg font-semibold text-[#ede8df]">Upload Assets</h2>
            <button
              onClick={() => !uploading && setShowUploadModal(false)}
              disabled={uploading}
              className="p-2 hover:bg-[#0d0b0a] rounded-lg transition-colors disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              {Icons.close}
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-[#b2a491] bg-[#b2a491]/10' : 'border-[#b2a491]/30 hover:border-[#b2a491]/50'
              }`}
            >
              <div className="text-[#b2a491] mb-3 flex justify-center">{Icons.upload}</div>
              <p className="text-[#ede8df] mb-1 text-sm sm:text-base">Tap to select files</p>
              <p className="text-xs sm:text-sm text-[#888]">Images & Videos supported</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Selected files */}
            {files.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-[#ede8df] mb-3">Selected Files ({files.length})</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {files.map((file, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square bg-[#0d0b0a] rounded-lg overflow-hidden">
                        {file.type.startsWith('image/') ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#b2a491]">
                            {Icons.video}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                        className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="white" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <p className="text-xs text-[#888] truncate mt-1 hidden sm:block">{file.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Category & Album selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#ede8df] mb-2">Category</label>
                <select
                  value={uploadCategoryId || ''}
                  onChange={(e) => {
                    setUploadCategoryId(Number(e.target.value));
                    setUploadAlbumId(null);
                  }}
                  className="w-full px-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl text-[#ede8df] focus:outline-none focus:border-[#b2a491]/50 text-base"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#ede8df] mb-2">Album</label>
                {isCreatingAlbum ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAlbumName}
                      onChange={(e) => setNewAlbumName(e.target.value)}
                      placeholder="New album name..."
                      className="flex-1 px-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl text-[#ede8df] focus:outline-none focus:border-[#b2a491]/50 text-base"
                      autoFocus
                    />
                    <button
                      onClick={() => { setIsCreatingAlbum(false); setNewAlbumName(''); }}
                      className="p-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl hover:bg-[#1a1614] min-w-[44px]"
                    >
                      {Icons.close}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={uploadAlbumId || ''}
                      onChange={(e) => setUploadAlbumId(Number(e.target.value) || null)}
                      className="flex-1 px-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl text-[#ede8df] focus:outline-none focus:border-[#b2a491]/50 text-base"
                    >
                      <option value="">Select album...</option>
                      {availableAlbums.map((album) => (
                        <option key={album.id} value={album.id}>{album.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setIsCreatingAlbum(true)}
                      className="p-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl hover:bg-[#1a1614] min-w-[44px]"
                      title="Create new album"
                    >
                      {Icons.plus}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Upload progress */}
            {uploading && (
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-[#888]">Uploading...</span>
                  <span className="text-[#ede8df]">{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-[#0d0b0a] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#b2a491] transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-4 sm:px-6 py-4 border-t border-[#b2a491]/10 pb-safe">
            <button
              onClick={() => setShowUploadModal(false)}
              disabled={uploading}
              className="px-4 sm:px-6 py-3 text-[#ede8df] hover:bg-[#0d0b0a] rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className="px-4 sm:px-6 py-3 bg-[#b2a491] text-[#0d0b0a] rounded-xl font-medium hover:bg-[#c4b8a5] transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : `Upload ${files.length}`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  // Editor Modal Component
  const EditorModal = () => {
    const [formData, setFormData] = useState({
      title: editingAsset?.title || '',
      description: editingAsset?.description || '',
      alt_text: editingAsset?.alt_text || '',
      photographer: editingAsset?.photographer || '',
      model_name: editingAsset?.model_name || '',
      location: editingAsset?.location || '',
      shoot_date: editingAsset?.shoot_date || '',
      tags: editingAsset?.tags || [],
      is_featured: editingAsset?.is_featured || false,
      product_handle: editingAsset?.product_handle || '',
    });
    const [newTag, setNewTag] = useState('');
    const [saving, setSaving] = useState(false);

    const addTag = () => {
      if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
        setFormData((prev) => ({ ...prev, tags: [...prev.tags, newTag.trim()] }));
        setNewTag('');
      }
    };

    const removeTag = (tag: string) => {
      setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
    };

    const handleSave = async () => {
      if (!editingAsset) return;

      setSaving(true);
      try {
        const res = await fetch(`/api/admin/brand-assets/${editingAsset.id}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          credentials: 'include',
          body: JSON.stringify(formData),
        });

        if (res.ok) {
          setShowEditorModal(false);
          setEditingAsset(null);
          fetchAssets();
        } else {
          alert('Failed to save changes');
        }
      } catch (error) {
        console.error('Error saving asset:', error);
        alert('Failed to save changes');
      } finally {
        setSaving(false);
      }
    };

    if (!editingAsset) return null;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4"
        onClick={(e) => e.target === e.currentTarget && !saving && setShowEditorModal(false)}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-[#171616] sm:rounded-2xl rounded-t-2xl w-full sm:max-w-3xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#b2a491]/10">
            <h2 className="text-lg font-semibold text-[#ede8df]">Edit Asset</h2>
            <button
              onClick={() => { setShowEditorModal(false); setEditingAsset(null); }}
              disabled={saving}
              className="p-2 hover:bg-[#0d0b0a] rounded-lg transition-colors disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              {Icons.close}
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {/* Preview - horizontal on mobile */}
            <div className="flex sm:hidden gap-4 mb-4">
              <div className="w-24 h-24 flex-shrink-0 bg-[#0d0b0a] rounded-xl overflow-hidden">
                <img
                  src={getAssetUrl(editingAsset)}
                  alt={editingAsset.title || 'Asset'}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 text-sm text-[#888]">
                <p className="truncate">{editingAsset.original_filename}</p>
                <p>{formatFileSize(editingAsset.file_size)}</p>
                {editingAsset.width && editingAsset.height && (
                  <p>{editingAsset.width} × {editingAsset.height}</p>
                )}
              </div>
            </div>

            <div className="hidden sm:grid sm:grid-cols-3 gap-6">
              {/* Preview - desktop */}
              <div className="col-span-1">
                <div className="aspect-square bg-[#0d0b0a] rounded-xl overflow-hidden">
                  <img
                    src={getAssetUrl(editingAsset)}
                    alt={editingAsset.title || 'Asset'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="mt-3 text-sm text-[#888]">
                  <p>{editingAsset.original_filename}</p>
                  <p>{formatFileSize(editingAsset.file_size)}</p>
                  {editingAsset.width && editingAsset.height && (
                    <p>{editingAsset.width} × {editingAsset.height}</p>
                  )}
                </div>
              </div>

              {/* Form - desktop */}
              <div className="col-span-2 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-[#ede8df] mb-2">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl text-[#ede8df] focus:outline-none focus:border-[#b2a491]/50"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-[#ede8df] mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl text-[#ede8df] focus:outline-none focus:border-[#b2a491]/50 resize-none"
                  />
                </div>

                {/* Alt Text */}
                <div>
                  <label className="block text-sm font-medium text-[#ede8df] mb-2">Alt Text (SEO)</label>
                  <input
                    type="text"
                    value={formData.alt_text}
                    onChange={(e) => setFormData((prev) => ({ ...prev, alt_text: e.target.value }))}
                    placeholder="Describe the image for accessibility..."
                    className="w-full px-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl text-[#ede8df] focus:outline-none focus:border-[#b2a491]/50"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-[#ede8df] mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-[#b2a491]/20 text-[#b2a491] rounded-full text-sm"
                      >
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-white">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      placeholder="Add tag..."
                      className="flex-1 px-4 py-2 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl text-[#ede8df] focus:outline-none focus:border-[#b2a491]/50"
                    />
                    <button
                      onClick={addTag}
                      className="px-4 py-2 bg-[#b2a491]/20 text-[#b2a491] rounded-xl hover:bg-[#b2a491]/30"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Attribution */}
                <div className="border-t border-[#b2a491]/10 pt-4">
                  <h3 className="text-sm font-medium text-[#ede8df] mb-3">Attribution</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[#888] mb-1">Photographer</label>
                      <input
                        type="text"
                        value={formData.photographer}
                        onChange={(e) => setFormData((prev) => ({ ...prev, photographer: e.target.value }))}
                        className="w-full px-3 py-2 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-lg text-[#ede8df] text-sm focus:outline-none focus:border-[#b2a491]/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#888] mb-1">Model</label>
                      <input
                        type="text"
                        value={formData.model_name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, model_name: e.target.value }))}
                        className="w-full px-3 py-2 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-lg text-[#ede8df] text-sm focus:outline-none focus:border-[#b2a491]/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#888] mb-1">Location</label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                        className="w-full px-3 py-2 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-lg text-[#ede8df] text-sm focus:outline-none focus:border-[#b2a491]/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#888] mb-1">Shoot Date</label>
                      <input
                        type="date"
                        value={formData.shoot_date}
                        onChange={(e) => setFormData((prev) => ({ ...prev, shoot_date: e.target.value }))}
                        className="w-full px-3 py-2 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-lg text-[#ede8df] text-sm focus:outline-none focus:border-[#b2a491]/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Product Link */}
                <div className="border-t border-[#b2a491]/10 pt-4">
                  <h3 className="text-sm font-medium text-[#ede8df] mb-3">Product Link</h3>
                  <input
                    type="text"
                    value={formData.product_handle}
                    onChange={(e) => setFormData((prev) => ({ ...prev, product_handle: e.target.value }))}
                    placeholder="Shopify product handle..."
                    className="w-full px-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl text-[#ede8df] focus:outline-none focus:border-[#b2a491]/50"
                  />
                </div>

                {/* Featured */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setFormData((prev) => ({ ...prev, is_featured: !prev.is_featured }))}
                    className={`p-2 rounded-lg transition-colors ${
                      formData.is_featured ? 'bg-yellow-500/20 text-yellow-400' : 'bg-[#0d0b0a] text-[#888]'
                    }`}
                  >
                    {formData.is_featured ? Icons.star : Icons.starOutline}
                  </button>
                  <span className="text-sm text-[#ede8df]">
                    {formData.is_featured ? 'Featured' : 'Mark as featured'}
                  </span>
                </div>
              </div>
            </div>

            {/* Form - mobile only */}
            <div className="sm:hidden space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-[#ede8df] mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl text-[#ede8df] focus:outline-none focus:border-[#b2a491]/50 text-base"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-[#ede8df] mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl text-[#ede8df] focus:outline-none focus:border-[#b2a491]/50 resize-none text-base"
                />
              </div>

              {/* Alt Text */}
              <div>
                <label className="block text-sm font-medium text-[#ede8df] mb-2">Alt Text</label>
                <input
                  type="text"
                  value={formData.alt_text}
                  onChange={(e) => setFormData((prev) => ({ ...prev, alt_text: e.target.value }))}
                  placeholder="Describe the image..."
                  className="w-full px-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl text-[#ede8df] focus:outline-none focus:border-[#b2a491]/50 text-base"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-[#ede8df] mb-2">Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#b2a491]/20 text-[#b2a491] rounded-full text-sm"
                    >
                      {tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-white p-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Add tag..."
                    className="flex-1 px-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl text-[#ede8df] focus:outline-none focus:border-[#b2a491]/50 text-base"
                  />
                  <button
                    onClick={addTag}
                    className="px-4 py-3 bg-[#b2a491]/20 text-[#b2a491] rounded-xl hover:bg-[#b2a491]/30 min-w-[44px]"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Product Link */}
              <div>
                <label className="block text-sm font-medium text-[#ede8df] mb-2">Product Handle</label>
                <input
                  type="text"
                  value={formData.product_handle}
                  onChange={(e) => setFormData((prev) => ({ ...prev, product_handle: e.target.value }))}
                  placeholder="Shopify product handle..."
                  className="w-full px-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-xl text-[#ede8df] focus:outline-none focus:border-[#b2a491]/50 text-base"
                />
              </div>

              {/* Featured */}
              <button
                onClick={() => setFormData((prev) => ({ ...prev, is_featured: !prev.is_featured }))}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  formData.is_featured ? 'bg-yellow-500/20' : 'bg-[#0d0b0a]'
                }`}
              >
                <span className={formData.is_featured ? 'text-yellow-400' : 'text-[#888]'}>
                  {formData.is_featured ? Icons.star : Icons.starOutline}
                </span>
                <span className="text-sm text-[#ede8df]">
                  {formData.is_featured ? 'Featured' : 'Mark as featured'}
                </span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 px-4 sm:px-6 py-4 border-t border-[#b2a491]/10 pb-safe">
            <button
              onClick={() => handleDeleteAsset(editingAsset.id)}
              className="px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors text-center"
            >
              Delete Asset
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowEditorModal(false); setEditingAsset(null); }}
                disabled={saving}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-3 text-[#ede8df] hover:bg-[#0d0b0a] rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-3 bg-[#b2a491] text-[#0d0b0a] rounded-xl font-medium hover:bg-[#c4b8a5] transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  // Get current filter label for mobile
  const getCurrentFilterLabel = () => {
    if (selectedAlbum) {
      const album = albums.find(a => a.id === selectedAlbum);
      return album?.name || 'Album';
    }
    if (selectedCategory) {
      const category = categories.find(c => c.id === selectedCategory);
      return `All ${category?.name || ''}`;
    }
    return 'All Assets';
  };

  return (
    <div className="min-h-screen bg-[#0d0b0a] text-[#ede8df]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0d0b0a]/95 backdrop-blur-sm border-b border-[#b2a491]/10">
        <div className="px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <a href="/admin" className="p-2 hover:bg-[#1a1614] rounded-lg transition-colors flex-shrink-0">
                {Icons.back}
              </a>
              <h1 className="text-lg sm:text-xl font-semibold truncate">Brand Assets</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Mobile sidebar toggle */}
              <button
                onClick={() => setShowMobileSidebar(true)}
                className="sm:hidden p-2.5 hover:bg-[#1a1614] rounded-lg transition-colors"
              >
                {Icons.menu}
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-[#b2a491] text-[#0d0b0a] rounded-xl font-medium hover:bg-[#c4b8a5] transition-colors"
              >
                {Icons.plus}
                <span className="hidden sm:inline">Upload</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {showMobileSidebar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 sm:hidden"
            onClick={() => setShowMobileSidebar(false)}
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute left-0 top-0 bottom-0 w-72 bg-[#171616] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile sidebar header */}
              <div className="flex items-center justify-between px-4 py-4 border-b border-[#b2a491]/10">
                <h2 className="font-semibold">Categories</h2>
                <button
                  onClick={() => setShowMobileSidebar(false)}
                  className="p-2 hover:bg-[#0d0b0a] rounded-lg transition-colors"
                >
                  {Icons.close}
                </button>
              </div>

              <div className="p-4">
                {/* Search */}
                <div className="relative mb-4">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]">{Icons.search}</span>
                  <input
                    type="text"
                    placeholder="Search assets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[#0d0b0a] border border-[#b2a491]/20 rounded-lg text-base text-[#ede8df] focus:outline-none focus:border-[#b2a491]/50"
                  />
                </div>

                {/* All Assets */}
                <button
                  onClick={() => { setSelectedCategory(null); setSelectedAlbum(null); setShowMobileSidebar(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg mb-2 transition-colors ${
                    !selectedCategory && !selectedAlbum ? 'bg-[#b2a491]/20 text-[#b2a491]' : 'hover:bg-[#0d0b0a]'
                  }`}
                >
                  {Icons.folder}
                  <span className="flex-1 text-left">All Assets</span>
                  <span className="text-sm text-[#888]">{assets.length}</span>
                </button>

                {/* Categories */}
                {categories.map((category) => (
                  <div key={category.id} className="mb-1">
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="w-full flex items-center gap-2 px-3 py-3 hover:bg-[#0d0b0a] rounded-lg transition-colors"
                    >
                      <span className={`transition-transform ${expandedCategories.has(category.id) ? 'rotate-90' : ''}`}>
                        {Icons.chevronRight}
                      </span>
                      <span className="flex-1 text-left font-medium">{category.name}</span>
                      <span className="text-sm text-[#888]">{category.album_count}</span>
                    </button>

                    {/* Albums */}
                    <AnimatePresence>
                      {expandedCategories.has(category.id) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pl-6 py-1 space-y-1">
                            {/* All in category */}
                            <button
                              onClick={() => { setSelectedCategory(category.id); setSelectedAlbum(null); setShowMobileSidebar(false); }}
                              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors ${
                                selectedCategory === category.id && !selectedAlbum
                                  ? 'bg-[#b2a491]/20 text-[#b2a491]'
                                  : 'text-[#888] hover:bg-[#0d0b0a] hover:text-[#ede8df]'
                              }`}
                            >
                              <span>All {category.name}</span>
                            </button>

                            {/* Individual albums */}
                            {getAlbumsForCategory(category.id).map((album) => (
                              <button
                                key={album.id}
                                onClick={() => { setSelectedCategory(category.id); setSelectedAlbum(album.id); setShowMobileSidebar(false); }}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg transition-colors ${
                                  selectedAlbum === album.id
                                    ? 'bg-[#b2a491]/20 text-[#b2a491]'
                                    : 'text-[#888] hover:bg-[#0d0b0a] hover:text-[#ede8df]'
                                }`}
                              >
                                <span className="truncate">{album.name}</span>
                                <span className="text-sm">{album.asset_count}</span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden sm:block w-64 border-r border-[#b2a491]/10 min-h-[calc(100vh-73px)] p-4">
          {/* Search */}
          <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]">{Icons.search}</span>
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#171616] border border-[#b2a491]/20 rounded-lg text-sm text-[#ede8df] focus:outline-none focus:border-[#b2a491]/50"
            />
          </div>

          {/* All Assets */}
          <button
            onClick={() => { setSelectedCategory(null); setSelectedAlbum(null); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-2 transition-colors ${
              !selectedCategory && !selectedAlbum ? 'bg-[#b2a491]/20 text-[#b2a491]' : 'hover:bg-[#1a1614]'
            }`}
          >
            {Icons.folder}
            <span className="flex-1 text-left text-sm">All Assets</span>
            <span className="text-xs text-[#888]">{assets.length}</span>
          </button>

          {/* Categories */}
          {categories.map((category) => (
            <div key={category.id} className="mb-1">
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#1a1614] rounded-lg transition-colors"
              >
                <span className={`transition-transform ${expandedCategories.has(category.id) ? 'rotate-90' : ''}`}>
                  {Icons.chevronRight}
                </span>
                <span className="flex-1 text-left text-sm font-medium">{category.name}</span>
                <span className="text-xs text-[#888]">{category.album_count}</span>
              </button>

              {/* Albums */}
              <AnimatePresence>
                {expandedCategories.has(category.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pl-6 py-1 space-y-1">
                      {/* All in category */}
                      <button
                        onClick={() => { setSelectedCategory(category.id); setSelectedAlbum(null); }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          selectedCategory === category.id && !selectedAlbum
                            ? 'bg-[#b2a491]/20 text-[#b2a491]'
                            : 'text-[#888] hover:bg-[#1a1614] hover:text-[#ede8df]'
                        }`}
                      >
                        <span>All {category.name}</span>
                      </button>

                      {/* Individual albums */}
                      {getAlbumsForCategory(category.id).map((album) => (
                        <button
                          key={album.id}
                          onClick={() => { setSelectedCategory(category.id); setSelectedAlbum(album.id); }}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            selectedAlbum === album.id
                              ? 'bg-[#b2a491]/20 text-[#b2a491]'
                              : 'text-[#888] hover:bg-[#1a1614] hover:text-[#ede8df]'
                          }`}
                        >
                          <span className="truncate">{album.name}</span>
                          <span className="text-xs">{album.asset_count}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 sm:p-6">
          {/* Mobile filter bar */}
          <div className="sm:hidden flex items-center gap-3 mb-4">
            <button
              onClick={() => setShowMobileSidebar(true)}
              className="flex-1 flex items-center justify-between px-4 py-3 bg-[#171616] rounded-xl border border-[#b2a491]/10"
            >
              <span className="text-sm font-medium truncate">{getCurrentFilterLabel()}</span>
              {Icons.chevronDown}
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6 overflow-x-auto pb-2 sm:pb-0">
            <div className="flex items-center gap-1 sm:gap-2 bg-[#171616] rounded-lg p-1 flex-shrink-0">
              {(['all', 'image', 'video'] as TypeFilter[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-2 sm:py-1.5 rounded-md text-sm transition-colors whitespace-nowrap ${
                    typeFilter === type ? 'bg-[#b2a491]/20 text-[#b2a491]' : 'text-[#888] hover:text-[#ede8df]'
                  }`}
                >
                  {type === 'all' ? 'All' : type === 'image' ? 'Images' : 'Videos'}
                </button>
              ))}
            </div>
          </div>

          {/* Assets Grid */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-[#b2a491]/30 border-t-[#b2a491] rounded-full animate-spin" />
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <div className="text-[#888] mb-4">{Icons.image}</div>
              <h3 className="text-lg font-medium mb-2">No assets yet</h3>
              <p className="text-[#888] mb-4 text-sm">Upload some images or videos to get started</p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-3 bg-[#b2a491] text-[#0d0b0a] rounded-xl font-medium hover:bg-[#c4b8a5]"
              >
                {Icons.plus}
                <span>Upload</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {assets.map((asset) => (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="group relative bg-[#171616] rounded-xl overflow-hidden border border-[#b2a491]/10 active:scale-[0.98] transition-all"
                  onClick={() => { setEditingAsset(asset); setShowEditorModal(true); }}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-square bg-[#0d0b0a]">
                    <img
                      src={getAssetUrl(asset)}
                      alt={asset.title || asset.original_filename || 'Asset'}
                      className="w-full h-full object-cover"
                    />

                    {/* Type badge */}
                    <div className="absolute top-2 left-2">
                      <span className={`p-1 sm:p-1.5 rounded-lg ${
                        asset.asset_type === 'video' ? 'bg-purple-500/80' : 'bg-blue-500/80'
                      }`}>
                        {asset.asset_type === 'video' ? Icons.video : Icons.image}
                      </span>
                    </div>

                    {/* Featured star */}
                    {asset.is_featured && (
                      <div className="absolute top-2 right-2 text-yellow-400">
                        {Icons.star}
                      </div>
                    )}

                    {/* Desktop hover overlay */}
                    <div className="hidden sm:flex absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingAsset(asset); setShowEditorModal(true); }}
                        className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                      >
                        {Icons.edit}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteAsset(asset.id); }}
                        className="p-2 bg-red-500/20 rounded-lg hover:bg-red-500/30 text-red-400 transition-colors"
                      >
                        {Icons.trash}
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-2 sm:p-3">
                    <h3 className="text-xs sm:text-sm font-medium truncate mb-0.5 sm:mb-1">
                      {asset.title || asset.original_filename || 'Untitled'}
                    </h3>
                    {asset.tags && asset.tags.length > 0 && (
                      <div className="hidden sm:flex items-center gap-1 text-xs text-[#888]">
                        {Icons.tag}
                        <span className="truncate">{asset.tags.slice(0, 2).join(', ')}</span>
                      </div>
                    )}
                    {asset.product_handle && (
                      <div className="flex items-center gap-1 text-xs text-[#b2a491] mt-0.5 sm:mt-1">
                        {Icons.link}
                        <span className="truncate">{asset.product_handle}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showUploadModal && <UploadModal />}
        {showEditorModal && editingAsset && <EditorModal />}
      </AnimatePresence>
    </div>
  );
}
