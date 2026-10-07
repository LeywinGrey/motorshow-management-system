import axios from 'axios';

const api = axios.create({
  baseURL: 'https://motorshow-management-system-gwj798jwt.vercel.app/api',
});

// Selalu lampirkan token JWT (jika ada) ke setiap request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Jika token kedaluwarsa / tidak valid, arahkan kembali ke login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401 && !window.location.pathname.startsWith('/penilaian')) {
      localStorage.removeItem('ms_token');
      localStorage.removeItem('ms_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
