import { useState, useEffect } from 'react';

/**
 * Hook to determine if an image area is dark or light
 * Samples the bottom portion of the image where text will be displayed
 * Returns isDark boolean for conditional text styling
 */
export function useImageLuminosity(
  imageUrl: string | null,
  imageLoaded: boolean,
  sampleArea: 'bottom' | 'full' = 'bottom'
): boolean {
  const [isDark, setIsDark] = useState(true); // Default to dark background (light text)

  useEffect(() => {
    if (!imageUrl || !imageLoaded) {
      setIsDark(true);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw image
        ctx.drawImage(img, 0, 0);

        // Sample area based on parameter
        let imageData;
        if (sampleArea === 'bottom') {
          // Sample bottom 30% where text overlay will be
          const bottomHeight = Math.floor(img.height * 0.3);
          imageData = ctx.getImageData(
            0,
            img.height - bottomHeight,
            img.width,
            bottomHeight
          );
        } else {
          // Sample entire image
          imageData = ctx.getImageData(0, 0, img.width, img.height);
        }

        // Calculate average luminosity using relative luminance formula
        // https://www.w3.org/TR/WCAG20/#relativeluminancedef
        let totalLuminosity = 0;
        const pixels = imageData.data.length / 4;

        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          // Relative luminosity formula (weighted for human perception)
          totalLuminosity += 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }

        const avgLuminosity = totalLuminosity / pixels;

        // Threshold at 128 (middle of 0-255 range)
        // If average luminosity < 128, background is dark, so use light text
        // If average luminosity >= 128, background is light, so use dark text
        setIsDark(avgLuminosity < 128);

      } catch (error) {
        // CORS or other error - fallback to dark background assumption
        console.warn('Image luminosity detection failed:', error);
        setIsDark(true);
      }
    };

    img.onerror = () => {
      // Image failed to load - use default
      setIsDark(true);
    };

    // Start loading
    img.src = imageUrl;

  }, [imageUrl, imageLoaded, sampleArea]);

  return isDark;
}
