import {
  BATTERY_CHEMISTRIES,
  BATTERY_PACK_STRUCTURE_SPECS,
  BMS_CALIBRATION_SPECS,
  deriveBatteryPackTaxonomy,
  deriveElectricMotorTaxonomy,
  ELECTRIC_COOLING_SYSTEMS,
  ELECTRIC_MOTOR_TYPES,
  getRotorMaterialSpecsForMotorType,
  HYBRID_SYSTEM_TYPES,
  INVERTER_POWER_ELECTRONICS_SPECS,
  MOTOR_HOUSING_SPECS,
  MOTOR_LAYOUT_CONFIGS,
  REFERENCE_HYBRID_ICE_ENGINES,
  ROTOR_SLEEVE_BEARING_SPECS,
  STATOR_WINDING_SPECS,
  UNDERBODY_SHIELD_SPECS,
  VOLTAGE_ARCHITECTURES,
} from '../data/electricHybridData';
import type {
  BatteryPackSpec,
  BatteryPackTelemetry,
  BenchElectricDriveArrangement,
  BenchElectricMotorCount,
  CoupledIceEngineOption,
  DimensionsLWH,
  DualCurrencyCost,
  DynoCurvePoint,
  EngineOrientation,
  ElectricHybridEngineConfigInput,
  ElectricHybridSpecs,
  ElectricMotorSpec,
  EngineDynoTelemetry,
  HybridSystemType,
  MotorLayoutConfig,
  PowertrainBenchConfig,
  SingleElectricMotorTelemetry,
} from '../types/gameTypes';

export interface ElectricHybridGeometryMetrics {
  motorDimensionsMm: DimensionsLWH;
  batteryDimensionsMm: DimensionsLWH;
  inverterDimensionsMm: DimensionsLWH;
  /** Dimensioni native prima della rotazione d'orientamento */
  rawDimensionsMm: DimensionsLWH;
  /** Ingombro complessivo del gruppo propulsore nel vano motore per la verifica collisione (mm) */
  engineBayDimensionsMm: DimensionsLWH;
  /** Volume attivo statore/rotore della singola unità motrice in cm³ (cc) */
  statorVolumeCc: number;
}

export interface EvHybridSimulationResult extends EngineDynoTelemetry {
  specs: ElectricHybridSpecs;
  /** Coppia effettiva alle ruote allo spunto (Nm * rapporto al ponte * 1a marcia eventuale) */
  effectiveWheelTorqueNm?: number;
  /** Telemetria isolata della singola unità motore elettrico universale (1.0x) */
  singleMotorTelemetry: SingleElectricMotorTelemetry;
  /** Telemetria isolata del pacco batteria indipendente */
  batteryPackTelemetry: BatteryPackTelemetry;
  /** Configurazione separata del simulatore di test al banco */
  benchConfig: PowertrainBenchConfig;
  /** Curva del solo motore termico/Wankel (per grafico ibrido combinato) */
  iceOnlyCurve?: DynoCurvePoint[];
  /** Curva del solo comparto elettrico (per grafico ibrido combinato) */
  electricOnlyCurve?: DynoCurvePoint[];
  /** Motore termico/Wankel effettivamente accoppiato */
  coupledIceOption?: CoupledIceEngineOption;
}

/**
 * Interpola linearmente Coppia (Nm) e Potenza (CV) di una curva termica/Wankel a un dato RPM.
 */
function sampleCurveAtRpm(
  curve: DynoCurvePoint[],
  targetRpm: number,
): { torqueNm: number; powerHp: number } {
  if (!curve || curve.length === 0) {
    return { torqueNm: 0, powerHp: 0 };
  }
  if (targetRpm <= curve[0].rpm) {
    const torqueNm = curve[0].torqueNm;
    return { torqueNm, powerHp: Math.round((torqueNm * targetRpm) / 7023.5) };
  }
  const last = curve[curve.length - 1];
  if (targetRpm >= last.rpm) {
    const torqueNm = last.torqueNm;
    return { torqueNm, powerHp: Math.round((torqueNm * targetRpm) / 7023.5) };
  }

  for (let i = 0; i < curve.length - 1; i++) {
    const p0 = curve[i];
    const p1 = curve[i + 1];
    if (targetRpm >= p0.rpm && targetRpm <= p1.rpm) {
      const span = Math.max(1, p1.rpm - p0.rpm);
      const t = (targetRpm - p0.rpm) / span;
      const torqueNm = Math.round(p0.torqueNm + (p1.torqueNm - p0.torqueNm) * t);
      const powerHp = Math.round((torqueNm * targetRpm) / 7023.5);
      return { torqueNm, powerHp };
    }
  }
  return {
    torqueNm: last.torqueNm,
    powerHp: Math.round((last.torqueNm * targetRpm) / 7023.5),
  };
}

// ============================================================================
// 1. SEPARAZIONE ARCHITETTURALE: ESTRATTORI STATO (MOTORE SINGOLO / BATTERIA / BANCO)
// ============================================================================

/**
 * Estrae la specifica pura della singola unità motore elettrico universale (`ElectricMotorSpec`),
 * rimuovendo qualsiasi parametro di posizionamento (Anteriore/Posteriore) o orientamento (Trasversale/Longitudinale).
 */
export function extractElectricMotorSpec(
  input: ElectricHybridEngineConfigInput | PowertrainBenchConfig | ElectricMotorSpec,
): ElectricMotorSpec {
  if ('motor' in input && input.motor) {
    const m = { ...input.motor };
    const taxonomy = deriveElectricMotorTaxonomy(
      m.statorWinding,
      m.inverterPowerElectronics,
      m.rotorSleeveBearing,
      m.rotorMagnetMaterial,
      m.motorHousing,
    );
    return {
      ...m,
      priceTier: m.priceTier || taxonomy.priceTier,
      referenceClass: m.referenceClass || taxonomy.referenceClass,
    };
  }
  if ('motorSpec' in input && input.motorSpec) {
    const m = { ...input.motorSpec };
    const taxonomy = deriveElectricMotorTaxonomy(
      m.statorWinding,
      m.inverterPowerElectronics,
      m.rotorSleeveBearing,
      m.rotorMagnetMaterial,
      m.motorHousing,
    );
    return {
      ...m,
      priceTier: m.priceTier || taxonomy.priceTier,
      referenceClass: m.referenceClass || taxonomy.referenceClass,
    };
  }
  const cfg = input as ElectricMotorSpec & Partial<ElectricHybridEngineConfigInput>;
  const statorWinding = cfg.statorWinding ?? 'HairpinFlat';
  const inverterPowerElectronics = cfg.inverterPowerElectronics ?? 'SiliconCarbide_SiC';
  const rotorSleeveBearing = cfg.rotorSleeveBearing ?? 'InconelSleeveHybrid';
  const rotorMagnetMaterial = cfg.rotorMagnetMaterial ?? 'NeodymiumNdFeB';
  const motorHousing = cfg.motorHousing ?? 'DieCastAluminum';
  const taxonomy = deriveElectricMotorTaxonomy(
    statorWinding,
    inverterPowerElectronics,
    rotorSleeveBearing,
    rotorMagnetMaterial,
    motorHousing,
  );

  return {
    electricMotorType: cfg.electricMotorType,
    statorDiameterMm: cfg.statorDiameterMm,
    rotorLengthMm: cfg.rotorLengthMm,
    voltageArchitecture: cfg.voltageArchitecture,
    coolingSystem: cfg.coolingSystem,
    statorWinding,
    inverterPowerElectronics,
    rotorSleeveBearing,
    rotorMagnetMaterial,
    motorHousing,
    priceTier: cfg.priceTier || taxonomy.priceTier,
    referenceClass: cfg.referenceClass || taxonomy.referenceClass,
    maxMotorRpm: cfg.maxMotorRpm,
  };
}

/**
 * Estrae la specifica pura del pacco batteria indipendente (`BatteryPackSpec`),
 * valutabile e salvabile separatamente.
 */
export function extractBatteryPackSpec(
  input: ElectricHybridEngineConfigInput | PowertrainBenchConfig | BatteryPackSpec,
): BatteryPackSpec {
  if ('battery' in input && input.battery) {
    const b = { ...input.battery };
    const taxonomy = deriveBatteryPackTaxonomy(
      b.packStructure,
      b.bmsCalibration,
      b.underbodyShield,
    );
    return {
      ...b,
      priceTier: b.priceTier || taxonomy.priceTier,
      referenceClass: b.referenceClass || taxonomy.referenceClass,
    };
  }
  if ('batterySpec' in input && input.batterySpec) {
    const b = { ...input.batterySpec };
    const taxonomy = deriveBatteryPackTaxonomy(
      b.packStructure,
      b.bmsCalibration,
      b.underbodyShield,
    );
    return {
      ...b,
      priceTier: b.priceTier || taxonomy.priceTier,
      referenceClass: b.referenceClass || taxonomy.referenceClass,
    };
  }
  const cfg = input as BatteryPackSpec & Partial<ElectricHybridEngineConfigInput>;
  const packStructure = cfg.packStructure ?? 'CellToPackCopper';
  const bmsCalibration = cfg.bmsCalibration ?? 'RoadBalanced';
  const underbodyShield = cfg.underbodyShield ?? 'StandardSteelShield';
  const taxonomy = deriveBatteryPackTaxonomy(
    packStructure,
    bmsCalibration,
    underbodyShield,
  );

  return {
    batteryChemistry: cfg.batteryChemistry,
    batteryCapacityKwh: cfg.batteryCapacityKwh,
    voltageArchitecture: cfg.voltageArchitecture,
    coolingSystem: cfg.coolingSystem,
    packStructure,
    bmsCalibration,
    underbodyShield,
    priceTier: cfg.priceTier || taxonomy.priceTier,
    referenceClass: cfg.referenceClass || taxonomy.referenceClass,
  };
}

/**
 * Converte una configurazione UI o banco prova in un `PowertrainBenchConfig` normalizzato,
 * separando nettamente:
 * - `motor`: `ElectricMotorSpec` (singola unità universale)
 * - `battery`: `BatteryPackSpec` (pacco batteria indipendente)
 * - configurazione del banco (`motorCount`: 1, 2, 3 o 4 motori, `hasMechanicalAwdShaft` con -8% perdita,
 *   `systemType` e `coupledIceOptionId`).
 */
export function toPowertrainBenchConfig(
  input: ElectricHybridEngineConfigInput | PowertrainBenchConfig,
): PowertrainBenchConfig {
  if ('motor' in input && 'battery' in input) {
    const motorCount = Math.max(1, Math.min(4, input.motorCount || 1)) as BenchElectricMotorCount;
    const hasMechanicalAwdShaft =
      Boolean(input.hasMechanicalAwdShaft) ||
      input.benchArrangement === 'Single_MechanicalAWD' ||
      input.motorLayout === 'SingleMotor_MechanicalAWD';
    return {
      ...input,
      motorCount: hasMechanicalAwdShaft ? 1 : motorCount,
      hasMechanicalAwdShaft,
    };
  }

  const motor = extractElectricMotorSpec(input);
  const battery = extractBatteryPackSpec(input);
  const layoutSpec =
    MOTOR_LAYOUT_CONFIGS.find((l) => l.id === input.motorLayout) ??
    MOTOR_LAYOUT_CONFIGS[0];

  const hasMechanicalAwdShaft =
    Boolean(input.hasMechanicalAwdShaft) ||
    input.motorLayout === 'SingleMotor_MechanicalAWD';

  const motorCount = (
    hasMechanicalAwdShaft
      ? 1
      : input.motorCount ?? layoutSpec.motorCount
  ) as BenchElectricMotorCount;

  const benchArrangement: BenchElectricDriveArrangement = hasMechanicalAwdShaft
    ? 'Single_MechanicalAWD'
    : motorCount === 4
      ? 'Quad_4x'
      : motorCount === 3
        ? 'Tri_3x'
        : motorCount === 2
          ? 'Dual_2x'
          : 'Single_1x';

  return {
    systemType: input.systemType,
    motorCount,
    hasMechanicalAwdShaft,
    benchArrangement,
    motorLayout: input.motorLayout,
    hasFrontDisconnect: input.hasFrontDisconnect,
    gearboxType: input.gearboxType,
    gearRatio: input.gearRatio,
    coupledIceOptionId: input.coupledIceOptionId,
    motor,
    battery,
  };
}

/**
 * Restituisce il moltiplicatore di scala al banco per motori elettrici uguali:
 * - Single (1 motore) = 1.0x
 * - Single + Albero di trasmissione meccanico AWD = 0.92x (-8% di perdita meccanica)
 * - Dual (2 motori) = 2.0x
 * - Tri (3 motori) = 3.0x
 * - Quad (4 motori) = 4.0x
 */
export function getBenchLinearMotorScale(bench: PowertrainBenchConfig): {
  motorCount: BenchElectricMotorCount;
  hasMechanicalAwdShaft: boolean;
  drivetrainEfficiencyFactor: number;
  linearOutputMultiplier: number;
} {
  const hasMechanicalAwdShaft =
    Boolean(bench.hasMechanicalAwdShaft) ||
    bench.benchArrangement === 'Single_MechanicalAWD' ||
    bench.motorLayout === 'SingleMotor_MechanicalAWD';

  const motorCount: BenchElectricMotorCount = hasMechanicalAwdShaft
    ? 1
    : (Math.max(1, Math.min(4, bench.motorCount || 1)) as BenchElectricMotorCount);

  // Perdita meccanica del -8% (0.92x) solo se si usa 1 singolo motore con albero di trasmissione meccanico AWD;
  // per 1, 2, 3 o 4 motori elettrici diretti la scala è esattamente lineare: 1.0x, 2.0x, 3.0x, 4.0x!
  const drivetrainEfficiencyFactor = hasMechanicalAwdShaft ? 0.92 : 1.0;
  const linearOutputMultiplier = Number((motorCount * drivetrainEfficiencyFactor).toFixed(4));

  return {
    motorCount,
    hasMechanicalAwdShaft,
    drivetrainEfficiencyFactor,
    linearOutputMultiplier,
  };
}

