export const EMPLACEMENTS = [
  "Congélateur à Tiroir Garage",
  "Congélateur à Tiroir Cave",
  "Congélateur Bac",
  "Petit Placard Garage",
  "Grand Placard Garage",
  "Grand Placard Buanderie",
  "Caisse Cave",
  "Cave à Vin JP",
  "Cave à Vin JC",
] as const;

export const VERSIONS = Array.from({ length: 10 }, (_, i) => `V${i + 1}`);

export const UNITES_POIDS = ["Gr", "Kg", "L", "Pièce", "Lot de 5", "Lot de 3", "Btl"] as const;

export const ETIQUETTE_FORMATS = [
  "Pas d'étiquettes",
  "23x23",   // DK-11221 — carrée 23×23
  "23x23v",  // DK-11221 — carrée 23×23 (vin, QR seul)
  "17x54",   // DK-11204 — adresse 17×54
  "62x29",   // DK-11209 — petite adresse 29×62
  "62x100",  // DK-11202 — expédition 62×100
  "62",      // DK-44205 — continu 62 mm (longueur 30 mm)
  "29x50",   // DK-22211 — Grand Froid 50×29
] as const;


export const TYPES_VIN = ["Bordeaux", "Bourgogne", "Champagne", "Liqueur", "Spiritueux", "Autre"] as const;

export const COULEURS_VIN = ["Rouge", "Blanc", "Rosé", "Noix", "Génépi", "Autre"] as const;
