import {
  calculateWankelGeometryAndDimensions,
  simulateWankelEngineDyno,
  type WankelEngineConfigInput,
} from './wankelMath';

export interface RotaryBenchmarkCase {
  year: number;
  name: string;
  realCc: number;
  realHp: number;
  realHpRpm: number;
  realNm: number;
  realNmRpm: number;
  realWeightKg: number;
  realReliabilityRange: [number, number];
  config: WankelEngineConfigInput;
}

const BASE_ROTARY: Omit<
  WankelEngineConfigInput,
  | 'rotorCount'
  | 'generatingRadiusMm'
  | 'eccentricityMm'
  | 'rotorWidthMm'
  | 'compressionRatio'
  | 'manualRedlineRpm'
  | 'priceTier'
  | 'referenceClass'
  | 'intendedOrientation'
  | 'apexSealMaterialId'
  | 'apexSealThicknessMm'
  | 'housingMaterialId'
  | 'oilMeteringSystemId'
  | 'portType'
  | 'fuelType'
  | 'catalystEra'
> = {
  turboType: 'NaturallyAspirated',
  turboCountConfig: 'SingleTurbo',
  turboBearingType: 'Journal',
  turboArRatio: 0.55,
  turboStagesArRatios: [0.55],
  boostPressureBar: 0,
  turboPosition: 'Lateral',
};

