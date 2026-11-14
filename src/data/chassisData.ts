import type { DualCurrencyCost, VehicleSegment } from '../types/gameTypes';

export interface ChassisStructureOption {
  id: string;
  name: string;
  minYear: number;
  defaultUnlocked: boolean;
  unlockCost: DualCurrencyCost;
  /** Rigidità torsionale di base (Nm/grado) prima dei rinforzi */
  baseRigidityNmPerDeg: number;
  /** Moltiplicatore peso sulla massa base volumetrica */
  weightMultiplier: number;
  /** Bonus/malus sicurezza passiva base (0-100) */
  baseSafetyScore: number;
  /** Tetto massimo raggiungibile in sicurezza cellula */
  maxSafetyScoreCap?: number;
  /** Se true, i rinforzi oltre il 35% hanno rendimenti decrescenti logaritmici */
  usesDiminishingReinforcement?: boolean;
  /** Limiti strutturali per architetture leggere (es. Vetroresina GRP) */
  maxSupportedTorqueNm?: number;
  maxSupportedEngineWeightKg?: number;
  /** Costo base produzione scocca nuda ($) */
  baseManufacturingCost: number;
  /** Costo sviluppo piattaforma base ($) */
  devCapitalCost: number;
  /** Punti R&D sviluppo piattaforma */
  devRdPoints: number;
  materialResistanceFactor: number;
  mechanicalStressFactor: number;
  isBodyOnFrame?: boolean;
  description: string;
}

