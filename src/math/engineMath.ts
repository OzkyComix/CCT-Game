import {
  BLOCK_MATERIALS,
  CAMSHAFT_TYPES,
  CATALYST_ERAS,
  CONROD_TYPES,
  CRANKSHAFT_TYPES,
  EXHAUST_MANIFOLDS,
  FUEL_SYSTEMS,
  HEAD_MATERIALS,
  INTAKE_SYSTEMS,
  PISTON_ARCHITECTURES,
  PISTON_TYPES,
  TURBO_COUNT_CONFIGS,
  TURBO_POSITIONS,
  TURBO_SYSTEMS,
} from '../data/historicalEras';
import {
  type CatalystEra,
  type DimensionsLWH,
  type DualCurrencyCost,
  type DynoCurvePoint,
  type EngineDynoTelemetry,
  type EngineOrientation,
  type KnockWarningInfo,
  type PistonArchitecture,
  type PriceTier,
  type ReferenceClass,
  type TurboCountConfig,
  type TurboPosition,
  type TurboType,
  calculateEstimatedDurabilityKm,
} from '../types/gameTypes';
import { calculateOrientationMechanicalAdaptation } from './volumeMath';

export interface PistonEngineConfigInput {
  architecture: PistonArchitecture;
  bankAngleDeg: number;
  cylinders: number;
  boreMm: number;
  strokeMm: number;
  valvesPerCylinder: number;
  compressionRatio: number;
  manualRedlineRpm: number;
  blockMaterialId: string;
  headMaterialId: string;
  pistonTypeId: string;
  conrodTypeId: string;
  crankshaftTypeId: string;
  camshaftTypeId: string;
  fuelType: 'Benzina' | 'Diesel' | 'BioFuel' | 'RaceFuel';
  fuelSystemId: string;
  intakeSystemId: string;
  exhaustManifoldId: string;
  turboType: TurboType;
  turboCountConfig: TurboCountConfig;
  turboBearingType: 'Journal' | 'BallBearing';
  turboArRatio: number;
  /** Diametro/A/R individuale per ciascuna turbina (Single=1, Twin=2, Triple=3, Quad=4) */
  turboStagesArRatios: number[];
  boostPressureBar: number;
  turboPosition: TurboPosition;
  catalystEra: CatalystEra;
  intendedOrientation: EngineOrientation;
  nativeOrientation?: EngineOrientation;
  priceTier: PriceTier;
  referenceClass: ReferenceClass;
}

export interface PistonGeometryMetrics {
  unitDisplacementCc: number;
  totalDisplacementCc: number;
  displacementLiters: number;
  strokeBoreRatio: number;
  geometryTypeLabel:
    | 'Superquadro (Corsa Corta)'
    | 'Quadro (Bilanciato)'
    | 'Sottoquadro (Corsa Lunga)';
  dimensionsMm: DimensionsLWH;
}

/** Converte il rapporto A/R (0.35 - 1.40) in diametro girante compressore in millimetri (mm) */
export function arRatioToImpellerMm(arRatio: number): number {
  return Math.round(30 + arRatio * 44);
}

/** Restituisce l'array normalizzato dei rapporti A/R per il numero effettivo di turbine attive */
export function getActiveTurboStagesAr(config: PistonEngineConfigInput): number[] {
  const countSpec =
    TURBO_COUNT_CONFIGS.find((tc) => tc.id === config.turboCountConfig) ??
    TURBO_COUNT_CONFIGS[0];
  const n = countSpec.turbineCount;
  const raw = config.turboStagesArRatios ?? [];
  const result: number[] = [];
  for (let i = 0; i < n; i++) {
    result.push(
      raw[i] !== undefined
        ? Math.min(1.4, Math.max(0.35, raw[i]))
        : Math.min(1.4, Math.max(0.35, config.turboArRatio || 0.65)),
    );
  }
  return result;
}

/**
 * Calcola il limite fisico meccanico massimo di rotazione (RPM di rottura)
 * mantenendo la formula identica a prima ma alzando il tetto massimo da 11.000 a 13.000 rpm.
 */
export function calculateMaxSafeMechanicalRpm(config: PistonEngineConfigInput): number {
  const blockSpec =
    BLOCK_MATERIALS.find((b) => b.id === config.blockMaterialId) ?? BLOCK_MATERIALS[0];
  const headSpec =
    HEAD_MATERIALS.find((h) => h.id === config.headMaterialId) ?? HEAD_MATERIALS[0];
  const pistonSpec =
    PISTON_TYPES.find((p) => p.id === config.pistonTypeId) ?? PISTON_TYPES[0];
  const conrodSpec =
    CONROD_TYPES.find((r) => r.id === config.conrodTypeId) ?? CONROD_TYPES[0];
  const crankSpec =
    CRANKSHAFT_TYPES.find((c) => c.id === config.crankshaftTypeId) ?? CRANKSHAFT_TYPES[0];
  const camSpec =
    CAMSHAFT_TYPES.find((c) => c.id === config.camshaftTypeId) ?? CAMSHAFT_TYPES[2];

  const isDiesel = config.fuelType === 'Diesel';
  const baseCriticalPistonSpeedMs = isDiesel ? 16.5 : 21.0;
  const strokeBasedRpm = Math.round((baseCriticalPistonSpeedMs * 30_000) / config.strokeMm);

  const valveTrainRpmBonus =
    camSpec.id === 'cam-ohv' ? -400 : (config.valvesPerCylinder - 2) * 180;

  let archRpmBonus = 0;
  if (config.architecture === 'Boxer') {
    archRpmBonus = 300;
  } else if (config.architecture === 'V' && config.bankAngleDeg > 15) {
    archRpmBonus = 150;
  } else if (config.architecture === 'Inline' && config.cylinders > 6) {
    archRpmBonus = -350;
  }

  const componentRpmDelta =
    blockSpec.rpmDelta +
    headSpec.rpmDelta +
    pistonSpec.rpmDelta +
    conrodSpec.rpmDelta +
    crankSpec.rpmDelta +
    camSpec.rpmDelta +
    valveTrainRpmBonus +
    archRpmBonus;

  const rawMaxRpm =
    strokeBasedRpm + (isDiesel ? componentRpmDelta * 0.42 : componentRpmDelta);

  const nonDieselCapRpm = config.referenceClass === 'Corsa' ? 21000 : 14500;

  return Math.min(
    isDiesel ? 5800 : nonDieselCapRpm,
    Math.max(isDiesel ? 3600 : 4600, Math.round(rawMaxRpm / 100) * 100),
  );
}

/**
 * Calcola la soglia di Detonazione (Knock / Battito in testa) in funzione di:
 * - Rapporto di Compressione (CR)
 * - Numero di ottani del carburante (Benzina vs BioFuel E85 vs RaceFuel 102 RON)
 * - Raffreddamento in camera (Iniezione Diretta GDI e conducibilità termica testata)
 * - Pressione di sovralimentazione (Boost in bar)
 */
export function evaluateCompressionAndKnock(config: PistonEngineConfigInput): KnockWarningInfo {
  if (config.fuelType === 'Diesel') {
    const maxSafeDieselCr =
      config.turboType === 'NaturallyAspirated'
        ? 22.0
        : Math.max(14.5, Number((20.8 - config.boostPressureBar * 1.25).toFixed(1)));
    const excess = Math.max(0, Number((config.compressionRatio - maxSafeDieselCr).toFixed(1)));
    if (excess > 0) {
      const relPen = Math.min(35, Math.round(excess * 8.0));
      return {
        isKnocking: true,
        knockExcessCr: excess,
        maxSafeCr: maxSafeDieselCr,
        powerPenaltyPercent: Math.min(20, Math.round(excess * 4.5)),
        reliabilityPenaltyPercent: relPen,
        message: `Picco pressione camera eccessivo per Diesel con ${config.boostPressureBar.toFixed(2)} bar di boost (CR consigliato ≤ ${maxSafeDieselCr}:1).`,
      };
    }
    return {
      isKnocking: false,
      knockExcessCr: 0,
      maxSafeCr: maxSafeDieselCr,
      powerPenaltyPercent: 0,
      reliabilityPenaltyPercent: 0,
      message: 'Combustione spontanea Diesel regolare.',
    };
  }

  // Ciclo Otto (Benzina, BioFuel, RaceFuel)
  const baseOctaneSafeCr =
    config.fuelType === 'RaceFuel'
      ? 15.0
      : config.fuelType === 'BioFuel'
        ? 14.0
        : 12.2;

  const gdiCoolingBonusCr = config.fuelSystemId === 'fs-gdi-350bar' ? 1.4 : 0.0;
  const millerValveBonusCr =
    config.camshaftTypeId === 'cam-dohc-vvl'
      ? 0.8
      : config.camshaftTypeId === 'cam-dohc-vvt'
        ? 0.5
        : 0.0;
  const headThermalBonusCr =
    config.headMaterialId === 'hd-cast-iron'
      ? -0.6
      : config.headMaterialId === 'hd-alu-t6'
        ? 0.4
        : 0.0;

  // Motori moderni GDI o a fasatura/alzata variabile/Miller o con e-turbo/VGT tollerano meglio la carica compressa
  const effectiveBoostBar =
    config.turboType === 'NaturallyAspirated' ? 0 : config.boostPressureBar;
  const boostReductionRate =
    config.fuelSystemId === 'fs-gdi-350bar' ||
    config.turboType === 'ETurbo' ||
    config.turboType === 'VGT'
      ? 1.35
      : 1.65;
  const boostCrReduction = effectiveBoostBar * boostReductionRate;

  const maxSafeCr = Number(
    Math.max(
      7.2,
      baseOctaneSafeCr +
        gdiCoolingBonusCr +
        millerValveBonusCr +
        headThermalBonusCr -
        boostCrReduction,
    ).toFixed(1),
  );

  const knockExcessCr = Math.max(
    0,
    Number((config.compressionRatio - maxSafeCr).toFixed(1)),
  );

  if (knockExcessCr <= 0) {
    return {
      isKnocking: false,
      knockExcessCr: 0,
      maxSafeCr,
      powerPenaltyPercent: 0,
      reliabilityPenaltyPercent: 0,
      message: `Nessuna detonazione (Soglia Knock con ${config.fuelType}: ${maxSafeCr}:1).`,
    };
  }

  const powerPenaltyPercent = Math.min(48, Math.round(knockExcessCr * 13.5));
  const reliabilityPenaltyPercent = Math.min(60, Math.round(knockExcessCr * 16.0));

  return {
    isKnocking: true,
    knockExcessCr,
    maxSafeCr,
    powerPenaltyPercent,
    reliabilityPenaltyPercent,
    message: `DETONAZIONE (KNOCK): CR ${config.compressionRatio.toFixed(1)}:1 troppo alto per ${effectiveBoostBar.toFixed(2)} bar su ${config.fuelType} (Max sicuro: ${maxSafeCr}:1) ➔ -${powerPenaltyPercent}% Potenza, -${reliabilityPenaltyPercent}% Affidabilità!`,
  };
}

