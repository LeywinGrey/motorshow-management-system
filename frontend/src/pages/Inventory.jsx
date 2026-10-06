import React, { useEffect, useState } from 'react';
import { Plus, Search, Bike, Pencil, Trash2, ArrowUpDown } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import { Card, StatCard } from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Pagination from '../components/ui/Pagination';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const STATUS_OPTIONS = ['Tersedia', 'Dibooking', 'Test Drive', 'Terjual'];
const emptyForm = { brand: '', model: '', year: '', color: '', price: '', status: 'Tersedia', image: null };

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export default function Inventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [motors, setMotors] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [filters, setFilters] = useState({ search: '', brand: '', year: '', status: '', sortPrice: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState('');

  const loadSummary = () => api.get('/motorcycles/summary').then((res) => setSummary(res.data.data)).catch(() => {});

  const loadMotors = (page = 1) => {
    const params = { page, limit: 10 };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get('/motorcycles', { params }).then((res) => {
      setMotors(res.data.data);
      setPagination(res.data.pagination);
    }).catch(() => {});
  };

  useEffect(() => { loadSummary(); }, []);
  useEffect(() => { loadMotors(1); }, [filters]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(''); setModalOpen(true); };
  const openEdit = (m) => { setEditing(m); setForm({ ...m, image: null }); setError(''); setModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const fd = new FormData();
      ['brand', 'model', 'year', 'color', 'price', 'status'].forEach((k) => fd.append(k, form[k]));
      if (form.image) fd.append('image', form.image);

      if (editing) {
        await api.put(`/motorcycles/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/motorcycles', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setModalOpen(false);
      loadMotors(pagination.page);
      loadSummary();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan data motor.');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/motorcycles/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadMotors(pagination.page);
      loadSummary();
    } catch (err) {
      setDeleteTarget(null);
    }
  };

  return (
    <MainLayout title="Inventory Motor">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard icon={Bike} label="Total Motor" value={summary.total} />
          <StatCard icon={Bike} label="Tersedia" value={summary.tersedia} color="bg-emerald-50 text-emerald-600" />
          <StatCard icon={Bike} label="Dibooking" value={summary.dibooking} color="bg-amber-50 text-amber-600" />
          <StatCard icon={Bike} label="Test Drive" value={summary.test_drive} color="bg-blue-50 text-blue-600" />
          <StatCard icon={Bike} label="Terjual" value={summary.terjual} color="bg-slate-100 text-slate-600" />
        </div>
      )}

      <Card
        title="Daftar Motor"
        action={isAdmin && (
          <button onClick={openCreate} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm px-3 py-2 rounded-lg">
            <Plus size={16} /> Tambah Motor
          </button>
        )}
      >
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Cari merek atau tipe..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <select value={filters.brand} onChange={(e) => setFilters({ ...filters, brand: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-200 text-sm">
            <option value="">Semua Merek</option>
            {['Honda', 'Yamaha', 'Suzuki', 'Kawasaki', 'Vespa'].map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-200 text-sm">
            <option value="">Semua Status</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => setFilters({ ...filters, sortPrice: filters.sortPrice === 'asc' ? 'desc' : 'asc' })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600"
          >
            <ArrowUpDown size={14} /> Harga {filters.sortPrice === 'asc' ? '↑' : filters.sortPrice === 'desc' ? '↓' : ''}
          </button>
        </div>

        <DataTable
          columns={[
            { key: 'image', label: '', render: (m) => (
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                {m.image ? <img src={m.image} alt={m.model} className="w-full h-full object-cover" /> : <Bike size={18} className="text-slate-300" />}
              </div>
            )},
            { key: 'brand', label: 'Merek' },
            { key: 'model', label: 'Tipe/Model' },
            { key: 'year', label: 'Tahun' },
            { key: 'color', label: 'Warna' },
            { key: 'price', label: 'Harga', render: (m) => formatRupiah(m.price) },
            { key: 'status', label: 'Status', render: (m) => <Badge status={m.status} /> },
            ...(isAdmin ? [{ key: 'actions', label: '', render: (m) => (
              <div className="flex gap-2">
                <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil size={15} /></button>
                <button onClick={() => setDeleteTarget(m)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>
              </div>
            )}] : []),
          ]}
          data={motors}
        />
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={loadMotors} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Motor' : 'Tambah Motor'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="Merek" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            <input required placeholder="Tipe/Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            <input required type="number" placeholder="Tahun" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            <input required placeholder="Warna" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            <input required type="number" placeholder="Harga" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-200 text-sm">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-500">Foto Motor</label>
            <input type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files[0] })} className="w-full text-sm mt-1" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-medium">
            Simpan
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        message={`Hapus motor ${deleteTarget?.brand} ${deleteTarget?.model}? Tindakan ini tidak dapat dibatalkan.`}
      />
    </MainLayout>
  );
}
