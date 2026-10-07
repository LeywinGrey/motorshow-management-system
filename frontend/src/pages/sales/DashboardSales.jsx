import React, { useEffect, useState } from 'react';
import { Users, Star, CalendarClock, Bell, Target, CheckCircle2 } from 'lucide-react';
import MainLayout from '../../components/layout/MainLayout';
import { StatCard, Card } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import api from '../../services/api';

export default function DashboardSales() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard/sales').then((res) => setData(res.data.data)).catch(() => {});
  }, []);

  if (!data) {
    return (
      <MainLayout title="Dashboard Sales">
        <p className="text-slate-400">Memuat data...</p>
      </MainLayout>
    );
  }

  const { stats, upcoming_schedule, recent_customers, recent_activities } = data;

  return (
    <MainLayout title="Dashboard Sales">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="Total Pelanggan" value={stats.total_pelanggan} />
        <StatCard icon={Target} label="Lead" value={stats.lead} color="bg-slate-100 text-slate-600" />
        <StatCard icon={Target} label="Prospek" value={stats.prospek} color="bg-violet-50 text-violet-600" />
        <StatCard icon={CalendarClock} label="Test Drive" value={stats.test_drive} color="bg-teal-50 text-teal-600" />
        <StatCard icon={Bell} label="Follow Up" value={stats.follow_up} color="bg-amber-50 text-amber-600" />
        <StatCard icon={CheckCircle2} label="Booking" value={stats.booking} color="bg-teal-50 text-teal-600" />
        <StatCard icon={CheckCircle2} label="Terjual" value={stats.terjual} color="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Star} label="Rata-rata Kepuasan" value={stats.rata_rata_kepuasan ? `${stats.rata_rata_kepuasan}/5` : '-'} color="bg-yellow-50 text-yellow-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Jadwal Test Drive Terdekat" className="lg:col-span-1">
          <ul className="space-y-3 text-sm">
            {upcoming_schedule.length === 0 && <p className="text-slate-400">Tidak ada jadwal mendatang.</p>}
            {upcoming_schedule.map((s, i) => (
              <li key={i} className="border-b border-slate-50 pb-2 last:border-0">
                <div className="flex justify-between">
                  <p className="font-medium">{s.customer_name}</p>
                  <Badge status={s.status} />
                </div>
                <p className="text-xs text-slate-400">{s.brand} {s.model} • {s.booking_date} {s.booking_time}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Pelanggan Terbaru" className="lg:col-span-1">
          <ul className="space-y-3 text-sm">
            {recent_customers.map((c, i) => (
              <li key={i} className="flex justify-between items-center border-b border-slate-50 pb-2 last:border-0">
                <p className="font-medium">{c.name}</p>
                <Badge status={c.status} />
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Aktivitas CRM Terbaru" className="lg:col-span-1">
          <ul className="space-y-3 text-sm">
            {recent_activities.map((a, i) => (
              <li key={i} className="border-b border-slate-50 pb-2 last:border-0">
                <p className="font-medium">{a.customer_name}</p>
                <p className="text-xs text-slate-500">{a.activity_type}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </MainLayout>
  );
}
