import api from './api';

// Showroom khusus Honda: kolom `brand` di database wajib diisi (NOT NULL),
// jadi dikirim otomatis dan tidak ditampilkan di form Inventory.
export const DEFAULT_BRAND = 'Honda';

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

function toFormData(obj) {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') fd.append(k, v);
  });
  return fd;
}

// Satu pemanggilan = satu unit motor (satu baris di tabel motorcycles)
export const createUnit = (data) => api.post('/motorcycles', toFormData({ brand: DEFAULT_BRAND, ...data }), MULTIPART);
export const updateUnit = (id, data) => api.put(`/motorcycles/${id}`, toFormData(data), MULTIPART);
export const deleteUnit = (id) => api.delete(`/motorcycles/${id}`);

/** Jalankan worker(item) per batch (default 5 sekaligus). Return array hasil Promise.allSettled. */
export async function runInBatches(items, worker, onProgress, size = 5) {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    const settled = await Promise.allSettled(items.slice(i, i + size).map(worker));
    results.push(...settled);
    if (onProgress) onProgress(Math.min(i + size, items.length));
  }
  return results;
}

export const errorMessage = (reason, fallback = 'Gagal menyimpan ke server.') =>
  reason?.response?.data?.message || fallback;
