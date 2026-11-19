import React, { useEffect, useRef } from 'react';
import type { GearTelemetryPoint } from '../../types/gameTypes';

export interface GearRatioChartProps {
  gearsTelemetry: GearTelemetryPoint[];
  peakTorqueRpm: number;
  peakPowerRpm: number;
  redlineRpm: number;
  theoreticalTopSpeedKmh: number;
  cruisingRpmAt130Kmh: number;
}

const GEAR_COLORS = [
  '#38bdf8',
  '#22d3ee',
  '#34d399',
  '#a3e635',
  '#facc15',
  '#fb923c',
  '#f87171',
  '#e879f9',
  '#a78bfa',
  '#60a5fa',
];

export const GearRatioChart: React.FC<GearRatioChartProps> = ({
  gearsTelemetry,
  peakTorqueRpm,
  peakPowerRpm,
  redlineRpm,
  theoreticalTopSpeedKmh,
  cruisingRpmAt130Kmh,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const draw = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(320, Math.floor(rect.width));
      const height = 270;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      const padLeft = 56;
      const padRight = 20;
      const padTop = 26;
      const padBottom = 34;
      const plotW = Math.max(100, width - padLeft - padRight);
      const plotH = Math.max(80, height - padTop - padBottom);

      const maxSpeed = Math.max(
        160,
        Math.ceil((Math.max(theoreticalTopSpeedKmh, 150) * 1.08) / 20) * 20,
      );
      const maxRpm = Math.max(3000, Math.ceil((redlineRpm * 1.08) / 1000) * 1000);

      const xToPx = (speedKmh: number) => padLeft + (speedKmh / maxSpeed) * plotW;
      const yToPx = (rpm: number) => padTop + plotH - (rpm / maxRpm) * plotH;

      // Grid lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = '#64748b';

      const rpmStep = maxRpm <= 6000 ? 1000 : maxRpm <= 12000 ? 2000 : 3000;
      for (let rpm = 0; rpm <= maxRpm; rpm += rpmStep) {
        const y = yToPx(rpm);
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(padLeft + plotW, y);
        ctx.stroke();
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${rpm}`, padLeft - 6, y);
      }

      const speedStep = maxSpeed <= 240 ? 30 : maxSpeed <= 380 ? 50 : 60;
      for (let spd = 0; spd <= maxSpeed; spd += speedStep) {
        const x = xToPx(spd);
        ctx.beginPath();
        ctx.moveTo(x, padTop);
        ctx.lineTo(x, padTop + plotH);
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`${spd}`, x, padTop + plotH + 6);
      }

      // Axis labels
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('km/h', padLeft + plotW, height - 3);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('RPM', 6, 6);

      // Reference line: 130 km/h highway cruise
      if (130 <= maxSpeed) {
        const x130 = xToPx(130);
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x130, padTop);
        ctx.lineTo(x130, padTop + plotH);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#7dd3fc';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`130 km/h (${cruisingRpmAt130Kmh} rpm)`, x130 + 4, padTop + plotH - 4);
      }

      // Horizontal reference lines: Peak Torque & Peak Power & Redline
      const drawRefRpm = (rpmVal: number, color: string, label: string, dashed: boolean) => {
        if (rpmVal <= 0 || rpmVal > maxRpm) return;
        const y = yToPx(rpmVal);
        ctx.save();
        if (dashed) ctx.setLineDash([5, 4]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(padLeft + plotW, y);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, padLeft + plotW - 4, y - 2);
      };

      drawRefRpm(peakTorqueRpm, 'rgba(245, 158, 11, 0.75)', `Coppia Max (${peakTorqueRpm})`, true);
      drawRefRpm(peakPowerRpm, 'rgba(16, 185, 129, 0.8)', `Potenza Max (${peakPowerRpm})`, true);
      drawRefRpm(redlineRpm, 'rgba(239, 68, 68, 0.65)', `Limitatore (${redlineRpm})`, false);

      // Gear lines + sawtooth upshift drops
      gearsTelemetry.forEach((g, idx) => {
        const color = GEAR_COLORS[idx % GEAR_COLORS.length];
        const xEnd = xToPx(Math.min(g.speedAtRedlineKmh, maxSpeed));
        const yEnd = yToPx(redlineRpm);

        // Full gear slope from origin (subtle)
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(xToPx(0), yToPx(0));
        ctx.lineTo(xEnd, yEnd);
        ctx.stroke();
        ctx.restore();

        // Highlighted active portion from previous upshift RPM
        const prevGear = idx > 0 ? gearsTelemetry[idx - 1] : null;
        const startRpm = prevGear ? Math.min(prevGear.rpmAfterUpshift, redlineRpm) : 0;
        const startSpeed = prevGear
          ? Math.min(prevGear.speedAtRedlineKmh, g.speedAtRedlineKmh)
          : 0;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.3;
        ctx.beginPath();
        ctx.moveTo(xToPx(startSpeed), yToPx(startRpm));
        ctx.lineTo(xEnd, yEnd);
        ctx.stroke();
        ctx.restore();

        // Sawtooth drop to next gear at redline
        if (idx < gearsTelemetry.length - 1) {
          const yDrop = yToPx(Math.max(0, Math.min(g.rpmAfterUpshift, redlineRpm)));
          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(xEnd, yEnd);
          ctx.lineTo(xEnd, yDrop);
          ctx.stroke();
          ctx.restore();
        }

        // Top vertex marker & gear label
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(xEnd, yEnd, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 11px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${g.gear}ª`, xEnd, yEnd - 5);
      });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => observer.disconnect();
  }, [
    gearsTelemetry,
    peakTorqueRpm,
    peakPowerRpm,
    redlineRpm,
    theoreticalTopSpeedKmh,
    cruisingRpmAt130Kmh,
  ]);

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="w-full rounded-xl border border-slate-800 bg-[#090d16] overflow-hidden"
      >
        <canvas ref={canvasRef} className="block w-full" />
      </div>

      {/* Tabella compatta per marcia */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70">
        <table className="w-full text-xs font-mono text-left">
          <thead className="bg-slate-900/90 text-[10px] uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-3 py-2">Marcia</th>
              <th className="px-3 py-2">Rapporto</th>
              <th className="px-3 py-2">V @ Picco CV</th>
              <th className="px-3 py-2">V @ Limitatore</th>
              <th className="px-3 py-2">RPM post-cambiata</th>
              <th className="px-3 py-2 text-right">Coppia Ruota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {gearsTelemetry.map((g, idx) => (
              <tr key={g.gear} className="hover:bg-slate-900/50">
                <td className="px-3 py-1.5 font-bold" style={{ color: GEAR_COLORS[idx % GEAR_COLORS.length] }}>
                  {g.gear}ª
                </td>
                <td className="px-3 py-1.5 text-slate-200">{g.ratio.toFixed(2)}:1</td>
                <td className="px-3 py-1.5 text-emerald-300">{g.speedAtPeakPowerKmh.toFixed(1)} km/h</td>
                <td className="px-3 py-1.5 text-cyan-300 font-semibold">
                  {g.speedAtRedlineKmh.toFixed(1)} km/h
                </td>
                <td className="px-3 py-1.5 text-slate-300">
                  {idx < gearsTelemetry.length - 1
                    ? `${g.rpmAfterUpshift} rpm (-${g.rpmDropPercent.toFixed(1)}%)`
                    : '— (Top Gear)'}
                </td>
                <td className="px-3 py-1.5 text-right text-amber-300">
                  {g.maxWheelTorqueNm.toLocaleString('it-IT')} Nm
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400 italic">
        Velocità meccanica teorica a limitatore (la Vmax reale dipenderà dall&apos;aerodinamica in Fase 2.7).
      </p>
    </div>
  );
};
