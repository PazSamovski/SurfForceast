/**
 * Wave condition genres → Cloudinary image URLs.
 * Set VITE_WAVE_IMAGE_SMALL / MEDIUM / BIG in frontend/.env, or replace URLs below.
 */
export const WAVE_GENRES = {
  Small: {
    label: 'Small',
    description: 'Gentle surf — under 1 m',
    imageUrl:
      import.meta.env.VITE_WAVE_IMAGE_SMALL ||
      'https://res.cloudinary.com/demo/image/upload/w_256,h_256,c_fill/sample.jpg',
  },
  Medium: {
    label: 'Medium',
    description: 'Rideable swell — 1 to 2 m',
    imageUrl:
      import.meta.env.VITE_WAVE_IMAGE_MEDIUM ||
      'https://res.cloudinary.com/demo/image/upload/w_256,h_256,c_fill/sample.jpg',
  },
  Big: {
    label: 'Big',
    description: 'Powerful surf — over 2 m',
    imageUrl:
      import.meta.env.VITE_WAVE_IMAGE_BIG ||
      'https://res.cloudinary.com/demo/image/upload/w_256,h_256,c_fill/sample.jpg',
  },
};

export function getWaveGenreImageUrl(genre) {
  if (!genre) return null;
  return WAVE_GENRES[genre]?.imageUrl ?? null;
}
