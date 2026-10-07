import React, { useEffect, useState } from 'react';
import { Plus, CalendarDays, List, X } from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import { Card } from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import { useAuth } from '../context/AuthContext';
import { buildMotorOptions } from '../utils/motorGroups';
import api from '../services/api';

const STATUS_OPTIONS = ['Menunggu', 'Dikonfirmasi', 'Selesai', 'Dibatalkan'];
const emptyForm = { customer_id: '', motorcycle_id: '', sales_id: '', booking_date: '', booking_time: '', notes: '' };

function getMonthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default function Booking() {
  const { user } = useAuth();
  const [view, setView] = useState('list');
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [filters, setFilters] = useState({ date: '', status: '' });
  const [customers, setCustomers] = useState([]);
  const [motors, setMotors] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const loadBookings = (page = 1) => {
    const params = { page, limit: 10 };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get('/bookings', { params }).then((res) => { setBookings(res.data.data); setPagination(res.data.pagination); }).catch(() => {});
  };

  const loadCalendar = () => {
    const { start, end } = getMonthRange(calendarDate);
    api.get('/bookings/calendar', { params: { start, end } }).then((res) => setCalendarEvents(res.data.data)).catch(() => {});
  };

  useEffect(() => {
    api.get('/customers', { params: { limit: 200 } }).then((res) => setCustomers(res.data.data)).catch(() => {});
    api.get('/motorcycles', { params: { limit: 1000 } }).then((res) => setMotors(res.data.data)).catch(() => {});
  }, []);
  useEffect(() => { if (view === 'list') loadBookings(1); }, [filters, view]);
  useEffect(() => { if (view === 'calendar') loadCalendar(); }, [calendarDate, view]);

  // Dropdown motor: satu opsi per tipe (bukan per unit), unit tersedia dipilih otomatis
  const motorOptions = buildMotorOptions(motors, { hideSold: true });

  const openCreate = () => { setForm(emptyForm); setError(''); setModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/bookings', form);
      setModalOpen(false);
      view === 'list' ? loadBookings(1) : loadCalendar();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membuat booking.');
    }
  };

  const changeStatus = async (id, status) => {
    try {
      await api.put(`/bookings/${id}/status`, { status });
      view === 'list' ? loadBookings(pagination.page) : loadCalendar();
      setSelectedBooking(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengubah status.');
    }
  };

  // Grid kalender sederhana
  const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
  const startWeekday = monthStart.getDay();
  const days = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const eventsByDay = {};
  calendarEvents.forEach((ev) => {
    const day = Number(ev.booking_date.slice(8, 10));
    eventsByDay[day] = eventsByDay[day] || [];
    eventsByDay[day].push(ev);
  });

  return (
    <MainLayout title="Booking Test Drive">
      <Card
        title="Kelola Booking Test Drive"
        action={(
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button onClick={() => setView('list')} className={`px-2.5 py-1.5 rounded-md text-xs flex items-center gap-1 ${view === 'list' ? 'bg-white shadow-sm' : 'text-slate-500'}`}><List size={14}/> List</button>
              <button onClick={() => setView('calendar')} className={`px-2.5 py-1.5 rounded-md text-xs flex items-center gap-1 ${view === 'calendar' ? 'bg-white shadow-sm' : 'text-slate-500'}`}><CalendarDays size={14}/> Kalender</button>
            </div>
            <button onClick={openCreate} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm px-3 py-2 rounded-lg">
              <Plus size={16} /> Booking
            </button>
          </div>
        )}
      >
        {view === 'list' ? (
          <>
            <div className="flex flex-wrap gap-3 mb-4">
              <input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-200 text-sm">
                <option value="">Semua Status</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <DataTable
              columns={[
                { key: 'booking_code', label: 'Kode' },
                { key: 'customer_name', label: 'Pelanggan' },
                { key: 'motor', label: 'Motor', render: (b) => `${b.motor_brand} ${b.motor_model}` },
                { key: 'sales_name', label: 'Sales' },
                { key: 'jadwal', label: 'Jadwal', render: (b) => `${b.booking_date} ${b.booking_time?.slice(0,5)}` },
                { key: 'status', label: 'Status', render: (b) => (
                  <select value={b.status} onChange={(e) => changeStatus(b.id, e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1">
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )},
              ]}
              data={bookings}
            />
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={loadBookings} />
          </>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} className="px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 rounded">←</button>
              <p className="font-medium text-sm">{calendarDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
              <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} className="px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 rounded">→</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs text-center text-slate-400 mb-1">
              {['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, idx) => (
                <div key={idx} className={`min-h-[70px] rounded-lg border border-slate-100 p-1 text-xs ${day ? 'bg-white' : 'bg-transparent border-none'}`}>
                  {day && <p className="text-slate-400 mb-1">{day}</p>}
                  {day && (eventsByDay[day] || []).slice(0, 2).map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => setSelectedBooking(ev)}
                      className="block w-full text-left truncate bg-brand-50 text-brand-700 rounded px-1 py-0.5 mb-0.5"
                    >
                      {ev.booking_time?.slice(0,5)} {ev.customer_name}
                    </button>
                  ))}
                  {day && (eventsByDay[day] || []).length > 2 && (
                    <p className="text-[10px] text-slate-400">+{(eventsByDay[day] || []).length - 2} lagi</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Booking Test Drive">
        <form onSubmit={handleSubmit} className="space-y-3">
          <select required value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
            <option value="">Pilih Pelanggan</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
          </select>
          <select
            required
            value={motorOptions.find((o) => o.unitIds.includes(String(form.motorcycle_id)))?.key || ''}
            onChange={(e) => setForm({ ...form, motorcycle_id: motorOptions.find((o) => o.key === e.target.value)?.unitId || '' })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          >
            <option value="">Pilih Tipe Motor</option>
            {motorOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input required type="date" value={form.booking_date} onChange={(e) => setForm({ ...form, booking_date: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            <input required type="time" value={form.booking_time} onChange={(e) => setForm({ ...form, booking_time: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          </div>
          <textarea placeholder="Catatan" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-medium">Simpan Booking</button>
        </form>
      </Modal>

      <Modal open={!!selectedBooking} onClose={() => setSelectedBooking(null)} title="Detail Booking" maxWidth="max-w-sm">
        {selectedBooking && (
          <div className="space-y-2 text-sm">
            <p><span className="text-slate-400">Kode:</span> {selectedBooking.booking_code}</p>
            <p><span className="text-slate-400">Pelanggan:</span> {selectedBooking.customer_name}</p>
            <p><span className="text-slate-400">Motor:</span> {selectedBooking.motor_brand} {selectedBooking.motor_model}</p>
            <p><span className="text-slate-400">Sales:</span> {selectedBooking.sales_name}</p>
            <p><span className="text-slate-400">Jadwal:</span> {selectedBooking.booking_date} {selectedBooking.booking_time?.slice(0,5)}</p>
            <p><span className="text-slate-400">Status:</span> <Badge status={selectedBooking.status} /></p>
            <select
              value={selectedBooking.status}
              onChange={(e) => changeStatus(selectedBooking.id, e.target.value)}
              className="w-full mt-2 px-3 py-2 rounded-lg border border-slate-200 text-sm"
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </Modal>
    </MainLayout>
  );
}
