import {
  ABS_MODULE_OPTIONS,
  AWD_SCHEME_OPTIONS,
  BRAKE_CALIPER_OPTIONS,
  BRAKE_DISC_OPTIONS,
  DIFFERENTIAL_OPTIONS,
  DRIVE_MODE_SELECTOR_SPEC,
  ESC_MODULE_OPTIONS,
  GEARBOX_STRENGTH_TIERS,
  STABILITY_CONTROL_OPTIONS,
  STABILITY_DRIVE_MODE_PRESETS,
  STEERING_OPTIONS,
  SUSPENSION_OPTIONS,
  TCS_MODULE_OPTIONS,
  TRANSMISSION_OPTIONS,
} from '../data/drivetrainData';
import {
  type AWDLayoutType,
  type ChassisEntity,
  type DimensionsLWH,
  type DrivetrainSetupConfig,
  type DrivetrainSetupMetrics,
  type ElectricMotorEntity,
  type EngineEntity,
  type EngineOrientation,
  type GearTelemetryPoint,
  type GearboxStrengthTier,
  type StabilityDriveMode,
  type TransmissionType,
  calculateEstimatedDurabilityKm,
} from '../types/gameTypes';
import { evaluateEngineBayCompatibility } from './volumeMath';

export interface DrivetrainPowertrainSpecs {
  isEv: boolean;
  peakPowerHp: number;
  peakPowerRpm: number;
  peakTorqueNm: number;
  redlineRpm: number;
  dimensionsMm?: DimensionsLWH;
  nativeOrientation?: EngineOrientation;
}

function isElectricMotorEntity(
  powertrain: EngineEntity | ElectricMotorEntity,
): powertrain is ElectricMotorEntity {
  return 'maxMotorRpm' in powertrain;
}

export function extractPowertrainSpecs(
  powertrain: EngineEntity | ElectricMotorEntity,
): DrivetrainPowertrainSpecs {
  if (isElectricMotorEntity(powertrain)) {
    return {
      isEv: true,
      peakPowerHp: powertrain.peakPowerHp,
      peakPowerRpm: powertrain.cornerSpeedRpm || Math.round(powertrain.maxMotorRpm * 0.45),
      peakTorqueNm: powertrain.peakTorqueNm,
      redlineRpm: powertrain.maxMotorRpm,
    };
  }

  // EngineEntity (Pistoni 1A, Wankel 1B o Ibrido/Elettrico 1C)
  const { telemetry } = powertrain;
  const isEv =
    powertrain.propulsionType === 'ElectricHybrid_1C' &&
    !powertrain.pistonSpecs &&
    !powertrain.wankelSpecs;

  const nativeOrientation =
    powertrain.pistonSpecs?.nativeOrientation ??
    powertrain.pistonSpecs?.intendedOrientation ??
    powertrain.wankelSpecs?.nativeOrientation ??
    powertrain.wankelSpecs?.intendedOrientation;

  return {
    isEv,
    peakPowerHp: telemetry.peakPowerHp,
    peakPowerRpm: telemetry.peakPowerRpm,
    peakTorqueNm: telemetry.peakTorqueNm,
    redlineRpm: telemetry.redlineRpm,
    dimensionsMm: powertrain.dimensionsMm,
    nativeOrientation,
  };
}

/**
 * Mantiene i rapporti del cambio strettamente decrescenti (ratios[i] > ratios[i+1])
 * quando si regola uno slider di una singola marcia.
 */
