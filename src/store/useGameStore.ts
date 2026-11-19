import { create } from 'zustand';
import {
  APEX_SEAL_MATERIALS,
  BLOCK_MATERIALS,
  CAMSHAFT_TYPES,
  CONROD_TYPES,
  CRANKSHAFT_TYPES,
  FUEL_SYSTEMS,
  HEAD_MATERIALS,
  OIL_METERING_SYSTEMS,
  PISTON_TYPES,
  WANKEL_HOUSING_MATERIALS,
  WANKEL_PORTING_TYPES,
} from '../data/historicalEras';
import { CHASSIS_STRUCTURES } from '../data/chassisData';
import {
  type BatteryPackEntity,
  type BodyAeroConfig,
  type BodyAeroMetrics,
  type ChassisEntity,
  type ComponentEntity,
  type DrivetrainSetupConfig,
  type DrivetrainSetupMetrics,
  type ElectricMotorEntity,
  type CoupledIceEngineOption,
  type DualCurrencyCost,
  type DualCurrencyResources,
  type EngineEntity,
  type PistonEngineSpecs,
  type WankelEngineSpecs,
  type PriceTier,
  type ReferenceClass,
  type SavedBodyAero,
  type SavedDrivetrainSetup,
  type SubBrand,
  type VehicleEntity,
  calculateEstimatedDurabilityKm,
} from '../types/gameTypes';
import { simulatePistonEngineDyno } from '../math/engineMath';
import { simulateWankelEngineDyno } from '../math/wankelMath';

export interface DualCurrencyGateResult {
  allowed: boolean;
  missingCapital: number;
  missingRdPoints: number;
  missingYear: boolean;
  reason?: string;
}

export interface ActiveVariantParentInfo {
  type: 'piston' | 'wankel' | 'electricMotor' | 'batteryPack' | 'chassis';
  id: string;
  name: string;
  codeName: string;
  entity: EngineEntity | ElectricMotorEntity | BatteryPackEntity | ChassisEntity;
}

export interface TransactionLogEntry {
  id: string;
  timestamp: string;
  actionName: string;
  capitalSpent: number;
  rdSpent: number;
}

export interface GameState {
  currentYear: number;
  currentMonth: number;
  /** Sistema a Doppia Valuta di Sviluppo: Capitale Finanziario + Punti R&D */
  resources: DualCurrencyResources;
  /** ID della componentistica motore sbloccata tramite R&D */
  unlockedEnginePartIds: string[];
  /** Database Modulare: 5 Entità Indipendenti */
  subBrands: SubBrand[];
  engines: EngineEntity[];
  chassisList: ChassisEntity[];
  bodyAeroList: SavedBodyAero[];
  drivetrainSetups: SavedDrivetrainSetup[];
  components: ComponentEntity[];
  vehicles: VehicleEntity[];
  transactionLog: TransactionLogEntry[];

  /** Bozza live del Motore a Pistoni attualmente configurato nella Tab 1A (per test Ibridi 1C) */
  livePistonDraft: CoupledIceEngineOption;
  /** Bozza live del Motore Wankel attualmente configurato nella Tab 1B (per test Ibridi 1C) */
  liveWankelDraft: CoupledIceEngineOption;

  /** Libreria Modulo 1.4: singole unità motore elettrico e pacchi batteria salvati separatamente */
  savedElectricMotors: ElectricMotorEntity[];
  savedBatteryPacks: BatteryPackEntity[];

  /** Stato globale Modalità Variante / Evoluzione attiva */
  activeVariantParent: ActiveVariantParentInfo | null;
  startVariant: (info: ActiveVariantParentInfo) => void;
  clearVariant: () => void;

  // Azioni Doppia Valuta & Gate di Validazione
  validateDualCurrencyGate: (cost: DualCurrencyCost) => DualCurrencyGateResult;
  spendDualCurrency: (actionName: string, cost: DualCurrencyCost) => DualCurrencyGateResult;
  addResources: (capitalDelta: number, rdDelta: number) => void;
  advanceMonth: () => void;
  setHistoricalYear: (year: number) => void;

  // Azioni Fase 1A: Sblocco Componenti Base Motore & Omologazione Propulsore
  unlockEnginePart: (partId: string, partName: string, cost: DualCurrencyCost) => DualCurrencyGateResult;
  saveEngineToDatabase: (engine: EngineEntity) => DualCurrencyGateResult;
  toggleEngineB2B: (engineId: string) => void;
  setLivePistonDraft: (draft: CoupledIceEngineOption) => void;
  setLiveWankelDraft: (draft: CoupledIceEngineOption) => void;
  saveElectricMotorToLibrary: (motor: ElectricMotorEntity) => DualCurrencyGateResult;
  saveBatteryPackToLibrary: (pack: BatteryPackEntity) => DualCurrencyGateResult;
  saveChassisToDatabase: (chassis: ChassisEntity) => DualCurrencyGateResult;
  addBodyAero: (bodyAero: SavedBodyAero) => DualCurrencyGateResult;
  updateBodyAero: (id: string, config: BodyAeroConfig, metrics: BodyAeroMetrics) => DualCurrencyGateResult;
  deleteBodyAero: (id: string) => void;
  addDrivetrainSetup: (setup: SavedDrivetrainSetup) => DualCurrencyGateResult;
  updateDrivetrainSetup: (id: string, config: DrivetrainSetupConfig, metrics: DrivetrainSetupMetrics) => DualCurrencyGateResult;
  deleteDrivetrainSetup: (id: string) => void;

  // Azioni Database Modulare
  addCustomComponent: (params: {
    name: string;
    category: ComponentEntity['category'];
    priceTier: PriceTier;
    referenceClass: ReferenceClass;
    materialName: string;
    materialResistanceFactor: number;
    mechanicalStressFactor: number;
    cost: DualCurrencyCost;
  }) => DualCurrencyGateResult;
  toggleComponentB2B: (componentId: string) => void;
}

// Ricava tutti i componenti base motore già sbloccati di default (Pistoni 1A e Wankel 1B)
const defaultUnlockedParts = [
  ...BLOCK_MATERIALS,
  ...HEAD_MATERIALS,
  ...PISTON_TYPES,
  ...CONROD_TYPES,
  ...CRANKSHAFT_TYPES,
  ...CAMSHAFT_TYPES,
  ...FUEL_SYSTEMS,
  ...APEX_SEAL_MATERIALS,
  ...WANKEL_PORTING_TYPES,
  ...WANKEL_HOUSING_MATERIALS,
  ...OIL_METERING_SYSTEMS,
  ...CHASSIS_STRUCTURES,
]
  .filter((p) => p.defaultUnlocked)
  .map((p) => p.id);

// ============================================================================
// SEED DATA ARCHITETTURA MODULARE (FASE 0 & FASE 1A)
// ============================================================================

const initialSubBrands: SubBrand[] = [
  {
    id: 'sb-officine-milano',
    name: 'Officine Meccaniche Milano',
    foundedYear: 1970,
    nation: 'Italia',
    prestige: 68,
    primaryTargetClass: 'Sport',
    primaryPriceTier: 'Premium',
    isFounderBrand: true,
    groupSharingEnabled: true,
    estimatedMarketValue: 185_000_000,
  },
  {
    id: 'sb-scuderia-corsa',
    name: 'Reparto Squadra Corse',
    foundedYear: 1974,
    nation: 'Italia',
    prestige: 84,
    primaryTargetClass: 'Corsa',
    primaryPriceTier: 'Lusso',
    isFounderBrand: false,
    groupSharingEnabled: true,
    estimatedMarketValue: 95_000_000,
  },
];

