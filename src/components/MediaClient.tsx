"use client";
import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Video } from "../app/media/types";

interface MediaClientProps {
  initialVideos: Video[];
}

export default function MediaClient({ initialVideos }: MediaClientProps) {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'featured'>('grid');
  const [filter, setFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);

  const videoTypes = ["all", "music_video", "short_film", "feature"];

  // Featured videos logic - select music videos and short films (up to 5)
  const featuredVideos = useMemo(() => {
    return initialVideos
      .filter((video) => video.type === "music video" || video.type === "short film")
      .slice(0, 5);
  }, [initialVideos]);

  // Filter and search logic
  const filteredVideos = useMemo(() => {
    return initialVideos.filter((video) => {
      const matchesFilter = filter === "all" || video.type.replace(" ", "_") === filter;
      const matchesSearch = 
        video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        video.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [initialVideos, filter, searchTerm]);

  // Navigation functions
  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % featuredVideos.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + featuredVideos.length) % featuredVideos.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  // Auto-advance carousel
  useEffect(() => {
    if (viewMode === 'featured' && featuredVideos.length > 1) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % featuredVideos.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [viewMode, featuredVideos.length]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-4">Media Gallery</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Explore our collection of music videos, short films, and creative content
        </p>
      </div>

      {/* View Mode Toggle */}
      <div className="mb-6 flex justify-center gap-2">
        <button
          onClick={() => setViewMode('grid')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'grid'
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Grid View
        </button>
        <button
          onClick={() => setViewMode('featured')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'featured'
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Featured View
        </button>
      </div>

      {/* Featured Carousel */}
      {viewMode === 'featured' && featuredVideos.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-center">Featured Videos</h2>
          <div className="relative max-w-6xl mx-auto">
            {/* Carousel Container */}
            <div className="relative overflow-hidden rounded-xl shadow-2xl">
              <div 
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {featuredVideos.map((video, index) => (
                  <div key={video.id} className="w-full flex-shrink-0 relative">
                    <div className="relative aspect-video bg-black">
                      {video.poster_url ? (
                        <Image
                          src={video.poster_url}
                          alt={video.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw"
                          priority={index === 0}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-800">
                          <svg className="w-24 h-24 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM5 8a1 1 0 011-1h8a1 1 0 011 1v2a1 1 0 01-1 1H6a1 1 0 01-1-1V8z" />
                          </svg>
                        </div>
                      )}
                      
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
                      
                      {/* Content Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                        <div className="max-w-4xl">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-blue-600 text-white text-sm px-3 py-1 rounded-full">
                              {video.type}
                            </span>
                            {video.duration && (
                              <span className="bg-black/50 text-white text-sm px-3 py-1 rounded-full">
                                {video.duration}
                              </span>
                            )}
                          </div>
                          <h3 className="text-3xl md:text-4xl font-bold mb-3">{video.title}</h3>
                          <p className="text-lg text-gray-200 mb-4 line-clamp-2 max-w-2xl">
                            {video.description}
                          </p>
                          <button
                            onClick={() => setSelectedVideo(video)}
                            className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-flex items-center gap-2 mr-3"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M8 5v10l8-5-8-5z" />
                            </svg>
                            Watch Now
                          </button>
                          <Link
                            href={`/media/${video.id}`}
                            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            View Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Navigation Arrows */}
              {featuredVideos.length > 1 && (
                <>
                  <button
                    onClick={prevSlide}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    onClick={nextSlide}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            
            {/* Dots Indicator */}
            {featuredVideos.length > 1 && (
              <div className="flex justify-center mt-6 gap-2">
                {featuredVideos.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      index === currentSlide ? "bg-blue-600" : "bg-gray-300 hover:bg-gray-400"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid View Content */}
      {viewMode === 'grid' && (
        <>
          {/* Search and Filter Bar */}
          <div className="mb-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search videos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              {videoTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === type
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Videos Count */}
          <div className="mb-6">
            <p className="text-gray-600">
              Showing {filteredVideos.length} of {initialVideos.length} videos
            </p>
          </div>

          {/* Video Grid */}
          {filteredVideos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No videos found matching your criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredVideos.map((video) => (
                <div
                  key={video.id}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Video Thumbnail */}
                  <div 
                    className="relative aspect-video bg-gray-200 cursor-pointer"
                    onClick={() => setSelectedVideo(video)}
                  >
                    {video.poster_url ? (
                      <Image
                        src={video.poster_url}
                        alt={video.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-300">
                        <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM5 8a1 1 0 011-1h8a1 1 0 011 1v2a1 1 0 01-1 1H6a1 1 0 01-1-1V8z" />
                        </svg>
                      </div>
                    )}
                    
                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                      <div className="w-12 h-12 bg-white bg-opacity-0 hover:bg-opacity-90 rounded-full flex items-center justify-center transition-all duration-200">
                        <svg className="w-6 h-6 text-gray-800 opacity-0 hover:opacity-100 transition-opacity duration-200" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8 5v10l8-5-8-5z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Video Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-lg mb-2 line-clamp-2">{video.title}</h3>
                    <p className="text-gray-600 text-sm mb-3 line-clamp-3">{video.description}</p>
                    
                    {/* Video Metadata */}
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {video.type}
                      </span>
                      <span>{video.duration}</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVideo(video);
                        }}
                        className="flex-1 bg-gray-100 text-gray-700 py-2 px-3 rounded text-sm font-medium hover:bg-gray-200 transition-colors"
                      >
                        Quick View
                      </button>
                      <Link
                        href={`/media/${video.id}`}
                        className="flex-1 bg-blue-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-blue-700 transition-colors text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Video Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold">{selectedVideo.title}</h2>
              <button
                onClick={() => setSelectedVideo(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Video Player */}
            <div className="p-6">
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
                <video
                  controls
                  className="w-full h-full"
                  poster={selectedVideo.poster_url}
                >
                  <source src={selectedVideo.url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* Video Info */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Description</h3>
                  <p className="text-gray-700">{selectedVideo.description}</p>
                </div>

                {/* Video Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Type:</strong> {selectedVideo.type}
                  </div>
                  <div>
                    <strong>Duration:</strong> {selectedVideo.duration}
                  </div>
                  <div>
                    <strong>Category:</strong> {selectedVideo.category}
                  </div>
                  <div>
                    <strong>Mood:</strong> {selectedVideo.mood}
                  </div>
                </div>

                {/* Credits */}
                {selectedVideo.credits && selectedVideo.credits.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Credits</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedVideo.credits.map((credit, index) => (
                        <div key={index} className="text-sm">
                          <span className="font-medium">{credit.name}</span> - {credit.role}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Related Projects */}
                {selectedVideo.related_projects && selectedVideo.related_projects.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Related Projects</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedVideo.related_projects.map((project, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                        >
                          {project}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
