/**
 * Color extraction utility for dynamic backgrounds
 * Analyzes product images to create complementary backgrounds
 */

export interface ExtractedColors {
  dominant: string;
  accent: string;
  background: string;
  text: string;
  isLight: boolean;
  luminance: number;
}

/**
 * Extract colors from an image URL
 * Returns dominant color, suggested background, and text color
 */
export async function extractColorsFromImage(imageUrl: string): Promise<ExtractedColors> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(getDefaultColors());
        return;
      }

      // Use smaller size for faster processing
      const size = 50;
      canvas.width = size;
      canvas.height = size;

      ctx.drawImage(img, 0, 0, size, size);

      try {
        const imageData = ctx.getImageData(0, 0, size, size);
        const colors = analyzeImageData(imageData);
        resolve(colors);
      } catch {
        // CORS or other error
        resolve(getDefaultColors());
      }
    };

    img.onerror = () => {
      resolve(getDefaultColors());
    };

    // Add cache buster if needed for CORS
    img.src = imageUrl;
  });
}

function analyzeImageData(imageData: ImageData): ExtractedColors {
  const data = imageData.data;
  const pixels: { r: number; g: number; b: number }[] = [];

  // Sample pixels (every 4th pixel for performance)
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Skip transparent pixels
    if (a < 128) continue;

    // Skip pure white/near white (likely background)
    if (r > 240 && g > 240 && b > 240) continue;

    pixels.push({ r, g, b });
  }

  if (pixels.length === 0) {
    return getDefaultColors();
  }

  // Calculate average color
  const avg = pixels.reduce(
    (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }),
    { r: 0, g: 0, b: 0 }
  );

  const count = pixels.length;
  const dominant = {
    r: Math.round(avg.r / count),
    g: Math.round(avg.g / count),
    b: Math.round(avg.b / count),
  };

  // Calculate luminance (perceived brightness)
  const luminance = (0.299 * dominant.r + 0.587 * dominant.g + 0.114 * dominant.b) / 255;
  const isLight = luminance > 0.5;

  // Find edge colors for gradient (sample edges of image)
  const edgeColors = getEdgeColors(imageData);

  // Create background that contrasts with product
  let background: string;
  let text: string;
  let accent: string;

  if (isLight) {
    // Light product → dark background with subtle color tint
    const tint = adjustColor(dominant, -0.7, 0.3);
    background = `linear-gradient(135deg,
      rgb(${tint.r}, ${tint.g}, ${tint.b}) 0%,
      rgb(${Math.max(0, tint.r - 20)}, ${Math.max(0, tint.g - 20)}, ${Math.max(0, tint.b - 20)}) 50%,
      rgb(${Math.max(0, tint.r - 10)}, ${Math.max(0, tint.g - 10)}, ${Math.max(0, tint.b - 10)}) 100%)`;
    text = '#ede8df';
    accent = `rgb(${Math.min(255, dominant.r + 30)}, ${Math.min(255, dominant.g + 30)}, ${Math.min(255, dominant.b + 30)})`;
  } else {
    // Dark product → light background with subtle warm tint
    const tint = adjustColor(dominant, 0.8, 0.15);
    background = `linear-gradient(135deg,
      rgb(${tint.r}, ${tint.g}, ${tint.b}) 0%,
      rgb(${Math.min(255, tint.r + 10)}, ${Math.min(255, tint.g + 8)}, ${Math.min(255, tint.b + 5)}) 50%,
      rgb(${Math.max(0, tint.r - 5)}, ${Math.max(0, tint.g - 8)}, ${Math.max(0, tint.b - 10)}) 100%)`;
    text = '#1a1817';
    accent = `rgb(${Math.max(0, dominant.r - 30)}, ${Math.max(0, dominant.g - 30)}, ${Math.max(0, dominant.b - 30)})`;
  }

  return {
    dominant: `rgb(${dominant.r}, ${dominant.g}, ${dominant.b})`,
    accent,
    background,
    text,
    isLight,
    luminance,
  };
}

function adjustColor(
  color: { r: number; g: number; b: number },
  lightnessShift: number,
  saturationMix: number
): { r: number; g: number; b: number } {
  // Shift towards light or dark while maintaining some color
  const gray = (color.r + color.g + color.b) / 3;

  let r, g, b;

  if (lightnessShift > 0) {
    // Lighten - blend towards white
    const target = 240;
    r = Math.round(color.r + (target - color.r) * lightnessShift);
    g = Math.round(color.g + (target - color.g) * lightnessShift);
    b = Math.round(color.b + (target - color.b) * lightnessShift);
  } else {
    // Darken - blend towards black but keep some saturation
    const factor = 1 + lightnessShift;
    r = Math.round(color.r * factor);
    g = Math.round(color.g * factor);
    b = Math.round(color.b * factor);
  }

  // Mix in some of the original color for warmth
  r = Math.round(r * (1 - saturationMix) + color.r * saturationMix);
  g = Math.round(g * (1 - saturationMix) + color.g * saturationMix);
  b = Math.round(b * (1 - saturationMix) + color.b * saturationMix);

  return {
    r: Math.max(0, Math.min(255, r)),
    g: Math.max(0, Math.min(255, g)),
    b: Math.max(0, Math.min(255, b)),
  };
}

function getEdgeColors(imageData: ImageData): { top: string; bottom: string } {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // Sample top edge
  let topR = 0, topG = 0, topB = 0, topCount = 0;
  for (let x = 0; x < width; x++) {
    const i = x * 4;
    if (data[i + 3] > 128) {
      topR += data[i];
      topG += data[i + 1];
      topB += data[i + 2];
      topCount++;
    }
  }

  // Sample bottom edge
  let botR = 0, botG = 0, botB = 0, botCount = 0;
  for (let x = 0; x < width; x++) {
    const i = ((height - 1) * width + x) * 4;
    if (data[i + 3] > 128) {
      botR += data[i];
      botG += data[i + 1];
      botB += data[i + 2];
      botCount++;
    }
  }

  const top = topCount > 0
    ? `rgb(${Math.round(topR/topCount)}, ${Math.round(topG/topCount)}, ${Math.round(topB/topCount)})`
    : 'rgb(200, 200, 200)';

  const bottom = botCount > 0
    ? `rgb(${Math.round(botR/botCount)}, ${Math.round(botG/botCount)}, ${Math.round(botB/botCount)})`
    : 'rgb(50, 50, 50)';

  return { top, bottom };
}

function getDefaultColors(): ExtractedColors {
  return {
    dominant: 'rgb(100, 100, 100)',
    accent: 'rgb(130, 130, 130)',
    background: 'linear-gradient(135deg, #f5f3f0 0%, #e8e4df 50%, #ddd8d2 100%)',
    text: '#1a1817',
    isLight: false,
    luminance: 0.4,
  };
}
