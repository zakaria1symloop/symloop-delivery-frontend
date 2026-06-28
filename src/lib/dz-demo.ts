/**
 * Hardcoded Algerian demo data (DEMO ONLY — no backend).
 * Used by the expéditeur Tarifs / Nos Bureaux pages for client presentations.
 */

// ── Pricing zones ──────────────────────────────────────────────────────────
type Zone = "A" | "B" | "C" | "D" | "E";

const ZONES: Record<Zone, { domicile: number; stopdesk: number; delai: string }> = {
  A: { domicile: 450,  stopdesk: 300, delai: "24 – 48h" }, // Centre (hub Alger)
  B: { domicile: 550,  stopdesk: 350, delai: "48 – 72h" }, // Nord Est / Ouest
  C: { domicile: 650,  stopdesk: 450, delai: "72h" },      // Hauts plateaux
  D: { domicile: 850,  stopdesk: 600, delai: "3 – 5 j" },  // Sahara
  E: { domicile: 1100, stopdesk: 800, delai: "5 – 7 j" },  // Grand Sud
};

// [code, name, zone]
const WILAYA_DEFS: [string, string, Zone][] = [
  ["01", "Adrar", "D"],            ["02", "Chlef", "A"],
  ["03", "Laghouat", "C"],         ["04", "Oum El Bouaghi", "B"],
  ["05", "Batna", "C"],            ["06", "Béjaïa", "B"],
  ["07", "Biskra", "C"],           ["08", "Béchar", "D"],
  ["09", "Blida", "A"],            ["10", "Bouira", "A"],
  ["11", "Tamanrasset", "E"],      ["12", "Tébessa", "C"],
  ["13", "Tlemcen", "B"],          ["14", "Tiaret", "B"],
  ["15", "Tizi Ouzou", "A"],       ["16", "Alger", "A"],
  ["17", "Djelfa", "C"],           ["18", "Jijel", "B"],
  ["19", "Sétif", "B"],            ["20", "Saïda", "B"],
  ["21", "Skikda", "B"],           ["22", "Sidi Bel Abbès", "B"],
  ["23", "Annaba", "B"],           ["24", "Guelma", "B"],
  ["25", "Constantine", "B"],      ["26", "Médéa", "A"],
  ["27", "Mostaganem", "B"],       ["28", "M'Sila", "C"],
  ["29", "Mascara", "B"],          ["30", "Ouargla", "D"],
  ["31", "Oran", "B"],             ["32", "El Bayadh", "C"],
  ["33", "Illizi", "E"],           ["34", "Bordj Bou Arréridj", "B"],
  ["35", "Boumerdès", "A"],        ["36", "El Tarf", "B"],
  ["37", "Tindouf", "E"],          ["38", "Tissemsilt", "B"],
  ["39", "El Oued", "D"],          ["40", "Khenchela", "C"],
  ["41", "Souk Ahras", "B"],       ["42", "Tipaza", "A"],
  ["43", "Mila", "B"],             ["44", "Aïn Defla", "A"],
  ["45", "Naâma", "C"],            ["46", "Aïn Témouchent", "B"],
  ["47", "Ghardaïa", "D"],         ["48", "Relizane", "B"],
  ["49", "El M'Ghair", "D"],       ["50", "El Meniaa", "D"],
  ["51", "Ouled Djellal", "D"],    ["52", "Bordj Badji Mokhtar", "E"],
  ["53", "Béni Abbès", "D"],       ["54", "Timimoun", "D"],
  ["55", "Touggourt", "D"],        ["56", "Djanet", "E"],
  ["57", "In Salah", "E"],         ["58", "In Guezzam", "E"],
];

export interface DzWilaya { code: string; name: string; }
export interface DzTarif {
  code: string; name: string; zone: Zone;
  domicile: number; stopdesk: number; retour: number; delai: string;
}

export const DZ_WILAYAS: DzWilaya[] = WILAYA_DEFS.map(([code, name]) => ({ code, name }));

export const DZ_TARIFS: DzTarif[] = WILAYA_DEFS.map(([code, name, zone]) => {
  const z = ZONES[zone];
  return {
    code, name, zone,
    domicile: z.domicile,
    stopdesk: z.stopdesk,
    retour: Math.round(z.stopdesk * 0.5),
    delai: z.delai,
  };
});

export const ZONE_LABELS: Record<Zone, string> = {
  A: "Centre",
  B: "Nord",
  C: "Hauts plateaux",
  D: "Sahara",
  E: "Grand Sud",
};

// ── Bureaux (offices) ────────────────────────────────────────────────────────
export type BureauType = "HUB" | "Agence";

export interface DzBureau {
  id: string;
  name: string;
  type: BureauType;
  wilayaCode: string;
  wilaya: string;
  commune: string;
  address: string;
  phone: string;
  hours: string;
}

