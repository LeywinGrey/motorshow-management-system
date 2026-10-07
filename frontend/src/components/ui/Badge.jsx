import React from 'react';

const COLOR_MAP = {
  // Status motor
  Tersedia: 'bg-emerald-100 text-emerald-700',
  Dibooking: 'bg-amber-100 text-amber-700',
  'Test Drive': 'bg-teal-100 text-teal-700',
  Terjual: 'bg-slate-200 text-slate-700',
  // Status pelanggan
  Lead: 'bg-slate-100 text-slate-700',
  Prospek: 'bg-violet-100 text-violet-700',
  'Follow Up': 'bg-amber-100 text-amber-700',
  Negosiasi: 'bg-purple-100 text-purple-700',
  Booking: 'bg-teal-100 text-teal-700',
  'Tidak Jadi': 'bg-red-100 text-red-700',
  // Status booking
  Menunggu: 'bg-amber-100 text-amber-700',
  Dikonfirmasi: 'bg-teal-100 text-teal-700',
  Selesai: 'bg-emerald-100 text-emerald-700',
  Dibatalkan: 'bg-red-100 text-red-700',
};

export default function Badge({ status, children }) {
  const cls = COLOR_MAP[status] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>
      {children || status}
    </span>
  );
}
