/**
 * Architettura Dati Modulare (Fase 0.2)
 * Motore, Pianale, Sotto-Brand, Componenti e Veicolo sono entità indipendenti nel database
 * per permettere condivisione di gruppo, riutilizzo su più generazioni, licenze B2B e allestimenti multipli.
 */

// ============================================================================
// 1. TASSONOMIA UNIVERSALE COMPONENTI
// ============================================================================

export type PriceTier = 'Economica' | 'Media' | 'Premium' | 'Lusso';

export type ReferenceClass = 'Normale' | 'Comfort' | 'Sport' | 'Corsa' | 'Fuoristrada';

export interface MaterialStressProfile {
  /** Nome materiale (es. Ghisa, Alluminio Forgiato, Titanio, Fibra di Carbonio) */
  materialName: string;
  /** Coefficiente di resistenza strutturale del materiale (0.5 = base, 2.5 = esotico) */
  materialResistanceFactor: number;
  /** Indice di stress meccanico operativo (0.5 = basso stress, 2.5 = stress estremo da gara) */
  mechanicalStressFactor: number;
}

export interface UniversalComponentTaxonomy {
  priceTier: PriceTier;
  referenceClass: ReferenceClass;
  materialStress: MaterialStressProfile;
  /** Durata stimata in km calcolata automaticamente in base a materiali e stress meccanico */
  estimatedDurabilityKm: number;
}

/**
 * Calcola automaticamente la Durata Stimata in km di un componente
 * in funzione di Fascia di Prezzo (Economica < Media < Premium < Lusso),
 * Classe di Riferimento (Corsa abbatte drasticamente i km per prestazioni estreme),
 * Materiale e Stress Meccanico.
 */
export function calculateEstimatedDurabilityKm(
  priceTier: PriceTier,
  referenceClass: ReferenceClass,
  materialResistanceFactor: number,
  mechanicalStressFactor: number,
): number {
  // Fix Punto 4: Lusso ha tolleranze superiori e garantisce più km di Premium
  const baseKmByTier: Record<PriceTier, number> = {
    Economica: 150_000,
    Media: 215_000,
    Premium: 280_000,
    Lusso: 340_000,
  };

  const classWearMultiplier: Record<ReferenceClass, number> = {
    Normale: 1.0,
    Comfort: 1.08,
    Fuoristrada: 0.94,
    Sport: 0.76,
    Corsa: 0.08, // Motori/componenti da Corsa hanno vita brevissima (es. 3.000 - 15.000 km)
  };

  const safeStress = Math.max(0.25, mechanicalStressFactor);
  const safeMaterial = Math.max(0.3, materialResistanceFactor);

  const rawKm =
    baseKmByTier[priceTier] *
    classWearMultiplier[referenceClass] *
    (safeMaterial / Math.pow(safeStress, 1.35));

  if (referenceClass === 'Corsa') {
    return Math.max(2_500, Math.round(rawKm / 500) * 500);
  }

  return Math.max(15_000, Math.round(rawKm / 1_000) * 1_000);
}

// ============================================================================
// 2. DOPPIA VALUTA DI SVILUPPO & GEOMETRIA 3D
// ============================================================================

export interface DualCurrencyResources {
  /** Capitale Finanziario in USD ($) */
  financialCapital: number;
  /** Punti Ricerca & Sviluppo dedicati */
  rdPoints: number;
}

export interface DualCurrencyCost {
  /** Costo in Capitale Finanziario ($) */
  capitalCost: number;
  /** Costo in Punti R&D dedicati */
  rdCost: number;
  /** Anno storico minimo richiesto (dal 1970 in poi) */
  minYear?: number;
}

/** Ingombro fisico tridimensionale in millimetri (Lunghezza x Larghezza x Altezza) */
export interface DimensionsLWH {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}

// ============================================================================
// 3. ENTITÀ 1: SOTTO-BRAND (SubBrand)
// ============================================================================