/**
 * Calcola cilindrata unitaria/totale, rapporto corsa/alesaggio e
 * ingombro fisico tridimensionale reale in millimetri (LWH).
 */
export function calculatePistonGeometryAndDimensions(
  config: PistonEngineConfigInput,
): PistonGeometryMetrics {
  const radiusMm = config.boreMm / 2;
  const unitVolumeMm3 = Math.PI * radiusMm * radiusMm * config.strokeMm;
  const unitDisplacementCc = Math.round(unitVolumeMm3 / 1000);
  const totalDisplacementCc = Math.round((unitVolumeMm3 * config.cylinders) / 1000);
  const displacementLiters = Number((totalDisplacementCc / 1000).toFixed(3));
  const strokeBoreRatio = Number((config.strokeMm / config.boreMm).toFixed(2));

  let geometryTypeLabel: PistonGeometryMetrics['geometryTypeLabel'] = 'Quadro (Bilanciato)';
  if (strokeBoreRatio < 0.95) {
    geometryTypeLabel = 'Superquadro (Corsa Corta)';
  } else if (strokeBoreRatio > 1.05) {
    geometryTypeLabel = 'Sottoquadro (Corsa Lunga)';
  }

  const camSpec =
    CAMSHAFT_TYPES.find((c) => c.id === config.camshaftTypeId) ?? CAMSHAFT_TYPES[2];
  const intakeSpec =
    INTAKE_SYSTEMS.find((i) => i.id === config.intakeSystemId) ?? INTAKE_SYSTEMS[0];
  const exhaustSpec =
    EXHAUST_MANIFOLDS.find((e) => e.id === config.exhaustManifoldId) ?? EXHAUST_MANIFOLDS[0];
  const turboCountSpec =
    TURBO_COUNT_CONFIGS.find((tc) => tc.id === config.turboCountConfig) ??
    TURBO_COUNT_CONFIGS[0];

  const cylinderPitchMm = config.boreMm * 1.16 + 11;
  const valveHeadHeightAddMm = (config.valvesPerCylinder - 2) * 9;
  const valveHeadWidthAddMm = (config.valvesPerCylinder - 2) * 11;

  const singleBankRadialLengthMm =
    config.strokeMm * 2.25 +
    config.boreMm * 0.42 +
    camSpec.heightAddMm +
    valveHeadHeightAddMm;

  const headEnvelopeWidthMm =
    config.boreMm + camSpec.widthAddMm + valveHeadWidthAddMm;

  let baseLengthMm = 0;
  let baseWidthMm = 0;
  let baseHeightMm = 0;

  if (config.architecture === 'Inline') {
    baseLengthMm = config.cylinders * cylinderPitchMm + 115;
    baseWidthMm = headEnvelopeWidthMm + exhaustSpec.widthAddMm + 165;
    baseHeightMm = singleBankRadialLengthMm + intakeSpec.heightAddMm + 160;
  } else if (config.architecture === 'V') {
    const cylPerBank = Math.ceil(config.cylinders / 2);
    const angleDeg = config.bankAngleDeg || 90;
    const halfAngleRad = (angleDeg / 2) * (Math.PI / 180);

    const sharedCrankpinOffsetMm = angleDeg <= 15 ? cylinderPitchMm * 0.5 : 26;
    baseLengthMm = cylPerBank * cylinderPitchMm + sharedCrankpinOffsetMm + 108;

    baseWidthMm =
      2 * Math.sin(halfAngleRad) * singleBankRadialLengthMm +
      Math.cos(halfAngleRad) * headEnvelopeWidthMm +
      exhaustSpec.widthAddMm +
      88;

    baseHeightMm =
      Math.cos(halfAngleRad) * singleBankRadialLengthMm +
      Math.sin(halfAngleRad) * (headEnvelopeWidthMm * 0.55) +
      intakeSpec.heightAddMm +
      148;
  } else if (config.architecture === 'Boxer') {
    const cylPerBank = Math.ceil(config.cylinders / 2);
    const boxerDedicatedCrankWebPerPairMm = 28;
    baseLengthMm =
      cylPerBank * (cylinderPitchMm + boxerDedicatedCrankWebPerPairMm) + 56 + 115;

    baseWidthMm =
      2 * singleBankRadialLengthMm +
      exhaustSpec.widthAddMm +
      valveHeadWidthAddMm * 1.4 +
      155;

    baseHeightMm =
      headEnvelopeWidthMm * 0.58 + intakeSpec.heightAddMm + 135;
  } else {
    const cylPerRow = Math.ceil(config.cylinders / 4);
    const halfAngleRad = ((config.bankAngleDeg || 72) / 2) * (Math.PI / 180);
    baseLengthMm = cylPerRow * (cylinderPitchMm * 1.34) + 130;
    baseWidthMm =
      2.22 * Math.sin(halfAngleRad) * singleBankRadialLengthMm +
      headEnvelopeWidthMm * 1.2 +
      exhaustSpec.widthAddMm +
      110;
    baseHeightMm =
      Math.cos(halfAngleRad) * singleBankRadialLengthMm * 1.06 +
      intakeSpec.heightAddMm +
      155;
  }

  const orientationAdapt = calculateOrientationMechanicalAdaptation(
    config.nativeOrientation,
    config.intendedOrientation,
  );
  baseLengthMm += orientationAdapt.lengthDeltaMm;
  baseWidthMm += orientationAdapt.widthDeltaMm;

  if (config.turboType !== 'NaturallyAspirated') {
    const posSpec =
      TURBO_POSITIONS.find((p) => p.id === config.turboPosition) ?? TURBO_POSITIONS[0];
    const activeStages = getActiveTurboStagesAr(config);
    const maxStageAr = Math.max(...activeStages);
    const arSizeMultiplier = 0.78 + maxStageAr * 0.42;
    const countSizeMultiplier =
      1 +
      (turboCountSpec.turbineCount - 1) * 0.14 +
      (config.turboType === 'Twincharged' ? 0.25 : 0);

    baseLengthMm += posSpec.lengthAddMm * arSizeMultiplier * countSizeMultiplier;
    baseWidthMm += posSpec.widthAddMm * arSizeMultiplier * countSizeMultiplier;
    baseHeightMm += posSpec.heightAddMm * arSizeMultiplier * countSizeMultiplier;
  }

  return {
    unitDisplacementCc,
    totalDisplacementCc,
    displacementLiters: Number(displacementLiters.toFixed(2)),
    strokeBoreRatio,
    geometryTypeLabel,
    dimensionsMm: {
      lengthMm: Math.round(baseLengthMm),
      widthMm: Math.round(baseWidthMm),
      heightMm: Math.round(baseHeightMm),
    },
  };
}

/**
 * Calcola il costo unitario di produzione ($) e il costo di sviluppo (Capitale $ + Punti R&D)
 * sommando il costo di ogni singola turbina in base al proprio A/R individuale.
 */
