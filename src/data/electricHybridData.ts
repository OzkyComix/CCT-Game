import type {
  BatteryChemistry,
  DualCurrencyCost,
  ElectricCoolingSystem,
  ElectricMotorType,
  HybridSystemType,
  InverterTech,
  MotorLayoutConfig,
  PriceTier,
  ReferenceClass,
} from '../types/gameTypes';

export interface HybridSystemTypeSpec {
  id: HybridSystemType;
  name: string;
  badge: string;
  minYear: number;
  unlockCost: DualCurrencyCost;
  description: string;
  hasIceEngine: boolean;
  minBatteryKwh: number;
  maxBatteryKwh: number;
  defaultBatteryKwh: number;
  emissionsReductionPercent: number;
  complexityFactor: number;
}

export const HYBRID_SYSTEM_TYPES: HybridSystemTypeSpec[] = [
  {
    id: 'PureEV',
    name: '100% Elettrico Puro a Batteria (BEV)',
    badge: 'BEV Zero Emissioni',
    minYear: 2008,
    unlockCost: { capitalCost: 18_000_000, rdCost: 220, minYear: 2008 },
    description: 'Trazione 100% elettrica a zero emissioni locali. Coppia istantanea da 0 rpm, architettura skateboard a pavimento piatto.',
    hasIceEngine: false,
    minBatteryKwh: 35,
    maxBatteryKwh: 150,
    defaultBatteryKwh: 75,
    emissionsReductionPercent: 100,
    complexityFactor: 1.0,
  },
  {
    id: 'MHEV',
    name: 'Mild Hybrid 48V (Ibrido Leggero — Torque Fill)',
    badge: 'MHEV 48V',
    minYear: 2014,
    unlockCost: { capitalCost: 4_500_000, rdCost: 65, minYear: 2014 },
    description: 'Motorino generatore a 48V (ISG P0/P2) collegato all’albero motore: assiste nei transitori, elimina il turbo lag e taglia consumi ed emissioni.',
    hasIceEngine: true,
    minBatteryKwh: 1.0,
    maxBatteryKwh: 4.0,
    defaultBatteryKwh: 2.0,
    emissionsReductionPercent: 14,
    complexityFactor: 1.15,
  },
  {
    id: 'FullHybrid',
    name: 'Full Hybrid (HEV — Parallelo / Serie-Parallelo)',
    badge: 'HEV Autoricabile',
    minYear: 1997,
    unlockCost: { capitalCost: 12_000_000, rdCost: 160, minYear: 1997 },
    description: 'Sistema autoricaricabile con motore elettrico integrato nel cambio (P2/P3): consente marcia elettrica a bassa velocità e veleggiamento a zero consumi.',
    hasIceEngine: true,
    minBatteryKwh: 1.5,
    maxBatteryKwh: 8.0,
    defaultBatteryKwh: 3.5,
    emissionsReductionPercent: 35,
    complexityFactor: 1.35,
  },
  {
    id: 'PHEV',
    name: 'Plug-in Hybrid (PHEV — Ibrido Ricaricabile alla Spina)',
    badge: 'PHEV 80+ km EV',
    minYear: 2012,
    unlockCost: { capitalCost: 22_000_000, rdCost: 260, minYear: 2012 },
    description: 'Doppia anima: batteria capiente per 50-100 km in solo elettrico e motore termico per lunghi viaggi, con potenza combinata devastante.',
    hasIceEngine: true,
    minBatteryKwh: 12,
    maxBatteryKwh: 40,
    defaultBatteryKwh: 22,
    emissionsReductionPercent: 72,
    complexityFactor: 1.6,
  },
  {
    id: 'RangeExtender',
    name: 'Range Extender (REEV — Ibrido Serie con Generatore)',
    badge: 'REEV E-Drive',
    minYear: 2010,
    unlockCost: { capitalCost: 14_000_000, rdCost: 180, minYear: 2010 },
    description: 'Trazione 100% elettrica alle ruote: il compatto motore termico a bordo non è collegato alle ruote ma funge esclusivamente da generatore di corrente.',
    hasIceEngine: true,
    minBatteryKwh: 20,
    maxBatteryKwh: 60,
    defaultBatteryKwh: 35,
    emissionsReductionPercent: 82,
    complexityFactor: 1.45,
  },
];

