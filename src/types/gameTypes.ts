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
  blockMaterialId?: string;
  headMaterial: string;
  headMaterialId?: string;
  pistonType: string;
  pistonTypeId?: string;
  conrodType: string;
  conrodTypeId?: string;
  crankshaftType: string;
  crankshaftTypeId?: string;
  camshaftType: string;
  camshaftTypeId?: string;
  valvesPerCylinder: number;
  fuelType: 'Benzina' | 'Diesel' | 'BioFuel' | 'RaceFuel';
  fuelSystem: string; // es. Carburatore, Iniezione Indiretta, Precamera, Common Rail, Diretta
  fuelSystemId?: string;
  intakeSystem: string;
  intakeSystemId?: string;
  exhaustManifold: string;
  exhaustManifoldId?: string;
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
  nativeOrientation?: EngineOrientation;
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
  nativeOrientation?: EngineOrientation;
  turboPosition: TurboPosition;
  catalystEra: CatalystEra;
  oilConsumptionLPer1000Km: number;
  apexSealWearRatePercentPer10kKm: number;
}

export type ElectricMotorType =
  | 'InductionAsync'
  | 'PermanentMagnetSync'
  | 'IPM_SynRM'
  | 'AxialFlux';

export type MotorLayoutConfig =
  | 'SingleMotor_FWD'
  | 'SingleMotor_RWD'
  | 'SingleMotor_MechanicalAWD'
  | 'DualMotor_eAWD'
  | 'TriMotor_TorqueVectoring'
  | 'QuadMotor_Independent';

export type BenchElectricMotorCount = 1 | 2 | 3 | 4;

export type BenchElectricDriveArrangement =
  | 'Single_1x'
  | 'Single_MechanicalAWD' // 1 motore elettrico con albero di trasmissione meccanico AWD (-8% perdita)
  | 'Dual_2x'
  | 'Tri_3x'
  | 'Quad_4x';

export type StatorWindingType =
  | 'RoundWireStandard' // Filo Tondo Standard (Riempimento 45%)
  | 'HairpinFlat' // Barre Piatte Hairpin (Riempimento 70%)
  | 'HairpinContinuousMultiLayer' // Hairpin Continuo Multi-Strato
  | 'LitzRacingWire'; // Filo Litz / Rame Puro Racing

export type InverterPowerElectronicsType =
  | 'Silicon_IGBT' // Inverter IGBT al Silicio (Economico)
  | 'Silicon_MOSFET' // Inverter MOSFET Silicio Avanzato
  | 'SiliconCarbide_SiC' // Inverter Carburo di Silicio (SiC MOSFET)
  | 'Dual_SiC_GaN_Racing'; // Dual-Inverter SiC / GaN Alta Corrente (Corsa)

export type RotorSleeveBearingType =
  | 'SteelLaminationStandard' // Lamierini Acciaio + Cuscinetti Acciaio Standard (max 14.000 RPM)
  | 'InconelSleeveHybrid' // Camicia Inconel + Cuscinetti Ibridi (max 18.000 RPM)
  | 'CarbonPrepregCeramic'; // Camicia in Fibra di Carbonio Pre-Preg + Cuscinetti Ceramici Si3N4 (max 24.000 RPM)

export type RotorMagnetMaterialType =
  | 'FerriteStandardCage' // Ferrite / Gabbia Alluminio Standard (-15% coppia/potenza, zero terre rare)
  | 'NeodymiumNdFeB' // Neodimio Standard (NdFeB N42) (1.0x)
  | 'NeodymiumDyUH' // Neodimio-Disprosio Alta Temperatura (NdFeB-UH 200°C) (+10% coppia)
  | 'SamariumCobaltRacing'; // Samario-Cobalto (SmCo) / Leghe Permendur Racing (+18% coppia/potenza)

export type MotorHousingType =
  | 'DieCastAluminum' // Alluminio Pressofuso Standard (base)
  | 'AcousticDampedActiveNVH' // Carcassa Silenziata con Supporti Attivi NVH (+4 kg, comfort lusso)
  | 'MagnesiumCarbonUltralight' // Magnesio e Carbonio Ultraleggero (Corsa) (-22% peso carcassa)
  | 'ArmoredSealedIP69K'; // Carcassa Blindata Sigillata IP69K (Fuoristrada) (+12 kg)

