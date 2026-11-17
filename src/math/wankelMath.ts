import {
  APEX_SEAL_MATERIALS,
  CATALYST_ERAS,
  OIL_METERING_SYSTEMS,
  TURBO_COUNT_CONFIGS,
  TURBO_POSITIONS,
  TURBO_SYSTEMS,
  WANKEL_HOUSING_MATERIALS,
  WANKEL_PORTING_TYPES,
} from '../data/historicalEras';
import {
  type CatalystEra,
  type DimensionsLWH,
  type DualCurrencyCost,
  type DynoCurvePoint,
  type EngineDynoTelemetry,
  type EngineOrientation,
  type KnockWarningInfo,
  type PriceTier,
  type ReferenceClass,
  type TurboCountConfig,
  type TurboPosition,
  type TurboType,
  type WankelPortType,
} from '../types/gameTypes';
import { calculateOrientationMechanicalAdaptation } from './volumeMath';

export interface WankelEngineConfigInput {
  rotorCount: number; // 1, 2, 3, 4
  generatingRadiusMm: number; // R (es. 100 - 115 mm, standard 105)
  eccentricityMm: number; // e (es. 13 - 17 mm, standard 15)
  rotorWidthMm: number; // B (es. 65 - 90 mm, standard 80)
  portType: WankelPortType;
  apexSealMaterialId: string;
  apexSealThicknessMm: 2.0 | 3.0;
  housingMaterialId: string;
  oilMeteringSystemId: string;
  compressionRatio: number; // 8.0:1 a 11.2:1
  fuelType: 'Benzina' | 'BioFuel' | 'RaceFuel';
  turboType: TurboType;
  turboCountConfig: TurboCountConfig;
  turboBearingType: 'Journal' | 'BallBearing';
  turboArRatio: number;
  turboStagesArRatios: number[];
  turboStagesDiametersMm?: number[];
  boostPressureBar: number;
  turboPosition: TurboPosition;
  manualRedlineRpm: number;
  intendedOrientation: EngineOrientation;
  nativeOrientation?: EngineOrientation;
  catalystEra: CatalystEra;
  priceTier: PriceTier;
  referenceClass: ReferenceClass;
}

export interface WankelGeometryMetrics {
  unitDisplacementCc: number;
  totalDisplacementCc: number;
  displacementLiters: number;
  equivalentDisplacementCc: number;
  equivalentLiters: number;
  kFactor: number;
  dimensionsMm: DimensionsLWH;
}

export interface WankelTurboStageInfo {
  index: number;
  ar: number;
  diamMm: number;
}

/** Converte il rapporto A/R (0.35 - 1.40) in diametro girante compressore in millimetri (mm) */
export function arRatioToImpellerMm(arRatio: number): number {
  return Math.round(30 + arRatio * 44);
}

/** Converte il diametro girante compressore (mm) in rapporto A/R equivalente */
export function impellerMmToArRatio(diamMm: number): number {
  return Number(Math.min(1.4, Math.max(0.35, (diamMm - 30) / 44)).toFixed(2));
}

/** Restituisce l'array dei parametri per ciascuna singola turbina attiva (Diametro mm e A/R) */
export function getActiveWankelTurboStages(config: WankelEngineConfigInput): WankelTurboStageInfo[] {
  const countSpec =
    TURBO_COUNT_CONFIGS.find((tc) => tc.id === config.turboCountConfig) ??
    TURBO_COUNT_CONFIGS[0];
  const n = countSpec.turbineCount;
  const rawAr = config.turboStagesArRatios ?? [];
  const rawDiam = config.turboStagesDiametersMm ?? [];
  const result: WankelTurboStageInfo[] = [];
  for (let i = 0; i < n; i++) {
    const hasAr = rawAr[i] !== undefined;
    const hasDiam = rawDiam[i] !== undefined;
    let ar = hasAr
      ? rawAr[i]
      : hasDiam
        ? impellerMmToArRatio(rawDiam[i])
        : config.turboArRatio || 0.65;
    ar = Math.min(1.4, Math.max(0.35, ar));
    let diamMm = hasDiam && !hasAr ? rawDiam[i] : arRatioToImpellerMm(ar);
    if (hasDiam && hasAr && Math.abs(rawDiam[i] - arRatioToImpellerMm(ar)) > 2) {
      diamMm = rawDiam[i];
    }
    diamMm = Math.min(95, Math.max(35, diamMm));
    result.push({ index: i, ar, diamMm });
  }
  return result;
}

/** Restituisce l'array normalizzato dei rapporti A/R per il numero effettivo di turbine attive */
export function getActiveWankelTurboStagesAr(config: WankelEngineConfigInput): number[] {
  return getActiveWankelTurboStages(config).map((s) => s.ar);
}

/**
 * Calcola cilindrata unitaria della camera (Vk = 3 * sqrt(3) * e * R * B),
 * cilindrata complessiva dei rotori, cilindrata equivalente (fattore 2.0x) e ingombro 3D LWH.
 */
export function calculateWankelGeometryAndDimensions(
  config: WankelEngineConfigInput,
): WankelGeometryMetrics {
  const e = config.eccentricityMm;
  const R = config.generatingRadiusMm;
  const B = config.rotorWidthMm;

  // Formula esatta della camera di volume epitrocoidale Wankel:
  // V_k = 3 * sqrt(3) * e * R * B
  const chamberVolumeMm3 = 3 * Math.sqrt(3) * e * R * B;
  const unitDisplacementCc = Math.round(chamberVolumeMm3 / 1000);
  const totalDisplacementCc = unitDisplacementCc * config.rotorCount;
  const displacementLiters = Number((totalDisplacementCc / 1000).toFixed(3));

  // Equivalenza tassazione / motorsport FIA: 2.0x (1 combustione per rotore a ogni giro d'albero)
  const equivalentDisplacementCc = totalDisplacementCc * 2;
  const equivalentLiters = Number((equivalentDisplacementCc / 1000).toFixed(3));
  const kFactor = Number((R / e).toFixed(2));

  // Dimensioni fisiche reali in mm (scalate fisicamente col raggio trocoide R/105 e numero rotori)
  const rotorGeomScale = Math.max(0.75, R / 105);
  const rotorLengthOffsetMm =
    config.rotorCount === 1
      ? -18
      : config.rotorCount === 3
        ? 22
        : config.rotorCount >= 4
          ? 40
          : 0;
  let baseLengthMm =
    config.rotorCount * (B + 25) +
    244 * Math.pow(rotorGeomScale, 0.55) +
    rotorLengthOffsetMm;

  // Larghezza W: trocoide (2*(R+e)) + collettori scarico/aspirazione e carter proporzionati a R
  const trochoidWidthMm = 2 * (R + e) + 178 * Math.pow(rotorGeomScale, 0.55);
  let baseWidthMm = trochoidWidthMm;

  // Altezza H: trocoide (2*(R-e) asse minore) + coppa olio inferiore + plenum aspirazione proporzionati a R
  const trochoidHeightMm =
    2 * (R - e) +
    297 * Math.pow(rotorGeomScale, 0.72) +
    (config.rotorCount === 1 ? -14 : 0);
  let baseHeightMm = trochoidHeightMm;

  const orientationAdapt = calculateOrientationMechanicalAdaptation(
    config.nativeOrientation,
    config.intendedOrientation,
  );
  baseLengthMm += orientationAdapt.lengthDeltaMm;
  baseWidthMm += orientationAdapt.widthDeltaMm;

  if (config.turboType !== 'NaturallyAspirated') {
    const posSpec =
      TURBO_POSITIONS.find((p) => p.id === config.turboPosition) ?? TURBO_POSITIONS[0];
    const activeStages = getActiveWankelTurboStagesAr(config);
    const maxStageAr = Math.max(...activeStages);
    const arScale = 0.70 + maxStageAr * 0.50;

    // Fisica direzionale pura:
    // - Front: aumenta SOLO L (ΔW=0, ΔH=0)
    // - Lateral (Side-Mount): aumenta SOLO W (ΔL=0, ΔH=0); due turbine sequenziali affiancate sul fianco statore NON allungano né alzano
    if (config.turboPosition === 'Front') {
      baseLengthMm += posSpec.lengthAddMm * arScale;
    } else if (config.turboPosition === 'HotV') {
      const hotVExcessH = maxStageAr <= 0.70 ? 0 : Math.min(30, (maxStageAr - 0.70) * 56);
      baseHeightMm += hotVExcessH;
    } else {
      baseWidthMm += (posSpec.widthAddMm + 14) * arScale;
    }
  }

  return {
    unitDisplacementCc,
    totalDisplacementCc,
    displacementLiters: Number(displacementLiters.toFixed(2)),
    equivalentDisplacementCc,
    equivalentLiters: Number(equivalentLiters.toFixed(2)),
    kFactor,
    dimensionsMm: {
      lengthMm: Math.round(baseLengthMm),
      widthMm: Math.round(baseWidthMm),
      heightMm: Math.round(baseHeightMm),
    },
  };
}

