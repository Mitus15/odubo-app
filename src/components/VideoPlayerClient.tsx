"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Video } from "../app/media/types";
import CloudflareStreamPlayer from "./CloudflareStreamPlayer";

interface VideoPlayerClientProps {
  video: Video;
  relatedVideos: Video[];
}

export default function VideoPlayerClient({ video, relatedVideos }: VideoPlayerClientProps) {
  const router = useRouter();
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const formatDuration = (duration: string | number) => {
    if (!duration) return '';
    if (typeof duration === 'string' && duration.includes(':')) return duration;
    const seconds = typeof duration === 'string' ? parseFloat(duration) : duration;
    if (isNaN(seconds)) return String(duration);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Get the best description available
  const description = video.long_description || video.description || video.short_description || '';
  const shouldTruncate = description.length > 200;

  return (
    <div className="min-h-screen bg-[#0d0c0a] text-[#ede8df]">
      {/* Header with back button */}
      <header className="sticky top-0 z-30 glass-blur-strong border-b border-[#502d26]/20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/media')}
            className="flex items-center gap-2 text-[#b2a491] hover:text-[#ede8df] transition-colors"
            aria-label="Back to Media"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </button>

          {/* Video type badge */}
          {video.type && (
            <span className="px-3 py-1 rounded-full bg-[#843c2d]/20 text-[#b2a491] text-xs uppercase tracking-wider">
              {video.type}
            </span>
          )}
        </div>
      </header>

      {/* Main content - responsive layout */}
      <main className="max-w-7xl mx-auto">
        <div className="lg:flex lg:gap-6 lg:p-6">
          {/* Video player section */}
          <div className="lg:flex-1 lg:max-w-4xl">
            {/* Player */}
            <div className="w-full aspect-video relative bg-black lg:rounded-xl overflow-hidden">
              <CloudflareStreamPlayer
                video={video}
                className="absolute inset-0"
                fillContainer={true}
                frameless={true}
              />
            </div>

            {/* Title & metadata - below player on mobile */}
            <div className="px-4 py-5 lg:px-0 lg:py-6">
              <h1 className="text-xl lg:text-2xl font-semibold text-[#ede8df] mb-2">
                {video.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-sm text-[#726d6c] mb-4">
                {video.artist_name && (
                  <span className="text-[#b2a491]">{video.artist_name}</span>
                )}
                {video.duration && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-[#502d26]" />
                    <span>{formatDuration(video.duration)}</span>
                  </>
                )}
                {video.category && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-[#502d26]" />
                    <span className="capitalize">{video.category}</span>
                  </>
                )}
                {video.mood && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-[#502d26]" />
                    <span className="capitalize">{video.mood}</span>
                  </>
                )}
              </div>

              {/* Description - expandable */}
              {description && (
                <div className="mb-6">
                  <div className={`text-sm text-[#b2a491] leading-relaxed whitespace-pre-line ${
                    !isDescriptionExpanded && shouldTruncate ? 'line-clamp-3' : ''
                  }`}>
                    {description}
                  </div>

                  {shouldTruncate && (
                    <button
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      className="mt-2 text-xs font-medium text-[#843c2d] hover:text-[#a5523f] transition-colors"
                    >
                      {isDescriptionExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              )}

              {/* Credits section */}
              {video.credits && video.credits.length > 0 && (
                <div className="border-t border-[#502d26]/20 pt-4 mb-6">
                  <h3 className="text-xs uppercase tracking-wider text-[#726d6c] mb-3">Credits</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {video.credits.map((credit, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="text-[#ede8df]">{credit.name}</span>
                        <span className="text-[#726d6c]"> · {credit.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {video.tags && video.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {video.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-full bg-[#302927]/50 text-[#b2a491] text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Related videos - mobile only (shows below content) */}
            {relatedVideos.length > 0 && (
              <div className="lg:hidden px-4 pb-8">
                <h2 className="text-sm uppercase tracking-wider text-[#726d6c] mb-4 pt-4 border-t border-[#502d26]/20">
                  Up Next
                </h2>
                <div className="space-y-3">
                  {relatedVideos.slice(0, 4).map((rv) => (
                    <Link
                      key={rv.id}
                      href={`/media/${rv.id}`}
                      className="flex items-start gap-3 group p-2 -mx-2 rounded-lg hover:bg-[#302927]/30 transition-colors"
                    >
                      <div className="relative w-28 aspect-video flex-shrink-0 rounded-lg overflow-hidden bg-[#1a1615]">
                        {rv.poster_url && (
                          <Image
                            src={rv.poster_url}
                            alt={rv.title}
                            fill
                            className="object-cover group-hover:scale-[1.02] transition-transform"
                            sizes="112px"
                          />
                        )}
                        {rv.duration && (
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-[10px] text-white rounded">
                            {formatDuration(rv.duration)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 py-1">
                        <h3 className="text-sm font-medium text-[#ede8df] line-clamp-2 group-hover:text-white transition-colors">
                          {rv.title}
                        </h3>
                        {rv.artist_name && (
                          <p className="text-xs text-[#726d6c] mt-1 truncate">
                            {rv.artist_name}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Related videos sidebar - desktop only */}
          {relatedVideos.length > 0 && (
            <aside className="hidden lg:block lg:w-80 xl:w-96">
              <h2 className="text-sm uppercase tracking-wider text-[#726d6c] mb-4">
                Up Next
              </h2>
              <div className="space-y-3">
                {relatedVideos.slice(0, 8).map((rv) => (
                  <Link
                    key={rv.id}
                    href={`/media/${rv.id}`}
                    className="flex items-start gap-3 group p-2 -mx-2 rounded-lg hover:bg-[#302927]/30 transition-colors"
                  >
                    <div className="relative w-32 aspect-video flex-shrink-0 rounded-lg overflow-hidden bg-[#1a1615]">
                      {rv.poster_url && (
                        <Image
                          src={rv.poster_url}
                          alt={rv.title}
                          fill
                          className="object-cover group-hover:scale-[1.02] transition-transform"
                          sizes="128px"
                        />
                      )}
                      {rv.duration && (
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-[10px] text-white rounded">
                          {formatDuration(rv.duration)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 py-1">
                      <h3 className="text-sm font-medium text-[#ede8df] line-clamp-2 group-hover:text-white transition-colors">
                        {rv.title}
                      </h3>
                      {rv.artist_name && (
                        <p className="text-xs text-[#726d6c] mt-1 truncate">
                          {rv.artist_name}
                        </p>
                      )}
                      {rv.type && (
                        <p className="text-[10px] text-[#502d26] mt-1 uppercase tracking-wider">
                          {rv.type}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
