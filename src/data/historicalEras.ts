import type {
  CatalystEra,
  DualCurrencyCost,
  PistonArchitecture,
  PriceTier,
  ReferenceClass,
  TurboCountConfig,
  TurboPosition,
  TurboType,
} from '../types/gameTypes';

export interface EnginePartOption {
  id: string;
  name: string;
  minYear: number;
  unlockCost: DualCurrencyCost;
  defaultUnlocked: boolean;
  priceTier: PriceTier;
  referenceClass: ReferenceClass;
  /** Moltiplicatore peso rispetto alla base (1.0 = neutro) */
  weightFactor: number;
  /** Bonus/malus limite giri (RPM) */
  rpmDelta: number;
  /** Bonus BMEP (in bar) invece di moltiplicatori esplosivi a cascata */
  bmepDeltaBar: number;
  /** Bonus efficienza termica (punti percentuali) */
  efficiencyDeltaPercent: number;
  /** Coefficiente di resistenza materiale per durata stimata km */
  materialResistance: number;
  /** Fattore di stress meccanico indotto */
  stressFactor: number;
  /** Costo di produzione base per cilindro/gruppo ($) */
  unitCost: number;
  /** Moltiplicatore complessità R&D */
  rdComplexityMultiplier: number;
  description: string;
}

export interface ArchitectureSpec {
  id: PistonArchitecture;
  label: string;
  supportedCylinders: number[];
  supportedBankAnglesDeg: number[];
  allowsHotV: boolean;
  smoothnessFactor: number;
  /** Moltiplicatore costo produzione per lavorazione bancate/teste */
  productionComplexityMultiplier: number;
  /** Moltiplicatore costo R&D per complessità architetturale */
  rdComplexityMultiplier: number;
  description: string;
}

export const PISTON_ARCHITECTURES: ArchitectureSpec[] = [
  {
    id: 'Inline',
    label: 'In Linea (L)',
    supportedCylinders: [2, 3, 4, 5, 6, 8],
    supportedBankAnglesDeg: [0],
    allowsHotV: false,
    smoothnessFactor: 1.0,
    productionComplexityMultiplier: 1.0,
    rdComplexityMultiplier: 1.0,
    description:
      'Unica bancata e unica testata: il più economico da progettare e produrre. Stretto (W ridotta), alto (H elevata) e lungo (L proporzionale ai cilindri).',
  },
  {
    id: 'V',
    label: 'Architettura a V (15°–180° Flat-V)',
    supportedCylinders: [2, 4, 6, 8, 10, 12, 16],
    supportedBankAnglesDeg: [15, 60, 72, 90, 120, 180],
    allowsHotV: true,
    smoothnessFactor: 1.08,
    productionComplexityMultiplier: 1.28,
    rdComplexityMultiplier: 1.32,
    description:
      'Due bancate con perni di manovella condivisi: dimezza L rispetto a un In-Linea; a 180° diventa un Flat-V (più corto del Boxer puro).',
  },
  {
    id: 'Boxer',
    label: 'Boxer Puro (180° Perni Dedicati)',
    supportedCylinders: [2, 4, 6, 8, 12],
    supportedBankAnglesDeg: [180],
    allowsHotV: false,
    smoothnessFactor: 1.2,
    productionComplexityMultiplier: 1.48,
    rdComplexityMultiplier: 1.52,
    description:
      'Ogni cilindro opposto ha il proprio perno di manovella dedicato: più lungo (L) e largo (W) di un V180°, baricentro bassissimo e costo elevato per doppia testata contrapposta.',
  },
  {
    id: 'W',
    label: 'Architettura a W (3/4 Bancate)',
    supportedCylinders: [8, 12, 16, 18],
    supportedBankAnglesDeg: [72, 90],
    allowsHotV: true,
    smoothnessFactor: 1.15,
    productionComplexityMultiplier: 1.9,
    rdComplexityMultiplier: 2.05,
    description:
      'Altissima densità frazionata: estrema compattezza longitudinale (L) per molti cilindri, ma costi R&D e di produzione altissimi.',
  },
];

// ============================================================================
// COMPONENTISTICA BASE MOTORE (Sblocco $ + R&D + BMEP additivo controllato)
// ============================================================================

export const BLOCK_MATERIALS: EnginePartOption[] = [
  {
    id: 'blk-cast-iron',
    name: 'Ghisa Grigia Lamellare',
    minYear: 1970,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    defaultUnlocked: true,
    priceTier: 'Economica',
    referenceClass: 'Normale',
    weightFactor: 1.28,
    rpmDelta: -300,
    bmepDeltaBar: 0.0,
    efficiencyDeltaPercent: -0.8,
    materialResistance: 1.35,
    stressFactor: 0.9,
    unitCost: 165,
    rdComplexityMultiplier: 0.85,
    description: 'Economica e molto robusta alle alte pressioni, ma pesante.',
  },
  {
    id: 'blk-alu-diecast',
    name: 'Alluminio Pressofuso c/ Canne in Ghisa',
    minYear: 1970,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    defaultUnlocked: true,
    priceTier: 'Media',
    referenceClass: 'Comfort',
    weightFactor: 1.0,
    rpmDelta: 100,
    bmepDeltaBar: 0.25,
    efficiencyDeltaPercent: 0.5,
    materialResistance: 1.18,
    stressFactor: 0.98,
    unitCost: 260,
    rdComplexityMultiplier: 1.0,
    description: 'Ottimo compromesso tra leggerezza, costo industriale e dissipazione termica.',
  },
  {
    id: 'blk-cgi-iron',
    name: 'Ghisa a Grafite Compatta (CGI)',
    minYear: 1996,
    unlockCost: { capitalCost: 4_500_000, rdCost: 65, minYear: 1996 },
    defaultUnlocked: false,
    priceTier: 'Premium',
    referenceClass: 'Fuoristrada',
    weightFactor: 1.14,
    rpmDelta: 0,
    bmepDeltaBar: 0.65,
    efficiencyDeltaPercent: 0.9,
    materialResistance: 1.78,
    stressFactor: 0.8,
    unitCost: 390,
    rdComplexityMultiplier: 1.2,
    description: 'Ideale per Diesel ad altissima coppia e V8/V12 sovralimentati ad alta pressione.',
  },
  {
    id: 'blk-alu-forged-nikasil',
    name: 'Alluminio AlSi Forgiato c/ Riporto Plasma/Nikasil',
    minYear: 1988,
    unlockCost: { capitalCost: 8_500_000, rdCost: 115, minYear: 1988 },
    defaultUnlocked: true,
    priceTier: 'Premium',
    referenceClass: 'Sport',
    weightFactor: 0.88,
    rpmDelta: 350,
    bmepDeltaBar: 0.75,
    efficiencyDeltaPercent: 1.5,
    materialResistance: 1.52,
    stressFactor: 0.92,
    unitCost: 590,
    rdComplexityMultiplier: 1.35,
    description: 'Elimina le canne in ghisa riducendo gli attriti e la distanza interasse cilindri.',
  },
  {
    id: 'blk-magnesium-billet',
    name: 'Lega Magnesio-Alluminio Aerospaziale CNC',
    minYear: 2004,
    unlockCost: { capitalCost: 18_000_000, rdCost: 220, minYear: 2004 },
    defaultUnlocked: false,
    priceTier: 'Lusso',
    referenceClass: 'Corsa',
    weightFactor: 0.76,
    rpmDelta: 550,
    bmepDeltaBar: 0.95,
    efficiencyDeltaPercent: 1.8,
    materialResistance: 1.38,
    stressFactor: 1.15,
    unitCost: 1_450,
    rdComplexityMultiplier: 1.75,
    description: 'Leggerezza estrema per propulsori da pista e hypercar.',
  },
];

