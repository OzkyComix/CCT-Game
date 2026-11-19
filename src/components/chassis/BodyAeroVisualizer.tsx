import React from 'react';
import { ArrowDown, ArrowUp, Gauge, Wind } from 'lucide-react';
import type {
  BodyAeroConfig,
  BodyAeroMetrics,
  BodyStyle,
  ChassisEntity,
} from '../../types/gameTypes';

export type AeroTunnelMode = 'high-downforce' | 'low-drag' | 'airbrake';

interface BodyAeroVisualizerProps {
  config: BodyAeroConfig;
  chassis: ChassisEntity;
  metrics: BodyAeroMetrics;
  mode: AeroTunnelMode;
  onModeChange: (mode: AeroTunnelMode) => void;
}

interface SilhouetteGeometry {
  bodyPath: string;
  cabinGlassPath: string;
  hoodTipX: number;
  hoodTipY: number;
  rearDeckX: number;
  rearDeckY: number;
  roofTopY: number;
}

function buildBodySilhouette(
  bodyStyle: BodyStyle,
  x0: number,
  x1: number,
  bottomY: number,
  topY: number,
): SilhouetteGeometry {
  const len = x1 - x0;
  const h = bottomY - topY;
  const beltY = bottomY - h * 0.48;
  const frontLipY = bottomY - h * 0.08;
  const rearSkirtY = bottomY - h * 0.12;
  const hoodX = x0 + len * 0.24;

  switch (bodyStyle) {
    case 'Coupé Sportivo': {
      const noseY = bottomY - h * 0.34;
      const hoodY = bottomY - h * 0.44;
      const roofX1 = x0 + len * 0.38;
      const roofX2 = x0 + len * 0.62;
      const deckY = bottomY - h * 0.50;
      return {
        bodyPath: `M ${x0 + 8} ${frontLipY} L ${x0} ${noseY} Q ${x0 + len * 0.08} ${hoodY - 8} ${hoodX} ${hoodY} L ${roofX1} ${topY} Q ${len * 0.12 + roofX1} ${topY - 3} ${roofX2} ${topY + 4} L ${x1 - 12} ${deckY} L ${x1} ${deckY + 8} L ${x1 - 4} ${rearSkirtY} Z`,
        cabinGlassPath: `M ${hoodX + 12} ${hoodY - 2} L ${roofX1 + 6} ${topY + 7} L ${roofX2 - 6} ${topY + 9} L ${x1 - len * 0.18} ${deckY - 2} Z`,
        hoodTipX: x0 + 6,
        hoodTipY: frontLipY,
        rearDeckX: x1 - 6,
        rearDeckY: deckY,
        roofTopY: topY,
      };
    }
    case 'Coupé': {
      const hoodY = beltY;
      const roofX1 = x0 + len * 0.40;
      const roofX2 = x0 + len * 0.68;
      const deckY = beltY - h * 0.04;
      return {
        bodyPath: `M ${x0 + 6} ${frontLipY} L ${x0} ${bottomY - h * 0.38} Q ${x0 + len * 0.08} ${hoodY} ${hoodX + 16} ${hoodY} L ${roofX1} ${topY} L ${roofX2} ${topY + 2} L ${x1 - 10} ${deckY} L ${x1} ${deckY + 12} L ${x1 - 4} ${rearSkirtY} Z`,
        cabinGlassPath: `M ${hoodX + 24} ${hoodY - 2} L ${roofX1 + 5} ${topY + 7} L ${roofX2 - 8} ${topY + 8} L ${x1 - len * 0.15} ${deckY - 2} Z`,
        hoodTipX: x0 + 6,
        hoodTipY: frontLipY,
        rearDeckX: x1 - 5,
        rearDeckY: deckY,
        roofTopY: topY,
      };
    }
    case 'Hatchback': {
      const hoodY = beltY - h * 0.02;
      const roofX1 = x0 + len * 0.36;
      const roofX2 = x0 + len * 0.88;
      return {
        bodyPath: `M ${x0 + 5} ${frontLipY} L ${x0} ${bottomY - h * 0.38} L ${hoodX} ${hoodY} L ${roofX1} ${topY} L ${roofX2} ${topY + 2} L ${x1} ${beltY - 4} L ${x1 - 3} ${rearSkirtY} Z`,
        cabinGlassPath: `M ${hoodX + 10} ${hoodY - 2} L ${roofX1 + 5} ${topY + 7} L ${roofX2 - 6} ${topY + 8} L ${x1 - 12} ${beltY - 6} Z`,
        hoodTipX: x0 + 5,
        hoodTipY: frontLipY,
        rearDeckX: roofX2,
        rearDeckY: topY + 2,
        roofTopY: topY,
      };
    }
    case 'Universale': {
      const hoodY = beltY;
      const roofX1 = x0 + len * 0.36;
      const roofX2 = x0 + len * 0.90;
      return {
        bodyPath: `M ${x0 + 5} ${frontLipY} L ${x0} ${bottomY - h * 0.38} L ${hoodX + 10} ${hoodY} L ${roofX1} ${topY} L ${roofX2} ${topY + 2} L ${x1} ${beltY} L ${x1 - 4} ${rearSkirtY} Z`,
        cabinGlassPath: `M ${hoodX + 18} ${hoodY - 2} L ${roofX1 + 5} ${topY + 7} L ${roofX2 - 8} ${topY + 8} L ${x1 - 14} ${beltY - 3} Z`,
        hoodTipX: x0 + 5,
        hoodTipY: frontLipY,
        rearDeckX: roofX2,
        rearDeckY: topY + 2,
        roofTopY: topY,
      };
    }
    case 'Crossover': {
      const hoodY = beltY - h * 0.04;
      const roofX1 = x0 + len * 0.37;
      const roofX2 = x0 + len * 0.85;
      return {
        bodyPath: `M ${x0 + 6} ${frontLipY} L ${x0} ${bottomY - h * 0.38} Q ${x0 + len * 0.06} ${hoodY} ${hoodX} ${hoodY} L ${roofX1} ${topY} L ${roofX2} ${topY + 4} L ${x1} ${beltY - 4} L ${x1 - 5} ${rearSkirtY} Z`,
        cabinGlassPath: `M ${hoodX + 10} ${hoodY - 2} L ${roofX1 + 5} ${topY + 7} L ${roofX2 - 8} ${topY + 9} L ${x1 - 14} ${beltY - 6} Z`,
        hoodTipX: x0 + 6,
        hoodTipY: frontLipY,
        rearDeckX: roofX2,
        rearDeckY: topY + 4,
        roofTopY: topY,
      };
    }
    case 'SUV': {
      const hoodY = beltY - h * 0.06;
      const roofX1 = x0 + len * 0.35;
      const roofX2 = x0 + len * 0.94;
      return {
        bodyPath: `M ${x0 + 3} ${frontLipY} L ${x0} ${hoodY + 6} L ${hoodX} ${hoodY} L ${roofX1} ${topY} L ${roofX2} ${topY} L ${x1} ${beltY} L ${x1 - 3} ${rearSkirtY} Z`,
        cabinGlassPath: `M ${hoodX + 8} ${hoodY - 2} L ${roofX1 + 4} ${topY + 7} L ${roofX2 - 6} ${topY + 7} L ${x1 - 10} ${beltY - 3} Z`,
        hoodTipX: x0 + 3,
        hoodTipY: frontLipY,
        rearDeckX: roofX2,
        rearDeckY: topY,
        roofTopY: topY,
      };
    }
    case 'Pickup': {
      const hoodY = beltY - h * 0.04;
      const roofX1 = x0 + len * 0.33;
      const cabEndX = x0 + len * 0.61;
      const bedY = beltY - h * 0.02;
      return {
        bodyPath: `M ${x0 + 4} ${frontLipY} L ${x0} ${hoodY + 8} L ${hoodX} ${hoodY} L ${roofX1} ${topY} L ${cabEndX} ${topY} L ${cabEndX + 4} ${bedY} L ${x1} ${bedY} L ${x1 - 2} ${rearSkirtY} Z`,
        cabinGlassPath: `M ${hoodX + 8} ${hoodY - 2} L ${roofX1 + 4} ${topY + 7} L ${cabEndX - 5} ${topY + 7} L ${cabEndX - 5} ${bedY - 2} Z`,
        hoodTipX: x0 + 4,
        hoodTipY: frontLipY,
        rearDeckX: x1 - 4,
        rearDeckY: bedY,
        roofTopY: topY,
      };
    }
    case 'Berlina':
    default: {
      const hoodY = beltY;
      const roofX1 = x0 + len * 0.37;
      const roofX2 = x0 + len * 0.72;
      const trunkY = beltY - h * 0.04;
      return {
        bodyPath: `M ${x0 + 5} ${frontLipY} L ${x0} ${bottomY - h * 0.38} L ${hoodX + 10} ${hoodY} L ${roofX1} ${topY} L ${roofX2} ${topY} L ${x1 - len * 0.14} ${trunkY} L ${x1} ${trunkY + 6} L ${x1 - 4} ${rearSkirtY} Z`,
        cabinGlassPath: `M ${hoodX + 18} ${hoodY - 2} L ${roofX1 + 5} ${topY + 7} L ${roofX2 - 5} ${topY + 7} L ${x1 - len * 0.16} ${trunkY - 2} Z`,
        hoodTipX: x0 + 5,
        hoodTipY: frontLipY,
        rearDeckX: x1 - 6,
        rearDeckY: trunkY,
        roofTopY: topY,
      };
    }
  }
}