export const CHASSIS_STRUCTURES: ChassisStructureOption[] = [
  {
    id: 'str-backbone-grp',
    name: 'Telaio a Trave Centrale (Backbone) + Scocca Vetroresina GRP (Stile Lotus)',
    minYear: 1970,
    defaultUnlocked: true,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    baseRigidityNmPerDeg: 10_500,
    weightMultiplier: 0.68,
    baseSafetyScore: 34,
    maxSafetyScoreCap: 56,
    maxSupportedTorqueNm: 360,
    maxSupportedEngineWeightKg: 145,
    baseManufacturingCost: 2_450,
    devCapitalCost: 95_000_000,
    devRdPoints: 140,
    materialResistanceFactor: 0.85,
    mechanicalStressFactor: 1.15,
    description:
      'Trave centrale in acciaio scatolato unita a carrozzeria portante in vetroresina GRP: peso piuma (-32%) e R&D bassissimo, ma protezione crash test limitata e coppia/peso motore supportabili contenuti.',
  },
  {
    id: 'str-steel-stamped',
    name: 'Monoscocca in Acciaio Stampato Convenzionale',
    minYear: 1970,
    defaultUnlocked: true,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    baseRigidityNmPerDeg: 11_500,
    weightMultiplier: 1.12,
    baseSafetyScore: 52,
    maxSafetyScoreCap: 72,
    baseManufacturingCost: 2_100,
    devCapitalCost: 390_000_000,
    devRdPoints: 260,
    materialResistanceFactor: 1.0,
    mechanicalStressFactor: 0.9,
    description:
      'Struttura portante classica in lamiera d’acciaio dolce saldata a punti: economica e facile da riparare, ma pesante e con flessione torsionale evidente.',
  },
  {
    id: 'str-ladder-frame',
    name: 'Telaio a Longheroni Separati (Body-on-Frame)',
    minYear: 1970,
    defaultUnlocked: true,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    baseRigidityNmPerDeg: 9_200,
    weightMultiplier: 1.24,
    baseSafetyScore: 48,
    maxSafetyScoreCap: 68,
    baseManufacturingCost: 1_950,
    devCapitalCost: 310_000_000,
    devRdPoints: 220,
    materialResistanceFactor: 1.25,
    mechanicalStressFactor: 0.85,
    isBodyOnFrame: true,
    description:
      'Longheroni scatolati ad alta resistenza al traino e ai carichi gravosi: ideale per fuoristrada puri, SUV heavy-duty e Pickup.',
  },
  {
    id: 'str-uhss-steel',
    name: 'Monoscocca in Acciaio Altoresistenziale (UHSS / Boron)',
    minYear: 1992,
    defaultUnlocked: false,
    unlockCost: { capitalCost: 8_500_000, rdCost: 95, minYear: 1992 },
    baseRigidityNmPerDeg: 25_000,
    weightMultiplier: 0.98,
    baseSafetyScore: 78,
    maxSafetyScoreCap: 93,
    baseManufacturingCost: 3_600,
    devCapitalCost: 650_000_000,
    devRdPoints: 420,
    materialResistanceFactor: 1.38,
    mechanicalStressFactor: 0.85,
    description:
      'Acciai bifasici e al boro stampati a caldo: raddoppia la rigidità torsionale e crea una cellula di sopravvivenza rigida per l’abitacolo.',
  },
  {
    id: 'str-alu-spaceframe',
    name: 'Spaceframe in Alluminio Estruso e Pressofuso',
    minYear: 1996,
    defaultUnlocked: false,
    unlockCost: { capitalCost: 14_000_000, rdCost: 145, minYear: 1996 },
    baseRigidityNmPerDeg: 28_000,
    weightMultiplier: 0.78,
    baseSafetyScore: 74,
    maxSafetyScoreCap: 84,
    usesDiminishingReinforcement: true,
    baseManufacturingCost: 7_150,
    devCapitalCost: 580_000_000,
    devRdPoints: 490,
    materialResistanceFactor: 1.48,
    mechanicalStressFactor: 0.92,
    description:
      'Nodi in alluminio fuso uniti a profilati estrusi: R&D ridotto per medie serie, ma costo unitario più alto (+$550 vs Ibrido Giorgio) per saldature/rivetti speciali e tetto sicurezza cellula inferiore all’UHSS.',
  },
  {
    id: 'str-hybrid-giorgio',
    name: 'Ibrido Acciaio Ultra-Resistente / Alluminio / Carbonio (Stile Giorgio)',
    minYear: 2008,
    defaultUnlocked: false,
    unlockCost: { capitalCost: 22_000_000, rdCost: 210, minYear: 2008 },
    baseRigidityNmPerDeg: 36_500,
    weightMultiplier: 0.82,
    baseSafetyScore: 88,
    maxSafetyScoreCap: 98,
    baseManufacturingCost: 6_600,
    devCapitalCost: 980_000_000,
    devRdPoints: 760,
    materialResistanceFactor: 1.75,
    mechanicalStressFactor: 0.9,
    description:
      'Architettura multi-materiale alto volume: montanti A/B in acciaio al boro stampato a caldo (sicurezza superiore), duomi/porte in alluminio, costo unitario inferiore allo Spaceframe alluminio ma R&D iniziale vicino al miliardo.',
  },
  {
    id: 'str-alu-carbon-supercar',
    name: 'Spaceframe Ibrido Alluminio + Vasca/Paratia Carbonio (Stile Huracán / R8)',
    minYear: 2012,
    defaultUnlocked: false,
    unlockCost: { capitalCost: 28_000_000, rdCost: 260, minYear: 2012 },
    baseRigidityNmPerDeg: 41_500,
    weightMultiplier: 0.66,
    baseSafetyScore: 89,
    maxSafetyScoreCap: 96,
    baseManufacturingCost: 13_800,
    devCapitalCost: 890_000_000,
    devRdPoints: 820,
    materialResistanceFactor: 1.92,
    mechanicalStressFactor: 0.92,
    description:
      'Zero acciaio: telaietti anteriori e posteriori in alluminio accoppiati a tunnel centrale e paratia posteriore in fibra di carbonio. Si posiziona tra Spaceframe Alluminio e Monoscocca Carbonio.',
  },
  {
    id: 'str-carbon-monocoque',
    name: 'Monoscocca in Fibra di Carbonio Pre-Preg T1000',
    minYear: 2004,
    defaultUnlocked: false,
    unlockCost: { capitalCost: 38_000_000, rdCost: 340, minYear: 2004 },
    baseRigidityNmPerDeg: 49_500,
    weightMultiplier: 0.56,
    baseSafetyScore: 93,
    maxSafetyScoreCap: 99,
    baseManufacturingCost: 21_500,
    devCapitalCost: 1_320_000_000,
    devRdPoints: 1_050,
    materialResistanceFactor: 2.15,
    mechanicalStressFactor: 0.95,
    description:
      'Vasca strutturale in autoclave con anima a nido d’ape in alluminio: rigidità torsionale estrema e peso piuma per supercar e hypercar.',
  },
];

