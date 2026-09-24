/**
 * Generate kode booking unik dengan format: TD-YYYY-XXX
 * Contoh: TD-2026-001
 */
function generateBookingCode(sequenceNumber, year = new Date().getFullYear()) {
  const padded = String(sequenceNumber).padStart(3, '0');
  return `TD-${year}-${padded}`;
}

module.exports = generateBookingCode;
