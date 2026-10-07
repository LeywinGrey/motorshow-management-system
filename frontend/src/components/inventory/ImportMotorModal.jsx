import React, { useRef, useState } from 'react';
import { Download, UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import api from '../../services/api';
import {
  downloadMotorTemplate, readExcelRows, validateMotorRows, MAX_IMPORT_ROWS,
} from '../../utils/importExcel';

const BATCH_SIZE = 5; // jumlah request yang dikirim bersamaan

function formatRupiah(n) {
  if (!Number.isFinite(n)) return '-';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export default function ImportMotorModal({ open, onClose, onImported }) {
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [readError, setReadError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null); // { success, failed: [{rowNumber, message}] }

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidCount = rows.length - validRows.length;

  const reset = () => {
    setFileName(''); setRows([]); setReadError(''); setProgress(0); setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const handleFile = async (file) => {
    if (!file) return;
    reset();
    setFileName(file.name);
    try {
      const raw = await readExcelRows(file);
      if (raw.length === 0) { setReadError('File kosong atau tidak ada data pada baris ke-2 dan seterusnya.'); return; }
      if (raw.length > MAX_IMPORT_ROWS) { setReadError(`Maksimal ${MAX_IMPORT_ROWS} baris per import. File Anda berisi ${raw.length} baris.`); return; }
      setRows(validateMotorRows(raw));
    } catch (err) {
      setReadError(err.message);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    let success = 0;
    const failed = [];

    // Kirim ke endpoint POST /motorcycles yang sudah ada (format sama dengan form "Tambah Motor")
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async ({ rowNumber, data }) => {
        try {
          const fd = new FormData();
          ['brand', 'model', 'year', 'color', 'price', 'status'].forEach((k) => fd.append(k, data[k]));
          await api.post('/motorcycles', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          success += 1;
        } catch (err) {
          failed.push({ rowNumber, message: err.response?.data?.message || 'Gagal menyimpan ke server.' });
        }
      }));
      setProgress(Math.min(i + BATCH_SIZE, validRows.length));
    }

    failed.sort((a, b) => a.rowNumber - b.rowNumber);
    setResult({ success, failed });
    setImporting(false);
    if (success > 0) onImported();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Import Data Motor dari Excel" maxWidth="max-w-3xl">
      {result ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center text-center gap-2 py-2">
            <div className={`p-3 rounded-full ${result.failed.length === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
              {result.failed.length === 0 ? <CheckCircle2 size={28} /> : <AlertCircle size={28} />}
            </div>
            <p className="font-semibold text-slate-800">
              {result.success} motor berhasil diimport{result.failed.length > 0 && `, ${result.failed.length} gagal`}
            </p>
          </div>
          {result.failed.length > 0 && (
            <ul className="text-sm bg-brand-50 border border-brand-100 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
              {result.failed.map((f) => (
                <li key={f.rowNumber} className="text-brand-700">Baris {f.rowNumber}: {f.message}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm">
              Import File Lain
            </button>
            <button onClick={handleClose} className="flex-1 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm">
              Selesai
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Langkah 1: template */}
          <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-100 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-brand-50 text-brand-600"><FileSpreadsheet size={20} /></div>
              <div>
                <p className="text-sm font-medium text-slate-700">1. Unduh template Excel</p>
                <p className="text-xs text-slate-400">Sudah berisi format kolom, contoh data, dan petunjuk pengisian.</p>
              </div>
            </div>
            <button
              onClick={() => { try { downloadMotorTemplate(); } catch (err) { alert(err.message); } }}
              className="shrink-0 flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-sm px-3 py-2 rounded-lg"
            >
              <Download size={15} /> Template
            </button>
          </div>

          {/* Langkah 2: upload */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">2. Upload file yang sudah diisi</p>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
              className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-lg py-6 cursor-pointer transition-colors ${
                dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-200 hover:bg-slate-50'
              }`}
            >
              <UploadCloud size={26} className="text-slate-400" />
              <span className="text-sm text-slate-600">
                {fileName || 'Klik untuk memilih file, atau seret ke sini'}
              </span>
              <span className="text-xs text-slate-400">.xlsx, .xls, atau .csv • maks. {MAX_IMPORT_ROWS} baris</span>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </label>
            {readError && <p className="text-sm text-brand-700 bg-brand-50 px-3 py-2 rounded-lg mt-2">{readError}</p>}
          </div>

          {/* Langkah 3: preview */}
          {rows.length > 0 && (
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <p className="text-sm font-medium text-slate-700 mr-1">3. Periksa data</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{rows.length} baris</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{validRows.length} valid</span>
                {invalidCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">{invalidCount} error (dilewati)</span>
                )}
              </div>
              <div className="border border-slate-100 rounded-lg overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 sticky top-0">
                    <tr className="text-left">
                      {['Baris', 'Merek', 'Tipe/Model', 'Tahun', 'Warna', 'Harga', 'Status', 'Keterangan'].map((h) => (
                        <th key={h} className="py-2 px-2.5 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.rowNumber} className={`border-t border-slate-50 ${r.errors.length ? 'bg-brand-50/60' : ''}`}>
                        <td className="py-1.5 px-2.5 text-slate-400">{r.rowNumber}</td>
                        <td className="py-1.5 px-2.5 whitespace-nowrap">{r.data.brand || '-'}</td>
                        <td className="py-1.5 px-2.5 whitespace-nowrap">{r.data.model || '-'}</td>
                        <td className="py-1.5 px-2.5">{Number.isFinite(r.data.year) ? r.data.year : '-'}</td>
                        <td className="py-1.5 px-2.5 whitespace-nowrap">{r.data.color || '-'}</td>
                        <td className="py-1.5 px-2.5 whitespace-nowrap">{formatRupiah(r.data.price)}</td>
                        <td className="py-1.5 px-2.5 whitespace-nowrap">{r.data.status}</td>
                        <td className="py-1.5 px-2.5 whitespace-nowrap">
                          {r.errors.length === 0
                            ? <span className="text-emerald-600">OK</span>
                            : <span className="text-brand-700">{r.errors.join(', ')}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importing && (
            <div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-600 transition-all"
                  style={{ width: `${validRows.length ? (progress / validRows.length) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1 text-center">Mengimport {progress} / {validRows.length}...</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleClose}
              disabled={importing}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleImport}
              disabled={importing || validRows.length === 0}
              className="flex-1 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {importing && <Loader2 size={16} className="animate-spin" />}
              {validRows.length > 0 ? `Import ${validRows.length} Motor` : 'Import'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
