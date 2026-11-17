import type {
  BatteryChemistry,
  BatteryPackStructure,
  BenchElectricMotorCount,
  BmsCalibrationProfile,
  CoupledIceEngineOption,
  DualCurrencyCost,
  ElectricCoolingSystem,
  ElectricMotorType,
  HybridSystemType,
  InverterPowerElectronicsType,
  InverterTech,
  MotorHousingType,
  MotorLayoutConfig,
  PriceTier,
  ReferenceClass,
  RotorMagnetMaterialType,
  RotorSleeveBearingType,
  StatorWindingType,
  UnderbodyShieldType,
  VoltageArchitecture,
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
    description:
      'Trazione 100% elettrica diretta sull’asse. Coppia massima istantanea da 0 RPM fino al Field Weakening, zero emissioni allo scarico.',
    hasIceEngine: false,
    minBatteryKwh: 20,
    maxBatteryKwh: 140,
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
    description:
      ' Starter-generatore a 48V (ISG P0/P2) accoppiato al motore termico/Wankel: riempie il vuoto ai bassi regimi (Torque Fill) ed elimina il turbo-lag.',
    hasIceEngine: true,
    minBatteryKwh: 0.8,
    maxBatteryKwh: 3.5,
    defaultBatteryKwh: 1.5,
    emissionsReductionPercent: 15,
    complexityFactor: 1.15,
  },
  {
    id: 'FullHybrid',
    name: 'Full Hybrid (HEV — Serie-Parallelo Autoricabile)',
    badge: 'Full Hybrid HEV',
    minYear: 1997,
    unlockCost: { capitalCost: 12_000_000, rdCost: 160, minYear: 1997 },
    description:
      'Sistema ibrido autoricaricabile con trazione combinata termico + elettrico: marcia cittadina a zero emissioni e forte abbattimento dei consumi.',
    hasIceEngine: true,
    minBatteryKwh: 1.5,
    maxBatteryKwh: 6.5,
    defaultBatteryKwh: 2.8,
    emissionsReductionPercent: 38,
    complexityFactor: 1.35,
  },
  {
    id: 'PHEV',
    name: 'Plug-in Hybrid (PHEV — Ricaricabile ad Alte Prestazioni)',
    badge: 'Plug-in PHEV',
    minYear: 2012,
    unlockCost: { capitalCost: 22_000_000, rdCost: 260, minYear: 2012 },
    description:
      'Batteria ad alta capacità ricaricabile alla spina + piena sinergia tra motore termico/Wankel ed elettromotori per potenze combinate da supercar.',
    hasIceEngine: true,
    minBatteryKwh: 10,
    maxBatteryKwh: 45,
    defaultBatteryKwh: 22,
    emissionsReductionPercent: 72,
    complexityFactor: 1.55,
  },
  {
    id: 'RangeExtender',
    name: 'Range Extender (EREV — Trazione 100% EV + Generatore)',
    badge: 'Range Extender EREV',
    minYear: 2010,
    unlockCost: { capitalCost: 14_000_000, rdCost: 180, minYear: 2010 },
    description:
      'Le ruote sono mosse al 100% dai motori elettrici; il motore termico o Wankel accoppiato lavora a regime fisso ottimale esclusivamente come generatore di bordo.',
    hasIceEngine: true,
    minBatteryKwh: 18,
    maxBatteryKwh: 65,
    defaultBatteryKwh: 32,
    emissionsReductionPercent: 80,
    complexityFactor: 1.4,
  },
];

export interface ElectricMotorTypeSpec {
  id: ElectricMotorType;
  name: string;
  shortName: string;
  minYear: number;
  unlockCost: DualCurrencyCost;
  baseEfficiencyPercent: number;
  powerMultiplier: number;
  torqueMultiplier: number;
  weightMultiplier: number;
  baseCornerRpm: number;
  maxSafeRpm: number;
  costPerKw: number;
  hasZeroDragWhenCoasting: boolean;
  rareEarthDependency: 'Zero' | 'Ridotta' | 'Alta';
  description: string;
}

export const ELECTRIC_MOTOR_TYPES: ElectricMotorTypeSpec[] = [
  {
    id: 'InductionAsync',
    name: 'Asincrono a Induzione (ASM — Gabbia di Scoiattolo)',
    shortName: 'ASM Induzione',
    minYear: 1990,
    unlockCost: { capitalCost: 2_500_000, rdCost: 40, minYear: 1990 },
    baseEfficiencyPercent: 91.5,
    powerMultiplier: 0.85,
    torqueMultiplier: 0.85,
    weightMultiplier: 1.12,
    baseCornerRpm: 5800,
    maxSafeRpm: 20000,
    costPerKw: 11,
    hasZeroDragWhenCoasting: true,
    rareEarthDependency: 'Zero',
    description:
      'Economico e robusto, zero terre rare e nessun freno magnetico a vuoto (dimezza la penalità di consumo sui Dual-Motor AWD). Ottimo allungo di Field Weakening grazie al flusso rotorico controllato.',
  },
  {
    id: 'PermanentMagnetSync',
    name: 'Sincrono a Magneti Permanenti (PSM — Neodimio)',
    shortName: 'PSM Magneti Perm.',
    minYear: 1997,
    unlockCost: { capitalCost: 6_000_000, rdCost: 80, minYear: 1997 },
    baseEfficiencyPercent: 95.5,
    powerMultiplier: 1.00,
    torqueMultiplier: 1.00,
    weightMultiplier: 1.00,
    baseCornerRpm: 5267,
    maxSafeRpm: 24000,
    costPerKw: 18,
    hasZeroDragWhenCoasting: false,
    rareEarthDependency: 'Alta',
    description:
      'Elevatissima efficienza energetica e spinta immediata fin da 0 RPM. Richiede magneti in terre rare; con camicia in carbonio raggiunge i 24.000 RPM.',
  },
  {
    id: 'IPM_SynRM',
    name: 'Riluttanza Commutata Assistita (IPM-SynRM)',
    shortName: 'IPM-SynRM',
    minYear: 2015,
    unlockCost: { capitalCost: 11_000_000, rdCost: 140, minYear: 2015 },
    baseEfficiencyPercent: 94.8,
    powerMultiplier: 1.18,
    torqueMultiplier: 1.04,
    weightMultiplier: 0.96,
    baseCornerRpm: 5980,
    maxSafeRpm: 24000,
    costPerKw: 14,
    hasZeroDragWhenCoasting: false,
    rareEarthDependency: 'Ridotta',
    description:
      'Ottimo compromesso costo/efficienza: sfrutta la riluttanza magnetica del rotore per estendere il plateau di Field Weakening (+14% corner speed) ed erogare più CV del PSM agli alti regimi.',
  },
  {
    id: 'WoundRotorSync_EESM',
    name: 'Sincrono a Rotore Avvolto (EESM — Eccitazione Esterna)',
    shortName: 'EESM Rotore Avvolto',
    minYear: 2012,
    unlockCost: { capitalCost: 8_500_000, rdCost: 110, minYear: 2012 },
    baseEfficiencyPercent: 94.8,
    powerMultiplier: 1.11,
    torqueMultiplier: 0.95,
    weightMultiplier: 1.06,
    baseCornerRpm: 6150,
    maxSafeRpm: 20000,
    costPerKw: 13,
    hasZeroDragWhenCoasting: true,
    rareEarthDependency: 'Zero',
    description:
      'Rotore privo di magneti permanenti con avvolgimento eccitato in DC (stile Renault 5AQ / BMW Gen5 eDrive): regolazione attiva del Field Weakening ad alta velocità, zero trascinamento magnetico a vuoto e zero terre rare (+3–5 kg rotore/eccitatore).',
  },
  {
    id: 'AxialFlux',
    name: 'Flusso Assiale (Axial Flux — Disco Pancake Supercar)',
    shortName: 'Axial Flux',
    minYear: 2020,
    unlockCost: { capitalCost: 26_000_000, rdCost: 320, minYear: 2020 },
    baseEfficiencyPercent: 96.8,
    powerMultiplier: 1.45,
    torqueMultiplier: 1.55,
    weightMultiplier: 0.56,
    baseCornerRpm: 4200,
    maxSafeRpm: 24000,
    costPerKw: 34,
    hasZeroDragWhenCoasting: false,
    rareEarthDependency: 'Alta',
    description:
      'Statore privo di giogo ferromagnetico e peso quasi dimezzato (-50% massa nucleo): densità di coppia estrema su dischi a grande diametro per supercar e hypercar.',
  },
];