export interface ElectricMotorTypeSpec {
  id: ElectricMotorType;
  name: string;
  minYear: number;
  unlockCost: DualCurrencyCost;
  priceTier: PriceTier;
  referenceClass: ReferenceClass;
  peakEfficiencyPercent: number;
  powerDensityKwPerKg: number;
  torqueDensityNmPerKg: number;
  costPerKw: number;
  maxSafeRpm: number;
  rareEarthDependency: 'Alta' | 'Media' | 'Zero';
  description: string;
}

export const ELECTRIC_MOTOR_TYPES: ElectricMotorTypeSpec[] = [
  {
    id: 'PermanentMagnetSync',
    name: 'PSM — Sincrono a Magneti Permanenti Neodimio',
    minYear: 1997,
    unlockCost: { capitalCost: 6_000_000, rdCost: 80, minYear: 1997 },
    priceTier: 'Premium',
    referenceClass: 'Sport',
    peakEfficiencyPercent: 97.5,
    powerDensityKwPerKg: 3.4,
    torqueDensityNmPerKg: 6.8,
    costPerKw: 22,
    maxSafeRpm: 18000,
    rareEarthDependency: 'Alta',
    description: 'Massima efficienza e coppia ai medi regimi. Standard industriale globale, sensibile alle alte temperature (rischio smagnetizzazione rotorica).',
  },
  {
    id: 'InductionAsync',
    name: 'ASM — Asincrono a Induzione (Gabbia di Scoiattolo)',
    minYear: 1990,
    unlockCost: { capitalCost: 2_500_000, rdCost: 40, minYear: 1990 },
    priceTier: 'Media',
    referenceClass: 'Normale',
    peakEfficiencyPercent: 94.0,
    powerDensityKwPerKg: 2.8,
    torqueDensityNmPerKg: 5.2,
    costPerKw: 14,
    maxSafeRpm: 19500,
    rareEarthDependency: 'Zero',
    description: 'Zero magneti e zero terre rare (stile Tesla originale). Nessuna perdita di trascinamento a vuoto (ideale per asse secondario disinseribile).',
  },
  {
    id: 'ElectricallyExcitedSync',
    name: 'EESM — Sincrono a Rotore Avvolto Elettricamente',
    minYear: 2015,
    unlockCost: { capitalCost: 11_000_000, rdCost: 140, minYear: 2015 },
    priceTier: 'Premium',
    referenceClass: 'Comfort',
    peakEfficiencyPercent: 96.8,
    powerDensityKwPerKg: 3.6,
    torqueDensityNmPerKg: 6.2,
    costPerKw: 19,
    maxSafeRpm: 21000,
    rareEarthDependency: 'Zero',
    description: 'Il rotore usa bobine di rame al posto dei magneti (stile BMW Gen 5). Efficienza eccezionale ad altissima velocità in autostrada modulando il flusso.',
  },
  {
    id: 'AxialFlux',
    name: 'Flusso Assiale — Rotore a Disco Ultrasottile (Stile YASA)',
    minYear: 2020,
    unlockCost: { capitalCost: 26_000_000, rdCost: 320, minYear: 2020 },
    priceTier: 'Lusso',
    referenceClass: 'Corsa',
    peakEfficiencyPercent: 98.2,
    powerDensityKwPerKg: 7.2,
    torqueDensityNmPerKg: 14.5,
    costPerKw: 42,
    maxSafeRpm: 15500,
    rareEarthDependency: 'Alta',
    description: 'Tecnologia da hypercar (Ferrari SF90 / Koenigsegg): flusso magnetico planare perpendicolare, spessore ridotto a pochi centimetri e densità di coppia ineguagliabile.',
  },
];

export interface MotorLayoutSpec {
  id: MotorLayoutConfig;
  name: string;
  motorCount: number;
  drivetrainType: 'FWD' | 'RWD' | 'eAWD';
  torqueVectoring: boolean;
  costMultiplier: number;
  weightAddKg: number;
  description: string;
}

