import {
  CHASSIS_STRUCTURES,
  SEGMENT_ERA_THRESHOLDS,
  type SegmentEraThreshold,
  VEHICLE_SEGMENT_LABELS,
} from '../data/chassisData';
import {
  type ChassisDrivetrainMode,
  type DimensionsLWH,
  type DualCurrencyCost,
  type EngineMountingPosition,
  type EngineOrientation,
  type GearboxLayoutType,
  type PriceTier,
  type ReferenceClass,
  type UniversalComponentTaxonomy,
  type VehicleSegment,
  calculateEstimatedDurabilityKm,
} from '../types/gameTypes';

export interface ChassisConfigInput {
  structureId: string;
  overallDimensionsMm: DimensionsLWH;
  wheelbaseMm: number;
  frontTrackMm: number;
  rearTrackMm: number;
  groundClearanceMm: number;
  /** Rinforzi torsionali / roll-structure integrata (0 - 100%) */
  rigidityReinforcementPercent: number;
  /** Livello zone a deformazione programmata & sicurezza passiva (0 - 100%) */
  safetyStructurePercent: number;
  /** Selezione singola esclusiva */
  supportedEnginePositions: EngineMountingPosition[];
  /** Selezione singola esclusiva */
  supportedEngineOrientations: EngineOrientation[];
  /** Grado arretramento motore verso l'abitacolo (0% = sbalzo estremo, 100% = arretramento massimo) */
  engineSetbackPercent: number;
  /** Modalità trazione nativa + predisposizione AWD */
  drivetrainMode: ChassisDrivetrainMode;
  /** Opzione Base FWD Longitudinale a sbalzo (solo Anteriore + Longitudinale con setback <= 35%) */
  allowLongitudinalFwd?: boolean;
  /** Schema scatola cambio */
  gearboxLayout: GearboxLayoutType;
  supportedDrivetrains: ('FWD' | 'RWD' | 'AWD')[];
  /** Offset manuale dimensioni vano motore rispetto al calcolo automatico (mm) */
  engineBayExtraLengthMm?: number;
  engineBayExtraWidthMm?: number;
  engineBayExtraHeightMm?: number;
}

export interface BayToleranceImpact {
  cargoVolumeDeltaLiters: number;
  weightDeltaKg: number;
  unitCostDelta: number;
  rigidityMultiplier: number;
  rigidityDeltaPercent: number;
  centerOfGravityDeltaMm: number;
}

export interface SegmentCalculationResult {
  segment: VehicleSegment;
  segmentLabel: string;
  thresholds: SegmentEraThreshold;
  reasoning: string;
}

export interface ChassisMetricsResult {
  segmentInfo: SegmentCalculationResult;
  engineBayMaxDimensionsMm: DimensionsLWH;
  torsionalRigidityNmPerDeg: number;
  structuralSafetyScore: number;
  baseWeightKg: number;
  estimatedFrontWeightPercent: number;
  estimatedRearWeightPercent: number;
  estimatedWeightDistribution2WD: { frontPercent: number; rearPercent: number };
  estimatedWeightDistributionAWD: { frontPercent: number; rearPercent: number } | null;
  awdSystemWeightKg: number;
  resolvedDrivetrains: ('FWD' | 'RWD' | 'AWD')[];
  nativePrimaryAxle: 'FWD' | 'RWD';
  hasAwdReady: boolean;
  effectiveGearboxLayout: GearboxLayoutType;
  cargoVolumeDeltaLiters: number;
  centerOfGravityDeltaMm: number;
  bayToleranceImpact: BayToleranceImpact;
  frontOverhangMm: number;
  rearOverhangMm: number;
  unitManufacturingCost: number;
  developmentCost: DualCurrencyCost;
  taxonomy: UniversalComponentTaxonomy;
}

