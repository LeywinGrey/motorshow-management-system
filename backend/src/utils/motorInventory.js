/**
 * Validasi & normalisasi data unit motor (Inventory) - dipakai oleh CRUD dan Import Excel.
 * Nama field = nama kolom database.
 */
const { isValidYear } = require('./validators');

const STATUS_VALUES = ['Tersedia', 'Dibooking', 'Test Drive', 'Terjual'];

const LABELS = {
  channel: 'Channel',
  channel_no: 'No.',
  type_code: 'Tipe Motor',
  model: 'Nama Tipe Motor',
  color_code: 'Kode Warna',
  color: 'Warna',
  year: 'Tahun',
  engine_number: 'Nomor Mesin',
  frame_number: 'Nomor Rangka',
  purchase_date: 'Tanggal Beli',
  display_date: 'Tanggal Display',
  gesekan: 'Gesekan',
  supplier: 'Supplier',
  status: 'Status',
  price: 'Harga',
};

const MAX_LEN = {
  channel: 100, type_code: 30, model: 100, color_code: 10, color: 50,
  engine_number: 30, frame_number: 30, gesekan: 100, supplier: 100,
};

// Wajib diisi saat tambah unit / setiap baris import. No., Tanggal Display, Gesekan boleh kosong.
const REQUIRED = [
  'channel', 'type_code', 'model', 'color_code', 'color', 'year',
  'engine_number', 'frame_number', 'purchase_date', 'supplier',
];

const TEXT_FIELDS = ['channel', 'type_code', 'model', 'color_code', 'color', 'engine_number', 'frame_number', 'gesekan', 'supplier'];
const DATE_FIELDS = ['purchase_date', 'display_date'];

const pad = (n) => String(n).padStart(2, '0');

function buildIso(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1990 || y > 2100) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Terima 'DD/MM/YYYY', 'DD-MM-YYYY', 'YYYY-MM-DD', Date, atau serial Excel -> 'YYYY-MM-DD'. */
function normalizeDate(v) {
  if (v === undefined || v === null || v === '') return { value: null };
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return { error: true };
    const iso = buildIso(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
    return iso ? { value: iso } : { error: true };
  }
  if (typeof v === 'number') {
    const dt = new Date(Math.round((v - 25569) * 86400000));
    const iso = buildIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    return iso ? { value: iso } : { error: true };
  }
  const s = String(v).trim();
  if (!s) return { value: null };
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const iso = buildIso(Number(m[3]), Number(m[2]), Number(m[1])); // hari-bulan-tahun
    return iso ? { value: iso } : { error: true };
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (m) {
    const iso = buildIso(Number(m[1]), Number(m[2]), Number(m[3]));
    return iso ? { value: iso } : { error: true };
  }
  return { error: true };
}

/**
 * @param {object} input  data mentah
 * @param {{partial?: boolean}} opts partial=true -> hanya validasi field yang dikirim (update)
 * @returns {{data: object, errors: {field: string, message: string}[]}}
 */
function validateMotorPayload(input = {}, { partial = false } = {}) {
  const data = {};
  const errors = [];
  const err = (field, message) => errors.push({ field, message });
  const present = (f) => input[f] !== undefined;

  for (const f of TEXT_FIELDS) {
    if (partial && !present(f)) continue;
    const v = input[f] === undefined || input[f] === null ? '' : String(input[f]).trim();
    if (!v) {
      if (REQUIRED.includes(f)) err(f, `${LABELS[f]} wajib diisi.`);
      else data[f] = null;
      continue;
    }
    if (v.length > MAX_LEN[f]) { err(f, `${LABELS[f]} maksimal ${MAX_LEN[f]} karakter.`); continue; }
    data[f] = v;
  }

  if (!partial || present('year')) {
    const raw = input.year === undefined || input.year === null ? '' : String(input.year).trim();
    if (!raw) err('year', 'Tahun wajib diisi.');
    else if (!/^\d{4}$/.test(raw) || !isValidYear(raw)) err('year', 'Tahun tidak valid.');
    else data.year = Number(raw);
  }

  for (const f of DATE_FIELDS) {
    if (partial && !present(f)) continue;
    const { value, error } = normalizeDate(input[f]);
    if (error) err(f, `${LABELS[f]} tidak valid (gunakan DD/MM/YYYY).`);
    else if (value === null && REQUIRED.includes(f)) err(f, `${LABELS[f]} wajib diisi.`);
    else data[f] = value;
  }

  if (present('channel_no')) {
    const raw = input.channel_no === null ? '' : String(input.channel_no).trim();
    if (raw === '') data.channel_no = null;
    else if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 1000000) err('channel_no', 'No. harus berupa angka bulat positif.');
    else data.channel_no = Number(raw);
  }

  if (present('status') && String(input.status).trim() !== '') {
    if (!STATUS_VALUES.includes(input.status)) err('status', `Status harus salah satu dari: ${STATUS_VALUES.join(', ')}.`);
    else data.status = input.status;
  }

  if (present('price')) {
    const raw = input.price === null ? '' : String(input.price).trim();
    if (raw === '') data.price = null;
    else if (Number.isNaN(Number(raw)) || Number(raw) <= 0) err('price', 'Harga harus berupa angka positif.');
    else data.price = Number(raw);
  }

  return { data, errors };
}

module.exports = { STATUS_VALUES, LABELS, REQUIRED, MAX_LEN, normalizeDate, validateMotorPayload };
