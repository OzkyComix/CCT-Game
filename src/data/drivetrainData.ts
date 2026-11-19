import type {
  AWDLayoutType,
  AbsModuleType,
  AwdScheme23,
  BrakeCaliperType,
  BrakeDiscType,
  DifferentialType,
  EngineOrientation,
  EscModuleType,
  GearboxStrengthTier,
  PriceTier,
  StabilityControlType,
  StabilityDriveMode,
  SteeringType,
  SuspensionType,
  TcsModuleType,
  TransmissionType,
} from '../types/gameTypes';

export interface TransmissionOption {
  id: TransmissionType;
  name: string;
  minYear: number;
  minGears: number;
  maxGears: number;
  isEvOnly: boolean;
  lossDeltaPercent: number;
  shiftTimeMs: number;
  baseTorqueCapacityNm: number;
  weightKg: number;
  unitCost: number;
  capitalCost: number;
  rdCost: number;
  perExtraGearCost: number;
  perExtraGearWeightKg: number;
  perExtraGearRdCost: number;
  perExtraGearCapitalCost: number;
  durabilityFactor: number;
  priceTier: PriceTier;
  description: string;
}

export const TRANSMISSION_OPTIONS: TransmissionOption[] = [
  {
    id: 'manual-h',
    name: 'Manuale a Griglia ad H',
    minYear: 1950,
    minGears: 4,
    maxGears: 7,
    isEvOnly: false,
    lossDeltaPercent: 0.0,
    shiftTimeMs: 360,
    baseTorqueCapacityNm: 480,
    weightKg: 42,
    unitCost: 850,
    capitalCost: 4_500_000,
    rdCost: 15,
    perExtraGearCost: 140,
    perExtraGearWeightKg: 2.3,
    perExtraGearRdCost: 5,
    perExtraGearCapitalCost: 450_000,
    durabilityFactor: 1.15,
    priceTier: 'Economica',
    description: 'Cambio manuale classico a sincronizzatori con massima purezza meccanica e rendimento diretto.',
  },
  {
    id: 'manual-dogleg',
    name: 'Manuale Sportivo Dog-Leg (Prima in Basso)',
    minYear: 1968,
    minGears: 5,
    maxGears: 6,
    isEvOnly: false,
    lossDeltaPercent: 0.2,
    shiftTimeMs: 280,
    baseTorqueCapacityNm: 540,
    weightKg: 46,
    unitCost: 1_650,
    capitalCost: 7_500_000,
    rdCost: 30,
    perExtraGearCost: 160,
    perExtraGearWeightKg: 2.4,
    perExtraGearRdCost: 6,
    perExtraGearCapitalCost: 500_000,
    durabilityFactor: 1.08,
    priceTier: 'Media',
    description: 'Schema da competizione con 2a e 3a sullo stesso asse di cambiata per uso pista/rally.',
  },
  {
    id: 'auto-torque-converter',
    name: 'Automatico Idraulico Classico (Convertitore)',
    minYear: 1955,
    minGears: 3,
    maxGears: 5,
    isEvOnly: false,
    lossDeltaPercent: 6.8,
    shiftTimeMs: 520,
    baseTorqueCapacityNm: 680,
    weightKg: 76,
    unitCost: 1_900,
    capitalCost: 11_000_000,
    rdCost: 35,
    perExtraGearCost: 220,
    perExtraGearWeightKg: 3.1,
    perExtraGearRdCost: 6,
    perExtraGearCapitalCost: 750_000,
    durabilityFactor: 1.25,
    priceTier: 'Media',
    description: 'Convertitore di coppia fluido senza lock-up continuo: molto dolce ma con elevate perdite idrauliche.',
  },
  {
    id: 'auto-modern-lockup',
    name: 'Automatico Moderno Lock-Up (8-10 Marce)',
    minYear: 2006,
    minGears: 6,
    maxGears: 10,
    isEvOnly: false,
    lossDeltaPercent: 1.2,
    shiftTimeMs: 145,
    baseTorqueCapacityNm: 980,
    weightKg: 79,
    unitCost: 3_400,
    capitalCost: 22_000_000,
    rdCost: 85,
    perExtraGearCost: 260,
    perExtraGearWeightKg: 3.2,
    perExtraGearRdCost: 7,
    perExtraGearCapitalCost: 950_000,
    durabilityFactor: 1.22,
    priceTier: 'Premium',
    description: 'Epicicloidale con frizione di blocco istantanea su tutte le marce, ideale per coppie elevate.',
  },
  {
    id: 'automated-single-clutch',
    name: 'Elettroattuato Monofrizione (SMG / F1)',
    minYear: 1997,
    minGears: 5,
    maxGears: 7,
    isEvOnly: false,
    lossDeltaPercent: 0.5,
    shiftTimeMs: 165,
    baseTorqueCapacityNm: 640,
    weightKg: 52,
    unitCost: 2_600,
    capitalCost: 16_000_000,
    rdCost: 65,
    perExtraGearCost: 220,
    perExtraGearWeightKg: 2.8,
    perExtraGearRdCost: 6,
    perExtraGearCapitalCost: 750_000,
    durabilityFactor: 0.92,
    priceTier: 'Premium',
    description: 'Cambio meccanico con attuatori idraulici: leggero ed efficiente, ma brusco nell’innesto.',
  },
  {
    id: 'dct-dry',
    name: 'Doppia Frizione a Secco (DCT Dry)',
    minYear: 2008,
    minGears: 6,
    maxGears: 7,
    isEvOnly: false,
    lossDeltaPercent: 0.4,
    shiftTimeMs: 85,
    baseTorqueCapacityNm: 380,
    weightKg: 62,
    unitCost: 2_450,
    capitalCost: 19_000_000,
    rdCost: 75,
    perExtraGearCost: 340,
    perExtraGearWeightKg: 3.4,
    perExtraGearRdCost: 8,
    perExtraGearCapitalCost: 1_100_000,
    durabilityFactor: 0.94,
    priceTier: 'Media',
    description: 'Rapidità da doppia frizione senza pompa olio ad alta pressione, limitata però dalla coppia termica.',
  },
  {
    id: 'dct-wet',
    name: 'Doppia Frizione a Bagno d’Olio (DCT Wet / PDK)',
    minYear: 2003,
    minGears: 6,
    maxGears: 8,
    isEvOnly: false,
    lossDeltaPercent: 0.6,
    shiftTimeMs: 55,
    baseTorqueCapacityNm: 960,
    weightKg: 74,
    unitCost: 4_300,
    capitalCost: 28_000_000,
    rdCost: 115,
    perExtraGearCost: 360,
    perExtraGearWeightKg: 3.6,
    perExtraGearRdCost: 9,
    perExtraGearCapitalCost: 1_250_000,
    durabilityFactor: 1.12,
    priceTier: 'Lusso',
    description: 'Cambiata fulminea senza interruzione di coppia con pacco frizioni raffreddato ad olio.',
  },
  {
    id: 'cvt',
    name: 'Variatore Continuo (CVT / e-CVT)',
    minYear: 1987,
    minGears: 1,
    maxGears: 7,
    isEvOnly: false,
    lossDeltaPercent: 4.8,
    shiftTimeMs: 120,
    baseTorqueCapacityNm: 340,
    weightKg: 58,
    unitCost: 1_850,
    capitalCost: 14_000_000,
    rdCost: 55,
    perExtraGearCost: 85,
    perExtraGearWeightKg: 2.2,
    perExtraGearRdCost: 4,
    perExtraGearCapitalCost: 350_000,
    durabilityFactor: 0.96,
    priceTier: 'Economica',
    description: 'Rapporto continuo per efficienza urbana e fluidità, penalizzato ad alti carichi di coppia.',
  },
  {
    id: 'sequential-race',
    name: 'Sequenziale a Denti Dritti (Motorsport)',
    minYear: 1992,
    minGears: 5,
    maxGears: 7,
    isEvOnly: false,
    lossDeltaPercent: 0.8,
    shiftTimeMs: 42,
    baseTorqueCapacityNm: 1100,
    weightKg: 39,
    unitCost: 8_900,
    capitalCost: 24_000_000,
    rdCost: 120,
    perExtraGearCost: 650,
    perExtraGearWeightKg: 2.5,
    perExtraGearRdCost: 10,
    perExtraGearCapitalCost: 1_500_000,
    durabilityFactor: 0.55,
    priceTier: 'Lusso',
    description: 'Innesti frontali ultraleggeri da gara, rumorosità meccanica marcata e revisioni frequenti.',
  },
  {
    id: 'ev-single-speed',
    name: 'Riduttore Monomarcia Diretto EV',
    minYear: 2008,
    minGears: 1,
    maxGears: 1,
    isEvOnly: true,
    lossDeltaPercent: 0.0,
    shiftTimeMs: 0,
    baseTorqueCapacityNm: 1200,
    weightKg: 26,
    unitCost: 950,
    capitalCost: 6_500_000,
    rdCost: 25,
    perExtraGearCost: 0,
    perExtraGearWeightKg: 0,
    perExtraGearRdCost: 0,
    perExtraGearCapitalCost: 0,
    durabilityFactor: 1.45,
    priceTier: 'Media',
    description: 'Ingranaggeria singola ad altissima efficienza senza frizioni né interruzioni di spinta.',
  },
  {
    id: 'ev-two-speed',
    name: 'Cambio EV a 2 Rapporti (Performance)',
    minYear: 2019,
    minGears: 2,
    maxGears: 2,
    isEvOnly: true,
    lossDeltaPercent: 0.7,
    shiftTimeMs: 90,
    baseTorqueCapacityNm: 1450,
    weightKg: 41,
    unitCost: 3_200,
    capitalCost: 16_000_000,
    rdCost: 75,
    perExtraGearCost: 450,
    perExtraGearWeightKg: 3.0,
    perExtraGearRdCost: 8,
    perExtraGearCapitalCost: 900_000,
    durabilityFactor: 1.25,
    priceTier: 'Lusso',
    description: 'Prima corta per accelerazione bruciante e seconda lunga per velocità oltre 260 km/h.',
  },
];