const initialPistonSpecs: PistonEngineSpecs = {
  architecture: 'V',
  bankAngleDeg: 90,
  cylinders: 6,
  boreMm: 86.5,
  strokeMm: 82.0,
  unitDisplacementCc: 482,
  totalDisplacementCc: 2891,
  strokeBoreRatio: 0.95,
  blockMaterial: 'Alluminio AlSi Forgiato c/ Riporto Plasma/Nikasil',
  blockMaterialId: 'blk-alu-forged-nikasil',
  headMaterial: 'Alluminio Trattato Termicamente T6 Flussi CNC',
  headMaterialId: 'hd-alu-t6',
  pistonType: 'Pistoni Forgiati Raffreddati a Getto d’Olio',
  pistonTypeId: 'pst-forged-oiljet',
  conrodType: 'Bielle in Acciaio C70 Fratturato',
  conrodTypeId: 'rod-c70-fractured',
  crankshaftType: 'Acciaio Forgiato Nitrurato Controbilanciato',
  crankshaftTypeId: 'crk-forged-nitrided',
  camshaftType: 'DOHC con Variatore di Fase Continuo (VVT)',
  camshaftTypeId: 'cam-dohc-vvt',
  valvesPerCylinder: 4,
  fuelType: 'Benzina',
  fuelSystem: 'Iniezione Diretta Ad Alta Pressione (GDI 350 bar)',
  fuelSystemId: 'fs-gdi-350bar',
  intakeSystem: 'Doppio Corpo Farfallato Plenum Corto ad Alto Flusso',
  intakeSystemId: 'int-plenum-short',
  exhaustManifold: 'Inconel Tubolare Integrato Ultraleggero',
  exhaustManifoldId: 'exh-inconel',
  turboType: 'TwinScroll',
  turboCountConfig: 'TwinTurbo',
  turboBearingType: 'BallBearing',
  turboArRatio: 0.65,
  turboStagesArRatios: [0.65, 0.65],
  boostPressureBar: 0.245,
  compressionRatio: 9.3,
  manualRedlineRpm: 7250,
  intendedOrientation: 'Longitudinale',
  nativeOrientation: 'Longitudinale',
  turboPosition: 'HotV',
  catalystEra: 'Era4_ActiveGlobalFilter_Euro7',
};

const initialPistonTelemetry = simulatePistonEngineDyno({
  ...initialPistonSpecs,
  priceTier: 'Premium',
  referenceClass: 'Sport',
  bankAngleDeg: initialPistonSpecs.bankAngleDeg ?? 90,
  compressionRatio: initialPistonSpecs.compressionRatio ?? 9.3,
  turboCountConfig: initialPistonSpecs.turboCountConfig ?? 'TwinTurbo',
  turboBearingType: initialPistonSpecs.turboBearingType ?? 'BallBearing',
  turboArRatio: initialPistonSpecs.turboArRatio ?? 0.65,
  turboStagesArRatios: initialPistonSpecs.turboStagesArRatios ?? [0.65, 0.65],
  boostPressureBar: initialPistonSpecs.boostPressureBar ?? 0.245,
  manualRedlineRpm: initialPistonSpecs.manualRedlineRpm ?? 7250,
  intendedOrientation: initialPistonSpecs.intendedOrientation ?? 'Longitudinale',
  nativeOrientation: initialPistonSpecs.nativeOrientation ?? 'Longitudinale',
  blockMaterialId: initialPistonSpecs.blockMaterialId!,
  headMaterialId: initialPistonSpecs.headMaterialId!,
  pistonTypeId: initialPistonSpecs.pistonTypeId!,
  conrodTypeId: initialPistonSpecs.conrodTypeId!,
  crankshaftTypeId: initialPistonSpecs.crankshaftTypeId!,
  camshaftTypeId: initialPistonSpecs.camshaftTypeId!,
  fuelSystemId: initialPistonSpecs.fuelSystemId!,
  intakeSystemId: initialPistonSpecs.intakeSystemId!,
  exhaustManifoldId: initialPistonSpecs.exhaustManifoldId!,
});

const initialWankelSpecs: WankelEngineSpecs = {
  rotorCount: 2,
  generatingRadiusMm: 105,
  eccentricityMm: 15,
  rotorWidthMm: 80,
  unitDisplacementCc: 654,
  totalDisplacementCc: 1308,
  equivalentDisplacementCc: 2616,
  portType: 'StandardSide',
  apexSealMaterialId: 'seal-tool-steel-dlc',
  apexSealMaterialName: 'Acciaio per Utensili Forgiato 3 Pezzi con Riporto DLC',
  apexSealThicknessMm: 2.0,
  housingMaterialId: 'whs-alu-cermet-nikasil',
  oilMeteringSystemId: 'omp-electronic-mikuni',
  compressionRatio: 9.0,
  fuelType: 'Benzina',
  turboType: 'TwinScroll',
  turboCountConfig: 'TwinTurbo',
  turboBearingType: 'Journal',
  turboArRatio: 0.60,
  turboStagesArRatios: [0.60, 0.60],
  turboStagesDiametersMm: [48, 48],
  boostPressureBar: 0.435,
  manualRedlineRpm: 8200,
  intendedOrientation: 'Longitudinale',
  nativeOrientation: 'Longitudinale',
  turboPosition: 'Lateral',
  catalystEra: 'Era2_ThreeWayLambda_80s90s',
  oilConsumptionLPer1000Km: 0.65,
  apexSealWearRatePercentPer10kKm: 2.15,
};

const initialWankelTelemetry = simulateWankelEngineDyno({
  ...initialWankelSpecs,
  priceTier: 'Premium',
  referenceClass: 'Sport',
  turboCountConfig: initialWankelSpecs.turboCountConfig ?? 'TwinTurbo',
  turboBearingType: initialWankelSpecs.turboBearingType ?? 'Journal',
  turboArRatio: initialWankelSpecs.turboArRatio ?? 0.60,
  turboStagesArRatios: initialWankelSpecs.turboStagesArRatios ?? [0.60, 0.60],
  turboStagesDiametersMm: initialWankelSpecs.turboStagesDiametersMm ?? [48, 48],
  boostPressureBar: initialWankelSpecs.boostPressureBar ?? 0.435,
  intendedOrientation: initialWankelSpecs.intendedOrientation ?? 'Longitudinale',
  nativeOrientation: initialWankelSpecs.nativeOrientation ?? 'Longitudinale',
});

