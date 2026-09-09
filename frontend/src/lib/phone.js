export const countryOptions = [
  { label: "Ghana", code: "+233", placeholder: "53 714 4161", length: 9 },
  { label: "Nigeria", code: "+234", placeholder: "801 234 5678", length: 10 },
  { label: "Côte d'Ivoire", code: "+225", placeholder: "07 12 34 56", length: 8 },
  { label: "Senegal", code: "+221", placeholder: "77 123 45 67", length: 9 },
  { label: "Burkina Faso", code: "+226", placeholder: "70 12 34 56", length: 8 },
  { label: "Mali", code: "+223", placeholder: "76 12 34 56", length: 8 },
  { label: "Gambia", code: "+220", placeholder: "992 3456", length: 7 },
  { label: "Togo", code: "+228", placeholder: "70 12 34 56", length: 8 },
  { label: "Benin", code: "+229", placeholder: "01 23 45 67", length: 8 },
  { label: "Niger", code: "+227", placeholder: "90 12 34 56", length: 8 },
  { label: "Guinea", code: "+224", placeholder: "66 12 34 56", length: 8 },
  { label: "Guinea-Bissau", code: "+245", placeholder: "91 23 456", length: 7 },
];

export function combinePhone(country, national) {
  const digits = (national || "").replace(/\D/g, "");
  return `${country}${digits}`;
}