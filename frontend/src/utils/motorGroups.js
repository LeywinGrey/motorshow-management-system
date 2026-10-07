export const STATUS_ORDER = ['Tersedia', 'Dibooking', 'Test Drive', 'Terjual'];

/**
 * Kelompokkan unit motor yang identik (tipe + tahun + warna + harga) menjadi satu baris.
 * Database tetap menyimpan satu baris per unit (karena status & booking per unit);
 * pengelompokan ini hanya untuk tampilan supaya tabel tidak ramai.
 */
export function groupMotors(motors) {
  const map = new Map();
  motors.forEach((m) => {
    const key = [
      String(m.model).trim().toLowerCase(),
      m.year,
      String(m.color).trim().toLowerCase(),
      Number(m.price),
    ].join('|');
    if (!map.has(key)) {
      map.set(key, { key, model: m.model, year: m.year, color: m.color, price: m.price, image: m.image, units: [] });
    }
    const g = map.get(key);
    g.units.push(m);
    if (!g.image && m.image) g.image = m.image;
  });

  return [...map.values()].map((g) => ({
    ...g,
    qty: g.units.length,
    statusCounts: STATUS_ORDER
      .map((status) => ({ status, count: g.units.filter((u) => u.status === status).length }))
      .filter((s) => s.count > 0),
  }));
}

/**
 * Opsi dropdown "pilih motor" yang ringkas: satu opsi per tipe (bukan per unit).
 * Setiap opsi menyimpan `unitId` = unit yang akan dipakai (diutamakan yang berstatus Tersedia),
 * karena booking/pelanggan di database tetap menunjuk ke unit tertentu.
 * hideSold: sembunyikan unit yang sudah Terjual (dipakai di form Booking).
 */
export function buildMotorOptions(motors, { hideSold = false } = {}) {
  return groupMotors(motors)
    .map((g) => {
      const pool = hideSold ? g.units.filter((u) => u.status !== 'Terjual') : g.units;
      if (pool.length === 0) return null;
      const tersedia = pool.filter((u) => u.status === 'Tersedia');
      const info = tersedia.length > 0 ? `${tersedia.length} unit tersedia` : 'tidak ada unit tersedia';
      return {
        key: g.key,
        unitId: (tersedia[0] || pool[0]).id,
        unitIds: g.units.map((u) => String(u.id)),
        label: `${g.model} • ${g.color} • ${g.year} (${info})`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label, 'id'));
}
