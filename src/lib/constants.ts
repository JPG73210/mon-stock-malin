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

export const ETIQUETTE_FORMATS = ["Pas d'étiquettes", "17x54", "23x23", "30x62"] as const;

export const TYPES_VIN = ["Bordeaux", "Bourgogne", "Champagne", "Liqueur", "Spiritueux", "Autre"] as const;

export const COULEURS_VIN = ["Rouge", "Blanc", "Rosé", "Noix", "Génépi", "Autre"] as const;