export interface AwdSchemeOption {
  id: AwdScheme23;
  mappedLayout: AWDLayoutType;
  name: string;
  minYear: number;
  allowedOrientations: EngineOrientation[];
  lossPercent: number;
  frontSplitMin: number;
  frontSplitMax: number;
  defaultFrontSplit: number;
  lowRangeRatio: number | null;
  torqueVectoringBonus: number;
  weightKg: number;
  unitCost: number;
  capitalCost: number;
  rdCost: number;
  durabilityFactor: number;
  description: string;
}

export const AWD_SCHEME_OPTIONS: AwdSchemeOption[] = [
  {
    id: 'awd-fwd-haldex',
    mappedLayout: 'AWD_Haldex_OnDemand',
    name: 'AWD Anteriore On-Demand (Haldex)',
    minYear: 1998,
    allowedOrientations: ['Trasversale'],
    lossPercent: 15.2,
    frontSplitMin: 50,
    frontSplitMax: 95,
    defaultFrontSplit: 70,
    lowRangeRatio: null,
    torqueVectoringBonus: 0.08,
    weightKg: 68,
    unitCost: 1_850,
    capitalCost: 12_000_000,
    rdCost: 45,
    durabilityFactor: 1.05,
    description: 'Prevalenza anteriore su pianali trasversali con giunto elettroidraulico che invia fino al 50% al retrotreno.',
  },
  {
    id: 'awd-transverse-perf',
    mappedLayout: 'AWD_Transverse_TorqueSplitter',
    name: 'AWD Trasversale Performance / Torque Splitter',
    minYear: 2015,
    allowedOrientations: ['Trasversale'],
    lossPercent: 16.2,
    frontSplitMin: 40,
    frontSplitMax: 65,
    defaultFrontSplit: 50,
    lowRangeRatio: null,
    torqueVectoringBonus: 0.24,
    weightKg: 76,
    unitCost: 3_100,
    capitalCost: 19_000_000,
    rdCost: 85,
    durabilityFactor: 1.0,
    description: 'Doppia frizione posteriore indipendente stile RS3 / A45 S capace di trasferire il 100% della coppia posteriore su singola ruota.',
  },
  {
    id: 'awd-longitudinal-perm',
    mappedLayout: 'AWD_Longitudinal_Permanent',
    name: 'AWD Longitudinale Permanente (Centrale Torsen / Frizioni)',
    minYear: 1980,
    allowedOrientations: ['Longitudinale'],
    lossPercent: 18.5,
    frontSplitMin: 30,
    frontSplitMax: 55,
    defaultFrontSplit: 40,
    lowRangeRatio: null,
    torqueVectoringBonus: 0.16,
    weightKg: 84,
    unitCost: 2_900,
    capitalCost: 17_000_000,
    rdCost: 70,
    durabilityFactor: 1.08,
    description: 'Trazione integrale permanente simmetrica o sbilanciata al retrotreno per motori longitudinali.',
  },
  {
    id: 'awd-4wd-heavy-lowrange',
    mappedLayout: '4WD_HeavyDuty_LowRange',
    name: '4WD Heavy-Duty con Ridotte (Low-Range 2.7x)',
    minYear: 1950,
    allowedOrientations: ['Longitudinale'],
    lossPercent: 22.0,
    frontSplitMin: 50,
    frontSplitMax: 50,
    defaultFrontSplit: 50,
    lowRangeRatio: 2.72,
    torqueVectoringBonus: 0.04,
    weightKg: 118,
    unitCost: 3_600,
    capitalCost: 15_000_000,
    rdCost: 50,
    durabilityFactor: 1.32,
    description: 'Ripartitore centrale rinforzato ad ingranaggi con riduttore fuoristrada 2.72:1 e bloccaggio centrale.',
  },
];