export const HEAD_MATERIALS: EnginePartOption[] = [
  {
    id: 'hd-cast-iron',
    name: 'Testa in Ghisa Standard',
    minYear: 1970,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    defaultUnlocked: true,
    priceTier: 'Economica',
    referenceClass: 'Normale',
    weightFactor: 1.22,
    rpmDelta: -250,
    bmepDeltaBar: -0.4,
    efficiencyDeltaPercent: -1.1,
    materialResistance: 1.25,
    stressFactor: 0.95,
    unitCost: 110,
    rdComplexityMultiplier: 0.85,
    description: 'Dissipazione termica limitata, favorisce la detonazione sotto carico.',
  },
  {
    id: 'hd-alu-cast',
    name: 'Testa in Alluminio Fuso',
    minYear: 1970,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    defaultUnlocked: true,
    priceTier: 'Media',
    referenceClass: 'Normale',
    weightFactor: 1.0,
    rpmDelta: 150,
    bmepDeltaBar: 0.2,
    efficiencyDeltaPercent: 0.6,
    materialResistance: 1.22,
    stressFactor: 0.98,
    unitCost: 195,
    rdComplexityMultiplier: 1.0,
    description: 'Migliore scambio termico della camera di scoppio.',
  },
  {
    id: 'hd-alu-t6',
    name: 'Alluminio Trattato Termicamente T6 Flussi CNC',
    minYear: 1986,
    unlockCost: { capitalCost: 5_500_000, rdCost: 80, minYear: 1986 },
    defaultUnlocked: true,
    priceTier: 'Premium',
    referenceClass: 'Sport',
    weightFactor: 0.93,
    rpmDelta: 350,
    bmepDeltaBar: 0.85,
    efficiencyDeltaPercent: 1.4,
    materialResistance: 1.58,
    stressFactor: 0.9,
    unitCost: 440,
    rdComplexityMultiplier: 1.3,
    description: 'Condotti di aspirazione e scarico lucidati a controllo numerico per alta permeabilità.',
  },
];

export const PISTON_TYPES: EnginePartOption[] = [
  {
    id: 'pst-cast',
    name: 'Pistoni Fusi in Lega Leggera',
    minYear: 1970,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    defaultUnlocked: true,
    priceTier: 'Economica',
    referenceClass: 'Normale',
    weightFactor: 1.02,
    rpmDelta: 0,
    bmepDeltaBar: 0.0,
    efficiencyDeltaPercent: 0,
    materialResistance: 1.0,
    stressFactor: 1.05,
    unitCost: 90,
    rdComplexityMultiplier: 0.9,
    description: 'Economici e silenziosi a freddo, ma vulnerabili a forti pressioni di sovralimentazione.',
  },
  {
    id: 'pst-hypereutectic',
    name: 'Pistoni Ipoeutettici ad Alto Silicio',
    minYear: 1982,
    unlockCost: { capitalCost: 3_000_000, rdCost: 45, minYear: 1982 },
    defaultUnlocked: true,
    priceTier: 'Media',
    referenceClass: 'Comfort',
    weightFactor: 0.97,
    rpmDelta: 250,
    bmepDeltaBar: 0.3,
    efficiencyDeltaPercent: 0.8,
    materialResistance: 1.3,
    stressFactor: 0.92,
    unitCost: 165,
    rdComplexityMultiplier: 1.05,
    description: 'Dilatazione termica ridotta e ottima longevità chilometrica.',
  },
  {
    id: 'pst-forged-oiljet',
    name: 'Pistoni Forgiati Raffreddati a Getto d’Olio',
    minYear: 1990,
    unlockCost: { capitalCost: 6_500_000, rdCost: 95, minYear: 1990 },
    defaultUnlocked: true,
    priceTier: 'Premium',
    referenceClass: 'Sport',
    weightFactor: 0.91,
    rpmDelta: 650,
    bmepDeltaBar: 0.75,
    efficiencyDeltaPercent: 1.1,
    materialResistance: 1.72,
    stressFactor: 0.84,
    unitCost: 380,
    rdComplexityMultiplier: 1.28,
    description: 'Sopportano alte pressioni turbo e regimi elevati grazie alla galleria di raffreddamento interna.',
  },
  {
    id: 'pst-al-li-racing',
    name: 'Pistoni Monoblocco Alluminio-Litio 2 Scanalature',
    minYear: 2008,
    unlockCost: { capitalCost: 14_000_000, rdCost: 180, minYear: 2008 },
    defaultUnlocked: false,
    priceTier: 'Lusso',
    referenceClass: 'Corsa',
    weightFactor: 0.8,
    rpmDelta: 1200,
    bmepDeltaBar: 1.15,
    efficiencyDeltaPercent: 1.5,
    materialResistance: 1.45,
    stressFactor: 1.18,
    unitCost: 920,
    rdComplexityMultiplier: 1.65,
    description: 'Massa alternata ridotta al minimo per regimi da competizione oltre 8.500–9.500 rpm.',
  },
];

export const CONROD_TYPES: EnginePartOption[] = [
  {
    id: 'rod-stamped-steel',
    name: 'Bielle in Acciaio Stampato',
    minYear: 1970,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    defaultUnlocked: true,
    priceTier: 'Economica',
    referenceClass: 'Normale',
    weightFactor: 1.05,
    rpmDelta: -150,
    bmepDeltaBar: 0.0,
    efficiencyDeltaPercent: 0,
    materialResistance: 1.0,
    stressFactor: 1.05,
    unitCost: 85,
    rdComplexityMultiplier: 0.9,
    description: 'Soluzione economica per motori stradali a regime moderato.',
  },
  {
    id: 'rod-c70-fractured',
    name: 'Bielle in Acciaio C70 Fratturato',
    minYear: 1990,
    unlockCost: { capitalCost: 4_200_000, rdCost: 60, minYear: 1990 },
    defaultUnlocked: true,
    priceTier: 'Media',
    referenceClass: 'Sport',
    weightFactor: 0.95,
    rpmDelta: 450,
    bmepDeltaBar: 0.35,
    efficiencyDeltaPercent: 0.4,
    materialResistance: 1.5,
    stressFactor: 0.88,
    unitCost: 215,
    rdComplexityMultiplier: 1.12,
    description: 'Accoppiamento perfetto del cappello di biella per alta rigidità e durata.',
  },
  {
    id: 'rod-titanium-cnc',
    name: 'Bielle in Titanio Grado 5 ad H Rovesciata',
    minYear: 1994,
    unlockCost: { capitalCost: 12_500_000, rdCost: 165, minYear: 1994 },
    defaultUnlocked: false,
    priceTier: 'Lusso',
    referenceClass: 'Corsa',
    weightFactor: 0.78,
    rpmDelta: 1100,
    bmepDeltaBar: 0.7,
    efficiencyDeltaPercent: 0.9,
    materialResistance: 1.75,
    stressFactor: 0.9,
    unitCost: 1_050,
    rdComplexityMultiplier: 1.6,
    description: 'Taglia del 35% le forze alterne del secondo ordine agli altissimi regimi.',
  },
];

