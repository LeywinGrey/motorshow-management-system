import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Bike, Users, GitBranch, CalendarClock, Star, FileBarChart, UserCog,
} from 'lucide-react';
import BrandLogo from '../ui/BrandLogo';
import { useAuth } from '../../context/AuthContext';

const adminMenu = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/inventory', label: 'Inventory Motor', icon: Bike },
  { to: '/customers', label: 'Data Pelanggan', icon: Users },
  { to: '/bookings', label: 'Booking Test Drive', icon: CalendarClock },
  { to: '/satisfaction', label: 'Kepuasan Pelanggan', icon: Star },
  { to: '/reports', label: 'Laporan', icon: FileBarChart },
  { to: '/users', label: 'Manajemen Pengguna', icon: UserCog },
];

const salesMenu = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/inventory', label: 'Inventory Motor', icon: Bike },
  { to: '/customers', label: 'Data Pelanggan', icon: Users },
  { to: '/bookings', label: 'Booking Test Drive', icon: CalendarClock },
  { to: '/satisfaction', label: 'Kepuasan Pelanggan', icon: Star },
];

export default function Sidebar() {
  const { user } = useAuth();
  const menu = user?.role === 'admin' ? adminMenu : salesMenu;

  return (
    <aside className="w-64 bg-white border-r border-slate-100 h-screen sticky top-0 flex flex-col">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-100">
        <BrandLogo className="w-11 h-11" />
        <div>
          <p className="font-bold text-slate-800 leading-tight text-sm">Mancung Motor</p>
          <p className="text-[11px] text-slate-400 leading-tight">Management System</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menu.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-slate-100 text-[11px] text-slate-400">
        Mancung Motor Management System<br />Kerja Praktik &copy; {new Date().getFullYear()}
      </div>
    </aside>
  );
}
