export const API_BASE_URL = (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim() !== '')
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
  : 'http://localhost:5000';

export const fetchApi = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': 'Bearer ' + token }),
    ...options.headers,
  };
  
  let response;
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
      throw new Error(`Unable to reach server. Please ensure the backend server is running.`);
    }
    throw err;
  }
  
  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
      // Clear invalid/expired session data so user can re-authenticate cleanly
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:expired'));
    }
    const errorMsg =
      (data && (data.error || (Array.isArray(data.errors) ? data.errors.map(e => e.msg).join(', ') : null))) ||
      `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
};