export type NationCode = 'Italia' | 'Germania' | 'Giappone' | 'USA' | 'Cina';

export interface SubBrand {
  id: string;
  name: string;
  foundedYear: number;
  nation: NationCode;
  /** Prestigio del marchio (0 - 100) */
  prestige: number;
  /** Target primario del sotto-brand */
  primaryTargetClass: ReferenceClass;
  /** Posizionamento prezzo dominante */
  primaryPriceTier: PriceTier;
  /** Indica se è il brand fondatore o un sotto-brand acquisito/creato */
  isFounderBrand: boolean;
  /** Abilita condivisione libera di pianali, motori e componenti nel gruppo */
  groupSharingEnabled: boolean;
  /** Valore di mercato stimato per eventuale vendita futura ($) */
  estimatedMarketValue: number;
}

// ============================================================================
// 4. ENTITÀ 2: COMPONENTE (Component) — In-House o Terzista + B2B
// ============================================================================

export type ComponentCategory =
  | 'Cambio'
  | 'Differenziale'
  | 'PinzaFreno'
  | 'Gomma'
  | 'CarburanteGara'
  | 'Sospensione'
  | 'SistemaStabilizzazione'
  | 'Interno';

export interface PassiveSpell {
  id: string;
  name: string;
  description: string;
  improvementPointsCost: number;
  modifiers: {
    performanceBonusPercent?: number;
    weightDeltaKg?: number;
    durabilityBonusPercent?: number;
    efficiencyBonusPercent?: number;
  };
}

export interface ComponentEntity {
  id: string;
  name: string;
  category: ComponentCategory;
  ownerSubBrandId: string;
  taxonomy: UniversalComponentTaxonomy;
  /** Progettato in casa oppure acquistato da fornitori terzi/partner */
  origin: 'InHouse' | 'ThirdParty';
  supplierName?: string;
  /** Livello studiato sulla componente */
  studyLevel: number;
  /** Punti Miglioramento sbloccati per applicare/rimuovere spell passive */
  improvementPointsAvailable: number;
  equippedSpells: PassiveSpell[];
  /** ID del veicolo muletto su cui la componente è stata testata */
  testedOnMuleVehicleId?: string;
  /** Gestione B2B e Produzione (Fase 4) */
  b2bSaleEnabled: boolean;
  b2bUnitsSold: number;
  productionMode: 'Internal' | 'Outsourced';
  unitManufacturingCost: number;
  developmentCost: DualCurrencyCost;
}

// ============================================================================
// 5. ENTITÀ 3: MOTORE (Engine) — 1A Pistoni, 1B Wankel, 1C Elettrico/Ibrido
// ============================================================================

export type EnginePropulsionType = 'Piston_1A' | 'Wankel_1B' | 'ElectricHybrid_1C';

export type PistonArchitecture = 'Inline' | 'V' | 'Boxer' | 'W';

export type TurboType =
  | 'NaturallyAspirated'
  | 'SingleScroll'
  | 'TwinScroll'
  | 'VGT'
  | 'Supercharger'
  | 'Twincharged'
  | 'ETurbo';

export type TurboCountConfig =
  | 'SingleTurbo'
  | 'TwinTurbo'
  | 'TripleTurbo'
  | 'QuadTurbo';

export type TurboPosition = 'None' | 'Lateral' | 'Front' | 'HotV';

export type CatalystEra =
  | 'None'
  | 'Era1_Oxidizing_70s'
  | 'Era2_ThreeWayLambda_80s90s'
  | 'Era3_MultiStage_DPF_SCR_2000s'
  | 'Era4_ActiveGlobalFilter_Euro7';

export type HybridSystemType = 'PureEV' | 'MHEV' | 'FullHybrid' | 'PHEV' | 'RangeExtender';