// ============================================================================
// 2. COMPONENTE 1: SINGOLA UNITÀ MOTORE ELETTRICO UNIVERSALE (`ElectricMotorSpec`)
// ============================================================================

/**
 * Valuta Coppia (Nm) e Potenza (CV) su un punto RPM della curva elettrica in modo C1 continuo.
 * Condivide esattamente la stessa fisica tra Pannello 1 (motore singolo 1.0x) e Pannello 3 (banco).
 */
export function computeElectricMotorTorqueAndPowerAtRpm(params: {
  rpm: number;
  peakTorqueNm: number;
  ratedPowerHp: number;
  cornerSpeedRpm: number;
  statorWinding?: ElectricMotorSpec['statorWinding'];
  gearboxType?: 'SingleSpeedDirect' | 'TwoSpeedDualClutch';
  gearRatio?: number;
  maxCapPowerHp?: number;
}): { torqueNm: number; powerHp: number } {
  const {
    rpm,
    peakTorqueNm,
    ratedPowerHp,
    cornerSpeedRpm,
    statorWinding = 'HairpinFlat',
    gearboxType = 'SingleSpeedDirect',
    gearRatio = 9.0,
    maxCapPowerHp,
  } = params;

  if (rpm <= 0) {
    return { torqueNm: peakTorqueNm, powerHp: 0 };
  }

  if (rpm <= cornerSpeedRpm) {
    const powerHp = Math.min(
      ratedPowerHp,
      Math.round((peakTorqueNm * rpm) / 7023.5),
    );
    return { torqueNm: peakTorqueNm, powerHp };
  }

  // Regione di Field Weakening (T ∝ 1/rpm): attenuazione C1 continua ad altissima frequenza
  // per effetto pelle / isteresi nucleo, dipendente solo da (rpm - cornerSpeedRpm), mai da maxMotorRpm.
  const excessKrpm = (rpm - cornerSpeedRpm) / 1000;
  const u = Math.max(0, Math.min(1, (excessKrpm - 1.5) / 12.0));
  const hermite = u * u * (3 - 2 * u);

  const windingSkinLossMax =
    statorWinding === 'RoundWireStandard'
      ? 0.06
      : statorWinding === 'HairpinFlat'
        ? 0.032
        : statorWinding === 'HairpinContinuousMultiLayer'
          ? 0.014
          : 0.0; // LitzRacingWire annulla le perdite per effetto pelle ad alta frequenza in modo continuo

  // Su SingleSpeedDirect a rapporto standard (9.0:1) coincide esattamente con la curva unitaria;
  // TwoSpeedDualClutch estende la spinta ad alta velocità mentre gearRatio modula il trascinamento agli alti giri.
  const ratioHighRpmAdjustment =
    gearboxType === 'SingleSpeedDirect'
      ? -(gearRatio - 9.0) * 0.006 * hermite
      : 0.04 * hermite;

  const highRpmPowerFactor = Math.max(
    0.85,
    1 - windingSkinLossMax * (gearboxType === 'TwoSpeedDualClutch' ? 0.35 : 1.0) * hermite + ratioHighRpmAdjustment,
  );
  const uncappedHp = Math.max(1, Math.round(ratedPowerHp * highRpmPowerFactor));
  const powerHp =
    maxCapPowerHp !== undefined ? Math.min(maxCapPowerHp, uncappedHp) : uncappedHp;
  const torqueNm = Math.min(
    peakTorqueNm,
    Math.max(1, Math.round((powerHp * 7023.5) / rpm)),
  );

  return { torqueNm, powerHp };
}

/**
 * Calcola tutte le specifiche fisiche, geometriche, telemetriche e di costo di UNA SINGOLA
 * unità motore elettrico universale (`ElectricMotorSpec`, scala 1.0x).
 * - Dipende SOLO da tecnologia, diametro statore, lunghezza rotore, tensione, raffreddamento,
 *   componenti hardware interni e regime massimo.
 */
