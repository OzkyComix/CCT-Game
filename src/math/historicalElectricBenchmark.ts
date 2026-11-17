import {
  calculateBatteryPackMetrics,
  calculateSingleElectricMotorMetrics,
  simulateElectricHybridDyno,
} from './evHybridMath';
import {
  getRotorMaterialSpecsForMotorType,
  REFERENCE_HYBRID_ICE_ENGINES,
} from '../data/electricHybridData';
import type {
  ElectricHybridEngineConfigInput,
  ElectricMotorSpec,
  HybridSystemType,
} from '../types/gameTypes';

export interface ElectricBenchmarkCase {
  id: number;
  year: number;
  name: string;
  realTopologyNote: string;
  realVoltageV: number;
  realKw: number;
  realHp: number;
  realNm: number;
  realMaxRpm: number;
  realWeightKg: number;
  spec: ElectricMotorSpec;
}

export const HISTORICAL_ELECTRIC_BENCHMARKS: ElectricBenchmarkCase[] = [
  {
    id: 1,
    year: 2010,
    name: 'Nissan Leaf ZE0 (EM61)',
    realTopologyNote: 'PMSM radiale 400V',
    realVoltageV: 400,
    realKw: 80,
    realHp: 109,
    realNm: 280,
    realMaxRpm: 10390,
    realWeightKg: 58,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 210,
      rotorLengthMm: 160,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'RoundWireStandard',
      inverterPowerElectronics: 'Silicon_IGBT',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Economica',
      referenceClass: 'Normale',
      maxMotorRpm: 10390,
    },
  },
  {
    id: 2,
    year: 2019,
    name: 'Renault Zoe R135 (5AQ)',
    realTopologyNote: 'EESM rotore avvolto 400V',
    realVoltageV: 400,
    realKw: 100,
    realHp: 136,
    realNm: 245,
    realMaxRpm: 11500,
    realWeightKg: 62,
    spec: {
      electricMotorType: 'WoundRotorSync_EESM',
      statorDiameterMm: 210,
      rotorLengthMm: 165,
      voltageArchitecture: 400,
      coolingSystem: 'Air',
      statorWinding: 'RoundWireStandard',
      inverterPowerElectronics: 'Silicon_MOSFET',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'FerriteStandardCage',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Media',
      referenceClass: 'Normale',
      maxMotorRpm: 11500,
    },
  },
  {
    id: 3,
    year: 2020,
    name: 'Fiat 500e (GKN EDM)',
    realTopologyNote: 'PMSM radiale 400V',
    realVoltageV: 400,
    realKw: 87,
    realHp: 118,
    realNm: 220,
    realMaxRpm: 12000,
    realWeightKg: 55,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 200,
      rotorLengthMm: 140,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'RoundWireStandard',
      inverterPowerElectronics: 'Silicon_MOSFET',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Media',
      referenceClass: 'Normale',
      maxMotorRpm: 12000,
    },
  },
  {
    id: 4,
    year: 2020,
    name: 'VW ID.3 / ID.4 (APP310)',
    realTopologyNote: 'PMSM Hairpin 400V',
    realVoltageV: 400,
    realKw: 150,
    realHp: 204,
    realNm: 310,
    realMaxRpm: 16000,
    realWeightKg: 65,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 215,
      rotorLengthMm: 160,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'Silicon_MOSFET',
      rotorSleeveBearing: 'InconelSleeveHybrid',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Media',
      referenceClass: 'Normale',
      maxMotorRpm: 16000,
    },
  },
  {
    id: 5,
    year: 2024,
    name: 'VW ID.7 (APP550)',
    realTopologyNote: 'PMSM Hairpin 400V High-Torque',
    realVoltageV: 400,
    realKw: 210,
    realHp: 286,
    realNm: 545,
    realMaxRpm: 16000,
    realWeightKg: 75,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 250,
      rotorLengthMm: 190,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Premium',
      referenceClass: 'Sport',
      maxMotorRpm: 16000,
    },
  },
  {
    id: 6,
    year: 2021,
    name: 'BMW i4 M50 Post. (Gen5 eDrive)',
    realTopologyNote: 'EESM 400V raffr. liquido (Gen5 eDrive)',
    realVoltageV: 400,
    realKw: 230,
    realHp: 313,
    realNm: 365,
    realMaxRpm: 17000,
    realWeightKg: 72,
    spec: {
      electricMotorType: 'WoundRotorSync_EESM',
      statorDiameterMm: 225,
      rotorLengthMm: 180,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'InconelSleeveHybrid',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Premium',
      referenceClass: 'Sport',
      maxMotorRpm: 17000,
    },
  },
  {
    id: 7,
    year: 2012,
    name: 'Tesla Model S 85 (LDU Base)',
    realTopologyNote: 'Induzione ASM 400V rotore rame',
    realVoltageV: 400,
    realKw: 270,
    realHp: 367,
    realNm: 440,
    realMaxRpm: 15000,
    realWeightKg: 90,
    spec: {
      electricMotorType: 'InductionAsync',
      statorDiameterMm: 255,
      rotorLengthMm: 210,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'RoundWireStandard',
      inverterPowerElectronics: 'Silicon_MOSFET',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Premium',
      referenceClass: 'Sport',
      maxMotorRpm: 15000,
    },
  },
  {
    id: 8,
    year: 2018,
    name: 'Tesla Model 3 Perf. Post. (3D1/3D6)',
    realTopologyNote: 'IPM-SynRM 400V SiC',
    realVoltageV: 400,
    realKw: 235,
    realHp: 320,
    realNm: 450,
    realMaxRpm: 18000,
    realWeightKg: 68,
    spec: {
      electricMotorType: 'IPM_SynRM',
      statorDiameterMm: 235,
      rotorLengthMm: 175,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'InconelSleeveHybrid',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Premium',
      referenceClass: 'Sport',
      maxMotorRpm: 18000,
    },
  },
  {
    id: 9,
    year: 2019,
    name: 'Porsche Taycan Turbo S Post.',
    realTopologyNote: 'PMSM Hairpin SiC 800V',
    realVoltageV: 800,
    realKw: 335,
    realHp: 456,
    realNm: 550,
    realMaxRpm: 16000,
    realWeightKg: 82,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 240,
      rotorLengthMm: 200,
      voltageArchitecture: 800,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'InconelSleeveHybrid',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Lusso',
      referenceClass: 'Sport',
      maxMotorRpm: 16000,
    },
  },
  {
    id: 10,
    year: 2024,
    name: 'Hyundai Ioniq 5 N Post.',
    realTopologyNote: 'PMSM Hairpin 800V SiC 21k RPM',
    realVoltageV: 800,
    realKw: 303,
    realHp: 412,
    realNm: 390,
    realMaxRpm: 21000,
    realWeightKg: 74,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 205,
      rotorLengthMm: 180,
      voltageArchitecture: 800,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'CarbonPrepregCeramic',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'AcousticDampedActiveNVH',
      priceTier: 'Premium',
      referenceClass: 'Sport',
      maxMotorRpm: 21000,
    },
  },
  {
    id: 11,
    year: 2021,
    name: 'Tesla Model S Plaid Post. Singola (5D1)',
    realTopologyNote: 'PMSM Carbon-Sleeve 450V SiC',
    realVoltageV: 400,
    realKw: 355,
    realHp: 483,
    realNm: 480,
    realMaxRpm: 20000,
    realWeightKg: 55,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 195,
      rotorLengthMm: 185,
      voltageArchitecture: 400,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'Dual_SiC_GaN_Racing',
      rotorSleeveBearing: 'CarbonPrepregCeramic',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Lusso',
      referenceClass: 'Corsa',
      maxMotorRpm: 20000,
    },
  },
  {
    id: 12,
    year: 2023,
    name: 'Lucid Air Dream / Sapphire Singola',
    realTopologyNote: 'PMSM Microjet 900V SiC',
    realVoltageV: 1000,
    realKw: 500,
    realHp: 680,
    realNm: 900,
    realMaxRpm: 20000,
    realWeightKg: 45,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 270,
      rotorLengthMm: 145,
      voltageArchitecture: 1000,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'Dual_SiC_GaN_Racing',
      rotorSleeveBearing: 'CarbonPrepregCeramic',
      rotorMagnetMaterial: 'SamariumCobaltRacing',
      motorHousing: 'MagnesiumCarbonUltralight',
      priceTier: 'Lusso',
      referenceClass: 'Corsa',
      maxMotorRpm: 20000,
    },
  },
  {
    id: 13,
    year: 2022,
    name: 'Rimac Nevera Post. Singola',
    realTopologyNote: 'PMSM 800V SiC High-Torque',
    realVoltageV: 800,
    realKw: 450,
    realHp: 612,
    realNm: 900,
    realMaxRpm: 17000,
    realWeightKg: 68,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 265,
      rotorLengthMm: 210,
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'InconelSleeveHybrid',
      rotorMagnetMaterial: 'SamariumCobaltRacing',
      motorHousing: 'MagnesiumCarbonUltralight',
      priceTier: 'Lusso',
      referenceClass: 'Corsa',
      maxMotorRpm: 17000,
    },
  },
  {
    id: 14,
    year: 2022,
    name: 'YASA P400R / Ferrari 296 GTB MGU-K',
    realTopologyNote: 'Axial Flux 800V Pancake',
    realVoltageV: 800,
    realKw: 123,
    realHp: 167,
    realNm: 315,
    realMaxRpm: 8000,
    realWeightKg: 24,
    spec: {
      electricMotorType: 'AxialFlux',
      statorDiameterMm: 240,
      rotorLengthMm: 105,
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'MagnesiumCarbonUltralight',
      priceTier: 'Lusso',
      referenceClass: 'Sport',
      maxMotorRpm: 8000,
    },
  },
  {
    id: 15,
    year: 2019,
    name: 'YASA 750R (Axial Flux High Torque)',
    realTopologyNote: 'Axial Flux 800V 3.250 rpm',
    realVoltageV: 800,
    realKw: 200,
    realHp: 272,
    realNm: 790,
    realMaxRpm: 3250,
    realWeightKg: 37,
    spec: {
      electricMotorType: 'AxialFlux',
      statorDiameterMm: 320,
      rotorLengthMm: 115,
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'MagnesiumCarbonUltralight',
      priceTier: 'Lusso',
      referenceClass: 'Sport',
      maxMotorRpm: 3250,
    },
  },
  {
    id: 16,
    year: 2022,
    name: 'Koenigsegg Quark (Raxial Flux)',
    realTopologyNote: 'Raxial Flux 850V SiC',
    realVoltageV: 800,
    realKw: 250,
    realHp: 340,
    realNm: 600,
    realMaxRpm: 9000,
    realWeightKg: 30,
    spec: {
      electricMotorType: 'AxialFlux',
      statorDiameterMm: 290,
      rotorLengthMm: 85,
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'LitzRacingWire',
      inverterPowerElectronics: 'Dual_SiC_GaN_Racing',
      rotorSleeveBearing: 'InconelSleeveHybrid',
      rotorMagnetMaterial: 'SamariumCobaltRacing',
      motorHousing: 'MagnesiumCarbonUltralight',
      priceTier: 'Lusso',
      referenceClass: 'Corsa',
      maxMotorRpm: 9000,
    },
  },
  {
    id: 17,
    year: 2022,
    name: 'McMurtry Spéirling Singolo Motore',
    realTopologyNote: 'PMSM Race 800V SiC 22k RPM',
    realVoltageV: 800,
    realKw: 370,
    realHp: 503,
    realNm: 400,
    realMaxRpm: 22000,
    realWeightKg: 48,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 200,
      rotorLengthMm: 170,
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'LitzRacingWire',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'CarbonPrepregCeramic',
      rotorMagnetMaterial: 'SamariumCobaltRacing',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Lusso',
      referenceClass: 'Corsa',
      maxMotorRpm: 22000,
    },
  },
  {
    id: 18,
    year: 2014,
    name: 'Formula E Gen1 (McLaren MGU)',
    realTopologyNote: 'PMSM Race 700V 17.5k RPM',
    realVoltageV: 800,
    realKw: 200,
    realHp: 272,
    realNm: 150,
    realMaxRpm: 17500,
    realWeightKg: 26,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 150,
      rotorLengthMm: 130,
      voltageArchitecture: 800,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'LitzRacingWire',
      inverterPowerElectronics: 'Silicon_MOSFET',
      rotorSleeveBearing: 'InconelSleeveHybrid',
      rotorMagnetMaterial: 'SamariumCobaltRacing',
      motorHousing: 'MagnesiumCarbonUltralight',
      priceTier: 'Lusso',
      referenceClass: 'Corsa',
      maxMotorRpm: 17500,
    },
  },
  {
    id: 19,
    year: 2018,
    name: 'Formula E Gen2 (BMW/Nissan MGU)',
    realTopologyNote: 'PMSM Race 800V SiC 20k RPM',
    realVoltageV: 800,
    realKw: 250,
    realHp: 340,
    realNm: 220,
    realMaxRpm: 20000,
    realWeightKg: 25,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 175,
      rotorLengthMm: 120,
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'LitzRacingWire',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'CarbonPrepregCeramic',
      rotorMagnetMaterial: 'SamariumCobaltRacing',
      motorHousing: 'MagnesiumCarbonUltralight',
      priceTier: 'Lusso',
      referenceClass: 'Corsa',
      maxMotorRpm: 20000,
    },
  },
  {
    id: 20,
    year: 2023,
    name: 'Formula E Gen3 Post. (900V SiC)',
    realTopologyNote: 'PMSM Race 900V SiC 22k RPM',
    realVoltageV: 1000,
    realKw: 350,
    realHp: 476,
    realNm: 280,
    realMaxRpm: 22000,
    realWeightKg: 23,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 180,
      rotorLengthMm: 115,
      voltageArchitecture: 1000,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'LitzRacingWire',
      inverterPowerElectronics: 'Dual_SiC_GaN_Racing',
      rotorSleeveBearing: 'CarbonPrepregCeramic',
      rotorMagnetMaterial: 'SamariumCobaltRacing',
      motorHousing: 'MagnesiumCarbonUltralight',
      priceTier: 'Lusso',
      referenceClass: 'Corsa',
      maxMotorRpm: 22000,
    },
  },
  // === A) Asincroni a Induzione (InductionAsync — #21..#27) ===
  {
    id: 21,
    year: 1996,
    name: 'GM EV1 Gen1 (Delco Remy IM)',
    realTopologyNote: 'ASM 400V Gabbia Alluminio',
    realVoltageV: 400,
    realKw: 102,
    realHp: 139,
    realNm: 150,
    realMaxRpm: 13000,
    realWeightKg: 65,
    spec: {
      electricMotorType: 'InductionAsync',
      statorDiameterMm: 215,
      rotorLengthMm: 145,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'RoundWireStandard',
      inverterPowerElectronics: 'Silicon_IGBT',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'FerriteStandardCage',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Economica',
      referenceClass: 'Normale',
      maxMotorRpm: 13000,
    },
  },
  {
    id: 22,
    year: 2010,
    name: 'Tesla Roadster 2.5 Sport (IM)',
    realTopologyNote: 'ASM Air-Cooled 400V Rame Brasato',
    realVoltageV: 400,
    realKw: 215,
    realHp: 292,
    realNm: 400,
    realMaxRpm: 14000,
    realWeightKg: 52,
    spec: {
      electricMotorType: 'InductionAsync',
      statorDiameterMm: 235,
      rotorLengthMm: 185,
      voltageArchitecture: 400,
      coolingSystem: 'Air',
      statorWinding: 'RoundWireStandard',
      inverterPowerElectronics: 'Silicon_IGBT',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Premium',
      referenceClass: 'Sport',
      maxMotorRpm: 14000,
    },
  },
  {
    id: 23,
    year: 2012,
    name: 'Toyota RAV4 EV Gen2 / B250e (M65)',
    realTopologyNote: 'ASM 400V Gabbia Rame',
    realVoltageV: 400,
    realKw: 115,
    realHp: 156,
    realNm: 296,
    realMaxRpm: 12500,
    realWeightKg: 68,
    spec: {
      electricMotorType: 'InductionAsync',
      statorDiameterMm: 265,
      rotorLengthMm: 125,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'RoundWireStandard',
      inverterPowerElectronics: 'Silicon_IGBT',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Media',
      referenceClass: 'Normale',
      maxMotorRpm: 12500,
    },
  },
  {
    id: 24,
    year: 2015,
    name: 'Tesla Model S P85D / P100D Post.',
    realTopologyNote: 'ASM LDU High-Current Rame-Ag',
    realVoltageV: 400,
    realKw: 375,
    realHp: 510,
    realNm: 660,
    realMaxRpm: 16000,
    realWeightKg: 95,
    spec: {
      electricMotorType: 'InductionAsync',
      statorDiameterMm: 295,
      rotorLengthMm: 180,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'RoundWireStandard',
      inverterPowerElectronics: 'Silicon_MOSFET',
      rotorSleeveBearing: 'InconelSleeveHybrid',
      rotorMagnetMaterial: 'SamariumCobaltRacing',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Lusso',
      referenceClass: 'Sport',
      maxMotorRpm: 16000,
    },
  },
  {
    id: 25,
    year: 2019,
    name: 'Audi e-tron 55 Post. (APA320)',
    realTopologyNote: 'ASM 400V Hairpin Alluminio',
    realVoltageV: 400,
    realKw: 165,
    realHp: 224,
    realNm: 355,
    realMaxRpm: 15000,
    realWeightKg: 78,
    spec: {
      electricMotorType: 'InductionAsync',
      statorDiameterMm: 275,
      rotorLengthMm: 205,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'Silicon_MOSFET',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'FerriteStandardCage',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Premium',
      referenceClass: 'Normale',
      maxMotorRpm: 15000,
    },
  },
  {
    id: 26,
    year: 2019,
    name: 'Mercedes-Benz EQC 400 Singola',
    realTopologyNote: 'ASM 400V Valeo Siemens eATS',
    realVoltageV: 400,
    realKw: 150,
    realHp: 204,
    realNm: 380,
    realMaxRpm: 13500,
    realWeightKg: 74,
    spec: {
      electricMotorType: 'InductionAsync',
      statorDiameterMm: 245,
      rotorLengthMm: 190,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'Silicon_MOSFET',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Premium',
      referenceClass: 'Normale',
      maxMotorRpm: 13500,
    },
  },
  {
    id: 27,
    year: 2019,
    name: 'Tesla Model 3 / Y Ant. (3D3/3D7)',
    realTopologyNote: 'ASM 400V SiC Oil-Cooled 18k',
    realVoltageV: 400,
    realKw: 158,
    realHp: 215,
    realNm: 240,
    realMaxRpm: 18000,
    realWeightKg: 56,
    spec: {
      electricMotorType: 'InductionAsync',
      statorDiameterMm: 210,
      rotorLengthMm: 135,
      voltageArchitecture: 400,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'InconelSleeveHybrid',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Premium',
      referenceClass: 'Sport',
      maxMotorRpm: 18000,
    },
  },
  // === B) Sincroni a Rotore Avvolto (WoundRotorSync_EESM — #28..#33) ===
  {
    id: 28,
    year: 2013,
    name: 'Renault Zoe Q210 / R90 (5AM)',
    realTopologyNote: 'EESM 400V Air Spazzole Std',
    realVoltageV: 400,
    realKw: 68,
    realHp: 92,
    realNm: 220,
    realMaxRpm: 10500,
    realWeightKg: 59,
    spec: {
      electricMotorType: 'WoundRotorSync_EESM',
      statorDiameterMm: 215,
      rotorLengthMm: 135,
      voltageArchitecture: 400,
      coolingSystem: 'Air',
      statorWinding: 'RoundWireStandard',
      inverterPowerElectronics: 'Silicon_IGBT',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'FerriteStandardCage',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Economica',
      referenceClass: 'Normale',
      maxMotorRpm: 10500,
    },
  },
  {
    id: 29,
    year: 2022,
    name: 'Renault Mégane E-Tech EV60 (6AK)',
    realTopologyNote: 'EESM 400V Direct Oil-Cooled',
    realVoltageV: 400,
    realKw: 160,
    realHp: 218,
    realNm: 300,
    realMaxRpm: 14000,
    realWeightKg: 60,
    spec: {
      electricMotorType: 'WoundRotorSync_EESM',
      statorDiameterMm: 220,
      rotorLengthMm: 140,
      voltageArchitecture: 400,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'Silicon_MOSFET',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Media',
      referenceClass: 'Normale',
      maxMotorRpm: 14000,
    },
  },
  {
    id: 30,
    year: 2022,
    name: 'Nissan Ariya / Scénic E-Tech (AM67)',
    realTopologyNote: 'EESM 400V Rotore HD Rame',
    realVoltageV: 400,
    realKw: 160,
    realHp: 218,
    realNm: 300,
    realMaxRpm: 14500,
    realWeightKg: 63,
    spec: {
      electricMotorType: 'WoundRotorSync_EESM',
      statorDiameterMm: 215,
      rotorLengthMm: 175,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'Silicon_MOSFET',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Media',
      referenceClass: 'Normale',
      maxMotorRpm: 14500,
    },
  },
  {
    id: 31,
    year: 2020,
    name: 'BMW iX3 G08 (Gen5 eDrive 210kW)',
    realTopologyNote: 'EESM 400V Gen5 210kW',
    realVoltageV: 400,
    realKw: 210,
    realHp: 286,
    realNm: 400,
    realMaxRpm: 16000,
    realWeightKg: 70,
    spec: {
      electricMotorType: 'WoundRotorSync_EESM',
      statorDiameterMm: 215,
      rotorLengthMm: 235,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'Silicon_MOSFET',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Premium',
      referenceClass: 'Normale',
      maxMotorRpm: 16000,
    },
  },
  {
    id: 32,
    year: 2022,
    name: 'BMW iX M60 / i7 M70 Post. (Gen5)',
    realTopologyNote: 'EESM 400V 6-Phase SiC Gen5',
    realVoltageV: 400,
    realKw: 360,
    realHp: 489,
    realNm: 650,
    realMaxRpm: 17000,
    realWeightKg: 86,
    spec: {
      electricMotorType: 'WoundRotorSync_EESM',
      statorDiameterMm: 250,
      rotorLengthMm: 220,
      voltageArchitecture: 400,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'InconelSleeveHybrid',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Lusso',
      referenceClass: 'Sport',
      maxMotorRpm: 17000,
    },
  },
  {
    id: 33,
    year: 2025,
    name: 'BMW Neue Klasse Gen6 800V (EESM)',
    realTopologyNote: 'EESM 800V Eccitatore Brushless',
    realVoltageV: 800,
    realKw: 300,
    realHp: 408,
    realNm: 500,
    realMaxRpm: 18000,
    realWeightKg: 66,
    spec: {
      electricMotorType: 'WoundRotorSync_EESM',
      statorDiameterMm: 255,
      rotorLengthMm: 130,
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'InconelSleeveHybrid',
      rotorMagnetMaterial: 'SamariumCobaltRacing',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Premium',
      referenceClass: 'Sport',
      maxMotorRpm: 18000,
    },
  },
  // === C) Sincroni a Magneti Permanenti Radiali (PermanentMagnetSync — #34..#44) ===
  {
    id: 34,
    year: 2009,
    name: 'Mitsubishi i-MiEV (Meidensha Y4F1)',
    realTopologyNote: 'PMSM 400V Compact Kei',
    realVoltageV: 400,
    realKw: 49,
    realHp: 67,
    realNm: 180,
    realMaxRpm: 8500,
    realWeightKg: 48,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 215,
      rotorLengthMm: 95,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'RoundWireStandard',
      inverterPowerElectronics: 'Silicon_IGBT',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Economica',
      referenceClass: 'Normale',
      maxMotorRpm: 8500,
    },
  },
  {
    id: 35,
    year: 2017,
    name: 'VW e-Golf 35.8 kWh (APP290)',
    realTopologyNote: 'PMSM 400V EEM85',
    realVoltageV: 400,
    realKw: 100,
    realHp: 136,
    realNm: 290,
    realMaxRpm: 12000,
    realWeightKg: 57,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 185,
      rotorLengthMm: 220,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'RoundWireStandard',
      inverterPowerElectronics: 'Silicon_IGBT',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Media',
      referenceClass: 'Normale',
      maxMotorRpm: 12000,
    },
  },
  {
    id: 36,
    year: 2019,
    name: 'Peugeot e-208 / Corsa-e (EMR3)',
    realTopologyNote: 'PMSM 400V Vitesco EMR3',
    realVoltageV: 400,
    realKw: 100,
    realHp: 136,
    realNm: 260,
    realMaxRpm: 14000,
    realWeightKg: 54,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 200,
      rotorLengthMm: 165,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'RoundWireStandard',
      inverterPowerElectronics: 'Silicon_MOSFET',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Media',
      referenceClass: 'Normale',
      maxMotorRpm: 14000,
    },
  },
  {
    id: 37,
    year: 2024,
    name: 'Peugeot e-3008 / Junior Veloce (M4)',
    realTopologyNote: 'PMSM 400V SiC Emotors M4',
    realVoltageV: 400,
    realKw: 207,
    realHp: 281,
    realNm: 345,
    realMaxRpm: 16000,
    realWeightKg: 60,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 190,
      rotorLengthMm: 235,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Premium',
      referenceClass: 'Sport',
      maxMotorRpm: 16000,
    },
  },
  {
    id: 38,
    year: 2018,
    name: 'Hyundai Kona Electric 64kWh (EM15)',
    realTopologyNote: 'PMSM 400V Mobis High-Torque',
    realVoltageV: 400,
    realKw: 150,
    realHp: 204,
    realNm: 395,
    realMaxRpm: 10500,
    realWeightKg: 66,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 235,
      rotorLengthMm: 180,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'Silicon_MOSFET',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Media',
      referenceClass: 'Normale',
      maxMotorRpm: 10500,
    },
  },
  {
    id: 39,
    year: 2020,
    name: 'Polestar 2 / XC40 Singola (EAD3.1)',
    realTopologyNote: 'PMSM 400V Hairpin Valeo',
    realVoltageV: 400,
    realKw: 150,
    realHp: 204,
    realNm: 330,
    realMaxRpm: 14000,
    realWeightKg: 64,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 215,
      rotorLengthMm: 185,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'Silicon_MOSFET',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Media',
      referenceClass: 'Normale',
      maxMotorRpm: 14000,
    },
  },
  {
    id: 40,
    year: 2021,
    name: 'Mercedes-Benz EQS 580 Post. (eATS)',
    realTopologyNote: 'PMSM 400V 6-Phase SiC',
    realVoltageV: 400,
    realKw: 255,
    realHp: 347,
    realNm: 568,
    realMaxRpm: 13500,
    realWeightKg: 80,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 235,
      rotorLengthMm: 235,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Lusso',
      referenceClass: 'Sport',
      maxMotorRpm: 13500,
    },
  },
  {
    id: 41,
    year: 2024,
    name: 'Porsche Macan Turbo EV Post. (PPE)',
    realTopologyNote: 'PMSM 800V SiC Oil-Cooled',
    realVoltageV: 800,
    realKw: 350,
    realHp: 476,
    realNm: 650,
    realMaxRpm: 16000,
    realWeightKg: 79,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 250,
      rotorLengthMm: 190,
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'InconelSleeveHybrid',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Lusso',
      referenceClass: 'Sport',
      maxMotorRpm: 16000,
    },
  },
  {
    id: 42,
    year: 2024,
    name: 'Porsche Taycan Turbo GT Post. (J1.2)',
    realTopologyNote: 'PMSM 800V 900A Pulse SiC',
    realVoltageV: 800,
    realKw: 560,
    realHp: 761,
    realNm: 850,
    realMaxRpm: 16500,
    realWeightKg: 81,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 230,
      rotorLengthMm: 215,
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'Dual_SiC_GaN_Racing',
      rotorSleeveBearing: 'InconelSleeveHybrid',
      rotorMagnetMaterial: 'SamariumCobaltRacing',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Lusso',
      referenceClass: 'Corsa',
      maxMotorRpm: 16500,
    },
  },
  {
    id: 43,
    year: 2023,
    name: 'Lotus Eletre R / Emeya R Post.',
    realTopologyNote: 'PMSM 800V TZ220XY SiC',
    realVoltageV: 800,
    realKw: 450,
    realHp: 612,
    realNm: 710,
    realMaxRpm: 16500,
    realWeightKg: 77,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 225,
      rotorLengthMm: 260,
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'InconelSleeveHybrid',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Lusso',
      referenceClass: 'Sport',
      maxMotorRpm: 16500,
    },
  },
  {
    id: 44,
    year: 2018,
    name: 'Porsche 919 Hybrid Evo MGU-K',
    realTopologyNote: 'PMSM LMP1 800V 22.5k Race',
    realVoltageV: 800,
    realKw: 324,
    realHp: 440,
    realNm: 250,
    realMaxRpm: 22500,
    realWeightKg: 27,
    spec: {
      electricMotorType: 'PermanentMagnetSync',
      statorDiameterMm: 165,
      rotorLengthMm: 125,
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'LitzRacingWire',
      inverterPowerElectronics: 'Dual_SiC_GaN_Racing',
      rotorSleeveBearing: 'CarbonPrepregCeramic',
      rotorMagnetMaterial: 'SamariumCobaltRacing',
      motorHousing: 'MagnesiumCarbonUltralight',
      priceTier: 'Lusso',
      referenceClass: 'Corsa',
      maxMotorRpm: 22500,
    },
  },
  // === D) Sincroni a Riluttanza Assistita (IPM_SynRM — #45..#53) ===
  {
    id: 45,
    year: 2018,
    name: 'BMW i3 120Ah (IB1P25B SynRM)',
    realTopologyNote: 'IPM-SynRM 400V Compact',
    realVoltageV: 400,
    realKw: 125,
    realHp: 170,
    realNm: 250,
    realMaxRpm: 11400,
    realWeightKg: 49,
    spec: {
      electricMotorType: 'IPM_SynRM',
      statorDiameterMm: 160,
      rotorLengthMm: 240,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'RoundWireStandard',
      inverterPowerElectronics: 'Silicon_IGBT',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Media',
      referenceClass: 'Normale',
      maxMotorRpm: 11400,
    },
  },
  {
    id: 46,
    year: 2017,
    name: 'Chevrolet Bolt EV / Ampera-e',
    realTopologyNote: 'IPM-SynRM 400V LG Bar-Wound',
    realVoltageV: 400,
    realKw: 150,
    realHp: 204,
    realNm: 360,
    realMaxRpm: 8810,
    realWeightKg: 67,
    spec: {
      electricMotorType: 'IPM_SynRM',
      statorDiameterMm: 215,
      rotorLengthMm: 190,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'Silicon_IGBT',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Economica',
      referenceClass: 'Normale',
      maxMotorRpm: 8810,
    },
  },
  {
    id: 47,
    year: 2019,
    name: 'Nissan Leaf e+ ZE1 (EM57 160kW)',
    realTopologyNote: 'IPM-SynRM 400V EM57',
    realVoltageV: 400,
    realKw: 160,
    realHp: 218,
    realNm: 340,
    realMaxRpm: 11330,
    realWeightKg: 63,
    spec: {
      electricMotorType: 'IPM_SynRM',
      statorDiameterMm: 195,
      rotorLengthMm: 230,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'RoundWireStandard',
      inverterPowerElectronics: 'Silicon_MOSFET',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Media',
      referenceClass: 'Normale',
      maxMotorRpm: 11330,
    },
  },
  {
    id: 48,
    year: 2018,
    name: 'Jaguar I-Pace EV400 Singola (GKN)',
    realTopologyNote: 'IPM-SynRM 400V Concentric',
    realVoltageV: 400,
    realKw: 147,
    realHp: 200,
    realNm: 348,
    realMaxRpm: 13000,
    realWeightKg: 56,
    spec: {
      electricMotorType: 'IPM_SynRM',
      statorDiameterMm: 235,
      rotorLengthMm: 145,
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'Silicon_MOSFET',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Premium',
      referenceClass: 'Normale',
      maxMotorRpm: 13000,
    },
  },
  {
    id: 49,
    year: 2021,
    name: 'Ford Mustang Mach-E GT Post. (iDM220)',
    realTopologyNote: 'IPM-SynRM 400V BorgWarner Oil',
    realVoltageV: 400,
    realKw: 210,
    realHp: 286,
    realNm: 430,
    realMaxRpm: 13800,
    realWeightKg: 70,
    spec: {
      electricMotorType: 'IPM_SynRM',
      statorDiameterMm: 220,
      rotorLengthMm: 200,
      voltageArchitecture: 400,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'Silicon_MOSFET',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Media',
      referenceClass: 'Normale',
      maxMotorRpm: 13800,
    },
  },
  {
    id: 50,
    year: 2022,
    name: 'Toyota bZ4X / Lexus RZ Ant. (1XM)',
    realTopologyNote: 'IPM-SynRM 400V SiC BluE Nexus',
    realVoltageV: 400,
    realKw: 150,
    realHp: 204,
    realNm: 266,
    realMaxRpm: 17000,
    realWeightKg: 58,
    spec: {
      electricMotorType: 'IPM_SynRM',
      statorDiameterMm: 225,
      rotorLengthMm: 105,
      voltageArchitecture: 400,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'InconelSleeveHybrid',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Premium',
      referenceClass: 'Normale',
      maxMotorRpm: 17000,
    },
  },
  {
    id: 51,
    year: 2023,
    name: 'Rivian R1T / R1S Enduro Singola',
    realTopologyNote: 'IPM-SynRM 400V Oil-Cooled SiC',
    realVoltageV: 400,
    realKw: 248,
    realHp: 337,
    realNm: 560,
    realMaxRpm: 14500,
    realWeightKg: 76,
    spec: {
      electricMotorType: 'IPM_SynRM',
      statorDiameterMm: 255,
      rotorLengthMm: 165,
      voltageArchitecture: 400,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Premium',
      referenceClass: 'Sport',
      maxMotorRpm: 14500,
    },
  },
  {
    id: 52,
    year: 2024,
    name: 'Tesla Model 3 Highland Perf. (4D2)',
    realTopologyNote: 'IPM-SynRM 400V 4D1/4D2 SiC',
    realVoltageV: 400,
    realKw: 265,
    realHp: 360,
    realNm: 480,
    realMaxRpm: 18500,
    realWeightKg: 66,
    spec: {
      electricMotorType: 'IPM_SynRM',
      statorDiameterMm: 240,
      rotorLengthMm: 150,
      voltageArchitecture: 400,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'InconelSleeveHybrid',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Premium',
      referenceClass: 'Sport',
      maxMotorRpm: 18500,
    },
  },
  {
    id: 53,
    year: 2024,
    name: 'Xiaomi SU7 Ultra HyperEngine V8s',
    realTopologyNote: 'IPM-SynRM 800V Carbon 24k+ RPM',
    realVoltageV: 800,
    realKw: 425,
    realHp: 578,
    realNm: 635,
    realMaxRpm: 24000,
    realWeightKg: 59,
    spec: {
      electricMotorType: 'IPM_SynRM',
      statorDiameterMm: 250,
      rotorLengthMm: 110,
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'Dual_SiC_GaN_Racing',
      rotorSleeveBearing: 'CarbonPrepregCeramic',
      rotorMagnetMaterial: 'SamariumCobaltRacing',
      motorHousing: 'DieCastAluminum',
      priceTier: 'Lusso',
      referenceClass: 'Corsa',
      maxMotorRpm: 24000,
    },
  },
  // === E) Flusso Assiale e Raxiale (AxialFlux — #54..#60) ===
  {
    id: 54,
    year: 2022,
    name: 'McLaren Artura E-Motor (Axial Flux)',
    realTopologyNote: 'Axial Flux 400V Pancake',
    realVoltageV: 400,
    realKw: 70,
    realHp: 95,
    realNm: 225,
    realMaxRpm: 7500,
    realWeightKg: 16,
    spec: {
      electricMotorType: 'AxialFlux',
      statorDiameterMm: 220,
      rotorLengthMm: 80,
      voltageArchitecture: 400,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumNdFeB',
      motorHousing: 'MagnesiumCarbonUltralight',
      priceTier: 'Premium',
      referenceClass: 'Sport',
      maxMotorRpm: 7500,
    },
  },
  {
    id: 55,
    year: 2019,
    name: 'Ferrari SF90 Stradale MGU-K (P400)',
    realTopologyNote: 'Axial Flux 800V YASA P400',
    realVoltageV: 800,
    realKw: 150,
    realHp: 204,
    realNm: 266,
    realMaxRpm: 9000,
    realWeightKg: 24,
    spec: {
      electricMotorType: 'AxialFlux',
      statorDiameterMm: 210,
      rotorLengthMm: 120,
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinFlat',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'MagnesiumCarbonUltralight',
      priceTier: 'Lusso',
      referenceClass: 'Sport',
      maxMotorRpm: 9000,
    },
  },
  {
    id: 56,
    year: 2023,
    name: 'Lamborghini Revuelto E-Axle Ant.',
    realTopologyNote: 'Axial Flux 400V YASA Front',
    realVoltageV: 400,
    realKw: 110,
    realHp: 150,
    realNm: 350,
    realMaxRpm: 7000,
    realWeightKg: 19,
    spec: {
      electricMotorType: 'AxialFlux',
      statorDiameterMm: 230,
      rotorLengthMm: 95,
      voltageArchitecture: 400,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'MagnesiumCarbonUltralight',
      priceTier: 'Lusso',
      referenceClass: 'Sport',
      maxMotorRpm: 7000,
    },
  },
  {
    id: 57,
    year: 2023,
    name: 'Mercedes-AMG C63 S E-Perf EDU',
    realTopologyNote: 'Axial Flux 400V AMG/YASA',
    realVoltageV: 400,
    realKw: 150,
    realHp: 204,
    realNm: 320,
    realMaxRpm: 8500,
    realWeightKg: 25,
    spec: {
      electricMotorType: 'AxialFlux',
      statorDiameterMm: 210,
      rotorLengthMm: 125,
      voltageArchitecture: 400,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'MagnesiumCarbonUltralight',
      priceTier: 'Lusso',
      referenceClass: 'Sport',
      maxMotorRpm: 8500,
    },
  },
  {
    id: 58,
    year: 2021,
    name: 'Magnax AXF225 (Yokeless Compact)',
    realTopologyNote: 'Axial Flux 800V D=225mm',
    realVoltageV: 800,
    realKw: 170,
    realHp: 231,
    realNm: 250,
    realMaxRpm: 11000,
    realWeightKg: 19,
    spec: {
      electricMotorType: 'AxialFlux',
      statorDiameterMm: 195,
      rotorLengthMm: 100,
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'InconelSleeveHybrid',
      rotorMagnetMaterial: 'NeodymiumDyUH',
      motorHousing: 'MagnesiumCarbonUltralight',
      priceTier: 'Lusso',
      referenceClass: 'Sport',
      maxMotorRpm: 11000,
    },
  },
  {
    id: 59,
    year: 2022,
    name: 'Magnax AXF290 (Yokeless Torque)',
    realTopologyNote: 'Axial Flux 800V D=290mm',
    realVoltageV: 800,
    realKw: 300,
    realHp: 408,
    realNm: 800,
    realMaxRpm: 6500,
    realWeightKg: 32,
    spec: {
      electricMotorType: 'AxialFlux',
      statorDiameterMm: 280,
      rotorLengthMm: 115,
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'HairpinContinuousMultiLayer',
      inverterPowerElectronics: 'SiliconCarbide_SiC',
      rotorSleeveBearing: 'SteelLaminationStandard',
      rotorMagnetMaterial: 'SamariumCobaltRacing',
      motorHousing: 'MagnesiumCarbonUltralight',
      priceTier: 'Lusso',
      referenceClass: 'Sport',
      maxMotorRpm: 6500,
    },
  },
  {
    id: 60,
    year: 2024,
    name: 'Mercedes-AMG Vision One-Eleven YASA',
    realTopologyNote: 'Axial Flux 800V Ultra Litz',
    realVoltageV: 800,
    realKw: 480,
    realHp: 653,
    realNm: 800,
    realMaxRpm: 10000,
    realWeightKg: 34,
    spec: {
      electricMotorType: 'AxialFlux',
      statorDiameterMm: 285,
      rotorLengthMm: 135,
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      statorWinding: 'LitzRacingWire',
      inverterPowerElectronics: 'Dual_SiC_GaN_Racing',
      rotorSleeveBearing: 'InconelSleeveHybrid',
      rotorMagnetMaterial: 'SamariumCobaltRacing',
      motorHousing: 'MagnesiumCarbonUltralight',
      priceTier: 'Lusso',
      referenceClass: 'Corsa',
      maxMotorRpm: 10000,
    },
  },
];