export interface MotorLayoutSpec {
  id: MotorLayoutConfig;
  name: string;
  shortName: string;
  motorCount: BenchElectricMotorCount;
  drivetrainType: 'FWD' | 'RWD' | 'eAWD';
  torqueVectoring: boolean;
  /** Moltiplicatore potenza totale rispetto al singolo motore */
  totalOutputMultiplier: number;
  /** Range indicativo potenza (CV) mostrato in UI */
  typicalHpRangeLabel: string;
  /** Efficienza base di trasmissione diretta sull'asse (%) */
  baseSystemEfficiencyPercent: number;
  /** Penalità consumo Wh/km rispetto a SingleMotor_RWD (1.00 = rif. RWD) */
  consumptionPenaltyMultiplier: number;
  /** Penalità consumo ridotta se accoppiato a ASM o sgancio meccanico anteriore */
  consumptionPenaltyWithDisconnect: number;
  costMultiplier: number;
  extraHardwareWeightKg: number;
  description: string;
}

export const MOTOR_LAYOUT_CONFIGS: MotorLayoutSpec[] = [
  {
    id: 'SingleMotor_RWD',
    name: 'Singolo Motore (Single 1.0× — RWD)',
    shortName: '1× Single (1.0×)',
    motorCount: 1,
    drivetrainType: 'RWD',
    torqueVectoring: false,
    totalOutputMultiplier: 1.0,
    typicalHpRangeLabel: '1.0× (60 – 550 CV)',
    baseSystemEfficiencyPercent: 92.5,
    consumptionPenaltyMultiplier: 1.0, // Riferimento più efficiente in assoluto
    consumptionPenaltyWithDisconnect: 1.0,
    costMultiplier: 1.0,
    extraHardwareWeightKg: 0,
    description:
      'Singola unità motrice universale (scala 1.0×): massima efficienza di sistema (90-93%), trazione diretta e zero trascinamenti parassiti.',
  },
  {
    id: 'SingleMotor_FWD',
    name: 'Singolo Motore (Single 1.0× — FWD)',
    shortName: '1× Single FWD (1.0×)',
    motorCount: 1,
    drivetrainType: 'FWD',
    torqueVectoring: false,
    totalOutputMultiplier: 1.0,
    typicalHpRangeLabel: '1.0× (60 – 550 CV)',
    baseSystemEfficiencyPercent: 91.0, // -1.5% rispetto a RWD in marcia veicolare
    consumptionPenaltyMultiplier: 1.015, // +1.5% consumo rispetto a RWD
    consumptionPenaltyWithDisconnect: 1.015,
    costMultiplier: 1.0,
    extraHardwareWeightKg: 0,
    description:
      'Stessa unità motrice singola universale (scala 1.0× e stesso costo): in marcia ha -1.5% di efficienza per limiti di rigenerazione sull’avantreno.',
  },
  {
    id: 'SingleMotor_MechanicalAWD',
    name: '1× Motore + Albero Meccanico AWD (-8% Perdita)',
    shortName: '1× Mech-AWD (0.92×)',
    motorCount: 1,
    drivetrainType: 'eAWD',
    torqueVectoring: false,
    totalOutputMultiplier: 0.92, // -8% perdita di trasmissione meccanica AWD
    typicalHpRangeLabel: '0.92× (-8% Loss)',
    baseSystemEfficiencyPercent: 85.1,
    consumptionPenaltyMultiplier: 1.087, // Penalità attrito albero di trasmissione e ripartitore
    consumptionPenaltyWithDisconnect: 1.055,
    costMultiplier: 1.0,
    extraHardwareWeightKg: 38,
    description:
      'Singolo motore elettrico accoppiato a un albero di trasmissione meccanico AWD tradizionale: subisce una perdita meccanica del -8% (0.92×) alle ruote.',
  },
  {
    id: 'DualMotor_eAWD',
    name: 'Dual-Motor e-AWD (2× Motori — Scala 2.0×)',
    shortName: '2× Dual-Motor (2.0×)',
    motorCount: 2,
    drivetrainType: 'eAWD',
    torqueVectoring: false,
    totalOutputMultiplier: 2.0,
    typicalHpRangeLabel: '2.0× (250 – 1.100 CV)',
    baseSystemEfficiencyPercent: 88.2,
    consumptionPenaltyMultiplier: 1.085, // +8.5% (+7% / +10%) rispetto a RWD
    consumptionPenaltyWithDisconnect: 1.04, // Ridotto a +4% con ASM o sgancio meccanico!
    costMultiplier: 2.0,
    extraHardwareWeightKg: 42,
    description:
      '2 motori elettrici uguali (scala lineare esatta 2.0× potenza e coppia). Consuma +8.5% rispetto a 1× RWD (ridotto a +4% con ASM o sgancio anteriore).',
  },
  {
    id: 'TriMotor_TorqueVectoring',
    name: 'Tri-Motor e-AWD (3× Motori — Scala 3.0×)',
    shortName: '3× Tri-Motor (3.0×)',
    motorCount: 3,
    drivetrainType: 'eAWD',
    torqueVectoring: true,
    totalOutputMultiplier: 3.0,
    typicalHpRangeLabel: '3.0× (600 – 1.650 CV)',
    baseSystemEfficiencyPercent: 85.5,
    consumptionPenaltyMultiplier: 1.145, // +14.5% (+14% / +18%)
    consumptionPenaltyWithDisconnect: 1.12,
    costMultiplier: 3.0,
    extraHardwareWeightKg: 82,
    description:
      '3 motori elettrici uguali con Torque Vectoring (scala lineare esatta 3.0× potenza e coppia). Consuma +14.5% per l’attrito di 3 riduttori e 3 inverter.',
  },
  {
    id: 'QuadMotor_Independent',
    name: 'Quad-Motor Indipendente (4× Motori — Scala 4.0×)',
    shortName: '4× Quad-Motor (4.0×)',
    motorCount: 4,
    drivetrainType: 'eAWD',
    torqueVectoring: true,
    totalOutputMultiplier: 4.0,
    typicalHpRangeLabel: '4.0× (1.000 – 2.400+ CV)',
    baseSystemEfficiencyPercent: 83.8,
    consumptionPenaltyMultiplier: 1.175, // +17.5% (+14% / +18%)
    consumptionPenaltyWithDisconnect: 1.15,
    costMultiplier: 4.0,
    extraHardwareWeightKg: 124,
    description:
      '4 motori e 4 inverter indipendenti, 1 per ruota (scala lineare esatta 4.0× potenza e coppia). Consuma +17.5% per l’attrito combinato dei 4 riduttori.',
  },
];

export interface BatteryChemistrySpec {
  id: BatteryChemistry;
  name: string;
  shortName: string;
  minYear: number;
  cellDensityWhPerKg: number;
  packagingMultiplier: number;
  /** Costo realistico al kWh ($/kWh) */
  costPerKwh: number;
  /** Cicli carica/scarica nominali al 75-80% SoH */
  cycleLife: number;
  /** Durata chilometrica base realistica in uso Normale (km) */
  baseLifespanKm: number;
  /** Modificatore affidabilità % legato alla stabilità chimico-termica */
  reliabilityDeltaPercent: number;
  thermalStability: 'Eccellente' | 'Buona' | 'Delicata';
  maxContinuousCRate: number;
  description: string;
}