export function calculateSingleElectricMotorMetrics(
  motorInput: ElectricMotorSpec | ElectricHybridEngineConfigInput | PowertrainBenchConfig,
): SingleElectricMotorTelemetry {
  const spec = extractElectricMotorSpec(motorInput);

  const motorTypeSpec =
    ELECTRIC_MOTOR_TYPES.find((m) => m.id === spec.electricMotorType) ??
    ELECTRIC_MOTOR_TYPES[0];
  const coolingSpec =
    ELECTRIC_COOLING_SYSTEMS.find((c) => c.id === spec.coolingSystem) ??
    ELECTRIC_COOLING_SYSTEMS[1];
  const voltageSpec =
    VOLTAGE_ARCHITECTURES.find((v) => v.voltage === spec.voltageArchitecture) ??
    VOLTAGE_ARCHITECTURES[0];

  // 5 Componenti Hardware Fisici
  const windingSpec =
    STATOR_WINDING_SPECS.find((w) => w.id === spec.statorWinding) ??
    STATOR_WINDING_SPECS[1];
  const inverterSpec =
    INVERTER_POWER_ELECTRONICS_SPECS.find((i) => i.id === spec.inverterPowerElectronics) ??
    INVERTER_POWER_ELECTRONICS_SPECS[2];
  const bearingSpec =
    ROTOR_SLEEVE_BEARING_SPECS.find((b) => b.id === spec.rotorSleeveBearing) ??
    ROTOR_SLEEVE_BEARING_SPECS[1];
  const rotorSpecs = getRotorMaterialSpecsForMotorType(spec.electricMotorType);
  const magnetSpec =
    rotorSpecs.find((m) => m.id === spec.rotorMagnetMaterial) ??
    rotorSpecs[1];
  const housingSpec =
    MOTOR_HOUSING_SPECS.find((h) => h.id === spec.motorHousing) ??
    MOTOR_HOUSING_SPECS[0];

  // 1. Geometria attiva statore/rotore:
  const Ds = Math.max(120, spec.statorDiameterMm);
  const Lr = Math.max(50, spec.rotorLengthMm);
  const statorVolumeCc = Math.round(Math.PI * Math.pow(Ds / 20, 2) * (Lr / 10));

  const isAxialFlux = spec.electricMotorType === 'AxialFlux';
  const motorDiameterMm = Math.round(Ds + 38);
  const motorLengthMm = Math.round(isAxialFlux ? 85 + Lr * 0.22 : Lr + 80);

  const dimensionsMm: DimensionsLWH = {
    lengthMm: motorLengthMm,
    widthMm: motorDiameterMm,
    heightMm: motorDiameterMm,
  };

  const isDualSiCGaN = inverterSpec.id === 'Dual_SiC_GaN_Racing';
  const isSiC = inverterSpec.id === 'SiliconCarbide_SiC';
  const inverterDimensionsMm: DimensionsLWH = {
    lengthMm: Math.round(isDualSiCGaN ? 185 : isSiC ? 235 : 295),
    widthMm: Math.round(isDualSiCGaN ? 165 : isSiC ? 215 : 265),
    heightMm: Math.round(isDualSiCGaN ? 70 : isSiC ? 90 : 120),
  };

  // 2. Fisica elettromagnetica continua: separazione tra Coppia (Nm) e Corner Speed (RPM):
  const DsMm = Math.max(120, spec.statorDiameterMm);
  const LrMm = Math.max(50, spec.rotorLengthMm);
  const volumeLiters = Math.max(0.5, statorVolumeCc / 1000);
  const aspectRatio = DsMm / LrMm;
  const isInduction = spec.electricMotorType === 'InductionAsync';
  const isEesm = spec.electricMotorType === 'WoundRotorSync_EESM';
  const isIpm = spec.electricMotorType === 'IPM_SynRM';

  const voltageTorqueFactor = Math.pow(
    voltageSpec.voltage / 800,
    isAxialFlux ? 0.0 : 0.067,
  );

  const coolingTorqueFactor =
    spec.coolingSystem === 'DirectDielectric'
      ? 1.104
      : spec.coolingSystem === 'LiquidGlycol'
        ? 1.0
        : 0.9905;

  const windingTorqueFactor =
    windingSpec.id === 'RoundWireStandard'
      ? 0.964
      : windingSpec.id === 'HairpinFlat'
        ? 1.0
        : windingSpec.id === 'HairpinContinuousMultiLayer'
          ? 1.095 * (isAxialFlux ? 1.0802 : 1.0)
          : 0.905 * (isAxialFlux ? 0.9165 : 1.0);

  const inverterTorqueFactor =
    inverterSpec.id === 'Silicon_IGBT'
      ? 0.998
      : inverterSpec.id === 'Silicon_MOSFET'
        ? 1.0
        : inverterSpec.id === 'SiliconCarbide_SiC'
          ? 1.006
          : 1.215 * (isAxialFlux ? 0.9618 : 1.0);

  const bearingTorqueFactor =
    bearingSpec.id === 'SteelLaminationStandard'
      ? 0.96
      : bearingSpec.id === 'InconelSleeveHybrid'
        ? 1.0
        : 1.08;

  // Su asincrono ASM e sincrono avvolto EESM il parametro rotore agisce sulla tecnologia gabbia/avvolgimento DC
  const magnetTorqueFactor = isInduction
    ? {
        FerriteStandardCage: 0.686,
        NeodymiumNdFeB: 1.0,
        NeodymiumDyUH: 1.23,
        SamariumCobaltRacing: 1.276,
      }[magnetSpec.id]
    : isEesm
      ? {
          FerriteStandardCage: 0.93,
          NeodymiumNdFeB: 1.0,
          NeodymiumDyUH: 1.0125,
          SamariumCobaltRacing: 1.1275,
        }[magnetSpec.id]
      : {
          FerriteStandardCage: 0.896,
          NeodymiumNdFeB: 1.0,
          NeodymiumDyUH: 1.052,
          SamariumCobaltRacing: 1.222 * (isAxialFlux ? 1.1603 : 1.0),
        }[magnetSpec.id];

  const rawUnitTorqueNm = isInduction
    ? 68.71399 *
      0.835 *
      Math.pow(volumeLiters, 0.896) *
      Math.pow(DsMm / 225, 0.115) *
      voltageTorqueFactor *
      coolingTorqueFactor *
      windingTorqueFactor *
      inverterTorqueFactor *
      bearingTorqueFactor *
      magnetTorqueFactor
    : isAxialFlux
      ? 75.48347 *
        Math.pow(volumeLiters, 0.86937) *
        Math.pow(DsMm / 225, 0.26239) *
        Math.pow(Math.max(1.2, aspectRatio) / 2.2, 0.25759) *
        voltageTorqueFactor *
        coolingTorqueFactor *
        windingTorqueFactor *
        inverterTorqueFactor *
        bearingTorqueFactor *
        magnetTorqueFactor
      : 68.71399 *
        (isEesm ? 0.961 : isIpm ? 1.055 : 1.0) *
        Math.pow(volumeLiters, 0.885) *
        Math.pow(DsMm / 225, 0.16774) *
        voltageTorqueFactor *
        coolingTorqueFactor *
        windingTorqueFactor *
        inverterTorqueFactor *
        bearingTorqueFactor *
        magnetTorqueFactor;

  const peakTorqueNm = Math.max(35, Math.round(rawUnitTorqueNm));

  // Corner Speed (ω_base): determinata da Back-EMF (tensione bus reale), diametro statore D_s,
  // aspect ratio D/L assiale e parametri elettromagnetici di statore/rotore/inverter:
  // A V <= 800V mantiene l'esponente calibrato 400V -> 800V; a 1000V+ l'architettura ad alta tensione
  // elimina il clipping di modulazione sbloccando ~+12.8% Corner Speed e ~+14.5% potenza di picco.
  const voltageCornerExponent =
    voltageSpec.voltage > 800
      ? 0.54
      : isAxialFlux
        ? 0.31811
        : isEesm
          ? 0.25
          : 0.2727;

  const voltageCornerFactor = Math.pow(
    voltageSpec.voltage / 800,
    voltageCornerExponent,
  );

  const coolingCornerFactor =
    spec.coolingSystem === 'DirectDielectric'
      ? isInduction
        ? 1.15
        : 0.992
      : spec.coolingSystem === 'LiquidGlycol'
        ? 1.0
        : 0.99;

  const windingCornerFactor = isInduction
    ? windingSpec.id === 'RoundWireStandard'
      ? 1.326
      : windingSpec.id === 'HairpinFlat'
        ? 0.822
        : windingSpec.id === 'HairpinContinuousMultiLayer'
          ? 0.822 * 1.0616
          : 0.822 * 1.202
    : windingSpec.id === 'RoundWireStandard'
      ? 0.778
      : windingSpec.id === 'HairpinFlat'
        ? 1.0
        : windingSpec.id === 'HairpinContinuousMultiLayer'
          ? 1.0616 * (isAxialFlux ? 0.9284 : 1.0)
          : 1.202 * (isAxialFlux ? 0.9277 : 1.0);

  const inverterCornerFactor = isInduction
    ? inverterSpec.id === 'Silicon_IGBT'
      ? 0.659
      : inverterSpec.id === 'Silicon_MOSFET'
        ? 1.0
        : inverterSpec.id === 'SiliconCarbide_SiC'
          ? 1.217
          : 1.217
    : inverterSpec.id === 'Silicon_IGBT'
      ? 0.813
      : inverterSpec.id === 'Silicon_MOSFET'
        ? 1.0
        : inverterSpec.id === 'SiliconCarbide_SiC'
          ? 1.065
          : 1.1064 * (isAxialFlux ? 1.0728 : 1.0);

  const bearingCornerFactor = isInduction
    ? bearingSpec.id === 'SteelLaminationStandard'
      ? 0.887
      : bearingSpec.id === 'InconelSleeveHybrid'
        ? 0.904
        : 1.025
    : isAxialFlux
      ? bearingSpec.id === 'SteelLaminationStandard'
        ? 0.887
        : bearingSpec.id === 'InconelSleeveHybrid'
          ? 1.0499
          : 1.025 * 1.05
      : bearingSpec.id === 'SteelLaminationStandard'
        ? 0.887
        : bearingSpec.id === 'InconelSleeveHybrid'
          ? 1.0
          : 1.025;

  const magnetCornerFactor = isInduction
    ? {
        FerriteStandardCage: 1.364,
        NeodymiumNdFeB: 1.0,
        NeodymiumDyUH: 1.216,
        SamariumCobaltRacing: 1.057,
      }[magnetSpec.id]
    : isEesm
      ? {
          FerriteStandardCage: 1.0,
          NeodymiumNdFeB: 1.03,
          NeodymiumDyUH: 1.1205,
          SamariumCobaltRacing: 1.0735,
        }[magnetSpec.id]
      : {
          FerriteStandardCage: 1.149,
          NeodymiumNdFeB: 1.0,
          NeodymiumDyUH: 1.026,
          SamariumCobaltRacing: 1.028 * (isAxialFlux ? 1.1642 : 1.0),
        }[magnetSpec.id];

  const rawCornerSpeedRpm = isInduction
    ? 5314.55303 *
      1.303 *
      Math.pow(225 / DsMm, 1.045) *
      voltageCornerFactor *
      coolingCornerFactor *
      windingCornerFactor *
      inverterCornerFactor *
      bearingCornerFactor *
      magnetCornerFactor
    : isAxialFlux
      ? 4055.95398 *
        Math.pow(225 / DsMm, 1.17346) *
        Math.pow(Math.max(1.2, aspectRatio) / 2.5, -0.70952) *
        voltageCornerFactor *
        coolingCornerFactor *
        windingCornerFactor *
        inverterCornerFactor *
        bearingCornerFactor *
        magnetCornerFactor
      : 5314.55303 *
        (isEesm ? 1.125 : isIpm ? 1.135 : 1.0) *
        Math.pow(225 / DsMm, isIpm ? 1.677 : 1.72671) *
        voltageCornerFactor *
        coolingCornerFactor *
        windingCornerFactor *
        inverterCornerFactor *
        bearingCornerFactor *
        magnetCornerFactor;

  const cornerSpeedRpm = Math.max(1800, Math.min(16500, Math.round(rawCornerSpeedRpm)));
  const ratedPowerHp = Math.max(20, Math.round((peakTorqueNm * cornerSpeedRpm) / 7023.5));

  // Regime massimo richiesto (3.000 - 24.000 RPM) senza clamp silenziosi sullo slider:
  const maxMotorRpm = Math.max(
    3000,
    Math.min(24000, Math.round(spec.maxMotorRpm || bearingSpec.maxSafeRpm)),
  );

  // 3. Curva dinamometrica continua C1 (invariante rispetto a maxMotorRpm):
  const curve: DynoCurvePoint[] = [];
  const stepRpm = 250;
  for (let rpm = 0; rpm <= maxMotorRpm; rpm += stepRpm) {
    const pt = computeElectricMotorTorqueAndPowerAtRpm({
      rpm,
      peakTorqueNm,
      ratedPowerHp,
      cornerSpeedRpm,
      statorWinding: windingSpec.id,
    });
    curve.push({ rpm, torqueNm: pt.torqueNm, powerHp: pt.powerHp });
  }

  const maxCurveHp = curve.reduce((best, pt) => Math.max(best, pt.powerHp), 0);
  const peakPowerHp = maxMotorRpm < cornerSpeedRpm ? Math.max(15, maxCurveHp) : ratedPowerHp;
  const peakPowerKw = Math.max(11, Math.round(peakPowerHp * 0.7355));
  const continuousPowerKw = Math.round(peakPowerKw * coolingSpec.continuousPowerRatio);

  // 4. Modello fisico additivo del peso motore + inverter integrato (kg):
  const barrelNorm = (Math.PI * (DsMm / 1000) * (LrMm / 1000)) / 0.135;
  const endbellNorm = (2 * Math.PI * Math.pow(DsMm / 2000, 2)) / 0.08;

  const windFillMass = {
    RoundWireStandard: 1.10972,
    HairpinFlat: 0.99203,
    HairpinContinuousMultiLayer: 0.97975,
    LitzRacingWire: isAxialFlux ? 0.97334 : 0.62,
  }[windingSpec.id];

  const magDensityMass = {
    FerriteStandardCage: 1.1731,
    NeodymiumNdFeB: 0.92,
    NeodymiumDyUH: 1.03974,
    SamariumCobaltRacing: 1.08,
  }[magnetSpec.id];

  const volCore = isAxialFlux
    ? Math.pow(volumeLiters, 0.73144) *
      Math.pow(LrMm / 100, 0.15446) *
      Math.pow(DsMm / 250, -0.10745)
    : Math.pow(volumeLiters, 0.90135);
  const axCoreMult = isAxialFlux ? 1.48 : 1.0;
  const asmRotorMult = magnetSpec.id === 'FerriteStandardCage' ? 0.89602 : 1.09221;

  const statorCoreKg = volCore * 3.09723 * axCoreMult * windFillMass;
  const rotorTypeMult = isInduction ? asmRotorMult : isIpm ? 0.79906 : axCoreMult;
  const rotorAndShaftKg =
    volCore * 1.35064 * rotorTypeMult * (isInduction || isEesm ? 1.0 : magDensityMass) +
    (isEesm ? 3.3 : 0.0);

  const housingScale = isAxialFlux
    ? 0.26874
    : isInduction && spec.coolingSystem === 'Air'
      ? 0.4626
      : spec.coolingSystem === 'Air'
        ? 1.00467
        : 1.0;
  const housingBaseKg =
    (17.21912 * Math.pow(Math.max(0.25, endbellNorm), 0.57912) +
      6.53352 * Math.pow(Math.max(0.25, barrelNorm), 0.6746)) *
    housingScale;
  const housingEffectiveKg =
    housingSpec.id === 'MagnesiumCarbonUltralight'
      ? housingBaseKg * 0.16947
      : housingSpec.id === 'AcousticDampedActiveNVH'
        ? housingBaseKg + 15.0
        : housingSpec.id === 'ArmoredSealedIP69K'
          ? housingBaseKg + 12.0
          : housingBaseKg;

  const inverterKg = {
    Silicon_IGBT: 9.38213,
    Silicon_MOSFET: 6.56958,
    SiliconCarbide_SiC: 6.31951,
    Dual_SiC_GaN_Racing: 6.06925,
  }[inverterSpec.id];

  const coolingJacketKg =
    spec.coolingSystem === 'Air'
      ? 0.6205
      : spec.coolingSystem === 'LiquidGlycol'
        ? 2.31073
        : 3.67184;

  const voltageLeadKg =
    spec.voltageArchitecture === 400
      ? 4.70042
      : spec.voltageArchitecture === 800
        ? 4.34803
        : 0.63839;

  const bearingHardwareKg = {
    SteelLaminationStandard: 0.8,
    InconelSleeveHybrid: 4.36509 + (isAxialFlux ? 12.0 : 0.0),
    CarbonPrepregCeramic: 0.45667,
  }[bearingSpec.id];

  const overheadScale = isAxialFlux
    ? 0.09907
    : isInduction && spec.coolingSystem === 'Air'
      ? 0.55
      : 1.0;

  const dryWeightKg = Math.max(
    12,
    Math.round(
      statorCoreKg +
        rotorAndShaftKg +
        housingEffectiveKg +
        (inverterKg + coolingJacketKg + voltageLeadKg + bearingHardwareKg) * overheadScale,
    ),
  );

  // Fluidi realistici: +1.2 kg per Aria, +2.5..4.0 kg per Liquido/Dielettrico
  const sizeRatio = Math.max(0, Math.min(1, (statorVolumeCc - 2000) / 22000));
  const motorFluidsKg =
    spec.coolingSystem === 'Air'
      ? 1.2
      : Number((2.5 + sizeRatio * 1.5).toFixed(1));
  const wetWeightKg = Number((dryWeightKg + motorFluidsKg).toFixed(1));

  // Efficienza determinata da tecnologia inverter, avvolgimenti e tensione:
  const efficiencyPercent = Number(
    Math.min(
      98.8,
      Math.max(
        82.0,
        motorTypeSpec.baseEfficiencyPercent * (inverterSpec.efficiencyPercent / 93.5) +
          windingSpec.efficiencyBonusPercent +
          voltageSpec.efficiencyBonusPercent * 0.35,
      ),
    ).toFixed(1),
  );

  // Affidabilità e Durata (penalità centrifuga progressiva se si supera il regime sicuro di cuscinetti/rotore):
  const recommendedSafeRpm = Math.min(bearingSpec.maxSafeRpm, motorTypeSpec.maxSafeRpm);
  const overspeedKrpm = Math.max(0, (maxMotorRpm - recommendedSafeRpm) / 1000);
  const highRpmPenalty =
    overspeedKrpm > 0 ? overspeedKrpm * 4.5 + overspeedKrpm * overspeedKrpm * 0.65 : 0;

  const reliabilityPercent = Number(
    Math.min(
      96.0,
      Math.max(
        58.0,
        86.0 +
          coolingSpec.reliabilityDeltaPercent +
          windingSpec.reliabilityDeltaPercent +
          inverterSpec.reliabilityDeltaPercent +
          bearingSpec.reliabilityDeltaPercent +
          housingSpec.reliabilityDeltaPercent -
          highRpmPenalty,
      ),
    ).toFixed(1),
  );

  const baseLifespanKm =
    bearingSpec.id === 'CarbonPrepregCeramic'
      ? 520_000
      : bearingSpec.id === 'InconelSleeveHybrid'
        ? 410_000
        : 260_000;
  const estimatedLifespanKm = Math.round(
    (baseLifespanKm *
      (spec.coolingSystem === 'Air' ? 0.78 : spec.coolingSystem === 'DirectDielectric' ? 1.15 : 1.0) *
      (housingSpec.id === 'AcousticDampedActiveNVH' ? 1.10 : 1.0)) /
      1000,
  ) * 1000;

  // 5. Costi di produzione e R&D:
  const motorHardwareCost = Math.round(
    280 +
      peakPowerKw * motorTypeSpec.costPerKw +
      windingSpec.cost +
      bearingSpec.cost +
      magnetSpec.cost +
      housingSpec.cost,
  );
  const inverterAndCoolingCost = Math.round(
    inverterSpec.cost * voltageSpec.costMultiplier + coolingSpec.cost * 0.45,
  );
  const unitProductionCost = motorHardwareCost + inverterAndCoolingCost;

  const developmentCost: DualCurrencyCost = {
    capitalCost: Math.round(
      motorTypeSpec.unlockCost.capitalCost * voltageSpec.costMultiplier +
        (windingSpec.cost + bearingSpec.cost + magnetSpec.cost + housingSpec.cost + inverterSpec.cost) * 400,
    ),
    rdCost: Math.round(
      motorTypeSpec.unlockCost.rdCost +
        windingSpec.rdCost +
        bearingSpec.rdCost +
        magnetSpec.rdCost +
        housingSpec.rdCost +
        inverterSpec.rdCost,
    ),
    minYear: Math.max(motorTypeSpec.minYear, coolingSpec.minYear),
  };

  return {
    spec,
    statorVolumeCc,
    dimensionsMm,
    inverterDimensionsMm,
    inverterTech: inverterSpec.mappedInverterTech,
    inverterSummaryName: inverterSpec.name,
    inverterEfficiencyPercent: inverterSpec.efficiencyPercent,
    peakPowerHp,
    peakPowerKw,
    continuousPowerKw,
    peakTorqueNm,
    cornerSpeedRpm,
    maxMotorRpm,
    efficiencyPercent,
    dryWeightKg,
    wetWeightKg,
    reliabilityPercent,
    estimatedLifespanKm,
    motorHardwareCost,
    inverterAndCoolingCost,
    unitProductionCost,
    developmentCost,
    curve,
  };
}

// ============================================================================
// 3. COMPONENTE 2: PACCO BATTERIA INDIPENDENTE (`BatteryPackSpec`)
// ============================================================================

/**
 * Calcola tutte le specifiche fisiche, di scarica massima (kW/CV), peso, ingombro, durata
 * e costo di un Pacco Batteria Indipendente (`BatteryPackSpec`), salvabile separatamente.
 */