function runElectricDiagnostic() {
  let failures = 0;

  console.log('=== 1. DIAGNOSTICA SU 60 MOTORI ELETTRICI STORICI (1996-2025) ===');
  console.log(
    '| # | Anno | Topologia | Motore | Dim (DxL) | CV Sim vs Reale (Err%) | Nm Sim vs Reale (Err%) | RPM Max Sim / Reale (Corner) | Peso Sim / Reale (Diff%) |',
  );
  console.log('| :---: | :---: | :--- | :--- | :---: | :--- | :--- | :---: | :--- |');

  let sumAbsHp = 0;
  let sumSignedHp = 0;
  let sumAbsNm = 0;
  let sumSignedNm = 0;
  let sumAbsKg = 0;
  let sumAbsKgPct = 0;
  let outHp3 = 0;
  let outNm3 = 0;
  let outHp5 = 0;
  let outNm5 = 0;
  let outKg10 = 0;

  const byTopology = new Map<
    string,
    { n: number; sumHp: number; sumNm: number; sumKg: number; outHp5: number; outNm5: number; outKg10: number }
  >();

  for (const b of HISTORICAL_ELECTRIC_BENCHMARKS) {
    const sim = calculateSingleElectricMotorMetrics(b.spec);
    const errHp = ((sim.peakPowerHp - b.realHp) / b.realHp) * 100;
    const errNm = ((sim.peakTorqueNm - b.realNm) / b.realNm) * 100;
    const diffKg = sim.dryWeightKg - b.realWeightKg;
    const diffKgPct = (diffKg / b.realWeightKg) * 100;

    sumAbsHp += Math.abs(errHp);
    sumSignedHp += errHp;
    sumAbsNm += Math.abs(errNm);
    sumSignedNm += errNm;
    sumAbsKg += Math.abs(diffKg);
    sumAbsKgPct += Math.abs(diffKgPct);
    if (Math.abs(errHp) > 3.0) outHp3++;
    if (Math.abs(errNm) > 3.0) outNm3++;
    if (Math.abs(errHp) > 5.0) outHp5++;
    if (Math.abs(errNm) > 5.0) outNm5++;
    if (Math.abs(diffKgPct) > 10.0) outKg10++;

    const topo = b.spec.electricMotorType;
    const st = byTopology.get(topo) ?? {
      n: 0,
      sumHp: 0,
      sumNm: 0,
      sumKg: 0,
      outHp5: 0,
      outNm5: 0,
      outKg10: 0,
    };
    st.n++;
    st.sumHp += Math.abs(errHp);
    st.sumNm += Math.abs(errNm);
    st.sumKg += Math.abs(diffKgPct);
    if (Math.abs(errHp) > 5.0) st.outHp5++;
    if (Math.abs(errNm) > 5.0) st.outNm5++;
    if (Math.abs(diffKgPct) > 10.0) st.outKg10++;
    byTopology.set(topo, st);

    console.log(
      `| ${b.id} | ${b.year} | ${topo} | ${b.name} | ${b.spec.statorDiameterMm}x${b.spec.rotorLengthMm} | ${sim.peakPowerHp} vs ${b.realHp} (${errHp >= 0 ? '+' : ''}${errHp.toFixed(1)}%) | ${sim.peakTorqueNm} vs ${b.realNm} (${errNm >= 0 ? '+' : ''}${errNm.toFixed(1)}%) | ${sim.maxMotorRpm} / ${b.realMaxRpm} (FW ${sim.cornerSpeedRpm}) | ${sim.dryWeightKg} / ${b.realWeightKg} kg (${diffKg >= 0 ? '+' : ''}${diffKg} kg, ${diffKgPct >= 0 ? '+' : ''}${diffKgPct.toFixed(1)}%) |`,
    );
  }

  const n = HISTORICAL_ELECTRIC_BENCHMARKS.length;
  const meanHp = sumAbsHp / n;
  const meanNm = sumAbsNm / n;
  const meanKgPct = sumAbsKgPct / n;
  console.log(`\n=== RIEPILOGO DIAGNOSTICO GENERALE (${n} MOTORI) ===`);
  console.log(
    `CV: Media |Err| = ${meanHp.toFixed(2)}% (Media con segno = ${(sumSignedHp / n).toFixed(2)}%) | Outlier > ±3.0%: ${outHp3}/${n} | Outlier > ±5.0%: ${outHp5}/${n}`,
  );
  console.log(
    `Nm: Media |Err| = ${meanNm.toFixed(2)}% (Media con segno = ${(sumSignedNm / n).toFixed(2)}%) | Outlier > ±3.0%: ${outNm3}/${n} | Outlier > ±5.0%: ${outNm5}/${n}`,
  );
  console.log(
    `Peso: Media |Diff| = ${(sumAbsKg / n).toFixed(1)} kg (${meanKgPct.toFixed(2)}%) | Outlier > ±10.0%: ${outKg10}/${n}`,
  );
  console.log('\n=== BREAKDOWN PER TOPOLOGIA ===');
  for (const [topo, st] of byTopology.entries()) {
    console.log(
      `- ${topo} (${st.n}): |Err CV|=${(st.sumHp / st.n).toFixed(2)}% (out>5%: ${st.outHp5}/${st.n}) | |Err Nm|=${(st.sumNm / st.n).toFixed(2)}% (out>5%: ${st.outNm5}/${st.n}) | |Diff Peso|=${(st.sumKg / st.n).toFixed(2)}% (out>10%: ${st.outKg10}/${st.n})`,
    );
  }

  // 2A. Test Slider Geometrici e Limitatore 3000 -> 24000 RPM
  console.log('\n=== 2A. TEST SLIDER GEOMETRICI E LIMITATORE (0% -> 100%) ===');
  const baseSpec = HISTORICAL_ELECTRIC_BENCHMARKS[8].spec; // Taycan base
  const dsPowers: number[] = [];
  for (const pct of [0, 25, 50, 75, 100]) {
    const ds = Math.round(150 + (340 - 150) * (pct / 100));
    const s = calculateSingleElectricMotorMetrics({ ...baseSpec, statorDiameterMm: ds });
    dsPowers.push(s.peakPowerHp);
    console.log(
      `[Diametro Statore ${pct}% = ${ds}mm] -> ${s.peakPowerHp} CV, ${s.peakTorqueNm} Nm, FW=${s.cornerSpeedRpm} RPM, Peso=${s.dryWeightKg} kg`,
    );
  }
  const lrPowers: number[] = [];
  for (const pct of [0, 25, 50, 75, 100]) {
    const lr = Math.round(80 + (280 - 80) * (pct / 100));
    const s = calculateSingleElectricMotorMetrics({ ...baseSpec, rotorLengthMm: lr });
    lrPowers.push(s.peakPowerHp);
    console.log(
      `[Lunghezza Rotore ${pct}% = ${lr}mm] -> ${s.peakPowerHp} CV, ${s.peakTorqueNm} Nm, FW=${s.cornerSpeedRpm} RPM, Peso=${s.dryWeightKg} kg`,
    );
  }
  if (new Set(dsPowers).size < 4 || new Set(lrPowers).size < 5) {
    failures++;
    console.error('FAIL: Slider geometrici presentano zone morte!');
  }

  const rpmSweep = [3000, 8000, 14000, 18000, 20000, 24000];
  const rpmEffs: number[] = [];
  for (const rpmLim of rpmSweep) {
    const s = calculateSingleElectricMotorMetrics({
      ...baseSpec,
      rotorSleeveBearing: 'CarbonPrepregCeramic',
      maxMotorRpm: rpmLim,
    });
    rpmEffs.push(s.maxMotorRpm);
    console.log(
      `[maxMotorRpm=${rpmLim} PSM + CarbonPrepregCeramic] -> effective=${s.maxMotorRpm}, ${s.peakPowerHp} CV, ${s.peakTorqueNm} Nm, Rel=${s.reliabilityPercent}%`,
    );
  }
  const steelSafe = calculateSingleElectricMotorMetrics({
    ...baseSpec,
    rotorSleeveBearing: 'SteelLaminationStandard',
    maxMotorRpm: 16000,
  });
  const steelOver = calculateSingleElectricMotorMetrics({
    ...baseSpec,
    rotorSleeveBearing: 'SteelLaminationStandard',
    maxMotorRpm: 20000,
  });
  if (
    JSON.stringify(rpmEffs) !== JSON.stringify(rpmSweep) ||
    steelOver.maxMotorRpm !== 20000 ||
    steelOver.reliabilityPercent >= steelSafe.reliabilityPercent
  ) {
    failures++;
    console.error('FAIL: maxMotorRpm 3.000-24.000 o penalità centrifuga progressiva non coerente!');
  }

  // 2B. Test Tensione (Corner Speed Back-EMF vs Coppia)
  console.log('\n=== 2B. TEST BACK-EMF TENSIONE (400V vs 800V vs 1000V) ===');
  const v400 = calculateSingleElectricMotorMetrics({ ...baseSpec, voltageArchitecture: 400 });
  const v800 = calculateSingleElectricMotorMetrics({ ...baseSpec, voltageArchitecture: 800 });
  const v1000 = calculateSingleElectricMotorMetrics({ ...baseSpec, voltageArchitecture: 1000 });
  const csGain800To1000Pct = ((v1000.cornerSpeedRpm - v800.cornerSpeedRpm) / v800.cornerSpeedRpm) * 100;
  const hpGain800To1000Pct = ((v1000.peakPowerHp - v800.peakPowerHp) / v800.peakPowerHp) * 100;
  console.log(
    `400V: ${v400.peakPowerHp} CV / ${v400.peakTorqueNm} Nm @ FW ${v400.cornerSpeedRpm} RPM | 800V: ${v800.peakPowerHp} CV / ${v800.peakTorqueNm} Nm @ FW ${v800.cornerSpeedRpm} RPM | 1000V: ${v1000.peakPowerHp} CV / ${v1000.peakTorqueNm} Nm @ FW ${v1000.cornerSpeedRpm} RPM (+${csGain800To1000Pct.toFixed(1)}% FW, +${hpGain800To1000Pct.toFixed(1)}% CV vs 800V)`,
  );
  if (
    !(v400.cornerSpeedRpm < v800.cornerSpeedRpm && v800.cornerSpeedRpm < v1000.cornerSpeedRpm) ||
    v1000.cornerSpeedRpm < v800.cornerSpeedRpm * 1.10 ||
    v1000.peakPowerHp < v800.peakPowerHp * 1.10
  ) {
    failures++;
    console.error(
      'FAIL: Legge Back-EMF non monotona o sblocco 800V -> 1000V inferiore al +10% su Corner Speed / CV!',
    );
  }

  // 2C. Test Gearbox & GearRatio + Pacco Batteria + Inverter + Multi-Motore
  console.log('\n=== 2C. TEST GEARBOX, GEAR RATIO, BATTERIA E QUAD-MOTOR ===');
  const baseBench: ElectricHybridEngineConfigInput = {
    systemType: 'PureEV',
    electricMotorType: 'PermanentMagnetSync',
    motorLayout: 'SingleMotor_RWD',
    motorCount: 1,
    hasFrontDisconnect: false,
    statorDiameterMm: 285,
    rotorLengthMm: 135,
    batteryChemistry: 'NMC811',
    batteryCapacityKwh: 75,
    voltageArchitecture: 800,
    coolingSystem: 'LiquidGlycol',
    inverterTech: 'SiliconCarbide_SiC',
    statorWinding: 'HairpinFlat',
    inverterPowerElectronics: 'SiliconCarbide_SiC',
    rotorSleeveBearing: 'InconelSleeveHybrid',
    rotorMagnetMaterial: 'NeodymiumNdFeB',
    motorHousing: 'DieCastAluminum',
    packStructure: 'CellToPackCopper',
    bmsCalibration: 'RoadBalanced',
    underbodyShield: 'StandardSteelShield',
    gearboxType: 'SingleSpeedDirect',
    gearRatio: 9.0,
    maxMotorRpm: 18000,
    priceTier: 'Premium',
    referenceClass: 'Sport',
  };
  const gSingleLow = simulateElectricHybridDyno({
    ...baseBench,
    gearboxType: 'SingleSpeedDirect',
    gearRatio: 5.5,
  });
  const gSingleHigh = simulateElectricHybridDyno({
    ...baseBench,
    gearboxType: 'SingleSpeedDirect',
    gearRatio: 13.5,
  });
  const gTwoSpeed = simulateElectricHybridDyno({
    ...baseBench,
    gearboxType: 'TwoSpeedDualClutch',
    gearRatio: 5.5,
  });
  console.log(
    `Gearbox Single 5.5: Peso=${gSingleLow.dryWeightKg}kg, Costo=$${gSingleLow.unitProductionCost}, Consumo=${gSingleLow.specs.efficiencyKwhPer100Km}kWh/100km, Eff=${gSingleLow.thermalEfficiencyPercent}%, Spunto=${gSingleLow.effectiveWheelTorqueNm}Nm, Rel=${gSingleLow.reliabilityPercent}%`,
  );
  console.log(
    `Gearbox Single 13.5: Peso=${gSingleHigh.dryWeightKg}kg, Costo=$${gSingleHigh.unitProductionCost}, Consumo=${gSingleHigh.specs.efficiencyKwhPer100Km}kWh/100km, Eff=${gSingleHigh.thermalEfficiencyPercent}%, Spunto=${gSingleHigh.effectiveWheelTorqueNm}Nm, Rel=${gSingleHigh.reliabilityPercent}%`,
  );
  console.log(
    `Gearbox TwoSpeed 5.5: Peso=${gTwoSpeed.dryWeightKg}kg, Costo=$${gTwoSpeed.unitProductionCost}, Consumo=${gTwoSpeed.specs.efficiencyKwhPer100Km}kWh/100km, Eff=${gTwoSpeed.thermalEfficiencyPercent}%, Spunto=${gTwoSpeed.effectiveWheelTorqueNm}Nm, Rel=${gTwoSpeed.reliabilityPercent}%`,
  );
  if (
    gTwoSpeed.dryWeightKg !== gSingleLow.dryWeightKg + 18 ||
    gTwoSpeed.unitProductionCost !== gSingleLow.unitProductionCost + 420 ||
    (gTwoSpeed.specs.efficiencyKwhPer100Km ?? 0) >=
      (gSingleLow.specs.efficiencyKwhPer100Km ?? 0) ||
    (gSingleHigh.specs.efficiencyKwhPer100Km ?? 0) <=
      (gSingleLow.specs.efficiencyKwhPer100Km ?? 0) ||
    (gTwoSpeed.effectiveWheelTorqueNm ?? 0) <= (gSingleLow.effectiveWheelTorqueNm ?? 0)
  ) {
    failures++;
    console.error('FAIL: gearboxType o gearRatio non attivi correttamente!');
  }

  // Test kWh 1 -> 150 + assenza boost torque +25% + tetto singola batteria su QuadMotor 4x
  const batSmall = simulateElectricHybridDyno({ ...baseBench, batteryCapacityKwh: 15 });
  const batStd = simulateElectricHybridDyno({ ...baseBench, batteryCapacityKwh: 75 });
  const batBig = simulateElectricHybridDyno({ ...baseBench, batteryCapacityKwh: 150 });
  const singleUnit = calculateSingleElectricMotorMetrics(baseBench);
  const quadPack = calculateBatteryPackMetrics({
    batteryChemistry: 'NMC811',
    batteryCapacityKwh: 75,
    voltageArchitecture: 800,
    coolingSystem: 'LiquidGlycol',
    packStructure: 'CellToPackCopper',
    bmsCalibration: 'RoadBalanced',
    underbodyShield: 'StandardSteelShield',
    priceTier: 'Premium',
    referenceClass: 'Sport',
  });
  const quad4x = simulateElectricHybridDyno({
    ...baseBench,
    motorLayout: 'QuadMotor_Independent',
    motorCount: 4,
    batteryCapacityKwh: 75,
  });
  console.log(
    `Pack 75 kWh C-rate (${batStd.batteryPackTelemetry.spec.bmsCalibration}): Scarica max = ${quadPack.maxDischargePowerKw} kW (${quadPack.maxDischargePowerHp} CV) | Peso = ${quadPack.weightKg} kg`,
  );
  console.log(
    `Single Motor Unit=${singleUnit.peakTorqueNm} Nm -> Bench 15/75/150 kWh: ${batSmall.peakTorqueNm}/${batStd.peakTorqueNm}/${batBig.peakTorqueNm} Nm, ${batSmall.peakPowerHp}/${batStd.peakPowerHp}/${batBig.peakPowerHp} CV`,
  );
  console.log(
    `Quad-Motor 4x su singolo pacco 75 kWh (cap ${quadPack.maxDischargePowerHp} CV): Tot=${quad4x.peakPowerHp} CV (non 4×cap!), Torque=${quad4x.peakTorqueNm} Nm`,
  );
  if (
    batStd.peakTorqueNm !== singleUnit.peakTorqueNm ||
    batBig.peakTorqueNm !== singleUnit.peakTorqueNm ||
    quad4x.peakPowerHp > quadPack.maxDischargePowerHp + 2 ||
    quad4x.peakTorqueNm > singleUnit.peakTorqueNm * 4
  ) {
    failures++;
    console.error('FAIL: Bug batteria (inflazione coppia o moltiplicazione * motorCount) ancora presente!');
  }

  // Test C1 LitzRacingWire e allineamento curva Pannello 1 == Pannello 3
  console.log('\n=== 2D. VERIFICA FORMA CURVA C1 (LITZ & ALLINEAMENTO PANNELLO 1 == PANNELLO 3) ===');
  const litzSpec: ElectricMotorSpec = {
    ...HISTORICAL_ELECTRIC_BENCHMARKS[16].spec, // McMurtry 800V Litz 22k RPM
    maxMotorRpm: 22000,
  };
  const litzUnit = calculateSingleElectricMotorMetrics(litzSpec);
  const litzBench = simulateElectricHybridDyno({
    ...baseBench,
    ...litzSpec,
    batteryCapacityKwh: 120,
    bmsCalibration: 'RaceExtreme',
    packStructure: 'CarbonLaserSilverBusbar',
    gearboxType: 'SingleSpeedDirect',
    gearRatio: 9.0,
  });
  const p18000 = litzUnit.curve.find((p) => p.rpm === 18000)!;
  const p18250 = litzUnit.curve.find((p) => p.rpm === 18250)!;
  const p18500 = litzUnit.curve.find((p) => p.rpm === 18500)!;
  let maxPanelDiffHp = 0;
  for (const pt1 of litzUnit.curve) {
    const pt3 = litzBench.curve.find((p) => p.rpm === pt1.rpm);
    if (pt3) maxPanelDiffHp = Math.max(maxPanelDiffHp, Math.abs(pt3.powerHp - pt1.powerHp));
  }
  const jump18k = Math.abs(p18250.powerHp - p18000.powerHp);
  console.log(
    `LitzRacingWire 18.000->18.250->18.500 RPM: ${p18000.powerHp} -> ${p18250.powerHp} -> ${p18500.powerHp} CV (Δ=${jump18k} CV) | Max scarto Pannello 1 vs 3: ${maxPanelDiffHp} CV`,
  );
  if (jump18k > 2 || maxPanelDiffHp > 1) {
    failures++;
    console.error('FAIL: Discontinuità Litz o disallineamento curva Pannello 1 vs Pannello 3!');
  }

  // 2E. Invarianza curve rispetto a maxMotorRpm (3.000 / 14.000 / 22.000 RPM)
  console.log('\n=== 2E. VERIFICA INVARIANZA CURVA RISPETTO A maxMotorRpm (14000 vs 22000 RPM) ===');
  const rLow = calculateSingleElectricMotorMetrics({
    ...baseSpec,
    electricMotorType: 'AxialFlux',
    rotorSleeveBearing: 'CarbonPrepregCeramic',
    maxMotorRpm: 14000,
  });
  const rHigh = calculateSingleElectricMotorMetrics({
    ...baseSpec,
    electricMotorType: 'AxialFlux',
    rotorSleeveBearing: 'CarbonPrepregCeramic',
    maxMotorRpm: 22000,
  });
  let maxDeltaNm = 0;
  let maxDeltaHp = 0;
  for (const pLow of rLow.curve) {
    const pHigh = rHigh.curve.find((p) => p.rpm === pLow.rpm);
    if (pHigh) {
      maxDeltaNm = Math.max(maxDeltaNm, Math.abs(pHigh.torqueNm - pLow.torqueNm));
      maxDeltaHp = Math.max(maxDeltaHp, Math.abs(pHigh.powerHp - pLow.powerHp));
    }
  }
  console.log(
    `Invarianza 0..14000 RPM: maxΔNm=${maxDeltaNm}, maxΔHP=${maxDeltaHp} | effMaxRpm: ${rLow.maxMotorRpm} vs ${rHigh.maxMotorRpm}`,
  );
  if (maxDeltaNm !== 0 || maxDeltaHp !== 0) {
    failures++;
    console.error('FAIL: Curva non invariante rispetto a maxMotorRpm!');
  }

  // 2F. Verifica EESM (WoundRotorSync_EESM), Coerenza Card Rotore e Tutti i 6 Layout
  console.log('\n=== 2F. VERIFICA EESM, GABBIE/AVVOLGIMENTI ROTORE E 6 LAYOUT TRAZIONE ===');
  const pmsmRef = calculateSingleElectricMotorMetrics({
    ...baseSpec,
    electricMotorType: 'PermanentMagnetSync',
    rotorMagnetMaterial: 'NeodymiumDyUH',
  });
  const eesmRef = calculateSingleElectricMotorMetrics({
    ...baseSpec,
    electricMotorType: 'WoundRotorSync_EESM',
    rotorMagnetMaterial: 'NeodymiumDyUH',
  });
  const eesmMassDeltaKg = eesmRef.dryWeightKg - pmsmRef.dryWeightKg;
  console.log(
    `PMSM NdFeB-UH: ${pmsmRef.dryWeightKg} kg, $${pmsmRef.motorHardwareCost} | EESM Gen5: ${eesmRef.dryWeightKg} kg (+${eesmMassDeltaKg} kg), $${eesmRef.motorHardwareCost}`,
  );
  if (eesmMassDeltaKg < 3 || eesmMassDeltaKg > 5 || eesmRef.motorHardwareCost >= pmsmRef.motorHardwareCost) {
    failures++;
    console.error('FAIL: EESM deve avere massa rotore +3..5 kg vs PMSM e costo inferiore a NdFeB DyUH!');
  }

  const asmCards = getRotorMaterialSpecsForMotorType('InductionAsync').map((c) => c.name);
  const eesmCards = getRotorMaterialSpecsForMotorType('WoundRotorSync_EESM').map((c) => c.name);
  console.log(`ASM Rotor Cards: ${asmCards.join(' | ')}`);
  console.log(`EESM Rotor Cards: ${eesmCards.join(' | ')}`);
  if (
    !asmCards[0].includes('Alluminio') ||
    !eesmCards[2].includes('Gen5') ||
    !eesmCards[3].includes('Induttivo')
  ) {
    failures++;
    console.error('FAIL: Etichette dinamiche rotorMagnetMaterial non coerenti!');
  }

  const layRwd = simulateElectricHybridDyno({ ...baseBench, motorLayout: 'SingleMotor_RWD', motorCount: 1 });
  const layFwd = simulateElectricHybridDyno({ ...baseBench, motorLayout: 'SingleMotor_FWD', motorCount: 1 });
  const layMechAwd = simulateElectricHybridDyno({
    ...baseBench,
    motorLayout: 'SingleMotor_MechanicalAWD',
    motorCount: 1,
  });
  const layDualPsm = simulateElectricHybridDyno({
    ...baseBench,
    motorLayout: 'DualMotor_eAWD',
    motorCount: 2,
    batteryCapacityKwh: 120,
    bmsCalibration: 'RaceExtreme',
    hasFrontDisconnect: false,
  });
  const layDualEesm = simulateElectricHybridDyno({
    ...baseBench,
    electricMotorType: 'WoundRotorSync_EESM',
    motorLayout: 'DualMotor_eAWD',
    motorCount: 2,
    batteryCapacityKwh: 120,
    bmsCalibration: 'RaceExtreme',
    hasFrontDisconnect: false,
  });
  console.log(
    `1× RWD: ${layRwd.peakPowerHp} CV / ${layRwd.peakTorqueNm} Nm, ${layRwd.dryWeightKg} kg, ${layRwd.specs.efficiencyKwhPer100Km} kWh/100km`,
  );
  console.log(
    `1× FWD: ${layFwd.peakPowerHp} CV / ${layFwd.peakTorqueNm} Nm, ${layFwd.dryWeightKg} kg, ${layFwd.specs.efficiencyKwhPer100Km} kWh/100km`,
  );
  console.log(
    `1× Mech-AWD (0.92×): ${layMechAwd.peakPowerHp} CV / ${layMechAwd.peakTorqueNm} Nm, ${layMechAwd.dryWeightKg} kg (+${layMechAwd.dryWeightKg - layRwd.dryWeightKg} kg), ${layMechAwd.specs.efficiencyKwhPer100Km} kWh/100km`,
  );
  console.log(
    `2× Dual EESM Zero-Drag vs PSM senza sgancio: Costo=$${layDualEesm.unitProductionCost} vs $${layDualPsm.unitProductionCost}, Consumo=${layDualEesm.specs.efficiencyKwhPer100Km} vs ${layDualPsm.specs.efficiencyKwhPer100Km} kWh/100km`,
  );
  if (
    layMechAwd.peakTorqueNm >= layRwd.peakTorqueNm ||
    layMechAwd.dryWeightKg < layRwd.dryWeightKg + 35 ||
    (layFwd.specs.efficiencyKwhPer100Km ?? 0) <= (layRwd.specs.efficiencyKwhPer100Km ?? 0) ||
    (layDualEesm.specs.efficiencyKwhPer100Km ?? 99) >= (layDualPsm.specs.efficiencyKwhPer100Km ?? 0)
  ) {
    failures++;
    console.error('FAIL: Layout FWD / Mech-AWD 0.92x o beneficio Zero-Drag EESM non coerenti!');
  }

  // 2G. Verifica Accoppiamento Ibrido Pannello 3 nelle 5 modalità systemType
  console.log('\n=== 2G. TEST ACCOPPIAMENTO IBRIDO PANNELLO 3 (5 MODALITA systemType) ===');
  const coupledIce = REFERENCE_HYBRID_ICE_ENGINES[1]; // 2.0L Turbo 255 CV / 390 Nm
  const hybridModes: { systemType: HybridSystemType; batteryKwh: number }[] = [
    { systemType: 'PureEV', batteryKwh: 75 },
    { systemType: 'MHEV', batteryKwh: 2 },
    { systemType: 'FullHybrid', batteryKwh: 4 },
    { systemType: 'PHEV', batteryKwh: 20 },
    { systemType: 'RangeExtender', batteryKwh: 38 },
  ];
  const hybridResults = new Map<HybridSystemType, ReturnType<typeof simulateElectricHybridDyno>>();
  for (const mode of hybridModes) {
    const simH = simulateElectricHybridDyno(
      {
        ...baseBench,
        systemType: mode.systemType,
        batteryCapacityKwh: mode.batteryKwh,
        statorDiameterMm: 225,
        rotorLengthMm: 165,
      },
      coupledIce,
    );
    hybridResults.set(mode.systemType, simH);
    const kwh100 = simH.specs.efficiencyKwhPer100Km ?? 0;
    const rangeKm = simH.specs.estimatedRangeKm ?? 0;
    console.log(
      `${mode.systemType.padEnd(13)}: ${simH.peakPowerHp} CV / ${simH.peakTorqueNm} Nm | Peso=${simH.dryWeightKg} kg | Consumo=${kwh100} kWh/100km | Range=${rangeKm} km | CO2=${simH.emissionsGPerKm} g/km | Eff=${simH.thermalEfficiencyPercent}% | Costo=$${simH.unitProductionCost}`,
    );
    const nums = [
      simH.peakPowerHp,
      simH.peakTorqueNm,
      simH.dryWeightKg,
      simH.unitProductionCost,
      simH.emissionsGPerKm,
      simH.thermalEfficiencyPercent,
      kwh100,
      rangeKm,
    ];
    if (
      nums.some((v) => !Number.isFinite(v)) ||
      simH.peakPowerHp <= 0 ||
      simH.peakTorqueNm <= 0 ||
      simH.dryWeightKg <= 0 ||
      simH.curve.length < 5
    ) {
      failures++;
      console.error(`FAIL: Valori NaN/non finiti o non validi su modalità ${mode.systemType}!`);
    }
  }
  const pureRes = hybridResults.get('PureEV')!;
  const mhevRes = hybridResults.get('MHEV')!;
  const fullRes = hybridResults.get('FullHybrid')!;
  const phevRes = hybridResults.get('PHEV')!;
  const erevRes = hybridResults.get('RangeExtender')!;
  if (
    pureRes.emissionsGPerKm !== 0 ||
    mhevRes.emissionsGPerKm <= 0 ||
    (mhevRes.specs.estimatedRangeKm ?? 99) > 2 ||
    mhevRes.peakPowerHp <= coupledIce.peakPowerHp ||
    fullRes.peakPowerHp <= mhevRes.peakPowerHp ||
    phevRes.peakTorqueNm <= coupledIce.peakTorqueNm ||
    mhevRes.unitProductionCost >= fullRes.unitProductionCost ||
    fullRes.unitProductionCost >= phevRes.unitProductionCost ||
    erevRes.peakPowerHp < pureRes.peakPowerHp * 0.98 ||
    erevRes.redlineRpm !== pureRes.redlineRpm ||
    pureRes.thermalEfficiencyPercent < 90 ||
    phevRes.thermalEfficiencyPercent < 68 ||
    phevRes.thermalEfficiencyPercent > 76 ||
    erevRes.thermalEfficiencyPercent < 55 ||
    erevRes.thermalEfficiencyPercent > 62 ||
    fullRes.thermalEfficiencyPercent < 44 ||
    fullRes.thermalEfficiencyPercent > 50 ||
    mhevRes.thermalEfficiencyPercent < 38 ||
    mhevRes.thermalEfficiencyPercent > 43 ||
    !(
      pureRes.thermalEfficiencyPercent > phevRes.thermalEfficiencyPercent &&
      phevRes.thermalEfficiencyPercent > erevRes.thermalEfficiencyPercent &&
      erevRes.thermalEfficiencyPercent > fullRes.thermalEfficiencyPercent &&
      fullRes.thermalEfficiencyPercent > mhevRes.thermalEfficiencyPercent
    ) ||
    !Number.isFinite(erevRes.specs.erevTotalCombinedRangeKm ?? NaN) ||
    (erevRes.specs.erevTotalCombinedRangeKm ?? 0) <= (erevRes.specs.estimatedRangeKm ?? 0)
  ) {
    failures++;
    console.error('FAIL: Progressione fisica, potenza EREV, efficienze di sistema o parametri MHEV/FullHybrid non coerenti!');
  }

  if (outHp3 > 0 || outNm3 > 0 || outKg10 > 0) {
    failures++;
    console.error(
      `FAIL: Superata la tolleranza outlier (±3.0% CV/Nm, ±10.0% Peso): ${outHp3} CV, ${outNm3} Nm, ${outKg10} Peso.`,
    );
  }
  if (meanHp >= 1.8 || meanNm >= 1.8 || meanKgPct >= 4.5) {
    failures++;
    console.error(
      `FAIL: Medie assolute fuori target (<1.8% CV/Nm, <4.5% Peso): CV=${meanHp.toFixed(2)}%, Nm=${meanNm.toFixed(2)}%, Peso=${meanKgPct.toFixed(2)}%.`,
    );
  }

  if (failures > 0) {
    console.error(`\nDIAGNOSTICA COMPLETATA CON ${failures} ERRORI DI CERTIFICAZIONE/CONTROLLI.`);
    process.exit(1);
  }
  console.log(
    `\nDIAGNOSTICA COMPLETATA (${n} motori): 0 errori di invarianza/controlli UI | Outlier >±3.0%: ${outHp3} CV / ${outNm3} Nm | Outlier >±5.0%: ${outHp5} CV / ${outNm5} Nm | Outlier Peso >±10.0%: ${outKg10}/${n}.`,
  );
}

runElectricDiagnostic();
