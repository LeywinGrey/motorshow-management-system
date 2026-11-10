import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Bike, Pencil, Trash2, FileSpreadsheet, FileUp, Loader2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import { Card, StatCard } from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Pagination from '../components/ui/Pagination';
import ImportMotorModal from '../components/inventory/ImportMotorModal';
import { useAuth } from '../context/AuthContext';
import {
  STATUS_OPTIONS, listMotors, getSummary, getStockSummary, getFilterOptions,
  createMotor, updateMotor, deleteMotor, exportMotors, errorMessage, fmtDate,
} from '../services/motorService';

const emptyForm = {
  channel: '', channel_no: '', type_code: '', model: '', color_code: '', color: '', year: '',
  engine_number: '', frame_number: '', purchase_date: '', display_date: '', gesekan: '', supplier: '', status: 'Tersedia',
};
const emptyFilters = { search: '', channel: '', supplier: '', year: '', color: '', type_code: '', status: '' };
const inputCls = 'mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const selectCls = 'px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white max-w-[190px] focus:outline-none focus:ring-2 focus:ring-brand-500';

function Field({ label, error, children, required }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}{required && <span className="text-brand-600"> *</span>}</span>
      {children}
      {error && <span className="block text-[11px] text-brand-700 mt-1">{error}</span>}
    </label>
  );
}

