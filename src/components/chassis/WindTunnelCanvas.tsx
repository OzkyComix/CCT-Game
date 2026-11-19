import React, { useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp, Gauge, Wind } from 'lucide-react';
import type {
  BodyAeroConfig,
  BodyAeroMetrics,
  BodyStyle,
  ChassisEntity,
} from '../../types/gameTypes';

export type AeroTunnelMode = 'high-downforce' | 'low-drag' | 'airbrake';

interface WindTunnelCanvasProps {
  config: BodyAeroConfig;
  chassis: ChassisEntity;
  metrics: BodyAeroMetrics;
  mode: AeroTunnelMode;
  onModeChange: (mode: AeroTunnelMode) => void;
}

interface CubicSegment {
  x0: number;
  y0: number;
  cx1: number;
  cy1: number;
  cx2: number;
  cy2: number;
  x1: number;
  y1: number;
}

interface BlueprintGeometry {
  upperSegments: CubicSegment[];
  windows: Array<Array<[number, number]>>;
  shutlines: Array<Array<[number, number]>>;
  sideIntake?: Array<[number, number]>;
  headlight: { x: number; y: number; w: number; h: number };
  taillight: { x: number; y: number; w: number; h: number };
  frontBumperBox?: { x: number; y: number; w: number; h: number };
  rearBumperBox?: { x: number; y: number; w: number; h: number };
  frontSplitterAnchor: { x: number; y: number };
  rearMount: { x: number; y: number; isRoofMount: boolean };
  getTopY: (x: number) => number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function evalCubic(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

export function getEraStyleLabel(year: number): string {
  if (year < 1980) return "Anni '70 (Squadrato / Wedge)";
  if (year < 1990) return "Anni '80 (Spigoli Tesi)";
  if (year < 2000) return "Anni '90 (Bio-Design)";
  if (year < 2010) return 'Anni 2000 (Teso Moderno)';
  if (year < 2020) return 'Anni 2010 (Aero Fluid)';
  return 'Anni 2020+ (CFD / LED Stream)';
}

function buildBlueprintGeometry(
  style: BodyStyle,
  x0: number,
  x1: number,
  bottomY: number,
  topY: number,
  eraT: number,
): BlueprintGeometry {
  const L = x1 - x0;
  const H = bottomY - topY;
  const px = (fx: number) => x0 + L * fx;
  const py = (fy: number) => bottomY - H * fy;

  // Evoluzione stilistica continua per decennio (eraT: 0 = 1970, 1 = 2025+)
  // Anni '70-'80: parabrezza più verticale (wsRake < 0), cofano piatto, spigoli tesi, paraurti sporgenti
  // Anni '90-'00: raccordi morbidi
  // Anni '10-'20+: parabrezza sdraiato (wsRake > 0), cintura alta (+beltLift), fari LED sottili
  const wsRake = (eraT - 0.35) * 0.045;
  const beltLift = (eraT - 0.3) * 0.035;
  const roofCurve = 0.01 + eraT * 0.025;
  const ledSlim = clamp(1 - eraT * 0.5, 0.48, 1);

  let upperSegments: CubicSegment[] = [];
  let windows: Array<Array<[number, number]>> = [];
  let shutlines: Array<Array<[number, number]>> = [];
  let sideIntake: Array<[number, number]> | undefined;
  let headlight = { x: px(0.012), y: py(0.36 + beltLift), w: Math.round(15 + eraT * 5), h: Math.max(3, Math.round(7 * ledSlim)) };
  let taillight = { x: px(0.962), y: py(0.45 + beltLift), w: Math.round(11 + eraT * 3), h: Math.max(3.5, Math.round(8 * ledSlim)) };
  let rearMount = { x: px(0.95), y: py(0.54 + beltLift), isRoofMount: false };

  switch (style) {
    case 'Coupé Sportivo': {
      const hoodEnd = 0.23 + wsRake * 0.4;
      const wsTop = 0.46 + wsRake * 0.7;
      upperSegments = [
        {
          x0: px(0.0), y0: py(0.18 + eraT * 0.03),
          cx1: px(0.03), cy1: py(0.34 + beltLift * 0.5),
          cx2: px(0.13), cy2: py(0.41 + beltLift),
          x1: px(hoodEnd), y1: py(0.44 + beltLift),
        },
        {
          x0: px(hoodEnd), y0: py(0.44 + beltLift),
          cx1: px(hoodEnd + 0.08), cy1: py(0.68),
          cx2: px(wsTop - 0.07), cy2: py(0.98),
          x1: px(wsTop), y1: py(1.0),
        },
        {
          x0: px(wsTop), y0: py(1.0),
          cx1: px(wsTop + 0.10), cy1: py(1.0 + roofCurve),
          cx2: px(0.67), cy2: py(0.89),
          x1: px(0.79), y1: py(0.67 + beltLift * 0.6),
        },
        {
          x0: px(0.79), y0: py(0.67 + beltLift * 0.6),
          cx1: px(0.87), cy1: py(0.57 + beltLift),
          cx2: px(0.94), cy2: py(0.54 + beltLift),
          x1: px(1.0), y1: py(0.52 + beltLift),
        },
      ];
      windows = [
        [
          [px(hoodEnd + 0.04), py(0.48 + beltLift)],
          [px(wsTop - 0.02), py(0.92)],
          [px(0.59), py(0.92)],
          [px(0.72), py(0.68)],
          [px(0.58), py(0.55 + beltLift)],
        ],
      ];
      sideIntake = [
        [px(0.58), py(0.44 + beltLift)],
        [px(0.68), py(0.50 + beltLift)],
        [px(0.66), py(0.22)],
        [px(0.56), py(0.22)],
      ];
      shutlines = [
        [[px(0.33), py(0.47)], [px(0.33), py(0.14)], [px(0.58), py(0.14)], [px(0.61), py(0.52)]],
      ];
      headlight = { x: px(0.015), y: py(0.28 + beltLift * 0.5), w: Math.round(17 + eraT * 5), h: Math.max(3, Math.round(5 * ledSlim)) };
      taillight = { x: px(0.958), y: py(0.47 + beltLift), w: 14, h: Math.max(3, Math.round(5 * ledSlim)) };
      rearMount = { x: px(0.955), y: py(0.53 + beltLift), isRoofMount: false };
      break;
    }

    case 'Coupé': {
      const hoodEnd = 0.30 + wsRake * 0.3;
      const wsTop = 0.48 + wsRake;
      upperSegments = [
        {
          x0: px(0.0), y0: py(0.26),
          cx1: px(0.03), cy1: py(0.44 + beltLift * 0.5),
          cx2: px(0.16), cy2: py(0.49 + beltLift),
          x1: px(hoodEnd), y1: py(0.51 + beltLift),
        },
        {
          x0: px(hoodEnd), y0: py(0.51 + beltLift),
          cx1: px(hoodEnd + 0.06), cy1: py(0.75),
          cx2: px(wsTop - 0.06), cy2: py(0.98),
          x1: px(wsTop), y1: py(1.0),
        },
        {
          x0: px(wsTop), y0: py(1.0),
          cx1: px(0.61), cy1: py(1.0 + roofCurve),
          cx2: px(0.75), cy2: py(0.83),
          x1: px(0.90), y1: py(0.59 + beltLift),
        },
        {
          x0: px(0.90), y0: py(0.59 + beltLift),
          cx1: px(0.95), cy1: py(0.57 + beltLift),
          cx2: px(0.98), cy2: py(0.56 + beltLift),
          x1: px(1.0), y1: py(0.54 + beltLift),
        },
      ];
      windows = [
        [
          [px(hoodEnd + 0.03), py(0.54 + beltLift)],
          [px(wsTop - 0.02), py(0.92)],
          [px(0.62), py(0.91)],
          [px(0.61), py(0.55 + beltLift)],
        ],
        [
          [px(0.64), py(0.89)],
          [px(0.79), py(0.70)],
          [px(0.64), py(0.56 + beltLift)],
        ],
      ];
      shutlines = [
        [[px(0.34), py(0.53)], [px(0.34), py(0.15)], [px(0.63), py(0.15)], [px(0.63), py(0.55)]],
      ];
      rearMount = { x: px(0.95), y: py(0.55 + beltLift), isRoofMount: false };
      break;
    }

    case 'Hatchback': {
      const hoodEnd = 0.22 + wsRake * 0.3;
      const wsTop = 0.40 + wsRake;
      const roofEnd = 0.85 - eraT * 0.02;
      upperSegments = [
        {
          x0: px(0.0), y0: py(0.28),
          cx1: px(0.02), cy1: py(0.45 + beltLift * 0.5),
          cx2: px(0.12), cy2: py(0.50 + beltLift),
          x1: px(hoodEnd), y1: py(0.52 + beltLift),
        },
        {
          x0: px(hoodEnd), y0: py(0.52 + beltLift),
          cx1: px(hoodEnd + 0.06), cy1: py(0.76),
          cx2: px(wsTop - 0.05), cy2: py(0.98),
          x1: px(wsTop), y1: py(1.0),
        },
        {
          x0: px(wsTop), y0: py(1.0),
          cx1: px(0.58), cy1: py(1.0 + roofCurve),
          cx2: px(0.74), cy2: py(0.99),
          x1: px(roofEnd), y1: py(0.95),
        },
        {
          x0: px(roofEnd), y0: py(0.95),
          cx1: px(0.91), cy1: py(0.82),
          cx2: px(0.97), cy2: py(0.64),
          x1: px(1.0), y1: py(0.46 + beltLift),
        },
      ];
      windows = [
        [
          [px(hoodEnd + 0.04), py(0.55 + beltLift)],
          [px(wsTop - 0.02), py(0.91)],
          [px(0.57), py(0.92)],
          [px(0.56), py(0.55 + beltLift)],
        ],
        [
          [px(0.60), py(0.92)],
          [px(roofEnd - 0.03), py(0.90)],
          [px(0.87), py(0.56 + beltLift)],
          [px(0.59), py(0.55 + beltLift)],
        ],
      ];
      shutlines = [
        [[px(0.27), py(0.54)], [px(0.27), py(0.15)], [px(0.57), py(0.15)], [px(0.58), py(0.55)]],
      ];
      rearMount = { x: px(roofEnd), y: py(0.95), isRoofMount: true };
      break;
    }

    case 'Universale': {
      const hoodEnd = 0.25 + wsRake * 0.3;
      const wsTop = 0.42 + wsRake;
      const roofEnd = 0.91 - eraT * 0.015;
      upperSegments = [
        {
          x0: px(0.0), y0: py(0.26),
          cx1: px(0.03), cy1: py(0.44 + beltLift * 0.5),
          cx2: px(0.14), cy2: py(0.49 + beltLift),
          x1: px(hoodEnd), y1: py(0.51 + beltLift),
        },
        {
          x0: px(hoodEnd), y0: py(0.51 + beltLift),
          cx1: px(hoodEnd + 0.06), cy1: py(0.76),
          cx2: px(wsTop - 0.05), cy2: py(0.98),
          x1: px(wsTop), y1: py(1.0),
        },
        {
          x0: px(wsTop), y0: py(1.0),
          cx1: px(0.60), cy1: py(1.0 + roofCurve * 0.8),
          cx2: px(0.78), cy2: py(0.99),
          x1: px(roofEnd), y1: py(0.95),
        },
        {
          x0: px(roofEnd), y0: py(0.95),
          cx1: px(0.95), cy1: py(0.82),
          cx2: px(0.98), cy2: py(0.64),
          x1: px(1.0), y1: py(0.46 + beltLift),
        },
      ];
      windows = [
        [
          [px(hoodEnd + 0.03), py(0.55 + beltLift)],
          [px(wsTop - 0.01), py(0.91)],
          [px(0.55), py(0.92)],
          [px(0.54), py(0.55 + beltLift)],
        ],
        [
          [px(0.58), py(0.92)],
          [px(0.73), py(0.91)],
          [px(0.72), py(0.55 + beltLift)],
          [px(0.57), py(0.55 + beltLift)],
        ],
        [
          [px(0.76), py(0.91)],
          [px(roofEnd - 0.02), py(0.89)],
          [px(0.93), py(0.56 + beltLift)],
          [px(0.75), py(0.55 + beltLift)],
        ],
      ];
      shutlines = [
        [[px(0.29), py(0.53)], [px(0.29), py(0.15)], [px(0.73), py(0.15)], [px(0.74), py(0.54)]],
      ];
      rearMount = { x: px(roofEnd), y: py(0.95), isRoofMount: true };
      break;
    }

    case 'Crossover': {
      const hoodEnd = 0.25 + wsRake * 0.25;
      const wsTop = 0.44 + wsRake;
      const roofEnd = 0.82;
      upperSegments = [
        {
          x0: px(0.0), y0: py(0.32),
          cx1: px(0.03), cy1: py(0.50 + beltLift * 0.5),
          cx2: px(0.14), cy2: py(0.54 + beltLift),
          x1: px(hoodEnd), y1: py(0.56 + beltLift),
        },
        {
          x0: px(hoodEnd), y0: py(0.56 + beltLift),
          cx1: px(hoodEnd + 0.06), cy1: py(0.78),
          cx2: px(wsTop - 0.05), cy2: py(0.98),
          x1: px(wsTop), y1: py(1.0),
        },
        {
          x0: px(wsTop), y0: py(1.0),
          cx1: px(0.58), cy1: py(1.0 + roofCurve),
          cx2: px(0.71), cy2: py(0.92),
          x1: px(roofEnd), y1: py(0.82),
        },
        {
          x0: px(roofEnd), y0: py(0.82),
          cx1: px(0.90), cy1: py(0.72),
          cx2: px(0.97), cy2: py(0.62),
          x1: px(1.0), y1: py(0.50 + beltLift),
        },
      ];
      windows = [
        [
          [px(hoodEnd + 0.03), py(0.59 + beltLift)],
          [px(wsTop - 0.02), py(0.91)],
          [px(0.57), py(0.91)],
          [px(0.56), py(0.59 + beltLift)],
        ],
        [
          [px(0.60), py(0.90)],
          [px(0.78), py(0.79)],
          [px(0.83), py(0.61 + beltLift)],
          [px(0.59), py(0.59 + beltLift)],
        ],
      ];
      shutlines = [
        [[px(0.29), py(0.57)], [px(0.29), py(0.17)], [px(0.74), py(0.17)], [px(0.76), py(0.58)]],
      ];
      rearMount = { x: px(roofEnd), y: py(0.82), isRoofMount: true };
      break;
    }

    case 'SUV': {
      const hoodEnd = 0.25;
      const wsTop = 0.37 + wsRake * 0.8;
      const roofEnd = 0.94 - eraT * 0.015;
      upperSegments = [
        {
          x0: px(0.0), y0: py(0.36),
          cx1: px(0.02), cy1: py(0.55),
          cx2: px(0.12), cy2: py(0.57 + beltLift * 0.5),
          x1: px(hoodEnd), y1: py(0.58 + beltLift * 0.6),
        },
        {
          x0: px(hoodEnd), y0: py(0.58 + beltLift * 0.6),
          cx1: px(0.30), cy1: py(0.80),
          cx2: px(wsTop - 0.03), cy2: py(0.98),
          x1: px(wsTop), y1: py(1.0),
        },
        {
          x0: px(wsTop), y0: py(1.0),
          cx1: px(0.58), cy1: py(1.0 + roofCurve * 0.4),
          cx2: px(0.78), cy2: py(1.0),
          x1: px(roofEnd), y1: py(0.98),
        },
        {
          x0: px(roofEnd), y0: py(0.98),
          cx1: px(0.98), cy1: py(0.86),
          cx2: px(0.99), cy2: py(0.68),
          x1: px(1.0), y1: py(0.48 + beltLift),
        },
      ];
      windows = [
        [
          [px(0.28), py(0.61 + beltLift * 0.5)],
          [px(wsTop - 0.01), py(0.92)],
          [px(0.54), py(0.92)],
          [px(0.53), py(0.61 + beltLift * 0.5)],
        ],
        [
          [px(0.57), py(0.92)],
          [px(0.73), py(0.92)],
          [px(0.72), py(0.61 + beltLift * 0.5)],
          [px(0.56), py(0.61 + beltLift * 0.5)],
        ],
        [
          [px(0.76), py(0.92)],
          [px(roofEnd - 0.02), py(0.91)],
          [px(0.94), py(0.61 + beltLift * 0.5)],
          [px(0.75), py(0.61 + beltLift * 0.5)],
        ],
      ];
      shutlines = [
        [[px(0.28), py(0.58)], [px(0.28), py(0.18)], [px(0.73), py(0.18)], [px(0.74), py(0.58)]],
      ];
      rearMount = { x: px(roofEnd), y: py(0.98), isRoofMount: true };
      break;
    }

    case 'Pickup': {
      const wsTop = 0.37 + wsRake * 0.7;
      upperSegments = [
        {
          x0: px(0.0), y0: py(0.34),
          cx1: px(0.02), cy1: py(0.53),
          cx2: px(0.12), cy2: py(0.56 + beltLift * 0.5),
          x1: px(0.24), y1: py(0.57 + beltLift * 0.5),
        },
        {
          x0: px(0.24), y0: py(0.57 + beltLift * 0.5),
          cx1: px(0.29), cy1: py(0.79),
          cx2: px(wsTop - 0.03), cy2: py(0.98),
          x1: px(wsTop), y1: py(1.0),
        },
        {
          x0: px(wsTop), y0: py(1.0),
          cx1: px(0.46), cy1: py(1.0),
          cx2: px(0.54), cy2: py(1.0),
          x1: px(0.60), y1: py(0.98),
        },
        {
          x0: px(0.60), y0: py(0.98),
          cx1: px(0.61), cy1: py(0.75),
          cx2: px(0.61), cy2: py(0.56),
          x1: px(0.62), y1: py(0.55 + beltLift * 0.5),
        },
        {
          x0: px(0.62), y0: py(0.55 + beltLift * 0.5),
          cx1: px(0.75), cy1: py(0.55 + beltLift * 0.5),
          cx2: px(0.88), cy2: py(0.55 + beltLift * 0.5),
          x1: px(1.0), y1: py(0.54 + beltLift * 0.5),
        },
      ];
      windows = [
        [
          [px(0.27), py(0.60 + beltLift * 0.5)],
          [px(wsTop - 0.01), py(0.91)],
          [px(0.47), py(0.91)],
          [px(0.46), py(0.60 + beltLift * 0.5)],
        ],
        [
          [px(0.50), py(0.91)],
          [px(0.58), py(0.91)],
          [px(0.58), py(0.60 + beltLift * 0.5)],
          [px(0.49), py(0.60 + beltLift * 0.5)],
        ],
      ];
      shutlines = [[[px(0.615), py(0.55)], [px(0.615), py(0.14)]]];
      rearMount = { x: px(0.96), y: py(0.54 + beltLift * 0.5), isRoofMount: false };
      break;
    }

    case 'Berlina':
    default: {
      const hoodEnd = 0.27 + wsRake * 0.3;
      const wsTop = 0.44 + wsRake;
      const roofEnd = 0.71 + wsRake * 0.4;
      const trunkStart = 0.85 + eraT * 0.02;
      upperSegments = [
        {
          x0: px(0.0), y0: py(0.26),
          cx1: px(0.03), cy1: py(0.45 + beltLift * 0.5),
          cx2: px(0.14), cy2: py(0.50 + beltLift),
          x1: px(hoodEnd), y1: py(0.52 + beltLift),
        },
        {
          x0: px(hoodEnd), y0: py(0.52 + beltLift),
          cx1: px(hoodEnd + 0.06), cy1: py(0.76),
          cx2: px(wsTop - 0.05), cy2: py(0.98),
          x1: px(wsTop), y1: py(1.0),
        },
        {
          x0: px(wsTop), y0: py(1.0),
          cx1: px(0.56), cy1: py(1.0 + roofCurve),
          cx2: px(0.65), cy2: py(0.98),
          x1: px(roofEnd), y1: py(0.90),
        },
        {
          x0: px(roofEnd), y0: py(0.90),
          cx1: px(0.77), cy1: py(0.76),
          cx2: px(0.81), cy2: py(0.60 + beltLift),
          x1: px(trunkStart), y1: py(0.56 + beltLift),
        },
        {
          x0: px(trunkStart), y0: py(0.56 + beltLift),
          cx1: px(0.91), cy1: py(0.56 + beltLift),
          cx2: px(0.96), cy2: py(0.55 + beltLift),
          x1: px(1.0), y1: py(0.53 + beltLift),
        },
      ];
      windows = [
        [
          [px(hoodEnd + 0.03), py(0.55 + beltLift)],
          [px(wsTop - 0.01), py(0.91)],
          [px(0.57), py(0.92)],
          [px(0.56), py(0.55 + beltLift)],
        ],
        [
          [px(0.60), py(0.91)],
          [px(roofEnd - 0.01), py(0.87)],
          [px(trunkStart - 0.04), py(0.58 + beltLift)],
          [px(0.59), py(0.55 + beltLift)],
        ],
      ];
      shutlines = [
        [[px(0.30), py(0.54)], [px(0.30), py(0.15)], [px(0.75), py(0.15)], [px(0.78), py(0.56)]],
      ];
      rearMount = { x: px(0.955), y: py(0.54 + beltLift), isRoofMount: false };
      break;
    }
  }

  // Paraurti sporgenti tipici degli anni '70-'80 (eraT < 0.45)
  const bumperOut = eraT < 0.45 ? Math.round((0.45 - eraT) * 16) : 0;
  const frontBumperBox =
    bumperOut > 1 ? { x: x0 - bumperOut, y: bottomY - 14, w: bumperOut + 4, h: 7 } : undefined;
  const rearBumperBox =
    bumperOut > 1 ? { x: x1 - 3, y: bottomY - 15, w: bumperOut + 4, h: 7 } : undefined;

  const samples: Array<{ x: number; y: number }> = [];
  for (const seg of upperSegments) {
    for (let k = 0; k <= 24; k++) {
      const t = k / 24;
      samples.push({
        x: evalCubic(seg.x0, seg.cx1, seg.cx2, seg.x1, t),
        y: evalCubic(seg.y0, seg.cy1, seg.cy2, seg.y1, t),
      });
    }
  }

  const getTopY = (x: number): number => {
    if (x <= samples[0].x) return samples[0].y;
    if (x >= samples[samples.length - 1].x) return samples[samples.length - 1].y;
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i];
      const b = samples[i + 1];
      if (x >= a.x && x <= b.x) {
        const span = Math.max(0.0001, b.x - a.x);
        const f = (x - a.x) / span;
        return a.y + (b.y - a.y) * f;
      }
    }
    return topY;
  };