export interface DifferentialOption {
  id: DifferentialType;
  name: string;
  minYear: number;
  lossDeltaPercent: number;
  tractionBonus: number;
  corneringBonus: number;
  weightKg: number;
  unitCost: number;
  capitalCost: number;
  rdCost: number;
  durabilityFactor: number;
  description: string;
}

export const DIFFERENTIAL_OPTIONS: DifferentialOption[] = [
  {
    id: 'open',
    name: 'Differenziale Aperto Standard',
    minYear: 1950,
    lossDeltaPercent: 0.0,
    tractionBonus: 0.0,
    corneringBonus: 0.0,
    weightKg: 18,
    unitCost: 220,
    capitalCost: 1_000_000,
    rdCost: 4,
    durabilityFactor: 1.15,
    description: 'Semplice ed economico, ma la ruota interna scarica può pattinare in uscita di curva.',
  },
  {
    id: 'viscous-lsd',
    name: 'Autobloccante Viscoso',
    minYear: 1984,
    lossDeltaPercent: 0.3,
    tractionBonus: 0.09,
    corneringBonus: 0.07,
    weightKg: 21,
    unitCost: 520,
    capitalCost: 3_200_000,
    rdCost: 14,
    durabilityFactor: 1.05,
    description: 'Giunto siliconico progressivo che riduce lo slittamento su fondi a bassa aderenza.',
  },
  {
    id: 'mechanical-clutch-lsd',
    name: 'Autobloccante Meccanico a Lamelle (LSD)',
    minYear: 1966,
    lossDeltaPercent: 0.5,
    tractionBonus: 0.18,
    corneringBonus: 0.15,
    weightKg: 24,
    unitCost: 1_150,
    capitalCost: 5_500_000,
    rdCost: 24,
    durabilityFactor: 0.94,
    description: 'Bloccaggio meccanico immediato in trazione e rilascio con rampe tarate per uso sportivo.',
  },
  {
    id: 'torsen-helical',
    name: 'Torsen / Elicoidale Torque-Sensing',
    minYear: 1986,
    lossDeltaPercent: 0.4,
    tractionBonus: 0.16,
    corneringBonus: 0.16,
    weightKg: 23,
    unitCost: 1_350,
    capitalCost: 7_200_000,
    rdCost: 32,
    durabilityFactor: 1.20,
    description: 'Zero usura dischi e reazione istantanea lineare su asfalto asciutto e cordoli.',
  },
  {
    id: 'electronic-torque-vectoring',
    name: 'Differenziale Attivo Elettronico (E-Diff / Torque Vectoring)',
    minYear: 2008,
    lossDeltaPercent: 0.6,
    tractionBonus: 0.24,
    corneringBonus: 0.25,
    weightKg: 28,
    unitCost: 2_600,
    capitalCost: 14_000_000,
    rdCost: 65,
    durabilityFactor: 1.04,
    description: 'Frizioni elettroidrauliche modulate millisecondo per millisecondo dalla telemetria di imbardata.',
  },
  {
    id: 'offroad-locking',
    name: 'Bloccaggio Meccanico 100% Off-Road (Ant/Post)',
    minYear: 1970,
    lossDeltaPercent: 0.8,
    tractionBonus: 0.26,
    corneringBonus: 0.02,
    weightKg: 32,
    unitCost: 1_450,
    capitalCost: 5_000_000,
    rdCost: 20,
    durabilityFactor: 1.28,
    description: 'Blocco integrale per fango, roccia e pendenze estreme a bassa velocità.',
  },
];

