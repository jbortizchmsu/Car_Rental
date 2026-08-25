export interface NegrosLocation {
  municipality: string;
  province: 'Negros Occidental' | 'Negros Oriental';
  type: 'City' | 'Municipality';
}

export const NEGROS_LOCATIONS: NegrosLocation[] = [
  // Negros Occidental — Cities
  { municipality: 'Bacolod', province: 'Negros Occidental', type: 'City' },
  { municipality: 'Bago', province: 'Negros Occidental', type: 'City' },
  { municipality: 'Cadiz', province: 'Negros Occidental', type: 'City' },
  { municipality: 'Escalante', province: 'Negros Occidental', type: 'City' },
  { municipality: 'Himamaylan', province: 'Negros Occidental', type: 'City' },
  { municipality: 'Kabankalan', province: 'Negros Occidental', type: 'City' },
  { municipality: 'La Carlota', province: 'Negros Occidental', type: 'City' },
  { municipality: 'Sagay', province: 'Negros Occidental', type: 'City' },
  { municipality: 'San Carlos', province: 'Negros Occidental', type: 'City' },
  { municipality: 'Silay', province: 'Negros Occidental', type: 'City' },
  { municipality: 'Talisay', province: 'Negros Occidental', type: 'City' },
  { municipality: 'Victorias', province: 'Negros Occidental', type: 'City' },
  // Negros Occidental — Municipalities
  { municipality: 'Binalbagan', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'Calatrava', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'Candoni', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'Cauayan', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'Enrique B. Magalona', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'Hinigaran', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'Hinoba-an', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'Ilog', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'Isabela', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'La Castellana', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'Manapla', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'Moises Padilla', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'Murcia', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'Pontevedra', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'Pulupandan', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'Salvador Benedicto', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'San Enrique', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'Sipalay', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'Toboso', province: 'Negros Occidental', type: 'Municipality' },
  { municipality: 'Valladolid', province: 'Negros Occidental', type: 'Municipality' },
  // Negros Oriental — Cities
  { municipality: 'Bayawan', province: 'Negros Oriental', type: 'City' },
  { municipality: 'Bais', province: 'Negros Oriental', type: 'City' },
  { municipality: 'Canlaon', province: 'Negros Oriental', type: 'City' },
  { municipality: 'Dumaguete', province: 'Negros Oriental', type: 'City' },
  { municipality: 'Guihulngan', province: 'Negros Oriental', type: 'City' },
  { municipality: 'Tanjay', province: 'Negros Oriental', type: 'City' },
  // Negros Oriental — Municipalities
  { municipality: 'Amlan', province: 'Negros Oriental', type: 'Municipality' },
  { municipality: 'Ayungon', province: 'Negros Oriental', type: 'Municipality' },
  { municipality: 'Bacong', province: 'Negros Oriental', type: 'Municipality' },
  { municipality: 'Basay', province: 'Negros Oriental', type: 'Municipality' },
  { municipality: 'Bindoy', province: 'Negros Oriental', type: 'Municipality' },
  { municipality: 'Dauin', province: 'Negros Oriental', type: 'Municipality' },
  { municipality: 'Jimalalud', province: 'Negros Oriental', type: 'Municipality' },
  { municipality: 'La Libertad', province: 'Negros Oriental', type: 'Municipality' },
  { municipality: 'Mabinay', province: 'Negros Oriental', type: 'Municipality' },
  { municipality: 'Manjuyod', province: 'Negros Oriental', type: 'Municipality' },
  { municipality: 'Pamplona', province: 'Negros Oriental', type: 'Municipality' },
  { municipality: 'San Jose', province: 'Negros Oriental', type: 'Municipality' },
  { municipality: 'Santa Catalina', province: 'Negros Oriental', type: 'Municipality' },
  { municipality: 'Siaton', province: 'Negros Oriental', type: 'Municipality' },
  { municipality: 'Sibulan', province: 'Negros Oriental', type: 'Municipality' },
  { municipality: 'Tayasan', province: 'Negros Oriental', type: 'Municipality' },
  { municipality: 'Valencia', province: 'Negros Oriental', type: 'Municipality' },
  { municipality: 'Vallehermoso', province: 'Negros Oriental', type: 'Municipality' },
  { municipality: 'Zamboanguita', province: 'Negros Oriental', type: 'Municipality' },
];

export const NEGROS_OCC = NEGROS_LOCATIONS.filter(l => l.province === 'Negros Occidental');
export const NEGROS_OR = NEGROS_LOCATIONS.filter(l => l.province === 'Negros Oriental');