export const MOTOR_LAYOUT_CONFIGS: MotorLayoutSpec[] = [
  {
    id: 'SingleMotor_FWD',
    name: '1 Motore Elettrico — Trazione Anteriore (e-FWD)',
    motorCount: 1,
    drivetrainType: 'FWD',
    torqueVectoring: false,
    costMultiplier: 1.0,
    weightAddKg: 0,
    description: 'Layout compatto per citycar e berline economiche: massima abitabilità a bordo.',
  },
  {
    id: 'SingleMotor_RWD',
    name: '1 Motore Elettrico — Trazione Posteriore (e-RWD)',
    motorCount: 1,
    drivetrainType: 'RWD',
    torqueVectoring: false,
    costMultiplier: 1.05,
    weightAddKg: 8,
    description: 'Dinamica di guida sportiva e motricità naturale in accelerazione su asse posteriore.',
  },
  {
    id: 'DualMotor_eAWD',
    name: '2 Motori Elettrici — Trazione Integrale Elettrica (e-AWD)',
    motorCount: 2,
    drivetrainType: 'eAWD',
    torqueVectoring: false,
    costMultiplier: 1.88,
    weightAddKg: 55,
    description: '1 motore anteriore + 1 motore posteriore senza albero di trasmissione fisico: motricità totale istantanea.',
  },
  {
    id: 'TriMotor_TorqueVectoring',
    name: '3 Motori Elettrici — Torque Vectoring Posteriore Attivo',
    motorCount: 3,
    drivetrainType: 'eAWD',
    torqueVectoring: true,
    costMultiplier: 2.75,
    weightAddKg: 95,
    description: '1 motore anteriore + 2 motori posteriori indipendenti: generazione di momento d’imbardata attivo in curva.',
  },
  {
    id: 'QuadMotor_Independent',
    name: '4 Motori Elettrici Indipendenti — 1 per Ruota (Hypercar)',
    motorCount: 4,
    drivetrainType: 'eAWD',
    torqueVectoring: true,
    costMultiplier: 3.65,
    weightAddKg: 140,
    description: 'Controllo millimetrico della coppia su ogni singola ruota: rotazione sul posto (Tank Turn) e tenuta laterale estrema.',
  },
];

export interface BatteryChemistrySpec {
  id: BatteryChemistry;
  name: string;
  minYear: number;
  cellDensityWhPerKg: number;
  packagingMultiplier: number; // Involucro, BMS, piastre termiche
  costPerKwh: number;
  cycleLife: number; // Cicli carica/scarica al 80% SOH
  thermalStability: 'Eccellente' | 'Buona' | 'Critica';
  maxChargeRateC: number; // 2C = 100kW su 50kWh
  description: string;
}

export const BATTERY_CHEMISTRIES: BatteryChemistrySpec[] = [
  {
    id: 'LFP',
    name: 'LFP — Litio Ferro Fosfato (LiFePO4)',
    minYear: 2005,
    cellDensityWhPerKg: 165,
    packagingMultiplier: 1.32,
    costPerKwh: 78,
    cycleLife: 3500,
    thermalStability: 'Eccellente',
    maxChargeRateC: 2.2,
    description: 'Celle chimicamente stabili, zero rischio incendio, durata ultra-decennale ma peso superiore a parità di kWh.',
  },
  {
    id: 'NMC811',
    name: 'NMC 811 — Nichel Manganese Cobalto (80-10-10)',
    minYear: 2016,
    cellDensityWhPerKg: 265,
    packagingMultiplier: 1.25,
    costPerKwh: 120,
    cycleLife: 1800,
    thermalStability: 'Buona',
    maxChargeRateC: 3.2,
    description: 'Standard moderno ad alta densità: riduce la massa del pacco batteria e garantisce elevata potenza di scarica.',
  },
  {
    id: 'NCA',
    name: 'NCA — Nichel Cobalto Alluminio (Motorsport / Sportive)',
    minYear: 2012,
    cellDensityWhPerKg: 295,
    packagingMultiplier: 1.22,
    costPerKwh: 155,
    cycleLife: 1400,
    thermalStability: 'Critica',
    maxChargeRateC: 4.5,
    description: 'Massima densità ed erogazione di picco da competizione. Richiede raffreddamento estremo per prevenire surriscaldamenti.',
  },
  {
    id: 'SolidState',
    name: 'Stato Solido — Elettrolita Ceramico Avanzato (R&D)',
    minYear: 2026,
    cellDensityWhPerKg: 430,
    packagingMultiplier: 1.15,
    costPerKwh: 235,
    cycleLife: 4200,
    thermalStability: 'Eccellente',
    maxChargeRateC: 6.0,
    description: 'Tecnologia del futuro: addio elettrolita liquido infiammabile. Dimezza il peso, ricarica ultra-rapida 10-80% in 7 minuti.',
  },
];

