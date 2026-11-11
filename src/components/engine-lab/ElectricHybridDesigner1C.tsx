import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Battery,
  BatteryCharging,
  Box,
  CheckCircle2,
  Cpu,
  Flame,
  Gauge,
  Layers,
  RotateCw,
  Save,
  ShieldAlert,
  Sliders,
  Wind,
  Zap,
} from 'lucide-react';
import {
  BATTERY_CHEMISTRIES,
  ELECTRIC_COOLING_SYSTEMS,
  ELECTRIC_MOTOR_TYPES,
  HYBRID_SYSTEM_TYPES,
  MOTOR_LAYOUT_CONFIGS,
  PRICE_TIER_EV_SPECS,
  REFERENCE_CLASS_EV_SPECS,
  REFERENCE_HYBRID_ICE_ENGINES,
  VOLTAGE_ARCHITECTURES,
} from '../../data/electricHybridData';
import { getLegalEmissionLimitForYear } from '../../data/historicalEras';
import {
  calculateElectricHybridCosts,
  calculateElectricHybridGeometryAndDimensions,
  simulateElectricHybridDyno,
} from '../../math/evHybridMath';
import { evaluateEngineBayCompatibility } from '../../math/volumeMath';
import { useGameStore } from '../../store/useGameStore';
import type {
  BatteryPackEntity,
  CoupledIceEngineOption,
  ElectricMotorEntity,
  DynoCurvePoint,
  ElectricHybridEngineConfigInput,
  EngineEntity,
  EngineOrientation,
  HybridSystemType,
  PriceTier,
  ReferenceClass,
} from '../../types/gameTypes';
import {
  type OverlaidChassisBayItem,
  VolumeViewer3D,
} from '../common/VolumeViewer3D';

const PRICE_TIERS: PriceTier[] = ['Economica', 'Media', 'Premium', 'Lusso'];
const REFERENCE_CLASSES: ReferenceClass[] = [
  'Normale',
  'Comfort',
  'Sport',
  'Corsa',
  'Fuoristrada',
];

/**
 * Converte un EngineEntity (Pistoni 1A o Wankel 1B) salvato nel database in un CoupledIceEngineOption
 * selezionabile per i sistemi Ibridi (MHEV, HEV, PHEV, EREV).
 */
function engineEntityToCoupledOption(eng: EngineEntity): CoupledIceEngineOption | null {
  if (eng.propulsionType === 'ElectricHybrid_1C') return null;

  if (eng.propulsionType === 'Wankel_1B' && eng.wankelSpecs) {
    const w = eng.wankelSpecs;
    return {
      id: eng.id,
      sourceKind: 'SavedDatabase',
      name: eng.name,
      codeName: eng.codeName,
      propulsionType: 'Wankel_1B',
      architectureLabel: `${(w.totalDisplacementCc / 1000).toFixed(1)}L ${w.rotorCount}-Rotori Wankel`,
      displacementCc: w.totalDisplacementCc,
      displacementLiters: Number((w.totalDisplacementCc / 1000).toFixed(1)),
      cylindersOrRotors: w.rotorCount,
      fuelType: w.fuelType,
      isTurbo: w.turboType !== 'NaturallyAspirated',
      peakPowerHp: eng.telemetry.peakPowerHp,
      peakPowerRpm: eng.telemetry.peakPowerRpm,
      peakTorqueNm: eng.telemetry.peakTorqueNm,
      peakTorqueRpm: eng.telemetry.peakTorqueRpm,
      redlineRpm: eng.telemetry.redlineRpm,
      dryWeightKg: eng.telemetry.dryWeightKg,
      wetWeightKg: eng.telemetry.wetWeightKg,
      dimensionsMm: eng.dimensionsMm,
      emissionsGPerKm: eng.telemetry.emissionsGPerKm,
      reliabilityPercent: eng.telemetry.reliabilityPercent,
      estimatedLifespanKm: eng.telemetry.estimatedLifespanKm,
      unitProductionCost: eng.telemetry.unitProductionCost,
      curve: eng.telemetry.curve,
    };
  }

  const p = eng.pistonSpecs;
  const dispCc = p?.totalDisplacementCc ?? 1998;
  return {
    id: eng.id,
    sourceKind: 'SavedDatabase',
    name: eng.name,
    codeName: eng.codeName,
    propulsionType: 'Piston_1A',
    architectureLabel: `${(dispCc / 1000).toFixed(1)}L ${p?.cylinders ?? 4} Cil. (${p?.architecture ?? 'Inline'})`,
    displacementCc: dispCc,
    displacementLiters: Number((dispCc / 1000).toFixed(1)),
    cylindersOrRotors: p?.cylinders ?? 4,
    fuelType: p?.fuelType ?? 'Benzina',
    isTurbo: (p?.turboType ?? 'NaturallyAspirated') !== 'NaturallyAspirated',
    peakPowerHp: eng.telemetry.peakPowerHp,
    peakPowerRpm: eng.telemetry.peakPowerRpm,
    peakTorqueNm: eng.telemetry.peakTorqueNm,
    peakTorqueRpm: eng.telemetry.peakTorqueRpm,
    redlineRpm: eng.telemetry.redlineRpm,
    dryWeightKg: eng.telemetry.dryWeightKg,
    wetWeightKg: eng.telemetry.wetWeightKg,
    dimensionsMm: eng.dimensionsMm,
    emissionsGPerKm: eng.telemetry.emissionsGPerKm,
    reliabilityPercent: eng.telemetry.reliabilityPercent,
    estimatedLifespanKm: eng.telemetry.estimatedLifespanKm,
    unitProductionCost: eng.telemetry.unitProductionCost,
    curve: eng.telemetry.curve,
  };
}

interface EvHybridDynoCanvas2DProps {
  curve: DynoCurvePoint[];
  iceOnlyCurve?: DynoCurvePoint[];
  electricOnlyCurve?: DynoCurvePoint[];
  redlineRpm: number;
  cornerSpeedRpm: number;
  systemType: HybridSystemType;
  engineName: string;
  architectureBadge: string;
  erevGeneratorOutputKw?: number;
}

/**
 * Grafico Dinamometrico Canvas 2D dedicato al Modulo 1C (Elettrici & Ibridi):
 * - Su BEV e Range Extender: mostra la curva da 0 RPM a 22.000 RPM con linea di Field Weakening
 *   (Coppia piatta 100% fino a cornerSpeedRpm, poi Potenza costante a plateau e Coppia 1/RPM).
 * - Su MHEV, Full Hybrid e PHEV: mostra sia le curve tratteggiate separate (Termico/Wankel + Spinta Elettrica)
 *   sia la Curva Totale Combinata di Sistema!
 */