const buildSeedPistonEngine = (opts: {
  id: string;
  name: string;
  codeName: string;
  createdYear: number;
  priceTier: PriceTier;
  referenceClass: ReferenceClass;
  architecture: PistonEngineSpecs['architecture'];
  cylinderCount: number;
  bankAngleDeg: number;
  boreMm: number;
  strokeMm: number;
  compressionRatio: number;
  manualRedlineRpm: number;
  nativeOrientation: 'Trasversale' | 'Longitudinale';
  turboType: PistonEngineSpecs['turboType'];
  turboCountConfig: PistonEngineSpecs['turboCountConfig'];
  boostPressureBar: number;
  turboPosition: PistonEngineSpecs['turboPosition'];
  dimensionsMm: { lengthMm: number; widthMm: number; heightMm: number };
  capitalCost: number;
  rdCost: number;
}): EngineEntity => {
  const specs: PistonEngineSpecs = {
    ...initialPistonSpecs,
    architecture: opts.architecture,
    cylinders: opts.cylinderCount,
    bankAngleDeg: opts.bankAngleDeg,
    boreMm: opts.boreMm,
    strokeMm: opts.strokeMm,
    compressionRatio: opts.compressionRatio,
    manualRedlineRpm: opts.manualRedlineRpm,
    intendedOrientation: opts.nativeOrientation,
    nativeOrientation: opts.nativeOrientation,
    turboType: opts.turboType,
    turboCountConfig: opts.turboCountConfig,
    boostPressureBar: opts.boostPressureBar,
    turboPosition: opts.turboPosition,
  };
  const telemetry = simulatePistonEngineDyno({
    ...specs,
    priceTier: opts.priceTier,
    referenceClass: opts.referenceClass,
    bankAngleDeg: opts.bankAngleDeg,
    compressionRatio: opts.compressionRatio,
    turboCountConfig: opts.turboCountConfig ?? 'SingleTurbo',
    turboBearingType: specs.turboBearingType ?? 'BallBearing',
    turboArRatio: specs.turboArRatio ?? 0.65,
    turboStagesArRatios: specs.turboStagesArRatios ?? [0.65, 0.65],
    boostPressureBar: opts.boostPressureBar,
    manualRedlineRpm: opts.manualRedlineRpm,
    intendedOrientation: opts.nativeOrientation,
    nativeOrientation: opts.nativeOrientation,
    blockMaterialId: specs.blockMaterialId!,
    headMaterialId: specs.headMaterialId!,
    pistonTypeId: specs.pistonTypeId!,
    conrodTypeId: specs.conrodTypeId!,
    crankshaftTypeId: specs.crankshaftTypeId!,
    camshaftTypeId: specs.camshaftTypeId!,
    fuelSystemId: specs.fuelSystemId!,
    intakeSystemId: specs.intakeSystemId!,
    exhaustManifoldId: specs.exhaustManifoldId!,
  });
  return {
    id: opts.id,
    name: opts.name,
    codeName: opts.codeName,
    ownerSubBrandId: 'sb-officine-milano',
    createdYear: opts.createdYear,
    propulsionType: 'Piston_1A',
    taxonomy: {
      priceTier: opts.priceTier,
      referenceClass: opts.referenceClass,
      materialStress: {
        materialName: 'Lega Alluminio OEM',
        materialResistanceFactor: 1.25,
        mechanicalStressFactor: 1.0,
      },
      estimatedDurabilityKm: calculateEstimatedDurabilityKm(
        opts.priceTier,
        opts.referenceClass,
        1.25,
        1.0,
      ),
    },
    dimensionsMm: opts.dimensionsMm,
    pistonSpecs: specs,
    telemetry,
    b2bSaleEnabled: true,
    b2bUnitsSold: 0,
    developmentCost: {
      capitalCost: opts.capitalCost,
      rdCost: opts.rdCost,
      minYear: opts.createdYear,
    },
  };
};

const initialEngines: EngineEntity[] = [
  buildSeedPistonEngine({
    id: 'eng-seed-12-i4-65',
    name: '1.2L I4 Compatto (65 CV)',
    codeName: 'FIRE-1242',
    createdYear: 2005,
    priceTier: 'Economica',
    referenceClass: 'Normale',
    architecture: 'Inline',
    cylinderCount: 4,
    bankAngleDeg: 0,
    boreMm: 70.8,
    strokeMm: 78.8,
    compressionRatio: 10.2,
    manualRedlineRpm: 5800,
    nativeOrientation: 'Trasversale',
    turboType: 'NaturallyAspirated',
    turboCountConfig: 'SingleTurbo',
    boostPressureBar: 0,
    turboPosition: 'Front',
    dimensionsMm: { lengthMm: 390, widthMm: 455, heightMm: 575 },
    capitalCost: 9_000_000,
    rdCost: 60,
  }),
  buildSeedPistonEngine({
    id: 'eng-seed-20-i4-turbo-280',
    name: '2.0L Turbo I4 (280 CV)',
    codeName: 'TBI-2000',
    createdYear: 2016,
    priceTier: 'Media',
    referenceClass: 'Sport',
    architecture: 'Inline',
    cylinderCount: 4,
    bankAngleDeg: 0,
    boreMm: 84.0,
    strokeMm: 90.0,
    compressionRatio: 9.6,
    manualRedlineRpm: 6800,
    nativeOrientation: 'Trasversale',
    turboType: 'TwinScroll',
    turboCountConfig: 'SingleTurbo',
    boostPressureBar: 1.35,
    turboPosition: 'Lateral',
    dimensionsMm: { lengthMm: 445, widthMm: 535, heightMm: 615 },
    capitalCost: 21_000_000,
    rdCost: 150,
  }),
  buildSeedPistonEngine({
    id: 'eng-seed-30-i6-biturbo-420',
    name: '3.0L I6 Biturbo (420 CV)',
    codeName: 'S55-3000T',
    createdYear: 2018,
    priceTier: 'Premium',
    referenceClass: 'Sport',
    architecture: 'Inline',
    cylinderCount: 6,
    bankAngleDeg: 0,
    boreMm: 84.0,
    strokeMm: 89.6,
    compressionRatio: 9.8,
    manualRedlineRpm: 7200,
    nativeOrientation: 'Longitudinale',
    turboType: 'TwinScroll',
    turboCountConfig: 'TwinTurbo',
    boostPressureBar: 1.25,
    turboPosition: 'Lateral',
    dimensionsMm: { lengthMm: 760, widthMm: 575, heightMm: 650 },
    capitalCost: 34_000_000,
    rdCost: 260,
  }),
  buildSeedPistonEngine({
    id: 'eng-seed-40-v8-biturbo-620',
    name: '4.0L V8 Biturbo (620 CV)',
    codeName: 'M178-V8TT',
    createdYear: 2020,
    priceTier: 'Lusso',
    referenceClass: 'Sport',
    architecture: 'V',
    cylinderCount: 8,
    bankAngleDeg: 90,
    boreMm: 86.0,
    strokeMm: 86.0,
    compressionRatio: 9.5,
    manualRedlineRpm: 7500,
    nativeOrientation: 'Longitudinale',
    turboType: 'TwinScroll',
    turboCountConfig: 'TwinTurbo',
    boostPressureBar: 1.45,
    turboPosition: 'HotV',
    dimensionsMm: { lengthMm: 645, widthMm: 725, heightMm: 665 },
    capitalCost: 52_000_000,
    rdCost: 420,
  }),
  {
    id: 'eng-v6-2900-biturbo',
    name: '2.9L V6 90° Bi-Turbo Hot-V',
    codeName: 'Tipo 690T',
    ownerSubBrandId: 'sb-officine-milano',
    createdYear: 2016,
    propulsionType: 'Piston_1A',
    taxonomy: {
      priceTier: 'Premium',
      referenceClass: 'Sport',
      materialStress: {
        materialName: 'Alluminio Forgiato Aerospaziale',
        materialResistanceFactor: 1.45,
        mechanicalStressFactor: 1.25,
      },
      estimatedDurabilityKm: calculateEstimatedDurabilityKm('Premium', 'Sport', 1.45, 1.25),
    },
    dimensionsMm: {
      lengthMm: 525,
      widthMm: 695,
      heightMm: 665,
    },
    pistonSpecs: initialPistonSpecs,
    telemetry: initialPistonTelemetry,
    b2bSaleEnabled: true,
    b2bUnitsSold: 1_420,
    developmentCost: {
      capitalCost: 45_000_000,
      rdCost: 380,
      minYear: 2010,
    },
  },
  {
    id: 'eng-wankel-13b-rew',
    name: '1.3L Twin-Rotor Sequential Biturbo (Tipo 13B-REW)',
    codeName: 'ROT-13B-TT',
    ownerSubBrandId: 'sb-officine-milano',
    createdYear: 1993,
    propulsionType: 'Wankel_1B',
    taxonomy: {
      priceTier: 'Premium',
      referenceClass: 'Sport',
      materialStress: {
        materialName: 'Alluminio Cermet + Apex Seal Acciaio Tool DLC',
        materialResistanceFactor: 1.55,
        mechanicalStressFactor: 1.15,
      },
      estimatedDurabilityKm: calculateEstimatedDurabilityKm('Premium', 'Sport', 1.55, 1.15),
    },
    dimensionsMm: {
      lengthMm: 510,
      widthMm: 520,
      heightMm: 510,
    },
    wankelSpecs: initialWankelSpecs,
    telemetry: initialWankelTelemetry,
    b2bSaleEnabled: true,
    b2bUnitsSold: 840,
    developmentCost: {
      capitalCost: 28_000_000,
      rdCost: 240,
      minYear: 1991,
    },
  },
];