export interface PistonEngineSpecs {
  architecture: PistonArchitecture;
  bankAngleDeg?: number; // per V / W
  cylinders: number;
  boreMm: number;
  strokeMm: number;
  unitDisplacementCc: number;
  totalDisplacementCc: number;
  strokeBoreRatio: number;
  blockMaterial: string;
  headMaterial: string;
  pistonType: string;
  conrodType: string;
  crankshaftType: string;
  camshaftType: string;
  valvesPerCylinder: number;
  fuelType: 'Benzina' | 'Diesel' | 'BioFuel' | 'RaceFuel';
  fuelSystem: string; // es. Carburatore, Iniezione Indiretta, Precamera, Common Rail, Diretta
  intakeSystem: string;
  exhaustManifold: string;
  turboType: TurboType;
  turboCountConfig?: TurboCountConfig;
  turboBearingType?: 'Journal' | 'BallBearing';
  turboArRatio?: number;
  /** Diametro/A/R individuale per ciascuna turbina (Single=1, Twin=2, Triple=3, Quad=4) */
  turboStagesArRatios?: number[];
  boostPressureBar?: number;
  compressionRatio?: number;
  manualRedlineRpm?: number;
  intendedOrientation?: EngineOrientation;
  turboPosition: TurboPosition;
  catalystEra: CatalystEra;
}

export type WankelPortType =
  | 'StandardSide'
  | 'StreetPort'
  | 'Bridgeport'
  | 'SemiPeripheral'
  | 'PeripheralPort';

export interface WankelEngineSpecs {
  rotorCount: number;
  generatingRadiusMm: number;
  eccentricityMm: number;
  rotorWidthMm: number;
  unitDisplacementCc: number;
  totalDisplacementCc: number;
  equivalentDisplacementCc: number;
  portType: WankelPortType;
  apexSealMaterialId: string;
  apexSealMaterialName: string;
  apexSealThicknessMm: 2.0 | 3.0;
  housingMaterialId: string;
  oilMeteringSystemId: string;
  compressionRatio: number;
  fuelType: 'Benzina' | 'BioFuel' | 'RaceFuel';
  turboType: TurboType;
  turboCountConfig?: TurboCountConfig;
  turboBearingType?: 'Journal' | 'BallBearing';
  turboArRatio?: number;
  turboStagesArRatios?: number[];
  turboStagesDiametersMm?: number[];
  boostPressureBar?: number;
  manualRedlineRpm: number;
  intendedOrientation: EngineOrientation;
  turboPosition: TurboPosition;
  catalystEra: CatalystEra;
  oilConsumptionLPer1000Km: number;
  apexSealWearRatePercentPer10kKm: number;
}

export type ElectricMotorType =
  | 'PermanentMagnetSync'
  | 'InductionAsync'
  | 'ElectricallyExcitedSync'
  | 'AxialFlux';

export type MotorLayoutConfig =
  | 'SingleMotor_FWD'
  | 'SingleMotor_RWD'
  | 'DualMotor_eAWD'
  | 'TriMotor_TorqueVectoring'
  | 'QuadMotor_Independent';

export type BatteryChemistry = 'LFP' | 'NMC811' | 'NCA' | 'SolidState';

export type ElectricCoolingSystem = 'Air' | 'LiquidGlycol' | 'DirectDielectric';

export type InverterTech = 'Silicon_IGBT' | 'SiliconCarbide_SiC' | 'GalliumNitride_GaN';

export type VoltageArchitecture = 400 | 800;

