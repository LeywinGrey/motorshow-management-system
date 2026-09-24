import React from 'react';

// Komponen tabel data sederhana & reusable
// columns: [{ key, label, render? }]
export default function DataTable({ columns, data, emptyMessage = 'Tidak ada data.' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-100">
            {columns.map((col) => (
              <th key={col.key} className="py-2.5 px-3 font-medium whitespace-nowrap">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr key={row.id || idx} className="border-b border-slate-50 hover:bg-slate-50/70">
                {columns.map((col) => (
                  <td key={col.key} className="py-2.5 px-3 align-middle whitespace-nowrap">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