const initialChassis: ChassisEntity[] = [
  {
    id: 'chs-giorgio-evo',
    name: 'Piattaforma Modulare Giorgio Evo',
    codeName: 'PRJ-952 (Ant-Long.)',
    ownerSubBrandId: 'sb-officine-milano',
    createdYear: 2016,
    generationNumber: 1,
    taxonomy: {
      priceTier: 'Premium',
      referenceClass: 'Sport',
      materialStress: {
        materialName: 'Ibrido Acciaio Ultra-Resistente / Alluminio / Carbonio',
        materialResistanceFactor: 1.75,
        mechanicalStressFactor: 0.9,
      },
      estimatedDurabilityKm: calculateEstimatedDurabilityKm('Premium', 'Sport', 1.75, 0.9),
    },
    overallDimensionsMm: { lengthMm: 4640, widthMm: 1860, heightMm: 1430 },
    wheelbaseMm: 2820,
    frontTrackMm: 1555,
    rearTrackMm: 1625,
    groundClearanceMm: 122,
    torsionalRigidityNmPerDeg: 35_000,
    structuralSafetyScore: 94,
    engineBayMaxDimensionsMm: {
      lengthMm: 740,
      widthMm: 820,
      heightMm: 720,
    },
    supportedEnginePositions: ['Anteriore', 'Anteriore-Centrale'],
    supportedEngineOrientations: ['Longitudinale'],
    engineSetbackPercent: 68,
    supportedDrivetrains: ['RWD', 'AWD'],
    calculatedSegment: 'D',
    baseWeightKg: 315,
    unitManufacturingCost: 6_800,
    developmentCost: { capitalCost: 85_000_000, rdCost: 650, minYear: 2012 },
  },
  {
    id: 'chs-compact-c-transverse',
    name: 'Pianale Compatto C-Modular',
    codeName: 'PRJ-940 (Ant-Trasv.)',
    ownerSubBrandId: 'sb-officine-milano',
    createdYear: 2010,
    generationNumber: 2,
    taxonomy: {
      priceTier: 'Media',
      referenceClass: 'Normale',
      materialStress: {
        materialName: 'Acciaio Stampato Altoresistenziale',
        materialResistanceFactor: 1.35,
        mechanicalStressFactor: 0.85,
      },
      estimatedDurabilityKm: calculateEstimatedDurabilityKm('Media', 'Normale', 1.35, 0.85),
    },
    overallDimensionsMm: { lengthMm: 4350, widthMm: 1795, heightMm: 1460 },
    wheelbaseMm: 2635,
    frontTrackMm: 1550,
    rearTrackMm: 1550,
    groundClearanceMm: 135,
    torsionalRigidityNmPerDeg: 24_500,
    structuralSafetyScore: 86,
    engineBayMaxDimensionsMm: {
      lengthMm: 575,
      widthMm: 765,
      heightMm: 645,
    },
    supportedEnginePositions: ['Anteriore'],
    supportedEngineOrientations: ['Trasversale'],
    engineSetbackPercent: 25,
    supportedDrivetrains: ['FWD', 'AWD'],
    calculatedSegment: 'C',
    baseWeightKg: 280,
    unitManufacturingCost: 3_900,
    developmentCost: { capitalCost: 45_000_000, rdCost: 320, minYear: 1995 },
  },
  {
    id: 'chs-carbon-tub-mid',
    name: 'Monoscocca Carbonio Corse GT',
    codeName: 'PRJ-F160 (Centr-Post.)',
    ownerSubBrandId: 'sb-scuderia-corsa',
    createdYear: 2015,
    generationNumber: 1,
    taxonomy: {
      priceTier: 'Lusso',
      referenceClass: 'Corsa',
      materialStress: {
        materialName: 'Pre-Preg Fibra di Carbonio T1000 / Honeycomb Alluminio',
        materialResistanceFactor: 2.15,
        mechanicalStressFactor: 0.95,
      },
      estimatedDurabilityKm: calculateEstimatedDurabilityKm('Lusso', 'Corsa', 2.15, 0.95),
    },
    overallDimensionsMm: { lengthMm: 4580, widthMm: 1965, heightMm: 1185 },
    wheelbaseMm: 2650,
    frontTrackMm: 1675,
    rearTrackMm: 1645,
    groundClearanceMm: 98,
    torsionalRigidityNmPerDeg: 48_000,
    structuralSafetyScore: 96,
    engineBayMaxDimensionsMm: {
      lengthMm: 890,
      widthMm: 930,
      heightMm: 635,
    },
    supportedEnginePositions: ['Centrale-Posteriore'],
    supportedEngineOrientations: ['Longitudinale'],
    engineSetbackPercent: 85,
    supportedDrivetrains: ['RWD', 'AWD'],
    calculatedSegment: 'S',
    baseWeightKg: 192,
    unitManufacturingCost: 22_500,
    developmentCost: { capitalCost: 140_000_000, rdCost: 920, minYear: 2005 },
  },
  {
    id: 'chs-rear-boxer-sport',
    name: 'Telaio Sport Posteriore a Sbalzo',
    codeName: 'PRJ-911R (Post-Basso)',
    ownerSubBrandId: 'sb-scuderia-corsa',
    createdYear: 1998,
    generationNumber: 3,
    taxonomy: {
      priceTier: 'Premium',
      referenceClass: 'Sport',
      materialStress: {
        materialName: 'Acciaio Galvanizzato / Alluminio Stampato',
        materialResistanceFactor: 1.6,
        mechanicalStressFactor: 0.92,
      },
      estimatedDurabilityKm: calculateEstimatedDurabilityKm('Premium', 'Sport', 1.6, 0.92),
    },
    overallDimensionsMm: { lengthMm: 4490, widthMm: 1850, heightMm: 1295 },
    wheelbaseMm: 2450,
    frontTrackMm: 1540,
    rearTrackMm: 1590,
    groundClearanceMm: 108,
    torsionalRigidityNmPerDeg: 33_000,
    structuralSafetyScore: 90,
    engineBayMaxDimensionsMm: {
      lengthMm: 615,
      widthMm: 990,
      heightMm: 575,
    },
    supportedEnginePositions: ['Posteriore'],
    supportedEngineOrientations: ['Longitudinale'],
    engineSetbackPercent: 15,
    supportedDrivetrains: ['RWD', 'AWD'],
    calculatedSegment: 'S',
    baseWeightKg: 265,
    unitManufacturingCost: 8_400,
    developmentCost: { capitalCost: 65_000_000, rdCost: 480, minYear: 1970 },
  },
];

