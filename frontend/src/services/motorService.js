import api from './api';

// Satu pemanggilan = satu unit motor (satu baris di tabel motorcycles). Payload JSON, snake_case.
export const fetchMotors = (params) => api.get('/motorcycles', { params }).then((r) => r.data);
export const fetchMotorSummary = () => api.get('/motorcycles/summary').then((r) => r.data.data);
export const fetchStockSummary = (params) => api.get('/motorcycles/stock-summary', { params }).then((r) => r.data.data);
export const fetchFilterOptions = () => api.get('/motorcycles/filters').then((r) => r.data.data);
export const fetchExportRows = (params) => api.get('/motorcycles/export', { params }).then((r) => r.data.data);

export const createMotor = (data) => api.post('/motorcycles', data);
export const updateMotor = (id, data) => api.put(`/motorcycles/${id}`, data);
export const deleteMotor = (id) => api.delete(`/motorcycles/${id}`);

/** dryRun=true: hanya validasi (termasuk cek duplikat di database), tidak menyimpan. */
export const importMotors = (rows, dryRun = false) =>
  api.post('/motorcycles/import', { rows, dryRun }).then((r) => r.data.data);

export const errorMessage = (err, fallback = 'Terjadi kesalahan. Silakan coba lagi.') =>
  err?.response?.data?.message || err?.message || fallback;
