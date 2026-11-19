import { calculateChassisMetrics } from './chassisMath';
import {
  type DrivetrainPowertrainSpecs,
  calculateDrivetrainMetrics,
  generateDefaultGearRatios,
} from './drivetrainMath';
import type {
  ChassisEntity,
  DrivetrainSetupConfig,
  EngineMountingPosition,
  EngineOrientation,
  GearboxLayoutType,
} from '../types/gameTypes';

interface DrivetrainBenchCase {
  id: number;
  name: string;
  year: number;
  targetLossPct: number;
  chassisSpec: {
    pos: EngineMountingPosition;
    ori: EngineOrientation;
    drivetrainMode: 'FWD_Only' | 'FWD_AWD_Ready' | 'RWD_Only' | 'RWD_AWD_Ready';
    gearboxLayout: GearboxLayoutType;
    structureId: string;
    groundClearanceMm: number;
  };
  powertrain: DrivetrainPowertrainSpecs;
  setup: Omit<DrivetrainSetupConfig, 'id' | 'name' | 'year' | 'chassisId' | 'engineId'>;
}

function makeBenchChassisForDrive(
  id: number,
  name: string,
  year: number,
  spec: DrivetrainBenchCase['chassisSpec'],
): ChassisEntity {
  const cRes = calculateChassisMetrics(
    {
      structureId: spec.structureId,
      overallDimensionsMm: { lengthMm: 4450, widthMm: 1820, heightMm: 1430 },
      wheelbaseMm: 2700,
      frontTrackMm: 1560,
      rearTrackMm: 1560,
      groundClearanceMm: spec.groundClearanceMm,
      rigidityReinforcementPercent: 35,
      safetyStructurePercent: 60,
      supportedEnginePositions: [spec.pos],
      supportedEngineOrientations: [spec.ori],
      engineSetbackPercent: 45,
      drivetrainMode: spec.drivetrainMode,
      gearboxLayout: spec.gearboxLayout,
      supportedDrivetrains: spec.drivetrainMode.includes('AWD')
        ? spec.drivetrainMode.startsWith('FWD')
          ? ['FWD', 'AWD']
          : ['RWD', 'AWD']
        : spec.drivetrainMode.startsWith('FWD')
          ? ['FWD']
          : ['RWD'],
    },
    year,
  );
  return {
    id: `chs-drv-${id}`,
    name,
    codeName: `DRV-${id}`,
    ownerSubBrandId: 'bench-sub',
    createdYear: year,
    generationNumber: 1,
    taxonomy: cRes.taxonomy,
    overallDimensionsMm: { lengthMm: 4450, widthMm: 1820, heightMm: 1430 },
    wheelbaseMm: 2700,
    frontTrackMm: 1560,
    rearTrackMm: 1560,
    groundClearanceMm: spec.groundClearanceMm,
    torsionalRigidityNmPerDeg: cRes.torsionalRigidityNmPerDeg,
    structuralSafetyScore: cRes.structuralSafetyScore,
    engineBayMaxDimensionsMm: cRes.engineBayMaxDimensionsMm,
    supportedEnginePositions: [spec.pos],
    supportedEngineOrientations: [spec.ori],
    engineSetbackPercent: 45,
    supportedDrivetrains: cRes.resolvedDrivetrains,
    drivetrainMode: spec.drivetrainMode,
    gearboxLayout: cRes.effectiveGearboxLayout,
    calculatedSegment: cRes.segmentInfo.segment,
    baseWeightKg: cRes.baseWeightKg,
    unitManufacturingCost: cRes.unitManufacturingCost,
    developmentCost: cRes.developmentCost,
  };
}