export interface SteeringOption {
  id: SteeringType;
  name: string;
  minYear: number;
  precisionScore: number;
  weightKg: number;
  unitCost: number;
  capitalCost: number;
  rdCost: number;
  durabilityFactor: number;
  description: string;
}

export const STEERING_OPTIONS: SteeringOption[] = [
  {
    id: 'manual-rack',
    name: 'Cremagliera Manuale Diretta',
    minYear: 1950,
    precisionScore: 68,
    weightKg: 14,
    unitCost: 240,
    capitalCost: 1_200_000,
    rdCost: 5,
    durabilityFactor: 1.25,
    description: 'Leggerissima e comunicativa su auto piuma, ma faticosa in manovra.',
  },
  {
    id: 'hydraulic-hps',
    name: 'Idroguida Idraulica (HPS)',
    minYear: 1965,
    precisionScore: 84,
    weightKg: 23,
    unitCost: 580,
    capitalCost: 3_500_000,
    rdCost: 14,
    durabilityFactor: 1.06,
    description: 'Feedback analogico naturale lungo tutto l’arco di sterzata.',
  },
  {
    id: 'electro-hydraulic',
    name: 'Elettroidraulico (EHPS)',
    minYear: 1998,
    precisionScore: 86,
    weightKg: 21,
    unitCost: 780,
    capitalCost: 5_200_000,
    rdCost: 24,
    durabilityFactor: 1.08,
    description: 'Mantiene la sensibilità della pressione idraulica eliminando la pompa trascinata a cinghia.',
  },
  {
    id: 'electric-eps',
    name: 'Servosterzo Elettrico Variabile (EPS)',
    minYear: 2004,
    precisionScore: 89,
    weightKg: 17,
    unitCost: 920,
    capitalCost: 8_500_000,
    rdCost: 40,
    durabilityFactor: 1.15,
    description: 'Demoltiplicazione adattiva e assistenza leggera integrabile con ESC ed ADAS.',
  },
  {
    id: 'steer-by-wire',
    name: 'Steer-by-Wire Digitale Adattivo',
    minYear: 2016,
    precisionScore: 95,
    weightKg: 15,
    unitCost: 2_100,
    capitalCost: 16_000_000,
    rdCost: 78,
    durabilityFactor: 1.10,
    description: 'Rapporto di sterzo variabile istantaneamente tra tornanti e velocità di punta.',
  },
];

export interface SuspensionOption {
  id: SuspensionType;
  name: string;
  minYear: number;
  gripGeometryScore: number;
  comfortScore: number;
  offRoadScore: number;
  weightKg: number;
  unitCost: number;
  capitalCost: number;
  rdCost: number;
  durabilityFactor: number;
  description: string;
}