export const CRANKSHAFT_TYPES: EnginePartOption[] = [
  {
    id: 'crk-cast-iron',
    name: 'Albero a Gomiti in Ghisa Sferoidale',
    minYear: 1970,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    defaultUnlocked: true,
    priceTier: 'Economica',
    referenceClass: 'Normale',
    weightFactor: 1.05,
    rpmDelta: -200,
    bmepDeltaBar: 0.0,
    efficiencyDeltaPercent: 0,
    materialResistance: 1.05,
    stressFactor: 1.02,
    unitCost: 115,
    rdComplexityMultiplier: 0.9,
    description: 'Basso costo di fusione, adatto a utilitarie e regimi contenuti.',
  },
  {
    id: 'crk-forged-nitrided',
    name: 'Acciaio Forgiato Nitrurato Controbilanciato',
    minYear: 1980,
    unlockCost: { capitalCost: 4_000_000, rdCost: 55, minYear: 1980 },
    defaultUnlocked: true,
    priceTier: 'Premium',
    referenceClass: 'Sport',
    weightFactor: 0.96,
    rpmDelta: 550,
    bmepDeltaBar: 0.4,
    efficiencyDeltaPercent: 0.5,
    materialResistance: 1.68,
    stressFactor: 0.84,
    unitCost: 340,
    rdComplexityMultiplier: 1.2,
    description: 'Altissima resistenza a fatica torsionale e perni induriti superficialmente.',
  },
  {
    id: 'crk-flatplane-billet',
    name: 'Albero Piatto (Flat-Plane 180°) Ricavato dal Pieno',
    minYear: 1988,
    unlockCost: { capitalCost: 11_000_000, rdCost: 150, minYear: 1988 },
    defaultUnlocked: false,
    priceTier: 'Lusso',
    referenceClass: 'Corsa',
    weightFactor: 0.84,
    rpmDelta: 950,
    bmepDeltaBar: 0.65,
    efficiencyDeltaPercent: 0.7,
    materialResistance: 1.62,
    stressFactor: 1.04,
    unitCost: 890,
    rdComplexityMultiplier: 1.55,
    description: 'Minima inerzia rotazionale e ordine di scoppio simmetrico per risposta fulminea.',
  },
];

export interface CamshaftSpec extends EnginePartOption {
  heightAddMm: number;
  widthAddMm: number;
  /** Vincolo meccanico (Punto 3): numero di valvole per cilindro supportate */
  supportedValvesPerCylinder: number[];
  /** Massa aggiuntiva della distribuzione per cilindro (kg/cil) */
  headWeightAddKgPerCyl: number;
}

export const CAMSHAFT_TYPES: CamshaftSpec[] = [
  {
    id: 'cam-ohv',
    name: 'Aste e Bilancieri (OHV / Pushrod)',
    minYear: 1970,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    defaultUnlocked: true,
    priceTier: 'Economica',
    referenceClass: 'Normale',
    weightFactor: 0.94,
    rpmDelta: -850,
    bmepDeltaBar: -0.35,
    efficiencyDeltaPercent: -0.5,
    materialResistance: 1.38,
    stressFactor: 0.88,
    unitCost: 95,
    rdComplexityMultiplier: 0.8,
    heightAddMm: 35,
    widthAddMm: 15,
    supportedValvesPerCylinder: [2],
    headWeightAddKgPerCyl: 0.0,
    description: 'Albero nel basamento: SOLO 2 valvole/cil. Teste compatte e leggere, limite giri contenuto.',
  },
  {
    id: 'cam-sohc',
    name: 'Singolo Albero a Camme in Testa (SOHC)',
    minYear: 1970,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    defaultUnlocked: true,
    priceTier: 'Media',
    referenceClass: 'Normale',
    weightFactor: 0.98,
    rpmDelta: 0,
    bmepDeltaBar: 0.15,
    efficiencyDeltaPercent: 0.3,
    materialResistance: 1.24,
    stressFactor: 0.95,
    unitCost: 165,
    rdComplexityMultiplier: 1.0,
    heightAddMm: 78,
    widthAddMm: 42,
    supportedValvesPerCylinder: [2, 3, 4],
    headWeightAddKgPerCyl: 1.25,
    description: 'Monoalbero in testa: supporta 2, 3 o 4 valvole/cilindro (VIETATO 5 valvole).',
  },
  {
    id: 'cam-dohc',
    name: 'Doppio Albero a Camme in Testa (DOHC)',
    minYear: 1970,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    defaultUnlocked: true,
    priceTier: 'Media',
    referenceClass: 'Sport',
    weightFactor: 1.04,
    rpmDelta: 650,
    bmepDeltaBar: 0.8,
    efficiencyDeltaPercent: 1.0,
    materialResistance: 1.28,
    stressFactor: 1.0,
    unitCost: 280,
    rdComplexityMultiplier: 1.25,
    heightAddMm: 115,
    widthAddMm: 82,
    supportedValvesPerCylinder: [2, 3, 4, 5],
    headWeightAddKgPerCyl: 2.45,
    description: 'Bialbero in testa: sblocca 4 e 5 valvole/cilindro, aumenta peso e volume della testata.',
  },
  {
    id: 'cam-dohc-vvt',
    name: 'DOHC con Variatore di Fase Continuo (VVT)',
    minYear: 1989,
    unlockCost: { capitalCost: 5_500_000, rdCost: 85, minYear: 1989 },
    defaultUnlocked: true,
    priceTier: 'Premium',
    referenceClass: 'Sport',
    weightFactor: 1.06,
    rpmDelta: 850,
    bmepDeltaBar: 1.35,
    efficiencyDeltaPercent: 2.4,
    materialResistance: 1.4,
    stressFactor: 0.96,
    unitCost: 450,
    rdComplexityMultiplier: 1.45,
    heightAddMm: 125,
    widthAddMm: 92,
    supportedValvesPerCylinder: [2, 3, 4, 5],
    headWeightAddKgPerCyl: 2.85,
    description: 'Ottimizza l’incrocio valvole sia ai bassi che agli alti regimi (supporta fino a 5V).',
  },
  {
    id: 'cam-dohc-vvl',
    name: 'DOHC Fase + Alzata Variabile Continua (VVL / MultiAir)',
    minYear: 2001,
    unlockCost: { capitalCost: 11_000_000, rdCost: 150, minYear: 2001 },
    defaultUnlocked: false,
    priceTier: 'Lusso',
    referenceClass: 'Sport',
    weightFactor: 1.08,
    rpmDelta: 1100,
    bmepDeltaBar: 1.75,
    efficiencyDeltaPercent: 3.6,
    materialResistance: 1.36,
    stressFactor: 1.02,
    unitCost: 690,
    rdComplexityMultiplier: 1.7,
    heightAddMm: 134,
    widthAddMm: 98,
    supportedValvesPerCylinder: [2, 3, 4, 5],
    headWeightAddKgPerCyl: 3.2,
    description: 'Controllo totale di alzata e durata apertura valvole su tutto l’arco di erogazione.',
  },
];

