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
  CoupledIceEngineOption,
  DimensionsLWH,
  DualCurrencyCost,
  DynoCurvePoint,
  ElectricHybridEngineConfigInput,
  ElectricHybridSpecs,
  EngineDynoTelemetry,
} from '../types/gameTypes';

export interface ElectricHybridGeometryMetrics {
  motorDimensionsMm: DimensionsLWH;
  batteryDimensionsMm: DimensionsLWH;
  inverterDimensionsMm: DimensionsLWH;
  /** Ingombro complessivo del gruppo propulsore nel vano motore per la verifica collisione (mm) */
  engineBayDimensionsMm: DimensionsLWH;
  /** Volume attivo statore/rotore in cm³ (cc) */
  statorVolumeCc: number;
}

export interface EvHybridSimulationResult extends EngineDynoTelemetry {
  specs: ElectricHybridSpecs;
  /** Curva del solo motore termico/Wankel (per grafico ibrido combinato) */
  iceOnlyCurve?: DynoCurvePoint[];
  /** Curva del solo contributo elettrico (per grafico ibrido combinato) */
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
    return { torqueNm: curve[0].torqueNm, powerHp: curve[0].powerHp };
  }
  const last = curve[curve.length - 1];
  if (targetRpm >= last.rpm) {
    return { torqueNm: last.torqueNm, powerHp: last.powerHp };
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
  return { torqueNm: last.torqueNm, powerHp: last.powerHp };
}

/**
 * Calcola l'ingombro tridimensionale (LWH mm) dei motori elettrici, dell'inverter,
 * del pacco batterie e del gruppo propulsore complessivo installato nel vano motore.
 */
export function calculateElectricHybridGeometryAndDimensions(
  config: ElectricHybridEngineConfigInput,
  coupledIce?: CoupledIceEngineOption,
): ElectricHybridGeometryMetrics {
  const Ds = Math.max(140, Math.min(360, config.statorDiameterMm));
  const Lr = Math.max(70, Math.min(300, config.rotorLengthMm));

  // FIX SCALA: Ds/20 è il raggio in cm, Lr/10 è la lunghezza in cm -> il prodotto è GIÀ in cm³ (cc)!
  const statorVolumeCc = Math.round(Math.PI * Math.pow(Ds / 20, 2) * (Lr / 10));

  // 1. Ingombro singola unità motrice elettrica (mm):
  // I motori a Flusso Assiale hanno spessore assiale ridottissimo ("pancake" ~90-115 mm)
  const isAxialFlux = config.electricMotorType === 'AxialFlux';
  const motorDiameterMm = Math.round(Ds + 38);
  const motorLengthMm = Math.round(isAxialFlux ? 85 + Lr * 0.22 : Lr + 80);

  const motorDimensionsMm: DimensionsLWH = {
    lengthMm: motorLengthMm,
    widthMm: motorDiameterMm,
    heightMm: motorDiameterMm,
  };

  // 2. Ingombro Inverter di potenza governato da PriceTier:
  const tierSpec = PRICE_TIER_EV_SPECS[config.priceTier] ?? PRICE_TIER_EV_SPECS.Media;
  const isSiC = tierSpec.mappedInverterTech === 'SiliconCarbide_SiC';
  const isGaN = tierSpec.mappedInverterTech === 'GalliumNitride_GaN';

  const inverterDimensionsMm: DimensionsLWH = {
    lengthMm: Math.round(isGaN ? 185 : isSiC ? 235 : 295),
    widthMm: Math.round(isGaN ? 165 : isSiC ? 215 : 265),
    heightMm: Math.round(isGaN ? 70 : isSiC ? 90 : 120),
  };

  // 3. Ingombro Pacco Batteria:
  let batteryDimensionsMm: DimensionsLWH;
  if (config.systemType === 'PureEV') {
    const kwh = Math.max(20, config.batteryCapacityKwh);
    const kwhScale = Math.pow(kwh / 75.0, 0.42);
    batteryDimensionsMm = {
      lengthMm: Math.round(1420 * kwhScale),
      widthMm: 1160,
      heightMm: Math.round(110 + (kwh > 85 ? 22 : 0)),
    };
  } else if (config.systemType === 'MHEV') {
    batteryDimensionsMm = { lengthMm: 290, widthMm: 200, heightMm: 135 };
  } else if (config.systemType === 'FullHybrid') {
    batteryDimensionsMm = { lengthMm: 460, widthMm: 330, heightMm: 180 };
  } else {
    const kwh = Math.max(10, config.batteryCapacityKwh);
    const kwhScale = Math.pow(kwh / 20.0, 0.46);
    batteryDimensionsMm = {
      lengthMm: Math.round(690 * kwhScale),
      widthMm: Math.round(460 * kwhScale),
      heightMm: 225,
    };
  }

  // 4. Ingombro nel vano motore per verifica collisione col Pianale (mm):
  let bayLengthMm: number;
  let bayWidthMm: number;
  let bayHeightMm: number;

  if (config.systemType === 'PureEV') {
    // Nel BEV il vano ospita l'e-Axle (motore + riduttore epicicloidale + inverter sopra)
    bayLengthMm = Math.round(motorDimensionsMm.lengthMm + 130);
    bayWidthMm = Math.round(motorDimensionsMm.widthMm + 115);
    bayHeightMm = Math.round(motorDimensionsMm.heightMm + inverterDimensionsMm.heightMm + 35);
  } else {
    // Negli Ibridi il vano ospita il motore Termico/Wankel scelto + il modulo elettrico accoppiato
    const iceDims = coupledIce?.dimensionsMm ?? {
      lengthMm: 465,
      widthMm: 580,
      heightMm: 620,
    };
    const hybridModuleAddLengthMm =
      config.systemType === 'MHEV'
        ? 45
        : isAxialFlux
          ? 75
          : 115;

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
    statorVolumeCc,
  };
}