export default function Inventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState(null);
  const [options, setOptions] = useState({ channels: [], suppliers: [], colors: [], type_codes: [], years: [], types: [], color_pairs: [] });
  const [stock, setStock] = useState({ total: 0, items: [] });
  const [showStock, setShowStock] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null); // { type: 'ok'|'err', text }

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const activeFilters = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')), [filters]);

  // Pencarian: tunggu 350 ms setelah berhenti mengetik
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput })), 350);
    return () => clearTimeout(t);
  }, [searchInput]);
  useEffect(() => { setPage(1); }, [filters, limit]);

  const loadSummary = useCallback(() => getSummary().then((r) => setSummary(r.data.data)).catch(() => {}), []);
  const loadOptions = useCallback(() => getFilterOptions().then((r) => setOptions(r.data.data)).catch(() => {}), []);
  const loadStock = useCallback(() => getStockSummary(activeFilters).then((r) => setStock(r.data.data)).catch(() => {}), [activeFilters]);
  const loadRows = useCallback(() => {
    setLoading(true);
    listMotors({ ...activeFilters, page, limit })
      .then((r) => { setRows(r.data.data); setPagination(r.data.pagination); })
      .catch((e) => setNotice({ type: 'err', text: errorMessage(e, 'Gagal memuat data.') }))
      .finally(() => setLoading(false));
  }, [activeFilters, page, limit]);

  useEffect(() => { loadSummary(); loadOptions(); }, [loadSummary, loadOptions]);
  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => { if (showStock) loadStock(); }, [showStock, loadStock]);

  const refreshAll = () => { loadRows(); loadSummary(); loadOptions(); if (showStock) loadStock(); };
  const setFilter = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });
  const resetFilters = () => { setFilters(emptyFilters); setSearchInput(''); };
  const hasFilters = Object.keys(activeFilters).length > 0;

  // ---------- Form tambah / edit ----------
  const openCreate = () => { setEditing(null); setForm(emptyForm); setFieldErrors({}); setFormError(''); setModalOpen(true); };
  const openEdit = (m) => {
    setEditing(m);
    setForm({
      channel: m.channel || '', channel_no: m.channel_no ?? '', type_code: m.type_code || '', model: m.model || '',
      color_code: m.color_code || '', color: m.color || '', year: m.year || '', engine_number: m.engine_number || '',
      frame_number: m.frame_number || '', purchase_date: m.purchase_date || '', display_date: m.display_date || '',
      gesekan: m.gesekan || '', supplier: m.supplier || '', status: m.status || 'Tersedia',
    });
    setFieldErrors({}); setFormError(''); setModalOpen(true);
  };
  const setF = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Isi otomatis pasangan nama/warna jika kode sudah dikenal (hanya bila kolom pasangannya masih kosong)
  const autoFillType = () => {
    const t = options.types.find((x) => x.type_code.toLowerCase() === form.type_code.trim().toLowerCase());
    if (t && !form.model) setForm((f) => ({ ...f, model: t.model }));
  };
  const autoFillColor = () => {
    const c = options.color_pairs.find((x) => x.color_code.toLowerCase() === form.color_code.trim().toLowerCase());
    if (c && !form.color) setForm((f) => ({ ...f, color: c.color }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(''); setFieldErrors({}); setSaving(true);
    const payload = { ...form };
    if (!editing) { delete payload.status; if (payload.channel_no === '') delete payload.channel_no; }
    try {
      if (editing) await updateMotor(editing.id, payload);
      else await createMotor(payload);
      setModalOpen(false);
      setNotice({ type: 'ok', text: editing ? 'Data motor berhasil diperbarui.' : 'Unit motor berhasil ditambahkan.' });
      refreshAll();
    } catch (err) {
      const list = err.response?.data?.errors;
      if (Array.isArray(list)) setFieldErrors(Object.fromEntries(list.map((x) => [x.field, x.message])));
      setFormError(list?.length ? 'Periksa kembali isian yang ditandai.' : errorMessage(err, 'Gagal menyimpan data motor.'));
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteMotor(target.id);
      setNotice({ type: 'ok', text: 'Unit motor berhasil dihapus.' });
      refreshAll();
    } catch (err) {
      setNotice({ type: 'err', text: errorMessage(err, 'Gagal menghapus unit.') });
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try { await exportMotors(activeFilters); }
    catch (err) { setNotice({ type: 'err', text: err.message }); }
    finally { setExporting(false); }
  };

  const dash = (v) => (v === null || v === undefined || v === '' ? <span className="text-slate-300">-</span> : v);

  const columns = [
    { key: 'channel', label: 'Channel', render: (m) => dash(m.channel) },
    { key: 'channel_no', label: 'No.', render: (m) => dash(m.channel_no) },
    { key: 'type_code', label: 'Tipe Motor', render: (m) => dash(m.type_code) },
    { key: 'model', label: 'Nama Tipe Motor', render: (m) => <span className="font-medium text-slate-800">{m.model}</span> },
    { key: 'color_code', label: 'Kode Warna', render: (m) => dash(m.color_code) },
    { key: 'color', label: 'Warna' },
    { key: 'year', label: 'Tahun' },
    { key: 'engine_number', label: 'Nomor Mesin', render: (m) => dash(m.engine_number) },
    { key: 'frame_number', label: 'Nomor Rangka', render: (m) => dash(m.frame_number) },
    { key: 'purchase_date', label: 'Tanggal Beli', render: (m) => fmtDate(m.purchase_date) },
    { key: 'display_date', label: 'Tanggal Display', render: (m) => fmtDate(m.display_date) },
    { key: 'gesekan', label: 'Gesekan', render: (m) => dash(m.gesekan) },
    { key: 'supplier', label: 'Supplier', render: (m) => dash(m.supplier) },
    { key: 'status', label: 'Status', render: (m) => <Badge status={m.status} /> },
    ...(isAdmin ? [{ key: 'actions', label: '', render: (m) => (
      <div className="flex gap-1">
        <button title="Edit" onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil size={15} /></button>
        <button title="Hapus" onClick={() => setDeleteTarget(m)} className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-600"><Trash2 size={15} /></button>
      </div>
    ) }] : []),
  ];

  // Ringkasan stok per tipe -> daftar warna
  const stockByType = useMemo(() => {
    const map = new Map();
    stock.items.forEach((i) => {
      const k = `${i.type_code || ''}|${i.model}`;
      if (!map.has(k)) map.set(k, { type_code: i.type_code, model: i.model, total: 0, tersedia: 0, colors: [] });
      const g = map.get(k);
      g.total += i.total; g.tersedia += i.tersedia;
      g.colors.push({ label: i.color, total: i.total });
    });
    return [...map.values()];
  }, [stock]);

  const from = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <MainLayout title="Inventory Motor">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard icon={Bike} label="Total Stok (Unit)" value={summary.total} />
          <StatCard icon={Bike} label="Tersedia" value={summary.tersedia} color="bg-emerald-50 text-emerald-600" />
          <StatCard icon={Bike} label="Dibooking" value={summary.dibooking} color="bg-amber-50 text-amber-600" />
          <StatCard icon={Bike} label="Test Drive" value={summary.test_drive} color="bg-teal-50 text-teal-600" />
          <StatCard icon={Bike} label="Terjual" value={summary.terjual} color="bg-slate-100 text-slate-600" />
        </div>
      )}

      {notice && (
        <div className={`mb-4 text-sm px-3 py-2 rounded-lg flex justify-between gap-3 ${notice.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-700'}`}>
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="text-xs underline shrink-0">Tutup</button>
        </div>
      )}

      <Card
        className="mb-6"
        title="Stok per Tipe Motor & Warna"
        action={(
          <button onClick={() => setShowStock(!showStock)} className="flex items-center gap-1 text-sm text-brand-600 hover:underline">
            {showStock ? <>Sembunyikan <ChevronUp size={16} /></> : <>Tampilkan <ChevronDown size={16} /></>}
          </button>
        )}
      >
        {!showStock ? (
          <p className="text-xs text-slate-400">Rincian jumlah unit per tipe dan warna{hasFilters ? ' (sesuai filter aktif)' : ''}.</p>
        ) : (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 border-b border-slate-100 sticky top-0 bg-white">
                <tr><th className="py-2 px-3 font-medium">Nama Tipe Motor</th><th className="py-2 px-3 font-medium">Tipe</th><th className="py-2 px-3 font-medium">Total</th><th className="py-2 px-3 font-medium">Tersedia</th><th className="py-2 px-3 font-medium">Warna</th></tr>
              </thead>
              <tbody>
                {stockByType.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-slate-400">Tidak ada data.</td></tr>}
                {stockByType.map((g) => (
                  <tr key={`${g.type_code}|${g.model}`} className="border-b border-slate-50 align-top">
                    <td className="py-2 px-3 font-medium text-slate-800">{g.model}</td>
                    <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{g.type_code || '-'}</td>
                    <td className="py-2 px-3 font-semibold">{g.total}</td>
                    <td className="py-2 px-3 text-emerald-700">{g.tersedia}</td>
                    <td className="py-2 px-3"><div className="flex flex-wrap gap-1">{g.colors.map((c) => (
                      <span key={c.label} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{c.label}: <b>{c.total}</b></span>
                    ))}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Daftar Unit Motor"
        action={(
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <button onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm px-3 py-2 rounded-lg">
                <FileUp size={16} /> Import Excel
              </button>
            )}
            {isAdmin && (
              <button onClick={handleExport} disabled={exporting} className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm px-3 py-2 rounded-lg disabled:opacity-60">
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} Export Excel
              </button>
            )}
            {isAdmin && (
              <button onClick={openCreate} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm px-3 py-2 rounded-lg">
                <Plus size={16} /> Tambah Motor
              </button>
            )}
          </div>
        )}
      >
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Cari Nomor Mesin, Nomor Rangka, Tipe, Nama Tipe, Channel..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <select value={filters.channel} onChange={setFilter('channel')} className={selectCls}><option value="">Semua Channel</option>{options.channels.map((v) => <option key={v} value={v}>{v}</option>)}</select>
          <select value={filters.supplier} onChange={setFilter('supplier')} className={selectCls}><option value="">Semua Supplier</option>{options.suppliers.map((v) => <option key={v} value={v}>{v}</option>)}</select>
          <select value={filters.type_code} onChange={setFilter('type_code')} className={selectCls}><option value="">Semua Tipe Motor</option>{options.type_codes.map((v) => <option key={v} value={v}>{v}</option>)}</select>
          <select value={filters.color} onChange={setFilter('color')} className={selectCls}><option value="">Semua Warna</option>{options.colors.map((v) => <option key={v} value={v}>{v}</option>)}</select>
          <select value={filters.year} onChange={setFilter('year')} className={selectCls}><option value="">Semua Tahun</option>{options.years.map((v) => <option key={v} value={v}>{v}</option>)}</select>
          <select value={filters.status} onChange={setFilter('status')} className={selectCls}><option value="">Semua Status</option>{STATUS_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}</select>
          {hasFilters && (
            <button onClick={resetFilters} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"><RotateCcw size={14} /> Reset</button>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
          <span>{loading ? 'Memuat...' : `Menampilkan ${from}-${to} dari ${pagination.total} unit`}</span>
          <label className="flex items-center gap-2">Baris per halaman
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white">
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>

        <div className={loading ? 'opacity-60 transition-opacity' : ''}>
          <DataTable columns={columns} data={rows} emptyMessage="Tidak ada unit motor yang cocok." />
        </div>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={setPage} />
      </Card>

      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editing ? 'Edit Unit Motor' : 'Tambah Unit Motor'} maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-3">
          <datalist id="dl-channels">{options.channels.map((v) => <option key={v} value={v} />)}</datalist>
          <datalist id="dl-suppliers">{options.suppliers.map((v) => <option key={v} value={v} />)}</datalist>
          <datalist id="dl-types">{options.types.map((t) => <option key={t.type_code} value={t.type_code}>{t.model}</option>)}</datalist>
          <datalist id="dl-colors">{options.color_pairs.map((c) => <option key={c.color_code} value={c.color_code}>{c.color}</option>)}</datalist>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Field label="Channel" required error={fieldErrors.channel}>
                <input list="dl-channels" value={form.channel} onChange={setF('channel')} className={inputCls} placeholder="Contoh: MANCUNG MOTOR" />
              </Field>
            </div>
            <Field label="No." error={fieldErrors.channel_no}>
              <input type="number" min="1" value={form.channel_no} onChange={setF('channel_no')} className={inputCls} placeholder={editing ? '' : 'Otomatis'} />
            </Field>
            <Field label="Tipe Motor" required error={fieldErrors.type_code}>
              <input list="dl-types" value={form.type_code} onChange={setF('type_code')} onBlur={autoFillType} className={inputCls} placeholder="H1B2N2A5" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Nama Tipe Motor" required error={fieldErrors.model}>
                <input value={form.model} onChange={setF('model')} className={inputCls} placeholder="D. NEW BEAT SPORTY CBS ISS ACC" />
              </Field>
            </div>
            <Field label="Kode Warna" required error={fieldErrors.color_code}>
              <input list="dl-colors" value={form.color_code} onChange={setF('color_code')} onBlur={autoFillColor} className={inputCls} placeholder="BK" />
            </Field>
            <Field label="Warna" required error={fieldErrors.color}>
              <input value={form.color} onChange={setF('color')} className={inputCls} placeholder="HITAM" />
            </Field>
            <Field label="Tahun" required error={fieldErrors.year}>
              <input type="number" min="1990" value={form.year} onChange={setF('year')} className={inputCls} placeholder="2026" />
            </Field>
            <div className="sm:col-span-1">
              <Field label="Nomor Mesin" required error={fieldErrors.engine_number}>
                <input value={form.engine_number} onChange={setF('engine_number')} className={inputCls} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Nomor Rangka" required error={fieldErrors.frame_number}>
                <input value={form.frame_number} onChange={setF('frame_number')} className={inputCls} />
              </Field>
            </div>
            <Field label="Tanggal Beli" required error={fieldErrors.purchase_date}>
              <input type="date" value={form.purchase_date} onChange={setF('purchase_date')} className={inputCls} />
            </Field>
            <Field label="Tanggal Display" error={fieldErrors.display_date}>
              <input type="date" value={form.display_date} onChange={setF('display_date')} className={inputCls} />
            </Field>
            <Field label="Gesekan" error={fieldErrors.gesekan}>
              <input value={form.gesekan} onChange={setF('gesekan')} className={inputCls} placeholder="Opsional" />
            </Field>
            <div className={editing ? 'sm:col-span-2' : 'sm:col-span-3'}>
              <Field label="Supplier" required error={fieldErrors.supplier}>
                <input list="dl-suppliers" value={form.supplier} onChange={setF('supplier')} className={inputCls} placeholder="PT. WAHANA MAKMUR SEJATI" />
              </Field>
            </div>
            {editing && (
              <Field label="Status" error={fieldErrors.status}>
                <select value={form.status} onChange={setF('status')} className={inputCls}>{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              </Field>
            )}
          </div>

          {formError && <p className="text-sm text-brand-700 bg-brand-50 px-3 py-2 rounded-lg">{formError}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Batal</button>
            <button type="submit" disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-60">
              {saving && <Loader2 size={16} className="animate-spin" />} Simpan
            </button>
          </div>
        </form>
      </Modal>

      {isAdmin && <ImportMotorModal open={importOpen} onClose={() => setImportOpen(false)} onImported={refreshAll} />}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        message={deleteTarget ? `Hapus unit ${deleteTarget.model}${deleteTarget.engine_number ? ` (${deleteTarget.engine_number})` : ''}? Unit yang sudah terhubung ke booking/pelanggan tidak dapat dihapus.` : ''}
      />
    </MainLayout>
  );
}
