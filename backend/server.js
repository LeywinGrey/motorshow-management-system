const app = require('./src/app');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🏍️  MotorShow Management System API berjalan di http://localhost:${PORT}`);
});