export const BodyAeroVisualizer: React.FC<BodyAeroVisualizerProps> = ({
  config,
  chassis,
  metrics,
  mode,
  onModeChange,
}) => {
  const supportsLowDrag = config.activeAeroType !== 'none';
  const supportsAirbrake =
    config.activeAeroType === 'drs-active-wing' ||
    config.activeAeroType === 'full-active-airbrake';

  const effectiveMode: AeroTunnelMode =
    mode === 'airbrake' && !supportsAirbrake
      ? 'high-downforce'
      : mode === 'low-drag' && !supportsLowDrag
        ? 'high-downforce'
        : mode;

  // Scala geometrica proporzionata al pianale reale dentro il canvas SVG (760 x 260)
  const svgW = 760;
  const svgH = 260;
  const groundY = 224;
  const scale = 0.105; // ~10.5 px ogni 100 mm
  const { lengthMm, heightMm } = chassis.overallDimensionsMm;
  const carW = Math.min(620, Math.max(330, lengthMm * scale));
  const carH = Math.min(185, Math.max(92, heightMm * scale));
  const wbPx = Math.min(carW * 0.72, Math.max(carW * 0.48, chassis.wheelbaseMm * scale));
  const clearancePx = Math.max(7, Math.min(34, chassis.groundClearanceMm * scale));

  const x0 = (svgW - carW) / 2;
  const x1 = x0 + carW;
  const bottomY = groundY - clearancePx;
  const topY = groundY - carH;

  const frontAxleX = x0 + (carW - wbPx) * 0.46;
  const rearAxleX = frontAxleX + wbPx;
  const wheelR = Math.max(24, Math.min(33, 21 + clearancePx * 0.42));
  const wheelCy = groundY - wheelR;

  const silhouette = buildBodySilhouette(config.bodyStyle, x0, x1, bottomY, topY);

  // Angoli effettivi di ala e flap in base alla modalità attiva
  const baseRearAngle = config.rearAero.type === 'none' ? 0 : config.rearAero.angleDeg;
  const visualRearAngle =
    effectiveMode === 'low-drag'
      ? Math.max(0, baseRearAngle * 0.25)
      : effectiveMode === 'airbrake'
        ? Math.min(48, Math.max(28, baseRearAngle + 22))
        : baseRearAngle;

  const streamStroke =
    effectiveMode === 'airbrake'
      ? '#fb7185'
      : effectiveMode === 'low-drag'
        ? '#34d399'
        : '#38bdf8';

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
  const rearLoadScale = effectiveMode === 'low-drag' ? 0.55 : effectiveMode === 'airbrake' ? 1.25 : 1;
  const frontLoadKg = Math.round(metrics.downforce200Kg.frontKg * frontLoadScale);
  const rearLoadKg = Math.round(metrics.downforce200Kg.rearKg * rearLoadScale);

  const frontArrowLen = Math.min(44, Math.max(10, Math.abs(frontLoadKg) * 0.14));
  const rearArrowLen = Math.min(44, Math.max(10, Math.abs(rearLoadKg) * 0.14));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden">
      {/* Header Galleria del Vento + Switch Modalità Flusso */}
      <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-950/60">
        <div className="flex items-center gap-2">
          <Wind className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
            Galleria del Vento Virtuale — Profilo {config.bodyStyle}
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <button
            type="button"
            onClick={() => onModeChange('high-downforce')}
            className={`px-2.5 py-1 rounded border transition cursor-pointer ${
              effectiveMode === 'high-downforce'
                ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            High-Downforce (Curva)
          </button>
          <button
            type="button"
            disabled={!supportsLowDrag}
            onClick={() => onModeChange('low-drag')}
            className={`px-2.5 py-1 rounded border transition ${
              !supportsLowDrag
                ? 'bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed'
                : effectiveMode === 'low-drag'
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold cursor-pointer'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 cursor-pointer'
            }`}
          >
            Low-Drag (DRS)
          </button>
          <button
            type="button"
            disabled={!supportsAirbrake}
            onClick={() => onModeChange('airbrake')}
            className={`px-2.5 py-1 rounded border transition ${
              !supportsAirbrake
                ? 'bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed'
                : effectiveMode === 'airbrake'
                  ? 'bg-rose-500/20 border-rose-400 text-rose-300 font-bold cursor-pointer'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 cursor-pointer'
            }`}
          >
            Airbrake (Staccata)
          </button>
        </div>
      </div>

      {/* Canvas SVG Profilo Pulito (senza quote numeriche sovrapposte) */}
      <div className="p-3 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-56 select-none"
          role="img"
          aria-label="Visualizzazione galleria del vento profilo laterale"
        >
          <defs>
            <pattern id="wtGrid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1e293b" strokeWidth="0.6" />
            </pattern>
            <linearGradient id="bodyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>

          <rect width={svgW} height={svgH} fill="url(#wtGrid)" rx="8" />

          {/* Linee di flusso aria galleria del vento */}
          {[0.18, 0.42, 0.68].map((frac, idx) => {
            const sy = topY - 22 + frac * carH * 0.72;
            const apexY = topY - 12 + idx * 9;
            return (
              <path
                key={idx}
                d={`M 18 ${sy + 18} Q ${x0 - 20} ${sy + 10} ${x0 + carW * 0.35} ${apexY} T ${x1 + 36} ${silhouette.rearDeckY + (idx - 1) * 14} L ${svgW - 18} ${silhouette.rearDeckY + (idx - 1) * 18}`}
                fill="none"
                stroke={streamStroke}
                strokeOpacity={effectiveMode === 'airbrake' ? 0.55 : 0.42}
                strokeWidth="1.6"
                strokeDasharray="7 5"
              />
            );
          })}

          {/* Flusso effetto suolo sottoscocca */}
          {config.underbodyType !== 'exposed' && (
            <path
              d={`M ${x0 - 30} ${groundY - clearancePx * 0.45} L ${x1 + 35} ${groundY - clearancePx * 0.55 - (config.underbodyType === 'venturi-ground-effect' ? 10 : 4)}`}
              fill="none"
              stroke={
                config.underbodyType === 'venturi-ground-effect' ? '#22d3ee' : '#38bdf8'
              }
              strokeOpacity={0.25 + metrics.groundEffectEfficiency * 0.65}
              strokeWidth={config.underbodyType === 'venturi-ground-effect' ? 2.6 : 1.7}
              strokeDasharray="6 4"
            />
          )}

          {/* Asfalto */}
          <line x1="16" y1={groundY} x2={svgW - 16} y2={groundY} stroke="#475569" strokeWidth="2" />

          {/* Fondo piatto / Venturi / Diffusore inferiore */}
          {config.underbodyType !== 'exposed' && (
            <path
              d={
                config.underbodyType === 'venturi-ground-effect'
                  ? `M ${frontAxleX - 18} ${bottomY} L ${rearAxleX - 24} ${bottomY} L ${x1 - 2} ${bottomY - 13} L ${x1 - 2} ${bottomY - 8} L ${rearAxleX - 20} ${bottomY + 3} L ${frontAxleX - 18} ${bottomY + 3} Z`
                  : config.underbodyType === 'flat-floor-diffuser'
                    ? `M ${frontAxleX - 10} ${bottomY} L ${rearAxleX - 14} ${bottomY} L ${x1 - 3} ${bottomY - 9} L ${x1 - 3} ${bottomY - 5} L ${rearAxleX - 12} ${bottomY + 2} L ${frontAxleX - 10} ${bottomY + 2} Z`
                    : `M ${frontAxleX} ${bottomY} L ${rearAxleX} ${bottomY + 2}`
              }
              fill={config.underbodyType === 'venturi-ground-effect' ? '#06b6d4' : '#38bdf8'}
              fillOpacity="0.6"
              stroke="#22d3ee"
              strokeWidth="1.3"
            />
          )}

          {/* Sagoma scocca principale */}
          <path
            d={silhouette.bodyPath}
            fill="url(#bodyFill)"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d={silhouette.cabinGlassPath}
            fill="#0284c7"
            fillOpacity="0.22"
            stroke="#38bdf8"
            strokeOpacity="0.55"
            strokeWidth="1.2"
          />

          {/* Appendici anteriori (Splitter / Lip / Canards) */}
          {config.frontAero.type !== 'none' && (
            <g
              transform={`translate(${silhouette.hoodTipX}, ${silhouette.hoodTipY}) rotate(${-config.frontAero.angleDeg * 0.7})`}
            >
              <rect
                x={config.frontAero.type === 'road-lip' ? -12 : -22}
                y={-2}
                width={config.frontAero.type === 'road-lip' ? 16 : 26}
                height={4}
                rx={1.5}
                fill="#f59e0b"
              />
              {config.frontAero.type === 'splitter-canards' && (
                <path d="M -8 -16 L 6 -10 L 6 -7 L -8 -12 Z" fill="#fbbf24" />
              )}
            </g>
          )}

          {/* Appendice posteriore (Ducktail / Ala GT / Swan-Neck) */}
          {config.rearAero.type !== 'none' && (
            <g transform={`translate(${silhouette.rearDeckX}, ${silhouette.rearDeckY})`}>
              {config.rearAero.type === 'ducktail-lip' ? (
                <path
                  d={`M -16 0 L 4 -${Math.max(7, Math.min(18, 7 + visualRearAngle * 0.45))} L 9 2 Z`}
                  fill="#f59e0b"
                />
              ) : (
                <>
                  {/* Pilone di supporto */}
                  <line
                    x1={config.rearAero.type === 'swan-neck-wing' ? -4 : -8}
                    y1={2}
                    x2={config.rearAero.type === 'swan-neck-wing' ? -1 : -4}
                    y2={-22}
                    stroke="#cbd5e1"
                    strokeWidth="2.4"
                  />
                  {/* Profilo alare ruotato all'incidenza configurata (o DRS / Airbrake) */}
                  <g transform={`translate(-3, -22) rotate(${visualRearAngle})`}>
                    <path
                      d="M -20 -3 Q 0 -6 22 0 L 20 4 Q -2 1 -20 0 Z"
                      fill={
                        effectiveMode === 'airbrake'
                          ? '#fb7185'
                          : config.rearAero.angleDeg > 20
                            ? '#ef4444'
                            : '#f59e0b'
                      }
                    />
                  </g>
                </>
              )}
            </g>
          )}

          {/* Ruote posizionate al passo reale */}
          {[frontAxleX, rearAxleX].map((wx, idx) => (
            <g key={idx}>
              <circle cx={wx} cy={wheelCy} r={wheelR} fill="#090d16" stroke="#64748b" strokeWidth="2.5" />
              <circle cx={wx} cy={wheelCy} r={wheelR * 0.62} fill="#1e293b" stroke="#94a3b8" strokeWidth="1.3" />
              <circle cx={wx} cy={wheelCy} r={4} fill="#cbd5e1" />
            </g>
          ))}

          {/* Vettori di carico/portanza su asse anteriore e posteriore (solo frecce grafiche) */}
          {[
            { x: frontAxleX, load: frontLoadKg, len: frontArrowLen },
            { x: rearAxleX, load: rearLoadKg, len: rearArrowLen },
          ].map((ax, idx) => {
            const isDown = ax.load >= 0;
            const yStart = topY - 12;
            return (
              <g key={idx}>
                <line
                  x1={ax.x}
                  y1={isDown ? yStart - ax.len : yStart}
                  x2={ax.x}
                  y2={isDown ? yStart : yStart - ax.len}
                  stroke={isDown ? '#38bdf8' : '#fb7185'}
                  strokeWidth="2.5"
                />
                {isDown ? (
                  <polygon
                    points={`${ax.x - 5},${yStart - 6} ${ax.x + 5},${yStart - 6} ${ax.x},${yStart + 2}`}
                    fill="#38bdf8"
                  />
                ) : (
                  <polygon
                    points={`${ax.x - 5},${yStart - ax.len + 6} ${ax.x + 5},${yStart - ax.len + 6} ${ax.x},${yStart - ax.len - 2}`}
                    fill="#fb7185"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Scheda Telemetrica Compatta Sotto il Canvas (quote e numeri slegati dal disegno) */}
      <div className="px-4 py-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/80 font-mono text-xs">
        <div>
          <div className="text-[10px] uppercase text-slate-400 flex items-center gap-1">
            <Gauge className="w-3 h-3 text-sky-400" /> Cx Attivo ({effectiveMode})
          </div>
          <div className="text-sm font-bold text-sky-300">{activeCx.toFixed(3)}</div>
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
              <ArrowDown className="w-3 h-3 text-sky-400" />
            ) : (
              <ArrowUp className="w-3 h-3 text-rose-400" />
            )}
            Carico @200 / @300
          </div>
          <div
            className={`text-sm font-bold ${
              activeDf200 >= 0 ? 'text-emerald-300' : 'text-rose-400'
            }`}
          >
            {activeDf200} kg / {activeDf300} kg
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-slate-400">Vettori Assi (@200)</div>
          <div className="text-sm font-bold text-amber-300">
            Ant {frontLoadKg} kg • Post {rearLoadKg} kg
          </div>
        </div>
      </div>
    </div>
  );
};
