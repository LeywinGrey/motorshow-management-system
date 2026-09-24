// Middleware penanganan error terpusat
function errorHandler(err, req, res, next) {
  console.error('Error:', err.message);

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'Data sudah ada (duplikat).' });
  }
  if (err.code && err.code.startsWith('ER_NO_REFERENCED_ROW')) {
    return res.status(400).json({ success: false, message: 'Data referensi tidak ditemukan.' });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Terjadi kesalahan pada server.',
  });
}

module.exports = errorHandler;