const initialComponents: ComponentEntity[] = [
  {
    id: 'cmp-zf8hp-sport',
    name: 'Cambio Automatico 8 Rapporti Torque-Converter Sport',
    category: 'Cambio',
    ownerSubBrandId: 'sb-officine-milano',
    taxonomy: {
      priceTier: 'Premium',
      referenceClass: 'Sport',
      materialStress: {
        materialName: 'Ingranaggi Acciaio Cementato + Scatola Magnesio',
        materialResistanceFactor: 1.5,
        mechanicalStressFactor: 1.1,
      },
      estimatedDurabilityKm: calculateEstimatedDurabilityKm('Premium', 'Sport', 1.5, 1.1),
    },
    origin: 'InHouse',
    studyLevel: 3,
    improvementPointsAvailable: 2,
    equippedSpells: [
      {
        id: 'spell-fast-lockup',
        name: 'Lock-Up Istantaneo 150ms',
        description: 'Riduce la perdita idraulica e velocizza i passaggi marcia in piena coppia.',
        improvementPointsCost: 1,
        modifiers: {
          performanceBonusPercent: 3.5,
          efficiencyBonusPercent: 2.0,
        },
      },
    ],
    testedOnMuleVehicleId: 'veh-berlina-qv-gen1',
    b2bSaleEnabled: true,
    b2bUnitsSold: 4_850,
    productionMode: 'Internal',
    unitManufacturingCost: 2_350,
    developmentCost: {
      capitalCost: 18_000_000,
      rdCost: 220,
      minYear: 2010,
    },
  },
  {
    id: 'cmp-brembo-ccb-6pot',
    name: 'Impianto Carboceramico 6 Pompanti Monoblocco',
    category: 'PinzaFreno',
    ownerSubBrandId: 'sb-scuderia-corsa',
    taxonomy: {
      priceTier: 'Lusso',
      referenceClass: 'Corsa',
      materialStress: {
        materialName: 'Composito Carbonio-Silicio Ceramico (CCM-R)',
        materialResistanceFactor: 2.2,
        mechanicalStressFactor: 0.75,
      },
      estimatedDurabilityKm: calculateEstimatedDurabilityKm('Lusso', 'Corsa', 2.2, 0.75),
    },
    origin: 'ThirdParty',
    supplierName: 'Brembo Racing Partner',
    studyLevel: 4,
    improvementPointsAvailable: 1,
    equippedSpells: [],
    b2bSaleEnabled: false,
    b2bUnitsSold: 0,
    productionMode: 'Outsourced',
    unitManufacturingCost: 4_900,
    developmentCost: {
      capitalCost: 9_500_000,
      rdCost: 140,
      minYear: 2005,
    },
  },
];

const initialVehicles: VehicleEntity[] = [
  {
    id: 'veh-berlina-qv-gen1',
    modelName: 'Arese GT Quadrifoglio',
    generationCode: 'Serie 952 Mk1',
    generationNumber: 1,
    trimType: 'Sport',
    subBrandId: 'sb-officine-milano',
    chassisId: 'chs-giorgio-evo',
    engineId: 'eng-v6-2900-biturbo',
    bodyStyle: 'Berlina',
    bodyMaterial: 'Alluminio + Cofano/Tetto in Fibra di Carbonio',
    taxonomy: {
      priceTier: 'Premium',
      referenceClass: 'Sport',
      materialStress: {
        materialName: 'Telaio Giorgio Evo + V6 2.9 Bi-Turbo',
        materialResistanceFactor: 1.5,
        mechanicalStressFactor: 1.18,
      },
      estimatedDurabilityKm: calculateEstimatedDurabilityKm('Premium', 'Sport', 1.5, 1.18),
    },
    drivetrainType: 'RWD',
    awdLayout: 'None_2WD',
    gearRatios: [4.71, 3.14, 2.11, 1.67, 1.29, 1.0, 0.84, 0.67],
    finalDriveRatio: 3.09,
    drivetrainLossPercent: 11.5,
    stabilityControlThresholdPercent: 85,
    isStrippedRaceInterior: false,
    calculatedSeats: 5,
    calculatedTrunkLiters: 480,
    installedComponentIds: ['cmp-zf8hp-sport', 'cmp-brembo-ccb-6pot'],
    lifecycleStatus: 'ActiveProduction',
    unitTotalCost: 34_200,
    listPrice: 89_500,
    warrantyYears: 3,
    warrantyKm: 100_000,
    developmentCost: {
      capitalCost: 42_000_000,
      rdCost: 310,
      minYear: 2016,
    },
  },
];

// ============================================================================
// ZUSTAND STORE
// ============================================================================