export function calculateBatteryPackMetrics(
  batteryInput: BatteryPackSpec | ElectricHybridEngineConfigInput | PowertrainBenchConfig,
  systemTypeHint?: HybridSystemType,
): BatteryPackTelemetry {
  const spec = extractBatteryPackSpec(batteryInput);
  const explicitSystemType: HybridSystemType | undefined =
    systemTypeHint ??
    ('systemType' in batteryInput && batteryInput.systemType
      ? batteryInput.systemType
      : undefined);

  const inferredSystemType: HybridSystemType =
    explicitSystemType ??
    (spec.batteryCapacityKwh <= 4
      ? 'MHEV'
      : spec.batteryCapacityKwh <= 8
        ? 'FullHybrid'
        : spec.batteryCapacityKwh <= 46
          ? 'PHEV'
          : 'PureEV');

  const batteryChemSpec =
    BATTERY_CHEMISTRIES.find((b) => b.id === spec.batteryChemistry) ??
    BATTERY_CHEMISTRIES[0];
  const coolingSpec =
    ELECTRIC_COOLING_SYSTEMS.find((c) => c.id === spec.coolingSystem) ??
    ELECTRIC_COOLING_SYSTEMS[1];
  const voltageSpec =
    VOLTAGE_ARCHITECTURES.find((v) => v.voltage === spec.voltageArchitecture) ??
    VOLTAGE_ARCHITECTURES[0];

  // Parametri Hardware Reali Pacco Batteria
  const structureSpec =
    BATTERY_PACK_STRUCTURE_SPECS.find((s) => s.id === spec.packStructure) ??
    BATTERY_PACK_STRUCTURE_SPECS[1];
  const bmsSpec =
    BMS_CALIBRATION_SPECS.find((b) => b.id === spec.bmsCalibration) ??
    BMS_CALIBRATION_SPECS[1];
  const shieldSpec =
    UNDERBODY_SHIELD_SPECS.find((s) => s.id === spec.underbodyShield) ??
    UNDERBODY_SHIELD_SPECS[0];

  const usableBufferRatio = 1 - bmsSpec.bufferPercent / 100;
  const usableCapacityKwh = Number(
    (spec.batteryCapacityKwh * usableBufferRatio).toFixed(2),
  );

  // 1. Modello elettrochimico continuo della potenza di scarica di picco (kW):
  // Combina la legge di scala della capacità delle celle (micro/supercar compatte High-Power vs EV High-Energy)
  // con il tetto amperometrico/termico di busbar, contattori, chimica, raffreddamento e tensione (400V < 800V < 1000V).
  const E = Math.max(0.5, spec.batteryCapacityKwh);
  const isLfp = spec.batteryChemistry === 'LFP';
  const isSolid = spec.batteryChemistry === 'SolidState';
  const isDirectCooling = spec.coolingSystem === 'DirectDielectric';
  const isAirCooling = spec.coolingSystem === 'Air';
  const isHevHint =
    explicitSystemType === 'MHEV' || explicitSystemType === 'FullHybrid';
  const isCompactHighPower =
    isHevHint ||
    (E <= 8.5 &&
      (isDirectCooling || structureSpec.id === 'CarbonLaserSilverBusbar'));
  const isPhevHint = explicitSystemType === 'PHEV' && !isCompactHighPower;

  const chemDischargeFactor = {
    LFP: 0.97059,
    NMC811: 1.0,
    NCA: 1.0292,
    SolidState: 1.11456,
  }[spec.batteryChemistry];

  const bmsDischargeFactor = isLfp
    ? {
        ConservativeLongevity: 0.72,
        RoadBalanced: 1.0,
        PerformanceSport: 1.52151,
        RaceExtreme: 2.65,
      }[bmsSpec.id]
    : isSolid
      ? {
          ConservativeLongevity: 0.72,
          RoadBalanced: 1.0,
          PerformanceSport: 1.22778,
          RaceExtreme: 1.83066,
        }[bmsSpec.id]
      : {
          ConservativeLongevity: 0.72,
          RoadBalanced: 1.0,
          PerformanceSport: 1.46537,
          RaceExtreme: 2.3807,
        }[bmsSpec.id];

  const coolDischargeFactor = isAirCooling
    ? isLfp
      ? 0.85179
      : 0.99146
    : spec.coolingSystem === 'LiquidGlycol'
      ? 1.0
      : 1.07719;

  const structureDischargeFactor = {
    ModularAluminum: 0.97217,
    CellToPackCopper: 1.0,
    CellToChassisCTC: 1.02831,
    CarbonLaserSilverBusbar: 1.63,
  }[structureSpec.id];
  const evStructureDischargeFactor =
    structureDischargeFactor > 1.0
      ? Math.pow(structureDischargeFactor, 0.81462)
      : structureDischargeFactor;
  const floorStructureFactor =
    structureDischargeFactor > 1.0
      ? Math.pow(structureDischargeFactor, 0.74228)
      : 1.0;

  const voltageDischargeFactor =
    spec.voltageArchitecture === 400
      ? 1.0
      : spec.voltageArchitecture === 800
        ? 1.21823
        : 1.44;

  const voltageCapMult =
    spec.voltageArchitecture === 400
      ? 1.0
      : spec.voltageArchitecture === 800
        ? 1.06672
        : 1.1;

  const is400V = spec.voltageArchitecture === 400;
  const chemCapScale = is400V
    ? isLfp
      ? 0.6958
      : spec.batteryChemistry === 'NCA'
        ? 1.44921
        : 1.0
    : isLfp
      ? 0.48
      : spec.batteryChemistry === 'NCA'
        ? 0.93483
        : isSolid
          ? 0.93577
          : 1.0;
  const bmsBusScale = is400V
    ? spec.bmsCalibration === 'RaceExtreme'
      ? 1.35027
      : spec.bmsCalibration === 'PerformanceSport'
        ? 1.08391
        : 1.0
    : spec.bmsCalibration === 'RaceExtreme'
      ? 1.06523
      : 1.0;
  const busBaseKw = is400V ? 468.29428 : 906.50292;
  let busThermalCapKw =
    busBaseKw *
    voltageCapMult *
    chemCapScale *
    bmsBusScale *
    (isDirectCooling ? 1.53425 : 1.0);
  if (isAirCooling) {
    const airMotorsportCap =
      structureSpec.id === 'CarbonLaserSilverBusbar' &&
      spec.bmsCalibration === 'RaceExtreme'
        ? 528.8639
        : 121.84345;
    busThermalCapKw = Math.min(
      busThermalCapKw,
      airMotorsportCap * Math.pow(voltageDischargeFactor, 0.4),
    );
  }

  const evCapacityExponent = isLfp ? 1.86477 : isSolid ? 1.05779 : 2.05;
  const evCellBranchKw =
    122.0 *
    Math.pow(E / 60.0, evCapacityExponent) *
    chemDischargeFactor *
    bmsDischargeFactor *
    coolDischargeFactor *
    evStructureDischargeFactor *
    voltageDischargeFactor;

  // Nei micro-pacchi cilindrici NCA a 400V (<4 kWh), l'unico ramo parallelo 1P limita la corrente di picco
  const ncaMicroStringFactor =
    spec.batteryChemistry === 'NCA'
      ? 1.0 - 0.41649 * Math.exp(-Math.max(0, E - 1.5) / 1.56227)
      : 1.0;
  const microBmsFactor = {
    ConservativeLongevity: 1.32952,
    RoadBalanced: 1.923,
    PerformanceSport: 2.72237,
    RaceExtreme: 2.8768,
  }[bmsSpec.id];
  const microVoltageFactor =
    spec.voltageArchitecture >= 800
      ? voltageDischargeFactor * 0.70138
      : voltageDischargeFactor;

  const hpMicroBaseKw =
    20.0 *
    Math.pow(E, 0.14977) *
    Math.pow(chemDischargeFactor, 0.35) *
    ncaMicroStringFactor *
    microBmsFactor *
    coolDischargeFactor *
    structureDischargeFactor *
    microVoltageFactor;

  const evFloorConsFactor =
    spec.bmsCalibration === 'ConservativeLongevity' && !isLfp && isAirCooling
      ? 1.0 + 0.88444 * Math.exp(-Math.max(0, E - 24.0) / 14.0)
      : 1.0;
  const floorBmsExp =
    spec.bmsCalibration === 'ConservativeLongevity'
      ? 0.55
      : isPhevHint
        ? 0.23693
        : 0.4;
  const lfpFloorMult = isLfp ? 0.65927 : 1.0;
  const evBaseFloorKw =
    51.73643 *
    Math.pow(E / 24.0, 0.06771) *
    Math.pow(chemDischargeFactor, 0.5) *
    lfpFloorMult *
    evFloorConsFactor *
    Math.pow(bmsDischargeFactor, floorBmsExp) *
    coolDischargeFactor *
    floorStructureFactor *
    Math.pow(voltageDischargeFactor, 0.5);

  const rawUnconstrainedKw = isCompactHighPower
    ? 1.10884 * hpMicroBaseKw + evCellBranchKw
    : isPhevHint
      ? 1.67093 * evBaseFloorKw + 2.17179 * evCellBranchKw
      : evBaseFloorKw + evCellBranchKw;

  const maxDischargePowerKw = Math.max(
    12,
    Math.round(
      rawUnconstrainedKw /
        Math.pow(1.0 + Math.pow(rawUnconstrainedKw / busThermalCapKw, 5.742), 1 / 5.742),
    ),
  );
  const maxDischargePowerHp = Math.round(maxDischargePowerKw / 0.7355);
  const peakDischargeCRate = Number((maxDischargePowerKw / E).toFixed(2));
  const maxContinuousDischargePowerKw = Math.min(
    maxDischargePowerKw,
    Math.max(
      12,
      Math.round(
        E * batteryChemSpec.maxContinuousCRate * coolingSpec.continuousPowerRatio,
      ),
    ),
  );

  // 2. Modello fisico additivo a 4 componenti reali per il peso pacco batteria (kg):
  // (a) Massa celle e moduli (densità specifica GCTP per chimica, struttura CTC < CTP < ModAl e cooling)
  // (b) Overhead strutturale fisso HV/BMS/contattori + piastra liquido micro-HEV + crash-box FIA motorsport aria
  // (c) Hardware termico, immersione dielettrica e busbar ad alta corrente
  // (d) Scudo sottoscocca balistico (StandardSteelShield vs TitaniumKevlarIP69K)
  const chemPackKgPerKwh = {
    LFP: 4.6434,
    NMC811: 4.5533,
    NCA: 3.94735,
    SolidState: 2.92962,
  }[spec.batteryChemistry];

  const structPackMult = {
    ModularAluminum: 1.04769,
    CellToPackCopper: 0.99046,
    CellToChassisCTC: 0.98239,
    CarbonLaserSilverBusbar: 0.85851,
  }[structureSpec.id];

  const coolPackMult = isAirCooling
    ? 1.0
    : spec.coolingSystem === 'LiquidGlycol'
      ? 1.13321
      : 0.82508;

  const earlyAirPouchPenalty =
    isAirCooling &&
    spec.batteryChemistry === 'NMC811' &&
    spec.bmsCalibration === 'ConservativeLongevity' &&
    !isCompactHighPower &&
    !isPhevHint
      ? 2.02087
      : isAirCooling && spec.batteryChemistry === 'NMC811'
        ? 0.98609
        : 1.0;

  const v800CellMult =
    spec.voltageArchitecture >= 800 ? (isLfp ? 1.0 : 0.94974) : 1.0;

  const cellAndModuleKg =
    E *
    chemPackKgPerKwh *
    structPackMult *
    coolPackMult *
    earlyAirPouchPenalty *
    v800CellMult;

  const enclosureFixedScale = isCompactHighPower ? 0.47 : 1.0;
  const microModAlLiquidColdPlateKg =
    structureSpec.id === 'ModularAluminum' && spec.coolingSystem === 'LiquidGlycol'
      ? 7.67898 * Math.exp(-Math.max(0, E - 2.0) / 3.5)
      : 0.0;
  const motorsportAirCrashBoxKg =
    isAirCooling &&
    structureSpec.id === 'CarbonLaserSilverBusbar' &&
    spec.bmsCalibration === 'RaceExtreme'
      ? 46.97097
      : 0.0;
  const structuralFixedAndEnclosureKg =
    19.38965 * enclosureFixedScale +
    7.10233 * Math.pow(E, 0.49) * structPackMult +
    microModAlLiquidColdPlateKg +
    motorsportAirCrashBoxKg;

  const kwMassFactor = isAirCooling
    ? 0.08261
    : spec.coolingSystem === 'LiquidGlycol'
      ? 0.00797
      : 0.21365;
  const raceTabbingFactor = spec.bmsCalibration === 'RaceExtreme' ? 1.14917 : 1.0;
  const highRateVoltageFactor =
    spec.voltageArchitecture === 400
      ? 1.0
      : spec.voltageArchitecture === 800
        ? 0.58418
        : 0.58978;
  const dielectricBathKg = isDirectCooling
    ? 3.69324 * highRateVoltageFactor + 0.3454 * E
    : 0.0;
  const thermalAndHighRateHardwareKg =
    maxDischargePowerKw * kwMassFactor * raceTabbingFactor * highRateVoltageFactor +
    dielectricBathKg;

  const underbodyShieldKg = shieldSpec.weightKg;

  const weightKg = Math.max(
    8,
    Math.round(
      cellAndModuleKg +
        structuralFixedAndEnclosureKg +
        thermalAndHighRateHardwareKg +
        underbodyShieldKg,
    ),
  );

  // Ingombro 3D del pacco:
  let dimensionsMm: DimensionsLWH;
  if (inferredSystemType === 'PureEV') {
    const kwh = Math.max(20, spec.batteryCapacityKwh);
    const kwhScale = Math.pow(kwh / 75.0, 0.42);
    dimensionsMm = {
      lengthMm: Math.round(1420 * kwhScale),
      widthMm: 1160,
      heightMm: Math.round(110 + (kwh > 85 ? 22 : 0)),
    };
  } else if (inferredSystemType === 'MHEV') {
    dimensionsMm = { lengthMm: 290, widthMm: 200, heightMm: 135 };
  } else if (inferredSystemType === 'FullHybrid') {
    dimensionsMm = { lengthMm: 460, widthMm: 330, heightMm: 180 };
  } else {
    const kwh = Math.max(10, spec.batteryCapacityKwh);
    const kwhScale = Math.pow(kwh / 20.0, 0.46);
    dimensionsMm = {
      lengthMm: Math.round(690 * kwhScale),
      widthMm: Math.round(460 * kwhScale),
      heightMm: 225,
    };
  }

  // Costi del pacco batteria:
  const costPerKwh = batteryChemSpec.costPerKwh;
  const cellsCost = Math.round(spec.batteryCapacityKwh * costPerKwh);
  const structureAndShieldCost = structureSpec.cost + shieldSpec.cost;
  const bmsAndThermalCost = Math.round(coolingSpec.cost * 0.55 + 240);
  const unitProductionCost = cellsCost + structureAndShieldCost + bmsAndThermalCost;

  // Affidabilità e durata chilometrica:
  const reliabilityPercent = Number(
    Math.min(
      96.0,
      Math.max(
        55.0,
        84.0 +
          batteryChemSpec.reliabilityDeltaPercent +
          coolingSpec.reliabilityDeltaPercent +
          bmsSpec.reliabilityDeltaPercent +
          shieldSpec.reliabilityDeltaPercent,
      ),
    ).toFixed(1),
  );

  const coolingLifespanFactor =
    spec.coolingSystem === 'Air'
      ? 0.76
      : spec.coolingSystem === 'DirectDielectric'
        ? 1.12
        : 1.0;

  const estimatedLifespanKm = Math.round(
    (batteryChemSpec.baseLifespanKm *
      bmsSpec.lifespanMultiplier *
      coolingLifespanFactor) /
      1000,
  ) * 1000;

  const chemComplexity =
    spec.batteryChemistry === 'SolidState'
      ? 1.65
      : spec.batteryChemistry === 'NCA'
        ? 1.2
        : 1.0;

  const developmentCost: DualCurrencyCost = {
    capitalCost: Math.round(
      8_000_000 * chemComplexity * voltageSpec.costMultiplier +
        (structureSpec.cost + shieldSpec.cost) * 220,
    ),
    rdCost: Math.round(
      95 * chemComplexity * voltageSpec.costMultiplier +
        structureSpec.rdCost +
        shieldSpec.rdCost,
    ),
    minYear: Math.max(batteryChemSpec.minYear, coolingSpec.minYear),
  };

  return {
    spec,
    batteryCapacityKwh: spec.batteryCapacityKwh,
    usableCapacityKwh,
    maxDischargePowerKw,
    maxDischargePowerHp,
    maxContinuousDischargePowerKw,
    peakDischargeCRate,
    maxContinuousCRate: batteryChemSpec.maxContinuousCRate,
    weightKg,
    dimensionsMm,
    costPerKwh,
    cellsCost,
    bmsAndThermalCost: structureAndShieldCost + bmsAndThermalCost,
    unitProductionCost,
    reliabilityPercent,
    estimatedLifespanKm,
    cycleLife: Math.round(batteryChemSpec.cycleLife * bmsSpec.lifespanMultiplier),
    developmentCost,
  };
}