const CASES: DrivetrainBenchCase[] = [
  {
    id: 1,
    name: 'Fiat Punto 1.2 FIRE 5M FWD (2009)',
    year: 2009,
    targetLossPct: 11.5,
    chassisSpec: { pos: 'Anteriore', ori: 'Trasversale', drivetrainMode: 'FWD_Only', gearboxLayout: 'InBlockWithEngine', structureId: 'str-uhss-steel', groundClearanceMm: 140 },
    powertrain: { isEv: false, peakPowerHp: 65, peakPowerRpm: 5500, peakTorqueNm: 102, redlineRpm: 6200 },
    setup: {
      drivetrainType: 'FWD', awdScheme: null, transmissionType: 'manual-h', gearCount: 5,
      gearRatios: [3.91, 2.16, 1.48, 1.12, 0.89], finalDriveRatio: 4.07, tireRadiusMm: 295,
      differentialType: 'open', steeringType: 'electric-eps', rearWheelSteering: false,
      frontSuspension: 'macpherson', rearSuspension: 'torsion-beam',
      stabilityControlType: 'abs-only', stabilityControlThresholdPercent: 75,
      frontCaliper: 'floating-1p', frontDiscType: 'solid-iron', frontDiscMm: 257,
      rearCaliper: 'drum', rearDiscType: 'solid-iron', rearDiscMm: 203,
    },
  },
  {
    id: 2,
    name: 'VW Golf Mk1 GTI 5M FWD (1978)',
    year: 1978,
    targetLossPct: 12.5,
    chassisSpec: { pos: 'Anteriore', ori: 'Trasversale', drivetrainMode: 'FWD_Only', gearboxLayout: 'InBlockWithEngine', structureId: 'str-steel-stamped', groundClearanceMm: 135 },
    powertrain: { isEv: false, peakPowerHp: 110, peakPowerRpm: 6100, peakTorqueNm: 140, redlineRpm: 6800 },
    setup: {
      drivetrainType: 'FWD', awdScheme: null, transmissionType: 'manual-h', gearCount: 5,
      gearRatios: [3.45, 1.94, 1.37, 1.03, 0.85], finalDriveRatio: 3.89, tireRadiusMm: 278,
      differentialType: 'open', steeringType: 'manual-rack', rearWheelSteering: false,
      frontSuspension: 'macpherson', rearSuspension: 'torsion-beam',
      stabilityControlType: 'none', stabilityControlThresholdPercent: 0,
      frontCaliper: 'floating-1p', frontDiscType: 'vented-iron', frontDiscMm: 239,
      rearCaliper: 'drum', rearDiscType: 'solid-iron', rearDiscMm: 200,
    },
  },
  {
    id: 3,
    name: 'Honda Civic Type R FL5 6M FWD Torsen (2023)',
    year: 2023,
    targetLossPct: 11.5,
    chassisSpec: { pos: 'Anteriore', ori: 'Trasversale', drivetrainMode: 'FWD_Only', gearboxLayout: 'InBlockWithEngine', structureId: 'str-uhss-steel', groundClearanceMm: 120 },
    powertrain: { isEv: false, peakPowerHp: 329, peakPowerRpm: 6500, peakTorqueNm: 420, redlineRpm: 7000 },
    setup: {
      drivetrainType: 'FWD', awdScheme: null, transmissionType: 'manual-h', gearCount: 6,
      gearRatios: [3.62, 2.11, 1.53, 1.12, 0.91, 0.73], finalDriveRatio: 3.84, tireRadiusMm: 324,
      differentialType: 'torsen-helical', steeringType: 'electric-eps', rearWheelSteering: false,
      frontSuspension: 'macpherson', rearSuspension: 'multi-link',
      stabilityControlType: 'esc-sport-variable', stabilityControlThresholdPercent: 40,
      frontCaliper: 'fixed-4p', frontDiscType: 'drilled-slotted-iron', frontDiscMm: 350,
      rearCaliper: 'floating-1p', rearDiscType: 'solid-iron', rearDiscMm: 305,
    },
  },
  {
    id: 4,
    name: 'BMW M3 E46 6M RWD LSD (2001)',
    year: 2001,
    targetLossPct: 14.0,
    chassisSpec: { pos: 'Anteriore-Centrale', ori: 'Longitudinale', drivetrainMode: 'RWD_Only', gearboxLayout: 'InBlockWithEngine', structureId: 'str-uhss-steel', groundClearanceMm: 120 },
    powertrain: { isEv: false, peakPowerHp: 343, peakPowerRpm: 7900, peakTorqueNm: 365, redlineRpm: 8000 },
    setup: {
      drivetrainType: 'RWD', awdScheme: null, transmissionType: 'manual-h', gearCount: 6,
      gearRatios: [4.23, 2.53, 1.67, 1.23, 1.00, 0.83], finalDriveRatio: 3.62, tireRadiusMm: 318,
      differentialType: 'mechanical-clutch-lsd', steeringType: 'hydraulic-hps', rearWheelSteering: false,
      frontSuspension: 'macpherson', rearSuspension: 'multi-link',
      stabilityControlType: 'esc-standard', stabilityControlThresholdPercent: 60,
      frontCaliper: 'floating-2p', frontDiscType: 'drilled-slotted-iron', frontDiscMm: 325,
      rearCaliper: 'floating-1p', rearDiscType: 'vented-iron', rearDiscMm: 328,
    },
  },
  {
    id: 5,
    name: 'Mazda MX-5 ND 6M RWD (2019)',
    year: 2019,
    targetLossPct: 13.2,
    chassisSpec: { pos: 'Anteriore-Centrale', ori: 'Longitudinale', drivetrainMode: 'RWD_Only', gearboxLayout: 'InBlockWithEngine', structureId: 'str-uhss-steel', groundClearanceMm: 135 },
    powertrain: { isEv: false, peakPowerHp: 184, peakPowerRpm: 7000, peakTorqueNm: 205, redlineRpm: 7500 },
    setup: {
      drivetrainType: 'RWD', awdScheme: null, transmissionType: 'manual-h', gearCount: 6,
      gearRatios: [5.09, 2.99, 2.04, 1.59, 1.29, 1.00], finalDriveRatio: 2.87, tireRadiusMm: 300,
      differentialType: 'torsen-helical', steeringType: 'electric-eps', rearWheelSteering: false,
      frontSuspension: 'double-wishbone', rearSuspension: 'multi-link',
      stabilityControlType: 'esc-sport-variable', stabilityControlThresholdPercent: 45,
      frontCaliper: 'fixed-4p', frontDiscType: 'vented-iron', frontDiscMm: 280,
      rearCaliper: 'floating-1p', rearDiscType: 'solid-iron', rearDiscMm: 280,
    },
  },
  {
    id: 6,
    name: 'Alfa Romeo Giulia QV ZF8 RWD (2016)',
    year: 2016,
    targetLossPct: 13.8,
    chassisSpec: { pos: 'Anteriore-Centrale', ori: 'Longitudinale', drivetrainMode: 'RWD_Only', gearboxLayout: 'InBlockWithEngine', structureId: 'str-hybrid-giorgio', groundClearanceMm: 120 },
    powertrain: { isEv: false, peakPowerHp: 510, peakPowerRpm: 6500, peakTorqueNm: 600, redlineRpm: 7400 },
    setup: {
      drivetrainType: 'RWD', awdScheme: null, transmissionType: 'auto-modern-lockup', gearCount: 8,
      gearRatios: [5.00, 3.20, 2.14, 1.72, 1.31, 1.00, 0.82, 0.64], finalDriveRatio: 3.09, tireRadiusMm: 331,
      differentialType: 'electronic-torque-vectoring', steeringType: 'electric-eps', rearWheelSteering: false,
      frontSuspension: 'double-wishbone', rearSuspension: 'multi-link',
      stabilityControlType: 'esc-sport-variable', stabilityControlThresholdPercent: 35,
      frontCaliper: 'fixed-6p', frontDiscType: 'carbon-ceramic', frontDiscMm: 390,
      rearCaliper: 'fixed-4p', rearDiscType: 'carbon-ceramic', rearDiscMm: 360,
    },
  },
  {
    id: 7,
    name: 'Ferrari 488 GTB 7DCT Transaxle RWD (2015)',
    year: 2015,
    targetLossPct: 11.5,
    chassisSpec: { pos: 'Centrale-Posteriore', ori: 'Longitudinale', drivetrainMode: 'RWD_Only', gearboxLayout: 'MidCentralTunnel', structureId: 'str-alu-spaceframe', groundClearanceMm: 115 },
    powertrain: { isEv: false, peakPowerHp: 670, peakPowerRpm: 8000, peakTorqueNm: 760, redlineRpm: 8000 },
    setup: {
      drivetrainType: 'RWD', awdScheme: null, transmissionType: 'dct-wet', gearCount: 7,
      gearRatios: [3.33, 2.29, 1.73, 1.38, 1.13, 0.96, 0.78], finalDriveRatio: 4.38, tireRadiusMm: 342,
      differentialType: 'electronic-torque-vectoring', steeringType: 'hydraulic-hps', rearWheelSteering: false,
      frontSuspension: 'double-wishbone', rearSuspension: 'multi-link',
      stabilityControlType: 'esc-sport-variable', stabilityControlThresholdPercent: 30,
      frontCaliper: 'fixed-6p', frontDiscType: 'carbon-ceramic', frontDiscMm: 398,
      rearCaliper: 'fixed-4p', rearDiscType: 'carbon-ceramic', rearDiscMm: 360,
    },
  },
  {
    id: 8,
    name: 'Porsche 911 GT3 992 7PDK RWD (2022)',
    year: 2022,
    targetLossPct: 11.8,
    chassisSpec: { pos: 'Posteriore', ori: 'Longitudinale', drivetrainMode: 'RWD_Only', gearboxLayout: 'InBlockWithEngine', structureId: 'str-hybrid-giorgio', groundClearanceMm: 100 },
    powertrain: { isEv: false, peakPowerHp: 510, peakPowerRpm: 8400, peakTorqueNm: 470, redlineRpm: 9000 },
    setup: {
      drivetrainType: 'RWD', awdScheme: null, transmissionType: 'dct-wet', gearCount: 7,
      gearRatios: [3.91, 2.29, 1.65, 1.30, 1.08, 0.88, 0.71], finalDriveRatio: 3.96, tireRadiusMm: 344,
      differentialType: 'electronic-torque-vectoring', steeringType: 'electric-eps', rearWheelSteering: true,
      frontSuspension: 'double-wishbone', rearSuspension: 'multi-link',
      stabilityControlType: 'esc-sport-variable', stabilityControlThresholdPercent: 35,
      frontCaliper: 'fixed-6p', frontDiscType: 'carbon-ceramic', frontDiscMm: 410,
      rearCaliper: 'fixed-4p', rearDiscType: 'carbon-ceramic', rearDiscMm: 390,
    },
  },
  {
    id: 9,
    name: 'Mercedes 500E 4-Spd Auto Classic RWD (1991)',
    year: 1991,
    targetLossPct: 20.0,
    chassisSpec: { pos: 'Anteriore', ori: 'Longitudinale', drivetrainMode: 'RWD_Only', gearboxLayout: 'InBlockWithEngine', structureId: 'str-steel-stamped', groundClearanceMm: 135 },
    powertrain: { isEv: false, peakPowerHp: 326, peakPowerRpm: 5700, peakTorqueNm: 480, redlineRpm: 6200 },
    setup: {
      drivetrainType: 'RWD', awdScheme: null, transmissionType: 'auto-torque-converter', gearCount: 4,
      gearRatios: [3.87, 2.25, 1.44, 1.00], finalDriveRatio: 2.82, tireRadiusMm: 315,
      differentialType: 'open', steeringType: 'hydraulic-hps', rearWheelSteering: false,
      frontSuspension: 'macpherson', rearSuspension: 'multi-link',
      stabilityControlType: 'abs-tcs', stabilityControlThresholdPercent: 75,
      frontCaliper: 'fixed-4p', frontDiscType: 'vented-iron', frontDiscMm: 300,
      rearCaliper: 'floating-2p', rearDiscType: 'solid-iron', rearDiscMm: 278,
    },
  },
  {
    id: 10,
    name: 'Chevrolet Corvette C3 3-Spd Auto RWD (1975)',
    year: 1975,
    targetLossPct: 21.5,
    chassisSpec: { pos: 'Anteriore-Centrale', ori: 'Longitudinale', drivetrainMode: 'RWD_Only', gearboxLayout: 'InBlockWithEngine', structureId: 'str-backbone-grp', groundClearanceMm: 130 },
    powertrain: { isEv: false, peakPowerHp: 205, peakPowerRpm: 4800, peakTorqueNm: 345, redlineRpm: 5500 },
    setup: {
      drivetrainType: 'RWD', awdScheme: null, transmissionType: 'auto-torque-converter', gearCount: 3,
      gearRatios: [2.48, 1.48, 1.00], finalDriveRatio: 3.08, tireRadiusMm: 332,
      differentialType: 'mechanical-clutch-lsd', steeringType: 'hydraulic-hps', rearWheelSteering: false,
      frontSuspension: 'double-wishbone', rearSuspension: 'multi-link',
      stabilityControlType: 'none', stabilityControlThresholdPercent: 0,
      frontCaliper: 'fixed-4p', frontDiscType: 'vented-iron', frontDiscMm: 298,
      rearCaliper: 'fixed-4p', rearDiscType: 'vented-iron', rearDiscMm: 298,
    },
  },
  {
    id: 11,
    name: 'VW Golf R Mk7 6DSG Haldex AWD (2015)',
    year: 2015,
    targetLossPct: 15.8,
    chassisSpec: { pos: 'Anteriore', ori: 'Trasversale', drivetrainMode: 'FWD_AWD_Ready', gearboxLayout: 'InBlockWithEngine', structureId: 'str-uhss-steel', groundClearanceMm: 130 },
    powertrain: { isEv: false, peakPowerHp: 300, peakPowerRpm: 5500, peakTorqueNm: 380, redlineRpm: 6700 },
    setup: {
      drivetrainType: 'AWD', awdScheme: 'awd-fwd-haldex', transmissionType: 'dct-wet', gearCount: 6,
      gearRatios: [3.46, 2.05, 1.30, 1.04, 0.86, 0.72], finalDriveRatio: 4.44, tireRadiusMm: 315,
      differentialType: 'open', steeringType: 'electric-eps', rearWheelSteering: false,
      frontSuspension: 'macpherson', rearSuspension: 'multi-link',
      stabilityControlType: 'esc-sport-variable', stabilityControlThresholdPercent: 55,
      frontCaliper: 'floating-2p', frontDiscType: 'vented-iron', frontDiscMm: 340,
      rearCaliper: 'floating-1p', rearDiscType: 'vented-iron', rearDiscMm: 310,
    },
  },
  {
    id: 12,
    name: 'Audi RS3 8Y 7DCT Torque Splitter AWD (2022)',
    year: 2022,
    targetLossPct: 16.8,
    chassisSpec: { pos: 'Anteriore', ori: 'Trasversale', drivetrainMode: 'FWD_AWD_Ready', gearboxLayout: 'InBlockWithEngine', structureId: 'str-uhss-steel', groundClearanceMm: 125 },
    powertrain: { isEv: false, peakPowerHp: 400, peakPowerRpm: 5600, peakTorqueNm: 500, redlineRpm: 7000 },
    setup: {
      drivetrainType: 'AWD', awdScheme: 'awd-transverse-perf', transmissionType: 'dct-wet', gearCount: 7,
      gearRatios: [3.56, 2.53, 1.68, 1.02, 0.79, 0.76, 0.63], finalDriveRatio: 4.17, tireRadiusMm: 325,
      differentialType: 'electronic-torque-vectoring', steeringType: 'electric-eps', rearWheelSteering: false,
      frontSuspension: 'macpherson', rearSuspension: 'multi-link',
      stabilityControlType: 'esc-sport-variable', stabilityControlThresholdPercent: 35,
      frontCaliper: 'fixed-6p', frontDiscType: 'drilled-slotted-iron', frontDiscMm: 375,
      rearCaliper: 'floating-1p', rearDiscType: 'vented-iron', rearDiscMm: 310,
    },
  },
  {
    id: 13,
    name: 'Mercedes-AMG A45 S 8DCT Torque Splitter AWD (2020)',
    year: 2020,
    targetLossPct: 16.8,
    chassisSpec: { pos: 'Anteriore', ori: 'Trasversale', drivetrainMode: 'FWD_AWD_Ready', gearboxLayout: 'InBlockWithEngine', structureId: 'str-uhss-steel', groundClearanceMm: 125 },
    powertrain: { isEv: false, peakPowerHp: 421, peakPowerRpm: 6750, peakTorqueNm: 500, redlineRpm: 7200 },
    setup: {
      drivetrainType: 'AWD', awdScheme: 'awd-transverse-perf', transmissionType: 'dct-wet', gearCount: 8,
      gearRatios: [4.21, 2.75, 1.91, 1.38, 1.04, 0.83, 0.68, 0.56], finalDriveRatio: 4.13, tireRadiusMm: 322,
      differentialType: 'electronic-torque-vectoring', steeringType: 'electric-eps', rearWheelSteering: false,
      frontSuspension: 'macpherson', rearSuspension: 'multi-link',
      stabilityControlType: 'esc-sport-variable', stabilityControlThresholdPercent: 30,
      frontCaliper: 'fixed-6p', frontDiscType: 'drilled-slotted-iron', frontDiscMm: 360,
      rearCaliper: 'floating-1p', rearDiscType: 'vented-iron', rearDiscMm: 330,
    },
  },
  {
    id: 14,
    name: 'Subaru Impreza WRX STI 6M Perm. AWD (2005)',
    year: 2005,
    targetLossPct: 19.2,
    chassisSpec: { pos: 'Anteriore', ori: 'Longitudinale', drivetrainMode: 'RWD_AWD_Ready', gearboxLayout: 'InBlockWithEngine', structureId: 'str-uhss-steel', groundClearanceMm: 145 },
    powertrain: { isEv: false, peakPowerHp: 280, peakPowerRpm: 6000, peakTorqueNm: 392, redlineRpm: 7500 },
    setup: {
      drivetrainType: 'AWD', awdScheme: 'awd-longitudinal-perm', transmissionType: 'manual-h', gearCount: 6,
      gearRatios: [3.64, 2.37, 1.76, 1.35, 0.97, 0.76], finalDriveRatio: 3.90, tireRadiusMm: 314,
      differentialType: 'torsen-helical', steeringType: 'hydraulic-hps', rearWheelSteering: false,
      frontSuspension: 'macpherson', rearSuspension: 'macpherson',
      stabilityControlType: 'abs-only', stabilityControlThresholdPercent: 80,
      frontCaliper: 'fixed-4p', frontDiscType: 'vented-iron', frontDiscMm: 326,
      rearCaliper: 'floating-2p', rearDiscType: 'vented-iron', rearDiscMm: 316,
    },
  },
  {
    id: 15,
    name: 'Audi RS4 B7 6M Torsen Perm. AWD (2006)',
    year: 2006,
    targetLossPct: 19.0,
    chassisSpec: { pos: 'Anteriore', ori: 'Longitudinale', drivetrainMode: 'RWD_AWD_Ready', gearboxLayout: 'InBlockWithEngine', structureId: 'str-uhss-steel', groundClearanceMm: 120 },
    powertrain: { isEv: false, peakPowerHp: 420, peakPowerRpm: 7800, peakTorqueNm: 430, redlineRpm: 8250 },
    setup: {
      drivetrainType: 'AWD', awdScheme: 'awd-longitudinal-perm', transmissionType: 'manual-h', gearCount: 6,
      gearRatios: [3.67, 2.05, 1.46, 1.13, 0.92, 0.78], finalDriveRatio: 4.11, tireRadiusMm: 323,
      differentialType: 'torsen-helical', steeringType: 'hydraulic-hps', rearWheelSteering: false,
      frontSuspension: 'double-wishbone', rearSuspension: 'multi-link',
      stabilityControlType: 'esc-standard', stabilityControlThresholdPercent: 60,
      frontCaliper: 'fixed-8p-race', frontDiscType: 'drilled-slotted-iron', frontDiscMm: 365,
      rearCaliper: 'floating-1p', rearDiscType: 'vented-iron', rearDiscMm: 324,
    },
  },
  {
    id: 16,
    name: 'Nissan GT-R R35 6DCT AWD (2012)',
    year: 2012,
    targetLossPct: 17.5,
    chassisSpec: { pos: 'Anteriore-Centrale', ori: 'Longitudinale', drivetrainMode: 'RWD_AWD_Ready', gearboxLayout: 'RearTransaxleTorqueTube', structureId: 'str-uhss-steel', groundClearanceMm: 110 },
    powertrain: { isEv: false, peakPowerHp: 550, peakPowerRpm: 6400, peakTorqueNm: 632, redlineRpm: 7000 },
    setup: {
      drivetrainType: 'AWD', awdScheme: 'awd-longitudinal-perm', transmissionType: 'dct-wet', gearCount: 6,
      gearRatios: [4.06, 2.30, 1.59, 1.25, 1.00, 0.80], finalDriveRatio: 3.70, tireRadiusMm: 344,
      differentialType: 'mechanical-clutch-lsd', steeringType: 'hydraulic-hps', rearWheelSteering: false,
      frontSuspension: 'double-wishbone', rearSuspension: 'multi-link',
      stabilityControlType: 'esc-sport-variable', stabilityControlThresholdPercent: 35,
      frontCaliper: 'fixed-6p', frontDiscType: 'drilled-slotted-iron', frontDiscMm: 390,
      rearCaliper: 'fixed-4p', rearDiscType: 'drilled-slotted-iron', rearDiscMm: 380,
    },
  },
  {
    id: 17,
    name: 'Land Rover Defender 110 5M 4WD Ridotte (1995)',
    year: 1995,
    targetLossPct: 23.5,
    chassisSpec: { pos: 'Anteriore', ori: 'Longitudinale', drivetrainMode: 'RWD_AWD_Ready', gearboxLayout: 'InBlockWithEngine', structureId: 'str-ladder-frame', groundClearanceMm: 215 },
    powertrain: { isEv: false, peakPowerHp: 113, peakPowerRpm: 4000, peakTorqueNm: 265, redlineRpm: 4500 },
    setup: {
      drivetrainType: 'AWD', awdScheme: 'awd-4wd-heavy-lowrange', transmissionType: 'manual-h', gearCount: 5,
      gearRatios: [3.69, 2.13, 1.40, 1.00, 0.77], finalDriveRatio: 3.54, tireRadiusMm: 404,
      differentialType: 'offroad-locking', steeringType: 'hydraulic-hps', rearWheelSteering: false,
      frontSuspension: 'solid-axle-coil', rearSuspension: 'solid-axle-coil',
      stabilityControlType: 'none', stabilityControlThresholdPercent: 0,
      frontCaliper: 'floating-2p', frontDiscType: 'solid-iron', frontDiscMm: 298,
      rearCaliper: 'floating-2p', rearDiscType: 'solid-iron', rearDiscMm: 290,
    },
  },
  {
    id: 18,
    name: 'Mercedes Classe G G500 9AT 4WD Ridotte (2020)',
    year: 2020,
    targetLossPct: 22.5,
    chassisSpec: { pos: 'Anteriore', ori: 'Longitudinale', drivetrainMode: 'RWD_AWD_Ready', gearboxLayout: 'InBlockWithEngine', structureId: 'str-ladder-frame', groundClearanceMm: 241 },
    powertrain: { isEv: false, peakPowerHp: 422, peakPowerRpm: 5250, peakTorqueNm: 610, redlineRpm: 6500 },
    setup: {
      drivetrainType: 'AWD', awdScheme: 'awd-4wd-heavy-lowrange', transmissionType: 'auto-modern-lockup', gearCount: 9,
      gearRatios: [5.35, 3.24, 2.25, 1.64, 1.21, 1.00, 0.86, 0.72, 0.60], finalDriveRatio: 4.30, tireRadiusMm: 392,
      differentialType: 'offroad-locking', steeringType: 'electric-eps', rearWheelSteering: false,
      frontSuspension: 'double-wishbone', rearSuspension: 'solid-axle-coil',
      stabilityControlType: 'esc-standard', stabilityControlThresholdPercent: 60,
      frontCaliper: 'fixed-6p', frontDiscType: 'drilled-slotted-iron', frontDiscMm: 354,
      rearCaliper: 'floating-1p', rearDiscType: 'vented-iron', rearDiscMm: 345,
    },
  },
  {
    id: 19,
    name: 'Toyota Prius/Corolla CVT FWD (2020)',
    year: 2020,
    targetLossPct: 15.5,
    chassisSpec: { pos: 'Anteriore', ori: 'Trasversale', drivetrainMode: 'FWD_Only', gearboxLayout: 'InBlockWithEngine', structureId: 'str-uhss-steel', groundClearanceMm: 135 },
    powertrain: { isEv: false, peakPowerHp: 140, peakPowerRpm: 5200, peakTorqueNm: 185, redlineRpm: 6000 },
    setup: {
      drivetrainType: 'FWD', awdScheme: null, transmissionType: 'cvt', gearCount: 1,
      gearRatios: [1.00], finalDriveRatio: 3.45, tireRadiusMm: 312,
      differentialType: 'open', steeringType: 'electric-eps', rearWheelSteering: false,
      frontSuspension: 'macpherson', rearSuspension: 'multi-link',
      stabilityControlType: 'esc-standard', stabilityControlThresholdPercent: 75,
      frontCaliper: 'floating-1p', frontDiscType: 'vented-iron', frontDiscMm: 282,
      rearCaliper: 'floating-1p', rearDiscType: 'solid-iron', rearDiscMm: 260,
    },
  },
  {
    id: 20,
    name: 'Tesla Model 3 Performance EV 1-Spd AWD (2024)',
    year: 2024,
    targetLossPct: 6.8,
    chassisSpec: { pos: 'Anteriore', ori: 'Trasversale', drivetrainMode: 'FWD_AWD_Ready', gearboxLayout: 'InBlockWithEngine', structureId: 'str-hybrid-giorgio', groundClearanceMm: 135 },
    powertrain: { isEv: true, peakPowerHp: 510, peakPowerRpm: 8000, peakTorqueNm: 740, redlineRpm: 18000 },
    setup: {
      drivetrainType: 'AWD', awdScheme: 'awd-transverse-perf', transmissionType: 'ev-single-speed', gearCount: 1,
      gearRatios: [1.00], finalDriveRatio: 9.00, tireRadiusMm: 334,
      differentialType: 'open', steeringType: 'electric-eps', rearWheelSteering: false,
      frontSuspension: 'double-wishbone', rearSuspension: 'multi-link',
      stabilityControlType: 'esc-sport-variable', stabilityControlThresholdPercent: 40,
      frontCaliper: 'fixed-4p', frontDiscType: 'vented-iron', frontDiscMm: 355,
      rearCaliper: 'floating-1p', rearDiscType: 'vented-iron', rearDiscMm: 335,
    },
  },
];

