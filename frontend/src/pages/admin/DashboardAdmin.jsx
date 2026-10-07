import React, { useEffect, useState } from 'react';
import { Bike, CheckCircle2, Users, CalendarClock, Star, Briefcase } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import MainLayout from '../../components/layout/MainLayout';
import { StatCard, Card } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import api from '../../services/api';

const PIE_COLORS = ['#9c2f35', '#d98c8f', '#d9a441', '#8b6bb1', '#4a9a8e', '#6b7f99', '#c9785a', '#a8a29e'];

export default function DashboardAdmin() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard/admin').then((res) => setData(res.data.data)).catch(() => {});
  }, []);

  if (!data) {
    return (
      <MainLayout title="Dashboard Admin">
        <p className="text-slate-400">Memuat data...</p>
      </MainLayout>
    );
  }

  const { stats, charts, recent } = data;

  return (
    <MainLayout title="Dashboard Admin">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard icon={Bike} label="Total Motor" value={stats.total_motor} />
        <StatCard icon={CheckCircle2} label="Motor Tersedia" value={stats.motor_tersedia} color="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Users} label="Total Pelanggan" value={stats.total_pelanggan} color="bg-violet-50 text-violet-600" />
        <StatCard icon={Briefcase} label="Total Sales" value={stats.total_sales} color="bg-amber-50 text-amber-600" />
        <StatCard icon={Star} label="Rata-rata Kepuasan" value={stats.rata_rata_kepuasan ? `${stats.rata_rata_kepuasan} / 5` : '-'} color="bg-yellow-50 text-yellow-600" />
        <StatCard icon={CalendarClock} label="Total Booking" value={stats.total_booking} />
        <StatCard icon={CheckCircle2} label="Test Drive Selesai" value={stats.test_drive_selesai} color="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Bike} label="Motor Dibooking" value={stats.motor_dibooking} color="bg-amber-50 text-amber-600" />
        <StatCard icon={Bike} label="Motor Test Drive" value={stats.motor_test_drive} color="bg-teal-50 text-teal-600" />
        <StatCard icon={Bike} label="Motor Terjual" value={stats.motor_terjual} color="bg-slate-100 text-slate-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card title="Booking Test Drive per Bulan">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={charts.bookingByMonth}>
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#9c2f35" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Status Pelanggan">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={charts.customerByStatus} dataKey="total" nameKey="status" outerRadius={80} label>
                {charts.customerByStatus.map((entry, i) => (
                  <Cell key={entry.status} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Aktivitas CRM">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts.activityByType}>
              <XAxis dataKey="activity_type" fontSize={10} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" fill="#c4676c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Distribusi Rating Kepuasan">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts.ratingDistribution}>
              <XAxis dataKey="rating" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Booking Terbaru">
          <ul className="space-y-3 text-sm">
            {recent.bookings.map((b, i) => (
              <li key={i} className="flex justify-between items-center border-b border-slate-50 pb-2 last:border-0">
                <div>
                  <p className="font-medium">{b.customer_name}</p>
                  <p className="text-xs text-slate-400">{b.booking_code} • {b.brand} {b.model}</p>
                </div>
                <Badge status={b.status} />
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Pelanggan Baru">
          <ul className="space-y-3 text-sm">
            {recent.customers.map((c, i) => (
              <li key={i} className="flex justify-between items-center border-b border-slate-50 pb-2 last:border-0">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-slate-400">Sales: {c.sales_name || '-'}</p>
                </div>
                <Badge status={c.status} />
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Aktivitas CRM Terbaru">
          <ul className="space-y-3 text-sm">
            {recent.activities.map((a, i) => (
              <li key={i} className="border-b border-slate-50 pb-2 last:border-0">
                <p className="font-medium">{a.customer_name} <span className="text-xs text-slate-400 font-normal">oleh {a.sales_name}</span></p>
                <p className="text-xs text-slate-500">{a.activity_type}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Penilaian Terbaru">
          <ul className="space-y-3 text-sm">
            {recent.reviews.map((r, i) => (
              <li key={i} className="border-b border-slate-50 pb-2 last:border-0">
                <div className="flex justify-between">
                  <p className="font-medium">{r.customer_name}</p>
                  <span className="text-amber-500 text-xs font-semibold">{r.overall_rating} / 5 ⭐</span>
                </div>
                {r.comment && <p className="text-xs text-slate-500 line-clamp-1">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </MainLayout>
  );
}