export type BatteryPackStructure =
  | 'ModularAluminum' // Moduli Standard con Busbar in Alluminio
  | 'CellToPackCopper' // Cell-to-Pack (CTP) con Busbar in Rame (-8% peso)
  | 'CellToChassisCTC' // Cell-to-Chassis Strutturale (CTC) (-15% peso)
  | 'CarbonLaserSilverBusbar'; // Guscio Monoscocca in Carbonio + Busbar Rame Argentato Laser (Corsa) (-25% peso)

export type BmsCalibrationProfile =
  | 'ConservativeLongevity' // Conservativa / Longevità (Buffer 12% - Scarica 1.5C)
  | 'RoadBalanced' // Stradale Bilanciata (Buffer 8% - Scarica 3C)
  | 'PerformanceSport' // Performance / Sport (Buffer 4% - Scarica 5C)
  | 'RaceExtreme'; // Qualifica / Corsa Estrema (Buffer 1% - Scarica 10C)

export type UnderbodyShieldType =
  | 'StandardSteelShield' // Lamiera Standard
  | 'TitaniumKevlarIP69K'; // Piastra Ballistica Titanio/Kevlar IP69K (Fuoristrada/Rally)

export type BatteryChemistry = 'LFP' | 'NMC811' | 'NCA' | 'SolidState';

export type ElectricCoolingSystem = 'Air' | 'LiquidGlycol' | 'DirectDielectric';

export type InverterTech = 'Silicon_IGBT' | 'SiliconCarbide_SiC' | 'GalliumNitride_GaN';

export type VoltageArchitecture = 400 | 800 | 1000;

/**
 * 1. Singola Unità Motore Elettrico Universale (Modulo 1.4):
 * Definita esclusivamente da tecnologia, componenti fisici (avvolgimenti, inverter,
 * cuscinetti/camicia, materiale rotore, carcassa), diametro statore, lunghezza rotore,
 * tensione e raffreddamento.
 * PriceTier e ReferenceClass sono derivati automaticamente dietro le quinte.
 */
export interface ElectricMotorSpec {
  id?: string;
  name?: string;
  codeName?: string;
  electricMotorType: ElectricMotorType;
  statorDiameterMm: number; // 150 - 340 mm
  rotorLengthMm: number; // 80 - 280 mm
  voltageArchitecture: VoltageArchitecture; // 400 | 800 | 1000
  coolingSystem: ElectricCoolingSystem; // Air | LiquidGlycol | DirectDielectric
  // 5 Componenti Hardware Reali
  statorWinding?: StatorWindingType;
  inverterPowerElectronics?: InverterPowerElectronicsType;
  rotorSleeveBearing?: RotorSleeveBearingType;
  rotorMagnetMaterial?: RotorMagnetMaterialType;
  motorHousing?: MotorHousingType;
  // Campi retrocompatibili derivati
  priceTier: PriceTier;
  referenceClass: ReferenceClass;
  maxMotorRpm?: number; // 14000 - 24000 rpm
}

/**
 * Telemetria e costi calcolati per la singola unità motore elettrico universale (1.0x).
 */
export interface SingleElectricMotorTelemetry {
  spec: ElectricMotorSpec;
  statorVolumeCc: number;
  dimensionsMm: DimensionsLWH;
  inverterDimensionsMm: DimensionsLWH;
  inverterTech: InverterTech;
  inverterSummaryName: string;
  inverterEfficiencyPercent: number;
  peakPowerHp: number;
  peakPowerKw: number;
  continuousPowerKw: number;
  peakTorqueNm: number;
  cornerSpeedRpm: number;
  maxMotorRpm: number;
  efficiencyPercent: number;
  dryWeightKg: number;
  wetWeightKg: number;
  reliabilityPercent: number;
  estimatedLifespanKm: number;
  motorHardwareCost: number;
  inverterAndCoolingCost: number;
  unitProductionCost: number;
  developmentCost: DualCurrencyCost;
  curve: DynoCurvePoint[];
}

