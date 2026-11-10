import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';

const STATUS_OPTIONS = ['Tersedia', 'Dibooking', 'Test Drive', 'Terjual'];
const inputCls = 'mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

const EMPTY = {
  channel: '', channel_no: '', type_code: '', model: '', color_code: '', color: '', year: '',
  engine_number: '', chassis_number: '', purchase_date: '', display_date: '', friction: '', supplier: '',
  status: 'Tersedia',
};

function Field({ label, required, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-medium text-slate-500">
        {label}{required && <span className="text-brand-600"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

/**
 * Form tambah/edit unit motor dengan 13 kolom template Excel (+ Status untuk modul Sales/Booking).
 * motor = null -> tambah; motor = {...} -> edit.
 * onSubmit(payload) harus mengembalikan promise; lempar error agar pesan server tampil di form.
 */
export default function MotorFormModal({ open, onClose, motor, options, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const editing = !!motor;

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(motor ? {
      ...EMPTY,
      ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, motor[k] ?? ''])),
    } : EMPTY);
  }, [open, motor]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Gagal menyimpan data motor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title={editing ? 'Edit Unit Motor' : 'Tambah Unit Motor'} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Channel" required className="sm:col-span-2">
            <input required list="inv-channels" maxLength={100} value={form.channel} onChange={set('channel')} className={inputCls} placeholder="Contoh: MANCUNG MOTOR" />
          </Field>
          <Field label="No." hint={editing ? undefined : 'Kosongkan = otomatis (urutan channel)'}>
            <input type="number" min="1" value={form.channel_no} onChange={set('channel_no')} className={inputCls} />
          </Field>

          <Field label="Tipe Motor" required>
            <input required maxLength={30} value={form.type_code} onChange={set('type_code')} className={inputCls} placeholder="H1B2N2A5" />
          </Field>
          <Field label="Nama Tipe Motor" required className="sm:col-span-2">
            <input required maxLength={100} value={form.model} onChange={set('model')} className={inputCls} placeholder="D. NEW BEAT SPORTY CBS ISS ACC" />
          </Field>

          <Field label="Kode Warna" required>
            <input required maxLength={20} value={form.color_code} onChange={set('color_code')} className={inputCls} placeholder="BK" />
          </Field>
          <Field label="Warna" required>
            <input required maxLength={50} value={form.color} onChange={set('color')} className={inputCls} placeholder="HITAM" />
          </Field>
          <Field label="Tahun" required>
            <input required type="number" min="1990" max={new Date().getFullYear() + 1} value={form.year} onChange={set('year')} className={inputCls} placeholder="2026" />
          </Field>

          <Field label="Nomor Mesin" required className="sm:col-span-1">
            <input required maxLength={40} value={form.engine_number} onChange={set('engine_number')} className={inputCls} placeholder="JMF1E1477355" />
          </Field>
          <Field label="Nomor Rangka" required className="sm:col-span-2">
            <input required maxLength={40} value={form.chassis_number} onChange={set('chassis_number')} className={inputCls} placeholder="JMF119TK477547" />
          </Field>

          <Field label="Tanggal Beli" required>
            <input required type="date" value={form.purchase_date} onChange={set('purchase_date')} className={inputCls} />
          </Field>
          <Field label="Tanggal Display">
            <input type="date" value={form.display_date} onChange={set('display_date')} className={inputCls} />
          </Field>
          <Field label="Gesekan" hint="Boleh kosong">
            <input maxLength={100} value={form.friction} onChange={set('friction')} className={inputCls} />
          </Field>

          <Field label="Supplier" required className="sm:col-span-2">
            <input required list="inv-suppliers" maxLength={100} value={form.supplier} onChange={set('supplier')} className={inputCls} placeholder="PT. WAHANA MAKMUR SEJATI" />
          </Field>
          <Field label="Status stok" hint="Dipakai modul Booking/Sales">
            <select value={form.status} onChange={set('status')} className={inputCls}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        <datalist id="inv-channels">{(options?.channels || []).map((c) => <option key={c} value={c} />)}</datalist>
        <datalist id="inv-suppliers">{(options?.suppliers || []).map((c) => <option key={c} value={c} />)}</datalist>

        {error && <p className="text-sm text-brand-700 bg-brand-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm disabled:opacity-50">
            Batal
          </button>
          <button type="submit" disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 size={16} className="animate-spin" />} Simpan
          </button>
        </div>
      </form>
    </Modal>
  );
}
