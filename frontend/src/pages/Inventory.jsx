import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Bike, Pencil, Trash2, ArrowUpDown, FileSpreadsheet, FileUp, Loader2 } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import { Card, StatCard } from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Pagination from '../components/ui/Pagination';
import ImportMotorModal from '../components/inventory/ImportMotorModal';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { createUnit, updateUnit, deleteUnit, runInBatches, errorMessage } from '../services/motorService';
import { exportToExcel } from '../utils/exportExcel';
import { groupMotors } from '../utils/motorGroups';

const STATUS_OPTIONS = ['Tersedia', 'Dibooking', 'Test Drive', 'Terjual'];
const PAGE_SIZE = 10;
const MAX_QTY = 50;
const emptyForm = { model: '', year: '', color: '', price: '', qty: 1, addQty: 0, status: 'Tersedia', image: null };

const inputCls = 'mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export default function Inventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [motors, setMotors] = useState([]);           // semua unit (1 baris = 1 unit di database)
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: '', status: '', sortPrice: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState(null);       // grup motor yang sedang diedit
  const [form, setForm] = useState(emptyForm);
  const [unitStatuses, setUnitStatuses] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null); // { units, message, closeModal? }
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Unit yang identik (tipe, tahun, warna, harga) digabung jadi 1 baris dengan Qty
  // Filter status dilakukan SETELAH pengelompokan agar edit/hapus selalu mengenai semua unit di grup
  const groups = useMemo(() => {
    const all = groupMotors(motors);
    return filters.status ? all.filter((g) => g.statusCounts.some((s) => s.status === filters.status)) : all;
  }, [motors, filters.status]);
  const unitCount = groups.reduce((sum, g) => sum + g.qty, 0);
  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageGroups = groups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const loadSummary = () => api.get('/motorcycles/summary').then((res) => setSummary(res.data.data)).catch(() => {});

  // Ambil semua unit sesuai filter, lalu dikelompokkan & dipaginasi di sisi tampilan
  const loadMotors = () => {
    const params = { page: 1, limit: 1000 };
    if (filters.search) params.search = filters.search;
    if (filters.sortPrice) params.sortPrice = filters.sortPrice;
    api.get('/motorcycles', { params }).then((res) => setMotors(res.data.data)).catch(() => {});
  };

  const refresh = () => { loadMotors(); loadSummary(); };

  useEffect(() => { loadSummary(); }, []);
  useEffect(() => { loadMotors(); }, [filters.search, filters.sortPrice]);
  useEffect(() => { setPage(1); }, [filters]);

  // Export Excel: satu baris per (tipe + status) dengan kolom Qty, sama formatnya dengan template import
  const handleExportExcel = () => {
    const rows = groups.flatMap((g) => g.statusCounts.map((s) => ({
      Tipe: g.model,
      Tahun: g.year,
      Warna: g.color,
      'Harga (Rp)': Number(g.price),
      Qty: s.count,
      Status: s.status,
    })));
    exportToExcel(rows, 'inventory-motor', 'Inventory Motor');
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(''); setModalOpen(true); };
  const openEdit = (g) => {
    setEditing(g);
    setForm({ ...emptyForm, model: g.model, year: g.year, color: g.color, price: Math.round(Number(g.price)) });
    setUnitStatuses(Object.fromEntries(g.units.map((u) => [u.id, u.status])));
    setError('');
    setModalOpen(true);
  };

  // Jalankan sekumpulan operasi; jika ada yang gagal, lempar error ringkas
  const runOps = async (ops) => {
    const results = await runInBatches(ops, (op) => op());
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      throw new Error(`${failed.length} dari ${ops.length} operasi gagal: ${errorMessage(failed[0].reason, 'Gagal menyimpan data motor.')}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const shared = { model: form.model.trim(), year: form.year, color: form.color.trim(), price: form.price };
      const ops = [];

      if (!editing) {
        // Tambah: Qty N => N unit dengan data yang sama
        const qty = Math.max(1, Math.min(MAX_QTY, Number(form.qty) || 1));
        for (let i = 0; i < qty; i += 1) ops.push(() => createUnit({ ...shared, status: form.status, image: form.image }));
      } else {
        // Edit: data bersama (tipe/tahun/warna/harga/foto) berlaku untuk semua unit di grup,
        // status diatur per unit, dan "Tambah unit" menambah stok baru.
        const sharedChanged = shared.model !== editing.model
          || String(shared.year) !== String(editing.year)
          || shared.color !== editing.color
          || Number(shared.price) !== Number(editing.price)
          || !!form.image;

        editing.units.forEach((u) => {
          const payload = {};
          if (sharedChanged) Object.assign(payload, shared, { image: form.image });
          if (unitStatuses[u.id] && unitStatuses[u.id] !== u.status) payload.status = unitStatuses[u.id];
          if (Object.keys(payload).length > 0) ops.push(() => updateUnit(u.id, payload));
        });

        const add = Math.max(0, Math.min(MAX_QTY, Number(form.addQty) || 0));
        for (let i = 0; i < add; i += 1) ops.push(() => createUnit({ ...shared, status: 'Tersedia', image: form.image }));
      }

      if (ops.length > 0) await runOps(ops);
      setModalOpen(false);
      refresh();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan data motor.');
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const target = deleteTarget;
    try {
      await runInBatches(target.units, (u) => deleteUnit(u.id));
    } finally {
      setDeleteTarget(null);
      if (target.closeModal) setModalOpen(false);
      refresh();
    }
  };

  const askDeleteGroup = (g) => setDeleteTarget({
    units: g.units,
    message: `Hapus ${g.model} (${g.qty} unit)? Data booking test drive yang terkait juga ikut terhapus. Tindakan ini tidak dapat dibatalkan.`,
  });

  return (
    <MainLayout title="Inventory Motor">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard icon={Bike} label="Total Unit" value={summary.total} />
          <StatCard icon={Bike} label="Tersedia" value={summary.tersedia} color="bg-emerald-50 text-emerald-600" />
          <StatCard icon={Bike} label="Dibooking" value={summary.dibooking} color="bg-amber-50 text-amber-600" />
          <StatCard icon={Bike} label="Test Drive" value={summary.test_drive} color="bg-teal-50 text-teal-600" />
          <StatCard icon={Bike} label="Terjual" value={summary.terjual} color="bg-slate-100 text-slate-600" />
        </div>
      )}

      <Card
        title="Daftar Motor"
        action={(
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm px-3 py-2 rounded-lg"
              >
                <FileUp size={16} /> Import Excel
              </button>
            )}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm px-3 py-2 rounded-lg"
            >
              <FileSpreadsheet size={16} /> Export Excel
            </button>
            {isAdmin && (
              <button onClick={openCreate} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm px-3 py-2 rounded-lg">
                <Plus size={16} /> Tambah Motor
              </button>
            )}
          </div>
        )}
      >
        <div className="flex flex-wrap gap-3 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Cari tipe motor..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
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
        <p className="text-xs text-slate-400 mb-3">{groups.length} tipe • {unitCount} unit</p>

        <DataTable
          columns={[
            { key: 'image', label: '', render: (g) => (
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                {g.image ? <img src={g.image} alt={g.model} className="w-full h-full object-cover" /> : <Bike size={18} className="text-slate-300" />}
              </div>
            )},
            { key: 'model', label: 'Tipe', render: (g) => <span className="font-medium text-slate-800">{g.model}</span> },
            { key: 'year', label: 'Tahun' },
            { key: 'color', label: 'Warna' },
            { key: 'price', label: 'Harga', render: (g) => formatRupiah(g.price) },
            { key: 'qty', label: 'Qty', render: (g) => (
              <span className="inline-flex min-w-[2rem] justify-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">{g.qty}</span>
            )},
            { key: 'status', label: 'Status', render: (g) => (
              <div className="flex flex-wrap gap-1">
                {g.statusCounts.map((s) => (
                  <Badge key={s.status} status={s.status}>{g.qty > 1 ? `${s.count} ${s.status}` : s.status}</Badge>
                ))}
              </div>
            )},
            ...(isAdmin ? [{ key: 'actions', label: '', render: (g) => (
              <div className="flex gap-2">
                <button onClick={() => openEdit(g)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil size={15} /></button>
                <button onClick={() => askDeleteGroup(g)} className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-600"><Trash2 size={15} /></button>
              </div>
            )}] : []),
          ]}
          data={pageGroups}
        />
        <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
      </Card>

      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editing ? `Edit ${editing.model}` : 'Tambah Motor'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Tipe" hint={!editing ? 'Contoh: Beat, Scoopy, Vario 160' : undefined}>
            <input required placeholder="Tipe motor" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tahun">
              <input required type="number" min="1990" placeholder="2025" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Warna">
              <input required placeholder="Hitam" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Harga (Rp)">
              <input required type="number" min="1" placeholder="19500000" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputCls} />
            </Field>
            {!editing ? (
              <Field label="Qty (jumlah unit)">
                <input required type="number" min="1" max={MAX_QTY} value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className={inputCls} />
              </Field>
            ) : (
              <Field label="Tambah unit baru">
                <input type="number" min="0" max={MAX_QTY} value={form.addQty} onChange={(e) => setForm({ ...form, addQty: e.target.value })} className={inputCls} />
              </Field>
            )}
          </div>

          {!editing && (
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          )}

          {editing && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Status per unit ({editing.units.length} unit)</p>
              <div className="border border-slate-100 rounded-lg divide-y divide-slate-50 max-h-48 overflow-y-auto">
                {editing.units.map((u, i) => (
                  <div key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="text-slate-600 shrink-0">Unit {i + 1}</span>
                    <span className="text-[11px] text-slate-300 shrink-0">#{u.id}</span>
                    <select
                      value={unitStatuses[u.id] || u.status}
                      onChange={(e) => setUnitStatuses({ ...unitStatuses, [u.id]: e.target.value })}
                      className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button
                      type="button"
                      disabled={editing.units.length === 1}
                      title={editing.units.length === 1 ? 'Unit terakhir: hapus lewat daftar motor' : 'Hapus unit ini'}
                      onClick={() => setDeleteTarget({
                        units: [u],
                        closeModal: true,
                        message: `Hapus Unit ${i + 1} (${editing.model})? Data booking test drive unit ini juga ikut terhapus.`,
                      })}
                      className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-600 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Tipe, tahun, warna, harga, dan foto berlaku untuk semua unit di atas.</p>
            </div>
          )}

          <Field label="Foto Motor (opsional)">
            <input type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files[0] })} className="w-full text-sm mt-1" />
          </Field>

          {error && <p className="text-sm text-brand-700 bg-brand-50 px-3 py-2 rounded-lg">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving && <Loader2 size={16} className="animate-spin" />} Simpan
          </button>
        </form>
      </Modal>

      {isAdmin && (
        <ImportMotorModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={refresh}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        message={deleteTarget?.message}
      />
    </MainLayout>
  );
}
