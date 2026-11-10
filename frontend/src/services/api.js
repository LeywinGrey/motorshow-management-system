import axios from 'axios';

// Produksi: memakai URL Vercel. Development lokal: .env.development mengisi VITE_API_URL=/api.
// Jika VITE_API_URL diisi tanpa "/api" di belakangnya (mis. hanya alamat backend), "/api" ditambahkan otomatis.
const DEFAULT_API = 'https://motorshow-management-system.vercel.app/api';
const rawBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const baseURL = rawBase ? (rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`) : DEFAULT_API;

const api = axios.create({ baseURL });

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