/**
 * Calcola la Potenza Elettrica di Picco (CV e kW), la Coppia Elettrica (Nm) e il regime di Field Weakening
 * in base a geometria statore/rotore, tipologia motore, configurazione 1/2/3/4 motori,
 * architettura di tensione (400V / 800V / 1000V+), PriceTier e ReferenceClass.
 */
export function calculateElectricOutputMetrics(config: ElectricHybridEngineConfigInput): {
  peakElectricPowerHp: number;
  peakElectricPowerKw: number;
  continuousPowerKw: number;
  peakElectricTorqueNm: number;
  cornerSpeedRpm: number;
  maxMotorRpm: number;
  cRatePeak: number;
} {
  const motorSpec =
    ELECTRIC_MOTOR_TYPES.find((m) => m.id === config.electricMotorType) ??
    ELECTRIC_MOTOR_TYPES[0];
  const layoutSpec =
    MOTOR_LAYOUT_CONFIGS.find((l) => l.id === config.motorLayout) ??
    MOTOR_LAYOUT_CONFIGS[0];
  const coolingSpec =
    ELECTRIC_COOLING_SYSTEMS.find((c) => c.id === config.coolingSystem) ??
    ELECTRIC_COOLING_SYSTEMS[1];
  const voltageSpec =
    VOLTAGE_ARCHITECTURES.find((v) => v.voltage === config.voltageArchitecture) ??
    VOLTAGE_ARCHITECTURES[0];
  const tierSpec = PRICE_TIER_EV_SPECS[config.priceTier] ?? PRICE_TIER_EV_SPECS.Media;
  const classSpec =
    REFERENCE_CLASS_EV_SPECS[config.referenceClass] ?? REFERENCE_CLASS_EV_SPECS.Normale;

  const geom = calculateElectricHybridGeometryAndDimensions(config);

  // Fattore geometrico normalizzato sul volume statore/rotore (rif. 230x160mm = 6648 cc):
  // Da 0.34 (150x80mm citycar) fino a 2.38 (340x280mm hypercar)
  const sizeFactor = Math.pow(geom.statorVolumeCc / 6648, 0.65);

  // Potenza base di un singolo motore di riferimento (185 CV a sizeFactor = 1.0):
  const rawSingleMotorHp =
    185 *
    sizeFactor *
    motorSpec.powerMultiplier *
    voltageSpec.powerMultiplier *
    tierSpec.powerMultiplier *
    classSpec.powerMultiplier;

  // Moltiplicatore layout (Single RWD 1.0x, Single FWD 0.95x, Dual 1.88x, Tri 2.75x, Quad 3.68x):
  let rawTotalElectricHp = rawSingleMotorHp * layoutSpec.totalOutputMultiplier;

  // Adattamento per architetture ibride leggere vs trazione primaria:
  if (config.systemType === 'MHEV') {
    // Starter-generatore 48V: tipicamente tra 16 e 65 CV di assistenza
    rawTotalElectricHp = Math.min(68, Math.max(16, rawTotalElectricHp * 0.18));
  } else if (config.systemType === 'FullHybrid') {
    // Full Hybrid HEV: limitato anche dalla scarica della batteria compatta (1.5 - 6.5 kWh)
    const maxBatteryHp = config.batteryCapacityKwh * 38 * classSpec.powerMultiplier;
    rawTotalElectricHp = Math.min(maxBatteryHp, Math.max(45, rawTotalElectricHp * 0.55));
  } else if (config.systemType === 'PHEV') {
    // Plug-in Hybrid: consente potenze elettriche elevate compatibili con la batteria (10 - 45 kWh)
    const maxPhevBatteryHp = config.batteryCapacityKwh * 42 * classSpec.powerMultiplier;
    rawTotalElectricHp = Math.min(maxPhevBatteryHp, Math.max(95, rawTotalElectricHp));
  } else {
    // PureEV e RangeExtender: rispettano i range fisici realistici di ogni layout!
    if (layoutSpec.motorCount === 1) {
      rawTotalElectricHp = Math.max(60, Math.min(540, rawTotalElectricHp));
    } else if (layoutSpec.motorCount === 2) {
      rawTotalElectricHp = Math.max(240, Math.min(960, rawTotalElectricHp));
    } else if (layoutSpec.motorCount === 3) {
      rawTotalElectricHp = Math.max(580, Math.min(1380, rawTotalElectricHp));
    } else if (layoutSpec.motorCount === 4) {
      rawTotalElectricHp = Math.max(980, Math.min(2450, rawTotalElectricHp));
    }
  }

  const peakElectricPowerHp = Math.round(rawTotalElectricHp);
  const peakElectricPowerKw = Math.round(peakElectricPowerHp * 0.7355);

  // Regime di Field Weakening (Corner Speed RPM, tra 5.500 e 9.500 RPM):
  // Motori più grandi o tarature Fuoristrada/Coppia anticipano leggermente il corner RPM dando più Nm in basso
  const sizeCornerShift = Math.round((1.0 - Math.min(1.5, sizeFactor)) * 450);
  const classCornerShift =
    config.referenceClass === 'Fuoristrada'
      ? -750
      : config.referenceClass === 'Corsa'
        ? +350
        : 0;
  const torqueVsPowerShift = Math.round(
    (motorSpec.powerMultiplier / motorSpec.torqueMultiplier - 1.0) * 600,
  );

  const cornerSpeedRpm = Math.max(
    5500,
    Math.min(
      9500,
      Math.round(
        motorSpec.baseCornerRpm +
          voltageSpec.cornerSpeedBonusRpm * 0.65 +
          sizeCornerShift +
          classCornerShift +
          torqueVsPowerShift,
      ),
    ),
  );

  // Coppia massima all'albero motore elettrico (Nm) fisicamente coerente con P = (T * RPM_corner) / 7023.5:
  // In questo modo a cornerSpeedRpm la curva di coppia piatta si raccorda con continuità C1 perfetta al plateau di potenza!
  const torqueBoostFactor =
    (motorSpec.torqueMultiplier / motorSpec.powerMultiplier) *
    (classSpec.torqueMultiplier / classSpec.powerMultiplier);

  // Regoliamo cornerSpeed effettivo per riflettere l'eventuale surplus di coppia (es. Fuoristrada o PSM/AxialFlux/QuadMotor)
  const multiMotorTorqueFactor =
    layoutSpec.motorCount === 4
      ? 1.32
      : layoutSpec.motorCount === 3
        ? 1.18
        : 1.0;

  const effectiveCornerSpeedRpm = Math.max(
    5500,
    Math.min(
      9500,
      Math.round(cornerSpeedRpm / Math.max(0.82, torqueBoostFactor * multiMotorTorqueFactor)),
    ),
  );

  const peakElectricTorqueNm = Math.max(
    config.systemType === 'MHEV' ? 55 : 110,
    Math.round((peakElectricPowerHp * 7023.5) / effectiveCornerSpeedRpm),
  );

  // Potenza continua sostenibile termicamente (kW):
  const continuousPowerKw = Math.round(
    peakElectricPowerKw * coolingSpec.continuousPowerRatio,
  );

  // Regime massimo di rotazione (14.000 - 22.000 RPM):
  const maxMotorRpm = Math.max(
    14000,
    Math.min(22000, Math.min(motorSpec.maxSafeRpm, config.maxMotorRpm || motorSpec.maxSafeRpm)),
  );

  // Stress di scarica batteria di picco (C-Rate = kW_picco / kWh_batteria):
  const cRatePeak = Number(
    (peakElectricPowerKw / Math.max(0.8, config.batteryCapacityKwh)).toFixed(2),
  );

  return {
    peakElectricPowerHp,
    peakElectricPowerKw,
    continuousPowerKw,
    peakElectricTorqueNm,
    cornerSpeedRpm: effectiveCornerSpeedRpm,
    maxMotorRpm,
    cRatePeak,
  };
}

