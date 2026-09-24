import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import { Card } from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import api from '../services/api';

const emptyForm = { name: '', email: '', password: '', role: 'sales', phone: '' };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadUsers = () => api.get('/users').then((res) => setUsers(res.data.data)).catch(() => {});
  useEffect(() => { loadUsers(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(''); setModalOpen(true); };
  const openEdit = (u) => { setEditing(u); setForm({ ...u, password: '' }); setError(''); setModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.put(`/users/${editing.id}`, payload);
      } else {
        await api.post('/users', form);
      }
      setModalOpen(false);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan data pengguna.');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadUsers();
    } catch (err) {
      setDeleteTarget(null);
    }
  };

  return (
    <MainLayout title="Manajemen Pengguna">
      <Card
        title="Daftar Admin & Sales"
        action={(
          <button onClick={openCreate} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm px-3 py-2 rounded-lg">
            <Plus size={16} /> Tambah Pengguna
          </button>
        )}
      >
        <DataTable
          columns={[
            { key: 'name', label: 'Nama' },
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Role', render: (u) => <span className="capitalize">{u.role}</span> },
            { key: 'phone', label: 'No. HP', render: (u) => u.phone || '-' },
            { key: 'is_active', label: 'Status', render: (u) => <Badge status={u.is_active ? 'Tersedia' : 'Terjual'}>{u.is_active ? 'Aktif' : 'Nonaktif'}</Badge> },
            { key: 'actions', label: '', render: (u) => (
              <div className="flex gap-2">
                <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil size={15} /></button>
                <button onClick={() => setDeleteTarget(u)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>
              </div>
            )},
          ]}
          data={users}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Pengguna' : 'Tambah Pengguna'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          <input placeholder="No. HP" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          <input
            type="password"
            placeholder={editing ? 'Password baru (kosongkan jika tidak diubah)' : 'Password'}
            required={!editing}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
            <option value="sales">Sales</option>
            <option value="admin">Admin</option>
          </select>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-medium">Simpan</button>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} message={`Hapus pengguna ${deleteTarget?.name}?`} />
    </MainLayout>
  );
}
