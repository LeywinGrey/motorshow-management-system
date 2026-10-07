import React, { useState } from 'react';
import { Search, CheckCircle2, Loader2 } from 'lucide-react';
import BrandLogo from '../../components/ui/BrandLogo';
import RatingStars from '../../components/ui/RatingStars';
import api from '../../services/api';

const RATING_LABELS = [
  { key: 'sales_rating', label: 'Kepuasan terhadap pelayanan Sales' },
  { key: 'booking_rating', label: 'Kepuasan terhadap proses booking' },
  { key: 'test_drive_rating', label: 'Kepuasan terhadap pengalaman Test Drive' },
  { key: 'overall_rating', label: 'Kepuasan secara keseluruhan' },
];

export default function PublicSatisfactionForm() {
  const [step, setStep] = useState('code'); // code -> form -> done
  const [bookingCode, setBookingCode] = useState('');
  const [bookingInfo, setBookingInfo] = useState(null);
  const [ratings, setRatings] = useState({ sales_rating: 0, booking_rating: 0, test_drive_rating: 0, overall_rating: 0 });
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.get(`/public/satisfaction/verify/${bookingCode.trim()}`);
      setBookingInfo(res.data.data);
      setStep('form');
    } catch (err) {
      setError(err.response?.data?.message || 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (Object.values(ratings).some((r) => r === 0)) {
      setError('Mohon isi semua rating sebelum mengirim.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/public/satisfaction/submit', { booking_code: bookingCode.trim(), ...ratings, comment });
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengirim penilaian.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-600 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        <div className="flex flex-col items-center mb-6">
          <BrandLogo className="w-20 h-20 mb-3" iconSize={30} />
          <h1 className="text-lg font-bold text-slate-800 text-center">Penilaian Kepuasan Pelanggan</h1>
          <p className="text-xs text-slate-400 text-center">Mancung Motor Management System</p>
        </div>

        {step === 'code' && (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-sm text-slate-500 text-center">
              Masukkan kode booking test drive Anda untuk mulai memberikan penilaian.
            </p>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                required
                value={bookingCode}
                onChange={(e) => setBookingCode(e.target.value.toUpperCase())}
                placeholder="Contoh: TD-2026-001"
                className="w-full pl-9 pr-3 py-3 rounded-lg border border-slate-200 text-center tracking-wide font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg text-center">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-brand-600 hover:bg-brand-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-60">
              {loading && <Loader2 size={16} className="animate-spin" />} Cari Booking
            </button>
          </form>
        )}

        {step === 'form' && bookingInfo && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-slate-400">Nama:</span> <span className="font-medium">{bookingInfo.customer_name}</span></p>
              <p><span className="text-slate-400">Motor:</span> {bookingInfo.motor}</p>
              <p><span className="text-slate-400">Tanggal Test Drive:</span> {bookingInfo.booking_date}</p>
              <p><span className="text-slate-400">Sales:</span> {bookingInfo.sales_name}</p>
            </div>

            {RATING_LABELS.map((r) => (
              <div key={r.key} className="flex items-center justify-between">
                <p className="text-sm text-slate-600 flex-1 pr-3">{r.label}</p>
                <RatingStars value={ratings[r.key]} onChange={(v) => setRatings({ ...ratings, [r.key]: v })} size={22} />
              </div>
            ))}

            <textarea
              placeholder="Komentar / Saran (opsional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
            />

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg text-center">{error}</p>}

            <button type="submit" disabled={loading} className="w-full bg-brand-600 hover:bg-brand-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-60">
              {loading && <Loader2 size={16} className="animate-spin" />} Kirim Penilaian
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center text-center py-6 gap-3">
            <div className="p-4 bg-emerald-100 text-emerald-600 rounded-full">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="font-semibold text-slate-800">Terima kasih atas penilaian Anda</h2>
            <p className="text-sm text-slate-500">Masukan Anda sangat berarti bagi kami untuk terus meningkatkan pelayanan.</p>
          </div>
        )}
      </div>
    </div>
  );
}
