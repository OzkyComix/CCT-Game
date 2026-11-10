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
import {
  type ChassisEntity,
  type ComponentEntity,
  type DualCurrencyCost,
  type DualCurrencyResources,
  type EngineEntity,
  type PriceTier,
  type ReferenceClass,
  type SubBrand,
  type VehicleEntity,
  calculateEstimatedDurabilityKm,
} from '../types/gameTypes';

export interface DualCurrencyGateResult {
  allowed: boolean;
  missingCapital: number;
  missingRdPoints: number;
  missingYear: boolean;
  reason?: string;
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
  components: ComponentEntity[];
  vehicles: VehicleEntity[];
  transactionLog: TransactionLogEntry[];

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

const initialEngines: EngineEntity[] = [
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
    pistonSpecs: {
      architecture: 'V',
      bankAngleDeg: 90,
      cylinders: 6,
      boreMm: 86.5,
      strokeMm: 82.0,
      unitDisplacementCc: 482,
      totalDisplacementCc: 2891,
      strokeBoreRatio: 0.95,
      blockMaterial: 'Alluminio AlSi Forgiato c/ Riporto Plasma/Nikasil',
      headMaterial: 'Alluminio Trattato Termicamente T6 Flussi CNC',
      pistonType: 'Pistoni Forgiati Raffreddati a Getto d’Olio',
      conrodType: 'Bielle in Acciaio C70 Fratturato',
      crankshaftType: 'Acciaio Forgiato Nitrurato Controbilanciato',
      camshaftType: 'DOHC con Variatore di Fase Continuo (VVT)',
      valvesPerCylinder: 4,
      fuelType: 'Benzina',
      fuelSystem: 'Iniezione Diretta Ad Alta Pressione (GDI 350 bar)',
      intakeSystem: 'Doppio Corpo Farfallato Plenum Corto ad Alto Flusso',
      exhaustManifold: 'Inconel Tubolare Integrato Ultraleggero',
      turboType: 'TwinScroll',
      turboBearingType: 'BallBearing',
      turboArRatio: 0.68,
      boostPressureBar: 1.55,
      compressionRatio: 9.3,
      intendedOrientation: 'Longitudinale',
      turboPosition: 'HotV',
      catalystEra: 'Era4_ActiveGlobalFilter_Euro7',
    },
    telemetry: {
      curve: [
        { rpm: 1500, torqueNm: 380, powerHp: 81 },
        { rpm: 2500, torqueNm: 600, powerHp: 213 },
        { rpm: 3500, torqueNm: 600, powerHp: 299 },
        { rpm: 4500, torqueNm: 600, powerHp: 384 },
        { rpm: 5500, torqueNm: 575, powerHp: 450 },
        { rpm: 6500, torqueNm: 540, powerHp: 510 },
        { rpm: 7250, torqueNm: 470, powerHp: 485 },
      ],
      peakPowerHp: 510,
      peakPowerRpm: 6500,
      peakTorqueNm: 600,
      peakTorqueRpm: 2500,
      redlineRpm: 7250,
      dryWeightKg: 168,
      wetWeightKg: 184,
      thermalEfficiencyPercent: 37.8,
      emissionsGPerKm: 192,
      reliabilityPercent: 89.5,
      estimatedLifespanKm: calculateEstimatedDurabilityKm('Premium', 'Sport', 1.45, 1.25),
      unitProductionCost: 11_400,
    },
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
    wankelSpecs: {
      rotorCount: 2,
      generatingRadiusMm: 105,
      eccentricityMm: 15,
      rotorWidthMm: 80,
      unitDisplacementCc: 654,
      totalDisplacementCc: 1308,
      equivalentDisplacementCc: 2616,
      portType: 'StreetPort',
      apexSealMaterialId: 'seal-tool-steel-dlc',
      apexSealMaterialName: 'Acciaio per Utensili Forgiato 3 Pezzi con Riporto DLC',
      apexSealThicknessMm: 2.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-electronic-mikuni',
      compressionRatio: 9.0,
      fuelType: 'Benzina',
      turboType: 'TwinScroll',
      turboCountConfig: 'TwinTurbo',
      turboBearingType: 'BallBearing',
      turboArRatio: 0.65,
      turboStagesArRatios: [0.65, 0.65],
      turboStagesDiametersMm: [52, 52],
      boostPressureBar: 0.75,
      manualRedlineRpm: 8200,
      intendedOrientation: 'Longitudinale',
      turboPosition: 'Lateral',
      catalystEra: 'Era2_ThreeWayLambda_80s90s',
      oilConsumptionLPer1000Km: 0.65,
      apexSealWearRatePercentPer10kKm: 2.15,
    },
    telemetry: {
      curve: [
        { rpm: 1500, torqueNm: 180, powerHp: 38 },
        { rpm: 2500, torqueNm: 275, powerHp: 98 },
        { rpm: 3500, torqueNm: 310, powerHp: 154 },
        { rpm: 5000, torqueNm: 295, powerHp: 210 },
        { rpm: 6500, torqueNm: 270, powerHp: 250 },
        { rpm: 8000, torqueNm: 230, powerHp: 262 },
      ],
      peakPowerHp: 265,
      peakPowerRpm: 6500,
      peakTorqueNm: 310,
      peakTorqueRpm: 3500,
      redlineRpm: 8200,
      dryWeightKg: 124,
      wetWeightKg: 138,
      thermalEfficiencyPercent: 27.2,
      emissionsGPerKm: 248,
      reliabilityPercent: 86.0,
      estimatedLifespanKm: calculateEstimatedDurabilityKm('Premium', 'Sport', 1.55, 1.15),
      unitProductionCost: 7_650,
      oilConsumptionLPer1000Km: 0.65,
      apexSealWearRate: 2.15,
    },
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
    financialCapital: 125_000_000,
    rdPoints: 840,
  },
  unlockedEnginePartIds: defaultUnlockedParts,
  subBrands: initialSubBrands,
  engines: initialEngines,
  chassisList: initialChassis,
  components: initialComponents,
  vehicles: initialVehicles,
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

  toggleEngineB2B: (engineId) =>
    set((state) => ({
      engines: state.engines.map((e) =>
        e.id === engineId ? { ...e, b2bSaleEnabled: !e.b2bSaleEnabled } : e,
      ),
    })),

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
}));
