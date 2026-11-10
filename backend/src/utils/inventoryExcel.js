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
const COL_WIDTHS = [30, 6, 14, 36, 11, 18, 8, 17, 19, 14, 15, 12, 28];

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

  ws.addRow(['POSISI PERSEDIAAN MOTOR']);
  ws.addRow(['PT. MANCUNG MOTOR']);
  ws.addRow([`Tanggal ${todayStr}`]);
  ws.addRow([]);
  ws.addRow([]);
  ['A1:M1', 'A2:M2', 'A3:M3'].forEach((rg) => ws.mergeCells(rg));
  [1, 2, 3].forEach((r) => {
    const c = ws.getCell(`A${r}`);
    c.font = { bold: true, size: r === 1 ? 14 : 11 };
    c.alignment = { horizontal: 'center' };
  });

  const header = ws.addRow(HEADERS); // baris 6
  header.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4393F' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  rows.forEach((m) => {
    ws.addRow([
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
  });

  COL_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: 6 }];
  return wb;
}

module.exports = { HEADERS, FIELD_ORDER, parseInventoryWorkbook, buildInventoryWorkbook };
