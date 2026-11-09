import React, { useMemo, useRef, useState } from 'react';
import { Download, UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { importMotors, errorMessage } from '../../services/motorService';
import {
  readInventoryFile, downloadInventoryTemplate, INVENTORY_HEADERS, MAX_IMPORT_ROWS,
} from '../../utils/inventoryExcel';

/**
 * Import Excel (format STOK UNIT MM.xlsx):
 * 1) file dibaca di browser  2) dry-run ke server (validasi + cek duplikat Nomor Mesin/Rangka)
 * 3) admin meninjau hasilnya, lalu import. Baris bermasalah dilewati & dilaporkan beserta alasannya.
 */
export default function ImportMotorModal({ open, onClose, onImported }) {
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);              // baris hasil baca Excel
  const [problems, setProblems] = useState(new Map()); // row -> [alasan] dari validasi server
  const [readError, setReadError] = useState('');
  const [checking, setChecking] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [result, setResult] = useState(null);        // { inserted, failed: [...] }

  const validCount = rows.length - problems.size;
  const shownRows = useMemo(() => (onlyErrors ? rows.filter((r) => problems.has(r.row)) : rows), [rows, problems, onlyErrors]);

  const reset = () => {
    setFileName(''); setRows([]); setProblems(new Map()); setReadError(''); setResult(null); setOnlyErrors(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    if (importing || checking) return;
    reset();
    onClose();
  };

  const handleFile = async (file) => {
    if (!file) return;
    reset();
    setFileName(file.name);
    setChecking(true);
    try {
      const { rows: parsed } = await readInventoryFile(file);
      if (parsed.length === 0) throw new Error('Tidak ada data unit motor di bawah header.');
      if (parsed.length > MAX_IMPORT_ROWS) throw new Error(`Maksimal ${MAX_IMPORT_ROWS} baris per import. File Anda berisi ${parsed.length} baris.`);
      const check = await importMotors(parsed, true); // dry run
      setRows(parsed);
      setProblems(new Map(check.failed.map((f) => [f.row, f.reasons])));
    } catch (err) {
      setReadError(errorMessage(err, 'Gagal membaca file.'));
    } finally {
      setChecking(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await importMotors(rows, false);
      setResult(res);
      if (res.inserted > 0) onImported();
    } catch (err) {
      setReadError(errorMessage(err, 'Import gagal.'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Import Data Motor dari Excel" maxWidth="max-w-5xl">
      {result ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center text-center gap-2 py-2">
            <div className={`p-3 rounded-full ${result.failed.length === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
              {result.failed.length === 0 ? <CheckCircle2 size={28} /> : <AlertCircle size={28} />}
            </div>
            <p className="font-semibold text-slate-800">
              {result.inserted} unit berhasil diimpor{result.failed.length > 0 && `, ${result.failed.length} unit gagal`}
            </p>
            <p className="text-xs text-slate-400">Dari total {result.total} baris di file.</p>
          </div>
          {result.failed.length > 0 && (
            <div className="border border-brand-100 rounded-lg overflow-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="bg-brand-50 text-brand-700 sticky top-0">
                  <tr className="text-left"><th className="py-2 px-3">Baris</th><th className="py-2 px-3">Nomor Mesin</th><th className="py-2 px-3">Alasan gagal</th></tr>
                </thead>
                <tbody>
                  {result.failed.map((f) => (
                    <tr key={f.row} className="border-t border-brand-50">
                      <td className="py-1.5 px-3 text-slate-500">{f.row}</td>
                      <td className="py-1.5 px-3 whitespace-nowrap">{f.engine_number || '-'}</td>
                      <td className="py-1.5 px-3 text-brand-700">{f.reasons.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm">Import File Lain</button>
            <button onClick={handleClose} className="flex-1 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm">Selesai</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-100 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-brand-50 text-brand-600"><FileSpreadsheet size={20} /></div>
              <div>
                <p className="text-sm font-medium text-slate-700">1. Siapkan file sesuai format STOK UNIT MM.xlsx</p>
                <p className="text-xs text-slate-400">{INVENTORY_HEADERS.length} kolom: {INVENTORY_HEADERS.join(', ')}. Baris judul di atas header otomatis dilewati.</p>
              </div>
            </div>
            <button
              onClick={() => { try { downloadInventoryTemplate(); } catch (err) { alert(err.message); } }}
              className="shrink-0 flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-sm px-3 py-2 rounded-lg"
            >
              <Download size={15} /> Template
            </button>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">2. Upload file</p>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
              className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-lg py-6 cursor-pointer transition-colors ${
                dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-200 hover:bg-slate-50'
              }`}
            >
              {checking ? <Loader2 size={26} className="text-brand-600 animate-spin" /> : <UploadCloud size={26} className="text-slate-400" />}
              <span className="text-sm text-slate-600">{checking ? 'Memeriksa data...' : fileName || 'Klik untuk memilih file, atau seret ke sini'}</span>
              <span className="text-xs text-slate-400">.xlsx, .xls, atau .csv • maks. {MAX_IMPORT_ROWS} baris</span>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={checking || importing} onChange={(e) => handleFile(e.target.files[0])} />
            </label>
            {readError && <p className="text-sm text-brand-700 bg-brand-50 px-3 py-2 rounded-lg mt-2">{readError}</p>}
          </div>

          {rows.length > 0 && (
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <p className="text-sm font-medium text-slate-700 mr-1">3. Periksa hasil validasi</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{rows.length} baris</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{validCount} valid</span>
                {problems.size > 0 && (
                  <>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">{problems.size} error (akan dilewati)</span>
                    <label className="ml-auto text-xs text-slate-500 flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} /> Hanya tampilkan error
                    </label>
                  </>
                )}
              </div>
              <div className="border border-slate-100 rounded-lg overflow-auto max-h-72">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 sticky top-0">
                    <tr className="text-left">
                      {['Baris', ...INVENTORY_HEADERS, 'Keterangan'].map((h) => <th key={h} className="py-2 px-2.5 font-medium whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {shownRows.map((r) => {
                      const errs = problems.get(r.row);
                      return (
                        <tr key={r.row} className={`border-t border-slate-50 ${errs ? 'bg-brand-50/60' : ''}`}>
                          <td className="py-1.5 px-2.5 text-slate-400">{r.row}</td>
                          {['channel', 'channel_no', 'type_code', 'model', 'color_code', 'color', 'year', 'engine_number', 'chassis_number', 'purchase_date', 'display_date', 'friction', 'supplier'].map((f) => (
                            <td key={f} className="py-1.5 px-2.5 whitespace-nowrap">{r[f] || '-'}</td>
                          ))}
                          <td className="py-1.5 px-2.5 whitespace-nowrap">
                            {errs ? <span className="text-brand-700">{errs.join('; ')}</span> : <span className="text-emerald-600">OK</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={handleClose} disabled={importing || checking} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm disabled:opacity-50">
              Batal
            </button>
            <button
              onClick={handleImport}
              disabled={importing || checking || validCount === 0}
              className="flex-1 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {importing && <Loader2 size={16} className="animate-spin" />}
              {validCount > 0 ? `Import ${validCount} Unit` : 'Import'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