export const BATTERY_CHEMISTRIES: BatteryChemistrySpec[] = [
  {
    id: 'LFP',
    name: 'LFP — Litio-Ferro-Fosfato (LiFePO4)',
    shortName: 'LFP (75 $/kWh)',
    minYear: 2005,
    cellDensityWhPerKg: 165,
    packagingMultiplier: 1.28,
    costPerKwh: 75, // 40 kWh = $3.000!
    cycleLife: 3200,
    baseLifespanKm: 440_000, // Range reale 350.000 - 550.000 km
    reliabilityDeltaPercent: +4.5,
    thermalStability: 'Eccellente',
    maxContinuousCRate: 2.5,
    description:
      'Economica (~75 $/kWh: 40 kWh costano $3.000) ed estremamente longeva (350.000 - 550.000 km). Chimicamente incombustibile ma più pesante a parità di kWh.',
  },
  {
    id: 'NMC811',
    name: 'NMC — Nichel-Manganese-Cobalto (Alta Densità)',
    shortName: 'NMC (110 $/kWh)',
    minYear: 2014,
    cellDensityWhPerKg: 260,
    packagingMultiplier: 1.22,
    costPerKwh: 110,
    cycleLife: 1850,
    baseLifespanKm: 285_000, // Range reale 220.000 - 360.000 km
    reliabilityDeltaPercent: 0.0,
    thermalStability: 'Buona',
    maxContinuousCRate: 3.8,
    description:
      'Ottimo bilanciamento peso/autonomia (~110 $/kWh) con durata reale tra 220.000 e 360.000 km. Standard ideale per berline e SUV di fascia media/alta.',
  },
  {
    id: 'NCA',
    name: 'NCA Alta Scarica — Nichel-Cobalto-Alluminio (Performance)',
    shortName: 'NCA (135 $/kWh)',
    minYear: 2012,
    cellDensityWhPerKg: 295,
    packagingMultiplier: 1.19,
    costPerKwh: 135,
    cycleLife: 1450,
    baseLifespanKm: 235_000,
    reliabilityDeltaPercent: -4.5,
    thermalStability: 'Delicata',
    maxContinuousCRate: 5.5,
    description:
      'Celle ad altissima scarica (~135 $/kWh) per vetture Sport e Corsa: eroga correnti estreme ma soffre lo stress termico (-4.5% affidabilità se non ben raffreddata).',
  },
  {
    id: 'SolidState',
    name: 'Stato Solido — Solid-State Elettrolita Ceramico',
    shortName: 'Solid-State (190 $/kWh)',
    minYear: 2025,
    cellDensityWhPerKg: 425,
    packagingMultiplier: 1.12,
    costPerKwh: 190,
    cycleLife: 2400,
    baseLifespanKm: 310_000, // Range reale 220.000 - 360.000 km
    reliabilityDeltaPercent: +2.0,
    thermalStability: 'Eccellente',
    maxContinuousCRate: 6.5,
    description:
      'Leggerissima e con densità energetica estrema (~190 $/kWh). Dimezza il peso della batteria e sostiene ricariche e scariche da hypercar (220.000 - 360.000 km).',
  },
];

export interface CoolingSystemSpec {
  id: ElectricCoolingSystem;
  name: string;
  shortName: string;
  minYear: number;
  cost: number;
  weightKg: number;
  continuousPowerRatio: number;
  reliabilityDeltaPercent: number;
  protectsHighDischargeCorsa: boolean;
  description: string;
}

export const ELECTRIC_COOLING_SYSTEMS: CoolingSystemSpec[] = [
  {
    id: 'Air',
    name: 'Aria Passiva / Elettroventola Forzata',
    shortName: 'Aria Passiva (-18% Affid.)',
    minYear: 1990,
    cost: 160,
    weightKg: 6,
    continuousPowerRatio: 0.54,
    reliabilityDeltaPercent: -18.0, // Forte penalità affidabilità -18% e thermal throttling!
    protectsHighDischargeCorsa: false,
    description:
      'Economico e leggero, ma causa rapido surriscaldamento delle celle (Thermal Throttling) e infligge una severa penalità di -18% all’affidabilità.',
  },
  {
    id: 'LiquidGlycol',
    name: 'Liquido con Chiller / Pompa di Calore Attiva',
    shortName: 'Liquido Chiller/PdC',
    minYear: 2010,
    cost: 780,
    weightKg: 24,
    continuousPowerRatio: 0.84,
    reliabilityDeltaPercent: +1.5,
    protectsHighDischargeCorsa: false,
    description:
      'Standard ottimale moderno: circuito a glicole climatizzato da chiller e pompa di calore che mantiene batteria e inverter tra 20°C e 35°C.',
  },
  {
    id: 'DirectDielectric',
    name: 'Immersione Dielettrica Diretta (Fluido Isolante)',
    shortName: 'Immersione Dielettrica',
    minYear: 2021,
    cost: 2150,
    weightKg: 34,
    continuousPowerRatio: 0.97,
    reliabilityDeltaPercent: +6.5,
    protectsHighDischargeCorsa: true,
    description:
      'Celle e avvolgimenti immersi direttamente in fluido dielettrico: azzera il derating termico ed è indispensabile per preservare l’affidabilità in classe Corsa.',
  },
];

export interface VoltageArchitectureSpec {
  voltage: VoltageArchitecture;
  name: string;
  badge: string;
  powerMultiplier: number;
  efficiencyBonusPercent: number;
  cornerSpeedBonusRpm: number;
  cableWeightKg: number;
  costMultiplier: number;
  description: string;
}

export const VOLTAGE_ARCHITECTURES: VoltageArchitectureSpec[] = [
  {
    voltage: 400,
    name: 'Architettura 400V Standard',
    badge: '400V Std',
    powerMultiplier: 0.97,
    efficiencyBonusPercent: 0.0,
    cornerSpeedBonusRpm: -900,
    cableWeightKg: 28,
    costMultiplier: 1.0,
    description: 'Tensione standard per citycar e berline: cavi in rame più pesanti (+4 kg bus motore) e Back-EMF che limita prima la Corner Speed.',
  },
  {
    voltage: 800,
    name: 'Architettura 800V Alta Potenza',
    badge: '800V Ultra-Fast',
    powerMultiplier: 1.00,
    efficiencyBonusPercent: 2.2,
    cornerSpeedBonusRpm: 1100,
    cableWeightKg: 15,
    costMultiplier: 1.18,
    description: 'Dimezza gli ampere a parità di kW: vince la Back-EMF estendendo del +20% la Corner Speed (CV agli alti giri) e alleggerisce i cablaggi (-13 kg).',
  },
  {
    voltage: 1000,
    name: 'Architettura 1000V+ Motorsport / Hypercar',
    badge: '1000V+ Hyper',
    powerMultiplier: 1.02,
    efficiencyBonusPercent: 3.5,
    cornerSpeedBonusRpm: 1650,
    cableWeightKg: 11,
    costMultiplier: 1.42,
    description: 'Altissima tensione da competizione/hypercar (stile Lucid/Formula E Gen3): massima Corner Speed e minime perdite resistive.',
  },
];

/**
 * Punto 5: PriceTier governa direttamente la tecnologia dell'Elettronica di Potenza (Inverter),
 * modificando Potenza specifica (+CV), Efficienza (meno kWh/100km), Affidabilità % e Durata in km.
 */
export interface PriceTierEvSpec {
  tier: PriceTier;
  inverterName: string;
  inverterShort: string;
  mappedInverterTech: InverterTech;
  inverterEfficiencyPercent: number;
  powerMultiplier: number;
  consumptionMultiplier: number;
  reliabilityDeltaPercent: number;
  lifespanMultiplier: number;
  electronicsCostBase: number;
  description: string;
}

export const PRICE_TIER_EV_SPECS: Record<PriceTier, PriceTierEvSpec> = {
  Economica: {
    tier: 'Economica',
    inverterName: 'Inverter IGBT al Silicio Base (Commutazione 12 kHz)',
    inverterShort: 'IGBT Base (86.0% eff.)',
    mappedInverterTech: 'Silicon_IGBT',
    inverterEfficiencyPercent: 86.0,
    powerMultiplier: 0.86,
    consumptionMultiplier: 1.09, // +9% kWh/100km per perdite di commutazione IGBT
    reliabilityDeltaPercent: -5.5,
    lifespanMultiplier: 0.84,
    electronicsCostBase: 480,
    description:
      'Elettronica di potenza economica con transistor IGBT al silicio (efficienza 86%): taglia i costi per citycar ma riduce potenza specifica e autonomia.',
  },
  Media: {
    tier: 'Media',
    inverterName: 'Inverter IGBT Trench Field-Stop Evoluto (20 kHz)',
    inverterShort: 'IGBT Evoluto (91.5% eff.)',
    mappedInverterTech: 'Silicon_IGBT',
    inverterEfficiencyPercent: 91.5,
    powerMultiplier: 1.0,
    consumptionMultiplier: 1.0,
    reliabilityDeltaPercent: 0.0,
    lifespanMultiplier: 1.0,
    electronicsCostBase: 850,
    description:
      'Inverter industriale bilanciato con moduli IGBT di ultima generazione (efficienza 91.5%): erogazione solida e durata standard.',
  },
  Premium: {
    tier: 'Premium',
    inverterName: 'Inverter MOSFET al Carburo di Silicio (SiC 80 kHz)',
    inverterShort: 'MOSFET SiC (95.5% eff.)',
    mappedInverterTech: 'SiliconCarbide_SiC',
    inverterEfficiencyPercent: 95.5,
    powerMultiplier: 1.12, // +12% CV specifici
    consumptionMultiplier: 0.94, // -6% kWh/100km
    reliabilityDeltaPercent: +3.5,
    lifespanMultiplier: 1.12,
    electronicsCostBase: 1550,
    description:
      'Semiconduttori al Carburo di Silicio (SiC, efficienza 95.5%): +12% potenza specifica, -6% consumi energetici e maggiore durata termica.',
  },
  Lusso: {
    tier: 'Lusso',
    inverterName: 'Inverter Dual-MOSFET SiC / Nitruro di Gallio (GaN 180 kHz)',
    inverterShort: 'Dual SiC/GaN (97.5% eff.)',
    mappedInverterTech: 'GalliumNitride_GaN',
    inverterEfficiencyPercent: 97.5,
    powerMultiplier: 1.22, // +22% CV specifici
    consumptionMultiplier: 0.90, // -10% kWh/100km
    reliabilityDeltaPercent: +6.0,
    lifespanMultiplier: 1.22,
    electronicsCostBase: 2850,
    description:
      'Architettura estrema Dual-SiC/GaN da hypercar (efficienza 97.5%): +22% potenza specifica, minime perdite termiche e cuscinetti ceramici.',
  },
};

