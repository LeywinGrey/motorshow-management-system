const multer = require('multer');
const path = require('path');

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });

// Memory storage: file Excel hanya dibaca lalu dibuang (aman untuk Vercel yang filesystem-nya read-only).
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.xlsx') return cb(null, true);
    cb(badRequest('Hanya file Excel .xlsx yang diperbolehkan.'));
  },
});

// Ubah error multer (mis. file > 5 MB) menjadi respons 400 yang ramah.
const uploadExcel = {
  single: (field) => (req, res, next) => uploader.single(field)(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(badRequest('Ukuran file maksimal 5 MB.'));
    if (err instanceof multer.MulterError) return next(badRequest(err.message));
    return next(err);
  }),
};

module.exports = uploadExcel;
