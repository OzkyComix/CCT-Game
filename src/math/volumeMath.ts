import type {
  ChassisEntity,
  DimensionsLWH,
  EngineOrientation,
  OrientationMechanicalAdaptation,
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
 * Calcola le quote fisiche del motore proiettate nel vano vettura:
 * - Longitudinale: L_bay (Fronte-Retro) = L_engine, W_bay (Tra i longheroni) = W_engine, H_bay = H_engine
 * - Trasversale (ruotato di 90°!): L_bay (Fronte-Retro tra radiatore e paratia) = W_engine,
 *   W_bay (Destra-Sinistra tra i passaruota) = L_engine, H_bay = H_engine
 */
export function calculateEngineInBayDimensions(
  engineDimensionsMm: DimensionsLWH,
  intendedOrientation: EngineOrientation,
): DimensionsLWH {
  if (intendedOrientation === 'Trasversale') {
    return {
      lengthMm: engineDimensionsMm.widthMm,
      widthMm: engineDimensionsMm.lengthMm,
      heightMm: engineDimensionsMm.heightMm,
    };
  }
  return {
    lengthMm: engineDimensionsMm.lengthMm,
    widthMm: engineDimensionsMm.widthMm,
    heightMm: engineDimensionsMm.heightMm,
  };
}

/**
 * Accorgimenti Meccanici di Conversione Orientamento (Punto 2):
 * Calcola l'adattamento fisico, la variazione di costo ($), le quote modificate (L/W)
 * e i moltiplicatori di potenza/coppia ed affidabilità quando un motore termico o Wankel
 * viene convertito dal suo orientamento nativo a quello opposto.
 */
export function calculateOrientationMechanicalAdaptation(
  nativeOrientation: EngineOrientation | undefined,
  intendedOrientation: EngineOrientation,
): OrientationMechanicalAdaptation {
  const native = nativeOrientation ?? intendedOrientation;
  if (native === 'Longitudinale' && intendedOrientation === 'Trasversale') {
    return {
      conversionType: 'LongitudinalToTransverse',
      unitCostDelta: 650,
      lengthDeltaMm: -20, // giro cinghie ausiliari compattato (-20mm su L_engine)
      widthDeltaMm: 25, // collettori ripiegati contro la paratia tagliafuoco (+25mm su W_engine)
      powerMultiplier: 0.975, // -2.5% potenza e coppia per contropressione scarico
      reliabilityDeltaPercent: -3.0, // -3.0% affidabilità per stress termico contro paratia
      technicalBadge:
        'Conversione Longitudinale → Trasversale: Coppa olio con paratie anti-G laterali e passaggio semiasse (+$650), cinghie ausiliari compattate (-20mm L), collettori ripiegati contro paratia (+25mm W, -2.5% CV/Nm contropressione scarico, -3.0% affidabilità termica).',
    };
  }
  if (native === 'Trasversale' && intendedOrientation === 'Longitudinale') {
    return {
      conversionType: 'TransverseToLongitudinal',
      unitCostDelta: 400,
      lengthDeltaMm: 15,
      widthDeltaMm: -15,
      powerMultiplier: 1.015, // +1.5% potenza ed efficienza
      reliabilityDeltaPercent: 1.5, // +1.5% affidabilità
      technicalBadge:
        'Conversione Trasversale → Longitudinale: Nuova coppa per G-longitudinali, supporti su slitta e collettori simmetrici lineari (+$400, +1.5% CV ed efficienza, +1.5% affidabilità grazie al flusso frontale).',
    };
  }
  return {
    conversionType: 'Native',
    unitCostDelta: 0,
    lengthDeltaMm: 0,
    widthDeltaMm: 0,
    powerMultiplier: 1.0,
    reliabilityDeltaPercent: 0,
    technicalBadge: `Orientamento Nativo di Progetto (${intendedOrientation}): Monoblocco, supporti e coppa olio ottimizzati all'origine (nessun costo o penalità).`,
  };
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
  options?: { isPureEV?: boolean },
): EngineBayCompatibilityResult {
  const isPureEV = Boolean(options?.isPureEV);
  const orientationConflict = isPureEV
    ? false
    : !chassis.supportedEngineOrientations.includes(intendedOrientation);

  const bay = chassis.engineBayMaxDimensionsMm;

  // Se il motore è montato Trasversalmente, la Lunghezza del blocco (L) corre lungo l'asse trasversale (W) del vano
  const effectiveDirect: DimensionsLWH =
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

  // Orientamento alternativo ruotato (per i BEV che non hanno vincolo meccanico d'asse rigido)
  const effectiveRotated: DimensionsLWH =
    intendedOrientation === 'Trasversale'
      ? {
          lengthMm: engineDimensionsMm.lengthMm,
          widthMm: engineDimensionsMm.widthMm,
          heightMm: engineDimensionsMm.heightMm,
        }
      : {
          lengthMm: engineDimensionsMm.widthMm,
          widthMm: engineDimensionsMm.lengthMm,
          heightMm: engineDimensionsMm.heightMm,
        };

  const directFits =
    effectiveDirect.lengthMm <= bay.lengthMm &&
    effectiveDirect.widthMm <= bay.widthMm &&
    effectiveDirect.heightMm <= bay.heightMm;

  const rotatedFits =
    effectiveRotated.lengthMm <= bay.lengthMm &&
    effectiveRotated.widthMm <= bay.widthMm &&
    effectiveRotated.heightMm <= bay.heightMm;

  // Nei veicoli elettrici puri (BEV), l'orientamento non blocca l'omologazione:
  // se entra in una delle due rotazioni fisiche nel vano, viene adottata quella compatibile.
  const effectiveEngineInBayMm: DimensionsLWH = isPureEV
    ? directFits
      ? effectiveDirect
      : rotatedFits
        ? effectiveRotated
        : effectiveDirect.lengthMm * effectiveDirect.widthMm <= effectiveRotated.lengthMm * effectiveRotated.widthMm
          ? effectiveDirect
          : effectiveRotated
    : effectiveDirect;

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
    (isPureEV || !orientationConflict) &&
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

