const isValidEmail = (email) => {
  if (!email) return true; // email opsional di beberapa form
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidPhone = (phone) => {
  // Nomor HP Indonesia: 08xxxxxxxxxx atau +62xxxxxxxxxx, 9-14 digit
  return /^(\+62|62|0)8[1-9][0-9]{6,10}$/.test(phone);
};

const isValidYear = (year) => {
  const y = Number(year);
  const currentYear = new Date().getFullYear();
  return Number.isInteger(y) && y >= 1990 && y <= currentYear + 1;
};

const isValidPrice = (price) => {
  return !isNaN(price) && Number(price) > 0;
};

const isValidRating = (rating) => {
  const r = Number(rating);
  return Number.isInteger(r) && r >= 1 && r <= 5;
};

module.exports = { isValidEmail, isValidPhone, isValidYear, isValidPrice, isValidRating };