export const useGameStore = create<GameState>((set, get) => ({
  currentYear: 2016,
  currentMonth: 4,
  resources: {
    // Valori sandbox pre-Fase 5.1 per test completi di tutte le combinazioni
    financialCapital: 1_000_000_000,
    rdPoints: 5_000,
  },
  unlockedEnginePartIds: defaultUnlockedParts,
  subBrands: initialSubBrands,
  engines: initialEngines,
  chassisList: initialChassis,
  bodyAeroList: [],
  drivetrainSetups: [],
  components: initialComponents,
  vehicles: initialVehicles,
  livePistonDraft: {
    id: 'live-piston-1a',
    sourceKind: 'LivePiston1A',
    name: '2.0L I4 16v Twin-Scroll Turbo (Tab 1A Live)',
    codeName: 'PRJ-20T-1A',
    propulsionType: 'Piston_1A',
    architectureLabel: '2.0L 4 Cilindri in Linea Turbo',
    displacementCc: 1998,
    displacementLiters: 2.0,
    cylindersOrRotors: 4,
    fuelType: 'Benzina',
    isTurbo: true,
    peakPowerHp: 280,
    peakPowerRpm: 5800,
    peakTorqueNm: 400,
    peakTorqueRpm: 2500,
    redlineRpm: 6800,
    dryWeightKg: 138,
    wetWeightKg: 151,
    dimensionsMm: { lengthMm: 470, widthMm: 585, heightMm: 625 },
    emissionsGPerKm: 158,
    reliabilityPercent: 86.5,
    estimatedLifespanKm: 235_000,
    unitProductionCost: 4_600,
    curve: [
      { rpm: 1000, torqueNm: 205, powerHp: 29 },
      { rpm: 1500, torqueNm: 290, powerHp: 62 },
      { rpm: 2000, torqueNm: 375, powerHp: 107 },
      { rpm: 2500, torqueNm: 400, powerHp: 142 },
      { rpm: 3000, torqueNm: 400, powerHp: 171 },
      { rpm: 3500, torqueNm: 400, powerHp: 200 },
      { rpm: 4000, torqueNm: 396, powerHp: 226 },
      { rpm: 4500, torqueNm: 388, powerHp: 249 },
      { rpm: 5000, torqueNm: 375, powerHp: 267 },
      { rpm: 5500, torqueNm: 354, powerHp: 278 },
      { rpm: 6000, torqueNm: 327, powerHp: 280 },
      { rpm: 6500, torqueNm: 292, powerHp: 271 },
      { rpm: 6800, torqueNm: 268, powerHp: 260 },
    ],
    intendedOrientation: 'Longitudinale',
    nativeOrientation: 'Longitudinale',
  },
  liveWankelDraft: {
    id: 'live-wankel-1b',
    sourceKind: 'LiveWankel1B',
    name: '1.3L Twin-Rotor Street-Port Sequential Biturbo (Tab 1B Live)',
    codeName: 'ROT-13B-1B',
    propulsionType: 'Wankel_1B',
    architectureLabel: '1.3L 2-Rotori Wankel (Equiv. 2.6L)',
    displacementCc: 1308,
    displacementLiters: 1.3,
    cylindersOrRotors: 2,
    fuelType: 'Benzina',
    isTurbo: true,
    peakPowerHp: 335,
    peakPowerRpm: 7600,
    peakTorqueNm: 345,
    peakTorqueRpm: 5400,
    redlineRpm: 8500,
    dryWeightKg: 112,
    wetWeightKg: 124,
    dimensionsMm: { lengthMm: 510, widthMm: 520, heightMm: 510 },
    emissionsGPerKm: 215,
    reliabilityPercent: 74.5,
    estimatedLifespanKm: 92_000,
    unitProductionCost: 6_450,
    curve: [
      { rpm: 1000, torqueNm: 185, powerHp: 26 },
      { rpm: 2000, torqueNm: 235, powerHp: 67 },
      { rpm: 3000, torqueNm: 285, powerHp: 122 },
      { rpm: 4000, torqueNm: 322, powerHp: 183 },
      { rpm: 5000, torqueNm: 342, powerHp: 243 },
      { rpm: 5500, torqueNm: 345, powerHp: 270 },
      { rpm: 6000, torqueNm: 342, powerHp: 292 },
      { rpm: 6500, torqueNm: 336, powerHp: 311 },
      { rpm: 7000, torqueNm: 328, powerHp: 327 },
      { rpm: 7600, torqueNm: 310, powerHp: 335 },
      { rpm: 8000, torqueNm: 292, powerHp: 333 },
      { rpm: 8500, torqueNm: 268, powerHp: 324 },
    ],
    intendedOrientation: 'Longitudinale',
    nativeOrientation: 'Longitudinale',
  },
  savedElectricMotors: [],
  savedBatteryPacks: [],
  activeVariantParent: null,
  transactionLog: [
    {
      id: 'tx-init-1',
      timestamp: 'Apr 2016',
      actionName: 'Omologazione Piattaforma Modulare Giorgio Evo (PRJ-952)',
      capitalSpent: 85_000_000,
      rdSpent: 650,
    },
    {
      id: 'tx-init-2',
      timestamp: 'Apr 2016',
      actionName: 'Sviluppo Propulsore 2.9L V6 90° Bi-Turbo Hot-V',
      capitalSpent: 45_000_000,
      rdSpent: 380,
    },
  ],

  validateDualCurrencyGate: (cost) => {
    const { resources, currentYear } = get();
    const missingCapital = Math.max(0, cost.capitalCost - resources.financialCapital);
    const missingRdPoints = Math.max(0, cost.rdCost - resources.rdPoints);
    const missingYear = cost.minYear !== undefined ? currentYear < cost.minYear : false;

    if (missingYear) {
      return {
        allowed: false,
        missingCapital,
        missingRdPoints,
        missingYear: true,
        reason: `Tecnologia non ancora disponibile nell’anno ${currentYear} (richiesto anno ${cost.minYear}).`,
      };
    }

    if (missingCapital > 0 || missingRdPoints > 0) {
      return {
        allowed: false,
        missingCapital,
        missingRdPoints,
        missingYear: false,
        reason: `Risorse insufficienti: mancano $${missingCapital.toLocaleString('it-IT')} e ${missingRdPoints} Punti R&D.`,
      };
    }

    return {
      allowed: true,
      missingCapital: 0,
      missingRdPoints: 0,
      missingYear: false,
    };
  },

  spendDualCurrency: (actionName, cost) => {
    const gate = get().validateDualCurrencyGate(cost);
    if (!gate.allowed) {
      return gate;
    }

    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const { currentMonth, currentYear } = get();

    set((state) => ({
      resources: {
        financialCapital: state.resources.financialCapital - cost.capitalCost,
        rdPoints: state.resources.rdPoints - cost.rdCost,
      },
      transactionLog: [
        {
          id: `tx-${Date.now()}`,
          timestamp: `${months[(currentMonth - 1) % 12]} ${currentYear}`,
          actionName,
          capitalSpent: cost.capitalCost,
          rdSpent: cost.rdCost,
        },
        ...state.transactionLog.slice(0, 14),
      ],
    }));

    return gate;
  },

  addResources: (capitalDelta, rdDelta) =>
    set((state) => ({
      resources: {
        financialCapital: Math.max(0, state.resources.financialCapital + capitalDelta),
        rdPoints: Math.max(0, state.resources.rdPoints + rdDelta),
      },
    })),

  advanceMonth: () =>
    set((state) => {
      const nextMonth = state.currentMonth === 12 ? 1 : state.currentMonth + 1;
      const nextYear = state.currentMonth === 12 ? state.currentYear + 1 : state.currentYear;
      return {
        currentMonth: nextMonth,
        currentYear: nextYear,
        resources: {
          financialCapital: state.resources.financialCapital + 3_500_000,
          rdPoints: state.resources.rdPoints + 45,
        },
      };
    }),

  setHistoricalYear: (year) =>
    set(() => ({
      currentYear: year,
    })),

  unlockEnginePart: (partId, partName, cost) => {
    if (get().unlockedEnginePartIds.includes(partId)) {
      return { allowed: true, missingCapital: 0, missingRdPoints: 0, missingYear: false };
    }
    const gate = get().spendDualCurrency(`Sblocco R&D Motore: ${partName}`, cost);
    if (!gate.allowed) return gate;

    set((state) => ({
      unlockedEnginePartIds: [...state.unlockedEnginePartIds, partId],
    }));
    return gate;
  },

  saveEngineToDatabase: (engine) => {
    const gate = get().spendDualCurrency(
      `Omologazione Motore: ${engine.name} (${engine.codeName})`,
      engine.developmentCost,
    );
    if (!gate.allowed) return gate;

    set((state) => ({
      engines: [engine, ...state.engines],
    }));
    return gate;
  },

  saveChassisToDatabase: (chassis) => {
    const gate = get().spendDualCurrency(
      `Omologazione Pianale: ${chassis.name} (${chassis.codeName})`,
      chassis.developmentCost,
    );
    if (!gate.allowed) return gate;

    set((state) => ({
      chassisList: [chassis, ...state.chassisList],
    }));
    return gate;
  },

  toggleEngineB2B: (engineId) =>
    set((state) => ({
      engines: state.engines.map((e) =>
        e.id === engineId ? { ...e, b2bSaleEnabled: !e.b2bSaleEnabled } : e,
      ),
    })),

  setLivePistonDraft: (draft) =>
    set(() => ({
      livePistonDraft: draft,
    })),

  setLiveWankelDraft: (draft) =>
    set(() => ({
      liveWankelDraft: draft,
    })),

  startVariant: (info) =>
    set(() => ({
      activeVariantParent: info,
    })),

  clearVariant: () =>
    set(() => ({
      activeVariantParent: null,
    })),

  saveElectricMotorToLibrary: (motor) => {
    const gate = get().spendDualCurrency(
      `Omologazione Motore Elettrico: ${motor.name} (${motor.codeName})`,
      motor.developmentCost,
    );
    if (!gate.allowed) return gate;
    set((state) => ({
      savedElectricMotors: [motor, ...state.savedElectricMotors],
    }));
    return gate;
  },

  saveBatteryPackToLibrary: (pack) => {
    const gate = get().spendDualCurrency(
      `Omologazione Pacco Batteria: ${pack.name} (${pack.codeName})`,
      pack.developmentCost,
    );
    if (!gate.allowed) return gate;
    set((state) => ({
      savedBatteryPacks: [pack, ...state.savedBatteryPacks],
    }));
    return gate;
  },

  addCustomComponent: (params) => {
    const gate = get().spendDualCurrency(`R&D Componente: ${params.name}`, params.cost);
    if (!gate.allowed) {
      return gate;
    }

    const estimatedDurabilityKm = calculateEstimatedDurabilityKm(
      params.priceTier,
      params.referenceClass,
      params.materialResistanceFactor,
      params.mechanicalStressFactor,
    );

    const newComp: ComponentEntity = {
      id: `cmp-${Date.now()}`,
      name: params.name,
      category: params.category,
      ownerSubBrandId: get().subBrands[0].id,
      taxonomy: {
        priceTier: params.priceTier,
        referenceClass: params.referenceClass,
        materialStress: {
          materialName: params.materialName,
          materialResistanceFactor: params.materialResistanceFactor,
          mechanicalStressFactor: params.mechanicalStressFactor,
        },
        estimatedDurabilityKm,
      },
      origin: 'InHouse',
      studyLevel: 1,
      improvementPointsAvailable: 1,
      equippedSpells: [],
      b2bSaleEnabled: false,
      b2bUnitsSold: 0,
      productionMode: 'Internal',
      unitManufacturingCost: Math.round(params.cost.capitalCost / 6000),
      developmentCost: params.cost,
    };

    set((state) => ({
      components: [newComp, ...state.components],
    }));

    return gate;
  },

  toggleComponentB2B: (componentId) =>
    set((state) => ({
      components: state.components.map((c) =>
        c.id === componentId ? { ...c, b2bSaleEnabled: !c.b2bSaleEnabled } : c,
      ),
    })),

  addBodyAero: (bodyAero) => {
    const validation = validateBodyAeroSave(bodyAero.config, bodyAero.metrics, get());
    if (!validation.ok) {
      const { resources, currentYear } = get();
      const missingCapital = Math.max(
        0,
        bodyAero.metrics.developmentCost.capitalCost - resources.financialCapital,
      );
      const missingRdPoints = Math.max(
        0,
        bodyAero.metrics.developmentCost.rdCost - resources.rdPoints,
      );
      const missingYear =
        bodyAero.metrics.developmentCost.minYear !== undefined
          ? currentYear < bodyAero.metrics.developmentCost.minYear
          : false;
      return {
        allowed: false,
        missingCapital,
        missingRdPoints,
        missingYear,
        reason: validation.reasons.join(' | '),
      };
    }

    const gate = get().spendDualCurrency(
      `Omologazione Carrozzeria & Aero: ${bodyAero.name}`,
      bodyAero.metrics.developmentCost,
    );
    if (!gate.allowed) return gate;

    const savedEntry: SavedBodyAero = {
      ...bodyAero,
      paidCapitalCost: bodyAero.metrics.developmentCost.capitalCost,
      paidRdCost: bodyAero.metrics.developmentCost.rdCost,
    };

    set((state) => ({
      bodyAeroList: [savedEntry, ...state.bodyAeroList],
    }));
    return gate;
  },

  updateBodyAero: (id, config, metrics) => {
    const existing = get().bodyAeroList.find((item) => item.id === id);
    const existingPaid = existing
      ? {
          paidCapitalCost: existing.paidCapitalCost ?? existing.metrics.developmentCost.capitalCost,
          paidRdCost: existing.paidRdCost ?? existing.metrics.developmentCost.rdCost,
        }
      : undefined;

    const validation = validateBodyAeroSave(config, metrics, get(), existingPaid);
    if (!validation.ok) {
      const { resources, currentYear } = get();
      const incCost = getIncrementalBodyAeroCost(metrics.developmentCost, existingPaid);
      const missingCapital = Math.max(0, incCost.capitalCost - resources.financialCapital);
      const missingRdPoints = Math.max(0, incCost.rdCost - resources.rdPoints);
      const missingYear =
        metrics.developmentCost.minYear !== undefined
          ? currentYear < metrics.developmentCost.minYear
          : false;
      return {
        allowed: false,
        missingCapital,
        missingRdPoints,
        missingYear,
        reason: validation.reasons.join(' | '),
      };
    }

    const incrementalCost = getIncrementalBodyAeroCost(metrics.developmentCost, existingPaid);
    const gate = get().spendDualCurrency(
      `Aggiornamento Carrozzeria & Aero: ${config.name}`,
      incrementalCost,
    );
    if (!gate.allowed) return gate;

    set((state) => ({
      bodyAeroList: state.bodyAeroList.map((item) =>
        item.id === id
          ? {
              ...item,
              name: config.name.trim(),
              chassisId: config.chassisId,
              createdYear: config.year,
              paidCapitalCost: Math.max(
                existingPaid?.paidCapitalCost ?? 0,
                metrics.developmentCost.capitalCost,
              ),
              paidRdCost: Math.max(
                existingPaid?.paidRdCost ?? 0,
                metrics.developmentCost.rdCost,
              ),
              config,
              metrics,
            }
          : item,
      ),
    }));
    return gate;
  },

  deleteBodyAero: (id) =>
    set((state) => ({
      bodyAeroList: state.bodyAeroList.filter((item) => item.id !== id),
    })),

  addDrivetrainSetup: (setup) => {
    const validation = validateDrivetrainSetupSave(setup.config, setup.metrics, get());
    if (!validation.ok) {
      const { resources, currentYear } = get();
      const missingCapital = Math.max(
        0,
        setup.metrics.developmentCost.capitalCost - resources.financialCapital,
      );
      const missingRdPoints = Math.max(
        0,
        setup.metrics.developmentCost.rdCost - resources.rdPoints,
      );
      const missingYear =
        setup.metrics.developmentCost.minYear !== undefined
          ? currentYear < setup.metrics.developmentCost.minYear
          : false;
      return {
        allowed: false,
        missingCapital,
        missingRdPoints,
        missingYear,
        reason: validation.reasons.join(' | '),
      };
    }

    const gate = get().spendDualCurrency(
      `Omologazione Trasmissione & Dinamica: ${setup.name}`,
      setup.metrics.developmentCost,
    );
    if (!gate.allowed) return gate;

    const savedEntry: SavedDrivetrainSetup = {
      ...setup,
      paidCapitalCost: setup.metrics.developmentCost.capitalCost,
      paidRdCost: setup.metrics.developmentCost.rdCost,
    };

    set((state) => ({
      drivetrainSetups: [savedEntry, ...state.drivetrainSetups],
    }));
    return gate;
  },

  updateDrivetrainSetup: (id, config, metrics) => {
    const existing = get().drivetrainSetups.find((item) => item.id === id);
    const existingPaid = existing
      ? {
          paidCapitalCost: existing.paidCapitalCost ?? existing.metrics.developmentCost.capitalCost,
          paidRdCost: existing.paidRdCost ?? existing.metrics.developmentCost.rdCost,
        }
      : undefined;

    const validation = validateDrivetrainSetupSave(
      config,
      metrics,
      get(),
      existingPaid,
      existing?.config,
    );
    if (!validation.ok) {
      const { resources, currentYear } = get();
      const incCost = getIncrementalDrivetrainCost(
        config,
        metrics.developmentCost,
        existingPaid,
        existing?.config,
      );
      const missingCapital = Math.max(0, incCost.capitalCost - resources.financialCapital);
      const missingRdPoints = Math.max(0, incCost.rdCost - resources.rdPoints);
      const missingYear =
        metrics.developmentCost.minYear !== undefined
          ? currentYear < metrics.developmentCost.minYear
          : false;
      return {
        allowed: false,
        missingCapital,
        missingRdPoints,
        missingYear,
        reason: validation.reasons.join(' | '),
      };
    }

    const incrementalCost = getIncrementalDrivetrainCost(
      config,
      metrics.developmentCost,
      existingPaid,
      existing?.config,
    );
    const gate = get().spendDualCurrency(
      `Aggiornamento Trasmissione & Dinamica: ${config.name}`,
      incrementalCost,
    );
    if (!gate.allowed) return gate;

    set((state) => ({
      drivetrainSetups: state.drivetrainSetups.map((item) =>
        item.id === id
          ? {
              ...item,
              name: config.name.trim(),
              chassisId: config.chassisId,
              engineId: config.engineId,
              createdYear: config.year,
              paidCapitalCost: Math.max(
                existingPaid?.paidCapitalCost ?? 0,
                metrics.developmentCost.capitalCost,
              ),
              paidRdCost: Math.max(
                existingPaid?.paidRdCost ?? 0,
                metrics.developmentCost.rdCost,
              ),
              config,
              metrics,
            }
          : item,
      ),
    }));
    return gate;
  },

  deleteDrivetrainSetup: (id) =>
    set((state) => ({
      drivetrainSetups: state.drivetrainSetups.filter((item) => item.id !== id),
    })),
}));