/**
 * 2. Pacco Batteria Indipendente (Modulo 1.4):
 * Definito da chimica, kWh, architettura strutturale, taratura BMS/C-Rate,
 * protezione sottoscocca, tensione e raffreddamento.
 * PriceTier e ReferenceClass sono derivati automaticamente dietro le quinte.
 */
export interface BatteryPackSpec {
  id?: string;
  name?: string;
  codeName?: string;
  batteryChemistry: BatteryChemistry; // LFP | NMC811 | NCA | SolidState
  batteryCapacityKwh: number; // 0.8 - 150 kWh
  voltageArchitecture: VoltageArchitecture; // 400 | 800 | 1000
  coolingSystem: ElectricCoolingSystem; // Air | LiquidGlycol | DirectDielectric
  // Parametri Hardware Reali
  packStructure?: BatteryPackStructure;
  bmsCalibration?: BmsCalibrationProfile;
  underbodyShield?: UnderbodyShieldType;
  // Campi retrocompatibili derivati
  priceTier: PriceTier;
  referenceClass: ReferenceClass;
}

/**
 * Telemetria, capacità di scarica massima e costi calcolati per il pacco batteria indipendente.
 */
export interface BatteryPackTelemetry {
  spec: BatteryPackSpec;
  batteryCapacityKwh: number;
  usableCapacityKwh: number;
  maxDischargePowerKw: number;
  maxDischargePowerHp: number;
  maxContinuousDischargePowerKw: number;
  peakDischargeCRate: number;
  maxContinuousCRate: number;
  weightKg: number;
  dimensionsMm: DimensionsLWH;
  costPerKwh: number;
  cellsCost: number;
  bmsAndThermalCost: number;
  unitProductionCost: number;
  reliabilityPercent: number;
  estimatedLifespanKm: number;
  cycleLife: number;
  developmentCost: DualCurrencyCost;
}

/**
 * Singola unità motore elettrico omologata e salvata nella libreria componenti (riutilizzabile al banco).
 */
export interface ElectricMotorEntity {
  id: string;
  name: string;
  codeName: string;
  ownerSubBrandId: string;
  createdYear: number;
  spec: ElectricMotorSpec;
  peakPowerHp: number;
  peakTorqueNm: number;
  cornerSpeedRpm: number;
  maxMotorRpm: number;
  dryWeightKg: number;
  reliabilityPercent: number;
  estimatedLifespanKm: number;
  unitProductionCost: number;
  developmentCost: DualCurrencyCost;
  /** Collegamento al progetto padre in caso di Variante / Evoluzione */
  parentMotorId?: string;
  parentMotorName?: string;
  isVariant?: boolean;
  variantRdSavingsPercent?: number;
  variantModifiedParts?: string[];
}

/**
 * Pacco batteria omologato e salvato nella libreria componenti (riutilizzabile al banco).
 */
export interface BatteryPackEntity {
  id: string;
  name: string;
  codeName: string;
  ownerSubBrandId: string;
  createdYear: number;
  spec: BatteryPackSpec;
  maxDischargePowerKw: number;
  weightKg: number;
  reliabilityPercent: number;
  estimatedLifespanKm: number;
  unitProductionCost: number;
  developmentCost: DualCurrencyCost;
  /** Collegamento al progetto padre in caso di Variante / Evoluzione */
  parentBatteryId?: string;
  parentBatteryName?: string;
  isVariant?: boolean;
  variantRdSavingsPercent?: number;
  variantModifiedParts?: string[];
}

/**
 * 3. Simulatore di Test al Banco Prova (Modulo 1.4):
 * Stato separato che permette di testare al banco 1, 2, 3 o 4 motori elettrici uguali
 * (scala lineare esatta: Single = 1.0x, Dual = 2.0x, Tri = 3.0x, Quad = 4.0x, oppure
 * 1 motore elettrico con albero di trasmissione meccanico AWD con -8% di perdita)
 * e di accoppiarli a qualsiasi motore termico o Wankel nelle modalità MHEV, FullHybrid,
 * PHEV e RangeExtender (EREV, dove il termico/Wankel funge da generatore per caricare la batteria).
 */
