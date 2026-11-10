const app = require('./src/app');

// Dijalankan langsung (npm run dev / npm start) -> buka port lokal.
// Di Vercel file ini hanya di-require, sehingga blok ini tidak aktif.
if (require.main === module) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`API berjalan di http://localhost:${port}`));
}

module.exports = app;