export const SUSPENSION_OPTIONS: SuspensionOption[] = [
  {
    id: 'solid-axle-leaf',
    name: 'Ponte Rigido a Balestre',
    minYear: 1950,
    gripGeometryScore: 34,
    comfortScore: 32,
    offRoadScore: 84,
    weightKg: 48,
    unitCost: 300,
    capitalCost: 1_500_000,
    rdCost: 6,
    durabilityFactor: 1.38,
    description: 'Robustezza estrema al carico e al traino, ma masse non sospese elevate.',
  },
  {
    id: 'solid-axle-coil',
    name: 'Ponte Rigido a Molle Elicoidali / Panhard',
    minYear: 1970,
    gripGeometryScore: 46,
    comfortScore: 52,
    offRoadScore: 96,
    weightKg: 44,
    unitCost: 480,
    capitalCost: 3_000_000,
    rdCost: 14,
    durabilityFactor: 1.32,
    description: 'Massima escursione ruota in fuoristrada duro con assorbimento superiore alle balestre.',
  },
  {
    id: 'torsion-beam',
    name: 'Ponte Interconnesso (Torsion Beam)',
    minYear: 1974,
    gripGeometryScore: 60,
    comfortScore: 62,
    offRoadScore: 38,
    weightKg: 28,
    unitCost: 320,
    capitalCost: 2_800_000,
    rdCost: 12,
    durabilityFactor: 1.18,
    description: 'Compatto ed economico per il retrotreno di compatte FWD a basso ingombro.',
  },
  {
    id: 'macpherson',
    name: 'Schema MacPherson',
    minYear: 1955,
    gripGeometryScore: 71,
    comfortScore: 70,
    offRoadScore: 56,
    weightKg: 26,
    unitCost: 450,
    capitalCost: 3_800_000,
    rdCost: 18,
    durabilityFactor: 1.15,
    description: 'Leggero e compatto, lascia ampio spazio trasversale nel vano motore.',
  },
  {
    id: 'double-wishbone',
    name: 'Quadrilatero Alto (Double Wishbone Alluminio)',
    minYear: 1962,
    gripGeometryScore: 91,
    comfortScore: 78,
    offRoadScore: 68,
    weightKg: 34,
    unitCost: 2_100,
    capitalCost: 11_000_000,
    rdCost: 52,
    durabilityFactor: 1.06,
    description: 'Controllo rigoroso del camber in compressione e rollio per vetture sportive.',
  },
  {
    id: 'multi-link',
    name: 'Multi-Link 5 Bracci Indipendente',
    minYear: 1988,
    gripGeometryScore: 89,
    comfortScore: 92,
    offRoadScore: 52,
    weightKg: 36,
    unitCost: 1_350,
    capitalCost: 10_500_000,
    rdCost: 48,
    durabilityFactor: 1.08,
    description: 'Disaccoppia smorzamento longitudinale e recupero di convergenza per comfort e precisione.',
  },
  {
    id: 'pushrod-inboard',
    name: 'Push-Rod Inboard (Motorsport / Hypercar)',
    minYear: 1995,
    gripGeometryScore: 98,
    comfortScore: 44,
    offRoadScore: 14,
    weightKg: 29,
    unitCost: 7_500,
    capitalCost: 26_000_000,
    rdCost: 120,
    durabilityFactor: 0.78,
    description: 'Molle e ammortizzatori orizzontali nella scocca: flussi ruota pulitissimi e rigidità verticale estrema.',
  },
];

export interface StabilityControlOption {
  id: StabilityControlType;
  name: string;
  minYear: number;
  baseIntervention: number;
  launchTractionBonus: number;
  absPrecisionBonus: number;
  hasAbs: boolean;
  hasTcs: boolean;
  hasEsc: boolean;
  supportedModes: StabilityDriveMode[];
  allowsCustomThresholds: boolean;
  tcsOnly: boolean;
  weightKg: number;
  unitCost: number;
  capitalCost: number;
  rdCost: number;
  description: string;
}

