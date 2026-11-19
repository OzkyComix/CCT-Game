import { calculateBodyAeroMetrics } from './bodyAeroMath';
import { calculateChassisMetrics } from './chassisMath';
import type { BodyAeroConfig, ChassisEntity } from '../types/gameTypes';

interface VehicleAeroCase {
  id: number;
  name: string;
  year: number;
  realCx: number;
  /** Per auto con aero attiva, target High-Downforce opzionale oltre a realCx (Low-Drag) */
  realCxHigh?: number;
  realFrontalAreaM2: number;
  realDf200Kg?: number;
  checkDfMaxZero?: boolean;
  checkDfExact?: boolean;
  chassisDims: {
    lengthMm: number;
    widthMm: number;
    heightMm: number;
    wheelbaseMm: number;
    frontTrackMm: number;
    rearTrackMm: number;
    groundClearanceMm: number;
    structureId: string;
  };
  bodyConfig: Omit<BodyAeroConfig, 'id' | 'name' | 'chassisId' | 'year'>;
}

function makeBenchChassis(v: VehicleAeroCase): ChassisEntity {
  const cRes = calculateChassisMetrics(
    {
      structureId: v.chassisDims.structureId,
      overallDimensionsMm: {
        lengthMm: v.chassisDims.lengthMm,
        widthMm: v.chassisDims.widthMm,
        heightMm: v.chassisDims.heightMm,
      },
      wheelbaseMm: v.chassisDims.wheelbaseMm,
      frontTrackMm: v.chassisDims.frontTrackMm,
      rearTrackMm: v.chassisDims.rearTrackMm,
      groundClearanceMm: v.chassisDims.groundClearanceMm,
      rigidityReinforcementPercent: 30,
      safetyStructurePercent: 55,
      supportedEnginePositions: ['Anteriore'],
      supportedEngineOrientations: ['Trasversale'],
      engineSetbackPercent: 50,
      drivetrainMode: 'FWD_Only',
      gearboxLayout: 'InBlockWithEngine',
      supportedDrivetrains: ['FWD'],
    },
    v.year,
  );
  return {
    id: `chs-aero-${v.id}`,
    name: v.name,
    codeName: `BENCH-${v.id}`,
    ownerSubBrandId: 'bench-sub',
    createdYear: v.year,
    generationNumber: 1,
    taxonomy: cRes.taxonomy,
    overallDimensionsMm: {
      lengthMm: v.chassisDims.lengthMm,
      widthMm: v.chassisDims.widthMm,
      heightMm: v.chassisDims.heightMm,
    },
    wheelbaseMm: v.chassisDims.wheelbaseMm,
    frontTrackMm: v.chassisDims.frontTrackMm,
    rearTrackMm: v.chassisDims.rearTrackMm,
    groundClearanceMm: v.chassisDims.groundClearanceMm,
    torsionalRigidityNmPerDeg: cRes.torsionalRigidityNmPerDeg,
    structuralSafetyScore: cRes.structuralSafetyScore,
    engineBayMaxDimensionsMm: cRes.engineBayMaxDimensionsMm,
    supportedEnginePositions: ['Anteriore'],
    supportedEngineOrientations: ['Trasversale'],
    engineSetbackPercent: 50,
    supportedDrivetrains: ['FWD'],
    calculatedSegment: cRes.segmentInfo.segment,
    baseWeightKg: cRes.baseWeightKg,
    unitManufacturingCost: cRes.unitManufacturingCost,
    developmentCost: cRes.developmentCost,
  };
}

