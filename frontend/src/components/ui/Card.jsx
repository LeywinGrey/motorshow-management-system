import React from 'react';

export function StatCard({ icon: Icon, label, value, color = 'bg-brand-50 text-brand-600' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4 shadow-sm">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-semibold text-slate-800">{value ?? '-'}</p>
      </div>
    </div>
  );
}

export function Card({ title, action, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-100 shadow-sm p-4 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h3 className="font-semibold text-slate-800">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
