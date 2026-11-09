import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, Bike, Pencil, Trash2, FileSpreadsheet, FileUp, RotateCcw, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import { Card, StatCard } from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Pagination from '../components/ui/Pagination';
import ImportMotorModal from '../components/inventory/ImportMotorModal';
import MotorFormModal from '../components/inventory/MotorFormModal';
import { useAuth } from '../context/AuthContext';
import {
  fetchMotors, fetchMotorSummary, fetchStockSummary, fetchFilterOptions, fetchExportRows,
  createMotor, updateMotor, deleteMotor, errorMessage,
} from '../services/motorService';
import { exportInventoryToExcel, formatDateID } from '../utils/inventoryExcel';

const STATUS_OPTIONS = ['Tersedia', 'Dibooking', 'Test Drive', 'Terjual'];
const PAGE_SIZES = [25, 50, 100];
const EMPTY_FILTERS = { search: '', channel: '', type_code: '', color: '', year: '', supplier: '', status: '' };
const selectCls = 'px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white max-w-[200px] focus:outline-none focus:ring-2 focus:ring-brand-500';

export default function Inventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [motors, setMotors] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [summary, setSummary] = useState(null);
  const [options, setOptions] = useState({ channels: [], types: [], colors: [], years: [], suppliers: [] });
  const [stock, setStock] = useState([]);
  const [stockOpen, setStockOpen] = useState(false);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Filter yang dikirim ke API (kosong dibuang) - dipakai bersama oleh list, ringkasan stok, dan export
  const activeParams = useMemo(
    () => Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
    [filters]
  );
  const hasFilters = Object.keys(activeParams).length > 0;

  // Debounce pencarian supaya tidak menembak API di setiap ketikan
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === searchInput.trim() ? f : { ...f, search: searchInput.trim() })), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [filters, pageSize]);

  const loadMotors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMotors({ ...activeParams, page, limit: pageSize });
      setMotors(res.data);
      setPagination(res.pagination);
      setPageError('');
    } catch (err) {
      setPageError(errorMessage(err, 'Gagal memuat data inventory.'));
    } finally {
      setLoading(false);
    }
  }, [activeParams, page, pageSize]);

  const loadStock = useCallback(() => {
    fetchStockSummary(activeParams).then(setStock).catch(() => {});
  }, [activeParams]);

  const loadSummary = () => fetchMotorSummary().then(setSummary).catch(() => {});
  const loadOptions = () => fetchFilterOptions().then(setOptions).catch(() => {});

  useEffect(() => { loadSummary(); loadOptions(); }, []);
  useEffect(() => { loadMotors(); }, [loadMotors]);
  useEffect(() => { if (stockOpen) loadStock(); }, [stockOpen, loadStock]);

  const refreshAll = () => { loadMotors(); loadSummary(); loadOptions(); if (stockOpen) loadStock(); };

  const setFilter = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });
  const resetFilters = () => { setSearchInput(''); setFilters(EMPTY_FILTERS); };

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (m) => { setEditing(m); setFormOpen(true); };

  const handleSubmit = async (form) => {
    if (editing) await updateMotor(editing.id, form);
    else await createMotor(form);
    setFormOpen(false);
    refreshAll();
  };

  const handleDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteMotor(target.id);
      refreshAll();
    } catch (err) {
      setPageError(errorMessage(err, 'Gagal menghapus unit.'));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await fetchExportRows(activeParams); // sesuai filter yang sedang aktif
      if (rows.length === 0) { alert('Tidak ada data untuk diexport.'); return; }
      exportInventoryToExcel(rows);
    } catch (err) {
      setPageError(errorMessage(err, 'Gagal export Excel.'));
    } finally {
      setExporting(false);
    }
  };

  const from = pagination.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, pagination.total);

  const columns = [
    { key: 'channel', label: 'Channel', render: (m) => <span className="font-medium text-slate-800">{m.channel || '-'}</span> },
    { key: 'channel_no', label: 'No.', render: (m) => m.channel_no ?? '-' },
    { key: 'type_code', label: 'Tipe Motor', render: (m) => m.type_code || '-' },
    { key: 'model', label: 'Nama Tipe Motor' },
    { key: 'color_code', label: 'Kode Warna', render: (m) => m.color_code || '-' },
    { key: 'color', label: 'Warna' },
    { key: 'year', label: 'Tahun' },
    { key: 'engine_number', label: 'Nomor Mesin', render: (m) => <span className="font-mono text-xs">{m.engine_number || '-'}</span> },
    { key: 'chassis_number', label: 'Nomor Rangka', render: (m) => <span className="font-mono text-xs">{m.chassis_number || '-'}</span> },
    { key: 'purchase_date', label: 'Tanggal Beli', render: (m) => formatDateID(m.purchase_date) || '-' },
    { key: 'display_date', label: 'Tanggal Display', render: (m) => formatDateID(m.display_date) || '-' },
    { key: 'friction', label: 'Gesekan', render: (m) => m.friction || '-' },
    { key: 'supplier', label: 'Supplier', render: (m) => m.supplier || '-' },
    { key: 'status', label: 'Status', render: (m) => <Badge status={m.status} /> },
    ...(isAdmin ? [{ key: 'actions', label: '', render: (m) => (
      <div className="flex gap-1">
        <button title="Edit" onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil size={15} /></button>
        <button title="Hapus" onClick={() => setDeleteTarget(m)} className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-600"><Trash2 size={15} /></button>
      </div>
    )}] : []),
  ];

  return (
    <MainLayout title="Inventory Motor">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard icon={Bike} label="Total Stok" value={summary.total} />
          <StatCard icon={Bike} label="Tersedia" value={summary.tersedia} color="bg-emerald-50 text-emerald-600" />
          <StatCard icon={Bike} label="Dibooking" value={summary.dibooking} color="bg-amber-50 text-amber-600" />
          <StatCard icon={Bike} label="Test Drive" value={summary.test_drive} color="bg-teal-50 text-teal-600" />
          <StatCard icon={Bike} label="Terjual" value={summary.terjual} color="bg-slate-100 text-slate-600" />
        </div>
      )}

      <Card
        className="mb-6"
        title="Stok per Tipe Motor & Warna"
        action={(
          <button onClick={() => setStockOpen(!stockOpen)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            {stockOpen ? <>Sembunyikan <ChevronUp size={16} /></> : <>Tampilkan <ChevronDown size={16} /></>}
          </button>
        )}
      >
        {stockOpen ? (
          <>
            <p className="text-xs text-slate-400 mb-2">{hasFilters ? 'Mengikuti filter yang sedang aktif • ' : ''}{stock.length} kombinasi tipe & warna</p>
            <div className="max-h-72 overflow-y-auto">
              <DataTable
                columns={[
                  { key: 'type_code', label: 'Tipe Motor', render: (s) => s.type_code || '-' },
                  { key: 'model', label: 'Nama Tipe Motor' },
                  { key: 'color', label: 'Warna', render: (s) => `${s.color}${s.color_code ? ` (${s.color_code})` : ''}` },
                  { key: 'total', label: 'Total', render: (s) => <span className="font-semibold">{s.total}</span> },
                  { key: 'tersedia', label: 'Tersedia' },
                ]}
                data={stock.map((s, i) => ({ ...s, id: `${s.type_code}-${s.color_code}-${i}` }))}
              />
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400">Klik "Tampilkan" untuk melihat jumlah stok per tipe motor dan warna.</p>
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
                <FileSpreadsheet size={16} /> {exporting ? 'Mengekspor...' : 'Export Excel'}
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
              placeholder="Cari Nomor Mesin, Nomor Rangka, Tipe, Nama Tipe, atau Channel..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <select value={filters.channel} onChange={setFilter('channel')} className={selectCls}>
            <option value="">Semua Channel</option>
            {options.channels.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filters.type_code} onChange={setFilter('type_code')} className={selectCls}>
            <option value="">Semua Tipe Motor</option>
            {options.types.map((t) => <option key={`${t.type_code}-${t.model}`} value={t.type_code}>{t.type_code} — {t.model}</option>)}
          </select>
          <select value={filters.color} onChange={setFilter('color')} className={selectCls}>
            <option value="">Semua Warna</option>
            {options.colors.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filters.year} onChange={setFilter('year')} className={selectCls}>
            <option value="">Semua Tahun</option>
            {options.years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filters.supplier} onChange={setFilter('supplier')} className={selectCls}>
            <option value="">Semua Supplier</option>
            {options.suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.status} onChange={setFilter('status')} className={selectCls}>
            <option value="">Semua Status</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {(hasFilters || searchInput) && (
            <button onClick={resetFilters} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
              <RotateCcw size={14} /> Reset
            </button>
          )}
        </div>

        {pageError && (
          <div className="flex items-start justify-between gap-2 text-sm text-brand-700 bg-brand-50 px-3 py-2 rounded-lg mb-3">
            <span>{pageError}</span>
            <button onClick={() => setPageError('')}><X size={16} /></button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-slate-400">
          <span>
            {loading ? 'Memuat...' : `Menampilkan ${from}–${to} dari ${pagination.total} unit`}
            {hasFilters && summary ? ` (total stok ${summary.total} unit)` : ''}
          </span>
          <label className="flex items-center gap-2">
            Baris per halaman
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white">
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>

        <div className={loading ? 'opacity-60 transition-opacity' : ''}>
          <DataTable columns={columns} data={motors} emptyMessage={hasFilters ? 'Tidak ada unit yang cocok dengan filter.' : 'Belum ada data unit motor.'} />
        </div>
        <Pagination page={page} totalPages={pagination.totalPages} onChange={setPage} />
      </Card>

      {isAdmin && (
        <>
          <MotorFormModal open={formOpen} onClose={() => setFormOpen(false)} motor={editing} options={options} onSubmit={handleSubmit} />
          <ImportMotorModal open={importOpen} onClose={() => setImportOpen(false)} onImported={refreshAll} />
          <ConfirmDialog
            open={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
            message={deleteTarget ? `Hapus unit ${deleteTarget.model} (${deleteTarget.color}) dengan Nomor Mesin ${deleteTarget.engine_number || '-'}? Tindakan ini tidak dapat dibatalkan.` : ''}
          />
        </>
      )}
    </MainLayout>
  );
}
