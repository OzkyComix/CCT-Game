import { calculatePistonGeometryAndDimensions, type PistonEngineConfigInput } from './engineMath';
import { calculateWankelGeometryAndDimensions, type WankelEngineConfigInput } from './wankelMath';
import { calculateElectricHybridGeometryAndDimensions } from './evHybridMath';
import type {
  ElectricCoolingSystem,
  ElectricMotorType,
  EngineOrientation,
  InverterPowerElectronicsType,
  PistonArchitecture,
  PowertrainBenchConfig,
  TurboCountConfig,
  TurboPosition,
  TurboType,
} from '../types/gameTypes';

type CamConfig = 'OHV' | 'SOHC' | 'DOHC';

type CategoryId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';

interface EnvelopeSpecBase {
  id: number;
  category: CategoryId;
  name: string;
  realL: number;
  realW: number;
  realH: number;
}

interface PistonEnvelopeSpec extends EnvelopeSpecBase {
  kind: 'piston';
  boreMm: number;
  strokeMm: number;
  cylinders: number;
  architecture: PistonArchitecture;
  bankAngleDeg: number;
  camConfig: CamConfig;
  valvesPerCylinder: 2 | 4;
  intakeSystemId: string;
  exhaustManifoldId: string;
  turboType: TurboType;
  turboCountConfig: TurboCountConfig;
  turboPosition: TurboPosition;
  arRatio: number;
  boostPressureBar: number;
}

interface WankelEnvelopeSpec extends EnvelopeSpecBase {
  kind: 'wankel';
  rotorCount: number;
  eccentricityMm: number;
  generatingRadiusMm: number;
  rotorWidthMm: number;
  turboType: TurboType;
  turboCountConfig: TurboCountConfig;
  turboPosition: TurboPosition;
  arRatio: number;
  boostPressureBar: number;
}

interface EvEnvelopeSpec extends EnvelopeSpecBase {
  kind: 'ev';
  electricMotorType: ElectricMotorType;
  statorDiameterMm: number;
  rotorLengthMm: number;
  voltageArchitecture: 400 | 800;
  coolingSystem: ElectricCoolingSystem;
  inverterPowerElectronics: InverterPowerElectronicsType;
  remoteInverter?: boolean;
}

type EnvelopeSpec = PistonEnvelopeSpec | WankelEnvelopeSpec | EvEnvelopeSpec;

export function makePistonConfig(
  s: PistonEnvelopeSpec,
  orientation: EngineOrientation = 'Longitudinale',
): PistonEngineConfigInput {
  const nTurbos =
    s.turboCountConfig === 'QuadTurbo'
      ? 4
      : s.turboCountConfig === 'TripleTurbo'
        ? 3
        : s.turboCountConfig === 'TwinTurbo'
          ? 2
          : 1;
  const camshaftTypeId =
    s.camConfig === 'OHV' ? 'cam-ohv' : s.camConfig === 'SOHC' ? 'cam-sohc' : 'cam-dohc';

  return {
    architecture: s.architecture,
    bankAngleDeg: s.bankAngleDeg,
    cylinders: s.cylinders,
    boreMm: s.boreMm,
    strokeMm: s.strokeMm,
    valvesPerCylinder: s.valvesPerCylinder,
    compressionRatio: s.turboType === 'NaturallyAspirated' ? 11.0 : 9.5,
    manualRedlineRpm: 7000,
    blockMaterialId: 'blk-alu-diecast',
    headMaterialId: 'hd-alu-cast',
    pistonTypeId: 'pst-hypereutectic',
    conrodTypeId: 'rod-c70-fractured',
    crankshaftTypeId: 'crk-forged-nitrided',
    camshaftTypeId,
    fuelType: 'Benzina',
    fuelSystemId: 'fs-gdi-350bar',
    intakeSystemId: s.intakeSystemId,
    exhaustManifoldId: s.exhaustManifoldId,
    turboType: s.turboType,
    turboCountConfig: s.turboCountConfig,
    turboBearingType: 'BallBearing',
    turboArRatio: s.arRatio,
    turboStagesArRatios: Array(nTurbos).fill(s.arRatio),
    boostPressureBar: s.boostPressureBar,
    turboPosition: s.turboType === 'NaturallyAspirated' ? 'None' : s.turboPosition,
    catalystEra: 'Era4_ActiveGlobalFilter_Euro7',
    intendedOrientation: orientation,
    nativeOrientation: orientation,
    priceTier: 'Media',
    referenceClass: 'Normale',
  };
}

function makeWankelConfig(s: WankelEnvelopeSpec): WankelEngineConfigInput {
  const nTurbos = s.turboCountConfig === 'TwinTurbo' ? 2 : 1;
  return {
    rotorCount: s.rotorCount,
    generatingRadiusMm: s.generatingRadiusMm,
    eccentricityMm: s.eccentricityMm,
    rotorWidthMm: s.rotorWidthMm,
    portType: s.rotorCount === 4 ? 'PeripheralPort' : 'StandardSide',
    apexSealMaterialId: 'seal-2pc-steel',
    apexSealThicknessMm: 2.0,
    housingMaterialId: 'whs-alu-cermet-nikasil',
    oilMeteringSystemId: 'omp-electronic-precision',
    compressionRatio: s.turboType === 'NaturallyAspirated' ? 10.0 : 9.0,
    fuelType: 'Benzina',
    turboType: s.turboType,
    turboCountConfig: s.turboCountConfig,
    turboBearingType: 'Journal',
    turboArRatio: s.arRatio,
    turboStagesArRatios: Array(nTurbos).fill(s.arRatio),
    boostPressureBar: s.boostPressureBar,
    turboPosition: s.turboType === 'NaturallyAspirated' ? 'None' : s.turboPosition,
    manualRedlineRpm: 8500,
    intendedOrientation: 'Longitudinale',
    nativeOrientation: 'Longitudinale',
    catalystEra: 'Era3_MultiStage_DPF_SCR_2000s',
    priceTier: 'Media',
    referenceClass: 'Sport',
  };
}

function makeEvBenchConfig(s: EvEnvelopeSpec): PowertrainBenchConfig {
  return {
    systemType: 'PureEV',
    motorCount: 1,
    hasMechanicalAwdShaft: false,
    benchArrangement: 'Single_1x',
    gearboxType: 'SingleSpeedDirect',
    gearRatio: 9.0,
    motor: {
      electricMotorType: s.electricMotorType,
      statorDiameterMm: s.statorDiameterMm,
      rotorLengthMm: s.rotorLengthMm,
      voltageArchitecture: s.voltageArchitecture,
      coolingSystem: s.coolingSystem,
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: s.inverterPowerElectronics,
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Media',
      referenceClass: 'Normale',
      maxMotorRpm: 16000,
    },
    battery: {
      batteryChemistry: 'NMC811',
      batteryCapacityKwh: 60,
      voltageArchitecture: s.voltageArchitecture,
      coolingSystem: 'LiquidGlycol',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'RoadBalanced',
      underbodyShield: 'StandardSteelShield',
      priceTier: 'Media',
      referenceClass: 'Normale',
    },
  };
}

