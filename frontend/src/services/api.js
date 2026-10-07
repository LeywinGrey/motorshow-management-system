import axios from 'axios';

const api = axios.create({
  baseURL: 'https://motorshow-management-system-ldzywdnl4.vercel.app/',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ms_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;