/**
 * Punto 5: ReferenceClass modifica concretamente la fisica (potenza, coppia, C-rate, peso, durata km e affidabilità).
 */
export interface ReferenceClassEvSpec {
  refClass: ReferenceClass;
  badge: string;
  powerMultiplier: number;
  torqueMultiplier: number;
  batteryPackWeightMultiplier: number;
  extraStructuralWeightKg: number;
  reliabilityDeltaPercent: number;
  /** Range target durata stimata in km */
  targetLifespanDescription: string;
  description: string;
}

export const REFERENCE_CLASS_EV_SPECS: Record<ReferenceClass, ReferenceClassEvSpec> = {
  Normale: {
    refClass: 'Normale',
    badge: 'Buffer Protettivo (Lunga Durata)',
    powerMultiplier: 1.0,
    torqueMultiplier: 1.0,
    batteryPackWeightMultiplier: 1.0,
    extraStructuralWeightKg: 0,
    reliabilityDeltaPercent: +2.0,
    targetLifespanDescription: '350k–550k km (LFP) • 220k–360k km (NMC/SS)',
    description:
      'Taratura stradale bilanciata con buffer batteria protettivo (8% top/bottom): massimizza la vita utile in km.',
  },
  Comfort: {
    refClass: 'Comfort',
    badge: 'Silenziosità & Max Cicli',
    powerMultiplier: 0.94,
    torqueMultiplier: 0.95,
    batteryPackWeightMultiplier: 1.02,
    extraStructuralWeightKg: 14, // Isolamento fischi inverter PWM
    reliabilityDeltaPercent: +4.0,
    targetLifespanDescription: '380k–550k km (LFP) • 250k–360k km (NMC/SS)',
    description:
      'Erogazione vellutata, incapsulamento acustico contro i fischi ad alta frequenza dell’inverter (+14 kg) e minima usura celle.',
  },
  Sport: {
    refClass: 'Sport',
    badge: '+20% CV/Nm • Scarica C-Rate Alta',
    powerMultiplier: 1.20,
    torqueMultiplier: 1.20,
    batteryPackWeightMultiplier: 0.96,
    extraStructuralWeightKg: 0,
    reliabilityDeltaPercent: -5.5,
    targetLifespanDescription: '120.000 – 200.000 km (Alta Scarica)',
    description:
      'Sblocca picchi di scarica (C-Rate) superiori (+20% CV e +20% Nm), riducendo la durata a 120.000–200.000 km e generando più calore.',
  },
  Corsa: {
    refClass: 'Corsa',
    badge: '+45% CV/Nm • Zero Buffer Racing',
    powerMultiplier: 1.45,
    torqueMultiplier: 1.45,
    batteryPackWeightMultiplier: 0.82, // -18% peso pacco batteria per involucro in carbonio
    extraStructuralWeightKg: -12,
    reliabilityDeltaPercent: -17.0, // Crollo affidabilità se non c'è immersione dielettrica!
    targetLifespanDescription: '15.000 – 45.000 km (Uso Pista Estremo)',
    description:
      'Rimuove i buffer di sicurezza e spinge gli inverter al limite (+45% CV/Nm e -18% peso batteria): crollo di durata (15k–45k km) e affidabilità senza Immersione Dielettrica.',
  },
  Fuoristrada: {
    refClass: 'Fuoristrada',
    badge: 'Blindatura Sottoscocca IP68 + Crawling',
    powerMultiplier: 1.05,
    torqueMultiplier: 1.24, // +24% coppia di spunto per rock-crawling
    batteryPackWeightMultiplier: 1.06,
    extraStructuralWeightKg: 46, // Piastra sottoscocca acciaio/kevlar + guarnizioni IP68
    reliabilityDeltaPercent: +4.5,
    targetLifespanDescription: '240.000 – 380.000 km (Blindato IP68)',
    description:
      'Blindatura strutturale sottoscocca della batteria e sigillatura stagna IP68 per guadi (+46 kg, +affidabilità meccanica, +24% coppia a bassi giri).',
  },
};

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
    efficiencyPercent: 89.5,
    switchingFrequencyKhz: 16,
    costPerInverter: 420,
    weightKg: 13,
    description: 'Semiconduttore collaudato ed economico con perdite di commutazione medie.',
  },
  {
    id: 'SiliconCarbide_SiC',
    name: 'SiC — Carburo di Silicio (MOSFET Alta Efficienza)',
    minYear: 2018,
    efficiencyPercent: 95.8,
    switchingFrequencyKhz: 95,
    costPerInverter: 1150,
    weightKg: 8.0,
    description: 'Dimezza le perdite Joule termiche. Fondamentale per architetture a 800V e 1000V.',
  },
  {
    id: 'GalliumNitride_GaN',
    name: 'GaN — Nitruro di Gallio ad Altissima Frequenza',
    minYear: 2024,
    efficiencyPercent: 97.5,
    switchingFrequencyKhz: 220,
    costPerInverter: 2200,
    weightKg: 4.5,
    description: 'Semiconduttore da motorsport: commutazioni ultra-rapide e massima densità di potenza.',
  },
];

// ============================================================================
// COMPONENTISTICA FISICA REALE (MOTORE ELETTRICO & PACCO BATTERIA)
// ============================================================================

export interface StatorWindingSpec {
  id: StatorWindingType;
  name: string;
  shortName: string;
  powerMultiplier: number;
  torqueMultiplier: number;
  highRpmPowerMultiplier: number;
  cost: number;
  rdCost: number;
  weightDeltaKg: number;
  efficiencyBonusPercent: number;
  reliabilityDeltaPercent: number;
  description: string;
}

export const STATOR_WINDING_SPECS: StatorWindingSpec[] = [
  {
    id: 'RoundWireStandard',
    name: 'Filo Tondo Standard (Riempimento 45%)',
    shortName: 'Filo Tondo 45%',
    powerMultiplier: 0.75,
    torqueMultiplier: 0.96,
    highRpmPowerMultiplier: 0.90,
    cost: 0,
    rdCost: 0,
    weightDeltaKg: 0,
    efficiencyBonusPercent: -0.8,
    reliabilityDeltaPercent: 0,
    description: 'Economico e base: riempimento cava 45%, minore coppia (-4%) e maggiore induttanza che anticipa il Field Weakening (-22% Corner Speed).',
  },
  {
    id: 'HairpinFlat',
    name: 'Barre Piatte Hairpin (Riempimento 70%)',
    shortName: 'Hairpin 70%',
    powerMultiplier: 1.00,
    torqueMultiplier: 1.00,
    highRpmPowerMultiplier: 1.02,
    cost: 280,
    rdCost: 45,
    weightDeltaKg: -1.5,
    efficiencyBonusPercent: +1.2,
    reliabilityDeltaPercent: +4,
    description: 'Riferimento moderno: barre rettangolari a forcina, riempimento cava 70% e buona dissipazione termica.',
  },
  {
    id: 'HairpinContinuousMultiLayer',
    name: 'Hairpin Continuo Multi-Strato',
    shortName: 'Hairpin Multi-Strato',
    powerMultiplier: 1.16,
    torqueMultiplier: 1.08,
    highRpmPowerMultiplier: 1.16,
    cost: 650,
    rdCost: 95,
    weightDeltaKg: -2.5,
    efficiencyBonusPercent: +2.2,
    reliabilityDeltaPercent: +6,
    description: 'Avvolgimento continuo multi-strato (+8% Nm, +8% Corner Speed): massima densità di rame senza saldature di testa.',
  },
  {
    id: 'LitzRacingWire',
    name: 'Filo Litz / Rame Puro Racing',
    shortName: 'Filo Litz Racing',
    powerMultiplier: 1.11,
    torqueMultiplier: 0.91,
    highRpmPowerMultiplier: 1.25,
    cost: 1450,
    rdCost: 210,
    weightDeltaKg: -3.5,
    efficiencyBonusPercent: +3.0,
    reliabilityDeltaPercent: +8,
    description: 'Trefoli isolati singolarmente (+21% Corner Speed, zero effetto pelle ad alta frequenza): privilegia l’allungo e i CV ad altissimi RPM.',
  },
];

