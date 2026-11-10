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
  turboStagesDiametersMm?: number[];
  boostPressureBar: number;
  turboPosition: TurboPosition;
  catalystEra: CatalystEra;
  intendedOrientation: EngineOrientation;
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

/** Converte il diametro girante compressore (mm) in rapporto A/R equivalente */
export function impellerMmToArRatio(diamMm: number): number {
  return Number(Math.min(1.4, Math.max(0.35, (diamMm - 30) / 44)).toFixed(2));
}

export interface TurboStageInfo {
  index: number;
  ar: number;
  diamMm: number;
}

/** Restituisce l'array dei parametri per ciascuna singola turbina attiva (Diametro mm e A/R) */
export function getActiveTurboStages(config: PistonEngineConfigInput): TurboStageInfo[] {
  const countSpec =
    TURBO_COUNT_CONFIGS.find((tc) => tc.id === config.turboCountConfig) ??
    TURBO_COUNT_CONFIGS[0];
  const n = countSpec.turbineCount;
  const rawAr = config.turboStagesArRatios ?? [];
  const rawDiam = config.turboStagesDiametersMm ?? [];
  const result: TurboStageInfo[] = [];
  for (let i = 0; i < n; i++) {
    let ar = rawAr[i] !== undefined ? rawAr[i] : (config.turboArRatio || 0.65);
    let diamMm = rawDiam[i] !== undefined ? rawDiam[i] : arRatioToImpellerMm(ar);
    ar = Math.min(1.4, Math.max(0.35, ar));
    diamMm = Math.min(95, Math.max(35, diamMm));
    result.push({ index: i, ar, diamMm });
  }
  return result;
}