export const HISTORICAL_ROTARY_BENCHMARKS: RotaryBenchmarkCase[] = [
  {
    year: 1964,
    name: 'NSU KKM 502 (Wankel Spider)',
    realCc: 498,
    realHp: 50,
    realHpRpm: 6000,
    realNm: 72,
    realNmRpm: 2500,
    realWeightKg: 68,
    realReliabilityRange: [72, 80],
    config: {
      ...BASE_ROTARY,
      rotorCount: 1,
      generatingRadiusMm: 100,
      eccentricityMm: 14.0,
      rotorWidthMm: 67,
      compressionRatio: 8.6,
      manualRedlineRpm: 6500,
      priceTier: 'Media',
      referenceClass: 'Normale',
      intendedOrientation: 'Longitudinale',
      apexSealMaterialId: 'seal-chilled-cast-iron',
      apexSealThicknessMm: 3.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-mechanical',
      portType: 'PeripheralPort',
      fuelType: 'Benzina',
      catalystEra: 'None',
    },
  },
  {
    year: 1967,
    name: 'Mazda 10A 0813 (Cosmo Sport L10B)',
    realCc: 982,
    realHp: 128,
    realHpRpm: 7000,
    realNm: 140,
    realNmRpm: 5000,
    realWeightKg: 102,
    realReliabilityRange: [80, 87],
    config: {
      ...BASE_ROTARY,
      rotorCount: 2,
      generatingRadiusMm: 105,
      eccentricityMm: 15.0,
      rotorWidthMm: 60,
      compressionRatio: 9.4,
      manualRedlineRpm: 7500,
      priceTier: 'Premium',
      referenceClass: 'Sport',
      intendedOrientation: 'Longitudinale',
      apexSealMaterialId: 'seal-carbon-aluminum',
      apexSealThicknessMm: 3.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-mechanical',
      portType: 'StandardSide',
      fuelType: 'Benzina',
      catalystEra: 'None',
    },
  },
  {
    year: 1967,
    name: 'NSU KKM 612 (Ro 80)',
    realCc: 995,
    realHp: 115,
    realHpRpm: 5500,
    realNm: 159,
    realNmRpm: 4500,
    realWeightKg: 103,
    realReliabilityRange: [68, 78],
    config: {
      ...BASE_ROTARY,
      rotorCount: 2,
      generatingRadiusMm: 100,
      eccentricityMm: 14.0,
      rotorWidthMm: 67,
      compressionRatio: 9.0,
      manualRedlineRpm: 6500,
      priceTier: 'Premium',
      referenceClass: 'Comfort',
      intendedOrientation: 'Longitudinale',
      apexSealMaterialId: 'seal-chilled-cast-iron',
      apexSealThicknessMm: 3.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-mechanical',
      portType: 'SemiPeripheral',
      fuelType: 'Benzina',
      catalystEra: 'Era1_Oxidizing_70s',
    },
  },
  {
    year: 1969,
    name: 'Mazda 13A (R130 Luce)',
    realCc: 1310,
    realHp: 126,
    realHpRpm: 6000,
    realNm: 172,
    realNmRpm: 3500,
    realWeightKg: 118,
    realReliabilityRange: [78, 85],
    config: {
      ...BASE_ROTARY,
      rotorCount: 2,
      generatingRadiusMm: 120,
      eccentricityMm: 17.5,
      rotorWidthMm: 60,
      compressionRatio: 9.1,
      manualRedlineRpm: 6500,
      priceTier: 'Premium',
      referenceClass: 'Comfort',
      intendedOrientation: 'Longitudinale',
      apexSealMaterialId: 'seal-carbon-aluminum',
      apexSealThicknessMm: 3.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-mechanical',
      portType: 'StandardSide',
      fuelType: 'Benzina',
      catalystEra: 'None',
    },
  },
  {
    year: 1969,
    name: 'Mercedes-Benz M950F (C111-I)',
    realCc: 1800,
    realHp: 280,
    realHpRpm: 7000,
    realNm: 294,
    realNmRpm: 5000,
    realWeightKg: 150,
    realReliabilityRange: [75, 83],
    config: {
      ...BASE_ROTARY,
      rotorCount: 3,
      generatingRadiusMm: 103,
      eccentricityMm: 15.0,
      rotorWidthMm: 75,
      compressionRatio: 9.3,
      manualRedlineRpm: 7500,
      priceTier: 'Lusso',
      referenceClass: 'Sport',
      intendedOrientation: 'Trasversale',
      apexSealMaterialId: 'seal-chilled-cast-iron',
      apexSealThicknessMm: 3.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-mechanical',
      portType: 'PeripheralPort',
      fuelType: 'Benzina',
      catalystEra: 'None',
    },
  },
  {
    year: 1970,
    name: 'Mercedes-Benz M950/4 KE409 (C111-II)',
    realCc: 2400,
    realHp: 350,
    realHpRpm: 7000,
    realNm: 392,
    realNmRpm: 4500,
    realWeightKg: 180,
    realReliabilityRange: [74, 82],
    config: {
      ...BASE_ROTARY,
      rotorCount: 4,
      generatingRadiusMm: 103,
      eccentricityMm: 15.0,
      rotorWidthMm: 75,
      compressionRatio: 9.3,
      manualRedlineRpm: 7500,
      priceTier: 'Lusso',
      referenceClass: 'Sport',
      intendedOrientation: 'Longitudinale',
      apexSealMaterialId: 'seal-chilled-cast-iron',
      apexSealThicknessMm: 3.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-mechanical',
      portType: 'PeripheralPort',
      fuelType: 'Benzina',
      catalystEra: 'None',
    },
  },
  {
    year: 1973,
    name: 'Comotor 624 (Citroën GS Birotor)',
    realCc: 995,
    realHp: 107,
    realHpRpm: 6500,
    realNm: 137,
    realNmRpm: 3000,
    realWeightKg: 105,
    realReliabilityRange: [76, 84],
    config: {
      ...BASE_ROTARY,
      rotorCount: 2,
      generatingRadiusMm: 100,
      eccentricityMm: 14.0,
      rotorWidthMm: 67,
      compressionRatio: 9.0,
      manualRedlineRpm: 7000,
      priceTier: 'Media',
      referenceClass: 'Comfort',
      intendedOrientation: 'Trasversale',
      apexSealMaterialId: 'seal-chilled-cast-iron',
      apexSealThicknessMm: 3.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-mechanical',
      portType: 'StandardSide',
      fuelType: 'Benzina',
      catalystEra: 'Era1_Oxidizing_70s',
    },
  },
  {
    year: 1978,
    name: 'Mazda 12A (RX-7 FB)',
    realCc: 1146,
    realHp: 115,
    realHpRpm: 6000,
    realNm: 152,
    realNmRpm: 4000,
    realWeightKg: 115,
    realReliabilityRange: [85, 92],
    config: {
      ...BASE_ROTARY,
      rotorCount: 2,
      generatingRadiusMm: 105,
      eccentricityMm: 15.0,
      rotorWidthMm: 70,
      compressionRatio: 9.4,
      manualRedlineRpm: 7000,
      priceTier: 'Media',
      referenceClass: 'Sport',
      intendedOrientation: 'Longitudinale',
      apexSealMaterialId: 'seal-chilled-cast-iron',
      apexSealThicknessMm: 3.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-mechanical',
      portType: 'StandardSide',
      fuelType: 'Benzina',
      catalystEra: 'Era1_Oxidizing_70s',
    },
  },
  {
    year: 1984,
    name: 'Mazda 13B-RESI (RX-7 FB GSL-SE)',
    realCc: 1308,
    realHp: 135,
    realHpRpm: 6000,
    realNm: 186,
    realNmRpm: 4000,
    realWeightKg: 122,
    realReliabilityRange: [86, 92],
    config: {
      ...BASE_ROTARY,
      rotorCount: 2,
      generatingRadiusMm: 105,
      eccentricityMm: 15.0,
      rotorWidthMm: 80,
      compressionRatio: 9.4,
      manualRedlineRpm: 7000,
      priceTier: 'Media',
      referenceClass: 'Sport',
      intendedOrientation: 'Longitudinale',
      apexSealMaterialId: 'seal-chilled-cast-iron',
      apexSealThicknessMm: 3.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-mechanical',
      portType: 'StandardSide',
      fuelType: 'Benzina',
      catalystEra: 'Era1_Oxidizing_70s',
    },
  },
  {
    year: 1983,
    name: 'Mazda 12A Turbo (RX-7 SA22C GT-Turbo)',
    realCc: 1146,
    realHp: 165,
    realHpRpm: 6500,
    realNm: 226,
    realNmRpm: 4000,
    realWeightKg: 134,
    realReliabilityRange: [80, 87],
    config: {
      ...BASE_ROTARY,
      rotorCount: 2,
      generatingRadiusMm: 105,
      eccentricityMm: 15.0,
      rotorWidthMm: 70,
      compressionRatio: 8.5,
      manualRedlineRpm: 7000,
      priceTier: 'Premium',
      referenceClass: 'Sport',
      intendedOrientation: 'Longitudinale',
      apexSealMaterialId: 'seal-chilled-cast-iron',
      apexSealThicknessMm: 3.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-mechanical',
      portType: 'StandardSide',
      fuelType: 'Benzina',
      turboType: 'SingleScroll',
      turboCountConfig: 'SingleTurbo',
      turboBearingType: 'Journal',
      turboArRatio: 0.50,
      turboStagesArRatios: [0.50],
      boostPressureBar: 0.50,
      catalystEra: 'Era1_Oxidizing_70s',
    },
  },
  {
    year: 1983,
    name: 'AvtoVAZ VAZ-415 (Samara RPD)',
    realCc: 1308,
    realHp: 140,
    realHpRpm: 6000,
    realNm: 186,
    realNmRpm: 4500,
    realWeightKg: 126,
    realReliabilityRange: [70, 78],
    config: {
      ...BASE_ROTARY,
      rotorCount: 2,
      generatingRadiusMm: 105,
      eccentricityMm: 15.0,
      rotorWidthMm: 80,
      compressionRatio: 9.4,
      manualRedlineRpm: 7000,
      priceTier: 'Economica',
      referenceClass: 'Sport',
      intendedOrientation: 'Trasversale',
      apexSealMaterialId: 'seal-chilled-cast-iron',
      apexSealThicknessMm: 3.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-mechanical',
      portType: 'StandardSide',
      fuelType: 'Benzina',
      catalystEra: 'None',
    },
  },
  {
    year: 1989,
    name: 'Mazda 13B-DEI 6-Port (RX-7 FC S5 N/A)',
    realCc: 1308,
    realHp: 160,
    realHpRpm: 6500,
    realNm: 191,
    realNmRpm: 4000,
    realWeightKg: 125,
    realReliabilityRange: [86, 92],
    config: {
      ...BASE_ROTARY,
      rotorCount: 2,
      generatingRadiusMm: 105,
      eccentricityMm: 15.0,
      rotorWidthMm: 80,
      compressionRatio: 9.7,
      manualRedlineRpm: 8000,
      priceTier: 'Premium',
      referenceClass: 'Sport',
      intendedOrientation: 'Longitudinale',
      apexSealMaterialId: 'seal-chilled-cast-iron',
      apexSealThicknessMm: 2.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-electronic-mikuni',
      portType: 'StreetPort',
      fuelType: 'Benzina',
      catalystEra: 'Era2_ThreeWayLambda_80s90s',
    },
  },
  {
    year: 1989,
    name: 'Mazda 13B-T Twin-Scroll (RX-7 FC S5 Turbo II)',
    realCc: 1308,
    realHp: 200,
    realHpRpm: 6500,
    realNm: 265,
    realNmRpm: 3500,
    realWeightKg: 148,
    realReliabilityRange: [82, 88],
    config: {
      ...BASE_ROTARY,
      rotorCount: 2,
      generatingRadiusMm: 105,
      eccentricityMm: 15.0,
      rotorWidthMm: 80,
      compressionRatio: 9.0,
      manualRedlineRpm: 7500,
      priceTier: 'Premium',
      referenceClass: 'Sport',
      intendedOrientation: 'Longitudinale',
      apexSealMaterialId: 'seal-chilled-cast-iron',
      apexSealThicknessMm: 2.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-electronic-mikuni',
      portType: 'StandardSide',
      fuelType: 'Benzina',
      turboType: 'TwinScroll',
      turboCountConfig: 'SingleTurbo',
      turboBearingType: 'Journal',
      turboArRatio: 0.55,
      turboStagesArRatios: [0.55],
      boostPressureBar: 0.60,
      catalystEra: 'Era2_ThreeWayLambda_80s90s',
    },
  },
  {
    year: 1987,
    name: 'Mazda 13G 3-Rotori (757 Le Mans)',
    realCc: 1962,
    realHp: 450,
    realHpRpm: 8500,
    realNm: 392,
    realNmRpm: 7000,
    realWeightKg: 142,
    realReliabilityRange: [78, 86],
    config: {
      ...BASE_ROTARY,
      rotorCount: 3,
      generatingRadiusMm: 105,
      eccentricityMm: 15.0,
      rotorWidthMm: 80,
      compressionRatio: 10.0,
      manualRedlineRpm: 9500,
      priceTier: 'Lusso',
      referenceClass: 'Corsa',
      intendedOrientation: 'Longitudinale',
      apexSealMaterialId: 'seal-carbon-aluminum',
      apexSealThicknessMm: 2.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-premix-aviation',
      portType: 'PeripheralPort',
      fuelType: 'RaceFuel',
      catalystEra: 'None',
    },
  },
  {
    year: 1990,
    name: 'Mazda 20B-REW (Eunos Cosmo Twin-Turbo)',
    realCc: 1962,
    realHp: 300,
    realHpRpm: 6500,
    realNm: 402,
    realNmRpm: 3000,
    realWeightKg: 195,
    realReliabilityRange: [81, 87],
    config: {
      ...BASE_ROTARY,
      rotorCount: 3,
      generatingRadiusMm: 105,
      eccentricityMm: 15.0,
      rotorWidthMm: 80,
      compressionRatio: 9.0,
      manualRedlineRpm: 7500,
      priceTier: 'Lusso',
      referenceClass: 'Sport',
      intendedOrientation: 'Longitudinale',
      apexSealMaterialId: 'seal-tool-steel-dlc',
      apexSealThicknessMm: 2.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-electronic-mikuni',
      portType: 'StandardSide',
      fuelType: 'Benzina',
      turboType: 'SingleScroll',
      turboCountConfig: 'TwinTurbo',
      turboBearingType: 'Journal',
      turboArRatio: 0.52,
      turboStagesArRatios: [0.42, 0.62],
      boostPressureBar: 0.70,
      catalystEra: 'Era2_ThreeWayLambda_80s90s',
    },
  },
  {
    year: 1991,
    name: 'Mazda R26B 4-Rotori (787B Le Mans)',
    realCc: 2616,
    realHp: 700,
    realHpRpm: 9000,
    realNm: 608,
    realNmRpm: 6500,
    realWeightKg: 180,
    realReliabilityRange: [82, 90],
    config: {
      ...BASE_ROTARY,
      rotorCount: 4,
      generatingRadiusMm: 105,
      eccentricityMm: 15.0,
      rotorWidthMm: 80,
      compressionRatio: 10.0,
      manualRedlineRpm: 9500,
      priceTier: 'Lusso',
      referenceClass: 'Corsa',
      intendedOrientation: 'Longitudinale',
      apexSealMaterialId: 'seal-ceramic-si3n4',
      apexSealThicknessMm: 2.0,
      housingMaterialId: 'whs-billet-alu-ceramic',
      oilMeteringSystemId: 'omp-premix-aviation',
      portType: 'PeripheralPort',
      fuelType: 'RaceFuel',
      catalystEra: 'None',
    },
  },
  {
    year: 1999,
    name: 'Mazda 13B-REW (RX-7 FD3S Spirit R)',
    realCc: 1308,
    realHp: 280,
    realHpRpm: 6500,
    realNm: 314,
    realNmRpm: 5000,
    realWeightKg: 148,
    realReliabilityRange: [79, 86],
    config: {
      ...BASE_ROTARY,
      rotorCount: 2,
      generatingRadiusMm: 105,
      eccentricityMm: 15.0,
      rotorWidthMm: 80,
      compressionRatio: 9.0,
      manualRedlineRpm: 8200,
      priceTier: 'Premium',
      referenceClass: 'Sport',
      intendedOrientation: 'Longitudinale',
      apexSealMaterialId: 'seal-tool-steel-dlc',
      apexSealThicknessMm: 2.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-electronic-mikuni',
      portType: 'StreetPort',
      fuelType: 'Benzina',
      turboType: 'TwinScroll',
      turboCountConfig: 'TwinTurbo',
      turboBearingType: 'BallBearing',
      turboArRatio: 0.54,
      turboStagesArRatios: [0.44, 0.64],
      boostPressureBar: 0.85,
      catalystEra: 'Era2_ThreeWayLambda_80s90s',
    },
  },
  {
    year: 2003,
    name: 'Mazda 13B-MSP Renesis (RX-8 High Power)',
    realCc: 1308,
    realHp: 231,
    realHpRpm: 8500,
    realNm: 211,
    realNmRpm: 5500,
    realWeightKg: 124,
    realReliabilityRange: [80, 87],
    config: {
      ...BASE_ROTARY,
      rotorCount: 2,
      generatingRadiusMm: 105,
      eccentricityMm: 15.0,
      rotorWidthMm: 80,
      compressionRatio: 10.0,
      manualRedlineRpm: 9000,
      priceTier: 'Premium',
      referenceClass: 'Sport',
      intendedOrientation: 'Longitudinale',
      apexSealMaterialId: 'seal-tool-steel-dlc',
      apexSealThicknessMm: 2.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-electronic-mikuni',
      portType: 'StreetPort',
      fuelType: 'Benzina',
      catalystEra: 'Era3_MultiStage_DPF_SCR_2000s',
    },
  },
  {
    year: 2023,
    name: 'Mazda 8C e-Skyactiv R-EV (MX-30 R-EV)',
    realCc: 830,
    realHp: 75,
    realHpRpm: 4700,
    realNm: 116,
    realNmRpm: 4000,
    realWeightKg: 72,
    realReliabilityRange: [88, 94],
    config: {
      ...BASE_ROTARY,
      rotorCount: 1,
      generatingRadiusMm: 120,
      eccentricityMm: 17.5,
      rotorWidthMm: 76,
      compressionRatio: 11.9,
      manualRedlineRpm: 5500,
      priceTier: 'Media',
      referenceClass: 'Normale',
      intendedOrientation: 'Trasversale',
      apexSealMaterialId: 'seal-tool-steel-dlc',
      apexSealThicknessMm: 2.0,
      housingMaterialId: 'whs-alu-cermet-nikasil',
      oilMeteringSystemId: 'omp-electronic-mikuni',
      portType: 'StandardSide',
      fuelType: 'Benzina',
      catalystEra: 'Era4_ActiveGlobalFilter_Euro7',
    },
  },
];

