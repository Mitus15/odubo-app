"use client";
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

  return (
    <div className="w-full text-[#ede8df]">
      {/* Back */}
      <header className="p-4">
        <button
          onClick={() => router.push('/media')}
          className="text-[#726d6c] hover:text-[#b2a491] transition-colors"
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </header>

      <main className="px-4 pb-8">
        <div className="max-w-4xl mx-auto">
          {/* Video Player */}
          <div className="w-full aspect-video relative rounded-xl overflow-hidden">
            <CloudflareStreamPlayer video={video} className="absolute inset-0" fillContainer={true} frameless={true} />
          </div>

          {/* Title + Duration */}
          <div className="py-4">
            <h1 className="text-lg sm:text-xl font-medium text-[#ede8df]">{video.title}</h1>
            {video.duration && (
              <span className="text-xs text-[#726d6c] mt-1 block">{formatDuration(video.duration)}</span>
            )}
          </div>

          {/* Up Next */}
          {relatedVideos.length > 0 && (
            <div className="mt-6 pt-6 border-t border-[#502d26]/20">
              <div className="space-y-3">
                {relatedVideos.slice(0, 4).map((rv) => (
                  <Link key={rv.id} href={`/media/${rv.id}`} className="flex items-center gap-3 group">
                    <div className="relative w-24 aspect-video flex-shrink-0 rounded-lg overflow-hidden bg-[#1a1615]">
                      {rv.poster_url && (
                        <Image
                          src={rv.poster_url}
                          alt={rv.title}
                          fill
                          className="object-cover group-hover:scale-[1.02] transition-transform"
                          sizes="96px"
                        />
                      )}
                      {rv.duration && (
                        <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-[#171616]/80 text-[10px] text-[#ede8df] rounded">
                          {formatDuration(rv.duration)}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-[#ede8df] line-clamp-2 group-hover:text-[#b2a491] transition-colors">
                      {rv.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
