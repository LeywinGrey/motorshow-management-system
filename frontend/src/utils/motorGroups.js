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