export interface InverterPowerElectronicsSpec {
  id: InverterPowerElectronicsType;
  name: string;
  shortName: string;
  mappedInverterTech: InverterTech;
  efficiencyPercent: number;
  powerMultiplier: number;
  torqueMultiplier: number;
  cost: number;
  rdCost: number;
  weightDeltaKg: number;
  reliabilityDeltaPercent: number;
  description: string;
}

export const INVERTER_POWER_ELECTRONICS_SPECS: InverterPowerElectronicsSpec[] = [
  {
    id: 'Silicon_IGBT',
    name: 'Inverter IGBT al Silicio (Economico)',
    shortName: 'IGBT Silicio (88%)',
    mappedInverterTech: 'Silicon_IGBT',
    efficiencyPercent: 88.0,
    powerMultiplier: 0.81,
    torqueMultiplier: 0.99,
    cost: 180,
    rdCost: 0,
    weightDeltaKg: +1.7,
    reliabilityDeltaPercent: 0,
    description: 'Basso costo, efficienza 88%, frequenza 16 kHz (-18% Corner Speed / -19% CV) e modulo di potenza più pesante (+1.7 kg).',
  },
  {
    id: 'Silicon_MOSFET',
    name: 'Inverter MOSFET Silicio Avanzato',
    shortName: 'MOSFET Silicio (93%)',
    mappedInverterTech: 'Silicon_IGBT',
    efficiencyPercent: 93.0,
    powerMultiplier: 1.0,
    torqueMultiplier: 1.0,
    cost: 420,
    rdCost: 40,
    weightDeltaKg: 0,
    reliabilityDeltaPercent: +3,
    description: 'Costo medio, efficienza 93%, erogazione e modulazione 1.0x equilibrata per auto stradali.',
  },
  {
    id: 'SiliconCarbide_SiC',
    name: 'Inverter Carburo di Silicio (SiC MOSFET)',
    shortName: 'SiC MOSFET (97.5%)',
    mappedInverterTech: 'SiliconCarbide_SiC',
    efficiencyPercent: 97.5,
    powerMultiplier: 1.09,
    torqueMultiplier: 1.03,
    cost: 950,
    rdCost: 110,
    weightDeltaKg: -2.3,
    reliabilityDeltaPercent: +8,
    description: 'Efficienza 97.5%, commutazione rapida 95 kHz (+3% Nm, +6% Corner Speed), inverter compatto (-2.3 kg) e basse perdite termiche.',
  },
  {
    id: 'Dual_SiC_GaN_Racing',
    name: 'Dual-Inverter SiC / GaN Alta Corrente (Corsa)',
    shortName: 'Dual SiC/GaN Corsa (98.5%)',
    mappedInverterTech: 'GalliumNitride_GaN',
    efficiencyPercent: 98.5,
    powerMultiplier: 1.34,
    torqueMultiplier: 1.25,
    cost: 2400,
    rdCost: 260,
    weightDeltaKg: -3.7,
    reliabilityDeltaPercent: -4,
    description: 'Doppia modulazione GaN/SiC ad altissima corrente di fase (+25% Nm, +7% Corner Speed, 98.5% eff.): densità da hypercar e Formula E.',
  },
];

export interface RotorSleeveBearingSpec {
  id: RotorSleeveBearingType;
  name: string;
  shortName: string;
  maxSafeRpm: number;
  cost: number;
  rdCost: number;
  weightDeltaKg: number;
  reliabilityDeltaPercent: number;
  description: string;
}

export const ROTOR_SLEEVE_BEARING_SPECS: RotorSleeveBearingSpec[] = [
  {
    id: 'SteelLaminationStandard',
    name: 'Lamierini Acciaio + Cuscinetti Acciaio Standard',
    shortName: 'Acciaio Std (16k RPM)',
    maxSafeRpm: 16000,
    cost: 0,
    rdCost: 0,
    weightDeltaKg: 0,
    reliabilityDeltaPercent: 0,
    description: 'Economico: lamierini convenzionali e cuscinetti in acciaio, regime sicuro fino a 16.000 RPM (-4% Nm / -11% Corner Speed).',
  },
  {
    id: 'InconelSleeveHybrid',
    name: 'Camicia Inconel + Cuscinetti Ibridi',
    shortName: 'Inconel Ibridi (20k RPM)',
    maxSafeRpm: 20000,
    cost: 380,
    rdCost: 50,
    weightDeltaKg: -0.4,
    reliabilityDeltaPercent: +6,
    description: 'Camicia di contenimento in Inconel e cuscinetti ibridi: permette fino a 20.000 RPM sicuri con attriti ridotti.',
  },
  {
    id: 'CarbonPrepregCeramic',
    name: 'Camicia in Fibra di Carbonio Pre-Preg + Cuscinetti Ceramici Si3N4',
    shortName: 'Carbonio + Si3N4 (24k RPM)',
    maxSafeRpm: 24000,
    cost: 1150,
    rdCost: 160,
    weightDeltaKg: -1.2,
    reliabilityDeltaPercent: +10,
    description: 'Rotore fasciato in carbonio pre-preg + cuscinetti ceramici Si3N4: sblocca fino a 24.000 RPM su motori sincroni/assiali (+6% Nm, zero correnti parassite).',
  },
];

export interface RotorMagnetMaterialSpec {
  id: RotorMagnetMaterialType;
  name: string;
  shortName: string;
  torqueMultiplier: number;
  powerMultiplier: number;
  cost: number;
  rdCost: number;
  weightDeltaKg: number;
  thermalDemagnetizationResistance: string;
  description: string;
}

export const ROTOR_MAGNET_MATERIAL_SPECS: RotorMagnetMaterialSpec[] = [
  {
    id: 'FerriteStandardCage',
    name: 'Magneti in Ferrite Ceramica (Zero Terre Rare)',
    shortName: 'Ferrite (Zero Terre Rare)',
    torqueMultiplier: 0.90,
    powerMultiplier: 1.03,
    cost: -250,
    rdCost: 0,
    weightDeltaKg: +2.0,
    thermalDemagnetizationResistance: 'Buona (fino a 200°C)',
    description: 'Zero terre rare (-10% Nm ma controllo campo in Field Weakening +15% Corner Speed): economica e resistente alla smagnetizzazione.',
  },
  {
    id: 'NeodymiumNdFeB',
    name: 'Neodimio Standard (NdFeB N42)',
    shortName: 'Neodimio N42',
    torqueMultiplier: 1.0,
    powerMultiplier: 1.0,
    cost: 0,
    rdCost: 30,
    weightDeltaKg: 0,
    thermalDemagnetizationResistance: 'Buona (fino a 120°C)',
    description: 'Costo medio, flusso e densità di coppia 1.0x standard per motori elettrici stradali.',
  },
  {
    id: 'NeodymiumDyUH',
    name: 'Neodimio-Disprosio Alta Temperatura (NdFeB-UH 200°C)',
    shortName: 'NdFeB-UH 200°C',
    torqueMultiplier: 1.05,
    powerMultiplier: 1.08,
    cost: 520,
    rdCost: 80,
    weightDeltaKg: -0.5,
    thermalDemagnetizationResistance: 'Superiore (fino a 200°C)',
    description: 'Additivato con Disprosio (+5% Nm, +2.6% Corner Speed): mantiene la coercitività fino a 200°C senza smagnetizzarsi.',
  },
  {
    id: 'SamariumCobaltRacing',
    name: 'Samario-Cobalto (SmCo) / Leghe Permendur Racing',
    shortName: 'SmCo / Permendur',
    torqueMultiplier: 1.20,
    powerMultiplier: 1.21,
    cost: 1350,
    rdCost: 190,
    weightDeltaKg: -1.2,
    thermalDemagnetizationResistance: 'Estrema (oltre 300°C)',
    description: 'Massima energia magnetica ad alta temperatura (+20% Nm, stabilità oltre 300°C) per motori da competizione ed hypercar.',
  },
];