export const STABILITY_CONTROL_OPTIONS: StabilityControlOption[] = [
  {
    id: 'none',
    name: 'Nessun Controllo Elettronico (Puro Meccanico)',
    minYear: 1950,
    baseIntervention: 0.0,
    launchTractionBonus: 0.0,
    absPrecisionBonus: 0.0,
    hasAbs: false,
    hasTcs: false,
    hasEsc: false,
    supportedModes: [],
    allowsCustomThresholds: false,
    tcsOnly: false,
    weightKg: 0,
    unitCost: 0,
    capitalCost: 0,
    rdCost: 0,
    description: 'Nessun ausilio elettronico su frenata o pattinamento.',
  },
  {
    id: 'abs-only',
    name: 'ABS Stradale Antibloccaggio',
    minYear: 1978,
    baseIntervention: 0.25,
    launchTractionBonus: 0.04,
    absPrecisionBonus: 0.08,
    hasAbs: true,
    hasTcs: false,
    hasEsc: false,
    supportedModes: [],
    allowsCustomThresholds: true,
    tcsOnly: false,
    weightKg: 4,
    unitCost: 280,
    capitalCost: 550_000,
    rdCost: 12,
    description: 'ABS stradale con soglia di slittamento in frenata tarabile.',
  },
  {
    id: 'abs-racing',
    name: 'ABS Sport / Racing Motorsport',
    minYear: 1996,
    baseIntervention: 0.35,
    launchTractionBonus: 0.06,
    absPrecisionBonus: 0.22,
    hasAbs: true,
    hasTcs: false,
    hasEsc: false,
    supportedModes: [],
    allowsCustomThresholds: true,
    tcsOnly: false,
    weightKg: 3.5,
    unitCost: 3_800,
    capitalCost: 2_200_000,
    rdCost: 65,
    description: 'Modulatore alta frequenza per pneumatici slick e pista, senza TCS/ESC.',
  },
  {
    id: 'abs-tcs',
    name: 'ABS + Controllo Trazione (TCS)',
    minYear: 1990,
    baseIntervention: 0.50,
    launchTractionBonus: 0.14,
    absPrecisionBonus: 0.10,
    hasAbs: true,
    hasTcs: true,
    hasEsc: false,
    supportedModes: ['road', 'custom'],
    allowsCustomThresholds: true,
    tcsOnly: true,
    weightKg: 5,
    unitCost: 520,
    capitalCost: 950_000,
    rdCost: 22,
    description: 'Soglie ABS e TCS regolabili per gestire trazione e staccata.',
  },
  {
    id: 'esc-standard',
    name: 'ESC Stabilità Integrale Stradale',
    minYear: 1998,
    baseIntervention: 0.80,
    launchTractionBonus: 0.18,
    absPrecisionBonus: 0.14,
    hasAbs: true,
    hasTcs: true,
    hasEsc: true,
    supportedModes: ['road', 'sport'],
    allowsCustomThresholds: true,
    tcsOnly: false,
    weightKg: 6,
    unitCost: 780,
    capitalCost: 1_450_000,
    rdCost: 35,
    description: 'Soglie ABS, TCS e ESC di fabbrica tutte tarabili dall’ingegnere.',
  },
  {
    id: 'esc-sport-variable',
    name: 'ESC Sport / Track Multi-Mappa',
    minYear: 2008,
    baseIntervention: 1.0,
    launchTractionBonus: 0.28,
    absPrecisionBonus: 0.20,
    hasAbs: true,
    hasTcs: true,
    hasEsc: true,
    supportedModes: ['road', 'sport', 'track', 'offroad', 'custom'],
    allowsCustomThresholds: true,
    tcsOnly: false,
    weightKg: 7,
    unitCost: 2_400,
    capitalCost: 2_800_000,
    rdCost: 80,
    description: 'Mappe selezionabili (Strada/Sport/Track/Off-Road/Custom) e taratura completa.',
  },
  {
    id: 'esc-motorsport-imu',
    name: 'Motorsport ABS Race + TC/ESC IMU 6-Assi',
    minYear: 2015,
    baseIntervention: 1.15,
    launchTractionBonus: 0.36,
    absPrecisionBonus: 0.28,
    hasAbs: true,
    hasTcs: true,
    hasEsc: true,
    supportedModes: ['road', 'sport', 'track', 'offroad', 'custom'],
    allowsCustomThresholds: true,
    tcsOnly: false,
    weightKg: 5.5,
    unitCost: 8_500,
    capitalCost: 4_800_000,
    rdCost: 165,
    description: 'Piattaforma inerziale IMU a 6 assi, ABS Race e TC/ESC predittivo da competizione.',
  },
];

export const STABILITY_DRIVE_MODE_PRESETS: Record<
  StabilityDriveMode,
  { label: string; tcsSlipPercent: number; escYawPercent: number }
> = {
  road: { label: 'Strada (Road)', tcsSlipPercent: 80, escYawPercent: 85 },
  sport: { label: 'Sport (Deriva Controllata)', tcsSlipPercent: 45, escYawPercent: 40 },
  track: { label: 'Pista (Track / Race)', tcsSlipPercent: 20, escYawPercent: 15 },
  offroad: { label: 'Fuoristrada (Off-Road)', tcsSlipPercent: 30, escYawPercent: 50 },
  custom: { label: 'Personalizzata (Custom)', tcsSlipPercent: 50, escYawPercent: 50 },
};

export interface BrakeCaliperOption {
  id: BrakeCaliperType;
  name: string;
  minYear: number;
  pistonForceFactor: number;
  caliperClearanceMm: number;
  weightPerCornerKg: number;
  unitCostPerAxle: number;
  capitalCost: number;
  rdCost: number;
  description: string;
}