function runDrivetrainBenchmark(): void {
  console.log('=== BENCHMARK TRASMISSIONE & DINAMICA FASE 2.3 (20 VEICOLI REALI) ===');
  console.log('| # | Veicolo | Loss Sim / Reale (Err pp) | WHP | Vmax Top Gear | @130 km/h |');
  console.log('| :---: | :--- | :---: | :---: | :---: | :---: |');

  let outLoss2 = 0;
  const absDiffs: number[] = [];

  for (const v of CASES) {
    const chs = makeBenchChassisForDrive(v.id, v.name, v.year, v.chassisSpec);
    const m = calculateDrivetrainMetrics(
      {
        id: `drv-${v.id}`,
        name: v.name,
        year: v.year,
        chassisId: chs.id,
        engineId: `eng-${v.id}`,
        ...v.setup,
      },
      chs,
      v.powertrain,
    );

    const diffPp = m.drivetrainLossPercent - v.targetLossPct;
    absDiffs.push(Math.abs(diffPp));
    if (Math.abs(diffPp) > 2.0) outLoss2++;

    console.log(
      `| ${v.id} | ${v.name} | ${m.drivetrainLossPercent.toFixed(1)}% / ${v.targetLossPct.toFixed(1)}% (${diffPp >= 0 ? '+' : ''}${diffPp.toFixed(1)} pp) | ${m.wheelPeakPowerHp} CV | ${m.theoreticalTopSpeedKmh.toFixed(0)} km/h | ${m.cruisingRpmAt130Kmh} rpm |`,
    );
  }

  const meanDiff = absDiffs.reduce((a, b) => a + b, 0) / absDiffs.length;

  console.log('\n=== TEST FISICI & VINCOLI PIANALE (6/6 OBBLIGATORI) ===');
  // Test 1: Vincolo Pianale (awd-longitudinal-perm su Trasversale -> false; awd-transverse-perf su Trasversale AWD_Ready -> true)
  const transvChs = makeBenchChassisForDrive(101, 'Transv Bench', 2022, CASES[10].chassisSpec);
  const resBadAwd = calculateDrivetrainMetrics(
    { id: 't1a', name: 'Bad AWD', year: 2022, chassisId: transvChs.id, engineId: 'e1', ...CASES[10].setup, awdScheme: 'awd-longitudinal-perm' },
    transvChs,
    CASES[10].powertrain,
  );
  const resGoodAwd = calculateDrivetrainMetrics(
    { id: 't1b', name: 'Good AWD', year: 2022, chassisId: transvChs.id, engineId: 'e1', ...CASES[10].setup, awdScheme: 'awd-transverse-perf' },
    transvChs,
    CASES[10].powertrain,
  );
  const t1Ok = !resBadAwd.isCompatibleWithChassis && resGoodAwd.isCompatibleWithChassis;
  console.log(`[${t1Ok ? 'PASS' : 'FAIL'}] 1. Vincolo Pianale AWD: Long su Trasv=${resBadAwd.isCompatibleWithChassis} vs Perf Trasv su Trasv=${resGoodAwd.isCompatibleWithChassis}`);

  // Test 2: Monotonia Drivetrain Loss: EV Direct < FWD Manual < RWD Manual < Haldex AWD < Longitudinal Perm AWD < 4WD Heavy-Duty
  const lossEv = calculateDrivetrainMetrics(
    { id: 't2a', name: 'EV', year: 2024, chassisId: transvChs.id, engineId: 'e', ...CASES[19].setup },
    transvChs,
    CASES[19].powertrain,
  ).drivetrainLossPercent;
  const fwdChs = makeBenchChassisForDrive(102, 'FWD', 2020, CASES[2].chassisSpec);
  const lossFwd = calculateDrivetrainMetrics(
    { id: 't2b', name: 'FWD', year: 2020, chassisId: fwdChs.id, engineId: 'e', ...CASES[2].setup, differentialType: 'open' },
    fwdChs,
    CASES[2].powertrain,
  ).drivetrainLossPercent;
  const rwdChs = makeBenchChassisForDrive(103, 'RWD', 2020, { pos: 'Anteriore-Centrale', ori: 'Longitudinale', drivetrainMode: 'RWD_AWD_Ready', gearboxLayout: 'InBlockWithEngine', structureId: 'str-uhss-steel', groundClearanceMm: 130 });
  const lossRwd = calculateDrivetrainMetrics(
    { id: 't2c', name: 'RWD', chassisId: rwdChs.id, engineId: 'e', ...CASES[3].setup, year: 2020, differentialType: 'open' },
    rwdChs,
    CASES[3].powertrain,
  ).drivetrainLossPercent;
  const lossHaldex = calculateDrivetrainMetrics(
    { id: 't2d', name: 'Haldex', year: 2020, chassisId: transvChs.id, engineId: 'e', ...CASES[10].setup, transmissionType: 'manual-h', differentialType: 'open' },
    transvChs,
    CASES[10].powertrain,
  ).drivetrainLossPercent;
  const lossPerm = calculateDrivetrainMetrics(
    { id: 't2e', name: 'Perm', chassisId: rwdChs.id, engineId: 'e', ...CASES[13].setup, year: 2020, differentialType: 'open' },
    rwdChs,
    CASES[13].powertrain,
  ).drivetrainLossPercent;
  const lossHeavy = calculateDrivetrainMetrics(
    { id: 't2f', name: 'Heavy', chassisId: rwdChs.id, engineId: 'e', ...CASES[16].setup, year: 2020, differentialType: 'open' },
    rwdChs,
    CASES[16].powertrain,
  ).drivetrainLossPercent;
  const t2Ok =
    lossEv < lossFwd &&
    lossFwd < lossRwd &&
    lossRwd < lossHaldex &&
    lossHaldex < lossPerm &&
    lossPerm < lossHeavy;
  console.log(`[${t2Ok ? 'PASS' : 'FAIL'}] 2. Monotonia Loss: EV(${lossEv}%) < FWD(${lossFwd}%) < RWD(${lossRwd}%) < Haldex(${lossHaldex}%) < Perm(${lossPerm}%) < Heavy(${lossHeavy}%)`);

  // Test 3: Rapportatura Reale (finalDriveRatio 3.50 -> 4.50)
  const baseDrive = calculateDrivetrainMetrics(
    { id: 't3a', name: 'FD 3.5', year: 2020, chassisId: fwdChs.id, engineId: 'e', ...CASES[2].setup, finalDriveRatio: 3.50, gearRatios: generateDefaultGearRatios(6, 'manual-h', 'balanced') },
    fwdChs,
    CASES[2].powertrain,
  );
  const shortDrive = calculateDrivetrainMetrics(
    { id: 't3b', name: 'FD 4.5', year: 2020, chassisId: fwdChs.id, engineId: 'e', ...CASES[2].setup, finalDriveRatio: 4.50, gearRatios: generateDefaultGearRatios(6, 'manual-h', 'balanced') },
    fwdChs,
    CASES[2].powertrain,
  );
  const ratioFactor = 4.5 / 3.5;
  const speedRatioObserved = baseDrive.gearsTelemetry[5].speedAtRedlineKmh / shortDrive.gearsTelemetry[5].speedAtRedlineKmh;
  const torqueRatioObserved = shortDrive.maxWheelTorqueFirstGearNm / baseDrive.maxWheelTorqueFirstGearNm;
  const t3Ok =
    Math.abs(speedRatioObserved - ratioFactor) / ratioFactor < 0.002 &&
    Math.abs(torqueRatioObserved - ratioFactor) / ratioFactor < 0.002;
  console.log(`[${t3Ok ? 'PASS' : 'FAIL'}] 3. Rapportatura Final Drive 3.5->4.5: ΔSpeed ratio=${speedRatioObserved.toFixed(4)} vs ΔTorque=${torqueRatioObserved.toFixed(4)} (atteso ${ratioFactor.toFixed(4)})`);

  // Test 4: Overload Cambio (950 Nm su cambio utilitaria CVT/Manuale piccolo)
  const smallNormal = calculateDrivetrainMetrics(
    { id: 't4a', name: 'Normal', chassisId: fwdChs.id, engineId: 'e', ...CASES[0].setup, year: 1995, transmissionType: 'cvt' },
    fwdChs,
    { isEv: false, peakPowerHp: 90, peakPowerRpm: 5500, peakTorqueNm: 140, redlineRpm: 6200 },
  );
  const smallOverload = calculateDrivetrainMetrics(
    { id: 't4b', name: 'Overload', chassisId: fwdChs.id, engineId: 'e', ...CASES[0].setup, year: 1995, transmissionType: 'cvt' },
    fwdChs,
    { isEv: false, peakPowerHp: 700, peakPowerRpm: 6000, peakTorqueNm: 950, redlineRpm: 6800 },
  );
  const durDropPct = ((smallOverload.estimatedDurabilityKm - smallNormal.estimatedDurabilityKm) / smallNormal.estimatedDurabilityKm) * 100;
  const t4Ok = smallOverload.torqueOverloadRatio > 2.0 && durDropPct < -60 && smallOverload.warnings.some((w) => w.includes('Sovraccarico'));
  console.log(`[${t4Ok ? 'PASS' : 'FAIL'}] 4. Overload Cambio (950 Nm): ratio=${smallOverload.torqueOverloadRatio}x, Durabilità ${smallNormal.estimatedDurabilityKm}->${smallOverload.estimatedDurabilityKm} km (${durDropPct.toFixed(1)}%)`);

  // Test 5: Ridotte 4WD >= 2.5x
  const heavyChs = makeBenchChassisForDrive(105, 'Defender', 2020, CASES[16].chassisSpec);
  const heavyMetrics = calculateDrivetrainMetrics(
    { id: 't5', name: '4WD Low', year: 2020, chassisId: heavyChs.id, engineId: 'e', ...CASES[16].setup },
    heavyChs,
    CASES[16].powertrain,
  );
  const lowRangeFactor = (heavyMetrics.lowRangeFirstGearTorqueNm ?? 0) / heavyMetrics.maxWheelTorqueFirstGearNm;
  const t5Ok = lowRangeFactor >= 2.5;
  console.log(`[${t5Ok ? 'PASS' : 'FAIL'}] 5. Ridotte 4WD: 1a Lunga=${heavyMetrics.maxWheelTorqueFirstGearNm} Nm -> 1a Ridotta=${heavyMetrics.lowRangeFirstGearTorqueNm} Nm (${lowRangeFactor.toFixed(2)}x >= 2.5x)`);

  // Test 6: Freni floating-1p solid 260mm -> fixed-6p carbon-ceramic 400mm
  const brakeSmall = calculateDrivetrainMetrics(
    { id: 't6a', name: 'Brake Base', year: 2022, chassisId: fwdChs.id, engineId: 'e', ...CASES[2].setup, frontCaliper: 'floating-1p', frontDiscType: 'solid-iron', frontDiscMm: 260 },
    fwdChs,
    CASES[2].powertrain,
  );
  const brakeBig = calculateDrivetrainMetrics(
    { id: 't6b', name: 'Brake Ceramic', year: 2022, chassisId: fwdChs.id, engineId: 'e', ...CASES[2].setup, frontCaliper: 'fixed-6p', frontDiscType: 'carbon-ceramic', frontDiscMm: 400 },
    fwdChs,
    CASES[2].powertrain,
  );
  const t6Ok =
    brakeBig.frontBrakeTorqueNm > brakeSmall.frontBrakeTorqueNm * 2.5 &&
    brakeBig.brakeThermalCapacityKj > brakeSmall.brakeThermalCapacityKj;
  console.log(`[${t6Ok ? 'PASS' : 'FAIL'}] 6. Freni 260mm 1p -> 400mm 6p CCM: Coppia Ant ${brakeSmall.frontBrakeTorqueNm}->${brakeBig.frontBrakeTorqueNm} Nm | Capacità Termica ${brakeSmall.brakeThermalCapacityKj}->${brakeBig.brakeThermalCapacityKj} kJ`);

  // Test 7: Collisione V8/I6 su vano compatto (stesso orientamento, sforamento mm) -> false
  const compactBayChassis: ChassisEntity = {
    ...rwdChs,
    engineBayMaxDimensionsMm: { lengthMm: 520, widthMm: 620, heightMm: 600 },
  };
  const v8Overflow = calculateDrivetrainMetrics(
    { id: 't7', name: 'V8 in Compact', year: 2022, chassisId: compactBayChassis.id, engineId: 'v8', ...CASES[3].setup },
    compactBayChassis,
    {
      isEv: false,
      peakPowerHp: 620,
      peakPowerRpm: 6500,
      peakTorqueNm: 800,
      redlineRpm: 7500,
      dimensionsMm: { lengthMm: 645, widthMm: 725, heightMm: 665 },
      nativeOrientation: 'Longitudinale',
    },
  );
  const t7Ok =
    !v8Overflow.isCompatibleWithChassis &&
    v8Overflow.compatibilityErrors.some((e) => e.includes('mm'));
  console.log(`[${t7Ok ? 'PASS' : 'FAIL'}] 7. Collisione V8 su vano compatto: compatibile=${v8Overflow.isCompatibleWithChassis} (${v8Overflow.compatibilityErrors[0]?.slice(0, 55)}...)`);

  // Test 8: Violazione monotonia marce -> errore bloccante
  const badRatios = calculateDrivetrainMetrics(
    {
      id: 't8',
      name: 'Bad Ratios',
      year: 2020,
      chassisId: fwdChs.id,
      engineId: 'e',
      ...CASES[2].setup,
      gearRatios: [3.20, 2.10, 2.35, 1.35, 1.00, 0.80],
    },
    fwdChs,
    CASES[2].powertrain,
  );
  const t8Ok =
    !badRatios.isCompatibleWithChassis &&
    badRatios.compatibilityErrors.some((e) => e.includes('Rapportatura non valida'));
  console.log(`[${t8Ok ? 'PASS' : 'FAIL'}] 8. Violazione monotonia marce: compatibile=${badRatios.isCompatibleWithChassis} (errore bloccante presente=${t8Ok})`);

  // Test 9: Sinergia/mismatch sospensioni Ant x Post x Trazione
  const suspMismatch = calculateDrivetrainMetrics(
    {
      id: 't9a',
      name: 'Susp Mismatch',
      year: 2020,
      chassisId: rwdChs.id,
      engineId: 'e',
      ...CASES[3].setup,
      frontSuspension: 'pushrod-inboard',
      rearSuspension: 'solid-axle-leaf',
    },
    rwdChs,
    CASES[3].powertrain,
  );
  const suspBalanced = calculateDrivetrainMetrics(
    {
      id: 't9b',
      name: 'Susp Balanced',
      year: 2020,
      chassisId: rwdChs.id,
      engineId: 'e',
      ...CASES[3].setup,
      frontSuspension: 'double-wishbone',
      rearSuspension: 'multi-link',
    },
    rwdChs,
    CASES[3].powertrain,
  );
  const t9Ok =
    suspMismatch.suspensionPairingScore < 70 &&
    suspBalanced.suspensionPairingScore >= 90 &&
    suspMismatch.rearGripGeometryScore < suspBalanced.rearGripGeometryScore;
  console.log(`[${t9Ok ? 'PASS' : 'FAIL'}] 9. Sinergia Sospensioni: Mismatch=${suspMismatch.suspensionPairingScore}/100 vs Bilanciato=${suspBalanced.suspensionPairingScore}/100`);

  // Test 10: Scala coppia gearboxStrengthTier
  const capCompact = calculateDrivetrainMetrics(
    { id: 't10a', name: 'C', year: 2020, chassisId: rwdChs.id, engineId: 'e', ...CASES[3].setup, gearboxStrengthTier: 'compact' },
    rwdChs,
    CASES[3].powertrain,
  ).gearboxTorqueCapacityNm;
  const capStd = calculateDrivetrainMetrics(
    { id: 't10b', name: 'S', year: 2020, chassisId: rwdChs.id, engineId: 'e', ...CASES[3].setup, gearboxStrengthTier: 'standard' },
    rwdChs,
    CASES[3].powertrain,
  ).gearboxTorqueCapacityNm;
  const capHd = calculateDrivetrainMetrics(
    { id: 't10c', name: 'H', year: 2020, chassisId: rwdChs.id, engineId: 'e', ...CASES[3].setup, gearboxStrengthTier: 'heavy-duty' },
    rwdChs,
    CASES[3].powertrain,
  ).gearboxTorqueCapacityNm;
  const capMs = calculateDrivetrainMetrics(
    { id: 't10d', name: 'M', year: 2020, chassisId: rwdChs.id, engineId: 'e', ...CASES[3].setup, gearboxStrengthTier: 'motorsport' },
    rwdChs,
    CASES[3].powertrain,
  ).gearboxTorqueCapacityNm;
  const t10Ok = capCompact < capStd && capStd < capHd && capHd < capMs;
  console.log(`[${t10Ok ? 'PASS' : 'FAIL'}] 10. Gearbox Tier: compact=${capCompact} < std=${capStd} < hd=${capHd} < motorsport=${capMs} Nm`);

  // Test 11: Interferenza disco 400 mm dentro cerchio 17" -> false
  const rimCollision = calculateDrivetrainMetrics(
    {
      id: 't11',
      name: '400mm in 17"',
      year: 2022,
      chassisId: fwdChs.id,
      engineId: 'e',
      ...CASES[2].setup,
      rimDiameterInch: 17,
      tireSidewallMm: 105,
      frontCaliper: 'fixed-6p',
      frontDiscMm: 400,
    },
    fwdChs,
    CASES[2].powertrain,
  );
  const t11Ok =
    !rimCollision.isCompatibleWithChassis &&
    rimCollision.maxFrontDiscMm === 341 &&
    rimCollision.compatibilityErrors.some((e) => e.includes('400 mm'));
  console.log(`[${t11Ok ? 'PASS' : 'FAIL'}] 11. Cerchio 17" vs Disco 400mm (6p): compatibile=${rimCollision.isCompatibleWithChassis}, max=${rimCollision.maxFrontDiscMm}mm`);

  // Test 12: Dischi carbon-carbon vs carbon-ceramic vs solid-iron
  const brakeSolid = calculateDrivetrainMetrics(
    {
      id: 't12a', name: 'Solid', year: 2022, chassisId: rwdChs.id, engineId: 'e',
      ...CASES[3].setup, frontCaliper: 'fixed-6p', frontDiscType: 'solid-iron', frontDiscMm: 380, rearDiscType: 'solid-iron', rearDiscMm: 350,
    },
    rwdChs,
    CASES[3].powertrain,
  );
  const brakeCcm = calculateDrivetrainMetrics(
    {
      id: 't12b', name: 'CCM', year: 2022, chassisId: rwdChs.id, engineId: 'e',
      ...CASES[3].setup, frontCaliper: 'fixed-6p', frontDiscType: 'carbon-ceramic', frontDiscMm: 380, rearDiscType: 'carbon-ceramic', rearDiscMm: 350,
    },
    rwdChs,
    CASES[3].powertrain,
  );
  const brakeCC = calculateDrivetrainMetrics(
    {
      id: 't12c', name: 'C/C', year: 2022, chassisId: rwdChs.id, engineId: 'e',
      ...CASES[3].setup, frontCaliper: 'fixed-6p', frontDiscType: 'carbon-carbon', frontDiscMm: 380, rearDiscType: 'carbon-carbon', rearDiscMm: 350,
    },
    rwdChs,
    CASES[3].powertrain,
  );
  const t12Ok =
    brakeCC.weightBreakdownKg.brakesKg < brakeCcm.weightBreakdownKg.brakesKg &&
    brakeCcm.weightBreakdownKg.brakesKg < brakeSolid.weightBreakdownKg.brakesKg &&
    brakeCC.brakeThermalCapacityKj > brakeCcm.brakeThermalCapacityKj * 1.4 &&
    brakeCcm.brakeThermalCapacityKj > brakeSolid.brakeThermalCapacityKj * 1.8 &&
    brakeCC.warnings.some((w) => w.includes('Carbo-Carbo'));
  console.log(`[${t12Ok ? 'PASS' : 'FAIL'}] 12. Dischi Solid->CCM->C/C: Peso=${brakeSolid.weightBreakdownKg.brakesKg}->${brakeCcm.weightBreakdownKg.brakesKg}->${brakeCC.weightBreakdownKg.brakesKg}kg | Termica=${brakeSolid.brakeThermalCapacityKj}->${brakeCcm.brakeThermalCapacityKj}->${brakeCC.brakeThermalCapacityKj}kJ`);

  // Test 13: Costo setup stradale < $10M & taratura soglie abs-racing / esc-standard
  const streetSetup = calculateDrivetrainMetrics(
    { id: 't13a', name: 'Street', year: 2018, chassisId: fwdChs.id, engineId: 'e', ...CASES[0].setup, stabilityControlType: 'esc-standard', absSlipThresholdPercent: 90, tcsSlipThresholdPercent: 90, escYawThresholdPercent: 90 },
    fwdChs,
    CASES[0].powertrain,
  );
  const streetSetupLowThresh = calculateDrivetrainMetrics(
    { id: 't13b', name: 'Street Low', year: 2018, chassisId: fwdChs.id, engineId: 'e', ...CASES[0].setup, stabilityControlType: 'esc-standard', absSlipThresholdPercent: 20, tcsSlipThresholdPercent: 20, escYawThresholdPercent: 20 },
    fwdChs,
    CASES[0].powertrain,
  );
  const absRacingHigh = calculateDrivetrainMetrics(
    { id: 't13c', name: 'ABS Race H', year: 2018, chassisId: rwdChs.id, engineId: 'e', ...CASES[3].setup, stabilityControlType: 'abs-racing', absSlipThresholdPercent: 90 },
    rwdChs,
    CASES[3].powertrain,
  );
  const absRacingLow = calculateDrivetrainMetrics(
    { id: 't13d', name: 'ABS Race L', year: 2018, chassisId: rwdChs.id, engineId: 'e', ...CASES[3].setup, stabilityControlType: 'abs-racing', absSlipThresholdPercent: 20 },
    rwdChs,
    CASES[3].powertrain,
  );
  const t13Ok =
    streetSetup.developmentCost.capitalCost < 10_000_000 &&
    streetSetupLowThresh.stabilityInterventionFactor > streetSetup.stabilityInterventionFactor &&
    absRacingLow.stabilityInterventionFactor > absRacingHigh.stabilityInterventionFactor;
  console.log(`[${t13Ok ? 'PASS' : 'FAIL'}] 13. Costi Stradali ($${(streetSetup.developmentCost.capitalCost / 1e6).toFixed(2)}M < $10M, ${streetSetup.developmentCost.rdCost} R&D) & Taratura ESC/ABS Racing attiva`);

  // Test 14: Motore nativo Trasversale su pianale solo Longitudinale -> false (orientamento incompatibile)
  const nativeMismatch = calculateDrivetrainMetrics(
    { id: 't14', name: 'Orient Mismatch', year: 2020, chassisId: rwdChs.id, engineId: 'e', ...CASES[3].setup },
    rwdChs,
    {
      isEv: false,
      peakPowerHp: 280,
      peakPowerRpm: 6000,
      peakTorqueNm: 400,
      redlineRpm: 6800,
      dimensionsMm: { lengthMm: 445, widthMm: 535, heightMm: 615 },
      nativeOrientation: 'Trasversale',
    },
  );
  const t14Ok =
    !nativeMismatch.isCompatibleWithChassis &&
    nativeMismatch.resolvedEngineOrientation === 'Trasversale' &&
    nativeMismatch.compatibilityErrors.some((e) => e.includes('Orientamento incompatibile'));
  console.log(`[${t14Ok ? 'PASS' : 'FAIL'}] 14. Blocco orientamento nativo Trasv su Long: compatibile=${nativeMismatch.isCompatibleWithChassis}`);

  // Test 15: Costo, peso e R&D scalati sul numero di marce (5 vs 7 manual-h, 6 vs 8 dct-wet)
  const man5 = calculateDrivetrainMetrics(
    { id: 't15a', name: '5M', year: 2020, chassisId: rwdChs.id, engineId: 'e', ...CASES[3].setup, transmissionType: 'manual-h', gearCount: 5, gearRatios: generateDefaultGearRatios(5, 'manual-h', 'balanced') },
    rwdChs,
    CASES[3].powertrain,
  );
  const man7 = calculateDrivetrainMetrics(
    { id: 't15b', name: '7M', year: 2020, chassisId: rwdChs.id, engineId: 'e', ...CASES[3].setup, transmissionType: 'manual-h', gearCount: 7, gearRatios: generateDefaultGearRatios(7, 'manual-h', 'balanced') },
    rwdChs,
    CASES[3].powertrain,
  );
  const dct6 = calculateDrivetrainMetrics(
    { id: 't15c', name: '6DCT', year: 2020, chassisId: rwdChs.id, engineId: 'e', ...CASES[3].setup, transmissionType: 'dct-wet', gearCount: 6, gearRatios: generateDefaultGearRatios(6, 'dct-wet', 'balanced') },
    rwdChs,
    CASES[3].powertrain,
  );
  const dct8 = calculateDrivetrainMetrics(
    { id: 't15d', name: '8DCT', year: 2020, chassisId: rwdChs.id, engineId: 'e', ...CASES[3].setup, transmissionType: 'dct-wet', gearCount: 8, gearRatios: generateDefaultGearRatios(8, 'dct-wet', 'balanced') },
    rwdChs,
    CASES[3].powertrain,
  );
  const t15Ok =
    man7.unitManufacturingCost > man5.unitManufacturingCost &&
    man7.weightBreakdownKg.gearboxKg > man5.weightBreakdownKg.gearboxKg &&
    man7.developmentCost.rdCost > man5.developmentCost.rdCost &&
    dct8.unitManufacturingCost > dct6.unitManufacturingCost &&
    dct8.weightBreakdownKg.gearboxKg > dct6.weightBreakdownKg.gearboxKg &&
    dct8.developmentCost.rdCost > dct6.developmentCost.rdCost;
  console.log(`[${t15Ok ? 'PASS' : 'FAIL'}] 15. Scala Marce: 5M->7M ($${man5.unitManufacturingCost}->$${man7.unitManufacturingCost}, ${man5.weightBreakdownKg.gearboxKg}->${man7.weightBreakdownKg.gearboxKg}kg, ${man5.developmentCost.rdCost}->${man7.developmentCost.rdCost} R&D)`);

  // Test 16: Cerchio 13" + spalla 55mm -> 220mm (<260mm) & staggered 19"/21"
  const tinyWheel = calculateDrivetrainMetrics(
    { id: 't16a', name: '13"', year: 1995, chassisId: fwdChs.id, engineId: 'e', ...CASES[0].setup, frontRimDiameterInch: 13, frontTireSidewallMm: 55, frontDiscMm: 220, rearDiscMm: 200 },
    fwdChs,
    CASES[0].powertrain,
  );
  const staggeredWheel = calculateDrivetrainMetrics(
    { id: 't16b', name: 'Stag', year: 2022, chassisId: rwdChs.id, engineId: 'e', ...CASES[3].setup, staggeredWheels: true, frontRimDiameterInch: 19, frontTireSidewallMm: 85, rearRimDiameterInch: 21, rearTireSidewallMm: 75, frontCaliper: 'fixed-6p', rearCaliper: 'fixed-4p' },
    rwdChs,
    CASES[3].powertrain,
  );
  const t16Ok =
    tinyWheel.frontTireRadiusMm === 220 &&
    tinyWheel.frontTireRadiusMm < 260 &&
    staggeredWheel.maxFrontDiscMm < staggeredWheel.maxRearDiscMm;
  console.log(`[${t16Ok ? 'PASS' : 'FAIL'}] 16. Ruote 13"+55mm=${tinyWheel.frontTireRadiusMm}mm (<260) | Staggered 19"/21" maxDisc=${staggeredWheel.maxFrontDiscMm}/${staggeredWheel.maxRearDiscMm}mm`);

  // Test 17: torsion-beam all'anteriore -> false
  const frontTorsion = calculateDrivetrainMetrics(
    { id: 't17', name: 'Front Torsion', year: 2020, chassisId: fwdChs.id, engineId: 'e', ...CASES[0].setup, frontSuspension: 'torsion-beam' },
    fwdChs,
    CASES[0].powertrain,
  );
  const t17Ok =
    !frontTorsion.isCompatibleWithChassis &&
    frontTorsion.compatibilityErrors.some((e) => e.includes('anteriore'));
  console.log(`[${t17Ok ? 'PASS' : 'FAIL'}] 17. Torsion-beam anteriore bloccato: compatibile=${frontTorsion.isCompatibleWithChassis}`);

  // Test 18: RWS 10° vs 2° -> turningCircleM nettamente più stretto con 10°
  const rws2 = calculateDrivetrainMetrics(
    { id: 't18a', name: 'RWS2', year: 2022, chassisId: rwdChs.id, engineId: 'e', ...CASES[3].setup, rearWheelSteering: true, rwsMaxAngleDeg: 2.0 },
    rwdChs,
    CASES[3].powertrain,
  );
  const rws10 = calculateDrivetrainMetrics(
    { id: 't18b', name: 'RWS10', year: 2022, chassisId: rwdChs.id, engineId: 'e', ...CASES[3].setup, rearWheelSteering: true, rwsMaxAngleDeg: 10.0 },
    rwdChs,
    CASES[3].powertrain,
  );
  const t18Ok = rws10.turningCircleM < rws2.turningCircleM - 1.5;
  console.log(`[${t18Ok ? 'PASS' : 'FAIL'}] 18. RWS 2° vs 10°: diametro=${rws2.turningCircleM}m -> ${rws10.turningCircleM}m`);

  // Test 19: Controlli modulari abs-racing + tcs:none + esc:none + hasDriveModeSelector:true
  const modAbsHigh = calculateDrivetrainMetrics(
    { id: 't19a', name: 'ModABS H', year: 2022, chassisId: rwdChs.id, engineId: 'e', ...CASES[3].setup, absType: 'abs-racing', tcsType: 'none', escType: 'none', hasDriveModeSelector: true, absSlipThresholdPercent: 90 },
    rwdChs,
    CASES[3].powertrain,
  );
  const modAbsLow = calculateDrivetrainMetrics(
    { id: 't19b', name: 'ModABS L', year: 2022, chassisId: rwdChs.id, engineId: 'e', ...CASES[3].setup, absType: 'abs-racing', tcsType: 'none', escType: 'none', hasDriveModeSelector: true, absSlipThresholdPercent: 20 },
    rwdChs,
    CASES[3].powertrain,
  );
  const t19Ok =
    modAbsHigh.isCompatibleWithChassis &&
    modAbsLow.stabilityInterventionFactor > modAbsHigh.stabilityInterventionFactor;
  console.log(`[${t19Ok ? 'PASS' : 'FAIL'}] 19. Modulare abs-racing + DriveMode: intervento ${modAbsHigh.stabilityInterventionFactor}->${modAbsLow.stabilityInterventionFactor}`);

  console.log('\n=== CHECKLIST CERTIFICAZIONE 2.3 ===');
  const all19Ok =
    t1Ok && t2Ok && t3Ok && t4Ok && t5Ok && t6Ok && t7Ok && t8Ok && t9Ok && t10Ok &&
    t11Ok && t12Ok && t13Ok && t14Ok && t15Ok && t16Ok && t17Ok && t18Ok && t19Ok;
  const okAll = outLoss2 === 0 && all19Ok;
  console.log(`[${outLoss2 === 0 ? 'CERTIFICATO' : 'FALLITO'}] Drivetrain Loss (20/20): ${outLoss2}/20 outlier > ±2.0 pp | Media |Err| = ${meanDiff.toFixed(2)} pp`);
  console.log(`[${all19Ok ? 'CERTIFICATO' : 'FALLITO'}] Tutti 19 test fisici e vincoli pianale PASS`);

  if (!okAll) process.exit(1);
}

runDrivetrainBenchmark();
