/**
 * Validasi & normalisasi data unit motor Inventory (13 kolom template STOK UNIT MM.xlsx).
 * Murni (tanpa akses DB) supaya bisa dipakai controller, import, dan CLI.
 */

// field API (snake_case) -> label kolom Excel
const FIELD_LABELS = {
  channel: 'Channel',
  channel_no: 'No.',
  type_code: 'Tipe Motor',
  model: 'Nama Tipe Motor',
  color_code: 'Kode Warna',
  color: 'Warna',
  year: 'Tahun',
  engine_number: 'Nomor Mesin',
  chassis_number: 'Nomor Rangka',
  purchase_date: 'Tanggal Beli',
  display_date: 'Tanggal Display',
  friction: 'Gesekan',
  supplier: 'Supplier',
};

const MAX_LEN = {
  channel: 100, type_code: 30, model: 100, color_code: 20, color: 50,
  engine_number: 40, chassis_number: 40, friction: 100, supplier: 100,
};

// Wajib diisi. Tanggal Display & Gesekan boleh kosong (Gesekan memang kosong di seluruh Excel).
const REQUIRED = [
  'channel', 'type_code', 'model', 'color_code', 'color', 'year',
  'engine_number', 'chassis_number', 'purchase_date', 'supplier',
];
const TEXT_FIELDS = ['channel', 'type_code', 'model', 'color_code', 'color', 'engine_number', 'chassis_number', 'friction', 'supplier'];
const DATE_FIELDS = ['purchase_date', 'display_date'];
const MOTOR_STATUSES = ['Tersedia', 'Dibooking', 'Test Drive', 'Terjual'];
const ALL_FIELDS = Object.keys(FIELD_LABELS);

const pad = (n) => String(n).padStart(2, '0');

/**
 * Terima "dd/mm/yyyy" (format Excel/Indonesia) atau "yyyy-mm-dd" (input type=date / MySQL).
 * Mengembalikan "yyyy-mm-dd" atau null bila tidak valid (termasuk tanggal yang tidak ada, mis. 31/02).
 */
function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();
  let d; let m; let y;
  let match = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (match) { [, d, m, y] = match; } else {
    match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
    if (!match) return null;
    [, y, m, d] = match;
  }
  const day = Number(d); const month = Number(m); const year = Number(y);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const blank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/**
 * @param raw     objek dengan key snake_case (lihat FIELD_LABELS)
 * @param options { partial: true } -> hanya validasi key yang dikirim (untuk PUT)
 * @returns { data, errors }  data hanya berisi field yang divalidasi, siap dipakai INSERT/UPDATE
 */
function validateMotor(raw = {}, { partial = false } = {}) {
  const data = {};
  const errors = [];
  const has = (f) => Object.prototype.hasOwnProperty.call(raw, f);

  for (const f of ALL_FIELDS) {
    if (partial && !has(f)) continue;
    const label = FIELD_LABELS[f];
    const v = raw[f];

    if (f === 'channel_no') {
      if (blank(v)) { data.channel_no = null; continue; }
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1) errors.push(`${label} harus berupa angka bulat >= 1`);
      else data.channel_no = n;
      continue;
    }

    if (f === 'year') {
      if (blank(v)) { errors.push(`${label} wajib diisi`); continue; }
      const y = Number(String(v).trim());
      const maxYear = new Date().getFullYear() + 1;
      if (!Number.isInteger(y) || y < 1990 || y > maxYear) errors.push(`${label} tidak valid (1990-${maxYear})`);
      else data.year = y;
      continue;
    }

    if (DATE_FIELDS.includes(f)) {
      if (blank(v)) {
        if (REQUIRED.includes(f)) errors.push(`${label} wajib diisi`);
        else data[f] = null;
        continue;
      }
      const iso = parseDate(v);
      if (!iso) errors.push(`${label} tidak valid (gunakan format dd/mm/yyyy)`);
      else data[f] = iso;
      continue;
    }

    // Field teks. Hanya di-trim: Nomor Mesin/Rangka & nama Channel/Supplier TIDAK diubah isinya.
    if (blank(v)) {
      if (REQUIRED.includes(f)) errors.push(`${label} wajib diisi`);
      else data[f] = null;
      continue;
    }
    const str = String(v).trim();
    if (str.length > MAX_LEN[f]) errors.push(`${label} maksimal ${MAX_LEN[f]} karakter`);
    else data[f] = str;
  }

  if (has('status') && !blank(raw.status)) {
    if (!MOTOR_STATUSES.includes(raw.status)) errors.push(`Status harus salah satu dari: ${MOTOR_STATUSES.join(', ')}`);
    else data.status = raw.status;
  }

  if (raw.price !== undefined && raw.price !== null && raw.price !== '') {
    if (Number.isNaN(Number(raw.price)) || Number(raw.price) < 0) errors.push('Harga harus berupa angka positif');
    else data.price = Number(raw.price);
  }

  if (data.purchase_date && data.display_date && data.display_date < data.purchase_date) {
    errors.push('Tanggal Display tidak boleh lebih awal dari Tanggal Beli');
  }

  return { data, errors };
}

module.exports = { FIELD_LABELS, REQUIRED, ALL_FIELDS, MOTOR_STATUSES, parseDate, validateMotor };
