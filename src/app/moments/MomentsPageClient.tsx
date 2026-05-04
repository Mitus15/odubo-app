"use client";

import { Suspense, useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  EditorialNav,
  EditorialScroll,
  EditorialScrollItem,
  EditorialDivider,
  EditorialSpotlight,
  SectionHeader,
  FilmGrain,
  EventCard,
  EventCardSkeleton,
  LiveBadge,
} from "@/components/moments/editorial";

interface Event {
  id: number;
  title: string;
  description?: string;
  code?: string;
  starts_at?: string;
  ends_at?: string;
  status?: "upcoming" | "live" | "past";
  photo_count?: number;
  capture_count?: number;
  preview_photo?: { thumbnail_url?: string; r2_url: string };
}

interface Gallery {
  id: number;
  title: string;
  code?: string;
  created_at?: string;
  photo_count?: number;
  preview_photos?: Array<{ id: number; thumbnail_url?: string; r2_url: string }>;
}

function MomentsIndex() {
  const params = useSearchParams();
  const prefillGalleryId = params?.get("galleryId") ?? "";
  const prefillCode = params?.get("code") ?? "";

  const [events, setEvents] = useState<Event[]>([]);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [ig, setIg] = useState("");

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);

      const [eventsRes, galleriesRes] = await Promise.all([
        fetch("/api/moments/events?limit=10"),
        fetch("/api/moments/galleries/public?limit=12&preview=true"),
      ]);

      const eventsData = await eventsRes.json().catch(() => ({}));
      const galleriesData = await galleriesRes.json().catch(() => ({}));

      if (eventsRes.ok && Array.isArray(eventsData.events)) {
        setEvents(eventsData.events);
      }

      if (galleriesRes.ok && Array.isArray(galleriesData.galleries)) {
        setGalleries(galleriesData.galleries);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("instagramHandle");
      if (stored) {
        setIg(stored.startsWith("@") ? stored : `@${stored}`);
      }
    } catch {}
  }, []);

  const featuredEvent = events.find((e) => e.status === "live") || events[0];
  const upcomingEvents = events.filter((e) => e.status === "upcoming");
  const liveEvent = events.find((e) => e.status === "live");

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--editorial-bg)" }}
    >
      <FilmGrain opacity={0.025} />

      <EditorialNav />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-32">
        {/* Hero / Featured Section */}
        {liveEvent ? (
          <section className="pt-8 pb-12">
            <LiveHero
              event={liveEvent}
              onOpenCamera={() => setShowCameraModal(true)}
            />
          </section>
        ) : featuredEvent ? (
          <section className="pt-8 pb-12">
            <FeaturedEvent
              event={featuredEvent}
              onOpenCamera={() => setShowCameraModal(true)}
            />
          </section>
        ) : (
          <EmptyState loading={loading} />
        )}

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <section className="pb-12">
            <SectionHeader label="Upcoming" title="Next Events" />
            <EditorialScroll>
              {upcomingEvents.map((event) => (
                <EditorialScrollItem key={event.id}>
                  <EventCard
                    id={event.id}
                    title={event.title}
                    subtitle={event.description}
                    startsAt={event.starts_at}
                    status={event.status}
                    previewImage={event.preview_photo?.r2_url}
                    className="w-72"
                  />
                </EditorialScrollItem>
              ))}
            </EditorialScroll>
          </section>
        )}

        {/* Archive / Past Galleries */}
        {galleries.length > 0 && (
          <section className="pb-12">
            <SectionHeader label="Archive" title="Past Moments" />
            <EditorialDivider />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {galleries.map((gallery, index) => (
                <Link
                  key={gallery.id}
                  href={`/moments/gallery/${gallery.id}`}
                  className={`editorial-card group block ${
                    index === 0 ? "col-span-2 row-span-2" : ""
                  }`}
                >
                  <div
                    className={`relative ${
                      index === 0 ? "aspect-square" : "aspect-[3/4]"
                    }`}
                  >
                    {gallery.preview_photos && gallery.preview_photos[0] ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            gallery.preview_photos[0].thumbnail_url ||
                            gallery.preview_photos[0].r2_url
                          }
                          alt={gallery.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                        />
                        <div className="editorial-overlay" />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-[var(--editorial-surface)] flex items-center justify-center">
                        <svg
                          className="w-10 h-10 text-[var(--editorial-border)]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                          />
                        </svg>
                      </div>
                    )}

                    {/* Photo count badge */}
                    {gallery.photo_count !== undefined && gallery.photo_count > 0 && (
                      <div
                        className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-medium"
                        style={{
                          background: "rgba(0,0,0,0.6)",
                          backdropFilter: "blur(8px)",
                          color: "white",
                        }}
                      >
                        {gallery.photo_count}
                      </div>
                    )}

                    {/* Content */}
                    <div className="absolute inset-0 flex flex-col justify-end p-4">
                      <h3
                        className={`editorial-heading text-white ${
                          index === 0 ? "text-lg" : "text-sm"
                        }`}
                        style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}
                      >
                        {gallery.title}
                      </h3>
                      {gallery.created_at && (
                        <p className="text-xs text-white/60 mt-1">
                          {new Date(gallery.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Loading skeletons */}
        {loading && events.length === 0 && galleries.length === 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <EventCardSkeleton key={i} featured={i === 0} />
            ))}
          </div>
        )}
      </main>

      {/* Floating Capture Button */}
      <button
        onClick={() => setShowCameraModal(true)}
        className="editorial-fab"
        aria-label="Capture moment"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
          />
        </svg>
      </button>

      {/* Camera Modal */}
      {showCameraModal && (
        <CaptureModal
          galleryId={prefillGalleryId}
          code={prefillCode}
          ig={ig}
          onClose={() => setShowCameraModal(false)}
          onSuccess={refreshData}
        />
      )}
    </div>
  );
}

