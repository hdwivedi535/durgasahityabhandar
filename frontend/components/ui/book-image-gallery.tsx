'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface BookImageGalleryProps {
  images: string[];
  alt: string;
  className?: string;
}

export function BookImageGallery({ images, alt, className }: BookImageGalleryProps) {
  const urls = images.filter(Boolean).slice(0, 3);
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (urls.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <button
          type="button"
          className="group relative overflow-hidden rounded-lg border border-border bg-accent/20"
          onClick={() => setLightbox(urls[0])}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[0]}
            alt={`${alt} cover`}
            className="aspect-[3/4] w-full object-cover transition-transform duration-300 ease-out group-hover:scale-110"
          />
        </button>
        {urls.length > 1 && (
          <div className="grid gap-3">
            {urls.slice(1).map((url, index) => (
              <button
                key={url}
                type="button"
                className="group relative overflow-hidden rounded-lg border border-border bg-accent/20"
                onClick={() => setLightbox(url)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${alt} image ${index + 2}`}
                  className="aspect-[4/3] w-full object-cover transition-transform duration-300 ease-out group-hover:scale-110"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <button
            type="button"
            aria-label="Close image preview"
            className="absolute inset-0"
            onClick={() => setLightbox(null)}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt={alt}
            className="relative z-10 max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}
