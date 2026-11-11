import {
  BATTERY_CHEMISTRIES,
  ELECTRIC_COOLING_SYSTEMS,
  ELECTRIC_MOTOR_TYPES,
  HYBRID_SYSTEM_TYPES,
  MOTOR_LAYOUT_CONFIGS,
  PRICE_TIER_EV_SPECS,
  REFERENCE_CLASS_EV_SPECS,
  REFERENCE_HYBRID_ICE_ENGINES,
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
  /** Ingombro complessivo del gruppo propulsore nel vano motore per la verifica collisione (mm) */
  engineBayDimensionsMm: DimensionsLWH;
  /** Volume attivo statore/rotore della singola unità motrice in cm³ (cc) */
  statorVolumeCc: number;
}

export interface EvHybridSimulationResult extends EngineDynoTelemetry {
  specs: ElectricHybridSpecs;
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
    return { ...input.motor };
  }
  if ('motorSpec' in input && input.motorSpec) {
    return { ...input.motorSpec };
  }
  const cfg = input as ElectricMotorSpec & Partial<ElectricHybridEngineConfigInput>;
  return {
    electricMotorType: cfg.electricMotorType,
    statorDiameterMm: cfg.statorDiameterMm,
    rotorLengthMm: cfg.rotorLengthMm,
    voltageArchitecture: cfg.voltageArchitecture,
    coolingSystem: cfg.coolingSystem,
    priceTier: cfg.priceTier,
    referenceClass: cfg.referenceClass,
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
    return { ...input.battery };
  }
  if ('batterySpec' in input && input.batterySpec) {
    return { ...input.batterySpec };
  }
  const cfg = input as BatteryPackSpec & Partial<ElectricHybridEngineConfigInput>;
  return {
    batteryChemistry: cfg.batteryChemistry,
    batteryCapacityKwh: cfg.batteryCapacityKwh,
    voltageArchitecture: cfg.voltageArchitecture,
    coolingSystem: cfg.coolingSystem,
    priceTier: cfg.priceTier,
    referenceClass: cfg.referenceClass,
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
 * Calcola tutte le specifiche fisiche, geometriche, telemetriche e di costo di UNA SINGOLA
 * unità motore elettrico universale (`ElectricMotorSpec`, scala 1.0x).
 * - Dipende SOLO da tecnologia, diametro statore, lunghezza rotore, tensione, raffreddamento,
 *   fascia prezzo e classe.
 * - Nessun parametro di posizionamento (Anteriore/Posteriore) o orientamento (Trasversale/Longitudinale)
 *   influenza le prestazioni o il prezzo del singolo motore.
 * - Tutti i modificatori agiscono positivamente e monotonamente sia sulla Potenza (CV) sia sulla Coppia (Nm).
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
  const tierSpec = PRICE_TIER_EV_SPECS[spec.priceTier] ?? PRICE_TIER_EV_SPECS.Media;
  const classSpec =
    REFERENCE_CLASS_EV_SPECS[spec.referenceClass] ?? REFERENCE_CLASS_EV_SPECS.Normale;

  // 1. Geometria attiva statore/rotore (Ds in mm, Lr in mm -> volume in cm³ / cc):
  const Ds = Math.max(140, Math.min(360, spec.statorDiameterMm));
  const Lr = Math.max(70, Math.min(300, spec.rotorLengthMm));
  const statorVolumeCc = Math.round(Math.PI * Math.pow(Ds / 20, 2) * (Lr / 10));

  const isAxialFlux = spec.electricMotorType === 'AxialFlux';
  const motorDiameterMm = Math.round(Ds + 38);
  const motorLengthMm = Math.round(isAxialFlux ? 85 + Lr * 0.22 : Lr + 80);

  const dimensionsMm: DimensionsLWH = {
    lengthMm: motorLengthMm,
    widthMm: motorDiameterMm,
    heightMm: motorDiameterMm,
  };

  const isSiC = tierSpec.mappedInverterTech === 'SiliconCarbide_SiC';
  const isGaN = tierSpec.mappedInverterTech === 'GalliumNitride_GaN';
  const inverterDimensionsMm: DimensionsLWH = {
    lengthMm: Math.round(isGaN ? 185 : isSiC ? 235 : 295),
    widthMm: Math.round(isGaN ? 165 : isSiC ? 215 : 265),
    heightMm: Math.round(isGaN ? 70 : isSiC ? 90 : 120),
  };

  // 2. Potenza (CV/kW) e Coppia (Nm) della singola unità motore (1.0x):
  // Ogni singolo parametro (dimensioni, tecnologia, tensione, raffreddamento, PriceTier, ReferenceClass)
  // scala positivamente sia CV sia Nm senza MAI invertire il segno!
  const sizeFactor = Math.pow(statorVolumeCc / 6648, 0.62);
  const coolingPowerMultiplier =
    spec.coolingSystem === 'DirectDielectric'
      ? 1.08
      : spec.coolingSystem === 'LiquidGlycol'
        ? 1.0
        : 0.90; // Aria passiva riduce del 10% il picco erogabile per limiti termici sugli avvolgimenti

  const rawUnitPowerHp =
    145 *
    sizeFactor *
    motorTypeSpec.powerMultiplier *
    voltageSpec.powerMultiplier *
    tierSpec.powerMultiplier *
    classSpec.powerMultiplier *
    coolingPowerMultiplier;

  const rawUnitTorqueNm =
    165 *
    sizeFactor *
    motorTypeSpec.torqueMultiplier *
    voltageSpec.powerMultiplier *
    tierSpec.powerMultiplier *
    classSpec.torqueMultiplier *
    coolingPowerMultiplier;

  const peakPowerHp = Math.max(25, Math.round(rawUnitPowerHp));
  const peakPowerKw = Math.max(18, Math.round(peakPowerHp * 0.7355));
  const peakTorqueNm = Math.max(35, Math.round(rawUnitTorqueNm));
  const continuousPowerKw = Math.round(peakPowerKw * coolingSpec.continuousPowerRatio);

  // Regime di Field Weakening (Corner Speed RPM) coerente con P_HP = (T_Nm * RPM_corner) / 7023.5:
  const cornerSpeedRpm = Math.max(
    4500,
    Math.min(9500, Math.round((peakPowerHp * 7023.5) / Math.max(1, peakTorqueNm))),
  );

  const maxMotorRpm = Math.max(
    14000,
    Math.min(
      22000,
      Math.min(motorTypeSpec.maxSafeRpm, spec.maxMotorRpm || motorTypeSpec.maxSafeRpm),
    ),
  );

  // 3. Curva dinamometrica nativa della singola unità motore (da 0 RPM a maxMotorRpm):
  const curve: DynoCurvePoint[] = [];
  const stepRpm = 250;
  for (let rpm = 0; rpm <= maxMotorRpm; rpm += stepRpm) {
    let torqueNow: number;
    let powerNow: number;
    if (rpm <= cornerSpeedRpm) {
      torqueNow = peakTorqueNm;
      powerNow = Math.round((torqueNow * rpm) / 7023.5);
    } else {
      powerNow = peakPowerHp;
      torqueNow = Math.round((peakPowerHp * 7023.5) / rpm);
    }
    curve.push({ rpm, torqueNm: torqueNow, powerHp: powerNow });
  }

  // 4. Peso, Efficienza, Affidabilità e Durata della singola unità motore:
  const motorCoreKg =
    (22 + peakPowerKw * 0.21) * motorTypeSpec.weightMultiplier;
  const inverterKg = spec.priceTier === 'Lusso' ? 5.5 : 9.0;
  const dryWeightKg = Math.max(18, Math.round(motorCoreKg + inverterKg));
  const wetWeightKg = Math.round(dryWeightKg + coolingSpec.weightKg * 0.45);

  const efficiencyPercent = Number(
    Math.min(
      97.5,
      Math.max(
        82.0,
        motorTypeSpec.baseEfficiencyPercent *
          (tierSpec.inverterEfficiencyPercent / 93.5) +
          voltageSpec.efficiencyBonusPercent * 0.4,
      ),
    ).toFixed(1),
  );

  const highRpmBearingPenalty =
    maxMotorRpm > 17500 ? ((maxMotorRpm - 17500) / 1000) * 1.6 : 0;
  let effectiveClassRelDelta = classSpec.reliabilityDeltaPercent;
  if (
    (spec.referenceClass === 'Corsa' || spec.referenceClass === 'Sport') &&
    coolingSpec.protectsHighDischargeCorsa
  ) {
    effectiveClassRelDelta *= 0.45;
  }

  const reliabilityPercent = Number(
    Math.min(
      95.0,
      Math.max(
        60.0,
        86.0 +
          coolingSpec.reliabilityDeltaPercent +
          tierSpec.reliabilityDeltaPercent +
          effectiveClassRelDelta -
          highRpmBearingPenalty,
      ),
    ).toFixed(1),
  );

  const baseMotorLifespanKm =
    spec.referenceClass === 'Corsa'
      ? 35_000
      : spec.referenceClass === 'Sport'
        ? 185_000
        : 420_000;
  const estimatedLifespanKm =
    Math.round(
      (baseMotorLifespanKm *
        tierSpec.lifespanMultiplier *
        (spec.coolingSystem === 'Air'
          ? 0.78
          : spec.coolingSystem === 'DirectDielectric'
            ? 1.12
            : 1.0)) /
        1000,
    ) * 1000;

  // 5. Costo della singola unità motore universale (ZERO dipendenza da Anteriore/Posteriore o orientamento!):
  const motorHardwareCost = Math.round(280 + peakPowerKw * motorTypeSpec.costPerKw);
  const inverterAndCoolingCost = Math.round(
    tierSpec.electronicsCostBase * voltageSpec.costMultiplier + coolingSpec.cost * 0.45,
  );
  const unitProductionCost = motorHardwareCost + inverterAndCoolingCost;

  const motorComplexity =
    spec.electricMotorType === 'AxialFlux'
      ? 1.55
      : spec.electricMotorType === 'IPM_SynRM'
        ? 1.2
        : 1.0;
  const tierRdMult =
    spec.priceTier === 'Lusso'
      ? 1.6
      : spec.priceTier === 'Premium'
        ? 1.25
        : spec.priceTier === 'Economica'
          ? 0.75
          : 1.0;

  const developmentCost: DualCurrencyCost = {
    capitalCost: Math.round(
      motorTypeSpec.unlockCost.capitalCost *
        motorComplexity *
        voltageSpec.costMultiplier *
        tierRdMult,
    ),
    rdCost: Math.round(
      motorTypeSpec.unlockCost.rdCost *
        motorComplexity *
        voltageSpec.costMultiplier *
        tierRdMult,
    ),
    minYear: Math.max(motorTypeSpec.minYear, coolingSpec.minYear),
  };

  return {
    spec,
    statorVolumeCc,
    dimensionsMm,
    inverterDimensionsMm,
    inverterTech: tierSpec.mappedInverterTech,
    inverterSummaryName: tierSpec.inverterName,
    inverterEfficiencyPercent: tierSpec.inverterEfficiencyPercent,
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
  const inferredSystemType: HybridSystemType =
    systemTypeHint ??
    ('systemType' in batteryInput && batteryInput.systemType
      ? batteryInput.systemType
      : spec.batteryCapacityKwh <= 4
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
  const tierSpec = PRICE_TIER_EV_SPECS[spec.priceTier] ?? PRICE_TIER_EV_SPECS.Media;
  const classSpec =
    REFERENCE_CLASS_EV_SPECS[spec.referenceClass] ?? REFERENCE_CLASS_EV_SPECS.Normale;

  const usableBufferRatio =
    spec.referenceClass === 'Corsa'
      ? 0.98
      : spec.referenceClass === 'Sport'
        ? 0.94
        : 0.90;
  const usableCapacityKwh = Number(
    (spec.batteryCapacityKwh * usableBufferRatio).toFixed(2),
  );

  // Calcolo C-Rate di scarica impulsiva massima e Potenza massima erogabile dalla batteria (kW / CV):
  // I pacchi ibridi compatti (MHEV/FullHybrid) impiegano celle ad altissima potenza specifica (High-Power Pulse Cells),
  // mentre i pacchi BEV/PHEV impiegano celle High-Energy/Performance.
  const coolingDischargeFactor =
    spec.coolingSystem === 'DirectDielectric'
      ? 1.16
      : spec.coolingSystem === 'LiquidGlycol'
        ? 1.0
        : 0.80;

  const highPowerCellGeometryBoost =
    inferredSystemType === 'MHEV'
      ? 7.5
      : inferredSystemType === 'FullHybrid'
        ? 6.2
        : inferredSystemType === 'PHEV'
          ? 2.2
          : 1.45;

  const peakDischargeCRate = Number(
    (
      batteryChemSpec.maxContinuousCRate *
      2.4 *
      highPowerCellGeometryBoost *
      voltageSpec.powerMultiplier *
      tierSpec.powerMultiplier *
      classSpec.powerMultiplier *
      coolingDischargeFactor
    ).toFixed(2),
  );

  const maxDischargePowerKw = Math.max(
    18,
    Math.round(spec.batteryCapacityKwh * peakDischargeCRate),
  );
  const maxDischargePowerHp = Math.round(maxDischargePowerKw / 0.7355);
  const maxContinuousDischargePowerKw = Math.max(
    12,
    Math.round(maxDischargePowerKw * coolingSpec.continuousPowerRatio),
  );

  // Peso del pacco batteria (kg):
  const weightKg = Math.max(
    8,
    Math.round(
      ((spec.batteryCapacityKwh * 1000) / batteryChemSpec.cellDensityWhPerKg) *
        batteryChemSpec.packagingMultiplier *
        classSpec.batteryPackWeightMultiplier,
    ),
  );

  // Ingombro 3D del pacco batteria (mm):
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

  // Costi realistici del pacco batteria ($/kWh: LFP 75, NMC811 110, NCA 135, SolidState 190):
  const costPerKwh = batteryChemSpec.costPerKwh;
  const cellsCost = Math.round(spec.batteryCapacityKwh * costPerKwh);
  const bmsAndThermalCost = Math.round(coolingSpec.cost * 0.55);
  const unitProductionCost = cellsCost + bmsAndThermalCost;

  // Affidabilità e durata chilometrica del pacco batteria:
  let effectiveClassRelDelta = classSpec.reliabilityDeltaPercent;
  if (
    (spec.referenceClass === 'Corsa' || spec.referenceClass === 'Sport') &&
    coolingSpec.protectsHighDischargeCorsa
  ) {
    effectiveClassRelDelta *= 0.45;
  }

  const reliabilityPercent = Number(
    Math.min(
      95.0,
      Math.max(
        58.0,
        84.0 +
          batteryChemSpec.reliabilityDeltaPercent +
          coolingSpec.reliabilityDeltaPercent +
          tierSpec.reliabilityDeltaPercent +
          effectiveClassRelDelta,
      ),
    ).toFixed(1),
  );

  const coolingLifespanFactor =
    spec.coolingSystem === 'Air'
      ? 0.76
      : spec.coolingSystem === 'DirectDielectric'
        ? 1.12
        : 1.0;

  let estimatedLifespanKm: number;
  if (spec.referenceClass === 'Corsa') {
    const corsaBaseKm = spec.coolingSystem === 'DirectDielectric' ? 34_000 : 21_000;
    estimatedLifespanKm = Math.max(
      15_000,
      Math.min(
        45_000,
        Math.round(
          corsaBaseKm *
            tierSpec.lifespanMultiplier *
            (spec.batteryChemistry === 'LFP' ? 1.15 : 1.0),
        ),
      ),
    );
  } else if (spec.referenceClass === 'Sport') {
    const sportBaseKm =
      spec.batteryChemistry === 'LFP'
        ? 172_000
        : spec.batteryChemistry === 'NCA'
          ? 138_000
          : 156_000;
    estimatedLifespanKm = Math.max(
      120_000,
      Math.min(
        200_000,
        Math.round(sportBaseKm * tierSpec.lifespanMultiplier * coolingLifespanFactor),
      ),
    );
  } else {
    const classLifespanMult =
      spec.referenceClass === 'Comfort'
        ? 1.08
        : spec.referenceClass === 'Fuoristrada'
          ? 0.94
          : 1.0;
    const rawNormalKm = Math.round(
      batteryChemSpec.baseLifespanKm *
        tierSpec.lifespanMultiplier *
        coolingLifespanFactor *
        classLifespanMult,
    );
    estimatedLifespanKm =
      spec.batteryChemistry === 'LFP'
        ? Math.max(350_000, Math.min(550_000, rawNormalKm))
        : Math.max(220_000, Math.min(360_000, rawNormalKm));
  }
  estimatedLifespanKm = Math.round(estimatedLifespanKm / 1000) * 1000;

  const chemComplexity =
    spec.batteryChemistry === 'SolidState'
      ? 1.65
      : spec.batteryChemistry === 'NCA'
        ? 1.2
        : 1.0;
  const developmentCost: DualCurrencyCost = {
    capitalCost: Math.round(8_000_000 * chemComplexity * voltageSpec.costMultiplier),
    rdCost: Math.round(95 * chemComplexity * voltageSpec.costMultiplier),
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
    bmsAndThermalCost,
    unitProductionCost,
    reliabilityPercent,
    estimatedLifespanKm,
    cycleLife: batteryChemSpec.cycleLife,
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
  cornerSpeedRpm: number;
  maxMotorRpm: number;
  cRatePeak: number;
} {
  const bench = toPowertrainBenchConfig(configInput);
  const unitMotor = calculateSingleElectricMotorMetrics(bench.motor);
  const batteryPack = calculateBatteryPackMetrics(bench.battery, bench.systemType);
  const { motorCount, hasMechanicalAwdShaft, linearOutputMultiplier } =
    getBenchLinearMotorScale(bench);

  // Rapporto di accoppiamento di sistema per MHEV (48V) e FullHybrid (HEV) vs trazione primaria (PHEV/EREV/PureEV):
  // Nota fondamentale: il rapporto è un coefficiente puro per la topologia, così ogni modificatore
  // del motore e la scala 1.0x / 2.0x / 3.0x / 4.0x scalano SEMPRE linearmente sia i CV sia i Nm!
  const systemArchitectureFactor =
    bench.systemType === 'MHEV'
      ? 0.25
      : bench.systemType === 'FullHybrid'
        ? 0.55
        : 1.0;

  // Fattore di alimentazione dalla batteria selezionata (kWh e chimica):
  // Permette alla batteria selezionata di limitare (se sottodimensionata/bassa scarica) o sostenere
  // la potenza elettrica massima erogata dal comparto elettrico a ogni regime!
  const refKwh =
    bench.systemType === 'MHEV'
      ? 1.5
      : bench.systemType === 'FullHybrid'
        ? 2.8
        : bench.systemType === 'PHEV'
          ? 22
          : bench.systemType === 'RangeExtender'
            ? 32
            : 75;

  const batteryChemSpec =
    BATTERY_CHEMISTRIES.find((b) => b.id === bench.battery.batteryChemistry) ??
    BATTERY_CHEMISTRIES[0];

  const capacityFactor = Math.pow(
    Math.max(0.35, bench.battery.batteryCapacityKwh / refKwh),
    0.24,
  );
  const chemistryDischargeFactor = Math.pow(
    batteryChemSpec.maxContinuousCRate / 3.8,
    0.20,
  );
  const batteryDischargeDeliveryRatio = Math.min(
    1.25,
    Math.max(0.72, capacityFactor * chemistryDischargeFactor),
  );

  // Coppia e Potenza meccanica del comparto elettrico (scala lineare esatta: 1.0x, 2.0x, 3.0x, 4.0x, o 0.92x):
  const rawCompartmentPowerHp =
    unitMotor.peakPowerHp * linearOutputMultiplier * systemArchitectureFactor;
  const rawCompartmentTorqueNm =
    unitMotor.peakTorqueNm * linearOutputMultiplier * systemArchitectureFactor;

  // Potenza elettrica massima limitata/sostenuta dalla scarica della batteria selezionata:
  const maxBatterySupportedElectricHp = Math.max(
    12,
    Math.round(
      Math.min(
        batteryPack.maxDischargePowerHp * motorCount,
        rawCompartmentPowerHp * batteryDischargeDeliveryRatio,
      ),
    ),
  );

  const peakElectricPowerHp = Math.max(12, Math.round(maxBatterySupportedElectricHp));
  const peakElectricPowerKw = Math.max(9, Math.round(peakElectricPowerHp * 0.7355));
  const peakElectricTorqueNm = Math.max(
    20,
    Math.round(rawCompartmentTorqueNm * batteryDischargeDeliveryRatio),
  );

  const coolingSpec =
    ELECTRIC_COOLING_SYSTEMS.find((c) => c.id === bench.motor.coolingSystem) ??
    ELECTRIC_COOLING_SYSTEMS[1];
  const continuousPowerKw = Math.round(
    peakElectricPowerKw * coolingSpec.continuousPowerRatio,
  );

  // Regime di Field Weakening (invariante rispetto a 1.0x / 2.0x / 3.0x / 4.0x!):
  const cornerSpeedRpm = unitMotor.cornerSpeedRpm;
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
  } = params;

  const redlineRpm = coupledIce.redlineRpm;
  const minIceRpm = coupledIce.curve[0]?.rpm ?? 1000;
  const stepRpm = 100;

  // Potenza elettrica massima erogabile (limitata dalla potenza di scarica massima della batteria selezionata):
  const effectiveMaxEvPowerHp = Math.min(
    peakElectricPowerHp,
    maxBatterySupportedElectricHp,
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

    if (rpm <= hybridTransitionRpm) {
      // Regione a coppia costante (Torque Fill pieno ai bassi e medi regimi):
      const rawTorqueNm = peakElectricTorqueNm;
      const rawPowerHp = (rawTorqueNm * rpm) / 7023.5;
      // Verifica il limite di potenza di scarica massima della batteria a questo RPM:
      evPowerContributionHp = Math.round(Math.min(rawPowerHp, effectiveMaxEvPowerHp));
      evTorqueContributionNm =
        rawPowerHp > effectiveMaxEvPowerHp
          ? Math.round((evPowerContributionHp * 7023.5) / rpm)
          : Math.round(rawTorqueNm);
    } else {
      // Regione di Field Weakening / Potenza Elettrica Costante limitata dalla batteria:
      // La potenza elettrica raggiunge il plateau effectiveMaxEvPowerHp e la coppia scende come 1/RPM
      const progressAboveTransition =
        (rpm - hybridTransitionRpm) / Math.max(1, redlineRpm - hybridTransitionRpm);
      const targetEvPowerHp = Math.min(
        effectiveMaxEvPowerHp,
        Math.round(
          ((peakElectricTorqueNm * hybridTransitionRpm) / 7023.5) *
            (1 - progressAboveTransition) +
            effectiveMaxEvPowerHp * progressAboveTransition,
        ),
      );
      evPowerContributionHp = Math.max(
        Math.min(
          effectiveMaxEvPowerHp,
          Math.round((peakElectricTorqueNm * hybridTransitionRpm) / 7023.5),
        ),
        targetEvPowerHp,
      );
      evTorqueContributionNm = Math.round((evPowerContributionHp * 7023.5) / rpm);
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
): ElectricHybridGeometryMetrics {
  const bench = toPowertrainBenchConfig(configInput);
  const unitMotor = calculateSingleElectricMotorMetrics(bench.motor);
  const batteryPack = calculateBatteryPackMetrics(bench.battery, bench.systemType);

  const motorDimensionsMm = unitMotor.dimensionsMm;
  const inverterDimensionsMm = unitMotor.inverterDimensionsMm;
  const batteryDimensionsMm = batteryPack.dimensionsMm;
  const isAxialFlux = bench.motor.electricMotorType === 'AxialFlux';

  let bayLengthMm: number;
  let bayWidthMm: number;
  let bayHeightMm: number;

  if (bench.systemType === 'PureEV') {
    bayLengthMm = Math.round(motorDimensionsMm.lengthMm + 130);
    bayWidthMm = Math.round(motorDimensionsMm.widthMm + 115);
    bayHeightMm = Math.round(
      motorDimensionsMm.heightMm + inverterDimensionsMm.heightMm + 35,
    );
  } else {
    const iceDims = coupledIce?.dimensionsMm ?? {
      lengthMm: 465,
      widthMm: 580,
      heightMm: 620,
    };
    const hybridModuleAddLengthMm =
      bench.systemType === 'MHEV' ? 45 : isAxialFlux ? 75 : 115;

    bayLengthMm = Math.round(iceDims.lengthMm + hybridModuleAddLengthMm);
    bayWidthMm = Math.round(Math.max(iceDims.widthMm, motorDimensionsMm.widthMm + 60));
    bayHeightMm = Math.round(Math.max(iceDims.heightMm, motorDimensionsMm.heightMm + 80));
  }

  return {
    motorDimensionsMm,
    batteryDimensionsMm,
    inverterDimensionsMm,
    engineBayDimensionsMm: {
      lengthMm: bayLengthMm,
      widthMm: bayWidthMm,
      heightMm: bayHeightMm,
    },
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
  const coolingSpec =
    ELECTRIC_COOLING_SYSTEMS.find((c) => c.id === bench.motor.coolingSystem) ??
    ELECTRIC_COOLING_SYSTEMS[1];

  // 1. Costo Pacco Batteria ($/kWh puro: LFP 75, NMC811 110, NCA 135, SolidState 190):
  const batteryCost = batteryPack.cellsCost;

  // 2. Costo Motori Elettrici (esattamente proporzionale al numero di motori: 1x, 2x, 3x, 4x;
  // zero dipendenza da posizionamento Anteriore/Posteriore o orientamento Trasversale/Longitudinale):
  const mechanicalShaftAddonCost = hasMechanicalAwdShaft ? 650 : 0;
  const disconnectAddonCost =
    bench.hasFrontDisconnect && motorCount >= 2 ? 320 : 0;

  const motorSystemCost = Math.round(
    unitMotor.motorHardwareCost * motorCount +
      mechanicalShaftAddonCost +
      disconnectAddonCost,
  );

  // 3. Costo Inverter + Gestione Termica:
  const inverterAndCoolingCost = Math.round(
    (unitMotor.inverterAndCoolingCost - coolingSpec.cost * 0.45) *
      (1 + (motorCount - 1) * 0.65) +
      coolingSpec.cost,
  );

  // 4. Costo Motore Termico/Wankel Accoppiato (se Ibrido):
  let coupledIceCost = 0;
  if (systemSpec.hasIceEngine) {
    coupledIceCost =
      coupledIce?.unitProductionCost ??
      REFERENCE_HYBRID_ICE_ENGINES[1].unitProductionCost;
  }

  const unitProductionCost = Math.round(
    batteryCost + motorSystemCost + inverterAndCoolingCost + coupledIceCost,
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
  const coolingSpec =
    ELECTRIC_COOLING_SYSTEMS.find((c) => c.id === bench.motor.coolingSystem) ??
    ELECTRIC_COOLING_SYSTEMS[1];
  const voltageSpec =
    VOLTAGE_ARCHITECTURES.find((v) => v.voltage === bench.motor.voltageArchitecture) ??
    VOLTAGE_ARCHITECTURES[0];
  const tierSpec = PRICE_TIER_EV_SPECS[bench.motor.priceTier] ?? PRICE_TIER_EV_SPECS.Media;
  const classSpec =
    REFERENCE_CLASS_EV_SPECS[bench.motor.referenceClass] ??
    REFERENCE_CLASS_EV_SPECS.Normale;
  const systemSpec =
    HYBRID_SYSTEM_TYPES.find((s) => s.id === bench.systemType) ??
    HYBRID_SYSTEM_TYPES[0];

  const coupledIce = systemSpec.hasIceEngine
    ? (coupledIceInput ?? REFERENCE_HYBRID_ICE_ENGINES[1])
    : undefined;

  // 1. Calcolo metriche comparto elettrico separato (Motore Singolo * Scala Lineare Banco + Batteria):
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
    cornerSpeedRpm,
    maxMotorRpm,
    cRatePeak,
  } = calculateElectricOutputMetrics(bench);

  // 2. Generazione Curva Dinamometrica:
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
    redlineRpm = maxMotorRpm;
    const stepRpm = 250;

    for (let rpm = 0; rpm <= maxMotorRpm; rpm += stepRpm) {
      let currentTorqueNm: number;
      let currentPowerHp: number;

      if (rpm <= cornerSpeedRpm) {
        currentTorqueNm = peakElectricTorqueNm;
        currentPowerHp = Math.min(
          peakElectricPowerHp,
          Math.round((currentTorqueNm * rpm) / 7023.5),
        );
      } else {
        currentPowerHp = peakElectricPowerHp;
        currentTorqueNm = Math.round((peakElectricPowerHp * 7023.5) / rpm);
      }

      curve.push({
        rpm,
        torqueNm: currentTorqueNm,
        powerHp: currentPowerHp,
      });

      if (currentTorqueNm > peakTorqueNm) {
        peakTorqueNm = currentTorqueNm;
        peakTorqueRpm = rpm;
      }
      if (currentPowerHp > peakPowerHp) {
        peakPowerHp = currentPowerHp;
        peakPowerRpm = rpm;
      }
    }
  } else if (coupledIce) {
    // SISTEMI IBRIDI (MHEV, FullHybrid, PHEV):
    // Usa l'algoritmo dedicato che calcola prima la curva reale del comparto elettrico a ogni step di RPM
    // (limitata dalla potenza di scarica massima della batteria selezionata) e la somma positivamente
    // alla curva del motore termico/Wankel scelto, ricalcolando i CV da CV = (Nm_totali * RPM) / 7023.5!
    const combinedResult = generateCombinedHybridDynoCurve({
      coupledIce,
      peakElectricTorqueNm,
      peakElectricPowerHp,
      maxBatterySupportedElectricHp,
      cornerSpeedRpm,
      maxMotorRpm,
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

  // 3. Pesi del Powertrain (kg):
  const motorWeightKg = Math.round(
    unitMotor.dryWeightKg * motorCount + layoutSpec.extraHardwareWeightKg,
  );
  const batteryWeightKg = batteryPack.weightKg;
  const electronicsAndThermalKg = Math.round(
    voltageSpec.cableWeightKg +
      coolingSpec.weightKg +
      classSpec.extraStructuralWeightKg,
  );

  const iceDryWeightKg = coupledIce ? coupledIce.dryWeightKg : 0;
  const iceWetWeightKg = coupledIce ? coupledIce.wetWeightKg : 0;

  const dryWeightKg = Math.max(
    45,
    Math.round(
      motorWeightKg +
        batteryWeightKg +
        Math.max(8, electronicsAndThermalKg - coolingSpec.weightKg) +
        iceDryWeightKg,
    ),
  );
  const wetWeightKg = Math.max(
    52,
    Math.round(motorWeightKg + batteryWeightKg + electronicsAndThermalKg + iceWetWeightKg),
  );

  // 4. Efficienza del Sistema (%) e Consumi Energetici Reali (Wh/km e kWh/100km):
  const hasLowDragFrontAxle =
    motorTypeSpec.hasZeroDragWhenCoasting || Boolean(bench.hasFrontDisconnect);

  const drivetrainConsumptionMult = hasMechanicalAwdShaft
    ? 1.087 // Penalità attrito albero di trasmissione meccanico AWD (-8% resa)
    : layoutSpec.id === 'DualMotor_eAWD' && hasLowDragFrontAxle
      ? layoutSpec.consumptionPenaltyWithDisconnect
      : layoutSpec.id === 'TriMotor_TorqueVectoring' && hasLowDragFrontAxle
        ? layoutSpec.consumptionPenaltyWithDisconnect
        : layoutSpec.consumptionPenaltyMultiplier;

  const rawSystemEfficiency =
    (hasMechanicalAwdShaft ? 85.1 : layoutSpec.baseSystemEfficiencyPercent) *
      (motorTypeSpec.baseEfficiencyPercent / 95.5) *
      (tierSpec.inverterEfficiencyPercent / 93.5) +
    voltageSpec.efficiencyBonusPercent * 0.5 +
    (layoutSpec.id === 'DualMotor_eAWD' && hasLowDragFrontAxle ? 2.1 : 0);

  const systemEfficiencyPercent = Number(
    Math.min(96.5, Math.max(78.0, rawSystemEfficiency)).toFixed(1),
  );

  const baseWhPerKmAtRwd =
    118 + (wetWeightKg / 1000) * 38 + peakElectricPowerKw * 0.032;

  const efficiencyWhPerKm = Math.round(
    baseWhPerKmAtRwd *
      drivetrainConsumptionMult *
      tierSpec.consumptionMultiplier *
      (95.5 / motorTypeSpec.baseEfficiencyPercent) *
      (1 - voltageSpec.efficiencyBonusPercent / 100),
  );
  const efficiencyKwhPer100Km = Number((efficiencyWhPerKm / 10).toFixed(1));

  const estimatedRangeKm = Math.max(
    2,
    Math.round((batteryPack.usableCapacityKwh * 1000) / Math.max(90, efficiencyWhPerKm)),
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

  // 6. Affidabilità Dinamica (58% - 94%) e Durata Stimata in Km:
  const cRateExcess = Math.max(0, cRatePeak - batteryChemSpec.maxContinuousCRate);
  const cRateReliabilityPenalty = Math.min(12.0, cRateExcess * 2.2);
  const multiMotorComplexityPenalty = (motorCount - 1) * 1.4;

  let rawReliability =
    unitMotor.reliabilityPercent * 0.45 +
    batteryPack.reliabilityPercent * 0.55 -
    cRateReliabilityPenalty -
    multiMotorComplexityPenalty;

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
          tierSpec.consumptionMultiplier,
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
  };
}
