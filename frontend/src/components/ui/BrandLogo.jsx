import React, { useState } from 'react';
import { Bike } from 'lucide-react';

// Logo Honda. File gambar diletakkan di: frontend/public/honda-logo.png
// Jika file belum ada, otomatis tampil ikon motor sebagai cadangan.
export default function BrandLogo({ className = 'w-10 h-10', iconSize = 20 }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`${className} bg-white border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden p-1 shrink-0`}>
      {failed ? (
        <Bike size={iconSize} className="text-red-600" />
      ) : (
        <img
          src="/honda-logo.png"
          alt="Logo Mancung Motor"
          onError={() => setFailed(true)}
          className="w-full h-full object-contain"
        />
      )}
    </div>
  );
}
