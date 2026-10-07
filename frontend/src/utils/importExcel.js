/**
 * Utility import Excel untuk data Motor - vanilla JavaScript.
 * Memakai SheetJS (window.XLSX) yang sudah dimuat lewat <script> di index.html,
 * sama seperti utils/exportExcel.js.
 *
 * Alur:
 * 1. downloadMotorTemplate()  -> unduh template .xlsx berisi header + contoh + petunjuk
 * 2. readExcelRows(file)      -> baca file Excel/CSV menjadi array of object (per baris)
 * 3. validateMotorRows(rows)  -> normalisasi & validasi tiap baris sebelum dikirim ke server
 */

export const MOTOR_STATUS_OPTIONS = ['Tersedia', 'Dibooking', 'Test Drive', 'Terjual'];
export const MAX_IMPORT_ROWS = 500;

const TEMPLATE_HEADERS = ['Merek', 'Tipe/Model', 'Tahun', 'Warna', 'Harga (Rp)', 'Status'];

// Nama kolom yang diterima (sudah dinormalisasi: huruf kecil, tanpa spasi/simbol).
// Dengan begitu file hasil "Export Excel" juga bisa langsung di-import kembali.
const HEADER_ALIASES = {
  brand: ['merek', 'brand'],
  model: ['tipemodel', 'tipe', 'model'],
  year: ['tahun', 'year'],
  color: ['warna', 'color'],
  price: ['hargarp', 'harga', 'price'],
  status: ['status'],
};

const normalizeHeader = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function pick(row, field) {
  const aliases = HEADER_ALIASES[field];
  const key = Object.keys(row).find((k) => aliases.includes(normalizeHeader(k)));
  return key === undefined ? '' : row[key];
}

function requireXlsx() {
  if (!window.XLSX) {
    throw new Error('Modul Excel belum siap dimuat. Silakan refresh halaman dan coba lagi.');
  }
  return window.XLSX;
}

/** Unduh template Excel untuk import data motor. */
export function downloadMotorTemplate() {
  const XLSX = requireXlsx();

  const dataSheet = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ['Honda', 'Vario 160', 2025, 'Hitam', 28500000, 'Tersedia'],
    ['Yamaha', 'NMAX 155', 2025, 'Abu-abu', 33000000, 'Tersedia'],
  ]);
  dataSheet['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];

  const guideSheet = XLSX.utils.aoa_to_sheet([
    ['PETUNJUK PENGISIAN'],
    [''],
    ['1. Isi data pada sheet "Data Motor", satu motor per baris, mulai dari baris ke-2.'],
    ['2. HAPUS 2 baris contoh (Vario 160 & NMAX 155) sebelum diupload, atau ganti dengan data Anda.'],
    ['3. Jangan mengubah nama kolom pada baris pertama.'],
    [`4. Maksimal ${MAX_IMPORT_ROWS} baris per sekali import.`],
    [''],
    ['Kolom', 'Wajib?', 'Keterangan'],
    ['Merek', 'Ya', 'Contoh: Honda, Yamaha, Suzuki, Kawasaki, Vespa'],
    ['Tipe/Model', 'Ya', 'Contoh: Vario 160'],
    ['Tahun', 'Ya', 'Angka 4 digit, contoh: 2025'],
    ['Warna', 'Ya', 'Contoh: Hitam'],
    ['Harga (Rp)', 'Ya', 'Angka saja tanpa titik/koma, contoh: 28500000'],
    ['Status', 'Tidak', `Salah satu dari: ${MOTOR_STATUS_OPTIONS.join(', ')}. Kosong = Tersedia`],
    [''],
    ['Catatan: foto motor tidak bisa di-import lewat Excel. Tambahkan lewat tombol Edit pada daftar motor.'],
  ]);
  guideSheet['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 70 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Data Motor');
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Petunjuk');
  XLSX.writeFile(workbook, 'template-import-motor.xlsx');
}

/** Baca file .xlsx / .xls / .csv menjadi array of object. */
export function readExcelRows(file) {
  return new Promise((resolve, reject) => {
    let XLSX;
    try { XLSX = requireXlsx(); } catch (err) { reject(err); return; }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File tidak dapat dibaca.'));
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const sheetName = workbook.SheetNames.includes('Data Motor') ? 'Data Motor' : workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', blankrows: false });
        resolve(rows);
      } catch (err) {
        reject(new Error('Format file tidak valid. Gunakan file .xlsx, .xls, atau .csv.'));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function parsePrice(value) {
  if (typeof value === 'number') return value;
  const digits = String(value ?? '').replace(/[^0-9]/g, ''); // "Rp 28.500.000" -> 28500000
  return digits ? Number(digits) : NaN;
}

/**
 * Validasi & normalisasi baris hasil baca Excel.
 * Return: [{ rowNumber, data: {brand, model, year, color, price, status}, errors: [] }]
 * rowNumber = nomor baris di Excel (baris 1 = header).
 */
export function validateMotorRows(rawRows) {
  const maxYear = new Date().getFullYear() + 1;

  return rawRows.map((raw, idx) => {
    const errors = [];

    const brand = String(pick(raw, 'brand')).trim();
    const model = String(pick(raw, 'model')).trim();
    const color = String(pick(raw, 'color')).trim();
    const year = Number(pick(raw, 'year'));
    const price = parsePrice(pick(raw, 'price'));
    const statusRaw = String(pick(raw, 'status')).trim();

    if (!brand) errors.push('Merek kosong');
    if (!model) errors.push('Tipe/Model kosong');
    if (!color) errors.push('Warna kosong');
    if (!Number.isInteger(year) || year < 1950 || year > maxYear) errors.push(`Tahun tidak valid (1950-${maxYear})`);
    if (!Number.isFinite(price) || price <= 0) errors.push('Harga tidak valid');

    let status = 'Tersedia';
    if (statusRaw) {
      const found = MOTOR_STATUS_OPTIONS.find((s) => s.toLowerCase() === statusRaw.toLowerCase());
      if (found) status = found;
      else errors.push(`Status "${statusRaw}" tidak dikenal`);
    }

    return { rowNumber: idx + 2, data: { brand, model, year, color, price, status }, errors };
  });
}