const VEHICLE_CASES: VehicleAeroCase[] = [
  {
    id: 1,
    name: 'Fiat Panda 141 (1980)',
    year: 1980,
    realCx: 0.40,
    realFrontalAreaM2: 1.70,
    checkDfMaxZero: true,
    chassisDims: { lengthMm: 3380, widthMm: 1460, heightMm: 1445, wheelbaseMm: 2160, frontTrackMm: 1255, rearTrackMm: 1250, groundClearanceMm: 150, structureId: 'str-steel-stamped' },
    bodyConfig: {
      bodyStyle: 'Hatchback',
      bodyMaterialId: 'mat-steel',
      aeroRefinementPercent: 28,
      coolingAperturePercent: 40,
      passiveSafetyReinforcementPercent: 15,
      airbagPackageId: 'airbag-none',
      frontAero: { type: 'none', angleDeg: 0 },
      rearAero: { type: 'none', angleDeg: 0 },
      underbodyType: 'exposed',
      activeAeroType: 'none',
    },
  },
  {
    id: 2,
    name: 'VW Golf Mk1 (1974)',
    year: 1974,
    realCx: 0.42,
    realFrontalAreaM2: 1.84,
    chassisDims: { lengthMm: 3705, widthMm: 1610, heightMm: 1410, wheelbaseMm: 2400, frontTrackMm: 1390, rearTrackMm: 1360, groundClearanceMm: 135, structureId: 'str-steel-stamped' },
    bodyConfig: {
      bodyStyle: 'Hatchback',
      bodyMaterialId: 'mat-steel',
      aeroRefinementPercent: 25,
      coolingAperturePercent: 40,
      passiveSafetyReinforcementPercent: 15,
      airbagPackageId: 'airbag-none',
      frontAero: { type: 'none', angleDeg: 0 },
      rearAero: { type: 'none', angleDeg: 0 },
      underbodyType: 'exposed',
      activeAeroType: 'none',
    },
  },
  {
    id: 3,
    name: 'VW Golf Mk7 (2012)',
    year: 2012,
    realCx: 0.29,
    realFrontalAreaM2: 2.19,
    chassisDims: { lengthMm: 4255, widthMm: 1799, heightMm: 1452, wheelbaseMm: 2637, frontTrackMm: 1549, rearTrackMm: 1520, groundClearanceMm: 135, structureId: 'str-uhss-steel' },
    bodyConfig: {
      bodyStyle: 'Hatchback',
      bodyMaterialId: 'mat-galvanized-hss',
      aeroRefinementPercent: 60,
      coolingAperturePercent: 30,
      passiveSafetyReinforcementPercent: 75,
      airbagPackageId: 'airbag-six-curtain',
      frontAero: { type: 'none', angleDeg: 0 },
      rearAero: { type: 'ducktail-lip', angleDeg: 2 },
      underbodyType: 'road-faired',
      activeAeroType: 'none',
    },
  },
  {
    id: 4,
    name: 'Renault Clio V (2020)',
    year: 2020,
    realCx: 0.30,
    realFrontalAreaM2: 2.12,
    chassisDims: { lengthMm: 4050, widthMm: 1798, heightMm: 1440, wheelbaseMm: 2583, frontTrackMm: 1550, rearTrackMm: 1540, groundClearanceMm: 135, structureId: 'str-uhss-steel' },
    bodyConfig: {
      bodyStyle: 'Hatchback',
      bodyMaterialId: 'mat-galvanized-hss',
      aeroRefinementPercent: 52,
      coolingAperturePercent: 35,
      passiveSafetyReinforcementPercent: 75,
      airbagPackageId: 'airbag-six-curtain',
      frontAero: { type: 'none', angleDeg: 0 },
      rearAero: { type: 'ducktail-lip', angleDeg: 2 },
      underbodyType: 'road-faired',
      activeAeroType: 'none',
    },
  },
  {
    id: 5,
    name: 'BMW Serie 3 E36 (1990)',
    year: 1990,
    realCx: 0.29,
    realFrontalAreaM2: 1.98,
    chassisDims: { lengthMm: 4433, widthMm: 1698, heightMm: 1393, wheelbaseMm: 2700, frontTrackMm: 1418, rearTrackMm: 1431, groundClearanceMm: 130, structureId: 'str-steel-stamped' },
    bodyConfig: {
      bodyStyle: 'Berlina',
      bodyMaterialId: 'mat-galvanized-hss',
      aeroRefinementPercent: 68,
      coolingAperturePercent: 28,
      passiveSafetyReinforcementPercent: 45,
      airbagPackageId: 'airbag-driver',
      frontAero: { type: 'none', angleDeg: 0 },
      rearAero: { type: 'none', angleDeg: 0 },
      underbodyType: 'exposed',
      activeAeroType: 'none',
    },
  },
  {
    id: 6,
    name: 'Alfa Romeo Giulia (2016)',
    year: 2016,
    realCx: 0.25,
    realFrontalAreaM2: 2.22,
    chassisDims: { lengthMm: 4643, widthMm: 1860, heightMm: 1436, wheelbaseMm: 2820, frontTrackMm: 1575, rearTrackMm: 1625, groundClearanceMm: 125, structureId: 'str-hybrid-giorgio' },
    bodyConfig: {
      bodyStyle: 'Berlina',
      bodyMaterialId: 'mat-alu-composite',
      aeroRefinementPercent: 70,
      coolingAperturePercent: 32,
      passiveSafetyReinforcementPercent: 85,
      airbagPackageId: 'airbag-six-curtain',
      frontAero: { type: 'road-lip', angleDeg: 2 },
      rearAero: { type: 'none', angleDeg: 0 },
      underbodyType: 'road-faired',
      activeAeroType: 'none',
    },
  },
  {
    id: 7,
    name: 'Mercedes Classe S W223 (2020)',
    year: 2020,
    realCx: 0.22,
    realFrontalAreaM2: 2.48,
    chassisDims: { lengthMm: 5179, widthMm: 1921, heightMm: 1503, wheelbaseMm: 3106, frontTrackMm: 1655, rearTrackMm: 1683, groundClearanceMm: 135, structureId: 'str-hybrid-giorgio' },
    bodyConfig: {
      bodyStyle: 'Berlina',
      bodyMaterialId: 'mat-alu-composite',
      aeroRefinementPercent: 92,
      coolingAperturePercent: 25,
      passiveSafetyReinforcementPercent: 95,
      airbagPackageId: 'airbag-ten-precrash',
      frontAero: { type: 'road-lip', angleDeg: 0 },
      rearAero: { type: 'none', angleDeg: 0 },
      underbodyType: 'road-faired',
      activeAeroType: 'none',
    },
  },
  {
    id: 8,
    name: 'Tesla Model 3 Highland (2023)',
    year: 2023,
    realCx: 0.22,
    realFrontalAreaM2: 2.22,
    chassisDims: { lengthMm: 4720, widthMm: 1849, heightMm: 1441, wheelbaseMm: 2875, frontTrackMm: 1584, rearTrackMm: 1584, groundClearanceMm: 138, structureId: 'str-uhss-steel' },
    bodyConfig: {
      bodyStyle: 'Berlina',
      bodyMaterialId: 'mat-alu-composite',
      aeroRefinementPercent: 94,
      coolingAperturePercent: 22,
      passiveSafetyReinforcementPercent: 92,
      airbagPackageId: 'airbag-ten-precrash',
      frontAero: { type: 'road-lip', angleDeg: 0 },
      rearAero: { type: 'ducktail-lip', angleDeg: 0 },
      underbodyType: 'road-faired',
      activeAeroType: 'none',
    },
  },
  {
    id: 9,
    name: 'Audi A5 Coupé (2017)',
    year: 2017,
    realCx: 0.26,
    realFrontalAreaM2: 2.18,
    chassisDims: { lengthMm: 4673, widthMm: 1846, heightMm: 1371, wheelbaseMm: 2764, frontTrackMm: 1587, rearTrackMm: 1568, groundClearanceMm: 125, structureId: 'str-uhss-steel' },
    bodyConfig: {
      bodyStyle: 'Coupé',
      bodyMaterialId: 'mat-alu-composite',
      aeroRefinementPercent: 72,
      coolingAperturePercent: 32,
      passiveSafetyReinforcementPercent: 85,
      airbagPackageId: 'airbag-six-curtain',
      frontAero: { type: 'none', angleDeg: 0 },
      rearAero: { type: 'none', angleDeg: 0 },
      underbodyType: 'road-faired',
      activeAeroType: 'none',
    },
  },
  {
    id: 10,
    name: 'BMW M4 G82 (2021)',
    year: 2021,
    realCx: 0.34,
    realFrontalAreaM2: 2.26,
    realDf200Kg: 25,
    chassisDims: { lengthMm: 4794, widthMm: 1887, heightMm: 1393, wheelbaseMm: 2857, frontTrackMm: 1617, rearTrackMm: 1605, groundClearanceMm: 120, structureId: 'str-hybrid-giorgio' },
    bodyConfig: {
      bodyStyle: 'Coupé',
      bodyMaterialId: 'mat-alu-composite',
      aeroRefinementPercent: 25,
      coolingAperturePercent: 95,
      passiveSafetyReinforcementPercent: 88,
      airbagPackageId: 'airbag-six-curtain',
      frontAero: { type: 'road-lip', angleDeg: 3 },
      rearAero: { type: 'ducktail-lip', angleDeg: 3 },
      underbodyType: 'road-faired',
      activeAeroType: 'none',
    },
  },
  {
    id: 11,
    name: 'Volvo 740 SW (1985)',
    year: 1985,
    realCx: 0.40,
    realFrontalAreaM2: 2.18,
    chassisDims: { lengthMm: 4785, widthMm: 1750, heightMm: 1435, wheelbaseMm: 2770, frontTrackMm: 1460, rearTrackMm: 1460, groundClearanceMm: 145, structureId: 'str-steel-stamped' },
    bodyConfig: {
      bodyStyle: 'Universale',
      bodyMaterialId: 'mat-steel',
      aeroRefinementPercent: 25,
      coolingAperturePercent: 42,
      passiveSafetyReinforcementPercent: 45,
      airbagPackageId: 'airbag-driver',
      frontAero: { type: 'none', angleDeg: 0 },
      rearAero: { type: 'none', angleDeg: 0 },
      underbodyType: 'exposed',
      activeAeroType: 'none',
    },
  },
  {
    id: 12,
    name: 'VW Passat Variant (2020)',
    year: 2020,
    realCx: 0.27,
    realFrontalAreaM2: 2.30,
    chassisDims: { lengthMm: 4773, widthMm: 1832, heightMm: 1482, wheelbaseMm: 2791, frontTrackMm: 1584, rearTrackMm: 1568, groundClearanceMm: 140, structureId: 'str-uhss-steel' },
    bodyConfig: {
      bodyStyle: 'Universale',
      bodyMaterialId: 'mat-galvanized-hss',
      aeroRefinementPercent: 68,
      coolingAperturePercent: 28,
      passiveSafetyReinforcementPercent: 82,
      airbagPackageId: 'airbag-six-curtain',
      frontAero: { type: 'none', angleDeg: 0 },
      rearAero: { type: 'ducktail-lip', angleDeg: 2 },
      underbodyType: 'road-faired',
      activeAeroType: 'none',
    },
  },
  {
    id: 13,
    name: 'Peugeot 3008 (2020)',
    year: 2020,
    realCx: 0.31,
    realFrontalAreaM2: 2.45,
    chassisDims: { lengthMm: 4447, widthMm: 1841, heightMm: 1624, wheelbaseMm: 2675, frontTrackMm: 1593, rearTrackMm: 1601, groundClearanceMm: 219, structureId: 'str-uhss-steel' },
    bodyConfig: {
      bodyStyle: 'Crossover',
      bodyMaterialId: 'mat-galvanized-hss',
      aeroRefinementPercent: 55,
      coolingAperturePercent: 32,
      passiveSafetyReinforcementPercent: 80,
      airbagPackageId: 'airbag-six-curtain',
      frontAero: { type: 'none', angleDeg: 0 },
      rearAero: { type: 'ducktail-lip', angleDeg: 2 },
      underbodyType: 'road-faired',
      activeAeroType: 'none',
    },
  },
  {
    id: 14,
    name: 'Tesla Model Y (2023)',
    year: 2023,
    realCx: 0.23,
    realFrontalAreaM2: 2.55,
    chassisDims: { lengthMm: 4751, widthMm: 1921, heightMm: 1624, wheelbaseMm: 2890, frontTrackMm: 1636, rearTrackMm: 1636, groundClearanceMm: 167, structureId: 'str-hybrid-giorgio' },
    bodyConfig: {
      bodyStyle: 'Crossover',
      bodyMaterialId: 'mat-alu-composite',
      aeroRefinementPercent: 99,
      coolingAperturePercent: 14,
      passiveSafetyReinforcementPercent: 94,
      airbagPackageId: 'airbag-ten-precrash',
      frontAero: { type: 'road-lip', angleDeg: 0 },
      rearAero: { type: 'ducktail-lip', angleDeg: 1 },
      underbodyType: 'road-faired',
      activeAeroType: 'none',
    },
  },
  {
    id: 15,
    name: 'Land Rover Defender 110 (1990)',
    year: 1990,
    realCx: 0.59,
    realFrontalAreaM2: 2.95,
    chassisDims: { lengthMm: 4599, widthMm: 1790, heightMm: 2035, wheelbaseMm: 2795, frontTrackMm: 1485, rearTrackMm: 1485, groundClearanceMm: 215, structureId: 'str-ladder-frame' },
    bodyConfig: {
      bodyStyle: 'SUV',
      bodyMaterialId: 'mat-aluminum',
      aeroRefinementPercent: 0,
      coolingAperturePercent: 70,
      passiveSafetyReinforcementPercent: 25,
      airbagPackageId: 'airbag-none',
      frontAero: { type: 'none', angleDeg: 0 },
      rearAero: { type: 'none', angleDeg: 0 },
      underbodyType: 'exposed',
      activeAeroType: 'none',
    },
  },
  {
    id: 16,
    name: 'Mercedes Classe G W463A (2018)',
    year: 2018,
    realCx: 0.54,
    realFrontalAreaM2: 3.18,
    chassisDims: { lengthMm: 4817, widthMm: 1931, heightMm: 1969, wheelbaseMm: 2890, frontTrackMm: 1638, rearTrackMm: 1638, groundClearanceMm: 241, structureId: 'str-ladder-frame' },
    bodyConfig: {
      bodyStyle: 'SUV',
      bodyMaterialId: 'mat-galvanized-hss',
      aeroRefinementPercent: 12,
      coolingAperturePercent: 82,
      passiveSafetyReinforcementPercent: 85,
      airbagPackageId: 'airbag-ten-precrash',
      frontAero: { type: 'none', angleDeg: 0 },
      rearAero: { type: 'none', angleDeg: 0 },
      underbodyType: 'exposed',
      activeAeroType: 'none',
    },
  },
  {
    id: 17,
    name: 'Alfa Romeo Stelvio (2018)',
    year: 2018,
    realCx: 0.32,
    realFrontalAreaM2: 2.66,
    chassisDims: { lengthMm: 4687, widthMm: 1903, heightMm: 1671, wheelbaseMm: 2818, frontTrackMm: 1612, rearTrackMm: 1650, groundClearanceMm: 200, structureId: 'str-hybrid-giorgio' },
    bodyConfig: {
      bodyStyle: 'SUV',
      bodyMaterialId: 'mat-alu-composite',
      aeroRefinementPercent: 88,
      coolingAperturePercent: 35,
      passiveSafetyReinforcementPercent: 88,
      airbagPackageId: 'airbag-six-curtain',
      frontAero: { type: 'road-lip', angleDeg: 1 },
      rearAero: { type: 'ducktail-lip', angleDeg: 2 },
      underbodyType: 'road-faired',
      activeAeroType: 'none',
    },
  },
  {
    id: 18,
    name: 'Toyota Hilux (1990)',
    year: 1990,
    realCx: 0.49,
    realFrontalAreaM2: 2.55,
    chassisDims: { lengthMm: 4920, widthMm: 1690, heightMm: 1790, wheelbaseMm: 2850, frontTrackMm: 1430, rearTrackMm: 1425, groundClearanceMm: 215, structureId: 'str-ladder-frame' },
    bodyConfig: {
      bodyStyle: 'Pickup',
      bodyMaterialId: 'mat-steel',
      aeroRefinementPercent: 60,
      coolingAperturePercent: 45,
      passiveSafetyReinforcementPercent: 30,
      airbagPackageId: 'airbag-none',
      frontAero: { type: 'none', angleDeg: 0 },
      rearAero: { type: 'none', angleDeg: 0 },
      underbodyType: 'exposed',
      activeAeroType: 'none',
    },
  },
  {
    id: 19,
    name: 'Ford F-150 (2020)',
    year: 2020,
    realCx: 0.44,
    realFrontalAreaM2: 3.15,
    chassisDims: { lengthMm: 5890, widthMm: 2029, heightMm: 1960, wheelbaseMm: 3683, frontTrackMm: 1725, rearTrackMm: 1725, groundClearanceMm: 235, structureId: 'str-ladder-frame' },
    bodyConfig: {
      bodyStyle: 'Pickup',
      bodyMaterialId: 'mat-aluminum',
      aeroRefinementPercent: 32,
      coolingAperturePercent: 35,
      passiveSafetyReinforcementPercent: 82,
      airbagPackageId: 'airbag-six-curtain',
      frontAero: { type: 'road-lip', angleDeg: 0 },
      rearAero: { type: 'none', angleDeg: 0 },
      underbodyType: 'road-faired',
      activeAeroType: 'none',
    },
  },
  {
    id: 20,
    name: 'Ferrari 488 GTB (2015)',
    year: 2015,
    realCx: 0.33,
    realFrontalAreaM2: 2.02,
    realDf200Kg: 195,
    checkDfExact: true,
    chassisDims: { lengthMm: 4568, widthMm: 1952, heightMm: 1213, wheelbaseMm: 2650, frontTrackMm: 1679, rearTrackMm: 1647, groundClearanceMm: 115, structureId: 'str-alu-spaceframe' },
    bodyConfig: {
      bodyStyle: 'Coupé Sportivo',
      bodyMaterialId: 'mat-alu-composite',
      aeroRefinementPercent: 50,
      coolingAperturePercent: 85,
      passiveSafetyReinforcementPercent: 80,
      airbagPackageId: 'airbag-six-curtain',
      frontAero: { type: 'road-lip', angleDeg: 5 },
      rearAero: { type: 'ducktail-lip', angleDeg: 16 },
      underbodyType: 'flat-floor-diffuser',
      activeAeroType: 'retractable-spoiler',
    },
  },
  {
    id: 21,
    name: 'McLaren 720S (2017)',
    year: 2017,
    realCx: 0.32,
    realCxHigh: 0.35,
    realFrontalAreaM2: 1.98,
    realDf200Kg: 175,
    checkDfExact: true,
    chassisDims: { lengthMm: 4543, widthMm: 1930, heightMm: 1196, wheelbaseMm: 2670, frontTrackMm: 1674, rearTrackMm: 1629, groundClearanceMm: 105, structureId: 'str-carbon-monocoque' },
    bodyConfig: {
      bodyStyle: 'Coupé Sportivo',
      bodyMaterialId: 'mat-carbon-prepreg',
      aeroRefinementPercent: 45,
      coolingAperturePercent: 88,
      passiveSafetyReinforcementPercent: 85,
      airbagPackageId: 'airbag-six-curtain',
      frontAero: { type: 'road-lip', angleDeg: 3 },
      rearAero: { type: 'ducktail-lip', angleDeg: 5 },
      underbodyType: 'flat-floor-diffuser',
      activeAeroType: 'full-active-airbrake',
    },
  },
  {
    id: 22,
    name: 'Ferrari 296 GTB (2022)',
    year: 2022,
    realCx: 0.33,
    realCxHigh: 0.36,
    realFrontalAreaM2: 1.99,
    realDf200Kg: 230,
    checkDfExact: true,
    chassisDims: { lengthMm: 4565, widthMm: 1958, heightMm: 1187, wheelbaseMm: 2600, frontTrackMm: 1665, rearTrackMm: 1632, groundClearanceMm: 110, structureId: 'str-alu-spaceframe' },
    bodyConfig: {
      bodyStyle: 'Coupé Sportivo',
      bodyMaterialId: 'mat-alu-composite',
      aeroRefinementPercent: 42,
      coolingAperturePercent: 82,
      passiveSafetyReinforcementPercent: 85,
      airbagPackageId: 'airbag-six-curtain',
      frontAero: { type: 'track-splitter', angleDeg: 4 },
      rearAero: { type: 'ducktail-lip', angleDeg: 11 },
      underbodyType: 'flat-floor-diffuser',
      activeAeroType: 'full-active-airbrake',
    },
  },
  {
    id: 23,
    name: 'Porsche 911 GT3 RS 992 (2023)',
    year: 2023,
    realCx: 0.32,
    realCxHigh: 0.39,
    realFrontalAreaM2: 2.08,
    realDf200Kg: 409,
    checkDfExact: true,
    chassisDims: { lengthMm: 4572, widthMm: 1900, heightMm: 1322, wheelbaseMm: 2457, frontTrackMm: 1627, rearTrackMm: 1585, groundClearanceMm: 100, structureId: 'str-hybrid-giorgio' },
    bodyConfig: {
      bodyStyle: 'Coupé Sportivo',
      bodyMaterialId: 'mat-alu-composite',
      aeroRefinementPercent: 60,
      coolingAperturePercent: 85,
      passiveSafetyReinforcementPercent: 90,
      airbagPackageId: 'airbag-six-curtain',
      frontAero: { type: 'splitter-canards', angleDeg: 8 },
      rearAero: { type: 'swan-neck-wing', angleDeg: 11 },
      underbodyType: 'flat-floor-diffuser',
      activeAeroType: 'drs-active-wing',
    },
  },
  {
    id: 24,
    name: 'Aston Martin Valkyrie (2022)',
    year: 2022,
    realCx: 0.38,
    realFrontalAreaM2: 1.72,
    realDf200Kg: 700,
    checkDfExact: true,
    chassisDims: { lengthMm: 4500, widthMm: 1965, heightMm: 1070, wheelbaseMm: 2770, frontTrackMm: 1700, rearTrackMm: 1650, groundClearanceMm: 85, structureId: 'str-carbon-monocoque' },
    bodyConfig: {
      bodyStyle: 'Coupé Sportivo',
      bodyMaterialId: 'mat-carbon-prepreg',
      aeroRefinementPercent: 92,
      coolingAperturePercent: 60,
      passiveSafetyReinforcementPercent: 90,
      airbagPackageId: 'airbag-dual-front',
      frontAero: { type: 'splitter-canards', angleDeg: 12 },
      rearAero: { type: 'swan-neck-wing', angleDeg: 12 },
      underbodyType: 'venturi-ground-effect',
      activeAeroType: 'none',
    },
  },
];

