import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import Login from './pages/Login';
import DashboardAdmin from './pages/admin/DashboardAdmin';
import DashboardSales from './pages/sales/DashboardSales';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Booking from './pages/Booking';
import Satisfaction from './pages/Satisfaction';
import Reports from './pages/Reports';
import UserManagement from './pages/UserManagement';
import PublicSatisfactionForm from './pages/public/PublicSatisfactionForm';
import ProtectedRoute from './components/layout/ProtectedRoute';

function DashboardRouter() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <DashboardAdmin /> : <DashboardSales />;
}

export default function App() {
  return (
    <Routes>
      {/* Halaman publik - tanpa login, khusus pelanggan */}
      <Route path="/penilaian" element={<PublicSatisfactionForm />} />

      {/* Login internal Admin/Sales */}
      <Route path="/login" element={<Login />} />

      {/* Halaman internal - butuh login */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/customers/:id" element={<ProtectedRoute><CustomerDetail /></ProtectedRoute>} />
      <Route path="/bookings" element={<ProtectedRoute><Booking /></ProtectedRoute>} />
      <Route path="/satisfaction" element={<ProtectedRoute><Satisfaction /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute roles={['admin']}><Reports /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute roles={['admin']}><UserManagement /></ProtectedRoute>} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
