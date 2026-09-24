import React, { useState } from 'react';
import { LogOut, ChevronDown, UserCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ title }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-30">
      <h1 className="font-semibold text-lg text-slate-800">{title}</h1>
      <div className="relative">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm">
          <UserCircle2 size={28} className="text-slate-400" />
          <div className="text-left hidden sm:block">
            <p className="font-medium text-slate-700 leading-tight">{user?.name}</p>
            <p className="text-xs text-slate-400 leading-tight capitalize">{user?.role}</p>
          </div>
          <ChevronDown size={16} className="text-slate-400" />
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-44 bg-white rounded-lg shadow-lg border border-slate-100 py-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut size={16} /> Keluar
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