/**
 * Calcola il limite fisico massimo di rotazione (RPM di rottura) del motore Wankel.
 * Nei rotativi non ci sono bielle e valvole: il limite è imposto dalla velocità periferica
 * delle guarnizioni apicali (Apex Seal) sulla trocoide e dal disegno delle luci di aspirazione/scarico.
 */
export function calculateMaxSafeWankelRpm(config: WankelEngineConfigInput): number {
  const sealSpec =
    APEX_SEAL_MATERIALS.find((s) => s.id === config.apexSealMaterialId) ??
    APEX_SEAL_MATERIALS[0];
  const portSpec =
    WANKEL_PORTING_TYPES.find((p) => p.id === config.portType) ??
    WANKEL_PORTING_TYPES[0];
  const housingSpec =
    WANKEL_HOUSING_MATERIALS.find((h) => h.id === config.housingMaterialId) ??
    WANKEL_HOUSING_MATERIALS[0];

  // Velocità limite apex seal (m/s) in base al raggio di generazione R
  // R standard 105 mm -> a 9.000 rpm la punta dell'apex viaggia a oltre 33 m/s!
  const baseSafeRpm = Math.round((28.5 * 30_000) / config.generatingRadiusMm);

  // Fisica eccentricità albero e (corsa/raggio orbitale eccentrico del rotore):
  // - e ridotto (12 mm): raggio d'orbita piccolo, bassa forza centrifuga rotorica e inclinazione apex ridotta (+750 rpm)
  // - e maggiorato (18 mm): elevata massa centrifuga orbitale, momento flettente gravoso sull'albero e chattering (-750 rpm)
  const eccentricityRpmDelta = Math.round((15.0 - config.eccentricityMm) * 250);

  // Fisica spessore Apex Seal:
  // - 2.0 mm: più leggero (-33% massa), riduce l'attrito centrifugo e permette +600 rpm prima di chattering / sollevamento tenuta
  // - 3.0 mm: più pesante, maggiore inerzia centrifuga sulle cave del rotore (-500 rpm sul regime massimo sicuro)
  const thicknessBonusRpm = config.apexSealThicknessMm === 2.0 ? 600 : -500;
  const housingRpmBonus = Math.round((housingSpec.wearResistance - 1.0) * 450);

  // Più rotori hanno un albero eccentrico più lungo con torsione aggiuntiva oltre i 2 rotori
  const multiRotorTorsionPenalty =
    config.rotorCount === 1 ? 250 : config.rotorCount === 2 ? 0 : config.rotorCount === 3 ? -350 : -650;

  const rawMaxRpm =
    baseSafeRpm +
    eccentricityRpmDelta +
    sealSpec.rpmDelta +
    portSpec.rpmLimitBonus +
    thicknessBonusRpm +
    housingRpmBonus +
    multiRotorTorsionPenalty;

  return Math.min(13000, Math.max(5500, Math.round(rawMaxRpm / 100) * 100));
}

/**
 * Valuta il rischio di Detonazione (Knock) e cedimento Apex Seal su Wankel.
 * A differenza dei pistoni, il Wankel non sopporta il battito in testa: una singola detonazione
 * ad alta pressione può spezzare istantaneamente gli apex seal in ghisa o alluminio.
 */