function runBodyAeroBenchmark(): void {
  console.log('=== BENCHMARK AERODINAMICA & CARROZZERIA FASE 2.2 (24 VEICOLI REALI) ===');
  console.log(
    '| # | Veicolo | Style | A Sim / Reale (Err%) | Cx Sim / Reale (Err%) | DF200 (kg) | Crash / NCAP |',
  );
  console.log('| :---: | :--- | :--- | :---: | :---: | :---: | :---: |');

  let outCx8 = 0;
  let outA6 = 0;
  let outDf10 = 0;
  const absCxErrs: number[] = [];
  const absAErrs: number[] = [];

  for (const v of VEHICLE_CASES) {
    const chs = makeBenchChassis(v);
    const metrics = calculateBodyAeroMetrics(
      {
        id: `body-${v.id}`,
        name: v.name,
        chassisId: chs.id,
        year: v.year,
        ...v.bodyConfig,
      },
      chs,
    );

    const aErr = ((metrics.frontalAreaM2 - v.realFrontalAreaM2) / v.realFrontalAreaM2) * 100;
    // Per auto con DRS/Active aero, confronta realCx contro cxLowDrag (se presente target Low-Drag + High-DF) o cxHighDownforce
    const simCxForTarget =
      v.realCxHigh !== undefined ? metrics.cxLowDrag : metrics.cxHighDownforce;
    const cxErr = ((simCxForTarget - v.realCx) / v.realCx) * 100;
    const cxHighErr =
      v.realCxHigh !== undefined
        ? ((metrics.cxHighDownforce - v.realCxHigh) / v.realCxHigh) * 100
        : 0;

    absAErrs.push(Math.abs(aErr));
    absCxErrs.push(Math.abs(cxErr));
    if (Math.abs(aErr) > 6.0) outA6++;
    if (Math.abs(cxErr) > 8.0 || (v.realCxHigh !== undefined && Math.abs(cxHighErr) > 8.0)) {
      outCx8++;
    }

    let dfInfo = `${metrics.downforce200Kg.highDownforce}`;
    if (v.checkDfMaxZero) {
      if (metrics.downforce200Kg.highDownforce > 0) outDf10++;
      dfInfo = `${metrics.downforce200Kg.highDownforce} (<=0)`;
    } else if (v.checkDfExact && v.realDf200Kg !== undefined) {
      const dfErr = ((metrics.downforce200Kg.highDownforce - v.realDf200Kg) / v.realDf200Kg) * 100;
      if (Math.abs(dfErr) > 10.0) outDf10++;
      dfInfo = `${metrics.downforce200Kg.highDownforce}/${v.realDf200Kg} (${dfErr >= 0 ? '+' : ''}${dfErr.toFixed(1)}%)`;
    } else if (v.realDf200Kg !== undefined) {
      dfInfo = `${metrics.downforce200Kg.highDownforce} (~${v.realDf200Kg})`;
    }

    const cxDisplay =
      v.realCxHigh !== undefined
        ? `${metrics.cxLowDrag.toFixed(2)}/${metrics.cxHighDownforce.toFixed(2)} vs ${v.realCx.toFixed(2)}/${v.realCxHigh.toFixed(2)} (${cxErr >= 0 ? '+' : ''}${cxErr.toFixed(1)}%)`
        : `${metrics.cxHighDownforce.toFixed(2)} vs ${v.realCx.toFixed(2)} (${cxErr >= 0 ? '+' : ''}${cxErr.toFixed(1)}%)`;

    console.log(
      `| ${v.id} | ${v.name} | ${v.bodyConfig.bodyStyle} | ${metrics.frontalAreaM2.toFixed(2)} / ${v.realFrontalAreaM2.toFixed(2)} (${aErr >= 0 ? '+' : ''}${aErr.toFixed(1)}%) | ${cxDisplay} | ${dfInfo} | ${metrics.crashTestScore}/100 (${metrics.euroNcapStars}★) |`,
    );
  }

  const meanCx = absCxErrs.reduce((a, b) => a + b, 0) / absCxErrs.length;
  const meanA = absAErrs.reduce((a, b) => a + b, 0) / absAErrs.length;

  console.log('\n=== TEST LEGGI FISICHE OBBLIGATORI ===');
  // Test 1: Venturi Ground Clearance 80 -> 200 mm
  const valk = VEHICLE_CASES[23];
  const chs80 = makeBenchChassis({
    ...valk,
    chassisDims: { ...valk.chassisDims, groundClearanceMm: 80 },
  });
  const chs200 = makeBenchChassis({
    ...valk,
    chassisDims: { ...valk.chassisDims, groundClearanceMm: 200 },
  });
  const df80 = calculateBodyAeroMetrics(
    { id: 't1a', name: 'Valk 80', chassisId: chs80.id, year: valk.year, ...valk.bodyConfig },
    chs80,
  ).downforce200Kg.highDownforce;
  const df200 = calculateBodyAeroMetrics(
    { id: 't1b', name: 'Valk 200', chassisId: chs200.id, year: valk.year, ...valk.bodyConfig },
    chs200,
  ).downforce200Kg.highDownforce;
  const dfDropPct = ((df200 - df80) / df80) * 100;
  const t1Ok = dfDropPct < -55;
  console.log(
    `[${t1Ok ? 'PASS' : 'FAIL'}] 1. Ground Clearance 80->200mm su Venturi: DF200 ${df80} -> ${df200} kg (${dfDropPct.toFixed(1)}%, atteso < -55%)`,
  );

  // Test 2: DRS Low-Drag & Airbrake
  const gt3 = VEHICLE_CASES[22];
  const gt3Chs = makeBenchChassis(gt3);
  const gt3M = calculateBodyAeroMetrics(
    { id: 't2a', name: 'GT3', chassisId: gt3Chs.id, year: gt3.year, ...gt3.bodyConfig },
    gt3Chs,
  );
  const m720 = VEHICLE_CASES[20];
  const m720Chs = makeBenchChassis(m720);
  const m720M = calculateBodyAeroMetrics(
    { id: 't2b', name: '720S', chassisId: m720Chs.id, year: m720.year, ...m720.bodyConfig },
    m720Chs,
  );
  const t2Ok =
    gt3M.cxLowDrag < gt3M.cxHighDownforce &&
    gt3M.downforce200Kg.lowDrag < gt3M.downforce200Kg.highDownforce &&
    m720M.cxAirbrake > m720M.cxHighDownforce;
  console.log(
    `[${t2Ok ? 'PASS' : 'FAIL'}] 2. DRS & Airbrake: GT3 Cx ${gt3M.cxHighDownforce}->${gt3M.cxLowDrag}, DF ${gt3M.downforce200Kg.highDownforce}->${gt3M.downforce200Kg.lowDrag} kg; 720S Airbrake Cx=${m720M.cxAirbrake}`,
  );

  // Test 3: Wing Stall > 20 deg degrades L/D
  const gt3_18 = calculateBodyAeroMetrics(
    {
      id: 't3a',
      name: 'GT3 18deg',
      chassisId: gt3Chs.id,
      year: gt3.year,
      ...gt3.bodyConfig,
      rearAero: { type: 'swan-neck-wing', angleDeg: 18 },
    },
    gt3Chs,
  );
  const gt3_25 = calculateBodyAeroMetrics(
    {
      id: 't3b',
      name: 'GT3 25deg',
      chassisId: gt3Chs.id,
      year: gt3.year,
      ...gt3.bodyConfig,
      rearAero: { type: 'swan-neck-wing', angleDeg: 25 },
    },
    gt3Chs,
  );
  const t3Ok = gt3_25.aeroEfficiencyLD < gt3_18.aeroEfficiencyLD && gt3_25.warnings.length > 0;
  console.log(
    `[${t3Ok ? 'PASS' : 'FAIL'}] 3. Stallo Ala (>20 deg): L/D ${gt3_18.aeroEfficiencyLD} (18°) -> ${gt3_25.aeroEfficiencyLD} (25°) | Warnings=${gt3_25.warnings.length}`,
  );

  // Test 4: Cooling Aperture 20% -> 100% increases cooling & Cx
  const giulia = VEHICLE_CASES[5];
  const giuliaChs = makeBenchChassis(giulia);
  const cool20 = calculateBodyAeroMetrics(
    {
      id: 't4a',
      name: 'Cool 20',
      chassisId: giuliaChs.id,
      year: giulia.year,
      ...giulia.bodyConfig,
      coolingAperturePercent: 20,
    },
    giuliaChs,
  );
  const cool100 = calculateBodyAeroMetrics(
    {
      id: 't4b',
      name: 'Cool 100',
      chassisId: giuliaChs.id,
      year: giulia.year,
      ...giulia.bodyConfig,
      coolingAperturePercent: 100,
    },
    giuliaChs,
  );
  const t4Ok =
    cool100.coolingEfficiencyScore > cool20.coolingEfficiencyScore &&
    cool100.cxHighDownforce > cool20.cxHighDownforce;
  console.log(
    `[${t4Ok ? 'PASS' : 'FAIL'}] 4. Cooling 20%->100%: Cooling ${cool20.coolingEfficiencyScore}->${cool100.coolingEfficiencyScore}, Cx ${cool20.cxHighDownforce}->${cool100.cxHighDownforce}`,
  );

  // Test 5: Material Steel -> Aluminum -> Carbon reduces weight & increases cost monotonically
  const mSteel = calculateBodyAeroMetrics(
    {
      id: 't5a',
      name: 'Steel',
      chassisId: giuliaChs.id,
      year: giulia.year,
      ...giulia.bodyConfig,
      bodyMaterialId: 'mat-steel',
    },
    giuliaChs,
  );
  const mAlu = calculateBodyAeroMetrics(
    {
      id: 't5b',
      name: 'Alu',
      chassisId: giuliaChs.id,
      year: giulia.year,
      ...giulia.bodyConfig,
      bodyMaterialId: 'mat-aluminum',
    },
    giuliaChs,
  );
  const mCarb = calculateBodyAeroMetrics(
    {
      id: 't5c',
      name: 'Carbon',
      chassisId: giuliaChs.id,
      year: giulia.year,
      ...giulia.bodyConfig,
      bodyMaterialId: 'mat-carbon-prepreg',
    },
    giuliaChs,
  );
  const t5Ok =
    mSteel.bodyPanelsWeightKg > mAlu.bodyPanelsWeightKg &&
    mAlu.bodyPanelsWeightKg > mCarb.bodyPanelsWeightKg &&
    mSteel.unitManufacturingCost < mAlu.unitManufacturingCost &&
    mAlu.unitManufacturingCost < mCarb.unitManufacturingCost;
  console.log(
    `[${t5Ok ? 'PASS' : 'FAIL'}] 5. Materiali Steel->Alu->Carbon: Peso ${mSteel.bodyPanelsWeightKg}->${mAlu.bodyPanelsWeightKg}->${mCarb.bodyPanelsWeightKg} kg | Costo $${mSteel.unitManufacturingCost}->$ ${mAlu.unitManufacturingCost}->$${mCarb.unitManufacturingCost}`,
  );

  // Test 6: Escursione Sicurezza Passiva (>= 25 pt) & Colli di bottiglia (pianale < 60, airbag-none <= 58)
  const safeMin = calculateBodyAeroMetrics(
    {
      id: 't6a',
      name: 'SafeMin',
      chassisId: giuliaChs.id,
      year: giulia.year,
      ...giulia.bodyConfig,
      passiveSafetyReinforcementPercent: 0,
      airbagPackageId: 'airbag-none',
    },
    giuliaChs,
  );
  const safeMax = calculateBodyAeroMetrics(
    {
      id: 't6b',
      name: 'SafeMax',
      chassisId: giuliaChs.id,
      year: giulia.year,
      ...giulia.bodyConfig,
      passiveSafetyReinforcementPercent: 100,
      airbagPackageId: 'airbag-ten-precrash',
    },
    giuliaChs,
  );
  const defChs = makeBenchChassis(VEHICLE_CASES[14]); // Defender str-ladder-frame (<60)
  const safeFrameCap = calculateBodyAeroMetrics(
    {
      id: 't6c',
      name: 'SafeFrameCap',
      chassisId: defChs.id,
      year: 2018,
      ...VEHICLE_CASES[14].bodyConfig,
      passiveSafetyReinforcementPercent: 100,
      airbagPackageId: 'airbag-ten-precrash',
    },
    defChs,
  );
  const safeDelta = safeMax.crashTestScore - safeMin.crashTestScore;
  const t6Ok =
    safeDelta >= 25 &&
    safeMin.crashTestScore <= 58 &&
    safeMin.safetyBreakdown.bottleneckNote !== null &&
    safeFrameCap.crashTestScore <= safeFrameCap.safetyBreakdown.chassisCellScore + 22 &&
    safeFrameCap.safetyBreakdown.bottleneckNote !== null;
  console.log(
    `[${t6Ok ? 'PASS' : 'FAIL'}] 6. Sicurezza Passiva: Escursione ${safeMin.crashTestScore}->${safeMax.crashTestScore} (+${safeDelta} pt >=25) | Cap Telaio=${safeFrameCap.crashTestScore}/${safeFrameCap.safetyBreakdown.chassisCellScore}+22`,
  );

  // Test 7: R&D Cost > 0 & aeroRefinement scaling (+120 R&D)
  const ref0 = calculateBodyAeroMetrics(
    {
      id: 't7a',
      name: 'Ref0',
      chassisId: giuliaChs.id,
      year: giulia.year,
      ...giulia.bodyConfig,
      aeroRefinementPercent: 0,
    },
    giuliaChs,
  );
  const ref100 = calculateBodyAeroMetrics(
    {
      id: 't7b',
      name: 'Ref100',
      chassisId: giuliaChs.id,
      year: giulia.year,
      ...giulia.bodyConfig,
      aeroRefinementPercent: 100,
    },
    giuliaChs,
  );
  const t7Ok =
    ref0.developmentCost.rdCost > 0 &&
    ref100.developmentCost.rdCost - ref0.developmentCost.rdCost === 120 &&
    ref100.developmentCost.capitalCost > ref0.developmentCost.capitalCost;
  console.log(
    `[${t7Ok ? 'PASS' : 'FAIL'}] 7. Costo R&D & Galleria: R&D ${ref0.developmentCost.rdCost} -> ${ref100.developmentCost.rdCost} (+${ref100.developmentCost.rdCost - ref0.developmentCost.rdCost} PTS)`,
  );

  // Test 8: Invarianza activeAeroType === 'none' & Edge-case angleDeg/lift balance
  const fixedAero = calculateBodyAeroMetrics(
    {
      id: 't8a',
      name: 'FixedEdge',
      chassisId: giuliaChs.id,
      year: giulia.year,
      ...giulia.bodyConfig,
      underbodyType: 'exposed',
      frontAero: { type: 'none', angleDeg: 18 },
      rearAero: { type: 'none', angleDeg: 25 },
      activeAeroType: 'none',
    },
    giuliaChs,
  );
  const t8Ok =
    fixedAero.cxLowDrag === fixedAero.cxHighDownforce &&
    fixedAero.cxAirbrake === fixedAero.cxHighDownforce &&
    fixedAero.downforce200Kg.lowDrag === fixedAero.downforce200Kg.highDownforce &&
    fixedAero.aeroRegime === 'lift' &&
    fixedAero.aeroBalanceFrontPercent === 50 &&
    fixedAero.aeroBalanceRearPercent === 50 &&
    fixedAero.warnings.length === 0;
  console.log(
    `[${t8Ok ? 'PASS' : 'FAIL'}] 8. Edge-case Aero: active=none invariante (Cx=${fixedAero.cxHighDownforce}), regime=${fixedAero.aeroRegime}, balance=${fixedAero.aeroBalanceFrontPercent}/${fixedAero.aeroBalanceRearPercent}, warnings=${fixedAero.warnings.length}`,
  );

  // Test 9: Saturazione CL su Pickup / SUV full-aero
  const pickupChs = makeBenchChassis({
    ...VEHICLE_CASES[18],
    chassisDims: { ...VEHICLE_CASES[18].chassisDims, groundClearanceMm: 120 },
  });
  const pickupFull = calculateBodyAeroMetrics(
    {
      id: 't9a',
      name: 'Pickup Full Aero',
      chassisId: pickupChs.id,
      year: 2023,
      bodyStyle: 'Pickup',
      bodyMaterialId: 'mat-carbon-prepreg',
      aeroRefinementPercent: 80,
      coolingAperturePercent: 50,
      passiveSafetyReinforcementPercent: 80,
      airbagPackageId: 'airbag-six-curtain',
      frontAero: { type: 'splitter-canards', angleDeg: 18 },
      rearAero: { type: 'swan-neck-wing', angleDeg: 20 },
      underbodyType: 'venturi-ground-effect',
      activeAeroType: 'full-active-airbrake',
    },
    pickupChs,
  );
  const suvChs = makeBenchChassis({
    ...VEHICLE_CASES[16],
    chassisDims: { ...VEHICLE_CASES[16].chassisDims, groundClearanceMm: 120 },
  });
  const suvFull = calculateBodyAeroMetrics(
    {
      id: 't9b',
      name: 'SUV Full Aero',
      chassisId: suvChs.id,
      year: 2023,
      bodyStyle: 'SUV',
      bodyMaterialId: 'mat-carbon-prepreg',
      aeroRefinementPercent: 80,
      coolingAperturePercent: 50,
      passiveSafetyReinforcementPercent: 80,
      airbagPackageId: 'airbag-six-curtain',
      frontAero: { type: 'splitter-canards', angleDeg: 18 },
      rearAero: { type: 'swan-neck-wing', angleDeg: 20 },
      underbodyType: 'venturi-ground-effect',
      activeAeroType: 'full-active-airbrake',
    },
    suvChs,
  );
  const t9Ok =
    pickupFull.clTotalHighDownforce <= 0.45 &&
    suvFull.clTotalHighDownforce <= 0.60 &&
    pickupFull.clSaturated &&
    suvFull.clSaturated;
  console.log(
    `[${t9Ok ? 'PASS' : 'FAIL'}] 9. Saturazione CL Full-Aero: Pickup CL=${pickupFull.clTotalHighDownforce} (<=0.45, sat=${pickupFull.clSaturated}), SUV CL=${suvFull.clTotalHighDownforce} (<=0.60, sat=${suvFull.clSaturated})`,
  );

  // Test 10: Effetto Mercedes CLR 1999 (hiddenBlowoverRisk alto su sbalzi lunghi + Venturi basso + ant scarico vs basso su berlina)
  const clrChs = makeBenchChassis({
    ...VEHICLE_CASES[23],
    chassisDims: {
      ...VEHICLE_CASES[23].chassisDims,
      lengthMm: 4880,
      wheelbaseMm: 2700, // overhang ratio = 2180/2700 = 0.807 > 0.68
      groundClearanceMm: 80,
    },
  });
  const clrMetrics = calculateBodyAeroMetrics(
    {
      id: 't10a',
      name: 'CLR Pitch Risk',
      chassisId: clrChs.id,
      year: 2022,
      bodyStyle: 'Coupé Sportivo',
      bodyMaterialId: 'mat-carbon-prepreg',
      aeroRefinementPercent: 85,
      coolingAperturePercent: 60,
      passiveSafetyReinforcementPercent: 80,
      airbagPackageId: 'airbag-none',
      frontAero: { type: 'none', angleDeg: 0 }, // anteriore scarico!
      rearAero: { type: 'swan-neck-wing', angleDeg: 20 }, // forte carico posteriore
      underbodyType: 'flat-floor-diffuser',
      activeAeroType: 'none',
    },
    clrChs,
  );
  const berlinaBalanced = calculateBodyAeroMetrics(
    {
      id: 't10b',
      name: 'Giulia Balanced',
      chassisId: giuliaChs.id,
      year: giulia.year,
      ...giulia.bodyConfig,
    },
    giuliaChs,
  );
  const t10Ok =
    clrMetrics.hiddenBlowoverRisk >= 0.65 &&
    berlinaBalanced.hiddenBlowoverRisk <= 0.15;
  console.log(
    `[${t10Ok ? 'PASS' : 'FAIL'}] 10. Effetto CLR 1999: CLR hiddenBlowoverRisk=${clrMetrics.hiddenBlowoverRisk} (>=0.65) vs Berlina=${berlinaBalanced.hiddenBlowoverRisk} (<=0.15)`,
  );

  console.log('\n=== CHECKLIST CERTIFICAZIONE 2.2 ===');
  const checks: [string, boolean][] = [
    [`Cx (24/24): ${outCx8}/24 outlier > ±8.0% | Media |Err| = ${meanCx.toFixed(2)}% (< 4.0%)`, outCx8 === 0 && meanCx < 4.0],
    [`Sezione Frontale A (24/24): ${outA6}/24 outlier > ±6.0% | Media |Err| = ${meanA.toFixed(2)}% (< 3.5%)`, outA6 === 0 && meanA < 3.5],
    [`Downforce @200km/h (#1,#20..#24): ${outDf10} outlier > ±10.0%`, outDf10 === 0],
    [`Tutti 10 test leggi fisiche, saturazione, CLR & sicurezza/R&D PASS`, t1Ok && t2Ok && t3Ok && t4Ok && t5Ok && t6Ok && t7Ok && t8Ok && t9Ok && t10Ok],
  ];
  let allOk = true;
  for (const [desc, ok] of checks) {
    console.log(`[${ok ? 'CERTIFICATO' : 'FALLITO'}] ${desc}`);
    if (!ok) allOk = false;
  }
  if (!allOk) process.exit(1);
}

runBodyAeroBenchmark();