  return {
    upperSegments,
    windows,
    shutlines,
    sideIntake,
    headlight,
    taillight,
    frontBumperBox,
    rearBumperBox,
    frontSplitterAnchor: { x: x0 + 6, y: bottomY - 1 },
    rearMount,
    getTopY,
  };
}

export const WindTunnelCanvas: React.FC<WindTunnelCanvasProps> = ({
  config,
  chassis,
  metrics,
  mode,
  onModeChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isActiveAero = config.activeAeroType !== 'none';
  const supportsAirbrake =
    config.activeAeroType === 'drs-active-wing' ||
    config.activeAeroType === 'full-active-airbrake';

  const effectiveMode: AeroTunnelMode =
    !isActiveAero
      ? 'high-downforce'
      : mode === 'airbrake' && !supportsAirbrake
        ? 'high-downforce'
        : mode;

  const activeCx =
    effectiveMode === 'low-drag'
      ? metrics.cxLowDrag
      : effectiveMode === 'airbrake'
        ? metrics.cxAirbrake
        : metrics.cxHighDownforce;

  const activeDf200 =
    effectiveMode === 'low-drag'
      ? metrics.downforce200Kg.lowDrag
      : metrics.downforce200Kg.highDownforce;

  const activeDf300 =
    effectiveMode === 'low-drag'
      ? metrics.downforce300Kg.lowDrag
      : metrics.downforce300Kg.highDownforce;

  const frontLoadScale = effectiveMode === 'low-drag' ? 0.65 : 1;
  const rearLoadScale =
    effectiveMode === 'low-drag' ? 0.55 : effectiveMode === 'airbrake' ? 1.25 : 1;
  const frontLoadKg = Math.round(metrics.downforce200Kg.frontKg * frontLoadScale);
  const rearLoadKg = Math.round(metrics.downforce200Kg.rearKg * rearLoadScale);

  // Ref per leggere lo stato live nel loop requestAnimationFrame senza MAI riavviare o accelerare il loop!
  const liveStateRef = useRef({
    config,
    chassis,
    metrics,
    effectiveMode,
    activeCx,
    frontLoadKg,
    rearLoadKg,
  });
  liveStateRef.current = {
    config,
    chassis,
    metrics,
    effectiveMode,
    activeCx,
    frontLoadKg,
    rearLoadKg,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 820;
    const H = 315;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    let animId = 0;
    let lastTime = performance.now();
    let phasePx = 0;
    const FLOW_SPEED_PX_PER_SEC = 120; // Velocità laminare rigorosamente costante

    const renderFrame = (now: number) => {
      const dt = Math.min(Math.max(0, (now - lastTime) / 1000), 0.05);
      lastTime = now;
      phasePx = (phasePx + FLOW_SPEED_PX_PER_SEC * dt) % 10000;

      const {
        config: cfg,
        chassis: chs,
        metrics: met,
        effectiveMode: effMode,
        activeCx: curCx,
        frontLoadKg: fKg,
        rearLoadKg: rKg,
      } = liveStateRef.current;

      const eraT = clamp((cfg.year - 1970) / 55, 0, 1);

      // Scala ridotta per lasciare sempre > 32% di margine libero sopra il tetto
      const groundY = 272;
      const scale = 0.088;
      const { lengthMm, heightMm } = chs.overallDimensionsMm;
      const carW = Math.min(540, Math.max(295, lengthMm * scale));
      const carH = Math.min(152, Math.max(82, heightMm * scale));
      const wbPx = Math.min(carW * 0.74, Math.max(carW * 0.48, chs.wheelbaseMm * scale));
      const clearancePx = Math.max(7, Math.min(28, chs.groundClearanceMm * scale));

      const primaryPos = chs.supportedEnginePositions[0] ?? 'Anteriore';
      const hasFront = primaryPos === 'Anteriore' || primaryPos === 'Anteriore-Centrale';
      const hasMidRear = primaryPos === 'Centrale-Posteriore' || primaryPos === 'Posteriore';
      const frontOverhangShare =
        hasFront && !hasMidRear ? 0.48 : hasMidRear && !hasFront ? 0.44 : 0.46;

      const x0 = (W - carW) / 2;
      const x1 = x0 + carW;
      const totalOverhangPx = Math.max(42, carW - wbPx);
      const frontAxleX = x0 + totalOverhangPx * frontOverhangShare;
      const rearAxleX = frontAxleX + wbPx;

      const bottomY = groundY - clearancePx;
      const topY = groundY - carH; // >= 120 px (>38% del canvas libero sopra il tetto!)
      const wheelR = Math.max(20, Math.min(29, 18 + clearancePx * 0.36));
      const wheelCy = groundY - wheelR;
      const archR = wheelR + 5;

      const blueprint = buildBlueprintGeometry(cfg.bodyStyle, x0, x1, bottomY, topY, eraT);

      const baseRearAngle = cfg.rearAero.type === 'none' ? 0 : cfg.rearAero.angleDeg;
      const visualRearAngle =
        effMode === 'low-drag'
          ? 1.5
          : effMode === 'airbrake'
            ? 55
            : baseRearAngle;
      const isRearWingStalled =
        (cfg.rearAero.type !== 'none' && cfg.rearAero.angleDeg > 20) || effMode === 'airbrake';

      const streamColor =
        effMode === 'airbrake'
          ? '#fb7185'
          : effMode === 'low-drag'
            ? '#34d399'
            : '#38bdf8';

      // Profilo liscio gaussiano che anticipa dolcemente muso e parabrezza senza tuffarsi verso il basso
      const getSmoothBodyEnvelopeY = (x: number): number => {
        const clamped = clamp(x, x0, x1);
        let sum = 0;
        let wSum = 0;
        for (let dx = -48; dx <= 48; dx += 8) {
          const w = Math.exp(-(dx * dx) / (2 * 24 * 24));
          const sx = clamp(clamped + dx, x0, x1);
          sum += blueprint.getTopY(sx) * w;
          wSum += w;
        }
        return Math.min(sum / wSum, blueprint.getTopY(clamped));
      };

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Sfondo galleria del vento + griglia
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#020617');
      bgGrad.addColorStop(0.75, '#091024');
      bgGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
      ctx.lineWidth = 0.7;
      for (let gx = 0; gx <= W; gx += 26) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, H);
        ctx.stroke();
      }
      for (let gy = 0; gy <= H; gy += 26) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }

      // 2. Streamline CFD superiori (7 linee):
      // - Entrano perfettamente ORIZZONTALI da sinistra (nessun tuffo sul faro!)
      // - Si sollevano morbidamente al punto di ristagno del muso e scorrono sopra getTopY(x)
      // - Mostrano upwash dietro l'ala posteriore (o turbolenza rossa in stallo/Airbrake)
      const noseStagnationY = blueprint.getTopY(x0 + 8);
      const hasRearWing =
        cfg.rearAero.type !== 'none' ||
        (cfg.activeAeroType === 'retractable-spoiler' && effMode !== 'low-drag');
      const frontAngleLiftPx =
        cfg.frontAero.type === 'none' ? 0 : 2 + cfg.frontAero.angleDeg * 0.45;

      for (let i = 0; i < 7; i++) {
        const laneClearance = 10 + i * 13;
        // Quota orizzontale indisturbata a monte dell'auto (sempre ben lontana dal bordo superiore!)
        const yFree = Math.max(18 + i * 11, noseStagnationY - 4 - i * 15.5);

        ctx.save();
        const isWakeTurbulentLane = isRearWingStalled && hasRearWing && i <= 2;
        ctx.strokeStyle = isWakeTurbulentLane ? '#fb7185' : streamColor;
        ctx.globalAlpha = Math.max(0.18, 0.62 - i * 0.065);
        ctx.lineWidth = i === 0 ? 1.9 : 1.35;
        ctx.setLineDash([15, 9]);
        ctx.lineDashOffset = -phasePx * (1 + (6 - i) * 0.04);
        ctx.beginPath();

        for (let sx = 14; sx <= W - 14; sx += 8) {
          let sy = yFree;

          if (sx <= x1) {
            // Influenza morbida a monte del muso (inizia ~85 px prima di x0, solo sollevamento verso l'alto!)
            const leadIn = sx < x0 ? Math.exp(-Math.pow((x0 - sx) / 42, 2)) : 1;
            const envY = getSmoothBodyEnvelopeY(Math.max(x0, sx)) - laneClearance;
            const frontCanardDeflect =
              sx >= x0 - 20 && sx <= x0 + 70 && i <= 1
                ? frontAngleLiftPx * Math.exp(-Math.pow((sx - x0 - 10) / 30, 2))
                : 0;
            const targetCarY = envY - frontCanardDeflect;
            const liftUp = Math.max(0, yFree - targetCarY) * leadIn;
            sy = yFree - liftUp;

            if (sx >= x0) {
              // Vincolo tassativo: mai sotto getTopY(sx) - (laneClearance - 2)
              sy = Math.min(sy, blueprint.getTopY(sx) - (laneClearance - 2));
            }
          } else {
            // Scia a valle della coda + Upwash ala posteriore
            const distBehind = sx - x1;
            const decay = Math.exp(-distBehind / 155);
            const tailEnvY = getSmoothBodyEnvelopeY(x1) - laneClearance;
            const baseTailY = Math.min(yFree, tailEnvY);

            // Upwash generato dall'ala posteriore (si riduce a quasi zero col DRS aperto!)
            const upwashMax = hasRearWing
              ? Math.min(24, visualRearAngle * 0.85) * Math.max(0, 1 - i * 0.22)
              : 0;
            const upwash =
              upwashMax * (1 - Math.exp(-distBehind / 26)) * Math.exp(-distBehind / 160);

            // Onde di vortice (amplificate in stallo > 20° o Airbrake)
            const stallAmp = isWakeTurbulentLane ? 8.5 : 1.8 + curCx * 6;
            const wakeWave =
              Math.sin(sx * (isWakeTurbulentLane ? 0.095 : 0.055) - phasePx * 0.08 + i) *
              stallAmp *
              Math.min(1, distBehind / 55);

            sy = baseTailY * decay + yFree * (1 - decay) - upwash + wakeWave;
          }

          sy = clamp(sy, 10 + i * 3, groundY - 8);
          if (sx === 14) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.restore();
      }

      // 3. Streamline dedicata di divisione sullo Splitter Anteriore (quando montato)
      if (cfg.frontAero.type !== 'none') {
        const splitY = bottomY - 3;
        const bladeLen = cfg.frontAero.type === 'road-lip' ? 14 : 24;
        const splitTipX = blueprint.frontSplitterAnchor.x - bladeLen + 5;
        ctx.save();
        ctx.strokeStyle = '#fbbf24';
        ctx.globalAlpha = 0.72;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([10, 6]);
        ctx.lineDashOffset = -phasePx * 1.15;
        // Ramo che entra orizzontale e viene deviato sopra lo splitter/canard
        ctx.beginPath();
        ctx.moveTo(14, splitY);
        ctx.lineTo(splitTipX, splitY);
        ctx.quadraticCurveTo(
          x0 + 6,
           noseStagnationY - 6 - frontAngleLiftPx,
          x0 + 48,
          blueprint.getTopY(x0 + 48) - 7,
        );
        ctx.stroke();
        ctx.restore();
      }

      // 4. Flusso Sottoscocca & Diffusore (2 linee accelerate per Fondo Piatto/Venturi, 1 per Carenato, flusso grigio irregolare per Esposto)
      const numUnderLines =
        cfg.underbodyType === 'flat-floor-diffuser' ||
        cfg.underbodyType === 'venturi-ground-effect'
          ? 2
          : 1;
      for (let u = 0; u < numUnderLines; u++) {
        ctx.save();
        const isVenturiOrDiff =
          cfg.underbodyType === 'flat-floor-diffuser' ||
          cfg.underbodyType === 'venturi-ground-effect';
        const highEff = met.groundEffectEfficiency > 0.65;
        ctx.strokeStyle =
          cfg.underbodyType === 'exposed'
            ? '#64748b'
            : highEff
              ? '#22d3ee'
              : '#38bdf8';
        ctx.globalAlpha =
          cfg.underbodyType === 'exposed'
            ? 0.45
            : 0.25 + met.groundEffectEfficiency * 0.72;
        ctx.lineWidth =
          cfg.underbodyType === 'venturi-ground-effect' && highEff ? 2.2 : 1.4;
        ctx.setLineDash(cfg.underbodyType === 'exposed' ? [7, 7] : [13, 7]);
        ctx.lineDashOffset =
          -phasePx * (isVenturiOrDiff ? 1.45 + met.groundEffectEfficiency * 0.4 : 0.95);

        const baseUnderY =
          groundY - clearancePx * (numUnderLines === 2 ? (u === 0 ? 0.33 : 0.66) : 0.5);
        ctx.beginPath();
        for (let sx = 14; sx <= W - 14; sx += 10) {
          let uy = baseUnderY;
          if (cfg.underbodyType === 'exposed' && sx >= x0) {
            uy += Math.sin(sx * 0.11 - phasePx * 0.07) * 2.4;
          } else if (isVenturiOrDiff && sx > rearAxleX) {
            // Espansione verso l'alto in uscita dal diffusore posteriore
            const diffT = clamp((sx - rearAxleX) / (W - rearAxleX), 0, 1);
            const expandPx =
              (cfg.underbodyType === 'venturi-ground-effect' ? 22 : 12) *
              (0.4 + 0.6 * met.groundEffectEfficiency) *
              diffT;
            uy -= expandPx;
          }
          if (sx === 14) ctx.moveTo(sx, uy);
          else ctx.lineTo(sx, uy);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Suolo Z=0
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(14, groundY);
      ctx.lineTo(W - 14, groundY);
      ctx.stroke();

      // 5. Struttura Fondo Piatto / Canale Venturi / Diffusore
      if (cfg.underbodyType !== 'exposed') {
        ctx.save();
        ctx.fillStyle =
          cfg.underbodyType === 'venturi-ground-effect'
            ? 'rgba(6, 182, 212, 0.55)'
            : 'rgba(56, 189, 248, 0.38)';
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        const diffLift = cfg.underbodyType === 'venturi-ground-effect' ? 12 : 7;
        ctx.moveTo(frontAxleX + wheelR * 0.55, bottomY);
        ctx.lineTo(rearAxleX + wheelR * 0.45, bottomY);
        ctx.lineTo(x1 - 3, bottomY - diffLift);
        ctx.lineTo(x1 - 3, bottomY - diffLift + 3.5);
        ctx.lineTo(rearAxleX + wheelR * 0.45, bottomY + 2.5);
        ctx.lineTo(frontAxleX + wheelR * 0.55, bottomY + 2.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // 6. Ombra interna vani ruota
      [frontAxleX, rearAxleX].forEach((ax) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax, wheelCy, archR + 2, Math.PI, Math.PI * 2);
        ctx.fillStyle = '#020617';
        ctx.fill();
        ctx.restore();
      });

      // 7. Scocca principale parametrizzata per decennio + passaruota scavati
      ctx.save();
      ctx.beginPath();
      const firstSeg = blueprint.upperSegments[0];
      ctx.moveTo(x0 + 4, bottomY - 2);
      ctx.lineTo(firstSeg.x0, firstSeg.y0);
      for (const seg of blueprint.upperSegments) {
        ctx.bezierCurveTo(seg.cx1, seg.cy1, seg.cx2, seg.cy2, seg.x1, seg.y1);
      }
      ctx.lineTo(x1, bottomY - 5);
      ctx.quadraticCurveTo(x1 - 3, bottomY, rearAxleX + archR, bottomY);
      ctx.arc(rearAxleX, wheelCy, archR, 0, Math.PI, true);
      ctx.lineTo(frontAxleX + archR, bottomY);
      ctx.arc(frontAxleX, wheelCy, archR, 0, Math.PI, true);
      ctx.lineTo(x0 + 4, bottomY - 2);
      ctx.closePath();

      const bodyGrad = ctx.createLinearGradient(0, topY, 0, bottomY);
      bodyGrad.addColorStop(0, '#64748b');
      bodyGrad.addColorStop(0.38, '#334155');
      bodyGrad.addColorStop(0.85, '#1e293b');
      bodyGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.9;
      ctx.stroke();

      // Paraurti sporgenti anni '70-'80
      if (blueprint.frontBumperBox) {
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.2;
        ctx.fillRect(
          blueprint.frontBumperBox.x,
          blueprint.frontBumperBox.y,
          blueprint.frontBumperBox.w,
          blueprint.frontBumperBox.h,
        );
        ctx.strokeRect(
          blueprint.frontBumperBox.x,
          blueprint.frontBumperBox.y,
          blueprint.frontBumperBox.w,
          blueprint.frontBumperBox.h,
        );
      }
      if (blueprint.rearBumperBox) {
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.2;
        ctx.fillRect(
          blueprint.rearBumperBox.x,
          blueprint.rearBumperBox.y,
          blueprint.rearBumperBox.w,
          blueprint.rearBumperBox.h,
        );
        ctx.strokeRect(
          blueprint.rearBumperBox.x,
          blueprint.rearBumperBox.y,
          blueprint.rearBumperBox.w,
          blueprint.rearBumperBox.h,
        );
      }
      ctx.restore();

      // 8. Vetrature laterali e linee portiere
      ctx.save();
      const glassGrad = ctx.createLinearGradient(x0, topY, x1, bottomY - carH * 0.45);
      glassGrad.addColorStop(0, 'rgba(56, 189, 248, 0.34)');
      glassGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.16)');
      glassGrad.addColorStop(1, 'rgba(56, 189, 248, 0.28)');

      for (const win of blueprint.windows) {
        ctx.beginPath();
        win.forEach(([wx, wy], idx) => {
          if (idx === 0) ctx.moveTo(wx, wy);
          else ctx.lineTo(wx, wy);
        });
        ctx.closePath();
        ctx.fillStyle = glassGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.65)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      if (blueprint.sideIntake) {
        ctx.beginPath();
        blueprint.sideIntake.forEach(([ix, iy], idx) => {
          if (idx === 0) ctx.moveTo(ix, iy);
          else ctx.lineTo(ix, iy);
        });
        ctx.closePath();
        ctx.fillStyle = '#090d16';
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1;
      for (const line of blueprint.shutlines) {
        ctx.beginPath();
        line.forEach(([lx, ly], idx) => {
          if (idx === 0) ctx.moveTo(lx, ly);
          else ctx.lineTo(lx, ly);
        });
        ctx.stroke();
      }
      ctx.restore();

      // 9. Fari anteriori e fanali posteriori (evoluti per decennio)
      ctx.save();
      ctx.fillStyle = eraT < 0.35 ? '#fef08a' : '#e0f2fe';
      ctx.shadowColor = eraT < 0.35 ? '#facc15' : '#38bdf8';
      ctx.shadowBlur = 5;
      ctx.fillRect(
        blueprint.headlight.x,
        blueprint.headlight.y,
        blueprint.headlight.w,
        blueprint.headlight.h,
      );
      ctx.fillStyle = '#fb7185';
      ctx.shadowColor = '#f43f5e';
      ctx.fillRect(
        blueprint.taillight.x,
        blueprint.taillight.y,
        blueprint.taillight.w,
        blueprint.taillight.h,
      );
      ctx.restore();

      // 10. Appendici Anteriori (Splitter / Road-Lip / Canards)
      if (cfg.frontAero.type !== 'none') {
        ctx.save();
        ctx.translate(blueprint.frontSplitterAnchor.x, blueprint.frontSplitterAnchor.y);
        ctx.rotate((-cfg.frontAero.angleDeg * 0.55 * Math.PI) / 180);
        const bladeLen = cfg.frontAero.type === 'road-lip' ? 14 : 24;
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-bladeLen + 5, -2, bladeLen, 3.5);
        if (cfg.frontAero.type !== 'road-lip') {
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(-bladeLen + 7, -2);
          ctx.lineTo(-2, -10);
          ctx.stroke();
        }
        if (cfg.frontAero.type === 'splitter-canards') {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.moveTo(-3, -14);
          ctx.lineTo(9, -9);
          ctx.lineTo(9, -6);
          ctx.lineTo(-3, -11);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // 11. Appendice Posteriore (Baule/Coda o Tetto Lunotto)
      const showActiveRetractable =
        cfg.rearAero.type === 'none' &&
        cfg.activeAeroType === 'retractable-spoiler' &&
        effMode !== 'low-drag';

      if (cfg.rearAero.type !== 'none' || showActiveRetractable) {
        const { x: rx, y: ry, isRoofMount } = blueprint.rearMount;
        ctx.save();
        ctx.translate(rx, ry);

        if (cfg.rearAero.type === 'ducktail-lip' || showActiveRetractable) {
          const lipH = Math.max(6, Math.min(16, 6 + visualRearAngle * 0.4));
          ctx.fillStyle = effMode === 'airbrake' ? '#fb7185' : '#f59e0b';
          ctx.beginPath();
          ctx.moveTo(-13, 1);
          ctx.quadraticCurveTo(-2, -lipH * 0.5, isRoofMount ? 10 : 6, -lipH);
          ctx.lineTo(isRoofMount ? 12 : 9, 2);
          ctx.closePath();
          ctx.fill();
        } else {
          const pylonH = isRoofMount ? 14 : 20;
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 2.1;
          ctx.beginPath();
          if (cfg.rearAero.type === 'swan-neck-wing') {
            ctx.moveTo(-7, 2);
            ctx.bezierCurveTo(-9, -pylonH - 5, -3, -pylonH - 7, 2, -pylonH - 2);
          } else {
            ctx.moveTo(-4, 2);
            ctx.lineTo(-2, -pylonH);
          }
          ctx.stroke();

          ctx.translate(-1, -pylonH);
          ctx.rotate((visualRearAngle * Math.PI) / 180);
          ctx.fillStyle =
            effMode === 'airbrake'
              ? '#fb7185'
              : effMode === 'low-drag'
                ? '#34d399'
                : cfg.rearAero.angleDeg > 20
                  ? '#ef4444'
                  : '#f59e0b';
          ctx.beginPath();
          ctx.moveTo(-18, -1);
          ctx.bezierCurveTo(-9, -5.5, 6, -3.5, 20, 1);
          ctx.bezierCurveTo(7, 3, -7, 2, -18, -1);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // 12. Ruote con rapporto cerchio/spalla evoluto per decennio (rimRatio: 0.52 nel 1970 -> 0.72 nel 2025)
      const rimRatio = 0.52 + 0.20 * eraT;
      [frontAxleX, rearAxleX].forEach((wx) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(wx, wheelCy, wheelR, 0, Math.PI * 2);
        ctx.fillStyle = '#090d16';
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.stroke();

        const rimR = wheelR * rimRatio;
        ctx.beginPath();
        ctx.arc(wx, wheelCy, rimR, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(wx, wheelCy, rimR * 0.62, 0, Math.PI * 2);
        ctx.fillStyle = '#475569';
        ctx.fill();

        const spokeCount = eraT >= 0.65 ? 7 : 5;
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = eraT >= 0.65 ? 1.5 : 2;
        for (let s = 0; s < spokeCount; s++) {
          const ang = (s * Math.PI * 2) / spokeCount - Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(wx, wheelCy);
          ctx.lineTo(wx + Math.cos(ang) * (rimR - 1), wheelCy + Math.sin(ang) * (rimR - 1));
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(wx, wheelCy, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.restore();
      });

      // 13. Frecce Downforce / Lift ancorate verticalmente sopra i passaruota anteriore e posteriore
      [
        { x: frontAxleX, load: fKg },
        { x: rearAxleX, load: rKg },
      ].forEach(({ x, load }) => {
        const isDown = load >= 0;
        const len = Math.min(38, Math.max(12, Math.abs(load) * 0.14));
        const bodyAtAxleY = blueprint.getTopY(x);
        const anchorY = Math.max(46, bodyAtAxleY - 8);
        const color = isDown ? '#22d3ee' : '#fb7185';
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        if (isDown) {
          ctx.moveTo(x, anchorY - len);
          ctx.lineTo(x, anchorY - 4);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x - 5.5, anchorY - 7);
          ctx.lineTo(x + 5.5, anchorY - 7);
          ctx.lineTo(x, anchorY + 1);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.moveTo(x, anchorY);
          ctx.lineTo(x, anchorY - len + 4);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x - 5.5, anchorY - len + 7);
          ctx.lineTo(x + 5.5, anchorY - len + 7);
          ctx.lineTo(x, anchorY - len - 1);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      });

      // 14. Badge discreto epoca stilistica in basso a sinistra (fuori dalla zona flusso)
      const eraBadgeText = `Stile Carrozzeria: ${getEraStyleLabel(cfg.year)} (${cfg.year})`;
      ctx.save();
      ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      const textW = ctx.measureText(eraBadgeText).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(14, H - 29, textW + 16, 20, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(eraBadgeText, 22, H - 15.5);
      ctx.restore();

      ctx.restore();
      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden">
      {/* Header Galleria del Vento */}
      <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-950/60">
        <div className="flex items-center gap-2">
          <Wind className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
            Galleria del Vento CFD — {config.bodyStyle}
          </span>
        </div>

        {!isActiveAero ? (
          <span className="px-2.5 py-1 rounded border border-slate-700 bg-slate-900 text-slate-300 font-mono text-[11px] font-semibold">
            Assetto Fisso (Aerodinamica Passiva)
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
            <span className="text-slate-400 mr-1">Simula Stato in Pista (Anteprima):</span>
            <button
              type="button"
              onClick={() => onModeChange('high-downforce')}
              className={`px-2.5 py-1 rounded border transition cursor-pointer ${
                effectiveMode === 'high-downforce'
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              Curva (Base)
            </button>
            <button
              type="button"
              onClick={() => onModeChange('low-drag')}
              className={`px-2.5 py-1 rounded border transition cursor-pointer ${
                effectiveMode === 'low-drag'
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              Rettilineo (DRS)
            </button>
            {supportsAirbrake && (
              <button
                type="button"
                onClick={() => onModeChange('airbrake')}
                className={`px-2.5 py-1 rounded border transition cursor-pointer ${
                  effectiveMode === 'airbrake'
                    ? 'bg-rose-500/20 border-rose-400 text-rose-300 font-bold'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                Staccata (Airbrake)
              </button>
            )}
          </div>
        )}
      </div>

      {/* Canvas HiDPI 2D */}
      <div className="p-2.5 bg-slate-950">
        <canvas
          ref={canvasRef}
          className="w-full h-auto block rounded-lg"
          style={{ aspectRatio: '820 / 315' }}
        />
      </div>

      {/* Scheda Telemetrica Compatta Sotto il Canvas */}
      <div className="px-4 py-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/80 font-mono text-xs">
        <div>
          <div className="text-[10px] uppercase text-slate-400 flex items-center gap-1">
            <Gauge className="w-3 h-3 text-cyan-400" /> Cx ({isActiveAero ? effectiveMode : 'fisso'})
          </div>
          <div className="text-sm font-bold text-cyan-300">{activeCx.toFixed(3)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-slate-400">SCx / Area A</div>
          <div className="text-sm font-bold text-slate-200">
            {(metrics.frontalAreaM2 * activeCx).toFixed(3)} m²{' '}
            <span className="text-[11px] font-normal text-slate-400">
              ({metrics.frontalAreaM2.toFixed(2)} m²)
            </span>
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-slate-400 flex items-center gap-1">
            {activeDf200 >= 0 ? (
              <ArrowDown className="w-3 h-3 text-cyan-400" />
            ) : (
              <ArrowUp className="w-3 h-3 text-rose-400" />
            )}
            {activeDf200 >= 0 ? 'Downforce @200 / @300' : 'Portanza (Lift) @200 / @300'}
          </div>
          <div
            className={`text-sm font-bold ${
              activeDf200 >= 0 ? 'text-emerald-300' : 'text-rose-400'
            }`}
          >
            {activeDf200} kg / {activeDf300} kg
            {activeDf200 < 0 ? ' · Lift' : ''}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-slate-400">Assi (@200 km/h)</div>
          <div className="text-sm font-bold text-amber-300">
            Ant {frontLoadKg} kg{frontLoadKg < 0 ? ' (Lift)' : ''} • Post {rearLoadKg} kg
            {rearLoadKg < 0 ? ' (Lift)' : ''}
          </div>
        </div>
      </div>
    </div>
  );
};