export const BRAKE_CALIPER_OPTIONS: BrakeCaliperOption[] = [
  {
    id: 'drum',
    name: 'Tamburo Meccanico / Idraulico',
    minYear: 1950,
    pistonForceFactor: 0.55,
    caliperClearanceMm: 68,
    weightPerCornerKg: 7.5,
    unitCostPerAxle: 140,
    capitalCost: 150_000,
    rdCost: 2,
    description: 'Economico per basse potenze o assali posteriori storici, ma soggetto a fading rapido.',
  },
  {
    id: 'floating-1p',
    name: 'Pinza Flottante 1 Pistone',
    minYear: 1962,
    pistonForceFactor: 0.82,
    caliperClearanceMm: 68,
    weightPerCornerKg: 5.5,
    unitCostPerAxle: 260,
    capitalCost: 280_000,
    rdCost: 4,
    description: 'Standard leggero ed affidabile per impiego stradale compatto.',
  },
  {
    id: 'floating-2p',
    name: 'Pinza Flottante 2 Pistoni',
    minYear: 1982,
    pistonForceFactor: 0.96,
    caliperClearanceMm: 74,
    weightPerCornerKg: 6.4,
    unitCostPerAxle: 420,
    capitalCost: 480_000,
    rdCost: 7,
    description: 'Maggior superficie pastiglia per berline veloci e SUV.',
  },
  {
    id: 'fixed-4p',
    name: 'Pinza Fissa Monoblocco 4 Pistoni',
    minYear: 1988,
    pistonForceFactor: 1.18,
    caliperClearanceMm: 82,
    weightPerCornerKg: 5.2,
    unitCostPerAxle: 1_150,
    capitalCost: 950_000,
    rdCost: 12,
    description: 'Rigidità pinza superiore e modulabilità sportiva costante ad alte temperature.',
  },
  {
    id: 'fixed-6p',
    name: 'Pinza Fissa Monoblocco 6 Pistoni',
    minYear: 2003,
    pistonForceFactor: 1.36,
    caliperClearanceMm: 90,
    weightPerCornerKg: 5.8,
    unitCostPerAxle: 2_250,
    capitalCost: 1_650_000,
    rdCost: 20,
    description: 'Pressione uniforme su pastiglie lunghe per staccate ripetute da oltre 280 km/h.',
  },
  {
    id: 'fixed-8p-race',
    name: 'Pinza Fissa Ricavata dal Pieno 8 Pistoni (Race)',
    minYear: 2012,
    pistonForceFactor: 1.52,
    caliperClearanceMm: 96,
    weightPerCornerKg: 5.4,
    unitCostPerAxle: 4_400,
    capitalCost: 2_600_000,
    rdCost: 32,
    description: 'Impianto endurance ad altissima resistenza al fading.',
  },
];

export interface BrakeDiscOption {
  id: BrakeDiscType;
  name: string;
  minYear: number;
  frictionCoeff: number;
  heatCapacityJPerKgK: number;
  coolingRateCoeff: number;
  densityScale: number;
  unitCostPerAxle: number;
  capitalCost: number;
  rdCost: number;
  durabilityFactor: number;
  description: string;
}

export const BRAKE_DISC_OPTIONS: BrakeDiscOption[] = [
  {
    id: 'solid-iron',
    name: 'Ghisa Piena',
    minYear: 1950,
    frictionCoeff: 0.36,
    heatCapacityJPerKgK: 420,
    coolingRateCoeff: 0.65,
    densityScale: 1.0,
    unitCostPerAxle: 120,
    capitalCost: 120_000,
    rdCost: 2,
    durabilityFactor: 1.0,
    description: 'Disco semplice senza canali interni di ventilazione.',
  },
  {
    id: 'vented-iron',
    name: 'Ghisa Autoventilante',
    minYear: 1966,
    frictionCoeff: 0.40,
    heatCapacityJPerKgK: 480,
    coolingRateCoeff: 1.05,
    densityScale: 1.12,
    unitCostPerAxle: 240,
    capitalCost: 300_000,
    rdCost: 5,
    durabilityFactor: 1.08,
    description: 'Camere radiali di pompaggio aria per smaltimento calore costante.',
  },
  {
    id: 'drilled-slotted-iron',
    name: 'Ghisa Baffata / Forata Componibile (Campana Alu)',
    minYear: 1986,
    frictionCoeff: 0.44,
    heatCapacityJPerKgK: 525,
    coolingRateCoeff: 1.32,
    densityScale: 0.96,
    unitCostPerAxle: 680,
    capitalCost: 750_000,
    rdCost: 10,
    durabilityFactor: 0.92,
    description: 'Evacuazione gas e polvere pastiglia con campana in lega leggera.',
  },
  {
    id: 'carbon-ceramic',
    name: 'Carboceramico (CCM-R)',
    minYear: 2001,
    frictionCoeff: 0.49,
    heatCapacityJPerKgK: 1050,
    coolingRateCoeff: 1.65,
    densityScale: 0.48,
    unitCostPerAxle: 5_200,
    capitalCost: 2_600_000,
    rdCost: 32,
    durabilityFactor: 1.55,
    description: 'Capacità termica doppia e peso non sospeso dimezzato rispetto alla ghisa.',
  },
  {
    id: 'carbon-carbon',
    name: 'Carbo-Carbo (C/C) Racing',
    minYear: 1995,
    frictionCoeff: 0.56,
    heatCapacityJPerKgK: 1750,
    coolingRateCoeff: 2.05,
    densityScale: 0.34,
    unitCostPerAxle: 18_500,
    capitalCost: 4_200_000,
    rdCost: 55,
    durabilityFactor: 0.65,
    description: 'Frenata estrema a caldo (>300°C) tipo F1 / Bugatti Bolide, massa minima e altissima capacità termica.',
  },
];

export interface GearboxStrengthTierOption {
  id: GearboxStrengthTier;
  name: string;
  minYear: number;
  torqueMultiplier: number;
  weightMultiplier: number;
  unitCostMultiplier: number;
  capitalCostMultiplier: number;
  rdCostDelta: number;
  description: string;
}

