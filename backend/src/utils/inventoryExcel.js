/**
 * Baca & tulis file Excel Inventory dengan format template "STOK UNIT MM.xlsx":
 *   Baris 1-3 : judul (POSISI PERSEDIAAN MOTOR / PT. MANCUNG MOTOR / Tanggal dd/mm/yyyy)
 *   Baris 6   : header 13 kolom
 *   Baris 7+  : data (1 baris = 1 unit)
 */
const ExcelJS = require('exceljs');

const HEADERS = [
  'Channel', 'No.', 'Tipe Motor', 'Nama Tipe Motor', 'Kode Warna', 'Warna', 'Tahun',
  'Nomor Mesin', 'Nomor Rangka', 'Tanggal Beli', 'Tanggal Display', 'Gesekan', 'Supplier',
];
const FIELD_ORDER = [
  'channel', 'channel_no', 'type_code', 'model', 'color_code', 'color', 'year',
  'engine_number', 'frame_number', 'purchase_date', 'display_date', 'gesekan', 'supplier',
];
// Lebar kolom mengikuti STOK UNIT MM.xlsx (sedikit dilebarkan agar teks tidak terpotong)
const COL_WIDTHS = [30, 6, 12, 36, 12, 18, 8, 16, 18, 14, 16, 10, 28];

// header yang dinormalisasi (huruf kecil, tanpa spasi/simbol) -> field
const HEADER_ALIASES = {
  channel: ['channel'],
  channel_no: ['no', 'nomor', 'nomorurut'],
  type_code: ['tipemotor'],
  model: ['namatipemotor'],
  color_code: ['kodewarna'],
  color: ['warna'],
  year: ['tahun'],
  engine_number: ['nomormesin'],
  frame_number: ['nomorrangka'],
  purchase_date: ['tanggalbeli'],
  display_date: ['tanggaldisplay'],
  gesekan: ['gesekan'],
  supplier: ['supplier'],
};

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Ubah nilai sel ExcelJS menjadi nilai biasa (string/number/Date/null). */
function cellValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.result !== undefined) return cellValue(v.result);
    if (v.text !== undefined) return cellValue(v.text);
    if (v.hyperlink) return String(v.text ?? v.hyperlink);
    return null;
  }
  if (typeof v === 'string') return v.trim() === '' ? null : v;
  return v;
}

/**
 * @returns {Promise<{rows: {rowNumber:number, raw:object}[], sheetName:string}>}
 * @throws Error dengan pesan yang ramah jika format tidak sesuai
 */
async function parseInventoryWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (e) {
    throw new Error('File tidak dapat dibaca. Gunakan file Excel .xlsx sesuai template STOK UNIT MM.');
  }

  for (const ws of wb.worksheets) {
    let headerRow = null;
    let map = null;
    const limit = Math.min(ws.rowCount, 30);
    for (let r = 1; r <= limit && !headerRow; r += 1) {
      const found = {};
      ws.getRow(r).eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const key = norm(cellValue(cell.value));
        for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
          if (aliases.includes(key) && found[field] === undefined) found[field] = colNumber;
        }
      });
      if (found.engine_number && found.frame_number) { headerRow = r; map = found; }
    }
    if (!headerRow) continue;

    const missing = FIELD_ORDER.filter((f) => f !== 'channel_no' && f !== 'gesekan' && f !== 'display_date' && !map[f]);
    if (missing.length) {
      const names = missing.map((f) => HEADERS[FIELD_ORDER.indexOf(f)]).join(', ');
      throw new Error(`Kolom wajib tidak ditemukan pada header: ${names}.`);
    }

    const rows = [];
    for (let r = headerRow + 1; r <= ws.rowCount; r += 1) {
      const row = ws.getRow(r);
      const raw = {};
      let hasData = false;
      for (const [field, col] of Object.entries(map)) {
        const val = cellValue(row.getCell(col).value);
        raw[field] = val;
        if (val !== null && String(val).trim() !== '') hasData = true;
      }
      if (hasData) rows.push({ rowNumber: r, raw });
    }
    return { rows, sheetName: ws.name };
  }
  throw new Error('Header tidak ditemukan. Pastikan file memiliki kolom "Nomor Mesin" dan "Nomor Rangka" seperti template STOK UNIT MM.');
}

const fmtDate = (iso) => {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
};

/** Buat workbook dengan layout yang sama seperti template. rows = baris dari tabel motorcycles. */
async function buildInventoryWorkbook(rows = []) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  const FONT = 'Calibri';

  // Baris 1-3: judul (sama seperti file STOK UNIT MM.xlsx)
  ['POSISI PERSEDIAAN MOTOR', 'PT. MANCUNG MOTOR', `Tanggal ${todayStr}`].forEach((t, i) => {
    ws.addRow([t]);
    ws.mergeCells(`A${i + 1}:M${i + 1}`);
    const c = ws.getCell(`A${i + 1}`);
    c.font = { name: FONT, size: 12, bold: true };
    c.alignment = { horizontal: 'center' };
    ws.getRow(i + 1).height = 15.6;
  });
  ws.addRow([]);
  ws.addRow([]);

  // Baris 6: header hijau muda, tebal, rata tengah, border tipis
  const thin = { style: 'thin', color: { argb: 'FF000000' } };
  const header = ws.addRow(HEADERS);
  header.height = 30;
  header.eachCell((c) => {
    c.font = { name: FONT, size: 11, bold: true, color: { argb: 'FF000000' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0FFC0' } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = { top: thin, left: thin, bottom: thin, right: thin };
  });

  // Baris 7+: data polos (Calibri 11, tanpa border)
  rows.forEach((m) => {
    const row = ws.addRow([
      m.channel ?? null,
      m.channel_no ?? null,
      m.type_code ?? null,
      m.model ?? null,
      m.color_code ?? null,
      m.color ?? null,
      m.year != null ? String(m.year) : null, // template menyimpan Tahun sebagai teks
      m.engine_number ?? null,
      m.frame_number ?? null,
      fmtDate(m.purchase_date),                // tanggal sebagai teks DD/MM/YYYY seperti template
      fmtDate(m.display_date),
      m.gesekan ?? null,
      m.supplier ?? null,
    ]);
    row.eachCell({ includeEmpty: true }, (c) => { c.font = { name: FONT, size: 11 }; });
  });

  COL_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: 6 }];
  return wb;
}

module.exports = { HEADERS, FIELD_ORDER, parseInventoryWorkbook, buildInventoryWorkbook };
