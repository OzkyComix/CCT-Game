import {
  calculateBatteryPackMetrics,
  simulateElectricHybridDyno,
} from './evHybridMath';
import type {
  BatteryPackSpec,
  ElectricHybridEngineConfigInput,
  HybridSystemType,
} from '../types/gameTypes';

export type BatteryCategory = 'A' | 'B' | 'C' | 'D';

export interface BatteryBenchmarkCase {
  id: number;
  category: BatteryCategory;
  year: number;
  name: string;
  realWeightKg: number;
  realPeakKw: number;
  realPeakHp: number;
  explicitSystemType?: HybridSystemType;
  spec: Omit<BatteryPackSpec, 'priceTier' | 'referenceClass'> &
    Partial<Pick<BatteryPackSpec, 'priceTier' | 'referenceClass'>>;
}

export const HISTORICAL_BATTERY_BENCHMARKS: BatteryBenchmarkCase[] = [
  // A) Batterie Ibride, PHEV & Hypercar High-Discharge (1.0 - 30.0 kWh — #1..#7)
  {
    id: 1,
    category: 'A',
    year: 2016,
    name: 'Toyota Prius Gen4 / Corolla Full-Hybrid',
    realWeightKg: 25,
    realPeakKw: 28,
    realPeakHp: 38,
    spec: {
      batteryCapacityKwh: 1.0,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'ConservativeLongevity',
      voltageArchitecture: 400,
      coolingSystem: 'Air',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 2,
    category: 'A',
    year: 2024,
    name: 'Porsche 911 GTS T-Hybrid (Varta V4Drive)',
    realWeightKg: 27,
    realPeakKw: 50,
    realPeakHp: 68,
    spec: {
      batteryCapacityKwh: 2.0,
      batteryChemistry: 'NCA',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'RaceExtreme',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 3,
    category: 'A',
    year: 2023,
    name: 'Lamborghini Revuelto High-Power Pack',
    realWeightKg: 70,
    realPeakKw: 140,
    realPeakHp: 190,
    spec: {
      batteryCapacityKwh: 4.0,
      batteryChemistry: 'NMC811',
      packStructure: 'CarbonLaserSilverBusbar',
      bmsCalibration: 'RaceExtreme',
      voltageArchitecture: 400,
      coolingSystem: 'DirectDielectric',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 4,
    category: 'A',
    year: 2023,
    name: 'Mercedes-AMG C63 S E-Perf. HPB150',
    realWeightKg: 89,
    realPeakKw: 150,
    realPeakHp: 204,
    spec: {
      batteryCapacityKwh: 6.0,
      batteryChemistry: 'NCA',
      packStructure: 'CarbonLaserSilverBusbar',
      bmsCalibration: 'RaceExtreme',
      voltageArchitecture: 400,
      coolingSystem: 'DirectDielectric',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 5,
    category: 'A',
    year: 2021,
    name: 'Ferrari 296 GTB / SF90 Stradale Pack',
    realWeightKg: 73,
    realPeakKw: 135,
    realPeakHp: 184,
    spec: {
      batteryCapacityKwh: 7.5,
      batteryChemistry: 'NMC811',
      packStructure: 'CarbonLaserSilverBusbar',
      bmsCalibration: 'RaceExtreme',
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 6,
    category: 'A',
    year: 2021,
    name: 'Toyota RAV4 Prime / Prius PHEV',
    realWeightKg: 145,
    realPeakKw: 110,
    realPeakHp: 150,
    spec: {
      batteryCapacityKwh: 18.0,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 7,
    category: 'A',
    year: 2023,
    name: 'BMW X5 xDrive50e / Range Rover PHEV',
    realWeightKg: 235,
    realPeakKw: 145,
    realPeakHp: 197,
    spec: {
      batteryCapacityKwh: 30.0,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },

  // B) Batterie LFP Litio-Ferro-Fosfato (27.0 - 82.0 kWh — #8..#13)
  {
    id: 8,
    category: 'B',
    year: 2021,
    name: 'Dacia Spring / City K-ZE (Sunwoda)',
    realWeightKg: 186,
    realPeakKw: 40,
    realPeakHp: 54,
    spec: {
      batteryCapacityKwh: 27.0,
      batteryChemistry: 'LFP',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'ConservativeLongevity',
      voltageArchitecture: 400,
      coolingSystem: 'Air',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 9,
    category: 'B',
    year: 2024,
    name: 'Fiat Grande Panda / Citroën ë-C3 (SVOLT)',
    realWeightKg: 305,
    realPeakKw: 95,
    realPeakHp: 129,
    spec: {
      batteryCapacityKwh: 44.0,
      batteryChemistry: 'LFP',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 10,
    category: 'B',
    year: 2022,
    name: 'BYD Dolphin / Atto 3 Blade Battery',
    realWeightKg: 378,
    realPeakKw: 165,
    realPeakHp: 224,
    spec: {
      batteryCapacityKwh: 60.0,
      batteryChemistry: 'LFP',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 11,
    category: 'B',
    year: 2022,
    name: 'Tesla Model 3 / Y RWD SR (CATL LFP)',
    realWeightKg: 380,
    realPeakKw: 235,
    realPeakHp: 320,
    spec: {
      batteryCapacityKwh: 60.0,
      batteryChemistry: 'LFP',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 12,
    category: 'B',
    year: 2023,
    name: 'BYD Seal / Han Blade 800V CTB',
    realWeightKg: 525,
    realPeakKw: 400,
    realPeakHp: 544,
    spec: {
      batteryCapacityKwh: 82.0,
      batteryChemistry: 'LFP',
      packStructure: 'CellToChassisCTC',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 800,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 13,
    category: 'B',
    year: 2024,
    name: 'Zeekr 007 / 001 Golden Brick 800V',
    realWeightKg: 475,
    realPeakKw: 480,
    realPeakHp: 653,
    spec: {
      batteryCapacityKwh: 75.0,
      batteryChemistry: 'LFP',
      packStructure: 'CellToChassisCTC',
      bmsCalibration: 'RaceExtreme',
      voltageArchitecture: 800,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },

  // C) Batterie NMC / NCA 400V Stradali (24.0 - 108.0 kWh — #14..#22)
  {
    id: 14,
    category: 'C',
    year: 2010,
    name: 'Nissan Leaf ZE0 24 kWh (AESC)',
    realWeightKg: 294,
    realPeakKw: 90,
    realPeakHp: 122,
    spec: {
      batteryCapacityKwh: 24.0,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'ConservativeLongevity',
      voltageArchitecture: 400,
      coolingSystem: 'Air',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 15,
    category: 'C',
    year: 2019,
    name: 'Renault Zoe ZE50 R135 (LG E78)',
    realWeightKg: 326,
    realPeakKw: 115,
    realPeakHp: 156,
    spec: {
      batteryCapacityKwh: 52.0,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'Air',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 16,
    category: 'C',
    year: 2020,
    name: 'Fiat 500e 42 kWh (Samsung SDI)',
    realWeightKg: 295,
    realPeakKw: 105,
    realPeakHp: 143,
    spec: {
      batteryCapacityKwh: 42.0,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 17,
    category: 'C',
    year: 2022,
    name: 'Renault Mégane / R5 E-Tech (LG CTP)',
    realWeightKg: 395,
    realPeakKw: 175,
    realPeakHp: 238,
    spec: {
      batteryCapacityKwh: 60.0,
      batteryChemistry: 'NMC811',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 18,
    category: 'C',
    year: 2020,
    name: 'VW ID.3 / ID.4 Pro S MEB (82 kWh)',
    realWeightKg: 495,
    realPeakKw: 265,
    realPeakHp: 360,
    spec: {
      batteryCapacityKwh: 82.0,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 19,
    category: 'C',
    year: 2021,
    name: 'BMW i4 M50 / iX3 Gen5 (CATL)',
    realWeightKg: 550,
    realPeakKw: 415,
    realPeakHp: 564,
    spec: {
      batteryCapacityKwh: 84.0,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 20,
    category: 'C',
    year: 2021,
    name: 'Tesla Model 3 / Y LR & Perf. (2170 NCA)',
    realWeightKg: 480,
    realPeakKw: 430,
    realPeakHp: 585,
    spec: {
      batteryCapacityKwh: 82.0,
      batteryChemistry: 'NCA',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 21,
    category: 'C',
    year: 2021,
    name: 'Tesla Model S Plaid 100 kWh (18650 NCA)',
    realWeightKg: 542,
    realPeakKw: 820,
    realPeakHp: 1115,
    spec: {
      batteryCapacityKwh: 100.0,
      batteryChemistry: 'NCA',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'RaceExtreme',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'TitaniumKevlarIP69K',
    },
  },
  {
    id: 22,
    category: 'C',
    year: 2021,
    name: 'Mercedes-Benz EQS 450+ / 580 EVA2',
    realWeightKg: 670,
    realPeakKw: 400,
    realPeakHp: 544,
    spec: {
      batteryCapacityKwh: 108.0,
      batteryChemistry: 'NMC811',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },

  // D) Batterie 800V-1000V Performance, Max-Pack, Corsa & Stato Solido (47.0 - 150.0 kWh — #23..#30)
  {
    id: 23,
    category: 'D',
    year: 2024,
    name: 'Hyundai Ioniq 5 N E-GMP 800V',
    realWeightKg: 485,
    realPeakKw: 500,
    realPeakHp: 680,
    spec: {
      batteryCapacityKwh: 84.0,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 800,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 24,
    category: 'D',
    year: 2019,
    name: 'Porsche Taycan Perf. Battery Plus J1.1',
    realWeightKg: 630,
    realPeakKw: 600,
    realPeakHp: 816,
    spec: {
      batteryCapacityKwh: 93.0,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 800,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'TitaniumKevlarIP69K',
    },
  },
  {
    id: 25,
    category: 'D',
    year: 2024,
    name: 'Porsche Taycan J1.2 / Macan EV PPE',
    realWeightKg: 570,
    realPeakKw: 760,
    realPeakHp: 1033,
    spec: {
      batteryCapacityKwh: 105.0,
      batteryChemistry: 'NMC811',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 800,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 26,
    category: 'D',
    year: 2023,
    name: 'Lucid Air Sapphire / Dream 900V',
    realWeightKg: 590,
    realPeakKw: 960,
    realPeakHp: 1305,
    spec: {
      batteryCapacityKwh: 118.0,
      batteryChemistry: 'NCA',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'RaceExtreme',
      voltageArchitecture: 1000,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 27,
    category: 'D',
    year: 2022,
    name: 'Rimac Nevera Structural Pack CTC',
    realWeightKg: 700,
    realPeakKw: 1400,
    realPeakHp: 1904,
    spec: {
      batteryCapacityKwh: 120.0,
      batteryChemistry: 'NCA',
      packStructure: 'CellToChassisCTC',
      bmsCalibration: 'RaceExtreme',
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 28,
    category: 'D',
    year: 2023,
    name: 'Rivian R1T / R1S Max Pack (149 kWh)',
    realWeightKg: 800,
    realPeakKw: 650,
    realPeakHp: 884,
    spec: {
      batteryCapacityKwh: 149.0,
      batteryChemistry: 'NCA',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'TitaniumKevlarIP69K',
    },
  },
  {
    id: 29,
    category: 'D',
    year: 2023,
    name: 'Formula E Gen3 Spec Pack (WAE 900V)',
    realWeightKg: 284,
    realPeakKw: 600,
    realPeakHp: 816,
    spec: {
      batteryCapacityKwh: 47.0,
      batteryChemistry: 'NCA',
      packStructure: 'CarbonLaserSilverBusbar',
      bmsCalibration: 'RaceExtreme',
      voltageArchitecture: 1000,
      coolingSystem: 'DirectDielectric',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 30,
    category: 'D',
    year: 2024,
    name: 'NIO ET7 / WeLion 150 kWh Semi-Solid',
    realWeightKg: 575,
    realPeakKw: 600,
    realPeakHp: 816,
    spec: {
      batteryCapacityKwh: 150.0,
      batteryChemistry: 'SolidState',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 800,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },

  // === NUOVI 30 PACCHI BATTERIA (2012-2026 — #31..#60) ===
  // A) Ibride, PHEV, Range Extender & Supercar (1.5 - 21.0 kWh — #31..#37)
  {
    id: 31,
    category: 'A',
    year: 2021,
    name: 'Hyundai Tucson / Kia Sportage HEV',
    realWeightKg: 34,
    realPeakKw: 44,
    realPeakHp: 60,
    explicitSystemType: 'FullHybrid',
    spec: {
      batteryCapacityKwh: 1.5,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 32,
    category: 'A',
    year: 2022,
    name: 'Nissan Qashqai / X-Trail e-Power',
    realWeightKg: 39,
    realPeakKw: 65,
    realPeakHp: 88,
    explicitSystemType: 'FullHybrid',
    spec: {
      batteryCapacityKwh: 2.0,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 33,
    category: 'A',
    year: 2024,
    name: 'Aston Martin Valhalla PHEV (800V Dielectric)',
    realWeightKg: 68,
    realPeakKw: 130,
    realPeakHp: 177,
    explicitSystemType: 'PHEV',
    spec: {
      batteryCapacityKwh: 6.0,
      batteryChemistry: 'NMC811',
      packStructure: 'CarbonLaserSilverBusbar',
      bmsCalibration: 'RaceExtreme',
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 34,
    category: 'A',
    year: 2022,
    name: 'Alfa Romeo Tonale / Jeep Compass 4xe',
    realWeightKg: 132,
    realPeakKw: 95,
    realPeakHp: 129,
    explicitSystemType: 'PHEV',
    spec: {
      batteryCapacityKwh: 15.5,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 35,
    category: 'A',
    year: 2023,
    name: 'Audi A8 / Q7 TFSI e quattro',
    realWeightKg: 144,
    realPeakKw: 105,
    realPeakHp: 143,
    explicitSystemType: 'PHEV',
    spec: {
      batteryCapacityKwh: 17.5,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 36,
    category: 'A',
    year: 2023,
    name: 'Mazda MX-30 R-EV (Panasonic Prismatic)',
    realWeightKg: 148,
    realPeakKw: 125,
    realPeakHp: 170,
    explicitSystemType: 'PHEV',
    spec: {
      batteryCapacityKwh: 18.0,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 37,
    category: 'A',
    year: 2024,
    name: 'BMW M5 G90 / XM M-Hybrid (21 kWh)',
    realWeightKg: 165,
    realPeakKw: 145,
    realPeakHp: 197,
    explicitSystemType: 'PHEV',
    spec: {
      batteryCapacityKwh: 21.0,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },

  // B) LFP Litio-Ferro-Fosfato (40.0 - 92.0 kWh — #38..#44)
  {
    id: 38,
    category: 'B',
    year: 2025,
    name: 'Renault R5 / Twingo Urban Range LFP',
    realWeightKg: 270,
    realPeakKw: 95,
    realPeakHp: 129,
    spec: {
      batteryCapacityKwh: 40.0,
      batteryChemistry: 'LFP',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 39,
    category: 'B',
    year: 2024,
    name: 'BYD Atto 2 / Yuan Up Blade',
    realWeightKg: 298,
    realPeakKw: 110,
    realPeakHp: 150,
    spec: {
      batteryCapacityKwh: 45.0,
      batteryChemistry: 'LFP',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 40,
    category: 'B',
    year: 2024,
    name: 'Leapmotor C10 / B10 CTC 2.0',
    realWeightKg: 440,
    realPeakKw: 185,
    realPeakHp: 252,
    spec: {
      batteryCapacityKwh: 70.0,
      batteryChemistry: 'LFP',
      packStructure: 'CellToChassisCTC',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 41,
    category: 'B',
    year: 2023,
    name: 'Ford Mustang Mach-E Standard LFP',
    realWeightKg: 455,
    realPeakKw: 265,
    realPeakHp: 360,
    spec: {
      batteryCapacityKwh: 72.0,
      batteryChemistry: 'LFP',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 42,
    category: 'B',
    year: 2024,
    name: 'Xiaomi SU7 Standard Blade LFP',
    realWeightKg: 465,
    realPeakKw: 275,
    realPeakHp: 374,
    spec: {
      batteryCapacityKwh: 74.0,
      batteryChemistry: 'LFP',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 43,
    category: 'B',
    year: 2024,
    name: 'Onvo L60 / NIO 85 kWh 900V LFP',
    realWeightKg: 530,
    realPeakKw: 420,
    realPeakHp: 571,
    spec: {
      batteryCapacityKwh: 85.0,
      batteryChemistry: 'LFP',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 1000,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 44,
    category: 'B',
    year: 2024,
    name: 'Rivian R1T / R1S Standard LFP',
    realWeightKg: 575,
    realPeakKw: 340,
    realPeakHp: 462,
    spec: {
      batteryCapacityKwh: 92.0,
      batteryChemistry: 'LFP',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },

  // C) NMC / NCA 400V Stradali (35.5 - 116.0 kWh — #45..#52)
  {
    id: 45,
    category: 'C',
    year: 2020,
    name: 'Honda e / Mazda MX-30 EV',
    realWeightKg: 255,
    realPeakKw: 100,
    realPeakHp: 136,
    spec: {
      batteryCapacityKwh: 35.5,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 46,
    category: 'C',
    year: 2024,
    name: 'MINI Cooper SE / Countryman E',
    realWeightKg: 365,
    realPeakKw: 150,
    realPeakHp: 204,
    spec: {
      batteryCapacityKwh: 54.0,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 47,
    category: 'C',
    year: 2024,
    name: 'Peugeot e-3008 / Alfa Junior Veloce',
    realWeightKg: 485,
    realPeakKw: 220,
    realPeakHp: 299,
    spec: {
      batteryCapacityKwh: 73.0,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 48,
    category: 'C',
    year: 2012,
    name: 'Tesla Model S 85 (Panasonic 18650 NCA)',
    realWeightKg: 540,
    realPeakKw: 420,
    realPeakHp: 571,
    spec: {
      batteryCapacityKwh: 85.0,
      batteryChemistry: 'NCA',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'TitaniumKevlarIP69K',
    },
  },
  {
    id: 49,
    category: 'C',
    year: 2022,
    name: 'Nissan Ariya 87 kWh e-4ORCE',
    realWeightKg: 540,
    realPeakKw: 390,
    realPeakHp: 530,
    spec: {
      batteryCapacityKwh: 87.0,
      batteryChemistry: 'NMC811',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 50,
    category: 'C',
    year: 2018,
    name: 'Jaguar I-Pace EV400 90 kWh',
    realWeightKg: 580,
    realPeakKw: 435,
    realPeakHp: 592,
    spec: {
      batteryCapacityKwh: 90.0,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 51,
    category: 'C',
    year: 2024,
    name: 'Peugeot e-3008 Long Range 98 kWh',
    realWeightKg: 595,
    realPeakKw: 350,
    realPeakHp: 476,
    spec: {
      batteryCapacityKwh: 98.0,
      batteryChemistry: 'NMC811',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 52,
    category: 'C',
    year: 2024,
    name: 'Mercedes-Benz G 580 EQ Tech',
    realWeightKg: 715,
    realPeakKw: 530,
    realPeakHp: 721,
    spec: {
      batteryCapacityKwh: 116.0,
      batteryChemistry: 'NMC811',
      packStructure: 'ModularAluminum',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'TitaniumKevlarIP69K',
    },
  },

  // D) 800V-1000V Performance, Corsa & Stato Solido (28.0 - 120.0 kWh — #53..#60)
  {
    id: 53,
    category: 'D',
    year: 2014,
    name: 'Formula E Gen1 Spec Pack (WAE 28 kWh)',
    realWeightKg: 200,
    realPeakKw: 230,
    realPeakHp: 313,
    spec: {
      batteryCapacityKwh: 28.0,
      batteryChemistry: 'NCA',
      packStructure: 'CarbonLaserSilverBusbar',
      bmsCalibration: 'RaceExtreme',
      voltageArchitecture: 800,
      coolingSystem: 'Air',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 54,
    category: 'D',
    year: 2022,
    name: 'McMurtry Spéirling Track Pack',
    realWeightKg: 350,
    realPeakKw: 680,
    realPeakHp: 925,
    spec: {
      batteryCapacityKwh: 60.0,
      batteryChemistry: 'NCA',
      packStructure: 'CarbonLaserSilverBusbar',
      bmsCalibration: 'RaceExtreme',
      voltageArchitecture: 800,
      coolingSystem: 'DirectDielectric',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 55,
    category: 'D',
    year: 2025,
    name: 'BMW Neue Klasse iX3 Gen6 800V',
    realWeightKg: 530,
    realPeakKw: 660,
    realPeakHp: 898,
    spec: {
      batteryCapacityKwh: 95.0,
      batteryChemistry: 'NMC811',
      packStructure: 'CellToChassisCTC',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 800,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 56,
    category: 'D',
    year: 2026,
    name: 'Mercedes-Benz GLC EQ 800V (MB.EA)',
    realWeightKg: 495,
    realPeakKw: 680,
    realPeakHp: 925,
    spec: {
      batteryCapacityKwh: 95.0,
      batteryChemistry: 'NCA',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 800,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 57,
    category: 'D',
    year: 2024,
    name: 'Audi Q6 e-tron / Macan EV PPE',
    realWeightKg: 575,
    realPeakKw: 700,
    realPeakHp: 952,
    spec: {
      batteryCapacityKwh: 100.0,
      batteryChemistry: 'NMC811',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 800,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 58,
    category: 'D',
    year: 2025,
    name: 'MG4 / IM Semi-Solid State 100 kWh',
    realWeightKg: 400,
    realPeakKw: 350,
    realPeakHp: 476,
    spec: {
      batteryCapacityKwh: 100.0,
      batteryChemistry: 'SolidState',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'RoadBalanced',
      voltageArchitecture: 800,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 59,
    category: 'D',
    year: 2024,
    name: 'Polestar 3 / Volvo EX90 Perf.',
    realWeightKg: 660,
    realPeakKw: 510,
    realPeakHp: 693,
    spec: {
      batteryCapacityKwh: 111.0,
      batteryChemistry: 'NMC811',
      packStructure: 'CellToPackCopper',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 400,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
  {
    id: 60,
    category: 'D',
    year: 2025,
    name: 'NIO ET9 SkyRide 900V (46105 CTC)',
    realWeightKg: 585,
    realPeakKw: 850,
    realPeakHp: 1156,
    spec: {
      batteryCapacityKwh: 120.0,
      batteryChemistry: 'NCA',
      packStructure: 'CellToChassisCTC',
      bmsCalibration: 'PerformanceSport',
      voltageArchitecture: 1000,
      coolingSystem: 'LiquidGlycol',
      underbodyShield: 'StandardSteelShield',
    },
  },
];

function fmtSigned(val: number, decimals = 1): string {
  const s = val.toFixed(decimals);
  return val >= 0 ? `+${s}` : s;
}

function runBatteryDiagnostic(): void {
  console.log(
    `=== DIAGNOSTICA CERTIFICAZIONE ${HISTORICAL_BATTERY_BENCHMARKS.length} PACCHI BATTERIA STORICI (2010-2026) ===`,
  );
  console.log(
    '| # | Cat | Anno | Pacco Batteria | kWh (Utile) | Peso Sim / Reale (Diff / Err%) | Wh/kg | Scarica Picco Sim / Reale (kW / CV, Err%) | C-Rate | Affid. | Costo |',
  );
  console.log(
    '| :---: | :---: | :---: | :--- | :---: | :--- | :---: | :--- | :---: | :---: | :---: |',
  );

  let sumAbsKgPct = 0;
  let sumSignedKgPct = 0;
  let sumAbsKg = 0;
  let sumAbsKwPct = 0;
  let sumSignedKwPct = 0;
  let outKg8 = 0;
  let outKw8 = 0;
  let outKg10 = 0;
  let outKw10 = 0;

  const byCat = new Map<
    BatteryCategory,
    { n: number; sumKgPct: number; sumKwPct: number; outKg8: number; outKw8: number }
  >();

  for (const b of HISTORICAL_BATTERY_BENCHMARKS) {
    const sysType: HybridSystemType =
      b.explicitSystemType ??
      (b.category === 'A'
        ? b.spec.batteryCapacityKwh >= 15
          ? 'PHEV'
          : 'FullHybrid'
        : 'PureEV');
    const sim = calculateBatteryPackMetrics(
      { priceTier: 'Premium', referenceClass: 'Sport', ...b.spec },
      sysType,
    );
    const diffKg = sim.weightKg - b.realWeightKg;
    const errKgPct = (diffKg / b.realWeightKg) * 100;
    const packWhPerKg = Math.round((b.spec.batteryCapacityKwh * 1000) / sim.weightKg);
    const errKwPct = ((sim.maxDischargePowerKw - b.realPeakKw) / b.realPeakKw) * 100;

    sumAbsKgPct += Math.abs(errKgPct);
    sumSignedKgPct += errKgPct;
    sumAbsKg += Math.abs(diffKg);
    sumAbsKwPct += Math.abs(errKwPct);
    sumSignedKwPct += errKwPct;

    if (Math.abs(errKgPct) > 8.0) outKg8++;
    if (Math.abs(errKwPct) > 8.0) outKw8++;
    if (Math.abs(errKgPct) > 10.0) outKg10++;
    if (Math.abs(errKwPct) > 10.0) outKw10++;

    const st = byCat.get(b.category) ?? {
      n: 0,
      sumKgPct: 0,
      sumKwPct: 0,
      outKg8: 0,
      outKw8: 0,
    };
    st.n++;
    st.sumKgPct += Math.abs(errKgPct);
    st.sumKwPct += Math.abs(errKwPct);
    if (Math.abs(errKgPct) > 8.0) st.outKg8++;
    if (Math.abs(errKwPct) > 8.0) st.outKw8++;
    byCat.set(b.category, st);

    console.log(
      `| ${b.id} | ${b.category} | ${b.year} | ${b.name} | ${b.spec.batteryCapacityKwh.toFixed(1)} (${sim.usableCapacityKwh.toFixed(1)}) | ${sim.weightKg} / ${b.realWeightKg} kg (${diffKg >= 0 ? '+' : ''}${diffKg} kg, ${fmtSigned(errKgPct)}%) | ${packWhPerKg} | ${sim.maxDischargePowerKw}/${sim.maxDischargePowerHp} vs ${b.realPeakKw}/${b.realPeakHp} (${fmtSigned(errKwPct)}%) | ${sim.peakDischargeCRate.toFixed(2)}C | ${sim.reliabilityPercent.toFixed(1)}% | $${sim.unitProductionCost} |`,
    );
  }

  const n = HISTORICAL_BATTERY_BENCHMARKS.length;
  const meanKgPct = sumAbsKgPct / n;
  const meanKwPct = sumAbsKwPct / n;
  console.log(`\n=== RIEPILOGO DIAGNOSTICO GLOBALE (${n} PACCHI BATTERIA) ===`);
  console.log(
    `Peso Pacco: Media |Diff| = ${(sumAbsKg / n).toFixed(1)} kg (${meanKgPct.toFixed(2)}%) | Media con segno = ${fmtSigned(sumSignedKgPct / n, 2)}% | Outlier > ±8.0%: ${outKg8}/${n} | Outlier > ±10.0%: ${outKg10}/${n}`,
  );
  console.log(
    `Scarica Picco (kW): Media |Err| = ${meanKwPct.toFixed(2)}% | Media con segno = ${fmtSigned(sumSignedKwPct / n, 2)}% | Outlier > ±8.0%: ${outKw8}/${n} | Outlier > ±10.0%: ${outKw10}/${n}`,
  );

  console.log('\n=== BREAKDOWN PER CATEGORIA ===');
  const catNames: Record<BatteryCategory, string> = {
    A: 'A) Ibride, PHEV & Hypercar High-Discharge',
    B: 'B) LFP Litio-Ferro-Fosfato',
    C: 'C) NMC / NCA 400V Stradali',
    D: 'D) 800V-1000V Performance, Corsa & Stato Solido',
  };
  for (const cat of ['A', 'B', 'C', 'D'] as BatteryCategory[]) {
    const st = byCat.get(cat);
    if (!st) continue;
    console.log(
      `- ${catNames[cat]} (${st.n}): |Err Peso| = ${(st.sumKgPct / st.n).toFixed(2)}% (out>8%: ${st.outKg8}/${st.n}) | |Err Scarica| = ${(st.sumKwPct / st.n).toFixed(2)}% (out>8%: ${st.outKw8}/${st.n})`,
    );
  }

  // Test automatici di monotonicità fisica rigorosa
  let failures = 0;
  console.log('\n=== 2. TEST MONOTONICITA FISICA PACCO BATTERIA ===');

  const refPackSpec: BatteryPackSpec = {
    batteryCapacityKwh: 75,
    batteryChemistry: 'NMC811',
    packStructure: 'CellToPackCopper',
    bmsCalibration: 'RoadBalanced',
    voltageArchitecture: 400,
    coolingSystem: 'LiquidGlycol',
    underbodyShield: 'StandardSteelShield',
    priceTier: 'Premium',
    referenceClass: 'Sport',
  };

  const baseBenchForRange: ElectricHybridEngineConfigInput = {
    ...refPackSpec,
    systemType: 'PureEV',
    electricMotorType: 'PermanentMagnetSync',
    motorLayout: 'SingleMotor_RWD',
    motorCount: 1,
    hasFrontDisconnect: false,
    statorDiameterMm: 225,
    rotorLengthMm: 165,
    inverterTech: 'SiliconCarbide_SiC',
    statorWinding: 'HairpinFlat',
    inverterPowerElectronics: 'SiliconCarbide_SiC',
    rotorSleeveBearing: 'InconelSleeveHybrid',
    rotorMagnetMaterial: 'NeodymiumNdFeB',
    motorHousing: 'DieCastAluminum',
    gearboxType: 'SingleSpeedDirect',
    gearRatio: 9.0,
    maxMotorRpm: 16000,
    priceTier: 'Premium',
    referenceClass: 'Sport',
  };

  // Sweep capacita 1 -> 150 kWh (peso, kW, autonomia strettamente crescenti)
  const capSweep = [1, 2, 5, 10, 20, 40, 60, 80, 100, 125, 150];
  let prevW = -1;
  let prevKw = -1;
  let prevRange = -1;
  for (const kwh of capSweep) {
    const p = calculateBatteryPackMetrics({ ...refPackSpec, batteryCapacityKwh: kwh }, 'PureEV');
    const dyno = simulateElectricHybridDyno({ ...baseBenchForRange, batteryCapacityKwh: kwh });
    const rangeKm = dyno.specs.estimatedRangeKm ?? 0;
    if (p.weightKg <= prevW || p.maxDischargePowerKw <= prevKw || rangeKm <= prevRange) {
      failures++;
      console.error(
        `FAIL Monotonicità capacità a ${kwh} kWh: Peso=${p.weightKg} (prev ${prevW}), kW=${p.maxDischargePowerKw} (prev ${prevKw}), Range=${rangeKm} (prev ${prevRange})`,
      );
    }
    prevW = p.weightKg;
    prevKw = p.maxDischargePowerKw;
    prevRange = rangeKm;
  }
  console.log(`Sweep 1 -> 150 kWh: finale 150 kWh -> Peso=${prevW} kg, Scarica=${prevKw} kW, Autonomia=${prevRange} km`);

  // BMS ordering
  const bCons = calculateBatteryPackMetrics({ ...refPackSpec, bmsCalibration: 'ConservativeLongevity' }, 'PureEV');
  const bRoad = calculateBatteryPackMetrics({ ...refPackSpec, bmsCalibration: 'RoadBalanced' }, 'PureEV');
  const bPerf = calculateBatteryPackMetrics({ ...refPackSpec, bmsCalibration: 'PerformanceSport' }, 'PureEV');
  const bRace = calculateBatteryPackMetrics({ ...refPackSpec, bmsCalibration: 'RaceExtreme' }, 'PureEV');
  console.log(
    `Ordine BMS (75 kWh): Cons=${bCons.maxDischargePowerKw} < Road=${bRoad.maxDischargePowerKw} < Perf=${bPerf.maxDischargePowerKw} < Race=${bRace.maxDischargePowerKw} kW (+${(((bRoad.maxDischargePowerKw / bCons.maxDischargePowerKw) - 1) * 100).toFixed(1)}% Cons->Road)`,
  );
  if (
    !(
      bCons.maxDischargePowerKw < bRoad.maxDischargePowerKw &&
      bRoad.maxDischargePowerKw >= bCons.maxDischargePowerKw * 1.25 &&
      bRoad.maxDischargePowerKw < bPerf.maxDischargePowerKw &&
      bPerf.maxDischargePowerKw < bRace.maxDischargePowerKw
    )
  ) {
    failures++;
    console.error(
      `FAIL: Ordine o separazione minima scarica BMS non rispettata (atteso Road >= Cons * 1.25, ottenuto ${bRoad.maxDischargePowerKw} vs ${bCons.maxDischargePowerKw})!`,
    );
  }

  // Voltage ordering
  const v400 = calculateBatteryPackMetrics({ ...refPackSpec, voltageArchitecture: 400 }, 'PureEV');
  const v800 = calculateBatteryPackMetrics({ ...refPackSpec, voltageArchitecture: 800 }, 'PureEV');
  const v1000 = calculateBatteryPackMetrics({ ...refPackSpec, voltageArchitecture: 1000 }, 'PureEV');
  console.log(
    `Ordine Tensione (75 kWh): 400V=${v400.maxDischargePowerKw} < 800V=${v800.maxDischargePowerKw} < 1000V=${v1000.maxDischargePowerKw} kW (+${(((v1000.maxDischargePowerKw / v800.maxDischargePowerKw) - 1) * 100).toFixed(1)}% 800V->1000V)`,
  );
  if (
    !(
      v400.maxDischargePowerKw < v800.maxDischargePowerKw &&
      v800.maxDischargePowerKw < v1000.maxDischargePowerKw &&
      v1000.maxDischargePowerKw >= v800.maxDischargePowerKw * 1.1
    )
  ) {
    failures++;
    console.error(
      `FAIL: Ordine o separazione minima scarica tensione 400V < 800V < 1000V (>=+10% 800V->1000V) non rispettato (ottenuto ${v1000.maxDischargePowerKw} vs ${v800.maxDischargePowerKw})!`,
    );
  }

  // Cooling ordering
  const cAir = calculateBatteryPackMetrics({ ...refPackSpec, coolingSystem: 'Air' }, 'PureEV');
  const cLiq = calculateBatteryPackMetrics({ ...refPackSpec, coolingSystem: 'LiquidGlycol' }, 'PureEV');
  const cDir = calculateBatteryPackMetrics({ ...refPackSpec, coolingSystem: 'DirectDielectric' }, 'PureEV');
  console.log(
    `Ordine Cooling (75 kWh): Air=${cAir.maxDischargePowerKw} < Liquid=${cLiq.maxDischargePowerKw} < Direct=${cDir.maxDischargePowerKw} kW`,
  );
  if (!(cAir.maxDischargePowerKw < cLiq.maxDischargePowerKw && cLiq.maxDischargePowerKw < cDir.maxDischargePowerKw)) {
    failures++;
    console.error('FAIL: Ordine scarica cooling Air < LiquidGlycol < DirectDielectric non rispettato!');
  }

  // Micro-pack 1.5 kWh BMS ordering (NMC811, ModularAluminum, LiquidGlycol, FullHybrid)
  const microBaseSpec: BatteryPackSpec = {
    batteryCapacityKwh: 1.5,
    batteryChemistry: 'NMC811',
    packStructure: 'ModularAluminum',
    bmsCalibration: 'RoadBalanced',
    voltageArchitecture: 400,
    coolingSystem: 'LiquidGlycol',
    underbodyShield: 'StandardSteelShield',
    priceTier: 'Premium',
    referenceClass: 'Sport',
  };
  const mCons = calculateBatteryPackMetrics({ ...microBaseSpec, bmsCalibration: 'ConservativeLongevity' }, 'FullHybrid');
  const mRoad = calculateBatteryPackMetrics({ ...microBaseSpec, bmsCalibration: 'RoadBalanced' }, 'FullHybrid');
  const mPerf = calculateBatteryPackMetrics({ ...microBaseSpec, bmsCalibration: 'PerformanceSport' }, 'FullHybrid');
  const mRace = calculateBatteryPackMetrics({ ...microBaseSpec, bmsCalibration: 'RaceExtreme' }, 'FullHybrid');
  console.log(
    `Ordine BMS Micro (1.5 kWh): Cons=${mCons.maxDischargePowerKw} < Road=${mRoad.maxDischargePowerKw} < Perf=${mPerf.maxDischargePowerKw} < Race=${mRace.maxDischargePowerKw} kW`,
  );
  if (
    !(
      mCons.maxDischargePowerKw < mRoad.maxDischargePowerKw &&
      mRoad.maxDischargePowerKw < mPerf.maxDischargePowerKw &&
      mPerf.maxDischargePowerKw < mRace.maxDischargePowerKw
    )
  ) {
    failures++;
    console.error('FAIL: Ordine scarica BMS micro-pacco 1.5 kWh non monotono!');
  }

  // Weight ordering CTC < CTP < ModularAluminum at 75 kWh
  const wCtc = calculateBatteryPackMetrics({ ...refPackSpec, packStructure: 'CellToChassisCTC' }, 'PureEV');
  const wCtp = calculateBatteryPackMetrics({ ...refPackSpec, packStructure: 'CellToPackCopper' }, 'PureEV');
  const wMod = calculateBatteryPackMetrics({ ...refPackSpec, packStructure: 'ModularAluminum' }, 'PureEV');
  console.log(
    `Ordine Peso Struttura (75 kWh): CTC=${wCtc.weightKg} kg <= CTP=${wCtp.weightKg} kg < ModAl=${wMod.weightKg} kg`,
  );
  if (!(wCtc.weightKg <= wCtp.weightKg && wCtp.weightKg < wMod.weightKg)) {
    failures++;
    console.error('FAIL: Ordine peso struttura stradale CellToChassisCTC <= CellToPackCopper < ModularAluminum non rispettato!');
  }

  // Vincoli tassativi di certificazione 60 pacchi
  if (outKg8 > 0 || outKw8 > 0) {
    failures++;
    console.error(
      `FAIL: Superata tolleranza outlier ±8.0%: Peso=${outKg8}/${n}, Scarica=${outKw8}/${n}.`,
    );
  }
  if (meanKgPct >= 3.0 || meanKwPct >= 4.0) {
    failures++;
    console.error(
      `FAIL: Errori medi fuori target (<3.0% Peso, <4.0% Scarica): Peso=${meanKgPct.toFixed(2)}%, Scarica=${meanKwPct.toFixed(2)}%.`,
    );
  }

  if (failures > 0) {
    console.error(`\nCERTIFICAZIONE BATTERIA FALLITA CON ${failures} ERRORI.`);
    process.exit(1);
  }
  console.log(
    `\nCERTIFICAZIONE BATTERIA COMPLETATA (${n} pacchi): 0 errori di monotonicità | Outlier >±8.0%: ${outKg8} Peso / ${outKw8} kW.`,
  );
}

runBatteryDiagnostic();
