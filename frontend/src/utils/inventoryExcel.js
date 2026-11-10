/**
 * Utilitas Excel untuk modul Inventory (format template "STOK UNIT MM.xlsx").
 * Memakai SheetJS (window.XLSX) yang sudah dimuat lewat <script> di index.html,
 * sama seperti utils/exportExcel.js, sehingga tidak ada dependency baru.
 *
 * Struktur template:
 *   baris 1-3 : judul laporan (POSISI PERSEDIAAN MOTOR / PT. MANCUNG MOTOR / Tanggal ...)
 *   baris 6   : header 13 kolom
 *   baris 7+  : data (1 baris = 1 unit motor)
 */

export const INVENTORY_HEADERS = [
  'Channel', 'No.', 'Tipe Motor', 'Nama Tipe Motor', 'Kode Warna', 'Warna', 'Tahun',
  'Nomor Mesin', 'Nomor Rangka', 'Tanggal Beli', 'Tanggal Display', 'Gesekan', 'Supplier',
];

// urutan sama dengan INVENTORY_HEADERS
export const INVENTORY_FIELDS = [
  'channel', 'channel_no', 'type_code', 'model', 'color_code', 'color', 'year',
  'engine_number', 'chassis_number', 'purchase_date', 'display_date', 'friction', 'supplier',
];

export const MAX_IMPORT_ROWS = 2000; // sama dengan batas di backend
const DATE_FIELDS = ['purchase_date', 'display_date'];
const REQUIRED_HEADERS = INVENTORY_FIELDS.filter((f) => f !== 'friction' && f !== 'display_date' && f !== 'channel_no');

const normalizeHeader = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const HEADER_TO_FIELD = Object.fromEntries(INVENTORY_HEADERS.map((h, i) => [normalizeHeader(h), INVENTORY_FIELDS[i]]));

const pad = (n) => String(n).padStart(2, '0');

/** "2026-09-17" -> "17/09/2026" (format tampilan & Excel). Nilai kosong -> "". */
export function formatDateID(value) {
  if (!value) return '';
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value);
}

/** Konversi sel tanggal Excel (teks dd/mm/yyyy, nomor seri Excel, atau Date) menjadi teks dd/mm/yyyy. */
function cellToDateText(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return `${pad(v.getDate())}/${pad(v.getMonth() + 1)}/${v.getFullYear()}`;
  if (typeof v === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000); // epoch Excel
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  }
  return String(v).trim();
}

const cellToText = (v) => (v === null || v === undefined ? '' : String(v).trim());

/**
 * Ubah array-of-arrays hasil baca sheet menjadi baris siap kirim ke API.
 * @param aoa       array of arrays (sheet_to_json dengan header:1)
 * @param firstRow  nomor baris Excel dari aoa[0] (default 1)
 * @returns { rows: [{ row, ...fields }], headerRow }
 */
export function parseInventoryAoa(aoa, firstRow = 1) {
  const headerIdx = aoa.slice(0, 30).findIndex((r) => {
    const cells = (r || []).map(normalizeHeader);
    return cells.includes('nomormesin') && cells.includes('channel');
  });
  if (headerIdx === -1) {
    throw new Error('Header kolom tidak ditemukan. Gunakan format "STOK UNIT MM.xlsx" (kolom Channel, No., Tipe Motor, ..., Supplier).');
  }

  const colOf = {};
  (aoa[headerIdx] || []).forEach((cell, idx) => {
    const field = HEADER_TO_FIELD[normalizeHeader(cell)];
    if (field && colOf[field] === undefined) colOf[field] = idx;
  });
  const missing = REQUIRED_HEADERS.filter((f) => colOf[f] === undefined)
    .map((f) => INVENTORY_HEADERS[INVENTORY_FIELDS.indexOf(f)]);
  if (missing.length) throw new Error(`Kolom wajib tidak ditemukan: ${missing.join(', ')}.`);

  const rows = [];
  for (let i = headerIdx + 1; i < aoa.length; i += 1) {
    const r = aoa[i] || [];
    if (r.every((c) => c === null || c === undefined || String(c).trim() === '')) continue; // baris kosong
    const item = { row: firstRow + i };
    INVENTORY_FIELDS.forEach((f) => {
      const v = colOf[f] === undefined ? null : r[colOf[f]];
      item[f] = DATE_FIELDS.includes(f) ? cellToDateText(v) : cellToText(v);
    });
    rows.push(item);
  }
  return { rows, headerRow: firstRow + headerIdx };
}

function requireXlsx() {
  if (!window.XLSX) throw new Error('Modul Excel belum siap dimuat. Silakan refresh halaman dan coba lagi.');
  return window.XLSX;
}

/** Baca file .xlsx / .xls / .csv, cari sheet yang berisi header Inventory. */
export function readInventoryFile(file) {
  return new Promise((resolve, reject) => {
    let XLSX;
    try { XLSX = requireXlsx(); } catch (err) { reject(err); return; }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File tidak dapat dibaca.'));
    reader.onload = (e) => {
      let workbook;
      try {
        workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      } catch (err) {
        reject(new Error('Format file tidak valid. Gunakan file .xlsx, .xls, atau .csv.'));
        return;
      }
      let lastError = null;
      for (const name of workbook.SheetNames) {
        const ws = workbook.Sheets[name];
        if (!ws || !ws['!ref']) continue;
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
        const firstRow = XLSX.utils.decode_range(ws['!ref']).s.r + 1;
        try {
          resolve(parseInventoryAoa(aoa, firstRow));
          return;
        } catch (err) { lastError = err; }
      }
      reject(lastError || new Error('File kosong.'));
    };
    reader.readAsArrayBuffer(file);
  });
}

function buildSheet(XLSX, dataRows) {
  const today = formatDateID(new Date().toISOString().slice(0, 10));
  const ws = XLSX.utils.aoa_to_sheet([
    ['POSISI PERSEDIAAN MOTOR'],
    ['PT. MANCUNG MOTOR'],
    [`Tanggal ${today}`],
    [],
    [],
    INVENTORY_HEADERS,
    ...dataRows,
  ]);
  ws['!cols'] = [
    { wch: 28 }, { wch: 6 }, { wch: 12 }, { wch: 34 }, { wch: 11 }, { wch: 16 }, { wch: 8 },
    { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 15 }, { wch: 12 }, { wch: 28 },
  ];
  return ws;
}

/** Unduh template kosong (judul + header 13 kolom) untuk import. */
export function downloadInventoryTemplate() {
  const XLSX = requireXlsx();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(XLSX, []), 'Sheet1');
  XLSX.writeFile(wb, 'TEMPLATE STOK UNIT MM.xlsx');
}

/** Export data Inventory ke Excel dengan struktur yang sama dengan template (bisa di-import kembali). */
export function exportInventoryToExcel(motors) {
  const XLSX = requireXlsx();
  const dataRows = motors.map((m) => [
    m.channel ?? '',
    m.channel_no ?? '',
    m.type_code ?? '',
    m.model ?? '',
    m.color_code ?? '',
    m.color ?? '',
    m.year != null ? String(m.year) : '',
    m.engine_number ?? '',
    m.chassis_number ?? '',
    formatDateID(m.purchase_date),
    formatDateID(m.display_date),
    m.friction ?? '',
    m.supplier ?? '',
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(XLSX, dataRows), 'Sheet1');
  XLSX.writeFile(wb, `STOK UNIT MM-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