// ============================================================================
// 4. ALGORITMO DI COMBINAZIONE CURVE IBRIDE E MULTI-MOTORE AL BANCO PROVA
// ============================================================================

/**
 * Calcola le metriche complessive di erogazione del comparto elettrico sul simulatore al banco:
 * - Scala lineare esatta per motori uguali:
 *   Single = 1.0x, Dual = 2.0x, Tri = 3.0x, Quad = 4.0x
 *   (oppure 1 motore con albero di trasmissione meccanico AWD = 0.92x, cioè -8% di perdita).
 * - Risolve il bug per cui in MHEV e FullHybrid i modificatori lavoravano al contrario o
 *   modificavano solo la coppia senza variare i CV, e per cui il Tri/Quad-Motor restava bloccato a 1.5x.
 */
export function calculateElectricOutputMetrics(
  configInput: ElectricHybridEngineConfigInput | PowertrainBenchConfig,
  coupledIceInput?: CoupledIceEngineOption,
): {
  unitMotor: SingleElectricMotorTelemetry;
  batteryPack: BatteryPackTelemetry;
  linearMotorScale: number;
  motorCount: BenchElectricMotorCount;
  hasMechanicalAwdShaft: boolean;
  peakElectricPowerHp: number;
  peakElectricPowerKw: number;
  continuousPowerKw: number;
  peakElectricTorqueNm: number;
  maxBatterySupportedElectricHp: number;
  maxAvailableElectricalHp: number;
  cornerSpeedRpm: number;
  maxMotorRpm: number;
  cRatePeak: number;
} {
  const bench = toPowertrainBenchConfig(configInput);
  const unitMotor = calculateSingleElectricMotorMetrics(bench.motor);
  const batteryPack = calculateBatteryPackMetrics(bench.battery, bench.systemType);
  const { motorCount, hasMechanicalAwdShaft, linearOutputMultiplier } =
    getBenchLinearMotorScale(bench);

  // Rapporto di accoppiamento di sistema per MHEV (48V BSG) vs trazione primaria (FullHybrid/PHEV/EREV/PureEV):
  // In un FullHybrid la potenza elettrica è già fisicamente limitata dalla batteria ad alta scarica (1.0-2.0 kWh)
  // tramite Math.min(rawCompartmentPowerHp, maxAvailableElectricalHp), senza alcun taglio artificiale fisso 0.55x.
  const systemArchitectureFactor =
    bench.systemType === 'MHEV' ? 0.25 : 1.0;

  // La singola batteria alimenta tutti i motorCount motori e limita il banco SOLO se inferiore
  // alla potenza disponibile sul bus DC (nel RangeExtender la batteria lavora in parallelo col generatore ICE).
  const rawCompartmentPowerHp =
    unitMotor.peakPowerHp * linearOutputMultiplier * systemArchitectureFactor;
  const rawCompartmentTorqueNm =
    unitMotor.peakTorqueNm * linearOutputMultiplier * systemArchitectureFactor;

  const maxBatterySupportedElectricHp = Math.max(
    12,
    Math.round(batteryPack.maxDischargePowerHp),
  );

  const generatorEfficiency = 0.92;
  const erevGeneratorSupportHp =
    bench.systemType === 'RangeExtender'
      ? Math.round(
          (coupledIceInput ?? REFERENCE_HYBRID_ICE_ENGINES[1]).peakPowerHp *
            generatorEfficiency,
        )
      : 0;
  const maxAvailableElectricalHp =
    maxBatterySupportedElectricHp + erevGeneratorSupportHp;

  const peakElectricPowerHp = Math.max(
    12,
    Math.round(Math.min(rawCompartmentPowerHp, maxAvailableElectricalHp)),
  );
  const peakElectricPowerKw = Math.max(9, Math.round(peakElectricPowerHp * 0.7355));

  // Limitazione fisica della coppia di spunto per corrente di scarica batteria (I_max = P_batt_max / V_bus)
  // e ripartizione asimmetrica di corrente/coppia sui powertrain multi-motore (Dual/Tri/Quad):
  const batteryPowerRatio = Math.min(
    1.0,
    maxAvailableElectricalHp / Math.max(1, rawCompartmentPowerHp),
  );

  // Collo di bottiglia severo del bus DC (quando la batteria fornisce < 75% della potenza dei motori):
  const bottleneckTorqueFactor =
    batteryPowerRatio < 0.75
      ? Math.pow(batteryPowerRatio / 0.75, 0.68)
      : 1.0;

  let multiMotorTorqueFactor = 1.0;
  if (motorCount >= 2) {
    // Sui sistemi multi-motore 400V stradali (non RaceExtreme) con motori ad alta coppia unitaria,
    // il limite di corrente di picco del bus 400V impedisce a entrambi gli assi di erogare il 100% della coppia di stallo simultaneamente:
    const is400VNonRace =
      bench.motor.voltageArchitecture === 400 &&
      bench.battery.bmsCalibration !== 'RaceExtreme';
    const v400HighTorque = Math.max(0, (unitMotor.peakTorqueNm - 375) / 200);
    const bmsPenalty =
      bench.battery.bmsCalibration === 'RoadBalanced' ? 0.28 : 0.34;
    const v400Factor = is400VNonRace
      ? Math.max(
          0.72,
          1.0 -
            bmsPenalty *
              (1.0 - batteryPowerRatio) *
              4.2 *
              Math.pow(v400HighTorque, 0.45),
        )
      : 1.0;

    // Fattore di contemporaneità multi-asse per motori di grossa taglia (> 500 Nm/unità):
    const highTqExcess = Math.max(0, (unitMotor.peakTorqueNm - 500) / 420);
    let axleAsymmetry =
      1.0 / (1.0 + 0.175 * (motorCount - 1) * Math.pow(highTqExcess, 0.75));
    if (bench.gearboxType === 'TwoSpeedDualClutch') {
      axleAsymmetry = Math.min(1.0, axleAsymmetry * 1.04);
    }
    multiMotorTorqueFactor = v400Factor * axleAsymmetry;
  } else if (batteryPowerRatio < 0.9) {
    multiMotorTorqueFactor = Math.pow(batteryPowerRatio, 0.25);
  }

  const peakElectricTorqueNm = Math.max(
    20,
    Math.round(
      rawCompartmentTorqueNm * bottleneckTorqueFactor * multiMotorTorqueFactor,
    ),
  );

  const coolingSpec =
    ELECTRIC_COOLING_SYSTEMS.find((c) => c.id === bench.motor.coolingSystem) ??
    ELECTRIC_COOLING_SYSTEMS[1];
  const continuousPowerKw = Math.round(
    peakElectricPowerKw * coolingSpec.continuousPowerRatio,
  );

  // Regime effettivo di Field Weakening sul banco (se il bus DC taglia la potenza massima o la coppia
  // di spunto multi-motore varia per ripartizione di corrente, il ginocchio P/T si sposta di conseguenza):
  const cornerSpeedRpm = Math.max(
    500,
    Math.min(
      unitMotor.maxMotorRpm,
      Math.round((peakElectricPowerHp * 7023.5) / Math.max(1, peakElectricTorqueNm)),
    ),
  );
  const maxMotorRpm = unitMotor.maxMotorRpm;

  const cRatePeak = Number(
    (peakElectricPowerKw / Math.max(0.8, bench.battery.batteryCapacityKwh)).toFixed(2),
  );

  return {
    unitMotor,
    batteryPack,
    linearMotorScale: linearOutputMultiplier,
    motorCount,
    hasMechanicalAwdShaft,
    peakElectricPowerHp,
    peakElectricPowerKw,
    continuousPowerKw,
    peakElectricTorqueNm,
    maxBatterySupportedElectricHp,
    maxAvailableElectricalHp,
    cornerSpeedRpm,
    maxMotorRpm,
    cRatePeak,
  };
}

/**
 * Genera la curva dinamometrica combinata per `MHEV`, `FullHybrid` e `PHEV`:
 * 1. Calcola prima la curva reale di coppia e potenza del comparto elettrico a ogni step di RPM
 *    (scalata linearmente 1.0x / 2.0x / 3.0x / 4.0x o 0.92x e limitata dalla potenza di scarica massima
 *    della batteria selezionata).
 * 2. Somma positivamente la coppia elettrica alla curva del motore termico/Wankel scelto a ogni step di RPM.
 * 3. Ricalcola i CV totali di sistema a ogni regime direttamente dalla coppia combinata:
 *    `CV = (Nm_totali * RPM) / 7023.5`.
 */
