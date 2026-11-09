import React, { useEffect, useRef, useState } from 'react';
import type { DynoCurvePoint } from '../../types/gameTypes';

interface TelemetryCanvas2DProps {
  curve: DynoCurvePoint[];
  redlineRpm: number;
  engineName: string;
  displacementLiters?: number;
  architectureLabel?: string;
}

/**
 * Modulo di rendering grafico interattivo su Canvas 2D (Retina / Apple Silicon High-DPI aware)
 * per curve di Coppia (Nm) e Potenza (CV) sul Banco Prova, con crosshair e ispezione mouse.
 * Fix 8: Header/Legenda e Barra Telemetria separati dal Canvas per zero sovrapposizioni coi numeri RPM.
 */
export const TelemetryCanvas2D: React.FC<TelemetryCanvas2DProps> = ({
  curve,
  redlineRpm,
  engineName,
  displacementLiters = 2.0,
  architectureLabel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || curve.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 580;
    const height = canvas.clientHeight || 230;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Pulizia background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    const padLeft = 48;
    const padRight = 24;
    const padTop = 16;
    const padBottom = 28;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const minRpm = curve[0].rpm;
    const maxRpm = Math.max(redlineRpm, curve[curve.length - 1].rpm);
    const peakCurveVal = Math.max(...curve.map((p) => Math.max(p.torqueNm, p.powerHp)));
    const maxVal = Math.max(250, Math.ceil((peakCurveVal * 1.1) / 50) * 50);

    // Griglia tecnica CAD orizzontale
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const y = padTop + (plotH / ySteps) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      const labelVal = Math.round(maxVal - (maxVal / ySteps) * i);
      ctx.fillStyle = '#64748b';
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${labelVal}`, padLeft - 8, y + 3);
    }

    // Griglia RPM verticale + Etichette asse X ben distanziate
    const rpmSteps = 6;
    for (let i = 0; i <= rpmSteps; i++) {
      const x = padLeft + (plotW / rpmSteps) * i;
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, height - padBottom);
      ctx.stroke();

      const rpmVal = Math.round(minRpm + ((maxRpm - minRpm) / rpmSteps) * i);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${rpmVal}`, x, height - 9);
    }

    const toX = (rpm: number) =>
      padLeft + ((rpm - minRpm) / Math.max(1, maxRpm - minRpm)) * plotW;
    const toY = (val: number) => padTop + plotH - (val / maxVal) * plotH;

    // Linea Redline (Limitatore)
    const redlineX = toX(redlineRpm);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(redlineX, padTop);
    ctx.lineTo(redlineX, height - padBottom);
    ctx.stroke();
    ctx.restore();

    // Area sottesa Potenza (leggera sfumatura ambra)
    ctx.save();
    ctx.beginPath();
    curve.forEach((pt, idx) => {
      const x = toX(pt.rpm);
      const y = toY(pt.powerHp);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(toX(curve[curve.length - 1].rpm), height - padBottom);
    ctx.lineTo(toX(curve[0].rpm), height - padBottom);
    ctx.closePath();
    ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
    ctx.fill();
    ctx.restore();

    // Curva Coppia (Nm) - Ciano morbida
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    curve.forEach((pt, idx) => {
      const x = toX(pt.rpm);
      const y = toY(pt.torqueNm);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Curva Potenza (CV) - Ambra morbida
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    curve.forEach((pt, idx) => {
      const x = toX(pt.rpm);
      const y = toY(pt.powerHp);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Crosshair interattivo al passaggio del mouse
    if (hoveredIndex !== null && curve[hoveredIndex]) {
      const pt = curve[hoveredIndex];
      const hx = toX(pt.rpm);
      const hyTorque = toY(pt.torqueNm);
      const hyPower = toY(pt.powerHp);

      ctx.save();
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hx, padTop);
      ctx.lineTo(hx, height - padBottom);
      ctx.stroke();
      ctx.restore();

      // Marker Coppia attivo
      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hx, hyTorque, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Marker Potenza attivo
      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hx, hyPower, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [curve, redlineRpm, hoveredIndex]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || curve.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padLeft = 48;
    const padRight = 24;
    const plotW = rect.width - padLeft - padRight;

    const minRpm = curve[0].rpm;
    const maxRpm = Math.max(redlineRpm, curve[curve.length - 1].rpm);
    const ratio = Math.max(0, Math.min(1, (mouseX - padLeft) / Math.max(1, plotW)));
    const targetRpm = minRpm + ratio * (maxRpm - minRpm);

    let closestIdx = 0;
    let minDiff = Infinity;
    curve.forEach((pt, idx) => {
      const diff = Math.abs(pt.rpm - targetRpm);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    setHoveredIndex(closestIdx);
  };

  const activePoint = hoveredIndex !== null ? curve[hoveredIndex] : null;
  const powerKw = activePoint ? Math.round(activePoint.powerHp * 0.7355) : 0;
  const specificHp =
    activePoint && displacementLiters > 0
      ? (activePoint.powerHp / displacementLiters).toFixed(1)
      : '0.0';

  return (
    <div className="w-full rounded-lg border border-slate-800 bg-slate-950 overflow-hidden select-none">
      {/* Header separato sopra il Canvas: Titolo a sinistra, Legenda a destra senza mai sovrapporsi */}
      <div className="px-3.5 py-2 border-b border-slate-800/90 bg-slate-900/70 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold shrink-0">
            {displacementLiters.toFixed(1)}L {architectureLabel ?? ''}
          </span>
          <span className="font-bold text-slate-200 truncate" title={engineName}>
            {engineName.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-[11px]">
          <span className="text-sky-400 font-bold">● Coppia (Nm)</span>
          <span className="text-amber-400 font-bold">● Potenza (CV)</span>
          <span className="text-rose-400 text-[10px]">┆ Limit. {redlineRpm}</span>
        </div>
      </div>

      {/* Area Grafico Canvas 2D */}
      <div className="relative w-full h-56">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIndex(null)}
          className="w-full h-full block cursor-crosshair"
        />
      </div>

      {/* Barra Telemetria / Istruzioni sotto il Canvas: non copre mai i numeri RPM dell'asse X */}
      <div className="px-3.5 py-2 border-t border-slate-800/90 bg-slate-900/80 min-h-[38px] flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
        {activePoint ? (
          <div className="w-full flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] text-slate-400 mr-1.5">REGIME:</span>
              <span className="font-bold text-slate-100">{activePoint.rpm} rpm</span>
            </div>
            <div>
              <span className="text-[10px] text-sky-400 mr-1.5">COPPIA:</span>
              <span className="font-bold text-sky-300">{activePoint.torqueNm} Nm</span>
            </div>
            <div>
              <span className="text-[10px] text-amber-400 mr-1.5">POTENZA:</span>
              <span className="font-bold text-amber-300">
                {activePoint.powerHp} CV ({powerKw} kW)
              </span>
            </div>
            <div>
              <span className="text-[10px] text-emerald-400 mr-1.5">BMEP / SPEC:</span>
              <span className="font-bold text-emerald-300">
                {activePoint.bmepBar ?? 0} bar ({specificHp} CV/L)
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full flex items-center justify-between text-[11px] text-slate-400">
            <span>Muovi il cursore sul grafico per ispezionare RPM / Nm / CV / BMEP</span>
            <span className="text-slate-500">Passo: 100 rpm</span>
          </div>
        )}
      </div>
    </div>
  );
};
