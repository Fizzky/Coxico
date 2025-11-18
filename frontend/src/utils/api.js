// API utility to get the base URL
export const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  // Ensure URL has protocol
  if (envUrl && !envUrl.startsWith('http://') && !envUrl.startsWith('https://')) {
    return `https://${envUrl}`;
  }
  return envUrl;
};

export const apiUrl = getApiUrl();

