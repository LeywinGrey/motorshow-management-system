import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, Eye } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import { Card } from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Pagination from '../components/ui/Pagination';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const STATUS_OPTIONS = ['Lead', 'Prospek', 'Test Drive', 'Follow Up', 'Negosiasi', 'Booking', 'Terjual', 'Tidak Jadi'];
const emptyForm = { name: '', phone: '', email: '', address: '', interested_motorcycle_id: '', assigned_sales_id: '', status: 'Lead' };

export default function Customers() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [customers, setCustomers] = useState([]);
  const [motors, setMotors] = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState('');

  const loadCustomers = (page = 1) => {
    const params = { page, limit: 10 };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get('/customers', { params }).then((res) => {
      setCustomers(res.data.data);
      setPagination(res.data.pagination);
    }).catch(() => {});
  };

  useEffect(() => {
    api.get('/motorcycles', { params: { limit: 100 } }).then((res) => setMotors(res.data.data)).catch(() => {});
    api.get('/users/sales').then((res) => setSalesList(res.data.data)).catch(() => {});
  }, []);
  useEffect(() => { loadCustomers(1); }, [filters]);

  const openCreate = () => { setForm(emptyForm); setError(''); setModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/customers', form);
      setModalOpen(false);
      loadCustomers(1);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan data pelanggan.');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/customers/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadCustomers(pagination.page);
    } catch (_) {
      setDeleteTarget(null);
    }
  };

  return (
    <MainLayout title="Data Pelanggan">
      <Card
        title="Daftar Pelanggan"
        action={(
          <button onClick={openCreate} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm px-3 py-2 rounded-lg">
            <Plus size={16} /> Tambah Pelanggan
          </button>
        )}
      >
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Cari nama, HP, atau email..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-200 text-sm">
            <option value="">Semua Status</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <DataTable
          columns={[
            { key: 'name', label: 'Nama' },
            { key: 'phone', label: 'No. HP' },
            { key: 'motor_brand', label: 'Motor Diminati', render: (c) => c.motor_brand ? `${c.motor_brand} ${c.motor_model}` : '-' },
            { key: 'sales_name', label: 'Sales', render: (c) => c.sales_name || '-' },
            { key: 'status', label: 'Status', render: (c) => <Badge status={c.status} /> },
            { key: 'actions', label: '', render: (c) => (
              <div className="flex gap-2">
                <Link to={`/customers/${c.id}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Eye size={15} /></Link>
                {isAdmin && <button onClick={() => setDeleteTarget(c)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>}
              </div>
            )},
          ]}
          data={customers}
        />
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={loadCustomers} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Pelanggan">
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          <input required placeholder="Nomor HP (08xxxxxxxxxx)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          <input type="email" placeholder="Email (opsional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          <textarea placeholder="Alamat" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" rows={2} />
          <select value={form.interested_motorcycle_id} onChange={(e) => setForm({ ...form, interested_motorcycle_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
            <option value="">Motor yang diminati (opsional)</option>
            {motors.map((m) => <option key={m.id} value={m.id}>{m.brand} {m.model}</option>)}
          </select>
          {isAdmin && (
            <select value={form.assigned_sales_id} onChange={(e) => setForm({ ...form, assigned_sales_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
              <option value="">Assign ke Sales (opsional)</option>
              {salesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-medium">Simpan</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        message={`Hapus data pelanggan ${deleteTarget?.name}? Tindakan ini tidak dapat dibatalkan.`}
      />
    </MainLayout>
  );
}