export interface ElectricHybridSpecs {
  systemType: HybridSystemType;
  electricMotorType: ElectricMotorType;
  motorLayout: MotorLayoutConfig;
  motorCount: number;
  statorDiameterMm: number;
  rotorLengthMm: number;
  batteryChemistry: BatteryChemistry;
  batteryCapacityKwh: number;
  voltageArchitecture: VoltageArchitecture;
  coolingSystem: ElectricCoolingSystem;
  inverterTech: InverterTech;
  peakElectricPowerKw: number;
  continuousPowerKw: number;
  peakTorqueNm: number;
  maxRpm: number;
  gearboxType: 'SingleSpeedDirect' | 'TwoSpeedDualClutch';
  gearRatio: number;
  batteryWeightKg: number;
  motorWeightKg: number;
  totalPowertrainWeightKg: number;
  estimatedRangeKm: number;
  efficiencyWhPerKm: number;
  batteryLifespanCycles: number;
  // Per topologie ibride (MHEV, FullHybrid, PHEV, RangeExtender)
  iceEngineDisplacementCc?: number;
  icePowerHp?: number;
  iceTorqueNm?: number;
  combinedPowerHp: number;
  combinedTorqueNm: number;
}

export interface ElectricHybridEngineConfigInput {
  systemType: HybridSystemType;
  electricMotorType: ElectricMotorType;
  motorLayout: MotorLayoutConfig;
  statorDiameterMm: number; // 180 - 320 mm
  rotorLengthMm: number; // 100 - 280 mm
  batteryChemistry: BatteryChemistry;
  batteryCapacityKwh: number; // 1.5 - 140 kWh
  voltageArchitecture: VoltageArchitecture;
  coolingSystem: ElectricCoolingSystem;
  inverterTech: InverterTech;
  gearboxType: 'SingleSpeedDirect' | 'TwoSpeedDualClutch';
  gearRatio: number; // 6.5 - 13.5:1
  maxMotorRpm: number; // 12000 - 22000 rpm
  // Componente termica per ibridi
  iceArchitecture?: 'Inline' | 'V' | 'Boxer' | 'Wankel';
  iceCylindersOrRotors?: number;
  iceDisplacementCc?: number;
  iceFuelType?: 'Benzina' | 'Diesel' | 'BioFuel';
  iceTurbocharged?: boolean;
  priceTier: PriceTier;
  referenceClass: ReferenceClass;
}

export interface DynoCurvePoint {
  rpm: number;
  torqueNm: number;
  powerHp: number;
  bmepBar?: number;
}

export interface KnockWarningInfo {
  isKnocking: boolean;
  knockExcessCr: number;
  maxSafeCr: number;
  powerPenaltyPercent: number;
  reliabilityPenaltyPercent: number;
  message: string;
}

export interface EngineDynoTelemetry {
  curve: DynoCurvePoint[];
  peakPowerHp: number;
  peakPowerRpm: number;
  peakTorqueNm: number;
  peakTorqueRpm: number;
  peakBmepBar?: number;
  redlineRpm: number;
  maxSafeMechanicalRpm?: number;
  knockWarning?: KnockWarningInfo;
  dryWeightKg: number;
  wetWeightKg: number;
  thermalEfficiencyPercent: number;
  emissionsGPerKm: number;
  reliabilityPercent: number;
  estimatedLifespanKm: number;
  unitProductionCost: number;
  oilConsumptionLPer1000Km?: number;
  apexSealWearRate?: number;
}

export interface EngineEntity {
  id: string;
  name: string;
  codeName: string;
  ownerSubBrandId: string;
  createdYear: number;
  propulsionType: EnginePropulsionType;
  taxonomy: UniversalComponentTaxonomy;
  /** Ingombro fisico tridimensionale in millimetri (LWH) */
  dimensionsMm: DimensionsLWH;
  pistonSpecs?: PistonEngineSpecs;
  wankelSpecs?: WankelEngineSpecs;
  electricHybridSpecs?: ElectricHybridSpecs;
  telemetry: EngineDynoTelemetry;
  b2bSaleEnabled: boolean;
  b2bUnitsSold: number;
  developmentCost: DualCurrencyCost;
}

// ============================================================================
// 6. ENTITÀ 4: PIANALE (Chassis) — Stile Piattaforma Giorgio
// ============================================================================

export type EngineMountingPosition =
  | 'Anteriore'
  | 'Anteriore-Centrale'
  | 'Centrale-Posteriore'
  | 'Posteriore';

