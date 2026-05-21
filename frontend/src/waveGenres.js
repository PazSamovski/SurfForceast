/**
 * Wave condition genres. Emoji icons are default; set VITE_WAVE_IMAGE_* in .env for Cloudinary URLs.
 */
export const WAVE_GENRES = {
  Small: {
    label: 'Small',
    description: 'Gentle surf — under 1 m',
    emoji: '🌊',
    emojiSize: '2rem',
  },
  Medium: {
    label: 'Medium',
    description: 'Rideable swell — 1 to 2 m',
    emoji: '🌊🌊',
    emojiSize: '2.5rem',
  },
  Big: {
    label: 'Big',
    description: 'Powerful surf — over 2 m',
    emoji: '🌊🌊🌊',
    emojiSize: '3rem',
  },
};

const WAVE_IMAGE_ENV = {
  Small: import.meta.env.VITE_WAVE_IMAGE_SMALL,
  Medium: import.meta.env.VITE_WAVE_IMAGE_MEDIUM,
  Big: import.meta.env.VITE_WAVE_IMAGE_BIG,
};

export function getWaveGenreDisplay(genre) {
  if (!genre || !WAVE_GENRES[genre]) return null;

  const config = WAVE_GENRES[genre];
  const imageUrl = String(WAVE_IMAGE_ENV[genre] ?? '').trim();

  if (imageUrl) {
    return {
      type: 'image',
      imageUrl,
      label: config.label,
      description: config.description,
      genre,
    };
  }

  return {
    type: 'emoji',
    emoji: config.emoji,
    emojiSize: config.emojiSize,
    label: config.label,
    description: config.description,
    genre,
  };
}