function LiveHero({
  event,
  onOpenCamera,
}: {
  event: Event;
  onOpenCamera: () => void;
}) {
  return (
    <EditorialSpotlight>
      <div className="relative rounded-2xl overflow-hidden">
        {/* Background */}
        {event.preview_photo?.r2_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.preview_photo.r2_url}
              alt={event.title}
              className="w-full h-full object-cover"
              style={{ maxHeight: "70vh", minHeight: "400px" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--editorial-bg)] via-[var(--editorial-bg)]/40 to-transparent" />
          </>
        ) : (
          <div
            className="w-full flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, var(--editorial-surface) 0%, var(--editorial-bg) 100%)",
              minHeight: "400px",
              maxHeight: "70vh",
            }}
          >
            <div className="text-center">
              <div
                className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ background: "var(--editorial-alert)" }}
              >
                <svg
                  className="w-10 h-10 text-white animate-pulse"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
                  />
                </svg>
              </div>
              <p className="text-sm text-[var(--editorial-text-muted)] uppercase tracking-widest">
                Live Stream
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 lg:p-12">
          <div className="max-w-2xl">
            <LiveBadge count={event.capture_count} className="mb-4" />

            <h1
              className="editorial-display text-3xl sm:text-4xl lg:text-5xl text-white mb-3"
              style={{ textShadow: "0 4px 30px rgba(0,0,0,0.5)" }}
            >
              {event.title}
            </h1>

            {event.description && (
              <p className="text-lg text-white/80 mb-6 max-w-lg">
                {event.description}
              </p>
            )}

            <div className="flex items-center gap-4">
              <button onClick={onOpenCamera} className="editorial-btn">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                  />
                </svg>
                Capture
              </button>

              <Link
                href={`/moments/event/${event.id}`}
                className="editorial-btn editorial-btn-ghost"
              >
                View Feed
              </Link>
            </div>
          </div>
        </div>
      </div>
    </EditorialSpotlight>
  );
}

