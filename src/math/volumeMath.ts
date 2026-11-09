import type {
  ChassisEntity,
  DimensionsLWH,
  EngineOrientation,
} from '../types/gameTypes';

export interface EngineBayCompatibilityResult {
  chassisId: string;
  chassisName: string;
  isCompatible: boolean;
  orientationConflict: boolean;
  /** Ingombro effettivo del motore orientato nel vano (mm) */
  effectiveEngineInBayMm: DimensionsLWH;
  /** Eccedenza fisica in millimetri (> 0 indica collisione con il vano motore) */
  overflowMm: DimensionsLWH;
  /** Margine residuo in millimetri (negativo se sfora) */
  clearanceMm: DimensionsLWH;
  conflictReasons: string[];
}

/**
 * 1.2: Verifica Ingombro Vano Motore in Tempo Reale
 * Confronta le dimensioni fisiche LWH del motore (incluso l'effetto di turbine Laterali/Frontali/Hot-V)
 * e l'orientamento previsto (Longitudinale vs Trasversale) con il vano motore di un Pianale aziendale.
 */
export function evaluateEngineBayCompatibility(
  engineDimensionsMm: DimensionsLWH,
  intendedOrientation: EngineOrientation,
  chassis: ChassisEntity,
): EngineBayCompatibilityResult {
  const orientationConflict = !chassis.supportedEngineOrientations.includes(intendedOrientation);

  // Se il motore è montato Trasversalmente, la Lunghezza del blocco (L) corre lungo l'asse trasversale (W) del vano
  const effectiveEngineInBayMm: DimensionsLWH =
    intendedOrientation === 'Trasversale'
      ? {
          lengthMm: engineDimensionsMm.widthMm,
          widthMm: engineDimensionsMm.lengthMm,
          heightMm: engineDimensionsMm.heightMm,
        }
      : {
          lengthMm: engineDimensionsMm.lengthMm,
          widthMm: engineDimensionsMm.widthMm,
          heightMm: engineDimensionsMm.heightMm,
        };

  const bay = chassis.engineBayMaxDimensionsMm;

  const overflowLengthMm = Math.max(0, effectiveEngineInBayMm.lengthMm - bay.lengthMm);
  const overflowWidthMm = Math.max(0, effectiveEngineInBayMm.widthMm - bay.widthMm);
  const overflowHeightMm = Math.max(0, effectiveEngineInBayMm.heightMm - bay.heightMm);

  const clearanceMm: DimensionsLWH = {
    lengthMm: bay.lengthMm - effectiveEngineInBayMm.lengthMm,
    widthMm: bay.widthMm - effectiveEngineInBayMm.widthMm,
    heightMm: bay.heightMm - effectiveEngineInBayMm.heightMm,
  };

  const conflictReasons: string[] = [];

  if (orientationConflict) {
    conflictReasons.push(
      `Orientamento ${intendedOrientation} non supportato (richiesto: ${chassis.supportedEngineOrientations.join('/')})`,
    );
  }
  if (overflowLengthMm > 0) {
    conflictReasons.push(`Lunghezza vano superata di +${overflowLengthMm} mm`);
  }
  if (overflowWidthMm > 0) {
    conflictReasons.push(`Larghezza vano superata di +${overflowWidthMm} mm`);
  }
  if (overflowHeightMm > 0) {
    conflictReasons.push(`Altezza cofano superata di +${overflowHeightMm} mm`);
  }

  const isCompatible =
    !orientationConflict &&
    overflowLengthMm === 0 &&
    overflowWidthMm === 0 &&
    overflowHeightMm === 0;

  return {
    chassisId: chassis.id,
    chassisName: chassis.name,
    isCompatible,
    orientationConflict,
    effectiveEngineInBayMm,
    overflowMm: {
      lengthMm: overflowLengthMm,
      widthMm: overflowWidthMm,
      heightMm: overflowHeightMm,
    },
    clearanceMm,
    conflictReasons,
  };
}

