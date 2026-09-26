export const GST_STATES = [
  { code: '24', name: 'Gujarat' },
  { code: '27', name: 'Maharashtra' },
  { code: '08', name: 'Rajasthan' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '29', name: 'Karnataka' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '07', name: 'Delhi' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '19', name: 'West Bengal' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' }
];

export function getStateFromGstin(gstin) {
  if (!gstin || gstin.length < 2) return null;
  const code = gstin.slice(0, 2);
  const found = GST_STATES.find((s) => s.code === code);
  return found || { code, name: 'Other State' };
}

export function isInterstateSupply(originCode = '24', destCode) {
  return String(originCode).trim() !== String(destCode).trim();
}