export const DZ_BUREAUX: DzBureau[] = [
  { id: "HUB-16", name: "Hub National — Alger", type: "HUB", wilayaCode: "16", wilaya: "Alger", commune: "Dar El Beïda",
    address: "Zone Industrielle, Dar El Beïda, Alger", phone: "+213 21 50 80 80", hours: "Sam – Jeu : 08:00 – 19:00" },
  { id: "HUB-31", name: "Hub Ouest — Oran", type: "HUB", wilayaCode: "31", wilaya: "Oran", commune: "Es Sénia",
    address: "Route de l'Aéroport, Es Sénia, Oran", phone: "+213 41 51 22 00", hours: "Sam – Jeu : 08:00 – 19:00" },
  { id: "HUB-25", name: "Hub Est — Constantine", type: "HUB", wilayaCode: "25", wilaya: "Constantine", commune: "El Khroub",
    address: "Pôle Logistique, El Khroub, Constantine", phone: "+213 31 92 14 50", hours: "Sam – Jeu : 08:00 – 19:00" },
  { id: "HUB-30", name: "Hub Sud — Ouargla", type: "HUB", wilayaCode: "30", wilaya: "Ouargla", commune: "Hassi Messaoud",
    address: "Zone d'activités, Hassi Messaoud, Ouargla", phone: "+213 29 73 40 10", hours: "Sam – Jeu : 08:00 – 18:00" },

  { id: "AG-16", name: "Agence Alger Centre", type: "Agence", wilayaCode: "16", wilaya: "Alger", commune: "Sidi M'Hamed",
    address: "12 Rue Hassiba Ben Bouali, Alger", phone: "+213 21 63 21 10", hours: "Sam – Jeu : 08:30 – 17:30" },
  { id: "AG-09", name: "Agence Blida", type: "Agence", wilayaCode: "09", wilaya: "Blida", commune: "Blida",
    address: "08 Bd Larbi Tebessi, Blida", phone: "+213 25 41 60 33", hours: "Sam – Jeu : 08:30 – 17:30" },
  { id: "AG-15", name: "Agence Tizi Ouzou", type: "Agence", wilayaCode: "15", wilaya: "Tizi Ouzou", commune: "Tizi Ouzou",
    address: "Rue des Frères Belhadj, Tizi Ouzou", phone: "+213 26 21 44 18", hours: "Sam – Jeu : 08:30 – 17:30" },
  { id: "AG-06", name: "Agence Béjaïa", type: "Agence", wilayaCode: "06", wilaya: "Béjaïa", commune: "Béjaïa",
    address: "Quartier Sidi Ahmed, Béjaïa", phone: "+213 34 16 55 27", hours: "Sam – Jeu : 08:30 – 17:30" },
  { id: "AG-19", name: "Agence Sétif", type: "Agence", wilayaCode: "19", wilaya: "Sétif", commune: "Sétif",
    address: "Cité Tlidjène, Av. de l'ALN, Sétif", phone: "+213 36 84 70 12", hours: "Sam – Jeu : 08:30 – 17:30" },
  { id: "AG-23", name: "Agence Annaba", type: "Agence", wilayaCode: "23", wilaya: "Annaba", commune: "Annaba",
    address: "14 Cours de la Révolution, Annaba", phone: "+213 38 86 32 41", hours: "Sam – Jeu : 08:30 – 17:30" },
  { id: "AG-05", name: "Agence Batna", type: "Agence", wilayaCode: "05", wilaya: "Batna", commune: "Batna",
    address: "Av. de l'Indépendance, Batna", phone: "+213 33 80 19 64", hours: "Sam – Jeu : 08:30 – 17:30" },
  { id: "AG-13", name: "Agence Tlemcen", type: "Agence", wilayaCode: "13", wilaya: "Tlemcen", commune: "Tlemcen",
    address: "Bd Colonel Lotfi, Tlemcen", phone: "+213 43 27 50 90", hours: "Sam – Jeu : 08:30 – 17:30" },
  { id: "AG-27", name: "Agence Mostaganem", type: "Agence", wilayaCode: "27", wilaya: "Mostaganem", commune: "Mostaganem",
    address: "Rue Khemisti, Mostaganem", phone: "+213 45 30 11 76", hours: "Sam – Jeu : 08:30 – 17:30" },
  { id: "AG-47", name: "Agence Ghardaïa", type: "Agence", wilayaCode: "47", wilaya: "Ghardaïa", commune: "Ghardaïa",
    address: "Av. du 1er Novembre, Ghardaïa", phone: "+213 29 88 24 55", hours: "Sam – Jeu : 08:00 – 17:00" },
  { id: "AG-07", name: "Agence Biskra", type: "Agence", wilayaCode: "07", wilaya: "Biskra", commune: "Biskra",
    address: "Rue Hakim Saâdane, Biskra", phone: "+213 33 74 60 28", hours: "Sam – Jeu : 08:30 – 17:30" },
  { id: "AG-17", name: "Agence Djelfa", type: "Agence", wilayaCode: "17", wilaya: "Djelfa", commune: "Djelfa",
    address: "Av. de Palestine, Djelfa", phone: "+213 27 90 33 47", hours: "Sam – Jeu : 08:30 – 17:30" },
  { id: "AG-08", name: "Agence Béchar", type: "Agence", wilayaCode: "08", wilaya: "Béchar", commune: "Béchar",
    address: "Bd Emir Abdelkader, Béchar", phone: "+213 49 81 27 39", hours: "Sam – Jeu : 08:00 – 17:00" },
];