/**
 * Punto 4: Calcola i costi realistici del pacco batteria ($/kWh: LFP 75, NMC 110, NCA 135, SolidState 190),
 * i costi unitari di produzione e i costi di sviluppo R&D.
 */
export function calculateElectricHybridCosts(
  config: ElectricHybridEngineConfigInput,
  coupledIce?: CoupledIceEngineOption,
): {
  unitProductionCost: number;
  batteryCost: number;
  motorSystemCost: number;
  inverterAndCoolingCost: number;
  coupledIceCost: number;
  developmentCost: DualCurrencyCost;
} {
  const motorSpec =
    ELECTRIC_MOTOR_TYPES.find((m) => m.id === config.electricMotorType) ??
    ELECTRIC_MOTOR_TYPES[0];
  const layoutSpec =
    MOTOR_LAYOUT_CONFIGS.find((l) => l.id === config.motorLayout) ??
    MOTOR_LAYOUT_CONFIGS[0];
  const batterySpec =
    BATTERY_CHEMISTRIES.find((b) => b.id === config.batteryChemistry) ??
    BATTERY_CHEMISTRIES[0];
  const coolingSpec =
    ELECTRIC_COOLING_SYSTEMS.find((c) => c.id === config.coolingSystem) ??
    ELECTRIC_COOLING_SYSTEMS[1];
  const voltageSpec =
    VOLTAGE_ARCHITECTURES.find((v) => v.voltage === config.voltageArchitecture) ??
    VOLTAGE_ARCHITECTURES[0];
  const tierSpec = PRICE_TIER_EV_SPECS[config.priceTier] ?? PRICE_TIER_EV_SPECS.Media;
  const systemSpec =
    HYBRID_SYSTEM_TYPES.find((s) => s.id === config.systemType) ??
    HYBRID_SYSTEM_TYPES[0];

  const { peakElectricPowerKw } = calculateElectricOutputMetrics(config);

  // 1. Costo realistico Pacco Batteria ($/kWh puro: es. 40 kWh LFP * 75 $/kWh = $3.000!):
  const batteryCost = Math.round(config.batteryCapacityKwh * batterySpec.costPerKwh);

  // 2. Costo Motori Elettrici:
  const singleMotorKw = peakElectricPowerKw / Math.max(1, layoutSpec.motorCount);
  const motorBaseCost = Math.round(
    (280 + singleMotorKw * motorSpec.costPerKw) *
      layoutSpec.motorCount *
      (config.hasFrontDisconnect && layoutSpec.id === 'DualMotor_eAWD' ? 1.08 : 1.0),
  );
  const motorSystemCost = Math.round(motorBaseCost);

  // 3. Costo Elettronica di Potenza (Inverter governato da PriceTier) + Raffreddamento + Alta Tensione:
  const inverterCost = Math.round(
    tierSpec.electronicsCostBase *
      (1 + (layoutSpec.motorCount - 1) * 0.55) *
      voltageSpec.costMultiplier,
  );
  const inverterAndCoolingCost = Math.round(inverterCost + coolingSpec.cost);

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
  const chemistryComplexity =
    config.batteryChemistry === 'SolidState'
      ? 1.65
      : config.batteryChemistry === 'NCA'
        ? 1.2
        : 1.0;
  const motorComplexity =
    config.electricMotorType === 'AxialFlux'
      ? 1.55
      : config.electricMotorType === 'IPM_SynRM'
        ? 1.2
        : 1.0;
  const tierRdMultiplier =
    config.priceTier === 'Lusso'
      ? 1.6
      : config.priceTier === 'Premium'
        ? 1.25
        : config.priceTier === 'Economica'
          ? 0.75
          : 1.0;

  const globalComplexity =
    systemSpec.complexityFactor *
    voltageSpec.costMultiplier *
    chemistryComplexity *
    motorComplexity *
    tierRdMultiplier *
    (1 + (layoutSpec.motorCount - 1) * 0.18);

  const capitalCost = Math.round(systemSpec.unlockCost.capitalCost * globalComplexity);
  const rdCost = Math.round(systemSpec.unlockCost.rdCost * globalComplexity);

  return {
    unitProductionCost,
    batteryCost,
    motorSystemCost,
    inverterAndCoolingCost,
    coupledIceCost,
    developmentCost: {
      capitalCost,
      rdCost,
      minYear: Math.max(
        systemSpec.minYear,
        motorSpec.minYear,
        batterySpec.minYear,
        coolingSpec.minYear,
      ),
    },
  };
}