function FeaturedEvent({
  event,
  onOpenCamera,
}: {
  event: Event;
  onOpenCamera: () => void;
}) {
  const startsDate = event.starts_at ? new Date(event.starts_at) : null;

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="editorial-label mb-1">Featured</p>
          <h1
            className="editorial-display text-2xl sm:text-3xl"
            style={{ color: "var(--editorial-text)" }}
          >
            {event.title}
          </h1>
        </div>
        {startsDate && (
          <div className="hidden sm:block text-right">
            <p className="text-xs text-[var(--editorial-text-muted)] uppercase tracking-wider mb-1">
              {startsDate.toLocaleDateString("en-US", {
                weekday: "long",
              })}
            </p>
            <p className="text-lg text-[var(--editorial-text)]">
              {startsDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}{" "}
              at{" "}
              {startsDate.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        )}
      </div>

      {/* Card */}
      <Link
        href={`/moments/event/${event.id}`}
        className="editorial-card block group"
      >
        <div className="relative aspect-[16/9] sm:aspect-[21/9]">
          {event.preview_photo?.r2_url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.preview_photo.r2_url}
                alt={event.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              />
              <div className="editorial-overlay" />
            </>
          ) : (
            <div className="absolute inset-0 bg-[var(--editorial-surface)] flex items-center justify-center">
              <svg
                className="w-16 h-16 text-[var(--editorial-border)]"
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"
                />
              </svg>
            </div>
          )}

          {/* CTA Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              onClick={(e) => {
                e.preventDefault();
                onOpenCamera();
              }}
              className="editorial-btn"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                />
              </svg>
              Join Event
            </button>
          </div>
        </div>
      </Link>
    </div>
  );
}

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="py-32 text-center">
      <div
        className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
        style={{ background: "var(--editorial-surface)" }}
      >
        <svg
          className="w-10 h-10 text-[var(--editorial-text-muted)]"
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
          />
        </svg>
      </div>
      <h2
        className="editorial-heading text-xl mb-2"
        style={{ color: "var(--editorial-text)" }}
      >
        {loading ? "Loading moments..." : "No events yet"}
      </h2>
      <p
        className="text-sm max-w-md mx-auto"
        style={{ color: "var(--editorial-text-secondary)" }}
      >
        {loading
          ? "Fetching the latest events and galleries."
          : "Check back soon for upcoming events and moments from past gatherings."}
      </p>
    </div>
  );
}

type UploadQueueItem = {
  id: string;
  preview: string;
  blob: Blob;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  mediaType?: "photo" | "video";
};

function CaptureModal({
  galleryId,
  code,
  ig,
  onClose,
  onSuccess,
}: {
  galleryId: string;
  code?: string;
  ig: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [aspect, setAspect] = useState<"9:16" | "3:4">("9:16");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);
  const [mediaType, setMediaType] = useState<"photo" | "video">("photo");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingInterval, setRecordingInterval] = useState<NodeJS.Timeout | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedPreview, setRecordedPreview] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");
  const [currentGalleryId, setCurrentGalleryId] = useState(galleryId);
  const [eventCode, setEventCode] = useState(code);
  const [lookingUp, setLookingUp] = useState(false);
  const [eventInfo, setEventInfo] = useState<{
    title?: string;
    starts_at?: string;
    ends_at?: string;
  } | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const aspectRatio = useMemo(() => (aspect === "9:16" ? 9 / 16 : 3 / 4), [aspect]);
  const MAX_RECORDING_TIME = 60;

  const lookupTimeout = useRef<NodeJS.Timeout | null>(null);

  const lookupEvent = useCallback(async (input: string) => {
    if (!input.trim()) {
      setEventInfo(null);
      return;
    }
    setLookingUp(true);
    try {
      const res = await fetch(`/api/moments/galleries/${encodeURIComponent(input.trim())}`);
      const data = await res.json().catch(() => ({}));
      if (data?.gallery) {
        setEventInfo({
          title: data.gallery.title,
          starts_at: data.gallery.starts_at,
          ends_at: data.gallery.ends_at,
        });
        setCurrentGalleryId(String(data.gallery.id));
        setEventCode(data.gallery.code);
      } else {
        setEventInfo(null);
      }
    } catch {
      setEventInfo(null);
    } finally {
      setLookingUp(false);
    }
  }, []);

  const handleInput = useCallback(
    (v: string) => {
      setCurrentGalleryId(v);
      setEventInfo(null);
      if (lookupTimeout.current) clearTimeout(lookupTimeout.current);
      lookupTimeout.current = setTimeout(() => lookupEvent(v), 500);
    },
    [lookupEvent]
  );

  async function startCamera(withAudio = false) {
    try {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setError("Camera requires HTTPS");
        return;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: facing === "environment" ? 1920 : 1280 },
          height: { ideal: facing === "environment" ? 1080 : 720 },
        },
        audio: withAudio,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef) {
        videoRef.srcObject = stream;
        videoRef.playsInline = true;
        videoRef.muted = true;
        videoRef.autoplay = true;
        await videoRef.play().catch(() => {});
      }
      setError("");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Camera failed";
      setError(message);
    }
  }

  const startCameraRef = useRef(startCamera);
  startCameraRef.current = startCamera;

  useEffect(() => {
    if (videoRef && streamRef.current) {
      videoRef.srcObject = streamRef.current;
      videoRef.play().catch(() => {});
    }
  }, [videoRef]);

  useEffect(() => {
    if (streamRef.current && mediaType === "photo") {
      startCameraRef.current(false);
    }
  }, [facing, aspect, mediaType]);

  useEffect(() => {
    if (mediaType === "video" && !isRecording) {
      startCameraRef.current(true);
    }
  }, [mediaType, isRecording]);

  useEffect(() => {
    return () => {
      if (recordingInterval) clearInterval(recordingInterval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [recordingInterval]);

  function startRecording() {
    if (!streamRef.current) return;
    recordedChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      setRecordedPreview(URL.createObjectURL(blob));
    };

    recorder.start(1000);
    setIsRecording(true);
    setRecordingTime(0);
    try { navigator.vibrate?.(20); } catch {}
    const interval = setInterval(() => {
      setRecordingTime((prev) => {
        if (prev >= MAX_RECORDING_TIME - 1) {
          stopRecording();
          return prev + 1;
        }
        return prev + 1;
      });
    }, 1000);
    setRecordingInterval(interval);
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (recordingInterval) {
      clearInterval(recordingInterval);
      setRecordingInterval(null);
    }
    setIsRecording(false);
    try { navigator.vibrate?.(15); } catch {}
  }

  function acceptRecording() {
    if (!recordedBlob) return;
    const queueItem: UploadQueueItem = {
      id: `${Date.now()}_${Math.random()}`,
      preview: recordedPreview,
      blob: recordedBlob,
      status: "pending",
      mediaType: "video",
    };
    setUploadQueue((prev) => [...prev, queueItem]);
    setRecordedBlob(null);
    setRecordedPreview(null);
  }

  function discardRecording() {
    if (recordedPreview) URL.revokeObjectURL(recordedPreview);
    setRecordedBlob(null);
    setRecordedPreview(null);
  }

  function cropAndDraw() {
    if (!videoRef || !canvasRef) return null;
    const vw = videoRef.videoWidth || 0;
    const vh = videoRef.videoHeight || 0;
    if (!vw || !vh) return null;
    const target = aspect === "9:16" ? 9 / 16 : 3 / 4;
    const srcAspect = vw / vh;
    let sw = vw, sh = vh, sx = 0, sy = 0;
    if (srcAspect > target) {
      sw = Math.round(vh * target);
      sx = Math.round((vw - sw) / 2);
    } else if (srcAspect < target) {
      sh = Math.round(vw / target);
      sy = Math.round((vh - sh) / 2);
    }
    canvasRef.width = sw;
    canvasRef.height = sh;
    const ctx = canvasRef.getContext("2d");
    if (!ctx) return null;
    const mirror = facing === "user";
    if (mirror) {
      ctx.save();
      ctx.translate(sw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef, sx, sy, sw, sh, 0, 0, sw, sh);
      ctx.restore();
    } else {
      ctx.drawImage(videoRef, sx, sy, sw, sh, 0, 0, sw, sh);
    }
    return canvasRef.toDataURL("image/jpeg", 0.92);
  }

  function takePhoto() {
    const dataUrl = cropAndDraw();
    if (!dataUrl) return;
    try { navigator.vibrate?.(15); } catch {}
    const b = dataURLToBlob(dataUrl);
    const queueItem: UploadQueueItem = {
      id: `${Date.now()}_${Math.random()}`,
      preview: dataUrl,
      blob: b,
      status: "pending",
      mediaType: "photo",
    };
    setUploadQueue((prev) => [...prev, queueItem]);
  }

  function dataURLToBlob(dataURL: string) {
    const parts = dataURL.split(",");
    const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
    const bstr = atob(parts[1]);
    const u8 = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }

  function timeoutFetch(input: RequestInfo | URL, init: RequestInit = {}, ms = 15000) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(id));
  }

  async function tryDirectUpload(filename: string, blob: Blob, type: "photo" | "video" = "photo") {
    const u = await timeoutFetch("/api/moments/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ galleryId: currentGalleryId, fileName: filename, mediaType: type }),
    });
    const uj = await u.json() as { uploadUrl?: string; key?: string; error?: string };
    if (!u.ok) throw new Error(uj?.error || "Upload URL failed");
    if (!uj.uploadUrl) throw new Error("No upload URL returned");
    await timeoutFetch(uj.uploadUrl, { method: "PUT", headers: { "Content-Type": type === "video" ? "video/webm" : "image/jpeg" }, body: blob }, 60000);
    return uj.key as string;
  }

  async function tryProxyUpload(filename: string, blob: Blob, type: "photo" | "video" = "photo") {
    const fd = new FormData();
    fd.append("file", blob, filename);
    fd.append("galleryId", currentGalleryId);
    if (eventCode) fd.append("code", eventCode);
    fd.append("mediaType", type);
    fd.append("fileName", filename);
    const p = await timeoutFetch("/api/moments/upload-proxy", { method: "POST", body: fd }, 60000);
    const pj = await p.json() as { key?: string; error?: string };
    if (!p.ok) throw new Error(pj?.error || "Proxy upload failed");
    return pj.key as string;
  }

  async function uploadItem(item: UploadQueueItem) {
    if (!currentGalleryId) throw new Error("Missing gallery ID");
    const ext = item.mediaType === "video" ? "webm" : "jpg";
    const filename = `${item.mediaType}_${Date.now()}.${ext}`;
    let key: string | null = null;

    try {
      key = await tryDirectUpload(filename, item.blob, item.mediaType);
    } catch (directErr) {
      console.warn("Direct upload failed, trying proxy:", directErr);
      try {
        key = await tryProxyUpload(filename, item.blob, item.mediaType);
      } catch { throw directErr; }
    }

    const r = await timeoutFetch("/api/moments/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ galleryId: currentGalleryId, r2_key: key, original_filename: filename, user_name: ig || undefined, media_type: item.mediaType }),
    });
    const rj = await r.json() as { error?: string };
    if (!r.ok) throw new Error(rj?.error || "Record failed");
  }

  async function batchUploadAll() {
    const pending = uploadQueue.filter((item) => item.status === "pending");
    if (pending.length === 0) return;
    setIsBatchUploading(true);
    setError("");
    for (const item of pending) {
      setUploadQueue((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "uploading" } : i)));
      try {
        await uploadItem(item);
        setUploadQueue((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "success" } : i)));
        setTimeout(() => setUploadQueue((prev) => prev.filter((i) => i.id !== item.id)), 1500);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Upload failed";
        setUploadQueue((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "error", error: message } : i)));
      }
    }
    setIsBatchUploading(false);
    if (onSuccess) onSuccess();
  }

  const pendingCount = uploadQueue.filter((i) => i.status === "pending").length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--editorial-bg)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: "var(--editorial-border)" }}>
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--editorial-surface)] transition-colors" style={{ color: "var(--editorial-text-secondary)" }}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div>
            <h2 className="editorial-heading text-sm" style={{ color: "var(--editorial-text)" }}>
              {eventInfo?.title || "Capture Moment"}
            </h2>
            {eventInfo?.title && <p className="text-xs" style={{ color: "var(--editorial-text-muted)" }}>{eventInfo.title}</p>}
          </div>
        </div>
        {currentGalleryId && (
          <Link href={`/moments/event/${currentGalleryId}`} className="text-xs uppercase tracking-wider hover:opacity-80 transition-opacity" style={{ color: "var(--editorial-accent)" }}>
            View Event
          </Link>
        )}
      </div>

      {/* Event lookup */}
      {!currentGalleryId && (
        <div className="px-4 py-4 border-b" style={{ borderColor: "var(--editorial-border)" }}>
          <label className="editorial-label block mb-2" style={{ color: "var(--editorial-text-secondary)" }}>Event ID or Code</label>
          <div className="relative">
            <input type="text" value={currentGalleryId} onChange={(e) => handleInput(e.target.value)} placeholder="Enter event ID" className="w-full px-4 py-3 rounded-lg bg-[var(--editorial-surface)] border text-sm" style={{ borderColor: "var(--editorial-border)", color: "var(--editorial-text)" }} />
            {lookingUp && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "var(--editorial-border)", borderTopColor: "var(--editorial-accent)" }} />
              </div>
            )}
          </div>
          {eventInfo?.title && <p className="text-xs mt-2" style={{ color: "var(--editorial-accent)" }}>Found: {eventInfo.title}</p>}
        </div>
      )}

      {/* Upload queue */}
      {uploadQueue.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--editorial-border-subtle)" }}>
          <span className="text-xs" style={{ color: "var(--editorial-text-muted)" }}>{pendingCount} ready</span>
          {pendingCount > 0 && (
            <button onClick={batchUploadAll} disabled={isBatchUploading} className="px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors" style={{ background: "var(--editorial-text)", color: "var(--editorial-bg)" }}>
              {isBatchUploading ? "Uploading..." : `Upload ${pendingCount}`}
            </button>
          )}
        </div>
      )}

      {/* Viewfinder */}
      <div className="flex-1 flex items-center justify-center p-4" style={{ background: "black" }}>
        <div className="relative rounded-xl overflow-hidden bg-[#0a0908]" style={{ aspectRatio: aspectRatio.toString(), maxHeight: "100%", maxWidth: "100%", width: "auto", height: "auto" }}>
          {recordedPreview ? (
            <video src={recordedPreview} autoPlay loop className="w-full h-full object-cover" />
          ) : (
            <video ref={setVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={facing === "user" ? { transform: "scaleX(-1)" } : undefined} />
          )}
          {!streamRef.current && !isStarting && !recordedPreview && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button onClick={() => { setIsStarting(true); startCamera(mediaType === "video").finally(() => setIsStarting(false)); }} className="px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-wider transition-transform hover:scale-105" style={{ background: "var(--editorial-text)", color: "var(--editorial-bg)" }}>
                Start Camera
              </button>
            </div>
          )}
          {isRecording && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold" style={{ background: "#dc2626", color: "white" }}>
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, "0")}
            </div>
          )}
          <canvas ref={setCanvasRef} className="hidden" />
        </div>
        {error && <p className="absolute bottom-4 left-0 right-0 text-center text-xs" style={{ color: "#dc2626" }}>{error}</p>}
      </div>

      {/* Recording preview actions */}
      {recordedPreview && (
        <div className="flex gap-3 px-4 py-4 border-t" style={{ borderColor: "var(--editorial-border)" }}>
          <button onClick={discardRecording} className="flex-1 py-3 rounded-lg text-sm font-medium transition-colors" style={{ background: "var(--editorial-surface)", color: "var(--editorial-text-secondary)" }}>Discard</button>
          <button onClick={acceptRecording} className="flex-1 py-3 rounded-lg text-sm font-semibold uppercase tracking-wider transition-colors" style={{ background: "var(--editorial-text)", color: "var(--editorial-bg)" }}>Use Video</button>
        </div>
      )}

      {/* Controls */}
      {!recordedPreview && (
        <div className="px-4 py-6 border-t" style={{ borderColor: "var(--editorial-border)", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
          <div className="flex justify-center mb-6">
            <div className="inline-flex p-1 rounded-full" style={{ background: "var(--editorial-surface)" }}>
              <button onClick={() => setMediaType("photo")} className={`px-6 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${mediaType === "photo" ? "bg-white text-black" : "text-[var(--editorial-text-muted)]"}`}>Photo</button>
              <button onClick={() => setMediaType("video")} className={`px-6 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${mediaType === "video" ? "bg-white text-black" : "text-[var(--editorial-text-muted)]"}`}>Video</button>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4">
            <div className="flex rounded-full overflow-hidden" style={{ border: "1px solid var(--editorial-border)" }}>
              <button onClick={() => setAspect("9:16")} className={`px-3 py-2 text-xs font-medium transition-colors ${aspect === "9:16" ? "bg-[var(--editorial-surface)] text-[var(--editorial-text)]" : "text-[var(--editorial-text-muted)]"}`}>9:16</button>
              <button onClick={() => setAspect("3:4")} className={`px-3 py-2 text-xs font-medium transition-colors ${aspect === "3:4" ? "bg-[var(--editorial-surface)] text-[var(--editorial-text)]" : "text-[var(--editorial-text-muted)]"}`}>3:4</button>
            </div>
            <button onClick={() => setFacing((f) => f === "environment" ? "user" : "environment")} className="p-3 rounded-full transition-colors" style={{ border: "1px solid var(--editorial-border)" }}>
              <svg className="w-5 h-5" style={{ color: "var(--editorial-text-secondary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
            {mediaType === "photo" ? (
              <button onClick={takePhoto} disabled={!streamRef.current || isBatchUploading} className="w-14 h-14 rounded-full transition-all hover:scale-105 disabled:opacity-50" style={{ background: "var(--editorial-text)" }} />
            ) : (
              <button onClick={isRecording ? stopRecording : startRecording} disabled={!streamRef.current || isBatchUploading} className={`w-14 h-14 rounded-full transition-all ${isRecording ? "animate-pulse" : ""}`} style={{ background: "#dc2626", opacity: streamRef.current ? 1 : 0.5 }} />
            )}
          </div>
          {mediaType === "video" && !isRecording && <p className="text-center text-xs mt-3" style={{ color: "var(--editorial-text-muted)" }}>Max 60 seconds</p>}
        </div>
      )}

      {/* Preview modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.95)" }} onClick={() => setPreviewImage(null)}>
          <button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img src={previewImage} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

export default function MomentsPageClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--editorial-bg)" }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--editorial-border)", borderTopColor: "var(--editorial-accent)" }} />
      </div>
    }>
      <MomentsIndex />
    </Suspense>
  );
}
