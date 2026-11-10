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
    let ar = rawAr[i] !== undefined ? rawAr[i] : (config.turboArRatio || 0.65);
    let diamMm = rawDiam[i] !== undefined ? rawDiam[i] : arRatioToImpellerMm(ar);
    ar = Math.min(1.4, Math.max(0.35, ar));
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

  // Dimensioni fisiche reali in mm
  // Lunghezza L: front iron (55mm) + rotori*(B + 22mm piastra intermedia) + rear iron (65mm) + puleggia/volano (110mm)
  const ironPlatesLengthMm =
    120 + config.rotorCount * (B + 22) + (config.rotorCount > 2 ? 35 : 0);
  let baseLengthMm = ironPlatesLengthMm + 110;

  // Larghezza W: trocoide (2*(R+e)) + collettori scarico/aspirazione (135mm)
  const trochoidWidthMm = 2 * (R + e) + 140;
  let baseWidthMm = trochoidWidthMm;

  // Altezza H: trocoide (2*(R-e) asse minore) + coppa olio + plenum (160mm)
  const trochoidHeightMm = 2 * (R - e) + 180;
  let baseHeightMm = trochoidHeightMm;

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
    const activeStages = getActiveWankelTurboStagesAr(config);
    const maxStageAr = Math.max(...activeStages);
    const arSizeMultiplier = 0.78 + maxStageAr * 0.42;
    const turboCountSpec =
      TURBO_COUNT_CONFIGS.find((tc) => tc.id === config.turboCountConfig) ??
      TURBO_COUNT_CONFIGS[0];
    const countSizeMultiplier = 1 + (turboCountSpec.turbineCount - 1) * 0.14;

    baseLengthMm += posSpec.lengthAddMm * arSizeMultiplier * countSizeMultiplier;
    baseWidthMm += posSpec.widthAddMm * arSizeMultiplier * countSizeMultiplier;
    baseHeightMm += posSpec.heightAddMm * arSizeMultiplier * countSizeMultiplier;
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
  const baseOctaneSafeCr =
    config.fuelType === 'RaceFuel' ? 12.8 : config.fuelType === 'BioFuel' ? 12.0 : 10.4;

  const sealSpec =
    APEX_SEAL_MATERIALS.find((s) => s.id === config.apexSealMaterialId) ??
    APEX_SEAL_MATERIALS[0];

  const effectiveBoostBar =
    config.turboType === 'NaturallyAspirated' ? 0 : config.boostPressureBar;

  // I sigilli da 3.0 mm resistono a pressioni di boost molto superiori (+25% tolleranza sotto forte sovralimentazione)
  const thicknessBoostResistance = config.apexSealThicknessMm === 3.0 ? 1.25 : 1.0;

  // Ogni bar di boost riduce il CR statico di sicurezza di 1.85 punti (mitigato dai sigilli 3.0mm)
  const maxSafeCr = Number(
    Math.max(
      7.5,
      baseOctaneSafeCr +
        (sealSpec.shatterResistance - 1.0) * 0.8 -
        (effectiveBoostBar * 1.85) / thicknessBoostResistance,
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
      message: `Camera Wankel stabile (Soglia Knock con ${config.fuelType}: ${maxSafeCr}:1, tenute ${config.apexSealThicknessMm.toFixed(1)}mm).`,
    };
  }

  // Se detona, il rischio rottura per gli apex seal è gravissimo (i 3.0mm attenuano il rischio frantumazione)
  const fragilityMultiplier = (2.0 / sealSpec.shatterResistance) / thicknessBoostResistance;
  const powerPenaltyPercent = Math.min(50, Math.round(knockExcessCr * 16.0));
  const reliabilityPenaltyPercent = Math.min(
    75,
    Math.round(knockExcessCr * 26.0 * fragilityMultiplier),
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

  // Sigilli Apex Seal da 3.0 mm richiedono elettroerosione (EDM) più profonda sulle cave del rotore (+20% costo materiale/lavorazione)
  const sealThicknessCostFactor = config.apexSealThicknessMm === 3.0 ? 1.2 : 1.0;

  const coreRotaryCost =
    (housingSpec.costPerRotor + sealSpec.unitCostPerRotor * 3 * sealThicknessCostFactor) *
      config.rotorCount +
    portSpec.cost +
    ompSpec.cost +
    380;

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

  const unitProductionCost = Math.round(
    coreRotaryCost * tierCostMultiplier[config.priceTier] +
      turboSystemUnitCost +
      catalystSpec.unitCost,
  );

  const globalComplexity =
    (0.85 + config.rotorCount * 0.35) *
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

  const maxSafeMechanicalRpm = calculateMaxSafeWankelRpm(config);
  const redlineRpm = Math.min(
    maxSafeMechanicalRpm,
    Math.max(3500, Math.round((config.manualRedlineRpm || maxSafeMechanicalRpm) / 100) * 100),
  );

  const knockWarning = evaluateWankelKnockAndStress(config);
  const knockPowerMultiplier = 1 - knockWarning.powerPenaltyPercent / 100;

  // Rendimento da Rapporto di Compressione (+3.2% per punto di CR)
  const refCr = 9.0;
  const crPerformanceMultiplier = Math.max(0.8, 1 + (config.compressionRatio - refCr) * 0.032);

  // BMEP base Wankel (in bar):
  // La camera allungata ha una BMEP termica naturale di circa 9.0 - 9.8 bar in aspirato
  const fuelBonusBar =
    config.fuelType === 'RaceFuel' ? 1.15 : config.fuelType === 'BioFuel' ? 0.6 : 0.0;
  const rawBaseNaBmepBar =
    (9.2 + sealSpec.bmepDeltaBar + portSpec.bmepDeltaBar + fuelBonusBar) *
    crPerformanceMultiplier;

  const catalystPowerFactor = 1 - catalystSpec.powerPenaltyPercent / 100;
  const activeTurboStagesAr = getActiveWankelTurboStagesAr(config);

  // Regime di coppia massima naturale Wankel:
  // Side port ha picco a 5.000–5.500 rpm, Bridgeport a 6.800 rpm, Peripheral port a 8.200–8.600 rpm!
  const naturalPeakTorqueRpm =
    config.portType === 'StandardSide'
      ? 5200
      : config.portType === 'StreetPort'
        ? 5800
        : config.portType === 'Bridgeport'
          ? 6800
          : config.portType === 'SemiPeripheral'
            ? 7200
            : 8400;

  // Portata Multi-Turbo per Wankel
  const totalCompressorFlow = activeTurboStagesAr.reduce(
    (acc, ar) => acc + (0.7 + Math.pow(ar, 1.25) * 1.3),
    0,
  );
  // Il Wankel espelle molto più volume di gas di scarico caldo rispetto a un pistone di pari cilindrata geometrica
  const gasFlowDemand = (geom.equivalentLiters / 2.0) * (0.85 + config.boostPressureBar * 0.55);
  const multiTurboFlowEfficiency = Math.min(
    1.42,
    0.8 +
      0.2 * Math.min(1.3, totalCompressorFlow / Math.max(0.4, gasFlowDemand)) +
      (turboCountSpec.turbineCount - 1) * 0.08,
  );

  const curve: DynoCurvePoint[] = [];
  let peakPowerHp = 0;
  let peakPowerRpm = 1000;
  let peakTorqueNm = 0;
  let peakTorqueRpm = 1000;
  let peakBmepBar = 0;

  for (let rpm = 1000; rpm <= redlineRpm; rpm += 100) {
    // 1. Curva di riempimento volumetrico tipica del Wankel con funzioni continue e morbide (zero scalini discontinui!)
    let portFillFactor = 1.0;
    if (config.portType === 'StandardSide' || config.portType === 'StreetPort') {
      const isStreet = config.portType === 'StreetPort';
      const peakRpm = isStreet ? naturalPeakTorqueRpm + 350 : naturalPeakTorqueRpm;
      const d = (rpm - peakRpm) / (isStreet ? 3400 : 3100);
      const baseFill = isStreet
        ? 0.88 + 0.16 * Math.exp(-Math.pow(d, 2))
        : 0.82 + 0.18 * Math.exp(-Math.pow(d, 2));
      const rollOffRpm = isStreet ? 7900 : 7300;
      const rollOff =
        rpm > rollOffRpm ? 1 / (1 + Math.pow((rpm - rollOffRpm) / 2200, 1.8)) : 1.0;
      portFillFactor = baseFill * rollOff;
    } else if (config.portType === 'Bridgeport') {
      // Bridgeport: sotto i 3.500 rpm la coppia è molto bassa (forte incrocio), rampa ripida ma morbida tra 4.000 e 6.000 rpm, spinta fino a 9.500+ rpm
      const lowRpmFactor = 0.40 + 0.18 * Math.pow((rpm - 1000) / 2500, 1.5);
      const midHighSurge = 1.04 + 0.22 * Math.exp(-Math.pow((rpm - 7500) / 3800, 2));
      const bridgeportSigmoid = 1 / (1 + Math.exp(-(rpm - 4850) / 460));
      portFillFactor = lowRpmFactor * (1 - bridgeportSigmoid) + midHighSurge * bridgeportSigmoid;
      if (rpm > 9800) {
        portFillFactor *= 1 / (1 + Math.pow((rpm - 9800) / 2400, 2.0));
      }
    } else if (config.portType === 'SemiPeripheral') {
      // Semi-Periferico: transizione progressiva, ottimo compromesso
      const lowRpmFactor = 0.48 + 0.22 * Math.pow((rpm - 1000) / 2800, 1.5);
      const highSurge = 1.08 + 0.28 * Math.exp(-Math.pow((rpm - 8200) / 4000, 2));
      const semiSigmoid = 1 / (1 + Math.exp(-(rpm - 5200) / 500));
      portFillFactor = lowRpmFactor * (1 - semiSigmoid) + highSurge * semiSigmoid;
      if (rpm > 10800) {
        portFillFactor *= 1 / (1 + Math.pow((rpm - 10800) / 2500, 2.0));
      }
    } else {
      // Peripheral Port: coppia bassissima sotto i 4.500 rpm ed esplosione progressiva tra 5.500 e 11.500 rpm!
      const lowRpmFactor = 0.28 + 0.18 * Math.pow((rpm - 1000) / 3500, 1.6);
      const screamingSurge = 1.18 + 0.42 * Math.exp(-Math.pow((rpm - 9000) / 4400, 2));
      const periSigmoid = 1 / (1 + Math.exp(-(rpm - 6000) / 520));
      portFillFactor = lowRpmFactor * (1 - periSigmoid) + screamingSurge * periSigmoid;
      if (rpm > 12200) {
        portFillFactor *= 1 / (1 + Math.pow((rpm - 12200) / 2800, 2.2));
      }
    }

    let currentBmepBar = rawBaseNaBmepBar * portFillFactor;

    // 2. Sovralimentazione Wankel con risposta specifica per ogni singola turbina
    if (config.turboType !== 'NaturallyAspirated') {
      const activeStages = getActiveWankelTurboStages(config);
      const effectiveBoostGain =
        config.boostPressureBar *
        0.74 *
        turboSpec.highEndEfficiency *
        multiTurboFlowEfficiency;
      const targetForcedPeakBmep = rawBaseNaBmepBar * (1 + effectiveBoostGain);

      // Gas di scarico Wankel ad altissima EGT accelerano lo spool
      const wankelSpoolAdvantageRpm = -280;
      let fastestStageSpool = 0;
      let sumStageSpool = 0;
      let sumHighFlow = 0;

      activeStages.forEach((stage) => {
        // Le turbine più piccole (es. 40-45mm) hanno minore inerzia -> spool anticipato
        const inertiaDelta = (stage.diamMm - 50) * 36;
        const arDelta = (stage.ar - 0.65) * 1100;
        const stageSpoolRpm = Math.max(
          1150,
          turboSpec.spoolRpmBase +
            wankelSpoolAdvantageRpm +
            turboCountSpec.spoolRpmBonus +
            inertiaDelta +
            arDelta,
        );
        const sig = 1 / (1 + Math.exp(-(rpm - stageSpoolRpm) / 410));
        const lowFloor = turboSpec.lowEndBoostFactor * 0.22;
        const stageSpool = lowFloor + (1 - lowFloor) * sig;

        // Limite di choking ad alti regimi: giranti grandi (es. 70mm) e A/R elevati non soffocano mai
        const stageChokeRpm = 5000 + (stage.diamMm - 35) * 85 + stage.ar * 2300;
        const highRollOff =
          rpm > stageChokeRpm ? 1 / (1 + Math.pow((rpm - stageChokeRpm) / 2900, 1.8)) : 1.0;

        fastestStageSpool = Math.max(fastestStageSpool, stageSpool);
        sumStageSpool += stageSpool;
        sumHighFlow += highRollOff;
      });

      const avgSpool = sumStageSpool / activeStages.length;
      const avgHighFlow = sumHighFlow / activeStages.length;

      const eTurboLowRamp = 0.85 + 0.15 * (1 - Math.exp(-Math.pow((rpm - 1000) / 680, 1.65)));
      const effectiveSpool =
        config.turboType === 'ETurbo'
          ? Math.max(avgSpool, eTurboLowRamp)
          : 0.55 * fastestStageSpool + 0.45 * avgSpool;

      const boostDomeCrown = 0.96 + 0.04 * Math.exp(-Math.pow((rpm - 4800) / 3200, 2));
      const forcedBmep =
        targetForcedPeakBmep *
        boostDomeCrown *
        avgHighFlow *
        portFillFactor;

      currentBmepBar = currentBmepBar * (1 - effectiveSpool) + forcedBmep * effectiveSpool;
    }

    currentBmepBar = Number((currentBmepBar * catalystPowerFactor * knockPowerMultiplier).toFixed(2));

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

  // 3. Peso Motore Wankel:
  // Molto più leggero di un endotermico alternativo!
  const rotorWeightKg = config.rotorWidthMm * 0.055;
  const ironPlatesWeightKg = (18 + config.rotorCount * 22) * housingSpec.weightFactor;
  const turboWeightKg =
    config.turboType === 'NaturallyAspirated'
      ? 0
      : Math.round(
          5.0 + activeTurboStagesAr.reduce((sum, ar) => sum + (3.6 + ar * 4.2), 0),
        );

  const dryWeightKg = Math.max(
    48,
    Math.round(
      ironPlatesWeightKg +
        rotorWeightKg * config.rotorCount +
        turboWeightKg +
        catalystSpec.weightAddKg * 0.75,
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

  // Affidabilità Wankel realistica:
  // Lo stress termico asimmetrico della trocoide e l'usura radente continua degli apex seal impongono
  // un tetto strutturale di affidabilità realistico (max 72-82% per uso stradale anche su Premium/Lusso).
  const maxReliabilityCeiling =
    config.priceTier === 'Lusso'
      ? 82.0
      : config.priceTier === 'Premium'
        ? 79.0
        : config.priceTier === 'Media'
          ? 74.0
          : 68.0;

  const rpmMargin = (maxSafeMechanicalRpm - redlineRpm) / Math.max(1, maxSafeMechanicalRpm);
  const rpmBonus = rpmMargin * 12.0 - 1.5;

  // I sigilli da 3.0mm migliorano sensibilmente la resistenza al boost (+25%)
  const thicknessTolerance = config.apexSealThicknessMm === 3.0 ? 1.25 : 1.0;
  const boostPenalty =
    config.turboType === 'NaturallyAspirated'
      ? 0
      : (config.boostPressureBar * 6.5) / (sealSpec.shatterResistance * thicknessTolerance);

  const portReliabilityPenalty = {
    StandardSide: 0,
    StreetPort: 2.5,
    Bridgeport: 13.0,
    SemiPeripheral: 17.5,
    PeripheralPort: 25.0,
  }[config.portType] ?? 0;

  const rawReliability =
    maxReliabilityCeiling +
    rpmBonus +
    ompSpec.sealDurabilityBonusPercent * 0.15 +
    housingSpec.wearResistance * 1.5 -
    boostPenalty -
    portReliabilityPenalty -
    knockWarning.reliabilityPenaltyPercent;

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

