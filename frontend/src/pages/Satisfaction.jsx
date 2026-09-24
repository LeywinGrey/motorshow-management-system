import React, { useEffect, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { Card } from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import RatingStars from '../components/ui/RatingStars';
import Pagination from '../components/ui/Pagination';
import api from '../services/api';

export default function Satisfaction() {
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });

  const loadReviews = (page = 1) => {
    api.get('/satisfaction', { params: { page, limit: 10 } }).then((res) => {
      setReviews(res.data.data);
      setPagination(res.data.pagination);
    }).catch(() => {});
  };

  useEffect(() => { loadReviews(1); }, []);

  return (
    <MainLayout title="Kepuasan Pelanggan">
      <Card title="Hasil Penilaian Kepuasan Pelanggan">
        <DataTable
          columns={[
            { key: 'booking_code', label: 'Kode Booking' },
            { key: 'customer_name', label: 'Pelanggan' },
            { key: 'sales_name', label: 'Sales' },
            { key: 'sales_rating', label: 'Rating Pelayanan', render: (r) => <RatingStars value={r.sales_rating} readOnly size={14} /> },
            { key: 'booking_rating', label: 'Rating Booking', render: (r) => <RatingStars value={r.booking_rating} readOnly size={14} /> },
            { key: 'test_drive_rating', label: 'Rating Test Drive', render: (r) => <RatingStars value={r.test_drive_rating} readOnly size={14} /> },
            { key: 'overall_rating', label: 'Rating Keseluruhan', render: (r) => <RatingStars value={r.overall_rating} readOnly size={14} /> },
            { key: 'comment', label: 'Komentar', render: (r) => <span className="max-w-[200px] truncate block">{r.comment || '-'}</span> },
          ]}
          data={reviews}
        />
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={loadReviews} />
      </Card>
    </MainLayout>
  );
}