function runRotaryDiagnostic() {
  let sumAbsHp = 0;
  let sumAbsNm = 0;
  let sumAbsKg = 0;
  let sumAbsKgPct = 0;
  let outliersHp = 0;
  let outliersNm = 0;
  let outliersKg = 0;
  let relInRange = 0;

  console.log(
    '| # | Anno | Motore | CC Sim / Reale | CV Sim @ RPM vs Reale (Err%) | Nm Sim @ RPM vs Reale (Err%) | Peso Sim / Reale (Diff) | Affidabilità Sim / Target |',
  );
  console.log('| :---: | :---: | :--- | :---: | :--- | :--- | :--- | :--- |');

  HISTORICAL_ROTARY_BENCHMARKS.forEach((b, i) => {
    const geom = calculateWankelGeometryAndDimensions(b.config);
    const sim = simulateWankelEngineDyno(b.config);
    const errHp = ((sim.peakPowerHp - b.realHp) / b.realHp) * 100;
    const errNm = ((sim.peakTorqueNm - b.realNm) / b.realNm) * 100;
    const diffKg = sim.dryWeightKg - b.realWeightKg;
    const diffKgPct = (diffKg / b.realWeightKg) * 100;

    sumAbsHp += Math.abs(errHp);
    sumAbsNm += Math.abs(errNm);
    sumAbsKg += Math.abs(diffKg);
    sumAbsKgPct += Math.abs(diffKgPct);
    if (Math.abs(errHp) > 5.0) outliersHp++;
    if (Math.abs(errNm) > 5.0) outliersNm++;
    if (Math.abs(diffKgPct) > 15.0) outliersKg++;

    const [rMin, rMax] = b.realReliabilityRange;
    const relOk = sim.reliabilityPercent >= rMin && sim.reliabilityPercent <= rMax;
    if (relOk) relInRange++;
    const relStatus = relOk
      ? 'OK'
      : sim.reliabilityPercent < rMin
        ? `${(sim.reliabilityPercent - rMin).toFixed(1)}pp`
        : `+${(sim.reliabilityPercent - rMax).toFixed(1)}pp`;

    console.log(
      `| ${i + 1} | ${b.year} | ${b.name} | ${geom.totalDisplacementCc} / ${b.realCc} cc | ${sim.peakPowerHp} @ ${sim.peakPowerRpm} vs ${b.realHp} @ ${b.realHpRpm} (${errHp >= 0 ? '+' : ''}${errHp.toFixed(1)}%) | ${sim.peakTorqueNm} @ ${sim.peakTorqueRpm} vs ${b.realNm} @ ${b.realNmRpm} (${errNm >= 0 ? '+' : ''}${errNm.toFixed(1)}%) | ${sim.dryWeightKg} / ${b.realWeightKg} kg (${diffKg >= 0 ? '+' : ''}${diffKg.toFixed(0)} kg, ${diffKgPct >= 0 ? '+' : ''}${diffKgPct.toFixed(1)}%) | ${sim.reliabilityPercent.toFixed(1)}% / ${rMin}-${rMax}% (${relStatus}) |`,
    );
  });

  const n = HISTORICAL_ROTARY_BENCHMARKS.length;
  console.log('\n=== RIEPILOGO BASELINE WANKEL (19 MOTORI) ===');
  console.log(
    `CV: Media |Err| = ${(sumAbsHp / n).toFixed(2)}% | Outlier (> ±5%): ${outliersHp}/${n}`,
  );
  console.log(
    `Nm: Media |Err| = ${(sumAbsNm / n).toFixed(2)}% | Outlier (> ±5%): ${outliersNm}/${n}`,
  );
  console.log(
    `Peso: Media |Diff| = ${(sumAbsKg / n).toFixed(1)} kg (${(sumAbsKgPct / n).toFixed(1)}%) | Outlier (> ±15%): ${outliersKg}/${n}`,
  );
  console.log(`Affidabilità: In Range ${relInRange}/${n}`);

  console.log('\n=== TEST INVARIANZA rpmLimit WANKEL (7500 vs 10000 rpm) ===');
  const invTargets = [
    HISTORICAL_ROTARY_BENCHMARKS[16], // 13B-REW
    HISTORICAL_ROTARY_BENCHMARKS[17], // 13B-MSP
    HISTORICAL_ROTARY_BENCHMARKS[15], // R26B
  ];
  for (const t of invTargets) {
    const rLow = simulateWankelEngineDyno({ ...t.config, manualRedlineRpm: 7500 });
    const rHigh = simulateWankelEngineDyno({ ...t.config, manualRedlineRpm: 10000 });
    let maxDeltaNm = 0;
    let maxDeltaHp = 0;
    for (const pLow of rLow.curve) {
      const pHigh = rHigh.curve.find((p) => p.rpm === pLow.rpm);
      if (pHigh) {
        maxDeltaNm = Math.max(maxDeltaNm, Math.abs(pHigh.torqueNm - pLow.torqueNm));
        maxDeltaHp = Math.max(maxDeltaHp, Math.abs(pHigh.powerHp - pLow.powerHp));
      }
    }
    const status = maxDeltaNm === 0 && maxDeltaHp === 0 ? 'OK' : 'ELASTICO!';
    console.log(
      `[${status}] ${t.name} | maxΔNm=${maxDeltaNm}, maxΔHP=${maxDeltaHp} | pkP: ${rLow.peakPowerHp}HP@${rLow.peakPowerRpm} vs ${rHigh.peakPowerHp}HP@${rHigh.peakPowerRpm} | Rel: ${rLow.reliabilityPercent}% -> ${rHigh.reliabilityPercent}%`,
    );
  }
}

runRotaryDiagnostic();