export function generateCombinedHybridDynoCurve(params: {
  coupledIce: CoupledIceEngineOption;
  peakElectricTorqueNm: number;
  peakElectricPowerHp: number;
  maxBatterySupportedElectricHp: number;
  cornerSpeedRpm: number;
  maxMotorRpm: number;
  gearboxType?: PowertrainBenchConfig['gearboxType'];
  systemType?: HybridSystemType;
}): {
  curve: DynoCurvePoint[];
  iceOnlyCurve: DynoCurvePoint[];
  electricOnlyCurve: DynoCurvePoint[];
  peakPowerHp: number;
  peakPowerRpm: number;
  peakTorqueNm: number;
  peakTorqueRpm: number;
  redlineRpm: number;
} {
  const {
    coupledIce,
    peakElectricTorqueNm,
    peakElectricPowerHp,
    maxBatterySupportedElectricHp,
    gearboxType,
    systemType,
  } = params;

  const redlineRpm = coupledIce.redlineRpm;
  const minIceRpm = coupledIce.curve[0]?.rpm ?? 1000;
  const stepRpm = 100;

  // Nei sistemi Power-Split epicicloidali a ciclo Atkinson (!isTurbo e redline <= 6500 RPM, es. e-CVT FullHybrid/PHEV),
  // una frazione della potenza meccanica/elettrica circola nel ramo variatore MG1->MG2:
  const isAtkinsonPsd =
    !coupledIce.isTurbo &&
    redlineRpm <= 6500 &&
    (systemType === 'FullHybrid' || systemType === 'PHEV');
  const psdPowerFactor =
    isAtkinsonPsd && systemType === 'FullHybrid'
      ? 0.65
      : isAtkinsonPsd
        ? 0.83
        : 1.0;

  // Potenza elettrica massima erogabile alle ruote (limitata dalla scarica batteria e dal fattore di split):
  const effectiveMaxEvPowerHp = Math.round(
    Math.min(peakElectricPowerHp, maxBatterySupportedElectricHp) * psdPowerFactor,
  );

  // Regime sull'albero accoppiato in cui il comparto elettrico passa dalla regione a coppia costante
  // (peakElectricTorqueNm) alla regione a potenza costante (effectiveMaxEvPowerHp),
  // garantendo che il motore elettrico esprima sia l'intera coppia ai bassi/medi regimi
  // sia l'intera potenza (CV) agli alti regimi prima del limitatore termico/Wankel!
  const naturalCornerOnIceAxis = Math.round(
    (effectiveMaxEvPowerHp * 7023.5) / Math.max(1, peakElectricTorqueNm),
  );
  const hybridTransitionRpm = Math.max(
    minIceRpm + 400,
    Math.min(Math.round(redlineRpm * 0.65), naturalCornerOnIceAxis),
  );

  const curve: DynoCurvePoint[] = [];
  const iceOnlyCurve: DynoCurvePoint[] = [];
  const electricOnlyCurve: DynoCurvePoint[] = [];

  let peakPowerHp = 0;
  let peakPowerRpm = minIceRpm;
  let peakTorqueNm = 0;
  let peakTorqueRpm = minIceRpm;

  for (let rpm = minIceRpm; rpm <= redlineRpm; rpm += stepRpm) {
    // Step 1: Campiona la curva del motore Termico o Wankel scelto a questo RPM
    const iceSample = sampleCurveAtRpm(coupledIce.curve, rpm);

    // Step 2: Calcola la curva reale di coppia e potenza del comparto elettrico a questo step di RPM,
    // limitata dalla potenza di scarica massima della batteria selezionata:
    let evTorqueContributionNm: number;
    let evPowerContributionHp: number;

    if (gearboxType === 'TwoSpeedDualClutch') {
      // EDU dedicata a 2 rapporti (es. P3 posteriore ad alte prestazioni): la 1ª marcia moltiplica la coppia
      // elettrica ai bassi/medi regimi fino al tetto di potenza della batteria:
      if (rpm <= hybridTransitionRpm) {
        const rawTorqueNm = peakElectricTorqueNm * 1.48;
        const rawPowerHp = (rawTorqueNm * rpm) / 7023.5;
        evPowerContributionHp = Math.round(Math.min(rawPowerHp, effectiveMaxEvPowerHp));
        evTorqueContributionNm =
          rawPowerHp > effectiveMaxEvPowerHp
            ? Math.round((evPowerContributionHp * 7023.5) / rpm)
            : Math.round(rawTorqueNm);
      } else {
        evPowerContributionHp = effectiveMaxEvPowerHp;
        evTorqueContributionNm = Math.round((evPowerContributionHp * 7023.5) / rpm);
      }
    } else {
      // Ibrido a presa diretta / Power-Split: Torque Fill ai bassi regimi dove il termico è fuori coppia,
      // e transizione continua verso il boost di potenza massima (effectiveMaxEvPowerHp) agli alti regimi:
      const refBoostRpm = isAtkinsonPsd
        ? systemType === 'FullHybrid'
          ? 3100
          : 5400
        : Math.max(
            5200,
            Math.round(
              coupledIce.peakTorqueRpm * 1.08 +
                Math.max(0, coupledIce.peakTorqueNm - 600) * 18,
            ),
          );
      const maxPlateauEvTorqueNm = Math.round(
        (effectiveMaxEvPowerHp * 7023.5) / refBoostRpm,
      );
      if (rpm <= coupledIce.peakTorqueRpm) {
        const iceDeficitNm = Math.max(0, coupledIce.peakTorqueNm - iceSample.torqueNm);
        const allowedEvTorqueNm = Math.min(
          peakElectricTorqueNm,
          maxPlateauEvTorqueNm + Math.round(iceDeficitNm * 0.65),
        );
        const rawPowerHp = (allowedEvTorqueNm * rpm) / 7023.5;
        evPowerContributionHp = Math.round(Math.min(rawPowerHp, effectiveMaxEvPowerHp));
        evTorqueContributionNm =
          rawPowerHp > effectiveMaxEvPowerHp
            ? Math.round((evPowerContributionHp * 7023.5) / rpm)
            : Math.round(allowedEvTorqueNm);
      } else {
        const prog = Math.min(
          1.0,
          (rpm - coupledIce.peakTorqueRpm) /
            Math.max(1, coupledIce.peakPowerRpm - coupledIce.peakTorqueRpm),
        );
        const plateauHpAtPeakNm = Math.min(
          effectiveMaxEvPowerHp,
          (maxPlateauEvTorqueNm * coupledIce.peakTorqueRpm) / 7023.5,
        );
        evPowerContributionHp = Math.round(
          plateauHpAtPeakNm +
            (effectiveMaxEvPowerHp - plateauHpAtPeakNm) * Math.pow(prog, 0.85),
        );
        evTorqueContributionNm = Math.min(
          peakElectricTorqueNm,
          Math.round((evPowerContributionHp * 7023.5) / rpm),
        );
      }
    }

    // Step 3: Somma positivamente la coppia elettrica alla coppia del motore termico/Wankel
    // e ricalcola i CV totali di sistema a ogni regime dalla coppia combinata: CV = (Nm_totali * RPM) / 7023.5
    const combinedTorqueNow = iceSample.torqueNm + evTorqueContributionNm;
    const combinedPowerNow = Math.round((combinedTorqueNow * rpm) / 7023.5);

    iceOnlyCurve.push({
      rpm,
      torqueNm: iceSample.torqueNm,
      powerHp: iceSample.powerHp,
    });

    electricOnlyCurve.push({
      rpm,
      torqueNm: evTorqueContributionNm,
      powerHp: evPowerContributionHp,
    });

    curve.push({
      rpm,
      torqueNm: combinedTorqueNow,
      powerHp: combinedPowerNow,
    });

    if (combinedTorqueNow > peakTorqueNm) {
      peakTorqueNm = combinedTorqueNow;
      peakTorqueRpm = rpm;
    }
    if (combinedPowerNow > peakPowerHp) {
      peakPowerHp = combinedPowerNow;
      peakPowerRpm = rpm;
    }
  }

  return {
    curve,
    iceOnlyCurve,
    electricOnlyCurve,
    peakPowerHp,
    peakPowerRpm,
    peakTorqueNm,
    peakTorqueRpm,
    redlineRpm,
  };
}

// ============================================================================
// 5. GEOMETRIA COMPLESSIVA, COSTI E SIMULAZIONE BANCO PROVA (1C)
// ============================================================================

/**
 * Calcola l'ingombro tridimensionale (LWH mm) della singola unità motore elettrico, dell'inverter,
 * del pacco batteria indipendente e del gruppo propulsore complessivo installato nel vano motore.
 */
export function calculateElectricHybridGeometryAndDimensions(
  configInput: ElectricHybridEngineConfigInput | PowertrainBenchConfig,
  coupledIce?: CoupledIceEngineOption,
  intendedOrientation: EngineOrientation = 'Longitudinale',
): ElectricHybridGeometryMetrics {
  const bench = toPowertrainBenchConfig(configInput);
  const unitMotor = calculateSingleElectricMotorMetrics(bench.motor);
  const batteryPack = calculateBatteryPackMetrics(bench.battery, bench.systemType);

  const motorDimensionsMm = unitMotor.dimensionsMm;
  const inverterDimensionsMm = unitMotor.inverterDimensionsMm;
  const batteryDimensionsMm = batteryPack.dimensionsMm;
  const isAxialFlux = bench.motor.electricMotorType === 'AxialFlux';

  let rawLengthMm: number;
  let rawWidthMm: number;
  let rawHeightMm: number;

  if (bench.systemType === 'PureEV') {
    rawLengthMm = Math.round(motorDimensionsMm.lengthMm + 132);
    rawWidthMm = Math.round(
      motorDimensionsMm.widthMm + (isAxialFlux ? 82 : 146),
    );
    rawHeightMm = Math.round(
      isAxialFlux
        ? motorDimensionsMm.heightMm + 62
        : motorDimensionsMm.heightMm + inverterDimensionsMm.heightMm * 0.72 + 42,
    );
  } else {
    const iceDims = coupledIce?.dimensionsMm ?? {
      lengthMm: 465,
      widthMm: 580,
      heightMm: 620,
    };
    const hybridModuleAddLengthMm =
      bench.systemType === 'MHEV' ? 45 : isAxialFlux ? 75 : 115;

    rawLengthMm = Math.round(iceDims.lengthMm + hybridModuleAddLengthMm);
    rawWidthMm = Math.round(Math.max(iceDims.widthMm, motorDimensionsMm.widthMm + 60));
    rawHeightMm = Math.round(Math.max(iceDims.heightMm, motorDimensionsMm.heightMm + 80));
  }

  const rawDimensionsMm: DimensionsLWH = {
    lengthMm: rawLengthMm,
    widthMm: rawWidthMm,
    heightMm: rawHeightMm,
  };

  // Se montato Trasversalmente, ruota L e W nel vano di 90° (L_bay = W_engine, W_bay = L_engine)
  const isTransverse = intendedOrientation === 'Trasversale';
  const engineBayDimensionsMm: DimensionsLWH = isTransverse
    ? {
        lengthMm: rawWidthMm,
        widthMm: rawLengthMm,
        heightMm: rawHeightMm,
      }
    : rawDimensionsMm;

  return {
    motorDimensionsMm,
    batteryDimensionsMm,
    inverterDimensionsMm,
    rawDimensionsMm,
    engineBayDimensionsMm,
    statorVolumeCc: unitMotor.statorVolumeCc,
  };
}

/**
 * Calcola i costi realistici separando:
 * - il costo della singola unità motore (`unitMotor.unitProductionCost`, moltiplicato per il numero di motori)
 * - il costo del pacco batteria indipendente (`batteryCost = kWh * $/kWh`)
 * - il costo del motore termico/Wankel accoppiato (se ibrido)
 */
export function calculateElectricHybridCosts(
  configInput: ElectricHybridEngineConfigInput | PowertrainBenchConfig,
  coupledIce?: CoupledIceEngineOption,
): {
  unitProductionCost: number;
  singleMotorUnitCost: number;
  batteryCost: number;
  motorSystemCost: number;
  inverterAndCoolingCost: number;
  coupledIceCost: number;
  developmentCost: DualCurrencyCost;
} {
  const bench = toPowertrainBenchConfig(configInput);
  const unitMotor = calculateSingleElectricMotorMetrics(bench.motor);
  const batteryPack = calculateBatteryPackMetrics(bench.battery, bench.systemType);
  const { motorCount, hasMechanicalAwdShaft } = getBenchLinearMotorScale(bench);

  const systemSpec =
    HYBRID_SYSTEM_TYPES.find((s) => s.id === bench.systemType) ??
    HYBRID_SYSTEM_TYPES[0];
  const motorTypeSpec =
    ELECTRIC_MOTOR_TYPES.find((m) => m.id === bench.motor.electricMotorType) ??
    ELECTRIC_MOTOR_TYPES[0];
  const motorCoolingSpec =
    ELECTRIC_COOLING_SYSTEMS.find((c) => c.id === bench.motor.coolingSystem) ??
    ELECTRIC_COOLING_SYSTEMS[1];

  // 1. Costo Pacco Batteria (celle + BMS e gestione termica specifica del pacco):
  const batteryCost = batteryPack.unitProductionCost;

  // 2. Costo Motori Elettrici (esattamente proporzionale al numero di motori: 1x, 2x, 3x, 4x;
  // zero dipendenza da posizionamento Anteriore/Posteriore o orientamento Trasversale/Longitudinale):
  // Se ASM o EESM: spegnimento elettronico/eccitazione asse a costo $0.
  // Se PSM / IPM-SynRM / Flusso Assiale: Unità di Sgancio Meccanico Dog-Clutch costa +$350.
  const hasZeroDragRotor = motorTypeSpec.hasZeroDragWhenCoasting;
  const hasDisconnectActive =
    !hasZeroDragRotor && Boolean(bench.hasFrontDisconnect) && motorCount >= 2;
  const mechanicalShaftAddonCost = hasMechanicalAwdShaft ? 650 : 0;
  const disconnectAddonCost = hasDisconnectActive ? 350 : 0;

  // Scala hardware motori/inverter per Mild Hybrid 48V (0.28x) e Full Hybrid HEV (0.62x) vs unità trazione primaria (1.0x):
  const hardwareSizingScale =
    bench.systemType === 'MHEV'
      ? 0.28
      : bench.systemType === 'FullHybrid'
        ? 0.62
        : 1.0;

  const motorSystemCost = Math.round(
    unitMotor.motorHardwareCost * motorCount * hardwareSizingScale +
      mechanicalShaftAddonCost +
      disconnectAddonCost,
  );

  // 3. Costo Inverter + Gestione Termica dei Motori (dedicata ai soli motori elettrici):
  const motorCoolingHardwareCost = Math.round(motorCoolingSpec.cost * 0.45);
  const singleInverterCost = Math.max(
    0,
    unitMotor.inverterAndCoolingCost - motorCoolingHardwareCost,
  );
  const inverterAndCoolingCost = Math.round(
    (singleInverterCost * (1 + (motorCount - 1) * 0.65) + motorCoolingHardwareCost) *
      hardwareSizingScale,
  );

  // 4. Costo Riduttore / Cambio Elettrico (+$420 per Cambio 2 Rapporti Doppia Frizione):
  const gearboxCost = bench.gearboxType === 'TwoSpeedDualClutch' ? 420 : 0;

  // 5. Costo Motore Termico/Wankel Accoppiato (se Ibrido):
  let coupledIceCost = 0;
  if (systemSpec.hasIceEngine) {
    coupledIceCost =
      coupledIce?.unitProductionCost ??
      REFERENCE_HYBRID_ICE_ENGINES[1].unitProductionCost;
  }

  const unitProductionCost = Math.round(
    batteryCost + motorSystemCost + inverterAndCoolingCost + gearboxCost + coupledIceCost,
  );

  // 5. Costo di Sviluppo R&D e Capitale Impianti:
  const globalComplexity =
    systemSpec.complexityFactor * (1 + (motorCount - 1) * 0.18);
  const capitalCost = Math.round(
    (unitMotor.developmentCost.capitalCost * 0.55 +
      batteryPack.developmentCost.capitalCost * 0.45 +
      systemSpec.unlockCost.capitalCost * 0.5) *
      globalComplexity,
  );
  const rdCost = Math.round(
    (unitMotor.developmentCost.rdCost * 0.55 +
      batteryPack.developmentCost.rdCost * 0.45 +
      systemSpec.unlockCost.rdCost * 0.5) *
      globalComplexity,
  );

  return {
    unitProductionCost,
    singleMotorUnitCost: unitMotor.unitProductionCost,
    batteryCost,
    motorSystemCost,
    inverterAndCoolingCost,
    coupledIceCost,
    developmentCost: {
      capitalCost,
      rdCost,
      minYear: Math.max(
        systemSpec.minYear,
        unitMotor.developmentCost.minYear ?? 0,
        batteryPack.developmentCost.minYear ?? 0,
      ),
    },
  };
}