export function getIncrementalBodyAeroCost(
  developmentCost: DualCurrencyCost,
  existingPaid?: { paidCapitalCost: number; paidRdCost: number },
): DualCurrencyCost {
  if (!existingPaid) return developmentCost;
  const deltaCapital = Math.max(0, developmentCost.capitalCost - existingPaid.paidCapitalCost);
  const deltaRd = Math.max(0, developmentCost.rdCost - existingPaid.paidRdCost);
  const revisionCapital = Math.round(developmentCost.capitalCost * 0.05);
  const revisionRd = Math.max(1, Math.round(developmentCost.rdCost * 0.05));
  return {
    capitalCost: deltaCapital + revisionCapital,
    rdCost: deltaRd + revisionRd,
    minYear: developmentCost.minYear,
  };
}

/**
 * Validazione deterministica pre-salvataggio per la Fase 2.2.
 * Verifica nome, esistenza pianale 2.1, anno minimo tecnologia e Doppia Valuta ($ + Punti R&D).
 * In modalità modifica (existingPaid), verifica solo il delta positivo + 5% di revisione.
 */
export function validateBodyAeroSave(
  config: BodyAeroConfig,
  metrics: BodyAeroMetrics,
  state: Pick<GameState, 'currentYear' | 'resources' | 'chassisList'>,
  existingPaid?: { paidCapitalCost: number; paidRdCost: number },
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!config.name || config.name.trim().length === 0) {
    reasons.push('Nome scocca mancante: inserire un nome valido.');
  }

  if (!config.chassisId || !state.chassisList.some((c) => c.id === config.chassisId)) {
    reasons.push('Pianale base (2.1) non valido o assente nel database.');
  }

  const minYear = metrics.developmentCost.minYear;
  if (minYear !== undefined && state.currentYear < minYear) {
    reasons.push(
      `Anno di gioco (${state.currentYear}) precedente alla disponibilità tecnologica (${minYear}).`,
    );
  }

  const requiredCost = getIncrementalBodyAeroCost(metrics.developmentCost, existingPaid);

  const missingCapital = Math.max(0, requiredCost.capitalCost - state.resources.financialCapital);
  if (missingCapital > 0) {
    reasons.push(`Capitale insufficiente: mancano $${missingCapital.toLocaleString('it-IT')}.`);
  }

  const missingRdPoints = Math.max(0, requiredCost.rdCost - state.resources.rdPoints);
  if (missingRdPoints > 0) {
    reasons.push(`Punti R&D insufficienti: mancano ${missingRdPoints} Punti R&D.`);
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

export function isDrivetrainTuningOnly(
  nextConfig: DrivetrainSetupConfig,
  prevConfig?: DrivetrainSetupConfig,
): boolean {
  if (!prevConfig) return false;
  return (
    nextConfig.chassisId === prevConfig.chassisId &&
    nextConfig.engineId === prevConfig.engineId &&
    nextConfig.year === prevConfig.year &&
    nextConfig.drivetrainType === prevConfig.drivetrainType &&
    nextConfig.awdScheme === prevConfig.awdScheme &&
    nextConfig.transmissionType === prevConfig.transmissionType &&
    (nextConfig.gearboxStrengthTier ?? 'standard') ===
      (prevConfig.gearboxStrengthTier ?? 'standard') &&
    nextConfig.gearCount === prevConfig.gearCount &&
    nextConfig.differentialType === prevConfig.differentialType &&
    nextConfig.steeringType === prevConfig.steeringType &&
    nextConfig.rearWheelSteering === prevConfig.rearWheelSteering &&
    Boolean(nextConfig.progressiveSteering) === Boolean(prevConfig.progressiveSteering) &&
    Boolean(nextConfig.speedSensitiveSteering) === Boolean(prevConfig.speedSensitiveSteering) &&
    nextConfig.frontSuspension === prevConfig.frontSuspension &&
    nextConfig.rearSuspension === prevConfig.rearSuspension &&
    nextConfig.stabilityControlType === prevConfig.stabilityControlType &&
    nextConfig.absType === prevConfig.absType &&
    nextConfig.tcsType === prevConfig.tcsType &&
    nextConfig.escType === prevConfig.escType &&
    Boolean(nextConfig.hasDriveModeSelector) === Boolean(prevConfig.hasDriveModeSelector) &&
    nextConfig.frontCaliper === prevConfig.frontCaliper &&
    nextConfig.frontDiscType === prevConfig.frontDiscType &&
    nextConfig.frontDiscMm === prevConfig.frontDiscMm &&
    nextConfig.rearCaliper === prevConfig.rearCaliper &&
    nextConfig.rearDiscType === prevConfig.rearDiscType &&
    nextConfig.rearDiscMm === prevConfig.rearDiscMm
  );
}

export function getIncrementalDrivetrainCost(
  config: DrivetrainSetupConfig,
  developmentCost: DualCurrencyCost,
  existingPaid?: { paidCapitalCost: number; paidRdCost: number },
  existingConfig?: DrivetrainSetupConfig,
): DualCurrencyCost {
  if (!existingPaid) return developmentCost;
  if (isDrivetrainTuningOnly(config, existingConfig)) {
    return {
      capitalCost: 25_000,
      rdCost: 1,
      minYear: developmentCost.minYear,
    };
  }
  return getIncrementalBodyAeroCost(developmentCost, existingPaid);
}

/**
 * Validazione deterministica pre-salvataggio per la Fase 2.3 (Trasmissione & Dinamica).
 * Verifica nome, pianale 2.1, motopropulsore 1.x, compatibilità fisica 2.1<->2.3,
 * anno minimo tecnologia e Doppia Valuta ($ + Punti R&D, incrementale se existingPaid).
 */
export function validateDrivetrainSetupSave(
  config: DrivetrainSetupConfig,
  metrics: DrivetrainSetupMetrics,
  state: Pick<GameState, 'currentYear' | 'resources' | 'chassisList' | 'engines' | 'savedElectricMotors'>,
  existingPaid?: { paidCapitalCost: number; paidRdCost: number },
  existingConfig?: DrivetrainSetupConfig,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!config.name || config.name.trim().length === 0) {
    reasons.push('Nome setup trasmissione mancante.');
  }

  if (!config.chassisId || !state.chassisList.some((c) => c.id === config.chassisId)) {
    reasons.push('Pianale base (2.1) non valido o assente nel database.');
  }

  const hasEngine =
    state.engines.some((e) => e.id === config.engineId) ||
    state.savedElectricMotors.some((m) => m.id === config.engineId);
  if (!config.engineId || !hasEngine) {
    reasons.push('Motopropulsore (Fase 1) non valido o assente nel database.');
  }

  if (!metrics.isCompatibleWithChassis) {
    reasons.push(...metrics.compatibilityErrors);
  }

  const minYear = metrics.developmentCost.minYear;
  if (minYear !== undefined && state.currentYear < minYear) {
    reasons.push(
      `Anno di gioco (${state.currentYear}) precedente alla disponibilità tecnologica (${minYear}).`,
    );
  }

  const requiredCost = getIncrementalDrivetrainCost(
    config,
    metrics.developmentCost,
    existingPaid,
    existingConfig,
  );

  const missingCapital = Math.max(0, requiredCost.capitalCost - state.resources.financialCapital);
  if (missingCapital > 0) {
    reasons.push(`Capitale insufficiente: mancano $${missingCapital.toLocaleString('it-IT')}.`);
  }

  const missingRdPoints = Math.max(0, requiredCost.rdCost - state.resources.rdPoints);
  if (missingRdPoints > 0) {
    reasons.push(`Punti R&D insufficienti: mancano ${missingRdPoints} Punti R&D.`);
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}
