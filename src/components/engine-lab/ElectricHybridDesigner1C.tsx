import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BatteryCharging,
  Box,
  CheckCircle2,
  Cpu,
  Flame,
  Gauge,
  Layers,
  RotateCw,
  Save,
  Shield,
  ShieldAlert,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  BATTERY_CHEMISTRIES,
  BATTERY_PACK_STRUCTURE_SPECS,
  BENCH_MOTOR_SCALING_CONFIGS,
  BMS_CALIBRATION_SPECS,
  deriveBatteryPackTaxonomy,
  deriveElectricMotorTaxonomy,
  ELECTRIC_COOLING_SYSTEMS,
  ELECTRIC_MOTOR_TYPES,
  HYBRID_SYSTEM_TYPES,
  INVERTER_POWER_ELECTRONICS_SPECS,
  MOTOR_HOUSING_SPECS,
  MOTOR_LAYOUT_CONFIGS,
  PRICE_TIER_EV_SPECS,
  REFERENCE_HYBRID_ICE_ENGINES,
  ROTOR_MAGNET_MATERIAL_SPECS,
  ROTOR_SLEEVE_BEARING_SPECS,
  STATOR_WINDING_SPECS,
  UNDERBODY_SHIELD_SPECS,
  VOLTAGE_ARCHITECTURES,
} from '../../data/electricHybridData';
import { getLegalEmissionLimitForYear } from '../../data/historicalEras';
import {
  calculateElectricHybridCosts,
  calculateElectricHybridGeometryAndDimensions,
  simulateElectricHybridDyno,
} from '../../math/evHybridMath';
import {
  calculateBatteryPackVariantRdCost,
  calculateElectricMotorVariantRdCost,
} from '../../math/variantRdMath';
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
} from '../../types/gameTypes';
import {
  type OverlaidChassisBayItem,
  VolumeViewer3D,
} from '../common/VolumeViewer3D';


/**
 * Converte un EngineEntity (Pistoni 1A o Wankel 1B) salvato nel database in un CoupledIceEngineOption
 * selezionabile per i test dei sistemi ibridi (MHEV, HEV, PHEV, Range Extender).
 */
