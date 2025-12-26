export const normalizeTrailerUrl = (trailer?: string) => {
  if (!trailer) return '';
  const trimmed = trailer.trim();
  if (!trimmed) return '';
  const isIdOnly = /^[a-zA-Z0-9_-]{10,14}$/.test(trimmed);
  if (isIdOnly) {
    return `https://www.youtube.com/watch?v=${trimmed}`;
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (withScheme.includes('youtube.com') || withScheme.includes('youtu.be')) {
    const id = extractYouTubeId(withScheme);
    return id ? `https://www.youtube.com/watch?v=${id}` : withScheme;
  }
  return withScheme;
};

export const extractYouTubeId = (url: string) => {
  const match =
    url.match(/[?&]v=([^&]+)/i) ||
    url.match(/youtu\.be\/([^?&]+)/i) ||
    url.match(/youtube\.com\/embed\/([^?&]+)/i);
  return match ? match[1] : null;
};

export const getTrailerThumbnail = (url?: string) => {
  if (!url) return '';
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
};

export const buildTrailerMeta = (trailer?: string) => {
  const url = normalizeTrailerUrl(trailer);
  return {
    url,
    thumbnail: getTrailerThumbnail(url),
  };
};