// ============================================================================
// ALIMENTAZIONE, ASPIRAZIONE, SCARICO & SOVRALIMENTAZIONE
// ============================================================================

export interface FuelSystemOption {
  id: string;
  name: string;
  supportedFuels: ('Benzina' | 'Diesel' | 'BioFuel' | 'RaceFuel')[];
  minYear: number;
  unlockCost: DualCurrencyCost;
  defaultUnlocked: boolean;
  bmepDeltaBar: number;
  highRpmBreathingFactor: number;
  efficiencyDeltaPercent: number;
  emissionsMultiplier: number;
  reliabilityDelta: number;
  unitCost: number;
  rdComplexityMultiplier: number;
  eraLabel: string;
}

export const FUEL_SYSTEMS: FuelSystemOption[] = [
  // CICLO OTTO (Benzina / BioFuel / RaceFuel)
  {
    id: 'fs-carb-single',
    name: 'Carburatore Singolo Corpo',
    supportedFuels: ['Benzina', 'BioFuel'],
    minYear: 1970,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    defaultUnlocked: true,
    bmepDeltaBar: -0.9,
    highRpmBreathingFactor: 0.88,
    efficiencyDeltaPercent: -4.5,
    emissionsMultiplier: 1.35,
    reliabilityDelta: -1,
    unitCost: 95,
    rdComplexityMultiplier: 0.75,
    eraLabel: 'Anni ’70 Economico',
  },
  {
    id: 'fs-carb-twin-weber',
    name: 'Batteria Carburatori Doppio Corpo (Weber / Dell’Orto)',
    supportedFuels: ['Benzina', 'BioFuel', 'RaceFuel'],
    minYear: 1970,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    defaultUnlocked: true,
    bmepDeltaBar: 0.25,
    highRpmBreathingFactor: 1.02,
    efficiencyDeltaPercent: -5.5,
    emissionsMultiplier: 1.48,
    reliabilityDelta: -3,
    unitCost: 290,
    rdComplexityMultiplier: 0.95,
    eraLabel: 'Anni ’70 Sport',
  },
  {
    id: 'fs-mech-inj',
    name: 'Iniezione Meccanica Continua (K-Jetronic / Spica)',
    supportedFuels: ['Benzina', 'RaceFuel'],
    minYear: 1973,
    unlockCost: { capitalCost: 2_200_000, rdCost: 35, minYear: 1973 },
    defaultUnlocked: true,
    bmepDeltaBar: 0.45,
    highRpmBreathingFactor: 1.01,
    efficiencyDeltaPercent: -1.8,
    emissionsMultiplier: 1.15,
    reliabilityDelta: 0,
    unitCost: 270,
    rdComplexityMultiplier: 1.05,
    eraLabel: 'Anni ’70–’80',
  },
  {
    id: 'fs-mpi-electronic',
    name: 'Iniezione Elettronica Multipoint Sequenziale (MPI)',
    supportedFuels: ['Benzina', 'BioFuel', 'RaceFuel'],
    minYear: 1983,
    unlockCost: { capitalCost: 4_000_000, rdCost: 60, minYear: 1983 },
    defaultUnlocked: true,
    bmepDeltaBar: 0.85,
    highRpmBreathingFactor: 1.04,
    efficiencyDeltaPercent: 1.5,
    emissionsMultiplier: 0.92,
    reliabilityDelta: 3,
    unitCost: 340,
    rdComplexityMultiplier: 1.15,
    eraLabel: 'Anni ’80–’90',
  },
  {
    id: 'fs-gdi-350bar',
    name: 'Iniezione Diretta Ad Alta Pressione (GDI 350 bar)',
    supportedFuels: ['Benzina', 'BioFuel', 'RaceFuel'],
    minYear: 2002,
    unlockCost: { capitalCost: 9_000_000, rdCost: 130, minYear: 2002 },
    defaultUnlocked: true,
    bmepDeltaBar: 1.45,
    highRpmBreathingFactor: 1.08,
    efficiencyDeltaPercent: 4.2,
    emissionsMultiplier: 0.78,
    reliabilityDelta: 1,
    unitCost: 640,
    rdComplexityMultiplier: 1.4,
    eraLabel: 'Anni 2000+',
  },
  // CICLO DIESEL (Dalla Precamera al Common Rail)
  {
    id: 'fs-diesel-idi-prechamber',
    name: 'Diesel Iniezione Indiretta a Precamera (IDI)',
    supportedFuels: ['Diesel'],
    minYear: 1970,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    defaultUnlocked: true,
    bmepDeltaBar: -1.2,
    highRpmBreathingFactor: 0.78,
    efficiencyDeltaPercent: 3.5,
    emissionsMultiplier: 1.42,
    reliabilityDelta: 5,
    unitCost: 210,
    rdComplexityMultiplier: 0.85,
    eraLabel: 'Anni ’70–’80',
  },
  {
    id: 'fs-diesel-rotary-pump',
    name: 'Diesel Iniezione Diretta Pompa Rotativa (TDI)',
    supportedFuels: ['Diesel'],
    minYear: 1988,
    unlockCost: { capitalCost: 3_800_000, rdCost: 55, minYear: 1988 },
    defaultUnlocked: true,
    bmepDeltaBar: 0.4,
    highRpmBreathingFactor: 0.88,
    efficiencyDeltaPercent: 6.5,
    emissionsMultiplier: 1.15,
    reliabilityDelta: 4,
    unitCost: 380,
    rdComplexityMultiplier: 1.1,
    eraLabel: 'Anni ’80–’90',
  },
  {
    id: 'fs-diesel-commonrail-1',
    name: 'Common Rail 1ª Generazione (1.350 bar — Brevetto Gruppo)',
    supportedFuels: ['Diesel'],
    minYear: 1997,
    unlockCost: { capitalCost: 8_500_000, rdCost: 120, minYear: 1997 },
    defaultUnlocked: true,
    bmepDeltaBar: 1.35,
    highRpmBreathingFactor: 1.0,
    efficiencyDeltaPercent: 9.2,
    emissionsMultiplier: 0.88,
    reliabilityDelta: 2,
    unitCost: 620,
    rdComplexityMultiplier: 1.35,
    eraLabel: 'Anni ’90–2000',
  },
  {
    id: 'fs-diesel-commonrail-piezo',
    name: 'Common Rail Multijet Piezoelettrico (2.500 bar)',
    supportedFuels: ['Diesel'],
    minYear: 2010,
    unlockCost: { capitalCost: 14_000_000, rdCost: 185, minYear: 2010 },
    defaultUnlocked: false,
    bmepDeltaBar: 2.1,
    highRpmBreathingFactor: 1.05,
    efficiencyDeltaPercent: 11.5,
    emissionsMultiplier: 0.72,
    reliabilityDelta: 0,
    unitCost: 980,
    rdComplexityMultiplier: 1.6,
    eraLabel: 'Era Moderna',
  },
];