export function evaluateWankelKnockAndStress(config: WankelEngineConfigInput): KnockWarningInfo {
  const catalystSpec =
    CATALYST_ERAS.find((c) => c.id === config.catalystEra) ?? CATALYST_ERAS[0];
  const housingSpec =
    WANKEL_HOUSING_MATERIALS.find((h) => h.id === config.housingMaterialId) ??
    WANKEL_HOUSING_MATERIALS[0];
  const sealSpec =
    APEX_SEAL_MATERIALS.find((s) => s.id === config.apexSealMaterialId) ??
    APEX_SEAL_MATERIALS[0];

  const isNa = config.turboType === 'NaturallyAspirated';
  const baseOctane =
    config.fuelType === 'RaceFuel' ? 11.7 : config.fuelType === 'BioFuel' ? 10.9 : 9.55;

  const naBonus = isNa
    ? catalystSpec.stageNumber >= 4
      ? 2.45
      : catalystSpec.stageNumber === 3
        ? 0.65
        : 0.35
    : catalystSpec.stageNumber >= 2
      ? 0.15
      : 0;

  const portCoolingBonusCr = isNa
    ? config.portType === 'PeripheralPort'
      ? 0.5
      : config.portType === 'SemiPeripheral'
        ? 0.3
        : config.portType === 'StreetPort'
          ? 0.2
          : 0
    : config.portType === 'PeripheralPort'
      ? 0.25
      : config.portType === 'StreetPort'
        ? 0.1
        : 0;

  const hardwareCoolingBonusCr =
    (housingSpec.id === 'whs-billet-alu-ceramic'
      ? 0.35
      : housingSpec.id === 'whs-alu-cermet-nikasil'
        ? 0.15
        : 0) +
    (!isNa && config.turboBearingType === 'BallBearing' ? 0.1 : 0) +
    (sealSpec.shatterResistance - 1.0) * 0.25;

  const effectiveBoostBar = isNa ? 0 : config.boostPressureBar;
  const thicknessBoostResistance = config.apexSealThicknessMm === 3.0 ? 1.25 : 1.0;
  const boostSlope = config.apexSealThicknessMm === 3.0 ? 1.20 : 1.32;

  const maxSafeCr = Number(
    Math.max(
      6.8,
      baseOctane +
        naBonus +
        portCoolingBonusCr +
        hardwareCoolingBonusCr -
        effectiveBoostBar * boostSlope,
    ).toFixed(1),
  );

  const knockExcessCr = Math.max(0, Number((config.compressionRatio - maxSafeCr).toFixed(1)));

  if (knockExcessCr <= 0) {
    return {
      isKnocking: false,
      knockExcessCr: 0,
      maxSafeCr,
      powerPenaltyPercent: 0,
      reliabilityPenaltyPercent: 0,
      message: `Camera Wankel stabile (Soglia Knock con ${config.fuelType}: ${maxSafeCr}:1, tenute ${(config.apexSealThicknessMm ?? 2.0).toFixed(1)}mm).`,
    };
  }

  const fragilityMultiplier = 1.6 / sealSpec.shatterResistance / thicknessBoostResistance;
  const powerPenaltyPercent = Math.min(
    55,
    Math.round(knockExcessCr * 14.0 + Math.pow(knockExcessCr, 1.5) * 4.5),
  );
  const reliabilityPenaltyPercent = Math.min(
    65,
    Math.round(knockExcessCr * 18.0 * fragilityMultiplier),
  );

  return {
    isKnocking: true,
    knockExcessCr,
    maxSafeCr,
    powerPenaltyPercent,
    reliabilityPenaltyPercent,
    message: `DETONAZIONE SU ROTATIVO: CR ${config.compressionRatio.toFixed(1)}:1 oltre limite sicuro (${maxSafeCr}:1) con ${effectiveBoostBar.toFixed(2)} bar! Rischio frantumazione Apex Seal immediata! ➔ -${powerPenaltyPercent}% Potenza, -${reliabilityPenaltyPercent}% Affidabilità.`,
  };
}

/**
 * Calcola costi unitari di produzione ($) e sviluppo (Capitale $ + R&D) per Wankel.
 */