export function calculateEngineCosts(config: PistonEngineConfigInput): {
  unitProductionCost: number;
  turboSystemUnitCost: number;
  developmentCost: DualCurrencyCost;
} {
  const archSpec =
    PISTON_ARCHITECTURES.find((a) => a.id === config.architecture) ?? PISTON_ARCHITECTURES[0];
  const blockSpec =
    BLOCK_MATERIALS.find((b) => b.id === config.blockMaterialId) ?? BLOCK_MATERIALS[0];
  const headSpec =
    HEAD_MATERIALS.find((h) => h.id === config.headMaterialId) ?? HEAD_MATERIALS[0];
  const pistonSpec =
    PISTON_TYPES.find((p) => p.id === config.pistonTypeId) ?? PISTON_TYPES[0];
  const conrodSpec =
    CONROD_TYPES.find((r) => r.id === config.conrodTypeId) ?? CONROD_TYPES[0];
  const crankSpec =
    CRANKSHAFT_TYPES.find((c) => c.id === config.crankshaftTypeId) ?? CRANKSHAFT_TYPES[0];
  const camSpec =
    CAMSHAFT_TYPES.find((c) => c.id === config.camshaftTypeId) ?? CAMSHAFT_TYPES[2];
  const fuelSysSpec =
    FUEL_SYSTEMS.find((f) => f.id === config.fuelSystemId) ?? FUEL_SYSTEMS[0];
  const intakeSpec =
    INTAKE_SYSTEMS.find((i) => i.id === config.intakeSystemId) ?? INTAKE_SYSTEMS[0];
  const exhaustSpec =
    EXHAUST_MANIFOLDS.find((e) => e.id === config.exhaustManifoldId) ?? EXHAUST_MANIFOLDS[0];
  const turboSpec =
    TURBO_SYSTEMS.find((t) => t.id === config.turboType) ?? TURBO_SYSTEMS[0];
  const turboCountSpec =
    TURBO_COUNT_CONFIGS.find((tc) => tc.id === config.turboCountConfig) ??
    TURBO_COUNT_CONFIGS[0];
  const turboPosSpec =
    TURBO_POSITIONS.find((tp) => tp.id === config.turboPosition) ?? TURBO_POSITIONS[0];
  const catalystSpec =
    CATALYST_ERAS.find((c) => c.id === config.catalystEra) ?? CATALYST_ERAS[0];

  const tierProductionMultiplier: Record<PriceTier, number> = {
    Economica: 0.65,
    Media: 1.0,
    Premium: 1.48,
    Lusso: 2.25,
  };

  const valveComplexityFactor = 1 + (config.valvesPerCylinder - 2) * 0.11;
  const cylinderFactor = config.cylinders / 4;

  const coreMechanicalCost =
    (blockSpec.unitCost +
      headSpec.unitCost * (config.architecture === 'Inline' ? 1.0 : 1.55) +
      (pistonSpec.unitCost + conrodSpec.unitCost) * cylinderFactor +
      crankSpec.unitCost * cylinderFactor +
      camSpec.unitCost * valveComplexityFactor * (config.architecture === 'Inline' ? 1.0 : 1.45)) *
    archSpec.productionComplexityMultiplier *
    tierProductionMultiplier[config.priceTier];

  // Costo scalare per ogni singola turbina in base al suo diametro/A/R individuale
  let turboSystemUnitCost = 0;
  if (config.turboType !== 'NaturallyAspirated') {
    const activeStages = getActiveTurboStagesAr(config);
    const tierTurboMultiplier: Record<PriceTier, number> = {
      Economica: 0.52,
      Media: 1.0,
      Premium: 1.65,
      Lusso: 2.65,
    };
    const bearingMultiplier = config.turboBearingType === 'BallBearing' ? 1.48 : 1.0;

    // Se le turbine hanno diametri diversi (asimmetriche/sequenziali), c'è un +12% per le valvole di bypass stadio
    const isAsymmetricSequential =
      activeStages.length >= 2 &&
      Math.max(...activeStages) - Math.min(...activeStages) >= 0.12;
    const sequentialValveCostMultiplier = isAsymmetricSequential ? 1.12 : 1.0;

    const sumStageCosts = activeStages.reduce((acc, stageAr) => {
      const arCostScaling = Math.pow(Math.max(0.35, stageAr) / 0.55, 1.42);
      return acc + turboSpec.baseUnitCost * arCostScaling;
    }, 0);

    turboSystemUnitCost = Math.round(
      sumStageCosts *
        tierTurboMultiplier[config.priceTier] *
        bearingMultiplier *
        turboPosSpec.turboCostMultiplier *
        sequentialValveCostMultiplier,
    );
  }

  const orientationAdapt = calculateOrientationMechanicalAdaptation(
    config.nativeOrientation,
    config.intendedOrientation,
  );

  const unitProductionCost = Math.round(
    coreMechanicalCost +
      fuelSysSpec.unitCost * Math.pow(cylinderFactor, 0.65) +
      intakeSpec.cost +
      exhaustSpec.cost * (config.architecture === 'Inline' ? 1.0 : 1.35) +
      turboSystemUnitCost +
      catalystSpec.unitCost +
      orientationAdapt.unitCostDelta,
  );

  const transversePackagingMultiplier =
    config.intendedOrientation === 'Trasversale' ? 1.08 : 1.0;

  const globalComplexity =
    archSpec.rdComplexityMultiplier *
    camSpec.rdComplexityMultiplier *
    fuelSysSpec.rdComplexityMultiplier *
    valveComplexityFactor *
    (0.55 + cylinderFactor * 0.45) *
    tierProductionMultiplier[config.priceTier] *
    (config.turboType === 'NaturallyAspirated'
      ? 1.0
      : 1.15 + turboCountSpec.turbineCount * 0.12) *
    (config.turboPosition === 'HotV' ? 1.18 : 1.0) *
    transversePackagingMultiplier;

  const capitalCost = Math.round(1_850_000 * globalComplexity);
  const rdCost = Math.max(20, Math.round(32 * globalComplexity));

  return {
    unitProductionCost,
    turboSystemUnitCost,
    developmentCost: {
      capitalCost,
      rdCost,
      minYear: 1970,
    },
  };
}

/**
 * Simula sul Banco Prova il motore a pistoni (1A) con fisica BMEP reale:
 * - Torque (Nm) = (BMEP_bar * Displacement_Liters * 100) / (4 * Math.PI)
 * - Differenza marcata tra Corsa Lunga (S/B > 1: +coppia Nm e schiena ai bassi/medi) e Corsa Corta (S/B < 1: +allungo RPM e CV agli alti)
 * - Impatto netto del Rapporto di Compressione su Potenza (CV) e Coppia (Nm) (+3.5%/pt prima del Knock)
 * - Portata Massica d'Aria Multi-Turbo reale (Single vs Twin vs Triple vs Quad-Turbo cambiano radicalmente la portata agli alti e lo spool)
 * - Peso per singola turbina realistico (5–9 kg a turbina) e affidabilità calibrata e progressiva
 */