export interface PowertrainBenchConfig {
  systemType: HybridSystemType;
  motorCount: BenchElectricMotorCount; // 1 | 2 | 3 | 4 (scala lineare 1.0x, 2.0x, 3.0x, 4.0x)
  /** Se true (con motorCount === 1), applica la perdita del -8% (0.92x) dell'albero di trasmissione meccanico AWD */
  hasMechanicalAwdShaft?: boolean;
  benchArrangement?: BenchElectricDriveArrangement;
  motorLayout?: MotorLayoutConfig;
  hasFrontDisconnect?: boolean;
  gearboxType: 'SingleSpeedDirect' | 'TwoSpeedDualClutch';
  gearRatio: number;
  /** ID del motore termico/Wankel selezionato per MHEV, FullHybrid, PHEV o RangeExtender (EREV) */
  coupledIceOptionId?: string;
  /** Singola unità motore elettrico universale in prova */
  motor: ElectricMotorSpec;
  /** Pacco batteria indipendente selezionato */
  battery: BatteryPackSpec;
}

/**
 * Rappresenta un motore termico (Pistoni 1A o Wankel 1B) selezionabile per accoppiamento Ibrido
 * (live dalle Tab 1A/1B, salvato nel database o di riferimento base).
 */
export interface CoupledIceEngineOption {
  id: string;
  sourceKind: 'LivePiston1A' | 'LiveWankel1B' | 'SavedDatabase' | 'ReferencePreset';
  name: string;
  codeName: string;
  propulsionType: 'Piston_1A' | 'Wankel_1B';
  architectureLabel: string;
  displacementCc: number;
  displacementLiters: number;
  cylindersOrRotors: number;
  fuelType: string;
  isTurbo: boolean;
  peakPowerHp: number;
  peakPowerRpm: number;
  peakTorqueNm: number;
  peakTorqueRpm: number;
  redlineRpm: number;
  dryWeightKg: number;
  wetWeightKg: number;
  dimensionsMm: DimensionsLWH;
  emissionsGPerKm: number;
  reliabilityPercent: number;
  estimatedLifespanKm: number;
  unitProductionCost: number;
  curve: DynoCurvePoint[];
  intendedOrientation: EngineOrientation;
  nativeOrientation?: EngineOrientation;
}

export interface ElectricHybridSpecs {
  systemType: HybridSystemType;
  electricMotorType: ElectricMotorType;
  motorLayout: MotorLayoutConfig;
  motorCount: number;
  hasMechanicalAwdShaft?: boolean;
  hasFrontDisconnect?: boolean;
  statorDiameterMm: number;
  rotorLengthMm: number;
  batteryChemistry: BatteryChemistry;
  batteryCapacityKwh: number;
  voltageArchitecture: VoltageArchitecture;
  coolingSystem: ElectricCoolingSystem;
  inverterTech: InverterTech;
  inverterSummaryName?: string;
  inverterEfficiencyPercent?: number;
  /** Specifica separata della singola unità motore elettrico universale (1.0x) */
  singleMotorSpec?: ElectricMotorSpec;
  unitMotorPowerHp?: number;
  unitMotorTorqueNm?: number;
  unitMotorCost?: number;
  /** Specifica separata del pacco batteria indipendente */
  batteryPackSpec?: BatteryPackSpec;
  maxBatteryDischargePowerKw?: number;
  maxBatteryDischargePowerHp?: number;
  peakElectricPowerKw: number;
  peakElectricPowerHp?: number;
  continuousPowerKw: number;
  peakTorqueNm: number;
  cornerSpeedRpm?: number;
  maxRpm: number;
  cRatePeak?: number;
  gearboxType: 'SingleSpeedDirect' | 'TwoSpeedDualClutch';
  gearRatio: number;
  batteryWeightKg: number;
  motorWeightKg: number;
  totalPowertrainWeightKg: number;
  estimatedRangeKm: number;
  efficiencyWhPerKm: number;
  efficiencyKwhPer100Km?: number;
  batteryLifespanCycles: number;
  // Per topologie ibride (MHEV, FullHybrid, PHEV, RangeExtender)
  coupledIceId?: string;
  coupledIceName?: string;
  coupledIcePropulsionType?: 'Piston_1A' | 'Wankel_1B';
  iceEngineDisplacementCc?: number;
  icePowerHp?: number;
  iceTorqueNm?: number;
  combinedPowerHp: number;
  combinedTorqueNm: number;
  // Specifiche Range Extender (EREV)
  erevGeneratorOutputKw?: number;
  erevCruisingDemandKw?: number;
  erevGeneratorRpm?: number;
  erevSelfSustaining?: boolean;
  erevTotalCombinedRangeKm?: number;
}