export const INDUCTION_ROTOR_CAGE_SPECS: RotorMagnetMaterialSpec[] = [
  {
    id: 'FerriteStandardCage',
    name: 'Gabbia in Alluminio Pressofuso',
    shortName: 'Gabbia Alluminio',
    torqueMultiplier: 0.95,
    powerMultiplier: 0.92,
    cost: -250,
    rdCost: 0,
    weightDeltaKg: -1.0,
    thermalDemagnetizationResistance: 'Standard (160°C)',
    description: 'Economica, maggiore resistenza rotorica e scorrimento: ideale per applicazioni stradali accessibili a zero terre rare.',
  },
  {
    id: 'NeodymiumNdFeB',
    name: 'Gabbia in Rame Pressofuso',
    shortName: 'Gabbia Rame',
    torqueMultiplier: 1.0,
    powerMultiplier: 1.0,
    cost: 0,
    rdCost: 30,
    weightDeltaKg: 0,
    thermalDemagnetizationResistance: 'Buona (200°C)',
    description: 'Conducibilità superiore e minori perdite Joule rotoriche rispetto alla gabbia in alluminio pressofuso.',
  },
  {
    id: 'NeodymiumDyUH',
    name: 'Gabbia in Rame Brasato ad Alta Densità',
    shortName: 'Rame Brasato LDU',
    torqueMultiplier: 1.03,
    powerMultiplier: 1.04,
    cost: 340,
    rdCost: 70,
    weightDeltaKg: +0.5,
    thermalDemagnetizationResistance: 'Superiore (240°C)',
    description: 'Stile Tesla LDU Perf.: barre in rame brasato ad alta corrente di spunto e superiore tenuta termica continua.',
  },
  {
    id: 'SamariumCobaltRacing',
    name: 'Gabbia Rame-Argento Aeronautico CNC',
    shortName: 'Rame-Argento CNC',
    torqueMultiplier: 1.06,
    powerMultiplier: 1.08,
    cost: 790,
    rdCost: 140,
    weightDeltaKg: +0.2,
    thermalDemagnetizationResistance: 'Estrema (oltre 300°C)',
    description: 'Massima conducibilità elettrica e tenuta centrifuga da competizione per motori ad induzione ad alte prestazioni.',
  },
];

export const EESM_ROTOR_WINDING_SPECS: RotorMagnetMaterialSpec[] = [
  {
    id: 'FerriteStandardCage',
    name: 'Rotore Avvolto a Spazzole Standard',
    shortName: 'Avvolto a Spazzole',
    torqueMultiplier: 0.93,
    powerMultiplier: 0.93,
    cost: -150,
    rdCost: 0,
    weightDeltaKg: +3.5,
    thermalDemagnetizationResistance: 'Anelli Grafite Std',
    description: 'Anelli collettori in grafite standard: avvolgimento rotorico in rame eccitato in DC, zero terre rare e zero trascinamento magnetico.',
  },
  {
    id: 'NeodymiumNdFeB',
    name: 'Rotore Avvolto ad Alta Densità di Rame',
    shortName: 'Avvolto Alta Densità',
    torqueMultiplier: 1.0,
    powerMultiplier: 1.03,
    cost: 0,
    rdCost: 35,
    weightDeltaKg: +4.0,
    thermalDemagnetizationResistance: 'Isolamento Classe H',
    description: 'Fattore di riempimento rotorico ottimizzato per una densità di flusso superiore ed eccellente rendimento ai carichi parziali.',
  },
  {
    id: 'NeodymiumDyUH',
    name: 'Rotore Avvolto Raffreddato a Liquido (Gen5)',
    shortName: 'Avvolto Liquido Gen5',
    torqueMultiplier: 1.01,
    powerMultiplier: 1.10,
    cost: 190,
    rdCost: 75,
    weightDeltaKg: +4.5,
    thermalDemagnetizationResistance: 'Raffreddamento Interno',
    description: 'Alta densità di corrente di eccitazione continua (stile BMW Gen5 eDrive): estende il Field Weakening a costi inferiori rispetto a NdFeB DyUH.',
  },
  {
    id: 'SamariumCobaltRacing',
    name: 'Eccitatore Induttivo Brushless ad Alta Frequenza',
    shortName: 'Induttivo Brushless HF',
    torqueMultiplier: 1.10,
    powerMultiplier: 1.28,
    cost: 480,
    rdCost: 145,
    weightDeltaKg: +3.8,
    thermalDemagnetizationResistance: 'Zero Attrito Spazzole',
    description: 'Zero attrito spazzole con trasferimento induttivo racing ad alta frequenza: usura nulla e costi nettamente inferiori a SmCo.',
  },
];

/**
 * Restituisce i descrittori fisici e UI dei 4 materiali/tecnologie rotore coerenti
 * con la topologia scelta (`InductionAsync`, `WoundRotorSync_EESM`, oppure motori a magneti permanenti),
 * mantenendo gli ID stabili per la retrocompatibilità con i motori salvati.
 */
export function getRotorMaterialSpecsForMotorType(
  motorType: ElectricMotorType,
): RotorMagnetMaterialSpec[] {
  if (motorType === 'InductionAsync') {
    return INDUCTION_ROTOR_CAGE_SPECS;
  }
  if (motorType === 'WoundRotorSync_EESM') {
    return EESM_ROTOR_WINDING_SPECS;
  }
  return ROTOR_MAGNET_MATERIAL_SPECS;
}

export interface MotorHousingSpec {
  id: MotorHousingType;
  name: string;
  shortName: string;
  cost: number;
  rdCost: number;
  weightDeltaKg: number;
  nvhComfortScore: number;
  reliabilityDeltaPercent: number;
  description: string;
}

export const MOTOR_HOUSING_SPECS: MotorHousingSpec[] = [
  {
    id: 'DieCastAluminum',
    name: 'Alluminio Pressofuso Standard',
    shortName: 'Alluminio Std',
    cost: 0,
    rdCost: 0,
    weightDeltaKg: 0,
    nvhComfortScore: 0,
    reliabilityDeltaPercent: 0,
    description: 'Carcassa strutturale standard in alluminio pressofuso: solida, economica e affidabile.',
  },
  {
    id: 'AcousticDampedActiveNVH',
    name: 'Carcassa Silenziata con Supporti Attivi NVH',
    shortName: 'NVH Silenziata (+15 kg)',
    cost: 450,
    rdCost: 60,
    weightDeltaKg: +15.0,
    nvhComfortScore: +15,
    reliabilityDeltaPercent: +5,
    description: '+15 kg per doppia parete acustica e incapsulamento NVH: abbatte il fischio dell’inverter e riduce le micro-vibrazioni (+5% aff.).',
  },
  {
    id: 'MagnesiumCarbonUltralight',
    name: 'Magnesio e Carbonio Ultraleggero (Corsa)',
    shortName: 'Magnesio-Carbonio (-60% carcassa)',
    cost: 1100,
    rdCost: 150,
    weightDeltaKg: -7.5,
    nvhComfortScore: -12,
    reliabilityDeltaPercent: 0,
    description: 'Lega ultraleggera di magnesio e fondelli in carbonio (-60% peso carcassa rispetto all’alluminio), zero insonorizzazione.',
  },
  {
    id: 'ArmoredSealedIP69K',
    name: 'Carcassa Blindata Sigillata IP69K (Fuoristrada)',
    shortName: 'Blindata IP69K (+12 kg)',
    cost: 650,
    rdCost: 75,
    weightDeltaKg: +12.0,
    nvhComfortScore: +5,
    reliabilityDeltaPercent: +20,
    description: '+12 kg, protezione totale da fango, sabbia, rocce e guadi profondi ad alta pressione (+20% affidabilità).',
  },
];

export interface BatteryPackStructureSpec {
  id: BatteryPackStructure;
  name: string;
  shortName: string;
  weightMultiplier: number;
  cost: number;
  rdCost: number;
  description: string;
}