function engineEntityToCoupledOption(eng: EngineEntity): CoupledIceEngineOption | null {
  if (eng.propulsionType === 'ElectricHybrid_1C') {
    return null;
  }

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
      intendedOrientation: w.intendedOrientation ?? 'Longitudinale',
      nativeOrientation: w.nativeOrientation ?? w.intendedOrientation ?? 'Longitudinale',
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
    intendedOrientation: p?.intendedOrientation ?? 'Longitudinale',
    nativeOrientation: p?.nativeOrientation ?? p?.intendedOrientation ?? 'Longitudinale',
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
    systemType === 'MHEV' || systemType === 'FullHybrid' || systemType === 'PHEV';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, width, height);

    if (!curve || curve.length === 0) return;

    const padLeft = 46;
    const padRight = 16;
    const padTop = 20;
    const padBottom = 26;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const minRpm = 0;
    const maxRpm = Math.max(redlineRpm, curve[curve.length - 1]?.rpm ?? 18000);

    let maxVal = 100;
    curve.forEach((p) => {
      if (p.torqueNm > maxVal) maxVal = p.torqueNm;
      if (p.powerHp > maxVal) maxVal = p.powerHp;
    });
    maxVal = Math.ceil((maxVal * 1.1) / 50) * 50;

    // Griglia orizzontale
    ctx.strokeStyle = '#1e293b';
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
      ctx.lineWidth = 1.5;
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

    // Curva Coppia Totale Sistema (Azzurro / Ciano solido brillante)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    curve.forEach((p, idx) => {
      const x = toX(p.rpm);
      const y = toY(p.torqueNm);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Curva Potenza Totale Sistema (Ambra brillante)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    curve.forEach((p, idx) => {
      const x = toX(p.rpm);
      const y = toY(p.powerHp);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Linea verticale limitatore RPM (Rosso tratteggiato)
    const redlineX = toX(redlineRpm);
    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(redlineX, padTop);
    ctx.lineTo(redlineX, height - padBottom);
    ctx.stroke();
    ctx.restore();

    // Cursore ispezione RPM
    if (hoveredIndex !== null && curve[hoveredIndex]) {
      const hp = curve[hoveredIndex];
      const hx = toX(hp.rpm);
      const hyTorque = toY(hp.torqueNm);
      const hyPower = toY(hp.powerHp);

      ctx.save();
      ctx.strokeStyle = '#e2e8f0';
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, padTop);
      ctx.lineTo(hx, height - padBottom);
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(hx, hyTorque, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(hx, hyPower, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }, [
    curve,
    iceOnlyCurve,
    electricOnlyCurve,
    redlineRpm,
    cornerSpeedRpm,
    systemType,
    hoveredIndex,
    isParallelHybrid,
    erevGeneratorOutputKw,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || curve.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padLeft = 46;
    const padRight = 16;
    const plotW = canvas.clientWidth - padLeft - padRight;
    const ratio = Math.max(0, Math.min(1, (mouseX - padLeft) / Math.max(1, plotW)));
    const minRpm = 0;
    const maxRpm = Math.max(redlineRpm, curve[curve.length - 1]?.rpm ?? 18000);
    const targetRpm = minRpm + ratio * (maxRpm - minRpm);

    let closestIdx = 0;
    let minDiff = Infinity;
    curve.forEach((p, idx) => {
      const diff = Math.abs(p.rpm - targetRpm);
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
      {/* Header con Legenda */}
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
              <div className="text-[10px] text-emerald-300">
                ICE: {activeIcePoint.powerHp} CV • EV: +{activeEvPoint.powerHp} CV
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
    activeVariantParent,
    startVariant,
    clearVariant,
  } = useGameStore();

  // Organizzazione Interfaccia in 3 Pannelli Distinti (Punto 5):
  // 1) 'motor' -> Costruttore Singolo Motore Elettrico (1.0x universale, senza asse o orientamento)
  // 2) 'battery' -> Costruttore Pacco Batteria Indipendente
  // 3) 'bench' -> Simulatore Powertrain al Banco Prova (scala multi-motore 1-4x, albero AWD -8% e test ibridi)
  const [activeSubPanel, setActiveSubPanel] = useState<'motor' | 'battery' | 'bench'>('motor');

  // Stato configurazione Powertrain Elettrico/Ibrido (Fase 1.4)
  const [config, setConfig] = useState<ElectricHybridEngineConfigInput>({
    systemType: 'PureEV',
    electricMotorType: 'PermanentMagnetSync',
    motorLayout: 'DualMotor_eAWD',
    motorCount: 2,
    hasFrontDisconnect: true,
    statorDiameterMm: 235,
    rotorLengthMm: 165,
    batteryChemistry: 'NMC811',
    batteryCapacityKwh: 75,
    voltageArchitecture: 800,
    coolingSystem: 'LiquidGlycol',
    inverterTech: 'SiliconCarbide_SiC',
    // 5 Componenti Hardware Fisici Motore
    statorWinding: 'HairpinFlat',
    inverterPowerElectronics: 'SiliconCarbide_SiC',
    rotorSleeveBearing: 'InconelSleeveHybrid',
    rotorMagnetMaterial: 'NeodymiumNdFeB',
    motorHousing: 'DieCastAluminum',
    // Parametri Hardware Pacco Batteria
    packStructure: 'CellToPackCopper',
    bmsCalibration: 'RoadBalanced',
    underbodyShield: 'StandardSteelShield',
    gearboxType: 'SingleSpeedDirect',
    gearRatio: 9.0,
    maxMotorRpm: 18000,
    coupledIceOptionId: 'live-piston-1a',
    priceTier: 'Premium',
    referenceClass: 'Sport',
  });

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

  // Motori Termici / Wankel selezionabili per accoppiamento Ibrido
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

  // L'orientamento dell'Ibrido è tassativamente ed esclusivamente quello del motore termico accoppiato!
  // Non si decide a posteriori nel banco ibrido: è una proprietà intrinseca del motore termico selezionato.
  const effectiveOrientation: EngineOrientation = useMemo(() => {
    if (config.systemType === 'PureEV') {
      return 'Trasversale';
    }
    return selectedCoupledIce.intendedOrientation ?? 'Longitudinale';
  }, [config.systemType, selectedCoupledIce]);

  // Se è stato caricato un Pacco Batteria salvato, mantiene le sue specifiche
  const effectiveConfig: ElectricHybridEngineConfigInput = useMemo(() => {
    const motorTax = deriveElectricMotorTaxonomy(
      config.statorWinding,
      config.inverterPowerElectronics,
      config.rotorSleeveBearing,
      config.rotorMagnetMaterial,
      config.motorHousing,
    );
    const battTax = deriveBatteryPackTaxonomy(
      config.packStructure,
      config.bmsCalibration,
      config.underbodyShield,
    );

    return {
      ...config,
      priceTier: motorTax.priceTier,
      referenceClass: motorTax.referenceClass,
      inverterTech:
        config.inverterPowerElectronics === 'Dual_SiC_GaN_Racing'
          ? 'GalliumNitride_GaN'
          : config.inverterPowerElectronics === 'SiliconCarbide_SiC'
            ? 'SiliconCarbide_SiC'
            : 'Silicon_IGBT',
      batterySpec: config.batterySpec
        ? {
            ...config.batterySpec,
            batteryChemistry: config.batteryChemistry,
            batteryCapacityKwh: config.batteryCapacityKwh,
            packStructure: config.packStructure,
            bmsCalibration: config.bmsCalibration,
            underbodyShield: config.underbodyShield,
            priceTier: battTax.priceTier,
            referenceClass: battTax.referenceClass,
          }
        : undefined,
    };
  }, [config]);

  // Calcoli Matematici e Telemetrici Real-Time
  const geometry = useMemo(
    () =>
      calculateElectricHybridGeometryAndDimensions(
        effectiveConfig,
        selectedCoupledIce,
        effectiveOrientation,
      ),
    [effectiveConfig, selectedCoupledIce, effectiveOrientation],
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

  // Sincronizza activeVariantParent se presente per E-Motor o Battery
  useEffect(() => {
    if (activeVariantParent) {
      if (activeVariantParent.type === 'electricMotor') {
        const parent = activeVariantParent.entity as ElectricMotorEntity;
        if (parent && parent.spec) {
          setActiveSubPanel('motor');
          setMotorLibName(`${parent.name} Evo`);
          setMotorLibCode(`${parent.codeName}-EVO`);
          const s = parent.spec;
          setConfig((prev) => ({
            ...prev,
            electricMotorType: s.electricMotorType,
            statorDiameterMm: s.statorDiameterMm,
            rotorLengthMm: s.rotorLengthMm,
            voltageArchitecture: s.voltageArchitecture,
            coolingSystem: s.coolingSystem,
            statorWinding: s.statorWinding ?? prev.statorWinding,
            inverterPowerElectronics: s.inverterPowerElectronics ?? prev.inverterPowerElectronics,
            rotorSleeveBearing: s.rotorSleeveBearing ?? prev.rotorSleeveBearing,
            rotorMagnetMaterial: s.rotorMagnetMaterial ?? prev.rotorMagnetMaterial,
            motorHousing: s.motorHousing ?? prev.motorHousing,
          }));
        }
      } else if (activeVariantParent.type === 'batteryPack') {
        const parent = activeVariantParent.entity as BatteryPackEntity;
        if (parent && parent.spec) {
          setActiveSubPanel('battery');
          setBatteryLibName(`${parent.name} Evo`);
          setBatteryLibCode(`${parent.codeName}-EVO`);
          const b = parent.spec;
          setConfig((prev) => ({
            ...prev,
            batteryChemistry: b.batteryChemistry,
            batteryCapacityKwh: b.batteryCapacityKwh,
            voltageArchitecture: b.voltageArchitecture,
            packStructure: b.packStructure ?? prev.packStructure,
            coolingSystem: b.coolingSystem ?? prev.coolingSystem,
            bmsCalibration: b.bmsCalibration ?? prev.bmsCalibration,
            underbodyShield: b.underbodyShield ?? prev.underbodyShield,
          }));
        }
      }
    }
  }, [activeVariantParent]);

  const motorVariantRdResult = useMemo(() => {
    if (activeVariantParent && activeVariantParent.type === 'electricMotor') {
      return calculateElectricMotorVariantRdCost(
        unitMotor.spec,
        activeVariantParent.entity as ElectricMotorEntity,
        unitMotor.developmentCost,
      );
    }
    return null;
  }, [activeVariantParent, unitMotor.spec, unitMotor.developmentCost]);

  const batteryVariantRdResult = useMemo(() => {
    if (activeVariantParent && activeVariantParent.type === 'batteryPack') {
      return calculateBatteryPackVariantRdCost(
        batteryPack.spec,
        activeVariantParent.entity as BatteryPackEntity,
        batteryPack.developmentCost,
      );
    }
    return null;
  }, [activeVariantParent, batteryPack.spec, batteryPack.developmentCost]);

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
      developmentCost: motorVariantRdResult
        ? motorVariantRdResult.effectiveDevelopmentCost
        : unitMotor.developmentCost,
      parentMotorId: activeVariantParent?.id,
      parentMotorName: activeVariantParent?.name,
      isVariant: Boolean(motorVariantRdResult),
      variantRdSavingsPercent: motorVariantRdResult?.savingsPercentage,
      variantModifiedParts: motorVariantRdResult?.detectedChanges.map((c) => c.label),
    };
    const res = saveElectricMotorToLibrary(entity);
    if (res.allowed && motorVariantRdResult) {
      clearVariant();
    }
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
      developmentCost: batteryVariantRdResult
        ? batteryVariantRdResult.effectiveDevelopmentCost
        : batteryPack.developmentCost,
      parentBatteryId: activeVariantParent?.id,
      parentBatteryName: activeVariantParent?.name,
      isVariant: Boolean(batteryVariantRdResult),
      variantRdSavingsPercent: batteryVariantRdResult?.savingsPercentage,
      variantModifiedParts: batteryVariantRdResult?.detectedChanges.map((c) => c.label),
    };
    const res = saveBatteryPackToLibrary(entity);
    if (res.allowed && batteryVariantRdResult) {
      clearVariant();
    }
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
      statorWinding: m.spec.statorWinding ?? prev.statorWinding,
      inverterPowerElectronics: m.spec.inverterPowerElectronics ?? prev.inverterPowerElectronics,
      rotorSleeveBearing: m.spec.rotorSleeveBearing ?? prev.rotorSleeveBearing,
      rotorMagnetMaterial: m.spec.rotorMagnetMaterial ?? prev.rotorMagnetMaterial,
      motorHousing: m.spec.motorHousing ?? prev.motorHousing,
      priceTier: m.spec.priceTier,
      referenceClass: m.spec.referenceClass,
      maxMotorRpm: m.spec.maxMotorRpm ?? prev.maxMotorRpm,
    }));
  };

  const loadBatteryToBench = (b: BatteryPackEntity) => {
    setConfig((prev) => ({
      ...prev,
      batteryChemistry: b.spec.batteryChemistry,
      batteryCapacityKwh: b.spec.batteryCapacityKwh,
      voltageArchitecture: b.spec.voltageArchitecture,
      coolingSystem: b.spec.coolingSystem,
      packStructure: b.spec.packStructure ?? prev.packStructure,
      bmsCalibration: b.spec.bmsCalibration ?? prev.bmsCalibration,
      underbodyShield: b.spec.underbodyShield ?? prev.underbodyShield,
      priceTier: b.spec.priceTier,
      referenceClass: b.spec.referenceClass,
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

  // Verifica compatibilità vano motore
  const isPureElectricContext = activeSubPanel === 'motor' || config.systemType === 'PureEV';

  const chassisCompatibilityList = useMemo(() => {
    return chassisList.map((chassis) => {
      const res = evaluateEngineBayCompatibility(
        geometry.engineBayDimensionsMm,
        effectiveOrientation,
        chassis,
        { isPureEV: isPureElectricContext },
      );
      return { chassis, ...res };
    });
  }, [geometry.engineBayDimensionsMm, effectiveOrientation, chassisList, isPureElectricContext]);

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

  // Preset rapidi di dimensionamento statore/rotore e componentistica
  const applyQuickSizingPreset = (preset: 'citycar' | 'sedan' | 'performance' | 'hypercar') => {
    if (preset === 'citycar') {
      setConfig((prev) => ({
        ...prev,
        electricMotorType: 'InductionAsync',
        motorLayout: 'SingleMotor_RWD',
        motorCount: 1,
        statorDiameterMm: 155,
        rotorLengthMm: 85,
        voltageArchitecture: 400,
        batteryChemistry: 'LFP',
        batteryCapacityKwh: prev.systemType === 'PureEV' ? 40 : prev.batteryCapacityKwh,
        coolingSystem: 'Air',
        statorWinding: 'RoundWireStandard',
        inverterPowerElectronics: 'Silicon_IGBT',
        rotorSleeveBearing: 'SteelLaminationStandard',
        rotorMagnetMaterial: 'FerriteStandardCage',
        motorHousing: 'DieCastAluminum',
        packStructure: 'ModularAluminum',
        bmsCalibration: 'ConservativeLongevity',
        underbodyShield: 'StandardSteelShield',
      }));
    } else if (preset === 'sedan') {
      setConfig((prev) => ({
        ...prev,
        electricMotorType: 'PermanentMagnetSync',
        motorLayout: 'SingleMotor_RWD',
        motorCount: 1,
        statorDiameterMm: 225,
        rotorLengthMm: 155,
        voltageArchitecture: 800,
        batteryChemistry: 'NMC811',
        batteryCapacityKwh: prev.systemType === 'PureEV' ? 75 : prev.batteryCapacityKwh,
        coolingSystem: 'LiquidGlycol',
        statorWinding: 'HairpinFlat',
        inverterPowerElectronics: 'Silicon_MOSFET',
        rotorSleeveBearing: 'InconelSleeveHybrid',
        rotorMagnetMaterial: 'NeodymiumNdFeB',
        motorHousing: 'AcousticDampedActiveNVH',
        packStructure: 'CellToPackCopper',
        bmsCalibration: 'RoadBalanced',
        underbodyShield: 'StandardSteelShield',
      }));
    } else if (preset === 'performance') {
      setConfig((prev) => ({
        ...prev,
        electricMotorType: 'IPM_SynRM',
        motorLayout: 'DualMotor_eAWD',
        motorCount: 2,
        hasFrontDisconnect: true,
        statorDiameterMm: 265,
        rotorLengthMm: 195,
        voltageArchitecture: 800,
        batteryChemistry: 'NMC811',
        batteryCapacityKwh: prev.systemType === 'PureEV' ? 92 : prev.batteryCapacityKwh,
        coolingSystem: 'LiquidGlycol',
        statorWinding: 'HairpinContinuousMultiLayer',
        inverterPowerElectronics: 'SiliconCarbide_SiC',
        rotorSleeveBearing: 'InconelSleeveHybrid',
        rotorMagnetMaterial: 'NeodymiumDyUH',
        motorHousing: 'DieCastAluminum',
        packStructure: 'CellToChassisCTC',
        bmsCalibration: 'PerformanceSport',
        underbodyShield: 'StandardSteelShield',
      }));
    } else {
      setConfig((prev) => ({
        ...prev,
        electricMotorType: 'AxialFlux',
        motorLayout: 'QuadMotor_Independent',
        motorCount: 4,
        hasFrontDisconnect: false,
        statorDiameterMm: 315,
        rotorLengthMm: 245,
        voltageArchitecture: 1000,
        batteryChemistry: 'SolidState',
        batteryCapacityKwh: prev.systemType === 'PureEV' ? 115 : prev.batteryCapacityKwh,
        coolingSystem: 'DirectDielectric',
        statorWinding: 'LitzRacingWire',
        inverterPowerElectronics: 'Dual_SiC_GaN_Racing',
        rotorSleeveBearing: 'CarbonPrepregCeramic',
        rotorMagnetMaterial: 'SamariumCobaltRacing',
        motorHousing: 'MagnesiumCarbonUltralight',
        packStructure: 'CarbonLaserSilverBusbar',
        bmsCalibration: 'RaceExtreme',
        underbodyShield: 'TitaniumKevlarIP69K',
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

  const isAsm = config.electricMotorType === 'InductionAsync';
  const showDisconnectControl =
    config.motorLayout === 'DualMotor_eAWD' ||
    config.motorLayout === 'TriMotor_TorqueVectoring' ||
    config.motorLayout === 'QuadMotor_Independent';

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
            <span>1C — Elettrici & Ibridi (Fisica Reale)</span>
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

      {/* SELETTORE DEI 3 PANNELLI DISTINTI (Punto 5) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-b border-slate-800 pb-4">
        <button
          type="button"
          onClick={() => setActiveSubPanel('motor')}
          className={`flex items-center justify-between p-3 rounded-xl font-mono text-xs font-bold transition cursor-pointer border ${
            activeSubPanel === 'motor'
              ? 'bg-sky-950/80 border-sky-500 text-sky-100 shadow-lg shadow-sky-500/10'
              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Cpu className={`w-4 h-4 ${activeSubPanel === 'motor' ? 'text-sky-400' : 'text-slate-400'}`} />
            <div className="text-left">
              <div>Pannello 1: Costruttore Motore</div>
              <div className="text-[10px] font-normal text-slate-400">Singola unità universale (1.0×)</div>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-sky-300 shrink-0">
            {unitMotor.peakPowerHp} CV • {unitMotor.dryWeightKg} kg
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubPanel('battery')}
          className={`flex items-center justify-between p-3 rounded-xl font-mono text-xs font-bold transition cursor-pointer border ${
            activeSubPanel === 'battery'
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-100 shadow-lg shadow-emerald-500/10'
              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <BatteryCharging className={`w-4 h-4 ${activeSubPanel === 'battery' ? 'text-emerald-400' : 'text-slate-400'}`} />
            <div className="text-left">
              <div>Pannello 2: Costruttore Batteria</div>
              <div className="text-[10px] font-normal text-slate-400">Pacco indipendente salvabile</div>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-emerald-300 shrink-0">
            {batteryPack.usableCapacityKwh} kWh • {batteryPack.maxDischargePowerKw} kW
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubPanel('bench')}
          className={`flex items-center justify-between p-3 rounded-xl font-mono text-xs font-bold transition cursor-pointer border ${
            activeSubPanel === 'bench'
              ? 'bg-amber-950/80 border-amber-500 text-amber-100 shadow-lg shadow-amber-500/10'
              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Gauge className={`w-4 h-4 ${activeSubPanel === 'bench' ? 'text-amber-400' : 'text-slate-400'}`} />
            <div className="text-left">
              <div>Pannello 3: Simulatore al Banco</div>
              <div className="text-[10px] font-normal text-slate-400">Test multi-motore & ibridi</div>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-300 shrink-0">
            {telemetry.peakPowerHp} CV • {telemetry.specs.systemType}
          </span>
        </button>
      </div>

      {/* Layout Principale a Due Colonne */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ================================================================= */}
        {/* COLONNA SINISTRA: PANNELLO ATTIVO (7 Colonne)                     */}
        {/* ================================================================= */}
        <div className="lg:col-span-7 space-y-6">
          {/* =============================================================== */}
          {/* PANNELLO 1: COSTRUTTORE SINGOLO MOTORE ELETTRICO (1.0x)         */}
          {/* =============================================================== */}
          {activeSubPanel === 'motor' && (
            <div className="space-y-6">
              {/* Banner Modalità Variante Motore Elettrico attiva */}
              {activeVariantParent && activeVariantParent.type === 'electricMotor' && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center gap-2 text-amber-300">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      <strong>Modalità Variante Attiva da:</strong> {activeVariantParent.name} (
                      {activeVariantParent.codeName}) — Calcolo R&D Delta Anti-Exploit
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={clearVariant}
                    className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer text-[11px]"
                  >
                    Annulla Modalità Variante
                  </button>
                </div>
              )}

              {/* Banner descrittivo Pannello 1 */}
              <div className="p-4 rounded-xl border border-sky-500/40 bg-sky-950/20 space-y-1">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-sky-400" />
                  <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-sky-200">
                    Pannello 1: Costruttore Singolo Motore Elettrico (Unità Universale 1.0×)
                  </h2>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Configura e omologa la singola unità motrice indipendente. Rimosso qualsiasi parametro di posizionamento (Anteriore/Posteriore) o orientamento (Trasversale/Longitudinale): l’unità è universale e riutilizzabile su qualsiasi asse al banco prova.
                </p>
              </div>

              {/* 1. Tipologia Macchina Elettrica (Punto 1) */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                    1. Tipologia Macchina Elettrica
                  </span>
                  <span className="text-[11px] font-mono text-sky-400 font-semibold">
                    Field Weakening @ {unitMotor.cornerSpeedRpm} RPM
                  </span>
                </div>

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
                            Potenza ×{mot.powerMultiplier.toFixed(2)} • Coppia ×{mot.torqueMultiplier.toFixed(2)}
                          </span>
                          <span>Peso ×{mot.weightMultiplier.toFixed(2)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 2. Dimensionamento Statore e Rotore (Punto 2: nessun clamp max peso) */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                    2. Dimensionamento Statore, Rotore & Regime Massimo
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    Volume Cilindrico: {Math.round(Math.PI * Math.pow(config.statorDiameterMm / 20, 2) * (config.rotorLengthMm / 10))} cc
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

                <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800/80 text-[11px] font-mono flex items-center justify-between text-slate-400">
                  <span>
                    Cassa esterna: Ø {config.statorDiameterMm + 38} mm • Lunghezza{' '}
                    {config.electricMotorType === 'AxialFlux'
                      ? Math.round(85 + config.rotorLengthMm * 0.22)
                      : config.rotorLengthMm + 80}{' '}
                    mm
                  </span>
                  <span className="text-emerald-400 font-semibold">
                    ✓ Peso unitario: {unitMotor.dryWeightKg} kg a secco (scala continua proporzionale al volume senza tetto)
                  </span>
                </div>
              </section>

              {/* 3. Tensione e Raffreddamento Singolo Motore (Punto 3: fluidi reali +1.2 kg o +2.5..4.0 kg) */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider block">
                    3. Tensione Operativa Motore
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
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Sistema di Raffreddamento Motore</span>
                    <span className="text-emerald-400 font-normal">
                      Fluidi Motore: +{(unitMotor.wetWeightKg - unitMotor.dryWeightKg).toFixed(1)} kg ({config.coolingSystem === 'Air' ? 'olio riduttore 1.2 kg' : 'olio riduttore + liquido camicia statore'})
                    </span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {ELECTRIC_COOLING_SYSTEMS.map((cool) => {
                      const isSelected = config.coolingSystem === cool.id;
                      const fluidOffsetLabel = cool.id === 'Air' ? '+1.2 kg fluidi' : '+2.5 ~ 4.0 kg fluidi';
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
                          <div className="font-bold text-xs">{cool.name}</div>
                          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                            {cool.description}
                          </p>
                          <div className="mt-2 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                            <span className="text-amber-300 font-semibold">{fluidOffsetLabel}</span>
                            <span className="text-slate-400">${cool.cost}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* 4. Componentistica Interna & Hardware Fisico del Motore Elettrico */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                      4. Componentistica Interna & Hardware Fisico Motore
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                      Fascia: {tierSpec.tier}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                      Classe: {config.referenceClass}
                    </span>
                  </div>
                </div>

                {/* A) Avvolgimenti Statore */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>A) Avvolgimenti Statore</span>
                    <span className="text-sky-400 font-normal">Riempimento cava & perdite alta frequenza</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {STATOR_WINDING_SPECS.map((w) => {
                      const isSelected = config.statorWinding === w.id;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, statorWinding: w.id }))}
                          className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-sky-950/60 border-sky-500 text-sky-100 ring-1 ring-sky-500/40'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs">{w.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 shrink-0">
                              {w.powerMultiplier >= 1.0 ? `+${Math.round((w.powerMultiplier - 1) * 100)}%` : `${Math.round((w.powerMultiplier - 1) * 100)}%`} CV
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{w.description}</p>
                          <div className="mt-2 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                            <span className="text-emerald-400">
                              {w.weightDeltaKg !== 0 ? `${w.weightDeltaKg > 0 ? '+' : ''}${w.weightDeltaKg} kg • ` : ''}
                              {w.cost > 0 ? `+$${w.cost}` : 'Base $0'}
                            </span>
                            <span className="text-slate-400">R&D: {w.rdCost}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* B) Elettronica di Potenza (Inverter) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>B) Elettronica di Potenza (Inverter)</span>
                    <span className="text-sky-400 font-normal">Semiconduttori e correnti di fase</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {INVERTER_POWER_ELECTRONICS_SPECS.map((inv) => {
                      const isSelected = config.inverterPowerElectronics === inv.id;
                      return (
                        <button
                          key={inv.id}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, inverterPowerElectronics: inv.id }))}
                          className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-amber-950/60 border-amber-500 text-amber-100 ring-1 ring-amber-500/40'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs">{inv.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 shrink-0">
                              {inv.efficiencyPercent}% Eff.
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{inv.description}</p>
                          <div className="mt-2 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                            <span className="text-amber-300 font-bold">
                              {inv.powerMultiplier >= 1.0 ? `+${Math.round((inv.powerMultiplier - 1) * 100)}%` : `${Math.round((inv.powerMultiplier - 1) * 100)}%`} CV/Nm
                            </span>
                            <span className="text-slate-400">${inv.cost}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* C) Contenimento Rotore e Cuscinetti (Limitatore RPM e Attriti) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>C) Contenimento Rotore e Cuscinetti</span>
                    <span className="text-sky-400 font-normal">Limite centrifugo & attriti rotanti</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {ROTOR_SLEEVE_BEARING_SPECS.map((brg) => {
                      const isSelected = config.rotorSleeveBearing === brg.id;
                      return (
                        <button
                          key={brg.id}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, rotorSleeveBearing: brg.id }))}
                          className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-sky-950/60 border-sky-500 text-sky-100 ring-1 ring-sky-500/40'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="font-bold text-xs flex items-center justify-between">
                            <span>{brg.shortName}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300">
                              max {brg.maxSafeRpm.toLocaleString('it-IT')} RPM
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{brg.description}</p>
                          <div className="mt-2 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                            <span className="text-emerald-400">
                              {brg.weightDeltaKg !== 0 ? `${brg.weightDeltaKg} kg • ` : ''}
                              {brg.cost > 0 ? `+$${brg.cost}` : 'Base $0'}
                            </span>
                            <span className="text-slate-400">+{brg.reliabilityDeltaPercent}% Affid.</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* D) Materiale Magneti / Gabbia Rotore */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>D) Materiale Magneti / Gabbia Rotore</span>
                    <span className="text-sky-400 font-normal">Permeabilità & resistenza termica</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ROTOR_MAGNET_MATERIAL_SPECS.map((mag) => {
                      const isSelected = config.rotorMagnetMaterial === mag.id;
                      return (
                        <button
                          key={mag.id}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, rotorMagnetMaterial: mag.id }))}
                          className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-purple-950/60 border-purple-500 text-purple-100 ring-1 ring-purple-500/40'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs">{mag.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 shrink-0">
                              {mag.torqueMultiplier >= 1.0 ? `+${Math.round((mag.torqueMultiplier - 1) * 100)}%` : `${Math.round((mag.torqueMultiplier - 1) * 100)}%`} Nm
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{mag.description}</p>
                          <div className="mt-2 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                            <span className="text-purple-300">
                              {mag.cost !== 0 ? `${mag.cost > 0 ? '+$' : '-$'}${Math.abs(mag.cost)}` : 'Base $0'}
                            </span>
                            <span className="text-slate-400">Tenuta: {mag.thermalDemagnetizationResistance}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* E) Carcassa Esterna e Isolamento */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>E) Carcassa Esterna e Isolamento</span>
                    <span className="text-sky-400 font-normal">Protezione, NVH & peso strutturale</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {MOTOR_HOUSING_SPECS.map((h) => {
                      const isSelected = config.motorHousing === h.id;
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, motorHousing: h.id }))}
                          className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-slate-900 border-sky-400 text-sky-100 ring-1 ring-sky-400/40'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs">{h.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 shrink-0">
                              {h.weightDeltaKg > 0 ? `+${h.weightDeltaKg} kg` : h.weightDeltaKg < 0 ? `${h.weightDeltaKg} kg` : '0 kg'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{h.description}</p>
                          <div className="mt-2 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                            <span className="text-emerald-400 font-semibold">
                              {h.cost > 0 ? `+$${h.cost}` : 'Base $0'}
                            </span>
                            <span className="text-slate-400">
                              {h.nvhComfortScore > 0 ? `+${h.nvhComfortScore} NVH` : h.reliabilityDeltaPercent > 0 ? `+${h.reliabilityDeltaPercent}% Affid.` : 'Std'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* 5. Salvataggio Singola Unità nella Libreria Componenti */}
              <section className="rounded-xl border border-sky-500/50 bg-sky-950/10 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-sky-800/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Save className="w-4 h-4 text-sky-400" />
                    <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-sky-200">
                      5. Salvataggio Singola Unità Motore nella Libreria
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-sky-300 font-semibold">
                    {unitMotor.peakPowerHp} CV • {unitMotor.peakTorqueNm} Nm • ${unitMotor.unitProductionCost.toLocaleString('it-IT')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="space-y-1">
                    <label className="text-slate-400">Nome Commerciale Motore:</label>
                    <input
                      type="text"
                      value={motorLibName}
                      onChange={(e) => setMotorLibName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">Codice Identificativo:</label>
                    <input
                      type="text"
                      value={motorLibCode}
                      onChange={(e) => setMotorLibCode(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100"
                    />
                  </div>
                </div>

                {/* Delta R&D Anti-Exploit Summary se siamo in Modalità Variante Motore */}
                {motorVariantRdResult && (
                  <div className="p-3.5 rounded-xl border font-mono text-xs space-y-2 bg-slate-950/90 border-amber-500/40">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Variante da: {motorVariantRdResult.parentName} ({motorVariantRdResult.parentCodeName})</span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          motorVariantRdResult.hasStructuralMoldChange
                            ? 'bg-red-950 border border-red-500 text-red-300'
                            : 'bg-emerald-950 border border-emerald-500 text-emerald-300'
                        }`}
                      >
                        {motorVariantRdResult.hasStructuralMoldChange
                          ? 'Strutturale (95% R&D)'
                          : `-${motorVariantRdResult.savingsPercentage}% R&D`}
                      </span>
                    </div>

                    {motorVariantRdResult.structuralWarning && (
                      <div className="p-2 rounded bg-red-950/50 border border-red-900/60 text-red-300 text-[11px]">
                        ⚠️ {motorVariantRdResult.structuralWarning}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                      <span className="text-slate-400">Costo R&D Pieno:</span>
                      <span className="line-through text-slate-500">
                        ${(motorVariantRdResult.baseDevelopmentCost.capitalCost / 1_000_000).toFixed(2)}M • {motorVariantRdResult.baseDevelopmentCost.rdCost} R&D
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-400 font-semibold">Costo Variante per Differenza:</span>
                      <span className="font-bold text-emerald-300">
                        ${(motorVariantRdResult.effectiveDevelopmentCost.capitalCost / 1_000_000).toFixed(2)}M • {motorVariantRdResult.effectiveDevelopmentCost.rdCost} R&D
                      </span>
                    </div>

                    {motorVariantRdResult.detectedChanges.length > 0 && (
                      <div className="pt-1.5 border-t border-slate-800/80 space-y-1">
                        <div className="text-[10px] uppercase text-slate-400">
                          Modifiche Rilevate ({motorVariantRdResult.detectedChanges.length}):
                        </div>
                        <div className="max-h-24 overflow-y-auto space-y-0.5 pr-1 text-[10px]">
                          {motorVariantRdResult.detectedChanges.map((ch, idx) => (
                            <div key={idx} className="flex items-center justify-between text-slate-300">
                              <span>• {ch.label}</span>
                              <span className="text-amber-400 font-semibold">+{ch.rdPercentage}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveMotor}
                    className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-2 cursor-pointer transition shadow-md shadow-sky-500/10"
                  >
                    <Save className="w-4 h-4" />
                    <span>
                      {motorVariantRdResult ? 'Salva Variante Motore' : 'Salva Motore Singolo'} (-$
                      {(
                        (motorVariantRdResult
                          ? motorVariantRdResult.effectiveDevelopmentCost.capitalCost
                          : unitMotor.developmentCost.capitalCost) / 1_000_000
                      ).toFixed(2)}
                      M / -
                      {motorVariantRdResult
                        ? motorVariantRdResult.effectiveDevelopmentCost.rdCost
                        : unitMotor.developmentCost.rdCost}{' '}
                      R&D)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSubPanel('bench')}
                    className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-sky-500/50 text-sky-300 font-mono text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Invia al Banco Prova</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Motori salvati nella libreria */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2 font-mono text-[11px]">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Motori Elettrici Salvati nella Libreria ({savedElectricMotors.length}):
                  </div>
                  {savedElectricMotors.length === 0 ? (
                    <div className="text-slate-500 text-[10px]">
                      Nessun motore ancora salvato. Salva questa unità per renderla disponibile in tutti i progetti.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {savedElectricMotors.map((m) => (
                        <div
                          key={m.id}
                          className="p-2.5 rounded-lg border border-slate-800 bg-slate-950 flex flex-col justify-between gap-1.5"
                        >
                          <div>
                            <div className="font-bold text-slate-200">{m.name} ({m.codeName})</div>
                            <div className="text-[10px] text-sky-300">
                              {m.peakPowerHp} CV • {m.peakTorqueNm} Nm • {m.dryWeightKg} kg • ${m.unitProductionCost.toLocaleString('it-IT')}
                            </div>
                            {m.isVariant && (
                              <div className="text-[10px] text-amber-400 font-semibold mt-0.5">
                                ↳ Variante da {m.parentMotorName || 'Progetto Base'} (-{m.variantRdSavingsPercent ?? 0}% R&D)
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                            <button
                              type="button"
                              onClick={() => {
                                loadMotorToBench(m);
                                setActiveSubPanel('bench');
                              }}
                              className="flex-1 px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 text-[10px] font-bold text-center cursor-pointer"
                            >
                              Monta al Banco →
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                startVariant({
                                  type: 'electricMotor',
                                  id: m.id,
                                  name: m.name,
                                  codeName: m.codeName,
                                  entity: m,
                                });
                                loadMotorToBench(m);
                                setMotorLibName(`${m.name} Evo`);
                                setMotorLibCode(`${m.codeName}-EVO`);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold cursor-pointer"
                            >
                              Crea Variante
                            </button>
                            <button
                              type="button"
                              onClick={() => loadMotorToBench(m)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                            >
                              Modifica
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* =============================================================== */}
          {/* PANNELLO 2: COSTRUTTORE PACCO BATTERIA INDIPENDENTE             */}
          {/* =============================================================== */}
          {activeSubPanel === 'battery' && (
            <div className="space-y-6">
              {/* Banner Modalità Variante Pacco Batteria attiva */}
              {activeVariantParent && activeVariantParent.type === 'batteryPack' && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center gap-2 text-amber-300">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      <strong>Modalità Variante Attiva da:</strong> {activeVariantParent.name} (
                      {activeVariantParent.codeName}) — Calcolo R&D Delta Anti-Exploit
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={clearVariant}
                    className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer text-[11px]"
                  >
                    Annulla Modalità Variante
                  </button>
                </div>
              )}

              {/* Banner descrittivo Pannello 2 */}
              <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/20 space-y-1">
                <div className="flex items-center gap-2">
                  <BatteryCharging className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-emerald-200">
                    Pannello 2: Costruttore Pacco Batteria Indipendente
                  </h2>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Configura e dimensiona indipendentemente il pacco accumulatori. Gestisce chimica celle, $/kWh reali, scarica massima di picco e continua, durata cicli SoH e ingombro 3D, pronto per essere salvato e accoppiato al banco prova.
                </p>
              </div>

              {/* 1. Chimica Cella ($/kWh Reali) */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                    1. Chimica Cella Pacco Batteria ($/kWh Reali)
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">
                    Costo Celle: ${batteryPack.cellsCost.toLocaleString('it-IT')} ({batterySpec.costPerKwh} $/kWh)
                  </span>
                </div>

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
                            ? 'bg-emerald-950/60 border-emerald-500 text-emerald-100 shadow-sm'
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
                            {bat.cellDensityWhPerKg} Wh/kg • {(bat.baseLifespanKm / 1000).toFixed(0)}k km
                          </span>
                          <span className="text-amber-300 font-bold">
                            Celle: ${packCostPreview.toLocaleString('it-IT')}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 2. Capacità Energetica Totale Pacco (kWh) */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                    2. Capacità Energetica Totale Pacco (kWh)
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    <span className="text-slate-400">Preset Rapidi:</span>
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, batteryCapacityKwh: 3 }))}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                    >
                      MHEV (3 kWh)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, batteryCapacityKwh: 22 }))}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 cursor-pointer"
                    >
                      PHEV (22 kWh)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, batteryCapacityKwh: 40 }))}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 cursor-pointer"
                    >
                      Citycar (40 kWh)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, batteryCapacityKwh: 75 }))}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 cursor-pointer"
                    >
                      Berlina (75 kWh)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, batteryCapacityKwh: 115 }))}
                      className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold cursor-pointer"
                    >
                      Hypercar (115 kWh)
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-mono">
                    <span className="text-slate-300 font-semibold">Capacità Pacco Batteria:</span>
                    <span className="text-emerald-400 font-bold">
                      {config.batteryCapacityKwh} kWh nominali • {batteryPack.usableCapacityKwh} kWh utili
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={150}
                    step={config.batteryCapacityKwh <= 10 ? 0.5 : 1}
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
                    <span>1 kWh Min</span>
                    <span>Peso Pacco: {batteryPack.weightKg} kg</span>
                    <span>150 kWh Max</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Scarica Massima Pacco:</div>
                    <div className="text-emerald-300 font-bold text-sm">
                      {batteryPack.maxDischargePowerKw} kW ({batteryPack.maxDischargePowerHp} CV)
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Continua: {batteryPack.maxContinuousDischargePowerKw} kW
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Tasso di Scarica (C-Rate):</div>
                    <div className="text-amber-300 font-bold text-sm">
                      {batteryPack.peakDischargeCRate}C Picco
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Continuo sicuro: {batteryPack.maxContinuousCRate}C
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Dimensioni Skateboard 3D:</div>
                    <div className="text-sky-300 font-bold text-sm">
                      {batteryPack.dimensionsMm.lengthMm} × {batteryPack.dimensionsMm.widthMm} × {batteryPack.dimensionsMm.heightMm} mm
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Densità celle: {batterySpec.cellDensityWhPerKg} Wh/kg
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. Tensione e Raffreddamento Batteria */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider block">
                    3. Tensione Operativa Pacco Batteria
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
                              ? 'bg-emerald-950/60 border-emerald-500 text-emerald-100'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="font-bold flex items-center justify-between">
                            <span>{vSpec.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300">
                              {vSpec.voltage}V
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">{vSpec.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider block">
                    Sistema di Raffreddamento Pacco Batteria
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
                              ? 'bg-emerald-950/60 border-emerald-500 text-emerald-100'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="font-bold text-xs">{cool.name}</div>
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
                            <span className="text-slate-400">${cool.cost}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* 4. Architettura Strutturale, BMS & Protezione Pacco Batteria */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                      4. Architettura Strutturale, BMS & Protezione Pacco
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300">
                      Fascia: {deriveBatteryPackTaxonomy(config.packStructure, config.bmsCalibration, config.underbodyShield).priceTier}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                      Classe: {deriveBatteryPackTaxonomy(config.packStructure, config.bmsCalibration, config.underbodyShield).referenceClass}
                    </span>
                  </div>
                </div>

                {/* A) Struttura e Connessioni Pacco */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>A) Struttura e Connessioni Pacco</span>
                    <span className="text-emerald-400 font-normal">Integrazione telaio & rigidità strutturale</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {BATTERY_PACK_STRUCTURE_SPECS.map((st) => {
                      const isSelected = config.packStructure === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, packStructure: st.id }))}
                          className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-emerald-950/60 border-emerald-500 text-emerald-100 ring-1 ring-emerald-500/40'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs">{st.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 shrink-0">
                              {st.weightMultiplier < 1.0 ? `${Math.round((st.weightMultiplier - 1) * 100)}%` : `+${Math.round((st.weightMultiplier - 1) * 100)}%`} Peso
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{st.description}</p>
                          <div className="mt-2 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                            <span className="text-emerald-400">
                              {st.cost > 0 ? `+$${st.cost.toLocaleString('it-IT')}` : 'Base $0'}
                            </span>
                            <span className="text-slate-400">R&D: {st.rdCost}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* B) Taratura BMS, Buffer di Sicurezza e Scarica (C-Rate) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>B) Taratura BMS, Buffer di Sicurezza e Scarica (C-Rate)</span>
                    <span className="text-emerald-400 font-normal">Buffer utile vs Potenza scarica impulsiva</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {BMS_CALIBRATION_SPECS.map((bms) => {
                      const isSelected = config.bmsCalibration === bms.id;
                      return (
                        <button
                          key={bms.id}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, bmsCalibration: bms.id }))}
                          className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-sky-950/60 border-sky-500 text-sky-100 ring-1 ring-sky-500/40'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs">{bms.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 shrink-0">
                              Buffer {bms.bufferPercent}%
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{bms.description}</p>
                          <div className="mt-2 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                            <span className="text-sky-300 font-semibold">
                              {bms.maxCRateMultiplier}C Max Scarica
                            </span>
                            <span className={bms.lifespanMultiplier >= 1.0 ? 'text-emerald-400' : 'text-red-400'}>
                              {bms.lifespanMultiplier >= 1.0 ? `×${bms.lifespanMultiplier}` : `×${bms.lifespanMultiplier}`} Durata
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* C) Protezione Sottoscocca */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>C) Protezione Sottoscocca</span>
                    <span className="text-emerald-400 font-normal">Resistenza impatti dal fondo stradale</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {UNDERBODY_SHIELD_SPECS.map((sh) => {
                      const isSelected = config.underbodyShield === sh.id;
                      return (
                        <button
                          key={sh.id}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, underbodyShield: sh.id }))}
                          className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-emerald-950/60 border-emerald-500 text-emerald-100 ring-1 ring-emerald-500/40'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs">{sh.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 shrink-0">
                              {sh.weightKg > 0 ? `+${sh.weightKg} kg` : '0 kg'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{sh.description}</p>
                          <div className="mt-2 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                            <span className="text-emerald-400">
                              {sh.cost > 0 ? `+$${sh.cost}` : 'Base $0'}
                            </span>
                            <span className="text-slate-400">
                              {sh.reliabilityDeltaPercent > 0 ? `+${sh.reliabilityDeltaPercent}% Affid. Gravosa` : 'Standard'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* 5. Salvataggio Pacco Batteria nella Libreria Componenti */}
              <section className="rounded-xl border border-emerald-500/50 bg-emerald-950/10 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-800/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Save className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-emerald-200">
                      5. Salvataggio Pacco Batteria nella Libreria
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-300 font-semibold">
                    ${batteryPack.unitProductionCost.toLocaleString('it-IT')} ({batteryPack.costPerKwh} $/kWh + BMS)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="space-y-1">
                    <label className="text-slate-400">Nome Pacco Batteria:</label>
                    <input
                      type="text"
                      value={batteryLibName}
                      onChange={(e) => setBatteryLibName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">Codice Identificativo:</label>
                    <input
                      type="text"
                      value={batteryLibCode}
                      onChange={(e) => setBatteryLibCode(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100"
                    />
                  </div>
                </div>

                {/* Delta R&D Anti-Exploit Summary se siamo in Modalità Variante Batteria */}
                {batteryVariantRdResult && (
                  <div className="p-3.5 rounded-xl border font-mono text-xs space-y-2 bg-slate-950/90 border-amber-500/40">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Variante da: {batteryVariantRdResult.parentName} ({batteryVariantRdResult.parentCodeName})</span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          batteryVariantRdResult.hasStructuralMoldChange
                            ? 'bg-red-950 border border-red-500 text-red-300'
                            : 'bg-emerald-950 border border-emerald-500 text-emerald-300'
                        }`}
                      >
                        {batteryVariantRdResult.hasStructuralMoldChange
                          ? 'Chimica Base (95% R&D)'
                          : `-${batteryVariantRdResult.savingsPercentage}% R&D`}
                      </span>
                    </div>

                    {batteryVariantRdResult.structuralWarning && (
                      <div className="p-2 rounded bg-red-950/50 border border-red-900/60 text-red-300 text-[11px]">
                        ⚠️ {batteryVariantRdResult.structuralWarning}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                      <span className="text-slate-400">Costo R&D Pieno:</span>
                      <span className="line-through text-slate-500">
                        ${(batteryVariantRdResult.baseDevelopmentCost.capitalCost / 1_000_000).toFixed(2)}M • {batteryVariantRdResult.baseDevelopmentCost.rdCost} R&D
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-400 font-semibold">Costo Variante per Differenza:</span>
                      <span className="font-bold text-emerald-300">
                        ${(batteryVariantRdResult.effectiveDevelopmentCost.capitalCost / 1_000_000).toFixed(2)}M • {batteryVariantRdResult.effectiveDevelopmentCost.rdCost} R&D
                      </span>
                    </div>

                    {batteryVariantRdResult.detectedChanges.length > 0 && (
                      <div className="pt-1.5 border-t border-slate-800/80 space-y-1">
                        <div className="text-[10px] uppercase text-slate-400">
                          Modifiche Rilevate ({batteryVariantRdResult.detectedChanges.length}):
                        </div>
                        <div className="max-h-24 overflow-y-auto space-y-0.5 pr-1 text-[10px]">
                          {batteryVariantRdResult.detectedChanges.map((ch, idx) => (
                            <div key={idx} className="flex items-center justify-between text-slate-300">
                              <span>• {ch.label}</span>
                              <span className="text-amber-400 font-semibold">+{ch.rdPercentage}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveBattery}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-2 cursor-pointer transition shadow-md shadow-emerald-500/10"
                  >
                    <Save className="w-4 h-4" />
                    <span>
                      {batteryVariantRdResult ? 'Salva Variante Batteria' : 'Salva Pacco Batteria'} (-$
                      {(
                        (batteryVariantRdResult
                          ? batteryVariantRdResult.effectiveDevelopmentCost.capitalCost
                          : batteryPack.developmentCost.capitalCost) / 1_000_000
                      ).toFixed(2)}
                      M / -
                      {batteryVariantRdResult
                        ? batteryVariantRdResult.effectiveDevelopmentCost.rdCost
                        : batteryPack.developmentCost.rdCost}{' '}
                      R&D)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSubPanel('bench')}
                    className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-emerald-500/50 text-emerald-300 font-mono text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Invia al Banco Prova</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Pacchi batteria salvati */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2 font-mono text-[11px]">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Pacchi Batteria Salvati nella Libreria ({savedBatteryPacks.length}):
                  </div>
                  {savedBatteryPacks.length === 0 ? (
                    <div className="text-slate-500 text-[10px]">
                      Nessun pacco batteria ancora salvato. Salva questa configurazione per renderla disponibile in tutti i progetti.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {savedBatteryPacks.map((b) => (
                        <div
                          key={b.id}
                          className="p-2.5 rounded-lg border border-slate-800 bg-slate-950 flex flex-col justify-between gap-1.5"
                        >
                          <div>
                            <div className="font-bold text-slate-200">{b.name} ({b.codeName})</div>
                            <div className="text-[10px] text-emerald-300">
                              {b.spec.batteryCapacityKwh} kWh {b.spec.batteryChemistry} • {b.maxDischargePowerKw} kW • {b.weightKg} kg • ${b.unitProductionCost.toLocaleString('it-IT')}
                            </div>
                            {b.isVariant && (
                              <div className="text-[10px] text-amber-400 font-semibold mt-0.5">
                                ↳ Variante da {b.parentBatteryName || 'Progetto Base'} (-{b.variantRdSavingsPercent ?? 0}% R&D)
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                            <button
                              type="button"
                              onClick={() => {
                                loadBatteryToBench(b);
                                setActiveSubPanel('bench');
                              }}
                              className="flex-1 px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-[10px] font-bold text-center cursor-pointer"
                            >
                              Monta al Banco →
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                startVariant({
                                  type: 'batteryPack',
                                  id: b.id,
                                  name: b.name,
                                  codeName: b.codeName,
                                  entity: b,
                                });
                                loadBatteryToBench(b);
                                setBatteryLibName(`${b.name} Evo`);
                                setBatteryLibCode(`${b.codeName}-EVO`);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold cursor-pointer"
                            >
                              Crea Variante
                            </button>
                            <button
                              type="button"
                              onClick={() => loadBatteryToBench(b)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                            >
                              Modifica
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* =============================================================== */}
          {/* PANNELLO 3: SIMULATORE POWERTRAIN AL BANCO PROVA                 */}
          {/* =============================================================== */}
          {activeSubPanel === 'bench' && (
            <div className="space-y-6">
              {/* Barra di Stato Componenti Montati al Banco */}
              <section className="rounded-xl border border-amber-500/50 bg-amber-950/20 p-4 space-y-3 font-mono text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-800/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-amber-400" />
                    <span className="font-bold uppercase tracking-wider text-amber-200">
                      Componenti Attivi al Banco Prova
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-300 font-semibold">
                    Banco: {telemetry.specs.motorCount}× motori
                    {telemetry.specs.hasMechanicalAwdShaft ? ' + albero AWD (0.92×)' : ` (${telemetry.specs.motorCount}.0×)`}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase">Motore Elettrico Attivo:</div>
                      <div className="font-bold text-sky-300">
                        {motorSpec.name} ({unitMotor.peakPowerHp} CV / {unitMotor.peakTorqueNm} Nm)
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {config.statorDiameterMm}mm × {config.rotorLengthMm}mm • {config.voltageArchitecture}V • ${unitMotor.unitProductionCost.toLocaleString('it-IT')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSubPanel('motor')}
                      className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 text-[10px] font-bold cursor-pointer shrink-0"
                    >
                      Modifica Motore
                    </button>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase">Pacco Batteria Attivo:</div>
                      <div className="font-bold text-emerald-300">
                        {config.batteryCapacityKwh} kWh {batterySpec.name} ({batteryPack.maxDischargePowerKw} kW)
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {batteryPack.weightKg} kg • ${batteryPack.unitProductionCost.toLocaleString('it-IT')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSubPanel('battery')}
                      className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-[10px] font-bold cursor-pointer shrink-0"
                    >
                      Modifica Batteria
                    </button>
                  </div>
                </div>
              </section>

              {/* 1. Architettura Powertrain (BEV / MHEV / HEV / PHEV / EREV) */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-sky-400" />
                    <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                      1. Modalità Sistema Powertrain
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

              {/* 2. Selettore Motore Termico / Wankel Accoppiato (Se Ibrido) */}
              {systemSpec.hasIceEngine && (
                <section className="rounded-xl border-2 border-amber-500/60 bg-amber-950/20 p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-amber-200">
                        2. Motore Termico / Wankel Accoppiato al Sistema Ibrido
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="text-amber-300 font-semibold">
                        {selectedCoupledIce.name} ({selectedCoupledIce.peakPowerHp} CV /{' '}
                        {selectedCoupledIce.peakTorqueNm} Nm)
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                          selectedCoupledIce.intendedOrientation === 'Trasversale'
                            ? 'bg-sky-950/80 border-sky-600 text-sky-300'
                            : 'bg-amber-950/80 border-amber-600 text-amber-300'
                        }`}
                      >
                        {selectedCoupledIce.intendedOrientation}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 font-mono text-xs">
                    {availableCoupledIceEngines.map((ice) => {
                      const isSelected = config.coupledIceOptionId === ice.id;
                      return (
                        <button
                          key={ice.id}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, coupledIceOptionId: ice.id }))}
                          className={`p-3 rounded-lg border text-left cursor-pointer transition flex flex-col justify-between ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-500 text-amber-100 shadow-md shadow-amber-500/10'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-xs truncate text-slate-100">{ice.name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded border font-mono font-semibold ${
                                  ice.intendedOrientation === 'Trasversale'
                                    ? 'bg-sky-950/80 border-sky-600 text-sky-300'
                                    : 'bg-amber-950/80 border-amber-600 text-amber-300'
                                }`}
                              >
                                {ice.intendedOrientation}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                                {ice.sourceKind === 'LivePiston1A'
                                  ? 'LIVE 1A'
                                  : ice.sourceKind === 'LiveWankel1B'
                                    ? 'LIVE 1B'
                                    : ice.sourceKind === 'SavedDatabase'
                                      ? 'DATABASE'
                                      : 'STOCK'}
                              </span>
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">{ice.architectureLabel}</div>
                          <div className="mt-2.5 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-bold">
                            <span className="text-amber-400">{ice.peakPowerHp} CV</span>
                            <span className="text-sky-300">{ice.peakTorqueNm} Nm</span>
                            <span className="text-slate-400">{ice.dryWeightKg} kg</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 3. Configurazione Assi & Scala Lineare (1.0x, 0.92x, 2.0x, 3.0x, 4.0x) */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-sky-400" />
                    <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                      3. Configurazione Assi & Scala Multi-Motore (1×, 2×, 3×, 4×)
                    </h2>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                    Scala Lineare Banco: {layoutSpec.totalOutputMultiplier}×
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {BENCH_MOTOR_SCALING_CONFIGS.map((lay) => {
                    const isSelected = config.motorLayout === lay.layoutId;
                    const effectivePenaltyPct =
                      lay.motorCount > 1 && (isAsm || config.hasFrontDisconnect)
                        ? '+2.0% consumo (Low-Drag)'
                        : lay.consumptionPenaltyMultiplier === 1.0
                          ? 'Rif. Ottimale (0% pen.)'
                          : `+${((lay.consumptionPenaltyMultiplier - 1) * 100).toFixed(1)}% consumo`;

                    return (
                      <button
                        key={lay.layoutId}
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            motorLayout: lay.layoutId,
                            motorCount: lay.motorCount,
                          }))
                        }
                        className={`p-3 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-sky-950/60 border-sky-500 text-sky-100 ring-1 ring-sky-500/50 shadow-md shadow-sky-500/10'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-bold text-xs">{lay.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 shrink-0">
                            {lay.multiplierLabel}
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

                {/* 4. Logica Sgancio Asse Secondario (Punto 4) */}
                {showDisconnectControl && (
                  <div className="pt-2 border-t border-slate-800/80">
                    {isAsm ? (
                      <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-600/40 bg-emerald-950/30 font-mono text-xs text-emerald-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <span className="font-bold">⚡ Spegnimento Elettronico Asse Integrato (ASM a Induzione):</span>
                          <p className="text-[10px] text-slate-300 mt-0.5">
                            Il rotore a gabbia di scoiattolo non possiede magneti permanenti: a vuoto non genera alcun freno magnetico o resistenza di trascinamento. Spegnimento elettronico a <strong>costo $0</strong>, <strong>peso +0 kg</strong> e consumi ridotti di serie.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <label className="flex items-center justify-between gap-3 p-3 rounded-lg border border-amber-600/40 bg-amber-950/20 font-mono text-xs cursor-pointer hover:border-amber-500 transition">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={Boolean(config.hasFrontDisconnect)}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                hasFrontDisconnect: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          />
                          <div>
                            <span className="font-bold text-amber-200">
                              Unità di Sgancio Meccanico Asse Secondario (Dog-Clutch Disconnect)
                            </span>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Scollega fisicamente il rotore a magneti permanenti ad alta velocità: elimina il freno magnetico di trascinamento.
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-emerald-400 font-bold block text-xs">-7% Consumi</span>
                          <span className="text-slate-400 text-[10px]">+$350 • +4.5 kg</span>
                        </div>
                      </label>
                    )}
                  </div>
                )}
              </section>

              {/* 5. Riduttore, Cambio e Rapporto al Ponte */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-sky-400" />
                    <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                      4. Riduttore & Trasmissione Elettrica
                    </h2>
                  </div>
                  <span className="text-[11px] font-mono text-sky-300">
                    Rapporto: {config.gearRatio}:1
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, gearboxType: 'SingleSpeedDirect' }))}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition ${
                      config.gearboxType === 'SingleSpeedDirect'
                        ? 'bg-sky-950/60 border-sky-500 text-sky-100'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold">Rapporto Fisso Diretto (Single Speed)</div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Standard industriale BEV: massima semplicità meccanica, peso ridotto, zero perdite di cambiata.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, gearboxType: 'TwoSpeedDualClutch' }))}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition ${
                      config.gearboxType === 'TwoSpeedDualClutch'
                        ? 'bg-amber-950/60 border-amber-500 text-amber-100'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold">Cambio Elettrico a 2 Rapporti (Doppia Frizione)</div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      1ª corta per scatto 0-100 fulmineo, 2ª lunga per velocità di punta e consumi autostradali (+18 kg, +$420).
                    </p>
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-300 font-semibold">Rapporto Finale al Ponte (Gear Ratio):</span>
                    <span className="text-sky-400 font-bold">{config.gearRatio.toFixed(1)}:1</span>
                  </div>
                  <input
                    type="range"
                    min={5.5}
                    max={13.5}
                    step={0.1}
                    value={config.gearRatio}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        gearRatio: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>5.5:1 (Allungo 350+ km/h)</span>
                    <span>9.0:1 (Bilanciato)</span>
                    <span>13.5:1 (Accelerazione Spinta)</span>
                  </div>
                </div>
              </section>

              {/* 6. Assegnazione Marchio, Costi & Omologazione Powertrain Completo */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Save className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                      5. Omologazione Powertrain Completo nel Database
                    </h2>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Gruppo Propulsore per Pianali
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

                {/* Riepilogo Costi Unitari & Omologazione */}
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
                      Costo Produzione Powertrain:
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
          )}
        </div>

        {/* ================================================================= */}
        {/* COLONNA DESTRA: BANCO PROVA 2D, TELEMETRIA & CAD 3D (5 Colonne)   */}
        {/* ================================================================= */}
        <div className="lg:col-span-5 space-y-6">
          {/* BANCO PROVA GRAFICO 2D */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                  {activeSubPanel === 'motor'
                    ? 'Banco Prova Singola Unità (1.0×)'
                    : activeSubPanel === 'battery'
                      ? 'Diagnostica Scarica Batteria'
                      : 'Banco Prova Powertrain Completo'}
                </h3>
              </div>
              <span className="text-xs font-mono text-sky-300 font-bold">
                {activeSubPanel === 'motor'
                  ? `${unitMotor.peakPowerHp} CV • ${unitMotor.peakTorqueNm} Nm`
                  : activeSubPanel === 'battery'
                    ? `${batteryPack.maxDischargePowerKw} kW • ${batteryPack.batteryCapacityKwh} kWh`
                    : `${telemetry.peakPowerHp} CV • ${telemetry.peakTorqueNm} Nm`}
              </span>
            </div>

            {activeSubPanel === 'motor' ? (
              <EvHybridDynoCanvas2D
                curve={unitMotor.curve}
                redlineRpm={unitMotor.maxMotorRpm}
                cornerSpeedRpm={unitMotor.cornerSpeedRpm}
                systemType="PureEV"
                engineName={motorLibName}
                architectureBadge={`Singolo ${unitMotor.spec.electricMotorType} (1.0×)`}
              />
            ) : activeSubPanel === 'battery' ? (
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
                <div className="text-emerald-400 font-bold flex items-center justify-between border-b border-slate-800 pb-2">
                  <span>Pacco Accumulatori {batteryPack.spec.batteryChemistry}</span>
                  <span>{batteryPack.usableCapacityKwh} kWh Utili / {config.batteryCapacityKwh} kWh Totali</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Scarica Massima:</span>
                    <span className="text-emerald-300 font-bold text-sm">
                      {batteryPack.maxDischargePowerKw} kW ({batteryPack.maxDischargePowerHp} CV)
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">C-Rate Picco:</span>
                    <span className="text-amber-300 font-bold text-sm">{batteryPack.peakDischargeCRate}C</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Durata Cicli SoH:</span>
                    <span className="text-sky-300 font-bold text-sm">{batteryPack.cycleLife} cicli</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Durata Stimata km:</span>
                    <span className="text-slate-100 font-bold text-sm">{(batteryPack.estimatedLifespanKm / 1000).toFixed(0)}k km</span>
                  </div>
                </div>
              </div>
            ) : (
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
            )}
          </section>

          {/* TELEMETRIA SINTETICA DETTAGLIATA */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 font-mono text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>
                  {activeSubPanel === 'motor'
                    ? 'Telemetria Singola Unità Motrice'
                    : activeSubPanel === 'battery'
                      ? 'Specifiche Pacco Batteria'
                      : 'Telemetria Powertrain Completo'}
                </span>
              </span>
              <span className="text-[10px] text-amber-300">{tierSpec.inverterShort}</span>
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">
                  {activeSubPanel === 'motor' ? 'Potenza Unità (1.0×):' : 'Potenza Totale:'}
                </div>
                <div className="text-amber-300 font-bold text-sm">
                  {activeSubPanel === 'motor'
                    ? `${unitMotor.peakPowerHp} CV (${unitMotor.peakPowerKw} kW)`
                    : `${telemetry.peakPowerHp} CV (${Math.round(telemetry.peakPowerHp * 0.7355)} kW)`}
                </div>
                <div className="text-[10px] text-slate-400">
                  {activeSubPanel === 'motor'
                    ? `Cont. ${unitMotor.continuousPowerKw} kW`
                    : `E-Motor: ${telemetry.specs.peakElectricPowerHp} CV`}
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">
                  {activeSubPanel === 'motor' ? 'Coppia Unità da 0 RPM:' : 'Coppia Totale:'}
                </div>
                <div className="text-sky-300 font-bold text-sm">
                  {activeSubPanel === 'motor' ? `${unitMotor.peakTorqueNm} Nm` : `${telemetry.peakTorqueNm} Nm`}
                </div>
                <div className="text-[10px] text-slate-400">
                  FW @ {activeSubPanel === 'motor' ? unitMotor.cornerSpeedRpm : telemetry.specs.cornerSpeedRpm} RPM
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Peso Totale:</div>
                <div className="text-slate-100 font-bold text-sm">
                  {activeSubPanel === 'motor'
                    ? `${unitMotor.wetWeightKg} kg (Secco: ${unitMotor.dryWeightKg} kg)`
                    : activeSubPanel === 'battery'
                      ? `${batteryPack.weightKg} kg (Pacco)`
                      : `${telemetry.wetWeightKg} kg (Secco: ${telemetry.dryWeightKg} kg)`}
                </div>
                <div className="text-[10px] text-slate-400">
                  {activeSubPanel === 'motor'
                    ? `Fluidi: +${(unitMotor.wetWeightKg - unitMotor.dryWeightKg).toFixed(1)} kg (${config.coolingSystem === 'Air' ? 'olio riduttore' : 'olio + camicia'})`
                    : activeSubPanel === 'battery'
                      ? `${batterySpec.cellDensityWhPerKg} Wh/kg cella`
                      : `Batt: ${telemetry.specs.batteryWeightKg} kg • Mot: ${telemetry.specs.motorWeightKg} kg`}
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Efficienza / Consumo:</div>
                <div className="text-emerald-300 font-bold text-sm">
                  {activeSubPanel === 'motor'
                    ? `${unitMotor.efficiencyPercent}%`
                    : `${telemetry.thermalEfficiencyPercent}% • ${telemetry.specs.efficiencyKwhPer100Km} kWh/100km`}
                </div>
                <div className="text-[10px] text-slate-400">
                  {activeSubPanel === 'motor'
                    ? `Inverter ${unitMotor.inverterEfficiencyPercent}%`
                    : `Autonomia EV: ${telemetry.specs.estimatedRangeKm} km`}
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Affidabilità Dinamica:</div>
                <div
                  className={`font-bold text-sm ${
                    (activeSubPanel === 'motor' ? unitMotor.reliabilityPercent : telemetry.reliabilityPercent) >= 82
                      ? 'text-emerald-400'
                      : (activeSubPanel === 'motor' ? unitMotor.reliabilityPercent : telemetry.reliabilityPercent) >= 70
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }`}
                >
                  {activeSubPanel === 'motor' ? unitMotor.reliabilityPercent : telemetry.reliabilityPercent}%
                </div>
                <div className="text-[10px] text-slate-400">
                  Raffr. {config.coolingSystem}
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Durata Stimata Reale:</div>
                <div className="text-sky-300 font-bold text-sm">
                  {activeSubPanel === 'motor'
                    ? `${(unitMotor.estimatedLifespanKm / 1000).toFixed(0)}k km`
                    : `${telemetry.estimatedLifespanKm.toLocaleString('it-IT')} km`}
                </div>
                <div className="text-[10px] text-slate-400">
                  Classe {config.referenceClass}
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Costo Unitario Produzione:</div>
                <div className="text-amber-300 font-bold text-sm">
                  ${activeSubPanel === 'motor'
                    ? unitMotor.unitProductionCost.toLocaleString('it-IT')
                    : activeSubPanel === 'battery'
                      ? batteryPack.unitProductionCost.toLocaleString('it-IT')
                      : telemetry.unitProductionCost.toLocaleString('it-IT')}
                </div>
                <div className="text-[10px] text-slate-400">
                  {activeSubPanel === 'motor'
                    ? 'Hardware + Inverter'
                    : activeSubPanel === 'battery'
                      ? `Celle + BMS ($${batteryPack.costPerKwh}/kWh)`
                      : `Batt. $${costs.batteryCost.toLocaleString('it-IT')} + Mot. $${costs.motorSystemCost.toLocaleString('it-IT')}`}
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Emissioni CO2:</div>
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
            </div>
          </section>

          {/* VISUALIZZATORE CAD 3D E COLLISIONE VANO MOTORE (ADATTIVO AI 3 PANNELLI) */}
          {activeSubPanel === 'motor' ? (
            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Box className="w-4 h-4 text-sky-400" />
                  <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                    CAD 3D Singola Unità Macchina Elettrica (1.0×)
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-sky-300 font-semibold">
                  {unitMotor.dimensionsMm.lengthMm}×{unitMotor.dimensionsMm.widthMm}×{unitMotor.dimensionsMm.heightMm} mm
                </span>
              </div>

              <VolumeViewer3D
                engineInBayDimensionsMm={unitMotor.dimensionsMm}
                rawEngineDimensionsMm={unitMotor.dimensionsMm}
                electricConfig={{
                  ...config,
                  systemType: 'PureEV',
                  motorCount: 1,
                }}
                engineType="ElectricHybrid"
                overlaidChassisBays={[]}
              />

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs space-y-1.5 text-slate-300">
                <div className="text-[11px] text-sky-400 font-bold uppercase tracking-wider">
                  Specifiche Involucro Macchina Indipendente (Universale)
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Diametro Esterno Totale:</span>
                  <span className="font-semibold text-slate-200">{unitMotor.dimensionsMm.widthMm} mm (Statore Ø{config.statorDiameterMm} mm)</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Lunghezza Assiale Totale:</span>
                  <span className="font-semibold text-slate-200">{unitMotor.dimensionsMm.lengthMm} mm (Rotore {config.rotorLengthMm} mm)</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Volume Inviluppo Cilindrico:</span>
                  <span className="font-semibold text-amber-300">{(unitMotor.statorVolumeCc / 1000).toFixed(2)} Litri</span>
                </div>
                <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-800/80">
                  * Unità autonoma priva di vincoli di asse o vano motore: nessun selettore trasversale/longitudinale o anteriore/posteriore. L'orientamento e l'alloggiamento nel telaio si simulano nel Pannello 3 (Banco Prova).
                </div>
              </div>
            </section>
          ) : activeSubPanel === 'battery' ? (
            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Box className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                    Ingombro Strutturale Pacco Batteria
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-emerald-300 font-semibold">
                  {batteryPack.dimensionsMm.lengthMm}×{batteryPack.dimensionsMm.widthMm}×{batteryPack.dimensionsMm.heightMm} mm
                </span>
              </div>

              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs space-y-3">
                <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-slate-800 pb-2">
                  <span>Alloggiamento Pianale Skateboard / Tunnel</span>
                  <span>{batteryPack.weightKg} kg</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-center">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Lunghezza:</span>
                    <span className="font-bold text-slate-200">{batteryPack.dimensionsMm.lengthMm} mm</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Larghezza:</span>
                    <span className="font-bold text-slate-200">{batteryPack.dimensionsMm.widthMm} mm</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Spessore/H:</span>
                    <span className="font-bold text-slate-200">{batteryPack.dimensionsMm.heightMm} mm</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Il pacco accumulatori è integrato come elemento strutturale nel pianale dell'autotelaio (Skateboard Floorpan o tunnel centrale). Non occupa il vano motore anteriore/posteriore e non è soggetto a vincoli di orientamento trasversale/longitudinale del gruppo propulsore.
                </p>
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Box className="w-4 h-4 text-sky-400" />
                  <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                    {config.systemType === 'PureEV'
                      ? 'CAD 3D & Ingombro Powertrain BEV'
                      : 'CAD 3D & Ingombro Powertrain Ibrido'}
                  </h3>
                </div>
                {config.systemType === 'PureEV' ? (
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded">
                    <span>Powertrain BEV E-AWD (Zero Vincoli Albero)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-[11px] text-slate-400">Orientamento Termico:</span>
                    <span
                      className={`px-2.5 py-0.5 rounded border font-bold text-xs ${
                        effectiveOrientation === 'Trasversale'
                          ? 'bg-sky-950 border-sky-500 text-sky-300'
                          : 'bg-amber-950 border-amber-500 text-amber-300'
                      }`}
                    >
                      {effectiveOrientation}
                    </span>
                  </div>
                )}
              </div>

              <VolumeViewer3D
                engineInBayDimensionsMm={geometry.engineBayDimensionsMm}
                rawEngineDimensionsMm={geometry.rawDimensionsMm ?? geometry.engineBayDimensionsMm}
                electricConfig={effectiveConfig}
                intendedOrientation={effectiveOrientation}
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
                    Ingombro: {geometry.engineBayDimensionsMm.lengthMm}×
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
          )}
        </div>
      </div>
    </div>
  );
};