export interface ElectricHybridEngineConfigInput {
  systemType: HybridSystemType;
  electricMotorType: ElectricMotorType;
  motorLayout: MotorLayoutConfig;
  motorCount?: BenchElectricMotorCount;
  hasMechanicalAwdShaft?: boolean;
  hasFrontDisconnect?: boolean;
  statorDiameterMm: number; // 150 - 340 mm
  rotorLengthMm: number; // 80 - 280 mm
  batteryChemistry: BatteryChemistry;
  batteryCapacityKwh: number; // 1.0 - 150 kWh
  voltageArchitecture: VoltageArchitecture;
  coolingSystem: ElectricCoolingSystem;
  inverterTech: InverterTech;
  // 5 Componenti Hardware Fisici Motore
  statorWinding?: StatorWindingType;
  inverterPowerElectronics?: InverterPowerElectronicsType;
  rotorSleeveBearing?: RotorSleeveBearingType;
  rotorMagnetMaterial?: RotorMagnetMaterialType;
  motorHousing?: MotorHousingType;
  // Parametri Hardware Pacco Batteria
  packStructure?: BatteryPackStructure;
  bmsCalibration?: BmsCalibrationProfile;
  underbodyShield?: UnderbodyShieldType;
  gearboxType: 'SingleSpeedDirect' | 'TwoSpeedDualClutch';
  gearRatio: number; // 6.5 - 13.5:1
  maxMotorRpm: number; // 14000 - 22000 rpm
  // ID del motore termico/Wankel selezionato per i test ibridi
  coupledIceOptionId?: string;
  // Componente termica fallback
  iceArchitecture?: 'Inline' | 'V' | 'Boxer' | 'Wankel';
  iceCylindersOrRotors?: number;
  iceDisplacementCc?: number;
  iceFuelType?: 'Benzina' | 'Diesel' | 'BioFuel';
  iceTurbocharged?: boolean;
  priceTier: PriceTier;
  referenceClass: ReferenceClass;
  /** Configurazione separata opzionale della singola unità motore */
  motorSpec?: ElectricMotorSpec;
  /** Configurazione separata opzionale del pacco batteria */
  batterySpec?: BatteryPackSpec;
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
  /** Collegamento al progetto padre in caso di Variante / Evoluzione */
  parentEngineId?: string;
  parentEngineName?: string;
  isVariant?: boolean;
  variantRdSavingsPercent?: number;
  variantModifiedParts?: string[];
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

export type OrientationConversionType =
  | 'Native'
  | 'LongitudinalToTransverse'
  | 'TransverseToLongitudinal';

export interface OrientationMechanicalAdaptation {
  conversionType: OrientationConversionType;
  unitCostDelta: number;
  lengthDeltaMm: number;
  widthDeltaMm: number;
  powerMultiplier: number;
  reliabilityDeltaPercent: number;
  technicalBadge: string;
}

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
  /** Predisposizione Fase 2: Piattaforma Padre e Delta R&D Varianti Pianale */
  parentPlatformId?: string;
  isPlatformVariant?: boolean;
  platformVariantRdSavingsPercent?: number;
  platformModifiedSpecs?: string[];
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

