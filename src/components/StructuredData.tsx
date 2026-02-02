"use client";

import { useEffect } from 'react';

interface StructuredDataProps {
  type: 'website' | 'organization' | 'musicAlbum' | 'musicTrack' | 'video' | 'product';
  data: any;
}

export default function StructuredData({ type, data }: StructuredDataProps) {
  useEffect(() => {
    // Remove existing structured data
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
    existingScripts.forEach(script => script.remove());

    // Create new structured data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    
    let structuredData: any = {};

    switch (type) {
      case 'website':
        structuredData = {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Odubo Studio",
          "description": "Professional music and video content management platform",
          "url": "https://odubo.studio",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://odubo.studio/search?q={search_term_string}",
            "query-input": "required name=search_term_string"
          },
          "publisher": {
            "@type": "Organization",
            "name": "Odubo Studio",
            "url": "https://odubo.studio"
          }
        };
        break;

      case 'organization':
        structuredData = {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Odubo Studio",
          "url": "https://odubo.studio",
          "logo": "https://odubo.studio/brand-logos/baad-logo.png",
          "description": "Professional music and video content management platform",
          "sameAs": [
            "https://twitter.com/odubostudio",
            "https://instagram.com/odubostudio",
            "https://linkedin.com/company/odubostudio"
          ],
          "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "customer service",
            "email": "baad@odubo.studio"
          }
        };
        break;

      case 'musicAlbum':
        structuredData = {
          "@context": "https://schema.org",
          "@type": "MusicAlbum",
          "name": data.name || "Album",
          "description": data.description || "Music album",
          "byArtist": {
            "@type": "MusicGroup",
            "name": data.artist || "Artist"
          },
          "albumReleaseType": data.releaseType || "AlbumRelease",
          "genre": data.genre || "Music",
          "tracks": data.tracks?.map((track: any) => ({
            "@type": "MusicRecording",
            "name": track.name,
            "duration": track.duration
          })) || []
        };
        break;

      case 'musicTrack':
        structuredData = {
          "@context": "https://schema.org",
          "@type": "MusicRecording",
          "name": data.name || "Track",
          "description": data.description || "Music track",
          "byArtist": {
            "@type": "MusicGroup",
            "name": data.artist || "Artist"
          },
          "inAlbum": {
            "@type": "MusicAlbum",
            "name": data.album || "Album"
          },
          "genre": data.genre || "Music",
          "duration": data.duration || "PT3M"
        };
        break;

      case 'video':
        structuredData = {
          "@context": "https://schema.org",
          "@type": "VideoObject",
          "name": data.name || "Video",
          "description": data.description || "Video content",
          "thumbnailUrl": data.thumbnail || "https://odubo.studio/thumbnail.jpg",
          "uploadDate": data.uploadDate || new Date().toISOString(),
          "duration": data.duration || "PT5M",
          "contentUrl": data.contentUrl || "https://odubo.studio/video.mp4",
          "embedUrl": data.embedUrl || "https://odubo.studio/embed",
          "publisher": {
            "@type": "Organization",
            "name": "Odubo Studio",
            "logo": {
              "@type": "ImageObject",
              "url": "https://odubo.studio/brand-logos/baad-logo.png"
            }
          }
        };
        break;

      case 'product':
        structuredData = {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": data.name || "Product",
          "description": data.description || "Product description",
          "image": data.image || "https://odubo.studio/product.jpg",
          "brand": {
            "@type": "Brand",
            "name": "Odubo Studio"
          },
          "offers": {
            "@type": "Offer",
            "price": data.price || "0",
            "priceCurrency": data.currency || "USD",
            "availability": data.availability || "https://schema.org/InStock"
          }
        };
        break;

      default:
        return;
    }

    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);

    // Cleanup on unmount
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [type, data]);

  return null; // This component doesn't render anything visible
}