export const INTAKE_SYSTEMS = [
  {
    id: 'int-std',
    name: 'Collettore Standard Singolo Corpo Farfallato',
    bmepDeltaBar: 0.0,
    highRpmMod: 0.96,
    cost: 110,
    heightAddMm: 35,
  },
  {
    id: 'int-vis',
    name: 'Collettore a Geometria Variabile (VIS Dual-Stage)',
    bmepDeltaBar: 0.55,
    highRpmMod: 1.02,
    cost: 280,
    heightAddMm: 55,
  },
  {
    id: 'int-plenum-short',
    name: 'Doppio Corpo Farfallato Plenum Corto ad Alto Flusso',
    bmepDeltaBar: 0.4,
    highRpmMod: 1.06,
    cost: 420,
    heightAddMm: 45,
  },
  {
    id: 'int-itb-carbon',
    name: 'Corpi Farfallati Individuali (ITB) + Airbox Carbonio',
    bmepDeltaBar: 0.65,
    highRpmMod: 1.12,
    cost: 980,
    heightAddMm: 75,
  },
];

export const EXHAUST_MANIFOLDS = [
  {
    id: 'exh-cast',
    name: 'Collettore in Ghisa Stampata Compatto',
    bmepDeltaBar: -0.35,
    weightKg: 13,
    widthAddMm: 30,
    cost: 95,
  },
  {
    id: 'exh-tubular-421',
    name: 'Tubolare in Acciaio Inox 4-2-1 (Coppia Media)',
    bmepDeltaBar: 0.35,
    weightKg: 9.0,
    widthAddMm: 55,
    cost: 310,
  },
  {
    id: 'exh-equal-length',
    name: 'Tubolare Equal-Length 4-1 Accordato',
    bmepDeltaBar: 0.65,
    weightKg: 8.0,
    widthAddMm: 68,
    cost: 540,
  },
  {
    id: 'exh-inconel',
    name: 'Inconel Tubolare Integrato Ultraleggero',
    bmepDeltaBar: 0.95,
    weightKg: 4.8,
    widthAddMm: 45,
    cost: 1_350,
  },
];

export interface TurboSystemSpec {
  id: TurboType;
  label: string;
  minYear: number;
  spoolRpmBase: number;
  lowEndBoostFactor: number;
  highEndEfficiency: number;
  weightAddKgBase: number;
  /** Costo base per una turbina singola economica ($) */
  baseUnitCost: number;
  stressAdd: number;
  description: string;
}

export const TURBO_SYSTEMS: TurboSystemSpec[] = [
  {
    id: 'NaturallyAspirated',
    label: 'Aspirato Naturale (N/A)',
    minYear: 1970,
    spoolRpmBase: 0,
    lowEndBoostFactor: 0,
    highEndEfficiency: 1.0,
    weightAddKgBase: 0,
    baseUnitCost: 0,
    stressAdd: 0,
    description: 'Risposta al pedale istantanea (BMEP 9–15.5 bar), erogazione lineare e peso ridotto.',
  },
  {
    id: 'SingleScroll',
    label: 'Turbocompressore Single-Scroll',
    minYear: 1973,
    spoolRpmBase: 3300,
    lowEndBoostFactor: 0.42,
    highEndEfficiency: 1.02,
    weightAddKgBase: 14,
    baseUnitCost: 220,
    stressAdd: 0.24,
    description: 'Economico e semplice: ottimo per utilitarie soft-turbo o spinta classica agli alti.',
  },
  {
    id: 'TwinScroll',
    label: 'Turbocompressore Twin-Scroll',
    minYear: 1985,
    spoolRpmBase: 2250,
    lowEndBoostFactor: 0.78,
    highEndEfficiency: 1.05,
    weightAddKgBase: 17,
    baseUnitCost: 410,
    stressAdd: 0.22,
    description: 'Doppia voluta che separa gli impulsi di scarico: riduce il lag e amplia il plateau di coppia.',
  },
  {
    id: 'VGT',
    label: 'Geometria Variabile (VGT / VNT)',
    minYear: 1991,
    spoolRpmBase: 1750,
    lowEndBoostFactor: 0.92,
    highEndEfficiency: 1.02,
    weightAddKgBase: 19,
    baseUnitCost: 580,
    stressAdd: 0.28,
    description: 'Palette orientabili: spinta pronta sin dai 1.650 rpm.',
  },
  {
    id: 'Supercharger',
    label: 'Compressore Volumetrico (Roots / Twin-Screw)',
    minYear: 1970,
    spoolRpmBase: 1000,
    lowEndBoostFactor: 1.0,
    highEndEfficiency: 0.88,
    weightAddKgBase: 24,
    baseUnitCost: 520,
    stressAdd: 0.2,
    description: 'Trascinato meccanicamente dall’albero: zero lag ma assorbe potenza agli alti regimi.',
  },
  {
    id: 'Twincharged',
    label: 'Twincharged (Volumetrico + Turbo in Serie)',
    minYear: 1985,
    spoolRpmBase: 1200,
    lowEndBoostFactor: 1.02,
    highEndEfficiency: 1.06,
    weightAddKgBase: 36,
    baseUnitCost: 1_150,
    stressAdd: 0.42,
    description: 'Stile Gruppo B (Delta S4): spinta brutale a ogni regime, complessità e ingombro elevati.',
  },
  {
    id: 'ETurbo',
    label: 'E-Turbo (Turbina Assistita da Motore Elettrico Coassiale)',
    minYear: 2016,
    spoolRpmBase: 1100,
    lowEndBoostFactor: 1.0,
    highEndEfficiency: 1.08,
    weightAddKgBase: 23,
    baseUnitCost: 1_480,
    stressAdd: 0.25,
    description: 'Elimina il turbo-lag garantendo l’88–95% della coppia massima già a 1.250–1.500 RPM.',
  },
];

// Punto 2: Configurazione Numero Turbine (Single, Twin Parallelo/Sequenziale, Triple, Quad)
export interface TurboCountSpec {
  id: TurboCountConfig;
  label: string;
  turbineCount: number;
  minCylinders: number;
  costMultiplier: number;
  weightMultiplier: number;
  spoolRpmBonus: number;
  highRpmFlowBonus: number;
  description: string;
}

