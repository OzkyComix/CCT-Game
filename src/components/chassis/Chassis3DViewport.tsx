import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Box, Eye, Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import {
  type ChassisConfigInput,
  type ChassisMetricsResult,
  resolveChassisLayoutRules,
} from '../../math/chassisMath';

export type ChassisViewPreset = 'iso' | 'side' | 'top' | 'front';

interface Chassis3DViewportProps {
  config: ChassisConfigInput;
  metrics: ChassisMetricsResult;
  layoutRules: ReturnType<typeof resolveChassisLayoutRules>;
  previewAwdAsset: boolean;
  onTogglePreviewAwd?: () => void;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface ProjectedPoint {
  sx: number;
  sy: number;
  depth: number;
}

interface CameraState {
  preset: ChassisViewPreset | 'free';
  yawDeg: number;
  pitchDeg: number;
  zoom: number;
}

interface StructurePalette {
  label: string;
  frameStroke: string;
  frameFill: string;
  secondaryStroke: string;
  reinforcementStroke: string;
  safetyStroke: string;
  nodeFill: string;
}

interface DrawFaceItem {
  kind: 'face';
  depth: number;
  pts: ProjectedPoint[];
  fill: string;
  stroke?: string;
  lineWidth?: number;
}

interface DrawLineItem {
  kind: 'line';
  depth: number;
  a: ProjectedPoint;
  b: ProjectedPoint;
  stroke: string;
  lineWidth: number;
  dash?: number[];
}

interface DrawNodeItem {
  kind: 'node';
  depth: number;
  p: ProjectedPoint;
  radius: number;
  fill: string;
  stroke?: string;
}

type RenderPrimitive = DrawFaceItem | DrawLineItem | DrawNodeItem;

const VIEW_PRESETS: Record<
  ChassisViewPreset,
  { label: string; yawDeg: number; pitchDeg: number; hint: string }
> = {
  iso: {
    label: 'Vista 3D Iso',
    yawDeg: 38,
    pitchDeg: 26,
    hint: 'Assonometria 3/4 anteriore-superiore',
  },
  side: {
    label: 'Vista Laterale (X-Z)',
    yawDeg: 0,
    pitchDeg: 0,
    hint: 'Passo, sbalzi, luce a terra e altezza cellula/vano',
  },
  top: {
    label: 'Vista Superiore (X-Y)',
    yawDeg: 0,
    pitchDeg: 90,
    hint: 'Carreggiate, larghezza scocca e pianta vano motore',
  },
  front: {
    label: 'Vista Frontale (Y-Z)',
    yawDeg: 90,
    pitchDeg: 0,
    hint: 'Sezione trasversale, carreggiata, luce a terra e ingombro frontale',
  },
};

function getStructurePalette(structureId: string): StructurePalette {
  switch (structureId) {
    case 'str-ladder-frame':
      return {
        label: 'Longheroni Separati (Body-on-Frame)',
        frameStroke: '#cbd5e1',
        frameFill: 'rgba(148, 163, 184, 0.14)',
        secondaryStroke: '#64748b',
        reinforcementStroke: '#f59e0b',
        safetyStroke: '#fbbf24',
        nodeFill: '#f59e0b',
      };
    case 'str-backbone-grp':
      return {
        label: 'Trave Centrale (Backbone) + GRP',
        frameStroke: '#2dd4bf',
        frameFill: 'rgba(20, 184, 166, 0.12)',
        secondaryStroke: '#0d9488',
        reinforcementStroke: '#5eead4',
        safetyStroke: '#38bdf8',
        nodeFill: '#2dd4bf',
      };
    case 'str-alu-spaceframe':
      return {
        label: 'Spaceframe Alluminio Estruso/Pressofuso',
        frameStroke: '#e2e8f0',
        frameFill: 'rgba(226, 232, 240, 0.08)',
        secondaryStroke: '#38bdf8',
        reinforcementStroke: '#7dd3fc',
        safetyStroke: '#0ea5e9',
        nodeFill: '#38bdf8',
      };
    case 'str-carbon-monocoque':
      return {
        label: 'Monoscocca Carbonio Pre-Preg',
        frameStroke: '#c084fc',
        frameFill: 'rgba(30, 41, 59, 0.65)',
        secondaryStroke: '#94a3b8',
        reinforcementStroke: '#a855f7',
        safetyStroke: '#e879f9',
        nodeFill: '#c084fc',
      };
    case 'str-alu-carbon-supercar':
      return {
        label: 'Vasca Carbonio + Telaietti Alluminio',
        frameStroke: '#c084fc',
        frameFill: 'rgba(30, 41, 59, 0.58)',
        secondaryStroke: '#38bdf8',
        reinforcementStroke: '#7dd3fc',
        safetyStroke: '#a855f7',
        nodeFill: '#38bdf8',
      };
    case 'str-uhss-steel':
      return {
        label: 'Monoscocca Acciaio UHSS / Boro',
        frameStroke: '#34d399',
        frameFill: 'rgba(16, 185, 129, 0.10)',
        secondaryStroke: '#10b981',
        reinforcementStroke: '#6ee7b7',
        safetyStroke: '#fb7185',
        nodeFill: '#34d399',
      };
    case 'str-hybrid-giorgio':
      return {
        label: 'Ibrido UHSS / Alluminio / Carbonio',
        frameStroke: '#38bdf8',
        frameFill: 'rgba(56, 189, 248, 0.10)',
        secondaryStroke: '#a855f7',
        reinforcementStroke: '#7dd3fc',
        safetyStroke: '#fb7185',
        nodeFill: '#38bdf8',
      };
    default:
      return {
        label: 'Monoscocca Acciaio Stampato',
        frameStroke: '#60a5fa',
        frameFill: 'rgba(59, 130, 246, 0.10)',
        secondaryStroke: '#3b82f6',
        reinforcementStroke: '#93c5fd',
        safetyStroke: '#f59e0b',
        nodeFill: '#60a5fa',
      };
  }
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function avgDepth(pts: ProjectedPoint[]): number {
  let sum = 0;
  for (const p of pts) sum += p.depth;
  return sum / pts.length;
}

export const Chassis3DViewport: React.FC<Chassis3DViewportProps> = ({
  config,
  metrics,
  layoutRules,
  previewAwdAsset,
  onTogglePreviewAwd,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const captionId = useId();

  const [camera, setCamera] = useState<CameraState>({
    preset: 'iso',
    yawDeg: VIEW_PRESETS.iso.yawDeg,
    pitchDeg: VIEW_PRESETS.iso.pitchDeg,
    zoom: 1.0,
  });

  const [canvasSize, setCanvasSize] = useState({ width: 580, height: 320 });

  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number | null;
    lastX: number;
    lastY: number;
  }>({
    active: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
  });

  // Osserva dimensioni reali del container per DPI nitido su Retina/desktop/mobile
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 80 && rect.height > 80) {
        setCanvasSize({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel non passivo sul canvas per zoomare senza scrollare la pagina
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      setCamera((prev) => ({
        ...prev,
        zoom: Math.max(0.55, Math.min(2.3, Number((prev.zoom * factor).toFixed(3)))),
      }));
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  const applyPreset = useCallback((preset: ChassisViewPreset) => {
    const p = VIEW_PRESETS[preset];
    setCamera({
      preset,
      yawDeg: p.yawDeg,
      pitchDeg: p.pitchDeg,
      zoom: 1.0,
    });
  }, []);

  const adjustZoom = useCallback((deltaFactor: number) => {
    setCamera((prev) => ({
      ...prev,
      zoom: Math.max(0.55, Math.min(2.3, Number((prev.zoom * deltaFactor).toFixed(3)))),
    }));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastY: e.clientY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ds = dragStateRef.current;
    if (!ds.active || ds.pointerId !== e.pointerId) return;
    const dx = e.clientX - ds.lastX;
    const dy = e.clientY - ds.lastY;
    ds.lastX = e.clientX;
    ds.lastY = e.clientY;
    setCamera((prev) => {
      const nextYaw = ((prev.yawDeg + dx * 0.55) % 360 + 360) % 360;
      const rawPitch = prev.pitchDeg + dy * 0.45;
      const nextPitch = Math.max(5, Math.min(85, rawPitch));
      return {
        ...prev,
        preset: 'free',
        yawDeg: nextYaw,
        pitchDeg: nextPitch,
      };
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragStateRef.current.pointerId === e.pointerId) {
      dragStateRef.current.active = false;
      dragStateRef.current.pointerId = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const handleCanvasKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const stepYaw = 8;
    const stepPitch = 5;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setCamera((p) => ({ ...p, preset: 'free', yawDeg: (p.yawDeg - stepYaw + 360) % 360 }));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setCamera((p) => ({ ...p, preset: 'free', yawDeg: (p.yawDeg + stepYaw) % 360 }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCamera((p) => ({
        ...p,
        preset: 'free',
        pitchDeg: Math.min(85, Math.max(5, p.pitchDeg + stepPitch)),
      }));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCamera((p) => ({
        ...p,
        preset: 'free',
        pitchDeg: Math.min(85, Math.max(5, p.pitchDeg - stepPitch)),
      }));
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      adjustZoom(1.12);
    } else if (e.key === '-') {
      e.preventDefault();
      adjustZoom(0.89);
    }
  };

  const palette = useMemo(() => getStructurePalette(config.structureId), [config.structureId]);
  const primaryPos = config.supportedEnginePositions[0] ?? 'Anteriore';
  const primaryOri = config.supportedEngineOrientations[0] ?? 'Longitudinale';

  const frontDriven =
    metrics.resolvedDrivetrains.includes('FWD') || (metrics.hasAwdReady && previewAwdAsset);
  const rearDriven =
    metrics.resolvedDrivetrains.includes('RWD') || (metrics.hasAwdReady && previewAwdAsset);
  const isAwdVisual = frontDriven && rearDriven;

  // Render pipeline CAD 3D su Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvasSize.width;
    const H = canvasSize.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Sfondo tecnico CAD
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, W, H);

    // Geometria reale in millimetri (X: ant- a post+, Y: sx- a dx+, Z: terra 0 -> tetto +)
    const L = config.overallDimensionsMm.lengthMm;
    const Wcar = config.overallDimensionsMm.widthMm;
    const Hcar = config.overallDimensionsMm.heightMm;
    const WB = config.wheelbaseMm;
    const FT = config.frontTrackMm;
    const RT = config.rearTrackMm;
    const GC = config.groundClearanceMm;
    const frontX = -L / 2;
    const rearX = L / 2;
    const frontAxleX = frontX + metrics.frontOverhangMm;
    const rearAxleX = frontAxleX + WB;

    const tireRadius = Math.min(385, Math.max(275, 290 + GC * 0.42));
    const tireWidth = Math.min(275, Math.max(175, Wcar * 0.125));
    // Riferimento verticale stabile ancorato al piano stradale (Z=0) e scala basata sulla lunghezza:
    // variare groundClearanceMm solleva/abbassa fisicamente la scocca rispetto a ruote e asfalto
    const centerZ = 720;

    // Fattore scala viewport ancorato alle dimensioni orizzontali stabili (no rescaling aggressivo su Hcar)
    const maxSpan = Math.max(L * 1.12, Wcar * 1.55, 3100);
    const basePxPerMm = (Math.min(W * 0.84, H * 0.78) / maxSpan) * camera.zoom;

    const yaw = degToRad(camera.yawDeg);
    const pitch = degToRad(camera.pitchDeg);
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    // Proiezione 3D ortografica-prospettica leggera (distanza focal CAD morbida nelle viste 3D)
    const isOrthographicSnap =
      camera.preset === 'side' || camera.preset === 'top' || camera.preset === 'front';
    const perspectiveStrength = isOrthographicSnap ? 0 : 0.000048;

    const project = (pt: Vec3): ProjectedPoint => {
      const dx = pt.x;
      const dy = pt.y;
      const dz = pt.z - centerZ;

      // Rotazione Yaw attorno a Z (yaw=0 -> camera lungo -Y guarda verso +Y, X a sinistra/destra)
      // Nota: con xr = dx*cosY - dy*sinY e camDepth = dx*sinY + dy*cosY:
      // yaw=0 -> schermo X = +X (fronte a sx, retro a dx), depth = +Y!
      // yaw=90 -> schermo X = -Y (vista frontale Y-Z), depth = +X!
      const xr = dx * cosY - dy * sinY;
      const yr = dx * sinY + dy * cosY;

      // Rotazione Pitch attorno all'asse orizzontale schermo:
      // pitch=0 -> schermo Y = -dz (X-Z o Y-Z ortogonale)
      // pitch=90 -> schermo Y = -yr (X-Y dall'alto!)
      const zUp = dz * cosP + yr * sinP;
      const camDepth = -dz * sinP + yr * cosP;

      const persp = 1 / Math.max(0.45, 1 + camDepth * perspectiveStrength);
      const scale = basePxPerMm * persp;
      return {
        sx: W * 0.5 + xr * scale,
        sy: H * 0.52 - zUp * scale,
        depth: camDepth,
      };
    };

    const primitives: RenderPrimitive[] = [];

    const pushLine = (
      a: Vec3,
      b: Vec3,
      stroke: string,
      lineWidth = 1.4,
      dash?: number[],
      depthBias = 0,
    ) => {
      const pa = project(a);
      const pb = project(b);
      primitives.push({
        kind: 'line',
        depth: (pa.depth + pb.depth) / 2 + depthBias,
        a: pa,
        b: pb,
        stroke,
        lineWidth,
        dash,
      });
    };

    const pushFace = (
      verts: Vec3[],
      fill: string,
      stroke?: string,
      lineWidth = 1,
      depthBias = 0,
    ) => {
      const pts = verts.map(project);
      primitives.push({
        kind: 'face',
        depth: avgDepth(pts) + depthBias,
        pts,
        fill,
        stroke,
        lineWidth,
      });
    };

    const pushBox = (
      x0: number,
      x1: number,
      y0: number,
      y1: number,
      z0: number,
      z1: number,
      fill: string,
      stroke: string,
      lineWidth = 1.2,
      wireOnly = false,
      dash?: number[],
      depthBias = 0,
    ) => {
      const corners: Vec3[] = [
        { x: x0, y: y0, z: z0 },
        { x: x1, y: y0, z: z0 },
        { x: x1, y: y1, z: z0 },
        { x: x0, y: y1, z: z0 },
        { x: x0, y: y0, z: z1 },
        { x: x1, y: y0, z: z1 },
        { x: x1, y: y1, z: z1 },
        { x: x0, y: y1, z: z1 },
      ];
      if (!wireOnly) {
        const faces = [
          [0, 1, 2, 3],
          [4, 5, 6, 7],
          [0, 1, 5, 4],
          [2, 3, 7, 6],
          [0, 3, 7, 4],
          [1, 2, 6, 5],
        ];
        for (const f of faces) {
          pushFace(
            [corners[f[0]], corners[f[1]], corners[f[2]], corners[f[3]]],
            fill,
            stroke,
            lineWidth,
            depthBias,
          );
        }
      } else {
        const edges = [
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 0],
          [4, 5],
          [5, 6],
          [6, 7],
          [7, 4],
          [0, 4],
          [1, 5],
          [2, 6],
          [3, 7],
        ];
        for (const [i, j] of edges) {
          pushLine(corners[i], corners[j], stroke, lineWidth, dash, depthBias);
        }
      }
    };

    // ------------------------------------------------------------
    // 1. PIANO TERRA CAD (Z = 0)
    // ------------------------------------------------------------
    const gridHalfX = Math.max(2600, L * 0.62);
    const gridHalfY = Math.max(1400, Wcar * 0.85);
    for (let gx = -Math.floor(gridHalfX / 500) * 500; gx <= gridHalfX; gx += 500) {
      pushLine(
        { x: gx, y: -gridHalfY, z: 0 },
        { x: gx, y: gridHalfY, z: 0 },
        'rgba(30, 41, 59, 0.7)',
        0.8,
        undefined,
        9000,
      );
    }
    for (let gy = -Math.floor(gridHalfY / 400) * 400; gy <= gridHalfY; gy += 400) {
      pushLine(
        { x: -gridHalfX, y: gy, z: 0 },
        { x: gridHalfX, y: gy, z: 0 },
        gy === 0 ? 'rgba(51, 65, 85, 0.9)' : 'rgba(30, 41, 59, 0.7)',
        gy === 0 ? 1 : 0.8,
        gy === 0 ? [5, 5] : undefined,
        9000,
      );
    }

    // ------------------------------------------------------------
    // 2. RUOTE CILINDRICHE 3D (4 ruote reali appoggiate a Z = 0)
    // ------------------------------------------------------------
    const drawWheel = (cx: number, cy: number, driven: boolean) => {
      const segments = 18;
      const yInner = cy < 0 ? cy + tireWidth * 0.5 : cy - tireWidth * 0.5;
      const yOuter = cy < 0 ? cy - tireWidth * 0.5 : cy + tireWidth * 0.5;
      const tireFill = driven ? 'rgba(245, 158, 11, 0.24)' : 'rgba(71, 85, 105, 0.24)';
      const tireStroke = driven ? '#f59e0b' : '#64748b';
      const rimStroke = driven ? '#fcd34d' : '#94a3b8';

      const outerPts: Vec3[] = [];
      const innerPts: Vec3[] = [];
      const rimOuterPts: Vec3[] = [];
      const rimInnerPts: Vec3[] = [];
      const rimR = tireRadius * 0.60;

      for (let i = 0; i < segments; i++) {
        const th = (i / segments) * Math.PI * 2;
        const ox = cx + Math.cos(th) * tireRadius;
        const oz = tireRadius + Math.sin(th) * tireRadius;
        outerPts.push({ x: ox, y: yOuter, z: oz });
        innerPts.push({ x: ox, y: yInner, z: oz });

        const rx = cx + Math.cos(th) * rimR;
        const rz = tireRadius + Math.sin(th) * rimR;
        rimOuterPts.push({ x: rx, y: yOuter, z: rz });
        rimInnerPts.push({ x: rx, y: yInner, z: rz });
      }

      // Facce battistrada + fianchi + cerchio
      for (let i = 0; i < segments; i++) {
        const next = (i + 1) % segments;
        pushFace(
          [outerPts[i], outerPts[next], innerPts[next], innerPts[i]],
          tireFill,
          tireStroke,
          0.9,
        );
      }
      pushFace(outerPts, tireFill, tireStroke, 1.3);
      pushFace(innerPts, tireFill, tireStroke, 0.9);
      pushFace(rimOuterPts, 'rgba(15, 23, 42, 0.65)', rimStroke, 1.1);
      pushFace(rimInnerPts, 'rgba(15, 23, 42, 0.5)', rimStroke, 0.8);

      // Razze semplici del cerchio sul fianco esterno
      for (let s = 0; s < 5; s++) {
        const th = (s / 5) * Math.PI * 2;
        pushLine(
          { x: cx, y: yOuter, z: tireRadius },
          {
            x: cx + Math.cos(th) * rimR,
            y: yOuter,
            z: tireRadius + Math.sin(th) * rimR,
          },
          rimStroke,
          1.0,
        );
      }
    };

    drawWheel(frontAxleX, -FT / 2, frontDriven);
    drawWheel(frontAxleX, FT / 2, frontDriven);
    drawWheel(rearAxleX, -RT / 2, rearDriven);
    drawWheel(rearAxleX, RT / 2, rearDriven);

    // ------------------------------------------------------------
    // 3. ARCHITETTURA STRUTTURALE DIFFERENZIATA PER structureId
    // ------------------------------------------------------------
    const floorZ = GC;
    const reinfNorm = config.rigidityReinforcementPercent / 100;
    const safetyNorm = config.safetyStructurePercent / 100;

    const roofFrontX = frontAxleX + WB * 0.20;
    const roofRearX = rearAxleX - Math.min(260, WB * 0.08);
    const roofHalfW = Wcar * 0.36;
    // I duomi/passaruota mantengono una base minima strutturale; ~72% della variazione di heightMm va sul padiglione
    const minWheelClearTopZ = floorZ + Math.min(440, Math.max(320, tireRadius * 1.15));
    const beltZ = Math.min(
      Hcar - 180,
      minWheelClearTopZ + Math.max(0, Hcar - GC - 820) * 0.28,
    );

    // Helper: archi abitacolo (montanti A-B-C + tetto in wireframe tecnico)
    const drawCabinWireframe = (stroke: string, pillarThick = 1.2, crossRoof = false) => {
      const aBaseL: Vec3 = { x: frontAxleX + WB * 0.06, y: -Wcar * 0.44, z: beltZ };
      const aBaseR: Vec3 = { x: frontAxleX + WB * 0.06, y: Wcar * 0.44, z: beltZ };
      const cBaseL: Vec3 = { x: rearX - 180, y: -Wcar * 0.43, z: beltZ };
      const cBaseR: Vec3 = { x: rearX - 180, y: Wcar * 0.43, z: beltZ };

      const rFL: Vec3 = { x: roofFrontX, y: -roofHalfW, z: Hcar };
      const rFR: Vec3 = { x: roofFrontX, y: roofHalfW, z: Hcar };
      const rRL: Vec3 = { x: roofRearX, y: -roofHalfW, z: Hcar };
      const rRR: Vec3 = { x: roofRearX, y: roofHalfW, z: Hcar };

      // Cornice parabrezza, tetto e lunotto
      pushLine(aBaseL, rFL, stroke, pillarThick);
      pushLine(aBaseR, rFR, stroke, pillarThick);
      pushLine(rFL, rFR, stroke, pillarThick);
      pushLine(rFL, rRL, stroke, pillarThick);
      pushLine(rFR, rRR, stroke, pillarThick);
      pushLine(rRL, rRR, stroke, pillarThick);
      pushLine(rRL, cBaseL, stroke, pillarThick);
      pushLine(rRR, cBaseR, stroke, pillarThick);

      // Montanti B centrali + arco sicurezza
      const bX = (roofFrontX + roofRearX) * 0.48;
      const bTopL: Vec3 = { x: bX, y: -roofHalfW, z: Hcar };
      const bTopR: Vec3 = { x: bX, y: roofHalfW, z: Hcar };
      const bBotL: Vec3 = { x: bX, y: -Wcar * 0.47, z: floorZ + 80 };
      const bBotR: Vec3 = { x: bX, y: Wcar * 0.47, z: floorZ + 80 };
      const safetyW = 1.2 + safetyNorm * 1.6;
      pushLine(bBotL, bTopL, palette.safetyStroke, safetyW);
      pushLine(bBotR, bTopR, palette.safetyStroke, safetyW);
      pushLine(bTopL, bTopR, palette.safetyStroke, safetyW);

      if (crossRoof || reinfNorm > 0.3) {
        pushLine(rFL, rRR, palette.reinforcementStroke, 0.9, [4, 4]);
        pushLine(rFR, rRL, palette.reinforcementStroke, 0.9, [4, 4]);
      }

      // Linea cintura laterale
      pushLine({ x: frontX + 120, y: -Wcar * 0.44, z: beltZ * 0.94 }, aBaseL, stroke, 1.0);
      pushLine({ x: frontX + 120, y: Wcar * 0.44, z: beltZ * 0.94 }, aBaseR, stroke, 1.0);
      pushLine(aBaseL, cBaseL, stroke, 1.0);
      pushLine(aBaseR, cBaseR, stroke, 1.0);
    };

    const sid = config.structureId;

    if (sid === 'str-ladder-frame') {
      // DUE MASSICCI LONGHERONI + 5..7 TRAVERSE + SUPPORTI SCOCCA
      const railHalfY = Math.min(FT, RT) * 0.27;
      const railW = 90 + safetyNorm * 35;
      const railH = 125 + safetyNorm * 40;
      const kickZ = floorZ + 95;
      const frontRailEnd = frontX + 90;
      const rearRailEnd = rearX - 80;

      // Longherone SX e DX in 3 segmenti (front, center dip, rear axle arch)
      for (const side of [-1, 1]) {
        const y0 = side * railHalfY - railW * 0.5;
        const y1 = side * railHalfY + railW * 0.5;
        // Sezione anteriore sopra ponte ant
        pushBox(
          frontRailEnd,
          frontAxleX + 340,
          y0,
          y1,
          floorZ + 40,
          floorZ + 40 + railH,
          palette.frameFill,
          palette.frameStroke,
          1.7,
        );
        // Sezione centrale ribassata
        pushBox(
          frontAxleX + 340,
          rearAxleX - 320,
          y0,
          y1,
          floorZ,
          floorZ + railH,
          palette.frameFill,
          palette.frameStroke,
          1.8,
        );
        // Arco sopra ponte posteriore
        pushBox(
          rearAxleX - 320,
          rearRailEnd,
          y0,
          y1,
          kickZ,
          kickZ + railH,
          palette.frameFill,
          palette.frameStroke,
          1.7,
        );
        // Bracci supporto scocca (outriggers)
        for (const ox of [frontAxleX + 380, (frontAxleX + rearAxleX) / 2, rearAxleX - 360]) {
          pushLine(
            { x: ox, y: side * railHalfY, z: floorZ + railH * 0.6 },
            { x: ox, y: side * Wcar * 0.44, z: floorZ + railH * 0.6 },
            palette.reinforcementStroke,
            2.2,
          );
          primitives.push({
            kind: 'node',
            depth: project({ x: ox, y: side * Wcar * 0.44, z: floorZ + railH * 0.6 }).depth,
            p: project({ x: ox, y: side * Wcar * 0.44, z: floorZ + railH * 0.6 }),
            radius: 3,
            fill: palette.nodeFill,
          });
        }
      }

      // 5..7 traverse orizzontali (+ diagonale X con reinforcement)
      const crossCount = 5 + Math.round(reinfNorm * 2);
      for (let i = 0; i < crossCount; i++) {
        const cx =
          frontRailEnd + 60 + ((rearRailEnd - frontRailEnd - 120) * i) / (crossCount - 1);
        const cz = cx > rearAxleX - 320 ? kickZ + 45 : floorZ + 45;
        pushBox(
          cx - 35,
          cx + 35,
          -railHalfY,
          railHalfY,
          cz,
          cz + 75,
          'rgba(100, 116, 139, 0.25)',
          palette.secondaryStroke,
          1.4,
        );
      }
      if (reinfNorm > 0.25) {
        const midX0 = frontAxleX + 380;
        const midX1 = rearAxleX - 360;
        pushLine(
          { x: midX0, y: -railHalfY, z: floorZ + 60 },
          { x: midX1, y: railHalfY, z: floorZ + 60 },
          palette.reinforcementStroke,
          1.8,
        );
        pushLine(
          { x: midX0, y: railHalfY, z: floorZ + 60 },
          { x: midX1, y: -railHalfY, z: floorZ + 60 },
          palette.reinforcementStroke,
          1.8,
        );
      }

      // Carrozzeria superiore separata in wireframe leggero
      drawCabinWireframe('rgba(148, 163, 184, 0.35)', 1.0);
    } else if (sid === 'str-backbone-grp') {
      // TRAVE CENTRALE A SPINA DORSALE + FORCELLE + PAVIMENTO GRP
      const spineW = 160 + reinfNorm * 65;
      const spineH = 190 + safetyNorm * 50;
      const forkFrontX = frontAxleX + 320;
      const forkRearX = rearAxleX - 300;

      // Pavimento GRP perimetrale leggero
      pushBox(
        frontAxleX + 180,
        rearAxleX - 180,
        -Wcar * 0.42,
        Wcar * 0.42,
        floorZ,
        floorZ + 42,
        palette.frameFill,
        palette.secondaryStroke,
        1.1,
      );

      // Spina dorsale centrale scatolata
      pushBox(
        forkFrontX,
        forkRearX,
        -spineW * 0.5,
        spineW * 0.5,
        floorZ + 10,
        floorZ + spineH,
        'rgba(45, 212, 191, 0.20)',
        palette.frameStroke,
        2.0,
      );

      // Forcelle anteriori e posteriori per accogliere motore e gruppo posteriore
      for (const side of [-1, 1]) {
        const yF = side * (FT * 0.26);
        const yR = side * (RT * 0.26);
        pushLine(
          { x: forkFrontX, y: side * (spineW * 0.4), z: floorZ + spineH * 0.6 },
          { x: frontX + 140, y: yF, z: floorZ + 140 },
          palette.frameStroke,
          2.6,
        );
        pushLine(
          { x: forkFrontX, y: side * (spineW * 0.4), z: floorZ + 35 },
          { x: frontX + 140, y: yF, z: floorZ + 65 },
          palette.secondaryStroke,
          2.0,
        );
        pushLine(
          { x: forkRearX, y: side * (spineW * 0.4), z: floorZ + spineH * 0.6 },
          { x: rearX - 140, y: yR, z: floorZ + 140 },
          palette.frameStroke,
          2.6,
        );
      }

      // Roll-bar & parabrezza leggero stile Lotus Elan/Seven
      const rollX = rearAxleX - 240;
      const rollL: Vec3 = { x: rollX, y: -roofHalfW, z: Hcar };
      const rollR: Vec3 = { x: rollX, y: roofHalfW, z: Hcar };
      pushLine({ x: rollX, y: -Wcar * 0.42, z: floorZ + 50 }, rollL, palette.safetyStroke, 2.2);
      pushLine({ x: rollX, y: Wcar * 0.42, z: floorZ + 50 }, rollR, palette.safetyStroke, 2.2);
      pushLine(rollL, rollR, palette.safetyStroke, 2.2);
      pushLine(
        { x: roofFrontX, y: -roofHalfW, z: Math.min(Hcar, beltZ + 260) },
        { x: roofFrontX, y: roofHalfW, z: Math.min(Hcar, beltZ + 260) },
        palette.secondaryStroke,
        1.5,
      );
      pushLine(
        { x: frontAxleX + WB * 0.08, y: -Wcar * 0.42, z: beltZ * 0.88 },
        { x: roofFrontX, y: -roofHalfW, z: Math.min(Hcar, beltZ + 260) },
        palette.secondaryStroke,
        1.4,
      );
      pushLine(
        { x: frontAxleX + WB * 0.08, y: Wcar * 0.42, z: beltZ * 0.88 },
        { x: roofFrontX, y: roofHalfW, z: Math.min(Hcar, beltZ + 260) },
        palette.secondaryStroke,
        1.4,
      );
    } else if (sid === 'str-alu-spaceframe') {
      // SPACEFRAME IN ALLUMINIO: NODI PRESSOFUSI + ESTRUSI RETICOLARI + DIAGONALI
      const sillY = Wcar * 0.44;
      const railY = Math.min(FT, RT) * 0.28;
      const strutZ = floorZ + Math.max(360, (Hcar - GC) * 0.44);

      // Floor grid alluminio
      pushBox(
        frontX + 180,
        rearX - 160,
        -sillY,
        sillY,
        floorZ,
        floorZ + 65,
        palette.frameFill,
        palette.secondaryStroke,
        1.3,
      );

      // Travi longitudinali & puntoni duomi anteriori/posteriori
      for (const side of [-1, 1]) {
        const ySill = side * sillY;
        const yRail = side * railY;
        const yTower = side * (FT * 0.35);
        const yRearTower = side * (RT * 0.35);

        // Longheroni inferiori & superiori di assorbimento
        pushLine(
          { x: frontX + 90, y: yRail, z: floorZ + 70 },
          { x: frontAxleX + 350, y: yRail, z: floorZ + 70 },
          palette.frameStroke,
          2.0,
        );
        pushLine(
          { x: rearAxleX - 320, y: yRail, z: floorZ + 80 },
          { x: rearX - 80, y: yRail, z: floorZ + 110 },
          palette.frameStroke,
          2.0,
        );

        // Torrette duomi in alluminio pressofuso + diagonali
        const fTower: Vec3 = { x: frontAxleX, y: yTower, z: strutZ };
        const aPillarBot: Vec3 = { x: frontAxleX + WB * 0.08, y: ySill, z: beltZ };
        const fFoot: Vec3 = { x: frontAxleX + WB * 0.08, y: ySill, z: floorZ + 60 };
        const rTower: Vec3 = { x: rearAxleX, y: yRearTower, z: strutZ };
        const cFoot: Vec3 = { x: rearAxleX - 240, y: ySill, z: floorZ + 60 };

        pushLine(fFoot, fTower, palette.secondaryStroke, 1.9);
        pushLine(fTower, aPillarBot, palette.reinforcementStroke, 2.0);
        pushLine({ x: frontX + 110, y: yRail, z: floorZ + 140 }, fTower, palette.frameStroke, 1.8);
        pushLine(cFoot, rTower, palette.secondaryStroke, 1.9);
        pushLine(rTower, { x: roofRearX, y: side * roofHalfW, z: Hcar }, palette.reinforcementStroke, 1.8);

        // Triangolazione reticolare lungo i brancardi
        const midX = (frontAxleX + rearAxleX) * 0.5;
        pushLine(fFoot, { x: midX, y: ySill, z: beltZ * 0.9 }, palette.reinforcementStroke, 1.4);
        pushLine({ x: midX, y: ySill, z: floorZ + 55 }, aPillarBot, palette.reinforcementStroke, 1.4);
        pushLine({ x: midX, y: ySill, z: floorZ + 55 }, { x: rearAxleX - 240, y: ySill, z: beltZ * 0.9 }, palette.reinforcementStroke, 1.4);

        // Nodi pressofusi evidenziati
        for (const node of [fTower, rTower, fFoot, cFoot, aPillarBot]) {
          const pn = project(node);
          primitives.push({
            kind: 'node',
            depth: pn.depth,
            p: pn,
            radius: 3.2,
            fill: palette.nodeFill,
            stroke: '#0f172a',
          });
        }
      }

      // Barra duomi anteriore & posteriore
      pushLine(
        { x: frontAxleX, y: -FT * 0.35, z: strutZ },
        { x: frontAxleX, y: FT * 0.35, z: strutZ },
        palette.reinforcementStroke,
        1.7 + reinfNorm * 1.4,
      );
      pushLine(
        { x: rearAxleX, y: -RT * 0.35, z: strutZ },
        { x: rearAxleX, y: RT * 0.35, z: strutZ },
        palette.reinforcementStroke,
        1.7 + reinfNorm * 1.4,
      );

      drawCabinWireframe(palette.frameStroke, 1.5, true);
    } else if (sid === 'str-carbon-monocoque' || sid === 'str-alu-carbon-supercar') {
      // VASCA MONOSCOCCA IN CARBONIO + PARATIA TAGLIAFUOCO + TELAIETTI ANT/POST
      const tubFrontX = frontAxleX + WB * 0.10;
      const tubRearX =
        primaryPos === 'Centrale-Posteriore' || primaryPos === 'Posteriore'
          ? frontAxleX + WB * 0.62
          : rearAxleX - 200;
      const sillY = Wcar * 0.44;
      const sillZ = floorZ + Math.max(240, (Hcar - GC) * 0.34);

      // Fondo vasca centrale
      pushBox(
        tubFrontX,
        tubRearX,
        -sillY,
        sillY,
        floorZ,
        floorZ + 70,
        palette.frameFill,
        palette.frameStroke,
        1.6,
      );

      // Brancardi laterali alti in carbonio sfaccettato
      for (const side of [-1, 1]) {
        const y0 = side > 0 ? sillY - 125 : -sillY;
        const y1 = side > 0 ? sillY : -sillY + 125;
        pushBox(
          tubFrontX,
          tubRearX,
          y0,
          y1,
          floorZ + 70,
          sillZ,
          palette.frameFill,
          palette.frameStroke,
          1.5,
        );
      }

      // Paratia tagliafuoco posteriore e anteriore in CFRP
      const bulkheadZ = floorZ + Math.max(380, (Hcar - GC) * 0.62);
      pushBox(
        tubRearX - 45,
        tubRearX,
        -sillY + 60,
        sillY - 60,
        floorZ + 70,
        bulkheadZ,
        'rgba(168, 85, 247, 0.24)',
        palette.safetyStroke,
        1.8,
      );
      pushBox(
        tubFrontX,
        tubFrontX + 45,
        -sillY + 110,
        sillY - 110,
        floorZ + 70,
        sillZ + 120,
        'rgba(168, 85, 247, 0.20)',
        palette.frameStroke,
        1.4,
      );

      // Telaietti tubolari anteriore e posteriore imbullonati alla vasca
      const subStroke = palette.secondaryStroke;
      for (const side of [-1, 1]) {
        const ySubF = side * (FT * 0.30);
        const ySubR = side * (RT * 0.30);
        // Subframe anteriore
        pushLine(
          { x: tubFrontX, y: side * (sillY * 0.68), z: floorZ + 75 },
          { x: frontX + 100, y: ySubF, z: floorZ + 110 },
          subStroke,
          2.0,
        );
        pushLine(
          { x: tubFrontX, y: side * (sillY * 0.68), z: sillZ },
          { x: frontAxleX, y: ySubF, z: floorZ + 330 },
          subStroke,
          1.8,
        );
        pushLine(
          { x: frontAxleX, y: ySubF, z: floorZ + 330 },
          { x: frontX + 100, y: ySubF, z: floorZ + 110 },
          subStroke,
          1.6,
        );
        // Subframe posteriore
        pushLine(
          { x: tubRearX, y: side * (sillY * 0.72), z: floorZ + 75 },
          { x: rearX - 100, y: ySubR, z: floorZ + 120 },
          subStroke,
          2.1,
        );
        pushLine(
          { x: tubRearX, y: side * (sillY * 0.72), z: bulkheadZ * 0.88 },
          { x: rearAxleX, y: ySubR, z: floorZ + 360 },
          subStroke,
          1.9,
        );
        pushLine(
          { x: rearAxleX, y: ySubR, z: floorZ + 360 },
          { x: rearX - 100, y: ySubR, z: floorZ + 120 },
          subStroke,
          1.6,
        );
      }
      // Traverse di collegamento telaietti
      pushLine(
        { x: frontX + 100, y: -FT * 0.30, z: floorZ + 110 },
        { x: frontX + 100, y: FT * 0.30, z: floorZ + 110 },
        subStroke,
        1.8,
      );
      pushLine(
        { x: rearX - 100, y: -RT * 0.30, z: floorZ + 120 },
        { x: rearX - 100, y: RT * 0.30, z: floorZ + 120 },
        subStroke,
        1.8,
      );

      drawCabinWireframe(palette.frameStroke, 1.4, true);
    } else {
      // MONOSCOCCA ACCIAIO STAMPATO / UHSS BORO / IBRIDO GIORGIO
      const sillY = Wcar * 0.45;
      const railY = Math.min(FT, RT) * 0.29;
      const crashBoxThickness = 55 + safetyNorm * 55;
      const crashBoxH = 95 + safetyNorm * 55;
      const sillH = 95 + safetyNorm * 45;
      const towerZ = Math.min(beltZ * 0.94, floorZ + 370 + Math.max(0, Hcar - GC - 820) * 0.24);

      // Pianale centrale nervato
      const cabinStartX = frontAxleX + WB * 0.14;
      const cabinEndX = rearAxleX - 120;
      pushBox(
        cabinStartX,
        cabinEndX,
        -sillY,
        sillY,
        floorZ,
        floorZ + 48,
        palette.frameFill,
        palette.secondaryStroke,
        1.2,
      );

      // Brancardi laterali (spessore & colore sicurezza con safetyStructurePercent)
      for (const side of [-1, 1]) {
        const y0 = side > 0 ? sillY - 95 : -sillY;
        const y1 = side > 0 ? sillY : -sillY + 95;
        pushBox(
          cabinStartX,
          cabinEndX,
          y0,
          y1,
          floorZ,
          floorZ + sillH,
          'rgba(15, 23, 42, 0.35)',
          safetyNorm > 0.45 ? palette.safetyStroke : palette.frameStroke,
          1.3 + safetyNorm * 1.1,
        );

        // Longheroni crash-box anteriori e posteriori (spessore cresce con safetyStructurePercent!)
        const cy0 = side * railY - crashBoxThickness * 0.5;
        const cy1 = side * railY + crashBoxThickness * 0.5;
        pushBox(
          frontX + 75,
          cabinStartX + 40,
          cy0,
          cy1,
          floorZ + 40,
          floorZ + 40 + crashBoxH,
          palette.frameFill,
          palette.safetyStroke,
          1.4 + safetyNorm * 1.2,
        );
        pushBox(
          cabinEndX - 40,
          rearX - 75,
          cy0,
          cy1,
          floorZ + 55,
          floorZ + 55 + crashBoxH * 0.9,
          palette.frameFill,
          palette.safetyStroke,
          1.3 + safetyNorm * 1.1,
        );

        // Torrette sospensioni anteriori e posteriori
        const ftY = side * (FT * 0.36);
        const rtY = side * (RT * 0.36);
        pushBox(
          frontAxleX - 70,
          frontAxleX + 70,
          ftY - 55,
          ftY + 55,
          floorZ + 80,
          towerZ,
          'rgba(56, 189, 248, 0.14)',
          palette.frameStroke,
          1.3,
        );
        pushBox(
          rearAxleX - 65,
          rearAxleX + 65,
          rtY - 50,
          rtY + 50,
          floorZ + 90,
          towerZ * 0.92,
          'rgba(56, 189, 248, 0.14)',
          palette.frameStroke,
          1.3,
        );
      }

      // Traverse crash-bumper anteriore & posteriore
      pushBox(
        frontX + 45,
        frontX + 95,
        -railY - 70,
        railY + 70,
        floorZ + 60,
        floorZ + 60 + crashBoxH * 0.8,
        palette.frameFill,
        palette.safetyStroke,
        1.5,
      );
      pushBox(
        rearX - 95,
        rearX - 45,
        -railY - 70,
        railY + 70,
        floorZ + 70,
        floorZ + 70 + crashBoxH * 0.75,
        palette.frameFill,
        palette.safetyStroke,
        1.4,
      );

      // Traverse di rinforzo pavimento dinamiche con rigidityReinforcementPercent
      const floorRibs = 2 + Math.round(reinfNorm * 4);
      for (let i = 0; i < floorRibs; i++) {
        const rx = cabinStartX + 120 + ((cabinEndX - cabinStartX - 240) * i) / (floorRibs - 1);
        pushLine(
          { x: rx, y: -sillY + 60, z: floorZ + 52 },
          { x: rx, y: sillY - 60, z: floorZ + 52 },
          palette.reinforcementStroke,
          1.5 + reinfNorm * 1.4,
        );
      }
      // Barra duomi superiore se rinforzo >= 25%
      if (reinfNorm >= 0.25) {
        pushLine(
          { x: frontAxleX, y: -FT * 0.36, z: towerZ },
          { x: frontAxleX, y: FT * 0.36, z: towerZ },
          palette.reinforcementStroke,
          1.8 + reinfNorm * 1.2,
        );
      }

      drawCabinWireframe(palette.frameStroke, 1.2);
    }

    // ------------------------------------------------------------
    // 4. CATENA CINEMATICA 3D (ASSALI, DIFFERENZIALI, PTU/TRANSFER, TUNNEL, CAMBIO)
    // ------------------------------------------------------------
    const axleZ = tireRadius;
    const hasAwdPrep = metrics.hasAwdReady;
    const isPrepPreviewOnly = hasAwdPrep && !previewAwdAsset;
    const secondaryIsFront = layoutRules.nativePrimaryAxle === 'RWD';
    const secondaryIsRear = layoutRules.nativePrimaryAxle === 'FWD';

    // Semiassi / Assali fisici + differenziali (primari in ambra pieno; secondari AWD tratteggiati se 2WD Base, ambra pieno se AWD completo)
    const frontShaftColor = frontDriven
      ? '#f59e0b'
      : isPrepPreviewOnly && secondaryIsFront
        ? '#22d3ee'
        : '#475569';
    const frontShaftDash = !frontDriven && isPrepPreviewOnly && secondaryIsFront ? [5, 4] : undefined;
    pushLine(
      { x: frontAxleX, y: -FT / 2, z: axleZ },
      { x: frontAxleX, y: FT / 2, z: axleZ },
      frontShaftColor,
      frontDriven ? 2.8 : isPrepPreviewOnly && secondaryIsFront ? 2.1 : 1.6,
      frontShaftDash,
    );

    const rearShaftColor = rearDriven
      ? '#f59e0b'
      : isPrepPreviewOnly && secondaryIsRear
        ? '#22d3ee'
        : '#475569';
    const rearShaftDash = !rearDriven && isPrepPreviewOnly && secondaryIsRear ? [5, 4] : undefined;
    pushLine(
      { x: rearAxleX, y: -RT / 2, z: axleZ },
      { x: rearAxleX, y: RT / 2, z: axleZ },
      rearShaftColor,
      rearDriven ? 2.8 : isPrepPreviewOnly && secondaryIsRear ? 2.1 : 1.6,
      rearShaftDash,
    );

    if (frontDriven || (isPrepPreviewOnly && secondaryIsFront)) {
      pushBox(
        frontAxleX - 75,
        frontAxleX + 75,
        -95,
        95,
        axleZ - 75,
        axleZ + 75,
        frontDriven ? 'rgba(245, 158, 11, 0.35)' : 'rgba(34, 211, 238, 0.14)',
        frontDriven ? '#fbbf24' : '#22d3ee',
        1.4,
        !frontDriven,
        frontDriven ? undefined : [4, 3],
      );
    }
    if (rearDriven || (isPrepPreviewOnly && secondaryIsRear)) {
      pushBox(
        rearAxleX - 80,
        rearAxleX + 80,
        -105,
        105,
        axleZ - 80,
        axleZ + 80,
        rearDriven ? 'rgba(245, 158, 11, 0.35)' : 'rgba(34, 211, 238, 0.14)',
        rearDriven ? '#fbbf24' : '#22d3ee',
        1.4,
        !rearDriven,
        rearDriven ? undefined : [4, 3],
      );
    }

    // ------------------------------------------------------------
    // 5. BOX 3D VANO MOTORE QUOTATO + SAGOMA MOTORE & CAMBIO
    // ------------------------------------------------------------
    const bayL = metrics.engineBayMaxDimensionsMm.lengthMm;
    const bayW = metrics.engineBayMaxDimensionsMm.widthMm;
    const bayH = metrics.engineBayMaxDimensionsMm.heightMm;

    const setbackFrac = config.engineSetbackPercent / 100;

    let bayCenterX = frontAxleX;
    if (primaryPos === 'Centrale-Posteriore') {
      bayCenterX = rearAxleX - bayL * 0.56 - 140 + setbackFrac * 180;
    } else if (primaryPos === 'Posteriore') {
      bayCenterX = rearAxleX + 110 - setbackFrac * 140;
    } else if (primaryPos === 'Anteriore-Centrale') {
      bayCenterX = frontAxleX + 160 + setbackFrac * 240;
    } else {
      bayCenterX = frontAxleX - 70 + setbackFrac * 210;
    }
    const minBayCx = frontX + bayL * 0.5 + 45;
    const maxBayCx = rearX - bayL * 0.5 - 45;
    if (minBayCx <= maxBayCx) {
      bayCenterX = Math.max(minBayCx, Math.min(maxBayCx, bayCenterX));
    }

    const bayBottomZ = floorZ + 35;
    const bayTopZ = Math.min(Hcar - 40, bayBottomZ + bayH);

    // Parallelepipedo semitrasparente Vano Motore (depthBias negativo lieve per visibilità interna)
    pushBox(
      bayCenterX - bayL * 0.5,
      bayCenterX + bayL * 0.5,
      -bayW * 0.5,
      bayW * 0.5,
      bayBottomZ,
      bayTopZ,
      'rgba(245, 158, 11, 0.14)',
      '#f59e0b',
      1.7,
      false,
      undefined,
      -10,
    );
    // Bordo wireframe marcato del vano motore
    pushBox(
      bayCenterX - bayL * 0.5,
      bayCenterX + bayL * 0.5,
      -bayW * 0.5,
      bayW * 0.5,
      bayBottomZ,
      bayTopZ,
      'transparent',
      '#fbbf24',
      1.7,
      true,
      undefined,
      -20,
    );

    // Sagoma 3D wireframe del blocco motore dentro il vano (orientato Longitudinale vs Trasversale)
    const isLongitudinal = primaryOri === 'Longitudinale';
    const engL = isLongitudinal ? Math.min(bayL * 0.68, 620) : Math.min(bayL * 0.62, 390);
    const engW = isLongitudinal ? Math.min(bayW * 0.60, 460) : Math.min(bayW * 0.72, 620);
    const engH = Math.min((bayTopZ - bayBottomZ) * 0.72, 460);
    const engBotZ = bayBottomZ + 35;

    // Monoblocco + testata superiore + coppa olio
    pushBox(
      bayCenterX - engL * 0.5,
      bayCenterX + engL * 0.5,
      -engW * 0.5,
      engW * 0.5,
      engBotZ,
      engBotZ + engH * 0.68,
      'rgba(56, 189, 248, 0.24)',
      '#38bdf8',
      1.5,
      false,
      undefined,
      -30,
    );
    pushBox(
      bayCenterX - engL * 0.44,
      bayCenterX + engL * 0.44,
      -engW * 0.56,
      engW * 0.56,
      engBotZ + engH * 0.68,
      engBotZ + engH,
      'rgba(125, 211, 252, 0.22)',
      '#bae6fd',
      1.3,
      false,
      undefined,
      -35,
    );

    // Schema Cambio + Tunnel Centrale / Albero / Torque Tube
    const engineEndX =
      primaryPos === 'Centrale-Posteriore' || primaryPos === 'Posteriore'
        ? bayCenterX - engL * 0.5
        : bayCenterX + engL * 0.5;

    if (layoutRules.effectiveGearboxLayout === 'RearTransaxleTorqueTube') {
      // Torque Tube rigido + campana cambio al retrotreno
      pushLine(
        { x: bayCenterX + engL * 0.45, y: 0, z: axleZ + 20 },
        { x: rearAxleX - 180, y: 0, z: axleZ + 20 },
        '#38bdf8',
        4.2,
        undefined,
        -25,
      );
      pushBox(
        rearAxleX - 240,
        rearAxleX + 120,
        -140,
        140,
        axleZ - 75,
        axleZ + 115,
        'rgba(56, 189, 248, 0.28)',
        '#7dd3fc',
        1.6,
        false,
        undefined,
        -35,
      );
    } else {
      // Cambio accoppiato al motore (in linea se Longitudinale, affiancato se Trasversale)
      const gbX0 = isLongitudinal
        ? primaryPos === 'Posteriore'
          ? engineEndX - 250
          : engineEndX
        : bayCenterX - 110;
      const gbX1 = isLongitudinal
        ? primaryPos === 'Posteriore'
          ? engineEndX
          : engineEndX + 270
        : bayCenterX + 110;
      const gbY0 = isLongitudinal ? -125 : engW * 0.45;
      const gbY1 = isLongitudinal ? 125 : engW * 0.45 + 165;
      pushBox(
        gbX0,
        gbX1,
        gbY0,
        gbY1,
        engBotZ + 10,
        engBotZ + engH * 0.56,
        'rgba(148, 163, 184, 0.30)',
        '#cbd5e1',
        1.4,
        false,
        undefined,
        -32,
      );

      // Tunnel centrale strutturale + PTU / Transfer Case + Albero trasmissione
      const isFrontPrimaryRwdShaft =
        layoutRules.nativePrimaryAxle === 'RWD' &&
        (primaryPos === 'Anteriore' || primaryPos === 'Anteriore-Centrale');
      const showCentralTunnelAndShaft =
        hasAwdPrep ||
        isFrontPrimaryRwdShaft ||
        layoutRules.effectiveGearboxLayout === 'MidCentralTunnel';

      if (showCentralTunnelAndShaft) {
        const isPrimaryShaftActive = isFrontPrimaryRwdShaft || isAwdVisual;
        const shaftColor = isPrimaryShaftActive ? '#f59e0b' : '#22d3ee';
        const shaftDash = isPrimaryShaftActive ? undefined : [6, 4];

        const shaftStart =
          primaryPos === 'Centrale-Posteriore' || primaryPos === 'Posteriore'
            ? frontAxleX
            : Math.min(gbX1, frontAxleX + 260);
        const shaftEnd =
          primaryPos === 'Centrale-Posteriore' || primaryPos === 'Posteriore'
            ? Math.max(bayCenterX - engL * 0.45, rearAxleX - 280)
            : rearAxleX;

        // Tunnel strutturale BIW continuo lungo la scocca
        const tunnelX0 = Math.max(frontAxleX + 180, Math.min(shaftStart, shaftEnd) - 20);
        const tunnelX1 = Math.min(rearAxleX - 140, Math.max(shaftStart, shaftEnd) + 20);
        if (tunnelX1 > tunnelX0 + 80) {
          pushBox(
            tunnelX0,
            tunnelX1,
            -98,
            98,
            floorZ + 18,
            floorZ + 170,
            isPrimaryShaftActive ? 'rgba(245, 158, 11, 0.10)' : 'rgba(34, 211, 238, 0.09)',
            isPrimaryShaftActive ? 'rgba(245, 158, 11, 0.60)' : 'rgba(34, 211, 238, 0.58)',
            1.1,
            true,
            isPrimaryShaftActive ? undefined : [5, 4],
            -16,
          );
        }

        // Albero di trasmissione centrale
        pushLine(
          { x: shaftStart, y: 0, z: axleZ + 16 },
          { x: shaftEnd, y: 0, z: axleZ + 16 },
          shaftColor,
          isPrimaryShaftActive ? 3.4 : 2.3,
          shaftDash,
          -24,
        );

        // Scatola di rinvio (PTU / Transfer Case) per pianali Predisposti AWD
        if (hasAwdPrep) {
          const ptuX =
            primaryPos === 'Centrale-Posteriore' || primaryPos === 'Posteriore'
              ? gbX0 - 70
              : Math.max(frontAxleX + 120, gbX1);
          pushBox(
            ptuX - 65,
            ptuX + 65,
            -90,
            90,
            axleZ - 55,
            axleZ + 80,
            previewAwdAsset ? 'rgba(245, 158, 11, 0.36)' : 'rgba(34, 211, 238, 0.18)',
            previewAwdAsset ? '#fbbf24' : '#22d3ee',
            1.4,
            !previewAwdAsset,
            previewAwdAsset ? undefined : [4, 3],
            -30,
          );
        }
      }
    }

    // Tunnel + PTU + Albero anteriore extra se RearTransaxleTorqueTube è abbinato a RWD_AWD_Ready
    if (
      layoutRules.effectiveGearboxLayout === 'RearTransaxleTorqueTube' &&
      hasAwdPrep
    ) {
      const awdSecondaryColor = previewAwdAsset ? '#fbbf24' : '#22d3ee';
      const awdDash = previewAwdAsset ? undefined : [5, 4];
      pushLine(
        { x: frontAxleX, y: 0, z: axleZ + 10 },
        { x: rearAxleX - 240, y: 0, z: axleZ + 10 },
        awdSecondaryColor,
        previewAwdAsset ? 2.8 : 2.0,
        awdDash,
        -22,
      );
      pushBox(
        rearAxleX - 330,
        rearAxleX - 210,
        -88,
        88,
        axleZ - 55,
        axleZ + 80,
        previewAwdAsset ? 'rgba(245, 158, 11, 0.32)' : 'rgba(34, 211, 238, 0.16)',
        awdSecondaryColor,
        1.3,
        !previewAwdAsset,
        awdDash,
        -30,
      );
    }

    // Ordinamento Z (painter's algorithm: più lontano prima)
    primitives.sort((a, b) => b.depth - a.depth);

    for (const item of primitives) {
      if (item.kind === 'face') {
        if (item.pts.length < 3) continue;
        ctx.beginPath();
        ctx.moveTo(item.pts[0].sx, item.pts[0].sy);
        for (let i = 1; i < item.pts.length; i++) {
          ctx.lineTo(item.pts[i].sx, item.pts[i].sy);
        }
        ctx.closePath();
        if (item.fill !== 'transparent') {
          ctx.fillStyle = item.fill;
          ctx.fill();
        }
        if (item.stroke) {
          ctx.strokeStyle = item.stroke;
          ctx.lineWidth = item.lineWidth ?? 1;
          ctx.stroke();
        }
      } else if (item.kind === 'line') {
        ctx.beginPath();
        ctx.setLineDash(item.dash ?? []);
        ctx.moveTo(item.a.sx, item.a.sy);
        ctx.lineTo(item.b.sx, item.b.sy);
        ctx.strokeStyle = item.stroke;
        ctx.lineWidth = item.lineWidth;
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.beginPath();
        ctx.arc(item.p.sx, item.p.sy, item.radius, 0, Math.PI * 2);
        ctx.fillStyle = item.fill;
        ctx.fill();
        if (item.stroke) {
          ctx.strokeStyle = item.stroke;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // ------------------------------------------------------------
    // 6. RIFERIMENTI ASSI PULITI (Senza quote testuali sovrapposte al 3D)
    // ------------------------------------------------------------
    if (camera.preset !== 'front') {
      const antP = project({ x: frontX - 110, y: 0, z: 0 });
      const postP = project({ x: rearX + 110, y: 0, z: 0 });
      ctx.save();
      ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#34d399';
      ctx.fillText('ANT', antP.sx, antP.sy + 3);
      ctx.fillStyle = '#64748b';
      ctx.fillText('POST', postP.sx, postP.sy + 3);
      ctx.restore();
    }
  }, [
    camera,
    canvasSize,
    config,
    metrics,
    layoutRules,
    palette,
    frontDriven,
    rearDriven,
    isAwdVisual,
  ]);

  const bay = metrics.engineBayMaxDimensionsMm;
  const activePresetLabel =
    camera.preset === 'free'
      ? `Orbita 3D (${Math.round(camera.yawDeg)}° / ${Math.round(camera.pitchDeg)}°)`
      : VIEW_PRESETS[camera.preset].label;

  return (
    <figure className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 space-y-3">
      {/* Header Blueprint + Pulsanti 4 Viste Rapide */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
          <Box className="w-4 h-4 text-sky-400" />
          <span>Blueprint 3D CAD — Pianale & Vano Motore</span>
        </div>
        <span className="text-[10px] font-mono text-sky-300">
          Vano: {bay.lengthMm}×{bay.widthMm}×{bay.heightMm} mm
        </span>
      </div>

      {/* Barra Controlli Viste Rapide & Zoom */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Viste CAD 3D">
          {(Object.keys(VIEW_PRESETS) as ChassisViewPreset[]).map((presetKey) => {
            const info = VIEW_PRESETS[presetKey];
            const isSelected = camera.preset === presetKey;
            return (
              <button
                key={presetKey}
                type="button"
                aria-pressed={isSelected}
                onClick={() => applyPreset(presetKey)}
                className={`min-h-[26px] px-2.5 py-1 rounded-md border text-[10px] font-mono font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 cursor-pointer ${
                  isSelected
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                    : 'bg-slate-950/80 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:border-slate-500'
                }`}
              >
                {info.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {metrics.hasAwdReady && onTogglePreviewAwd && (
            <button
              type="button"
              aria-pressed={previewAwdAsset}
              onClick={onTogglePreviewAwd}
              className={`min-h-[26px] px-2 py-1 mr-1 rounded-md border text-[10px] font-mono font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 cursor-pointer ${
                previewAwdAsset
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                  : 'bg-cyan-500/15 border-cyan-500/60 text-cyan-200 hover:border-cyan-400'
              }`}
            >
              {previewAwdAsset ? 'Vista AWD Completo' : 'Vista Base 2WD (Predisposto)'}
            </button>
          )}
          <button
            type="button"
            aria-label="Zoom out blueprint 3D"
            onClick={() => adjustZoom(0.86)}
            className="min-h-[26px] min-w-[26px] px-1.5 rounded-md border border-slate-700 bg-slate-950/80 text-slate-300 hover:border-slate-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 cursor-pointer flex items-center justify-center"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-400 w-10 text-center">
            {Math.round(camera.zoom * 100)}%
          </span>
          <button
            type="button"
            aria-label="Zoom in blueprint 3D"
            onClick={() => adjustZoom(1.16)}
            className="min-h-[26px] min-w-[26px] px-1.5 rounded-md border border-slate-700 bg-slate-950/80 text-slate-300 hover:border-slate-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 cursor-pointer flex items-center justify-center"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Ripristina vista 3D isometrica"
            onClick={() => applyPreset('iso')}
            className="min-h-[26px] min-w-[26px] px-1.5 rounded-md border border-slate-700 bg-slate-950/80 text-slate-300 hover:border-slate-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 cursor-pointer flex items-center justify-center"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Viewport Canvas 3D Interattivo */}
      <div
        ref={containerRef}
        className="relative rounded-lg bg-slate-950 border border-slate-800 overflow-hidden h-[300px] sm:h-[330px]"
      >
        <canvas
          ref={canvasRef}
          role="img"
          tabIndex={0}
          aria-describedby={captionId}
          aria-label={`Modello 3D ${palette.label}, ${activePresetLabel}, lunghezza ${config.overallDimensionsMm.lengthMm} mm, passo ${config.wheelbaseMm} mm, vano motore ${bay.lengthMm} per ${bay.widthMm} per ${bay.heightMm} mm`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleCanvasKeyDown}
          style={{ touchAction: 'none' }}
          className="w-full h-full block cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-400"
        >
          {palette.label}: {config.overallDimensionsMm.lengthMm}×
          {config.overallDimensionsMm.widthMm}×{config.overallDimensionsMm.heightMm} mm, Passo{' '}
          {config.wheelbaseMm} mm, Carreggiate {config.frontTrackMm}/{config.rearTrackMm} mm, Luce{' '}
          {config.groundClearanceMm} mm, Vano Motore {bay.lengthMm}×{bay.widthMm}×{bay.heightMm}{' '}
          mm ({primaryPos}, {primaryOri}).
        </canvas>

        {/* Overlay HUD angolo/struttura */}
        <div className="pointer-events-none absolute top-2 left-2.5 flex items-center gap-1.5 rounded bg-slate-950/80 border border-slate-800/90 px-2 py-0.5 text-[10px] font-mono text-slate-300">
          <Eye className="w-3 h-3 text-sky-400" />
          <span>{activePresetLabel}</span>
          <span className="text-slate-600">•</span>
          <span style={{ color: palette.frameStroke }}>{palette.label}</span>
        </div>

        <div className="pointer-events-none absolute bottom-2 right-2.5 flex items-center gap-1 rounded bg-slate-950/80 border border-slate-800/80 px-2 py-0.5 text-[9px] font-mono text-slate-400">
          <Maximize2 className="w-2.5 h-2.5 text-slate-500" />
          <span>Trascina per ruotare 3D • Rotella per zoom</span>
        </div>
      </div>

      {/* Griglia Quote Tecniche Slegata dal Canvas */}
      <figcaption id={captionId} className="space-y-2.5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 font-mono text-[10px]">
          {/* Blocco 1: Corpo & Passo */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              1. Corpo & Passo
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Scocca (L×W×H):</span>
              <span>
                {config.overallDimensionsMm.lengthMm}×{config.overallDimensionsMm.widthMm}×
                {config.overallDimensionsMm.heightMm} mm
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Passo:</span>
              <span className="font-bold text-slate-100">{config.wheelbaseMm} mm</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Sbalzi Ant / Post:</span>
              <span>
                {metrics.frontOverhangMm} / {metrics.rearOverhangMm} mm
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Luce a terra:</span>
              <span className="text-sky-300">{config.groundClearanceMm} mm</span>
            </div>
          </div>

          {/* Blocco 2: Carreggiate & Trazione */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              2. Carreggiate & Trazione
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Carr. Ant / Post:</span>
              <span>
                {config.frontTrackMm} / {config.rearTrackMm} mm
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Trazione:</span>
              <span className="font-bold text-amber-300">
                {metrics.hasAwdReady
                  ? previewAwdAsset
                    ? `AWD Attivo (Base ${layoutRules.nativePrimaryAxle})`
                    : `${layoutRules.nativePrimaryAxle} + Prep. AWD`
                  : `${layoutRules.nativePrimaryAxle} Puro`}
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Cambio:</span>
              <span>
                {layoutRules.effectiveGearboxLayout === 'RearTransaxleTorqueTube'
                  ? 'Transaxle Torque Tube'
                  : layoutRules.effectiveGearboxLayout === 'MidCentralTunnel'
                    ? 'Tunnel Centrale'
                    : 'In Blocco Motore'}
              </span>
            </div>
          </div>

          {/* Blocco 3: Vano Motore Utile */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
              3. Vano Motore Utile
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Max Vano (L×W×H):</span>
              <span className="font-bold text-amber-300">
                {bay.lengthMm}×{bay.widthMm}×{bay.heightMm} mm
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Posizione / Orient.:</span>
              <span>
                {primaryPos} • {primaryOri}
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Arretramento (Setback):</span>
              <span className="text-emerald-300">{config.engineSetbackPercent}%</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              <span className="text-amber-400 font-bold">Ambra</span> = Trazione attiva / Vano
            </span>
            <span>
              <span className="text-cyan-300 font-bold">Ciano tratteggiato</span> = Tunnel / PTU
              predisposto AWD (2WD Base)
            </span>
            <span>
              <span className="text-sky-300 font-bold">Azzurro</span> = Blocco motore / Torque Tube
            </span>
          </div>
        </div>
      </figcaption>
    </figure>
  );
};