const EvHybridDynoCanvas2D: React.FC<EvHybridDynoCanvas2DProps> = ({
  curve,
  iceOnlyCurve,
  electricOnlyCurve,
  redlineRpm,
  cornerSpeedRpm,
  systemType,
  engineName,
  architectureBadge,
  erevGeneratorOutputKw,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const isParallelHybrid =
    (systemType === 'MHEV' || systemType === 'FullHybrid' || systemType === 'PHEV') &&
    Boolean(iceOnlyCurve && iceOnlyCurve.length > 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || curve.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 580;
    const height = canvas.clientHeight || 245;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    const padLeft = 52;
    const padRight = 24;
    const padTop = 18;
    const padBottom = 30;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const minRpm = curve[0].rpm;
    const maxRpm = Math.max(redlineRpm, curve[curve.length - 1].rpm);
    const peakCurveVal = Math.max(...curve.map((p) => Math.max(p.torqueNm, p.powerHp)));
    const maxVal = Math.max(200, Math.ceil((peakCurveVal * 1.12) / 50) * 50);

    // Griglia orizzontale
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

    // Griglia verticale RPM
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

    // Se BEV o EREV: disegna la linea verticale di Field Weakening (Corner Speed)
    if (!isParallelHybrid && cornerSpeedRpm > minRpm && cornerSpeedRpm < maxRpm) {
      const fwX = toX(cornerSpeedRpm);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(fwX, padTop);
      ctx.lineTo(fwX, height - padBottom);
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Field Weakening (${cornerSpeedRpm} RPM)`, fwX + 5, padTop + 11);
      ctx.restore();
    }

    // Se EREV: mostra la linea orizzontale della potenza generata dal motore termico/Wankel
    if (systemType === 'RangeExtender' && erevGeneratorOutputKw) {
      const genHp = Math.round(erevGeneratorOutputKw * 1.3596);
      const genY = toY(genHp);
      if (genY >= padTop && genY <= height - padBottom) {
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(padLeft, genY);
        ctx.lineTo(width - padRight, genY);
        ctx.stroke();

        ctx.fillStyle = '#34d399';
        ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(
          `⚡ Generatore ICE: ${erevGeneratorOutputKw} kW (${genHp} CV)`,
          width - padRight - 6,
          Math.max(padTop + 10, genY - 5),
        );
        ctx.restore();
      }
    }

    // Se Ibrido Parallelo (MHEV, HEV, PHEV): disegna le curve tratteggiate separate (Termico + Elettrico)
    if (isParallelHybrid && iceOnlyCurve && electricOnlyCurve) {
      // 1. Curva Coppia Solo Termico/Wankel (tratteggiata azzurro tenue)
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      iceOnlyCurve.forEach((pt, idx) => {
        const x = toX(pt.rpm);
        const y = toY(pt.torqueNm);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 2. Curva Potenza Solo Termico/Wankel (tratteggiata ambra tenue)
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.42)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      iceOnlyCurve.forEach((pt, idx) => {
        const x = toX(pt.rpm);
        const y = toY(pt.powerHp);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 3. Curva Spinta Elettrica (tratteggiata verde smeraldo)
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.65)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      electricOnlyCurve.forEach((pt, idx) => {
        const x = toX(pt.rpm);
        const y = toY(pt.torqueNm);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

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

    // Area sottesa Potenza Totale
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
    ctx.fillStyle = 'rgba(245, 158, 11, 0.09)';
    ctx.fill();
    ctx.restore();

    // Curva Principale Coppia Totale (Nm) - Ciano pieno
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.6;
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

    // Curva Principale Potenza Totale (CV) - Ambra pieno
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.6;
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

    // Crosshair interattivo
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

      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hx, hyTorque, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hx, hyPower, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [
    curve,
    iceOnlyCurve,
    electricOnlyCurve,
    redlineRpm,
    cornerSpeedRpm,
    systemType,
    isParallelHybrid,
    erevGeneratorOutputKw,
    hoveredIndex,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || curve.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padLeft = 52;
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
  const activeIcePoint =
    hoveredIndex !== null && iceOnlyCurve ? iceOnlyCurve[hoveredIndex] : null;
  const activeEvPoint =
    hoveredIndex !== null && electricOnlyCurve ? electricOnlyCurve[hoveredIndex] : null;
  const powerKw = activePoint ? Math.round(activePoint.powerHp * 0.7355) : 0;

  return (
    <div className="w-full rounded-lg border border-slate-800 bg-slate-950 overflow-hidden select-none">
      {/* Header con Legenda separata */}
      <div className="px-3.5 py-2 border-b border-slate-800/90 bg-slate-900/70 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 text-sky-300 font-bold shrink-0">
            {architectureBadge}
          </span>
          <span className="font-bold text-slate-200 truncate" title={engineName}>
            {engineName.toUpperCase()}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 text-[10px]">
          <span className="text-sky-400 font-bold">━ Coppia (Nm)</span>
          <span className="text-amber-400 font-bold">━ Potenza (CV)</span>
          {isParallelHybrid && (
            <>
              <span className="text-slate-400">┄ Solo Termico</span>
              <span className="text-emerald-400">┄ +Boost EV</span>
            </>
          )}
          <span className="text-rose-400">┆ Limit. {redlineRpm}</span>
        </div>
      </div>

      {/* Canvas 2D */}
      <div className="relative w-full h-60">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIndex(null)}
          className="w-full h-full block cursor-crosshair"
        />
      </div>

      {/* Barra Ispezione Telemetrica */}
      <div className="px-3.5 py-2 border-t border-slate-800/90 bg-slate-900/80 min-h-[42px] flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
        {activePoint ? (
          <div className="w-full flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div>
              <span className="text-slate-400 mr-1">RPM:</span>
              <span className="font-bold text-slate-100">{activePoint.rpm}</span>
            </div>
            <div>
              <span className="text-sky-400 mr-1">COPPIA TOT:</span>
              <span className="font-bold text-sky-300">{activePoint.torqueNm} Nm</span>
            </div>
            <div>
              <span className="text-amber-400 mr-1">POTENZA TOT:</span>
              <span className="font-bold text-amber-300">
                {activePoint.powerHp} CV ({powerKw} kW)
              </span>
            </div>
            {isParallelHybrid && activeIcePoint && activeEvPoint ? (
              <div className="text-emerald-300 font-semibold">
                ICE: {activeIcePoint.powerHp} CV / {activeIcePoint.torqueNm} Nm • EV: +
                {activeEvPoint.powerHp} CV / +{activeEvPoint.torqueNm} Nm
              </div>
            ) : (
              <div className="text-slate-400">
                {activePoint.rpm <= cornerSpeedRpm
                  ? 'Regione Coppia Costante (100%)'
                  : 'Regione Field Weakening (1/RPM)'}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full flex items-center justify-between text-[11px] text-slate-400">
            <span>
              {isParallelHybrid
                ? 'Muovi il cursore per ispezionare Curva Termica + Spinta Elettrica = Totale Sistema'
                : 'Muovi il cursore per ispezionare Coppia da 0 RPM e Plateau di Potenza (Field Weakening)'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

interface ElectricHybridDesignerProps {
  onSwitchToPiston?: () => void;
  onSwitchToWankel?: () => void;
}

export const ElectricHybridDesigner1C: React.FC<ElectricHybridDesignerProps> = ({
  onSwitchToPiston,
  onSwitchToWankel,
}) => {
  const {
    currentYear,
    subBrands,
    chassisList,
    engines,
    livePistonDraft,
    liveWankelDraft,
    saveEngineToDatabase,
    savedElectricMotors,
    savedBatteryPacks,
    saveElectricMotorToLibrary,
    saveBatteryPackToLibrary,
  } = useGameStore();

  // Stato configurazione Powertrain Elettrico/Ibrido (Fase 1.4)
  const [config, setConfig] = useState<ElectricHybridEngineConfigInput>({
    systemType: 'PureEV',
    electricMotorType: 'PermanentMagnetSync',
    motorLayout: 'DualMotor_eAWD',
    hasFrontDisconnect: true,
    statorDiameterMm: 235,
    rotorLengthMm: 165,
    batteryChemistry: 'NMC811',
    batteryCapacityKwh: 75,
    voltageArchitecture: 800,
    coolingSystem: 'LiquidGlycol',
    inverterTech: 'SiliconCarbide_SiC',
    gearboxType: 'SingleSpeedDirect',
    gearRatio: 9.0,
    maxMotorRpm: 18000,
    coupledIceOptionId: 'live-piston-1a',
    priceTier: 'Premium',
    referenceClass: 'Sport',
  });

  const [intendedOrientation, setIntendedOrientation] =
    useState<EngineOrientation>('Trasversale');
  const [selectedSubBrandId, setSelectedSubBrandId] = useState<string>(
    subBrands[0]?.id ?? 'sb-officine-milano',
  );
  const [engineName, setEngineName] = useState<string>('Volta e-AWD 800V');
  const [codeName, setCodeName] = useState<string>('EV-DUAL-800');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);

  const [selectedChassisIds, setSelectedChassisIds] = useState<string[]>(() =>
    chassisList.slice(0, 3).map((c) => c.id),
  );

  // Costruisce l'elenco completo di tutti i Motori Termici / Wankel selezionabili per i test Ibridi (Punto 6):
  // 1) Motore a Pistoni attualmente configurato nella Tab 1A
  // 2) Motore Wankel attualmente configurato nella Tab 1B
  // 3) Qualsiasi motore termico/Wankel salvato nel database dall'utente
  // 4) 3 Motori di riferimento base
  const availableCoupledIceEngines: CoupledIceEngineOption[] = useMemo(() => {
    const savedOptions = engines
      .map(engineEntityToCoupledOption)
      .filter((x): x is CoupledIceEngineOption => x !== null);

    return [
      livePistonDraft,
      liveWankelDraft,
      ...savedOptions,
      ...REFERENCE_HYBRID_ICE_ENGINES,
    ];
  }, [livePistonDraft, liveWankelDraft, engines]);

  const selectedCoupledIce = useMemo(() => {
    return (
      availableCoupledIceEngines.find((e) => e.id === config.coupledIceOptionId) ??
      livePistonDraft
    );
  }, [availableCoupledIceEngines, config.coupledIceOptionId, livePistonDraft]);

  // Se è stato caricato un Pacco Batteria salvato (BatteryPackSpec indipendente), mantiene la sua
  // tensione/raffreddamento/fascia/classe separati dal motore, sincronizzando solo chimica e kWh dagli slider.
  const effectiveConfig: ElectricHybridEngineConfigInput = useMemo(
    () =>
      config.batterySpec
        ? {
            ...config,
            batterySpec: {
              ...config.batterySpec,
              batteryChemistry: config.batteryChemistry,
              batteryCapacityKwh: config.batteryCapacityKwh,
            },
          }
        : config,
    [config],
  );

  // Calcoli Matematici e Telemetrici Real-Time (da src/math/evHybridMath.ts)
  const geometry = useMemo(
    () => calculateElectricHybridGeometryAndDimensions(effectiveConfig, selectedCoupledIce),
    [effectiveConfig, selectedCoupledIce],
  );

  const costs = useMemo(
    () => calculateElectricHybridCosts(effectiveConfig, selectedCoupledIce),
    [effectiveConfig, selectedCoupledIce],
  );

  const telemetry = useMemo(
    () => simulateElectricHybridDyno(effectiveConfig, selectedCoupledIce),
    [effectiveConfig, selectedCoupledIce],
  );

  const unitMotor = telemetry.singleMotorTelemetry;
  const batteryPack = telemetry.batteryPackTelemetry;

  const [motorLibName, setMotorLibName] = useState<string>('E-Motor PSM 235');
  const [motorLibCode, setMotorLibCode] = useState<string>('EM-235');
  const [batteryLibName, setBatteryLibName] = useState<string>('Pacco NMC 75 kWh');
  const [batteryLibCode, setBatteryLibCode] = useState<string>('BP-75');

  const handleSaveMotor = () => {
    const entity: ElectricMotorEntity = {
      id: `emot-${Date.now()}`,
      name: motorLibName,
      codeName: motorLibCode,
      ownerSubBrandId: selectedSubBrandId,
      createdYear: currentYear,
      spec: { ...unitMotor.spec, name: motorLibName, codeName: motorLibCode },
      peakPowerHp: unitMotor.peakPowerHp,
      peakTorqueNm: unitMotor.peakTorqueNm,
      cornerSpeedRpm: unitMotor.cornerSpeedRpm,
      maxMotorRpm: unitMotor.maxMotorRpm,
      dryWeightKg: unitMotor.dryWeightKg,
      reliabilityPercent: unitMotor.reliabilityPercent,
      estimatedLifespanKm: unitMotor.estimatedLifespanKm,
      unitProductionCost: unitMotor.unitProductionCost,
      developmentCost: unitMotor.developmentCost,
    };
    const res = saveElectricMotorToLibrary(entity);
    setFeedbackBanner(
      res.allowed
        ? { type: 'ok', msg: `Motore elettrico "${entity.name}" salvato in libreria (${entity.peakPowerHp} CV / ${entity.peakTorqueNm} Nm per unità).` }
        : { type: 'err', msg: res.reason ?? 'Risorse insufficienti per omologare il motore elettrico.' },
    );
  };

  const handleSaveBattery = () => {
    const entity: BatteryPackEntity = {
      id: `bpack-${Date.now()}`,
      name: batteryLibName,
      codeName: batteryLibCode,
      ownerSubBrandId: selectedSubBrandId,
      createdYear: currentYear,
      spec: { ...batteryPack.spec, name: batteryLibName, codeName: batteryLibCode },
      maxDischargePowerKw: batteryPack.maxDischargePowerKw,
      weightKg: batteryPack.weightKg,
      reliabilityPercent: batteryPack.reliabilityPercent,
      estimatedLifespanKm: batteryPack.estimatedLifespanKm,
      unitProductionCost: batteryPack.unitProductionCost,
      developmentCost: batteryPack.developmentCost,
    };
    const res = saveBatteryPackToLibrary(entity);
    setFeedbackBanner(
      res.allowed
        ? { type: 'ok', msg: `Pacco batteria "${entity.name}" salvato in libreria (${entity.spec.batteryCapacityKwh} kWh, ${entity.maxDischargePowerKw} kW scarica max).` }
        : { type: 'err', msg: res.reason ?? 'Risorse insufficienti per omologare il pacco batteria.' },
    );
  };

  const loadMotorToBench = (m: ElectricMotorEntity) => {
    setConfig((prev) => ({
      ...prev,
      electricMotorType: m.spec.electricMotorType,
      statorDiameterMm: m.spec.statorDiameterMm,
      rotorLengthMm: m.spec.rotorLengthMm,
      voltageArchitecture: m.spec.voltageArchitecture,
      coolingSystem: m.spec.coolingSystem,
      priceTier: m.spec.priceTier,
      referenceClass: m.spec.referenceClass,
      maxMotorRpm: m.spec.maxMotorRpm ?? prev.maxMotorRpm,
      inverterTech: PRICE_TIER_EV_SPECS[m.spec.priceTier].mappedInverterTech,
    }));
  };

  const loadBatteryToBench = (b: BatteryPackEntity) => {
    setConfig((prev) => ({
      ...prev,
      batteryChemistry: b.spec.batteryChemistry,
      batteryCapacityKwh: b.spec.batteryCapacityKwh,
      batterySpec: { ...b.spec },
    }));
  };

  const currentLegalEmissionLimit = useMemo(
    () => getLegalEmissionLimitForYear(currentYear),
    [currentYear],
  );

  const systemSpec = useMemo(
    () =>
      HYBRID_SYSTEM_TYPES.find((s) => s.id === config.systemType) ??
      HYBRID_SYSTEM_TYPES[0],
    [config.systemType],
  );

  const motorSpec = useMemo(
    () =>
      ELECTRIC_MOTOR_TYPES.find((m) => m.id === config.electricMotorType) ??
      ELECTRIC_MOTOR_TYPES[0],
    [config.electricMotorType],
  );

  const layoutSpec = useMemo(
    () =>
      MOTOR_LAYOUT_CONFIGS.find((l) => l.id === config.motorLayout) ??
      MOTOR_LAYOUT_CONFIGS[0],
    [config.motorLayout],
  );

  const batterySpec = useMemo(
    () =>
      BATTERY_CHEMISTRIES.find((b) => b.id === config.batteryChemistry) ??
      BATTERY_CHEMISTRIES[0],
    [config.batteryChemistry],
  );

  const tierSpec = useMemo(
    () => PRICE_TIER_EV_SPECS[config.priceTier] ?? PRICE_TIER_EV_SPECS.Media,
    [config.priceTier],
  );

  const classSpec = useMemo(
    () =>
      REFERENCE_CLASS_EV_SPECS[config.referenceClass] ??
      REFERENCE_CLASS_EV_SPECS.Normale,
    [config.referenceClass],
  );

  // Verifica compatibilità vano motore
  const chassisCompatibilityList = useMemo(() => {
    return chassisList.map((chassis) => {
      const res = evaluateEngineBayCompatibility(
        geometry.engineBayDimensionsMm,
        intendedOrientation,
        chassis,
      );
      return { chassis, ...res };
    });
  }, [geometry.engineBayDimensionsMm, intendedOrientation, chassisList]);

  const overlaidChassisBays: OverlaidChassisBayItem[] = useMemo(() => {
    return chassisCompatibilityList
      .filter((item) => selectedChassisIds.includes(item.chassis.id))
      .map((item) => ({
        id: item.chassis.id,
        name: item.chassis.name,
        codeName: item.chassis.codeName,
        bayDimensionsMm: item.chassis.engineBayMaxDimensionsMm,
        isCompatible: item.isCompatible,
        orientationConflict: item.orientationConflict,
      }));
  }, [chassisCompatibilityList, selectedChassisIds]);

  const toggleChassisSelection = (id: string) => {
    setSelectedChassisIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSystemTypeChange = (newType: HybridSystemType) => {
    const spec = HYBRID_SYSTEM_TYPES.find((s) => s.id === newType);
    if (!spec) return;
    setConfig((prev) => ({
      ...prev,
      systemType: newType,
      batteryCapacityKwh: Math.max(
        spec.minBatteryKwh,
        Math.min(spec.maxBatteryKwh, spec.defaultBatteryKwh),
      ),
    }));
  };

  // Preset rapidi di dimensionamento statore/rotore per test immediati (Citycar -> Hypercar)
  const applyQuickSizingPreset = (preset: 'citycar' | 'sedan' | 'performance' | 'hypercar') => {
    if (preset === 'citycar') {
      setConfig((prev) => ({
        ...prev,
        electricMotorType: 'InductionAsync',
        motorLayout: 'SingleMotor_FWD',
        statorDiameterMm: 155,
        rotorLengthMm: 85,
        voltageArchitecture: 400,
        batteryChemistry: 'LFP',
        batteryCapacityKwh: prev.systemType === 'PureEV' ? 40 : prev.batteryCapacityKwh,
        coolingSystem: 'LiquidGlycol',
        priceTier: 'Economica',
        referenceClass: 'Normale',
      }));
    } else if (preset === 'sedan') {
      setConfig((prev) => ({
        ...prev,
        electricMotorType: 'PermanentMagnetSync',
        motorLayout: 'SingleMotor_RWD',
        statorDiameterMm: 225,
        rotorLengthMm: 155,
        voltageArchitecture: 400,
        batteryChemistry: 'NMC811',
        batteryCapacityKwh: prev.systemType === 'PureEV' ? 75 : prev.batteryCapacityKwh,
        coolingSystem: 'LiquidGlycol',
        priceTier: 'Media',
        referenceClass: 'Normale',
      }));
    } else if (preset === 'performance') {
      setConfig((prev) => ({
        ...prev,
        electricMotorType: 'IPM_SynRM',
        motorLayout: 'DualMotor_eAWD',
        statorDiameterMm: 265,
        rotorLengthMm: 195,
        voltageArchitecture: 800,
        batteryChemistry: 'NMC811',
        batteryCapacityKwh: prev.systemType === 'PureEV' ? 92 : prev.batteryCapacityKwh,
        coolingSystem: 'LiquidGlycol',
        priceTier: 'Premium',
        referenceClass: 'Sport',
      }));
    } else {
      setConfig((prev) => ({
        ...prev,
        electricMotorType: 'AxialFlux',
        motorLayout: 'QuadMotor_Independent',
        statorDiameterMm: 315,
        rotorLengthMm: 245,
        voltageArchitecture: 1000,
        batteryChemistry: 'SolidState',
        batteryCapacityKwh: prev.systemType === 'PureEV' ? 115 : prev.batteryCapacityKwh,
        coolingSystem: 'DirectDielectric',
        priceTier: 'Lusso',
        referenceClass: 'Corsa',
      }));
    }
  };

  const handleHomologate = () => {
    const newEngine: EngineEntity = {
      id: `eng-ev-${Date.now()}`,
      name: engineName,
      codeName,
      ownerSubBrandId: selectedSubBrandId,
      createdYear: currentYear,
      propulsionType: 'ElectricHybrid_1C',
      taxonomy: {
        priceTier: config.priceTier,
        referenceClass: config.referenceClass,
        materialStress: {
          materialName: `${motorSpec.shortName} + ${batterySpec.shortName} (${tierSpec.inverterShort})`,
          materialResistanceFactor: motorSpec.powerMultiplier * 1.15,
          mechanicalStressFactor: config.referenceClass === 'Corsa' ? 1.45 : 1.05,
        },
        estimatedDurabilityKm: telemetry.estimatedLifespanKm,
      },
      dimensionsMm: geometry.engineBayDimensionsMm,
      electricHybridSpecs: telemetry.specs,
      telemetry: {
        curve: telemetry.curve,
        peakPowerHp: telemetry.peakPowerHp,
        peakPowerRpm: telemetry.peakPowerRpm,
        peakTorqueNm: telemetry.peakTorqueNm,
        peakTorqueRpm: telemetry.peakTorqueRpm,
        redlineRpm: telemetry.redlineRpm,
        dryWeightKg: telemetry.dryWeightKg,
        wetWeightKg: telemetry.wetWeightKg,
        thermalEfficiencyPercent: telemetry.thermalEfficiencyPercent,
        emissionsGPerKm: telemetry.emissionsGPerKm,
        reliabilityPercent: telemetry.reliabilityPercent,
        estimatedLifespanKm: telemetry.estimatedLifespanKm,
        unitProductionCost: telemetry.unitProductionCost,
      },
      b2bSaleEnabled: true,
      b2bUnitsSold: 0,
      developmentCost: costs.developmentCost,
    };

    const res = saveEngineToDatabase(newEngine);
    if (!res.allowed) {
      setFeedbackBanner({
        type: 'err',
        msg: res.reason ?? 'Risorse insufficienti per omologare il powertrain elettrico/ibrido.',
      });
    } else {
      setFeedbackBanner({
        type: 'ok',
        msg: `Powertrain "${newEngine.name}" (${newEngine.codeName}) — ${telemetry.peakPowerHp} CV / ${telemetry.peakTorqueNm} Nm omologato con successo!`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Selettore Sotto-Moduli Fase 1 (1A / 1B / 1C Attivo) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSwitchToPiston}
            className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-mono flex items-center gap-1.5 cursor-pointer transition"
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>1A — Endotermici a Pistoni</span>
          </button>

          <button
            type="button"
            onClick={onSwitchToWankel}
            className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-mono flex items-center gap-1.5 cursor-pointer transition"
          >
            <RotateCw className="w-3.5 h-3.5 text-amber-500" />
            <span>1B — Rotativi Wankel</span>
          </button>

          <div className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-sky-500/10">
            <Zap className="w-4 h-4" />
            <span>1C — Elettrici & Ibridi (Fisica Reale Field Weakening)</span>
          </div>
        </div>

        {/* Badge Sintetici Powertrain */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="px-3 py-1.5 rounded bg-slate-900 border border-sky-500/40 text-sky-300 font-bold flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-sky-400" />
            <span>
              {telemetry.peakPowerHp} CV ({Math.round(telemetry.peakPowerHp * 0.7355)} kW) •{' '}
              {telemetry.peakTorqueNm} Nm
            </span>
          </span>
          <span className="px-3 py-1.5 rounded bg-slate-900 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1.5">
            <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {config.batteryCapacityKwh} kWh ({batterySpec.id}) •{' '}
              {telemetry.specs.efficiencyKwhPer100Km} kWh/100km
            </span>
          </span>
          <span className="px-3 py-1.5 rounded bg-slate-900 border border-amber-500/40 text-amber-300 font-bold">
            Affidabilità: {telemetry.reliabilityPercent}% •{' '}
            {(telemetry.estimatedLifespanKm / 1000).toFixed(0)}k km
          </span>
        </div>
      </div>

      {feedbackBanner && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
            feedbackBanner.type === 'ok'
              ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200'
              : 'bg-red-950/80 border-red-500 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{feedbackBanner.msg}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs opacity-75 hover:opacity-100 cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      )}

      {/* Layout Principale a Due Colonne */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ================================================================= */}
        {/* COLONNA SINISTRA: CONFIGURATORE ELETTRO-MECCANICO (7 Colonne)    */}
        {/* ================================================================= */}
        <div className="lg:col-span-7 space-y-6">
          {/* SEZIONE 1: TIPOLOGIA POWERTRAIN E PRESET RAPIDI */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-sky-400" />
                <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                  1. Architettura Powertrain (BEV / MHEV / HEV / PHEV / EREV)
                </h2>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                <span className="text-slate-400">Preset Rapidi:</span>
                <button
                  type="button"
                  onClick={() => applyQuickSizingPreset('citycar')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  Citycar (60-90 CV)
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickSizingPreset('sedan')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 cursor-pointer"
                >
                  Berlina RWD (200 CV)
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickSizingPreset('performance')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 cursor-pointer"
                >
                  Dual AWD (650 CV)
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickSizingPreset('hypercar')}
                  className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold cursor-pointer"
                >
                  Quad Axial (2.100+ CV)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {HYBRID_SYSTEM_TYPES.map((sys) => {
                const isSelected = config.systemType === sys.id;
                return (
                  <button
                    key={sys.id}
                    type="button"
                    onClick={() => handleSystemTypeChange(sys.id)}
                    className={`p-3 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-sky-950/60 border-sky-500 shadow-md shadow-sky-500/10'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-xs text-slate-100">{sys.name}</div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 shrink-0">
                        {sys.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                      {sys.description}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono border-t border-slate-800/80 pt-1.5 text-slate-400">
                      <span>Taglio CO2: -{sys.emissionsReductionPercent}%</span>
                      <span className="text-emerald-400 font-semibold">
                        {sys.minBatteryKwh}–{sys.maxBatteryKwh} kWh
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* SEZIONE 2 (PUNTO 6): SELETTORE MOTORE TERMICO / WANKEL ACCOPPIATO PER TEST IBRIDI */}
          {systemSpec.hasIceEngine && (
            <section className="rounded-xl border-2 border-amber-500/60 bg-amber-950/20 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-800/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-amber-200">
                    Motore Termico / Wankel Accoppiato ({systemSpec.badge})
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-amber-300 font-semibold">
                  {config.systemType === 'RangeExtender'
                    ? 'Lavora a Regime Fisso come Generatore Elettrico'
                    : 'Sovrapposizione Reale delle Curve sul Banco Prova'}
                </span>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-mono text-amber-200/90 uppercase tracking-wider block">
                  Scegli il Motore Endotermico (Pistoni Tab 1A, Wankel Tab 1B, Salvati o Riferimento):
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableCoupledIceEngines.map((iceOpt) => {
                    const isSelected = selectedCoupledIce.id === iceOpt.id;
                    const badgeLabel =
                      iceOpt.sourceKind === 'LivePiston1A'
                        ? '🔥 TAB 1A LIVE'
                        : iceOpt.sourceKind === 'LiveWankel1B'
                          ? '🌀 TAB 1B LIVE'
                          : iceOpt.sourceKind === 'SavedDatabase'
                            ? '📦 SALVATO DB'
                            : '⚙️ RIFERIMENTO';
                    const badgeClass =
                      iceOpt.sourceKind === 'LivePiston1A' ||
                      iceOpt.sourceKind === 'LiveWankel1B'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : iceOpt.sourceKind === 'SavedDatabase'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-300';

                    return (
                      <button
                        key={iceOpt.id}
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            coupledIceOptionId: iceOpt.id,
                          }))
                        }
                        className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-950/70 border-amber-400 shadow-md shadow-amber-500/10'
                            : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-xs text-slate-100 leading-snug">
                            {iceOpt.name}
                          </div>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${badgeClass}`}
                          >
                            {badgeLabel}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-1">
                          {iceOpt.architectureLabel} • Limitatore {iceOpt.redlineRpm} RPM
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px] font-mono border-t border-slate-800/80 pt-1.5">
                          <span className="text-amber-300 font-bold">
                            {iceOpt.peakPowerHp} CV / {iceOpt.peakTorqueNm} Nm
                          </span>
                          <span className="text-slate-400">
                            {iceOpt.wetWeightKg} kg • ${iceOpt.unitProductionCost.toLocaleString('it-IT')}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scheda Sinergia Ibrida o Bilancio Generatore Range Extender */}
              {config.systemType === 'RangeExtender' ? (
                <div
                  className={`p-3 rounded-lg border font-mono text-xs space-y-1.5 ${
                    telemetry.specs.erevSelfSustaining
                      ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-200'
                      : 'bg-red-950/50 border-red-500/60 text-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>
                      {telemetry.specs.erevSelfSustaining
                        ? '✓ GENERATORE EREV AUTOSUFFICIENTE IN AUTOSTRADA'
                        : '⚠️ GENERATORE SOTTODIMENSIONATO (RISCHIO TURTLE MODE)'}
                    </span>
                    <span>Regime Fisso: {telemetry.specs.erevGeneratorRpm} RPM</span>
                  </div>
                  <div className="text-[11px] opacity-90">
                    Il motore <strong>{selectedCoupledIce.name}</strong> genera{' '}
                    <strong>{telemetry.specs.erevGeneratorOutputKw} kW continui</strong> contro un
                    fabbisogno medio in crociera di{' '}
                    <strong>{telemetry.specs.erevCruisingDemandKw} kW</strong>. Autonomia totale
                    combinata (Batteria + Serbatoio):{' '}
                    <strong>{telemetry.specs.erevTotalCombinedRangeKm} km</strong>.
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-slate-950 border border-amber-500/40 font-mono text-xs flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] text-slate-400">CONTRIBUTO TERMICO/WANKEL:</div>
                    <div className="text-amber-300 font-bold">
                      {selectedCoupledIce.peakPowerHp} CV • {selectedCoupledIce.peakTorqueNm} Nm
                    </div>
                  </div>
                  <div className="text-slate-500 font-bold">+</div>
                  <div>
                    <div className="text-[10px] text-slate-400">SPINTA ELETTRICA ({systemSpec.badge}):</div>
                    <div className="text-sky-300 font-bold">
                      +{telemetry.specs.peakElectricPowerHp} CV • +{telemetry.specs.peakTorqueNm} Nm
                    </div>
                  </div>
                  <div className="text-slate-500 font-bold">=</div>
                  <div>
                    <div className="text-[10px] text-emerald-400 font-bold">
                      TOTALE COMBINATO DI SISTEMA:
                    </div>
                    <div className="text-emerald-300 font-bold text-sm">
                      {telemetry.peakPowerHp} CV @ {telemetry.peakPowerRpm} RPM •{' '}
                      {telemetry.peakTorqueNm} Nm
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* SEZIONE 3 (PUNTI 1 E 2): TECNOLOGIA MOTORE ELETTRICO, CONFIGURAZIONE 1-4 MOTORI E TENSIONE */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-sky-400" />
                <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                  2. Tecnologia Elettromotore, Configurazione Assi & Tensione
                </h2>
              </div>
              <span className="text-[11px] font-mono text-sky-400 font-semibold">
                Field Weakening @ {telemetry.specs.cornerSpeedRpm} RPM
              </span>
            </div>

            {/* Tipologia Motore Elettrico */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider block">
                Tipologia Macchina Elettrica (ASM / PSM / IPM-SynRM / Flusso Assiale)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ELECTRIC_MOTOR_TYPES.map((mot) => {
                  const isSelected = config.electricMotorType === mot.id;
                  return (
                    <button
                      key={mot.id}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          electricMotorType: mot.id,
                          maxMotorRpm: Math.min(prev.maxMotorRpm, mot.maxSafeRpm),
                        }))
                      }
                      className={`p-3 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-sky-950/60 border-sky-500 text-sky-100 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs font-bold">{mot.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 shrink-0">
                          Eff. {mot.baseEfficiencyPercent}%
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                        {mot.description}
                      </p>
                      <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-amber-300">
                        <span>
                          Potenza ×{mot.powerMultiplier.toFixed(2)} • Coppia ×
                          {mot.torqueMultiplier.toFixed(2)}
                        </span>
                        <span>Peso ×{mot.weightMultiplier.toFixed(2)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Configurazione Motori e Penalità Efficienza Reali (FWD vs RWD vs Dual/Tri/Quad) */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider">
                  Configurazione Motori e Trazione (Efficienza RWD vs FWD vs Multi-Motore)
                </label>
                {config.motorLayout === 'DualMotor_eAWD' && (
                  <label className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-300 cursor-pointer bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-600/40">
                    <input
                      type="checkbox"
                      checked={Boolean(config.hasFrontDisconnect)}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          hasFrontDisconnect: e.target.checked,
                        }))
                      }
                      className="accent-emerald-500 cursor-pointer"
                    />
                    <span>Sgancio Meccanico Asse Ant. (Riduce penalità consumo a +4%)</span>
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {MOTOR_LAYOUT_CONFIGS.map((lay) => {
                  const isSelected = config.motorLayout === lay.id;
                  const effectivePenaltyPct =
                    lay.id === 'DualMotor_eAWD' &&
                    (motorSpec.hasZeroDragWhenCoasting || config.hasFrontDisconnect)
                      ? '+4.0% consumo (Low-Drag)'
                      : lay.consumptionPenaltyMultiplier === 1.0
                        ? 'Rif. Ottimale (0% pen.)'
                        : `+${((lay.consumptionPenaltyMultiplier - 1) * 100).toFixed(1)}% consumo`;

                  return (
                    <button
                      key={lay.id}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, motorLayout: lay.id }))}
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-sky-950/60 border-sky-500 text-sky-100'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-xs">{lay.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 shrink-0">
                          {lay.typicalHpRangeLabel}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        {lay.description}
                      </p>
                      <div className="mt-2 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                        <span className="text-sky-300">
                          Eff. Base: {lay.baseSystemEfficiencyPercent}%
                        </span>
                        <span
                          className={
                            lay.consumptionPenaltyMultiplier === 1.0
                              ? 'text-emerald-400 font-bold'
                              : 'text-amber-400'
                          }
                        >
                          {effectivePenaltyPct}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Architettura di Tensione: 400V / 800V / 1000V+ */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider block">
                Architettura di Tensione (400V Standard / 800V / 1000V+ Motorsport)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-xs">
                {VOLTAGE_ARCHITECTURES.map((vSpec) => {
                  const isSelected = config.voltageArchitecture === vSpec.voltage;
                  return (
                    <button
                      key={vSpec.voltage}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          voltageArchitecture: vSpec.voltage,
                        }))
                      }
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition flex flex-col justify-between ${
                        isSelected
                          ? 'bg-amber-950/60 border-amber-500 text-amber-100'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>{vSpec.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                          ×{vSpec.powerMultiplier.toFixed(2)} CV
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">{vSpec.description}</div>
                      <div className="mt-2 pt-1 border-t border-slate-800/80 text-[10px] text-emerald-400">
                        Cavi: {vSpec.cableWeightKg} kg • +{vSpec.efficiencyBonusPercent}% Eff.
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slider Dimensionamento Statore/Rotore e Regime Massimo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-300 font-semibold">Diametro Statore:</span>
                  <span className="text-amber-400 font-bold">{config.statorDiameterMm} mm</span>
                </div>
                <input
                  type="range"
                  min={150}
                  max={340}
                  step={5}
                  value={config.statorDiameterMm}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      statorDiameterMm: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>150 mm (Citycar)</span>
                  <span>340 mm (Hypercar)</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-300 font-semibold">Lunghezza Rotore:</span>
                  <span className="text-amber-400 font-bold">{config.rotorLengthMm} mm</span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={280}
                  step={5}
                  value={config.rotorLengthMm}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      rotorLengthMm: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>80 mm (Compatto)</span>
                  <span>280 mm (Max Flusso)</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-300 font-semibold">Limitatore E-Motor:</span>
                  <span className="text-sky-400 font-bold">{config.maxMotorRpm} RPM</span>
                </div>
                <input
                  type="range"
                  min={14000}
                  max={motorSpec.maxSafeRpm}
                  step={500}
                  value={Math.min(config.maxMotorRpm, motorSpec.maxSafeRpm)}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      maxMotorRpm: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>14.000 RPM</span>
                  <span>{motorSpec.maxSafeRpm} RPM Max</span>
                </div>
              </div>
            </div>
          </section>

          {/* SEZIONE 4 (PUNTI 3 E 4): PACCO BATTERIE ($/kWh REALISTICI) & RAFFREDDAMENTO */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Battery className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                  3. Chimica Pacco Batteria ($/kWh Reali) & Gestione Termica
                </h2>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                Costo Pacco Batteria: ${costs.batteryCost.toLocaleString('it-IT')} (
                {batterySpec.costPerKwh} $/kWh)
              </span>
            </div>

            {/* Chimica Batteria */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {BATTERY_CHEMISTRIES.map((bat) => {
                const isSelected = config.batteryChemistry === bat.id;
                const packCostPreview = Math.round(config.batteryCapacityKwh * bat.costPerKwh);
                return (
                  <button
                    key={bat.id}
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, batteryChemistry: bat.id }))}
                    className={`p-3 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-100'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs font-bold">{bat.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold shrink-0">
                        {bat.costPerKwh} $/kWh
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                      {bat.description}
                    </p>
                    <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-sky-300">
                        {bat.cellDensityWhPerKg} Wh/kg • Base {(bat.baseLifespanKm / 1000).toFixed(0)}k km
                      </span>
                      <span className="text-amber-300 font-bold">
                        Pacco {config.batteryCapacityKwh} kWh = $
                        {packCostPreview.toLocaleString('it-IT')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Slider Capacità Batteria (kWh) */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-mono">
                <span className="text-slate-300 font-semibold">
                  Capacità Pacco Batteria ({systemSpec.badge}):
                </span>
                <span className="text-emerald-400 font-bold">
                  {config.batteryCapacityKwh} kWh • Costo Pacco: $
                  {costs.batteryCost.toLocaleString('it-IT')} • Peso Batteria:{' '}
                  {telemetry.specs.batteryWeightKg} kg
                </span>
              </div>
              <input
                type="range"
                min={systemSpec.minBatteryKwh}
                max={systemSpec.maxBatteryKwh}
                step={systemSpec.maxBatteryKwh > 20 ? 1 : 0.2}
                value={config.batteryCapacityKwh}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    batteryCapacityKwh: Number(e.target.value),
                  }))
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>{systemSpec.minBatteryKwh} kWh Min</span>
                <span>
                  Scarica Picco Attuale: {telemetry.specs.cRatePeak}C (Max Cont.{' '}
                  {batterySpec.maxContinuousCRate}C)
                </span>
                <span>{systemSpec.maxBatteryKwh} kWh Max</span>
              </div>
            </div>

            {/* Sistema di Raffreddamento (Impatto Dinamico su Affidabilità e Durata) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-sky-400" />
                <span>Sistema di Raffreddamento (Governa Thermal Throttling e Affidabilità %)</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {ELECTRIC_COOLING_SYSTEMS.map((cool) => {
                  const isSelected = config.coolingSystem === cool.id;
                  return (
                    <button
                      key={cool.id}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, coolingSystem: cool.id }))}
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-sky-950/60 border-sky-500 text-sky-100'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-xs font-bold">{cool.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        {cool.description}
                      </p>
                      <div className="mt-2 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                        <span
                          className={
                            cool.reliabilityDeltaPercent < 0
                              ? 'text-red-400 font-bold'
                              : 'text-emerald-400 font-bold'
                          }
                        >
                          {cool.reliabilityDeltaPercent > 0 ? '+' : ''}
                          {cool.reliabilityDeltaPercent}% Affid.
                        </span>
                        <span className="text-slate-400">
                          +{cool.weightKg} kg • ${cool.cost}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SEZIONE 3B: LIBRERIA COMPONENTI SEPARATI (MOTORE SINGOLO / PACCO BATTERIA) & BANCO */}
          <section className="rounded-xl border border-violet-500/50 bg-violet-950/10 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-800/60 pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-400" />
                <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-violet-200">
                  Componenti Separati: Motore Singolo • Pacco Batteria • Banco Prova
                </h2>
              </div>
              <span className="text-[11px] font-mono text-violet-300 font-semibold">
                Banco: {telemetry.specs.motorCount}× motori
                {telemetry.specs.hasMechanicalAwdShaft ? ' + albero AWD (0.92×)' : ` (${telemetry.specs.motorCount}.0×)`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
              {/* Singola unità motore */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-[10px] text-slate-400 uppercase">Singola Unità Motore (1.0×)</div>
                <div className="text-sky-300 font-bold text-sm">
                  {unitMotor.peakPowerHp} CV • {unitMotor.peakTorqueNm} Nm
                </div>
                <div className="text-[10px] text-slate-400">
                  FW {unitMotor.cornerSpeedRpm} RPM • Max {unitMotor.maxMotorRpm} RPM • {unitMotor.dryWeightKg} kg
                </div>
                <div className="text-[10px] text-amber-300">
                  Costo unità: ${unitMotor.unitProductionCost.toLocaleString('it-IT')} (indipendente da posizione/orientamento)
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    value={motorLibName}
                    onChange={(e) => setMotorLibName(e.target.value)}
                    className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-100 text-[11px]"
                  />
                  <input
                    type="text"
                    value={motorLibCode}
                    onChange={(e) => setMotorLibCode(e.target.value)}
                    className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-100 text-[11px]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveMotor}
                  className="w-full px-3 py-1.5 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Salva Motore Singolo (${unitMotor.developmentCost.capitalCost.toLocaleString('it-IT')} • {unitMotor.developmentCost.rdCost} R&D)
                </button>
              </div>

              {/* Pacco batteria */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase">
                  <span>Pacco Batteria Indipendente</span>
                  {config.batterySpec && (
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, batterySpec: undefined }))}
                      className="text-rose-300 normal-case hover:text-rose-200 cursor-pointer"
                    >
                      Scollega pacco salvato
                    </button>
                  )}
                </div>
                <div className="text-emerald-300 font-bold text-sm">
                  {batteryPack.batteryCapacityKwh} kWh {batteryPack.spec.batteryChemistry} • {batteryPack.spec.voltageArchitecture}V
                </div>
                <div className="text-[10px] text-slate-400">
                  Scarica max {batteryPack.maxDischargePowerKw} kW ({batteryPack.maxDischargePowerHp} CV) • {batteryPack.weightKg} kg
                </div>
                <div className="text-[10px] text-amber-300">
                  Costo pacco: ${batteryPack.unitProductionCost.toLocaleString('it-IT')} ({batteryPack.costPerKwh} $/kWh + BMS)
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    value={batteryLibName}
                    onChange={(e) => setBatteryLibName(e.target.value)}
                    className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-100 text-[11px]"
                  />
                  <input
                    type="text"
                    value={batteryLibCode}
                    onChange={(e) => setBatteryLibCode(e.target.value)}
                    className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-100 text-[11px]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveBattery}
                  className="w-full px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Salva Pacco Batteria (${batteryPack.developmentCost.capitalCost.toLocaleString('it-IT')} • {batteryPack.developmentCost.rdCost} R&D)
                </button>
              </div>
            </div>

            {/* Librerie salvate: carica al banco */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
              <div className="space-y-1.5">
                <div className="text-[10px] text-slate-400 uppercase">Motori salvati ({savedElectricMotors.length})</div>
                {savedElectricMotors.length === 0 ? (
                  <div className="text-slate-500 text-[10px]">Nessun motore salvato.</div>
                ) : (
                  savedElectricMotors.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => loadMotorToBench(m)}
                      className="w-full p-2 rounded border border-slate-800 bg-slate-950 hover:border-sky-500 text-left cursor-pointer"
                    >
                      <div className="font-bold text-slate-100">{m.name} ({m.codeName})</div>
                      <div className="text-[10px] text-sky-300">
                        {m.peakPowerHp} CV • {m.peakTorqueNm} Nm • ${m.unitProductionCost.toLocaleString('it-IT')} → Carica al banco
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="space-y-1.5">
                <div className="text-[10px] text-slate-400 uppercase">Pacchi batteria salvati ({savedBatteryPacks.length})</div>
                {savedBatteryPacks.length === 0 ? (
                  <div className="text-slate-500 text-[10px]">Nessun pacco salvato.</div>
                ) : (
                  savedBatteryPacks.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => loadBatteryToBench(b)}
                      className="w-full p-2 rounded border border-slate-800 bg-slate-950 hover:border-emerald-500 text-left cursor-pointer"
                    >
                      <div className="font-bold text-slate-100">{b.name} ({b.codeName})</div>
                      <div className="text-[10px] text-emerald-300">
                        {b.spec.batteryCapacityKwh} kWh {b.spec.batteryChemistry} • {b.maxDischargePowerKw} kW • ${b.unitProductionCost.toLocaleString('it-IT')} → Carica al banco
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* SEZIONE 5 (PUNTO 5): IMPATTO REALE DI FASCIA PREZZO (INVERTER IGBT -> SiC) E CLASSE D'USO */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                  4. Fascia Prezzo (Elettronica Inverter) & Classe d’Uso (Taratura Fisica)
                </h2>
              </div>
              <span className="text-[11px] font-mono text-amber-300">
                {tierSpec.inverterShort} • {classSpec.badge}
              </span>
            </div>

            {/* Fascia di Prezzo (PriceTier -> Inverter IGBT 86% vs MOSFET SiC 97.5%) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider block">
                Fascia di Prezzo (Governa Tecnologia Inverter IGBT/SiC, +CV, Consumi e Durata km)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRICE_TIERS.map((tier) => {
                  const tSpec = PRICE_TIER_EV_SPECS[tier];
                  const isSelected = config.priceTier === tier;
                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          priceTier: tier,
                          inverterTech: tSpec.mappedInverterTech,
                        }))
                      }
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-amber-950/60 border-amber-500 text-amber-100'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs">Fascia {tier}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                          {tSpec.inverterShort}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">{tSpec.description}</p>
                      <div className="mt-2 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-emerald-300">
                        <span>Potenza ×{tSpec.powerMultiplier.toFixed(2)}</span>
                        <span>Consumo ×{tSpec.consumptionMultiplier.toFixed(2)}</span>
                        <span>Durata ×{tSpec.lifespanMultiplier.toFixed(2)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Classe d'Uso (ReferenceClass -> Normale / Comfort / Sport / Corsa / Fuoristrada) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider block">
                Classe d’Uso (Modifica C-Rate di Scarica, Buffer Batteria, Peso, Affidabilità e Km)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {REFERENCE_CLASSES.map((refCls) => {
                  const cSpec = REFERENCE_CLASS_EV_SPECS[refCls];
                  const isSelected = config.referenceClass === refCls;
                  return (
                    <button
                      key={refCls}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          referenceClass: refCls,
                        }))
                      }
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-sky-950/60 border-sky-500 text-sky-100'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs">Classe {refCls}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                          CV ×{cSpec.powerMultiplier.toFixed(2)} • Nm ×
                          {cSpec.torqueMultiplier.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        {cSpec.description}
                      </p>
                      <div className="mt-2 pt-1 border-t border-slate-800/80 text-[10px] font-mono text-emerald-400">
                        Target: {cSpec.targetLifespanDescription}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SEZIONE 6: ASSEGNAZIONE MARCHIO, COSTI & OMOLOGAZIONE */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                  5. Identificativo Commerciale & Omologazione Nel Database
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Salvataggio in Libreria Motori
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-slate-400">Nome Commerciale Powertrain:</label>
                <input
                  type="text"
                  value={engineName}
                  onChange={(e) => setEngineName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">Codice Progetto Industriale:</label>
                <input
                  type="text"
                  value={codeName}
                  onChange={(e) => setCodeName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">Sotto-Brand Proprietario:</label>
                <select
                  value={selectedSubBrandId}
                  onChange={(e) => setSelectedSubBrandId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-100"
                >
                  {subBrands.map((sb) => (
                    <option key={sb.id} value={sb.id}>
                      {sb.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Riepilogo Scomposizione Costi Unitari & Omologazione */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
              <div className="space-y-0.5">
                <div className="text-slate-400 uppercase text-[10px]">
                  Costo Sviluppo Omologazione:
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 font-bold">
                    ${costs.developmentCost.capitalCost.toLocaleString('it-IT')}
                  </span>
                  <span className="text-sky-400 font-bold">
                    {costs.developmentCost.rdCost} PTS R&D
                  </span>
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-slate-400 uppercase text-[10px]">
                  Costo Unitario (Batt. ${costs.batteryCost.toLocaleString('it-IT')} + Mot/Inv $
                  {(costs.motorSystemCost + costs.inverterAndCoolingCost).toLocaleString('it-IT')}
                  {costs.coupledIceCost > 0
                    ? ` + ICE $${costs.coupledIceCost.toLocaleString('it-IT')}`
                    : ''}
                  ):
                </div>
                <div className="text-amber-400 font-bold text-sm">
                  ${costs.unitProductionCost.toLocaleString('it-IT')} / unità
                </div>
              </div>

              <button
                type="button"
                onClick={handleHomologate}
                className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer transition"
              >
                <Save className="w-4 h-4" />
                <span>Omologa Powertrain</span>
              </button>
            </div>
          </section>
        </div>

        {/* ================================================================= */}
        {/* COLONNA DESTRA: BANCO PROVA 2D, TELEMETRIA & CAD 3D (5 Colonne)   */}
        {/* ================================================================= */}
        <div className="lg:col-span-5 space-y-6">
          {/* BANCO PROVA GRAFICO 2D MULTI-CURVA */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                  Banco Prova Dinamometrico (1C)
                </h3>
              </div>
              <span className="text-xs font-mono text-sky-300 font-bold">
                {telemetry.peakPowerHp} CV ({Math.round(telemetry.peakPowerHp * 0.7355)} kW) •{' '}
                {telemetry.peakTorqueNm} Nm
              </span>
            </div>

            <EvHybridDynoCanvas2D
              curve={telemetry.curve}
              iceOnlyCurve={telemetry.iceOnlyCurve}
              electricOnlyCurve={telemetry.electricOnlyCurve}
              redlineRpm={telemetry.redlineRpm}
              cornerSpeedRpm={telemetry.specs.cornerSpeedRpm ?? 6500}
              systemType={config.systemType}
              engineName={engineName}
              architectureBadge={`${systemSpec.badge} • ${layoutSpec.shortName}`}
              erevGeneratorOutputKw={telemetry.specs.erevGeneratorOutputKw}
            />
          </section>

          {/* TELEMETRIA SINTETICA DETTAGLIATA */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 font-mono text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Telemetria Reale, Efficienza & Durata Stimata</span>
              </span>
              <span className="text-[10px] text-amber-300">{tierSpec.inverterShort}</span>
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">
                  {systemSpec.hasIceEngine && config.systemType !== 'RangeExtender'
                    ? 'Potenza Totale Combinata:'
                    : 'Potenza Elettrica Picco:'}
                </div>
                <div className="text-amber-300 font-bold text-sm">
                  {telemetry.peakPowerHp} CV ({Math.round(telemetry.peakPowerHp * 0.7355)} kW)
                </div>
                <div className="text-[10px] text-slate-400">
                  E-Motor: {telemetry.specs.peakElectricPowerHp} CV (Cont.{' '}
                  {telemetry.specs.continuousPowerKw} kW)
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">
                  {systemSpec.hasIceEngine && config.systemType !== 'RangeExtender'
                    ? 'Coppia Totale Combinata:'
                    : 'Coppia Motore da 0 RPM:'}
                </div>
                <div className="text-sky-300 font-bold text-sm">{telemetry.peakTorqueNm} Nm</div>
                <div className="text-[10px] text-slate-400">
                  Field Weakening: {telemetry.specs.cornerSpeedRpm} RPM
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Efficienza Sistema & Consumo:</div>
                <div className="text-emerald-300 font-bold text-sm">
                  {telemetry.thermalEfficiencyPercent}% • {telemetry.specs.efficiencyKwhPer100Km}{' '}
                  kWh/100km
                </div>
                <div className="text-[10px] text-slate-400">
                  {telemetry.specs.efficiencyWhPerKm} Wh/km • Autonomia EV:{' '}
                  {telemetry.specs.estimatedRangeKm} km
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Peso Totale Powertrain:</div>
                <div className="text-slate-100 font-bold text-sm">
                  {telemetry.wetWeightKg} kg (Secco: {telemetry.dryWeightKg} kg)
                </div>
                <div className="text-[10px] text-slate-400">
                  Batt: {telemetry.specs.batteryWeightKg} kg • E-Mot:{' '}
                  {telemetry.specs.motorWeightKg} kg
                  {systemSpec.hasIceEngine ? ` • ICE: ${selectedCoupledIce.wetWeightKg} kg` : ''}
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">
                  Affidabilità Dinamica (58%–94%):
                </div>
                <div
                  className={`font-bold text-sm ${
                    telemetry.reliabilityPercent >= 82
                      ? 'text-emerald-400'
                      : telemetry.reliabilityPercent >= 70
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }`}
                >
                  {telemetry.reliabilityPercent}%
                </div>
                <div className="text-[10px] text-slate-400">
                  Scarica: {telemetry.specs.cRatePeak}C • Raffr. {config.coolingSystem}
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">
                  Durata Stimata Reale (75–80% SoH):
                </div>
                <div className="text-sky-300 font-bold text-sm">
                  {telemetry.estimatedLifespanKm.toLocaleString('it-IT')} km
                </div>
                <div className="text-[10px] text-slate-400">
                  Classe {config.referenceClass} • Chimica {batterySpec.id}
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Emissioni CO2 Omologate:</div>
                <div
                  className={`font-bold text-sm ${
                    telemetry.emissionsGPerKm <= currentLegalEmissionLimit
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}
                >
                  {telemetry.emissionsGPerKm} g/km
                </div>
                <div className="text-[10px] text-slate-400">
                  Soglia {currentYear}: {currentLegalEmissionLimit} g/km
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Costo Produzione Unitario:</div>
                <div className="text-amber-300 font-bold text-sm">
                  ${telemetry.unitProductionCost.toLocaleString('it-IT')}
                </div>
                <div className="text-[10px] text-slate-400">
                  Pacco Batt.: ${costs.batteryCost.toLocaleString('it-IT')} (
                  {batterySpec.costPerKwh} $/kWh)
                </div>
              </div>
            </div>
          </section>

          {/* VISUALIZZATORE CAD 3D E COLLISIONE VANO MOTORE */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                  CAD 3D & Ingombro Vano Motore
                </h3>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <label className="text-[11px] text-slate-400">Orientamento:</label>
                <select
                  value={intendedOrientation}
                  onChange={(e) => setIntendedOrientation(e.target.value as EngineOrientation)}
                  className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-sky-300 text-xs"
                >
                  <option value="Trasversale">Trasversale</option>
                  <option value="Longitudinale">Longitudinale</option>
                </select>
              </div>
            </div>

            <VolumeViewer3D
              engineInBayDimensionsMm={geometry.engineBayDimensionsMm}
              rawEngineDimensionsMm={geometry.engineBayDimensionsMm}
              electricConfig={effectiveConfig}
              engineType="ElectricHybrid"
              overlaidChassisBays={overlaidChassisBays}
            />

            <div className="space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  <span>Seleziona Pianali da Sovrapporre nel 3D:</span>
                </span>
                <span>
                  Vano: {geometry.engineBayDimensionsMm.lengthMm}×
                  {geometry.engineBayDimensionsMm.widthMm}×
                  {geometry.engineBayDimensionsMm.heightMm} mm
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {chassisCompatibilityList.map((item) => {
                  const isChecked = selectedChassisIds.includes(item.chassis.id);
                  return (
                    <label
                      key={item.chassis.id}
                      className={`p-2 rounded border flex items-center justify-between cursor-pointer transition ${
                        item.isCompatible
                          ? 'border-emerald-900/60 bg-emerald-950/20 text-emerald-200'
                          : 'border-red-900/60 bg-red-950/20 text-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleChassisSelection(item.chassis.id)}
                          className="rounded accent-sky-500 cursor-pointer"
                        />
                        <span className="font-bold">{item.chassis.name}</span>
                        <span className="text-[10px] text-slate-400">
                          ({item.chassis.codeName})
                        </span>
                      </div>
                      <span className="text-[10px] font-bold">
                        {item.isCompatible ? '✓ COMPATIBILE' : '✗ INCOMPATIBILE'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
