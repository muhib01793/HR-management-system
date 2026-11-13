import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

// Attach the login token to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hr_token');
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
});

// An expired or invalid token sends the person back to the login page.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    if (err.response?.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/register')) {
      localStorage.removeItem('hr_token');
      localStorage.removeItem('hr_user');
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }
    return Promise.reject(err);
  }
);

export default api;