export type EngineOrientation = 'Trasversale' | 'Longitudinale';

export type AWDLayoutType =
  | 'None_2WD'
  | 'AWD_Haldex_OnDemand'
  | 'AWD_Transverse_TorqueSplitter'
  | 'AWD_Longitudinal_Permanent'
  | '4WD_HeavyDuty_LowRange';

export type VehicleSegment = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'S' | 'J_SUV' | 'M_Pickup';

export interface ChassisEntity {
  id: string;
  name: string;
  codeName: string;
  ownerSubBrandId: string;
  createdYear: number;
  generationNumber: number;
  parentChassisId?: string;
  taxonomy: UniversalComponentTaxonomy;
  /** Dimensioni esterne base del pianale in mm */
  overallDimensionsMm: DimensionsLWH;
  wheelbaseMm: number;
  frontTrackMm: number;
  rearTrackMm: number;
  groundClearanceMm: number;
  /** Rigidità torsionale (Nm/grado) */
  torsionalRigidityNmPerDeg: number;
  structuralSafetyScore: number;
  /** Layout e vano motore per il controllo collisione in tempo reale */
  engineBayMaxDimensionsMm: DimensionsLWH;
  supportedEnginePositions: EngineMountingPosition[];
  supportedEngineOrientations: EngineOrientation[];
  /** Grado di arretramento del motore verso l'abitacolo (0% - 100%) */
  engineSetbackPercent: number;
  supportedDrivetrains: ('FWD' | 'RWD' | 'AWD')[];
  /** Segmento auto calcolato automaticamente rispetto agli standard dell'anno corrente */
  calculatedSegment: VehicleSegment;
  baseWeightKg: number;
  unitManufacturingCost: number;
  developmentCost: DualCurrencyCost;
}

// ============================================================================
// 7. ENTITÀ 5: VEICOLO (Vehicle) — Allestimenti, Generazioni, Telemetria
// ============================================================================

export type BodyStyle =
  | 'Berlina'
  | 'Coupé'
  | 'Hatchback'
  | 'SUV'
  | 'Crossover'
  | 'Universale'
  | 'Coupé Sportivo'
  | 'Pickup';

export type VehicleTrimType = 'Base' | 'Premium' | 'Sport' | 'Pista' | 'SerieLimitata';

export type VehicleLifecycleStatus =
  | 'PrototypeDeposit'
  | 'ScheduledLaunch'
  | 'ActiveProduction'
  | 'FaceliftActive'
  | 'OutOfProduction';

export interface VehicleEntity {
  id: string;
  modelName: string;
  generationCode: string; // es. E30 -> E36 -> E46
  generationNumber: number;
  previousGenerationVehicleId?: string;
  parentBaseTrimVehicleId?: string;
  trimType: VehicleTrimType;
  subBrandId: string;
  chassisId: string;
  engineId: string;
  bodyStyle: BodyStyle;
  bodyMaterial: string;
  taxonomy: UniversalComponentTaxonomy;
  /** Configurazione Trasmissione & Rapportatura */
  drivetrainType: 'FWD' | 'RWD' | 'AWD';
  awdLayout: AWDLayoutType;
  gearRatios: number[];
  finalDriveRatio: number;
  drivetrainLossPercent: number;
  stabilityControlThresholdPercent: number;
  /** Abitacolo e Volumi calcolati */
  isStrippedRaceInterior: boolean;
  calculatedSeats: number;
  calculatedTrunkLiters: number;
  /** Componenti installate (Riferimenti ID alla tabella ComponentEntity) */
  installedComponentIds: string[];
  /** Stato Lancio, Prezzi e Garanzia (Fasi 4 e 5) */
  lifecycleStatus: VehicleLifecycleStatus;
  scheduledLaunchYear?: number;
  scheduledLaunchMonth?: number;
  unitTotalCost: number;
  listPrice: number;
  warrantyYears: number;
  warrantyKm: number;
  developmentCost: DualCurrencyCost;
}