/**
 * Simulazione completa del Banco Prova Elettrico e Ibrido (Modulo 1.4 / 1C):
 * - Separa `SingleElectricMotorTelemetry`, `BatteryPackTelemetry` e `PowertrainBenchConfig`.
 * - Scala linearmente 1, 2, 3 o 4 motori (`1.0x`, `2.0x`, `3.0x`, `4.0x`, o `0.92x` per 1 motore + albero meccanico AWD).
 * - Genera la curva dinamometrica combinata per `MHEV`, `FullHybrid` e `PHEV` calcolando prima
 *   la curva reale del comparto elettrico a ogni step di RPM (limitata dalla potenza di scarica massima
 *   della batteria selezionata) e sommandola positivamente alla curva del motore termico/Wankel scelto
 *   (`CV = (Nm_totali * RPM) / 7023.5`).
 * - Per `RangeExtender (EREV)`, usa il motore termico/Wankel scelto come generatore a regime ottimale
 *   per caricare la batteria, mantenendo trazione 100% elettrica alle ruote.
 */
export function simulateElectricHybridDyno(
  configInput: ElectricHybridEngineConfigInput | PowertrainBenchConfig,
  coupledIceInput?: CoupledIceEngineOption,
): EvHybridSimulationResult {
  const bench = toPowertrainBenchConfig(configInput);

  const motorTypeSpec =
    ELECTRIC_MOTOR_TYPES.find((m) => m.id === bench.motor.electricMotorType) ??
    ELECTRIC_MOTOR_TYPES[0];
  const layoutSpec =
    MOTOR_LAYOUT_CONFIGS.find((l) => l.id === bench.motorLayout) ??
    MOTOR_LAYOUT_CONFIGS.find((l) => l.motorCount === bench.motorCount) ??
    MOTOR_LAYOUT_CONFIGS[0];
  const batteryChemSpec =
    BATTERY_CHEMISTRIES.find((b) => b.id === bench.battery.batteryChemistry) ??
    BATTERY_CHEMISTRIES[0];
  const voltageSpec =
    VOLTAGE_ARCHITECTURES.find((v) => v.voltage === bench.motor.voltageArchitecture) ??
    VOLTAGE_ARCHITECTURES[0];
  const systemSpec =
    HYBRID_SYSTEM_TYPES.find((s) => s.id === bench.systemType) ??
    HYBRID_SYSTEM_TYPES[0];
  const inverterSpec =
    INVERTER_POWER_ELECTRONICS_SPECS.find(
      (i) => i.id === bench.motor.inverterPowerElectronics,
    ) ?? INVERTER_POWER_ELECTRONICS_SPECS[2];

  const isTwoSpeedGearbox = bench.gearboxType === 'TwoSpeedDualClutch';
  const clampedGearRatio = Math.max(5.5, Math.min(13.5, Number(bench.gearRatio || 9.0)));

  const coupledIce = systemSpec.hasIceEngine
    ? (coupledIceInput ?? REFERENCE_HYBRID_ICE_ENGINES[1])
    : undefined;

  // 1. Calcolo metriche comparto elettrico separato (Motore Singolo * Scala Lineare Banco + Batteria/Generatore):
  const {
    unitMotor,
    batteryPack,
    motorCount,
    hasMechanicalAwdShaft,
    peakElectricPowerHp,
    peakElectricPowerKw,
    continuousPowerKw,
    peakElectricTorqueNm,
    maxBatterySupportedElectricHp,
    maxAvailableElectricalHp,
    cornerSpeedRpm,
    maxMotorRpm,
    cRatePeak,
  } = calculateElectricOutputMetrics(bench, coupledIce);

  // 2. Generazione Curva Dinamometrica (condivisa e continua C1, invariante rispetto a maxMotorRpm):
  let curve: DynoCurvePoint[] = [];
  let iceOnlyCurve: DynoCurvePoint[] = [];
  let electricOnlyCurve: DynoCurvePoint[] = [];

  let peakPowerHp = 0;
  let peakPowerRpm = 0;
  let peakTorqueNm = 0;
  let peakTorqueRpm = 0;
  let redlineRpm = maxMotorRpm;

  if (bench.systemType === 'PureEV' || bench.systemType === 'RangeExtender') {
    // TRAZIONE 100% ELETTRICA ALLE RUOTE (BEV e Range Extender EREV):
    // Scala lineare esatta: Single = 1.0x, Dual = 2.0x, Tri = 3.0x, Quad = 4.0x (o 0.92x con albero AWD meccanico).
    // Nel RangeExtender le ruote restano 100% elettriche su tutto 0..maxMotorRpm, alimentate da Batteria + Generatore.
    redlineRpm = maxMotorRpm;
    const stepRpm = 250;

    for (let rpm = 0; rpm <= maxMotorRpm; rpm += stepRpm) {
      const pt = computeElectricMotorTorqueAndPowerAtRpm({
        rpm,
        peakTorqueNm: peakElectricTorqueNm,
        ratedPowerHp: peakElectricPowerHp,
        cornerSpeedRpm,
        statorWinding: bench.motor.statorWinding,
        gearboxType: bench.gearboxType,
        gearRatio: clampedGearRatio,
        maxCapPowerHp: maxAvailableElectricalHp,
      });

      curve.push({
        rpm,
        torqueNm: pt.torqueNm,
        powerHp: pt.powerHp,
      });

      if (pt.torqueNm > peakTorqueNm) {
        peakTorqueNm = pt.torqueNm;
        peakTorqueRpm = rpm;
      }
      if (pt.powerHp > peakPowerHp) {
        peakPowerHp = pt.powerHp;
        peakPowerRpm = rpm;
      }
    }
  } else if (coupledIce) {
    // SISTEMI IBRIDI (MHEV, FullHybrid, PHEV):
    const combinedResult = generateCombinedHybridDynoCurve({
      coupledIce,
      peakElectricTorqueNm,
      peakElectricPowerHp,
      maxBatterySupportedElectricHp,
      cornerSpeedRpm,
      maxMotorRpm,
      gearboxType: bench.gearboxType,
      systemType: bench.systemType,
    });

    curve = combinedResult.curve;
    iceOnlyCurve = combinedResult.iceOnlyCurve;
    electricOnlyCurve = combinedResult.electricOnlyCurve;
    peakPowerHp = combinedResult.peakPowerHp;
    peakPowerRpm = combinedResult.peakPowerRpm;
    peakTorqueNm = combinedResult.peakTorqueNm;
    peakTorqueRpm = combinedResult.peakTorqueRpm;
    redlineRpm = combinedResult.redlineRpm;
  }

  // 3. Pesi del Powertrain (kg), inclusi cambio elettrico a 2 rapporti (+18 kg), albero/differenziali Mech-AWD (+38 kg) e cablaggi:
  const hasZeroDragRotor = motorTypeSpec.hasZeroDragWhenCoasting;
  const hasDisconnectActive =
    !hasZeroDragRotor && Boolean(bench.hasFrontDisconnect) && motorCount >= 2;
  const disconnectAddonWeightKg = hasDisconnectActive ? 4.5 : 0;
  const mechanicalShaftWeightKg = hasMechanicalAwdShaft
    ? Math.max(38, layoutSpec.extraHardwareWeightKg)
    : 0;
  const gearboxWeightKg = isTwoSpeedGearbox ? 18 : 0;

  const motorHardwareWeightScale =
    bench.systemType === 'MHEV'
      ? 0.28
      : bench.systemType === 'FullHybrid'
        ? 0.62
        : 1.0;

  const motorWeightKg = Math.round(
    unitMotor.dryWeightKg * motorCount * motorHardwareWeightScale +
      mechanicalShaftWeightKg +
      disconnectAddonWeightKg +
      gearboxWeightKg,
  );
  const batteryWeightKg = batteryPack.weightKg;
  const electronicsWeightKg = 0;

  const iceDryWeightKg = coupledIce ? coupledIce.dryWeightKg : 0;
  const iceWetWeightKg = coupledIce ? coupledIce.wetWeightKg : 0;

  const dryWeightKg = Math.max(
    30,
    Math.round(
      motorWeightKg +
        batteryWeightKg +
        electronicsWeightKg +
        iceDryWeightKg,
    ),
  );

  // Fluidi totali reali:
  const motorFluidsTotalKg = Number(
    ((unitMotor.wetWeightKg - unitMotor.dryWeightKg) * motorCount).toFixed(1),
  );
  const batteryCoolantKg = bench.battery.coolingSystem === 'Air' ? 0 : 2.5;
  const gearboxOilKg = isTwoSpeedGearbox ? 1.5 : 0;
  const iceFluidsKg = Math.max(0, iceWetWeightKg - iceDryWeightKg);
  const totalFluidsKg = Math.round(
    motorFluidsTotalKg + batteryCoolantKg + gearboxOilKg + iceFluidsKg,
  );
  const wetWeightKg = dryWeightKg + totalFluidsKg;

  // 4. Efficienza del Sistema (%) e Consumi Energetici Reali (Wh/km e kWh/100km):
  // Include effetto reale di gearboxType (TwoSpeed -6% consumo) e gearRatio (5.5:1 più lungo = -5.2%, 13.5:1 più corto = +6.8%).
  const hasZeroDragFrontAxle = hasZeroDragRotor || hasDisconnectActive;

  let drivetrainConsumptionMult = 1.0;
  if (hasMechanicalAwdShaft) {
    drivetrainConsumptionMult = 1.087;
  } else if (motorCount === 1) {
    drivetrainConsumptionMult =
      bench.motorLayout === 'SingleMotor_FWD' ? 1.012 : 1.0;
  } else if (motorCount === 2) {
    drivetrainConsumptionMult = hasZeroDragFrontAxle ? 1.035 : 1.085;
  } else if (motorCount === 3) {
    drivetrainConsumptionMult = hasZeroDragFrontAxle ? 1.075 : 1.08;
  } else {
    drivetrainConsumptionMult = 1.32;
  }

  const baseEfficiency = hasMechanicalAwdShaft
    ? 85.1
    : motorCount === 1
      ? (bench.motorLayout === 'SingleMotor_FWD' ? 90.5 : 92.0)
      : motorCount === 2
        ? (hasZeroDragFrontAxle ? 89.5 : 88.0)
        : motorCount === 3
          ? (hasZeroDragFrontAxle ? 86.8 : 85.0)
          : 83.5;

  const gearRatioEffDelta = -(clampedGearRatio - 9.0) * 0.25;
  const gearboxEffDelta = isTwoSpeedGearbox ? 1.3 : 0.0;

  const rawElectricEfficiency =
    baseEfficiency *
      (motorTypeSpec.baseEfficiencyPercent / 95.5) *
      (inverterSpec.efficiencyPercent / 93.5) +
    voltageSpec.efficiencyBonusPercent * 0.5 +
    gearRatioEffDelta +
    gearboxEffDelta;

  const pureEvEfficiency = Math.min(96.5, Math.max(76.0, rawElectricEfficiency));
  const electricEffNorm = pureEvEfficiency / 95.0;
  const iceCycleFactor = coupledIce && !coupledIce.isTurbo ? 1.03 : 1.0;

  // Efficienza energetica reale pesata per architettura (PureEV 90-96.5%, PHEV 68-76%, EREV 55-62%, HEV 44-50%, MHEV 38-43%):
  let rawCombinedSystemEfficiency: number;
  if (bench.systemType === 'PureEV') {
    rawCombinedSystemEfficiency = pureEvEfficiency;
  } else if (bench.systemType === 'PHEV') {
    const phevCapDelta = Math.max(-2.0, Math.min(2.5, (bench.battery.batteryCapacityKwh - 20) * 0.12));
    rawCombinedSystemEfficiency = Math.min(
      76.0,
      Math.max(68.0, 71.5 * electricEffNorm * iceCycleFactor + phevCapDelta),
    );
  } else if (bench.systemType === 'RangeExtender') {
    const erevCapDelta = Math.max(-1.5, Math.min(2.0, (bench.battery.batteryCapacityKwh - 35) * 0.08));
    rawCombinedSystemEfficiency = Math.min(
      62.0,
      Math.max(55.0, 58.0 * electricEffNorm * iceCycleFactor + erevCapDelta),
    );
  } else if (bench.systemType === 'FullHybrid') {
    rawCombinedSystemEfficiency = Math.min(
      50.0,
      Math.max(44.0, 46.5 * electricEffNorm * iceCycleFactor + gearboxEffDelta * 0.4 + gearRatioEffDelta * 0.3),
    );
  } else {
    // MHEV: trazione prevalentemente termica con recupero 48V BSG
    rawCombinedSystemEfficiency = Math.min(
      43.0,
      Math.max(38.0, 40.0 * electricEffNorm * iceCycleFactor + gearboxEffDelta * 0.3 + gearRatioEffDelta * 0.25),
    );
  }

  const systemEfficiencyPercent = Number(rawCombinedSystemEfficiency.toFixed(1));

  const baseWhPerKmAtRwd =
    84.0 +
    (dryWeightKg / 1000.0) * 62.0 +
    Math.pow(peakElectricPowerKw, 0.85) * 0.14;

  const inverterConsumptionFactor = {
    Silicon_IGBT: 1.045,
    Silicon_MOSFET: 1.03,
    SiliconCarbide_SiC: 0.945,
    Dual_SiC_GaN_Racing: 0.9,
  }[inverterSpec.id];

  const motorTypeConsumptionFactor = {
    IPM_SynRM: 0.955,
    WoundRotorSync_EESM: 0.965,
    PermanentMagnetSync: 1.0,
    AxialFlux: 1.02,
    InductionAsync: 1.045,
  }[bench.motor.electricMotorType];

  // Carico aerodinamico e d'attrito pneumatici maggiorati per configurazioni AWD ad alte prestazioni (PerformanceSport):
  let sportAeroTireDragMult = 1.0;
  if (
    bench.battery.bmsCalibration === 'PerformanceSport' &&
    motorCount >= 2 &&
    bench.systemType === 'PureEV'
  ) {
    sportAeroTireDragMult =
      bench.battery.packStructure === 'ModularAluminum' &&
      bench.motor.voltageArchitecture >= 800
        ? 1.15
        : bench.battery.packStructure === 'ModularAluminum'
          ? 1.09
          : peakElectricPowerKw > 600
            ? 1.14
            : 1.02;
    if (bench.battery.underbodyShield === 'TitaniumKevlarIP69K') {
      sportAeroTireDragMult *= 1.16;
    }
    if (inverterSpec.id === 'Silicon_MOSFET') {
      sportAeroTireDragMult *= 1.15;
    }
  }

  const twoSpeedConsumptionFactor = isTwoSpeedGearbox ? 0.96 : 1.0;
  const gearRatioCruiseConsumptionFactor =
    1.0 + (clampedGearRatio - 9.0) * 0.015;
  const voltageConsumptionMult =
    bench.motor.voltageArchitecture === 800
      ? 0.985
      : bench.motor.voltageArchitecture >= 1000
        ? 0.965
        : 1.0;

  // Massa passiva e perdite di trascinamento cambio/trasmissione ibrida in marcia EV per PHEV ed EREV:
  const isCompactHighPerfPhev =
    bench.systemType === 'PHEV' && bench.battery.batteryCapacityKwh <= 10.0;
  const hybridParasiticMult =
    bench.systemType === 'PHEV' || bench.systemType === 'RangeExtender'
      ? isCompactHighPerfPhev
        ? 1.55 + ((coupledIce?.peakPowerHp ?? 200) / 1000.0) * 0.75
        : 1.32 + ((coupledIce?.peakPowerHp ?? 150) / 1000.0) * 0.55
      : 1.0;

  const efficiencyWhPerKm = Math.round(
    baseWhPerKmAtRwd *
      drivetrainConsumptionMult *
      inverterConsumptionFactor *
      motorTypeConsumptionFactor *
      sportAeroTireDragMult *
      twoSpeedConsumptionFactor *
      gearRatioCruiseConsumptionFactor *
      voltageConsumptionMult *
      hybridParasiticMult,
  );
  const efficiencyKwhPer100Km = Number((efficiencyWhPerKm / 10).toFixed(1));

  // Finestra di scarica Charge-Depleting (SOC riservato al buffer Charge-Sustaining su PHEV/EREV):
  let depletionWindowRatio = 1.0;
  if (bench.systemType === 'RangeExtender') {
    depletionWindowRatio = 0.78;
  } else if (bench.systemType === 'PHEV') {
    if (isCompactHighPerfPhev) {
      // Nei PHEV supercar/performance (<= 10 kWh), una quota di SOC resta sempre riservata al boost ibrido (Charge-Sustaining)
      // e i consumi ausiliari di pompaggio cambio/frizioni/raffreddamento assorbono una frazione fissa per ciclo:
      depletionWindowRatio =
        bench.battery.bmsCalibration === 'PerformanceSport' ? 0.88 : 0.74;
      if (isTwoSpeedGearbox) {
        depletionWindowRatio *= 0.57;
      }
      if (motorCount >= 3) {
        depletionWindowRatio *= 0.88;
      }
    } else {
      depletionWindowRatio = 0.83;
    }
  }

  // Autonomia elettrica reale WLTP per topologia:
  const estimatedRangeKm =
    bench.systemType === 'MHEV'
      ? Math.min(2, Math.max(0, Math.round(batteryPack.usableCapacityKwh * 0.6)))
      : bench.systemType === 'FullHybrid'
        ? Math.max(
            2,
            Math.round(
              (batteryPack.usableCapacityKwh * 0.55 * 1000) /
                Math.max(90, efficiencyWhPerKm),
            ),
          )
        : Math.max(
            2,
            Math.round(
              (batteryPack.usableCapacityKwh * depletionWindowRatio * 1000) /
                Math.max(90, efficiencyWhPerKm),
            ),
          );

  const effectiveWheelTorqueNm = Math.round(
    peakTorqueNm * clampedGearRatio * (isTwoSpeedGearbox ? 1.45 : 1.0),
  );

  // 5. Range Extender (EREV): il motore termico/Wankel scelto funge da generatore per caricare la batteria
  let erevGeneratorOutputKw: number | undefined;
  let erevCruisingDemandKw: number | undefined;
  let erevGeneratorRpm: number | undefined;
  let erevSelfSustaining: boolean | undefined;
  let erevTotalCombinedRangeKm: number | undefined;

  if (bench.systemType === 'RangeExtender' && coupledIce) {
    erevGeneratorRpm = Math.round((coupledIce.redlineRpm * 0.62) / 100) * 100;
    const genSample = sampleCurveAtRpm(coupledIce.curve, erevGeneratorRpm);
    erevGeneratorOutputKw = Math.round(genSample.powerHp * 0.7355 * 0.92);
    erevCruisingDemandKw = Math.round((efficiencyWhPerKm * 125) / 1000);
    erevSelfSustaining = erevGeneratorOutputKw >= erevCruisingDemandKw;
    const generatorRangeKm = Math.round(
      450 *
        (erevGeneratorOutputKw / Math.max(15, erevCruisingDemandKw) > 1 ? 1.15 : 0.85),
    );
    erevTotalCombinedRangeKm = estimatedRangeKm + generatorRangeKm;
  }

  // 6. Affidabilità Dinamica (58% - 94%) e Durata Stimata in Km (include cambio 2 rapporti e carico corrente rapporto lungo):
  const cRateExcess = Math.max(0, cRatePeak - batteryChemSpec.maxContinuousCRate);
  const cRateReliabilityPenalty = Math.min(12.0, cRateExcess * 2.2);
  const multiMotorComplexityPenalty = (motorCount - 1) * 1.4;
  const gearboxReliabilityDelta =
    (isTwoSpeedGearbox ? -1.5 : 0.0) + ((clampedGearRatio - 9.0) / 4.5) * 0.5;

  let rawReliability =
    unitMotor.reliabilityPercent * 0.45 +
    batteryPack.reliabilityPercent * 0.55 -
    cRateReliabilityPenalty -
    multiMotorComplexityPenalty +
    gearboxReliabilityDelta;

  if (systemSpec.hasIceEngine && coupledIce) {
    rawReliability = rawReliability * 0.62 + coupledIce.reliabilityPercent * 0.38 - 2.5;
  }

  const reliabilityPercent = Number(
    Math.min(94.0, Math.max(58.0, rawReliability)).toFixed(1),
  );

  const cRateLifespanFactor = Math.max(0.68, 1.0 - cRateExcess * 0.055);
  let estimatedLifespanKm = Math.round(batteryPack.estimatedLifespanKm * cRateLifespanFactor);

  if (systemSpec.hasIceEngine && coupledIce && bench.motor.referenceClass !== 'Corsa') {
    estimatedLifespanKm = Math.round(
      Math.min(
        estimatedLifespanKm,
        coupledIce.estimatedLifespanKm * 1.15 + estimatedLifespanKm * 0.25,
      ),
    );
  }
  estimatedLifespanKm = Math.round(estimatedLifespanKm / 1000) * 1000;

  // 7. Emissioni CO2 (g/km) e Costi:
  let emissionsGPerKm = 0;
  if (systemSpec.hasIceEngine && coupledIce) {
    emissionsGPerKm = Math.max(
      0,
      Math.round(
        coupledIce.emissionsGPerKm *
          (1 - systemSpec.emissionsReductionPercent / 100) *
          twoSpeedConsumptionFactor *
          Math.min(1.04, Math.max(0.96, gearRatioCruiseConsumptionFactor)),
      ),
    );
  }

  const { unitProductionCost } = calculateElectricHybridCosts(bench, coupledIce);

  const effectiveMotorLayout: MotorLayoutConfig = hasMechanicalAwdShaft
    ? 'SingleMotor_MechanicalAWD'
    : bench.motorLayout ?? layoutSpec.id;

  const specs: ElectricHybridSpecs = {
    systemType: bench.systemType,
    electricMotorType: bench.motor.electricMotorType,
    motorLayout: effectiveMotorLayout,
    motorCount,
    hasMechanicalAwdShaft,
    hasFrontDisconnect: bench.hasFrontDisconnect,
    statorDiameterMm: bench.motor.statorDiameterMm,
    rotorLengthMm: bench.motor.rotorLengthMm,
    batteryChemistry: bench.battery.batteryChemistry,
    batteryCapacityKwh: bench.battery.batteryCapacityKwh,
    voltageArchitecture: bench.motor.voltageArchitecture,
    coolingSystem: bench.motor.coolingSystem,
    inverterTech: unitMotor.inverterTech,
    inverterSummaryName: unitMotor.inverterSummaryName,
    inverterEfficiencyPercent: unitMotor.inverterEfficiencyPercent,
    singleMotorSpec: unitMotor.spec,
    unitMotorPowerHp: unitMotor.peakPowerHp,
    unitMotorTorqueNm: unitMotor.peakTorqueNm,
    unitMotorCost: unitMotor.unitProductionCost,
    batteryPackSpec: batteryPack.spec,
    maxBatteryDischargePowerKw: batteryPack.maxDischargePowerKw,
    maxBatteryDischargePowerHp: maxBatterySupportedElectricHp,
    peakElectricPowerKw,
    peakElectricPowerHp,
    continuousPowerKw,
    peakTorqueNm: peakElectricTorqueNm,
    cornerSpeedRpm,
    maxRpm: maxMotorRpm,
    cRatePeak,
    gearboxType: bench.gearboxType,
    gearRatio: bench.gearRatio,
    batteryWeightKg,
    motorWeightKg,
    totalPowertrainWeightKg: wetWeightKg,
    estimatedRangeKm,
    efficiencyWhPerKm,
    efficiencyKwhPer100Km,
    batteryLifespanCycles: batteryPack.cycleLife,
    coupledIceId: coupledIce?.id,
    coupledIceName: coupledIce?.name,
    coupledIcePropulsionType: coupledIce?.propulsionType,
    iceEngineDisplacementCc: coupledIce?.displacementCc,
    icePowerHp: coupledIce?.peakPowerHp,
    iceTorqueNm: coupledIce?.peakTorqueNm,
    combinedPowerHp: peakPowerHp,
    combinedTorqueNm: peakTorqueNm,
    erevGeneratorOutputKw,
    erevCruisingDemandKw,
    erevGeneratorRpm,
    erevSelfSustaining,
    erevTotalCombinedRangeKm,
  };

  return {
    curve,
    iceOnlyCurve: iceOnlyCurve.length > 0 ? iceOnlyCurve : undefined,
    electricOnlyCurve: electricOnlyCurve.length > 0 ? electricOnlyCurve : undefined,
    coupledIceOption: coupledIce,
    singleMotorTelemetry: unitMotor,
    batteryPackTelemetry: batteryPack,
    benchConfig: bench,
    peakPowerHp,
    peakPowerRpm,
    peakTorqueNm,
    peakTorqueRpm,
    redlineRpm,
    dryWeightKg,
    wetWeightKg,
    thermalEfficiencyPercent: systemEfficiencyPercent,
    emissionsGPerKm,
    reliabilityPercent,
    estimatedLifespanKm,
    unitProductionCost,
    specs,
    effectiveWheelTorqueNm,
  };
}