export const TURBO_COUNT_CONFIGS: TurboCountSpec[] = [
  {
    id: 'SingleTurbo',
    label: 'Single Turbo (1 Turbina)',
    turbineCount: 1,
    minCylinders: 2,
    costMultiplier: 1.0,
    weightMultiplier: 1.0,
    spoolRpmBonus: 0,
    highRpmFlowBonus: 1.0,
    description:
      'Singolo turbocompressore: leggero ed economico, ma su cilindrate elevate o alti RPM può murare di portata.',
  },
  {
    id: 'TwinTurbo',
    label: 'Biturbo / Twin-Turbo (2 Turbine Personalizzabili)',
    turbineCount: 2,
    minCylinders: 4,
    costMultiplier: 1.85,
    weightMultiplier: 1.6,
    spoolRpmBonus: -380,
    highRpmFlowBonus: 1.15,
    description:
      'Due turbine configurabili singolarmente (uguali in parallelo o asimmetriche/sequenziali): +portata d’aria e risposta immediata.',
  },
  {
    id: 'TripleTurbo',
    label: 'Triple-Turbo (3 Turbine Stadio Multiplo)',
    turbineCount: 3,
    minCylinders: 6,
    costMultiplier: 2.95,
    weightMultiplier: 2.15,
    spoolRpmBonus: -580,
    highRpmFlowBonus: 1.26,
    description:
      'Tre turbocompressori configurabili: elimina il turbo-lag e garantisce una portata d’aria enorme fino al limitatore.',
  },
  {
    id: 'QuadTurbo',
    label: 'Quad-Turbo (4 Turbine — V8/V10/V12/W16)',
    turbineCount: 4,
    minCylinders: 8,
    costMultiplier: 4.1,
    weightMultiplier: 2.7,
    spoolRpmBonus: -520,
    highRpmFlowBonus: 1.38,
    description:
      'Quattro turbine dedicate (stile EB110 / Chiron W16): quadrupla area compressore, zero contropressione e potenza estrema.',
  },
];

// Punto 9: Impatto Posizione Turbine (Frontali, Laterali, Hot-V) su ingombri, costi e affidabilità
export const TURBO_POSITIONS: {
  id: TurboPosition;
  label: string;
  lengthAddMm: number;
  widthAddMm: number;
  heightAddMm: number;
  requiresVOrW: boolean;
  turboCostMultiplier: number;
  reliabilityDeltaPercent: number;
  description: string;
}[] = [
  {
    id: 'Front',
    label: 'Turbina Frontale / Anteriore',
    lengthAddMm: 135,
    widthAddMm: 20,
    heightAddMm: 15,
    requiresVOrW: false,
    turboCostMultiplier: 1.0,
    reliabilityDeltaPercent: 0.0,
    description: 'Costo base (1.0x), aumenta la Lunghezza (L), affidabilità neutra (0%).',
  },
  {
    id: 'Lateral',
    label: 'Turbine Laterali Esterne',
    lengthAddMm: 18,
    widthAddMm: 155,
    heightAddMm: 15,
    requiresVOrW: false,
    turboCostMultiplier: 1.05,
    reliabilityDeltaPercent: -1.0,
    description: 'Costo medio (+5%), aumenta la Larghezza (W) nel vano, affidabilità -1%.',
  },
  {
    id: 'HotV',
    label: 'Configurazione Hot-V (Dentro la V)',
    lengthAddMm: 12,
    widthAddMm: 15,
    heightAddMm: 48,
    requiresVOrW: true,
    turboCostMultiplier: 1.25,
    reliabilityDeltaPercent: -3.5,
    description:
      'Solo V/W (60°–120°): abbatte la Larghezza (W) e migliora lo spool, +25% costo turbo e -3.5% affidabilità per calore nella V.',
  },
];

// ============================================================================
// 4 ERE DI CATALIZZATORI E IMPATTO AFFIDABILITÀ (Punto 8: Penalità DPF/SCR Diesel)
// ============================================================================

export interface CatalystEraSpec {
  id: CatalystEra;
  stageNumber: number;
  label: string;
  decadeLabel: string;
  minYear: number;
  emissionsReductionPercent: number;
  powerPenaltyPercent: number;
  weightAddKg: number;
  unitCost: number;
  reliabilityPenaltyPetrolPercent: number;
  reliabilityPenaltyDieselPercent: number;
  description: string;
}

export const CATALYST_ERAS: CatalystEraSpec[] = [
  {
    id: 'None',
    stageNumber: 0,
    label: 'Scarico Diretto (Senza Catalizzatore)',
    decadeLabel: 'Pre-Normative / Pista',
    minYear: 1970,
    emissionsReductionPercent: 0,
    powerPenaltyPercent: 0,
    weightAddKg: 0,
    unitCost: 0,
    reliabilityPenaltyPetrolPercent: 0,
    reliabilityPenaltyDieselPercent: 0,
    description: 'Nessun abbattimento inquinanti: zero contropressione e nessun filtro soggetto a intasamento.',
  },
  {
    id: 'Era1_Oxidizing_70s',
    stageNumber: 1,
    label: 'Stadio 1: Catalizzatore Ossidante a 2 Vie',
    decadeLabel: 'Anni ’70',
    minYear: 1973,
    emissionsReductionPercent: 32,
    powerPenaltyPercent: 4.5,
    weightAddKg: 6,
    unitCost: 190,
    reliabilityPenaltyPetrolPercent: 0.3,
    reliabilityPenaltyDieselPercent: 0.8,
    description: 'Ossida CO e HC incombusti ma introduce una sensibile contropressione nei primi impianti.',
  },
  {
    id: 'Era2_ThreeWayLambda_80s90s',
    stageNumber: 2,
    label: 'Stadio 2: Catalizzatore a Tre Vie + Sonda Lambda',
    decadeLabel: 'Anni ’80–’90 (Euro 1/2)',
    minYear: 1984,
    emissionsReductionPercent: 58,
    powerPenaltyPercent: 2.5,
    weightAddKg: 8,
    unitCost: 350,
    reliabilityPenaltyPetrolPercent: 0.6,
    reliabilityPenaltyDieselPercent: 1.8,
    description: 'Controllo stechiometrico closed-loop che abbatte anche gli ossidi di azoto (NOx).',
  },
  {
    id: 'Era3_MultiStage_DPF_SCR_2000s',
    stageNumber: 3,
    label: 'Stadio 3: Multi-Stadio + Filtro DPF/FAP + EGR/SCR',
    decadeLabel: 'Anni 2000 (Euro 4/5/6)',
    minYear: 2000,
    emissionsReductionPercent: 76,
    powerPenaltyPercent: 1.8,
    weightAddKg: 14,
    unitCost: 780,
    reliabilityPenaltyPetrolPercent: 1.2,
    reliabilityPenaltyDieselPercent: 5.5,
    description:
      'Trappola particolato DPF e valvola EGR: abbatte le emissioni ma riduce l’affidabilità (spec. sui Diesel per intasamento).',
  },
  {
    id: 'Era4_ActiveGlobalFilter_Euro7',
    stageNumber: 4,
    label: 'Stadio 4: Sistema Attivo Riscaldato + DPF/SCR Globale Euro 7',
    decadeLabel: 'Era Euro 7',
    minYear: 2016,
    emissionsReductionPercent: 89,
    powerPenaltyPercent: 1.4,
    weightAddKg: 17,
    unitCost: 1_280,
    reliabilityPenaltyPetrolPercent: 1.8,
    reliabilityPenaltyDieselPercent: 8.0,
    description:
      'Pre-cat elettrico + DPF/GPF + doppio dosatore AdBlue: massima pulizia (-8% su Diesel, -1.8% su Benzina).',
  },
];

