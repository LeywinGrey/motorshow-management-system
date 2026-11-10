import api from './api';

// Semua pemanggilan API modul Inventory (1 baris = 1 unit motor).
export const STATUS_OPTIONS = ['Tersedia', 'Dibooking', 'Test Drive', 'Terjual'];

// Buang filter kosong agar query string bersih
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined));

export const listMotors = (params) => api.get('/motorcycles', { params: clean(params) });
export const getSummary = () => api.get('/motorcycles/summary');
export const getStockSummary = (params) => api.get('/motorcycles/stock-summary', { params: clean(params) });
export const getFilterOptions = () => api.get('/motorcycles/filter-options');
export const createMotor = (data) => api.post('/motorcycles', data);
export const updateMotor = (id, data) => api.put(`/motorcycles/${id}`, data);
export const deleteMotor = (id) => api.delete(`/motorcycles/${id}`);

export const importMotors = (file, dryRun) => {
  const fd = new FormData();
  fd.append('file', file);
  if (dryRun) fd.append('dry_run', 'true');
  return api.post('/motorcycles/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};

// Unduh file (blob) dari endpoint admin
async function downloadBlob(url, params, fallbackName) {
  try {
    const res = await api.get(url, { params: clean(params || {}), responseType: 'blob' });
    const blobUrl = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    // Error dari server datang sebagai blob JSON -> baca pesannya
    let msg = 'Gagal mengunduh file.';
    try { msg = JSON.parse(await err.response.data.text()).message || msg; } catch { /* abaikan */ }
    throw new Error(msg);
  }
}

export const exportMotors = (filters) => downloadBlob('/motorcycles/export', filters, `STOK UNIT MM ${new Date().toISOString().slice(0, 10)}.xlsx`);
export const downloadImportTemplate = () => downloadBlob('/motorcycles/import-template', {}, 'template-stok-unit.xlsx');

export const errorMessage = (err, fallback = 'Terjadi kesalahan.') => err?.response?.data?.message || err?.message || fallback;

// 'YYYY-MM-DD' -> 'DD/MM/YYYY' (format yang sama dengan template Excel)
export const fmtDate = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '-';
};