export function getSegmentThresholdsForYear(year: number): SegmentEraThreshold {
  let matched = SEGMENT_ERA_THRESHOLDS[0];
  for (const t of SEGMENT_ERA_THRESHOLDS) {
    if (year >= t.minYear) {
      matched = t;
    }
  }
  return matched;
}

/**
 * Algoritmo di calcolo automatico del Segmento Auto
 * confrontando le dimensioni del pianale con gli standard storici dell'anno corrente.
 */
export function calculateVehicleSegment(params: {
  overallDimensionsMm: DimensionsLWH;
  wheelbaseMm: number;
  groundClearanceMm: number;
  isBodyOnFrame?: boolean;
  currentYear: number;
  supportedEnginePositions: EngineMountingPosition[];
}): SegmentCalculationResult {
  const {
    overallDimensionsMm,
    groundClearanceMm,
    isBodyOnFrame,
    currentYear,
    supportedEnginePositions,
  } = params;

  const thresholds = getSegmentThresholdsForYear(currentYear);
  const { lengthMm, heightMm } = overallDimensionsMm;

  // 1. Pickup / Commerciale pesante (longheroni + lunghezza elevata + luce a terra alta)
  if (
    (isBodyOnFrame && lengthMm >= 4750 && groundClearanceMm >= 185) ||
    (lengthMm >= 5180 && groundClearanceMm >= 190)
  ) {
    return {
      segment: 'M_Pickup',
      segmentLabel: VEHICLE_SEGMENT_LABELS.M_Pickup,
      thresholds,
      reasoning: `Telaio alto (${groundClearanceMm} mm da terra) e passo lungo su scocca da ${lengthMm} mm.`,
    };
  }

  // 2. SUV / Fuoristrada (altezza complessiva e altezza da terra sopra soglia dell'epoca)
  if (
    heightMm >= thresholds.suvMinHeightMm &&
    groundClearanceMm >= thresholds.suvMinGroundClearanceMm
  ) {
    return {
      segment: 'J_SUV',
      segmentLabel: VEHICLE_SEGMENT_LABELS.J_SUV,
      thresholds,
      reasoning: `Altezza ${heightMm} mm (≥ ${thresholds.suvMinHeightMm} mm) e luce a terra ${groundClearanceMm} mm (≥ ${thresholds.suvMinGroundClearanceMm} mm) per gli standard ${thresholds.eraLabel}.`,
    };
  }

  // 3. Sportiva / Supercar (assetto molto basso o motore centrale-posteriore)
  const isMidEngine = supportedEnginePositions.includes('Centrale-Posteriore');
  const isRearSport =
    supportedEnginePositions.includes('Posteriore') &&
    !supportedEnginePositions.includes('Anteriore') &&
    heightMm <= thresholds.sportMaxHeightMm + 45;

  if (heightMm <= thresholds.sportMaxHeightMm || isMidEngine || isRearSport) {
    return {
      segment: 'S',
      segmentLabel: VEHICLE_SEGMENT_LABELS.S,
      thresholds,
      reasoning: isMidEngine
        ? `Architettura a motore Centrale-Posteriore e profilo ribassato (${heightMm} mm).`
        : `Altezza padiglione ribassata (${heightMm} mm ≤ ${thresholds.sportMaxHeightMm} mm) per gli standard ${thresholds.eraLabel}.`,
    };
  }

  // 4. Segmenti tradizionali A -> F in base alla lunghezza dell'epoca storica
  let segment: VehicleSegment = 'F';
  if (lengthMm <= thresholds.maxLengthA) {
    segment = 'A';
  } else if (lengthMm <= thresholds.maxLengthB) {
    segment = 'B';
  } else if (lengthMm <= thresholds.maxLengthC) {
    segment = 'C';
  } else if (lengthMm <= thresholds.maxLengthD) {
    segment = 'D';
  } else if (lengthMm <= thresholds.maxLengthE) {
    segment = 'E';
  }

  return {
    segment,
    segmentLabel: VEHICLE_SEGMENT_LABELS[segment],
    thresholds,
    reasoning: `Lunghezza ${lengthMm} mm confrontata con le soglie dimensionali dell'epoca ${thresholds.eraLabel}.`,
  };
}

