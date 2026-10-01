import { useEffect, useState } from 'react';

const cache = new Map<string, Promise<string | undefined>>();

const toHex = (value: number) => value.toString(16).padStart(2, '0');

function isSkinLike(red: number, green: number, blue: number): boolean {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 510;
  const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
  return red > green && green >= blue && red > 120 && lightness > 0.3 && lightness < 0.88 && saturation > 0.18 && saturation < 0.8;
}

/** Finds the dominant skin-like colour of a sprite, so a procedural body can match a real head. */
function readTone(key: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return resolve(undefined);
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      const counts = new Map<number, number>();
      for (let i = 0; i < data.length; i += 4) {
        const red = data[i] ?? 0;
        const green = data[i + 1] ?? 0;
        const blue = data[i + 2] ?? 0;
        if ((data[i + 3] ?? 0) < 250 || !isSkinLike(red, green, blue)) continue;
        const bucket = ((red >> 3) << 10) | ((green >> 3) << 5) | (blue >> 3);
        counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
      }
      let best: number | undefined;
      let bestCount = 0;
      counts.forEach((count, bucket) => {
        if (count > bestCount) {
          best = bucket;
          bestCount = count;
        }
      });
      if (best === undefined) return resolve(undefined);
      const red = ((best >> 10) & 31) << 3;
      const green = ((best >> 5) & 31) << 3;
      const blue = (best & 31) << 3;
      resolve(`#${toHex(red + 4)}${toHex(green + 4)}${toHex(blue + 4)}`);
    };
    image.onerror = () => resolve(undefined);
    image.src = `/assets/${key}.png`;
  });
}

/** The dominant skin colour of a sprite asset, or undefined while it loads (or when it has none). */
export function useSpriteSkinTone(key: string | undefined): string | undefined {
  const [result, setResult] = useState<{ key: string; tone: string } | undefined>();

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const pending = cache.get(key) ?? readTone(key);
    cache.set(key, pending);
    void pending.then((tone) => {
      if (!cancelled && tone) setResult({ key, tone });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return key && result?.key === key ? result.tone : undefined;
}