export function clampGearRatio(
  ratios: number[],
  index: number,
  nextValue: number,
): number[] {
  if (index < 0 || index >= ratios.length) return ratios;
  const minStep = 0.02;
  const upperBound = index > 0 ? ratios[index - 1] - minStep : 6.0;
  const lowerBound = index < ratios.length - 1 ? ratios[index + 1] + minStep : 0.45;
  const safeLower = Math.min(lowerBound, upperBound);
  const clamped = clamp(nextValue, Math.max(0.45, safeLower), Math.min(6.0, upperBound));
  const next = [...ratios];
  next[index] = roundTo(clamped, 2);
  return next;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function roundTo(val: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(val * f) / f;
}

/**
 * Genera una spaziatura di rapporti cambio progressiva realistica
 * per numero di marce (1..10), tipo di cambio e profilo ('short' | 'balanced' | 'long').
 */
export function generateDefaultGearRatios(
  gearCount: number,
  transmissionType: TransmissionType,
  profile: 'short' | 'balanced' | 'long' = 'balanced',
): number[] {
  if (transmissionType === 'ev-single-speed') {
    const single = profile === 'short' ? 1.15 : profile === 'long' ? 0.88 : 1.0;
    return [roundTo(single, 2)];
  }
  if (transmissionType === 'ev-two-speed') {
    const scale = profile === 'short' ? 1.08 : profile === 'long' ? 0.92 : 1.0;
    return [roundTo(1.75 * scale, 2), roundTo(0.86 * scale, 2)];
  }
  if (transmissionType === 'cvt') {
    return [roundTo(profile === 'short' ? 2.65 : profile === 'long' ? 2.35 : 2.5, 2)];
  }

  const clampedCount = Math.round(clamp(gearCount, 3, 10));
  const firstBase =
    clampedCount >= 8
      ? 4.70
      : clampedCount === 7
        ? 4.10
        : clampedCount === 6
          ? 3.70
          : clampedCount === 5
            ? 3.55
            : clampedCount === 4
              ? 3.45
              : 2.85;
  const topBase =
    clampedCount >= 8
      ? 0.64
      : clampedCount === 7
        ? 0.71
        : clampedCount === 6
          ? 0.76
          : clampedCount === 5
            ? 0.82
            : 1.0;

  const profileScale = profile === 'short' ? 1.08 : profile === 'long' ? 0.92 : 1.0;
  const first = firstBase * profileScale;
  const top = topBase * (profile === 'short' ? 1.06 : profile === 'long' ? 0.90 : 1.0);

  // Progressione geometrica leggermente più ravvicinata sulle marce alte
  const ratios: number[] = [];
  for (let i = 0; i < clampedCount; i++) {
    const progress = clampedCount === 1 ? 0 : i / (clampedCount - 1);
    const curved = Math.pow(progress, 0.88);
    const r = first * Math.pow(top / first, curved);
    ratios.push(roundTo(r, 2));
  }
  return ratios;
}

function computeSpeedKmh(
  rpm: number,
  gearRatio: number,
  finalDriveRatio: number,
  tireRadiusMm: number,
): number {
  const rTireM = tireRadiusMm / 1000;
  const denom = Math.max(0.1, gearRatio * finalDriveRatio * 1000);
  return (rpm * 2 * Math.PI * rTireM * 60) / denom;
}

/**
 * Calcola tutte le metriche fisiche di trasmissione, perdite alla ruota,
 * velocità per marcia, affidabilità cambio, sterzo, sospensioni e capacità frenante.
 */
export function calculateDrivetrainMetrics(
  config: DrivetrainSetupConfig,
  chassis: ChassisEntity,
  powertrain: DrivetrainPowertrainSpecs,
): DrivetrainSetupMetrics {
  const transOpt =
    TRANSMISSION_OPTIONS.find((t) => t.id === config.transmissionType) ?? TRANSMISSION_OPTIONS[0];
  const awdOpt =
    config.drivetrainType === 'AWD'
      ? AWD_SCHEME_OPTIONS.find((a) => a.id === config.awdScheme) ?? AWD_SCHEME_OPTIONS[0]
      : null;
  const diffOpt =
    DIFFERENTIAL_OPTIONS.find((d) => d.id === config.differentialType) ?? DIFFERENTIAL_OPTIONS[0];
  const steerOpt =
    STEERING_OPTIONS.find((s) => s.id === config.steeringType) ?? STEERING_OPTIONS[0];
  const frontSuspOpt =
    SUSPENSION_OPTIONS.find((s) => s.id === config.frontSuspension) ?? SUSPENSION_OPTIONS[3];
  const rearSuspOpt =
    SUSPENSION_OPTIONS.find((s) => s.id === config.rearSuspension) ?? SUSPENSION_OPTIONS[3];
  const escOpt =
    STABILITY_CONTROL_OPTIONS.find((e) => e.id === config.stabilityControlType) ??
    STABILITY_CONTROL_OPTIONS[0];
  const frontCaliperOpt =
    BRAKE_CALIPER_OPTIONS.find((c) => c.id === config.frontCaliper) ?? BRAKE_CALIPER_OPTIONS[1];
  const rearCaliperOpt =
    BRAKE_CALIPER_OPTIONS.find((c) => c.id === config.rearCaliper) ?? BRAKE_CALIPER_OPTIONS[1];
  const frontDiscOpt =
    BRAKE_DISC_OPTIONS.find((d) => d.id === config.frontDiscType) ?? BRAKE_DISC_OPTIONS[1];
  const rearDiscOpt =
    BRAKE_DISC_OPTIONS.find((d) => d.id === config.rearDiscType) ?? BRAKE_DISC_OPTIONS[0];
  const strengthTier: GearboxStrengthTier = config.gearboxStrengthTier ?? 'standard';
  const strengthTierOpt =
    GEARBOX_STRENGTH_TIERS.find((g) => g.id === strengthTier) ?? GEARBOX_STRENGTH_TIERS[1];

  const compatibilityErrors: string[] = [];
  const warnings: string[] = [];

  // 1. Validazione rigorosa Pianale 2.1 <-> Trasmissione 2.3 & Collisione Vano Motore
  const supportedDrivetrains = chassis.supportedDrivetrains ?? [];
  const orientations = chassis.supportedEngineOrientations ?? ['Longitudinale'];
  const primaryPos = chassis.supportedEnginePositions?.[0] ?? 'Anteriore';
  const hasTransverse = orientations.includes('Trasversale');

  let resolvedEngineOrientation: EngineOrientation | 'N/A' = powertrain.isEv
    ? 'N/A'
    : powertrain.nativeOrientation ?? orientations[0] ?? 'Longitudinale';
  let engineFitNote = powertrain.isEv
    ? 'Motopropulsore EV esente da vincolo orientamento albero'
    : `Orientamento ${resolvedEngineOrientation} compatibile con il vano`;

  if (!powertrain.isEv) {
    if (powertrain.nativeOrientation && !orientations.includes(powertrain.nativeOrientation)) {
      resolvedEngineOrientation = powertrain.nativeOrientation;
      engineFitNote = 'Orientamento nativo incompatibile col pianale';
      compatibilityErrors.push(
        `Orientamento incompatibile: motore nativo ${powertrain.nativeOrientation} su pianale ${orientations.join('/')} — crea prima una variante ruotata nel Banco Motori (Fase 1).`,
      );
    } else if (powertrain.dimensionsMm) {
      const targetOri = powertrain.nativeOrientation ?? orientations[0] ?? 'Longitudinale';
      const bayCheck = evaluateEngineBayCompatibility(powertrain.dimensionsMm, targetOri, chassis, {
        isPureEV: false,
      });
      resolvedEngineOrientation = targetOri;
      if (!bayCheck.isCompatible) {
        engineFitNote = `Collisione vano motore (${targetOri})`;
        compatibilityErrors.push(
          `Motore troppo ingombrante per il vano di ${chassis.name} (${targetOri}): ${bayCheck.conflictReasons.join(', ')}.`,
        );
      }
    }
  }

  if (!supportedDrivetrains.includes(config.drivetrainType)) {
    compatibilityErrors.push(
      `Trazione ${config.drivetrainType} non supportata dal pianale ${chassis.name} (supporta: ${supportedDrivetrains.join(', ')}).`,
    );
  }

  if (powertrain.isEv && !transOpt.isEvOnly) {
    compatibilityErrors.push(
      `Il motopropulsore elettrico richiede un riduttore EV (selezionato: ${transOpt.name}).`,
    );
  } else if (!powertrain.isEv && transOpt.isEvOnly) {
    compatibilityErrors.push(
      `Un motore termico/Wankel non può montare un riduttore diretto EV (${transOpt.name}).`,
    );
  }

  if (config.drivetrainType === 'AWD') {
    if (!awdOpt) {
      compatibilityErrors.push('Selezionare uno dei 4 schemi AWD per la trazione integrale.');
    } else {
      const supportsSchemeOrientation = awdOpt.allowedOrientations.some((o) =>
        orientations.includes(o),
      );
      if (!supportsSchemeOrientation) {
        compatibilityErrors.push(
          `Schema ${awdOpt.name} incompatibile con l'orientamento ${orientations.join('/')} del pianale ${chassis.name}.`,
        );
      }
      if (
        awdOpt.id === 'awd-4wd-heavy-lowrange' &&
        chassis.calculatedSegment !== 'J_SUV' &&
        chassis.calculatedSegment !== 'M_Pickup' &&
        chassis.groundClearanceMm < 170
      ) {
        warnings.push(
          `4WD Heavy-Duty con ridotte su scocca stradale bassa (${chassis.groundClearanceMm} mm): peso e attriti elevati.`,
        );
      }
    }
  }

  // 2. Perdita di trasmissione reale (drivetrainLossPercent)
  let baseLayoutLoss = 11.2;
  if (powertrain.isEv) {
    baseLayoutLoss = config.drivetrainType === 'AWD' ? 6.8 : 5.6;
  } else if (config.drivetrainType === 'FWD') {
    baseLayoutLoss = 11.2;
  } else if (config.drivetrainType === 'RWD') {
    const isRearOrMidOrTransaxle =
      primaryPos === 'Centrale-Posteriore' ||
      primaryPos === 'Posteriore' ||
      chassis.gearboxLayout === 'RearTransaxleTorqueTube' ||
      chassis.gearboxLayout === 'MidCentralTunnel';
    baseLayoutLoss = isRearOrMidOrTransaxle ? 11.0 : 13.2;
  } else if (config.drivetrainType === 'AWD' && awdOpt) {
    const isTransaxleAwd = chassis.gearboxLayout === 'RearTransaxleTorqueTube';
    baseLayoutLoss = awdOpt.lossPercent - (isTransaxleAwd ? 1.2 : 0);
  }

  // Evoluzione storica oli sintetici e cuscinetti (1975 -> +1.3%, 2008 -> 0.0%, 2024 -> -0.4%)
  const rawEraFrictionDelta = clamp(1.3 - ((config.year - 1975) / 48) * 1.7, -0.5, 1.5);
  const eraFrictionDelta = powertrain.isEv ? rawEraFrictionDelta * 0.1 : rawEraFrictionDelta;
  const diffLoss = powertrain.isEv && config.differentialType === 'open' ? 0 : diffOpt.lossDeltaPercent;

  const drivetrainLossPercent = roundTo(
    clamp(baseLayoutLoss + transOpt.lossDeltaPercent + diffLoss + eraFrictionDelta, 4.0, 29.0),
    1,
  );

  const transmissionEfficiency = 1 - drivetrainLossPercent / 100;
  const wheelPeakPowerHp = Math.round(powertrain.peakPowerHp * transmissionEfficiency);
  const wheelPeakTorqueNm = Math.round(powertrain.peakTorqueNm * transmissionEfficiency);

  // 3. Tabella rapportatura, velocità per marcia e regime a 130 km/h
  const maxFinalDrive = transOpt.isEvOnly ? 12.0 : 6.2;
  const finalDriveRatio = clamp(config.finalDriveRatio, 2.0, maxFinalDrive);
  const frontRim = clamp(config.frontRimDiameterInch ?? config.rimDiameterInch ?? 19, 13, 23);
  const frontSidewall = clamp(config.frontTireSidewallMm ?? config.tireSidewallMm ?? 105, 55, 190);
  const rearRim = config.staggeredWheels
    ? clamp(config.rearRimDiameterInch ?? frontRim, 13, 23)
    : frontRim;
  const rearSidewall = config.staggeredWheels
    ? clamp(config.rearTireSidewallMm ?? frontSidewall, 55, 190)
    : frontSidewall;

  const hasExplicitRim =
    config.frontRimDiameterInch !== undefined || config.rimDiameterInch !== undefined;
  const frontTireRadiusMm = hasExplicitRim
    ? Math.max(200, Math.round((frontRim * 25.4) / 2 + frontSidewall))
    : clamp(config.tireRadiusMm, 200, 480);
  const rearTireRadiusMm = hasExplicitRim
    ? Math.max(200, Math.round((rearRim * 25.4) / 2 + rearSidewall))
    : clamp(config.tireRadiusMm, 200, 480);
  const tireRadiusMm =
    config.drivetrainType === 'FWD'
      ? frontTireRadiusMm
      : config.drivetrainType === 'RWD'
        ? rearTireRadiusMm
        : Math.round((frontTireRadiusMm + rearTireRadiusMm) / 2);
  const ratios =
    config.gearRatios && config.gearRatios.length > 0
      ? config.gearRatios
      : generateDefaultGearRatios(config.gearCount, config.transmissionType, 'balanced');

  let hasMonotonicityViolation = false;
  const gearsTelemetry: GearTelemetryPoint[] = [];
  for (let i = 0; i < ratios.length; i++) {
    const ratio = clamp(ratios[i], 0.4, 6.5);
    const totalRatio = roundTo(ratio * finalDriveRatio, 2);
    const speedAtPeakPowerKmh = roundTo(
      computeSpeedKmh(powertrain.peakPowerRpm, ratio, finalDriveRatio, tireRadiusMm),
      1,
    );
    const speedAtRedlineKmh = roundTo(
      computeSpeedKmh(powertrain.redlineRpm, ratio, finalDriveRatio, tireRadiusMm),
      1,
    );
    const maxWheelTorqueNm = Math.round(wheelPeakTorqueNm * totalRatio);

    let rpmAfterUpshift = powertrain.redlineRpm;
    let rpmDropPercent = 0;
    if (i < ratios.length - 1) {
      const nextRatio = clamp(ratios[i + 1], 0.4, 6.5);
      rpmAfterUpshift = Math.round(powertrain.redlineRpm * (nextRatio / ratio));
      rpmDropPercent = roundTo((1 - nextRatio / ratio) * 100, 1);
      if (nextRatio >= ratio) {
        hasMonotonicityViolation = true;
        warnings.push(
          `Rapportatura incoerente tra ${i + 1}ª (${ratio}) e ${i + 2}ª (${nextRatio}): una marcia alta non può essere più corta della precedente.`,
        );
      } else if (rpmDropPercent > 45) {
        warnings.push(
          `Salto eccessivo tra ${i + 1}ª e ${i + 2}ª marcia (-${rpmDropPercent}% giri): rischio buco di coppia.`,
        );
      }
    }

    gearsTelemetry.push({
      gear: i + 1,
      ratio: roundTo(ratio, 2),
      totalRatio,
      speedAtPeakPowerKmh,
      speedAtRedlineKmh,
      rpmAfterUpshift,
      rpmDropPercent,
      maxWheelTorqueNm,
    });
  }

  const firstGear = gearsTelemetry[0];
  const topGear = gearsTelemetry[gearsTelemetry.length - 1];
  const maxWheelTorqueFirstGearNm = firstGear ? firstGear.maxWheelTorqueNm : wheelPeakTorqueNm;
  const lowRangeFirstGearTorqueNm =
    awdOpt && awdOpt.lowRangeRatio
      ? Math.round(maxWheelTorqueFirstGearNm * awdOpt.lowRangeRatio)
      : null;

  const theoreticalTopSpeedKmh = topGear ? topGear.speedAtRedlineKmh : 0;
  const topTotalRatio = topGear ? topGear.totalRatio : finalDriveRatio;
  const cruisingRpmAt130Kmh = Math.round(
    (130 * topTotalRatio * 1000) / (2 * Math.PI * (tireRadiusMm / 1000) * 60),
  );

  if (!powertrain.isEv && ratios.length >= 4 && theoreticalTopSpeedKmh < 145) {
    warnings.push(
      `Rapportatura finale troppo corta: in ultima marcia il limitatore interviene già a ${theoreticalTopSpeedKmh} km/h.`,
    );
  }
  if (!powertrain.isEv && cruisingRpmAt130Kmh > Math.round(powertrain.redlineRpm * 0.82)) {
    warnings.push(
      `Regime autostradale elevato a 130 km/h (${cruisingRpmAt130Kmh} giri/min): consumi e usura aumentati.`,
    );
  }

  if (hasMonotonicityViolation) {
    compatibilityErrors.push(
      'Rapportatura non valida: ogni marcia superiore deve avere un rapporto inferiore alla precedente.',
    );
  }

  // 4. Capacità coppia cambio (con gearboxStrengthTier) & sovraccarico affidabilità
  const modernTechTorqueFactor = 1 + clamp((config.year - 1985) / 120, -0.12, 0.25);
  const gearboxTorqueCapacityNm = Math.round(
    transOpt.baseTorqueCapacityNm * modernTechTorqueFactor * strengthTierOpt.torqueMultiplier,
  );
  const torqueOverloadRatio = roundTo(
    powertrain.peakTorqueNm / Math.max(120, gearboxTorqueCapacityNm),
    2,
  );

  if (torqueOverloadRatio > 1.0) {
    warnings.push(
      `Sovraccarico coppia trasmissione (${powertrain.peakTorqueNm} Nm vs ${gearboxTorqueCapacityNm} Nm max, ${(torqueOverloadRatio * 100).toFixed(0)}%): affidabilità gravemente ridotta.`,
    );
  }

  // 5. Dinamica: AWD split, Sterzo, Sospensioni (sinergia Trazione x Ant/Post), ESC, Freni
  let awdStaticSplitFrontPercent = config.drivetrainType === 'FWD' ? 100 : 0;
  let awdLayoutMapped: AWDLayoutType = 'None_2WD';
  if (config.drivetrainType === 'AWD' && awdOpt) {
    awdStaticSplitFrontPercent = awdOpt.defaultFrontSplit;
    awdLayoutMapped = awdOpt.mappedLayout;
  }

  // Sinergia Sospensioni x Trazione x Abbinamento Ant/Post
  let frontGripDelta = 0;
  let rearGripDelta = 0;
  let steeringSuspDelta = 0;
  let rearComfortDelta = 0;
  let launchSuspDelta = 0;
  let offRoadSuspDelta = 0;

  if (config.drivetrainType === 'FWD' && (powertrain.peakPowerHp > 220 || powertrain.peakTorqueNm > 300)) {
    if (frontSuspOpt.id === 'macpherson') {
      frontGripDelta -= 8;
      steeringSuspDelta -= 6;
      warnings.push(
        `Torque steer elevato su FWD (${powertrain.peakPowerHp} CV / ${powertrain.peakTorqueNm} Nm) con McPherson anteriore: precisione sterzo e trazione penalizzate.`,
      );
    } else if (frontSuspOpt.id === 'double-wishbone' || frontSuspOpt.id === 'multi-link') {
      frontGripDelta += 5;
      steeringSuspDelta += 4;
      launchSuspDelta += 0.04;
    }
  }

  if (config.drivetrainType === 'RWD' && powertrain.peakPowerHp > 250) {
    if (rearSuspOpt.id === 'solid-axle-leaf' || rearSuspOpt.id === 'torsion-beam') {
      rearGripDelta -= 14;
      launchSuspDelta -= 0.08;
      warnings.push(
        `Retrotreno ${rearSuspOpt.name} inadeguato per RWD da ${powertrain.peakPowerHp} CV: perdita di trazione e stabilità in accelerazione.`,
      );
    } else if (rearSuspOpt.id === 'multi-link' || rearSuspOpt.id === 'double-wishbone') {
      rearGripDelta += 5;
      rearComfortDelta += 4;
      launchSuspDelta += 0.05;
    }
  }

  if (
    config.drivetrainType === 'AWD' &&
    awdOpt?.id === 'awd-4wd-heavy-lowrange' &&
    (frontSuspOpt.id === 'solid-axle-coil' ||
      frontSuspOpt.id === 'solid-axle-leaf' ||
      rearSuspOpt.id === 'solid-axle-coil' ||
      rearSuspOpt.id === 'solid-axle-leaf')
  ) {
    offRoadSuspDelta += 8;
  }

  // Regole asimmetriche per asse (Anteriore sterzante vs Posteriore)
  if (frontSuspOpt.id === 'torsion-beam') {
    compatibilityErrors.push(
      'Ponte torcente non montabile sull’asse anteriore sterzante.',
    );
  }
  if (
    rearSuspOpt.id === 'torsion-beam' &&
    (config.drivetrainType === 'RWD' || config.drivetrainType === 'AWD')
  ) {
    compatibilityErrors.push(
      `Ponte torcente posteriore incompatibile con trazione ${config.drivetrainType} (assenza spazio differenziale).`,
    );
  }
  if (
    frontSuspOpt.id === 'solid-axle-leaf' &&
    awdOpt?.id !== 'awd-4wd-heavy-lowrange' &&
    chassis.calculatedSegment !== 'M_Pickup' &&
    chassis.calculatedSegment !== 'J_SUV'
  ) {
    steeringSuspDelta -= 14;
    frontGripDelta -= 8;
    warnings.push(
      'Ponte rigido a balestre anteriore su vettura stradale: precisione di sterzo fortemente penalizzata.',
    );
  }

  // Accoppiamento Ant/Post (coerenza cinematica asimmetrica)
  let suspensionPairingScore = 82;
  let suspensionPairingNote: string | null = null;
  const gripGap = Math.abs(frontSuspOpt.gripGeometryScore - rearSuspOpt.gripGeometryScore);

  const isExtremeMismatch =
    (frontSuspOpt.id === 'pushrod-inboard' &&
      (rearSuspOpt.id === 'solid-axle-leaf' || rearSuspOpt.id === 'torsion-beam')) ||
    (rearSuspOpt.id === 'pushrod-inboard' &&
      (frontSuspOpt.id === 'solid-axle-leaf' || frontSuspOpt.id === 'torsion-beam')) ||
    (frontSuspOpt.id === 'double-wishbone' &&
      (rearSuspOpt.id === 'solid-axle-leaf' || rearSuspOpt.id === 'torsion-beam')) ||
    gripGap >= 35;

  const isBalancedHighEnd =
    (frontSuspOpt.id === 'double-wishbone' &&
      (rearSuspOpt.id === 'multi-link' || rearSuspOpt.id === 'double-wishbone')) ||
    (frontSuspOpt.id === 'macpherson' &&
      (rearSuspOpt.id === 'multi-link' ||
        (rearSuspOpt.id === 'torsion-beam' && config.drivetrainType === 'FWD'))) ||
    (frontSuspOpt.id === 'pushrod-inboard' && rearSuspOpt.id === 'pushrod-inboard') ||
    (frontSuspOpt.id === 'solid-axle-coil' && rearSuspOpt.id === 'solid-axle-coil');

  if (isExtremeMismatch) {
    suspensionPairingScore = Math.round(clamp(55 - gripGap * 0.4, 25, 65));
    suspensionPairingNote = `Mismatch cinematico Ant/Post (${frontSuspOpt.name} + ${rearSuspOpt.name}): comportamento squilibrato tra gli assi.`;
    warnings.push(suspensionPairingNote);
    frontGripDelta -= 4;
    rearGripDelta -= 4;
    rearComfortDelta -= 12;
  } else if (isBalancedHighEnd) {
    suspensionPairingScore = 95;
    suspensionPairingNote = `Abbinamento bilanciato (${frontSuspOpt.name} + ${rearSuspOpt.name}).`;
    rearComfortDelta += 3;
  } else {
    suspensionPairingScore = Math.round(clamp(88 - gripGap * 0.35, 65, 92));
  }

  // Sterzo progressivo, prontezza & RWS configurabile
  const minSteerRatio = steerOpt.id === 'steer-by-wire' ? 8.5 : 10.5;
  const steeringRatio = clamp(config.steeringRatio ?? 14.5, minSteerRatio, 19.0);
  const ratioPrecisionDelta = (14.5 - steeringRatio) * 1.4;
  const progressiveBonus = config.progressiveSteering ? 2.5 : 0;
  const speedSensitiveBonus = config.speedSensitiveSteering ? 2.0 : 0;
  const rwsAngleDeg = config.rearWheelSteering
    ? clamp(config.rwsMaxAngleDeg ?? 3.0, 1.5, 10.0)
    : 0;
  const rwsCrossoverKmh = clamp(config.rwsCrossoverSpeedKmh ?? 60, 30, 110);
  const rwsPrecisionBonus = config.rearWheelSteering
    ? 3.5 + rwsAngleDeg * 0.65 + (rwsCrossoverKmh >= 50 && rwsCrossoverKmh <= 75 ? 1.5 : 0)
    : 0;

  const steeringPrecisionScore = Math.round(
    clamp(
      steerOpt.precisionScore +
        rwsPrecisionBonus +
        ratioPrecisionDelta +
        progressiveBonus +
        speedSensitiveBonus +
        (frontSuspOpt.gripGeometryScore - 70) * 0.12 +
        steeringSuspDelta,
      20,
      100,
    ),
  );
  const baseTurningCircleM = 7.4 + (chassis.wheelbaseMm / 1000) * 1.48;
  const rwsTurnFactor = config.rearWheelSteering ? 1 - rwsAngleDeg * 0.022 : 1.0;
  const progressiveTurnFactor = config.progressiveSteering ? 0.97 : 1.0;
  const turningCircleM = roundTo(
    baseTurningCircleM *
      rwsTurnFactor *
      progressiveTurnFactor *
      (hasTransverse && config.drivetrainType === 'FWD' ? 1.03 : 1.0),
    2,
  );

  const frontGripGeometryScore = Math.round(
    clamp(frontSuspOpt.gripGeometryScore + frontGripDelta, 20, 100),
  );
  const rearGripGeometryScore = Math.round(
    clamp(rearSuspOpt.gripGeometryScore + rearGripDelta, 20, 100),
  );
  const rideComfortScore = Math.round(
    clamp(
      (frontSuspOpt.comfortScore * 0.5 + rearSuspOpt.comfortScore * 0.5 + rearComfortDelta) *
        (chassis.groundClearanceMm < 105 ? 0.85 : 1.0),
      15,
      100,
    ),
  );
  const offRoadArticulationScore = Math.round(
    clamp(
      frontSuspOpt.offRoadScore * 0.45 +
        rearSuspOpt.offRoadScore * 0.45 +
        (awdOpt?.id === 'awd-4wd-heavy-lowrange' ? 12 : 0) +
        offRoadSuspDelta,
      5,
      100,
    ),
  );

  // Controlli elettronici modulari (ABS / TCS / ESC + Selettore Mappe) con fallback su stabilityControlType
  const usesModularElec =
    config.absType !== undefined ||
    config.tcsType !== undefined ||
    config.escType !== undefined;

  const absOpt = usesModularElec
    ? ABS_MODULE_OPTIONS.find((a) => a.id === (config.absType ?? 'none')) ?? ABS_MODULE_OPTIONS[0]
    : null;
  const tcsOpt = usesModularElec
    ? TCS_MODULE_OPTIONS.find((t) => t.id === (config.tcsType ?? 'none')) ?? TCS_MODULE_OPTIONS[0]
    : null;
  const escModOpt = usesModularElec
    ? ESC_MODULE_OPTIONS.find((e) => e.id === (config.escType ?? 'none')) ?? ESC_MODULE_OPTIONS[0]
    : null;

  const hasAbs = usesModularElec ? absOpt!.id !== 'none' : escOpt.hasAbs;
  const hasTcs = usesModularElec ? tcsOpt!.id !== 'none' : escOpt.hasTcs;
  const hasEsc = usesModularElec ? escModOpt!.id !== 'none' : escOpt.hasEsc;

  if (usesModularElec && !hasAbs && (hasTcs || hasEsc)) {
    compatibilityErrors.push(
      'TCS ed ESC richiedono i sensori ruota ABS attivi (selezionare ABS Stradale o ABS Racing).',
    );
  }

  const hasDriveModeSelector = Boolean(config.hasDriveModeSelector);
  const requestedMode: StabilityDriveMode = config.stabilityDriveMode ?? 'road';
  const effectiveMode: StabilityDriveMode = usesModularElec
    ? hasDriveModeSelector
      ? requestedMode
      : 'road'
    : escOpt.supportedModes.length === 0
      ? 'road'
      : escOpt.supportedModes.includes(requestedMode)
        ? requestedMode
        : escOpt.supportedModes[0];

  const modePreset = STABILITY_DRIVE_MODE_PRESETS[effectiveMode];
  const rawAbs = hasAbs
    ? (config.absSlipThresholdPercent ?? config.stabilityControlThresholdPercent)
    : 100;
  const rawTcs = !hasTcs
    ? 100
    : usesModularElec || escOpt.allowsCustomThresholds
      ? (config.tcsSlipThresholdPercent ?? modePreset.tcsSlipPercent)
      : modePreset.tcsSlipPercent;
  const rawYaw = !hasEsc
    ? 100
    : usesModularElec || escOpt.allowsCustomThresholds
      ? (config.escYawThresholdPercent ?? modePreset.escYawPercent)
      : modePreset.escYawPercent;

  const activeThresholds: number[] = [];
  if (hasAbs) activeThresholds.push(rawAbs);
  if (hasTcs) activeThresholds.push(rawTcs);
  if (hasEsc) activeThresholds.push(rawYaw);

  const stabilityThreshold = clamp(
    activeThresholds.length === 0
      ? config.stabilityControlThresholdPercent
      : activeThresholds.reduce((sum, v) => sum + v, 0) / activeThresholds.length,
    0,
    100,
  );
  const effectiveBaseIntervention = usesModularElec
    ? absOpt!.baseIntervention + tcsOpt!.baseIntervention + escModOpt!.baseIntervention
    : escOpt.baseIntervention;
  const effectiveLaunchBonus = usesModularElec
    ? tcsOpt!.launchTractionBonus
    : escOpt.launchTractionBonus;
  const effectiveAbsBonus = usesModularElec
    ? absOpt!.absPrecisionBonus
    : escOpt.absPrecisionBonus;

  const stabilityInterventionFactor = roundTo(
    effectiveBaseIntervention * (0.35 + (1 - stabilityThreshold / 100) * 0.65),
    3,
  );
  const tractionLaunchFactor = roundTo(
    clamp(
      1.0 +
        (config.drivetrainType === 'AWD' ? 0.25 : config.drivetrainType === 'RWD' ? 0.08 : 0.0) +
        diffOpt.tractionBonus +
        (awdOpt?.torqueVectoringBonus ?? 0) * 0.5 +
        effectiveLaunchBonus +
        effectiveAbsBonus * 0.25 +
        launchSuspDelta,
      0.85,
      1.95,
    ),
    3,
  );

  // Impianto Frenante Indipendente Ant / Post + Vincolo Geometrico Cerchio
  const frontDiscMm = clamp(config.frontDiscMm, 220, 440);
  const rearDiscMm = clamp(config.rearDiscMm, 200, 420);
  const maxFrontDiscMm = Math.floor(frontRim * 25.4 - frontCaliperOpt.caliperClearanceMm);
  const maxRearDiscMm = Math.floor(rearRim * 25.4 - rearCaliperOpt.caliperClearanceMm);

  if (hasExplicitRim) {
    if (frontDiscMm > maxFrontDiscMm) {
      compatibilityErrors.push(
        `Disco anteriore ${frontDiscMm} mm non entra nel cerchio da ${frontRim}" (max ${maxFrontDiscMm} mm con ${frontCaliperOpt.name}, interferenza +${frontDiscMm - maxFrontDiscMm} mm).`,
      );
    }
    if (rearDiscMm > maxRearDiscMm) {
      compatibilityErrors.push(
        `Disco posteriore ${rearDiscMm} mm non entra nel cerchio da ${rearRim}" (max ${maxRearDiscMm} mm con ${rearCaliperOpt.name}, interferenza +${rearDiscMm - maxRearDiscMm} mm).`,
      );
    }
  }

  if (frontDiscOpt.id === 'carbon-carbon' || rearDiscOpt.id === 'carbon-carbon') {
    warnings.push(
      'Dischi Carbo-Carbo (C/C): frenata a freddo molto ridotta su strada (richiedono >300°C) e alta usura.',
    );
  }

  const frontEffectiveRadiusM = (frontDiscMm * 0.39) / 1000;
  const rearEffectiveRadiusM = (rearDiscMm * 0.39) / 1000;

  const frontBrakeTorqueNm = Math.round(
    18500 * frontEffectiveRadiusM * frontCaliperOpt.pistonForceFactor * frontDiscOpt.frictionCoeff,
  );
  const rearBrakeTorqueNm = Math.round(
    12500 * rearEffectiveRadiusM * rearCaliperOpt.pistonForceFactor * rearDiscOpt.frictionCoeff,
  );
  const totalBrakeTorque = Math.max(1, frontBrakeTorqueNm + rearBrakeTorqueNm);
  const brakeBiasFrontPercent = roundTo((frontBrakeTorqueNm / totalBrakeTorque) * 100, 1);

  if (brakeBiasFrontPercent < 55) {
    warnings.push(
      `Ripartizione frenata sbilanciata al retrotreno (${brakeBiasFrontPercent}% Ant): rischio bloccaggio posteriore in staccata.`,
    );
  }

  const getOperatingDeltaTK = (discId: string) =>
    discId === 'carbon-carbon'
      ? 1150
      : discId === 'carbon-ceramic'
        ? 820
        : discId === 'drilled-slotted-iron'
          ? 520
          : discId === 'vented-iron'
            ? 450
            : 380;

  const frontDiscMassKg = 4.2 * Math.pow(frontDiscMm / 300, 2.1) * frontDiscOpt.densityScale;
  const rearDiscMassKg = 3.2 * Math.pow(rearDiscMm / 280, 2.1) * rearDiscOpt.densityScale;
  const brakeThermalCapacityKj = Math.round(
    (2 * frontDiscMassKg * frontDiscOpt.heatCapacityJPerKgK * getOperatingDeltaTK(frontDiscOpt.id) +
      2 * rearDiscMassKg * rearDiscOpt.heatCapacityJPerKgK * getOperatingDeltaTK(rearDiscOpt.id)) /
      1000,
  );
  const brakeCoolingRateKw = roundTo(
    (frontDiscOpt.coolingRateCoeff * (frontDiscMm / 320) +
      rearDiscOpt.coolingRateCoeff * (rearDiscMm / 300)) *
      18,
    1,
  );

  if (powertrain.peakPowerHp >= 450 && (frontDiscMm < 340 || frontCaliperOpt.id === 'drum' || frontCaliperOpt.id === 'floating-1p')) {
    warnings.push(
      `Impianto frenante anteriore sottodimensionato per ${powertrain.peakPowerHp} CV (disco ${frontDiscMm} mm, ${frontCaliperOpt.name}): alto rischio fading.`,
    );
  }

  // 6. Pesi, Costi & Durabilità Meccanica (scalati su extraGears oltre minGears)
  const extraGears = Math.max(0, ratios.length - transOpt.minGears);
  const gearboxKg = Math.round(
    (transOpt.weightKg + extraGears * transOpt.perExtraGearWeightKg) *
      strengthTierOpt.weightMultiplier,
  );
  const awdHardwareKg = awdOpt ? awdOpt.weightKg : 0;
  const differentialKg = diffOpt.weightKg;
  const steeringKg = steerOpt.weightKg + (config.rearWheelSteering ? 9 : 0);
  const suspensionKg = frontSuspOpt.weightKg + rearSuspOpt.weightKg;
  const brakesKg = Math.round(
    2 * frontCaliperOpt.weightPerCornerKg +
      2 * rearCaliperOpt.weightPerCornerKg +
      2 * frontDiscMassKg +
      2 * rearDiscMassKg,
  );
  const elecWeightKg = usesModularElec
    ? Math.round(absOpt!.weightKg + tcsOpt!.weightKg + escModOpt!.weightKg)
    : escOpt.weightKg;
  const totalMechatronicsKg =
    gearboxKg + awdHardwareKg + differentialKg + steeringKg + suspensionKg + brakesKg + elecWeightKg;

  const weightBreakdownKg = {
    gearboxKg,
    awdHardwareKg,
    differentialKg,
    steeringKg,
    suspensionKg,
    brakesKg,
    totalMechatronicsKg,
  };

  const elecUnitCost = usesModularElec
    ? absOpt!.unitCost + tcsOpt!.unitCost + escModOpt!.unitCost
    : escOpt.unitCost;
  const driveModeUnitCost = hasDriveModeSelector ? DRIVE_MODE_SELECTOR_SPEC.unitCost : 0;
  const steeringFeatureCost =
    (config.rearWheelSteering ? 950 : 0) +
    (config.progressiveSteering ? 420 : 0) +
    (config.speedSensitiveSteering ? 220 : 0);

  const unitManufacturingCost = Math.round(
    (transOpt.unitCost + extraGears * transOpt.perExtraGearCost) *
      strengthTierOpt.unitCostMultiplier +
      (awdOpt?.unitCost ?? 0) +
      diffOpt.unitCost +
      steerOpt.unitCost +
      steeringFeatureCost +
      frontSuspOpt.unitCost +
      rearSuspOpt.unitCost +
      elecUnitCost +
      driveModeUnitCost +
      frontCaliperOpt.unitCostPerAxle +
      rearCaliperOpt.unitCostPerAxle +
      frontDiscOpt.unitCostPerAxle +
      rearDiscOpt.unitCostPerAxle,
  );

  const minYear = Math.max(
    transOpt.minYear,
    strengthTierOpt.minYear,
    awdOpt?.minYear ?? 1950,
    diffOpt.minYear,
    steerOpt.minYear,
    config.rearWheelSteering ? 1987 : 1950,
    config.progressiveSteering ? 2003 : 1950,
    config.speedSensitiveSteering ? 1992 : 1950,
    frontSuspOpt.minYear,
    rearSuspOpt.minYear,
    usesModularElec
      ? Math.max(absOpt!.minYear, tcsOpt!.minYear, escModOpt!.minYear)
      : escOpt.minYear,
    hasDriveModeSelector ? DRIVE_MODE_SELECTOR_SPEC.minYear : 1950,
    frontCaliperOpt.minYear,
    rearCaliperOpt.minYear,
    frontDiscOpt.minYear,
    rearDiscOpt.minYear,
  );

  const elecCapCost = usesModularElec
    ? absOpt!.capitalCost + tcsOpt!.capitalCost + escModOpt!.capitalCost
    : escOpt.capitalCost;
  const elecRdCost = usesModularElec
    ? absOpt!.rdCost + tcsOpt!.rdCost + escModOpt!.rdCost
    : escOpt.rdCost;

  // Costo di sviluppo Fase 2.3: integrazione e taratura veicolo (non progettazione da zero)
  const mechIntegrationCapScale = 0.14;
  const mechIntegrationRdScale = 0.24;
  const developmentCost = {
    capitalCost: Math.round(
      ((transOpt.capitalCost + extraGears * transOpt.perExtraGearCapitalCost) *
        strengthTierOpt.capitalCostMultiplier +
        (awdOpt?.capitalCost ?? 0) +
        diffOpt.capitalCost +
        steerOpt.capitalCost +
        (config.rearWheelSteering ? 6_000_000 : 0) +
        frontSuspOpt.capitalCost +
        rearSuspOpt.capitalCost) *
        mechIntegrationCapScale +
        elecCapCost +
        (hasDriveModeSelector ? DRIVE_MODE_SELECTOR_SPEC.capitalCost : 0) +
        frontCaliperOpt.capitalCost +
        rearCaliperOpt.capitalCost +
        frontDiscOpt.capitalCost +
        rearDiscOpt.capitalCost,
    ),
    rdCost: Math.round(
      (transOpt.rdCost +
        extraGears * transOpt.perExtraGearRdCost +
        strengthTierOpt.rdCostDelta +
        (awdOpt?.rdCost ?? 0) +
        diffOpt.rdCost +
        steerOpt.rdCost +
        (config.rearWheelSteering ? 28 : 0) +
        frontSuspOpt.rdCost +
        rearSuspOpt.rdCost) *
        mechIntegrationRdScale +
        elecRdCost +
        (hasDriveModeSelector ? DRIVE_MODE_SELECTOR_SPEC.rdCost : 0) +
        frontCaliperOpt.rdCost +
        rearCaliperOpt.rdCost +
        frontDiscOpt.rdCost +
        rearDiscOpt.rdCost,
    ),
    minYear,
  };

  // Penalità non lineare se coppia motore > capacità cambio
  const overloadStress =
    torqueOverloadRatio > 1.0 ? 1 + Math.pow(torqueOverloadRatio - 1.0, 1.35) * 4.5 : 0.92;
  const avgMaterialRes =
    (transOpt.durabilityFactor +
      (awdOpt?.durabilityFactor ?? 1.15) +
      diffOpt.durabilityFactor +
      frontSuspOpt.durabilityFactor * 0.5 +
      rearSuspOpt.durabilityFactor * 0.5 +
      frontDiscOpt.durabilityFactor) /
    5;

  const estimatedDurabilityKm = calculateEstimatedDurabilityKm(
    transOpt.priceTier,
    config.transmissionType === 'sequential-race'
      ? 'Corsa'
      : awdOpt?.id === 'awd-4wd-heavy-lowrange'
        ? 'Fuoristrada'
        : 'Normale',
    avgMaterialRes,
    overloadStress,
  );

  return {
    drivetrainLossPercent,
    wheelPeakPowerHp,
    wheelPeakTorqueNm,
    maxWheelTorqueFirstGearNm,
    lowRangeFirstGearTorqueNm,
    gearboxTorqueCapacityNm,
    torqueOverloadRatio,
    shiftTimeMs: transOpt.shiftTimeMs,
    awdStaticSplitFrontPercent,
    awdLayoutMapped,
    gearsTelemetry,
    theoreticalTopSpeedKmh: roundTo(theoreticalTopSpeedKmh, 1),
    cruisingRpmAt130Kmh,
    effectiveTireRadiusMm: tireRadiusMm,
    frontTireRadiusMm,
    rearTireRadiusMm,
    maxFrontDiscMm,
    maxRearDiscMm,
    resolvedEngineOrientation,
    engineFitNote,
    steeringPrecisionScore,
    turningCircleM,
    frontGripGeometryScore,
    rearGripGeometryScore,
    rideComfortScore,
    offRoadArticulationScore,
    suspensionPairingScore,
    suspensionPairingNote,
    gearboxStrengthTier: strengthTier,
    stabilityDriveMode: effectiveMode,
    frontBrakeTorqueNm,
    rearBrakeTorqueNm,
    brakeBiasFrontPercent,
    brakeThermalCapacityKj,
    brakeCoolingRateKw,
    stabilityInterventionFactor,
    tractionLaunchFactor,
    weightBreakdownKg,
    unitManufacturingCost,
    developmentCost,
    estimatedDurabilityKm,
    isCompatibleWithChassis: compatibilityErrors.length === 0,
    compatibilityErrors,
    warnings,
  };
}