export const BATTERY_PACK_STRUCTURE_SPECS: BatteryPackStructureSpec[] = [
  {
    id: 'ModularAluminum',
    name: 'Moduli Standard con Busbar in Alluminio',
    shortName: 'Modulare Alluminio',
    weightMultiplier: 1.12, // +12% peso involucro
    cost: 0,
    rdCost: 0,
    description: 'Economico e modulare: scomparti sostituibili per facilitare la riparazione ma con peso strutturale maggiore.',
  },
  {
    id: 'CellToPackCopper',
    name: 'Cell-to-Pack (CTP) con Busbar in Rame',
    shortName: 'CTP Rame (-8% peso)',
    weightMultiplier: 0.92, // -8% peso
    cost: 850,
    rdCost: 60,
    description: 'Costo medio (-8% peso strutturale): elimina i telai dei moduli singoli, integrando le celle con busbar in rame.',
  },
  {
    id: 'CellToChassisCTC',
    name: 'Cell-to-Chassis Strutturale (CTC)',
    shortName: 'CTC Strutturale (-15% peso)',
    weightMultiplier: 0.85, // -15% peso
    cost: 2200,
    rdCost: 160,
    description: 'Premium (-15% peso): il pacco batteria funge da pianale strutturale dell’auto, elevatissima rigidità torsionale.',
  },
  {
    id: 'CarbonLaserSilverBusbar',
    name: 'Guscio Monoscocca in Carbonio + Busbar Rame Argentato Laser (Corsa)',
    shortName: 'Carbonio & Argento (-25% peso)',
    weightMultiplier: 0.75, // -25% peso
    cost: 5500,
    rdCost: 320,
    description: 'Costosissimo (-25% peso involucro): guscio in autoclave e busbar saldate al laser in rame argentato a minima resistenza.',
  },
];

export interface BmsCalibrationSpec {
  id: BmsCalibrationProfile;
  name: string;
  shortName: string;
  bufferPercent: number;
  maxCRateMultiplier: number;
  lifespanMultiplier: number;
  reliabilityDeltaPercent: number;
  dischargePowerMultiplier: number;
  description: string;
}

export const BMS_CALIBRATION_SPECS: BmsCalibrationSpec[] = [
  {
    id: 'ConservativeLongevity',
    name: 'Conservativa / Longevità (Buffer 12% - Scarica 1.5C)',
    shortName: 'Conservativa 1.5C',
    bufferPercent: 12,
    maxCRateMultiplier: 1.5,
    lifespanMultiplier: 1.5,
    reliabilityDeltaPercent: +15,
    dischargePowerMultiplier: 0.85,
    description: 'Massima durata e affidabilità (+15%): buffer 12%, scarica limitata a 1.5C per garantire oltre 500.000 km di vita.',
  },
  {
    id: 'RoadBalanced',
    name: 'Stradale Bilanciata (Buffer 8% - Scarica 3C)',
    shortName: 'Bilanciata 3C',
    bufferPercent: 8,
    maxCRateMultiplier: 3.0,
    lifespanMultiplier: 1.0,
    reliabilityDeltaPercent: 0,
    dischargePowerMultiplier: 1.0,
    description: 'Standard: buffer 8% e scarica fino a 3C, equilibrio ottimale per auto stradali di serie.',
  },
  {
    id: 'PerformanceSport',
    name: 'Performance / Sport (Buffer 4% - Scarica 5C)',
    shortName: 'Sport 5C (+20% kW)',
    bufferPercent: 4,
    maxCRateMultiplier: 5.0,
    lifespanMultiplier: 0.85,
    reliabilityDeltaPercent: -5,
    dischargePowerMultiplier: 1.20,
    description: '+20% potenza massima erogabile dalla batteria ai motori: buffer 4%, scarica fino a 5C (-15% durata km).',
  },
  {
    id: 'RaceExtreme',
    name: 'Qualifica / Corsa Estrema (Buffer 1% - Scarica 10C)',
    shortName: 'Qualifica 10C (+45% kW)',
    bufferPercent: 1,
    maxCRateMultiplier: 10.0,
    lifespanMultiplier: 0.50,
    reliabilityDeltaPercent: -15,
    dischargePowerMultiplier: 1.45,
    description: '+45% potenza di picco scaricabile (fino a 10C): alimenta hypercar da 1000+ CV anche con batterie compatte, vita utile ridotta.',
  },
];

export interface UnderbodyShieldSpec {
  id: UnderbodyShieldType;
  name: string;
  shortName: string;
  cost: number;
  rdCost: number;
  weightKg: number;
  reliabilityDeltaPercent: number;
  description: string;
}

export const UNDERBODY_SHIELD_SPECS: UnderbodyShieldSpec[] = [
  {
    id: 'StandardSteelShield',
    name: 'Lamiera Standard',
    shortName: 'Lamiera Std',
    cost: 0,
    rdCost: 0,
    weightKg: 0,
    reliabilityDeltaPercent: 0,
    description: 'Protezione base in alluminio/acciaio stampato per uso stradale quotidiano.',
  },
  {
    id: 'TitaniumKevlarIP69K',
    name: 'Piastra Ballistica Titanio/Kevlar IP69K (Fuoristrada/Rally)',
    shortName: 'Titanio/Kevlar (+18 kg)',
    cost: 850,
    rdCost: 45,
    weightKg: 18,
    reliabilityDeltaPercent: +22,
    description: '+18 kg, +costo: piastra in composito di titanio e aramide Kevlar anti-sfondamento (+22% affidabilità su terreni sconnessi).',
  },
];

export interface BenchMotorScalingSpec {
  motorCount: BenchElectricMotorCount;
  layoutId: MotorLayoutConfig;
  name: string;
  shortName: string;
  badge: string;
  multiplierLabel: string;
  totalOutputMultiplier: number;
  baseSystemEfficiencyPercent: number;
  consumptionPenaltyMultiplier: number;
  description: string;
}

export const BENCH_MOTOR_SCALING_CONFIGS: BenchMotorScalingSpec[] = [
  {
    motorCount: 1,
    layoutId: 'SingleMotor_RWD',
    name: '1x Singolo Motore (Scala 1.0x)',
    shortName: '1x Singolo (1.0x)',
    badge: '1× Motore',
    multiplierLabel: '1.0×',
    totalOutputMultiplier: 1.0,
    baseSystemEfficiencyPercent: 92.5,
    consumptionPenaltyMultiplier: 1.0,
    description: 'Singola unità motrice universale diretta (scala 1.0× potenza e coppia). Massima efficienza, zero trascinamento secondario.',
  },
  {
    motorCount: 2,
    layoutId: 'DualMotor_eAWD',
    name: '2x Dual-Motor (Scala 2.0x)',
    shortName: '2x Dual-Motor (2.0x)',
    badge: '2× Motori',
    multiplierLabel: '2.0×',
    totalOutputMultiplier: 2.0,
    baseSystemEfficiencyPercent: 88.2,
    consumptionPenaltyMultiplier: 1.085,
    description: 'Doppia unità motrice (scala lineare esatta 2.0× potenza e coppia). Spegnimento secondario ASM $0 o Dog-Clutch.',
  },
  {
    motorCount: 3,
    layoutId: 'TriMotor_TorqueVectoring',
    name: '3x Tri-Motor (Scala 3.0x)',
    shortName: '3x Tri-Motor (3.0x)',
    badge: '3× Motori',
    multiplierLabel: '3.0×',
    totalOutputMultiplier: 3.0,
    baseSystemEfficiencyPercent: 85.5,
    consumptionPenaltyMultiplier: 1.145,
    description: 'Tre unità motrici con Torque Vectoring (scala lineare esatta 3.0× potenza e coppia).',
  },
  {
    motorCount: 4,
    layoutId: 'QuadMotor_Independent',
    name: '4x Quad-Motor (Scala 4.0x)',
    shortName: '4x Quad-Motor (4.0x)',
    badge: '4× Motori',
    multiplierLabel: '4.0×',
    totalOutputMultiplier: 4.0,
    baseSystemEfficiencyPercent: 83.8,
    consumptionPenaltyMultiplier: 1.175,
    description: 'Quattro unità motrici e quattro inverter indipendenti, 1 per ruota (scala lineare esatta 4.0× potenza e coppia).',
  },
];

/**
 * Deriva automaticamente PriceTier e ReferenceClass per un motore elettrico
 * in base ai suoi componenti fisici interni.
 */
export function deriveElectricMotorTaxonomy(
  statorWinding?: StatorWindingType,
  inverter?: InverterPowerElectronicsType,
  rotorSleeve?: RotorSleeveBearingType,
  magnetMaterial?: RotorMagnetMaterialType,
  housing?: MotorHousingType,
): { priceTier: PriceTier; referenceClass: ReferenceClass } {
  let referenceClass: ReferenceClass = 'Normale';
  if (housing === 'ArmoredSealedIP69K') {
    referenceClass = 'Fuoristrada';
  } else if (housing === 'AcousticDampedActiveNVH') {
    referenceClass = 'Comfort';
  } else if (
    rotorSleeve === 'CarbonPrepregCeramic' ||
    inverter === 'Dual_SiC_GaN_Racing' ||
    statorWinding === 'LitzRacingWire'
  ) {
    referenceClass = 'Corsa';
  } else if (
    statorWinding === 'HairpinContinuousMultiLayer' ||
    inverter === 'SiliconCarbide_SiC' ||
    magnetMaterial === 'NeodymiumDyUH' ||
    magnetMaterial === 'SamariumCobaltRacing'
  ) {
    referenceClass = 'Sport';
  }

  let priceTier: PriceTier = 'Media';
  if (inverter === 'Dual_SiC_GaN_Racing' || rotorSleeve === 'CarbonPrepregCeramic') {
    priceTier = 'Lusso';
  } else if (inverter === 'SiliconCarbide_SiC' || statorWinding === 'HairpinContinuousMultiLayer') {
    priceTier = 'Premium';
  } else if (inverter === 'Silicon_IGBT' && statorWinding === 'RoundWireStandard') {
    priceTier = 'Economica';
  }

  return { priceTier, referenceClass };
}