const SPECS: EnvelopeSpec[] = [
  // A) 2 & 3 Cilindri in Linea (I2 / I3 — #1..#10)
  { id: 1, category: 'A', kind: 'piston', name: 'Fiat 0.9 TwinAir', boreMm: 80.5, strokeMm: 86.0, cylinders: 2, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'SOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.35, boostPressureBar: 1.5, realL: 330, realW: 460, realH: 580 },
  { id: 2, category: 'A', kind: 'piston', name: 'Renault 0.9 TCe H4Bt', boreMm: 72.2, strokeMm: 73.1, cylinders: 3, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.36, boostPressureBar: 1.2, realL: 410, realW: 510, realH: 590 },
  { id: 3, category: 'A', kind: 'piston', name: 'Toyota 1.0 1KR-FE', boreMm: 71.0, strokeMm: 84.0, cylinders: 3, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.40, boostPressureBar: 0, realL: 405, realW: 480, realH: 585 },
  { id: 4, category: 'A', kind: 'piston', name: 'VW 1.0 TSI EA211', boreMm: 74.5, strokeMm: 76.4, cylinders: 3, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.38, boostPressureBar: 1.4, realL: 425, realW: 535, realH: 600 },
  // Motori trasversali con scarico sul fronte cofano (= fianco collettori W nel sistema blocco motore -> 'Lateral')
  { id: 5, category: 'A', kind: 'piston', name: 'Ford 1.0 EcoBoost', boreMm: 71.9, strokeMm: 82.0, cylinders: 3, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.40, boostPressureBar: 1.5, realL: 420, realW: 540, realH: 610 },
  { id: 6, category: 'A', kind: 'piston', name: 'PSA 1.2 PureTech EB2', boreMm: 75.0, strokeMm: 90.5, cylinders: 3, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.42, boostPressureBar: 1.4, realL: 435, realW: 550, realH: 625 },
  { id: 7, category: 'A', kind: 'piston', name: 'BMW 1.5 B38', boreMm: 82.0, strokeMm: 94.6, cylinders: 3, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.45, boostPressureBar: 1.5, realL: 455, realW: 560, realH: 640 },
  { id: 8, category: 'A', kind: 'piston', name: 'Ford 1.5 EcoBoost Dragon', boreMm: 84.0, strokeMm: 90.0, cylinders: 3, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.52, boostPressureBar: 1.6, realL: 460, realW: 570, realH: 630 },
  { id: 9, category: 'A', kind: 'piston', name: 'Toyota 1.6 G16E-GTS', boreMm: 87.5, strokeMm: 89.7, cylinders: 3, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.62, boostPressureBar: 1.8, realL: 465, realW: 585, realH: 635 },
  { id: 10, category: 'A', kind: 'piston', name: 'Koenigsegg 2.0 TFG', boreMm: 95.0, strokeMm: 93.5, cylinders: 3, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Lateral', arRatio: 0.58, boostPressureBar: 2.0, realL: 495, realW: 620, realH: 590 },

  // B) 4 Cilindri in Linea Aspirati & Volumetrici (I4 NA / SC — #11..#22)
  { id: 11, category: 'B', kind: 'piston', name: 'BMC 1.3 A-Series', boreMm: 70.6, strokeMm: 81.3, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'OHV', valvesPerCylinder: 2, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.45, boostPressureBar: 0, realL: 465, realW: 430, realH: 540 },
  { id: 12, category: 'B', kind: 'piston', name: 'Fiat 1.0 / 1.1 FIRE 8v', boreMm: 70.0, strokeMm: 64.9, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'SOHC', valvesPerCylinder: 2, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.45, boostPressureBar: 0, realL: 475, realW: 440, realH: 550 },
  { id: 13, category: 'B', kind: 'piston', name: 'Fiat 1.2 8v FIRE 65 CV', boreMm: 70.8, strokeMm: 78.8, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'SOHC', valvesPerCylinder: 2, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.45, boostPressureBar: 0, realL: 485, realW: 450, realH: 575 },
  { id: 14, category: 'B', kind: 'piston', name: 'VW 1.6 / 1.8 EA827 GTI', boreMm: 79.5, strokeMm: 80.0, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'SOHC', valvesPerCylinder: 2, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.45, boostPressureBar: 0, realL: 525, realW: 490, realH: 595 },
  { id: 15, category: 'B', kind: 'piston', name: 'Honda 1.8 B18C Type-R', boreMm: 81.0, strokeMm: 87.2, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.45, boostPressureBar: 0, realL: 545, realW: 510, realH: 615 },
  { id: 16, category: 'B', kind: 'piston', name: 'Peugeot 1.9 XU9J4 Mi16', boreMm: 83.0, strokeMm: 88.0, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.45, boostPressureBar: 0, realL: 555, realW: 515, realH: 620 },
  { id: 17, category: 'B', kind: 'piston', name: 'Mazda 2.0 Skyactiv-G', boreMm: 83.5, strokeMm: 91.2, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.45, boostPressureBar: 0, realL: 555, realW: 510, realH: 625 },
  { id: 18, category: 'B', kind: 'piston', name: 'Toyota 1.8 2ZZ-GE SC', boreMm: 82.0, strokeMm: 85.0, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'Supercharger', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.55, boostPressureBar: 0.8, realL: 550, realW: 560, realH: 615 },
  { id: 19, category: 'B', kind: 'piston', name: 'Honda 2.0 K20A Type-R', boreMm: 86.0, strokeMm: 86.0, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.45, boostPressureBar: 0, realL: 560, realW: 525, realH: 635 },
  { id: 20, category: 'B', kind: 'piston', name: 'Honda 2.0 F20C (S2000)', boreMm: 87.0, strokeMm: 84.0, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.45, boostPressureBar: 0, realL: 570, realW: 520, realH: 630 },
  { id: 21, category: 'B', kind: 'piston', name: 'Alfa 2.0 Bialbero Nord', boreMm: 84.0, strokeMm: 88.5, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 2, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.45, boostPressureBar: 0, realL: 575, realW: 520, realH: 640 },
  { id: 22, category: 'B', kind: 'piston', name: 'BMW 2.3 S14B23 (M3 E30)', boreMm: 93.4, strokeMm: 84.0, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-itb-carbon', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.45, boostPressureBar: 0, realL: 595, realW: 545, realH: 630 },

  // C) 4 Cilindri in Linea Turbo (I4 Turbo — #23..#36)
  { id: 23, category: 'C', kind: 'piston', name: 'Fiat 1.4 T-Jet / MultiAir', boreMm: 72.0, strokeMm: 84.0, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.46, boostPressureBar: 1.3, realL: 520, realW: 565, realH: 615 },
  { id: 24, category: 'C', kind: 'piston', name: 'Renault 1.8 TCe M5Pt', boreMm: 79.7, strokeMm: 90.1, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'TwinScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.58, boostPressureBar: 1.7, realL: 545, realW: 580, realH: 625 },
  { id: 25, category: 'C', kind: 'piston', name: 'Alfa Romeo 1.750 TBi', boreMm: 83.0, strokeMm: 80.5, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.54, boostPressureBar: 1.5, realL: 560, realW: 590, realH: 615 },
  { id: 26, category: 'C', kind: 'piston', name: 'VW 2.0 TSI EA888 Gen4', boreMm: 82.5, strokeMm: 92.8, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.60, boostPressureBar: 1.6, realL: 565, realW: 595, realH: 635 },
  { id: 27, category: 'C', kind: 'piston', name: 'VW 2.0 TDI EA288', boreMm: 81.0, strokeMm: 95.5, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'VGT', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.52, boostPressureBar: 1.8, realL: 565, realW: 590, realH: 655 },
  { id: 28, category: 'C', kind: 'piston', name: 'BMW 2.0 B48 TwinPower', boreMm: 82.0, strokeMm: 94.6, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'TwinScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.56, boostPressureBar: 1.5, realL: 570, realW: 585, realH: 645 },
  { id: 29, category: 'C', kind: 'piston', name: 'Mercedes-AMG 2.0 M139', boreMm: 83.0, strokeMm: 92.0, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'TwinScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.72, boostPressureBar: 2.1, realL: 570, realW: 605, realH: 635 },
  { id: 30, category: 'C', kind: 'piston', name: 'Alfa Romeo 2.0 GME T4', boreMm: 84.0, strokeMm: 90.0, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'SOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'TwinScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.56, boostPressureBar: 1.6, realL: 575, realW: 590, realH: 630 },
  { id: 31, category: 'C', kind: 'piston', name: 'Honda 2.0 K20C1 Type-R', boreMm: 86.0, strokeMm: 85.9, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.62, boostPressureBar: 1.6, realL: 575, realW: 610, realH: 635 },
  { id: 32, category: 'C', kind: 'piston', name: 'Volvo 2.0 B4204T Polestar', boreMm: 82.0, strokeMm: 93.2, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'Twincharged', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.64, boostPressureBar: 2.0, realL: 575, realW: 635, realH: 645 },
  { id: 33, category: 'C', kind: 'piston', name: 'Mitsubishi 2.0 4G63T Evo', boreMm: 85.0, strokeMm: 88.0, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'TwinScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.65, boostPressureBar: 1.5, realL: 580, realW: 605, realH: 640 },
  { id: 34, category: 'C', kind: 'piston', name: 'Lancia 2.0 16v Lampredi', boreMm: 84.0, strokeMm: 90.0, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.63, boostPressureBar: 1.3, realL: 585, realW: 610, realH: 645 },
  { id: 35, category: 'C', kind: 'piston', name: 'Nissan 2.0 SR20DET', boreMm: 86.0, strokeMm: 86.0, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.64, boostPressureBar: 1.1, realL: 585, realW: 595, realH: 635 },
  { id: 36, category: 'C', kind: 'piston', name: 'Ford 2.0 Cosworth YB', boreMm: 90.8, strokeMm: 76.9, cylinders: 4, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.63, boostPressureBar: 1.4, realL: 600, realW: 600, realH: 630 },

  // D) 5 & 6 Cilindri in Linea (I5 / I6 — #37..#48)
  { id: 37, category: 'D', kind: 'piston', name: 'Audi 2.5 TFSI EA855 EVO', boreMm: 82.5, strokeMm: 92.8, cylinders: 5, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.70, boostPressureBar: 1.5, realL: 645, realW: 605, realH: 635 },
  { id: 38, category: 'D', kind: 'piston', name: 'Fiat 2.0 20v Turbo', boreMm: 82.0, strokeMm: 75.6, cylinders: 5, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.60, boostPressureBar: 1.2, realL: 655, realW: 590, realH: 615 },
  { id: 39, category: 'D', kind: 'piston', name: 'Volvo 2.5 B5254T5', boreMm: 83.0, strokeMm: 93.2, cylinders: 5, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.64, boostPressureBar: 1.4, realL: 665, realW: 605, realH: 640 },
  { id: 40, category: 'D', kind: 'piston', name: 'Mercedes 3.0 M256', boreMm: 83.0, strokeMm: 92.4, cylinders: 6, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'TwinScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.68, boostPressureBar: 1.5, realL: 775, realW: 615, realH: 655 },
  { id: 41, category: 'D', kind: 'piston', name: 'BMW 3.0 B58 / S58', boreMm: 84.0, strokeMm: 90.0, cylinders: 6, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Lateral', arRatio: 0.56, boostPressureBar: 2.1, realL: 780, realW: 625, realH: 650 },
  { id: 42, category: 'D', kind: 'piston', name: 'BMW 3.0 B57D30S0', boreMm: 84.0, strokeMm: 90.0, cylinders: 6, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'QuadTurbo', turboPosition: 'Lateral', arRatio: 0.65, boostPressureBar: 2.8, realL: 785, realW: 645, realH: 660 },
  { id: 43, category: 'D', kind: 'piston', name: 'Mercedes 3.0 M198 (300 SL)', boreMm: 85.0, strokeMm: 88.0, cylinders: 6, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'SOHC', valvesPerCylinder: 2, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.55, boostPressureBar: 0, realL: 785, realW: 560, realH: 620 },
  { id: 44, category: 'D', kind: 'piston', name: 'BMW 3.2 S54B32 (M3 E46)', boreMm: 87.0, strokeMm: 91.0, cylinders: 6, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-itb-carbon', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.55, boostPressureBar: 0, realL: 790, realW: 540, realH: 645 },
  { id: 45, category: 'D', kind: 'piston', name: 'Nissan 2.6 RB26DETT', boreMm: 86.0, strokeMm: 73.7, cylinders: 6, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Lateral', arRatio: 0.60, boostPressureBar: 1.2, realL: 795, realW: 630, realH: 625 },
  { id: 46, category: 'D', kind: 'piston', name: 'Toyota 3.0 2JZ-GTE', boreMm: 86.0, strokeMm: 86.0, cylinders: 6, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Lateral', arRatio: 0.62, boostPressureBar: 1.1, realL: 805, realW: 635, realH: 645 },
  { id: 47, category: 'D', kind: 'piston', name: 'Ford 4.0 Barra Turbo', boreMm: 92.3, strokeMm: 99.1, cylinders: 6, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 1.06, boostPressureBar: 1.2, realL: 835, realW: 640, realH: 690 },
  { id: 48, category: 'D', kind: 'piston', name: 'Jaguar 4.2 XK6 (E-Type)', boreMm: 92.1, strokeMm: 106.0, cylinders: 6, architecture: 'Inline', bankAngleDeg: 0, camConfig: 'DOHC', valvesPerCylinder: 2, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.55, boostPressureBar: 0, realL: 840, realW: 555, realH: 710 },

  // E) V6 Stretti (15°), 60°, 90° & 120° (V6 — #49..#60)
  { id: 49, category: 'E', kind: 'piston', name: 'VW 3.2 VR6 EA390', boreMm: 84.0, strokeMm: 95.9, cylinders: 6, architecture: 'V', bankAngleDeg: 15, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.55, boostPressureBar: 0, realL: 495, realW: 520, realH: 650 },
  { id: 50, category: 'E', kind: 'piston', name: 'Lancia 2.5 V6 Aurelia', boreMm: 78.0, strokeMm: 85.5, cylinders: 6, architecture: 'V', bankAngleDeg: 60, camConfig: 'OHV', valvesPerCylinder: 2, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.55, boostPressureBar: 0, realL: 495, realW: 585, realH: 590 },
  { id: 51, category: 'E', kind: 'piston', name: 'Alfa 3.2 V6 Busso GTA', boreMm: 93.0, strokeMm: 78.0, cylinders: 6, architecture: 'V', bankAngleDeg: 60, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.55, boostPressureBar: 0, realL: 530, realW: 665, realH: 615 },
  { id: 52, category: 'E', kind: 'piston', name: 'Chrysler 3.6 Pentastar', boreMm: 96.0, strokeMm: 83.0, cylinders: 6, architecture: 'V', bankAngleDeg: 60, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.55, boostPressureBar: 0, realL: 530, realW: 650, realH: 630 },
  { id: 53, category: 'E', kind: 'piston', name: 'Nissan 3.7 VQ37VHR', boreMm: 95.5, strokeMm: 86.0, cylinders: 6, architecture: 'V', bankAngleDeg: 60, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.55, boostPressureBar: 0, realL: 535, realW: 655, realH: 625 },
  { id: 54, category: 'E', kind: 'piston', name: 'Ford 3.5 EcoBoost', boreMm: 92.5, strokeMm: 86.7, cylinders: 6, architecture: 'V', bankAngleDeg: 60, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Lateral', arRatio: 0.54, boostPressureBar: 1.5, realL: 565, realW: 715, realH: 640 },
  { id: 55, category: 'E', kind: 'piston', name: 'Nissan 3.8 VR38DETT', boreMm: 95.5, strokeMm: 88.4, cylinders: 6, architecture: 'V', bankAngleDeg: 60, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Lateral', arRatio: 0.60, boostPressureBar: 1.3, realL: 575, realW: 735, realH: 645 },
  { id: 56, category: 'E', kind: 'piston', name: 'Honda 3.0 V6 C30A (NSX)', boreMm: 90.0, strokeMm: 78.0, cylinders: 6, architecture: 'V', bankAngleDeg: 90, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.55, boostPressureBar: 0, realL: 520, realW: 710, realH: 575 },
  { id: 57, category: 'E', kind: 'piston', name: 'Porsche/Audi 2.9 TFSI', boreMm: 84.5, strokeMm: 86.0, cylinders: 6, architecture: 'V', bankAngleDeg: 90, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'HotV', arRatio: 0.55, boostPressureBar: 1.6, realL: 535, realW: 730, realH: 620 },
  { id: 58, category: 'E', kind: 'piston', name: 'Alfa 2.9 V6 90° (Giulia QV)', boreMm: 86.5, strokeMm: 82.0, cylinders: 6, architecture: 'V', bankAngleDeg: 90, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Lateral', arRatio: 0.58, boostPressureBar: 1.7, realL: 545, realW: 755, realH: 610 },
  { id: 59, category: 'E', kind: 'piston', name: 'McLaren 3.0 V6 M630', boreMm: 84.0, strokeMm: 90.0, cylinders: 6, architecture: 'V', bankAngleDeg: 120, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'HotV', arRatio: 0.62, boostPressureBar: 2.0, realL: 525, realW: 830, realH: 555 },
  { id: 60, category: 'E', kind: 'piston', name: 'Ferrari 3.0 V6 F163 (296)', boreMm: 88.0, strokeMm: 82.0, cylinders: 6, architecture: 'V', bankAngleDeg: 120, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'HotV', arRatio: 0.64, boostPressureBar: 2.2, realL: 535, realW: 820, realH: 545 },

  // F) V8 OHV & DOHC (V8 — #61..#74)
  { id: 61, category: 'F', kind: 'piston', name: 'Chevy 6.2 LS3 / LT2', boreMm: 103.2, strokeMm: 92.0, cylinders: 8, architecture: 'V', bankAngleDeg: 90, camConfig: 'OHV', valvesPerCylinder: 2, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 655, realW: 640, realH: 545 },
  { id: 62, category: 'F', kind: 'piston', name: 'Chrysler 6.4 Hemi 392', boreMm: 103.9, strokeMm: 94.6, cylinders: 8, architecture: 'V', bankAngleDeg: 90, camConfig: 'OHV', valvesPerCylinder: 2, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 665, realW: 650, realH: 565 },
  { id: 63, category: 'F', kind: 'piston', name: 'Dodge 6.2 Hemi Hellcat', boreMm: 103.9, strokeMm: 90.9, cylinders: 8, architecture: 'V', bankAngleDeg: 90, camConfig: 'OHV', valvesPerCylinder: 2, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'Supercharger', turboCountConfig: 'SingleTurbo', turboPosition: 'HotV', arRatio: 0.85, boostPressureBar: 1.0, realL: 675, realW: 660, realH: 635 },
  { id: 64, category: 'F', kind: 'piston', name: 'Mercedes-AMG 4.0 M177', boreMm: 83.0, strokeMm: 92.0, cylinders: 8, architecture: 'V', bankAngleDeg: 90, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'HotV', arRatio: 0.65, boostPressureBar: 1.6, realL: 620, realW: 740, realH: 625 },
  { id: 65, category: 'F', kind: 'piston', name: 'BMW 4.0 S65B40 (M3 E92)', boreMm: 92.0, strokeMm: 75.2, cylinders: 8, architecture: 'V', bankAngleDeg: 90, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-itb-carbon', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 625, realW: 730, realH: 585 },
  { id: 66, category: 'F', kind: 'piston', name: 'Porsche/Audi 4.0 EA825', boreMm: 86.0, strokeMm: 86.0, cylinders: 8, architecture: 'V', bankAngleDeg: 90, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'TwinScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'HotV', arRatio: 0.64, boostPressureBar: 1.6, realL: 630, realW: 745, realH: 625 },
  { id: 67, category: 'F', kind: 'piston', name: 'Ferrari 4.5 F136 (458)', boreMm: 94.0, strokeMm: 81.0, cylinders: 8, architecture: 'V', bankAngleDeg: 90, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 640, realW: 745, realH: 590 },
  { id: 68, category: 'F', kind: 'piston', name: 'McLaren 4.0 M840T (720S)', boreMm: 93.0, strokeMm: 73.5, cylinders: 8, architecture: 'V', bankAngleDeg: 90, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'TwinScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Lateral', arRatio: 0.68, boostPressureBar: 1.7, realL: 640, realW: 755, realH: 575 },
  { id: 69, category: 'F', kind: 'piston', name: 'BMW 4.4 S63 / S68 (M5)', boreMm: 89.0, strokeMm: 88.3, cylinders: 8, architecture: 'V', bankAngleDeg: 90, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'TwinScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'HotV', arRatio: 0.66, boostPressureBar: 1.8, realL: 640, realW: 750, realH: 630 },
  { id: 70, category: 'F', kind: 'piston', name: 'Ferrari 3.9 F154 (488/F8)', boreMm: 86.5, strokeMm: 83.0, cylinders: 8, architecture: 'V', bankAngleDeg: 90, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Lateral', arRatio: 0.68, boostPressureBar: 1.8, realL: 645, realW: 775, realH: 600 },
  { id: 71, category: 'F', kind: 'piston', name: 'Ford 5.0 Coyote Gen4', boreMm: 93.0, strokeMm: 92.7, cylinders: 8, architecture: 'V', bankAngleDeg: 90, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 660, realW: 755, realH: 635 },
  { id: 72, category: 'F', kind: 'piston', name: 'Chevy 5.5 LT6 (C8 Z06)', boreMm: 104.3, strokeMm: 80.0, cylinders: 8, architecture: 'V', bankAngleDeg: 90, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 665, realW: 755, realH: 590 },
  { id: 73, category: 'F', kind: 'piston', name: 'Koenigsegg 5.0 V8 (Jesko)', boreMm: 92.0, strokeMm: 95.3, cylinders: 8, architecture: 'V', bankAngleDeg: 90, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Lateral', arRatio: 0.88, boostPressureBar: 2.2, realL: 665, realW: 795, realH: 630 },
  { id: 74, category: 'F', kind: 'piston', name: 'Mercedes-AMG 6.2 M156', boreMm: 102.2, strokeMm: 94.6, cylinders: 8, architecture: 'V', bankAngleDeg: 90, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 680, realW: 765, realH: 640 },

  // G) V10, V12, W12 & W16 (V10 / V12 / W — #75..#86)
  { id: 75, category: 'G', kind: 'piston', name: 'Lexus 4.8 V10 1LR-GUE', boreMm: 88.0, strokeMm: 79.0, cylinders: 10, architecture: 'V', bankAngleDeg: 72, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.65, boostPressureBar: 0, realL: 685, realW: 700, realH: 585 },
  { id: 76, category: 'G', kind: 'piston', name: 'Porsche 5.7 V10 (CGT)', boreMm: 98.0, strokeMm: 76.0, cylinders: 10, architecture: 'V', bankAngleDeg: 68, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.65, boostPressureBar: 0, realL: 710, realW: 695, realH: 575 },
  { id: 77, category: 'G', kind: 'piston', name: 'Audi/Lambo 5.2 V10 FSI', boreMm: 84.5, strokeMm: 92.8, cylinders: 10, architecture: 'V', bankAngleDeg: 90, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.65, boostPressureBar: 0, realL: 715, realW: 770, realH: 595 },
  { id: 78, category: 'G', kind: 'piston', name: 'BMW 5.0 V10 S85 (M5 E60)', boreMm: 92.0, strokeMm: 75.2, cylinders: 10, architecture: 'V', bankAngleDeg: 90, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-itb-carbon', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.65, boostPressureBar: 0, realL: 730, realW: 740, realH: 590 },
  { id: 79, category: 'G', kind: 'piston', name: 'Dodge 8.4 V10 Viper', boreMm: 103.0, strokeMm: 100.6, cylinders: 10, architecture: 'V', bankAngleDeg: 90, camConfig: 'OHV', valvesPerCylinder: 2, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.65, boostPressureBar: 0, realL: 790, realW: 680, realH: 580 },
  { id: 80, category: 'G', kind: 'piston', name: 'GMA Cosworth 3.9 V12', boreMm: 81.5, strokeMm: 63.8, cylinders: 12, architecture: 'V', bankAngleDeg: 65, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.65, boostPressureBar: 0, realL: 735, realW: 645, realH: 545 },
  { id: 81, category: 'G', kind: 'piston', name: 'AM Cosworth 6.5 V12', boreMm: 95.0, strokeMm: 76.4, cylinders: 12, architecture: 'V', bankAngleDeg: 65, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.65, boostPressureBar: 0, realL: 810, realW: 690, realH: 565 },
  { id: 82, category: 'G', kind: 'piston', name: 'Lambo 6.5 V12 L539/L545', boreMm: 95.0, strokeMm: 76.4, cylinders: 12, architecture: 'V', bankAngleDeg: 60, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.65, boostPressureBar: 0, realL: 820, realW: 685, realH: 575 },
  { id: 83, category: 'G', kind: 'piston', name: 'Ferrari 6.5 V12 F140', boreMm: 94.0, strokeMm: 78.0, cylinders: 12, architecture: 'V', bankAngleDeg: 65, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.65, boostPressureBar: 0, realL: 825, realW: 705, realH: 585 },
  { id: 84, category: 'G', kind: 'piston', name: 'AMG 6.0 V12 M279/M158', boreMm: 82.6, strokeMm: 93.0, cylinders: 12, architecture: 'V', bankAngleDeg: 60, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Lateral', arRatio: 0.66, boostPressureBar: 1.5, realL: 840, realW: 735, realH: 605 },
  { id: 85, category: 'G', kind: 'piston', name: 'Bentley 6.0 W12 TSI', boreMm: 84.0, strokeMm: 90.2, cylinders: 12, architecture: 'W', bankAngleDeg: 72, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'TwinScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Lateral', arRatio: 0.60, boostPressureBar: 1.4, realL: 615, realW: 735, realH: 635 },
  { id: 86, category: 'G', kind: 'piston', name: 'Bugatti 8.0 W16', boreMm: 86.0, strokeMm: 86.0, cylinders: 16, architecture: 'W', bankAngleDeg: 90, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'QuadTurbo', turboPosition: 'Lateral', arRatio: 0.72, boostPressureBar: 2.6, realL: 760, realW: 870, realH: 660 },

  // H) Boxer 4, Boxer 6 & Flat-12 (Boxer — #87..#92)
  { id: 87, category: 'H', kind: 'piston', name: 'Alfa Romeo 1.7 Boxer 16v', boreMm: 87.0, strokeMm: 72.0, cylinders: 4, architecture: 'Boxer', bankAngleDeg: 180, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.55, boostPressureBar: 0, realL: 415, realW: 760, realH: 430 },
  { id: 88, category: 'H', kind: 'piston', name: 'Subaru/Toyota 2.4 FA24', boreMm: 94.0, strokeMm: 86.0, cylinders: 4, architecture: 'Boxer', bankAngleDeg: 180, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.55, boostPressureBar: 0, realL: 440, realW: 815, realH: 465 },
  { id: 89, category: 'H', kind: 'piston', name: 'Subaru 2.5 EJ257 STI', boreMm: 99.5, strokeMm: 79.0, cylinders: 4, architecture: 'Boxer', bankAngleDeg: 180, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.58, boostPressureBar: 1.2, realL: 455, realW: 820, realH: 510 },
  { id: 90, category: 'H', kind: 'piston', name: 'Porsche 4.0 B6 (911 GT3)', boreMm: 102.0, strokeMm: 81.5, cylinders: 6, architecture: 'Boxer', bankAngleDeg: 180, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 595, realW: 865, realH: 475 },
  { id: 91, category: 'H', kind: 'piston', name: 'Porsche 3.8 B6 (911 Turbo S)', boreMm: 102.0, strokeMm: 77.5, cylinders: 6, architecture: 'Boxer', bankAngleDeg: 180, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'VGT', turboCountConfig: 'TwinTurbo', turboPosition: 'Lateral', arRatio: 0.68, boostPressureBar: 1.55, realL: 615, realW: 915, realH: 495 },
  { id: 92, category: 'H', kind: 'piston', name: 'Ferrari 4.9 Flat-12 F113', boreMm: 82.0, strokeMm: 78.0, cylinders: 12, architecture: 'Boxer', bankAngleDeg: 180, camConfig: 'DOHC', valvesPerCylinder: 4, intakeSystemId: 'int-std', exhaustManifoldId: 'exh-cast', turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 845, realW: 930, realH: 470 },

  // I) Rotativi Wankel (20) & Drive Unit Elettriche (4) (#93..#116)
  { id: 93, category: 'I', kind: 'wankel', name: 'NSU Wankel Spider KKM 502 (1964)', rotorCount: 1, eccentricityMm: 14.0, generatingRadiusMm: 100, rotorWidthMm: 67, turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 310, realW: 390, realH: 420 },
  { id: 94, category: 'I', kind: 'wankel', name: 'Sachs KM 914 / W-2000 (1974)', rotorCount: 1, eccentricityMm: 11.5, generatingRadiusMm: 86, rotorWidthMm: 52, turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 280, realW: 350, realH: 380 },
  { id: 95, category: 'I', kind: 'wankel', name: 'Mazda 8C e-Skyactiv R-EV (2023)', rotorCount: 1, eccentricityMm: 17.5, generatingRadiusMm: 120, rotorWidthMm: 76, turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 345, realW: 465, realH: 495 },
  { id: 96, category: 'I', kind: 'wankel', name: 'Mazda 10A 0810 Cosmo (1967)', rotorCount: 2, eccentricityMm: 15.0, generatingRadiusMm: 105, rotorWidthMm: 60, turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 395, realW: 415, realH: 450 },
  { id: 97, category: 'I', kind: 'wankel', name: 'NSU KKM 612 Ro 80 (1967)', rotorCount: 2, eccentricityMm: 14.0, generatingRadiusMm: 100, rotorWidthMm: 67, turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 410, realW: 405, realH: 440 },
  { id: 98, category: 'I', kind: 'wankel', name: 'Citroen Comotor 624 (1973)', rotorCount: 2, eccentricityMm: 14.0, generatingRadiusMm: 100, rotorWidthMm: 67, turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 415, realW: 410, realH: 445 },
  { id: 99, category: 'I', kind: 'wankel', name: 'Mazda 12A RX-7 SA (1978)', rotorCount: 2, eccentricityMm: 15.0, generatingRadiusMm: 105, rotorWidthMm: 70, turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 420, realW: 420, realH: 455 },
  { id: 100, category: 'I', kind: 'wankel', name: 'Mazda 13B-DEI RX-7 FC NA (1985)', rotorCount: 2, eccentricityMm: 15.0, generatingRadiusMm: 105, rotorWidthMm: 80, turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 440, realW: 425, realH: 465 },
  { id: 101, category: 'I', kind: 'wankel', name: 'Mazda 13B-MSP Renesis RX-8 (2003)', rotorCount: 2, eccentricityMm: 15.0, generatingRadiusMm: 105, rotorWidthMm: 80, turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 440, realW: 420, realH: 460 },
  { id: 102, category: 'I', kind: 'wankel', name: 'Mazda 16X Skyactiv-R (2007)', rotorCount: 2, eccentricityMm: 16.5, generatingRadiusMm: 114, rotorWidthMm: 70, turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 425, realW: 450, realH: 480 },
  { id: 103, category: 'I', kind: 'wankel', name: 'Mazda 12A Turbo (1982)', rotorCount: 2, eccentricityMm: 15.0, generatingRadiusMm: 105, rotorWidthMm: 70, turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.58, boostPressureBar: 0.8, realL: 420, realW: 495, realH: 455 },
  { id: 104, category: 'I', kind: 'wankel', name: 'Mazda 13B-Turbo II FC (1986)', rotorCount: 2, eccentricityMm: 15.0, generatingRadiusMm: 105, rotorWidthMm: 80, turboType: 'TwinScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.63, boostPressureBar: 0.8, realL: 440, realW: 505, realH: 465 },
  { id: 105, category: 'I', kind: 'wankel', name: 'Mazda 13B-REW RX-7 FD (1992)', rotorCount: 2, eccentricityMm: 15.0, generatingRadiusMm: 105, rotorWidthMm: 80, turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Lateral', arRatio: 0.62, boostPressureBar: 0.9, realL: 485, realW: 510, realH: 510 },
  { id: 106, category: 'I', kind: 'wankel', name: 'Mazda 13B-REW Big Single', rotorCount: 2, eccentricityMm: 15.0, generatingRadiusMm: 105, rotorWidthMm: 80, turboType: 'SingleScroll', turboCountConfig: 'SingleTurbo', turboPosition: 'Lateral', arRatio: 0.92, boostPressureBar: 1.2, realL: 485, realW: 535, realH: 510 },
  { id: 107, category: 'I', kind: 'wankel', name: 'Mercedes M950F C111-I (1969)', rotorCount: 3, eccentricityMm: 15.0, generatingRadiusMm: 105, rotorWidthMm: 70, turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 535, realW: 425, realH: 460 },
  { id: 108, category: 'I', kind: 'wankel', name: 'Mazda 13G / 20B NA 757 (1985)', rotorCount: 3, eccentricityMm: 15.0, generatingRadiusMm: 105, rotorWidthMm: 80, turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 560, realW: 430, realH: 465 },
  { id: 109, category: 'I', kind: 'wankel', name: 'Mazda 20B-REW Cosmo (1990)', rotorCount: 3, eccentricityMm: 15.0, generatingRadiusMm: 105, rotorWidthMm: 80, turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Lateral', arRatio: 0.66, boostPressureBar: 0.9, realL: 590, realW: 520, realH: 515 },
  { id: 110, category: 'I', kind: 'wankel', name: 'Mercedes M950F C111-II (1970)', rotorCount: 4, eccentricityMm: 15.0, generatingRadiusMm: 105, rotorWidthMm: 70, turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.60, boostPressureBar: 0, realL: 645, realW: 430, realH: 465 },
  { id: 111, category: 'I', kind: 'wankel', name: 'Mazda R26B 787B (1991)', rotorCount: 4, eccentricityMm: 15.0, generatingRadiusMm: 105, rotorWidthMm: 80, turboType: 'NaturallyAspirated', turboCountConfig: 'SingleTurbo', turboPosition: 'None', arRatio: 0.65, boostPressureBar: 0, realL: 685, realW: 445, realH: 475 },
  { id: 112, category: 'I', kind: 'wankel', name: 'Mazda R26B 4R Bi-Turbo', rotorCount: 4, eccentricityMm: 15.0, generatingRadiusMm: 105, rotorWidthMm: 80, turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Lateral', arRatio: 0.83, boostPressureBar: 1.2, realL: 685, realW: 545, realH: 515 },
  { id: 113, category: 'I', kind: 'ev', name: 'Fiat 500e GKN EDM', electricMotorType: 'PermanentMagnetSync', statorDiameterMm: 200, rotorLengthMm: 140, voltageArchitecture: 400, coolingSystem: 'LiquidGlycol', inverterPowerElectronics: 'Silicon_MOSFET', realL: 340, realW: 380, realH: 350 },
  { id: 114, category: 'I', kind: 'ev', name: 'Tesla Model 3 4D2', electricMotorType: 'IPM_SynRM', statorDiameterMm: 240, rotorLengthMm: 150, voltageArchitecture: 400, coolingSystem: 'DirectDielectric', inverterPowerElectronics: 'SiliconCarbide_SiC', realL: 370, realW: 425, realH: 380 },
  { id: 115, category: 'I', kind: 'ev', name: 'VW APP550 ID.7', electricMotorType: 'PermanentMagnetSync', statorDiameterMm: 250, rotorLengthMm: 190, voltageArchitecture: 400, coolingSystem: 'LiquidGlycol', inverterPowerElectronics: 'SiliconCarbide_SiC', realL: 390, realW: 440, realH: 395 },
  { id: 116, category: 'I', kind: 'ev', name: 'YASA P400R / Ferrari 296', electricMotorType: 'AxialFlux', statorDiameterMm: 240, rotorLengthMm: 105, voltageArchitecture: 800, coolingSystem: 'DirectDielectric', inverterPowerElectronics: 'SiliconCarbide_SiC', remoteInverter: true, realL: 245, realW: 360, realH: 340 },
];

const CATEGORY_LABELS: Record<CategoryId, string> = {
  A: 'A) 2 & 3 Cilindri in Linea (I2 / I3)',
  B: 'B) 4 Cilindri in Linea NA / SC',
  C: 'C) 4 Cilindri in Linea Turbo',
  D: 'D) 5 & 6 Cilindri in Linea (I5 / I6)',
  E: 'E) V6 Stretti (15°), 60°, 90° & 120°',
  F: 'F) V8 OHV & DOHC',
  G: 'G) V10, V12, W12 & W16',
  H: 'H) Boxer 4, Boxer 6 & Flat-12',
  I: 'I) Rotativi Wankel & Drive Unit EV',
};

interface RowResult {
  id: number;
  category: CategoryId;
  name: string;
  simL: number;
  simW: number;
  simH: number;
  realL: number;
  realW: number;
  realH: number;
  errL: number;
  errW: number;
  errH: number;
}

const results: RowResult[] = [];

for (const s of SPECS) {
  let simL = 0;
  let simW = 0;
  let simH = 0;

  if (s.kind === 'piston') {
    const m = calculatePistonGeometryAndDimensions(makePistonConfig(s));
    simL = m.dimensionsMm.lengthMm;
    simW = m.dimensionsMm.widthMm;
    simH = m.dimensionsMm.heightMm;
  } else if (s.kind === 'wankel') {
    const m = calculateWankelGeometryAndDimensions(makeWankelConfig(s));
    simL = m.dimensionsMm.lengthMm;
    simW = m.dimensionsMm.widthMm;
    simH = m.dimensionsMm.heightMm;
  } else {
    const m = calculateElectricHybridGeometryAndDimensions(makeEvBenchConfig(s));
    simL = m.rawDimensionsMm.lengthMm;
    simW = m.rawDimensionsMm.widthMm;
    simH = m.rawDimensionsMm.heightMm;
  }

  const errL = ((simL - s.realL) / s.realL) * 100;
  const errW = ((simW - s.realW) / s.realW) * 100;
  const errH = ((simH - s.realH) / s.realH) * 100;

  results.push({
    id: s.id,
    category: s.category,
    name: s.name,
    simL,
    simW,
    simH,
    realL: s.realL,
    realW: s.realW,
    realH: s.realH,
    errL,
    errW,
    errH,
  });
}

const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

console.log(`=== BENCHMARK INGOMBRI ${results.length} MOTORI REALI (L x W x H) ===`);
console.log('| # | Cat | Motore | LxWxH Sim (mm) | LxWxH Reale (mm) | Err L% | Err W% | Err H% |');
console.log('| :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: |');
for (const r of results) {
  console.log(
    `| ${r.id} | ${r.category} | ${r.name} | ${r.simL}x${r.simW}x${r.simH} | ${r.realL}x${r.realW}x${r.realH} | ${fmtPct(r.errL)} | ${fmtPct(r.errW)} | ${fmtPct(r.errH)} |`,
  );
}

console.log('\n=== STATISTICHE MEDIE PER CATEGORIA ===');
console.log(
  '| Categoria | N | Media |Err L%| (con segno) | Media |Err W%| (con segno) | Media |Err H%| (con segno) | Media |Err| Totale |',
);
console.log('| :--- | :---: | :---: | :---: | :---: | :---: |');

const cats: CategoryId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
for (const cat of cats) {
  const rows = results.filter((r) => r.category === cat);
  const avgL = rows.reduce((a, r) => a + Math.abs(r.errL), 0) / rows.length;
  const avgW = rows.reduce((a, r) => a + Math.abs(r.errW), 0) / rows.length;
  const avgH = rows.reduce((a, r) => a + Math.abs(r.errH), 0) / rows.length;
  const sL = rows.reduce((a, r) => a + r.errL, 0) / rows.length;
  const sW = rows.reduce((a, r) => a + r.errW, 0) / rows.length;
  const sH = rows.reduce((a, r) => a + r.errH, 0) / rows.length;
  const avgAll = (avgL + avgW + avgH) / 3;
  console.log(
    `| ${CATEGORY_LABELS[cat]} | ${rows.length} | ${avgL.toFixed(2)}% (${fmtPct(sL)}) | ${avgW.toFixed(2)}% (${fmtPct(sW)}) | ${avgH.toFixed(2)}% (${fmtPct(sH)}) | ${avgAll.toFixed(2)}% |`,
  );
}

const gL = results.reduce((a, r) => a + Math.abs(r.errL), 0) / results.length;
const gW = results.reduce((a, r) => a + Math.abs(r.errW), 0) / results.length;
const gH = results.reduce((a, r) => a + Math.abs(r.errH), 0) / results.length;
const gsL = results.reduce((a, r) => a + r.errL, 0) / results.length;
const gsW = results.reduce((a, r) => a + r.errW, 0) / results.length;
const gsH = results.reduce((a, r) => a + r.errH, 0) / results.length;
const outL = results.filter((r) => Math.abs(r.errL) > 8).length;
const outW = results.filter((r) => Math.abs(r.errW) > 8).length;
const outH = results.filter((r) => Math.abs(r.errH) > 8).length;
const outAny = results.filter(
  (r) => Math.abs(r.errL) > 8 || Math.abs(r.errW) > 8 || Math.abs(r.errH) > 8,
).length;

console.log(
  `\nTOTALE ${results.length} MOTORI: Media |Err L|=${gL.toFixed(2)}% (${fmtPct(gsL)}) | Media |Err W|=${gW.toFixed(2)}% (${fmtPct(gsW)}) | Media |Err H|=${gH.toFixed(2)}% (${fmtPct(gsH)}) | Media Globale=${((gL + gW + gH) / 3).toFixed(2)}% (${fmtPct((gsL + gsW + gsH) / 3)}) | Outlier >±8%: L=${outL}, W=${outW}, H=${outH}, Motori=${outAny}/${results.length}`,
);

// === TEST AUTOMATICO ISOLAMENTO ASSI TURBO ===
const baseI4Spec = SPECS.find((s) => s.id === 19) as PistonEnvelopeSpec;
const baseV8Spec = SPECS.find((s) => s.id === 65) as PistonEnvelopeSpec;
const baseB6Spec = SPECS.find((s) => s.id === 90) as PistonEnvelopeSpec;

const naI4 = calculatePistonGeometryAndDimensions(makePistonConfig(baseI4Spec)).dimensionsMm;
const frontI4Small = calculatePistonGeometryAndDimensions(
  makePistonConfig({ ...baseI4Spec, turboType: 'SingleScroll', turboPosition: 'Front', arRatio: 0.45 }),
).dimensionsMm;
const frontI4Large = calculatePistonGeometryAndDimensions(
  makePistonConfig({ ...baseI4Spec, turboType: 'SingleScroll', turboPosition: 'Front', arRatio: 0.90 }),
).dimensionsMm;

const sideI4Small = calculatePistonGeometryAndDimensions(
  makePistonConfig({ ...baseI4Spec, turboType: 'SingleScroll', turboPosition: 'Lateral', arRatio: 0.45 }),
).dimensionsMm;
const sideI4Twin = calculatePistonGeometryAndDimensions(
  makePistonConfig({ ...baseI4Spec, turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Lateral', arRatio: 0.45 }),
).dimensionsMm;
const sideI4Large = calculatePistonGeometryAndDimensions(
  makePistonConfig({ ...baseI4Spec, turboType: 'SingleScroll', turboPosition: 'Lateral', arRatio: 0.90 }),
).dimensionsMm;

const naV8 = calculatePistonGeometryAndDimensions(makePistonConfig(baseV8Spec)).dimensionsMm;
const hotVV8Street = calculatePistonGeometryAndDimensions(
  makePistonConfig({ ...baseV8Spec, turboType: 'TwinScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'HotV', arRatio: 0.65 }),
).dimensionsMm;
const hotVV8Big = calculatePistonGeometryAndDimensions(
  makePistonConfig({ ...baseV8Spec, turboType: 'TwinScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'HotV', arRatio: 1.05 }),
).dimensionsMm;

const naB6 = calculatePistonGeometryAndDimensions(makePistonConfig(baseB6Spec)).dimensionsMm;
const underBankB6 = calculatePistonGeometryAndDimensions(
  makePistonConfig({ ...baseB6Spec, turboType: 'VGT', turboCountConfig: 'TwinTurbo', turboPosition: 'Lateral', arRatio: 0.68 }),
).dimensionsMm;

const isoFrontOk =
  frontI4Small.lengthMm > naI4.lengthMm &&
  frontI4Large.lengthMm > frontI4Small.lengthMm &&
  frontI4Small.widthMm === naI4.widthMm &&
  frontI4Large.widthMm === naI4.widthMm &&
  frontI4Small.heightMm === naI4.heightMm &&
  frontI4Large.heightMm === naI4.heightMm;

const isoSideOk =
  sideI4Small.widthMm > naI4.widthMm &&
  sideI4Large.widthMm > sideI4Small.widthMm &&
  sideI4Small.lengthMm === naI4.lengthMm &&
  sideI4Large.lengthMm === naI4.lengthMm &&
  sideI4Twin.lengthMm === sideI4Small.lengthMm &&
  sideI4Small.heightMm === naI4.heightMm &&
  sideI4Large.heightMm === naI4.heightMm;

const isoHotVOk =
  hotVV8Street.lengthMm === naV8.lengthMm &&
  hotVV8Street.widthMm === naV8.widthMm &&
  hotVV8Street.heightMm === naV8.heightMm &&
  hotVV8Big.lengthMm === naV8.lengthMm &&
  hotVV8Big.widthMm === naV8.widthMm &&
  hotVV8Big.heightMm > naV8.heightMm;

const isoUnderBankOk =
  underBankB6.lengthMm === naB6.lengthMm &&
  underBankB6.heightMm === naB6.heightMm &&
  underBankB6.widthMm > naB6.widthMm;

console.log('\n=== TEST AUTOMATICO ISOLAMENTO ASSI TURBO ===');
console.log(
  `[${isoFrontOk ? 'PASS' : 'FAIL'}] Front-Mount (NA -> AR 0.45 -> AR 0.90): L=${naI4.lengthMm}->${frontI4Small.lengthMm}->${frontI4Large.lengthMm} | ΔW=${frontI4Large.widthMm - naI4.widthMm} mm | ΔH=${frontI4Large.heightMm - naI4.heightMm} mm`,
);
console.log(
  `[${isoSideOk ? 'PASS' : 'FAIL'}] Side-Mount (NA -> Single 0.45 -> Twin 0.45 -> AR 0.90): W=${naI4.widthMm}->${sideI4Small.widthMm}/${sideI4Twin.widthMm}->${sideI4Large.widthMm} | ΔL=${sideI4Twin.lengthMm - naI4.lengthMm} mm | ΔH=${sideI4Large.heightMm - naI4.heightMm} mm`,
);
console.log(
  `[${isoHotVOk ? 'PASS' : 'FAIL'}] Hot-V V8 (NA -> AR 0.65 -> AR 1.05): ΔL=${hotVV8Big.lengthMm - naV8.lengthMm} mm | ΔW=${hotVV8Big.widthMm - naV8.widthMm} mm | H=${naV8.heightMm}->${hotVV8Street.heightMm}->${hotVV8Big.heightMm}`,
);
console.log(
  `[${isoUnderBankOk ? 'PASS' : 'FAIL'}] Under-Bank Boxer-6 (NA -> Twin AR 0.68): ΔL=${underBankB6.lengthMm - naB6.lengthMm} mm | ΔH=${underBankB6.heightMm - naB6.heightMm} mm | W=${naB6.widthMm}->${underBankB6.widthMm}`,
);

const meanAll = (gL + gW + gH) / 3;
const certOk =
  gL < 3.5 &&
  gW < 3.5 &&
  gH < 3.5 &&
  meanAll < 3.0 &&
  outAny === 0 &&
  isoFrontOk &&
  isoSideOk &&
  isoHotVOk &&
  isoUnderBankOk;

console.log(
  `\n[${certOk ? 'CERTIFICATO' : 'FALLITO'}] AvgL<3.5 (${gL.toFixed(2)}%) | AvgW<3.5 (${gW.toFixed(2)}%) | AvgH<3.5 (${gH.toFixed(2)}%) | Global<3.0 (${meanAll.toFixed(2)}%) | Outliers=${outAny}/${results.length} | Assi=${isoFrontOk && isoSideOk && isoHotVOk && isoUnderBankOk ? 'OK' : 'FAIL'}`,
);
if (!certOk) {
  process.exit(1);
}
