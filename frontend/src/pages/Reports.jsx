import React, { useEffect, useState } from 'react';
import { Bike, Users, CalendarClock, Star } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import { Card, StatCard } from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import api from '../services/api';

const TABS = [
  { key: 'inventory', label: 'Laporan Inventory', icon: Bike },
  { key: 'sales', label: 'Laporan Sales', icon: Users },
  { key: 'test-drive', label: 'Laporan Test Drive', icon: CalendarClock },
  { key: 'satisfaction', label: 'Laporan Kepuasan', icon: Star },
];

export default function Reports() {
  const [tab, setTab] = useState('inventory');
  const [filters, setFilters] = useState({ start_date: '', end_date: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // Kosongkan data setiap tab/filter berubah, supaya data tab sebelumnya tidak dirender
  // dengan tampilan tab baru (penyebab halaman blank). `ignore` mengabaikan respons yang terlambat.
  useEffect(() => {
    let ignore = false;
    setData(null);
    setError('');
    const params = {};
    if (filters.start_date) params.start_date = filters.start_date;
    if (filters.end_date) params.end_date = filters.end_date;
    api.get(`/reports/${tab}`, { params })
      .then((res) => { if (!ignore) setData(res.data.data); })
      .catch((err) => { if (!ignore) setError(err.response?.data?.message || 'Gagal memuat laporan.'); });
    return () => { ignore = true; };
  }, [tab, filters]);

  const exportCsv = () => {
    if (!data) return;
    let rows = [];
    if (tab === 'sales') rows = data;
    else if (tab === 'test-drive') rows = data.schedule;
    else if (tab === 'satisfaction') rows = data.comments;
    else rows = data.by_brand;

    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => `"${r[h] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-${tab}.csv`;
    a.click();
  };

  return (
    <MainLayout title="Laporan">
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${tab === t.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      <Card
        title={TABS.find((t) => t.key === tab)?.label}
        action={(
          <div className="flex gap-2 items-center">
            <input type="date" value={filters.start_date} onChange={(e) => setFilters({ ...filters, start_date: e.target.value })} className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs" />
            <span className="text-xs text-slate-400">s/d</span>
            <input type="date" value={filters.end_date} onChange={(e) => setFilters({ ...filters, end_date: e.target.value })} className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs" />
            <button onClick={exportCsv} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">Export CSV</button>
          </div>
        )}
      >
        {error ? (
          <p className="text-sm text-brand-700 bg-brand-50 px-3 py-2 rounded-lg">{error}</p>
        ) : !data ? (
          <p className="text-slate-400">Memuat data...</p>
        ) : tab === 'inventory' ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <StatCard icon={Bike} label="Total Motor" value={data.summary.total_motor} />
              <StatCard icon={Bike} label="Tersedia" value={data.summary.tersedia} color="bg-emerald-50 text-emerald-600" />
              <StatCard icon={Bike} label="Dibooking" value={data.summary.dibooking} color="bg-amber-50 text-amber-600" />
              <StatCard icon={Bike} label="Test Drive" value={data.summary.test_drive} color="bg-teal-50 text-teal-600" />
              <StatCard icon={Bike} label="Terjual" value={data.summary.terjual} color="bg-slate-100 text-slate-600" />
            </div>
            <DataTable columns={[{ key: 'brand', label: 'Merek' }, { key: 'total', label: 'Jumlah Unit' }]} data={data.by_brand} />
          </>
        ) : tab === 'sales' ? (
          <DataTable
            columns={[
              { key: 'sales_name', label: 'Sales' },
              { key: 'jumlah_pelanggan', label: 'Jumlah Pelanggan' },
              { key: 'jumlah_test_drive', label: 'Jumlah Test Drive' },
              { key: 'jumlah_booking', label: 'Jumlah Booking' },
              { key: 'jumlah_terjual', label: 'Pelanggan Terjual' },
            ]}
            data={data}
          />
        ) : tab === 'test-drive' ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <StatCard icon={CalendarClock} label="Total Test Drive" value={data.summary.total} />
              <StatCard icon={CalendarClock} label="Selesai" value={data.summary.selesai} color="bg-emerald-50 text-emerald-600" />
              <StatCard icon={CalendarClock} label="Dibatalkan" value={data.summary.dibatalkan} color="bg-red-50 text-red-600" />
              <StatCard icon={CalendarClock} label="Menunggu/Dikonfirmasi" value={(data.summary.menunggu || 0) + (data.summary.dikonfirmasi || 0)} color="bg-amber-50 text-amber-600" />
            </div>
            <DataTable
              columns={[
                { key: 'booking_code', label: 'Kode' },
                { key: 'customer_name', label: 'Pelanggan' },
                { key: 'sales_name', label: 'Sales' },
                { key: 'booking_date', label: 'Tanggal' },
                { key: 'status', label: 'Status' },
              ]}
              data={data.schedule}
            />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <StatCard icon={Star} label="Rata-rata Keseluruhan" value={data.summary.avg_overall ? Number(data.summary.avg_overall).toFixed(2) : '-'} />
              <StatCard icon={Star} label="Rata-rata Sales" value={data.summary.avg_sales ? Number(data.summary.avg_sales).toFixed(2) : '-'} />
              <StatCard icon={Star} label="Rata-rata Booking" value={data.summary.avg_booking ? Number(data.summary.avg_booking).toFixed(2) : '-'} />
              <StatCard icon={Star} label="Rata-rata Test Drive" value={data.summary.avg_test_drive ? Number(data.summary.avg_test_drive).toFixed(2) : '-'} />
            </div>
            <DataTable
              columns={[
                { key: 'customer_name', label: 'Pelanggan' },
                { key: 'sales_name', label: 'Sales' },
                { key: 'overall_rating', label: 'Rating' },
                { key: 'comment', label: 'Komentar' },
              ]}
              data={data.comments}
            />
          </>
        )}
      </Card>
    </MainLayout>
  );
}
