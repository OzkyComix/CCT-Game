import {
  BATTERY_CHEMISTRIES,
  ELECTRIC_COOLING_SYSTEMS,
  ELECTRIC_MOTOR_TYPES,
  HYBRID_SYSTEM_TYPES,
  INVERTER_TECHNOLOGIES,
  MOTOR_LAYOUT_CONFIGS,
} from '../data/electricHybridData';
import type {
  DimensionsLWH,
  DualCurrencyCost,
  DynoCurvePoint,
  ElectricHybridEngineConfigInput,
  ElectricHybridSpecs,
  EngineDynoTelemetry,
  PriceTier,
} from '../types/gameTypes';

export interface ElectricHybridGeometryMetrics {
  motorDimensionsMm: DimensionsLWH;
  batteryDimensionsMm: DimensionsLWH;
  inverterDimensionsMm: DimensionsLWH;
  /** Ingombro complessivo del gruppo propulsore nel vano motore per la verifica collisione (mm) */
  engineBayDimensionsMm: DimensionsLWH;
  statorVolumeCc: number;
}

/**
 * Calcola l'ingombro tridimensionale (LWH mm) dei motori elettrici, dell'inverter,
 * del pacco batterie e del gruppo propulsore complessivo installato nel vano motore.
 */
export function calculateElectricHybridGeometryAndDimensions(
  config: ElectricHybridEngineConfigInput,
): ElectricHybridGeometryMetrics {
  const Ds = config.statorDiameterMm;
  const Lr = config.rotorLengthMm;

  // Volume cilindrico del rotore/statore (in cc)
  const statorVolumeCc = Math.round((Math.PI * Math.pow(Ds / 20, 2) * (Lr / 10)) / 1000);

  // 1. Ingombro singola unità motrice elettrica (in mm):
  // Per motori a flusso assiale lo spessore assiale è ridottissimo (pancake design)
  const isAxialFlux = config.electricMotorType === 'AxialFlux';
  const motorDiameterMm = Math.round(Ds + 35); // cassa alluminio + camicia di raffreddamento
  const motorLengthMm = Math.round(isAxialFlux ? 95 : Lr + 85); // rotore + testate bobine + resolver

  const motorDimensionsMm: DimensionsLWH = {
    lengthMm: motorLengthMm,
    widthMm: motorDiameterMm,
    heightMm: motorDiameterMm,
  };

  // 2. Ingombro Inverter di potenza (elettronica di potenza ad alta tensione):
  const isSiC = config.inverterTech === 'SiliconCarbide_SiC';
  const isGaN = config.inverterTech === 'GalliumNitride_GaN';
  const inverterDimensionsMm: DimensionsLWH = {
    lengthMm: Math.round(isGaN ? 190 : isSiC ? 250 : 310),
    widthMm: Math.round(isGaN ? 170 : isSiC ? 230 : 280),
    heightMm: Math.round(isGaN ? 75 : isSiC ? 95 : 125),
  };

  // 3. Ingombro Pacco Batteria:
  // In BEV la batteria è uno skateboard nel pianale tra gli assi; negli ibridi è un pacco compatto
  let batteryDimensionsMm: DimensionsLWH;
  if (config.systemType === 'PureEV') {
    const kwh = Math.max(35, config.batteryCapacityKwh);
    const kwhScale = Math.pow(kwh / 75.0, 0.45);
    batteryDimensionsMm = {
      lengthMm: Math.round(1450 * kwhScale),
      widthMm: 1180,
      heightMm: Math.round(115 + (kwh > 85 ? 25 : 0)),
    };
  } else if (config.systemType === 'MHEV') {
    batteryDimensionsMm = { lengthMm: 310, widthMm: 210, heightMm: 140 };
  } else if (config.systemType === 'FullHybrid') {
    batteryDimensionsMm = { lengthMm: 480, widthMm: 340, heightMm: 190 };
  } else {
    // PHEV o REEV
    const kwh = Math.max(12, config.batteryCapacityKwh);
    const kwhScale = Math.pow(kwh / 20.0, 0.5);
    batteryDimensionsMm = {
      lengthMm: Math.round(720 * kwhScale),
      widthMm: Math.round(480 * kwhScale),
      heightMm: 240,
    };
  }

  // 4. Ingombro vano motore per verifica collisione (mm):
  // Se è BEV, nel vano motore c'è solo l'e-Axle (motore + differenziale + inverter)
  // Se è Ibrido, c'è il motore termico ICE più il modulo elettrico integrato
  let bayLengthMm: number;
  let bayWidthMm: number;
  let bayHeightMm: number;

  if (config.systemType === 'PureEV') {
    // e-Axle compatto anteriore o posteriore
    bayLengthMm = Math.round(motorDimensionsMm.lengthMm + 140);
    bayWidthMm = Math.round(motorDimensionsMm.widthMm + 110);
    bayHeightMm = Math.round(motorDimensionsMm.heightMm + inverterDimensionsMm.heightMm + 40);
  } else {
    // Topologia Ibrida: motore a pistoni (es. 4 cilindri 2.0L o V6) con distanziale elettrico tra motore e cambio (+115mm)
    const iceCyl = config.iceCylindersOrRotors ?? 4;
    const baseIceLength = 410 + iceCyl * 48;
    bayLengthMm = Math.round(baseIceLength + 125);
    bayWidthMm = 620;
    bayHeightMm = 630;
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
 * Calcola i costi di produzione unitari e i costi di sviluppo R&D
 * del gruppo propulsore Elettrico / Ibrido.
 */
export function calculateElectricHybridCosts(config: ElectricHybridEngineConfigInput): {
  unitProductionCost: number;
  batteryCost: number;
  motorSystemCost: number;
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
    ELECTRIC_COOLING_SYSTEMS[0];
  const inverterSpec =
    INVERTER_TECHNOLOGIES.find((i) => i.id === config.inverterTech) ??
    INVERTER_TECHNOLOGIES[0];
  const systemSpec =
    HYBRID_SYSTEM_TYPES.find((s) => s.id === config.systemType) ??
    HYBRID_SYSTEM_TYPES[0];

  const tierCostMultiplier: Record<PriceTier, number> = {
    Economica: 0.72,
    Media: 1.0,
    Premium: 1.48,
    Lusso: 2.25,
  };

  // Stima potenza elettrica complessiva in kW basata sul volume statore D_s^2 * L_r
  const geom = calculateElectricHybridGeometryAndDimensions(config);
  const isAxial = config.electricMotorType === 'AxialFlux';
  const volumeRatio = (geom.statorVolumeCc / 6080) * (isAxial ? 1.85 : 1.0);
  const estimatedKwPerMotor = Math.round(140 * volumeRatio * (motorSpec.powerDensityKwPerKg / 3.4));

  // 1. Costo Motori Elettrici:
  const motorCostSingle = Math.round(estimatedKwPerMotor * motorSpec.costPerKw + 450);
  const motorSystemCost = Math.round(
    motorCostSingle * layoutSpec.motorCount * layoutSpec.costMultiplier,
  );

  // 2. Costo Elettronica di Potenza (Inverter):
  const inverterSystemCost = Math.round(
    inverterSpec.costPerInverter * layoutSpec.motorCount * (config.voltageArchitecture === 800 ? 1.25 : 1.0),
  );

  // 3. Costo Pacco Batteria:
  const voltageBonus = config.voltageArchitecture === 800 ? 1.12 : 1.0;
  const batteryCost = Math.round(
    config.batteryCapacityKwh * batterySpec.costPerKwh * voltageBonus + 380,
  );

  // 4. Costo Raffreddamento & Cablaggi Alta Tensione:
  const coolingCablingCost = Math.round(coolingSpec.cost + (config.voltageArchitecture === 800 ? 420 : 250));

  // 5. Costo Motore Termico ausiliario (per powertrain ibridi MHEV, HEV, PHEV, REEV):
  let iceUnitCost = 0;
  if (systemSpec.hasIceEngine) {
    const iceDisplacement = config.iceDisplacementCc ?? 1998;
    iceUnitCost = Math.round(
      1400 + (iceDisplacement / 1000) * 850 + (config.iceTurbocharged ? 650 : 0),
    );
  }

  // Costo di produzione unitario totale:
  const unitProductionCost = Math.round(
    (motorSystemCost + inverterSystemCost + batteryCost + coolingCablingCost + iceUnitCost) *
      tierCostMultiplier[config.priceTier],
  );

  // Sviluppo R&D e Capitale di impianto:
  const voltageComplexity = config.voltageArchitecture === 800 ? 1.35 : 1.0;
  const chemistryComplexity = config.batteryChemistry === 'SolidState' ? 1.8 : 1.0;
  const inverterComplexity = config.inverterTech === 'GalliumNitride_GaN' ? 1.6 : 1.0;

  const globalComplexity =
    systemSpec.complexityFactor *
    voltageComplexity *
    chemistryComplexity *
    inverterComplexity *
    tierCostMultiplier[config.priceTier] *
    (1 + (layoutSpec.motorCount - 1) * 0.22);

  const capitalCost = Math.round(systemSpec.unlockCost.capitalCost * globalComplexity);
  const rdCost = Math.round(systemSpec.unlockCost.rdCost * globalComplexity);

  return {
    unitProductionCost,
    batteryCost,
    motorSystemCost,
    developmentCost: {
      capitalCost,
      rdCost,
      minYear: Math.max(
        systemSpec.minYear,
        motorSpec.minYear,
        batterySpec.minYear,
        inverterSpec.minYear,
      ),
    },
  };
}

/**
 * Simula sul Banco Prova il Powertrain Elettrico o Ibrido (Modulo 1C)
 * calcolando erogazione istantanea di coppia, campo di deflussaggio,
 * integrazione termica-elettrica, autonomia WLTP stimata e degrado batteria.
 */
export function simulateElectricHybridDyno(
  config: ElectricHybridEngineConfigInput,
): EngineDynoTelemetry & {
  specs: ElectricHybridSpecs;
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
    ELECTRIC_COOLING_SYSTEMS[0];
  const inverterSpec =
    INVERTER_TECHNOLOGIES.find((i) => i.id === config.inverterTech) ??
    INVERTER_TECHNOLOGIES[0];
  const systemSpec =
    HYBRID_SYSTEM_TYPES.find((s) => s.id === config.systemType) ??
    HYBRID_SYSTEM_TYPES[0];

  const geom = calculateElectricHybridGeometryAndDimensions(config);

  // 1. Fisica Coppia e Potenza Elettrica:
  // Coppia magnetica proporzionale al volume del rotore: T \propto D_s^2 * L_r
  const isAxial = config.electricMotorType === 'AxialFlux';
  const volumeRatio = (geom.statorVolumeCc / 6080) * (isAxial ? 1.85 : 1.0);

  const techTorqueMultiplier =
    config.electricMotorType === 'AxialFlux'
      ? 2.15
      : config.electricMotorType === 'PermanentMagnetSync'
        ? 1.08
        : config.electricMotorType === 'ElectricallyExcitedSync'
          ? 0.98
          : 0.90; // ASM

  const singleMotorPeakTorqueNm = Math.round(360 * volumeRatio * techTorqueMultiplier);
  const totalElectricPeakTorqueNm = singleMotorPeakTorqueNm * layoutSpec.motorCount;

  // Regime base (Corner Speed rpm) dove finisce la coppia costante e comincia il deflussaggio:
  const voltageCornerBonus = config.voltageArchitecture === 800 ? 550 : 0;
  const cornerSpeedRpm = Math.min(
    7500,
    Math.max(3800, Math.round(5200 + voltageCornerBonus - (volumeRatio - 1.0) * 800)),
  );

  // Potenza di picco elettrica (kW e CV):
  const inverterEfficiency = inverterSpec.efficiencyPercent / 100;
  const singleMotorPeakKw =
    ((singleMotorPeakTorqueNm * ((2 * Math.PI * cornerSpeedRpm) / 60)) / 1000) *
    inverterEfficiency;
  const totalElectricPeakKw = Math.round(singleMotorPeakKw * layoutSpec.motorCount);
  const continuousPowerKw = Math.round(
    totalElectricPeakKw * coolingSpec.continuousPowerRatio * 0.95,
  );
  const totalElectricPowerHp = Math.round(totalElectricPeakKw * 1.35962);

  // Regime massimo di rotazione del motore elettrico (RPM):
  const maxMotorRpm = Math.min(
    motorSpec.maxSafeRpm,
    Math.max(10000, config.maxMotorRpm || motorSpec.maxSafeRpm),
  );

  // 2. Componente Motore Termico (per MHEV, FullHybrid, PHEV, RangeExtender):
  let icePeakPowerHp = 0;
  let icePeakTorqueNm = 0;
  let icePeakTorqueRpm = 3500;

  if (systemSpec.hasIceEngine) {
    const dispLiters = (config.iceDisplacementCc ?? 1998) / 1000;
    const isTurbo = config.iceTurbocharged ?? true;
    const isDiesel = config.iceFuelType === 'Diesel';

    if (config.systemType === 'MHEV') {
      // Motore a pistoni tradizionale di base
      icePeakPowerHp = Math.round(dispLiters * (isTurbo ? 105 : 68) * (isDiesel ? 0.82 : 1.0));
      icePeakTorqueNm = Math.round(dispLiters * (isTurbo ? 175 : 98) * (isDiesel ? 1.28 : 1.0));
      icePeakTorqueRpm = isDiesel ? 2000 : 2800;
    } else if (config.systemType === 'FullHybrid') {
      // Ciclo Atkinson a pistoni ad alta efficienza termica
      icePeakPowerHp = Math.round(dispLiters * 78);
      icePeakTorqueNm = Math.round(dispLiters * 105);
      icePeakTorqueRpm = 3800;
    } else if (config.systemType === 'PHEV') {
      // Termico prestazionale turbo
      icePeakPowerHp = Math.round(dispLiters * 145);
      icePeakTorqueNm = Math.round(dispLiters * 215);
      icePeakTorqueRpm = 2500;
    } else if (config.systemType === 'RangeExtender') {
      // Generatore costante a regime fisso ottimizzato
      icePeakPowerHp = Math.round(dispLiters * 62);
      icePeakTorqueNm = Math.round(dispLiters * 82);
      icePeakTorqueRpm = 3200;
    }
  }

  // 3. Generazione Curva Telemetrica Combinata (RPM da 0 a maxMotorRpm o 8000 se ibrido):
  // Per BEV la scala RPM rappresenta i giri del motore elettrico (da 0 a maxMotorRpm).
  // Per gli Ibridi (MHEV, HEV, PHEV), la scala RPM sul grafico rappresenta i giri dell'albero combinato/motore termico (da 1000 a 7500 rpm)
  // dove l'elettrico riempie istantaneamente i bassi regimi (Torque Fill!).
  const curve: DynoCurvePoint[] = [];
  let peakPowerHp = 0;
  let peakPowerRpm = 0;
  let peakTorqueNm = 0;
  let peakTorqueRpm = 0;

  if (config.systemType === 'PureEV') {
    // BEV PURO: coppia istantanea a 0 rpm, costante fino a corner speed, poi deflussaggio a potenza costante
    const stepRpm = Math.round(maxMotorRpm / 60);

    for (let rpm = 0; rpm <= maxMotorRpm; rpm += stepRpm) {
      let currentTorqueNm: number;
      let currentPowerHp: number;

      if (rpm <= cornerSpeedRpm) {
        // Constant Torque Region
        currentTorqueNm = totalElectricPeakTorqueNm;
        currentPowerHp = Math.round((currentTorqueNm * rpm) / 7023.5);
      } else {
        // Field Weakening (Deflussaggio): potenza piatta con lieve roll-off agli altissimi regimi
        const highSpeedDerating =
          1.0 - Math.pow((rpm - cornerSpeedRpm) / (maxMotorRpm - cornerSpeedRpm), 1.9) * 0.12;
        currentPowerHp = Math.round(totalElectricPowerHp * highSpeedDerating);
        currentTorqueNm = Math.round((currentPowerHp * 7023.5) / Math.max(1, rpm));
      }

      curve.push({ rpm, torqueNm: currentTorqueNm, powerHp: currentPowerHp });

      if (currentTorqueNm > peakTorqueNm) {
        peakTorqueNm = currentTorqueNm;
        peakTorqueRpm = rpm;
      }
      if (currentPowerHp > peakPowerHp) {
        peakPowerHp = currentPowerHp;
        peakPowerRpm = rpm;
      }
    }
  } else {
    // TOPOLOGIE IBRIDE (MHEV, FullHybrid, PHEV, REEV):
    // La curva sul banco prova illustra la sinergia combinata termico + elettrico tra 1.000 e 7.200 rpm
    const maxIceRpm = config.systemType === 'RangeExtender' ? 5000 : 7200;

    for (let rpm = 1000; rpm <= maxIceRpm; rpm += 100) {
      // Curva ICE termica
      const iceNorm = Math.exp(-Math.pow((rpm - icePeakTorqueRpm) / 2200, 2));
      const iceTorqueNow = Math.round(icePeakTorqueNm * (0.62 + 0.38 * iceNorm));

      // Curva assistenza elettrica (Torque Fill massiccio a 1000-3000 rpm, poi sfuma a regimi alti)
      let electricBoostTorque = 0;
      if (config.systemType === 'MHEV') {
        // 48V aggiunge fino a 160 Nm da 1000 a 2400 rpm, poi si riduce dolcemente
        const eRollOff = Math.max(0, 1.0 - Math.pow(Math.max(0, rpm - 2200) / 4500, 1.5));
        electricBoostTorque = Math.round(160 * eRollOff);
      } else if (config.systemType === 'FullHybrid') {
        const eRollOff = Math.max(0.25, 1.0 - Math.pow(Math.max(0, rpm - 2800) / 4800, 1.4));
        electricBoostTorque = Math.round(totalElectricPeakTorqueNm * 0.45 * eRollOff);
      } else if (config.systemType === 'PHEV') {
        const eRollOff = Math.max(0.4, 1.0 - Math.pow(Math.max(0, rpm - 3200) / 5000, 1.3));
        electricBoostTorque = Math.round(totalElectricPeakTorqueNm * 0.75 * eRollOff);
      } else if (config.systemType === 'RangeExtender') {
        // Trazione 100% elettrica alle ruote
        electricBoostTorque = totalElectricPeakTorqueNm;
      }

      const combinedTorqueNow = iceTorqueNow + electricBoostTorque;
      const combinedPowerNow = Math.round((combinedTorqueNow * rpm) / 7023.5);

      curve.push({ rpm, torqueNm: combinedTorqueNow, powerHp: combinedPowerNow });

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

  // 4. Pesi del Powertrain (kg):
  // Motori elettrici
  const motorWeightKg = Math.round(
    layoutSpec.motorCount *
      ((totalElectricPeakKw / layoutSpec.motorCount) / motorSpec.powerDensityKwPerKg) +
      layoutSpec.weightAddKg,
  );
  // Inverter
  const inverterWeightKg = Math.round(layoutSpec.motorCount * inverterSpec.weightKg);
  // Pacco batteria
  const batteryWeightKg = Math.round(
    (config.batteryCapacityKwh * 1000) /
      batterySpec.cellDensityWhPerKg *
      batterySpec.packagingMultiplier,
  );
  // Liquidi termici & cablaggi
  const thermalAndCablesKg = Math.round(coolingSpec.weightKg + (config.voltageArchitecture === 800 ? 14 : 28));

  // Motore termico aggiuntivo (se ibrido)
  let iceWeightKg = 0;
  if (systemSpec.hasIceEngine) {
    const dispL = (config.iceDisplacementCc ?? 1998) / 1000;
    iceWeightKg = Math.round(110 + dispL * 35 + (config.iceTurbocharged ? 18 : 0));
  }

  const dryWeightKg = motorWeightKg + inverterWeightKg + batteryWeightKg + iceWeightKg;
  const wetWeightKg = dryWeightKg + thermalAndCablesKg + (systemSpec.hasIceEngine ? 8 : 0);

  // 5. Consumi Energetici WLTP e Autonomia (km):
  // Consumo base (Wh/km) ponderato sul peso complessivo, potenza di picco e resa inverter/motore
  const baseConsumptionWhPerKm = Math.round(
    (115 + (wetWeightKg / 1000) * 36 + totalElectricPeakKw * 0.045) *
      (1 / (inverterSpec.efficiencyPercent / 100)) *
      (1 / (motorSpec.peakEfficiencyPercent / 100)),
  );

  const usableCapacityKwh = config.batteryCapacityKwh * 0.92;
  const estimatedRangeKm = Math.round((usableCapacityKwh * 1000) / baseConsumptionWhPerKm);

  // 6. Emissioni CO2 (g/km):
  // PureEV è zero emissioni locali
  let emissionsGPerKm = 0;
  if (systemSpec.hasIceEngine) {
    const rawIceEmissions = Math.round(165 + (config.iceDisplacementCc ?? 1998) * 0.035);
    emissionsGPerKm = Math.max(
      0,
      Math.round(rawIceEmissions * (1 - systemSpec.emissionsReductionPercent / 100)),
    );
  }

  // 7. Affidabilità e Durata Cicli:
  // I motori elettrici hanno pochissime parti in movimento (zero valvole, bielle, guarnizioni) -> affidabilità altissima (94-98%)
  const coolingReliabilityBonus = config.coolingSystem === 'DirectDielectric' ? 3.5 : 0;
  const baseReliability =
    config.systemType === 'PureEV'
      ? 95.0 + coolingReliabilityBonus
      : 89.0 - (systemSpec.complexityFactor - 1.0) * 8.0;

  const reliabilityPercent = Number(Math.min(99.0, Math.max(45.0, baseReliability)).toFixed(1));
  const estimatedLifespanKm =
    config.systemType === 'PureEV'
      ? Math.round(batterySpec.cycleLife * (estimatedRangeKm * 0.75))
      : Math.round(220_000 * (reliabilityPercent / 88.0));

  const { unitProductionCost } = calculateElectricHybridCosts(config);

  const specs: ElectricHybridSpecs = {
    systemType: config.systemType,
    electricMotorType: config.electricMotorType,
    motorLayout: config.motorLayout,
    motorCount: layoutSpec.motorCount,
    statorDiameterMm: config.statorDiameterMm,
    rotorLengthMm: config.rotorLengthMm,
    batteryChemistry: config.batteryChemistry,
    batteryCapacityKwh: config.batteryCapacityKwh,
    voltageArchitecture: config.voltageArchitecture,
    coolingSystem: config.coolingSystem,
    inverterTech: config.inverterTech,
    peakElectricPowerKw: totalElectricPeakKw,
    continuousPowerKw,
    peakTorqueNm: totalElectricPeakTorqueNm,
    maxRpm: maxMotorRpm,
    gearboxType: config.gearboxType,
    gearRatio: config.gearRatio,
    batteryWeightKg,
    motorWeightKg,
    totalPowertrainWeightKg: wetWeightKg,
    estimatedRangeKm,
    efficiencyWhPerKm: baseConsumptionWhPerKm,
    batteryLifespanCycles: batterySpec.cycleLife,
    iceEngineDisplacementCc: config.iceDisplacementCc,
    icePowerHp: icePeakPowerHp,
    iceTorqueNm: icePeakTorqueNm,
    combinedPowerHp: peakPowerHp,
    combinedTorqueNm: peakTorqueNm,
  };

  return {
    curve,
    peakPowerHp,
    peakPowerRpm,
    peakTorqueNm,
    peakTorqueRpm,
    redlineRpm: config.systemType === 'PureEV' ? maxMotorRpm : 7200,
    dryWeightKg,
    wetWeightKg,
    thermalEfficiencyPercent: motorSpec.peakEfficiencyPercent,
    emissionsGPerKm,
    reliabilityPercent,
    estimatedLifespanKm,
    unitProductionCost,
    specs,
  };
}
