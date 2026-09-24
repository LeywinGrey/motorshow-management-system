import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Phone, MessageCircle, Users2, Bike, RefreshCw, Handshake, Pencil, Trash2 } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import { Card } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import api from '../services/api';

const ACTIVITY_TYPES = ['Telepon', 'WhatsApp', 'Bertemu Langsung', 'Test Drive', 'Follow Up', 'Negosiasi'];
const ACTIVITY_ICONS = {
  Telepon: Phone, WhatsApp: MessageCircle, 'Bertemu Langsung': Users2,
  'Test Drive': Bike, 'Follow Up': RefreshCw, Negosiasi: Handshake,
};

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [activities, setActivities] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ activity_type: 'Telepon', activity_date: '', notes: '' });
  const [error, setError] = useState('');

  const loadCustomer = () => api.get(`/customers/${id}`).then((res) => setCustomer(res.data.data)).catch(() => {});
  const loadActivities = () => {
    const params = {};
    if (filterType) params.activity_type = filterType;
    api.get(`/customers/${id}/activities`, { params }).then((res) => setActivities(res.data.data)).catch(() => {});
  };

  useEffect(() => { loadCustomer(); }, [id]);
  useEffect(() => { loadActivities(); }, [id, filterType]);

  const openCreate = () => {
    setEditingActivity(null);
    setForm({ activity_type: 'Telepon', activity_date: new Date().toISOString().slice(0, 16), notes: '' });
    setError('');
    setModalOpen(true);
  };
  const openEdit = (a) => {
    setEditingActivity(a);
    setForm({ activity_type: a.activity_type, activity_date: a.activity_date?.slice(0, 16), notes: a.notes || '' });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingActivity) {
        await api.put(`/activities/${editingActivity.id}`, form);
      } else {
        await api.post(`/customers/${id}/activities`, form);
      }
      setModalOpen(false);
      loadActivities();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan aktivitas.');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/activities/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadActivities();
    } catch (_) {
      setDeleteTarget(null);
    }
  };

  if (!customer) {
    return <MainLayout title="Detail Pelanggan"><p className="text-slate-400">Memuat data...</p></MainLayout>;
  }

  return (
    <MainLayout title="Detail Pelanggan & CRM">
      <Link to="/customers" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={16} /> Kembali ke Data Pelanggan
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Informasi Pelanggan" className="lg:col-span-1 h-fit">
          <div className="space-y-2 text-sm">
            <p><span className="text-slate-400">Nama:</span> <span className="font-medium">{customer.name}</span></p>
            <p><span className="text-slate-400">No. HP:</span> {customer.phone}</p>
            <p><span className="text-slate-400">Email:</span> {customer.email || '-'}</p>
            <p><span className="text-slate-400">Alamat:</span> {customer.address || '-'}</p>
            <p><span className="text-slate-400">Motor Diminati:</span> {customer.motor_brand ? `${customer.motor_brand} ${customer.motor_model}` : '-'}</p>
            <p><span className="text-slate-400">Sales:</span> {customer.sales_name || '-'}</p>
            <p><span className="text-slate-400">Status:</span> <Badge status={customer.status} /></p>
          </div>
        </Card>

        <Card
          title="Riwayat Aktivitas (Timeline)"
          className="lg:col-span-2"
          action={(
            <div className="flex gap-2">
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs">
                <option value="">Semua Jenis</option>
                {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={openCreate} className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white text-xs px-3 py-1.5 rounded-lg">
                <Plus size={14} /> Aktivitas
              </button>
            </div>
          )}
        >
          <div className="relative pl-6">
            <div className="absolute left-[9px] top-1 bottom-1 w-0.5 bg-slate-100" />
            {activities.length === 0 && <p className="text-slate-400 text-sm">Belum ada aktivitas tercatat.</p>}
            {activities.map((a) => {
              const Icon = ACTIVITY_ICONS[a.activity_type] || Phone;
              return (
                <div key={a.id} className="relative mb-5 last:mb-0">
                  <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center">
                    <Icon size={12} className="text-brand-600" />
                  </div>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{a.activity_type}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(a.activity_date).toLocaleString('id-ID')} • oleh {a.sales_name}
                      </p>
                      {a.notes && <p className="text-sm text-slate-600 mt-1">{a.notes}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(a)} className="p-1 rounded hover:bg-slate-100 text-slate-400"><Pencil size={13} /></button>
                      <button onClick={() => setDeleteTarget(a)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingActivity ? 'Edit Aktivitas' : 'Tambah Aktivitas'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <select value={form.activity_type} onChange={(e) => setForm({ ...form, activity_type: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
            {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="datetime-local" value={form.activity_date} onChange={(e) => setForm({ ...form, activity_date: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          <textarea placeholder="Catatan" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-medium">Simpan</button>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} message="Hapus aktivitas ini?" />
    </MainLayout>
  );
}