export interface CoolingSystemSpec {
  id: ElectricCoolingSystem;
  name: string;
  minYear: number;
  cost: number;
  weightKg: number;
  continuousPowerRatio: number; // Percentuale potenza di picco mantenibile stabilmente
  thermalDeratingMarginPercent: number;
  description: string;
}

export const ELECTRIC_COOLING_SYSTEMS: CoolingSystemSpec[] = [
  {
    id: 'Air',
    name: 'Aria Forzata a Convezione Naturale / Elettroventole',
    minYear: 1990,
    cost: 180,
    weightKg: 6,
    continuousPowerRatio: 0.55,
    thermalDeratingMarginPercent: 28,
    description: 'Economico e leggero, ma taglia drasticamente la potenza dopo pochi secondi di accelerazione piena.',
  },
  {
    id: 'LiquidGlycol',
    name: 'Liquido con Piastre Radianti Intermedie (Glicole/Acqua)',
    minYear: 2010,
    cost: 850,
    weightKg: 26,
    continuousPowerRatio: 0.82,
    thermalDeratingMarginPercent: 12,
    description: 'Standard automotive moderno: canali di raffreddamento a serpentina sotto le celle e attorno al rotore.',
  },
  {
    id: 'DirectDielectric',
    name: 'Immersione Dielettrica Diretta (Fluido Termico Isolante)',
    minYear: 2022,
    cost: 2400,
    weightKg: 38,
    continuousPowerRatio: 0.98,
    thermalDeratingMarginPercent: 2,
    description: 'Fluido sintetico dielettrico non conduttivo a contatto diretto con celle, busbar e avvolgimenti: zero derating.',
  },
];

export interface InverterTechSpec {
  id: InverterTech;
  name: string;
  minYear: number;
  efficiencyPercent: number;
  switchingFrequencyKhz: number;
  costPerInverter: number;
  weightKg: number;
  description: string;
}

export const INVERTER_TECHNOLOGIES: InverterTechSpec[] = [
  {
    id: 'Silicon_IGBT',
    name: 'IGBT al Silicio (Si Standard Industriale)',
    minYear: 1995,
    efficiencyPercent: 94.5,
    switchingFrequencyKhz: 16,
    costPerInverter: 420,
    weightKg: 14,
    description: 'Semiconduttore collaudato ed economico con perdite di commutazione medie.',
  },
  {
    id: 'SiliconCarbide_SiC',
    name: 'SiC — Carburo di Silicio (MOSFET Alta Efficienza)',
    minYear: 2018,
    efficiencyPercent: 98.8,
    switchingFrequencyKhz: 95,
    costPerInverter: 1150,
    weightKg: 8.5,
    description: 'Dimezza le perdite Joule termiche. Fondamentale per architetture a 800V e frenata rigenerativa ad alta potenza.',
  },
  {
    id: 'GalliumNitride_GaN',
    name: 'GaN — Nitruro di Gallio ad Altissima Frequenza',
    minYear: 2024,
    efficiencyPercent: 99.4,
    switchingFrequencyKhz: 250,
    costPerInverter: 2600,
    weightKg: 4.2,
    description: 'Semiconduttore microscopico da motorsport: commutazioni ultra-rapide e dissipatore termico quasi azzerato.',
  },
];