export const GEARBOX_STRENGTH_TIERS: GearboxStrengthTierOption[] = [
  {
    id: 'compact',
    name: 'Compatto / Leggero (Utilitarie)',
    minYear: 1950,
    torqueMultiplier: 0.70,
    weightMultiplier: 0.88,
    unitCostMultiplier: 0.80,
    capitalCostMultiplier: 0.85,
    rdCostDelta: 0,
    description: 'Ingranaggi snelli a basso attrito per motori compatti fino a media coppia.',
  },
  {
    id: 'standard',
    name: 'Standard OEM',
    minYear: 1950,
    torqueMultiplier: 1.00,
    weightMultiplier: 1.00,
    unitCostMultiplier: 1.00,
    capitalCostMultiplier: 1.00,
    rdCostDelta: 0,
    description: 'Dimensionamento di serie bilanciato tra resistenza, massa e costi.',
  },
  {
    id: 'heavy-duty',
    name: 'Rinforzato Heavy-Duty',
    minYear: 1965,
    torqueMultiplier: 1.65,
    weightMultiplier: 1.18,
    unitCostMultiplier: 1.55,
    capitalCostMultiplier: 1.25,
    rdCostDelta: 20,
    description: 'Alberi maggiorati e denti cementati per coppie elevate, SUV e traino.',
  },
  {
    id: 'motorsport',
    name: 'Motorsport Billet / Titanio',
    minYear: 1995,
    torqueMultiplier: 2.50,
    weightMultiplier: 1.05,
    unitCostMultiplier: 3.20,
    capitalCostMultiplier: 1.65,
    rdCostDelta: 55,
    description: 'Acciai speciali e lavorazione CNC per supercar e coppie estreme.',
  },
];

export interface AbsModuleOption {
  id: AbsModuleType;
  name: string;
  minYear: number;
  absPrecisionBonus: number;
  baseIntervention: number;
  weightKg: number;
  unitCost: number;
  capitalCost: number;
  rdCost: number;
}

export const ABS_MODULE_OPTIONS: AbsModuleOption[] = [
  { id: 'none', name: 'Nessun ABS', minYear: 1950, absPrecisionBonus: 0, baseIntervention: 0, weightKg: 0, unitCost: 0, capitalCost: 0, rdCost: 0 },
  { id: 'abs-road', name: 'ABS Stradale', minYear: 1978, absPrecisionBonus: 0.08, baseIntervention: 0.25, weightKg: 4, unitCost: 280, capitalCost: 550_000, rdCost: 12 },
  { id: 'abs-racing', name: 'ABS Sport / Racing Motorsport', minYear: 1996, absPrecisionBonus: 0.22, baseIntervention: 0.35, weightKg: 3.5, unitCost: 3_800, capitalCost: 2_200_000, rdCost: 65 },
];

export interface TcsModuleOption {
  id: TcsModuleType;
  name: string;
  minYear: number;
  launchTractionBonus: number;
  baseIntervention: number;
  weightKg: number;
  unitCost: number;
  capitalCost: number;
  rdCost: number;
}

export const TCS_MODULE_OPTIONS: TcsModuleOption[] = [
  { id: 'none', name: 'Nessun TCS', minYear: 1950, launchTractionBonus: 0, baseIntervention: 0, weightKg: 0, unitCost: 0, capitalCost: 0, rdCost: 0 },
  { id: 'tcs-standard', name: 'TCS Standard', minYear: 1990, launchTractionBonus: 0.14, baseIntervention: 0.25, weightKg: 1, unitCost: 280, capitalCost: 450_000, rdCost: 12 },
  { id: 'tcs-sport', name: 'TCS Sport / Launch Control', minYear: 2005, launchTractionBonus: 0.22, baseIntervention: 0.35, weightKg: 1.5, unitCost: 950, capitalCost: 1_100_000, rdCost: 28 },
  { id: 'tcs-motorsport-imu', name: 'TCS Motorsport IMU', minYear: 2015, launchTractionBonus: 0.30, baseIntervention: 0.45, weightKg: 1.2, unitCost: 3_600, capitalCost: 2_100_000, rdCost: 60 },
];

export interface EscModuleOption {
  id: EscModuleType;
  name: string;
  minYear: number;
  baseIntervention: number;
  weightKg: number;
  unitCost: number;
  capitalCost: number;
  rdCost: number;
}

export const ESC_MODULE_OPTIONS: EscModuleOption[] = [
  { id: 'none', name: 'Nessun ESC', minYear: 1950, baseIntervention: 0, weightKg: 0, unitCost: 0, capitalCost: 0, rdCost: 0 },
  { id: 'esc-standard', name: 'ESC Standard', minYear: 1998, baseIntervention: 0.30, weightKg: 1.5, unitCost: 450, capitalCost: 650_000, rdCost: 16 },
  { id: 'esc-sport', name: 'ESC Sport', minYear: 2008, baseIntervention: 0.40, weightKg: 1.8, unitCost: 1_450, capitalCost: 1_500_000, rdCost: 38 },
  { id: 'esc-motorsport-imu', name: 'ESC Motorsport IMU 6-Assi', minYear: 2015, baseIntervention: 0.50, weightKg: 1.5, unitCost: 4_800, capitalCost: 2_800_000, rdCost: 85 },
];

export const DRIVE_MODE_SELECTOR_SPEC = {
  minYear: 2004,
  unitCost: 450,
  capitalCost: 650_000,
  rdCost: 25,
};