export interface SegmentEraThreshold {
  eraLabel: string;
  minYear: number;
  /** Lunghezza massima (mm) per ciascun segmento in questa epoca */
  maxLengthA: number;
  maxLengthB: number;
  maxLengthC: number;
  maxLengthD: number;
  maxLengthE: number;
  /** Soglia altezza minima (mm) per identificare SUV/Crossover vs berline */
  suvMinHeightMm: number;
  suvMinGroundClearanceMm: number;
  /** Soglia altezza massima (mm) per segmento S (Sportiva / Supercar) */
  sportMaxHeightMm: number;
}

/**
 * Soglie dimensionali a scaglioni storici:
 * Ogni 10-12 anni le auto crescono di categoria (es. una Seg. C degli anni '70 oggi è piccola quanto una Seg. A/B).
 */
export const SEGMENT_ERA_THRESHOLDS: SegmentEraThreshold[] = [
  {
    eraLabel: 'Anni ’70 (1970–1979)',
    minYear: 1970,
    maxLengthA: 3350,
    maxLengthB: 3750,
    maxLengthC: 4180,
    maxLengthD: 4520,
    maxLengthE: 4820,
    suvMinHeightMm: 1620,
    suvMinGroundClearanceMm: 175,
    sportMaxHeightMm: 1270,
  },
  {
    eraLabel: 'Anni ’80 (1980–1989)',
    minYear: 1980,
    maxLengthA: 3450,
    maxLengthB: 3880,
    maxLengthC: 4280,
    maxLengthD: 4600,
    maxLengthE: 4900,
    suvMinHeightMm: 1610,
    suvMinGroundClearanceMm: 170,
    sportMaxHeightMm: 1280,
  },
  {
    eraLabel: 'Anni ’90 (1990–1999)',
    minYear: 1990,
    maxLengthA: 3560,
    maxLengthB: 3980,
    maxLengthC: 4360,
    maxLengthD: 4680,
    maxLengthE: 4960,
    suvMinHeightMm: 1600,
    suvMinGroundClearanceMm: 165,
    sportMaxHeightMm: 1300,
  },
  {
    eraLabel: 'Anni 2000 (2000–2011)',
    minYear: 2000,
    maxLengthA: 3680,
    maxLengthB: 4100,
    maxLengthC: 4460,
    maxLengthD: 4780,
    maxLengthE: 5040,
    suvMinHeightMm: 1585,
    suvMinGroundClearanceMm: 160,
    sportMaxHeightMm: 1320,
  },
  {
    eraLabel: 'Anni 2012–2021',
    minYear: 2012,
    maxLengthA: 3760,
    maxLengthB: 4190,
    maxLengthC: 4540,
    maxLengthD: 4860,
    maxLengthE: 5110,
    suvMinHeightMm: 1575,
    suvMinGroundClearanceMm: 155,
    sportMaxHeightMm: 1335,
  },
  {
    eraLabel: 'Era Moderna (2022+)',
    minYear: 2022,
    maxLengthA: 3840,
    maxLengthB: 4260,
    maxLengthC: 4610,
    maxLengthD: 4930,
    maxLengthE: 5180,
    suvMinHeightMm: 1565,
    suvMinGroundClearanceMm: 155,
    sportMaxHeightMm: 1345,
  },
];

export const VEHICLE_SEGMENT_LABELS: Record<VehicleSegment, string> = {
  A: 'Segmento A (Citycar)',
  B: 'Segmento B (Utilitaria)',
  C: 'Segmento C (Compatta)',
  D: 'Segmento D (Berlina Media)',
  E: 'Segmento E (Executive / Ammiraglia)',
  F: 'Segmento F (Lusso / Limousine)',
  S: 'Segmento S (Sportiva / Supercar)',
  J_SUV: 'Segmento J (SUV / Fuoristrada)',
  M_Pickup: 'Segmento M (Pickup / Multispazio)',
};

