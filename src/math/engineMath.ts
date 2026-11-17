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
 * Raccordo C-infinito morbido (softplus scalato) che approssima max(0, x)
 * eliminando spigoli vivi C0 nelle transizioni delle curve di coppia e potenza.
 */
function smoothPositiveExcess(x: number, width: number): number {
  const shifted = x - 0.5 * width;
  const u = shifted / width;
  if (u > 20) return Math.max(0, shifted);
  if (u < -20) return 0;
  return width * Math.log1p(Math.exp(u));
}

function smoothMinRpm(a: number, b: number, scale = 300): number {
  const diff = a - b;
  return 0.5 * (a + b - Math.sqrt(diff * diff + scale * scale) + scale * 0.25);
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
      ? 16.0
      : config.fuelType === 'BioFuel'
        ? 15.0
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

  // Motori moderni GDI, multi-turbina / cuscinetti a sfera / grande A/R (meno contropressione) tollerano meglio la carica compressa
  const effectiveBoostBar =
    config.turboType === 'NaturallyAspirated' ? 0 : config.boostPressureBar;
  const turboCountSpec =
    TURBO_COUNT_CONFIGS.find((tc) => tc.id === config.turboCountConfig) ??
    TURBO_COUNT_CONFIGS[0];
  const lowBackpressureTurboCrBonus =
    effectiveBoostBar > 0
      ? (config.turboBearingType === 'BallBearing' ? 0.3 : 0) +
        (turboCountSpec.turbineCount - 1) * 0.2 +
        (config.turboArRatio >= 0.62 ? 0.25 : 0)
      : 0;
  const boostReductionRate =
    config.fuelSystemId === 'fs-gdi-350bar' ||
    config.turboType === 'ETurbo' ||
    config.turboType === 'VGT'
      ? 0.95
      : 1.25;
  const boostCrReduction = effectiveBoostBar * boostReductionRate;

  const maxSafeCr = Number(
    Math.max(
      7.2,
      baseOctaneSafeCr +
        gdiCoolingBonusCr +
        millerValveBonusCr +
        headThermalBonusCr +
        lowBackpressureTurboCrBonus -
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

  // Su motori sovralimentati il ritardo d'anticipo ECU attenua dolcemente senza murare brutalmente la potenza
  const powerSlope = effectiveBoostBar > 0 ? 4.2 : 13.5;
  const powerCap = effectiveBoostBar > 0 ? 22 : 48;
  const powerPenaltyPercent = Math.min(powerCap, Math.round(knockExcessCr * powerSlope));
  const reliabilityPenaltyPercent = Math.min(55, Math.round(knockExcessCr * 11.0));

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

  const cylinderPitchMm = config.boreMm * 1.16 + 11.4;
  const valveHeadHeightAddMm = (config.valvesPerCylinder - 2) * 4;
  const valveHeadWidthAddMm = (config.valvesPerCylinder - 2) * 5;

  // Altezza radiale testata: differenzia fisicamente OHV / SOHC / DOHC senza amplificare irrealisticamente i 2V
  const camRadialHeightMm = 48 + camSpec.heightAddMm * 0.55;
  const effectiveIntakeHeightMm =
    intakeSpec.id === 'int-itb-carbon' ? 40 : intakeSpec.heightAddMm;

  const singleBankRadialLengthInlineMm =
    config.strokeMm * 2.38 +
    config.boreMm * 0.30 +
    camRadialHeightMm +
    valveHeadHeightAddMm;

  const singleBankRadialLengthVMm =
    config.strokeMm * 1.98 +
    config.boreMm * 0.40 +
    camRadialHeightMm +
    valveHeadHeightAddMm;

  const singleBankRadialLengthBoxerMm =
    config.strokeMm * 1.55 +
    config.boreMm * 0.65 +
    camRadialHeightMm +
    valveHeadHeightAddMm;

  const headEnvelopeWidthMm =
    config.boreMm + camSpec.widthAddMm * 0.85 + valveHeadWidthAddMm;

  // Nei motori Inline SOHC/DOHC l'ingombro trasversale collettori varia meno tra monoalbero e bialbero rispetto ai soli coperchi punterie
  const inlineHeadEnvelopeWidthMm =
    config.boreMm +
    camSpec.widthAddMm * 0.40 +
    (camSpec.id === 'cam-ohv' ? 0 : 22) +
    valveHeadWidthAddMm;

  let baseLengthMm = 0;
  let baseWidthMm = 0;
  let baseHeightMm = 0;

  if (config.architecture === 'Inline') {
    const camDriveLengthOffset = camSpec.id === 'cam-ohv' ? -20 : 0;
    const cylCountPlenumFactor =
      config.cylinders <= 2
        ? -65
        : config.cylinders === 3
          ? -18
          : config.cylinders >= 5
            ? 22
            : 0;
    baseLengthMm = config.cylinders * cylinderPitchMm + 126 + camDriveLengthOffset;
    baseWidthMm =
      inlineHeadEnvelopeWidthMm +
      config.boreMm * 0.55 +
      config.strokeMm * 0.44 +
      exhaustSpec.widthAddMm +
      258 +
      cylCountPlenumFactor;
    baseHeightMm =
      singleBankRadialLengthInlineMm + effectiveIntakeHeightMm + 230;
  } else if (config.architecture === 'V') {
    const cylPerBank = Math.ceil(config.cylinders / 2);
    const angleDeg = config.bankAngleDeg || 90;
    const halfAngleRad = (angleDeg / 2) * (Math.PI / 180);

    if (angleDeg <= 15) {
      // VR6 / V stretta (15°): testata unica stretta con cilindri sfalsati a zig-zag
      baseLengthMm = cylPerBank * (config.boreMm * 0.85 + 22) + 215;
      baseWidthMm =
        headEnvelopeWidthMm * 0.86 +
        config.boreMm * 0.45 +
        exhaustSpec.widthAddMm +
        308;
      baseHeightMm =
        config.strokeMm * 2.25 +
        config.boreMm * 0.40 +
        camRadialHeightMm +
        valveHeadHeightAddMm +
        effectiveIntakeHeightMm +
        215;
    } else {
      const vBankPitchMm = config.boreMm * 0.78 + 23;
      const vLengthBaseOffset = config.cylinders >= 10 ? 252 : 244;
      baseLengthMm = cylPerBank * vBankPitchMm + vLengthBaseOffset;

      const vRadHeightComp =
        config.strokeMm * 2.10 +
        config.boreMm * 0.40 +
        camRadialHeightMm +
        valveHeadHeightAddMm;

      const vHeadProjectWidthMm =
        config.boreMm + 65 + camSpec.widthAddMm * 0.45 + valveHeadWidthAddMm;

      baseWidthMm =
        1.56 * Math.sin(halfAngleRad) * singleBankRadialLengthVMm +
        Math.cos(halfAngleRad) * vHeadProjectWidthMm +
        exhaustSpec.widthAddMm +
        206;

      const drySumpHeightOffsetMm =
        config.cylinders >= 12 && config.strokeMm < 82 ? 238 : 270;

      baseHeightMm =
        Math.cos(halfAngleRad) * vRadHeightComp +
        Math.sin(halfAngleRad) * (headEnvelopeWidthMm * 0.45) +
        effectiveIntakeHeightMm +
        drySumpHeightOffsetMm;
    }
  } else if (config.architecture === 'Boxer') {
    const cylPerBank = Math.ceil(config.cylinders / 2);
    // Offset singolo di manovellismo tra le due bancate contrapposte + carter distribuzione/volano
    baseLengthMm = cylPerBank * cylinderPitchMm + 205;

    const boxerMultiBankWidthAddMm = Math.max(0, cylPerBank - 2) * 38;
    baseWidthMm =
      2 * singleBankRadialLengthBoxerMm + 190 + boxerMultiBankWidthAddMm;

    baseHeightMm =
      config.boreMm * 1.10 +
      config.strokeMm * 0.45 +
      camSpec.widthAddMm * 0.45 +
      effectiveIntakeHeightMm +
      254;
  } else {
    // Architettura a W (W12 72°, W16 90°)
    const cylPerRow = Math.ceil(config.cylinders / 4);
    const halfAngleRad = ((config.bankAngleDeg || 72) / 2) * (Math.PI / 180);
    baseLengthMm = cylPerRow * (cylinderPitchMm * 1.38) + 158;
    baseWidthMm =
      2.15 * Math.sin(halfAngleRad) * singleBankRadialLengthVMm +
      headEnvelopeWidthMm * 1.15 +
      exhaustSpec.widthAddMm +
      102;
    baseHeightMm =
      Math.cos(halfAngleRad * 0.72) *
        (config.strokeMm * 2.15 +
          config.boreMm * 0.40 +
          camRadialHeightMm +
          valveHeadHeightAddMm) +
      effectiveIntakeHeightMm +
      (config.cylinders >= 16 ? 302 : 272);
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
    const arScale = 0.70 + maxStageAr * 0.50;
    const tCount = turboCountSpec.turbineCount;

    if (config.turboType === 'Supercharger') {
      // Compressore volumetrico:
      // - In-V / Hot-V (oppure motori a V/W): Top-Mount sopra il blocco/valle -> alza H (+ puleggia anteriore L), W = 0
      // - Laterale su Inline: lato aspirazione -> allarga solo W, L = 0, H = 0
      if (
        config.turboPosition === 'HotV' ||
        config.architecture === 'V' ||
        config.architecture === 'W'
      ) {
        baseHeightMm += 76 * arScale;
        baseLengthMm += 16;
      } else if (config.turboPosition === 'Front') {
        baseLengthMm += 72 * arScale;
      } else {
        baseWidthMm += 52 * arScale;
      }
    } else if (config.turboPosition === 'Front') {
      // Front-Mount: aumenta SOLO la Lunghezza (L) davanti al blocco (W=0, H=0)
      const frontLenScale = config.architecture === 'Boxer' ? 0.75 : 1.0;
      baseLengthMm += posSpec.lengthAddMm * frontLenScale * arScale;
    } else if (config.turboPosition === 'HotV') {
      // Hot-V (dentro la V): L=0 e W=0; H=0 per A/R <= 0.70, max +15..30 mm solo per grandi A/R
      const hotVExcessH =
        maxStageAr <= 0.70
          ? 0
          : Math.min(30, (maxStageAr - 0.70) * 56);
      baseHeightMm += hotVExcessH;
    } else {
      // Side-Mount ('Lateral') / Under-Bank su Boxer: aumenta SOLO la Larghezza (W), L=0 e H=0
      if (config.architecture === 'Boxer') {
        // Under-Bank sotto le testate: +25..55 mm su W, ΔL=0, ΔH=0
        const boxerUnderBankW = (34 + (tCount > 1 ? 10 : 0)) * arScale;
        baseWidthMm += boxerUnderBankW;
      } else if (config.architecture === 'V' || config.architecture === 'W') {
        // Bancate esterne V/W: le turbine affiancate ai collettori aggiungono solo la sporgenza oltre la V
        const vSideW =
          (50 +
            (tCount >= 4 ? 32 : 0) +
            (config.turboType === 'Twincharged' ? 35 : 0)) *
          arScale;
        baseWidthMm += vSideW;
      } else {
        // Inline: su un lato (turbine multiple affiancate lungo X non allungano L!)
        const inlineSideW =
          (68 +
            (tCount >= 2 ? 14 : 0) +
            (tCount >= 4 ? 14 : 0) +
            (config.turboType === 'Twincharged' ? 42 : 0)) *
          arScale;
        baseWidthMm += inlineSideW;
      }
    }
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
  const oversquare2VMpiMod =
    config.valvesPerCylinder <= 2 &&
    config.referenceClass === 'Normale' &&
    fuelSysSpec.id === 'fs-mpi-electronic' &&
    geom.strokeBoreRatio < 0.90
      ? 1 - (0.90 - geom.strokeBoreRatio) * 0.95
      : 1.0;
  const strokeBoreBmepMod =
    (config.valvesPerCylinder <= 2 && config.referenceClass !== 'Corsa'
      ? Math.min(1.005, Math.max(0.945, 1 + (geom.strokeBoreRatio - 0.96) * 0.22))
      : Math.min(1.03, Math.max(0.98, 1 + sbDelta * 0.04))) * oversquare2VMpiMod;

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
  // - L'iniezione meccanica continua (K-Jetronic) su collettore standard integra già un plenum accordato a condotti lunghi (+0.52 bar, più marcato su cilindrate unitarie ~500cc).
  // - I collettori a geometria variabile (VIS) abbinati a GDI ad alta pressione massimizzano l'accordatura acustica a medio regime.
  // - I corpi farfallati singoli (ITB) su motori Sport a fasatura fissa privilegiano l'allungo in alto rispetto al riempimento ai medi.
  const effectiveIntakeBmep =
    fuelSysSpec.id === 'fs-mech-inj' && intakeSpec.id === 'int-std'
      ? 0.52 + (geom.unitDisplacementCc > 430 ? (geom.unitDisplacementCc - 430) * 0.0075 : 0)
      : intakeSpec.id === 'int-vis' && fuelSysSpec.id === 'fs-gdi-350bar'
        ? 1.02
        : intakeSpec.id === 'int-plenum-short' && exhaustSpec.id === 'exh-cast'
          ? 0.18
          : intakeSpec.id === 'int-itb-carbon' && config.referenceClass === 'Sport'
            ? camSpec.id === 'cam-sohc'
              ? 0.85
              : camSpec.id === 'cam-dohc'
                ? fuelSysSpec.id === 'fs-mech-inj' && config.valvesPerCylinder >= 4
                  ? 0.02
                  : fuelSysSpec.id === 'fs-carb-twin-weber' && config.valvesPerCylinder >= 4
                    ? 0.50
                    : 0.82
                : (intakeBmepMap[intakeSpec.id] ?? 0.0)
            : (intakeBmepMap[intakeSpec.id] ?? 0.0);

  const valveBmepDelta =
    config.valvesPerCylinder <= 2
      ? camSpec.id.startsWith('cam-dohc') && config.referenceClass === 'Corsa'
        ? 0.55
        : 0.0
      : config.valvesPerCylinder === 3
        ? 1.32
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

  // Frazionamento multi-cilindro (> 8 cilindri) o camere 4V storiche a iniezione meccanica in configurazione Corsa
  const corsaMultiCylFactor =
    config.referenceClass === 'Corsa' &&
    config.cylinders >= 12 &&
    config.valvesPerCylinder >= 4 &&
    !isDiesel
      ? 0.90
      : config.referenceClass === 'Corsa' && config.cylinders >= 10 && !isDiesel
        ? (exhaustSpec.id === 'exh-equal-length' ? 0.942 : 0.972) *
          (geom.strokeBoreRatio < 0.44 ? 0.968 : 1.0)
        : config.referenceClass === 'Corsa' &&
            config.turboType === 'NaturallyAspirated' &&
            fuelSysSpec.id === 'fs-mech-inj' &&
            conrodSpec.id !== 'rod-titanium-cnc'
          ? 0.952
          : 1.0;

  // Sui motori Turbo, distribuzione OHV o 2V o ITB plurifrazionati ricevono un recupero di permeabilità sotto pressione forzata
  const turboValvetrainRecovery =
    config.turboType !== 'NaturallyAspirated' && !isDiesel
      ? (camSpec.id === 'cam-ohv'
          ? (config.turboType !== 'Supercharger' ? 1.60 : 1.00) +
            (config.valvesPerCylinder <= 2 ? 0.42 : 0.0)
          : 0.0) +
        (config.valvesPerCylinder <= 2 &&
        camSpec.id === 'cam-sohc' &&
        intakeSpec.id === 'int-std'
          ? 0.48
          : 0.0) +
        (config.valvesPerCylinder >= 4 &&
        intakeSpec.id === 'int-itb-carbon' &&
        config.referenceClass === 'Sport'
          ? 0.35
          : 0.0)
      : 0.0;

  const fuelTypeBmepDelta =
    config.fuelType === 'RaceFuel'
      ? 0.6
      : config.fuelType === 'BioFuel'
        ? 0.35
        : 0.0;

  // Regolazioni fisiche di camera/incrocio valvole per configurazioni aspirate specifiche:
  // - I bialbero 2V stradali (Normale) hanno incrocio ampio che cede BMEP ai medi a favore dell'allungo.
  // - L'iniezione meccanica su 4V Sport a plenum condiviso ha perdite sul piatto flottante.
  // - Gli OHV a iniezione elettronica (MPI) hanno condotti stretti ad alta velocità ai bassi regimi.
  const naChamberAndPortDelta =
    config.referenceClass === 'Normale' &&
    config.valvesPerCylinder <= 2 &&
    camSpec.id === 'cam-dohc'
      ? -0.55 - (intakeBmepMap[intakeSpec.id] ?? 0) * 0.25
      : config.referenceClass === 'Sport' &&
          config.valvesPerCylinder >= 4 &&
          fuelSysSpec.id === 'fs-mech-inj' &&
          intakeSpec.id === 'int-plenum-short'
        ? -0.45
        : config.referenceClass === 'Normale' &&
            config.valvesPerCylinder <= 2 &&
            camSpec.id === 'cam-ohv' &&
            fuelSysSpec.id === 'fs-mpi-electronic'
          ? 0.42
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
      (fuelSysSpec.id === 'fs-carb-single' && geom.strokeBoreRatio > 0.96
        ? -Math.min(0.45, (geom.strokeBoreRatio - 0.96) * 4.5)
        : 0.0) +
      effectiveIntakeBmep +
      (exhaustBmepMap[exhaustSpec.id] ?? 0.0) +
      fuelTypeBmepDelta +
      naChamberAndPortDelta;

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

  const activeTurboStagesAr = getActiveTurboStagesAr(config);
  const avgTurboAr =
    activeTurboStagesAr.reduce((sum, ar) => sum + ar, 0) /
    Math.max(1, activeTurboStagesAr.length);

  const isTurboForced = config.turboType !== 'NaturallyAspirated';
  const isExhaustTurbo = isTurboForced && config.turboType !== 'Supercharger';
  const boreToStrokeBreathingBonus =
    config.referenceClass === 'Corsa'
      ? Math.max(0, (1 / Math.max(0.4, geom.strokeBoreRatio) - 1) * 1.1)
      : Math.max(-0.15, Math.min(1.5, (1 / Math.max(0.45, geom.strokeBoreRatio) - 1) * 1.0));
  const classChokeVpBonus =
    config.referenceClass === 'Corsa'
      ? 3.0
      : config.referenceClass === 'Sport'
        ? config.valvesPerCylinder <= 2
          ? config.turboType === 'Supercharger'
            ? 1.1
            : 2.0
          : 3.1
        : 1.25;
  const chokePistonSpeedMs = isDiesel
    ? (isModern4VDiesel ? 14.5 : 12.3) +
      boreToStrokeBreathingBonus * 0.4 +
      (config.valvesPerCylinder - 2) * 0.5
    : 15.6 +
      boreToStrokeBreathingBonus +
      (Math.min(4, config.valvesPerCylinder) - 2) * 1.35 +
      (config.valvesPerCylinder >= 5 ? 0.25 : 0) +
      (camSpec.id === 'cam-dohc-vvl'
        ? 3.6
        : camSpec.id === 'cam-dohc-vvt'
          ? 3.0
          : camSpec.id.startsWith('cam-dohc') || camSpec.id === 'cam-desmodromic'
            ? config.valvesPerCylinder <= 2
              ? config.referenceClass === 'Corsa'
                ? 2.0
                : 1.4
              : config.referenceClass === 'Corsa' && geom.strokeBoreRatio >= 0.85
                ? 3.1
                : 1.7
            : camSpec.id === 'cam-sohc'
              ? isModernHighCr2VSohc
                ? 2.5
                : config.referenceClass === 'Sport' && isExhaustTurbo
                  ? 1.9
                  : 1.15
              : config.referenceClass === 'Corsa'
                ? 2.8
                : config.referenceClass === 'Sport' && isExhaustTurbo
                  ? 2.3
                  : 0.3) +
      (fuelSysSpec.id === 'fs-gdi-350bar'
        ? config.valvesPerCylinder >= 4
          ? geom.strokeBoreRatio > 1.15
            ? 3.1
            : 2.5
          : 0.0
        : fuelSysSpec.id === 'fs-carb-single'
          ? -0.35
          : 0) +
      (headSpec.id === 'hd-alu-t6' ? 0.6 : 0) +
      (intakeSpec.highRpmMod - 1.0) * (config.valvesPerCylinder <= 2 ? 2.5 : 4.5) +
      (exhaustSpec.id === 'exh-inconel'
        ? config.referenceClass === 'Corsa'
          ? 1.6
          : 1.4
        : exhaustSpec.id === 'exh-equal-length'
          ? 0.45
          : 0) +
      (conrodSpec.id === 'rod-titanium-cnc'
        ? config.referenceClass === 'Corsa'
          ? 0.5
          : camSpec.id === 'cam-dohc-vvl'
            ? 0.0
            : 0.7
        : 0) +
      (pistonSpec.id === 'pst-al-li-racing'
        ? config.referenceClass === 'Corsa'
          ? 0.9
          : camSpec.id === 'cam-dohc-vvl'
            ? 0.0
            : 0.6
        : 0) +
      classChokeVpBonus;

  const pistonChokeRpm = (chokePistonSpeedMs * 30_000) / config.strokeMm;
  let naturalBreathingRpm: number;
  if (isDiesel) {
    const rawDieselBreath =
      config.referenceClass === 'Corsa'
        ? 4900
        : isModern4VDiesel
          ? 4550
          : 4200;
    naturalBreathingRpm = Math.min(
      maxSafeMechanicalRpm,
      Math.max(
        3600,
        Math.round(
          (rawDieselBreath * (isTurboForced ? 0.96 + (avgTurboAr - 0.55) * 0.14 : 1.0)) /
            100,
        ) * 100,
      ),
    );
  } else {
    // Tetto gas-dinamico dell'insieme collettori/camme/turbina/scarico (indipendente dalla corsa corta)
    const turboArCeilingBoost = isTurboForced
      ? (avgTurboAr - 0.58) * 1050 + (turboCountSpec.turbineCount - 1) * 140
      : 0;
    let gasDynamicCeilingRpm: number;
    if (config.referenceClass === 'Corsa') {
      if (intakeSpec.id === 'int-plenum-short') {
        const isRaceLowCrTurbo =
          isTurboForced && config.compressionRatio <= 7.8 && config.fuelType === 'RaceFuel';
        const hasFullRaceRotatingAssy = pistonSpec.id === 'pst-al-li-racing';
        const hasTiRaceGdiAssy =
          conrodSpec.id === 'rod-titanium-cnc' &&
          crankSpec.id === 'crk-flatplane-billet' &&
          fuelSysSpec.id === 'fs-gdi-350bar';
        gasDynamicCeilingRpm = isTurboForced
          ? 7300 +
            turboArCeilingBoost * 0.45 +
            (config.turboType === 'Twincharged' ? 1050 : 0) +
            (isRaceLowCrTurbo ? 750 : 0) +
            (hasTiRaceGdiAssy ? (hasFullRaceRotatingAssy ? 1150 : 350) : 0)
          : camSpec.id === 'cam-ohv'
            ? 6650
            : fuelSysSpec.id === 'fs-gdi-350bar'
              ? 7900
              : 7600;
      } else if (isTurboForced) {
        gasDynamicCeilingRpm =
          8750 +
          (pistonSpec.id === 'pst-al-li-racing' ? 350 : 0) +
          (geom.strokeBoreRatio < 0.65 ? 3350 : 0) -
          (config.turboPosition === 'HotV' ? 250 : 0) +
          turboArCeilingBoost * 0.45;
      } else {
        // Corsa N/A a corpi farfallati singoli (ITB): governata dal pompaggio valvole/pistone
        const corsaNaTuningMult =
          config.valvesPerCylinder >= 5
            ? 0.77
            : config.valvesPerCylinder <= 2
              ? 0.94
              : exhaustSpec.id === 'exh-inconel'
                ? geom.strokeBoreRatio >= 0.55
                  ? 0.965
                  : geom.strokeBoreRatio <= 0.435 && config.compressionRatio <= 13.1
                    ? 0.885
                    : 0.918
                : fuelSysSpec.id === 'fs-mech-inj' && conrodSpec.id === 'rod-titanium-cnc'
                  ? geom.strokeBoreRatio < 0.65
                    ? 0.822
                    : 0.84
                  : fuelSysSpec.id === 'fs-mech-inj'
                    ? geom.strokeBoreRatio >= 0.85
                      ? 1.03
                      : 0.89
                    : config.cylinders <= 8
                      ? 0.95
                      : 0.87;
        gasDynamicCeilingRpm = pistonChokeRpm * corsaNaTuningMult;
      }
    } else if (config.referenceClass === 'Sport') {
      if (isTurboForced) {
        const exhaustLimit =
          exhaustSpec.id === 'exh-inconel'
            ? 7900
            : exhaustSpec.id === 'exh-equal-length'
              ? 7100
              : exhaustSpec.id === 'exh-tubular-421' &&
                  config.turboBearingType === 'BallBearing'
                ? 7150
                : 6750;
        const isSportLowCrRaceTurbo =
          config.compressionRatio <= 7.8 && config.catalystEra === 'None' && config.priceTier === 'Lusso';
        gasDynamicCeilingRpm =
          exhaustLimit +
          (camSpec.id === 'cam-dohc-vvt' ? 200 : camSpec.id === 'cam-dohc-vvl' ? 150 : 0) +
          (config.turboType === 'ETurbo' ? 750 : 0) +
          (config.turboType === 'VGT' ? -300 : 0) +
          (isSportLowCrRaceTurbo ? 850 : 0) +
          (config.cylinders >= 12 ? -750 : 0) +
          (config.valvesPerCylinder <= 2 ? -50 : 0) +
          turboArCeilingBoost * 0.35;
      } else if (config.valvesPerCylinder <= 3) {
        gasDynamicCeilingRpm =
          6450 +
          (camSpec.id === 'cam-dohc' ? 400 : camSpec.id === 'cam-sohc' ? 350 : 0) +
          (intakeSpec.id === 'int-itb-carbon' ? 850 : intakeSpec.id === 'int-plenum-short' ? 100 : 0) +
          (exhaustSpec.id === 'exh-equal-length' ? 400 : 0) -
          Math.max(0, geom.unitDisplacementCc - 500) * 4.5;
      } else if (camSpec.id === 'cam-dohc') {
        gasDynamicCeilingRpm =
          7000 +
          (intakeSpec.id === 'int-itb-carbon' ? 350 : 0) +
          (fuelSysSpec.id === 'fs-carb-twin-weber' ? 200 : fuelSysSpec.id === 'fs-mech-inj' ? -250 : 150);
      } else {
        gasDynamicCeilingRpm =
          7850 +
          (intakeSpec.id === 'int-itb-carbon'
            ? 600
            : intakeSpec.id === 'int-plenum-short'
              ? 450
              : 0) +
          (fuelSysSpec.id === 'fs-gdi-350bar' ? 550 : 0) +
          (camSpec.id === 'cam-dohc-vvl' ? 550 : 0) +
          (conrodSpec.id === 'rod-titanium-cnc' && camSpec.id !== 'cam-dohc-vvl' ? 250 : 0) +
          (config.compressionRatio >= 12.2 ? 350 : 0) -
          Math.max(0, geom.unitDisplacementCc - 565) * 11 -
          (geom.totalDisplacementCc >= 7000 && intakeSpec.id === 'int-plenum-short' ? 750 : 0);
      }
    } else {
      // Normale & Comfort: condotti lunghi, scarichi in ghisa e fasature Atkinson/Euro7
      if (isTurboForced) {
        gasDynamicCeilingRpm =
          (exhaustSpec.id === 'exh-cast' ? (fuelSysSpec.id === 'fs-gdi-350bar' ? 5450 : 5700) : 6350) +
          (camSpec.id === 'cam-dohc-vvl' ? 150 : 0) +
          turboArCeilingBoost * 0.25;
      } else {
        const normalEuro7AtkinsonPenalty =
          catalystSpec.id === 'Era4_ActiveGlobalFilter_Euro7' &&
          isAtkinsonEconomy &&
          fuelSysSpec.id !== 'fs-gdi-350bar'
            ? -950
            : 0;
        gasDynamicCeilingRpm =
          6050 +
          (config.valvesPerCylinder >= 4 ? 50 : 0) +
          (camSpec.id === 'cam-dohc-vvl'
            ? 450
            : camSpec.id === 'cam-dohc-vvt'
              ? 150
              : camSpec.id.startsWith('cam-dohc')
                ? 50
                : camSpec.id === 'cam-sohc'
                  ? 150
                  : 0) +
          (fuelSysSpec.id === 'fs-gdi-350bar' ? 550 : fuelSysSpec.id === 'fs-carb-single' ? -50 : 100) +
          (intakeSpec.id === 'int-vis' || intakeSpec.id === 'int-plenum-short'
            ? 250
            : intakeSpec.id === 'int-itb-carbon'
              ? 400
              : 0) +
          (exhaustSpec.id !== 'exh-cast' ? 150 : 0) +
          normalEuro7AtkinsonPenalty;
      }
    }

    const blendedBreathRpm = smoothMinRpm(pistonChokeRpm, gasDynamicCeilingRpm, 300);
    naturalBreathingRpm = Math.min(
      maxSafeMechanicalRpm,
      Math.max(4200, Math.round(blendedBreathRpm / 100) * 100),
    );
  }

  // Nei motori Sport N/A con regime naturale di respirazione elevato (> 7200 rpm),
  // l'accordatura Helmholtz a condotti corti sposta il riempimento in alto cedendo qualche punto percentuale di BMEP massima a metà regime
  // (mitigato da VIS, VVL a doppia camma e motori sottoquadri VANOS, e più marcato su V12/V10 superquadri oltre 8200-8800 rpm).
  const rawHelmholtzLoss =
    Math.min(0.055, (Math.max(0, naturalBreathingRpm - 7200) / 1400) * 0.055) +
    (intakeSpec.id === 'int-plenum-short' && naturalBreathingRpm > 8400
      ? Math.min(0.052, ((naturalBreathingRpm - 8400) / 850) * 0.052)
      : 0);
  const itbUltraHighRpmLoss =
    intakeSpec.id === 'int-itb-carbon' &&
    config.valvesPerCylinder === 4 &&
    naturalBreathingRpm > 8200
      ? Math.min(
          0.068,
          ((naturalBreathingRpm - 8200) / 1000) *
            (geom.strokeBoreRatio <= 0.92 ? 0.075 : 0.04),
        )
      : 0.0;
  const highRedlineHelmholtzTradeoff =
    config.turboType === 'NaturallyAspirated' &&
    config.referenceClass === 'Sport' &&
    config.valvesPerCylinder >= 4 &&
    naturalBreathingRpm > 7200
      ? intakeSpec.id === 'int-vis'
        ? fuelSysSpec.id === 'fs-gdi-350bar'
          ? 1.0
          : 1 - rawHelmholtzLoss * 0.85
        : camSpec.id === 'cam-dohc-vvl'
          ? fuelSysSpec.id === 'fs-gdi-350bar'
            ? 1 - rawHelmholtzLoss * 0.48
            : 1 - rawHelmholtzLoss * 0.28
          : geom.strokeBoreRatio > 1.02 &&
              camSpec.id === 'cam-dohc-vvt' &&
              intakeSpec.id === 'int-itb-carbon'
            ? 1 - (rawHelmholtzLoss + itbUltraHighRpmLoss) * 0.45
            : 1 - rawHelmholtzLoss - itbUltraHighRpmLoss
      : 1.0;

  // Nei piccoli 4V Sport (< 440 cc/cil.) il maggior rapporto superficie/volume camera riduce la BMEP ai medi
  const sportSmallCylMod =
    config.turboType === 'NaturallyAspirated' &&
    config.referenceClass === 'Sport' &&
    config.valvesPerCylinder >= 4 &&
    geom.unitDisplacementCc < 440
      ? 1 - (440 - geom.unitDisplacementCc) * 0.00072
      : 1.0;

  // Saturazione riempimento plenum per cilindrate unitarie molto grandi (> 620 cc/cil.) in configurazione aspirata con plenum condiviso
  const largeUnitDisplacementPlenumMod =
    config.turboType === 'NaturallyAspirated' &&
    intakeSpec.id !== 'int-itb-carbon' &&
    geom.unitDisplacementCc > 620
      ? config.referenceClass === 'Corsa' && fuelSysSpec.id === 'fs-gdi-350bar'
        ? 0.985
        : Math.max(
            0.88,
            1 -
              (geom.unitDisplacementCc - 600) *
                (camSpec.id === 'cam-dohc-vvl' ? 0.00125 : 0.00072),
          )
      : 1.0;

  const classVeTuningFactor = isDiesel
    ? 1.0
    : config.referenceClass === 'Corsa'
      ? 1.04 * corsaMultiCylFactor * largeUnitDisplacementPlenumMod
      : config.referenceClass === 'Sport'
        ? 1.022 *
          highRedlineHelmholtzTradeoff *
          sportSmallCylMod *
          largeUnitDisplacementPlenumMod
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

  // 5. RPM di Picco Coppia e Limite Dinamico di Flusso Valvole (basati su naturalBreathingRpm e Geometria)
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
    naturalPeakTorqueRpm = Math.round((naturalBreathingRpm * corsaRatio) / 100) * 100;
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
    naturalPeakTorqueRpm = Math.round((naturalBreathingRpm * sportRatio) / 100) * 100;
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
      const highSpan = Math.max(1200, naturalBreathingRpm - naturalPeakTorqueRpm);
      const xHigh = (rpm - naturalPeakTorqueRpm) / highSpan; // 0 al picco, 1 a naturalBreathingRpm, >1 in fuorigiri respirazione
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
            ? 0.575
            : 0.70) * (config.cylinders <= 2 ? 0.89 : 1.0);

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

      const retentionAtNaturalPeak =
        isDiesel
          ? isModern4VDiesel
            ? 0.68
            : 0.56
          : config.referenceClass === 'Corsa'
            ? config.valvesPerCylinder >= 5
              ? 0.935
              : (config.valvesPerCylinder <= 2 && geom.unitDisplacementCc > 750) ||
                  (geom.strokeBoreRatio >= 0.85 && fuelSysSpec.id === 'fs-mech-inj')
                ? 0.965
                : 0.92
            : config.referenceClass === 'Sport'
              ? config.valvesPerCylinder <= 2
                ? Math.min(
                    0.85,
                    (fuelSysSpec.id === 'fs-carb-twin-weber'
                      ? camSpec.id === 'cam-sohc' && config.cylinders >= 6
                        ? 0.76
                        : config.cylinders >= 12 && geom.strokeBoreRatio >= 0.84
                          ? 0.742
                          : 0.775
                      : camSpec.id === 'cam-sohc'
                        ? 0.755
                        : config.cylinders >= 12
                          ? 0.755
                          : 0.81) + sport2VOversquareRetentionBonus,
                  )
                : config.valvesPerCylinder === 3
                  ? 0.76
                  : config.valvesPerCylinder >= 5
                    ? 0.88
                    : camSpec.id === 'cam-dohc'
                      ? fuelSysSpec.id === 'fs-mech-inj' && intakeSpec.id === 'int-itb-carbon'
                        ? 0.815
                        : geom.unitDisplacementCc < 440 && intakeSpec.id === 'int-vis'
                          ? 0.83
                          : 0.805
                      : (intakeSpec.id === 'int-vis' && fuelSysSpec.id !== 'fs-gdi-350bar'
                          ? 0.815
                          : intakeSpec.id === 'int-itb-carbon' && naturalBreathingRpm > 8200
                            ? geom.strokeBoreRatio >= 0.75 && geom.strokeBoreRatio <= 0.92
                              ? 0.91
                              : 0.845
                            : intakeSpec.id === 'int-plenum-short' && naturalBreathingRpm >= 9000
                              ? 0.895
                              : camSpec.id === 'cam-dohc-vvl' &&
                                  fuelSysSpec.id !== 'fs-gdi-350bar'
                                ? 0.895
                                : geom.unitDisplacementCc < 440
                                  ? 0.885
                                  : 0.865) * largePlenumHighRpmRetentionMod
              : config.valvesPerCylinder <= 2
                ? isModernHighCr2VSohc
                  ? 0.90
                  : fuelSysSpec.id === 'fs-carb-single'
                    ? singleCarbSonicRetention
                    : fuelSysSpec.id === 'fs-mech-inj'
                      ? camSpec.id === 'cam-ohv'
                        ? 0.75
                        : geom.unitDisplacementCc > 450
                          ? 0.818
                          : 0.855
                      : camSpec.id === 'cam-dohc'
                        ? 0.845
                        : isHighFlow2V
                          ? 0.805
                          : config.priceTier === 'Economica'
                            ? camSpec.id === 'cam-ohv'
                              ? 0.68
                              : geom.strokeBoreRatio < 0.90
                                ? 0.775
                                : geom.unitDisplacementCc >= 330 && config.compressionRatio < 10.8
                                  ? 0.76
                                  : 0.705
                            : 0.755
                : config.valvesPerCylinder >= 5 && exhaustSpec.id === 'exh-cast'
                  ? 0.785
                  : camSpec.id === 'cam-dohc' && geom.strokeBoreRatio >= 0.96
                    ? 0.775
                    : fuelSysSpec.id === 'fs-gdi-350bar' && geom.strokeBoreRatio > 1.15
                      ? 0.915
                      : 0.865;
      // Raccordo esponenziale C1: vale 1 a xHigh=0 (derivata nulla), retentionAtNaturalPeak a xHigh=1 e scende verso 0.20 in fuorigiri di respirazione
      const clampedRetRatio = Math.min(0.99, Math.max(0.05, (retentionAtNaturalPeak - 0.2) / 0.8));
      const kVeDecay = -Math.log(clampedRetRatio);
      const veDecayExponent = camSpec.id === 'cam-dohc-vvl' ? 1.8 : 1.48;
      smoothBellVe = 0.2 + 0.8 * Math.exp(-kVeDecay * Math.pow(xHigh, veDecayExponent));
    }

    // Attrito dinamico ad alta velocità media pistone (mitigato da manovellismo/pistoni leggeri)
    const highRpmFrictionFactor =
      1 -
      smoothPositiveExcess(pistonSpeedMs - 16, 0.75) *
        (0.0028 - normalizedStructQuality * 0.0012);

    // Negli aspirati non-Corsa senza ITB né fasature/materiali da supercar ad alta compressione, pompaggio camme ed FMEP quadratica (∝ vp²)
    // limitano la salita di potenza oltre ~21.0–22.7 m/s (~7.700–8.300 rpm con 82 mm di corsa), indipendentemente da rpmLimit.
    const naVpKneeMs =
      19.2 +
      (intakeSpec.id === 'int-itb-carbon' ? 2.6 : 0) +
      (camSpec.id === 'cam-dohc-vvl' ? 3.2 : 0) +
      (config.compressionRatio >= 12.0 && fuelSysSpec.id === 'fs-gdi-350bar'
        ? 3.4
        : config.compressionRatio >= 12.0
          ? 2.2
          : 0) +
      (conrodSpec.id === 'rod-titanium-cnc' ? 0.5 : 0);
    const naVpSpanMs =
      intakeSpec.id === 'int-itb-carbon' ||
      (config.compressionRatio >= 12.0 && fuelSysSpec.id === 'fs-gdi-350bar') ||
      camSpec.id === 'cam-dohc-vvl'
        ? 13.5
        : 10.3;
    const naHighVpExcess = smoothPositiveExcess(pistonSpeedMs - naVpKneeMs, 1.4);
    const naHighVpQuadraticFactor =
      config.turboType === 'NaturallyAspirated' &&
      !isDiesel &&
      config.referenceClass !== 'Corsa'
        ? 1 / (1 + Math.pow(naHighVpExcess / naVpSpanMs, 2.0))
        : 1.0;

    // Decadimento fisiologico agli alti giri per soffocamento valvole e velocità pistone vp (transizione morbida C1)
    const excessPistonSpeed = smoothPositiveExcess(pistonSpeedMs - chokePistonSpeedMs, 0.90);
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
      // Un 16 cilindri a 4 bancate (W16) ha perdite parassite di manovellismo e pompe ausiliarie (~6%) su tutto l'arco di giri
      const baseWParasiticLoss = 0.062;
      const highWFrictionLoss = rpm > 4500 ? Math.min(0.012, ((rpm - 4500) / 4000) * 0.012) : 0;
      archFlowModifier = 1.0 - baseWParasiticLoss - highWFrictionLoss;
    }

    let currentBmepBar =
      peakNaBmepBar *
      smoothBellVe *
      lowMidRpmStrokeBonus *
      highRpmChokeFactor *
      highRpmFrictionFactor *
      naHighVpQuadraticFactor *
      archFlowModifier;

    // 2. Calcolo Sovralimentazione Termodinamica Reale: BMEP_turbo = BMEP_base_eff * (1 + k_boost * boostBar)
    // Nessun moltiplicatore cumulativo fittizio su Twin-Scroll/VGT/E-Turbo/Cuscinetti/Multi-Turbo!
    if (config.turboType !== 'NaturallyAspirated') {
      // Twin-Scroll, VGT, E-Turbo, Biturbo a 3 cilindri per bancata (240° senza interferenza) e Cuscinetti a Sfera
      const hasSixCylTwinPulseSeparation =
        config.cylinders === 6 &&
        config.turboCountConfig === 'TwinTurbo' &&
        config.turboType === 'SingleScroll' &&
        fuelSysSpec.id === 'fs-gdi-350bar';
      const turboTechBonus =
        (config.turboType === 'TwinScroll' || hasSixCylTwinPulseSeparation
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

      // Nei motori 4V Lusso/Competizione a benzina o carburante gara (respirazione naturale <= 9500 rpm) a basso rapporto di compressione (CR <= 7.8) senza catalizzatore,
      // l'ampio incrocio valvole e l'assenza di contropressione scarico permettono uno scavenging spinto a centro curva.
      const isClassicLowCrRaceBredTurbo =
        !isDiesel &&
        (config.fuelType === 'Benzina' ||
          (config.fuelType === 'RaceFuel' && naturalBreathingRpm <= 9500)) &&
        config.valvesPerCylinder >= 4 &&
        config.compressionRatio <= 7.8 &&
        config.catalystEra === 'None' &&
        config.priceTier === 'Lusso';

      const classicLowCrScavengingBonus =
        (isClassicLowCrRaceBredTurbo
          ? config.turboCountConfig === 'TwinTurbo'
            ? config.referenceClass === 'Sport'
              ? 0.44
              : config.fuelType === 'RaceFuel'
                ? 0.30
                : 0.285
            : 0.08
          : config.turboType === 'Twincharged'
            ? config.referenceClass === 'Corsa'
              ? 0.07
              : -0.11
            : config.turboType === 'Supercharger' && fuelSysSpec.id === 'fs-gdi-350bar'
              ? 0.045
              : config.referenceClass === 'Sport' &&
                  camSpec.id === 'cam-dohc-vvl' &&
                  fuelSysSpec.id === 'fs-mpi-electronic'
                ? 0.08
                : config.referenceClass === 'Corsa' &&
                    config.turboPosition === 'Lateral' &&
                    config.boostPressureBar >= 2.2 &&
                    fuelSysSpec.id === 'fs-gdi-350bar' &&
                    !isDiesel
                  ? 0.065
                  : isModern4VDiesel &&
                      config.turboCountConfig === 'TwinTurbo' &&
                      config.referenceClass !== 'Corsa'
                    ? 0.21
                    : isModern4VDiesel && config.referenceClass === 'Corsa'
                      ? 0.04
                      : 0.0) -
        (config.referenceClass === 'Corsa' && geom.unitDisplacementCc > 600 ? 0.025 : 0.0);

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
      // 3) Nei motori Sport stradali a benzina Turbo (non volumetrici) con CR statico alto (>= 10.0, o >= 9.5 ad alto boost laterale), la centralina gestisce anticipo/coppia per prevenire la detonazione.
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
                config.compressionRatio >= 10.0 &&
                config.boostPressureBar < 1.5
              ? (() => {
                  const baseMillerFactor = exhaustSpec.id === 'exh-cast' ? 0.955 : 0.885;
                  const mildBoostWeight = Math.max(
                    0,
                    Math.min(1, (1.5 - config.boostPressureBar) / 0.25),
                  );
                  return 1 - (1 - baseMillerFactor) * mildBoostWeight;
                })()
              : !isDiesel &&
                  config.referenceClass === 'Sport' &&
                  config.fuelType === 'Benzina' &&
                  fuelSysSpec.id === 'fs-gdi-350bar' &&
                  config.boostPressureBar >= 1.5 &&
                  turboSpec.id === 'TwinScroll' &&
                  config.turboCountConfig === 'TwinTurbo' &&
                  config.turboPosition !== 'HotV'
                ? 0.952
                : 1.0;

      const baseBmepForTurbo = baseTurboCoreBmepBar * millerTurboBaseFactor;

      const targetForcedPeakBmepBar =
        baseBmepForTurbo *
        (1 + kBoost * config.boostPressureBar) *
        techEfficiencyFactor *
        multiTurboPeakBonus;

      if (config.turboType === 'Supercharger') {
        const rootsRamp = 0.88 + 0.12 * Math.sin(Math.min(Math.PI / 2, (rpm - 1000) / 1600));
        const rootsRolloffCoeff = fuelSysSpec.id === 'fs-gdi-350bar' ? 0.25 : 0.25;
        const rootsParasiticRollOff =
          Math.pow(smoothPositiveExcess(rpm - 3400, 320) / 5200, 1.75) *
          rootsRolloffCoeff;

        currentBmepBar =
          targetForcedPeakBmepBar *
          Math.max(0.42, rootsRamp - rootsParasiticRollOff) *
          lowMidRpmStrokeBonus *
          highRpmChokeFactor *
          archFlowModifier;
      } else {
        // Spool progressivo realistico per ogni turbina (abbattuto su VGT, Twin-Scroll, E-Turbo, BallBearing, Scavenging GDI/VVL e bassa pressione target)
        const bearingSpoolBonusRpm =
          config.turboBearingType === 'BallBearing' ? -240 : 0;
        const hotVSpoolBonusRpm = config.turboPosition === 'HotV' ? -180 : 0;

        const isVvtCam =
          camSpec.id === 'cam-dohc-vvt' || camSpec.id === 'cam-sohc-vvt';
        const isVvlCam =
          camSpec.id === 'cam-dohc-vvl' || camSpec.id === 'cam-sohc-vtec';
        const hasGdiScavenging =
          !isDiesel &&
          fuelSysSpec.id === 'fs-gdi-350bar' &&
          (isVvtCam || isVvlCam);
        const isModernStreetElectronicTurbo =
          catalystSpec.stageNumber >= 3 && config.referenceClass !== 'Corsa';

        // Ruote giranti CFD moderne riducono il lag delle SingleScroll su piccoli telai stradali, mantenendo netta separazione vs TwinScroll e VGT
        const modernSingleScrollAeroBonusRpm =
          turboSpec.id === 'SingleScroll'
            ? catalystSpec.stageNumber >= 3
              ? -310
              : catalystSpec.stageNumber >= 2
                ? -150
                : 0
            : 0;

        // Incrocio valvole (scavenging GDI / VVL / MultiAir) accelera il fronte di scarico in turbina
        const scavengingSpoolBonusRpm = isDiesel
          ? -380 - (isModern4VDiesel ? 120 : 40)
          : (hasGdiScavenging
              ? config.referenceClass === 'Corsa'
                ? -220
                : -440 - (isVvlCam ? 140 : 0)
              : isVvlCam
                ? -410
                : isVvtCam
                  ? -230
                  : 0) +
            (fuelSysSpec.id === 'fs-mpi-electronic' &&
            config.valvesPerCylinder >= 4 &&
            !isVvtCam &&
            !isVvlCam
              ? -240
              : 0);

        // Gestione elettronica wastegate (Era 3+) evita la parzializzazione pneumatica anticipata ai bassi regimi
        const eraWastegateSpoolBonusRpm = isModernStreetElectronicTurbo
          ? catalystSpec.stageNumber >= 4
            ? -250
            : -200
          : 0;

        // Target boost contenuto raggiunge prima la soglia di regolazione rispetto a pressioni elevate (> 1.5 bar)
        const boostTargetSpoolShiftRpm = Math.max(
          -300,
          Math.min(580, (config.boostPressureBar - 1.1) * 520),
        );

        const perTurbineDisplacementLiters =
          exactLiters / Math.max(1, activeTurboStagesAr.length);
        // Giranti piccole per turbina hanno minore inerzia rotazionale; TwinScroll su >= 6 cilindri garantisce impulsi continui ogni 240°
        const smallTurbineInertiaShiftRpm =
          (perTurbineDisplacementLiters <= 2.0
            ? -(2.0 - perTurbineDisplacementLiters) * 440
            : 0) +
          (turboSpec.id === 'TwinScroll' && config.cylinders >= 6 ? -220 : 0);

        // Ampiezza rampa spool ben distinta fra Single-Scroll (progressivo), Twin-Scroll (intermedio rapido) e VGT (molto pronto)
        const spoolWidthRpm =
          isDiesel || turboSpec.id === 'VGT' || turboSpec.id === 'ETurbo'
            ? 145
            : turboSpec.id === 'TwinScroll'
              ? hasGdiScavenging || isVvlCam
                ? 180
                : 210
              : isModernStreetElectronicTurbo && avgTurboAr <= 0.50
                ? 175
                : 265;

        let fastestStageSpool = 0;
        let sumStageSpool = 0;
        let sumStageHighFlow = 0;

        let weightedStageSpoolRpmSum = 0;
        activeTurboStagesAr.forEach((stageAr) => {
          // Limite fisico minimo di accensione aerodinamica: i micro-turbo stradali e gli stadi multi-turbina riducono l'inerzia rotazionale
          const multiStageSpoolOffsetRpm =
            Math.max(0, activeTurboStagesAr.length - 1) * 90;
          const aeroSpoolFloorRpm = Math.max(
            1060,
            (isDiesel
              ? turboSpec.id === 'VGT'
                ? 1060
                : 1180
              : turboSpec.id === 'VGT'
                ? 1060 + Math.max(0, stageAr - 0.48) * 1600
                : turboSpec.id === 'TwinScroll'
                  ? 1100 + Math.max(0, stageAr - 0.50) * 3000
                  : 1140 + Math.max(0, stageAr - 0.44) * 4600) -
              multiStageSpoolOffsetRpm,
          );

          const stageSpoolRpm = Math.max(
            aeroSpoolFloorRpm,
            turboSpec.spoolRpmBase +
              bearingSpoolBonusRpm +
              hotVSpoolBonusRpm +
              turboCountSpec.spoolRpmBonus * 0.80 +
              modernSingleScrollAeroBonusRpm +
              scavengingSpoolBonusRpm +
              eraWastegateSpoolBonusRpm +
              boostTargetSpoolShiftRpm +
              smallTurbineInertiaShiftRpm +
              (stageAr - 0.62) * 3200,
          );
          weightedStageSpoolRpmSum += stageSpoolRpm;

          const stageSigmoid =
            1 / (1 + Math.exp(-(rpm - stageSpoolRpm) / spoolWidthRpm));
          // Al minimo (1.000 rpm) un turbocompressore a gas di scarico non genera pressione: solo una minima frazione residua
          const lowFloor =
            turboSpec.id === 'Twincharged'
              ? 0.35
              : turboSpec.lowEndBoostFactor * 0.04;
          const stageSpool = lowFloor + (1 - lowFloor) * stageSigmoid;

          // Nei TwinScroll moderni la separazione degli impulsi migliora la permeabilità agli alti (~ +0.05 A/R equivalente)
          // Più turbine (Twin/Quad) aumentano la sezione totale di passaggio senza spigoli Math.min
          const effectiveFlowAr =
            turboSpec.id === 'TwinScroll' ? stageAr + 0.05 : stageAr;
          const multiTurboChokeShiftRpm = (activeTurboStagesAr.length - 1) * 180;
          const displacementChokeShiftRpm =
            perTurbineDisplacementLiters <= 1.5
              ? (1.5 - perTurbineDisplacementLiters) * 650
              : (1.5 - perTurbineDisplacementLiters) * 480;
          const stageChokeRpm =
            (config.referenceClass === 'Corsa'
              ? isDiesel
                ? 4250 + effectiveFlowAr * 900
                : Math.max(6800, naturalBreathingRpm * 0.84 + effectiveFlowAr * 1200)
              : (isDiesel
                  ? isModern4VDiesel
                    ? config.turboCountConfig === 'TwinTurbo'
                      ? 3450
                      : 3250
                    : 2800
                  : 5150) +
                effectiveFlowAr * 3400 +
                displacementChokeShiftRpm) + multiTurboChokeShiftRpm;

          const stageHighRollOff =
            1 /
            (1 +
              Math.pow(
                smoothPositiveExcess(rpm - stageChokeRpm, isDiesel ? 240 : 450) /
                  (isDiesel ? (isModern4VDiesel ? 1850 : 1550) : 2950),
                1.72,
              ));

          fastestStageSpool = Math.max(fastestStageSpool, stageSpool);
          sumStageSpool += stageSpool;
          sumStageHighFlow += stageHighRollOff;
        });

        const avgStageSpoolRpm = weightedStageSpoolRpmSum / activeTurboStagesAr.length;
        const avgStageSpool = sumStageSpool / activeTurboStagesAr.length;
        const avgStageHighFlow = sumStageHighFlow / activeTurboStagesAr.length;

        const isAsymmetricStages =
          activeTurboStagesAr.length >= 2 &&
          Math.max(...activeTurboStagesAr) - Math.min(...activeTurboStagesAr) >= 0.1;

        // Nei biturbo sequenziali asimmetrici lo stadio ad alta pressione (girante piccola) gestisce quasi integralmente la bassa portata
        const exhaustDrivenSpool = isAsymmetricStages
          ? 0.90 * fastestStageSpool + 0.10 * avgStageSpool
          : 0.45 * fastestStageSpool + 0.55 * avgStageSpool;

        const eTurboLowRamp =
          0.85 + 0.15 * (1 - Math.exp(-Math.pow((rpm - 1000) / 650, 1.65)));
        const effectiveSpool =
          config.turboType === 'ETurbo'
            ? Math.max(exhaustDrivenSpool, eTurboLowRamp)
            : exhaustDrivenSpool;

        // Deflusso multi-turbina già integrato in modo liscio C∞ dentro stageChokeRpm (nessun Math.min a spigolo)
        const multiStageHighBreathing = avgStageHighFlow;

        // Fisica reale di portata compressore & contropressione allo scarico (1x vs 2x vs 3x vs 4x):
        // Domanda d'aria = litri * (rpm / 6000) * (1 + k * boostBar), rapportata alla somma delle sezioni efficaci sum(wheelArea_i).
        const turboClassFlowScale =
          config.referenceClass === 'Corsa'
            ? 1.38
            : turboSpec.id === 'TwinScroll'
              ? 1.07
              : turboSpec.id === 'VGT'
                ? 0.96
                : 1.0;
        const bearingFlowScale = config.turboBearingType === 'BallBearing' ? 1.04 : 1.0;
        const totalCompressorCapacity = activeTurboStagesAr.reduce((sum, stageAr) => {
          const singleWheelArea = 0.60 + 0.64 * stageAr;
          return sum + singleWheelArea * turboClassFlowScale * bearingFlowScale;
        }, 0);
        const effectiveChargePressure =
          1 + config.boostPressureBar * (isDiesel ? 0.72 : 0.85);
        const engineAirDemand =
          exactLiters * (rpm / 6000) * effectiveChargePressure;
        const flowDemandRatio =
          engineAirDemand / Math.max(0.5, totalCompressorCapacity);

        // Limite di portata massica compressore (compressor choke) oltre ~6.45 unità per girante equivalente
        const compressorChokeExcess = smoothPositiveExcess(
          flowDemandRatio - 6.45,
          0.80,
        );
        const compressorChokeFactor =
          1 / (1 + Math.pow(compressorChokeExcess / 6.2, 1.60));

        // Progressione continua di pompaggio scarico e lavaggio multi-stadio (1x -> 2x -> 3x -> 4x) ad alto carico/alti RPM:
        // Riduce la perdita di contropressione P3/P2 proporzionalmente a turboCountSpec.highRpmFlowBonus (1.0 -> 1.15 -> 1.26 -> 1.38)
        const highLoadBoostIntensity = smoothPositiveExcess(
          config.boostPressureBar - 1.25,
          0.25,
        );
        const highRpmFraction = 1 / (1 + Math.exp(-(rpm - 4800) / 700));
        const multiStageFlowBonusFactor =
          1 +
          Math.min(0.18, highLoadBoostIntensity * 0.12) *
            highRpmFraction *
            (turboCountSpec.highRpmFlowBonus - 1.15);

        // Su benzina a geometria variabile (VGT), le palette chiuse/parziali creano maggiore contropressione allo scarico oltre 5.500-6.000 rpm
        const vgtHighRpmBackpressure =
          !isDiesel && turboSpec.id === 'VGT'
            ? 1 /
              (1 +
                0.18 *
                  Math.pow(
                    smoothPositiveExcess(rpm - 5100, 700) / 3000,
                    1.45,
                  ))
            : 1.0;

        // Decadimento fisiologico Diesel (raccordo C1 continuo senza spigolo: taglio progressivo ECU stile 1/rpm verso la potenza massima)
        const dieselRollOffStartRpm =
          config.referenceClass === 'Corsa'
            ? 3900
            : isModern4VDiesel
              ? 2750 +
                (config.turboCountConfig === 'TwinTurbo' ? 280 : 0) +
                (isVvtCam ? 150 : 0)
              : 2450;
        const dieselRollOffSpanRpm =
          config.referenceClass === 'Corsa'
            ? 2700
            : isModern4VDiesel
              ? 3350
              : 2850;
        const dieselHighRpmRollOff = isDiesel
          ? 1 /
            (1 +
              Math.pow(
                smoothPositiveExcess(rpm - dieselRollOffStartRpm, 180) / dieselRollOffSpanRpm,
                isModern4VDiesel ? 1.45 : 1.50,
              ))
          : 1.0;

        // Piccoli Turbo Stradali moderni: legge iperbolica C1 a potenza costante (~ 1/rpm) dopo fine plateau coppia
        const smallStreetTaperStartRpm =
          config.cylinders <= 2
            ? 3920
            : config.compressionRatio >= 11.5
              ? 4350 - Math.max(0, config.boostPressureBar - 1.1) * 700
              : config.cylinders === 3 && config.compressionRatio <= 10.1
                ? 3980
                : 4650;
        const smallStreetPowerConstSlope =
          config.cylinders <= 2
            ? 0.80
            : config.compressionRatio >= 11.5
              ? 0.88
              : config.cylinders === 3 && config.compressionRatio <= 10.1
                ? 0.63
                : 0.78;
        const smallStreetOverRevChoke =
          1 +
          Math.pow(
            smoothPositiveExcess(rpm - (smallStreetTaperStartRpm + 1850), 220) / 1750,
            1.8,
          );
        const smallStreetBoostTaper = isSmallModernStreetTurbo
          ? 1 /
            ((1 +
              (smallStreetPowerConstSlope *
                smoothPositiveExcess(rpm - smallStreetTaperStartRpm, 220)) /
                smallStreetTaperStartRpm) *
              smallStreetOverRevChoke)
          : 1.0;

        // Fine plateau turbo basata esclusivamente sulla portata fisica (naturalBreathingRpm + A/R + turbocompressori), mai su rpmLimit!
        const arFlowOffset = (avgTurboAr - 0.65) * 650;
        const isModernNormaleHighPlateau =
          config.referenceClass === 'Normale' &&
          !isDiesel &&
          exhaustSpec.id !== 'exh-cast' &&
          (turboSpec.id === 'TwinScroll' || turboSpec.id === 'VGT') &&
          (isVvtCam || isVvlCam);
        const turboPlateauStartRpm =
          (config.referenceClass === 'Corsa'
            ? naturalBreathingRpm * 0.71
            : isClassicLowCrRaceBredTurbo && config.turboCountConfig === 'TwinTurbo'
              ? naturalBreathingRpm * 0.62
              : config.referenceClass === 'Sport' &&
                  config.compressionRatio >= 10.0 &&
                  config.boostPressureBar <= 1.25 &&
                  exhaustSpec.id === 'exh-cast'
                ? naturalBreathingRpm * 0.665
                : config.referenceClass === 'Sport' &&
                    exhaustSpec.id === 'exh-cast' &&
                    fuelSysSpec.id === 'fs-gdi-350bar' &&
                    turboCountSpec.turbineCount >= 2
                  ? naturalBreathingRpm * 0.75
                  : config.referenceClass === 'Sport'
                    ? naturalBreathingRpm * 0.70
                    : isModernNormaleHighPlateau
                      ? naturalBreathingRpm * 0.695
                      : naturalBreathingRpm * 0.64) + arFlowOffset;

        const turboRedlineRetention =
          config.referenceClass === 'Corsa'
            ? fuelSysSpec.id === 'fs-gdi-350bar' && config.boostPressureBar >= 1.5
              ? config.turboPosition === 'HotV'
                ? config.compressionRatio >= 11.0
                  ? 0.73
                  : 0.785
                : 0.73
              : fuelSysSpec.id === 'fs-gdi-350bar' && camSpec.id === 'cam-dohc'
                ? 0.785
                : fuelSysSpec.id === 'fs-gdi-350bar' &&
                    pistonSpec.id === 'pst-al-li-racing' &&
                    config.boostPressureBar <= 0.8
                  ? 0.86
                  : isClassicLowCrRaceBredTurbo && config.turboCountConfig === 'TwinTurbo'
                    ? config.fuelType === 'RaceFuel'
                      ? geom.strokeBoreRatio < 0.65
                        ? 0.89
                        : 0.86
                      : 0.72
                    : 0.82
            : isClassicLowCrRaceBredTurbo && config.turboCountConfig === 'TwinTurbo'
              ? 0.76
              : config.referenceClass === 'Sport'
                ? config.valvesPerCylinder <= 2 && exhaustSpec.id === 'exh-cast'
                  ? 0.735
                  : config.compressionRatio >= 10.0 &&
                      config.fuelType === 'Benzina' &&
                      config.boostPressureBar <= 1.25
                    ? exhaustSpec.id === 'exh-cast'
                      ? 0.68
                      : 0.785
                    : camSpec.id === 'cam-dohc' &&
                        intakeSpec.id === 'int-plenum-short' &&
                        exhaustSpec.id !== 'exh-inconel'
                      ? 0.785
                      : camSpec.id === 'cam-dohc-vvl' && fuelSysSpec.id === 'fs-mpi-electronic'
                        ? 0.78
                        : naturalBreathingRpm >= 8400
                          ? 0.77
                          : turboCountSpec.turbineCount >= 2
                            ? 0.83
                            : 0.81
                : isModernNormaleHighPlateau
                  ? 0.785
                  : turboCountSpec.turbineCount >= 2
                    ? 0.80
                    : 0.77;

        // Leggera curvatura organica naturale sul plateau turbo + ginocchio C1 morbido verso gli alti giri
        const plateauMidRpm = (avgStageSpoolRpm + 700 + turboPlateauStartRpm) * 0.5;
        const plateauHalfWidth = Math.max(900, (turboPlateauStartRpm - plateauMidRpm) * 0.85);
        const organicTurboCrownAmp = isModernNormaleHighPlateau ? 0.014 : 0.022;
        const organicTurboCrown =
          1.0 -
          organicTurboCrownAmp *
            Math.tanh(0.65 * Math.pow((rpm - plateauMidRpm) / plateauHalfWidth, 2));

        const kTurboDecay = -Math.log(Math.max(0.4, turboRedlineRetention));
        const turboRollOffExcess =
          smoothPositiveExcess(rpm - turboPlateauStartRpm, 420) /
          Math.max(800, naturalBreathingRpm - turboPlateauStartRpm);

        const generalTurboHighRpmTaper =
          !isDiesel && !isSmallModernStreetTurbo
            ? Math.exp(-kTurboDecay * Math.pow(turboRollOffExcess, 1.35)) * organicTurboCrown
            : 1.0;

        const naOffBoostFactor =
          hasGdiScavenging || turboSpec.id === 'VGT' || turboSpec.id === 'TwinScroll'
            ? 0.92
            : 0.85;
        const naOffBoostBmep =
          peakNaBmepBar *
          smoothBellVe *
          naOffBoostFactor *
          lowMidRpmStrokeBonus *
          highRpmChokeFactor;

        const fullBoostBmep =
          targetForcedPeakBmepBar *
          multiStageHighBreathing *
          compressorChokeFactor *
          multiStageFlowBonusFactor *
          vgtHighRpmBackpressure *
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

  // 6. Peso a Secco Reale (Modello Fisico Additivo a 5 Sottogruppi Separati)
  // Ogni materiale moltiplica SOLO l'organo meccanico di cui è composto; gli accessori fissi NON dipendono dal blocco.
  const isRaceClass = config.referenceClass === 'Corsa';
  const isBoxer = config.architecture === 'Boxer';
  const isFlat180V = config.architecture === 'V' && config.bankAngleDeg >= 165;
  const isVintageRace =
    isRaceClass &&
    (fuelSysSpec.id === 'fs-mech-inj' ||
      fuelSysSpec.id === 'fs-carb-twin-weber' ||
      fuelSysSpec.id === 'fs-carb-single');

  const isTiRace = isRaceClass && conrodSpec.id === 'rod-titanium-cnc';
  // Miniaturizzazione continua per unità Corsa F1 / prototipi ad altissimi regimi (basata su naturalBreathingRpm, indipendente da manualRedlineRpm)
  const sprintRpmNorm = isTiRace
    ? Math.min(1.0, Math.max(0.0, (naturalBreathingRpm - 11400) / 6200))
    : 0.0;
  const isCompact4CylTiRace = isTiRace && config.cylinders <= 4;
  const raceLightIndex = isTiRace
    ? Math.max(sprintRpmNorm, isCompact4CylTiRace ? 0.85 : 0.0)
    : 0.0;

  const boreRatio = config.boreMm / 82;
  const strokeRatio = config.strokeMm / 78;

  // Carico strutturale continuo (coppia e potenza): le micro-utilitarie (<130 Nm) usano fusioni e accessori più compatti
  const structuralLoad = Math.max(peakTorqueNm, peakPowerHp * 1.20);
  const microLoadFactor =
    structuralLoad < 130
      ? 0.56 + (structuralLoad / 130) * 0.44
      : 1.0;

  // Fusioni thin-wall robotizzate in ghisa per piccoli motori economici OHC/DOHC (stile FIRE / 1SZ-FE, canne sottili <= 71 mm)
  const isThinWallEconomyCastIron =
    !isRaceClass &&
    blockSpec.id === 'blk-cast-iron' &&
    config.priceTier === 'Economica' &&
    camSpec.id !== 'cam-ohv' &&
    pistonSpec.id !== 'pst-cast' &&
    geom.unitDisplacementCc <= 285 &&
    config.boreMm <= 71;

  // Blocchi 4 cilindri in alluminio bialbero 2V storici con canne umide in ghisa riportate e doppia catena duplex (stile Alfa Nord)
  const isWetLinerInlineAlu2VDohc =
    !isRaceClass &&
    config.architecture === 'Inline' &&
    blockSpec.id === 'blk-alu-diecast' &&
    config.valvesPerCylinder === 2 &&
    camSpec.id === 'cam-dohc';

  // Architettura Sport N/A ad altissimo regime con sottobasamento strutturale (bedplate girdle) e doppi bilancieri VTEC/VVL (stile B16/F20C/C30A)
  const isHighRpmBedplateVvtSport =
    !isRaceClass &&
    config.referenceClass === 'Sport' &&
    config.turboType === 'NaturallyAspirated' &&
    (camSpec.id === 'cam-dohc-vvt' || camSpec.id === 'cam-dohc-vvl') &&
    catalystSpec.stageNumber <= 2 &&
    config.cylinders <= 6 &&
    blockSpec.weightFactor <= 1.05;

  // Bialbero 4V superquadro (S/B < 0.78) in alluminio con distribuzione a cinghia dentata senza variatori (stile Lotus 907)
  const isBeltDrivenOversquareAluDohc4V =
    !isRaceClass &&
    config.architecture === 'Inline' &&
    blockSpec.id === 'blk-alu-diecast' &&
    config.valvesPerCylinder >= 4 &&
    camSpec.id === 'cam-dohc' &&
    geom.strokeBoreRatio < 0.78;

  // Progresso tecnologico CAD/FEA su spessori pareti e fusioni tra epoche (Stage 0 anni '70 -> Stage 4 2020+)
  const eraTechFactor = isRaceClass
    ? isVintageRace && !isTiRace
      ? 1.0
      : 1.0 - raceLightIndex * 0.36
    : catalystSpec.stageNumber === 0
      ? 1.11
      : catalystSpec.stageNumber === 1
        ? 1.08
        : catalystSpec.stageNumber === 2
          ? 1.05
          : catalystSpec.stageNumber === 3
            ? 0.88
            : 0.84;

  // Sottogruppo 1: MONOBLOCCO NUDO (bareBlockWeightKg) — Moltiplicato SOLO per blockSpec.weightFactor
  const blockArchFactor =
    config.architecture === 'Inline'
      ? config.cylinders >= 6
        ? 1.16
        : config.cylinders === 5
          ? 1.10
          : 1.04
      : isVR15
        ? 0.98
        : isBoxer
          ? 1.16
          : isFlat180V
            ? 1.06
            : config.architecture === 'W'
              ? 1.08
              : 0.88;

  const cylBarrelGeom =
    Math.pow(boreRatio, 1.35) * (0.44 + 0.56 * Math.pow(strokeRatio, 0.88));

  const cylBlockScale =
    config.architecture === 'W'
      ? 6 + (config.cylinders - 6) * 0.82
      : config.cylinders <= 6
        ? config.cylinders
        : 6 + (config.cylinders - 6) * 0.58;

  const blockLoadFactor =
    structuralLoad < 150
      ? 0.60 + (structuralLoad / 150) * 0.40
      : 1.0 + Math.min(0.18, Math.pow((structuralLoad - 150) / 750, 0.65) * 0.18);

  const dieselWallMult = isDiesel ? 1.16 : 1.0;
  // Rinforzo closed-deck su blocchi leggeri in alluminio/magnesio sovralimentati ad alta pressione (> 0.8 bar)
  const highBoostClosedDeckMult =
    blockSpec.weightFactor <= 1.05 &&
    config.turboType !== 'NaturallyAspirated' &&
    config.boostPressureBar > 0.8
      ? 1.0 + Math.min(0.24, (config.boostPressureBar - 0.8) * 0.15)
      : 1.0;

  const ohvBlockBossMult = !isRaceClass && camSpec.id === 'cam-ohv' ? 1.08 : 1.0;

  // Alleggerimento CNC sul monoblocco per Corsa e V12 5V derivazione F1
  const isF1DerivedV12 = config.cylinders >= 12 && config.valvesPerCylinder === 5;
  const blockCncLightFactor = isTiRace
    ? (isVintageRace ? 0.96 : 0.85) - raceLightIndex * 0.25
    : isRaceClass
      ? 0.94
      : isF1DerivedV12
        ? 0.84
        : 1.0;

  const bareBlockWeightKg =
    (1.8 + cylBlockScale * 7.1 * cylBarrelGeom * blockArchFactor) *
    blockLoadFactor *
    dieselWallMult *
    highBoostClosedDeckMult *
    ohvBlockBossMult *
    (isRaceClass ? 1.0 : eraTechFactor) *
    blockCncLightFactor *
    (isThinWallEconomyCastIron ? (camSpec.id === 'cam-dohc-vvt' ? 0.56 : 0.64) : 1.0) *
    (isWetLinerInlineAlu2VDohc ? 1.16 : 1.0) *
    (isHighRpmBedplateVvtSport ? 1.20 : 1.0) *
    (isBeltDrivenOversquareAluDohc4V ? 0.84 : 1.0) *
    blockSpec.weightFactor;

  // Sottogruppo 2: MANOVELLISMO INTERNO SEPARATO (Albero + Bielle + Pistoni)
  const crankThrows =
    config.architecture === 'Inline'
      ? config.cylinders
      : config.architecture === 'W'
        ? Math.ceil(config.cylinders / 2)
        : isBoxer
          ? config.cylinders * 0.72
          : Math.ceil(config.cylinders / 2);

  const crankThrowFactor =
    config.architecture === 'Inline' && config.cylinders >= 6
      ? 1.15
      : config.architecture === 'V'
        ? 1.24
        : config.architecture === 'W'
          ? 1.18
          : 1.04;

  const crankWeightKg =
    (1.6 + crankThrows * 2.55 * crankThrowFactor * Math.pow(strokeRatio, 0.82)) *
    Math.pow(Math.max(40, peakTorqueNm) / 180, 0.20) *
    (isDiesel ? 1.15 : 1.0) *
    (1.0 - raceLightIndex * 0.37) *
    crankSpec.weightFactor;

  const rodTiBonus = conrodSpec.id === 'rod-titanium-cnc' ? 0.78 : 1.0;
  const conrodsWeightKg =
    0.58 *
    config.cylinders *
    Math.pow(boreRatio, 1.50) *
    Math.pow(strokeRatio, 0.45) *
    (isDiesel ? 1.18 : 1.0) *
    rodTiBonus *
    conrodSpec.weightFactor;

  const pistonsWeightKg =
    0.46 *
    config.cylinders *
    Math.pow(boreRatio, 2.4) *
    (isDiesel ? 1.20 : 1.0) *
    (1.0 - raceLightIndex * 0.28) *
    pistonSpec.weightFactor;

  const cranktrainWeightKg = crankWeightKg + conrodsWeightKg + pistonsWeightKg;

  // Sottogruppo 3: TESTATE E DISTRIBUZIONE (Fusioni Testata + Camme/Attuatori VVT/VVL)
  const headBankCount =
    config.architecture === 'Inline' || isVR15
      ? 1
      : config.architecture === 'W'
        ? 2.6
        : 2;

  const headCylScale =
    config.architecture === 'W'
      ? config.cylinders * 0.90
      : config.cylinders <= 6
        ? config.cylinders
        : 6 + (config.cylinders - 6) * 0.68;

  const headCastingsKg =
    (1.8 * headBankCount + headCylScale * 2.98 * Math.pow(boreRatio, 2.0)) *
    (1 + (config.valvesPerCylinder - 2) * 0.065) *
    (isRaceClass
      ? isVintageRace && !isTiRace
        ? 0.98
        : 0.94 - raceLightIndex * 0.36
      : eraTechFactor) *
    (structuralLoad < 120 && !isRaceClass ? 0.76 + (structuralLoad / 120) * 0.24 : 1.0) *
    (isThinWallEconomyCastIron ? (camSpec.id === 'cam-dohc-vvt' ? 0.68 : 0.76) : 1.0) *
    (isWetLinerInlineAlu2VDohc ? 1.15 : 1.0) *
    (isHighRpmBedplateVvtSport ? 1.20 : 1.0) *
    (isBeltDrivenOversquareAluDohc4V ? 0.84 : 1.0) *
    headSpec.weightFactor;

  const camBasePerCyl =
    camSpec.id === 'cam-ohv'
      ? 0.55
      : camSpec.headWeightAddKgPerCyl * 0.90 + 0.48;
  const valvetrainWeightKg =
    (1.6 * headBankCount +
      headCylScale * camBasePerCyl * (0.50 + 0.50 * Math.pow(boreRatio, 1.4))) *
    (isHighRpmBedplateVvtSport ? 1.22 : isWetLinerInlineAlu2VDohc ? 1.15 : 1.0) *
    (isRaceClass
      ? isVintageRace && !isTiRace
        ? 0.94
        : 0.94 - raceLightIndex * 0.48
      : eraTechFactor < 1.0
        ? 0.85
        : 1.0);

  const cylinderHeadsAndValvetrainKg = headCastingsKg + valvetrainWeightKg;

  // Sottogruppo 4: ACCESSORI FISSI, VOLANO, LUBRIFICAZIONE E ALIMENTAZIONE — INDIPENDENTI dal blocco!
  const dressEraMult = isRaceClass
    ? 1.0
    : catalystSpec.stageNumber === 0
      ? 1.12
      : catalystSpec.stageNumber === 1
        ? 1.08
        : catalystSpec.stageNumber === 2
          ? 1.04
          : catalystSpec.stageNumber === 3
            ? 0.85
            : 0.81;

  const flywheelKg = isRaceClass
    ? isTiRace
      ? (isVintageRace ? 4.0 : 3.2) - raceLightIndex * 1.7
      : isVintageRace
        ? 3.8 + Math.min(2.2, exactLiters * 0.4)
        : 5.0 + Math.min(3.5, exactLiters * 0.55)
    : (2.2 + Math.min(9.5, Math.pow(peakTorqueNm / 15, 0.72)) + (isDiesel ? 3.2 : 0)) *
      (catalystSpec.stageNumber >= 3 ? 0.85 : 1.0) *
      (conrodSpec.id === 'rod-titanium-cnc' && intakeSpec.id === 'int-itb-carbon' ? 0.78 : 1.0);

  const sizeDispDress =
    3.0 + Math.pow(exactLiters, 0.58) * 11.4 + Math.min(6.0, config.cylinders * 0.52);
  const dressAndAuxKg = isRaceClass
    ? isTiRace
      ? ((isVintageRace ? 15.0 : 12.2) + Math.pow(exactLiters, 0.55) * 4.6) *
        (1.0 - raceLightIndex * 0.56)
      : isVintageRace
        ? 11.5 + Math.pow(exactLiters, 0.58) * 5.2
        : 16.5 + Math.pow(exactLiters, 0.58) * 6.2
    : (sizeDispDress + (isBoxer ? 0.95 * config.cylinders : isFlat180V ? 3.0 : 0)) *
      dressEraMult *
      microLoadFactor *
      (isThinWallEconomyCastIron ? (camSpec.id === 'cam-dohc-vvt' ? 0.68 : 0.76) : 1.0) *
      (isWetLinerInlineAlu2VDohc ? 1.14 : 1.0) *
      (isHighRpmBedplateVvtSport ? 1.14 : 1.0) *
      (isBeltDrivenOversquareAluDohc4V ? 0.84 : 1.0);

  let fuelDeliveryKg = 1.0 + Math.min(3.5, exactLiters * 0.65);
  if (fuelSysSpec.id === 'fs-carb-twin-weber') {
    fuelDeliveryKg = 3.8 + config.cylinders * 1.18;
  } else if (fuelSysSpec.id === 'fs-mech-inj') {
    fuelDeliveryKg =
      (isRaceClass ? 2.8 : 4.6) + config.cylinders * (isRaceClass ? 0.45 : 0.72);
  } else if (fuelSysSpec.id === 'fs-carb-single') {
    fuelDeliveryKg = 1.4;
  } else if (isDiesel) {
    fuelDeliveryKg = 3.8 + config.cylinders * 0.40;
  }

  let intakeHardwareKg =
    intakeSpec.id === 'int-vis'
      ? 5.8 + config.cylinders * 0.90
      : intakeSpec.id === 'int-itb-carbon'
        ? !isRaceClass &&
          fuelSysSpec.id === 'fs-carb-twin-weber' &&
          config.valvesPerCylinder >= 4
          ? 1.2
          : isTiRace
            ? (3.0 + config.cylinders * 0.42) * (1.0 - raceLightIndex * 0.46)
            : isRaceClass
              ? 2.8 + config.cylinders * 0.48
              : 3.0 + config.cylinders * 0.65
        : intakeSpec.id === 'int-plenum-short'
          ? 3.2 + config.cylinders * 0.48
          : 1.5 + Math.pow(exactLiters, 0.65) * 1.5;
  if (isTiRace && intakeSpec.id !== 'int-itb-carbon') {
    intakeHardwareKg *= 1.0 - raceLightIndex * 0.36;
  }
  if (!isRaceClass && catalystSpec.stageNumber >= 3) {
    intakeHardwareKg *= 0.78;
  }

  const auxiliariesAndDressWeightKg =
    flywheelKg + dressAndAuxKg + fuelDeliveryKg + intakeHardwareKg;

  // Sottogruppo 5: SOVRALIMENTAZIONE, INTERCOOLER E SCARICO
  const turboSystemWeightKg =
    config.turboType === 'NaturallyAspirated'
      ? 0
      : config.turboType === 'Supercharger'
        ? 15 + exactLiters * 2.2
        : (4.5 +
            config.boostPressureBar * (isRaceClass ? 3.4 : 5.4) +
            (turboCountSpec.turbineCount - 1) * 6.5 +
            (config.turboType === 'Twincharged' ? 17 : 0) +
            (config.turboType === 'ETurbo' ? 4.0 : 0) +
            activeTurboStagesAr.reduce(
              (sumKg, stageAr) => sumKg + (4.2 + stageAr * 4.6),
              0,
            )) *
          (isTiRace ? 1.0 - raceLightIndex * 0.30 : isVintageRace ? 0.84 : 1.0) *
          (!isRaceClass && catalystSpec.stageNumber >= 4 ? 0.85 : 1.0);

  const exhaustWeightKg =
    exhaustSpec.weightKg *
      (config.architecture === 'Inline' ? 0.56 : 0.78) *
      Math.min(1.45, 0.28 + exactLiters * 0.16 + config.cylinders * 0.04) *
      (isRaceClass
        ? isVintageRace && !isTiRace
          ? 0.82
          : 0.88 - raceLightIndex * 0.38
        : !isRaceClass && catalystSpec.stageNumber >= 3
          ? 0.78
          : 1.0) +
    catalystSpec.weightAddKg * Math.min(0.20, 0.04 + exactLiters * 0.025);

  const dryWeightKg = Math.max(
    40,
    Math.round(
      bareBlockWeightKg +
        cranktrainWeightKg +
        cylinderHeadsAndValvetrainKg +
        auxiliariesAndDressWeightKg +
        turboSystemWeightKg +
        exhaustWeightKg,
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
    Normale: 0.95,
    Comfort: 1.4,
    Fuoristrada: 1.2,
    Sport: 0.3,
    Corsa: -7.5,
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
    : catalystSpec.reliabilityPenaltyPetrolPercent *
      (catalystSpec.stageNumber >= 4 ? 0.18 : 0.36);

  const turboPositionReliabilityDelta =
    config.turboType === 'NaturallyAspirated' ? 0 : turboPosSpec.reliabilityDeltaPercent * 0.45;

  const materialProtectionFactor = Math.max(0.55, 1.38 / avgMaterialResistance);

  // Stress termico e meccanico continuo:
  // 1) Potenza specifica (CV/L): incisiva tra 80–120 CV/L e progressivamente attenuata sui motori forgiati moderni
  const specificPowerHpPerLiter = peakPowerHp / Math.max(0.4, exactLiters);
  const isPneumaticTitaniumRace =
    conrodSpec.id === 'rod-titanium-cnc' &&
    (camSpec.id === 'cam-pneumatic' ||
      (config.referenceClass === 'Corsa' &&
        redlineRpm >= 9500 &&
        camSpec.id.startsWith('cam-dohc')));
  const isMechanicalFuel =
    fuelSysSpec.id === 'fs-carb-single' ||
    fuelSysSpec.id === 'fs-carb-twin-weber' ||
    fuelSysSpec.id === 'fs-mech-inj';
  const hasElectronicControlAndForged =
    (fuelSysSpec.id === 'fs-mpi-electronic' ||
      fuelSysSpec.id === 'fs-gdi-350bar' ||
      fuelSysSpec.id === 'fs-diesel-commonrail-1' ||
      fuelSysSpec.id === 'fs-diesel-commonrail-piezo') &&
    (pistonSpec.id === 'pst-forged-oiljet' || pistonSpec.id === 'pst-al-li-racing');
  const isEnduranceProtected =
    config.referenceClass === 'Corsa' && hasElectronicControlAndForged;

  const hasAdvancedOemDurability =
    hasElectronicControlAndForged ||
    (fuelSysSpec.id === 'fs-gdi-350bar' &&
      pistonSpec.id === 'pst-hypereutectic' &&
      conrodSpec.id === 'rod-c70-fractured' &&
      config.referenceClass === 'Normale');

  const specificPowerStressPenalty =
    (Math.max(0, specificPowerHpPerLiter - 60) * 0.013 +
      Math.min(40, Math.max(0, specificPowerHpPerLiter - 80)) * 0.018 +
      Math.max(0, specificPowerHpPerLiter - 120) * 0.008) *
    materialProtectionFactor *
    (isPneumaticTitaniumRace
      ? 0.45
      : isEnduranceProtected
        ? 0.52
        : hasElectronicControlAndForged
          ? 0.65
          : hasAdvancedOemDurability
            ? 0.80
            : 1.0);

  // 2) Velocità media del pistone al limitatore (m/s) e regime assoluto
  // Valvole pneumatiche (o distribuzione DOHC racing >= 9.500 rpm) + bielle in titanio schermano del 65% la fatica da alti giri
  const redlinePistonSpeedMs = (2 * config.strokeMm * redlineRpm) / 60_000;
  const nonForgedHighSpeedWear =
    (pistonSpec.id === 'pst-cast' ||
      conrodSpec.id === 'rod-stamped-steel' ||
      config.referenceClass === 'Sport' ||
      (config.cylinders === 4 && redlineRpm >= 7000)) &&
    pistonSpec.id !== 'pst-forged-oiljet' &&
    pistonSpec.id !== 'pst-al-li-racing' &&
    conrodSpec.id !== 'rod-titanium-cnc'
      ? Math.max(0, redlinePistonSpeedMs - 18.0) * 0.90
      : 0;
  const pistonSpeedAndRpmPenalty =
    (Math.max(0, redlinePistonSpeedMs - (isDiesel ? 14.5 : 15.5)) * 0.30 +
      Math.max(0, redlineRpm - (isDiesel ? 4600 : 6400)) * 0.00072) *
      (isPneumaticTitaniumRace ? 0.36 : isEnduranceProtected ? 0.60 : 1.0) +
    Math.max(0, redlineRpm - 10500) * 0.0003 +
    nonForgedHighSpeedWear;

  // 3) Pressione di sovralimentazione e BMEP legata al controllo iniezione e pistoni forgiati
  const turboControlShieldFactor = isMechanicalFuel
    ? 1.65
    : hasElectronicControlAndForged
      ? 0.35
      : hasAdvancedOemDurability
        ? 0.56
        : 0.78;

  const mechanicalFuelBaseMaintenancePenalty =
    fuelSysSpec.id === 'fs-carb-twin-weber'
      ? 3.8
      : fuelSysSpec.id === 'fs-mech-inj'
        ? 3.0
        : fuelSysSpec.id === 'fs-carb-single'
          ? 0.6
          : 0.0;

  const boostAndBmepPenalty =
    ((config.turboType === 'NaturallyAspirated'
      ? 0
      : (config.boostPressureBar * 1.35 +
          Math.max(0, config.boostPressureBar - 1.5) * 1.10) *
          turboControlShieldFactor +
        (isMechanicalFuel ? 0.8 : 0)) +
      Math.max(0, peakBmepBar - 14.0) * 0.08) *
    materialProtectionFactor;

  // 4) Complessità frazionamento e sovralimentazione multi-stadio (incluso TwinAir 2 cil. / 3 cil. turbo e Twincharged)
  const complexityPenalty =
    Math.max(0, config.cylinders - 4) * 0.16 +
    (config.cylinders === 2 && config.turboType !== 'NaturallyAspirated'
      ? 4.4
      : config.cylinders === 3 && config.turboType !== 'NaturallyAspirated'
        ? 2.6
        : 0) +
    (config.turboType === 'NaturallyAspirated'
      ? 0
      : (turboCountSpec.turbineCount - 1) * 0.35 +
        (config.turboType === 'Twincharged' ? 5.8 : 0));

  const isAtkinsonVvtEconomy =
    !isDiesel &&
    config.turboType === 'NaturallyAspirated' &&
    config.referenceClass === 'Normale' &&
    (camSpec.id === 'cam-dohc-vvt' || camSpec.id === 'cam-dohc-vvl') &&
    knockWarning.knockExcessCr <= 0.6;

  const highCrReliabilityPenalty =
    Math.max(
      0,
      config.compressionRatio - (isDiesel ? 18.2 : isAtkinsonVvtEconomy ? 14.1 : 12.2),
    ) * 0.45;
  const effectiveKnockRelPenalty = isAtkinsonVvtEconomy
    ? 0
    : knockWarning.reliabilityPenaltyPercent;

  // I materiali nobili proteggono dalle penalità tramite materialProtectionFactor, senza regalare punti sopra il 95%
  const overbuiltMaterialBonus = Math.min(0.8, (avgMaterialResistance - 1.15) * 1.35);
  const simpleValvetrainBonus =
    camSpec.id === 'cam-ohv' || (camSpec.id === 'cam-sohc' && config.valvesPerCylinder <= 2)
      ? 1.0
      : 0.0;
  const boxerBalanceReliabilityBonus = config.architecture === 'Boxer' ? 0.5 : 0;

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
    fuelSysSpec.reliabilityDelta * 0.5 +
    boxerBalanceReliabilityBonus +
    turboPositionReliabilityDelta -
    catalystReliabilityPenalty -
    mechanicalFuelBaseMaintenancePenalty -
    specificPowerStressPenalty -
    pistonSpeedAndRpmPenalty -
    boostAndBmepPenalty -
    complexityPenalty -
    highCrReliabilityPenalty -
    effectiveKnockRelPenalty +
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
