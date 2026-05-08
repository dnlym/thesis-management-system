import { BASE_URL } from '@/api/client';

/**
 * Resolves a file URL by prepending the backend BASE_URL if it's a relative path.
 * If it's already an absolute URL (e.g. starting with http), it returns it as is.
 */
export const getFileUrl = (url: string | undefined | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Ensure the relative path starts with a slash
  const relativePath = url.startsWith('/') ? url : `/${url}`;
  return `${BASE_URL}${relativePath}`;
};