/** Restituisce la soglia legale di emissioni CO2/inquinanti (g/km) in base all'anno storico */
export function getLegalEmissionLimitForYear(year: number): number {
  if (year < 1980) return 310;
  if (year < 1992) return 255;
  if (year < 2005) return 210;
  if (year < 2015) return 165;
  return 125;
}

// ============================================================================
// MODULO 1B: COMPONENTISTICA SPECIFICA MOTORI ROTATIVI (WANKEL)
// ============================================================================

export interface ApexSealSpec {
  id: string;
  name: string;
  minYear: number;
  unlockCost: DualCurrencyCost;
  defaultUnlocked: boolean;
  priceTier: PriceTier;
  referenceClass: ReferenceClass;
  /** Moltiplicatore tasso usura seal (1.0 = base, 0.45 = ceramica ultra durevole) */
  wearRateMultiplier: number;
  /** Limite massimo regime di sicurezza aggiuntivo */
  rpmDelta: number;
  bmepDeltaBar: number;
  /** Resistenza al battito/detonazione (frantumazione) */
  shatterResistance: number;
  unitCostPerRotor: number;
  rdComplexityMultiplier: number;
  description: string;
}

export const APEX_SEAL_MATERIALS: ApexSealSpec[] = [
  {
    id: 'seal-chilled-cast-iron',
    name: 'Ghisa Sferoidale Chilled con Riporto Cromo',
    minYear: 1970,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    defaultUnlocked: true,
    priceTier: 'Economica',
    referenceClass: 'Normale',
    wearRateMultiplier: 1.25,
    rpmDelta: -200,
    bmepDeltaBar: 0.0,
    shatterResistance: 1.0,
    unitCostPerRotor: 85,
    rdComplexityMultiplier: 0.85,
    description: 'Soluzione storica base: buona tenuta a freddo ma pesante e soggetta a usura oltre i 7.000 rpm.',
  },
  {
    id: 'seal-carbon-aluminum',
    name: 'Composito Carbonio-Alluminio Autolubrificante',
    minYear: 1974,
    unlockCost: { capitalCost: 2_800_000, rdCost: 45, minYear: 1974 },
    defaultUnlocked: true,
    priceTier: 'Media',
    referenceClass: 'Sport',
    wearRateMultiplier: 0.95,
    rpmDelta: 650,
    bmepDeltaBar: 0.25,
    shatterResistance: 0.82,
    unitCostPerRotor: 240,
    rdComplexityMultiplier: 1.1,
    description: 'Bassa massa e bassissimo attrito sulla superficie trocoide: permette allunghi puliti fino a 8.500 rpm.',
  },
  {
    id: 'seal-tool-steel-dlc',
    name: 'Acciaio per Utensili Forgiato 3 Pezzi con Riporto DLC',
    minYear: 1991,
    unlockCost: { capitalCost: 6_500_000, rdCost: 95, minYear: 1991 },
    defaultUnlocked: true,
    priceTier: 'Premium',
    referenceClass: 'Sport',
    wearRateMultiplier: 0.65,
    rpmDelta: 1100,
    bmepDeltaBar: 0.65,
    shatterResistance: 1.65,
    unitCostPerRotor: 580,
    rdComplexityMultiplier: 1.35,
    description: 'Design a 3 pezzi con rivestimento Diamond-Like Carbon: tollera alte pressioni turbo e previene rotture.',
  },
  {
    id: 'seal-ceramic-si3n4',
    name: 'Ceramica Avanzata Nitruro di Silicio (Si3N4 Monoblocco)',
    minYear: 1996,
    unlockCost: { capitalCost: 15_000_000, rdCost: 210, minYear: 1996 },
    defaultUnlocked: false,
    priceTier: 'Lusso',
    referenceClass: 'Corsa',
    wearRateMultiplier: 0.38,
    rpmDelta: 1800,
    bmepDeltaBar: 1.1,
    shatterResistance: 1.45,
    unitCostPerRotor: 1_250,
    rdComplexityMultiplier: 1.7,
    description: 'Tecnologia Le Mans (stile 787B): peso ridottissimo, resiste a 1050°C di EGT e regimi oltre 10.500 rpm.',
  },
];

export interface WankelPortingSpec {
  id: 'StandardSide' | 'StreetPort' | 'Bridgeport' | 'SemiPeripheral' | 'PeripheralPort';
  name: string;
  minYear: number;
  unlockCost: DualCurrencyCost;
  defaultUnlocked: boolean;
  lowEndTorqueMod: number;
  highEndFlowMod: number;
  rpmLimitBonus: number;
  bmepDeltaBar: number;
  idleRpm: number;
  idleCharacter: string;
  emissionsPenaltyPercent: number;
  cost: number;
  rdComplexityMultiplier: number;
  description: string;
}

