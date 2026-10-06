/**
 * Utility export Excel - vanilla JavaScript, tidak bergantung pada React.
 * Menggunakan library SheetJS (window.XLSX) yang dimuat lewat <script> tag
 * di index.html, supaya mudah dipahami: cukup panggil fungsi exportToExcel()
 * dengan data array of object + nama file yang diinginkan.
 *
 * Cara kerja (murni HTML/CSS/JS, tanpa dependency React):
 * 1. Ubah data (array of object) menjadi worksheet dengan XLSX.utils.json_to_sheet
 * 2. Bungkus worksheet ke dalam workbook
 * 3. Simpan/unduh workbook sebagai file .xlsx dengan XLSX.writeFile
 */

export function exportToExcel(rows, fileName = 'export', sheetName = 'Sheet1') {
  if (!window.XLSX) {
    alert('Modul export Excel belum siap dimuat. Silakan refresh halaman dan coba lagi.');
    return;
  }
  if (!rows || rows.length === 0) {
    alert('Tidak ada data untuk diexport.');
    return;
  }

  const worksheet = window.XLSX.utils.json_to_sheet(rows);

  // Atur lebar kolom otomatis secara sederhana berdasarkan panjang teks terpanjang per kolom
  const columnKeys = Object.keys(rows[0]);
  worksheet['!cols'] = columnKeys.map((key) => {
    const maxLength = rows.reduce((max, row) => {
      const value = row[key] == null ? '' : String(row[key]);
      return Math.max(max, value.length);
    }, key.length);
    return { wch: Math.min(Math.max(maxLength + 2, 10), 40) };
  });

  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const today = new Date().toISOString().slice(0, 10);
  window.XLSX.writeFile(workbook, `${fileName}-${today}.xlsx`);
}
