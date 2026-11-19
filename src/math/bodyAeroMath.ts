import {
  ACTIVE_AERO_OPTIONS,
  AIRBAG_PACKAGES,
  BODY_MATERIALS,
  BODY_STYLES,
  FRONT_AERO_OPTIONS,
  REAR_AERO_OPTIONS,
  UNDERBODY_AERO_OPTIONS,
} from '../data/bodyAeroData';
import {
  type BodyAeroConfig,
  type BodyAeroMetrics,
  type ChassisEntity,
  calculateEstimatedDurabilityKm,
} from '../types/gameTypes';

const AIR_DENSITY_KG_M3 = 1.225;
const GRAVITY_MS2 = 9.80665;
const V_200_MS = 200 / 3.6;
const V_300_MS = 300 / 3.6;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function roundTo(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/**
 * Calcola le prestazioni aerodinamiche, i pesi di carrozzeria/sicurezza/aero,
 * la protezione crash test (0..100 + stelle Euro NCAP) e i costi della Fase 2.2
 * in funzione continua della geometria reale del pianale 2.1.
 */
export function calculateBodyAeroMetrics(
  config: BodyAeroConfig,
  chassis: ChassisEntity,
): BodyAeroMetrics {
  const style = BODY_STYLES.find((s) => s.id === config.bodyStyle) ?? BODY_STYLES[0];
  const material =
    BODY_MATERIALS.find((m) => m.id === config.bodyMaterialId) ?? BODY_MATERIALS[0];
  const airbag =
    AIRBAG_PACKAGES.find((a) => a.id === config.airbagPackageId) ?? AIRBAG_PACKAGES[0];
  const frontOpt =
    FRONT_AERO_OPTIONS.find((f) => f.id === config.frontAero.type) ?? FRONT_AERO_OPTIONS[0];
  const rearOpt =
    REAR_AERO_OPTIONS.find((r) => r.id === config.rearAero.type) ?? REAR_AERO_OPTIONS[0];
  const underbodyOpt =
    UNDERBODY_AERO_OPTIONS.find((u) => u.id === config.underbodyType) ?? UNDERBODY_AERO_OPTIONS[0];
  const activeOpt =
    ACTIVE_AERO_OPTIONS.find((a) => a.id === config.activeAeroType) ?? ACTIVE_AERO_OPTIONS[0];

  const { lengthMm, widthMm, heightMm } = chassis.overallDimensionsMm;
  const widthM = widthMm / 1000;
  const heightM = heightMm / 1000;
  const lengthM = lengthMm / 1000;
  const clearanceM = chassis.groundClearanceMm / 1000;
  const maxTrackM = Math.max(chassis.frontTrackMm, chassis.rearTrackMm) / 1000;

  // 1. Sezione frontale reale A (m^2): rettangolo scocca depurato dal vuoto sottoscocca + sporgenza carreggiate
  const effectiveHeightM = Math.max(0.75, heightM - 0.62 * clearanceM);
  const trackProtrusionM2 = Math.max(0, maxTrackM - widthM * 0.85) * 0.08;
  const frontalAreaM2 = roundTo(
    (widthM * effectiveHeightM + trackProtrusionM2) * style.frontalShapeFactor,
    3,
  );

  // 2. Evoluzione storica Cx, raffinatezza superficiale, raffreddamento e luce a terra
  const aeroRefinement = clamp(config.aeroRefinementPercent, 0, 100);
  const coolingAperture = clamp(config.coolingAperturePercent, 10, 100);
  const passiveSafety = clamp(config.passiveSafetyReinforcementPercent, 0, 100);

  const eraCxFactor = 0.94 + 0.26 / (1 + Math.exp((config.year - 1986) / 6.5));
  const refinementFactor = 1.14 - (aeroRefinement / 100) * 0.31;
  const bodyBaseCx = style.baseCx * eraCxFactor * refinementFactor;

  const clearanceDragSlope =
    underbodyOpt.id === 'exposed'
      ? 0.00075
      : underbodyOpt.id === 'road-faired'
        ? 0.00020
        : 0.00035;
  const clearanceDragDelta = Math.max(0, chassis.groundClearanceMm - 140) * clearanceDragSlope;
  const coolingDragDelta = Math.max(0, coolingAperture - 10) * 0.00062;
  const coolingEfficiencyScore = Math.round(clamp(12 + coolingAperture * 0.88, 5, 100));

  // 3. Efficienza Effetto Suolo: massima tra 75 e 115 mm, decade oltre 155 mm
  const groundEffectEfficiency = roundTo(
    1 / (1 + Math.exp((chassis.groundClearanceMm - 142) / 14)),
    3,
  );

  // 4. Contributi Front, Rear (con stallo > stallAngleDeg ~20°), Underbody e Active Aero
  const frontAngleDeg = frontOpt.id === 'none' ? 0 : clamp(config.frontAero.angleDeg, 0, 18);
  const rearAngleDeg = rearOpt.id === 'none' ? 0 : clamp(config.rearAero.angleDeg, 0, 25);

  const frontCl =
    frontOpt.id === 'none' ? 0 : frontOpt.clBase + frontOpt.clPerDeg * frontAngleDeg;
  const frontCx =
    frontOpt.id === 'none' ? 0 : frontOpt.cxBase + frontOpt.cxPerDeg * frontAngleDeg;

  let rearCl = 0;
  let rearCx = 0;
  let isWingStalled = false;
  if (rearOpt.id !== 'none') {
    const preStallDeg = Math.min(rearAngleDeg, rearOpt.stallAngleDeg);
    const stallExcessDeg = Math.max(0, rearAngleDeg - rearOpt.stallAngleDeg);
    isWingStalled = stallExcessDeg > 0;
    // Oltre lo stallo (~20°), la portanza si degrada leggermente mentre il drag cresce quadraticamente
    rearCl =
      (rearOpt.clBase + rearOpt.clPerDeg * preStallDeg - 0.008 * stallExcessDeg) *
      style.flowCleanlinessFactor;
    rearCx =
      rearOpt.cxBase +
      rearOpt.cxPerDeg * rearAngleDeg +
      0.0055 * stallExcessDeg * stallExcessDeg;
  }

  // Sotto i flussi stradali, una luce a terra alta attenua il carico del fondo piatto/Venturi
  // e la scia della carrozzeria modula l'efficacia di alimentazione del fondo
  const effectiveUnderbodyCl =
    underbodyOpt.clPotential >= 0
      ? underbodyOpt.clPotential *
        (1 - underbodyOpt.groundEffectSensitivity + underbodyOpt.groundEffectSensitivity * groundEffectEfficiency) *
        style.flowCleanlinessFactor
      : underbodyOpt.clPotential;

  const activeClBonus = activeOpt.clHighBonus * style.flowCleanlinessFactor;
  const upperBodyCl = -style.baseUpperLiftCl; // baseUpperLiftCl > 0 indica portanza (CL negativo)

  const rawClFront =
    upperBodyCl * style.baseFrontLiftShare +
    effectiveUnderbodyCl * underbodyOpt.frontShare +
    frontCl +
    activeClBonus * activeOpt.frontShare;
  const rawClRear =
    upperBodyCl * (1 - style.baseFrontLiftShare) +
    effectiveUnderbodyCl * (1 - underbodyOpt.frontShare) +
    rearCl +
    activeClBonus * (1 - activeOpt.frontShare);

  const rawClTotal = rawClFront + rawClRear;
  const clKnee = style.maxPhysicalClCap * 0.80;
  let clSaturated = false;
  let satScale = 1.0;
  if (rawClTotal > clKnee) {
    clSaturated = true;
    const headroom = Math.max(0.05, style.maxPhysicalClCap - clKnee);
    const compressedCl = clKnee + headroom * Math.tanh((rawClTotal - clKnee) / headroom);
    satScale = compressedCl / rawClTotal;
  }

  const clFront = roundTo(rawClFront * satScale, 3);
  const clRear = roundTo(rawClRear * satScale, 3);
  const clTotalHighDownforce = roundTo(clFront + clRear, 3);
  const aeroRegime: 'lift' | 'neutral' | 'downforce' =
    clTotalHighDownforce < -0.02
      ? 'lift'
      : clTotalHighDownforce > 0.02
        ? 'downforce'
        : 'neutral';

  const cxHighDownforce = roundTo(
    clamp(
      bodyBaseCx +
        clearanceDragDelta +
        coolingDragDelta +
        underbodyOpt.cxDelta +
        frontCx +
        rearCx,
      0.17,
      0.85,
    ),
    3,
  );

  let cxLowDrag = cxHighDownforce;
  let cxAirbrake = cxHighDownforce;
  let clTotalLowDrag = clTotalHighDownforce;

  if (activeOpt.id !== 'none') {
    const drsAvailableTrim = Math.min(
      activeOpt.lowDragCxReduction,
      Math.max(0.018, rearCx * 0.85 + frontCx * 0.35 + 0.018),
    );
    cxLowDrag = roundTo(clamp(cxHighDownforce - drsAvailableTrim, 0.16, cxHighDownforce), 3);
    cxAirbrake = roundTo(cxHighDownforce + activeOpt.airbrakeCxBoost, 3);

    const clLowDragDrop =
      activeOpt.lowDragClReductionShare * (Math.max(0, rearCl) * 0.45 + activeClBonus);
    clTotalLowDrag = roundTo(clTotalHighDownforce - clLowDragDrop, 3);
  }

  const scxHighDownforce = roundTo(frontalAreaM2 * cxHighDownforce, 3);
  const scxLowDrag = roundTo(frontalAreaM2 * cxLowDrag, 3);
  const aeroEfficiencyLD = roundTo(clTotalHighDownforce / Math.max(0.15, cxHighDownforce), 2);

  // 5. Downforce reale in kg a 200 e 300 km/h
  const q200 = (0.5 * AIR_DENSITY_KG_M3 * V_200_MS * V_200_MS) / GRAVITY_MS2;
  const q300 = (0.5 * AIR_DENSITY_KG_M3 * V_300_MS * V_300_MS) / GRAVITY_MS2;

  const df200High = Math.round(q200 * frontalAreaM2 * clTotalHighDownforce);
  const df300High = Math.round(q300 * frontalAreaM2 * clTotalHighDownforce);

  const downforce200Kg = {
    highDownforce: df200High,
    lowDrag: activeOpt.id === 'none' ? df200High : Math.round(q200 * frontalAreaM2 * clTotalLowDrag),
    frontKg: Math.round(q200 * frontalAreaM2 * clFront),
    rearKg: Math.round(q200 * frontalAreaM2 * clRear),
  };

  const downforce300Kg = {
    highDownforce: df300High,
    lowDrag: activeOpt.id === 'none' ? df300High : Math.round(q300 * frontalAreaM2 * clTotalLowDrag),
    frontKg: Math.round(q300 * frontalAreaM2 * clFront),
    rearKg: Math.round(q300 * frontalAreaM2 * clRear),
  };

  let aeroBalanceFrontPercent = 50;
  let aeroBalanceRearPercent = 50;
  if (clTotalHighDownforce > 0.02) {
    aeroBalanceFrontPercent = clamp(roundTo((clFront / clTotalHighDownforce) * 100, 1), 0, 100);
    aeroBalanceRearPercent = roundTo(100 - aeroBalanceFrontPercent, 1);
  }

  // 6. Pesi carrozzeria, sicurezza passiva e pacchetto aero (kg)
  const cabinHeightM = Math.max(0.85, heightM - clearanceM);
  const shellSurfaceIndex =
    (lengthM * (widthM + 0.85 * cabinHeightM)) / (4.55 * (1.82 + 0.85 * 1.32));
  const bodyPanelsWeightKg = Math.round(
    185 * shellSurfaceIndex * style.panelSurfaceFactor * material.weightMultiplier,
  );
  const safetyWeightKg = Math.round(airbag.weightKg + (passiveSafety / 100) * 28);
  const aeroWeightKg = Math.round(
    frontOpt.weightKg + rearOpt.weightKg + underbodyOpt.weightKg + activeOpt.weightKg,
  );
  const totalBodyAeroWeightKg = bodyPanelsWeightKg + safetyWeightKg + aeroWeightKg;

  // 7. Sicurezza Passiva accoppiata al Pianale 2.1: Crash Test (0..100) & Euro NCAP (0..5)
  const isFramePenaltyChassis =
    chassis.structuralSafetyScore < 58 &&
    (chassis.calculatedSegment === 'J_SUV' || chassis.calculatedSegment === 'M_Pickup');
  const chassisCellScore = Math.round(
    clamp(chassis.structuralSafetyScore - (isFramePenaltyChassis ? 4 : 0), 15, 100),
  );
  const bodyPassiveScore = Math.round(
    clamp(18 + (passiveSafety / 100) * 68 + Math.min(14, material.corrosionResistanceFactor * 8), 15, 100),
  );
  const airbagRestraintMap: Record<string, number> = {
    'airbag-none': 0,
    'airbag-driver': 28,
    'airbag-dual-front': 52,
    'airbag-six-curtain': 82,
    'airbag-ten-precrash': 100,
  };
  const airbagRestraintScore = airbagRestraintMap[config.airbagPackageId] ?? 0;

  let rawCrash =
    chassisCellScore * 0.48 + bodyPassiveScore * 0.24 + airbagRestraintScore * 0.28;
  let bottleneckNote: string | null = null;

  if (config.airbagPackageId === 'airbag-none') {
    if (rawCrash > 58) {
      rawCrash = 58;
    }
    if (chassisCellScore >= 60 || rawCrash >= 55) {
      bottleneckNote = 'Assenza airbag: alta decelerazione occupanti nonostante il pianale rigido';
    }
  } else if (chassisCellScore < 60) {
    const chassisCap = chassisCellScore + 22;
    if (rawCrash > chassisCap) {
      rawCrash = chassisCap;
    }
    bottleneckNote =
      'Cellula pianale (2.1) limitante: gli airbag non compensano la rigidità del telaio';
  }

  const crashTestScore = Math.round(clamp(rawCrash, 15, 100));

  let euroNcapStars = 0;
  if (crashTestScore >= 84) euroNcapStars = 5;
  else if (crashTestScore >= 68) euroNcapStars = 4;
  else if (crashTestScore >= 52) euroNcapStars = 3;
  else if (crashTestScore >= 36) euroNcapStars = 2;
  else if (crashTestScore >= 22) euroNcapStars = 1;

  const safetyBreakdown = {
    chassisCellScore,
    bodyPassiveScore,
    airbagRestraintScore,
    bottleneckNote,
  };

  // 8. Costi di produzione, sviluppo (Doppia Valuta) e durabilità pannelli/corrosione
  const unitManufacturingCost = Math.round(
    material.unitCost * (0.78 + 0.22 * shellSurfaceIndex) +
      airbag.unitCost +
      (passiveSafety / 100) * 380 +
      (aeroRefinement / 100) * 260 +
      frontOpt.unitCost +
      rearOpt.unitCost +
      underbodyOpt.unitCost +
      activeOpt.unitCost,
  );

  const minYear = Math.max(
    material.minYear,
    airbag.minYear,
    frontOpt.minYear,
    rearOpt.minYear,
    underbodyOpt.minYear,
    activeOpt.minYear,
  );

  const developmentCost = {
    capitalCost: Math.round(
      material.devCapitalCost +
        airbag.devCapitalCost +
        frontOpt.devCapitalCost +
        rearOpt.devCapitalCost +
        underbodyOpt.devCapitalCost +
        activeOpt.devCapitalCost +
        (aeroRefinement / 100) * 14_000_000 +
        (passiveSafety / 100) * 6_000_000,
    ),
    rdCost: Math.round(
      material.devRdPoints +
        airbag.devRdPoints +
        frontOpt.devRdPoints +
        rearOpt.devRdPoints +
        underbodyOpt.devRdPoints +
        activeOpt.devRdPoints +
        (aeroRefinement / 100) * 120 +
        (passiveSafety / 100) * 30,
    ),
    minYear,
  };

  const estimatedDurabilityKm = calculateEstimatedDurabilityKm(
    material.priceTier,
    chassis.calculatedSegment === 'S'
      ? 'Sport'
      : chassis.calculatedSegment === 'J_SUV' || chassis.calculatedSegment === 'M_Pickup'
        ? 'Fuoristrada'
        : 'Normale',
    material.corrosionResistanceFactor,
    0.95,
  );

  // 9. Avvisi fisici e di coerenza
  const warnings: string[] = [];
  if (isWingStalled) {
    warnings.push(
      `Stallo aerodinamico ala posteriore (${rearAngleDeg}° > ${rearOpt.stallAngleDeg}°): il drag cresce rapidamente degradando l'efficienza L/D.`,
    );
  }
  if (clTotalHighDownforce > 0.15 && aeroBalanceFrontPercent > 52) {
    warnings.push(
      `Squilibrio aerodinamico anteriore (${aeroBalanceFrontPercent}% Ant): carico eccessivo sull'avantreno con rischio di sovrasterzo ad alta velocità.`,
    );
  }
  if (
    (config.underbodyType === 'flat-floor-diffuser' ||
      config.underbodyType === 'venturi-ground-effect') &&
    chassis.groundClearanceMm > 155
  ) {
    warnings.push(
      `Effetto suolo sprecato (luce a terra ${chassis.groundClearanceMm} mm > 155 mm): efficienza fondo ridotta al ${Math.round(groundEffectEfficiency * 100)}%.`,
    );
  }
  if (
    (config.bodyStyle === 'SUV' || config.bodyStyle === 'Pickup') &&
    chassis.groundClearanceMm < 130
  ) {
    warnings.push(
      `Incoerenza carrozzeria/pianale: ${config.bodyStyle} abbinato a luce a terra ribassata (${chassis.groundClearanceMm} mm).`,
    );
  } else if (config.bodyStyle === 'Coupé Sportivo' && chassis.groundClearanceMm > 175) {
    warnings.push(
      `Incoerenza carrozzeria/pianale: Coupé Sportivo abbinato a pianale rialzato (${chassis.groundClearanceMm} mm).`,
    );
  }
  if (clSaturated && rawClTotal > style.maxPhysicalClCap * 0.90) {
    warnings.push(
      `Appendici sovradimensionate per la scia della carrozzeria ${config.bodyStyle}: saturazione aerodinamica attiva (CL compresso da ${rawClTotal.toFixed(2)} a ${clTotalHighDownforce.toFixed(2)}).`,
    );
  }

  // 10. Parametro nascosto "Effetto Mercedes CLR 1999" (sensibilità beccheggio/blowover ad alta velocità — mai esposto nei warning UI!)
  let frontLiftPitchFactor = 0;
  if (clFront < -0.06) {
    frontLiftPitchFactor = clamp((-clFront - 0.06) / 0.14, 0, 1);
  } else if (clTotalHighDownforce > 0.6 && aeroBalanceFrontPercent < 33) {
    frontLiftPitchFactor = clamp((33 - aeroBalanceFrontPercent) / 14, 0, 1);
  }

  const overhangRatio =
    Math.max(0, lengthMm - chassis.wheelbaseMm) / Math.max(1000, chassis.wheelbaseMm);
  const overhangPitchFactor =
    overhangRatio > 0.68 ? clamp((overhangRatio - 0.68) / 0.25, 0, 1) : 0;

  const hasFlatOrVenturi =
    config.underbodyType === 'flat-floor-diffuser' ||
    config.underbodyType === 'venturi-ground-effect';
  const lowClearancePitchFactor =
    hasFlatOrVenturi && chassis.groundClearanceMm < 100
      ? clamp((100 - chassis.groundClearanceMm) / 25, 0.25, 1)
      : 0;

  const coexistingBoost =
    frontLiftPitchFactor > 0.2 && overhangPitchFactor > 0.2 && lowClearancePitchFactor > 0.2
      ? 0.18
      : 0;
  const hiddenBlowoverRisk = roundTo(
    clamp(
      frontLiftPitchFactor * 0.48 +
        overhangPitchFactor * 0.28 +
        lowClearancePitchFactor * 0.24 +
        coexistingBoost,
      0,
      1,
    ),
    3,
  );

  return {
    frontalAreaM2,
    cxHighDownforce,
    cxLowDrag,
    cxAirbrake,
    scxHighDownforce,
    scxLowDrag,
    clFront,
    clRear,
    clTotalHighDownforce,
    clTotalLowDrag,
    clSaturated,
    aeroRegime,
    hiddenBlowoverRisk,
    aeroEfficiencyLD,
    downforce200Kg,
    downforce300Kg,
    aeroBalanceFrontPercent,
    aeroBalanceRearPercent,
    groundEffectEfficiency,
    coolingEfficiencyScore,
    bodyPanelsWeightKg,
    safetyWeightKg,
    aeroWeightKg,
    totalBodyAeroWeightKg,
    crashTestScore,
    euroNcapStars,
    safetyBreakdown,
    unitManufacturingCost,
    developmentCost,
    estimatedDurabilityKm,
    warnings,
  };
}