/**
 * Deriva automaticamente PriceTier e ReferenceClass per un pacco batteria
 * in base alla sua architettura strutturale, BMS e protezione.
 */
export function deriveBatteryPackTaxonomy(
  structure?: BatteryPackStructure,
  bms?: BmsCalibrationProfile,
  shield?: UnderbodyShieldType,
): { priceTier: PriceTier; referenceClass: ReferenceClass } {
  let referenceClass: ReferenceClass = 'Normale';
  if (shield === 'TitaniumKevlarIP69K') {
    referenceClass = 'Fuoristrada';
  } else if (bms === 'RaceExtreme' || structure === 'CarbonLaserSilverBusbar') {
    referenceClass = 'Corsa';
  } else if (bms === 'PerformanceSport') {
    referenceClass = 'Sport';
  } else if (bms === 'ConservativeLongevity') {
    referenceClass = 'Comfort';
  }

  let priceTier: PriceTier = 'Media';
  if (structure === 'CarbonLaserSilverBusbar') {
    priceTier = 'Lusso';
  } else if (structure === 'CellToChassisCTC') {
    priceTier = 'Premium';
  } else if (structure === 'ModularAluminum' && bms === 'ConservativeLongevity') {
    priceTier = 'Economica';
  }

  return { priceTier, referenceClass };
}

/**
 * Punto 6: 3 Motori di Riferimento Base sempre disponibili per il test dei sistemi Ibridi
 * (oltre al Motore a Pistoni attuale in Tab 1A, al Motore Wankel attuale in Tab 1B e ai motori salvati nel DB).
 */
export const REFERENCE_HYBRID_ICE_ENGINES: CoupledIceEngineOption[] = [
  {
    id: 'ref-ice-i3-1500-atkinson',
    sourceKind: 'ReferencePreset',
    name: '1.5L 3-Cilindri Ciclo Atkinson (Rif. Citycar/HEV)',
    codeName: 'REF-15A-I3',
    propulsionType: 'Piston_1A',
    architectureLabel: '1.5L 3 Cil. in Linea Aspirato',
    displacementCc: 1496,
    displacementLiters: 1.5,
    cylindersOrRotors: 3,
    fuelType: 'Benzina',
    isTurbo: false,
    peakPowerHp: 115,
    peakPowerRpm: 5800,
    peakTorqueNm: 148,
    peakTorqueRpm: 3800,
    redlineRpm: 6400,
    dryWeightKg: 86,
    wetWeightKg: 95,
    dimensionsMm: { lengthMm: 390, widthMm: 510, heightMm: 580 },
    emissionsGPerKm: 108,
    reliabilityPercent: 92.5,
    estimatedLifespanKm: 310_000,
    unitProductionCost: 2_150,
    curve: [
      { rpm: 1000, torqueNm: 108, powerHp: 15 },
      { rpm: 1500, torqueNm: 122, powerHp: 26 },
      { rpm: 2000, torqueNm: 132, powerHp: 38 },
      { rpm: 2500, torqueNm: 139, powerHp: 50 },
      { rpm: 3000, torqueNm: 144, powerHp: 62 },
      { rpm: 3500, torqueNm: 147, powerHp: 73 },
      { rpm: 4000, torqueNm: 148, powerHp: 84 },
      { rpm: 4500, torqueNm: 145, powerHp: 93 },
      { rpm: 5000, torqueNm: 141, powerHp: 100 },
      { rpm: 5500, torqueNm: 137, powerHp: 107 },
      { rpm: 6000, torqueNm: 134, powerHp: 115 },
      { rpm: 6400, torqueNm: 122, powerHp: 111 },
    ],
    intendedOrientation: 'Trasversale',
  },
  {
    id: 'ref-ice-i4-2000-turbo',
    sourceKind: 'ReferencePreset',
    name: '2.0L 4-Cilindri Turbo GDI (Rif. Berlina/SUV)',
    codeName: 'REF-20T-I4',
    propulsionType: 'Piston_1A',
    architectureLabel: '2.0L 4 Cil. in Linea Turbo',
    displacementCc: 1998,
    displacementLiters: 2.0,
    cylindersOrRotors: 4,
    fuelType: 'Benzina',
    isTurbo: true,
    peakPowerHp: 255,
    peakPowerRpm: 5800,
    peakTorqueNm: 390,
    peakTorqueRpm: 2600,
    redlineRpm: 6800,
    dryWeightKg: 132,
    wetWeightKg: 145,
    dimensionsMm: { lengthMm: 465, widthMm: 580, heightMm: 620 },
    emissionsGPerKm: 154,
    reliabilityPercent: 87.0,
    estimatedLifespanKm: 245_000,
    unitProductionCost: 4_350,
    curve: [
      { rpm: 1000, torqueNm: 195, powerHp: 28 },
      { rpm: 1500, torqueNm: 275, powerHp: 59 },
      { rpm: 2000, torqueNm: 355, powerHp: 101 },
      { rpm: 2500, torqueNm: 390, powerHp: 139 },
      { rpm: 3000, torqueNm: 390, powerHp: 167 },
      { rpm: 3500, torqueNm: 388, powerHp: 193 },
      { rpm: 4000, torqueNm: 382, powerHp: 218 },
      { rpm: 4500, torqueNm: 372, powerHp: 238 },
      { rpm: 5000, torqueNm: 352, powerHp: 251 },
      { rpm: 5500, torqueNm: 324, powerHp: 254 },
      { rpm: 6000, torqueNm: 298, powerHp: 255 },
      { rpm: 6500, torqueNm: 265, powerHp: 245 },
      { rpm: 6800, torqueNm: 242, powerHp: 234 },
    ],
    intendedOrientation: 'Trasversale',
  },
  {
    id: 'ref-ice-v8-4000-biturbo',
    sourceKind: 'ReferencePreset',
    name: '4.0L V8 90° Twin-Turbo Hot-V (Rif. Supercar PHEV)',
    codeName: 'REF-40TT-V8',
    propulsionType: 'Piston_1A',
    architectureLabel: '4.0L V8 90° Bi-Turbo',
    displacementCc: 3982,
    displacementLiters: 4.0,
    cylindersOrRotors: 8,
    fuelType: 'Benzina',
    isTurbo: true,
    peakPowerHp: 640,
    peakPowerRpm: 6500,
    peakTorqueNm: 800,
    peakTorqueRpm: 3200,
    redlineRpm: 7500,
    dryWeightKg: 192,
    wetWeightKg: 210,
    dimensionsMm: { lengthMm: 585, widthMm: 710, heightMm: 650 },
    emissionsGPerKm: 248,
    reliabilityPercent: 81.5,
    estimatedLifespanKm: 165_000,
    unitProductionCost: 13_800,
    curve: [
      { rpm: 1000, torqueNm: 420, powerHp: 60 },
      { rpm: 1500, torqueNm: 540, powerHp: 115 },
      { rpm: 2000, torqueNm: 680, powerHp: 194 },
      { rpm: 2500, torqueNm: 765, powerHp: 272 },
      { rpm: 3000, torqueNm: 800, powerHp: 342 },
      { rpm: 3500, torqueNm: 800, powerHp: 399 },
      { rpm: 4000, torqueNm: 795, powerHp: 453 },
      { rpm: 4500, torqueNm: 785, powerHp: 503 },
      { rpm: 5000, torqueNm: 768, powerHp: 547 },
      { rpm: 5500, torqueNm: 745, powerHp: 584 },
      { rpm: 6000, torqueNm: 722, powerHp: 617 },
      { rpm: 6500, torqueNm: 691, powerHp: 640 },
      { rpm: 7000, torqueNm: 635, powerHp: 633 },
      { rpm: 7500, torqueNm: 565, powerHp: 603 },
    ],
    intendedOrientation: 'Longitudinale',
  },
];