export function resolveChassisLayoutRules(params: {
  position: EngineMountingPosition;
  orientation: EngineOrientation;
  engineSetbackPercent: number;
  drivetrainMode: ChassisDrivetrainMode;
  allowLongitudinalFwd?: boolean;
  gearboxLayout: GearboxLayoutType;
}): {
  nativePrimaryAxle: 'FWD' | 'RWD';
  canUseLongitudinalFwd: boolean;
  hasAwdReady: boolean;
  allowedDrivetrainModes: ChassisDrivetrainMode[];
  effectiveDrivetrainMode: ChassisDrivetrainMode;
  resolvedDrivetrains: ('FWD' | 'RWD' | 'AWD')[];
  canUseTransaxle: boolean;
  canUseMidTunnel: boolean;
  effectiveGearboxLayout: GearboxLayoutType;
} {
  const { position, orientation, engineSetbackPercent, drivetrainMode, allowLongitudinalFwd, gearboxLayout } =
    params;

  const canUseLongitudinalFwd =
    position === 'Anteriore' && orientation === 'Longitudinale' && engineSetbackPercent <= 35;

  const isFrontMidTransverse =
    position === 'Anteriore-Centrale' && orientation === 'Trasversale';
  const isFrontTransverse =
    position === 'Anteriore' && orientation === 'Trasversale';

  let allowedDrivetrainModes: ChassisDrivetrainMode[];
  let defaultDrivetrainMode: ChassisDrivetrainMode;

  if (isFrontMidTransverse) {
    // Anteriore-Centrale + Trasversale: abilita FWD_Only, FWD_AWD_Ready (oltre a RWD_AWD_Ready), fallback predefinito FWD_Only
    allowedDrivetrainModes = ['FWD_Only', 'FWD_AWD_Ready', 'RWD_AWD_Ready'];
    defaultDrivetrainMode = 'FWD_Only';
  } else if (isFrontTransverse || (canUseLongitudinalFwd && allowLongitudinalFwd)) {
    allowedDrivetrainModes = ['FWD_Only', 'FWD_AWD_Ready'];
    defaultDrivetrainMode = 'FWD_Only';
  } else {
    allowedDrivetrainModes = ['RWD_Only', 'RWD_AWD_Ready'];
    defaultDrivetrainMode = 'RWD_Only';
  }

  const effectiveDrivetrainMode = allowedDrivetrainModes.includes(drivetrainMode)
    ? drivetrainMode
    : defaultDrivetrainMode;

  let nativePrimaryAxle: 'FWD' | 'RWD' = 'RWD';
  if (isFrontTransverse || isFrontMidTransverse) {
    nativePrimaryAxle = 'FWD';
  } else if (canUseLongitudinalFwd && allowLongitudinalFwd) {
    nativePrimaryAxle = 'FWD';
  } else {
    nativePrimaryAxle = 'RWD';
  }

  const hasAwdReady =
    effectiveDrivetrainMode === 'FWD_AWD_Ready' ||
    effectiveDrivetrainMode === 'RWD_AWD_Ready';
  const resolvedDrivetrains: ('FWD' | 'RWD' | 'AWD')[] = hasAwdReady
    ? [nativePrimaryAxle, 'AWD']
    : [nativePrimaryAxle];

  const canUseTransaxle =
    nativePrimaryAxle === 'RWD' &&
    (position === 'Anteriore' || position === 'Anteriore-Centrale');
  const canUseMidTunnel = position === 'Centrale-Posteriore';

  let effectiveGearboxLayout: GearboxLayoutType = 'InBlockWithEngine';
  if (gearboxLayout === 'RearTransaxleTorqueTube' && canUseTransaxle) {
    effectiveGearboxLayout = 'RearTransaxleTorqueTube';
  } else if (gearboxLayout === 'MidCentralTunnel' && canUseMidTunnel) {
    effectiveGearboxLayout = 'MidCentralTunnel';
  }

  return {
    nativePrimaryAxle,
    canUseLongitudinalFwd,
    hasAwdReady,
    allowedDrivetrainModes,
    effectiveDrivetrainMode,
    resolvedDrivetrains,
    canUseTransaxle,
    canUseMidTunnel,
    effectiveGearboxLayout,
  };
}