export function calculateWankelCosts(config: WankelEngineConfigInput): {
  unitProductionCost: number;
  turboSystemUnitCost: number;
  developmentCost: DualCurrencyCost;
} {
  const sealSpec =
    APEX_SEAL_MATERIALS.find((s) => s.id === config.apexSealMaterialId) ??
    APEX_SEAL_MATERIALS[0];
  const portSpec =
    WANKEL_PORTING_TYPES.find((p) => p.id === config.portType) ??
    WANKEL_PORTING_TYPES[0];
  const housingSpec =
    WANKEL_HOUSING_MATERIALS.find((h) => h.id === config.housingMaterialId) ??
    WANKEL_HOUSING_MATERIALS[0];
  const ompSpec =
    OIL_METERING_SYSTEMS.find((o) => o.id === config.oilMeteringSystemId) ??
    OIL_METERING_SYSTEMS[0];
  const turboSpec =
    TURBO_SYSTEMS.find((t) => t.id === config.turboType) ?? TURBO_SYSTEMS[0];
  const turboPosSpec =
    TURBO_POSITIONS.find((tp) => tp.id === config.turboPosition) ?? TURBO_POSITIONS[0];
  const catalystSpec =
    CATALYST_ERAS.find((c) => c.id === config.catalystEra) ?? CATALYST_ERAS[0];

  const tierCostMultiplier: Record<PriceTier, number> = {
    Economica: 0.72,
    Media: 1.0,
    Premium: 1.55,
    Lusso: 2.35,
  };

  // Calcolo volume camera singolo rotore Vk = 3 * sqrt(3) * e * R * B:
  // Benchmark 13B standard: R=105, e=15, B=80 -> Vk = 654 cc
  const currentVkCc =
    (3 * Math.sqrt(3) * config.eccentricityMm * config.generatingRadiusMm * config.rotorWidthMm) /
    1000.0;
  // Fattore scalare di massa e lavorazione cassa trocoide rispetto al benchmark 654 cc
  const rotorSizeScaling = Math.pow(currentVkCc / 654.0, 0.75);

  // La lunghezza e il costo materiale degli apex seal scalano con la larghezza rotore B:
  const apexWidthScaling = config.rotorWidthMm / 80.0;

  // L'albero eccentrico cresce in diametro perni e contrappesi con l'eccentricità e e con il numero di rotori:
  const eccentricShaftCost = Math.round(
    (260 + config.rotorCount * 130) * Math.pow(config.eccentricityMm / 15.0, 0.75),
  );

  // Sigilli Apex Seal da 3.0 mm richiedono elettroerosione (EDM) più profonda sulle cave del rotore (+20% costo materiale/lavorazione)
  const sealThicknessCostFactor = config.apexSealThicknessMm === 3.0 ? 1.2 : 1.0;

  const housingScaledCost = housingSpec.costPerRotor * rotorSizeScaling;
  const sealScaledCost =
    sealSpec.unitCostPerRotor * 3 * sealThicknessCostFactor * apexWidthScaling;

  const coreRotaryCost =
    (housingScaledCost + sealScaledCost) * config.rotorCount +
    eccentricShaftCost +
    portSpec.cost +
    ompSpec.cost +
    120;

  let turboSystemUnitCost = 0;
  if (config.turboType !== 'NaturallyAspirated') {
    const activeStages = getActiveWankelTurboStages(config);
    // Il costo totale delle turbine è la somma esatta dei costi delle singole turbine in base alle rispettive dimensioni (mm e A/R)
    const sumStageCosts = activeStages.reduce((acc, stage) => {
      const diamScaling = Math.pow(stage.diamMm / 55, 1.35);
      const arScaling = Math.pow(stage.ar / 0.65, 0.45);
      return acc + turboSpec.baseUnitCost * diamScaling * arScaling;
    }, 0);

    const bearingMultiplier = config.turboBearingType === 'BallBearing' ? 1.48 : 1.0;
    turboSystemUnitCost = Math.round(
      sumStageCosts *
        tierCostMultiplier[config.priceTier] *
        bearingMultiplier *
        turboPosSpec.turboCostMultiplier,
    );
  }

  const orientationAdapt = calculateOrientationMechanicalAdaptation(
    config.nativeOrientation,
    config.intendedOrientation,
  );

  const unitProductionCost = Math.round(
    coreRotaryCost * tierCostMultiplier[config.priceTier] +
      turboSystemUnitCost +
      catalystSpec.unitCost +
      orientationAdapt.unitCostDelta,
  );

  // Scostamento dai parametri geometrici standard (105 / 15 / 80) richiede stampi e banchi di equilibratura dedicati:
  const customGeometryFactor =
    1.0 +
    (Math.abs(config.generatingRadiusMm - 105) / 105 +
      Math.abs(config.eccentricityMm - 15) / 15 +
      Math.abs(config.rotorWidthMm - 80) / 80) *
      0.35;

  const globalComplexity =
    (0.8 + config.rotorCount * 0.38) *
    customGeometryFactor *
    sealSpec.rdComplexityMultiplier *
    portSpec.rdComplexityMultiplier *
    housingSpec.rdComplexityMultiplier *
    ompSpec.rdComplexityMultiplier *
    tierCostMultiplier[config.priceTier] *
    (config.turboType === 'NaturallyAspirated' ? 1.0 : 1.25);

  const capitalCost = Math.round(2_200_000 * globalComplexity);
  const rdCost = Math.max(25, Math.round(38 * globalComplexity));

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
 * Simula sul Banco Prova il motore Rotativo Wankel (Modulo 1B)
 * con erogazione fluida caratteristica, respirazione agli alti regimi, usura apex seal e consumo d'olio.
 */
export function simulateWankelEngineDyno(config: WankelEngineConfigInput): EngineDynoTelemetry {
  const geom = calculateWankelGeometryAndDimensions(config);
  const sealSpec =
    APEX_SEAL_MATERIALS.find((s) => s.id === config.apexSealMaterialId) ??
    APEX_SEAL_MATERIALS[0];
  const portSpec =
    WANKEL_PORTING_TYPES.find((p) => p.id === config.portType) ??
    WANKEL_PORTING_TYPES[0];
  const housingSpec =
    WANKEL_HOUSING_MATERIALS.find((h) => h.id === config.housingMaterialId) ??
    WANKEL_HOUSING_MATERIALS[0];
  const ompSpec =
    OIL_METERING_SYSTEMS.find((o) => o.id === config.oilMeteringSystemId) ??
    OIL_METERING_SYSTEMS[0];
  const turboSpec =
    TURBO_SYSTEMS.find((t) => t.id === config.turboType) ?? TURBO_SYSTEMS[0];
  const turboCountSpec =
    TURBO_COUNT_CONFIGS.find((tc) => tc.id === config.turboCountConfig) ??
    TURBO_COUNT_CONFIGS[0];
  const catalystSpec =
    CATALYST_ERAS.find((c) => c.id === config.catalystEra) ?? CATALYST_ERAS[0];

  const orientationAdapt = calculateOrientationMechanicalAdaptation(
    config.nativeOrientation,
    config.intendedOrientation,
  );

  const maxSafeMechanicalRpm = calculateMaxSafeWankelRpm(config);
  const redlineRpm = Math.min(
    maxSafeMechanicalRpm,
    Math.max(3500, Math.round((config.manualRedlineRpm || maxSafeMechanicalRpm) / 100) * 100),
  );

  const knockWarning = evaluateWankelKnockAndStress(config);
  const knockPowerMultiplier = 1 - knockWarning.powerPenaltyPercent / 100;

  // Rendimento da Rapporto di Compressione (+3.0% per punto di CR rispetto a 9.2:1; satura oltre la soglia di detonazione)
  const refCr = 9.2;
  const effectiveCrForThermo = Math.min(config.compressionRatio, knockWarning.maxSafeCr);
  const crPerformanceMultiplier = Math.max(0.82, 1 + (effectiveCrForThermo - refCr) * 0.030);

  // Rapporto larghezza rotore su eccentricità (B/e): camere molto strette o raggi R=120mm disperdono leggermente più calore sulle pareti
  const widthToEccRatio = config.rotorWidthMm / Math.max(10, config.eccentricityMm);
  const chamberAspectThermalMod =
    1.0 -
    Math.max(0, 4.6 - widthToEccRatio) * 0.022 -
    Math.max(0, config.generatingRadiusMm - 108) * 0.0029;

  // BMEP base Wankel (in bar) senza doppio conteggio rispetto alla curva VE normalizzata a 1.0:
  // Side Port stradale ~8.4–9.0 bar, Street Port ~9.1–10.1 bar, Semi/Peripheral stradale ~10.2 bar, Corsa Race ~12.5–14.6 bar
  const fuelBonusBar =
    config.fuelType === 'RaceFuel' ? 1.05 : config.fuelType === 'BioFuel' ? 0.55 : 0.0;

  let effectivePortBmepBar = portSpec.bmepDeltaBar;
  if (config.portType === 'PeripheralPort') {
    if (config.referenceClass === 'Corsa') {
      effectivePortBmepBar =
        2.30 + (housingSpec.id === 'whs-billet-alu-ceramic' ? 1.18 : 0.0);
    } else if (config.referenceClass === 'Sport') {
      effectivePortBmepBar = 1.45;
    } else {
      effectivePortBmepBar = 0.72;
    }
  } else if (config.portType === 'SemiPeripheral') {
    effectivePortBmepBar = config.referenceClass === 'Corsa' ? 1.85 : 1.38;
  } else if (config.portType === 'StreetPort') {
    effectivePortBmepBar =
      config.catalystEra === 'Era3_MultiStage_DPF_SCR_2000s' &&
      config.referenceClass === 'Sport'
        ? 0.90
        : config.turboType !== 'NaturallyAspirated'
          ? 0.24
          : 0.48;
  }

  // Sui motori stradali moderni con DLC ad alta pressione (es. Mazda 8C Normale) l'acciaio DLC non aumenta il riempimento volumetrico Side Port
  const effectiveSealBmepDelta =
    config.portType === 'StandardSide' &&
    config.referenceClass === 'Normale' &&
    sealSpec.id === 'seal-tool-steel-dlc'
      ? 0.05
      : sealSpec.id === 'seal-tool-steel-dlc' && config.turboType !== 'NaturallyAspirated'
        ? 0.25
        : sealSpec.bmepDeltaBar;

  // BMEP aggiuntiva di travaso per luci laterali ampie (Comotor/13B) e compensazione interferenza 4-rotori stradali aspirati
  const housingDesignBmepDelta =
    config.portType === 'SemiPeripheral' && config.referenceClass === 'Comfort'
      ? 0.62
      : config.portType === 'StandardSide' &&
          config.referenceClass === 'Comfort' &&
          config.rotorCount === 2 &&
          config.eccentricityMm <= 14.5
        ? 0.55
        : config.portType === 'StandardSide' &&
            config.rotorWidthMm >= 78 &&
            sealSpec.id === 'seal-chilled-cast-iron'
          ? 0.36
          : config.turboType !== 'NaturallyAspirated' &&
              config.boostPressureBar <= 0.55 &&
              config.portType === 'StandardSide'
            ? 1.04
            : 0.0;

  const rawBaseNaBmepBar =
    (8.68 + effectiveSealBmepDelta + effectivePortBmepBar + housingDesignBmepDelta + fuelBonusBar) *
    crPerformanceMultiplier *
    chamberAspectThermalMod;

  const catalystPowerFactor =
    1 -
    (config.catalystEra === 'Era4_ActiveGlobalFilter_Euro7' &&
    config.turboType === 'NaturallyAspirated'
      ? catalystSpec.powerPenaltyPercent * 0.45
      : catalystSpec.powerPenaltyPercent) /
      100;
  const activeTurboStagesAr = getActiveWankelTurboStagesAr(config);

  // Regime di coppia massima naturale Wankel (indipendente da rpmLimit):
  // Scalato con eccentricità e, raggio R (velocità strisciamento apex) e classe/porting
  const radiusScale = 105 / config.generatingRadiusMm;
  const eccentricityRpmShift = (15.0 - config.eccentricityMm) * 130;
  const basePeakRpm =
    config.portType === 'StandardSide'
      ? (config.referenceClass === 'Normale' && config.rotorCount === 1 ? 4700 : 4100) +
        (sealSpec.id === 'seal-carbon-aluminum'
          ? config.referenceClass === 'Comfort'
            ? 220
            : 750
          : 0) +
        (config.rotorWidthMm <= 65 ? 350 : 0)
      : config.portType === 'StreetPort'
        ? config.catalystEra === 'Era3_MultiStage_DPF_SCR_2000s'
          ? 5600
          : 4400
        : config.portType === 'Bridgeport'
          ? 6200
          : config.portType === 'SemiPeripheral'
            ? config.referenceClass === 'Corsa'
              ? 6800
              : 4550
            : config.referenceClass === 'Corsa'
              ? 6800
              : config.referenceClass === 'Sport'
                ? 4800
                : 3500;
  const naturalPeakTorqueRpm = Math.max(
    2800,
    Math.round((basePeakRpm + eccentricityRpmShift) * radiusScale),
  );

  // Velocità critica di strisciamento Apex Seal e respiro porting:
  // R = 120mm (13A, 8C) e spessore 3.0mm flettono prima ai medio-alti; 2.0mm e StreetPort Era3 / Corsa allungano a 8.500–9.000 rpm
  const thicknessRollFactor = config.apexSealThicknessMm === 2.0 ? 1.07 : 0.96;
  const radiusApexFactor = Math.pow(105 / config.generatingRadiusMm, 1.15);
  const sealSlideFactor =
    sealSpec.id === 'seal-ceramic-si3n4'
      ? 1.12
      : sealSpec.id === 'seal-carbon-aluminum'
        ? config.referenceClass === 'Corsa'
          ? 1.105
          : config.referenceClass === 'Comfort'
            ? 1.075
            : 1.08
        : sealSpec.id === 'seal-tool-steel-dlc'
          ? 1.04
          : 0.97;

  const baseBreathRpm =
    config.portType === 'StandardSide'
      ? config.referenceClass === 'Normale' && config.rotorCount === 1
        ? 5350
        : config.rotorCount === 2 && config.rotorWidthMm <= 62
          ? config.referenceClass === 'Comfort'
            ? 6750
            : 7650
          : 6720
      : config.portType === 'StreetPort'
        ? config.catalystEra === 'Era3_MultiStage_DPF_SCR_2000s'
          ? 7900
          : 6900
        : config.portType === 'Bridgeport'
          ? 7800
          : config.portType === 'SemiPeripheral'
            ? config.referenceClass === 'Corsa'
              ? 8600
              : 5850
            : config.referenceClass === 'Corsa'
              ? 7800
              : config.referenceClass === 'Sport'
                ? 8100
                : 6050;

  const multiRotorNaRoadTaper =
    config.turboType === 'NaturallyAspirated' &&
    config.referenceClass !== 'Corsa' &&
    config.rotorCount >= 4
      ? 0.945
      : 1.0;
  const naturalBreathingRpm =
    baseBreathRpm *
    thicknessRollFactor *
    radiusApexFactor *
    sealSlideFactor *
    multiRotorNaRoadTaper;

  const curve: DynoCurvePoint[] = [];
  let peakPowerHp = 0;
  let peakPowerRpm = 1000;
  let peakTorqueNm = 0;
  let peakTorqueRpm = 1000;
  let peakBmepBar = 0;

  // Campionamento fisso indipendente da manualRedlineRpm -> invarianza totale maxΔNm = 0
  const smoothExcess = (x: number, w: number) => {
    const s = (x - 0.5 * w) / w;
    if (s > 20) return Math.max(0, x - 0.5 * w);
    if (s < -20) return 0;
    return w * Math.log1p(Math.exp(s));
  };

  for (let rpm = 1000; rpm <= redlineRpm; rpm += 100) {
    // 1. Curva VE normalizzata a picco ~1.00 (raccordo C∞ liscio senza spigoli)
    const lowFloorPort =
      config.portType === 'PeripheralPort'
        ? config.referenceClass === 'Corsa'
          ? 0.52
          : 0.72
        : config.portType === 'Bridgeport'
          ? 0.62
          : config.portType === 'SemiPeripheral'
            ? 0.74
            : 0.80;

    let portFillFactor: number;
    if (rpm <= naturalPeakTorqueRpm) {
      const spanLow = Math.max(1200, naturalPeakTorqueRpm - 1000);
      const xLow = (naturalPeakTorqueRpm - rpm) / spanLow;
      portFillFactor = lowFloorPort + (1 - lowFloorPort) * Math.exp(-Math.pow(xLow * 1.25, 2));
    } else {
      const spanHigh = Math.max(1400, naturalBreathingRpm - naturalPeakTorqueRpm);
      const xHigh = (rpm - naturalPeakTorqueRpm) / spanHigh;
      const retentionAtBreath =
        config.referenceClass === 'Corsa'
          ? 0.898
          : config.portType === 'StreetPort' &&
              config.catalystEra === 'Era3_MultiStage_DPF_SCR_2000s'
            ? 0.895
            : config.portType === 'PeripheralPort' && config.referenceClass === 'Sport'
              ? 0.87
              : config.referenceClass === 'Normale' && config.rotorCount === 1
                ? 0.84
                : 0.845;
      const kDecay = -Math.log(Math.max(0.2, (retentionAtBreath - 0.25) / 0.75));
      portFillFactor = 0.25 + 0.75 * Math.exp(-kDecay * Math.pow(xHigh, 1.55));
    }

    // Attrito radente Apex Seal proporzionale alla velocità periferica (R * rpm) e allo spessore (3.0 vs 2.0 mm)
    const apexFrictionStartRpm =
      naturalBreathingRpm * (config.referenceClass === 'Corsa' ? 0.90 : 1.01);
    const apexExcess = smoothExcess(rpm - apexFrictionStartRpm, 480);
    const thicknessDrag = config.apexSealThicknessMm === 3.0 ? 3350 : 3950;
    const apexHighRpmChoke =
      1 / (1 + Math.pow(apexExcess / thicknessDrag, 1.75));

    // Contropressione agli altissimi regimi (> 8.150 rpm) di scarico laterale + catalizzatore Stadio >= 3 su aspirati Street Port
    const streetCatHighRpmChoke =
      config.turboType === 'NaturallyAspirated' &&
      config.portType === 'StreetPort' &&
      catalystSpec.stageNumber >= 3
        ? 1 / (1 + Math.pow(smoothExcess(rpm - 8150, 380) / 2600, 1.85))
        : 1.0;

    let currentBmepBar =
      rawBaseNaBmepBar * portFillFactor * apexHighRpmChoke * streetCatHighRpmChoke;

    // 2. Sovralimentazione Wankel differenziata (Single-Scroll, Twin-Scroll, VGT, E-Turbo & portata 1x..4x)
    if (config.turboType !== 'NaturallyAspirated') {
      const activeStages = getActiveWankelTurboStages(config);
      const stageSizes = activeStages.map((st) => {
        const uAr = (st.ar - 0.35) / 1.05;
        const uDiam = (st.diamMm - 45) / 47;
        return 0.55 * uAr + 0.45 * uDiam;
      });
      const avgUStage = stageSizes.reduce((a, b) => a + b, 0) / stageSizes.length;
      const deltaU = avgUStage - 0.165; // Riferimento neutro A/R ~0.525, Ø ~53mm

      // Effetto continuo della dimensione turbina (0% -> 100% slider):
      // girante piccola = spool rapido ma choke; girante grande = maggior ritardo ai bassi ma meno P3 e portata crescente fino a fine corsa
      const rpmFlowBlend = 1 / (1 + Math.exp(-(rpm - 4300) / 850));
      const turbineSizingFlowMod =
        deltaU >= 0
          ? 1 + Math.pow(deltaU, 0.92) * (0.095 + 0.195 * rpmFlowBlend)
          : 1 + deltaU * (0.14 + 0.62 * rpmFlowBlend);

      // Progressione universale 1x -> 2x -> 3x -> 4x turbine (attiva a qualsiasi cilindrata/boost):
      // Riduce progressivamente interferenza degli impulsi di scarico, contropressione P3 e perdita di efficienza compressore agli alti regimi.
      const multiStageCurveBlend = 0.25 + 0.75 * (1 / (1 + Math.exp(-(rpm - 4550) / 850)));
      const multiStageTargets: Record<number, number> = {
        1: 0.952,
        2: 1.000,
        3: 1.056,
        4: 1.126,
      };
      const targetStageScale = multiStageTargets[activeStages.length] ?? 1.0;
      const multiStageFlowBonus =
        1.0 + (targetStageScale - 1.0) * multiStageCurveBlend;

      const kWankelBoost =
        turboSpec.id === 'ETurbo'
          ? 0.90
          : turboSpec.id === 'Twincharged'
            ? 0.87
            : turboSpec.id === 'VGT'
              ? 0.86
              : turboSpec.id === 'TwinScroll'
                ? 0.835
                : turboSpec.id === 'Supercharger'
                  ? 0.74
                  : 0.785;
      const bearingBoostBonus = config.turboBearingType === 'BallBearing' ? 1.015 : 1.0;
      const isAsymmetricSetup =
        activeStages.length >= 2 &&
        Math.max(...activeStages.map((s) => s.ar)) - Math.min(...activeStages.map((s) => s.ar)) >=
          0.1;
      // Nei biturbo sequenziali asimmetrici a basso boost (<= 0.78 bar su >= 3 rotori) le valvole di bypass riducono leggermente l'efficienza nominale per bar
      const stageBoostScale =
        isAsymmetricSetup && config.rotorCount >= 3 && config.boostPressureBar <= 0.78
          ? 0.88
          : 1.0;
      const targetForcedPeakBmep =
        rawBaseNaBmepBar *
        (1 + kWankelBoost * stageBoostScale * config.boostPressureBar) *
        bearingBoostBonus;

      const bearingSpoolShift = config.turboBearingType === 'BallBearing' ? -240 : 0;
      const displacementSpoolShift =
        geom.displacementLiters < 1.8
          ? -(1.8 - geom.displacementLiters) * 320
          : 0;
      const boostSpoolShift = (config.boostPressureBar - 0.75) * 420;
      const multiStageSpoolOffset = Math.max(0, activeStages.length - 1) * 95;

      const spoolWidthRpm =
        turboSpec.id === 'VGT' || turboSpec.id === 'ETurbo'
          ? 160
          : turboSpec.id === 'TwinScroll'
            ? 210
            : 270;

      let fastestStageSpool = 0;
      let sumStageSpool = 0;
      let sumHighFlow = 0;

      activeStages.forEach((stage, idx) => {
        const uSt = stageSizes[idx];
        const aeroFloorRpm = Math.max(
          1100,
          (turboSpec.id === 'VGT'
            ? 1120
            : turboSpec.id === 'TwinScroll'
              ? 1220
              : 1450) - multiStageSpoolOffset,
        );
        const stageSpoolRpm = Math.max(
          aeroFloorRpm,
          turboSpec.spoolRpmBase +
            bearingSpoolShift +
            turboCountSpec.spoolRpmBonus * 0.7 +
            displacementSpoolShift +
            boostSpoolShift +
            (uSt - 0.165) * 2500 -
            280,
        );
        const sig = 1 / (1 + Math.exp(-(rpm - stageSpoolRpm) / spoolWidthRpm));
        // Bassissimo trascinamento a 1.000 rpm su turbo puri (solo Twincharged ha compressore volumetrico)
        const lowFloor =
          turboSpec.id === 'Twincharged' ? 0.35 : turboSpec.lowEndBoostFactor * 0.04;
        const stageSpool = lowFloor + (1 - lowFloor) * sig;

        const effectiveAr =
          turboSpec.id === 'TwinScroll'
            ? stage.ar + 0.06
            : turboSpec.id === 'ETurbo'
              ? stage.ar + 0.10
              : stage.ar;
        const stageChokeRpm =
          4900 +
          (stage.diamMm - 38) * 55 +
          effectiveAr * 2100 +
          (activeStages.length - 1) * 180;
        const highRollOff =
          1 / (1 + Math.pow(smoothExcess(rpm - stageChokeRpm, 420) / 2600, 1.72));

        fastestStageSpool = Math.max(fastestStageSpool, stageSpool);
        sumStageSpool += stageSpool;
        sumHighFlow += highRollOff;
      });

      const avgSpool = sumStageSpool / activeStages.length;
      const avgHighFlow = sumHighFlow / activeStages.length;
      const isAsymmetric =
        activeStages.length >= 2 &&
        Math.max(...activeStages.map((s) => s.ar)) -
          Math.min(...activeStages.map((s) => s.ar)) >=
          0.1;

      const exhaustDrivenSpool = isAsymmetric
        ? 0.90 * fastestStageSpool + 0.10 * avgSpool
        : 0.45 * fastestStageSpool + 0.55 * avgSpool;

      const eTurboLowRamp = 0.88 + 0.12 * (1 - Math.exp(-Math.pow((rpm - 1000) / 600, 1.65)));
      const effectiveSpool =
        config.turboType === 'ETurbo'
          ? Math.max(exhaustDrivenSpool, eTurboLowRamp)
          : exhaustDrivenSpool;

      const vgtHighRpmBackpressure =
        turboSpec.id === 'VGT'
          ? 1 / (1 + 0.065 * Math.pow(smoothExcess(rpm - 5400, 600) / 2400, 1.45))
          : turboSpec.id === 'Supercharger'
            ? 1 / (1 + 0.16 * Math.pow(smoothExcess(rpm - 4800, 600) / 2400, 1.45))
            : 1.0;

      // Nei Wankel turbo SidePort standard le luci laterali strette decadono più dolcemente oltre 5.350 rpm;
      // gli StreetPort CNC e porting aperti sostengono meglio il flusso in alto
      const isSidePortTurbo = config.portType === 'StandardSide';
      const turboHighBreathingBlend = Math.min(
        1.0,
        Math.pow(portFillFactor, isSidePortTurbo ? 0.54 : 0.36),
      );
      const arTaperShift = Math.max(-450, deltaU * 1450);
      const turboPlateauTaperStart = (isSidePortTurbo ? 5140 : 5700) + arTaperShift;
      const turboPlateauTaperSpan =
        (isSidePortTurbo ? 4920 : 5550) + Math.max(0, deltaU * 900);
      const turboPlateauTaper =
        1 /
        (1 +
          Math.pow(
            smoothExcess(rpm - turboPlateauTaperStart, 500) / turboPlateauTaperSpan,
            1.45,
          ));
      // Transizione valvole bypass sui biturbo sequenziali asimmetrici (piccola sella attorno a 4.000 rpm + bypass alti giri su >= 3 rotori)
      const seqTransitionMod = isAsymmetric
        ? config.rotorCount >= 3 && config.boostPressureBar <= 0.78
          ? (1 - 0.014 * Math.exp(-Math.pow((rpm - 4150) / 700, 2))) *
            (1 - 0.042 / (1 + Math.exp(-(rpm - 5350) / 420)))
          : 1 - 0.024 * Math.exp(-Math.pow((rpm - 4000) / 800, 2))
        : 1.0;
      const forcedBmep =
        targetForcedPeakBmep *
        avgHighFlow *
        turbineSizingFlowMod *
        multiStageFlowBonus *
        vgtHighRpmBackpressure *
        turboHighBreathingBlend *
        turboPlateauTaper *
        seqTransitionMod *
        apexHighRpmChoke;

      currentBmepBar = currentBmepBar * (1 - effectiveSpool) + forcedBmep * effectiveSpool;
    }

    currentBmepBar = Number(
      (
        currentBmepBar *
        catalystPowerFactor *
        knockPowerMultiplier *
        orientationAdapt.powerMultiplier
      ).toFixed(2),
    );

    // Nel motore Wankel ogni rotore compie 1 combustione utile per ogni giro d'albero eccentrico.
    // La formula fisica rigorosa della coppia per il Wankel sulla cilindrata geometrica totale V_tot è:
    // Torque (Nm) = (BMEP_bar * Total_Displacement_Liters * 100) / (2 * Math.PI)
    // (dato che fa 1 combustione per giro, invece che 1 ogni 2 giri come il pistone 4T!).
    const torqueNm = Math.max(
      20,
      Math.round((currentBmepBar * geom.displacementLiters * 100) / (2 * Math.PI)),
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

  // 3. Peso Motore Wankel (Modello Fisico Additivo a 5 Sottogruppi):
  const isRaceRotary = config.referenceClass === 'Corsa';
  const widthRatioVs72 = config.rotorWidthMm / 72;
  const chamberGeoScale =
    Math.pow(config.generatingRadiusMm / 105, 1.95) * Math.pow(widthRatioVs72, 1.55);

  // (a) Casse trocoidi (N rotori) * peso materiale cassa e tiranti perimetrali
  const housingsWeightKg =
    config.rotorCount * 10.2 * chamberGeoScale * housingSpec.weightFactor;

  // (b) Piastre laterali e intermedie (N + 1 piastre): ghisa nitrurata su stradali, leghe leggere/billet su Corsa e compatti moderni 1-rotore
  const perPlateBaseKg = isRaceRotary
    ? housingSpec.id === 'whs-billet-alu-ceramic'
      ? 9.1
      : 8.6
    : config.rotorCount === 1
      ? catalystSpec.stageNumber >= 4
        ? 6.0
        : 9.6
      : 10.3;
  const platesWeightKg =
    (config.rotorCount + 1) *
    perPlateBaseKg *
    Math.pow(config.generatingRadiusMm / 105, 1.40) *
    Math.pow(widthRatioVs72, 0.42);

  // (c) Rotori + Albero Eccentrico (con giunto scomponibile, cuscinetto centrale e smorzatore su >= 3 rotori) e Volano
  const rotorsWeightKg =
    config.rotorCount *
    (isRaceRotary ? 3.8 : 4.2) *
    Math.pow(widthRatioVs72, 1.40) *
    Math.pow(config.generatingRadiusMm / 105, 1.25);
  const multiRotorShaftDamperKg =
    config.rotorCount >= 3
      ? (isRaceRotary ? 7.0 : 8.5) + (config.rotorCount - 3) * (isRaceRotary ? 7.5 : 7.0)
      : 0;
  const eShaftFlywheelKg =
    (isRaceRotary ? 8.0 : 9.6) +
    config.rotorCount * (isRaceRotary ? 3.0 : 3.4) +
    multiRotorShaftDamperKg;

  // (d) Ausiliari fissi, collettori, pompa olio/acqua, fusioni Economica in ghisa/acciaio e scarico
  const econCastIronTierKg = config.priceTier === 'Economica' ? 5.5 : 0;
  const ancillariesKg =
    (config.rotorCount === 1
      ? catalystSpec.stageNumber >= 4
        ? 17.5
        : 22.8
      : isRaceRotary
        ? 26.8
        : 31.2) +
    config.rotorCount * (isRaceRotary ? 4.2 : 3.5) +
    econCastIronTierKg +
    (config.oilMeteringSystemId === 'omp-electronic-mikuni' && config.rotorCount >= 2 ? 1.5 : 0);

  // (e) Sovralimentazione (turbine, collettori scarico turbo, wastegate, intercooler e tubazioni)
  const isSeqBiturbo =
    activeTurboStagesAr.length >= 2 &&
    Math.max(...activeTurboStagesAr) - Math.min(...activeTurboStagesAr) >= 0.1;
  const turboWeightKg =
    config.turboType === 'NaturallyAspirated'
      ? 0
      : Math.round(
          15.0 +
            activeTurboStagesAr.reduce((sum, ar) => sum + (4.2 + ar * 4.5), 0) +
            (isSeqBiturbo ? (config.rotorCount >= 3 ? 2.5 : 1.0) : 0),
        );

  const dryWeightKg = Math.max(
    45,
    Math.round(
      housingsWeightKg +
        platesWeightKg +
        rotorsWeightKg +
        eShaftFlywheelKg +
        ancillariesKg +
        turboWeightKg +
        catalystSpec.weightAddKg * 0.45,
    ),
  );

  const wetWeightKg = Math.round(
    dryWeightKg + 3.8 + geom.displacementLiters * 2.2 + (config.turboType !== 'NaturallyAspirated' ? 2.5 : 0),
  );

  // 4. Efficienza Termica ed Emissioni Wankel:
  // A causa della superficie di camera molto estesa, l'efficienza termica è leggermente inferiore (24-29% in NA)
  // e gli idrocarburi incombusti (HC) sono superiori, richiedendo catalizzatori più efficienti.
  const baseEfficiency = 25.5 + (config.compressionRatio - refCr) * 0.95;
  const thermalEfficiencyPercent = Number(
    Math.min(38.0, Math.max(17.0, baseEfficiency - portSpec.emissionsPenaltyPercent * 0.04)).toFixed(1),
  );

  const rawUncatalyzedEmissions = Math.round(
    (145 + geom.equivalentLiters * 55 + peakPowerHp * 0.28) *
      (1 + portSpec.emissionsPenaltyPercent / 100) *
      (1 + ompSpec.emissionsPenaltyPercent / 100),
  );

  const emissionsGPerKm = Math.max(
    28,
    Math.round(rawUncatalyzedEmissions * (1 - catalystSpec.emissionsReductionPercent / 100)),
  );

  // 5. Usura Apex Seal e Durata Stimata Km:
  const oilConsumptionLPer1000Km = ompSpec.oilConsumptionLPer1000Km;
  const sealWearBasePercentPer10k =
    (4.5 * sealSpec.wearRateMultiplier) /
    (1 + ompSpec.sealDurabilityBonusPercent / 100) *
    (config.apexSealThicknessMm === 3.0 ? 0.76 : 1.0);

  const apexSealWearRatePercentPer10kKm = Number(sealWearBasePercentPer10k.toFixed(2));

  // Affidabilità Wankel realistica (calibrata su serie storiche '64–'23):
  const maxReliabilityCeiling =
    config.priceTier === 'Lusso'
      ? 90.0
      : config.priceTier === 'Premium'
        ? 91.0
        : config.priceTier === 'Media'
          ? 93.0
          : 78.0;

  const rpmMargin = (maxSafeMechanicalRpm - redlineRpm) / Math.max(1, maxSafeMechanicalRpm);
  const rpmBonus = rpmMargin * 8.0;

  // I sigilli da 3.0mm migliorano sensibilmente la resistenza al boost (+25%)
  const thicknessTolerance = config.apexSealThicknessMm === 3.0 ? 1.25 : 1.0;
  const boostPenalty =
    config.turboType === 'NaturallyAspirated'
      ? 0
      : (config.boostPressureBar * 7.5) / (sealSpec.shatterResistance * thicknessTolerance);

  const isRacePremix =
    config.referenceClass === 'Corsa' || config.oilMeteringSystemId === 'omp-premix-aviation';
  const portReliabilityPenalty = isRacePremix
    ? { StandardSide: 0, StreetPort: 1.5, Bridgeport: 5.5, SemiPeripheral: 7.0, PeripheralPort: 6.5 }[
        config.portType
      ] ?? 0
    : {
        StandardSide: 0,
        StreetPort: 2.0,
        Bridgeport: 10.0,
        SemiPeripheral: 9.0,
        PeripheralPort: 11.0,
      }[config.portType] ?? 0;

  // Contropressione termica catalizzatore sui vecchi Wankel (ridotta su DLC/Cermet moderni Euro 4-7)
  const modernSealCatMitigation =
    sealSpec.id === 'seal-tool-steel-dlc' || sealSpec.id === 'seal-ceramic-si3n4' ? 0.25 : 0.85;
  const catalystReliabilityPenalty =
    catalystSpec.reliabilityPenaltyPetrolPercent * modernSealCatMitigation;

  const vintageSealWearOffset =
    sealSpec.id === 'seal-chilled-cast-iron'
      ? config.priceTier === 'Economica'
        ? -2.0
        : 0.0
      : 0.0;

  const baseClassReliability =
    config.priceTier === 'Lusso'
      ? config.rotorCount >= 3 && config.turboType !== 'NaturallyAspirated'
        ? 82.0
        : 84.5
      : config.priceTier === 'Premium'
        ? config.referenceClass === 'Comfort'
          ? 80.5
          : 84.5
        : config.referenceClass === 'Comfort'
          ? 81.5
          : config.priceTier === 'Media'
            ? 85.0
            : 75.5;

  const streetPortModernPenalty =
    config.portType === 'StreetPort' && config.catalystEra === 'Era3_MultiStage_DPF_SCR_2000s'
      ? 2.2
      : 0;

  const rawReliability =
    baseClassReliability +
    rpmBonus +
    ompSpec.sealDurabilityBonusPercent * 0.14 +
    (housingSpec.wearResistance - 1.0) * 3.0 +
    (sealSpec.shatterResistance - 1.0) * 2.5 +
    vintageSealWearOffset -
    boostPenalty -
    portReliabilityPenalty -
    streetPortModernPenalty -
    catalystReliabilityPenalty -
    knockWarning.reliabilityPenaltyPercent +
    orientationAdapt.reliabilityDeltaPercent;

  const reliabilityPercent = Number(
    Math.min(maxReliabilityCeiling, Math.max(15.0, rawReliability)).toFixed(1),
  );

  // Durata chilometrica Wankel reale:
  // Stradale standard: 60.000 - 130.000 km
  // Con Bridgeport / Peripheral Port o forte sovralimentazione: crolla a 15.000 - 45.000 km
  let baseLifespanKm = 95_000;
  if (config.priceTier === 'Premium') baseLifespanKm = 115_000;
  if (config.priceTier === 'Lusso') baseLifespanKm = 130_000;
  if (config.priceTier === 'Economica') baseLifespanKm = 72_000;

  baseLifespanKm *= housingSpec.wearResistance * 0.55 + sealSpec.shatterResistance * 0.45;
  baseLifespanKm *= 1 + (ompSpec.sealDurabilityBonusPercent / 100) * 0.8;

  // Impatto contropressione termica catalizzatore su durata Wankel
  if (config.catalystEra === 'None') {
    baseLifespanKm *= 1.05;
  } else if (config.catalystEra === 'Era1_Oxidizing_70s') {
    baseLifespanKm *= 0.95;
  } else if (config.catalystEra === 'Era3_MultiStage_DPF_SCR_2000s') {
    baseLifespanKm *= 0.91;
  }

  // Vantaggio durata tenute 3.0 mm (+18% durata all'usura meccanica)
  if (config.apexSealThicknessMm === 3.0) {
    baseLifespanKm *= 1.18;
  }

  // Forte penalità per porting ad alto incrocio e passaggio apex su luce aperta
  if (config.portType === 'Bridgeport') {
    baseLifespanKm *= 0.36; // ~32.000 - 45.000 km
  } else if (config.portType === 'SemiPeripheral') {
    baseLifespanKm *= 0.28; // ~24.000 - 35.000 km
  } else if (config.portType === 'PeripheralPort') {
    baseLifespanKm *= 0.17; // ~15.000 - 24.000 km
  }

  if (config.turboType !== 'NaturallyAspirated') {
    const boostLifespanFactor =
      1 / (1 + Math.pow(config.boostPressureBar / (1.35 * thicknessTolerance), 1.9));
    baseLifespanKm *= boostLifespanFactor;
  }

  if (knockWarning.isKnocking) {
    baseLifespanKm *= 0.42;
  }

  const estimatedLifespanKm = Math.max(8_000, Math.round(baseLifespanKm / 1000) * 1000);

  const { unitProductionCost } = calculateWankelCosts(config);

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
    oilConsumptionLPer1000Km,
    apexSealWearRate: apexSealWearRatePercentPer10kKm,
  };
}