export function simulatePistonEngineDyno(
  config: PistonEngineConfigInput,
): EngineDynoTelemetry {
  const geom = calculatePistonGeometryAndDimensions(config);
  const exactLiters = geom.totalDisplacementCc / 1000;

  const blockSpec =
    BLOCK_MATERIALS.find((b) => b.id === config.blockMaterialId) ?? BLOCK_MATERIALS[0];
  const headSpec =
    HEAD_MATERIALS.find((h) => h.id === config.headMaterialId) ?? HEAD_MATERIALS[0];
  const pistonSpec =
    PISTON_TYPES.find((p) => p.id === config.pistonTypeId) ?? PISTON_TYPES[0];
  const conrodSpec =
    CONROD_TYPES.find((r) => r.id === config.conrodTypeId) ?? CONROD_TYPES[0];
  const crankSpec =
    CRANKSHAFT_TYPES.find((c) => c.id === config.crankshaftTypeId) ?? CRANKSHAFT_TYPES[0];
  const camSpec =
    CAMSHAFT_TYPES.find((c) => c.id === config.camshaftTypeId) ?? CAMSHAFT_TYPES[2];
  const fuelSysSpec =
    FUEL_SYSTEMS.find((f) => f.id === config.fuelSystemId) ?? FUEL_SYSTEMS[0];
  const intakeSpec =
    INTAKE_SYSTEMS.find((i) => i.id === config.intakeSystemId) ?? INTAKE_SYSTEMS[0];
  const exhaustSpec =
    EXHAUST_MANIFOLDS.find((e) => e.id === config.exhaustManifoldId) ?? EXHAUST_MANIFOLDS[0];
  const turboSpec =
    TURBO_SYSTEMS.find((t) => t.id === config.turboType) ?? TURBO_SYSTEMS[0];
  const turboCountSpec =
    TURBO_COUNT_CONFIGS.find((tc) => tc.id === config.turboCountConfig) ??
    TURBO_COUNT_CONFIGS[0];
  const turboPosSpec =
    TURBO_POSITIONS.find((tp) => tp.id === config.turboPosition) ?? TURBO_POSITIONS[0];
  const catalystSpec =
    CATALYST_ERAS.find((c) => c.id === config.catalystEra) ?? CATALYST_ERAS[0];

  const isDiesel = config.fuelType === 'Diesel';
  const isVR15 = config.architecture === 'V' && config.bankAngleDeg <= 15;

  const orientationAdapt = calculateOrientationMechanicalAdaptation(
    config.nativeOrientation,
    config.intendedOrientation,
  );

  // 1. Limite Fisico Meccanico e Limitatore Manuale (che tronca soltanto la curva senza deformarla!)
  const maxSafeMechanicalRpm = calculateMaxSafeMechanicalRpm(config);
  const redlineRpm = Math.min(
    maxSafeMechanicalRpm,
    Math.max(3000, Math.round((config.manualRedlineRpm || maxSafeMechanicalRpm) / 100) * 100),
  );

  // 2. Valutazione Rapporto di Compressione e Rischio Detonazione (Knock)
  const knockWarning = evaluateCompressionAndKnock(config);
  const knockPowerMultiplier = 1 - knockWarning.powerPenaltyPercent / 100;

  // Guadagno termodinamico reale da Rapporto di Compressione (rendimento ciclo Otto saturante oltre 12.0:1, Diesel lineare dolce)
  const refCr = isDiesel ? 16.5 : 9.5;
  const crDelta = config.compressionRatio - refCr;
  const crPerformanceMultiplier = isDiesel
    ? Math.max(0.84, 1 + crDelta * 0.02)
    : crDelta >= 0
      ? 1 + (0.03 * crDelta) / (1 + 0.13 * crDelta)
      : Math.max(0.82, 1 + crDelta * 0.03);

  // 3. Effetto Fisico Rapporto Corsa/Alesaggio (S/B = strokeMm / boreMm):
  // Nelle testate a 2 valvole stradali (camera piatta meno compatta) un motore superquadro (S/B < 0.96) perde più BMEP ai medi regimi
  // per minore turbolenza/tumble e percorso di fiamma più lungo, mentre sulle 4V/5V a tetto o camere emisferiche Corsa l'effetto è più dolce.
  const sbDelta = geom.strokeBoreRatio - 0.95;
  const strokeBoreBmepMod =
    config.valvesPerCylinder <= 2 && config.referenceClass !== 'Corsa'
      ? Math.min(1.005, Math.max(0.945, 1 + (geom.strokeBoreRatio - 0.96) * 0.22))
      : Math.min(1.03, Math.max(0.98, 1 + sbDelta * 0.04));

  // 4. Separazione tra Struttura Basamento e Riempimento Termodinamico Testata/Distribuzione:
  // Blocco, pistoni, bielle e albero motore NON pompano aria extra: riducono attriti interni (FMEP)
  // aumentando l'efficienza meccanica al massimo del +3.2% (oltre a reggere RPM e Boost superiori).
  const structuralFMEPScore =
    blockSpec.bmepDeltaBar +
    pistonSpec.bmepDeltaBar +
    conrodSpec.bmepDeltaBar +
    crankSpec.bmepDeltaBar;
  const normalizedStructQuality = Math.min(1, Math.max(0, structuralFMEPScore / 3.45));
  const mechanicalFrictionEfficiency = 0.995 + normalizedStructQuality * 0.035;

  // BMEP Termodinamica Aspirata (N/A) determinata SOLO da Testata, Camme, Valvole, Alimentazione, Aspirazione, Scarico e Carburante
  const headBmepMap: Record<string, number> = {
    'hd-cast-iron': 0.0,
    'hd-alu-cast': 0.35,
    'hd-alu-t6': 0.75,
  };
  const camBmepMap: Record<string, number> = {
    'cam-ohv': 0.0,
    'cam-sohc': 0.5,
    'cam-dohc': 0.85,
    'cam-dohc-vvt': 1.05,
    'cam-dohc-vvl': 1.25,
    'cam-desmodromic': 1.35,
  };
  const fuelSysBmepMap: Record<string, number> = {
    'fs-carb-single': 0.0,
    'fs-mpi-electronic': 0.38,
    'fs-mech-inj': 0.55,
    'fs-carb-twin-weber': 0.72,
    'fs-gdi-350bar': 0.88,
  };
  const intakeBmepMap: Record<string, number> = {
    'int-std': 0.0,
    'int-vis': 0.35,
    'int-plenum-short': 0.65,
    'int-itb-carbon': 1.05,
  };
  const exhaustBmepMap: Record<string, number> = {
    'exh-cast': 0.0,
    'exh-tubular-421': 0.25,
    'exh-equal-length': 0.45,
    'exh-inconel': 0.65,
  };

  // Sinergia fisica collettore/alimentazione:
  // - L'iniezione meccanica continua (K-Jetronic) su collettore standard integra già un plenum accordato a condotti lunghi (+0.52 bar).
  // - I corpi farfallati singoli (ITB) su motori Sport a fasatura fissa privilegiano l'allungo in alto rispetto al riempimento ai medi.
  const effectiveIntakeBmep =
    fuelSysSpec.id === 'fs-mech-inj' && intakeSpec.id === 'int-std'
      ? 0.52
      : intakeSpec.id === 'int-itb-carbon' &&
          config.referenceClass === 'Sport' &&
          camSpec.id === 'cam-dohc'
        ? fuelSysSpec.id === 'fs-mech-inj' && config.valvesPerCylinder >= 4
          ? 0.42
          : 0.82
        : (intakeBmepMap[intakeSpec.id] ?? 0.0);

  const valveBmepDelta =
    config.valvesPerCylinder <= 2
      ? camSpec.id.startsWith('cam-dohc') && config.referenceClass === 'Corsa'
        ? 0.55
        : 0.0
      : config.valvesPerCylinder === 3
        ? 0.64
        : config.valvesPerCylinder === 4
          ? 0.75
          : 0.78;

  const isModernHighCr2VSohc =
    config.turboType === 'NaturallyAspirated' &&
    !isDiesel &&
    camSpec.id === 'cam-sohc' &&
    config.valvesPerCylinder <= 2 &&
    config.compressionRatio >= 11.5;

  const isModern4VDiesel = isDiesel && config.valvesPerCylinder >= 4;

  // Frazionamento multi-cilindro (> 8 cilindri) in configurazione Corsa 4V/5V: maggiori perdite di pompaggio/calore parete per cilindro unitario piccolo
  const corsaMultiCylFactor =
    config.referenceClass === 'Corsa' &&
    config.cylinders >= 12 &&
    config.valvesPerCylinder >= 4 &&
    !isDiesel
      ? 0.90
      : config.referenceClass === 'Corsa' && config.cylinders >= 10 && !isDiesel
        ? 0.972
        : 1.0;

  // Sui motori Turbo, distribuzione OHV o 2V riceve un recupero di permeabilità sotto pressione forzata
  const turboValvetrainRecovery =
    config.turboType !== 'NaturallyAspirated' && !isDiesel
      ? (camSpec.id === 'cam-ohv' ? 1.15 : 0.0) +
        (config.valvesPerCylinder <= 2 && camSpec.id === 'cam-ohv' ? 0.30 : 0.0)
      : 0.0;

  const fuelTypeBmepDelta =
    config.fuelType === 'RaceFuel'
      ? 0.6
      : config.fuelType === 'BioFuel'
        ? 0.35
        : 0.0;

  const rawThermoNaBmepBar = isDiesel
    ? isModern4VDiesel
      ? 9.25 +
        (headSpec.id === 'hd-alu-t6' ? 0.45 : 0.20) +
        (camSpec.id === 'cam-dohc-vvt' ? 0.85 : 0.25) +
        (config.compressionRatio <= 15.8 && config.referenceClass !== 'Corsa' ? 0.35 : 0.0) +
        (geom.strokeBoreRatio > 1.12 ? (geom.strokeBoreRatio - 1.12) * 5.0 : 0.0)
      : 8.85 +
        (headSpec.id === 'hd-cast-iron' ? 0.0 : 0.25) +
        (config.valvesPerCylinder >= 4 ? 0.25 : 0.0)
    : 8.85 +
      (headBmepMap[headSpec.id] ?? 0.3) +
      (camBmepMap[camSpec.id] ?? 0.45) +
      valveBmepDelta +
      (fuelSysBmepMap[fuelSysSpec.id] ?? 0.3) +
      (fuelSysSpec.id === 'fs-carb-single' && geom.strokeBoreRatio > 1.08 ? -0.25 : 0.0) +
      effectiveIntakeBmep +
      (exhaustBmepMap[exhaustSpec.id] ?? 0.0) +
      fuelTypeBmepDelta;

  // BMEP base turbo: nei motori sovralimentati lo scavenging atmosferico ad incrocio spinto scompare per la contropressione in turbina
  const rawTurboCoreNaBmep = isDiesel
    ? rawThermoNaBmepBar
    : 8.85 +
      (headBmepMap[headSpec.id] ?? 0.3) * 0.8 +
      (camBmepMap[camSpec.id] ?? 0.45) * 0.65 +
      valveBmepDelta * 0.8 +
      (fuelSysBmepMap[fuelSysSpec.id] ?? 0.3) * 0.72 +
      (intakeBmepMap[intakeSpec.id] ?? 0.0) * 0.22 +
      (exhaustBmepMap[exhaustSpec.id] ?? 0.0) * 0.22 +
      fuelTypeBmepDelta * 0.72 +
      turboValvetrainRecovery;

  // Aggressività diagramma distribuzione / fasatura N/A in base a Classe di Riferimento (Atkinson stradale vs Sport vs Corsa)
  const isAtkinsonEconomy =
    !isDiesel &&
    config.referenceClass === 'Normale' &&
    (config.priceTier === 'Economica' || config.priceTier === 'Media') &&
    config.compressionRatio >= 12.4;

  const atkinsonEconomyFactor = Math.max(
    0.905,
    0.96 - Math.max(0, config.compressionRatio - 12.4) * 0.035,
  );

  // Nei motori Sport N/A ad altissimo regime (redline > 7200 rpm),
  // l'accordatura Helmholtz a condotti corti sposta il riempimento in alto cedendo qualche punto percentuale di BMEP massima a metà regime
  // (dimezzato sui sistemi a geometria variabile int-vis, e più marcato su 4V con ITB oltre 8200 rpm).
  const rawHelmholtzLoss = Math.min(0.055, ((redlineRpm - 7200) / 1400) * 0.055);
  const itbUltraHighRpmLoss =
    intakeSpec.id === 'int-itb-carbon' &&
    config.valvesPerCylinder === 4 &&
    redlineRpm > 8200
      ? Math.min(0.04, ((redlineRpm - 8200) / 1000) * 0.04)
      : 0.0;
  const highRedlineHelmholtzTradeoff =
    config.turboType === 'NaturallyAspirated' &&
    config.referenceClass === 'Sport' &&
    config.valvesPerCylinder >= 4 &&
    redlineRpm > 7200
      ? intakeSpec.id === 'int-vis'
        ? 1 - rawHelmholtzLoss * 0.45
        : 1 - rawHelmholtzLoss - itbUltraHighRpmLoss
      : 1.0;

  // Saturazione riempimento plenum per cilindrate unitarie molto grandi (> 620 cc/cil.) in configurazione aspirata con plenum condiviso
  const largeUnitDisplacementPlenumMod =
    config.turboType === 'NaturallyAspirated' &&
    intakeSpec.id !== 'int-itb-carbon' &&
    geom.unitDisplacementCc > 620
      ? Math.max(0.89, 1 - (geom.unitDisplacementCc - 600) * 0.00072)
      : 1.0;

  const classVeTuningFactor = isDiesel
    ? 1.0
    : config.referenceClass === 'Corsa'
      ? 1.04 * corsaMultiCylFactor * largeUnitDisplacementPlenumMod
      : config.referenceClass === 'Sport'
        ? 1.022 * highRedlineHelmholtzTradeoff * largeUnitDisplacementPlenumMod
        : isAtkinsonEconomy
          ? atkinsonEconomyFactor
          : 1.005;

  const modern2VSohcCrEfficiencyBonus = isModernHighCr2VSohc ? 1.06 : 1.0;

  const peakNaBmepBar = Math.max(
    7.0,
    rawThermoNaBmepBar *
      crPerformanceMultiplier *
      strokeBoreBmepMod *
      classVeTuningFactor *
      mechanicalFrictionEfficiency *
      modern2VSohcCrEfficiencyBonus,
  );

  // Per il turbo il rapporto di compressione neutro scende con il boost: CR_ref_turbo = max(7.2, 9.5 - boostBar * 1.1)
  // Così i turbo storici anni '70-'80 (CR 7.0-7.8:1) non vengono penalizzati ingiustamente sulla BMEP base,
  // mentre i 2V non interrefrigerati con CR estremo <= 6.8 subiscono la reale perdita termica di ciclo.
  const crRefTurbo = Math.max(7.2, 9.5 - config.boostPressureBar * 1.1);
  const turboCrDelta = config.compressionRatio - crRefTurbo;
  const ultraLowCr2VPenalty =
    !isDiesel && config.valvesPerCylinder <= 2 && config.compressionRatio <= 6.8
      ? 0.91
      : 1.0;
  const turboCrMultiplier = isDiesel
    ? isModern4VDiesel
      ? Math.max(0.985, 1 + (config.compressionRatio - 15.8) * 0.012)
      : crPerformanceMultiplier
    : (turboCrDelta >= 0
        ? 1 + (0.012 * turboCrDelta) / (1 + 0.1 * turboCrDelta)
        : Math.max(0.96, 1 + turboCrDelta * 0.012)) * ultraLowCr2VPenalty;

  const baseTurboCoreBmepBar = Math.max(
    8.2,
    rawTurboCoreNaBmep *
      turboCrMultiplier *
      mechanicalFrictionEfficiency,
  );

  const catalystPowerFactor = 1 - catalystSpec.powerPenaltyPercent / 100;
  const activeTurboStagesAr = getActiveTurboStagesAr(config);

  // 5. RPM di Picco Coppia e Limite Dinamico di Flusso Valvole (basati su Velocità Media Pistone vp e Classe)
  let naturalPeakTorqueRpm: number;
  if (isDiesel) {
    naturalPeakTorqueRpm = Math.min(
      2300,
      Math.max(1800, Math.round(1950 + (90 - config.strokeMm) * 14)),
    );
  } else if (config.referenceClass === 'Corsa') {
    const corsaRatio = Math.min(
      0.82,
      Math.max(
        0.74,
        0.76 +
          (camSpec.id.startsWith('cam-dohc') || camSpec.id === 'cam-desmodromic' ? 0.02 : 0) +
          (intakeSpec.id === 'int-itb-carbon' ? 0.02 : 0),
      ),
    );
    naturalPeakTorqueRpm = Math.round((redlineRpm * corsaRatio) / 100) * 100;
  } else if (config.referenceClass === 'Sport') {
    const sportRatio = Math.min(
      0.72,
      Math.max(
        0.6,
        0.63 +
          (config.valvesPerCylinder <= 2 ? -0.02 : 0.02) +
          (camSpec.id === 'cam-dohc-vvl' || camSpec.id === 'cam-dohc-vvt' ? 0.02 : 0) +
          (intakeSpec.id === 'int-itb-carbon' || intakeSpec.id === 'int-plenum-short' ? 0.02 : 0),
      ),
    );
    naturalPeakTorqueRpm = Math.round((redlineRpm * sportRatio) / 100) * 100;
  } else {
    // Normale / Comfort / Fuoristrada: 2V OHV/SOHC intorno 2.800-3.500 rpm, 4V moderni intorno 3.500-4.400 rpm
    const rawNormalPeak =
      config.valvesPerCylinder <= 2
        ? 3050 +
          (75 - config.strokeMm) * 18 +
          (camSpec.id === 'cam-sohc' ? 200 : 0) +
          (fuelSysSpec.id === 'fs-mpi' ? 120 : 0)
        : 3750 +
          (78 - config.strokeMm) * 20 +
          (camSpec.id.startsWith('cam-dohc') ? 200 : 0) +
          (config.valvesPerCylinder >= 4 ? 150 : 0);
    naturalPeakTorqueRpm = Math.min(
      config.valvesPerCylinder <= 2 ? 3600 : 4500,
      Math.max(2600, Math.round(rawNormalPeak / 100) * 100),
    );
  }

  // Velocità media critica del pistone vp (m/s) dove le valvole iniziano a murare:
  // Dipende da geometria Corsa/Alesaggio (valvole grandi su alesaggio ampio), numero valvole, camme e classe.
  const boreToStrokeBreathingBonus =
    (1 / Math.max(0.4, geom.strokeBoreRatio) - 1) *
    (config.valvesPerCylinder <= 2 ? 2.1 : 3.1);
  const classChokeVpBonus =
    config.referenceClass === 'Corsa'
      ? 6.4
      : config.referenceClass === 'Sport'
        ? config.valvesPerCylinder <= 2
          ? 1.5
          : 3.2
        : 0.5;
  const chokePistonSpeedMs = isDiesel
    ? (isModern4VDiesel ? 13.6 : 11.4) +
      boreToStrokeBreathingBonus * 0.4 +
      (config.valvesPerCylinder - 2) * 0.5
    : 15.2 +
      Math.min(4.2, Math.max(-0.8, boreToStrokeBreathingBonus)) +
      (Math.min(4, config.valvesPerCylinder) - 2) * 1.45 +
      (config.valvesPerCylinder >= 5 ? 0.5 : 0) +
      (camSpec.id === 'cam-dohc-vvl' || camSpec.id === 'cam-dohc-vvt'
        ? 2.8
        : camSpec.id.startsWith('cam-dohc') || camSpec.id === 'cam-desmodromic'
          ? config.valvesPerCylinder <= 2
            ? config.referenceClass === 'Corsa'
              ? 2.2
              : 0.9
            : 1.8
          : camSpec.id === 'cam-sohc'
            ? isModernHighCr2VSohc
              ? 2.4
              : 0.9
            : 0) +
      (headSpec.id === 'hd-alu-t6' ? 1.0 : 0) +
      (intakeSpec.highRpmMod - 1.0) * (config.valvesPerCylinder <= 2 ? 4 : 10) +
      classChokeVpBonus;

  const isSmallModernStreetTurbo =
    config.turboType !== 'NaturallyAspirated' &&
    !isDiesel &&
    config.referenceClass === 'Normale' &&
    (config.priceTier === 'Economica' || config.priceTier === 'Media') &&
    exactLiters <= 2.1;

  const curve: DynoCurvePoint[] = [];
  let peakPowerHp = 0;
  let peakPowerRpm = 1000;
  let peakTorqueNm = 0;
  let peakTorqueRpm = 1000;
  let peakBmepBar = 0;

  // Campionamento ogni 100 RPM da 1000 RPM fino a redlineRpm
  for (let rpm = 1000; rpm <= redlineRpm; rpm += 100) {
    const pistonSpeedMs = (2 * config.strokeMm * rpm) / 60_000;

    // 1. Forma fisica della curva VE aspirata:
    // Salita dai bassi regimi fino a naturalPeakTorqueRpm, poi decadimento controllato verso il limitatore
    let smoothBellVe: number;
    if (rpm <= naturalPeakTorqueRpm) {
      const riseSpan = Math.max(1200, naturalPeakTorqueRpm - 1000);
      const xLow = (naturalPeakTorqueRpm - rpm) / riseSpan; // 0 al picco, 1 a 1000 rpm
      const lowFloor =
        camSpec.id === 'cam-dohc-vvl' || intakeSpec.id === 'int-vis'
          ? 0.84
          : camSpec.id === 'cam-dohc-vvt'
            ? 0.81
            : config.referenceClass === 'Corsa'
              ? 0.68
              : 0.74;
      smoothBellVe = lowFloor + (1 - lowFloor) * Math.exp(-Math.pow(xLow * 1.25, 2));
    } else {
      const highSpan = Math.max(1200, redlineRpm - naturalPeakTorqueRpm);
      const xHigh = (rpm - naturalPeakTorqueRpm) / highSpan; // 0 al picco, 1 al limitatore
      const isHighFlow2V =
        fuelSysSpec.id === 'fs-mech-inj' ||
        (fuelSysSpec.id === 'fs-carb-twin-weber' && intakeSpec.id !== 'int-std') ||
        camSpec.id === 'cam-dohc' ||
        fuelSysSpec.id === 'fs-gdi-350bar' ||
        config.compressionRatio >= 11.5;

      // Soffocamento sonico del venturi su carburatore a corpo singolo:
      // la portata massima in alto è limitata dalla sezione del singolo venturi (più marcato sui bicilindrici per pulsazioni singole)
      const singleCarbSonicRetention =
        (camSpec.id === 'cam-ohv'
          ? Math.min(0.83, Math.max(0.66, 7.35 / peakNaBmepBar))
          : config.compressionRatio >= 9.5
            ? 0.56
            : 0.68) * (config.cylinders <= 2 ? 0.89 : 1.0);

      // Nei 2V Sport superquadri (S/B < 0.82) la fasatura spinta compensa in alto il riempimento perso ai medi
      const sport2VOversquareRetentionBonus =
        geom.strokeBoreRatio < 0.82 ? (0.82 - geom.strokeBoreRatio) * 0.95 : 0;

      // Saturazione portata plenum in alto su grandi V12 stradali (> 7.0L) a plenum singolo condiviso
      const largePlenumHighRpmRetentionMod =
        config.turboType === 'NaturallyAspirated' &&
        config.referenceClass === 'Sport' &&
        intakeSpec.id === 'int-plenum-short' &&
        geom.totalDisplacementCc >= 7000
          ? 0.77
          : 1.0;

      const retentionAtRedline =
        isDiesel
          ? isModern4VDiesel
            ? 0.68
            : 0.56
          : config.referenceClass === 'Corsa'
            ? config.valvesPerCylinder >= 5
              ? 0.935
              : config.valvesPerCylinder <= 2 && geom.unitDisplacementCc > 750
                ? 0.96
                : 0.92
            : config.referenceClass === 'Sport'
              ? config.valvesPerCylinder <= 2
                ? Math.min(
                    0.85,
                    (fuelSysSpec.id === 'fs-carb-twin-weber'
                      ? camSpec.id === 'cam-sohc' && config.cylinders >= 6
                        ? 0.74
                        : 0.775
                      : 0.81) + sport2VOversquareRetentionBonus,
                  )
                : config.valvesPerCylinder === 3
                  ? 0.81
                  : config.valvesPerCylinder >= 5
                    ? 0.88
                    : camSpec.id === 'cam-dohc'
                      ? fuelSysSpec.id === 'fs-mech-inj' && intakeSpec.id === 'int-itb-carbon'
                        ? 0.84
                        : 0.805
                      : (intakeSpec.id === 'int-itb-carbon' && redlineRpm > 8200
                          ? 0.89
                          : 0.865) * largePlenumHighRpmRetentionMod
              : config.valvesPerCylinder <= 2
                ? isModernHighCr2VSohc
                  ? 0.90
                  : fuelSysSpec.id === 'fs-carb-single'
                    ? singleCarbSonicRetention
                    : fuelSysSpec.id === 'fs-mech-inj'
                      ? camSpec.id === 'cam-ohv'
                        ? 0.775
                        : 0.855
                      : isHighFlow2V
                        ? 0.805
                        : config.priceTier === 'Economica'
                          ? 0.705
                          : 0.755
                : config.valvesPerCylinder >= 5 && exhaustSpec.id === 'exh-cast'
                  ? 0.835
                  : camSpec.id === 'cam-dohc' && geom.strokeBoreRatio >= 0.96
                    ? 0.775
                    : 0.865;
      smoothBellVe = 1 - (1 - retentionAtRedline) * Math.pow(xHigh, 1.75);
    }

    // Attrito dinamico ad alta velocità media pistone (mitigato da manovellismo/pistoni leggeri)
    const highRpmFrictionFactor =
      1 - Math.max(0, pistonSpeedMs - 16) * (0.0028 - normalizedStructQuality * 0.0012);

    // Decadimento fisiologico agli alti giri per soffocamento valvole e velocità pistone vp
    const excessPistonSpeed = Math.max(0, pistonSpeedMs - chokePistonSpeedMs);
    const highRpmChokeFactor =
      1 / (1 + Math.pow(excessPistonSpeed / (config.referenceClass === 'Corsa' ? 5.2 : 5.6), 1.85));

    // Effetto Corsa Lunga ai bassi/medi
    const lowMidRpmStrokeBonus =
      rpm < 4000 ? 1 + sbDelta * 0.045 * ((4000 - rpm) / 3000) : 1.0;

    // Modificatori caratteristici di erogazione per architettura
    let archFlowModifier = 1.0;
    if (config.architecture === 'Inline') {
      archFlowModifier =
        1.0 + 0.015 * Math.exp(-Math.pow((rpm - 3400) / 1500, 2));
    } else if (config.architecture === 'Boxer') {
      archFlowModifier =
        1.0 + 0.014 * Math.exp(-Math.pow((rpm - 3700) / 1600, 2));
    } else if (isVR15) {
      const lowBonus = 0.02 * Math.exp(-Math.pow((rpm - 2200) / 1100, 2));
      const highPenalty = rpm > 4500 ? Math.min(0.03, ((rpm - 4500) / 4000) * 0.03) : 0;
      archFlowModifier = 1.0 + lowBonus - highPenalty;
    } else if (config.architecture === 'V') {
      const highBonus = rpm > 5000 ? Math.min(0.018, ((rpm - 5000) / 4500) * 0.018) : 0;
      archFlowModifier = 1.0 + highBonus;
    } else if (config.architecture === 'W') {
      // Un 16 cilindri a 4 bancate (W16) ha perdite parassite di manovellismo e pompe ausiliarie (~5%) su tutto l'arco di giri
      const baseWParasiticLoss = 0.052;
      const highWFrictionLoss = rpm > 4500 ? Math.min(0.02, ((rpm - 4500) / 4000) * 0.02) : 0;
      archFlowModifier = 1.0 - baseWParasiticLoss - highWFrictionLoss;
    }

    let currentBmepBar =
      peakNaBmepBar *
      smoothBellVe *
      lowMidRpmStrokeBonus *
      highRpmChokeFactor *
      highRpmFrictionFactor *
      archFlowModifier;

    // 2. Calcolo Sovralimentazione Termodinamica Reale: BMEP_turbo = BMEP_base_eff * (1 + k_boost * boostBar)
    // Nessun moltiplicatore cumulativo fittizio su Twin-Scroll/VGT/E-Turbo/Cuscinetti/Multi-Turbo!
    if (config.turboType !== 'NaturallyAspirated') {
      // Twin-Scroll, VGT, E-Turbo e Cuscinetti a Sfera migliorano principalmente lo spool (-rpm) e al massimo +1.5% / +4% di rendimento termodinamico
      const turboTechBonus =
        (config.turboType === 'TwinScroll'
          ? 0.02
          : config.turboType === 'Twincharged'
            ? 0.03
            : config.turboType === 'VGT'
              ? 0.03
              : config.turboType === 'ETurbo'
                ? 0.03
                : 0.0) +
        (config.turboBearingType === 'BallBearing' ? 0.01 : 0.0);
      const techEfficiencyFactor = 1 + Math.min(0.04, turboTechBonus);

      // Multi-turbo: a parità di bar evita il choke agli alti regimi (+0% / +1.5% max sulla coppia di picco)
      const multiTurboPeakBonus =
        1 + Math.min(0.015, (turboCountSpec.turbineCount - 1) * 0.005);

      // Nei motori 4V Lusso/Competizione a benzina o carburante gara (<= 9500 rpm) a basso rapporto di compressione (CR <= 7.8) senza catalizzatore,
      // l'ampio incrocio valvole e l'assenza di contropressione scarico permettono uno scavenging spinto a centro curva.
      const isClassicLowCrRaceBredTurbo =
        !isDiesel &&
        (config.fuelType === 'Benzina' ||
          (config.fuelType === 'RaceFuel' && redlineRpm <= 9500)) &&
        config.valvesPerCylinder >= 4 &&
        config.compressionRatio <= 7.8 &&
        config.catalystEra === 'None' &&
        config.priceTier === 'Lusso';

      const classicLowCrScavengingBonus = isClassicLowCrRaceBredTurbo
        ? config.turboCountConfig === 'TwinTurbo'
          ? config.referenceClass === 'Sport'
            ? 0.44
            : config.fuelType === 'RaceFuel'
              ? 0.30
              : 0.25
          : 0.08
        : config.turboType === 'Twincharged'
          ? config.referenceClass === 'Corsa'
            ? 0.07
            : -0.11
          : config.turboType === 'Supercharger' && fuelSysSpec.id === 'fs-gdi-350bar'
            ? 0.06
            : isModern4VDiesel &&
                config.turboCountConfig === 'TwinTurbo' &&
                config.referenceClass !== 'Corsa'
              ? 0.21
              : isModern4VDiesel && config.referenceClass === 'Corsa'
                ? 0.04
                : 0.0;

      // Coefficiente termodinamico reale di sovralimentazione k_boost
      const kBoost =
        (isDiesel
          ? 0.76
          : config.referenceClass === 'Corsa'
            ? 0.76
            : config.referenceClass === 'Sport'
              ? 0.72
              : 0.70) + classicLowCrScavengingBonus;

      // Regimi fisici di gestione carica/accensione sui benzina turbo:
      // 1) Nei motori Normale con CR >= 11.5 (ciclo Miller/Atkinson), la chiusura anticipata/ritardata aspirazione riduce la carica intrappolata in modo continuo con CR.
      // 2) Nei piccoli GDI Normale non-Miller (CR <= 10.5, es. 1.0 EcoBoost), il raffreddamento evaporativo GDI consente overboost/scavenging ai medi (+9.5%).
      // 3) Nei motori Sport stradali a benzina Turbo (non volumetrici) con CR statico alto (>= 10.0), la centralina ritarda l'anticipo di accensione e limita il plateau di coppia per prevenire la detonazione.
      const millerTurboBaseFactor =
        !isDiesel && config.referenceClass === 'Normale' && config.compressionRatio >= 11.5
          ? Math.max(0.79, 0.875 - (config.compressionRatio - 12.0) * 0.17)
          : !isDiesel &&
              config.referenceClass === 'Normale' &&
              fuelSysSpec.id === 'fs-gdi-350bar' &&
              config.compressionRatio <= 10.1 &&
              config.cylinders <= 3
            ? 1.095
            : !isDiesel &&
                config.referenceClass === 'Sport' &&
                config.turboType !== 'Supercharger' &&
                config.fuelType === 'Benzina' &&
                config.compressionRatio >= 10.0
              ? exhaustSpec.id === 'exh-cast'
                ? 0.955
                : 0.885
              : 1.0;

      const baseBmepForTurbo = baseTurboCoreBmepBar * millerTurboBaseFactor;

      const targetForcedPeakBmepBar =
        baseBmepForTurbo *
        (1 + kBoost * config.boostPressureBar) *
        techEfficiencyFactor *
        multiTurboPeakBonus;

      if (config.turboType === 'Supercharger') {
        const rootsRamp = 0.88 + 0.12 * Math.sin(Math.min(Math.PI / 2, (rpm - 1000) / 1600));
        const rootsRolloffCoeff = fuelSysSpec.id === 'fs-gdi-350bar' ? 0.22 : 0.25;
        const rootsParasiticRollOff =
          rpm > 3400 ? Math.pow((rpm - 3400) / 5200, 1.75) * rootsRolloffCoeff : 0;

        currentBmepBar =
          targetForcedPeakBmepBar *
          Math.max(0.42, rootsRamp - rootsParasiticRollOff) *
          lowMidRpmStrokeBonus *
          highRpmChokeFactor *
          archFlowModifier;
      } else {
        // Spool progressivo realistico per ogni turbina (abbattuto su VGT, Twin-Scroll, E-Turbo e BallBearing)
        const bearingSpoolBonusRpm =
          config.turboBearingType === 'BallBearing' ? -360 : 0;
        const hotVSpoolBonusRpm = config.turboPosition === 'HotV' ? -240 : 0;

        let fastestStageSpool = 0;
        let sumStageSpool = 0;
        let sumStageHighFlow = 0;

        // Le turbine piccole su motori di cilindrata contenuta (<= 2.0L) hanno inerzia minore e spoolano molto più presto (1.600-2.400 rpm)
        const smallDisplacementSpoolShift =
          exactLiters <= 2.0 ? -(2.0 - exactLiters) * 750 : 0;

        activeTurboStagesAr.forEach((stageAr) => {
          const stageSpoolRpm = Math.max(
            isDiesel ? 1300 : 1200,
            turboSpec.spoolRpmBase +
              bearingSpoolBonusRpm +
              hotVSpoolBonusRpm +
              turboCountSpec.spoolRpmBonus +
              smallDisplacementSpoolShift +
              (stageAr - 0.65) * 1850,
          );

          const stageSigmoid = 1 / (1 + Math.exp(-(rpm - stageSpoolRpm) / 360));
          const lowFloor = turboSpec.lowEndBoostFactor * 0.24;
          const stageSpool = lowFloor + (1 - lowFloor) * stageSigmoid;

          // Con più turbine (Twin/Triple/Quad) ogni girante alimenta meno cilindri e non mura tra 5.500 e 7.500 rpm
          // Nei motori Corsa turbo (F1/LMP1/DTM) la girante è dimensionata per respirare vicino al limitatore (~84% redline)
          const perTurbineDisplacementLiters =
            exactLiters / activeTurboStagesAr.length;
          const displacementChokeShiftRpm = (1.5 - perTurbineDisplacementLiters) * 650;
          const stageChokeRpm =
            config.referenceClass === 'Corsa'
              ? isDiesel
                ? 4150 + stageAr * 900
                : Math.max(6800, redlineRpm * 0.84 + stageAr * 1200)
              : (isDiesel
                  ? isModern4VDiesel
                    ? config.turboCountConfig === 'TwinTurbo'
                      ? 3250
                      : 3050
                    : 2700
                  : 5100) +
                stageAr * 3400 +
                displacementChokeShiftRpm;

          const stageHighRollOff =
            rpm > stageChokeRpm
              ? 1 /
                (1 +
                  Math.pow(
                    (rpm - stageChokeRpm) /
                      (isDiesel ? (isModern4VDiesel ? 1600 : 1450) : 2800),
                    1.85,
                  ))
              : 1.0;

          fastestStageSpool = Math.max(fastestStageSpool, stageSpool);
          sumStageSpool += stageSpool;
          sumStageHighFlow += stageHighRollOff;
        });

        const avgStageSpool = sumStageSpool / activeTurboStagesAr.length;
        const avgStageHighFlow = sumStageHighFlow / activeTurboStagesAr.length;

        const isAsymmetricStages =
          activeTurboStagesAr.length >= 2 &&
          Math.max(...activeTurboStagesAr) - Math.min(...activeTurboStagesAr) >= 0.1;

        const exhaustDrivenSpool = isAsymmetricStages
          ? 0.72 * fastestStageSpool + 0.28 * avgStageSpool
          : 0.35 * fastestStageSpool + 0.65 * avgStageSpool;

        const eTurboLowRamp =
          0.85 + 0.15 * (1 - Math.exp(-Math.pow((rpm - 1000) / 650, 1.65)));
        const effectiveSpool =
          config.turboType === 'ETurbo'
            ? Math.max(exhaustDrivenSpool, eTurboLowRamp)
            : exhaustDrivenSpool;

        // Il Multi-Turbo sostiene la portata fino a 7.500 rpm senza moltiplicare la BMEP oltre il nominale
        const multiStageHighBreathing = Math.min(
          1.0,
          avgStageHighFlow + (activeTurboStagesAr.length - 1) * 0.04,
        );

        // Decadimento fisiologico Diesel: nei 2V inizia a 2.600 rpm, nei 4V moderni a 2.800 rpm, nei Diesel Corsa LMP1 a 3.850 rpm
        const dieselRollOffStartRpm =
          config.referenceClass === 'Corsa' ? 3850 : isModern4VDiesel ? 2800 : 2600;
        const dieselRollOffSpanRpm =
          config.referenceClass === 'Corsa' ? 2600 : isModern4VDiesel ? 2200 : 2150;
        const dieselHighRpmRollOff =
          isDiesel && rpm > dieselRollOffStartRpm
            ? 1 / (1 + Math.pow((rpm - dieselRollOffStartRpm) / dieselRollOffSpanRpm, 2.05))
            : 1.0;

        // Piccoli Turbo Stradali moderni (Economica/Media Normale <= 2.1L): taglio wastegate/Miller oltre 3.800-4.400 rpm
        // per mantenere la potenza in plateau attorno a 5.000-5.800 rpm (più marcato sui bicilindrici e sui ciclo Miller ad alto CR).
        const smallStreetTaperStartRpm =
          config.cylinders <= 2
            ? 3750
            : config.compressionRatio >= 11.5
              ? 3950
              : config.cylinders === 3 && config.compressionRatio <= 10.1
                ? 4050
                : 4350;
        const smallStreetTaperSpanRpm =
          config.cylinders <= 2
            ? 2350
            : config.compressionRatio >= 11.5
              ? 2450
              : config.cylinders === 3
                ? 2750
                : 3000;
        const smallStreetBoostTaper =
          isSmallModernStreetTurbo && rpm > smallStreetTaperStartRpm
            ? 1 / (1 + Math.pow((rpm - smallStreetTaperStartRpm) / smallStreetTaperSpanRpm, 1.85))
            : 1.0;

        const turboPlateauStartRpm =
          config.referenceClass === 'Corsa'
            ? redlineRpm * 0.71
            : isClassicLowCrRaceBredTurbo && config.turboCountConfig === 'TwinTurbo'
              ? redlineRpm * 0.62
              : config.referenceClass === 'Sport' &&
                  config.compressionRatio >= 10.0 &&
                  exhaustSpec.id === 'exh-cast'
                ? redlineRpm * 0.64
                : config.referenceClass === 'Sport'
                  ? redlineRpm * 0.70
                  : redlineRpm * 0.64;

        const turboRedlineRetention =
          config.referenceClass === 'Corsa'
            ? fuelSysSpec.id === 'fs-gdi-350bar' && config.boostPressureBar >= 1.8
              ? 0.73
              : isClassicLowCrRaceBredTurbo && config.turboCountConfig === 'TwinTurbo'
                ? config.fuelType === 'RaceFuel'
                  ? 0.86
                  : 0.72
                : 0.82
            : isClassicLowCrRaceBredTurbo && config.turboCountConfig === 'TwinTurbo'
              ? 0.76
              : config.referenceClass === 'Sport'
                ? config.compressionRatio >= 10.0 && config.fuelType === 'Benzina'
                  ? exhaustSpec.id === 'exh-cast'
                    ? 0.68
                    : 0.75
                  : redlineRpm >= 8400
                    ? 0.77
                    : turboCountSpec.turbineCount >= 2
                      ? 0.83
                      : 0.81
                : turboCountSpec.turbineCount >= 2
                  ? 0.80
                  : 0.77;

        const generalTurboHighRpmTaper =
          !isDiesel && !isSmallModernStreetTurbo && rpm > turboPlateauStartRpm
            ? 1 -
              (1 - turboRedlineRetention) *
                Math.pow(
                  (rpm - turboPlateauStartRpm) /
                    Math.max(800, redlineRpm - turboPlateauStartRpm),
                  1.55,
                )
            : 1.0;

        const naOffBoostBmep =
          peakNaBmepBar *
          smoothBellVe *
          0.85 *
          lowMidRpmStrokeBonus *
          highRpmChokeFactor;

        const fullBoostBmep =
          targetForcedPeakBmepBar *
          multiStageHighBreathing *
          dieselHighRpmRollOff *
          smallStreetBoostTaper *
          generalTurboHighRpmTaper *
          lowMidRpmStrokeBonus *
          highRpmChokeFactor *
          highRpmFrictionFactor;

        currentBmepBar =
          (naOffBoostBmep * (1 - effectiveSpool) + fullBoostBmep * effectiveSpool) *
          archFlowModifier;
      }
    }

    // Applica contropressione catalizzatore, eventuale taglio potenza da Detonazione (Knock) e adattamento meccanico orientamento
    currentBmepBar = Number(
      (
        currentBmepBar *
        catalystPowerFactor *
        knockPowerMultiplier *
        orientationAdapt.powerMultiplier
      ).toFixed(2),
    );

    // FORMULA FISICA ESATTA DEI MOTORI 4 TEMPI:
    // Torque (Nm) = (BMEP_bar * Displacement_Liters * 100) / (4 * Math.PI)
    const torqueNm = Math.max(
      25,
      Math.round((currentBmepBar * exactLiters * 100) / (4 * Math.PI)),
    );
    const powerHp = Math.round((torqueNm * rpm) / 7023.5);

    curve.push({ rpm, torqueNm, powerHp, bmepBar: currentBmepBar });

    if (torqueNm > peakTorqueNm) {
      peakTorqueNm = torqueNm;
      peakTorqueRpm = rpm;
    }
    if (powerHp > peakPowerHp) {
      peakPowerHp = powerHp;
      peakPowerRpm = rpm;
    }
    if (currentBmepBar > peakBmepBar) {
      peakBmepBar = currentBmepBar;
    }
  }

  // 6. Peso Realistico e Contenuto (scalato sulla cilindrata unitaria per le testate e sub-lineare sulle grandi cubature)
  const archWeightFactor =
    config.architecture === 'Inline'
      ? 1.0
      : config.architecture === 'V'
        ? 0.98
        : config.architecture === 'Boxer'
          ? 1.06
          : 1.15;

  const headBankFactor =
    config.architecture === 'Inline'
      ? 1.0
      : isVR15
        ? 1.12
        : config.architecture === 'W'
          ? 1.85
          : 1.34;

  const effectiveBottomDispLiters =
    exactLiters <= 3.0
      ? exactLiters
      : 3.0 + Math.pow(exactLiters - 3.0, 0.50) * 1.12;

  const bottomEndWeightKg =
    (10 + effectiveBottomDispLiters * 29.8 + config.cylinders * 3.1) *
    archWeightFactor *
    blockSpec.weightFactor *
    ((pistonSpec.weightFactor + conrodSpec.weightFactor + crankSpec.weightFactor) / 3);

  const unitDispLiters = exactLiters / Math.max(1, config.cylinders);
  const dispScaleForHeads = 0.60 + Math.min(0.54, unitDispLiters) * 0.92;
  const cylinderHeadsWeightKg =
    (3.5 + effectiveBottomDispLiters * 6.2) * headBankFactor * headSpec.weightFactor +
    (camSpec.headWeightAddKgPerCyl + (config.valvesPerCylinder - 2) * 0.44) *
      config.cylinders *
      dispScaleForHeads;

  // Peso sistema turbo calcolato sul peso reale di ciascuna turbina (5–9 kg a turbina in base al diametro!)
  const turboSystemWeightKg =
    config.turboType === 'NaturallyAspirated'
      ? 0
      : config.turboType === 'Supercharger'
        ? Math.round(14 + exactLiters * 2.2)
        : Math.round(
            3.5 + // Intercooler e tubazioni base
              (config.turboType === 'Twincharged' ? 11 : 0) +
              (config.turboType === 'ETurbo' ? 3.5 : 0) +
              activeTurboStagesAr.reduce(
                (sumKg, stageAr) => sumKg + (3.8 + stageAr * 4.4),
                0,
              ),
          );

  const exhaustWeightScale = Math.min(1.02, 0.45 + exactLiters * 0.16);
  const dryWeightKg = Math.max(
    45,
    Math.round(
      bottomEndWeightKg +
        cylinderHeadsWeightKg +
        exhaustSpec.weightKg *
          (config.architecture === 'Inline' ? 1.0 : 1.18) *
          exhaustWeightScale +
        turboSystemWeightKg +
        catalystSpec.weightAddKg * Math.min(0.42, 0.22 + exactLiters * 0.05),
    ),
  );

  const wetWeightKg = Math.round(
    dryWeightKg +
      3.2 +
      exactLiters * 2.2 +
      (config.turboType !== 'NaturallyAspirated' ? 2.2 : 0),
  );

  // 7. Efficienza Termica (%) ed Emissioni (g/km)
  const baseEfficiency = isDiesel
    ? 36.5
    : config.fuelType === 'BioFuel'
      ? 31.5
      : 29.0;
  const crEfficiencyBonus = (config.compressionRatio - refCr) * 1.15;
  const archEfficiencyMod =
    config.architecture === 'W'
      ? -3.0
      : config.architecture === 'Inline'
        ? 0.6
        : config.architecture === 'Boxer'
          ? 0.4
          : 0.0;
  const strokeEfficiencyBonus = (geom.strokeBoreRatio - 1.0) * 2.8;

  const rawEfficiency =
    baseEfficiency +
    crEfficiencyBonus +
    archEfficiencyMod +
    strokeEfficiencyBonus +
    blockSpec.efficiencyDeltaPercent +
    headSpec.efficiencyDeltaPercent +
    pistonSpec.efficiencyDeltaPercent +
    conrodSpec.efficiencyDeltaPercent +
    crankSpec.efficiencyDeltaPercent +
    camSpec.efficiencyDeltaPercent +
    fuelSysSpec.efficiencyDeltaPercent +
    (config.turboType !== 'NaturallyAspirated' ? 1.5 : 0) -
    (knockWarning.isKnocking ? knockWarning.knockExcessCr * 2.5 : 0);

  const thermalEfficiencyPercent = Number(
    Math.min(52.0, Math.max(16.0, rawEfficiency)).toFixed(1),
  );

  const rawUncatalyzedEmissions =
    (95 + exactLiters * 45 + peakPowerHp * 0.22) *
    fuelSysSpec.emissionsMultiplier *
    (32 / thermalEfficiencyPercent) *
    (config.fuelType === 'BioFuel' ? 0.78 : 1.0);

  const emissionsGPerKm = Math.max(
    18,
    Math.round(
      rawUncatalyzedEmissions * (1 - catalystSpec.emissionsReductionPercent / 100),
    ),
  );

  // 8. Affidabilità (%) e Durata Stimata in Km:
  // Premia i motori semplici e sotto-stressati (95–99%) e scala in modo continuo con potenza specifica (CV/L),
  // pressione/BMEP, velocità media del pistone e complessità meccanica (85–94% sportive/supercar, 72–86% Corsa).
  const avgMaterialResistance =
    (blockSpec.materialResistance +
      headSpec.materialResistance +
      pistonSpec.materialResistance +
      conrodSpec.materialResistance +
      crankSpec.materialResistance +
      camSpec.materialResistance) /
    6;

  const classReliabilityBonus: Record<ReferenceClass, number> = {
    Normale: 1.2,
    Comfort: 1.8,
    Fuoristrada: 1.5,
    Sport: 0.6,
    Corsa: -11.0,
  };

  const baseRefMechanicalRpm = Math.min(
    isDiesel ? 5800 : 11000,
    maxSafeMechanicalRpm,
  );
  const rpmMarginRatio =
    (baseRefMechanicalRpm - redlineRpm) / Math.max(1, baseRefMechanicalRpm);
  const manualRpmStressMultiplier = Math.max(0.7, 1.1 - rpmMarginRatio * 1.1);

  const catalystReliabilityPenalty = isDiesel
    ? catalystSpec.reliabilityPenaltyDieselPercent * 0.22
    : catalystSpec.reliabilityPenaltyPetrolPercent * 0.5;

  const turboPositionReliabilityDelta =
    config.turboType === 'NaturallyAspirated' ? 0 : turboPosSpec.reliabilityDeltaPercent * 0.45;

  const materialProtectionFactor = Math.max(0.55, 1.38 / avgMaterialResistance);

  // Stress termico e meccanico continuo:
  // 1) Potenza specifica (CV/L) oltre 60 CV/L
  const specificPowerHpPerLiter = peakPowerHp / Math.max(0.4, exactLiters);
  const specificPowerStressPenalty =
    Math.max(0, specificPowerHpPerLiter - 60) * 0.032 * materialProtectionFactor;

  // 2) Velocità media del pistone al limitatore (m/s) e regime assoluto
  const redlinePistonSpeedMs = (2 * config.strokeMm * redlineRpm) / 60_000;
  const pistonSpeedAndRpmPenalty =
    Math.max(0, redlinePistonSpeedMs - (isDiesel ? 14.5 : 15.5)) * 0.34 +
    Math.max(0, redlineRpm - (isDiesel ? 4600 : 6400)) * 0.00085;

  // 3) Pressione di sovralimentazione e BMEP
  const boostAndBmepPenalty =
    ((config.turboType === 'NaturallyAspirated'
      ? 0
      : config.boostPressureBar * 1.35 +
        Math.max(0, config.boostPressureBar - 1.6) * 1.4) +
      Math.max(0, peakBmepBar - 13.5) * 0.14) *
    materialProtectionFactor;

  // 4) Complessità frazionamento e sovralimentazione multi-stadio
  const complexityPenalty =
    Math.max(0, config.cylinders - 4) * 0.36 +
    (config.turboType === 'NaturallyAspirated'
      ? 0
      : (turboCountSpec.turbineCount - 1) * 0.55 +
        (config.turboType === 'Twincharged' ? 1.5 : 0));

  const highCrReliabilityPenalty =
    Math.max(0, config.compressionRatio - (isDiesel ? 18.2 : 12.2)) * 0.45;

  const overbuiltMaterialBonus = (avgMaterialResistance - 1.15) * 5.2;
  const simpleValvetrainBonus =
    camSpec.id === 'cam-ohv' || (camSpec.id === 'cam-sohc' && config.valvesPerCylinder <= 2)
      ? 1.2
      : 0.0;
  const boxerBalanceReliabilityBonus = config.architecture === 'Boxer' ? 0.6 : 0;

  const bmepMechanicalStress =
    peakBmepBar > 26
      ? 0.28 + (peakBmepBar - 26) * 0.055
      : peakBmepBar > 15
        ? (peakBmepBar - 15) * 0.025
        : 0;

  const totalMechanicalStress = Number(
    (
      (((blockSpec.stressFactor +
        pistonSpec.stressFactor +
        conrodSpec.stressFactor +
        crankSpec.stressFactor) /
        4) +
        bmepMechanicalStress +
        (config.turboType !== 'NaturallyAspirated'
          ? turboSpec.stressAdd * 0.55 + config.boostPressureBar * 0.14
          : 0) +
        (config.turboPosition === 'HotV' &&
        config.turboType !== 'NaturallyAspirated'
          ? 0.08
          : 0) +
        catalystReliabilityPenalty * 0.02 +
        knockWarning.reliabilityPenaltyPercent * 0.035) *
      manualRpmStressMultiplier
    ).toFixed(2),
  );

  const estimatedLifespanKm = calculateEstimatedDurabilityKm(
    config.priceTier,
    config.referenceClass,
    avgMaterialResistance,
    totalMechanicalStress,
  );

  const rawReliabilityPercent =
    95.2 +
    overbuiltMaterialBonus +
    simpleValvetrainBonus +
    classReliabilityBonus[config.referenceClass] +
    fuelSysSpec.reliabilityDelta * 0.45 +
    boxerBalanceReliabilityBonus +
    turboPositionReliabilityDelta -
    catalystReliabilityPenalty -
    specificPowerStressPenalty -
    pistonSpeedAndRpmPenalty -
    boostAndBmepPenalty -
    complexityPenalty -
    highCrReliabilityPenalty -
    knockWarning.reliabilityPenaltyPercent +
    orientationAdapt.reliabilityDeltaPercent;

  const reliabilityPercent = Number(
    Math.min(99.0, Math.max(10.0, rawReliabilityPercent)).toFixed(1),
  );

  const { unitProductionCost } = calculateEngineCosts(config);

  return {
    curve,
    peakPowerHp,
    peakPowerRpm,
    peakTorqueNm,
    peakTorqueRpm,
    peakBmepBar,
    redlineRpm,
    maxSafeMechanicalRpm,
    knockWarning,
    dryWeightKg,
    wetWeightKg,
    thermalEfficiencyPercent,
    emissionsGPerKm,
    reliabilityPercent,
    estimatedLifespanKm,
    unitProductionCost,
  };
}