/**
 * Calcola tutte le metriche strutturali, le quote reali del vano motore,
 * la distribuzione pesi stimata e i costi di sviluppo/produzione del pianale.
 */
export function calculateChassisMetrics(
  config: ChassisConfigInput,
  currentYear: number,
): ChassisMetricsResult {
  const structure =
    CHASSIS_STRUCTURES.find((s) => s.id === config.structureId) ?? CHASSIS_STRUCTURES[0];

  const { lengthMm, widthMm, heightMm } = config.overallDimensionsMm;
  const primaryPos: EngineMountingPosition = config.supportedEnginePositions[0] ?? 'Anteriore';
  const primaryOri: EngineOrientation = config.supportedEngineOrientations[0] ?? 'Longitudinale';

  const layoutRules = resolveChassisLayoutRules({
    position: primaryPos,
    orientation: primaryOri,
    engineSetbackPercent: config.engineSetbackPercent,
    drivetrainMode: config.drivetrainMode,
    allowLongitudinalFwd: config.allowLongitudinalFwd,
    gearboxLayout: config.gearboxLayout,
  });

  // Sbalzi complessivi (divisi tra anteriore e posteriore in base al layout motore)
  const totalOverhang = Math.max(800, lengthMm - config.wheelbaseMm);
  const hasFrontEngine = primaryPos === 'Anteriore' || primaryPos === 'Anteriore-Centrale';
  const hasMidOrRear = primaryPos === 'Centrale-Posteriore' || primaryPos === 'Posteriore';

  const frontOverhangRatio = hasFrontEngine && !hasMidOrRear ? 0.48 : hasMidOrRear && !hasFrontEngine ? 0.44 : 0.46;
  const frontOverhangMm = Math.round(totalOverhang * frontOverhangRatio);
  const rearOverhangMm = totalOverhang - frontOverhangMm;

  // Calcolo fisico del Vano Motore in base a Carreggiata dedicata all'asse, Passo, Sbalzo anteriore, Arretramento e Altezza
  const isTransverse = primaryOri === 'Trasversale';
  const isLongitudinal = primaryOri === 'Longitudinale';

  // Lunghezza utile vano (fronte-retro):
  // Cresce sia con il Passo (wheelbaseMm -> maggiore distanza dash-to-axle / spazio interasse)
  // sia con lo Sbalzo anteriore / Lunghezza totale della scocca (lengthMm), orientamento, setback e transaxle.
  let baseBayLength = 540;
  if (primaryPos === 'Centrale-Posteriore') {
    baseBayLength = Math.round(
      config.wheelbaseMm * 0.24 +
        lengthMm * 0.06 +
        (isLongitudinal ? 60 : 10) +
        (config.engineSetbackPercent / 100) * 55,
    );
  } else if (primaryPos === 'Posteriore') {
    baseBayLength = Math.round(
      config.wheelbaseMm * 0.11 +
        lengthMm * 0.075 +
        (isLongitudinal ? 80 : 15) +
        (config.engineSetbackPercent / 100) * 65,
    );
  } else if (isLongitudinal) {
    const frontMidBonus = primaryPos === 'Anteriore-Centrale' ? 28 : 0;
    const transaxleBayBonus =
      layoutRules.effectiveGearboxLayout === 'RearTransaxleTorqueTube' ? 55 : 0;
    baseBayLength = Math.round(
      config.wheelbaseMm * 0.18 +
        frontOverhangMm * 0.32 +
        95 +
        frontMidBonus +
        (config.engineSetbackPercent / 100) * 135 +
        transaxleBayBonus,
    );
  } else {
    const frontMidBonus = primaryPos === 'Anteriore-Centrale' ? 45 : 0;
    baseBayLength = Math.round(
      config.wheelbaseMm * 0.18 +
        lengthMm * 0.045 -
        85 +
        frontMidBonus +
        (config.engineSetbackPercent / 100) * 140,
    );
  }

  // Larghezza utile tra i duomi / longheroni (solo asse dedicato: zero contaminazione tra avantreno e retrotreno)
  const usesRearAxleBay = hasMidOrRear && !hasFrontEngine;
  const trackForBay = usesRearAxleBay ? config.rearTrackMm : config.frontTrackMm;
  const bayWidthTrackCoeff = usesRearAxleBay
    ? isTransverse && !isLongitudinal
      ? 0.54
      : 0.59
    : isTransverse && !isLongitudinal
      ? 0.49
      : 0.525;
  const baseBayWidth = Math.round(
    trackForBay * bayWidthTrackCoeff + (widthMm - trackForBay) * 0.14,
  );

  // Altezza utile sotto cofano / vano (base minima duomi sospensioni + ~32% della variazione altezza corpo)
  const bayHeightBaseMm =
    primaryPos === 'Centrale-Posteriore' ? 339 : primaryPos === 'Posteriore' ? 245 : 242;
  const baseBayHeight = Math.round(
    bayHeightBaseMm + (heightMm - config.groundClearanceMm) * 0.32,
  );

  const extraL = config.engineBayExtraLengthMm ?? 0;
  const extraW = config.engineBayExtraWidthMm ?? 0;
  const extraH = config.engineBayExtraHeightMm ?? 0;

  const engineBayMaxDimensionsMm: DimensionsLWH = {
    lengthMm: Math.max(420, Math.min(1250, baseBayLength + extraL)),
    widthMm: Math.max(480, Math.min(1150, baseBayWidth + extraW)),
    heightMm: Math.max(460, Math.min(980, baseBayHeight + extraH)),
  };

  // Punto 4: Conseguenze fisiche reali degli slider Tolleranza Vano L / W / H
  const bayToleranceImpact: BayToleranceImpact = {
    cargoVolumeDeltaLiters: Number((-(extraL / 10) * 4.5).toFixed(1)),
    weightDeltaKg: Number(((extraL / 10) * 2.2 + (extraH / 10) * 1.2).toFixed(1)),
    unitCostDelta: Math.round((extraL / 10) * 35 + (extraW / 10) * 45),
    rigidityMultiplier: Math.max(0.65, 1 - (extraW / 10) * 0.018),
    rigidityDeltaPercent: Number((-(extraW / 10) * 1.8).toFixed(1)),
    centerOfGravityDeltaMm: Number(((extraH / 10) * 3.5).toFixed(1)),
  };

  // Punto 1: Curva rinforzo continua (logaritmica oltre 35% per Spaceframe Alluminio) + sezione chiusa e passo continuo
  const r = config.rigidityReinforcementPercent;
  const reinforcementGain =
    structure.usesDiminishingReinforcement && r > 35
      ? 1.32 * 0.35 + 0.60 * Math.log1p((r - 35) / 22)
      : (r / 100) * 1.32;
  const reinforcementMultiplier = 0.90 + reinforcementGain;
  const safetyCellRigidityBonus = 1 + (config.safetyStructurePercent / 100) * 0.20;

  const wheelbaseRigidityFactor = Math.pow(2650 / config.wheelbaseMm, 0.42);
  const cabinHeightMm = Math.max(850, heightMm - config.groundClearanceMm);
  const crossSectionHeightFactor = structure.isBodyOnFrame
    ? Math.pow(1680 / 1300, 0.65) * Math.pow(cabinHeightMm / 1680, 0.20)
    : Math.pow(cabinHeightMm / 1300, 0.65);
  const crossSectionFactor =
    Math.pow(widthMm / 1820, 0.75) * crossSectionHeightFactor;
  const rawEraJoining = 0.80 + 0.20 / (1 + Math.exp(-(currentYear - 1986) / 4.0));
  const usesDiscreteFrameEra = Boolean(structure.isBodyOnFrame || structure.maxSupportedTorqueNm);
  const eraRigidityFactor = usesDiscreteFrameEra
    ? 1 + (rawEraJoining - 1) * 0.30
    : rawEraJoining;
  const clearancePenalty = Math.max(
    0.82,
    1 - Math.max(0, config.groundClearanceMm - 140) * 0.0020,
  );
  const awdTunnelBonus = layoutRules.hasAwdReady ? 1.04 : 1.0;
  const transaxleRigidityBonus =
    layoutRules.effectiveGearboxLayout === 'RearTransaxleTorqueTube' ? 1.04 : 1.0;

  const torsionalRigidityNmPerDeg = Math.round(
    structure.baseRigidityNmPerDeg *
      wheelbaseRigidityFactor *
      crossSectionFactor *
      eraRigidityFactor *
      reinforcementMultiplier *
      safetyCellRigidityBonus *
      clearancePenalty *
      awdTunnelBonus *
      transaxleRigidityBonus *
      bayToleranceImpact.rigidityMultiplier,
  );

  // Sicurezza passiva (0 - 100) con cap per materiale (Spaceframe Alu < UHSS)
  const eraSafetyExpectation =
    currentYear < 1985 ? 5 : currentYear < 2000 ? 0 : currentYear < 2015 ? -3 : -6;
  const safetyCap = structure.maxSafetyScoreCap ?? 99;
  const safetyGainScale = structure.usesDiminishingReinforcement ? 0.65 : 1.0;
  const structuralSafetyScore = Math.max(
    25,
    Math.min(
      safetyCap,
      Math.round(
        structure.baseSafetyScore +
          (config.safetyStructurePercent / 100) * 14 * safetyGainScale +
          (config.rigidityReinforcementPercent / 100) * 4 * safetyGainScale +
          eraSafetyExpectation,
      ),
    ),
  );

  // Massa base del pianale (kg): nucleo telaietti/longheroni + guscio 3D multi-dimensionale + tunnel trasmissione + rinforzi
  const volumeIndex = (lengthMm * widthMm) / (4500 * 1820);
  const avgTrackMm = (config.frontTrackMm + config.rearTrackMm) / 2;
  const dimensionalMassIndex =
    0.55 * volumeIndex +
    0.30 * (config.wheelbaseMm / 2700) +
    0.12 * (heightMm / 1450) +
    0.03 * (avgTrackMm / 1550);
  const coreSubframeKg = structure.isBodyOnFrame
    ? 128
    : structure.weightMultiplier <= 0.65
      ? 54
      : 9;
  const awdTunnelWeightAdd = layoutRules.hasAwdReady ? 17 : 0;
  const rwdTunnelWeightAdd =
    config.drivetrainMode.startsWith('RWD') &&
    hasFrontEngine &&
    layoutRules.effectiveGearboxLayout !== 'RearTransaxleTorqueTube'
      ? 24
      : 0;
  const torqueTubeWeightAdd =
    layoutRules.effectiveGearboxLayout === 'RearTransaxleTorqueTube' ? 50 : 0;
  const reinforcementMassMaterialScale = structure.weightMultiplier <= 0.50 ? 0.12 : 1.0;
  const reinforcementWeightAdd =
    ((config.rigidityReinforcementPercent / 100) * 16 * reinforcementMassMaterialScale +
      (config.safetyStructurePercent / 100) * 51) *
    (0.16 + 0.84 * structure.weightMultiplier);

  const baseWeightKg = Math.round(
    coreSubframeKg +
      205 * dimensionalMassIndex * structure.weightMultiplier +
      awdTunnelWeightAdd +
      rwdTunnelWeightAdd +
      torqueTubeWeightAdd +
      reinforcementWeightAdd +
      bayToleranceImpact.weightDeltaKg,
  );

  // Punto 3: Impatto reale Trazione e Schema Cambio sul bilanciamento pesi (% Ant / % Post)
  let baseFrontBias = 54;
  if (primaryPos === 'Centrale-Posteriore') {
    baseFrontBias = 42.5;
  } else if (primaryPos === 'Posteriore') {
    baseFrontBias = 38.5;
  } else if (primaryPos === 'Anteriore-Centrale') {
    baseFrontBias = 51.0;
  } else if (isTransverse) {
    baseFrontBias = 59.0;
  } else if (layoutRules.nativePrimaryAxle === 'FWD') {
    // FWD Longitudinale a sbalzo (stile Audi)
    baseFrontBias = 60.5;
  }

  const setbackShift = (config.engineSetbackPercent - 50) * 0.08;
  let front2WD = baseFrontBias - setbackShift;

  if (layoutRules.effectiveGearboxLayout === 'RearTransaxleTorqueTube') {
    // Sposta il 6% del peso dall'anteriore al posteriore
    front2WD -= 6.0;
  } else if (layoutRules.effectiveGearboxLayout === 'MidCentralTunnel') {
    // Accentra le masse migliorando il bilanciamento del 3.5% verso il centro (50%)
    front2WD += front2WD < 50 ? 3.5 : -3.5;
  }

  const frontPercent2WD = Math.max(33, Math.min(65, Number(front2WD.toFixed(1))));
  const rearPercent2WD = Number((100 - frontPercent2WD).toFixed(1));
  const estimatedWeightDistribution2WD = {
    frontPercent: frontPercent2WD,
    rearPercent: rearPercent2WD,
  };

  let estimatedWeightDistributionAWD: { frontPercent: number; rearPercent: number } | null = null;
  if (layoutRules.hasAwdReady) {
    // Assetto AWD completo (+85 kg): sposta +2.5% verso l'asse secondario (se Base FWD -> +2.5% post / -2.5% ant)
    // o +3.5% verso l'anteriore (se Base RWD -> +3.5% ant / -3.5% post)
    const awdFrontShift = layoutRules.nativePrimaryAxle === 'FWD' ? -2.5 : 3.5;
    const frontAWD = Math.max(35, Math.min(65, Number((frontPercent2WD + awdFrontShift).toFixed(1))));
    estimatedWeightDistributionAWD = {
      frontPercent: frontAWD,
      rearPercent: Number((100 - frontAWD).toFixed(1)),
    };
  }

  // Delta volume abitacolo/bagagliaio (L) da tunnel AWD, Transaxle e Tolleranza Vano L
  const awdTunnelVolumeDelta = layoutRules.hasAwdReady
    ? primaryPos === 'Anteriore' && isTransverse
      ? -18
      : -22
    : 0;
  const gearboxVolumeDelta =
    layoutRules.effectiveGearboxLayout === 'RearTransaxleTorqueTube' ? -35 : 0;
  const cargoVolumeDeltaLiters = Number(
    (awdTunnelVolumeDelta + gearboxVolumeDelta + bayToleranceImpact.cargoVolumeDeltaLiters).toFixed(1),
  );

  // Segmento automatico
  const segmentInfo = calculateVehicleSegment({
    overallDimensionsMm: config.overallDimensionsMm,
    wheelbaseMm: config.wheelbaseMm,
    groundClearanceMm: config.groundClearanceMm,
    isBodyOnFrame: structure.isBodyOnFrame,
    currentYear,
    supportedEnginePositions: [primaryPos],
  });

  // Costi unitari e R&D
  const gearboxUnitCost =
    layoutRules.effectiveGearboxLayout === 'RearTransaxleTorqueTube'
      ? 1_150
      : layoutRules.effectiveGearboxLayout === 'MidCentralTunnel'
        ? 800
        : 0;

  const unitManufacturingCost = Math.max(
    900,
    Math.round(
      structure.baseManufacturingCost * (0.75 + 0.25 * volumeIndex) +
        (config.rigidityReinforcementPercent / 100) * 480 +
        (config.safetyStructurePercent / 100) * 420 +
        (layoutRules.hasAwdReady ? 350 : 0) +
        gearboxUnitCost +
        bayToleranceImpact.unitCostDelta,
    ),
  );

  const awdRdMultiplier = layoutRules.hasAwdReady
    ? primaryPos === 'Anteriore' && isTransverse
      ? 1.08
      : 1.10
    : 1.0;

  const developmentCost: DualCurrencyCost = {
    capitalCost: Math.round(
      structure.devCapitalCost *
        (0.85 + 0.15 * volumeIndex) *
        (1 + (config.rigidityReinforcementPercent + config.safetyStructurePercent) / 600) *
        awdRdMultiplier,
    ),
    rdCost: Math.round(
      structure.devRdPoints *
        (1 + (config.rigidityReinforcementPercent + config.safetyStructurePercent) / 500) *
        awdRdMultiplier,
    ),
    minYear: structure.minYear,
  };

  // Tassonomia derivata
  const priceTier: PriceTier =
    unitManufacturingCost >= 14_000
      ? 'Lusso'
      : unitManufacturingCost >= 5_500
        ? 'Premium'
        : unitManufacturingCost >= 3_000
          ? 'Media'
          : 'Economica';

  const referenceClass: ReferenceClass =
    segmentInfo.segment === 'S'
      ? 'Corsa'
      : segmentInfo.segment === 'J_SUV' || segmentInfo.segment === 'M_Pickup'
        ? 'Fuoristrada'
        : torsionalRigidityNmPerDeg >= 30_000
          ? 'Sport'
          : structuralSafetyScore >= 82
            ? 'Comfort'
            : 'Normale';

  const taxonomy: UniversalComponentTaxonomy = {
    priceTier,
    referenceClass,
    materialStress: {
      materialName: structure.name,
      materialResistanceFactor: structure.materialResistanceFactor,
      mechanicalStressFactor: structure.mechanicalStressFactor,
    },
    estimatedDurabilityKm: calculateEstimatedDurabilityKm(
      priceTier,
      referenceClass,
      structure.materialResistanceFactor,
      structure.mechanicalStressFactor,
    ),
  };

  return {
    segmentInfo,
    engineBayMaxDimensionsMm,
    torsionalRigidityNmPerDeg,
    structuralSafetyScore,
    baseWeightKg,
    estimatedFrontWeightPercent: estimatedWeightDistribution2WD.frontPercent,
    estimatedRearWeightPercent: estimatedWeightDistribution2WD.rearPercent,
    estimatedWeightDistribution2WD,
    estimatedWeightDistributionAWD,
    awdSystemWeightKg: 85,
    resolvedDrivetrains: layoutRules.resolvedDrivetrains,
    nativePrimaryAxle: layoutRules.nativePrimaryAxle,
    hasAwdReady: layoutRules.hasAwdReady,
    effectiveGearboxLayout: layoutRules.effectiveGearboxLayout,
    cargoVolumeDeltaLiters,
    centerOfGravityDeltaMm: bayToleranceImpact.centerOfGravityDeltaMm,
    bayToleranceImpact,
    frontOverhangMm,
    rearOverhangMm,
    unitManufacturingCost,
    developmentCost,
    taxonomy,
  };
}