/** Restituisce l'array normalizzato dei rapporti A/R per il numero effettivo di turbine attive */
export function getActiveTurboStagesAr(config: PistonEngineConfigInput): number[] {
  return getActiveTurboStages(config).map((s) => s.ar);
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

  return Math.min(
    isDiesel ? 5800 : 13000,
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
      ? 14.6
      : config.fuelType === 'BioFuel'
        ? 13.8
        : 12.1;

  const gdiCoolingBonusCr = config.fuelSystemId === 'fs-gdi-350bar' ? 0.9 : 0.0;
  const headThermalBonusCr =
    config.headMaterialId === 'hd-cast-iron'
      ? -0.6
      : config.headMaterialId === 'hd-alu-t6'
        ? 0.4
        : 0.0;

  // Ogni bar di boost riduce il CR statico massimo tollerabile senza detonazione di ~1.75 punti
  const effectiveBoostBar =
    config.turboType === 'NaturallyAspirated' ? 0 : config.boostPressureBar;
  const boostCrReduction = effectiveBoostBar * 1.75;

  const maxSafeCr = Number(
    Math.max(
      7.2,
      baseOctaneSafeCr + gdiCoolingBonusCr + headThermalBonusCr - boostCrReduction,
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

  if (config.intendedOrientation === 'Trasversale') {
    baseLengthMm -= 15;
    baseWidthMm += 22;
  } else {
    baseLengthMm += 18;
    baseWidthMm -= 15;
  }

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

  // Costo scalare per ogni singola turbina in base al suo diametro mm e A/R individuale
  let turboSystemUnitCost = 0;
  if (config.turboType !== 'NaturallyAspirated') {
    const activeStages = getActiveTurboStages(config);
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
      Math.max(...activeStages.map((s) => s.diamMm)) -
        Math.min(...activeStages.map((s) => s.diamMm)) >=
        6;
    const sequentialValveCostMultiplier = isAsymmetricSequential ? 1.12 : 1.0;

    const sumStageCosts = activeStages.reduce((acc, stage) => {
      const diamScaling = Math.pow(stage.diamMm / 55, 1.35);
      const arScaling = Math.pow(stage.ar / 0.65, 0.45);
      return acc + turboSpec.baseUnitCost * diamScaling * arScaling;
    }, 0);

    turboSystemUnitCost = Math.round(
      sumStageCosts *
        tierTurboMultiplier[config.priceTier] *
        bearingMultiplier *
        turboPosSpec.turboCostMultiplier *
        sequentialValveCostMultiplier,
    );
  }

  const unitProductionCost = Math.round(
    coreMechanicalCost +
      fuelSysSpec.unitCost * Math.pow(cylinderFactor, 0.65) +
      intakeSpec.cost +
      exhaustSpec.cost * (config.architecture === 'Inline' ? 1.0 : 1.35) +
      turboSystemUnitCost +
      catalystSpec.unitCost,
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

  // 1. Limite Fisico Meccanico e Limitatore Manuale (che tronca soltanto la curva senza deformarla!)
  const maxSafeMechanicalRpm = calculateMaxSafeMechanicalRpm(config);
  const redlineRpm = Math.min(
    maxSafeMechanicalRpm,
    Math.max(3000, Math.round((config.manualRedlineRpm || maxSafeMechanicalRpm) / 100) * 100),
  );

  // 2. Valutazione Rapporto di Compressione e Rischio Detonazione (Knock)
  const knockWarning = evaluateCompressionAndKnock(config);
  const knockPowerMultiplier = 1 - knockWarning.powerPenaltyPercent / 100;

  // Guadagno termodinamico reale da Rapporto di Compressione (+3.5% Coppia/Potenza per ogni punto di CR su ciclo Otto, +2.2% su Diesel)
  // Applicato direttamente alle prestazioni senza essere azzerato da tetti intermedi!
  const refCr = isDiesel ? 16.5 : 9.5;
  const crStepGain = isDiesel ? 0.022 : 0.035;
  const crPerformanceMultiplier = Math.max(
    0.78,
    1 + (config.compressionRatio - refCr) * crStepGain,
  );

  // 3. Effetto Fisico Rapporto Corsa/Alesaggio (S/B = strokeMm / boreMm):
  // - Corsa Lunga (S/B > 1.0): camera raccolta, minor dispersione termica al PMS e forte inerzia nei condotti -> +Coppia (Nm) fino a +16%
  // - Corsa Corta (S/B < 1.0): camera piatta, meno coppia ai bassi/medi (-10%), ma valvole più grandi e altissimi RPM per fare +CV in alto!
  const sbDelta = geom.strokeBoreRatio - 0.96;
  const strokeBoreTorqueMultiplier = Math.min(
    1.18,
    Math.max(0.88, 1 + sbDelta * 0.25),
  );

  // 4. Calcolo BMEP Aspirata Base (in bar)
  const valveBmepBonusBar =
    config.valvesPerCylinder === 2
      ? 0.0
      : config.valvesPerCylinder === 3
        ? 0.55
        : config.valvesPerCylinder === 4
          ? 1.15
          : 1.5;

  const fuelBmepBonusBar =
    config.fuelType === 'RaceFuel'
      ? 1.25
      : config.fuelType === 'BioFuel'
        ? 0.65
        : config.fuelType === 'Diesel'
          ? -0.8
          : 0.0;

  const rawNaComponentBmepBar =
    9.6 +
    blockSpec.bmepDeltaBar +
    headSpec.bmepDeltaBar +
    pistonSpec.bmepDeltaBar +
    conrodSpec.bmepDeltaBar +
    crankSpec.bmepDeltaBar +
    camSpec.bmepDeltaBar +
    fuelSysSpec.bmepDeltaBar +
    intakeSpec.bmepDeltaBar +
    exhaustSpec.bmepDeltaBar +
    valveBmepBonusBar +
    fuelBmepBonusBar;

  // Il moltiplicatore di Compressione (CR) e Corsa/Alesaggio (S/B) agiscono direttamente sulla BMEP!
  const peakNaBmepBar = Math.max(
    7.0,
    rawNaComponentBmepBar * crPerformanceMultiplier * strokeBoreTorqueMultiplier,
  );

  const catalystPowerFactor = 1 - catalystSpec.powerPenaltyPercent / 100;
  const activeTurboStagesAr = getActiveTurboStagesAr(config);

  // 5. Capacità di Portata Massica d'Aria del Sistema Multi-Turbo (Single vs Twin vs Triple vs Quad):
  // Ogni turbina ha una portata massima d'aria proporzionale all'area della sua girante compressore.
  // Su motori di media/grande cilindrata o ad alta pressione boost:
  // - 1 Singola Turbina va in "choke" (mura per portata insufficiente o contropressione scarico)
  // - 2, 3 o 4 Turbine moltiplicano la portata d'aria complessiva e dimezzano le interferenze di scarico,
  //   aumentando drasticamente sia la Coppia (Nm) sia la Potenza (CV) agli alti regimi!
  const totalCompressorFlowCapacity = activeTurboStagesAr.reduce(
    (sum, stageAr) => sum + (0.62 + Math.pow(stageAr, 1.28) * 1.35),
    0,
  );
  const engineAirFlowDemand =
    (exactLiters / 2.0) * (0.7 + config.boostPressureBar * 0.52);
  const flowMatchRatio =
    totalCompressorFlowCapacity / Math.max(0.45, engineAirFlowDemand);

  // Efficienza di sovralimentazione in funzione del numero di turbine e della copertura di portata
  const multiTurboFlowEfficiency = Math.min(
    1.45,
    0.76 +
      0.24 * Math.min(1.35, Math.pow(flowMatchRatio, 0.48)) +
      (turboCountSpec.turbineCount - 1) * 0.085,
  );

  // RPM fisici di picco riempimento volumetrico (la corsa lunga sposta la coppia molto più in basso, la corsa corta molto più in alto)
  const naturalPeakTorqueRpm = isDiesel
    ? Math.round(1950 + (90 - config.strokeMm) * 18)
    : Math.round(
        3850 +
          (86 - config.strokeMm) * 36 +
          (camSpec.id === 'cam-ohv' ? -650 : camSpec.id === 'cam-sohc' ? -250 : 350) +
          (config.valvesPerCylinder - 3) * 220 +
          (config.intakeSystemId === 'int-itb-carbon' ? 550 : 0),
      );

  // Velocità media critica del flusso valvole (m/s): un motore a corsa corta (alesaggio grande = valvole grandi) respira molto più in alto!
  const boreToStrokeBreathingBonus = (1 / Math.max(0.6, geom.strokeBoreRatio) - 1) * 2.8;
  const chokePistonSpeedMs = isDiesel
    ? 13.2 + boreToStrokeBreathingBonus * 0.5
    : 15.8 +
      boreToStrokeBreathingBonus +
      (config.valvesPerCylinder - 2) * 1.4 +
      (camSpec.id.startsWith('cam-dohc') ? 1.9 : 0) +
      (intakeSpec.highRpmMod - 1.0) * 12;

  const curve: DynoCurvePoint[] = [];
  let peakPowerHp = 0;
  let peakPowerRpm = 1000;
  let peakTorqueNm = 0;
  let peakTorqueRpm = 1000;
  let peakBmepBar = 0;

  // Campionamento ogni 100 RPM da 1000 RPM fino a redlineRpm (troncamento puro senza deformazione!)
  for (let rpm = 1000; rpm <= redlineRpm; rpm += 100) {
    const pistonSpeedMs = (2 * config.strokeMm * rpm) / 60_000;

    // 1. Forma morbida Gaussiana del riempimento volumetrico aspirato
    const rpmDeltaFromPeak = (rpm - naturalPeakTorqueRpm) / 2900;
    const widthAsymmetry = rpm < naturalPeakTorqueRpm ? 1.18 : 1.08;
    const smoothBellVe =
      0.78 + 0.22 * Math.exp(-Math.pow(rpmDeltaFromPeak / widthAsymmetry, 2));

    // Effetto dinamico Corsa Lunga vs Corsa Corta lungo i giri:
    // Corsa lunga spinge forte ai bassi/medi (1000-4200 rpm), Corsa corta respira meglio oltre i 5000 rpm
    const lowMidRpmStrokeBonus =
      rpm < 4500 ? 1 + sbDelta * 0.08 * ((4500 - rpm) / 3500) : 1.0;

    // Decadimento fisiologico agli alti giri per soffocamento valvole e velocità pistone
    const excessPistonSpeed = Math.max(0, pistonSpeedMs - chokePistonSpeedMs);
    const highRpmChokeFactor =
      1 / (1 + Math.pow(excessPistonSpeed / 5.4, 1.85));

    // Modificatori caratteristici di erogazione per architettura
    let archFlowModifier = 1.0;
    if (config.architecture === 'Inline') {
      archFlowModifier =
        1.0 + 0.025 * Math.exp(-Math.pow((rpm - 3400) / 1500, 2));
    } else if (config.architecture === 'Boxer') {
      archFlowModifier =
        1.0 + 0.03 * Math.exp(-Math.pow((rpm - 3700) / 1600, 2));
    } else if (isVR15) {
      const lowBonus = 0.025 * Math.exp(-Math.pow((rpm - 2200) / 1100, 2));
      const highPenalty = rpm > 4200 ? Math.min(0.035, ((rpm - 4200) / 4000) * 0.035) : 0;
      archFlowModifier = 1.0 + lowBonus - highPenalty;
    } else if (config.architecture === 'V') {
      const highBonus = rpm > 4800 ? Math.min(0.025, ((rpm - 4800) / 3800) * 0.025) : 0;
      archFlowModifier = 1.0 + highBonus;
    } else if (config.architecture === 'W') {
      const frictionLoss = rpm > 4500 ? Math.min(0.025, ((rpm - 4500) / 4000) * 0.025) : 0;
      archFlowModifier = 1.0 - frictionLoss;
    }

    let currentBmepBar =
      peakNaBmepBar *
      smoothBellVe *
      lowMidRpmStrokeBonus *
      highRpmChokeFactor *
      archFlowModifier;

    // 2. Calcolo Sovralimentazione Morbida (Multi-Turbo Individuale / E-Turbo / Volumetrico)
    if (config.turboType !== 'NaturallyAspirated') {
      // Guadagno reale di BMEP dal boost e dal numero/portata delle turbine (senza taglio Math.tanh del -24%!)
      const effectiveBoostGain =
        config.boostPressureBar *
        0.72 *
        turboSpec.highEndEfficiency *
        multiTurboFlowEfficiency;

      const targetForcedPeakBmepBar = peakNaBmepBar * (1 + effectiveBoostGain);

      if (config.turboType === 'Supercharger') {
        const rootsRamp = 0.88 + 0.12 * Math.sin(Math.min(Math.PI / 2, (rpm - 1000) / 1600));
        const rootsParasiticRollOff =
          rpm > 3400 ? Math.pow((rpm - 3400) / 5200, 1.75) * 0.25 : 0;

        currentBmepBar =
          targetForcedPeakBmepBar *
          Math.max(0.38, rootsRamp - rootsParasiticRollOff) *
          lowMidRpmStrokeBonus *
          highRpmChokeFactor *
          archFlowModifier;
      } else {
        // Calcolo combinato di ogni singola turbina (incluso E-Turbo!) in base al suo diametro/A/R individuale e al numero totale di turbine
        const activeStages = getActiveTurboStages(config);
        const bearingSpoolBonusRpm =
          config.turboBearingType === 'BallBearing' ? -360 : 0;
        const hotVSpoolBonusRpm = config.turboPosition === 'HotV' ? -240 : 0;

        let fastestStageSpool = 0;
        let sumStageSpool = 0;
        let sumStageHighFlow = 0;

        activeStages.forEach((stage) => {
          const inertiaDelta = (stage.diamMm - 50) * 36;
          const arDelta = (stage.ar - 0.65) * 1200;
          const stageSpoolRpm = Math.max(
            1200,
            turboSpec.spoolRpmBase +
              bearingSpoolBonusRpm +
              hotVSpoolBonusRpm +
              turboCountSpec.spoolRpmBonus +
              inertiaDelta +
              arDelta,
          );

          const stageSigmoid = 1 / (1 + Math.exp(-(rpm - stageSpoolRpm) / 460));
          const lowFloor = turboSpec.lowEndBoostFactor * 0.24;
          const stageSpool = lowFloor + (1 - lowFloor) * stageSigmoid;

          // Regime oltre il quale la singola turbina inizia a murare per portata:
          // Con più turbine (Twin/Triple/Quad), ogni turbina alimenta meno cilindri e quindi mura molto più in alto!
          const perTurbineDisplacementLiters =
            exactLiters / activeStages.length;
          const displacementChokeShiftRpm = (1.5 - perTurbineDisplacementLiters) * 680;
          const stageChokeRpm =
            4800 +
            (stage.diamMm - 35) * 75 +
            stage.ar * 2100 +
            displacementChokeShiftRpm;

          const stageHighRollOff =
            rpm > stageChokeRpm
              ? 1 / (1 + Math.pow((rpm - stageChokeRpm) / 2800, 1.85))
              : 1.0;

          fastestStageSpool = Math.max(fastestStageSpool, stageSpool);
          sumStageSpool += stageSpool;
          sumStageHighFlow += stageHighRollOff;
        });

        const avgStageSpool = sumStageSpool / activeStages.length;
        const avgStageHighFlow = sumStageHighFlow / activeStages.length;

        // Se le turbine hanno taglie diverse (es. Turbina #1 piccola + Turbina #2 grande),
        // la piccola garantisce lo spool immediato ai bassi e la grande la portata agli alti!
        const isAsymmetricStages =
          activeStages.length >= 2 &&
          Math.max(...activeStages.map((s) => s.diamMm)) -
            Math.min(...activeStages.map((s) => s.diamMm)) >=
            6;

        const exhaustDrivenSpool = isAsymmetricStages
          ? 0.72 * fastestStageSpool + 0.28 * avgStageSpool
          : 0.35 * fastestStageSpool + 0.65 * avgStageSpool;

        // L'E-Turbo usa il motore elettrico coassiale per partire dall'85% già a 1000 rpm e raggiungere il 100% a ~2100 rpm
        // azzerando il lag anche con giranti A/R enormi, mantenendo poi tutta la portata e il bonus Multi-Turbo agli alti giri!
        const eTurboLowRamp =
          0.85 + 0.15 * (1 - Math.exp(-Math.pow((rpm - 1000) / 680, 1.65)));
        const effectiveSpool =
          config.turboType === 'ETurbo'
            ? Math.max(exhaustDrivenSpool, eTurboLowRamp)
            : exhaustDrivenSpool;

        // Con più turbine o stadi asimmetrici, il mantenimento della pressione agli alti regimi migliora nettamente
        const multiStageHighBreathing = Math.min(
          1.05,
          avgStageHighFlow * (1 + (activeTurboStagesAr.length - 1) * 0.04),
        );

        const minAr = Math.min(...activeTurboStagesAr);
        const naturalBoostPeakRpm =
          config.turboType === 'ETurbo'
            ? 2600 + minAr * 950
            : 2800 + minAr * 1550;
        const boostDomeCrown =
          0.95 +
          0.05 * Math.exp(-Math.pow((rpm - naturalBoostPeakRpm) / 2600, 2));

        const naOffBoostBmep =
          peakNaBmepBar *
          smoothBellVe *
          0.85 *
          lowMidRpmStrokeBonus *
          highRpmChokeFactor;

        const fullBoostBmep =
          targetForcedPeakBmepBar *
          boostDomeCrown *
          multiStageHighBreathing *
          lowMidRpmStrokeBonus *
          highRpmChokeFactor;

        currentBmepBar =
          (naOffBoostBmep * (1 - effectiveSpool) + fullBoostBmep * effectiveSpool) *
          archFlowModifier;
      }
    }

    // Applica contropressione catalizzatore e eventuale taglio potenza da Detonazione (Knock)
    currentBmepBar = Number(
      (currentBmepBar * catalystPowerFactor * knockPowerMultiplier).toFixed(2),
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

  // 6. Peso Realistico e Più Contenuto (snellito del ~14% su monoblocco, testate e turbine singole)
  const archWeightFactor =
    config.architecture === 'Inline'
      ? 1.0
      : config.architecture === 'V'
        ? 1.06
        : config.architecture === 'Boxer'
          ? 1.11
          : 1.18;

  const headBankFactor =
    config.architecture === 'Inline'
      ? 1.0
      : isVR15
        ? 1.12
        : config.architecture === 'W'
          ? 1.95
          : 1.42;

  const bottomEndWeightKg =
    (10 + exactLiters * 29.0 + config.cylinders * 2.8) *
    archWeightFactor *
    blockSpec.weightFactor *
    ((pistonSpec.weightFactor + conrodSpec.weightFactor + crankSpec.weightFactor) / 3);

  const dispScaleForHeads = 0.32 + exactLiters * 0.22;
  const cylinderHeadsWeightKg =
    (3.5 + exactLiters * 6.8) * headBankFactor * headSpec.weightFactor +
    (camSpec.headWeightAddKgPerCyl + (config.valvesPerCylinder - 2) * 0.45) *
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

  const exhaustWeightScale = Math.min(1.25, 0.45 + exactLiters * 0.24);
  const dryWeightKg = Math.max(
    45,
    Math.round(
      bottomEndWeightKg +
        cylinderHeadsWeightKg +
        exhaustSpec.weightKg *
          (config.architecture === 'Inline' ? 1.0 : 1.22) *
          exhaustWeightScale +
        turboSystemWeightKg +
        catalystSpec.weightAddKg * Math.min(1.1, 0.5 + exactLiters * 0.2),
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
  // Progressiva e bilanciata (niente crollo del 3% per +0.05 bar!), mitigata dalla resistenza dei componenti forgiati.
  const avgMaterialResistance =
    (blockSpec.materialResistance +
      headSpec.materialResistance +
      pistonSpec.materialResistance +
      conrodSpec.materialResistance +
      crankSpec.materialResistance +
      camSpec.materialResistance) /
    6;

  const tierReliabilityBonus: Record<PriceTier, number> = {
    Economica: 0.0,
    Media: 2.5,
    Premium: 5.5,
    Lusso: 8.5,
  };

  const classReliabilityBonus: Record<ReferenceClass, number> = {
    Normale: 2.5,
    Comfort: 3.5,
    Fuoristrada: 2.0,
    Sport: 0.0,
    Corsa: -14.0,
  };

  // Il riferimento di sicurezza rimane ancorato al vecchio tetto di 11.000 rpm (non vede i 13k come i vecchi 11k!):
  // fino a 11k il comportamento è identico a prima, mentre spingersi tra 11k e 13k aumenta progressivamente lo stress.
  const baseRefMechanicalRpm = Math.min(
    isDiesel ? 5800 : 11000,
    maxSafeMechanicalRpm,
  );
  const rpmMarginRatio =
    (baseRefMechanicalRpm - redlineRpm) / Math.max(1, baseRefMechanicalRpm);
  const manualRpmReliabilityBonus = rpmMarginRatio * 24 - 1.5;
  const manualRpmStressMultiplier = Math.max(0.7, 1.1 - rpmMarginRatio * 1.1);

  const catalystReliabilityPenalty = isDiesel
    ? catalystSpec.reliabilityPenaltyDieselPercent
    : catalystSpec.reliabilityPenaltyPetrolPercent;

  const turboPositionReliabilityDelta =
    config.turboType === 'NaturallyAspirated' ? 0 : turboPosSpec.reliabilityDeltaPercent;

  // Penalità da pressione Boost e BMEP unificata e mitigata dalla resistenza dei materiali:
  // +0.05 bar varia l'affidabilità di ~0.2% - 0.3%, non del 3%!
  const materialProtectionFactor = Math.max(0.55, 1.65 / avgMaterialResistance);
  const boostAndBmepPenalty =
    (config.turboType === 'NaturallyAspirated'
      ? 0
      : config.boostPressureBar * 3.8 +
        Math.max(0, config.boostPressureBar - 1.6) * 4.5) *
      materialProtectionFactor +
    Math.max(0, peakBmepBar - 22) * 0.45 * materialProtectionFactor;

  const highCrReliabilityPenalty =
    Math.max(0, config.compressionRatio - (isDiesel ? 17.5 : 11.0)) * 0.9;

  const boxerBalanceReliabilityBonus = config.architecture === 'Boxer' ? 2.2 : 0;

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
    86.5 +
    (avgMaterialResistance - 1.15) * 16.0 +
    tierReliabilityBonus[config.priceTier] +
    classReliabilityBonus[config.referenceClass] +
    fuelSysSpec.reliabilityDelta +
    manualRpmReliabilityBonus +
    boxerBalanceReliabilityBonus +
    turboPositionReliabilityDelta -
    catalystReliabilityPenalty -
    boostAndBmepPenalty -
    highCrReliabilityPenalty -
    knockWarning.reliabilityPenaltyPercent;

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
