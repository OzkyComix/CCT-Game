import {
  calculateBatteryPackMetrics,
  calculateElectricOutputMetrics,
  calculateSingleElectricMotorMetrics,
  simulateElectricHybridDyno,
} from './evHybridMath';
import { HISTORICAL_ELECTRIC_BENCHMARKS } from './historicalElectricBenchmark';
import { HISTORICAL_BATTERY_BENCHMARKS } from './historicalBatteryBenchmark';
import type {
  BatteryPackSpec,
  CoupledIceEngineOption,
  ElectricMotorSpec,
  HybridSystemType,
  MotorLayoutConfig,
  PowertrainBenchConfig,
} from '../types/gameTypes';

function getMotor(id: number): ElectricMotorSpec {
  const m = HISTORICAL_ELECTRIC_BENCHMARKS.find((x) => x.id === id);
  if (!m) throw new Error(`Motor #${id} not found`);
  return { ...m.spec };
}

function getBattery(id: number): BatteryPackSpec {
  const b = HISTORICAL_BATTERY_BENCHMARKS.find((x) => x.id === id);
  if (!b) throw new Error(`Battery #${id} not found`);
  return { priceTier: 'Premium', referenceClass: 'Sport', ...b.spec };
}

function makeIce(
  name: string,
  peakPowerHp: number,
  peakPowerRpm: number,
  peakTorqueNm: number,
  peakTorqueRpm: number,
  redlineRpm: number,
  dryWeightKg: number,
  isTurbo: boolean,
): CoupledIceEngineOption {
  const curve = [];
  const minRpm = 1000;
  const tqAtPeakPower = (peakPowerHp * 7023.5) / peakPowerRpm;
  for (let rpm = minRpm; rpm <= redlineRpm; rpm += 100) {
    let torqueNm: number;
    if (rpm <= peakTorqueRpm) {
      const progress = (rpm - minRpm) / Math.max(1, peakTorqueRpm - minRpm);
      torqueNm = peakTorqueNm * (0.78 + 0.22 * Math.sin(progress * (Math.PI / 2)));
    } else if (rpm <= peakPowerRpm) {
      const progress =
        (rpm - peakTorqueRpm) / Math.max(1, peakPowerRpm - peakTorqueRpm);
      torqueNm =
        peakTorqueNm -
        (peakTorqueNm - tqAtPeakPower) * Math.pow(progress, 1.15);
    } else {
      const progress =
        (rpm - peakPowerRpm) / Math.max(1, redlineRpm - peakPowerRpm);
      const powerNow = peakPowerHp * (1.0 - 0.06 * Math.pow(progress, 1.6));
      torqueNm = (powerNow * 7023.5) / rpm;
    }
    const tq = Math.round(torqueNm);
    const hp = Math.round((tq * rpm) / 7023.5);
    curve.push({ rpm, torqueNm: tq, powerHp: hp });
  }
  return {
    id: `test-ice-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    sourceKind: 'ReferencePreset',
    name,
    codeName: 'TEST-ICE',
    propulsionType: 'Piston_1A',
    architectureLabel: name,
    displacementCc: 2000,
    displacementLiters: 2.0,
    cylindersOrRotors: 4,
    fuelType: 'Benzina',
    isTurbo,
    peakPowerHp,
    peakPowerRpm,
    peakTorqueNm,
    peakTorqueRpm,
    redlineRpm,
    dryWeightKg,
    wetWeightKg: dryWeightKg + 8,
    dimensionsMm: { lengthMm: 450, widthMm: 550, heightMm: 600 },
    emissionsGPerKm: 130,
    reliabilityPercent: 90,
    estimatedLifespanKm: 250_000,
    unitProductionCost: 3500,
    curve,
    intendedOrientation: 'Longitudinale',
  };
}

interface PowertrainCase {
  id: number;
  category: 'A' | 'B' | 'C';
  name: string;
  systemType: HybridSystemType;
  motorLayout: MotorLayoutConfig;
  motorCount: 1 | 2 | 3 | 4;
  gearboxType?: PowertrainBenchConfig['gearboxType'];
  motor: ElectricMotorSpec;
  battery: BatteryPackSpec;
  ice?: CoupledIceEngineOption;
  realHp: string;
  realNm: string;
  realPtKg: number;
  realRangeKm?: number;
}

const POWERTRAIN_CASES: PowertrainCase[] = [
  // A) Single-Motor EV (10)
  {
    id: 1,
    category: 'A',
    name: 'Dacia Spring 45 (2021)',
    systemType: 'PureEV',
    motorLayout: 'SingleMotor_FWD',
    motorCount: 1,
    motor: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 236,
      rotorLengthMm: 58,
      coolingSystem: 'Air',
      voltageArchitecture: 400,
      statorWinding: 'RoundWireStandard',
      inverterPowerElectronics: 'Silicon_IGBT',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'FerriteStandardCage',
      motorHousing: 'DieCastAluminum',
      maxMotorRpm: 8500,
      priceTier: 'Economica',
      referenceClass: 'Normale',
    },
    battery: getBattery(8),
    realHp: '45',
    realNm: '125',
    realPtKg: 225,
    realRangeKm: 230,
  },
  {
    id: 2,
    category: 'A',
    name: 'Nissan Leaf ZE0 24 kWh (2010)',
    systemType: 'PureEV',
    motorLayout: 'SingleMotor_FWD',
    motorCount: 1,
    motor: getMotor(1),
    battery: getBattery(14),
    realHp: '109',
    realNm: '280',
    realPtKg: 352,
    realRangeKm: 175,
  },
  {
    id: 3,
    category: 'A',
    name: 'Renault Zoe ZE50 R135 (2019)',
    systemType: 'PureEV',
    motorLayout: 'SingleMotor_FWD',
    motorCount: 1,
    motor: getMotor(2),
    battery: getBattery(15),
    realHp: '136',
    realNm: '245',
    realPtKg: 388,
    realRangeKm: 395,
  },
  {
    id: 4,
    category: 'A',
    name: 'Fiat 500e 42 kWh (2020)',
    systemType: 'PureEV',
    motorLayout: 'SingleMotor_FWD',
    motorCount: 1,
    motor: getMotor(3),
    battery: getBattery(16),
    realHp: '118',
    realNm: '220',
    realPtKg: 350,
    realRangeKm: 320,
  },
  {
    id: 5,
    category: 'A',
    name: 'Peugeot e-208 50 kWh (2019)',
    systemType: 'PureEV',
    motorLayout: 'SingleMotor_FWD',
    motorCount: 1,
    motor: getMotor(36),
    battery: {
      batteryCapacityKwh: 50,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
      priceTier: 'Media',
      referenceClass: 'Normale',
    },
    realHp: '136',
    realNm: '260',
    realPtKg: 399,
    realRangeKm: 362,
  },
  {
    id: 6,
    category: 'A',
    name: 'BYD Atto 3 / Dolphin 60 kWh (2022)',
    systemType: 'PureEV',
    motorLayout: 'SingleMotor_FWD',
    motorCount: 1,
    motor: { ...getMotor(39), statorDiameterMm: 204, rotorLengthMm: 188 },
    battery: getBattery(10),
    realHp: '204',
    realNm: '310',
    realPtKg: 442,
    realRangeKm: 420,
  },
  {
    id: 7,
    category: 'A',
    name: 'Renault Mégane E-Tech EV60 (2022)',
    systemType: 'PureEV',
    motorLayout: 'SingleMotor_FWD',
    motorCount: 1,
    motor: getMotor(29),
    battery: getBattery(17),
    realHp: '218',
    realNm: '300',
    realPtKg: 455,
    realRangeKm: 450,
  },
  {
    id: 8,
    category: 'A',
    name: 'VW ID.3 Pro S 82 kWh (2020)',
    systemType: 'PureEV',
    motorLayout: 'SingleMotor_RWD',
    motorCount: 1,
    motor: getMotor(4),
    battery: getBattery(18),
    realHp: '204',
    realNm: '310',
    realPtKg: 560,
    realRangeKm: 549,
  },
  {
    id: 9,
    category: 'A',
    name: 'Tesla Model 3 RWD LFP 60 kWh (2022)',
    systemType: 'PureEV',
    motorLayout: 'SingleMotor_RWD',
    motorCount: 1,
    motor: getMotor(8),
    battery: getBattery(11),
    realHp: '283-320',
    realNm: '420-450',
    realPtKg: 448,
    realRangeKm: 513,
  },
  {
    id: 10,
    category: 'A',
    name: 'VW ID.7 Pro 82 kWh (2024)',
    systemType: 'PureEV',
    motorLayout: 'SingleMotor_RWD',
    motorCount: 1,
    motor: getMotor(5),
    battery: getBattery(18),
    realHp: '286',
    realNm: '545',
    realPtKg: 570,
    realRangeKm: 615,
  },

  // B) Multi-Motor EV (12)
  {
    id: 11,
    category: 'B',
    name: 'BMW i4 M50 Dual-Motor (2021)',
    systemType: 'PureEV',
    motorLayout: 'DualMotor_eAWD',
    motorCount: 2,
    motor: getMotor(6),
    battery: getBattery(19),
    realHp: '544',
    realNm: '795',
    realPtKg: 694,
    realRangeKm: 510,
  },
  {
    id: 12,
    category: 'B',
    name: 'Mercedes EQS 580 4MATIC (2021)',
    systemType: 'PureEV',
    motorLayout: 'DualMotor_eAWD',
    motorCount: 2,
    motor: getMotor(40),
    battery: getBattery(22),
    realHp: '544',
    realNm: '858',
    realPtKg: 830,
    realRangeKm: 670,
  },
  {
    id: 13,
    category: 'B',
    name: 'Ford Mustang Mach-E GT (2021)',
    systemType: 'PureEV',
    motorLayout: 'DualMotor_eAWD',
    motorCount: 2,
    motor: getMotor(49),
    battery: {
      batteryCapacityKwh: 99,
      batteryChemistry: 'NMC811',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
      priceTier: 'Premium',
      referenceClass: 'Sport',
    },
    realHp: '487-619',
    realNm: '860',
    realPtKg: 735,
    realRangeKm: 490,
  },
  {
    id: 14,
    category: 'B',
    name: 'Tesla Model 3 Performance AWD (2021)',
    systemType: 'PureEV',
    motorLayout: 'DualMotor_eAWD',
    motorCount: 2,
    motor: getMotor(8),
    battery: getBattery(20),
    realHp: '534-585',
    realNm: '660-750',
    realPtKg: 616,
    realRangeKm: 547,
  },
  {
    id: 15,
    category: 'B',
    name: 'Hyundai Ioniq 5 N Dual-Motor (2024)',
    systemType: 'PureEV',
    motorLayout: 'DualMotor_eAWD',
    motorCount: 2,
    motor: getMotor(10),
    battery: getBattery(23),
    realHp: '650-680',
    realNm: '770',
    realPtKg: 633,
    realRangeKm: 448,
  },
  {
    id: 16,
    category: 'B',
    name: 'Porsche Taycan Turbo S J1.1 (2019)',
    systemType: 'PureEV',
    motorLayout: 'DualMotor_eAWD',
    motorCount: 2,
    gearboxType: 'TwoSpeedDualClutch',
    motor: getMotor(9),
    battery: getBattery(24),
    realHp: '761-816',
    realNm: '1050',
    realPtKg: 812,
    realRangeKm: 412,
  },
  {
    id: 17,
    category: 'B',
    name: 'Porsche Taycan Turbo GT J1.2 (2024)',
    systemType: 'PureEV',
    motorLayout: 'DualMotor_eAWD',
    motorCount: 2,
    gearboxType: 'TwoSpeedDualClutch',
    motor: getMotor(42),
    battery: getBattery(25),
    realHp: '1034',
    realNm: '1240-1340',
    realPtKg: 750,
    realRangeKm: 555,
  },
  {
    id: 18,
    category: 'B',
    name: 'Tesla Model S Plaid Tri-Motor (2021)',
    systemType: 'PureEV',
    motorLayout: 'TriMotor_TorqueVectoring',
    motorCount: 3,
    motor: getMotor(11),
    battery: getBattery(21),
    realHp: '1020-1115',
    realNm: '1420',
    realPtKg: 707,
    realRangeKm: 600,
  },
  {
    id: 19,
    category: 'B',
    name: 'Lucid Air Sapphire Tri-Motor (2023)',
    systemType: 'PureEV',
    motorLayout: 'TriMotor_TorqueVectoring',
    motorCount: 3,
    motor: getMotor(12),
    battery: getBattery(26),
    realHp: '1234-1305',
    realNm: '1940',
    realPtKg: 725,
    realRangeKm: 687,
  },
  {
    id: 20,
    category: 'B',
    name: 'Rimac Nevera Quad-Motor (2022)',
    systemType: 'PureEV',
    motorLayout: 'QuadMotor_Independent',
    motorCount: 4,
    motor: getMotor(13),
    battery: getBattery(27),
    realHp: '1914',
    realNm: '2360',
    realPtKg: 972,
    realRangeKm: 490,
  },
  {
    id: 21,
    category: 'B',
    name: 'Formula E Gen2 (2018)',
    systemType: 'PureEV',
    motorLayout: 'SingleMotor_RWD',
    motorCount: 1,
    motor: getMotor(19),
    battery: {
      batteryCapacityKwh: 54,
      batteryChemistry: 'NCA',
      packStructure: 'CarbonLaserSilverBusbar',
      bmsCalibration: 'RaceExtreme',
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      underbodyShield: 'StandardSteelShield',
      priceTier: 'Lusso',
      referenceClass: 'Corsa',
    },
    realHp: '340',
    realNm: '220',
    realPtKg: 345,
  },
  {
    id: 22,
    category: 'B',
    name: 'Formula E Gen3 Post. (2023)',
    systemType: 'PureEV',
    motorLayout: 'SingleMotor_RWD',
    motorCount: 1,
    motor: getMotor(20),
    battery: getBattery(29),
    realHp: '476',
    realNm: '280',
    realPtKg: 307,
  },

  // C) Hybrid Powertrains (8)
  {
    id: 23,
    category: 'C',
    name: 'Toyota Prius Gen4 1.8 Full-Hybrid (2016)',
    systemType: 'FullHybrid',
    motorLayout: 'SingleMotor_FWD',
    motorCount: 1,
    motor: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 196,
      rotorLengthMm: 104,
      coolingSystem: 'LiquidGlycol',
      voltageArchitecture: 400,
      statorWinding: 'RoundWireStandard',
      inverterPowerElectronics: 'Silicon_IGBT',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      maxMotorRpm: 13500,
      priceTier: 'Media',
      referenceClass: 'Normale',
    },
    battery: getBattery(1),
    ice: makeIce('1.8L Atkinson', 98, 5200, 142, 3600, 5600, 95, false),
    realHp: '122',
    realNm: '~200',
    realPtKg: 155,
  },
  {
    id: 24,
    category: 'C',
    name: 'Porsche 911 Carrera GTS T-Hybrid (2024)',
    systemType: 'FullHybrid',
    motorLayout: 'SingleMotor_RWD',
    motorCount: 1,
    motor: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 222,
      rotorLengthMm: 72,
      coolingSystem: 'LiquidGlycol',
      voltageArchitecture: 400,
      statorWinding: 'RoundWireStandard',
      inverterPowerElectronics: 'Silicon_IGBT',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      maxMotorRpm: 11000,
      priceTier: 'Media',
      referenceClass: 'Sport',
    },
    battery: getBattery(2),
    ice: makeIce('3.6L Boxer-6 Turbo', 485, 6500, 570, 3500, 7500, 195, true),
    realHp: '541',
    realNm: '610',
    realPtKg: 250,
  },
  {
    id: 25,
    category: 'C',
    name: 'Mazda MX-30 e-Skyactiv R-EV (2023)',
    systemType: 'RangeExtender',
    motorLayout: 'SingleMotor_FWD',
    motorCount: 1,
    motor: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 204,
      rotorLengthMm: 154,
      coolingSystem: 'LiquidGlycol',
      voltageArchitecture: 400,
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'Silicon_MOSFET',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      maxMotorRpm: 14000,
      priceTier: 'Media',
      referenceClass: 'Normale',
    },
    battery: getBattery(36),
    ice: makeIce('Wankel 8C 830cc', 75, 4700, 116, 4000, 5000, 72, false),
    realHp: '170',
    realNm: '260',
    realPtKg: 275,
    realRangeKm: 85,
  },
  {
    id: 26,
    category: 'C',
    name: 'Toyota RAV4 Prime PHEV (2021)',
    systemType: 'PHEV',
    motorLayout: 'DualMotor_eAWD',
    motorCount: 2,
    motor: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 154,
      rotorLengthMm: 142,
      coolingSystem: 'LiquidGlycol',
      voltageArchitecture: 400,
      statorWinding: 'RoundWireStandard',
      inverterPowerElectronics: 'Silicon_IGBT',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      maxMotorRpm: 14000,
      priceTier: 'Media',
      referenceClass: 'Normale',
    },
    battery: getBattery(6),
    ice: makeIce('2.5L Atkinson', 185, 6000, 227, 3600, 6200, 130, false),
    realHp: '306',
    realNm: '~380',
    realPtKg: 365,
    realRangeKm: 75,
  },
  {
    id: 27,
    category: 'C',
    name: 'McLaren Artura PHEV (2022)',
    systemType: 'PHEV',
    motorLayout: 'SingleMotor_RWD',
    motorCount: 1,
    motor: getMotor(54),
    battery: {
      ...getBattery(33),
      batteryCapacityKwh: 7.5,
      bmsCalibration: 'PerformanceSport',
    },
    ice: makeIce('3.0L V6 Twin-Turbo', 585, 7500, 585, 5000, 8500, 160, true),
    realHp: '680',
    realNm: '720',
    realPtKg: 255,
    realRangeKm: 31,
  },
  {
    id: 28,
    category: 'C',
    name: 'Ferrari 296 GTB PHEV (2022)',
    systemType: 'PHEV',
    motorLayout: 'SingleMotor_RWD',
    motorCount: 1,
    motor: getMotor(14),
    battery: getBattery(5),
    ice: makeIce('3.0L V6 Twin-Turbo', 663, 8000, 740, 6250, 8500, 185, true),
    realHp: '830',
    realNm: '740-850',
    realPtKg: 282,
    realRangeKm: 25,
  },
  {
    id: 29,
    category: 'C',
    name: 'Mercedes-AMG C63 S E-Performance (2023)',
    systemType: 'PHEV',
    motorLayout: 'SingleMotor_RWD',
    motorCount: 1,
    gearboxType: 'TwoSpeedDualClutch',
    motor: getMotor(57),
    battery: getBattery(4),
    ice: makeIce('2.0L I4 Turbo', 476, 6750, 545, 5250, 7000, 139, true),
    realHp: '680',
    realNm: '1020',
    realPtKg: 253,
    realRangeKm: 13,
  },
  {
    id: 30,
    category: 'C',
    name: 'Lamborghini Revuelto PHEV (2023)',
    systemType: 'PHEV',
    motorLayout: 'TriMotor_TorqueVectoring',
    motorCount: 3,
    motor: getMotor(56),
    battery: getBattery(3),
    ice: makeIce('6.5L V12 NA', 825, 9250, 725, 6750, 9500, 218, false),
    realHp: '1015',
    realNm: '807-1000',
    realPtKg: 345,
    realRangeKm: 10,
  },
];

function parseTargetRange(spec: string): { min: number; max: number; mid: number } {
  const cleaned = spec.replace(/[~,\s]/g, '');
  if (cleaned.includes('-')) {
    const [a, b] = cleaned.split('-').map(Number);
    return { min: a, max: b, mid: (a + b) / 2 };
  }
  const val = Number(cleaned);
  return { min: val, max: val, mid: val };
}

function calcRangeErrPct(sim: number, targetStr: string): number {
  const { min, max } = parseTargetRange(targetStr);
  if (sim >= min && sim <= max) return 0;
  if (sim < min) return ((sim - min) / min) * 100;
  return ((sim - max) / max) * 100;
}

function makeBenchInput(c: PowertrainCase): PowertrainBenchConfig {
  return {
    systemType: c.systemType,
    motorCount: c.motorCount,
    motorLayout: c.motorLayout,
    gearboxType: c.gearboxType ?? 'SingleSpeedDirect',
    gearRatio: 9.0,
    hasFrontDisconnect: false,
    coupledIceOptionId: c.ice?.id,
    motor: c.motor,
    battery: c.battery,
  };
}

function runCouplingDiagnostics(): void {
  console.log('=== PARTE 1: DIAGNOSTICA 30 POWERTRAIN REALI ACCOPPIATI (2010-2025) ===');
  console.log(
    '| # | Cat | Veicolo | Sys | CV Sim vs Reale (Err%) | Nm Sim vs Reale (Err%) | Peso PT Sim / Reale (Err%) | Range Sim / Reale (Err%) | kWh/100km |',
  );
  console.log(
    '| :---: | :---: | :--- | :---: | :--- | :--- | :--- | :--- | :---: |',
  );

  let curveMismatchCount = 0;
  let powerOutliers = 0;
  let torqueOutliers = 0;
  let weightOutliers = 0;
  let rangeOutliers = 0;
  const powerErrors: number[] = [];
  const torqueErrors: number[] = [];
  const rangeErrors: number[] = [];
  const weightErrors: number[] = [];

  for (const c of POWERTRAIN_CASES) {
    const input = makeBenchInput(c);

    const dyno = simulateElectricHybridDyno(input, c.ice);
    const out = calculateElectricOutputMetrics(input, c.ice);

    const maxCurveHp = Math.max(...dyno.curve.map((p) => p.powerHp));
    const maxCurveNm = Math.max(...dyno.curve.map((p) => p.torqueNm));
    if (
      Math.abs(maxCurveHp - dyno.peakPowerHp) > 2 ||
      Math.abs(maxCurveNm - dyno.peakTorqueNm) > 2
    ) {
      curveMismatchCount++;
    }

    const hpErr = calcRangeErrPct(dyno.peakPowerHp, c.realHp);
    const nmErr = calcRangeErrPct(dyno.peakTorqueNm, c.realNm);
    powerErrors.push(Math.abs(hpErr));
    torqueErrors.push(Math.abs(nmErr));
    if (Math.abs(hpErr) > 6.0) powerOutliers++;
    if (Math.abs(nmErr) > 8.0) torqueOutliers++;

    const wErr = ((dyno.dryWeightKg - c.realPtKg) / c.realPtKg) * 100;
    weightErrors.push(Math.abs(wErr));
    if (Math.abs(wErr) > 8.0) weightOutliers++;

    const simRange = dyno.specs.estimatedRangeKm ?? 0;
    let rangeStr = `${simRange} km`;
    if (c.realRangeKm !== undefined) {
      const rErr = ((simRange - c.realRangeKm) / c.realRangeKm) * 100;
      rangeErrors.push(Math.abs(rErr));
      if (Math.abs(rErr) > 12.0) rangeOutliers++;
      rangeStr = `${simRange} / ${c.realRangeKm} km (${rErr >= 0 ? '+' : ''}${rErr.toFixed(1)}%)`;
    }

    const fmtErr = (e: number) => `${e >= 0 ? '+' : ''}${e.toFixed(1)}%`;

    console.log(
      `| ${c.id} | ${c.category} | ${c.name} | ${c.systemType} | ${dyno.peakPowerHp} vs ${c.realHp} (${fmtErr(hpErr)}) | ${dyno.peakTorqueNm} vs ${c.realNm} (${fmtErr(nmErr)}) | ${dyno.dryWeightKg} / ${c.realPtKg} kg (${fmtErr(wErr)}) | ${rangeStr} | ${dyno.specs.efficiencyKwhPer100Km ?? '-'} |`,
    );
    void out;
  }

  console.log('\n=== PARTE 2: 5 VERIFICHE STRUTTURALI SULL ACCOPPIAMENTO ===');

  const meanHpErr = powerErrors.reduce((a, b) => a + b, 0) / powerErrors.length;
  const meanNmErr = torqueErrors.reduce((a, b) => a + b, 0) / torqueErrors.length;
  const meanWeightErr = weightErrors.reduce((a, b) => a + b, 0) / weightErrors.length;
  const meanRangeErr = rangeErrors.reduce((a, b) => a + b, 0) / rangeErrors.length;

  // 1. Coerenza Card vs Curva Dyno
  console.log(`1. Coerenza Card vs Curva Dyno (30 veicoli): discrepanze > 2 CV/Nm = ${curveMismatchCount}/30`);

  // 2. Battery Bottleneck Stress Test (Motore 600+ CV / 900 Nm + Batteria 5 kWh / ~30 CV)
  const bigMotor = getMotor(12); // Lucid 694 CV / 907 Nm
  const tinyBatt: BatteryPackSpec = {
    batteryCapacityKwh: 5.0,
    batteryChemistry: 'LFP',
    packStructure: 'ModularAluminum',
    bmsCalibration: 'ConservativeLongevity',
    voltageArchitecture: 400,
    coolingSystem: 'Air',
    underbodyShield: 'StandardSteelShield',
    priceTier: 'Economica',
    referenceClass: 'Normale',
  };
  const unitBig = calculateSingleElectricMotorMetrics(bigMotor);
  const battTiny = calculateBatteryPackMetrics(tinyBatt, 'PureEV');
  const bottleneckBench: PowertrainBenchConfig = {
    systemType: 'PureEV',
    motorCount: 1,
    motorLayout: 'SingleMotor_RWD',
    gearboxType: 'SingleSpeedDirect',
    gearRatio: 9.0,
    hasFrontDisconnect: false,
    motor: bigMotor,
    battery: tinyBatt,
  };
  const bottleneckDyno = simulateElectricHybridDyno(bottleneckBench);
  const bottleneckPass =
    bottleneckDyno.peakPowerHp <= 38 &&
    bottleneckDyno.peakTorqueNm < 120 &&
    Math.abs(Math.max(...bottleneckDyno.curve.map((p) => p.powerHp)) - bottleneckDyno.peakPowerHp) <= 2 &&
    Math.abs(Math.max(...bottleneckDyno.curve.map((p) => p.torqueNm)) - bottleneckDyno.peakTorqueNm) <= 2;
  console.log(
    `2. Stress Test Bottleneck Batteria: Motore nudo = ${unitBig.peakPowerHp} CV / ${unitBig.peakTorqueNm} Nm | Batteria = ${battTiny.maxDischargePowerKw} kW (${battTiny.maxDischargePowerHp} CV) -> Dyno Accoppiato = ${bottleneckDyno.peakPowerHp} CV / ${bottleneckDyno.peakTorqueNm} Nm [${bottleneckPass ? 'PASS' : 'FAIL'}]`,
  );

  // 3. Bilancio Pesi (dryWeightKg vs somma componenti)
  console.log(
    `3. Bilancio Pesi (30 veicoli): Outlier > +/-8.0% = ${weightOutliers}/30 | Media |Err Peso PT| = ${meanWeightErr.toFixed(2)}% (target < 3.5%)`,
  );
  const sample = POWERTRAIN_CASES[10]; // BMW i4 M50
  const sUnit = calculateSingleElectricMotorMetrics(sample.motor);
  const sBatt = calculateBatteryPackMetrics(sample.battery, sample.systemType);
  const sDyno = simulateElectricHybridDyno(makeBenchInput(sample));
  console.log(
    `   Esempio i4 M50: 2x unitMotor (${2 * sUnit.dryWeightKg} kg) + Batt (${sBatt.weightKg} kg) = ${2 * sUnit.dryWeightKg + sBatt.weightKg} kg vs dyno.dryWeightKg=${sDyno.dryWeightKg} kg (delta=${sDyno.dryWeightKg - (2 * sUnit.dryWeightKg + sBatt.weightKg)} kg)`,
  );

  // 4. Analisi Consumi & Range WLTP
  console.log(
    `4. Analisi Range WLTP (${rangeErrors.length} veicoli con target): Outlier > +/-12.0% = ${rangeOutliers}/${rangeErrors.length} | Media |Err Range| = ${meanRangeErr.toFixed(2)}% (target < 5.5%)`,
  );

  // 5. Somma Coppia/Potenza negli Ibridi
  console.log('5. Somma Coppia/Potenza negli Ibridi (#23..#30):');
  for (const c of POWERTRAIN_CASES.filter((x) => x.category === 'C')) {
    const bench = makeBenchInput(c);
    const out = calculateElectricOutputMetrics(bench, c.ice);
    const dyno = simulateElectricHybridDyno(bench, c.ice);
    const iceHp = c.ice?.peakPowerHp ?? 0;
    const iceNm = c.ice?.peakTorqueNm ?? 0;
    console.log(
      `   #${c.id} ${c.name}: ICE(${iceHp}CV/${iceNm}Nm) + Elec(${out.peakElectricPowerHp}CV/${out.peakElectricTorqueNm}Nm) -> Somma Picchi=${iceHp + out.peakElectricPowerHp}CV/${iceNm + out.peakElectricTorqueNm}Nm vs Curva Dyno=${dyno.peakPowerHp}CV/${dyno.peakTorqueNm}Nm (Reale=${c.realHp}CV/${c.realNm}Nm)`,
    );
  }

  console.log('\n=== RIEPILOGO CERTIFICAZIONE FINALE ===');
  console.log(`- Potenza Sistema (tolleranza +/-6.0%): Outlier = ${powerOutliers}/30 | Media |Err| = ${meanHpErr.toFixed(2)}%`);
  console.log(`- Coppia Sistema  (tolleranza +/-8.0%): Outlier = ${torqueOutliers}/30 | Media |Err| = ${meanNmErr.toFixed(2)}%`);
  console.log(`- Peso Powertrain (tolleranza +/-8.0%): Outlier = ${weightOutliers}/30 | Media |Err| = ${meanWeightErr.toFixed(2)}%`);
  console.log(`- Range WLTP EV   (tolleranza +/-12.0%): Outlier = ${rangeOutliers}/${rangeErrors.length} | Media |Err| = ${meanRangeErr.toFixed(2)}%`);
  console.log(`- Coerenza Card vs Curva Dyno: Discrepanze = ${curveMismatchCount}/30`);
  console.log(`- Stress Test Bottleneck Batteria: ${bottleneckPass ? 'PASS' : 'FAIL'}`);

  const allPassed =
    powerOutliers === 0 &&
    torqueOutliers === 0 &&
    weightOutliers === 0 &&
    meanWeightErr < 3.5 &&
    rangeOutliers === 0 &&
    meanRangeErr < 5.5 &&
    curveMismatchCount === 0 &&
    bottleneckPass;

  if (!allPassed) {
    console.error('\n[FAIL] Certificazione accoppiamento non superata!');
    process.exit(1);
  }
  console.log('\n[PASS] TUTTI I CRITERI DI CERTIFICAZIONE SUPERATI (0 OUTLIER)!');
}

runCouplingDiagnostics();
