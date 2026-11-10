import React, { useRef, useState } from 'react';
import { FileUp, Download, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { importMotors, downloadImportTemplate, errorMessage } from '../../services/motorService';

// Alur: pilih file -> pemeriksaan otomatis (tanpa menyimpan) -> konfirmasi import.
// Semua validasi & pengecekan duplikat dilakukan di backend.
export default function ImportMotorModal({ open, onClose, onImported }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [check, setCheck] = useState(null);   // hasil pemeriksaan (dry run)
  const [result, setResult] = useState(null); // hasil import sebenarnya
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setFile(null); setCheck(null); setResult(null); setError(''); setBusy(false); if (inputRef.current) inputRef.current.value = ''; };
  const close = () => { if (busy) return; const done = !!result; reset(); onClose(); if (done) onImported?.(); };

  const pick = async (e) => {
    const f = e.target.files[0];
    setCheck(null); setResult(null); setError('');
    setFile(f || null);
    if (!f) return;
    setBusy(true);
    try {
      const res = await importMotors(f, true);
      setCheck(res.data.data);
    } catch (err) {
      setError(errorMessage(err, 'Gagal memeriksa file.'));
    } finally { setBusy(false); }
  };

  const runImport = async () => {
    setBusy(true); setError('');
    try {
      const res = await importMotors(file, false);
      setResult(res.data.data);
      setCheck(null);
    } catch (err) {
      setError(errorMessage(err, 'Gagal mengimpor data.'));
    } finally { setBusy(false); }
  };

  const report = result || check;

  return (
    <Modal open={open} onClose={close} title="Import Excel Stok Unit" maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 space-y-1">
          <p>Gunakan format <b>STOK UNIT MM</b>: 13 kolom (Channel, No., Tipe Motor, Nama Tipe Motor, Kode Warna, Warna, Tahun, Nomor Mesin, Nomor Rangka, Tanggal Beli, Tanggal Display, Gesekan, Supplier).</p>
          <p className="text-xs text-slate-500">Nomor Mesin &amp; Nomor Rangka harus unik. Baris yang tidak valid atau duplikat dilewati; baris lain tetap diimpor.</p>
          <button type="button" onClick={() => downloadImportTemplate().catch((e) => setError(e.message))} className="inline-flex items-center gap-1.5 text-brand-600 hover:underline text-xs font-medium">
            <Download size={14} /> Unduh template
          </button>
        </div>

        {!result && (
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-6 cursor-pointer hover:bg-slate-50">
            <FileUp size={24} className="text-slate-400" />
            <span className="text-sm text-slate-600">{file ? file.name : 'Pilih file .xlsx'}</span>
            <input ref={inputRef} type="file" accept=".xlsx" onChange={pick} className="hidden" disabled={busy} />
          </label>
        )}

        {busy && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Memproses...</p>}
        {error && <p className="text-sm text-brand-700 bg-brand-50 px-3 py-2 rounded-lg">{error}</p>}

        {report && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Total baris</p><p className="text-lg font-semibold text-slate-800">{report.total_rows}</p></div>
              <div className="rounded-lg bg-emerald-50 p-3"><p className="text-xs text-emerald-700">{result ? 'Berhasil diimpor' : 'Valid'}</p><p className="text-lg font-semibold text-emerald-700">{result ? report.imported : report.valid}</p></div>
              <div className="rounded-lg bg-brand-50 p-3"><p className="text-xs text-brand-700">Gagal</p><p className="text-lg font-semibold text-brand-700">{report.failed}</p></div>
            </div>

            {report.errors.length > 0 && (
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1"><AlertTriangle size={14} className="text-amber-500" /> Baris bermasalah ({report.failed}){report.errors_truncated ? ' - sebagian ditampilkan' : ''}</p>
                <div className="max-h-56 overflow-auto border border-slate-100 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 sticky top-0"><tr><th className="text-left px-2 py-1.5">Baris</th><th className="text-left px-2 py-1.5">Nomor Mesin</th><th className="text-left px-2 py-1.5">Alasan</th></tr></thead>
                    <tbody>
                      {report.errors.map((e, i) => (
                        <tr key={`${e.row}-${i}`} className="border-t border-slate-50 align-top">
                          <td className="px-2 py-1.5 whitespace-nowrap">{e.row}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{e.engine_number || '-'}</td>
                          <td className="px-2 py-1.5 text-brand-700">{e.reasons.join(' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result && (
              <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={16} /> Import selesai: {result.imported} unit ditambahkan.</p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={close} disabled={busy} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">{result ? 'Tutup' : 'Batal'}</button>
          {check && !result && (
            <button type="button" onClick={runImport} disabled={busy || check.valid === 0} className="flex-1 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50">
              Import {check.valid} data
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