export const WANKEL_PORTING_TYPES: WankelPortingSpec[] = [
  {
    id: 'StandardSide',
    name: 'Side Port Stradale (Luci sulle Piastre Laterali)',
    minYear: 1970,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    defaultUnlocked: true,
    lowEndTorqueMod: 1.05,
    highEndFlowMod: 0.94,
    rpmLimitBonus: 0,
    bmepDeltaBar: 0.0,
    idleRpm: 850,
    idleCharacter: 'Fluido, lineare e silenzioso (850 rpm)',
    emissionsPenaltyPercent: 0,
    cost: 150,
    rdComplexityMultiplier: 1.0,
    description: 'Incrocio valvole nullo/minimo: ottima regolarità al minimo, consumi ed emissioni sotto controllo.',
  },
  {
    id: 'StreetPort',
    name: 'Street Port Lavorato CNC (Diagramma Allargato +20%)',
    minYear: 1978,
    unlockCost: { capitalCost: 2_200_000, rdCost: 35, minYear: 1978 },
    defaultUnlocked: true,
    lowEndTorqueMod: 0.98,
    highEndFlowMod: 1.08,
    rpmLimitBonus: 400,
    bmepDeltaBar: 0.45,
    idleRpm: 950,
    idleCharacter: 'Minimo leggermente cupo e sportivo (950 rpm)',
    emissionsPenaltyPercent: 12,
    cost: 450,
    rdComplexityMultiplier: 1.15,
    description: 'Condotti laterali allargati e lucidati: aumenta la respirazione agli alti giri conservando guidabilità.',
  },
  {
    id: 'Bridgeport',
    name: 'Bridgeport (Luce Ausiliaria con Ponticello — Brap Brap)',
    minYear: 1982,
    unlockCost: { capitalCost: 5_500_000, rdCost: 80, minYear: 1982 },
    defaultUnlocked: true,
    lowEndTorqueMod: 0.82,
    highEndFlowMod: 1.22,
    rpmLimitBonus: 950,
    bmepDeltaBar: 0.95,
    idleRpm: 1350,
    idleCharacter: 'Pulsato e aggressivo "Brap-Brap-Brap" (1.350 rpm)',
    emissionsPenaltyPercent: 34,
    cost: 850,
    rdComplexityMultiplier: 1.35,
    description: 'Forte incrocio tra aspirazione e scarico: vuoto ai bassi regimi ma spinta violenta da 5.000 a 9.500 rpm.',
  },
  {
    id: 'SemiPeripheral',
    name: 'Semi-Periferico Ibrido (Side Port + Luce Periferica Ausiliaria)',
    minYear: 1993,
    unlockCost: { capitalCost: 9_200_000, rdCost: 140, minYear: 1993 },
    defaultUnlocked: false,
    lowEndTorqueMod: 0.94,
    highEndFlowMod: 1.32,
    rpmLimitBonus: 1250,
    bmepDeltaBar: 1.45,
    idleRpm: 1100,
    idleCharacter: 'Stabile ai carichi bassi, brutale sotto spinta (1.100 rpm)',
    emissionsPenaltyPercent: 22,
    cost: 1_450,
    rdComplexityMultiplier: 1.5,
    description: 'Usa le luci laterali a regimi bassi e apre la luce periferica sulla trocoide agli alti: ideale con turbo.',
  },
  {
    id: 'PeripheralPort',
    name: 'Peripheral Port Race (Condotti Periferici Diretti — Stile 787B)',
    minYear: 1988,
    unlockCost: { capitalCost: 16_000_000, rdCost: 220, minYear: 1988 },
    defaultUnlocked: false,
    lowEndTorqueMod: 0.68,
    highEndFlowMod: 1.48,
    rpmLimitBonus: 2200,
    bmepDeltaBar: 1.95,
    idleRpm: 1850,
    idleCharacter: 'Urlante e ingestibile sotto i 3.500 rpm (1.850 rpm)',
    emissionsPenaltyPercent: 65,
    cost: 2_200,
    rdComplexityMultiplier: 1.75,
    description: 'Flusso diretto e rettilineo dentro la camera: rendimento volumetrico estremo tra 7.500 e 11.500+ rpm.',
  },
];

export interface WankelHousingSpec {
  id: string;
  name: string;
  minYear: number;
  unlockCost: DualCurrencyCost;
  defaultUnlocked: boolean;
  priceTier: PriceTier;
  weightFactor: number;
  thermalConductivity: number;
  wearResistance: number;
  costPerRotor: number;
  rdComplexityMultiplier: number;
  description: string;
}

export const WANKEL_HOUSING_MATERIALS: WankelHousingSpec[] = [
  {
    id: 'whs-iron-chrome',
    name: 'Trocoide in Ghisa con Cromatura Dura Elettrolitica',
    minYear: 1970,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    defaultUnlocked: true,
    priceTier: 'Economica',
    weightFactor: 1.15,
    thermalConductivity: 0.85,
    wearResistance: 1.0,
    costPerRotor: 320,
    rdComplexityMultiplier: 0.9,
    description: 'Soluzione robusta ma pesante e con limitata dissipazione termica sul lato caldo di scarico.',
  },
  {
    id: 'whs-alu-cermet-nikasil',
    name: 'Alluminio Pressofuso ad Alta Conducibilità c/ Riporto Cermet/Nikasil',
    minYear: 1985,
    unlockCost: { capitalCost: 4_800_000, rdCost: 65, minYear: 1985 },
    defaultUnlocked: true,
    priceTier: 'Premium',
    weightFactor: 0.88,
    thermalConductivity: 1.35,
    wearResistance: 1.45,
    costPerRotor: 680,
    rdComplexityMultiplier: 1.25,
    description: 'Dimezza il peso e dissipa rapidamente i picchi termici di scarico, proteggendo la superficie trocoide.',
  },
  {
    id: 'whs-billet-alu-ceramic',
    name: 'Casse Billet Lavorate dal Pieno CNC c/ Inserto Ceramico di Scarico',
    minYear: 1998,
    unlockCost: { capitalCost: 13_500_000, rdCost: 190, minYear: 1998 },
    defaultUnlocked: false,
    priceTier: 'Lusso',
    weightFactor: 0.76,
    thermalConductivity: 1.55,
    wearResistance: 1.9,
    costPerRotor: 1_550,
    rdComplexityMultiplier: 1.6,
    description: 'Rigidità torsionale strutturale massima, tolleranze millesimali per corse endurance e altissimi carichi.',
  },
];

export interface OilMeteringSpec {
  id: string;
  name: string;
  minYear: number;
  unlockCost: DualCurrencyCost;
  defaultUnlocked: boolean;
  oilConsumptionLPer1000Km: number;
  sealDurabilityBonusPercent: number;
  emissionsPenaltyPercent: number;
  cost: number;
  rdComplexityMultiplier: number;
  description: string;
}

export const OIL_METERING_SYSTEMS: OilMeteringSpec[] = [
  {
    id: 'omp-mechanical',
    name: 'Pompa Meccanica a Ingranaggi OMP (Legata a Giri Motore)',
    minYear: 1970,
    unlockCost: { capitalCost: 0, rdCost: 0, minYear: 1970 },
    defaultUnlocked: true,
    oilConsumptionLPer1000Km: 1.1,
    sealDurabilityBonusPercent: 0,
    emissionsPenaltyPercent: 18,
    cost: 140,
    rdComplexityMultiplier: 0.9,
    description: 'Inietta olio motore standard proporzionalmente ai giri: fumo e residui carboniosi a regimi bassi.',
  },
  {
    id: 'omp-electronic-mikuni',
    name: 'Pompa Elettronica Micrometrica OMP (Mappatura ECU Carico/TPS)',
    minYear: 1989,
    unlockCost: { capitalCost: 3_200_000, rdCost: 50, minYear: 1989 },
    defaultUnlocked: true,
    oilConsumptionLPer1000Km: 0.65,
    sealDurabilityBonusPercent: 15,
    emissionsPenaltyPercent: 6,
    cost: 380,
    rdComplexityMultiplier: 1.2,
    description: 'Dosaggio ad altissima precisione gestito da centralina: riduce il consumo di olio e abbatte le emissioni.',
  },
  {
    id: 'omp-premix-aviation',
    name: 'Serbatoio Olio 2T Sintetico Separato + Premix Elettronico',
    minYear: 1995,
    unlockCost: { capitalCost: 7_000_000, rdCost: 110, minYear: 1995 },
    defaultUnlocked: false,
    oilConsumptionLPer1000Km: 0.45,
    sealDurabilityBonusPercent: 32,
    emissionsPenaltyPercent: 2,
    cost: 720,
    rdComplexityMultiplier: 1.45,
    description: 'Non brucia l’olio esausto della coppa: inietta lubrificante sintetico 2T a ceneri zero, prolungando la vita degli apex.',
  },
];

