import { CHASSIS_STRUCTURES } from '../data/chassisData';
import type { ChassisEntity, EngineOrientation } from '../types/gameTypes';
import {
  calculateChassisMetrics,
  resolveChassisLayoutRules,
  type ChassisConfigInput,
} from './chassisMath';
import {
  calculatePistonGeometryAndDimensions,
  type PistonEngineConfigInput,
} from './engineMath';
import { evaluateEngineBayCompatibility } from './volumeMath';

interface PlatformBenchmarkCase {
  id: number;
  cat: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  name: string;
  year: number;
  noteMapping: string;
  config: ChassisConfigInput;
  realBiwKg: number;
  realRollingKg: number;
  realRigidityNmPerDeg: number;
}

const PLATFORM_CASES: PlatformBenchmarkCase[] = [
  // A) Monoscocche Storiche & Utilitarie Economy (8)
  {
    id: 1,
    cat: 'A',
    name: 'Fiat Panda 141 (1980)',
    year: 1980,
    noteMapping: 'Monoscocca acciaio dolce',
    config: {
      structureId: 'str-steel-stamped',
      overallDimensionsMm: { lengthMm: 3380, widthMm: 1460, heightMm: 1445 },
      wheelbaseMm: 2160,
      frontTrackMm: 1260,
      rearTrackMm: 1260,
      groundClearanceMm: 150,
      rigidityReinforcementPercent: 0,
      safetyStructurePercent: 5,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 25,
      drivetrainMode: 'FWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['FWD'],
    },
    realBiwKg: 165,
    realRollingKg: 310,
    realRigidityNmPerDeg: 5800,
  },
  {
    id: 2,
    cat: 'A',
    name: 'Peugeot 205 (1983)',
    year: 1983,
    noteMapping: 'Monoscocca acciaio leggero',
    config: {
      structureId: 'str-steel-stamped',
      overallDimensionsMm: { lengthMm: 3705, widthMm: 1572, heightMm: 1370 },
      wheelbaseMm: 2420,
      frontTrackMm: 1365,
      rearTrackMm: 1350,
      groundClearanceMm: 135,
      rigidityReinforcementPercent: 5,
      safetyStructurePercent: 10,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 30,
      drivetrainMode: 'FWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['FWD'],
    },
    realBiwKg: 175,
    realRollingKg: 325,
    realRigidityNmPerDeg: 6500,
  },
  {
    id: 3,
    cat: 'A',
    name: 'Volkswagen Golf Mk1 (1974)',
    year: 1974,
    noteMapping: 'Pianale A1 acciaio stampato',
    config: {
      structureId: 'str-steel-stamped',
      overallDimensionsMm: { lengthMm: 3705, widthMm: 1610, heightMm: 1390 },
      wheelbaseMm: 2400,
      frontTrackMm: 1390,
      rearTrackMm: 1360,
      groundClearanceMm: 140,
      rigidityReinforcementPercent: 10,
      safetyStructurePercent: 10,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 30,
      drivetrainMode: 'FWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['FWD'],
    },
    realBiwKg: 185,
    realRollingKg: 340,
    realRigidityNmPerDeg: 7200,
  },
  {
    id: 4,
    cat: 'A',
    name: 'Fiat Punto 199 / Grande Punto (2005)',
    year: 2005,
    noteMapping: 'Pianale SCCS HSS (proxy UHSS)',
    config: {
      structureId: 'str-uhss-steel',
      overallDimensionsMm: { lengthMm: 4030, widthMm: 1687, heightMm: 1490 },
      wheelbaseMm: 2510,
      frontTrackMm: 1470,
      rearTrackMm: 1466,
      groundClearanceMm: 140,
      rigidityReinforcementPercent: 10,
      safetyStructurePercent: 50,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 35,
      drivetrainMode: 'FWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['FWD'],
    },
    realBiwKg: 245,
    realRollingKg: 430,
    realRigidityNmPerDeg: 16900,
  },
  {
    id: 5,
    cat: 'A',
    name: 'Fiat 500 / Panda Mini (2007)',
    year: 2007,
    noteMapping: 'Acciaio HSS micro (proxy acciaio rinforzato)',
    config: {
      structureId: 'str-steel-stamped',
      overallDimensionsMm: { lengthMm: 3546, widthMm: 1627, heightMm: 1488 },
      wheelbaseMm: 2300,
      frontTrackMm: 1410,
      rearTrackMm: 1407,
      groundClearanceMm: 135,
      rigidityReinforcementPercent: 40,
      safetyStructurePercent: 55,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 30,
      drivetrainMode: 'FWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['FWD'],
    },
    realBiwKg: 215,
    realRollingKg: 380,
    realRigidityNmPerDeg: 14500,
  },
  {
    id: 6,
    cat: 'A',
    name: 'Ford Fiesta Mk7 (2008)',
    year: 2008,
    noteMapping: 'Global B-Car HSS/Boro',
    config: {
      structureId: 'str-uhss-steel',
      overallDimensionsMm: { lengthMm: 3950, widthMm: 1722, heightMm: 1481 },
      wheelbaseMm: 2490,
      frontTrackMm: 1485,
      rearTrackMm: 1475,
      groundClearanceMm: 140,
      rigidityReinforcementPercent: 15,
      safetyStructurePercent: 65,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 35,
      drivetrainMode: 'FWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['FWD'],
    },
    realBiwKg: 250,
    realRollingKg: 435,
    realRigidityNmPerDeg: 19000,
  },
  {
    id: 7,
    cat: 'A',
    name: 'Suzuki Swift Heartect (2017)',
    year: 2017,
    noteMapping: 'Ultra-Light UHSS (scocca base FWD 840kg 3-stelle EuroNCAP)',
    config: {
      structureId: 'str-uhss-steel',
      overallDimensionsMm: { lengthMm: 3840, widthMm: 1735, heightMm: 1495 },
      wheelbaseMm: 2450,
      frontTrackMm: 1520,
      rearTrackMm: 1520,
      groundClearanceMm: 120,
      rigidityReinforcementPercent: 8,
      safetyStructurePercent: 20,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 35,
      drivetrainMode: 'FWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['FWD'],
    },
    realBiwKg: 195,
    realRollingKg: 355,
    realRigidityNmPerDeg: 17500,
  },
  {
    id: 8,
    cat: 'A',
    name: 'Renault Clio V / Sandero III (2020)',
    year: 2020,
    noteMapping: 'CMF-B HSS',
    config: {
      structureId: 'str-uhss-steel',
      overallDimensionsMm: { lengthMm: 4050, widthMm: 1798, heightMm: 1440 },
      wheelbaseMm: 2600,
      frontTrackMm: 1520,
      rearTrackMm: 1510,
      groundClearanceMm: 135,
      rigidityReinforcementPercent: 20,
      safetyStructurePercent: 70,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 35,
      drivetrainMode: 'FWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['FWD'],
    },
    realBiwKg: 255,
    realRollingKg: 445,
    realRigidityNmPerDeg: 21000,
  },

  // B) Pianali Modulari Moderni Segmento C / D / E (10)
  {
    id: 9,
    cat: 'B',
    name: 'BMW Serie 3 E36 (1990)',
    year: 1990,
    noteMapping: 'Monoscocca acciaio RWD',
    config: {
      structureId: 'str-steel-stamped',
      overallDimensionsMm: { lengthMm: 4433, widthMm: 1698, heightMm: 1393 },
      wheelbaseMm: 2700,
      frontTrackMm: 1415,
      rearTrackMm: 1431,
      groundClearanceMm: 130,
      rigidityReinforcementPercent: 20,
      safetyStructurePercent: 40,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 55,
      drivetrainMode: 'RWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD'],
    },
    realBiwKg: 275,
    realRollingKg: 495,
    realRigidityNmPerDeg: 10500,
  },
  {
    id: 10,
    cat: 'B',
    name: 'BMW Serie 3 E46 (1998)',
    year: 1998,
    noteMapping: 'Monoscocca HSS RWD',
    config: {
      structureId: 'str-uhss-steel',
      overallDimensionsMm: { lengthMm: 4471, widthMm: 1739, heightMm: 1415 },
      wheelbaseMm: 2725,
      frontTrackMm: 1475,
      rearTrackMm: 1483,
      groundClearanceMm: 130,
      rigidityReinforcementPercent: 10,
      safetyStructurePercent: 55,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 55,
      drivetrainMode: 'RWD_AWD_Ready',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD', 'AWD'],
    },
    realBiwKg: 295,
    realRollingKg: 525,
    realRigidityNmPerDeg: 18000,
  },
  {
    id: 11,
    cat: 'B',
    name: 'Volkswagen Golf Mk5 (2003)',
    year: 2003,
    noteMapping: 'PQ35 saldatura laser',
    config: {
      structureId: 'str-uhss-steel',
      overallDimensionsMm: { lengthMm: 4204, widthMm: 1759, heightMm: 1485 },
      wheelbaseMm: 2580,
      frontTrackMm: 1535,
      rearTrackMm: 1515,
      groundClearanceMm: 135,
      rigidityReinforcementPercent: 30,
      safetyStructurePercent: 65,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 40,
      drivetrainMode: 'FWD_AWD_Ready',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['FWD', 'AWD'],
    },
    realBiwKg: 285,
    realRollingKg: 490,
    realRigidityNmPerDeg: 25000,
  },
  {
    id: 12,
    cat: 'B',
    name: 'Volkswagen Golf Mk7 / Mk8 (2012)',
    year: 2012,
    noteMapping: 'MQB UHSS Hot-Stamped (scocca base 2WD 262 kg)',
    config: {
      structureId: 'str-uhss-steel',
      overallDimensionsMm: { lengthMm: 4255, widthMm: 1799, heightMm: 1452 },
      wheelbaseMm: 2630,
      frontTrackMm: 1545,
      rearTrackMm: 1520,
      groundClearanceMm: 135,
      rigidityReinforcementPercent: 45,
      safetyStructurePercent: 85,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 45,
      drivetrainMode: 'FWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['FWD'],
    },
    realBiwKg: 262,
    realRollingKg: 460,
    realRigidityNmPerDeg: 28500,
  },
  {
    id: 13,
    cat: 'B',
    name: 'Peugeot 308 / 3008 (2014)',
    year: 2014,
    noteMapping: 'EMP2 acciaio/alluminio',
    config: {
      structureId: 'str-uhss-steel',
      overallDimensionsMm: { lengthMm: 4253, widthMm: 1804, heightMm: 1457 },
      wheelbaseMm: 2675,
      frontTrackMm: 1560,
      rearTrackMm: 1555,
      groundClearanceMm: 135,
      rigidityReinforcementPercent: 30,
      safetyStructurePercent: 75,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 45,
      drivetrainMode: 'FWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['FWD'],
    },
    realBiwKg: 258,
    realRollingKg: 455,
    realRigidityNmPerDeg: 24500,
  },
  {
    id: 14,
    cat: 'B',
    name: 'Toyota Corolla / C-HR (2018)',
    year: 2018,
    noteMapping: 'TNGA-C Ring-Frame UHSS',
    config: {
      structureId: 'str-uhss-steel',
      overallDimensionsMm: { lengthMm: 4370, widthMm: 1790, heightMm: 1435 },
      wheelbaseMm: 2640,
      frontTrackMm: 1530,
      rearTrackMm: 1540,
      groundClearanceMm: 135,
      rigidityReinforcementPercent: 35,
      safetyStructurePercent: 85,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 45,
      drivetrainMode: 'FWD_AWD_Ready',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['FWD', 'AWD'],
    },
    realBiwKg: 270,
    realRollingKg: 470,
    realRigidityNmPerDeg: 26000,
  },
  {
    id: 15,
    cat: 'B',
    name: 'Mazda 3 / CX-30 (2019)',
    year: 2019,
    noteMapping: 'Skyactiv-Vehicle Architecture UHSS',
    config: {
      structureId: 'str-uhss-steel',
      overallDimensionsMm: { lengthMm: 4460, widthMm: 1795, heightMm: 1435 },
      wheelbaseMm: 2725,
      frontTrackMm: 1565,
      rearTrackMm: 1580,
      groundClearanceMm: 135,
      rigidityReinforcementPercent: 40,
      safetyStructurePercent: 85,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 45,
      drivetrainMode: 'FWD_AWD_Ready',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['FWD', 'AWD'],
    },
    realBiwKg: 275,
    realRollingKg: 480,
    realRigidityNmPerDeg: 27000,
  },
  {
    id: 16,
    cat: 'B',
    name: 'BMW Serie 3 G20 (2019)',
    year: 2019,
    noteMapping: 'CLAR Misto UHSS/Alu',
    config: {
      structureId: 'str-hybrid-giorgio',
      overallDimensionsMm: { lengthMm: 4709, widthMm: 1827, heightMm: 1442 },
      wheelbaseMm: 2850,
      frontTrackMm: 1585,
      rearTrackMm: 1600,
      groundClearanceMm: 135,
      rigidityReinforcementPercent: 20,
      safetyStructurePercent: 85,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 60,
      drivetrainMode: 'RWD_AWD_Ready',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD', 'AWD'],
    },
    realBiwKg: 305,
    realRollingKg: 545,
    realRigidityNmPerDeg: 31000,
  },
  {
    id: 17,
    cat: 'B',
    name: 'Alfa Romeo Giulia / Stelvio (2016)',
    year: 2016,
    noteMapping: 'Pianale Giorgio UHSS/Alu/Carbon',
    config: {
      structureId: 'str-hybrid-giorgio',
      overallDimensionsMm: { lengthMm: 4643, widthMm: 1860, heightMm: 1436 },
      wheelbaseMm: 2820,
      frontTrackMm: 1575,
      rearTrackMm: 1625,
      groundClearanceMm: 125,
      rigidityReinforcementPercent: 27,
      safetyStructurePercent: 90,
      supportedEnginePositions: ['Anteriore-Centrale'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 75,
      drivetrainMode: 'RWD_AWD_Ready',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD', 'AWD'],
    },
    realBiwKg: 282,
    realRollingKg: 510,
    realRigidityNmPerDeg: 35000,
  },
  {
    id: 18,
    cat: 'B',
    name: 'Mercedes-Benz Classe S W223 (2020)',
    year: 2020,
    noteMapping: 'MRA2 Alu-Hybrid',
    config: {
      structureId: 'str-hybrid-giorgio',
      overallDimensionsMm: { lengthMm: 5179, widthMm: 1954, heightMm: 1503 },
      wheelbaseMm: 3105,
      frontTrackMm: 1655,
      rearTrackMm: 1680,
      groundClearanceMm: 135,
      rigidityReinforcementPercent: 35,
      safetyStructurePercent: 95,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 60,
      drivetrainMode: 'RWD_AWD_Ready',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD', 'AWD'],
    },
    realBiwKg: 345,
    realRollingKg: 620,
    realRigidityNmPerDeg: 40500,
  },

  // C) Telai a Longheroni (Ladder Frame) & Tralicci Tubolari (6)
  {
    id: 19,
    cat: 'C',
    name: 'Mercedes 300 SL Gullwing W198 (1954)',
    year: 1954,
    noteMapping: 'Traliccio CrMo (proxy str-backbone-grp, NO traliccio tubolare in UI)',
    config: {
      structureId: 'str-backbone-grp',
      overallDimensionsMm: { lengthMm: 4520, widthMm: 1790, heightMm: 1300 },
      wheelbaseMm: 2400,
      frontTrackMm: 1390,
      rearTrackMm: 1445,
      groundClearanceMm: 130,
      rigidityReinforcementPercent: 0,
      safetyStructurePercent: 0,
      supportedEnginePositions: ['Anteriore-Centrale'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 75,
      drivetrainMode: 'RWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD'],
    },
    realBiwKg: 190,
    realRollingKg: 310,
    realRigidityNmPerDeg: 4200,
  },
  {
    id: 20,
    cat: 'C',
    name: 'Caterham Seven CSR (2005)',
    year: 2005,
    noteMapping: 'Traliccio leggero (proxy str-backbone-grp, NO traliccio tubolare in UI)',
    config: {
      structureId: 'str-backbone-grp',
      overallDimensionsMm: { lengthMm: 3300, widthMm: 1685, heightMm: 1100 },
      wheelbaseMm: 2225,
      frontTrackMm: 1335,
      rearTrackMm: 1460,
      groundClearanceMm: 100,
      rigidityReinforcementPercent: 0,
      safetyStructurePercent: 0,
      supportedEnginePositions: ['Anteriore-Centrale'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 80,
      drivetrainMode: 'RWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD'],
    },
    realBiwKg: 135,
    realRollingKg: 210,
    realRigidityNmPerDeg: 3800,
  },
  {
    id: 21,
    cat: 'C',
    name: 'Land Rover Defender 110 (1990)',
    year: 1990,
    noteMapping: 'Longheroni acciaio boxed',
    config: {
      structureId: 'str-ladder-frame',
      overallDimensionsMm: { lengthMm: 4599, widthMm: 1790, heightMm: 2035 },
      wheelbaseMm: 2795,
      frontTrackMm: 1485,
      rearTrackMm: 1485,
      groundClearanceMm: 215,
      rigidityReinforcementPercent: 10,
      safetyStructurePercent: 20,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 40,
      drivetrainMode: 'RWD_AWD_Ready',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD', 'AWD'],
    },
    realBiwKg: 460,
    realRollingKg: 760,
    realRigidityNmPerDeg: 7500,
  },
  {
    id: 22,
    cat: 'C',
    name: 'Mitsubishi Pajero V20 GLS (1991)',
    year: 1991,
    noteMapping: 'Longheroni fuoristrada',
    config: {
      structureId: 'str-ladder-frame',
      overallDimensionsMm: { lengthMm: 4725, widthMm: 1785, heightMm: 1900 },
      wheelbaseMm: 2725,
      frontTrackMm: 1465,
      rearTrackMm: 1480,
      groundClearanceMm: 205,
      rigidityReinforcementPercent: 25,
      safetyStructurePercent: 25,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 40,
      drivetrainMode: 'RWD_AWD_Ready',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD', 'AWD'],
    },
    realBiwKg: 440,
    realRollingKg: 730,
    realRigidityNmPerDeg: 9800,
  },
  {
    id: 23,
    cat: 'C',
    name: 'Jeep Wrangler JL Rubicon (2018)',
    year: 2018,
    noteMapping: 'Longheroni HSS + Alu',
    config: {
      structureId: 'str-ladder-frame',
      overallDimensionsMm: { lengthMm: 4785, widthMm: 1875, heightMm: 1869 },
      wheelbaseMm: 3010,
      frontTrackMm: 1598,
      rearTrackMm: 1598,
      groundClearanceMm: 250,
      rigidityReinforcementPercent: 58,
      safetyStructurePercent: 65,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 45,
      drivetrainMode: 'RWD_AWD_Ready',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD', 'AWD'],
    },
    realBiwKg: 475,
    realRollingKg: 780,
    realRigidityNmPerDeg: 14200,
  },
  {
    id: 24,
    cat: 'C',
    name: 'Mercedes Classe G W463A (2018)',
    year: 2018,
    noteMapping: 'Longheroni + scocca mista',
    config: {
      structureId: 'str-ladder-frame',
      overallDimensionsMm: { lengthMm: 4817, widthMm: 1931, heightMm: 1969 },
      wheelbaseMm: 2890,
      frontTrackMm: 1638,
      rearTrackMm: 1638,
      groundClearanceMm: 241,
      rigidityReinforcementPercent: 20,
      safetyStructurePercent: 75,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 45,
      drivetrainMode: 'RWD_AWD_Ready',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD', 'AWD'],
    },
    realBiwKg: 510,
    realRollingKg: 840,
    realRigidityNmPerDeg: 10162,
  },

  // D) Spaceframe in Alluminio & Piattaforme Sportive Miste (8)
  {
    id: 25,
    cat: 'D',
    name: 'Honda NSX NA1 (1990)',
    year: 1990,
    noteMapping: 'Monoscocca integrale alluminio (year < minYear 1996)',
    config: {
      structureId: 'str-alu-spaceframe',
      overallDimensionsMm: { lengthMm: 4425, widthMm: 1810, heightMm: 1170 },
      wheelbaseMm: 2530,
      frontTrackMm: 1510,
      rearTrackMm: 1528,
      groundClearanceMm: 115,
      rigidityReinforcementPercent: 15,
      safetyStructurePercent: 25,
      supportedEnginePositions: ['Centrale-Posteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 50,
      drivetrainMode: 'RWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD'],
    },
    realBiwKg: 210,
    realRollingKg: 410,
    realRigidityNmPerDeg: 13500,
  },
  {
    id: 26,
    cat: 'D',
    name: 'Lotus Elise S1 / S2 (1996)',
    year: 1996,
    noteMapping: 'Vasca alluminio estruso incollato',
    config: {
      structureId: 'str-alu-spaceframe',
      overallDimensionsMm: { lengthMm: 3785, widthMm: 1719, heightMm: 1117 },
      wheelbaseMm: 2300,
      frontTrackMm: 1440,
      rearTrackMm: 1486,
      groundClearanceMm: 130,
      rigidityReinforcementPercent: 0,
      safetyStructurePercent: 10,
      supportedEnginePositions: ['Centrale-Posteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 50,
      drivetrainMode: 'RWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD'],
    },
    realBiwKg: 165,
    realRollingKg: 290,
    realRigidityNmPerDeg: 10500,
  },
  {
    id: 27,
    cat: 'D',
    name: 'Audi A8 D2 (1994)',
    year: 1994,
    noteMapping: 'ASF Gen1 Spaceframe Alluminio (year < minYear 1996)',
    config: {
      structureId: 'str-alu-spaceframe',
      overallDimensionsMm: { lengthMm: 5034, widthMm: 1880, heightMm: 1440 },
      wheelbaseMm: 2880,
      frontTrackMm: 1580,
      rearTrackMm: 1580,
      groundClearanceMm: 125,
      rigidityReinforcementPercent: 28,
      safetyStructurePercent: 50,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 25,
      drivetrainMode: 'FWD_AWD_Ready',
      allowLongitudinalFwd: true,
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['FWD', 'AWD'],
    },
    realBiwKg: 249,
    realRollingKg: 510,
    realRigidityNmPerDeg: 20000,
  },
  {
    id: 28,
    cat: 'D',
    name: 'Ferrari 360 Modena (1999)',
    year: 1999,
    noteMapping: 'Spaceframe Alluminio Alcoa',
    config: {
      structureId: 'str-alu-spaceframe',
      overallDimensionsMm: { lengthMm: 4477, widthMm: 1922, heightMm: 1214 },
      wheelbaseMm: 2600,
      frontTrackMm: 1670,
      rearTrackMm: 1620,
      groundClearanceMm: 115,
      rigidityReinforcementPercent: 10,
      safetyStructurePercent: 40,
      supportedEnginePositions: ['Centrale-Posteriore'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 55,
      drivetrainMode: 'RWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD'],
    },
    realBiwKg: 225,
    realRollingKg: 440,
    realRigidityNmPerDeg: 14700,
  },
  {
    id: 29,
    cat: 'D',
    name: 'Ferrari 458 / 488 GTB (2009)',
    year: 2009,
    noteMapping: 'Spaceframe Alluminio Multiphase',
    config: {
      structureId: 'str-alu-spaceframe',
      overallDimensionsMm: { lengthMm: 4527, widthMm: 1937, heightMm: 1213 },
      wheelbaseMm: 2650,
      frontTrackMm: 1672,
      rearTrackMm: 1606,
      groundClearanceMm: 115,
      rigidityReinforcementPercent: 30,
      safetyStructurePercent: 65,
      supportedEnginePositions: ['Centrale-Posteriore'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 60,
      drivetrainMode: 'RWD_Only',
      gearboxLayout: 'MidCentralTunnel',
      supportedDrivetrains: ['RWD'],
    },
    realBiwKg: 238,
    realRollingKg: 455,
    realRigidityNmPerDeg: 20600,
  },
  {
    id: 30,
    cat: 'D',
    name: 'Porsche 911 (992) (2019)',
    year: 2019,
    noteMapping: 'MMB 70% Alu / 30% Acciaio Carrera 2WD 240kg (proxy str-hybrid-giorgio)',
    config: {
      structureId: 'str-hybrid-giorgio',
      overallDimensionsMm: { lengthMm: 4519, widthMm: 1852, heightMm: 1298 },
      wheelbaseMm: 2450,
      frontTrackMm: 1590,
      rearTrackMm: 1557,
      groundClearanceMm: 115,
      rigidityReinforcementPercent: 45,
      safetyStructurePercent: 85,
      supportedEnginePositions: ['Posteriore'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 20,
      drivetrainMode: 'RWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD'],
    },
    realBiwKg: 240,
    realRollingKg: 465,
    realRigidityNmPerDeg: 39000,
  },
  {
    id: 31,
    cat: 'D',
    name: 'Audi R8 V10 / Huracán (2014)',
    year: 2014,
    noteMapping: 'MSS Alluminio + Carbonio',
    config: {
      structureId: 'str-alu-carbon-supercar',
      overallDimensionsMm: { lengthMm: 4459, widthMm: 1924, heightMm: 1165 },
      wheelbaseMm: 2650,
      frontTrackMm: 1650,
      rearTrackMm: 1620,
      groundClearanceMm: 110,
      rigidityReinforcementPercent: 48,
      safetyStructurePercent: 75,
      supportedEnginePositions: ['Centrale-Posteriore'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 60,
      drivetrainMode: 'RWD_AWD_Ready',
      gearboxLayout: 'MidCentralTunnel',
      supportedDrivetrains: ['RWD', 'AWD'],
    },
    realBiwKg: 200,
    realRollingKg: 430,
    realRigidityNmPerDeg: 40000,
  },
  {
    id: 32,
    cat: 'D',
    name: 'Mercedes-AMG GT / SL (2022)',
    year: 2022,
    noteMapping: 'MSA Spaceframe Alu/Mg/CF',
    config: {
      structureId: 'str-alu-carbon-supercar',
      overallDimensionsMm: { lengthMm: 4705, widthMm: 1915, heightMm: 1354 },
      wheelbaseMm: 2700,
      frontTrackMm: 1680,
      rearTrackMm: 1680,
      groundClearanceMm: 115,
      rigidityReinforcementPercent: 30,
      safetyStructurePercent: 80,
      supportedEnginePositions: ['Anteriore-Centrale'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 80,
      drivetrainMode: 'RWD_AWD_Ready',
      gearboxLayout: 'RearTransaxleTorqueTube',
      supportedDrivetrains: ['RWD', 'AWD'],
    },
    realBiwKg: 270,
    realRollingKg: 510,
    realRigidityNmPerDeg: 36500,
  },

  // E) Monoscocche in Carbonio & Carbo-Titanio Supercar/Hypercar (4)
  {
    id: 33,
    cat: 'E',
    name: 'Alfa Romeo 4C (2013)',
    year: 2013,
    noteMapping: 'Vasca Prepreg Autoclave + Telaietti Alu',
    config: {
      structureId: 'str-carbon-monocoque',
      overallDimensionsMm: { lengthMm: 3989, widthMm: 1864, heightMm: 1183 },
      wheelbaseMm: 2380,
      frontTrackMm: 1600,
      rearTrackMm: 1625,
      groundClearanceMm: 110,
      rigidityReinforcementPercent: 0,
      safetyStructurePercent: 55,
      supportedEnginePositions: ['Centrale-Posteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 55,
      drivetrainMode: 'RWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD'],
    },
    realBiwKg: 155,
    realRollingKg: 295,
    realRigidityNmPerDeg: 26000,
  },
  {
    id: 34,
    cat: 'E',
    name: 'McLaren 720S / MP4-12C (2017)',
    year: 2017,
    noteMapping: 'MonoCage II Carbonio RTM',
    config: {
      structureId: 'str-carbon-monocoque',
      overallDimensionsMm: { lengthMm: 4543, widthMm: 1930, heightMm: 1196 },
      wheelbaseMm: 2670,
      frontTrackMm: 1660,
      rearTrackMm: 1630,
      groundClearanceMm: 105,
      rigidityReinforcementPercent: 22,
      safetyStructurePercent: 75,
      supportedEnginePositions: ['Centrale-Posteriore'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 60,
      drivetrainMode: 'RWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD'],
    },
    realBiwKg: 175,
    realRollingKg: 380,
    realRigidityNmPerDeg: 35000,
  },
  {
    id: 35,
    cat: 'E',
    name: 'Lamborghini Aventador / Revuelto (2023)',
    year: 2023,
    noteMapping: 'Monofuselage CFRP Forged',
    config: {
      structureId: 'str-carbon-monocoque',
      overallDimensionsMm: { lengthMm: 4947, widthMm: 2033, heightMm: 1160 },
      wheelbaseMm: 2779,
      frontTrackMm: 1720,
      rearTrackMm: 1700,
      groundClearanceMm: 110,
      rigidityReinforcementPercent: 35,
      safetyStructurePercent: 85,
      supportedEnginePositions: ['Centrale-Posteriore'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 65,
      drivetrainMode: 'RWD_AWD_Ready',
      gearboxLayout: 'MidCentralTunnel',
      supportedDrivetrains: ['RWD', 'AWD'],
    },
    realBiwKg: 190,
    realRollingKg: 420,
    realRigidityNmPerDeg: 40000,
  },
  {
    id: 36,
    cat: 'E',
    name: 'Pagani Utopia / Koenigsegg Jesko (2022)',
    year: 2022,
    noteMapping: 'Carbo-Titanio Prepreg',
    config: {
      structureId: 'str-carbon-monocoque',
      overallDimensionsMm: { lengthMm: 4673, widthMm: 2060, heightMm: 1165 },
      wheelbaseMm: 2795,
      frontTrackMm: 1715,
      rearTrackMm: 1685,
      groundClearanceMm: 105,
      rigidityReinforcementPercent: 95,
      safetyStructurePercent: 95,
      supportedEnginePositions: ['Centrale-Posteriore'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 65,
      drivetrainMode: 'RWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD'],
    },
    realBiwKg: 165,
    realRollingKg: 375,
    realRigidityNmPerDeg: 65000,
  },

  // F) Skateboard Elettrici, Gigacasting & Cell-to-Chassis (4)
  {
    id: 37,
    cat: 'F',
    name: 'Volkswagen MEB ID.3/ID.4 (2020)',
    year: 2020,
    noteMapping: 'Skateboard EV UHSS + Alu (proxy str-uhss-steel)',
    config: {
      structureId: 'str-uhss-steel',
      overallDimensionsMm: { lengthMm: 4584, widthMm: 1852, heightMm: 1612 },
      wheelbaseMm: 2770,
      frontTrackMm: 1585,
      rearTrackMm: 1560,
      groundClearanceMm: 160,
      rigidityReinforcementPercent: 50,
      safetyStructurePercent: 90,
      supportedEnginePositions: ['Posteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 50,
      drivetrainMode: 'RWD_AWD_Ready',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD', 'AWD'],
    },
    realBiwKg: 315,
    realRollingKg: 565,
    realRigidityNmPerDeg: 30000,
  },
  {
    id: 38,
    cat: 'F',
    name: 'Hyundai/Kia E-GMP Ioniq 5/EV6 (2021)',
    year: 2021,
    noteMapping: 'Skateboard EV UHSS (proxy str-uhss-steel)',
    config: {
      structureId: 'str-uhss-steel',
      overallDimensionsMm: { lengthMm: 4635, widthMm: 1890, heightMm: 1605 },
      wheelbaseMm: 3000,
      frontTrackMm: 1630,
      rearTrackMm: 1637,
      groundClearanceMm: 160,
      rigidityReinforcementPercent: 70,
      safetyStructurePercent: 95,
      supportedEnginePositions: ['Posteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 50,
      drivetrainMode: 'RWD_AWD_Ready',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD', 'AWD'],
    },
    realBiwKg: 335,
    realRollingKg: 595,
    realRigidityNmPerDeg: 33500,
  },
  {
    id: 39,
    cat: 'F',
    name: 'Tesla Model Y / 3 Highland (2023)',
    year: 2023,
    noteMapping: 'Megacasting + CTC (proxy str-hybrid-giorgio)',
    config: {
      structureId: 'str-hybrid-giorgio',
      overallDimensionsMm: { lengthMm: 4751, widthMm: 1921, heightMm: 1624 },
      wheelbaseMm: 2890,
      frontTrackMm: 1635,
      rearTrackMm: 1635,
      groundClearanceMm: 167,
      rigidityReinforcementPercent: 25,
      safetyStructurePercent: 95,
      supportedEnginePositions: ['Posteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 50,
      drivetrainMode: 'RWD_AWD_Ready',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['RWD', 'AWD'],
    },
    realBiwKg: 285,
    realRollingKg: 525,
    realRigidityNmPerDeg: 37000,
  },
  {
    id: 40,
    cat: 'F',
    name: 'Rimac Nevera Structural CTC (2022)',
    year: 2022,
    noteMapping: 'Monoscocca Carbonio Integrata CTC (proxy str-carbon-monocoque)',
    config: {
      structureId: 'str-carbon-monocoque',
      overallDimensionsMm: { lengthMm: 4750, widthMm: 1986, heightMm: 1208 },
      wheelbaseMm: 2745,
      frontTrackMm: 1690,
      rearTrackMm: 1680,
      groundClearanceMm: 105,
      rigidityReinforcementPercent: 100,
      safetyStructurePercent: 95,
      supportedEnginePositions: ['Centrale-Posteriore'],
      supportedEngineOrientations: ['Longitudinale'],
      engineSetbackPercent: 55,
      drivetrainMode: 'RWD_AWD_Ready',
      gearboxLayout: 'MidCentralTunnel',
      supportedDrivetrains: ['RWD', 'AWD'],
    },
    realBiwKg: 195,
    realRollingKg: 445,
    realRigidityNmPerDeg: 70000,
  },
];

function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

function makePistonForBay(
  p: Partial<PistonEngineConfigInput> & {
    architecture: PistonEngineConfigInput['architecture'];
    cylinders: number;
    boreMm: number;
    strokeMm: number;
    intendedOrientation: EngineOrientation;
  },
): PistonEngineConfigInput {
  const turboCount =
    p.turboCountConfig === 'QuadTurbo'
      ? 4
      : p.turboCountConfig === 'TripleTurbo'
        ? 3
        : p.turboCountConfig === 'TwinTurbo'
          ? 2
          : 1;
  const isForced = p.turboType !== undefined && p.turboType !== 'NaturallyAspirated';
  const ar = p.turboArRatio ?? 0.65;
  return {
    bankAngleDeg: 0,
    manualRedlineRpm: 7000,
    compressionRatio: 10.5,
    blockMaterialId: 'blk-cast-iron',
    headMaterialId: 'hd-alu-cast',
    pistonTypeId: 'pst-forged-oiljet',
    conrodTypeId: 'rod-c70-fractured',
    crankshaftTypeId: 'crk-forged-nitrided',
    camshaftTypeId: 'cam-dohc',
    valvesPerCylinder: 4,
    fuelType: 'Benzina',
    fuelSystemId: 'fs-mpi-electronic',
    intakeSystemId: 'int-std',
    exhaustManifoldId: 'exh-cast',
    turboType: 'NaturallyAspirated',
    turboCountConfig: 'SingleTurbo',
    turboBearingType: 'BallBearing',
    turboArRatio: ar,
    turboStagesArRatios: Array(turboCount).fill(ar),
    boostPressureBar: isForced ? 1.1 : 0,
    turboPosition: isForced ? 'Front' : 'None',
    catalystEra: 'Era3_MultiStage_DPF_SCR_2000s',
    priceTier: 'Media',
    referenceClass: 'Sport',
    nativeOrientation: p.intendedOrientation,
    ...p,
  };
}

function runPlatformBaseline(): void {
  console.log('=== PASSO 2: CERTIFICAZIONE 40 PIANALI REALI (1954-2025) ===');
  console.log(
    '| # | Cat | Anno | Pianale | Seg | Peso BIW Sim / Reale (Rolling) | Err BIW% | Rig Sim / Reale (Nm/deg) | Err Rig% | Vano (L×W×H mm) | Sic. | Costo ($) |',
  );
  console.log(
    '| :---: | :---: | :---: | :--- | :---: | :--- | :---: | :--- | :---: | :--- | :---: | :---: |',
  );

  const absBiwErrs: number[] = [];
  const absRigErrs: number[] = [];
  let outBiw10 = 0;
  let outRig8 = 0;
  let outRig12 = 0;
  let outBiw15 = 0;
  let outRig15 = 0;

  const catStats = new Map<
    string,
    { biw: number[]; rig: number[]; outBiw10: number; outRig12: number }
  >();
  const metricsById = new Map<
    number,
    { c: PlatformBenchmarkCase; res: ReturnType<typeof calculateChassisMetrics> }
  >();

  for (const c of PLATFORM_CASES) {
    const res = calculateChassisMetrics(c.config, c.year);
    metricsById.set(c.id, { c, res });
    const biwErr = ((res.baseWeightKg - c.realBiwKg) / c.realBiwKg) * 100;
    const rigErr =
      ((res.torsionalRigidityNmPerDeg - c.realRigidityNmPerDeg) / c.realRigidityNmPerDeg) * 100;

    absBiwErrs.push(Math.abs(biwErr));
    absRigErrs.push(Math.abs(rigErr));
    if (Math.abs(biwErr) > 10) outBiw10++;
    if (Math.abs(rigErr) > 8) outRig8++;
    if (Math.abs(rigErr) > 12) outRig12++;
    if (Math.abs(biwErr) > 15) outBiw15++;
    if (Math.abs(rigErr) > 15) outRig15++;

    if (!catStats.has(c.cat)) {
      catStats.set(c.cat, { biw: [], rig: [], outBiw10: 0, outRig12: 0 });
    }
    const cs = catStats.get(c.cat)!;
    cs.biw.push(Math.abs(biwErr));
    cs.rig.push(Math.abs(rigErr));
    if (Math.abs(biwErr) > 10) cs.outBiw10++;
    if (Math.abs(rigErr) > 12) cs.outRig12++;

    const bay = res.engineBayMaxDimensionsMm;
    console.log(
      `| ${c.id} | ${c.cat} | ${c.year} | ${c.name} | ${res.segmentInfo.segment} | ${res.baseWeightKg} / ${c.realBiwKg} (${c.realRollingKg}) kg | ${fmtPct(biwErr)} | ${res.torsionalRigidityNmPerDeg} / ${c.realRigidityNmPerDeg} | ${fmtPct(rigErr)} | ${bay.lengthMm}×${bay.widthMm}×${bay.heightMm} | ${res.structuralSafetyScore} | $${res.unitManufacturingCost} |`,
    );
  }

  const meanBiw = absBiwErrs.reduce((a, b) => a + b, 0) / absBiwErrs.length;
  const meanRig = absRigErrs.reduce((a, b) => a + b, 0) / absRigErrs.length;

  console.log('\n=== RIEPILOGO STATISTICO CERTIFICATO (40 PIANALI) ===');
  console.log(
    `Peso BIW: Media |Err| = ${meanBiw.toFixed(2)}% | Outlier > ±10%: ${outBiw10}/40 | Outlier > ±15%: ${outBiw15}/40`,
  );
  console.log(
    `Rigidita Torsionale: Media |Err| = ${meanRig.toFixed(2)}% | Outlier > ±12%: ${outRig12}/40 | Outlier > ±15%: ${outRig15}/40`,
  );
  for (const [cat, cs] of catStats.entries()) {
    const mB = cs.biw.reduce((a, b) => a + b, 0) / cs.biw.length;
    const mR = cs.rig.reduce((a, b) => a + b, 0) / cs.rig.length;
    console.log(
      `- Cat ${cat} (${cs.biw.length}): Media |Err BIW|=${mB.toFixed(2)}% (out>10%: ${cs.outBiw10}/${cs.biw.length}) | Media |Err Rig|=${mR.toFixed(2)}% (out>12%: ${cs.outRig12}/${cs.rig.length})`,
    );
  }

  // PASSO 3
  console.log('\n=== PASSO 3.1: VERIFICA CONTROLLI UI (DEAD / INVERTED CHECKS) ===');
  const baseCfg: ChassisConfigInput = {
    structureId: 'str-uhss-steel',
    overallDimensionsMm: { lengthMm: 4500, widthMm: 1820, heightMm: 1440 },
    wheelbaseMm: 2700,
    frontTrackMm: 1560,
    rearTrackMm: 1560,
    groundClearanceMm: 135,
    rigidityReinforcementPercent: 35,
    safetyStructurePercent: 50,
    supportedEnginePositions: ['Anteriore'],
    supportedEngineOrientations: ['Longitudinale'],
    engineSetbackPercent: 45,
    drivetrainMode: 'RWD_Only',
    allowLongitudinalFwd: false,
    gearboxLayout: 'InBlockWithEngine',
    supportedDrivetrains: ['RWD'],
    engineBayExtraLengthMm: 0,
    engineBayExtraWidthMm: 0,
    engineBayExtraHeightMm: 0,
  };

  let allControlsActive = true;

  function checkSweep(
    label: string,
    cfgLow: ChassisConfigInput,
    cfgHigh: ChassisConfigInput,
    year = 2022,
  ): {
    dKg: number;
    dRig: number;
    dSaf: number;
    dBayL: number;
    dBayW: number;
    dBayH: number;
    anyChanged: boolean;
  } {
    const a = calculateChassisMetrics(cfgLow, year);
    const b = calculateChassisMetrics(cfgHigh, year);
    const dKg = b.baseWeightKg - a.baseWeightKg;
    const dRig = b.torsionalRigidityNmPerDeg - a.torsionalRigidityNmPerDeg;
    const dSaf = b.structuralSafetyScore - a.structuralSafetyScore;
    const dCost = b.unitManufacturingCost - a.unitManufacturingCost;
    const dBayL = b.engineBayMaxDimensionsMm.lengthMm - a.engineBayMaxDimensionsMm.lengthMm;
    const dBayW = b.engineBayMaxDimensionsMm.widthMm - a.engineBayMaxDimensionsMm.widthMm;
    const dBayH = b.engineBayMaxDimensionsMm.heightMm - a.engineBayMaxDimensionsMm.heightMm;
    const dBay = `${dBayL}/${dBayW}/${dBayH}`;
    const dBias = Number((b.estimatedFrontWeightPercent - a.estimatedFrontWeightPercent).toFixed(1));
    const anyChanged =
      dKg !== 0 ||
      dRig !== 0 ||
      dSaf !== 0 ||
      dCost !== 0 ||
      dBias !== 0 ||
      dBay !== '0/0/0' ||
      a.segmentInfo.segment !== b.segmentInfo.segment ||
      a.frontOverhangMm !== b.frontOverhangMm;
    if (!anyChanged) allControlsActive = false;
    console.log(
      `- ${label.padEnd(36)}: dKg=${dKg >= 0 ? '+' : ''}${dKg} | dRig=${dRig >= 0 ? '+' : ''}${dRig} | dSaf=${dSaf >= 0 ? '+' : ''}${dSaf} | dCost=${dCost >= 0 ? '+' : ''}${dCost} | dBiasAnt=${dBias}% | dBay=${dBay} | seg=${a.segmentInfo.segment}->${b.segmentInfo.segment} ${anyChanged ? '[ATTIVO]' : '[MORTO!]'}`,
    );
    return { dKg, dRig, dSaf, dBayL, dBayW, dBayH, anyChanged };
  }

  const swReinf = checkSweep(
    'rigidityReinforcement (0->100%)',
    { ...baseCfg, rigidityReinforcementPercent: 0 },
    { ...baseCfg, rigidityReinforcementPercent: 100 },
  );
  const swSaf = checkSweep(
    'safetyStructure (0->100%)',
    { ...baseCfg, safetyStructurePercent: 0 },
    { ...baseCfg, safetyStructurePercent: 100 },
  );
  const swLen = checkSweep(
    'lengthMm (3200->5500 mm)',
    { ...baseCfg, overallDimensionsMm: { ...baseCfg.overallDimensionsMm, lengthMm: 3200 } },
    { ...baseCfg, overallDimensionsMm: { ...baseCfg.overallDimensionsMm, lengthMm: 5500 } },
  );
  const swWb = checkSweep(
    'wheelbaseMm (2000->3600 mm)',
    { ...baseCfg, overallDimensionsMm: { ...baseCfg.overallDimensionsMm, lengthMm: 4800 }, wheelbaseMm: 2000 },
    { ...baseCfg, overallDimensionsMm: { ...baseCfg.overallDimensionsMm, lengthMm: 4800 }, wheelbaseMm: 3600 },
  );
  const swW = checkSweep(
    'widthMm (1550->2150 mm)',
    { ...baseCfg, overallDimensionsMm: { ...baseCfg.overallDimensionsMm, widthMm: 1550 } },
    { ...baseCfg, overallDimensionsMm: { ...baseCfg.overallDimensionsMm, widthMm: 2150 } },
  );
  const swH = checkSweep(
    'heightMm (1050->2000 mm)',
    { ...baseCfg, overallDimensionsMm: { ...baseCfg.overallDimensionsMm, heightMm: 1050 } },
    { ...baseCfg, overallDimensionsMm: { ...baseCfg.overallDimensionsMm, heightMm: 2000 } },
  );
  const swFt = checkSweep(
    'frontTrackMm (1320->1800 mm)',
    { ...baseCfg, frontTrackMm: 1320 },
    { ...baseCfg, frontTrackMm: 1800 },
  );
  const swRtAnt = checkSweep(
    'rearTrackMm (1320->1800 mm, Ant)',
    { ...baseCfg, rearTrackMm: 1320 },
    { ...baseCfg, rearTrackMm: 1800 },
  );
  const swRtPost = checkSweep(
    'rearTrackMm (1320->1800 mm, Post)',
    { ...baseCfg, supportedEnginePositions: ['Centrale-Posteriore'], rearTrackMm: 1320 },
    { ...baseCfg, supportedEnginePositions: ['Centrale-Posteriore'], rearTrackMm: 1800 },
  );
  checkSweep(
    'groundClearanceMm (75->260 mm)',
    { ...baseCfg, groundClearanceMm: 75 },
    { ...baseCfg, groundClearanceMm: 260 },
  );
  checkSweep(
    'enginePosition (Ant->CentrPost)',
    { ...baseCfg, supportedEnginePositions: ['Anteriore'] },
    { ...baseCfg, supportedEnginePositions: ['Centrale-Posteriore'] },
  );
  checkSweep(
    'engineOrientation (Long->Trasv)',
    { ...baseCfg, supportedEngineOrientations: ['Longitudinale'], drivetrainMode: 'RWD_Only' },
    { ...baseCfg, supportedEngineOrientations: ['Trasversale'], drivetrainMode: 'FWD_Only' },
  );
  checkSweep(
    'drivetrainMode (RWD->RWD_AWD_Ready)',
    { ...baseCfg, drivetrainMode: 'RWD_Only' },
    { ...baseCfg, drivetrainMode: 'RWD_AWD_Ready' },
  );
  checkSweep(
    'allowLongitudinalFwd (false->true)',
    { ...baseCfg, engineSetbackPercent: 25, allowLongitudinalFwd: false },
    { ...baseCfg, engineSetbackPercent: 25, allowLongitudinalFwd: true },
  );
  checkSweep(
    'gearboxLayout (InBlock->Transaxle)',
    { ...baseCfg, gearboxLayout: 'InBlockWithEngine' },
    { ...baseCfg, gearboxLayout: 'RearTransaxleTorqueTube' },
  );
  checkSweep(
    'engineSetback (0->100%)',
    { ...baseCfg, engineSetbackPercent: 0 },
    { ...baseCfg, engineSetbackPercent: 100 },
  );
  checkSweep(
    'engineBayExtraL (-100->+150 mm)',
    { ...baseCfg, engineBayExtraLengthMm: -100 },
    { ...baseCfg, engineBayExtraLengthMm: 150 },
  );
  checkSweep(
    'engineBayExtraW (-80->+120 mm)',
    { ...baseCfg, engineBayExtraWidthMm: -80 },
    { ...baseCfg, engineBayExtraWidthMm: 120 },
  );
  checkSweep(
    'engineBayExtraH (-80->+120 mm)',
    { ...baseCfg, engineBayExtraHeightMm: -80 },
    { ...baseCfg, engineBayExtraHeightMm: 120 },
  );

  console.log('\n=== PASSO 3.2: LEGGE FISICA PASSO (wheelbaseMm) VS RIGIDITA E PESO (length=5200mm) ===');
  let wbMonotonic = true;
  let prevRig = Infinity;
  let prevKg = -Infinity;
  for (const wb of [2000, 2200, 2400, 2650, 2850, 3100, 3400, 3800, 4200]) {
    const m = calculateChassisMetrics(
      {
        ...baseCfg,
        overallDimensionsMm: { lengthMm: 5200, widthMm: 1850, heightMm: 1450 },
        wheelbaseMm: wb,
      },
      2022,
    );
    if (!(m.torsionalRigidityNmPerDeg < prevRig && m.baseWeightKg > prevKg)) {
      wbMonotonic = false;
    }
    prevRig = m.torsionalRigidityNmPerDeg;
    prevKg = m.baseWeightKg;
    console.log(
      `Passo=${wb} mm -> Peso BIW=${m.baseWeightKg} kg | Rigidità=${m.torsionalRigidityNmPerDeg} Nm/deg | Sbalzo Ant=${m.frontOverhangMm} mm / Post=${m.rearOverhangMm} mm`,
    );
  }

  console.log('\n=== PASSO 3.3: PROGRESSIONE TOPOLOGIE E MATERIALI A PARITA DI DIMENSIONI (4400x1800x1400, Passo 2650, Track 1580) ===');
  for (const s of CHASSIS_STRUCTURES) {
    const m = calculateChassisMetrics(
      {
        ...baseCfg,
        structureId: s.id,
        overallDimensionsMm: { lengthMm: 4400, widthMm: 1800, heightMm: 1400 },
        wheelbaseMm: 2650,
        frontTrackMm: 1580,
        rearTrackMm: 1580,
        groundClearanceMm: 130,
        rigidityReinforcementPercent: 35,
        safetyStructurePercent: 50,
      },
      2022,
    );
    console.log(
      `${s.id.padEnd(24)} (${s.minYear}+): Peso=${String(m.baseWeightKg).padStart(3)} kg | Rig=${String(m.torsionalRigidityNmPerDeg).padStart(5)} Nm/deg | Sic=${String(m.structuralSafetyScore).padStart(2)}/100 | Unit=$${m.unitManufacturingCost} | R&D=$${Math.round(m.developmentCost.capitalCost / 1_000_000)}M/${m.developmentCost.rdCost}pts | Dur=${m.taxonomy.estimatedDurabilityKm}km`,
    );
  }

  // PASSO 4: TEST ACCOPPIAMENTO VANO MOTORE (20 ACCOPPIAMENTI REALI = 25 SUB-TEST + 5 IMPOSSIBILI)
  console.log('\n=== PASSO 4: TEST ACCOPPIAMENTO VANO MOTORE <-> MOTORI REALI (extra=0 mm) ===');
  interface BayFitSpec {
    group: number;
    label: string;
    chassisId: number;
    engine: PistonEngineConfigInput;
    expectedCompatible: boolean;
  }

  const bayTests: BayFitSpec[] = [
    // 55+ accoppiamenti reali multi-motorizzazione (tutti PASS attesi, margine >= 10 mm)
    // Gruppo 1: Panda 141 (#1)
    { group: 1, label: '1a. Panda 141 + 1.0 FIRE I4', chassisId: 1, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 70, strokeMm: 64.9, valvesPerCylinder: 2, camshaftTypeId: 'cam-sohc', intendedOrientation: 'Trasversale' }) },
    { group: 1, label: '1b. Panda 141 + 1.1 FIRE I4', chassisId: 1, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 70, strokeMm: 72, valvesPerCylinder: 2, camshaftTypeId: 'cam-sohc', intendedOrientation: 'Trasversale' }) },
    { group: 1, label: '1c. Panda 141 + 1.3 Diesel I4', chassisId: 1, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 76, strokeMm: 71.5, valvesPerCylinder: 2, camshaftTypeId: 'cam-sohc', intendedOrientation: 'Trasversale' }) },
    // Gruppo 2: Peugeot 205 (#2) & Punto 199 (#4)
    { group: 2, label: '2a. Peugeot 205 + 1.1 TU1 I4', chassisId: 2, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 72, strokeMm: 69, valvesPerCylinder: 2, camshaftTypeId: 'cam-sohc', intendedOrientation: 'Trasversale' }) },
    { group: 2, label: '2b. Peugeot 205 + 1.9 GTI 8V', chassisId: 2, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 83, strokeMm: 88, valvesPerCylinder: 2, camshaftTypeId: 'cam-sohc', intendedOrientation: 'Trasversale' }) },
    { group: 2, label: '2c. Peugeot 205 + 1.9 16V Mi16 DOHC', chassisId: 2, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 83, strokeMm: 88, valvesPerCylinder: 4, camshaftTypeId: 'cam-dohc', intendedOrientation: 'Trasversale' }) },
    { group: 2, label: '2d. Punto 199 + 1.2 8V FIRE', chassisId: 4, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 70.8, strokeMm: 78.8, valvesPerCylinder: 2, camshaftTypeId: 'cam-sohc', intendedOrientation: 'Trasversale' }) },
    { group: 2, label: '2e. Punto 199 + 1.3 MultiJet Diesel', chassisId: 4, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 69.6, strokeMm: 82, turboType: 'SingleScroll', turboPosition: 'Front', intendedOrientation: 'Trasversale' }) },
    { group: 2, label: '2f. Punto 199 + 1.4 T-Jet Turbo', chassisId: 4, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 72, strokeMm: 84, turboType: 'SingleScroll', turboPosition: 'Front', intendedOrientation: 'Trasversale' }) },
    // Gruppo 3: Fiat 500 (#5)
    { group: 3, label: '3a. Fiat 500 + 0.9 TwinAir Turbo', chassisId: 5, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 2, boreMm: 80.5, strokeMm: 86, valvesPerCylinder: 4, camshaftTypeId: 'cam-sohc', turboType: 'SingleScroll', turboPosition: 'Lateral', turboArRatio: 0.35, intendedOrientation: 'Trasversale' }) },
    { group: 3, label: '3b. Fiat 500 + 1.2 8V FIRE', chassisId: 5, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 70.8, strokeMm: 78.8, valvesPerCylinder: 2, camshaftTypeId: 'cam-sohc', intendedOrientation: 'Trasversale' }) },
    { group: 3, label: '3c. Fiat 500 + 1.4 T-Jet Abarth 695', chassisId: 5, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 72, strokeMm: 84, turboType: 'SingleScroll', turboPosition: 'Front', turboArRatio: 0.55, intendedOrientation: 'Trasversale' }) },
    // Gruppo 4: Golf Mk1 (#3)
    { group: 4, label: '4a. Golf Mk1 + 1.1 EA111 I4', chassisId: 3, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 69.5, strokeMm: 72, valvesPerCylinder: 2, camshaftTypeId: 'cam-sohc', intendedOrientation: 'Trasversale' }) },
    { group: 4, label: '4b. Golf Mk1 + 1.6 GTI SOHC', chassisId: 3, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 79.5, strokeMm: 80, valvesPerCylinder: 2, camshaftTypeId: 'cam-sohc', intendedOrientation: 'Trasversale' }) },
    { group: 4, label: '4c. Golf Mk1 + 1.8 GTI SOHC', chassisId: 3, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 81, strokeMm: 86.4, valvesPerCylinder: 2, camshaftTypeId: 'cam-sohc', intendedOrientation: 'Trasversale' }) },
    { group: 4, label: '4d. Golf Mk1 + 1.6 D Diesel', chassisId: 3, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 76.5, strokeMm: 86.4, valvesPerCylinder: 2, camshaftTypeId: 'cam-sohc', intendedOrientation: 'Trasversale' }) },
    // Gruppo 5: Golf Mk5 (#11) & Golf Mk7 (#12)
    { group: 5, label: '5a. Golf Mk7 + 1.4 TSI EA211', chassisId: 12, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 74.5, strokeMm: 80, turboType: 'SingleScroll', turboPosition: 'Front', intendedOrientation: 'Trasversale' }) },
    { group: 5, label: '5b. Golf Mk7 + 2.0 TSI EA888', chassisId: 12, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 82.5, strokeMm: 92.8, turboType: 'SingleScroll', turboPosition: 'Front', intendedOrientation: 'Trasversale' }) },
    { group: 5, label: '5c. Golf Mk7 + 2.0 TDI Diesel', chassisId: 12, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 81, strokeMm: 95.5, turboType: 'VGT', turboPosition: 'Front', intendedOrientation: 'Trasversale' }) },
    { group: 5, label: '5d. Golf Mk5 + 3.2 VR6 (V6 15deg)', chassisId: 11, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 6, bankAngleDeg: 15, boreMm: 84, strokeMm: 95.9, intendedOrientation: 'Trasversale' }) },
    // Gruppo 6: Fiesta Mk7 (#6) & Clio V (#8)
    { group: 6, label: '6a. Fiesta Mk7 + 1.0 EcoBoost I3', chassisId: 6, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 3, boreMm: 71.9, strokeMm: 82, turboType: 'SingleScroll', turboPosition: 'Front', turboArRatio: 0.40, intendedOrientation: 'Trasversale' }) },
    { group: 6, label: '6b. Fiesta Mk7 + 1.6 Ti-VCT NA', chassisId: 6, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 79, strokeMm: 81.4, intendedOrientation: 'Trasversale' }) },
    { group: 6, label: '6c. Fiesta Mk7 + 1.6 EcoBoost ST', chassisId: 6, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 79, strokeMm: 81.4, turboType: 'SingleScroll', turboPosition: 'Front', intendedOrientation: 'Trasversale' }) },
    { group: 6, label: '6d. Clio V + 1.3 TCe I4 Turbo', chassisId: 8, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 72.2, strokeMm: 81.4, turboType: 'SingleScroll', turboPosition: 'Front', intendedOrientation: 'Trasversale' }) },
    // Gruppo 7: BMW E36 (#9), E46 (#10), G20 (#16)
    { group: 7, label: '7a. BMW E36 + 1.8 I4 M43', chassisId: 9, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 84, strokeMm: 81, valvesPerCylinder: 2, camshaftTypeId: 'cam-sohc', intendedOrientation: 'Longitudinale' }) },
    { group: 7, label: '7b. BMW E36 + 3.2 I6 S50B32 M3', chassisId: 9, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 6, boreMm: 86.4, strokeMm: 91, intendedOrientation: 'Longitudinale' }) },
    { group: 7, label: '7c. BMW E46 + 3.2 I6 S54B32 M3', chassisId: 10, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 6, boreMm: 87, strokeMm: 91, intendedOrientation: 'Longitudinale' }) },
    { group: 7, label: '7d. BMW E46 + 4.0 V8 S65 NA', chassisId: 10, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 8, bankAngleDeg: 90, boreMm: 92, strokeMm: 75.2, intendedOrientation: 'Longitudinale' }) },
    { group: 7, label: '7e. BMW G20 + 2.0 I4 B48 Turbo', chassisId: 16, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 82, strokeMm: 94.6, turboType: 'TwinScroll', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    { group: 7, label: '7f. BMW G20 + 3.0 I6 B58/S58', chassisId: 16, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 6, boreMm: 84, strokeMm: 90, turboType: 'TwinScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    { group: 7, label: '7g. BMW G20 + 3.0 I6 B57 Diesel', chassisId: 16, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 6, boreMm: 84, strokeMm: 90, turboType: 'VGT', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    // Gruppo 8: Alfa Giulia (#17)
    { group: 8, label: '8a. Giulia + 2.0 Turbo GME I4', chassisId: 17, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 84, strokeMm: 90, turboType: 'TwinScroll', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    { group: 8, label: '8b. Giulia + 2.2 JTDm Diesel I4', chassisId: 17, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 83, strokeMm: 99, turboType: 'VGT', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    { group: 8, label: '8c. Giulia QV + 2.9 V6 90deg Biturbo', chassisId: 17, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 6, bankAngleDeg: 90, boreMm: 86.5, strokeMm: 82, turboType: 'TwinScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    // Gruppo 9: Classe S W223 (#18)
    { group: 9, label: '9a. Classe S W223 + 3.0 I6 M256', chassisId: 18, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 6, boreMm: 83, strokeMm: 92.4, turboType: 'SingleScroll', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    { group: 9, label: '9b. Classe S W223 + 4.0 V8 Biturbo', chassisId: 18, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 8, bankAngleDeg: 90, boreMm: 83, strokeMm: 92, turboType: 'TwinScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'HotV', intendedOrientation: 'Longitudinale' }) },
    { group: 9, label: '9c. Classe S W223 + 6.0 V12 Biturbo', chassisId: 18, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 12, bankAngleDeg: 60, boreMm: 82.6, strokeMm: 93, turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    // Gruppo 10: Wrangler JL (#23), Defender 110 (#21), Pajero V20 (#22)
    { group: 10, label: '10a. Wrangler JL + 3.6 V6 Pentastar', chassisId: 23, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 6, bankAngleDeg: 60, boreMm: 96, strokeMm: 83, intendedOrientation: 'Longitudinale' }) },
    { group: 10, label: '10b. Wrangler JL + 6.4 V8 Hemi OHV', chassisId: 23, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 8, bankAngleDeg: 90, boreMm: 103.9, strokeMm: 94.5, valvesPerCylinder: 2, camshaftTypeId: 'cam-ohv', intendedOrientation: 'Longitudinale' }) },
    { group: 10, label: '10c. Defender 110 + 2.0 I4 Ingenium', chassisId: 21, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 83, strokeMm: 92.3, turboType: 'TwinScroll', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    { group: 10, label: '10d. Defender 110 + 3.0 I6 Ingenium', chassisId: 21, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 6, boreMm: 83, strokeMm: 92.3, turboType: 'TwinScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    { group: 10, label: '10e. Defender 110 + 5.0 V8 Superch.', chassisId: 21, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 8, bankAngleDeg: 90, boreMm: 92.5, strokeMm: 93, turboType: 'Supercharger', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    { group: 10, label: '10f. Pajero V20 + 2.8 TD 4M40 I4', chassisId: 22, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 95, strokeMm: 100, turboType: 'SingleScroll', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    { group: 10, label: '10g. Pajero V20 + 3.5 V6 6G74', chassisId: 22, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 6, bankAngleDeg: 60, boreMm: 93, strokeMm: 85.8, intendedOrientation: 'Longitudinale' }) },
    // Gruppo 11: Classe G W463A (#24)
    { group: 11, label: '11a. Classe G W463A + 3.0 I6 OM656', chassisId: 24, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 6, boreMm: 82, strokeMm: 92.3, turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    { group: 11, label: '11b. Classe G W463A + 4.0 V8 Biturbo', chassisId: 24, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 8, bankAngleDeg: 90, boreMm: 83, strokeMm: 92, turboType: 'TwinScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'HotV', intendedOrientation: 'Longitudinale' }) },
    // Gruppo 12: Lotus Elise / Exige (#26)
    { group: 12, label: '12a. Lotus Elise + 1.8 I4 NA', chassisId: 26, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 82, strokeMm: 85, intendedOrientation: 'Trasversale' }) },
    { group: 12, label: '12b. Lotus Elise + 1.8 I4 Superch.', chassisId: 26, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 82, strokeMm: 85, turboType: 'Supercharger', turboPosition: 'Front', intendedOrientation: 'Trasversale' }) },
    { group: 12, label: '12c. Lotus Elise + 3.5 V6 60deg 2GR-FE', chassisId: 26, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 6, bankAngleDeg: 60, boreMm: 94, strokeMm: 83, intendedOrientation: 'Trasversale' }) },
    // Gruppo 13: Alfa 4C (#33)
    { group: 13, label: '13. Alfa 4C + 1.750 TBi I4 Turbo', chassisId: 33, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Inline', cylinders: 4, boreMm: 83, strokeMm: 80.5, turboType: 'SingleScroll', turboPosition: 'Front', intendedOrientation: 'Trasversale' }) },
    // Gruppo 14: Honda NSX NA1 (#25)
    { group: 14, label: '14a. Honda NSX NA1 + 3.0 V6 90deg NA', chassisId: 25, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 6, bankAngleDeg: 90, boreMm: 90, strokeMm: 78, intendedOrientation: 'Trasversale' }) },
    { group: 14, label: '14b. Honda NSX NA2 + 3.2 V6 90deg NA', chassisId: 25, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 6, bankAngleDeg: 90, boreMm: 93, strokeMm: 78, intendedOrientation: 'Trasversale' }) },
    // Gruppo 15: Porsche 911 (992) (#30)
    { group: 15, label: '15a. Porsche 911 (992) + 3.0 B6 Biturbo', chassisId: 30, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Boxer', cylinders: 6, boreMm: 91, strokeMm: 76.4, turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    { group: 15, label: '15b. Porsche 911 (992) + 3.8 B6 Turbo S', chassisId: 30, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Boxer', cylinders: 6, boreMm: 102, strokeMm: 76.4, turboType: 'VGT', turboCountConfig: 'TwinTurbo', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    { group: 15, label: '15c. Porsche 911 (992) + 4.0 B6 GT3 NA', chassisId: 30, expectedCompatible: true, engine: makePistonForBay({ architecture: 'Boxer', cylinders: 6, boreMm: 102, strokeMm: 81.5, intendedOrientation: 'Longitudinale' }) },
    // Gruppo 16: Ferrari 360 (#28), 458/488 (#29)
    { group: 16, label: '16a. Ferrari 360 + 3.6 V8 F131 NA', chassisId: 28, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 8, bankAngleDeg: 90, boreMm: 85, strokeMm: 79, intendedOrientation: 'Longitudinale' }) },
    { group: 16, label: '16b. Ferrari 458 + 4.5 V8 F136 NA', chassisId: 29, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 8, bankAngleDeg: 90, boreMm: 94, strokeMm: 81, intendedOrientation: 'Longitudinale' }) },
    { group: 16, label: '16c. Ferrari 488 + 3.9 V8 F154 Biturbo', chassisId: 29, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 8, bankAngleDeg: 90, boreMm: 86.5, strokeMm: 83, turboType: 'TwinScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    // Gruppo 17: McLaren 720S (#34)
    { group: 17, label: '17. McLaren 720S + 4.0 V8 M840T Biturbo', chassisId: 34, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 8, bankAngleDeg: 90, boreMm: 93, strokeMm: 73.5, turboType: 'TwinScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    // Gruppo 18: Audi R8/Huracan (#31)
    { group: 18, label: '18a. Audi R8 + 4.2 V8 FSI NA', chassisId: 31, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 8, bankAngleDeg: 90, boreMm: 84.5, strokeMm: 92.8, intendedOrientation: 'Longitudinale' }) },
    { group: 18, label: '18b. Audi R8/Huracan + 5.2 V10 90deg NA', chassisId: 31, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 10, bankAngleDeg: 90, boreMm: 84.5, strokeMm: 92.8, intendedOrientation: 'Longitudinale' }) },
    // Gruppo 19: Lamborghini Aventador / Murcielago (#35)
    { group: 19, label: '19a. Aventador + 6.5 V12 L539 NA', chassisId: 35, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 12, bankAngleDeg: 60, boreMm: 95, strokeMm: 76.4, intendedOrientation: 'Longitudinale' }) },
    { group: 19, label: '19b. Murcielago + 6.5 V12 Bizzarrini', chassisId: 35, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 12, bankAngleDeg: 60, boreMm: 88, strokeMm: 89, intendedOrientation: 'Longitudinale' }) },
    // Gruppo 20: Pagani Utopia (#36)
    { group: 20, label: '20. Pagani Utopia + 6.0 V12 60deg Biturbo', chassisId: 36, expectedCompatible: true, engine: makePistonForBay({ architecture: 'V', cylinders: 12, bankAngleDeg: 60, boreMm: 82.6, strokeMm: 93, turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    // 5 casi impossibili (tutti FAIL attesi)
    { group: 21, label: '21. Panda 141 + 6.5 V12 Lamborghini', chassisId: 1, expectedCompatible: false, engine: makePistonForBay({ architecture: 'V', cylinders: 12, bankAngleDeg: 60, boreMm: 88, strokeMm: 89, intendedOrientation: 'Longitudinale' }) },
    { group: 22, label: '22. Lotus Elise + 6.0 V12 Biturbo', chassisId: 26, expectedCompatible: false, engine: makePistonForBay({ architecture: 'V', cylinders: 12, bankAngleDeg: 60, boreMm: 82.6, strokeMm: 93, turboType: 'SingleScroll', turboCountConfig: 'TwinTurbo', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    { group: 23, label: '23. Fiat 500 + 3.0 I6 Trasversale', chassisId: 5, expectedCompatible: false, engine: makePistonForBay({ architecture: 'Inline', cylinders: 6, boreMm: 84, strokeMm: 90, intendedOrientation: 'Trasversale' }) },
    { group: 24, label: '24. Fiesta Mk7 + 8.0 W16 Quad-Turbo', chassisId: 6, expectedCompatible: false, engine: makePistonForBay({ architecture: 'W', cylinders: 16, bankAngleDeg: 90, boreMm: 86, strokeMm: 86, turboType: 'SingleScroll', turboCountConfig: 'QuadTurbo', turboPosition: 'Front', intendedOrientation: 'Longitudinale' }) },
    { group: 25, label: '25. Porsche 911 (992) + 6.5 V12 Post.', chassisId: 30, expectedCompatible: false, engine: makePistonForBay({ architecture: 'V', cylinders: 12, bankAngleDeg: 60, boreMm: 88, strokeMm: 89, intendedOrientation: 'Longitudinale' }) },
  ];

  const groupPass = new Map<number, boolean>();
  let realSubtestPass = 0;
  let realSubtestTotal = 0;
  let impossibleFail = 0;
  let impossibleTotal = 0;
  let p911V12MarginL = 0;
  let minRealMarginMm = Infinity;

  for (const t of bayTests) {
    const entry = metricsById.get(t.chassisId)!;
    const m = entry.res;
    const chs: ChassisEntity = {
      id: `bench-${t.chassisId}`,
      name: entry.c.name,
      codeName: 'BENCH',
      ownerSubBrandId: 'bench-sub',
      createdYear: entry.c.year,
      generationNumber: 1,
      taxonomy: m.taxonomy,
      overallDimensionsMm: entry.c.config.overallDimensionsMm,
      wheelbaseMm: entry.c.config.wheelbaseMm,
      frontTrackMm: entry.c.config.frontTrackMm,
      rearTrackMm: entry.c.config.rearTrackMm,
      groundClearanceMm: entry.c.config.groundClearanceMm,
      torsionalRigidityNmPerDeg: m.torsionalRigidityNmPerDeg,
      structuralSafetyScore: m.structuralSafetyScore,
      engineBayMaxDimensionsMm: m.engineBayMaxDimensionsMm,
      supportedEnginePositions: entry.c.config.supportedEnginePositions,
      supportedEngineOrientations: entry.c.config.supportedEngineOrientations,
      engineSetbackPercent: entry.c.config.engineSetbackPercent,
      supportedDrivetrains: m.resolvedDrivetrains,
      calculatedSegment: m.segmentInfo.segment,
      baseWeightKg: m.baseWeightKg,
      unitManufacturingCost: m.unitManufacturingCost,
      developmentCost: m.developmentCost,
    };
    const geom = calculatePistonGeometryAndDimensions(t.engine);
    const compat = evaluateEngineBayCompatibility(
      geom.dimensionsMm,
      t.engine.intendedOrientation,
      chs,
    );
    const matched = compat.isCompatible === t.expectedCompatible;
    const prevGrp = groupPass.get(t.group) ?? true;
    groupPass.set(t.group, prevGrp && matched);

    if (t.expectedCompatible) {
      realSubtestTotal++;
      if (compat.isCompatible) realSubtestPass++;
    } else {
      impossibleTotal++;
      if (!compat.isCompatible) impossibleFail++;
    }

    const e = compat.effectiveEngineInBayMm;
    const b = m.engineBayMaxDimensionsMm;
    const cl = compat.clearanceMm;
    if (t.expectedCompatible) {
      minRealMarginMm = Math.min(minRealMarginMm, cl.lengthMm, cl.widthMm, cl.heightMm);
    }
    if (t.group === 25) p911V12MarginL = cl.lengthMm;
    console.log(
      `${compat.isCompatible ? 'PASS' : 'FAIL'} (Atteso: ${t.expectedCompatible ? 'PASS' : 'FAIL'}) | ${t.label.padEnd(42)} | Eng: ${e.lengthMm}×${e.widthMm}×${e.heightMm} vs Bay: ${b.lengthMm}×${b.widthMm}×${b.heightMm} | Marg: ${cl.lengthMm}/${cl.widthMm}/${cl.heightMm}${compat.conflictReasons.length ? ' | ' + compat.conflictReasons.join('; ') : ''}`,
    );
  }

  const realGroupsPassed = Array.from({ length: 20 }, (_, i) => i + 1).filter((g) =>
    groupPass.get(g),
  ).length;
  const impossibleGroupsPassed = Array.from({ length: 5 }, (_, i) => i + 21).filter((g) =>
    groupPass.get(g),
  ).length;

  const slidersMonotonic =
    swReinf.dKg > 0 &&
    swReinf.dRig > 0 &&
    swReinf.dSaf > 0 &&
    swSaf.dKg > 0 &&
    swSaf.dRig > 0 &&
    swSaf.dSaf > 0 &&
    swLen.dKg > 0 &&
    swLen.dBayL > 0 &&
    swWb.dKg > 0 &&
    swWb.dRig < 0 &&
    swWb.dBayL > 0 &&
    swW.dKg > 0 &&
    swW.dRig > 0 &&
    swW.dBayW > 0 &&
    swH.dKg > 0 &&
    swH.dRig > 0 &&
    swH.dBayH > 0 &&
    swFt.dKg > 0 &&
    swFt.dBayW > 0 &&
    swRtAnt.dKg > 0 &&
    swRtAnt.dBayW === 0 &&
    swRtPost.dKg > 0 &&
    swRtPost.dBayW > 0;

  const frontMidTransv = resolveChassisLayoutRules({
    position: 'Anteriore-Centrale',
    orientation: 'Trasversale',
    engineSetbackPercent: 60,
    drivetrainMode: 'FWD_AWD_Ready',
    gearboxLayout: 'InBlockWithEngine',
  });
  const frontMidLong = resolveChassisLayoutRules({
    position: 'Anteriore-Centrale',
    orientation: 'Longitudinale',
    engineSetbackPercent: 60,
    drivetrainMode: 'RWD_Only',
    gearboxLayout: 'InBlockWithEngine',
  });

  console.log('\n=== CHECKLIST CERTIFICAZIONE FINALE ===');
  const checks: [string, boolean][] = [
    [`Peso BIW: ${outBiw10}/40 outlier > ±10.0% (atteso 0/40)`, outBiw10 === 0],
    [`Peso BIW: Media |Err| = ${meanBiw.toFixed(2)}% (atteso < 4.00%)`, meanBiw < 4.0],
    [`Rigidità Torsionale: ${outRig8}/40 outlier > ±8.0% (atteso 0/40)`, outRig8 === 0],
    [`Rigidità Torsionale: ${outRig12}/40 outlier > ±12.0% (atteso 0/40)`, outRig12 === 0],
    [`Rigidità Torsionale: Media |Err| = ${meanRig.toFixed(2)}% (atteso < 5.00%)`, meanRig < 5.0],
    [
      `Vano Motore Reali: ${realGroupsPassed}/20 coppie (${realSubtestPass}/${realSubtestTotal} sub-test, margine min=${minRealMarginMm} mm >= 10 mm) PASS`,
      realGroupsPassed === 20 &&
        realSubtestPass === realSubtestTotal &&
        realSubtestTotal >= 50 &&
        minRealMarginMm >= 10,
    ],
    [
      `Vano Motore Impossibili: ${impossibleFail}/${impossibleTotal} FAIL (${impossibleGroupsPassed}/5 corretti, 911+V12=${p911V12MarginL} mm)`,
      impossibleFail === 5 && impossibleGroupsPassed === 5 && p911V12MarginL <= -100,
    ],
    [
      `Layout Anteriore-Centrale: Trasversale->${frontMidTransv.nativePrimaryAxle}+AWD, Longitudinale->${frontMidLong.nativePrimaryAxle}`,
      frontMidTransv.nativePrimaryAxle === 'FWD' &&
        frontMidTransv.resolvedDrivetrains.includes('FWD') &&
        frontMidTransv.resolvedDrivetrains.includes('AWD') &&
        frontMidLong.nativePrimaryAxle === 'RWD',
    ],
    [
      `Controlli UI & Legge Passo monotona & Isolamento carreggiate`,
      allControlsActive && wbMonotonic && slidersMonotonic,
    ],
  ];

  let allOk = true;
  for (const [desc, ok] of checks) {
    console.log(`[${ok ? 'CERTIFICATO' : 'FALLITO'}] ${desc}`);
    if (!ok) allOk = false;
  }

  if (!allOk) {
    process.exit(1);
  }
}

runPlatformBaseline();