/**
 * Simulazione completa del Banco Prova Elettrico e Ibrido (Modulo 1C):
 * - Punto 1: Fisica potenza/coppia reale e curva dinamometrica con Field Weakening (legge 1/RPM).
 * - Punto 2: Efficienza e consumi reali (Single RWD > Single FWD > Dual AWD > Tri/Quad AWD).
 * - Punto 3: Affidabilità dinamica (58% - 94%) e durata reale in km (stop ai 3 milioni di km!).
 * - Punto 5: Impatto reale di PriceTier (IGBT 86% -> SiC 97.5%) e ReferenceClass.
 * - Punto 6: Integrazione e sovrapposizione curva con il Motore Termico/Wankel scelto per MHEV/HEV/PHEV/EREV.
 */
export function simulateElectricHybridDyno(
  config: ElectricHybridEngineConfigInput,
  coupledIceInput?: CoupledIceEngineOption,
): EvHybridSimulationResult {
  const motorSpec =
    ELECTRIC_MOTOR_TYPES.find((m) => m.id === config.electricMotorType) ??
    ELECTRIC_MOTOR_TYPES[0];
  const layoutSpec =
    MOTOR_LAYOUT_CONFIGS.find((l) => l.id === config.motorLayout) ??
    MOTOR_LAYOUT_CONFIGS[0];
  const batterySpec =
    BATTERY_CHEMISTRIES.find((b) => b.id === config.batteryChemistry) ??
    BATTERY_CHEMISTRIES[0];
  const coolingSpec =
    ELECTRIC_COOLING_SYSTEMS.find((c) => c.id === config.coolingSystem) ??
    ELECTRIC_COOLING_SYSTEMS[1];
  const voltageSpec =
    VOLTAGE_ARCHITECTURES.find((v) => v.voltage === config.voltageArchitecture) ??
    VOLTAGE_ARCHITECTURES[0];
  const tierSpec = PRICE_TIER_EV_SPECS[config.priceTier] ?? PRICE_TIER_EV_SPECS.Media;
  const classSpec =
    REFERENCE_CLASS_EV_SPECS[config.referenceClass] ?? REFERENCE_CLASS_EV_SPECS.Normale;
  const systemSpec =
    HYBRID_SYSTEM_TYPES.find((s) => s.id === config.systemType) ??
    HYBRID_SYSTEM_TYPES[0];

  const coupledIce = systemSpec.hasIceEngine
    ? (coupledIceInput ?? REFERENCE_HYBRID_ICE_ENGINES[1])
    : undefined;

  // 1. Metriche di potenza e coppia elettrica:
  const {
    peakElectricPowerHp,
    peakElectricPowerKw,
    continuousPowerKw,
    peakElectricTorqueNm,
    cornerSpeedRpm,
    maxMotorRpm,
    cRatePeak,
  } = calculateElectricOutputMetrics(config);

  // 2. Generazione Curva Dinamometrica:
  const curve: DynoCurvePoint[] = [];
  const iceOnlyCurve: DynoCurvePoint[] = [];
  const electricOnlyCurve: DynoCurvePoint[] = [];

  let peakPowerHp = 0;
  let peakPowerRpm = 0;
  let peakTorqueNm = 0;
  let peakTorqueRpm = 0;
  let redlineRpm = maxMotorRpm;

  if (config.systemType === 'PureEV' || config.systemType === 'RangeExtender') {
    // TRAZIONE 100% ELETTRICA ALLE RUOTE (BEV e Range Extender EREV):
    // Da 0 RPM fino a cornerSpeedRpm: Coppia 100% costante, Potenza sale linearmente.
    // Da cornerSpeedRpm fino a maxMotorRpm: Potenza costante a plateau, Coppia scende con legge 1 / RPM!
    redlineRpm = maxMotorRpm;
    const stepRpm = 250;

    for (let rpm = 0; rpm <= maxMotorRpm; rpm += stepRpm) {
      let currentTorqueNm: number;
      let currentPowerHp: number;

      if (rpm <= cornerSpeedRpm) {
        currentTorqueNm = peakElectricTorqueNm;
        currentPowerHp = Math.round((currentTorqueNm * rpm) / 7023.5);
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
    // SISTEMI IBRIDI PARALLELI / SERIE-PARALLELI (MHEV 48V, Full Hybrid HEV, Plug-in Hybrid PHEV):
    // Somma sul grafico la curva reale del Motore Termico/Wankel scelto con la spinta del motore elettrico!
    redlineRpm = coupledIce.redlineRpm;
    const minIceRpm = coupledIce.curve[0]?.rpm ?? 1000;
    const stepRpm = 100;

    // Rapporto di accoppiamento giri tra motore elettrico e albero motore termico:
    const rpmCouplingRatio = maxMotorRpm / Math.max(4000, redlineRpm);

    for (let rpm = minIceRpm; rpm <= redlineRpm; rpm += stepRpm) {
      const iceSample = sampleCurveAtRpm(coupledIce.curve, rpm);
      const equivalentEvRpm = rpm * rpmCouplingRatio;

      // Curva del contributo elettrico riportato all'albero combinato:
      let evPowerContributionHp: number;
      let evTorqueContributionNm: number;

      if (config.systemType === 'MHEV') {
        // MHEV 48V: forte Torque Fill ai bassi regimi (1000 - 3000 RPM) per azzerare il turbo-lag,
        // poi sfuma progressivamente agli alti regimi dove l'ISG 48V raggiunge la saturazione di potenza
        const lowRpmFill =
          rpm <= 2600
            ? 1.0
            : Math.max(0.18, Math.exp(-Math.pow((rpm - 2600) / 2800, 1.6)));
        evTorqueContributionNm = Math.round(peakElectricTorqueNm * lowRpmFill);
        evPowerContributionHp = Math.min(
          peakElectricPowerHp,
          Math.round((evTorqueContributionNm * rpm) / 7023.5),
        );
        evTorqueContributionNm = Math.round((evPowerContributionHp * 7023.5) / rpm);
      } else {
        // HEV e PHEV: il motore elettrico eroga coppia piena fino al suo punto di Field Weakening
        // e poi mantiene il plateau di potenza elettrica costante fino al limitatore!
        if (equivalentEvRpm <= cornerSpeedRpm) {
          evTorqueContributionNm = peakElectricTorqueNm;
          evPowerContributionHp = Math.round(
            peakElectricPowerHp * (equivalentEvRpm / cornerSpeedRpm),
          );
        } else {
          evPowerContributionHp = peakElectricPowerHp;
          evTorqueContributionNm = Math.round(
            peakElectricTorqueNm * (cornerSpeedRpm / equivalentEvRpm),
          );
        }
      }

      const combinedTorqueNow = iceSample.torqueNm + evTorqueContributionNm;
      const combinedPowerNow = iceSample.powerHp + evPowerContributionHp;

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
  }

  // 3. Calcolo Pesi Reali del Powertrain (kg):
  // Peso motori elettrici (Axial Flux pesa -44% rispetto ai radiali!)
  const singleMotorWeightKg =
    (22 + (peakElectricPowerKw / Math.max(1, layoutSpec.motorCount)) * 0.21) *
    motorSpec.weightMultiplier;
  const motorWeightKg = Math.round(
    singleMotorWeightKg * layoutSpec.motorCount + layoutSpec.extraHardwareWeightKg,
  );

  // Peso pacco batteria (influenzato da densità Wh/kg e da ReferenceClass: Corsa -18%, Fuoristrada +6%):
  const batteryWeightKg = Math.round(
    ((config.batteryCapacityKwh * 1000) / batterySpec.cellDensityWhPerKg) *
      batterySpec.packagingMultiplier *
      classSpec.batteryPackWeightMultiplier,
  );

  // Peso inverter, cablaggi (800V/1000V più leggeri di 400V) e struttura (Fuoristrada blindato IP68 +46kg):
  const electronicsAndThermalKg = Math.round(
    layoutSpec.motorCount * (config.priceTier === 'Lusso' ? 5.5 : 9.0) +
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

  // 4. Punto 2: Efficienza del Sistema (%) e Consumi Energetici Reali (Wh/km e kWh/100km):
  // - Single RWD: configurazione più efficiente (base 92.5%, consumo 1.000x)
  // - Single FWD: -1.5% efficienza / +1.5% consumo (1.015x)
  // - Dual-Motor AWD: +8.5% consumo (ridotto a +4.0% se ASM a induzione o sgancio anteriore!)
  // - Tri-Motor / Quad-Motor: +14.5% / +17.5% consumo per attrito 3-4 riduttori e 4 inverter
  const hasLowDragFrontAxle =
    motorSpec.hasZeroDragWhenCoasting || Boolean(config.hasFrontDisconnect);

  const drivetrainConsumptionMult =
    layoutSpec.id === 'DualMotor_eAWD' && hasLowDragFrontAxle
      ? layoutSpec.consumptionPenaltyWithDisconnect // 1.04 (+4%)
      : layoutSpec.id === 'TriMotor_TorqueVectoring' && hasLowDragFrontAxle
        ? layoutSpec.consumptionPenaltyWithDisconnect
        : layoutSpec.consumptionPenaltyMultiplier;

  // Efficienza complessiva dell'asse elettrico (combinazione layout + tipo motore + inverter PriceTier + tensione):
  const rawSystemEfficiency =
    layoutSpec.baseSystemEfficiencyPercent *
    (motorSpec.baseEfficiencyPercent / 95.5) *
    (tierSpec.inverterEfficiencyPercent / 93.5) +
    voltageSpec.efficiencyBonusPercent * 0.5 +
    (layoutSpec.id === 'DualMotor_eAWD' && hasLowDragFrontAxle ? 2.1 : 0);

  const systemEfficiencyPercent = Number(
    Math.min(96.5, Math.max(78.0, rawSystemEfficiency)).toFixed(1),
  );

  // Consumo energetico Wh/km (e kWh/100km):
  const baseWhPerKmAtRwd =
    118 + (wetWeightKg / 1000) * 38 + peakElectricPowerKw * 0.032;

  const efficiencyWhPerKm = Math.round(
    baseWhPerKmAtRwd *
      drivetrainConsumptionMult *
      tierSpec.consumptionMultiplier *
      (95.5 / motorSpec.baseEfficiencyPercent) *
      (1 - voltageSpec.efficiencyBonusPercent / 100),
  );
  const efficiencyKwhPer100Km = Number((efficiencyWhPerKm / 10).toFixed(1));

  // Autonomia elettrica WLTP (km):
  const usableBufferRatio =
    config.referenceClass === 'Corsa'
      ? 0.98 // Corsa rimuove i buffer di sicurezza!
      : config.referenceClass === 'Sport'
        ? 0.94
        : 0.90; // Buffer protettivo 10% su Normale/Comfort
  const usableKwh = config.batteryCapacityKwh * usableBufferRatio;
  const estimatedRangeKm = Math.max(
    2,
    Math.round((usableKwh * 1000) / Math.max(90, efficiencyWhPerKm)),
  );

  // Bilancio Energetico specifico per Range Extender (EREV):
  let erevGeneratorOutputKw: number | undefined;
  let erevCruisingDemandKw: number | undefined;
  let erevGeneratorRpm: number | undefined;
  let erevSelfSustaining: boolean | undefined;
  let erevTotalCombinedRangeKm: number | undefined;

  if (config.systemType === 'RangeExtender' && coupledIce) {
    // Il motore termico/Wankel scelto lavora al regime fisso di miglior rendimento (65% del redline)
    erevGeneratorRpm = Math.round((coupledIce.redlineRpm * 0.62) / 100) * 100;
    const genSample = sampleCurveAtRpm(coupledIce.curve, erevGeneratorRpm);
    // Conversione meccanico -> elettrico tramite generatore sincrono (resa ~92%)
    erevGeneratorOutputKw = Math.round(genSample.powerHp * 0.7355 * 0.92);
    // Fabbisogno medio in crociera autostradale sostenuta (125 km/h):
    erevCruisingDemandKw = Math.round((efficiencyWhPerKm * 125) / 1000);
    erevSelfSustaining = erevGeneratorOutputKw >= erevCruisingDemandKw;
    // Autonomia combinata (Batteria EV + Serbatoio benzina 45L per generatore):
    const generatorRangeKm = Math.round(450 * (erevGeneratorOutputKw / Math.max(15, erevCruisingDemandKw) > 1 ? 1.15 : 0.85));
    erevTotalCombinedRangeKm = estimatedRangeKm + generatorRangeKm;
  }

  // 5. Punto 3: Affidabilità Dinamica (Range reale 58% - 94%) e Durata Reale in Km (STOP ai 3 milioni di km!):
  // Calcolo penalità da stress di scarica (C-Rate) e regime massimo dei cuscinetti:
  const cRateExcess = Math.max(0, cRatePeak - batterySpec.maxContinuousCRate);
  const cRateReliabilityPenalty = Math.min(12.0, cRateExcess * 2.2);

  // Usura cuscinetti/riduttore ad altissimi regimi (> 17.500 RPM):
  const highRpmBearingPenalty =
    maxMotorRpm > 17500 ? ((maxMotorRpm - 17500) / 1000) * 1.6 : 0;

  // Gestione classe Corsa e Sport con raffreddamento:
  // Se Corsa o Sport è supportata da Immersione Dielettrica Diretta, la penalità termica è dimezzata!
  let effectiveClassReliabilityDelta = classSpec.reliabilityDeltaPercent;
  if (
    (config.referenceClass === 'Corsa' || config.referenceClass === 'Sport') &&
    coolingSpec.protectsHighDischargeCorsa
  ) {
    effectiveClassReliabilityDelta *= 0.45;
  }

  // Penalità complessità multi-motore (4 motori + 4 inverter hanno più componenti rispetto a 1 motore):
  const multiMotorComplexityPenalty = (layoutSpec.motorCount - 1) * 1.4;

  let rawReliability =
    84.0 +
    batterySpec.reliabilityDeltaPercent +
    coolingSpec.reliabilityDeltaPercent + // Aria Passiva = -18%!
    tierSpec.reliabilityDeltaPercent + // Economica -5.5%, Lusso +6.0%
    effectiveClassReliabilityDelta -
    cRateReliabilityPenalty -
    highRpmBearingPenalty -
    multiMotorComplexityPenalty;

  // Se è un sistema Ibrido, l'affidabilità tiene conto anche del motore termico/Wankel accoppiato:
  if (systemSpec.hasIceEngine && coupledIce) {
    rawReliability = rawReliability * 0.62 + coupledIce.reliabilityPercent * 0.38 - 2.5;
  }

  const reliabilityPercent = Number(
    Math.min(94.0, Math.max(58.0, rawReliability)).toFixed(1),
  );

  // Calcolo Durata Stimata in Km (Fine vita utile al 75-80% SoH + usura inverter/cuscinetti/riduttore):
  // - LFP uso Normale/Comfort: 350.000 - 550.000 km
  // - NMC / Stato Solido uso Normale/Comfort: 220.000 - 360.000 km
  // - Configurazioni Sport ad alta scarica: 120.000 - 200.000 km
  // - Classe Corsa: 15.000 - 45.000 km
  const coolingLifespanFactor =
    config.coolingSystem === 'Air'
      ? 0.76
      : config.coolingSystem === 'DirectDielectric'
        ? 1.12
        : 1.0;

  const cRateLifespanFactor = Math.max(0.68, 1.0 - cRateExcess * 0.055);

  let estimatedLifespanKm: number;
  if (config.referenceClass === 'Corsa') {
    // Classe Corsa: rimuove i buffer batteria e spinge inverter al limite -> 15.000 - 45.000 km
    const corsaBaseKm =
      config.coolingSystem === 'DirectDielectric' ? 34_000 : 21_000;
    const rawCorsaKm = Math.round(
      corsaBaseKm *
        tierSpec.lifespanMultiplier *
        cRateLifespanFactor *
        (config.batteryChemistry === 'LFP' ? 1.15 : 1.0),
    );
    estimatedLifespanKm = Math.max(15_000, Math.min(45_000, rawCorsaKm));
  } else if (config.referenceClass === 'Sport') {
    // Classe Sport ad alta scarica: 120.000 - 200.000 km
    const sportBaseKm =
      config.batteryChemistry === 'LFP'
        ? 172_000
        : config.batteryChemistry === 'NCA'
          ? 138_000
          : 156_000;
    const rawSportKm = Math.round(
      sportBaseKm *
        tierSpec.lifespanMultiplier *
        coolingLifespanFactor *
        cRateLifespanFactor,
    );
    estimatedLifespanKm = Math.max(120_000, Math.min(200_000, rawSportKm));
  } else {
    // Uso Normale, Comfort o Fuoristrada:
    const classLifespanMult =
      config.referenceClass === 'Comfort'
        ? 1.08
        : config.referenceClass === 'Fuoristrada'
          ? 0.94
          : 1.0;
    const rawNormalKm = Math.round(
      batterySpec.baseLifespanKm *
        tierSpec.lifespanMultiplier *
        coolingLifespanFactor *
        cRateLifespanFactor *
        classLifespanMult,
    );

    if (config.batteryChemistry === 'LFP') {
      // LFP uso normale: 350.000 - 550.000 km
      estimatedLifespanKm = Math.max(350_000, Math.min(550_000, rawNormalKm));
    } else {
      // NMC / NCA / Stato Solido uso normale: 220.000 - 360.000 km
      estimatedLifespanKm = Math.max(220_000, Math.min(360_000, rawNormalKm));
    }
  }

  // Se è Ibrido con motore termico/Wankel (es. un Wankel che dura 80.000 km), la durata del powertrain
  // è vincolata anche dalla revisione dell'unità termica/rotativa accoppiata:
  if (systemSpec.hasIceEngine && coupledIce && config.referenceClass !== 'Corsa') {
    estimatedLifespanKm = Math.round(
      Math.min(
        estimatedLifespanKm,
        coupledIce.estimatedLifespanKm * 1.15 + estimatedLifespanKm * 0.25,
      ),
    );
  }
  // Arrotonda ai 1.000 km per pulizia visiva
  estimatedLifespanKm = Math.round(estimatedLifespanKm / 1000) * 1000;

  // 6. Emissioni CO2 (g/km):
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

  const { unitProductionCost } = calculateElectricHybridCosts(config, coupledIce);

  const specs: ElectricHybridSpecs = {
    systemType: config.systemType,
    electricMotorType: config.electricMotorType,
    motorLayout: config.motorLayout,
    motorCount: layoutSpec.motorCount,
    hasFrontDisconnect: config.hasFrontDisconnect,
    statorDiameterMm: config.statorDiameterMm,
    rotorLengthMm: config.rotorLengthMm,
    batteryChemistry: config.batteryChemistry,
    batteryCapacityKwh: config.batteryCapacityKwh,
    voltageArchitecture: config.voltageArchitecture,
    coolingSystem: config.coolingSystem,
    inverterTech: tierSpec.mappedInverterTech,
    inverterSummaryName: tierSpec.inverterName,
    inverterEfficiencyPercent: tierSpec.inverterEfficiencyPercent,
    peakElectricPowerKw,
    peakElectricPowerHp,
    continuousPowerKw,
    peakTorqueNm: peakElectricTorqueNm,
    cornerSpeedRpm,
    maxRpm: maxMotorRpm,
    cRatePeak,
    gearboxType: config.gearboxType,
    gearRatio: config.gearRatio,
    batteryWeightKg,
    motorWeightKg,
    totalPowertrainWeightKg: wetWeightKg,
    estimatedRangeKm,
    efficiencyWhPerKm,
    efficiencyKwhPer100Km,
    batteryLifespanCycles: batterySpec.cycleLife,
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
