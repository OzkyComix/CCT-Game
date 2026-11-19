import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Coins,
  FlaskConical,
  Gauge,
  Layers,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Wind,
} from 'lucide-react';
import {
  ACTIVE_AERO_OPTIONS,
  AIRBAG_PACKAGES,
  BODY_MATERIALS,
  BODY_STYLES,
  FRONT_AERO_OPTIONS,
  REAR_AERO_OPTIONS,
  UNDERBODY_AERO_OPTIONS,
} from '../../data/bodyAeroData';
import { calculateBodyAeroMetrics } from '../../math/bodyAeroMath';
import {
  getIncrementalBodyAeroCost,
  useGameStore,
  validateBodyAeroSave,
} from '../../store/useGameStore';
import type {
  ActiveAeroType,
  AirbagPackageId,
  BodyAeroConfig,
  BodyMaterialId,
  BodyStyle,
  FrontAeroType,
  RearAeroType,
  UnderbodyAeroType,
} from '../../types/gameTypes';
import { type AeroTunnelMode, WindTunnelCanvas } from './WindTunnelCanvas';

interface BodyAeroDesigner22Props {
  selectedBodyAeroId?: string | null;
  onClearSelectedBodyAero?: () => void;
  onNavigateToChassis21?: () => void;
}

function suggestBodyStyleForSegment(segment: string): BodyStyle {
  if (segment === 'S') return 'Coupé Sportivo';
  if (segment === 'J_SUV') return 'SUV';
  if (segment === 'M_Pickup') return 'Pickup';
  if (segment === 'A' || segment === 'B') return 'Hatchback';
  return 'Berlina';
}

export const BodyAeroDesigner22: React.FC<BodyAeroDesigner22Props> = ({
  selectedBodyAeroId,
  onClearSelectedBodyAero,
  onNavigateToChassis21,
}) => {
  const {
    currentYear,
    resources,
    chassisList,
    bodyAeroList,
    addBodyAero,
    updateBodyAero,
    deleteBodyAero,
  } = useGameStore();

  const defaultChassis = chassisList[0];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tunnelMode, setTunnelMode] = useState<AeroTunnelMode>('high-downforce');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);

  const [config, setConfig] = useState<BodyAeroConfig>(() => ({
    id: `body-${Date.now()}`,
    name: defaultChassis ? `Scocca ${defaultChassis.codeName}` : 'Nuova Scocca Aero',
    chassisId: defaultChassis?.id ?? '',
    year: currentYear,
    bodyStyle: defaultChassis
      ? suggestBodyStyleForSegment(defaultChassis.calculatedSegment)
      : 'Berlina',
    bodyMaterialId:
      currentYear >= 2008
        ? 'mat-alu-composite'
        : currentYear >= 1994
          ? 'mat-galvanized-hss'
          : 'mat-steel',
    aeroRefinementPercent: 60,
    coolingAperturePercent: 35,
    passiveSafetyReinforcementPercent: 65,
    airbagPackageId:
      currentYear >= 2014
        ? 'airbag-ten-precrash'
        : currentYear >= 1998
          ? 'airbag-six-curtain'
          : currentYear >= 1990
            ? 'airbag-dual-front'
            : currentYear >= 1981
              ? 'airbag-driver'
              : 'airbag-none',
    frontAero: { type: 'none', angleDeg: 0 },
    rearAero: { type: 'none', angleDeg: 0 },
    underbodyType: currentYear >= 2002 ? 'road-faired' : 'exposed',
    activeAeroType: 'none',
  }));

  useEffect(() => {
    if (!selectedBodyAeroId) return;
    const found = bodyAeroList.find((item) => item.id === selectedBodyAeroId);
    if (found) {
      setEditingId(found.id);
      setConfig({ ...found.config });
      setFeedbackBanner({
        type: 'ok',
        msg: `Scocca "${found.name}" caricata in modifica.`,
      });
    }
  }, [selectedBodyAeroId, bodyAeroList]);

  useEffect(() => {
    if (chassisList.length > 0 && !chassisList.some((c) => c.id === config.chassisId)) {
      setConfig((prev) => ({
        ...prev,
        chassisId: chassisList[0].id,
      }));
    }
  }, [chassisList, config.chassisId]);

  const selectedChassis = useMemo(
    () => chassisList.find((c) => c.id === config.chassisId) ?? chassisList[0],
    [chassisList, config.chassisId],
  );

  const metrics = useMemo(() => {
    if (!selectedChassis) return null;
    return calculateBodyAeroMetrics(config, selectedChassis);
  }, [config, selectedChassis]);

  const editingItem = useMemo(
    () => (editingId ? bodyAeroList.find((item) => item.id === editingId) : undefined),
    [editingId, bodyAeroList],
  );

  const existingPaid = useMemo(
    () =>
      editingItem
        ? {
            paidCapitalCost:
              editingItem.paidCapitalCost ?? editingItem.metrics.developmentCost.capitalCost,
            paidRdCost: editingItem.paidRdCost ?? editingItem.metrics.developmentCost.rdCost,
          }
        : undefined,
    [editingItem],
  );

  const requiredCost = useMemo(() => {
    if (!metrics) return { capitalCost: 0, rdCost: 0, minYear: 1950 };
    return getIncrementalBodyAeroCost(metrics.developmentCost, existingPaid);
  }, [metrics, existingPaid]);

  const saveValidation = useMemo(() => {
    if (!metrics) return { ok: false, reasons: ['Nessun pianale selezionato.'] };
    return validateBodyAeroSave(
      config,
      metrics,
      {
        currentYear,
        resources,
        chassisList,
      },
      existingPaid,
    );
  }, [config, metrics, currentYear, resources, chassisList, existingPaid]);

  if (!selectedChassis || !metrics) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-8 text-center space-y-4">
        <Layers className="w-10 h-10 text-indigo-400 mx-auto" />
        <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wider font-mono">
          Nessun Pianale Base Disponibile
        </h2>
        <p className="text-sm text-slate-400 max-w-lg mx-auto">
          Per progettare Carrozzeria, Sicurezza Passiva e Aerodinamica (Fase 2.2) devi prima creare o omologare un pianale base nella Fase 2.1.
        </p>
        {onNavigateToChassis21 && (
          <button
            type="button"
            onClick={onNavigateToChassis21}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
          >
            <span>Vai a Fase 2.1: Pianali</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  const minRequiredYear = metrics.developmentCost.minYear ?? 1950;
  const isEraValid = currentYear >= minRequiredYear;

  const handleSaveNew = () => {
    if (!saveValidation.ok) {
      setFeedbackBanner({
        type: 'err',
        msg: saveValidation.reasons.join(' | '),
      });
      return;
    }
    const newId = `body-${Date.now()}`;
    const savedConfig: BodyAeroConfig = { ...config, id: newId };
    const gate = addBodyAero({
      id: newId,
      name: savedConfig.name.trim(),
      chassisId: selectedChassis.id,
      createdYear: savedConfig.year,
      config: savedConfig,
      metrics,
    });
    if (!gate.allowed) {
      setFeedbackBanner({
        type: 'err',
        msg: gate.reason ?? 'Salvataggio bloccato: verifica risorse e anno tecnologia.',
      });
      return;
    }
    setEditingId(newId);
    setConfig(savedConfig);
    setFeedbackBanner({
      type: 'ok',
      msg: `Scocca "${savedConfig.name}" omologata (-$${(metrics.developmentCost.capitalCost / 1_000_000).toFixed(1)}M, -${metrics.developmentCost.rdCost} PTS R&D).`,
    });
  };

  const handleUpdateExisting = () => {
    if (!editingId) return;
    const gate = updateBodyAero(editingId, { ...config, id: editingId }, metrics);
    if (!gate.allowed) {
      setFeedbackBanner({
        type: 'err',
        msg: gate.reason ?? 'Aggiornamento bloccato: verifica risorse e anno tecnologia.',
      });
      return;
    }
    setFeedbackBanner({
      type: 'ok',
      msg: `Scocca "${config.name}" aggiornata (delta incrementale: -$${(requiredCost.capitalCost / 1_000_000).toFixed(2)}M, -${requiredCost.rdCost} PTS R&D).`,
    });
  };

  const handleResetNewDraft = () => {
    setEditingId(null);
    onClearSelectedBodyAero?.();
    setConfig((prev) => ({
      ...prev,
      id: `body-${Date.now()}`,
      name: `Scocca ${selectedChassis.codeName} Nuovo`,
    }));
    setFeedbackBanner(null);
  };

  const isRearStalled = config.rearAero.type !== 'none' && config.rearAero.angleDeg > 20;

  return (
    <div className="space-y-6">
      {/* Header & Selettore Pianale 2.1 + Confronto Saldo vs Costo Sviluppo Doppia Valuta */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
                Fase 2.2 — Scocca, Carrozzeria, Sicurezza Passiva & Aerodinamica
              </h2>
              <p className="text-xs text-slate-400">
                Galleria del vento CFD e crash test accoppiati al pianale 2.1 selezionato.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Barra Costi Sviluppo vs Saldo Disponibile Doppia Valuta */}
            <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs">
              <div className="flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400">Sviluppo:</span>
                <span
                  className={`font-bold ${
                    resources.financialCapital >= metrics.developmentCost.capitalCost
                      ? 'text-emerald-300'
                      : 'text-rose-400'
                  }`}
                >
                  ${(metrics.developmentCost.capitalCost / 1_000_000).toFixed(1)}M
                </span>
                <span className="text-slate-500">
                  (Saldo ${(resources.financialCapital / 1_000_000).toFixed(1)}M)
                </span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-slate-400">R&D:</span>
                <span
                  className={`font-bold ${
                    resources.rdPoints >= metrics.developmentCost.rdCost
                      ? 'text-sky-300'
                      : 'text-rose-400'
                  }`}
                >
                  {metrics.developmentCost.rdCost} PTS
                </span>
                <span className="text-slate-500">
                  (Saldo {resources.rdPoints.toLocaleString('it-IT')} PTS)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="chassis-select-22" className="text-xs font-mono text-slate-400">
                Pianale 2.1:
              </label>
              <select
                id="chassis-select-22"
                value={selectedChassis.id}
                onChange={(e) => {
                  const nextCh = chassisList.find((c) => c.id === e.target.value);
                  setConfig((prev) => ({
                    ...prev,
                    chassisId: e.target.value,
                    bodyStyle: nextCh
                      ? suggestBodyStyleForSegment(nextCh.calculatedSegment)
                      : prev.bodyStyle,
                  }));
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-cyan-300"
              >
                {chassisList.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name} ({ch.codeName} • Seg. {ch.calculatedSegment})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Vincoli Ereditati dal Pianale 2.1 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-800/80 font-mono text-xs">
          <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
            <div className="text-[10px] uppercase text-slate-400">Dimensioni Pianale</div>
            <div className="font-bold text-slate-200">
              {selectedChassis.overallDimensionsMm.lengthMm}×
              {selectedChassis.overallDimensionsMm.widthMm}×
              {selectedChassis.overallDimensionsMm.heightMm} mm
            </div>
          </div>
          <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
            <div className="text-[10px] uppercase text-slate-400">Passo</div>
            <div className="font-bold text-slate-200">{selectedChassis.wheelbaseMm} mm</div>
          </div>
          <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
            <div className="text-[10px] uppercase text-slate-400">Luce a Terra</div>
            <div
              className={`font-bold ${
                selectedChassis.groundClearanceMm > 155 ? 'text-amber-300' : 'text-cyan-300'
              }`}
            >
              {selectedChassis.groundClearanceMm} mm
            </div>
          </div>
          <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
            <div className="text-[10px] uppercase text-slate-400">Cellula BIW (2.1)</div>
            <div className="font-bold text-emerald-300">
              {metrics.safetyBreakdown.chassisCellScore} / 100
            </div>
          </div>
          <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
            <div className="text-[10px] uppercase text-slate-400">Peso Base Pianale</div>
            <div className="font-bold text-slate-200">{selectedChassis.baseWeightKg} kg</div>
          </div>
        </div>
      </section>

      {feedbackBanner && (
        <div
          className={`p-3 rounded-lg border flex items-center justify-between text-xs font-mono ${
            feedbackBanner.type === 'ok'
              ? 'bg-emerald-950/50 border-emerald-700 text-emerald-300'
              : 'bg-rose-950/50 border-rose-700 text-rose-300'
          }`}
        >
          <span className="flex items-center gap-2">
            {feedbackBanner.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            {feedbackBanner.msg}
          </span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Layout Principale: 3 Blocchi Controlli (5/12) + WindTunnelCanvas & Telemetria (7/12) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 space-y-4">
          {/* Blocco 1: Carrozzeria & Materiali */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5 font-mono">
                <Sparkles className="w-3.5 h-3.5" /> 1. Carrozzeria & Materiali
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                Pannelli: <strong className="text-slate-200">{metrics.bodyPanelsWeightKg} kg</strong>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[10px] uppercase text-slate-400 font-mono mb-1">
                  Nome Scocca
                </label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-slate-400 font-mono mb-1">
                  Anno Progetto
                </label>
                <input
                  type="number"
                  min={1950}
                  max={2035}
                  value={config.year}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, year: Number(e.target.value) || 2020 }))
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-amber-300"
                />
              </div>
            </div>

            {/* 8 BodyStyle */}
            <div>
              <label className="block text-[10px] uppercase text-slate-400 font-mono mb-1.5">
                Stile Carrozzeria (8 Formati)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {BODY_STYLES.map((bs) => (
                  <button
                    key={bs.id}
                    type="button"
                    onClick={() => setConfig((p) => ({ ...p, bodyStyle: bs.id }))}
                    className={`px-2 py-1.5 rounded border text-[11px] font-mono transition cursor-pointer ${
                      config.bodyStyle === bs.id
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                    title={bs.description}
                  >
                    {bs.id}
                  </button>
                ))}
              </div>
            </div>

            {/* 6 Materiali Pannelli (layout a 2 righe flex-wrap senza troncamento!) */}
            <div>
              <label className="block text-[10px] uppercase text-slate-400 font-mono mb-1.5">
                Materiale Pannelli Esterni (6 Opzioni)
              </label>
              <div className="space-y-1.5">
                {BODY_MATERIALS.map((mat) => {
                  const lockedByYear = currentYear < mat.minYear;
                  return (
                    <button
                      key={mat.id}
                      type="button"
                      onClick={() =>
                        setConfig((p) => ({ ...p, bodyMaterialId: mat.id as BodyMaterialId }))
                      }
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition cursor-pointer space-y-1 ${
                        config.bodyMaterialId === mat.id
                          ? 'bg-cyan-500/15 border-cyan-400 text-slate-100'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-semibold">{mat.name}</span>
                        <span
                          className={`text-[10px] font-mono ${
                            lockedByYear ? 'text-rose-400 font-bold' : 'text-slate-400'
                          }`}
                        >
                          dal {mat.minYear}
                          {lockedByYear ? ` (Richiede ${mat.minYear})` : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] font-mono text-cyan-300">
                        <span>{Math.round(mat.weightMultiplier * 100)}% massa</span>
                        <span className="text-emerald-300">${mat.unitCost.toLocaleString('it-IT')}</span>
                        <span className="text-sky-300">
                          Sviluppo: ${(mat.devCapitalCost / 1_000_000).toFixed(1)}M + {mat.devRdPoints} R&D
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slider Sviluppo Galleria del Vento & CFD + Prese Raffreddamento */}
            <div className="space-y-3 pt-1">
              <div>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-200 font-semibold">
                    Sviluppo Galleria del Vento & CFD (Affinamento Superfici)
                  </span>
                  <span className="text-cyan-300 font-bold">{config.aeroRefinementPercent}%</span>
                </div>
                <p className="text-[10px] text-slate-400 mb-1">
                  Riduce il Cx base tramite raccordi e CFD: aumenta budget e punti R&D
                </p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={config.aeroRefinementPercent}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      aeroRefinementPercent: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-slate-300">Apertura Prese Raffreddamento</span>
                  <span className="text-amber-300 font-bold">{config.coolingAperturePercent}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={config.coolingAperturePercent}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      coolingAperturePercent: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Blocco 2: Sicurezza Passiva Accoppiata (2.1 + 2.2) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5 font-mono">
                <ShieldCheck className="w-3.5 h-3.5" /> 2. Sicurezza Passiva (2.1 + 2.2)
              </h3>
              <div className="flex items-center gap-2 font-mono">
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold">
                  Crash {metrics.crashTestScore}/100
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center gap-0.5">
                  {metrics.euroNcapStars}
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> NCAP
                </span>
              </div>
            </div>

            {/* 3 Barre Accoppiate di Sicurezza */}
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2 font-mono text-[11px]">
              {[
                {
                  label: 'Cellula Pianale (2.1)',
                  score: metrics.safetyBreakdown.chassisCellScore,
                  color: 'bg-indigo-400',
                },
                {
                  label: 'Rinforzi Scocca (2.2)',
                  score: metrics.safetyBreakdown.bodyPassiveScore,
                  color: 'bg-emerald-400',
                },
                {
                  label: 'Airbag & Pre-Crash (2.2)',
                  score: metrics.safetyBreakdown.airbagRestraintScore,
                  color: 'bg-cyan-400',
                },
              ].map((bar) => (
                <div key={bar.label} className="space-y-0.5">
                  <div className="flex justify-between text-slate-300">
                    <span>{bar.label}</span>
                    <span className="font-bold">{bar.score}/100</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${bar.color} transition-all`}
                      style={{ width: `${bar.score}%` }}
                    />
                  </div>
                </div>
              ))}
              {metrics.safetyBreakdown.bottleneckNote && (
                <div className="pt-1 flex items-start gap-1.5 text-[11px] text-amber-300">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{metrics.safetyBreakdown.bottleneckNote}</span>
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-mono mb-1">
                <span className="text-slate-300">Barre Porte, Montanti & Zone Collasso</span>
                <span className="text-emerald-300 font-bold">
                  {config.passiveSafetyReinforcementPercent}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={config.passiveSafetyReinforcementPercent}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    passiveSafetyReinforcementPercent: Number(e.target.value),
                  }))
                }
                className="w-full accent-emerald-400 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase text-slate-400 font-mono mb-1.5">
                Pacchetto Airbag (5 Opzioni)
              </label>
              <div className="space-y-1.5">
                {AIRBAG_PACKAGES.map((ab) => (
                  <button
                    key={ab.id}
                    type="button"
                    onClick={() =>
                      setConfig((p) => ({ ...p, airbagPackageId: ab.id as AirbagPackageId }))
                    }
                    className={`w-full text-left px-2.5 py-1.5 rounded border text-xs transition cursor-pointer flex flex-wrap items-center justify-between gap-1 ${
                      config.airbagPackageId === ab.id
                        ? 'bg-emerald-500/15 border-emerald-400 text-slate-100'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>
                      {ab.name}{' '}
                      <span className="text-[10px] font-mono text-slate-500">({ab.minYear}+)</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300">
                      +{ab.weightKg}kg • ${ab.unitCost.toLocaleString('it-IT')} • {ab.devRdPoints} R&D
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Blocco 3: Configuratore Aerodinamico (Tipo Fissa vs Attiva prima delle appendici!) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 font-mono">
                <Gauge className="w-3.5 h-3.5" /> 3. Configuratore Aerodinamico
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                L/D: <strong className="text-cyan-300">{metrics.aeroEfficiencyLD.toFixed(2)}</strong>
              </span>
            </div>

            {/* Selettore Primario: Tipo Aerodinamica Fissa vs Attiva */}
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase text-amber-300 font-mono font-bold">
                Tipo Aerodinamica: Fissa (Passiva — $0 / 0 kg) vs Attiva (DRS / Airbrake)
              </label>
              <div className="space-y-1.5">
                {ACTIVE_AERO_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setConfig((p) => ({ ...p, activeAeroType: opt.id as ActiveAeroType }))
                    }
                    className={`w-full text-left px-2.5 py-1.5 rounded border text-xs transition cursor-pointer space-y-0.5 ${
                      config.activeAeroType === opt.id
                        ? 'bg-amber-500/15 border-amber-400 text-slate-100'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-semibold">{opt.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        dal {opt.minYear}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-amber-300">
                      +${opt.unitCost.toLocaleString('it-IT')} • +{opt.weightKg} kg • {opt.devRdPoints} Punti R&D
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Anteriore */}
            <div className="space-y-2 pt-1">
              <label className="block text-[10px] uppercase text-slate-400 font-mono">
                Appendice Anteriore (Front Aero)
              </label>
              <select
                value={config.frontAero.type}
                onChange={(e) => {
                  const nextType = e.target.value as FrontAeroType;
                  setConfig((p) => ({
                    ...p,
                    frontAero: {
                      type: nextType,
                      angleDeg: nextType === 'none' ? 0 : p.frontAero.angleDeg || 4,
                    },
                  }));
                }}
                className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100"
              >
                {FRONT_AERO_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name} ({opt.minYear}+ • +{opt.weightKg}kg • ${opt.unitCost} • {opt.devRdPoints} R&D)
                  </option>
                ))}
              </select>
              {config.frontAero.type !== 'none' && (
                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-slate-300">Incidenza Base / Assetto Curva (°)</span>
                    <span className="text-amber-300 font-bold">{config.frontAero.angleDeg}°</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={18}
                    value={config.frontAero.angleDeg}
                    onChange={(e) =>
                      setConfig((p) => ({
                        ...p,
                        frontAero: { ...p.frontAero, angleDeg: Number(e.target.value) },
                      }))
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Posteriore + Zona Stallo > 20° */}
            <div className="space-y-2 pt-1">
              <label className="block text-[10px] uppercase text-slate-400 font-mono">
                Appendice Posteriore (Rear Aero)
              </label>
              <select
                value={config.rearAero.type}
                onChange={(e) => {
                  const nextType = e.target.value as RearAeroType;
                  setConfig((p) => ({
                    ...p,
                    rearAero: {
                      type: nextType,
                      angleDeg: nextType === 'none' ? 0 : p.rearAero.angleDeg || 8,
                    },
                  }));
                }}
                className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100"
              >
                {REAR_AERO_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name} ({opt.minYear}+ • +{opt.weightKg}kg • ${opt.unitCost} • {opt.devRdPoints} R&D)
                  </option>
                ))}
              </select>
              {config.rearAero.type !== 'none' && (
                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-slate-300">
                      Incidenza Base / Assetto Curva (°){' '}
                      <span className={isRearStalled ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                        (Stallo &gt; 20°)
                      </span>
                    </span>
                    <span
                      className={`font-bold ${
                        isRearStalled ? 'text-rose-400' : 'text-amber-300'
                      }`}
                    >
                      {config.rearAero.angleDeg}°{isRearStalled ? ' STALLO' : ''}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={25}
                    value={config.rearAero.angleDeg}
                    onChange={(e) =>
                      setConfig((p) => ({
                        ...p,
                        rearAero: { ...p.rearAero, angleDeg: Number(e.target.value) },
                      }))
                    }
                    className={`w-full cursor-pointer ${
                      isRearStalled ? 'accent-rose-500' : 'accent-amber-400'
                    }`}
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-0.5">
                    <span>0°</span>
                    <span>10°</span>
                    <span className="text-amber-400">20° Max L/D</span>
                    <span className="text-rose-400">25° Stallo</span>
                  </div>
                </div>
              )}
            </div>

            {/* Fondo & Effetto Suolo */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-[10px] uppercase font-mono">
                <span className="text-slate-400">Fondo & Effetto Suolo</span>
                <span
                  className={`font-bold ${
                    metrics.groundEffectEfficiency >= 0.75
                      ? 'text-cyan-300'
                      : metrics.groundEffectEfficiency >= 0.35
                        ? 'text-amber-300'
                        : 'text-rose-400'
                  }`}
                >
                  Efficienza Suolo: {Math.round(metrics.groundEffectEfficiency * 100)}% (h={selectedChassis.groundClearanceMm}mm)
                </span>
              </div>
              <select
                value={config.underbodyType}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, underbodyType: e.target.value as UnderbodyAeroType }))
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100"
              >
                {UNDERBODY_AERO_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name} ({opt.minYear}+ • +{opt.weightKg}kg • ${opt.unitCost} • {opt.devRdPoints} R&D)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* COLONNA DESTRA (7/12): WindTunnelCanvas + Telemetria + Salvataggio Trasparente */}
        <div className="xl:col-span-7 space-y-4">
          <WindTunnelCanvas
            config={config}
            chassis={selectedChassis}
            metrics={metrics}
            mode={tunnelMode}
            onModeChange={setTunnelMode}
          />

          {/* Avvisi Fisici */}
          {metrics.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3.5 space-y-1.5">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 font-mono">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Avvisi Fisici & Coerenza Aerodinamica ({metrics.warnings.length})
              </div>
              <ul className="space-y-1 text-xs text-amber-200/90 list-disc pl-5">
                {metrics.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Telemetria Live Completa */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                Telemetria Aerodinamica, Pesi & Affidabilità (Fase 2.2)
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                CL Totale HD:{' '}
                <strong className="text-cyan-300">{metrics.clTotalHighDownforce.toFixed(3)}</strong> •
                LD: <strong className="text-emerald-300">{metrics.aeroEfficiencyLD.toFixed(2)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] uppercase text-slate-400">Cx (HD / Low / Brake)</div>
                <div className="text-sm font-bold text-sky-300 mt-0.5">
                  {metrics.cxHighDownforce.toFixed(3)} / {metrics.cxLowDrag.toFixed(3)} /{' '}
                  {metrics.cxAirbrake.toFixed(3)}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] uppercase text-slate-400">Sezione A & SCx</div>
                <div className="text-sm font-bold text-slate-100 mt-0.5">
                  {metrics.frontalAreaM2.toFixed(2)} m² • SCx {metrics.scxHighDownforce.toFixed(3)}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] uppercase text-slate-400">Efficienza L/D & Cool</div>
                <div className="text-sm font-bold text-emerald-300 mt-0.5">
                  L/D {metrics.aeroEfficiencyLD.toFixed(2)} • Cool {metrics.coolingEfficiencyScore}%
                </div>
              </div>

              <div
                className="p-3 rounded-lg bg-slate-950 border border-slate-800"
                title="Valori negativi = portanza aerodinamica: l'auto viene spinta leggermente verso l'alto ad alta velocità"
              >
                <div className="text-[10px] uppercase text-slate-400">
                  {metrics.downforce200Kg.highDownforce < 0
                    ? 'Portanza (Lift) @200 km/h'
                    : 'Downforce @200 km/h'}
                </div>
                <div
                  className={`text-sm font-bold mt-0.5 ${
                    metrics.downforce200Kg.highDownforce < 0 ? 'text-rose-400' : 'text-cyan-300'
                  }`}
                >
                  {metrics.downforce200Kg.highDownforce} kg
                  {metrics.downforce200Kg.highDownforce < 0 ? ' · Portanza (Lift)' : ''}
                </div>
                <div className="text-[10px] text-slate-400">
                  Ant {metrics.downforce200Kg.frontKg}
                  {metrics.downforce200Kg.frontKg < 0 ? ' (Lift)' : ''} / Post{' '}
                  {metrics.downforce200Kg.rearKg}
                  {metrics.downforce200Kg.rearKg < 0 ? ' (Lift)' : ''} kg
                </div>
              </div>

              <div
                className="p-3 rounded-lg bg-slate-950 border border-slate-800"
                title="Valori negativi = portanza aerodinamica: l'auto viene spinta leggermente verso l'alto ad alta velocità"
              >
                <div className="text-[10px] uppercase text-slate-400">
                  {metrics.downforce300Kg.highDownforce < 0
                    ? 'Portanza (Lift) @300 km/h'
                    : 'Downforce @300 km/h'}
                </div>
                <div
                  className={`text-sm font-bold mt-0.5 ${
                    metrics.downforce300Kg.highDownforce < 0 ? 'text-rose-400' : 'text-cyan-300'
                  }`}
                >
                  {metrics.downforce300Kg.highDownforce} kg
                  {metrics.downforce300Kg.highDownforce < 0 ? ' · Portanza (Lift)' : ''}
                </div>
                <div className="text-[10px] text-slate-400">
                  Ant {metrics.downforce300Kg.frontKg}
                  {metrics.downforce300Kg.frontKg < 0 ? ' (Lift)' : ''} / Post{' '}
                  {metrics.downforce300Kg.rearKg}
                  {metrics.downforce300Kg.rearKg < 0 ? ' (Lift)' : ''} kg
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] uppercase text-slate-400">Peso Totale Scocca</div>
                <div className="text-sm font-bold text-amber-300 mt-0.5">
                  {metrics.totalBodyAeroWeightKg} kg
                </div>
                <div className="text-[10px] text-slate-400">
                  {metrics.bodyPanelsWeightKg} + {metrics.safetyWeightKg} + {metrics.aeroWeightKg} kg
                </div>
              </div>
            </div>

            {/* Barra Bilanciamento Aerodinamico (gestione sicura aeroRegime === 'lift') */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Bilanciamento Carico Aerodinamico</span>
                {metrics.aeroRegime === 'lift' ? (
                  <span className="font-bold text-rose-400">
                    Regime Portanza (Lift) — Nessun carico netto
                  </span>
                ) : metrics.aeroRegime === 'neutral' ? (
                  <span className="font-bold text-slate-300">
                    Regime Neutro (CL ≈ 0)
                  </span>
                ) : (
                  <span
                    className={`font-bold ${
                      metrics.aeroBalanceFrontPercent > 52 ? 'text-rose-400' : 'text-cyan-300'
                    }`}
                  >
                    Ant {metrics.aeroBalanceFrontPercent.toFixed(1)}% / Post{' '}
                    {metrics.aeroBalanceRearPercent.toFixed(1)}%
                  </span>
                )}
              </div>
              {metrics.aeroRegime === 'downforce' ? (
                <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden flex">
                  <div
                    className={
                      metrics.aeroBalanceFrontPercent > 52 ? 'bg-rose-500' : 'bg-amber-400'
                    }
                    style={{ width: `${metrics.aeroBalanceFrontPercent}%` }}
                  />
                  <div
                    className="bg-cyan-500"
                    style={{ width: `${metrics.aeroBalanceRearPercent}%` }}
                  />
                </div>
              ) : (
                <div className="w-full h-2.5 rounded-full bg-slate-900 border border-rose-900/50" />
              )}
              {(metrics.downforce200Kg.highDownforce < 0 ||
                metrics.downforce200Kg.frontKg < 0 ||
                metrics.downforce200Kg.rearKg < 0) && (
                <div className="text-[10px] text-rose-300/90 pt-0.5">
                  Valori negativi = portanza aerodinamica (Lift): l&apos;auto viene spinta leggermente verso l&apos;alto ad alta velocità.
                </div>
              )}
            </div>

            {/* Costi, Durata Corrosione & Box Doppia Valuta Trasparente */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs pt-1">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] uppercase text-slate-400">Costo Unitario Scocca</div>
                <div className="text-sm font-bold text-emerald-300">
                  ${metrics.unitManufacturingCost.toLocaleString('it-IT')}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] uppercase text-slate-400">Durata Corrosione</div>
                <div className="text-sm font-bold text-slate-200">
                  {metrics.estimatedDurabilityKm.toLocaleString('it-IT')} km
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] uppercase text-slate-400">
                  {editingId ? 'Delta Revisione vs Saldo' : 'Costo Sviluppo vs Saldo'}
                </div>
                <div className="text-[11px] font-bold flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                  <span
                    className={
                      resources.financialCapital >= requiredCost.capitalCost
                        ? 'text-emerald-300'
                        : 'text-rose-400'
                    }
                  >
                    ${(requiredCost.capitalCost / 1_000_000).toFixed(1)}M / $
                    {(resources.financialCapital / 1_000_000).toFixed(1)}M
                  </span>
                  <span className="text-slate-500">•</span>
                  <span
                    className={
                      resources.rdPoints >= requiredCost.rdCost
                        ? 'text-sky-300'
                        : 'text-rose-400'
                    }
                  >
                    {requiredCost.rdCost} / {resources.rdPoints} PTS R&D
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <div className="text-[11px] font-mono text-slate-400">
                Anno min. tecnologia:{' '}
                <strong className={isEraValid ? 'text-emerald-300' : 'text-rose-400'}>
                  {minRequiredYear}
                </strong>{' '}
                (Anno gioco: {currentYear})
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {editingId && (
                  <>
                    <button
                      type="button"
                      onClick={handleResetNewDraft}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider transition cursor-pointer font-mono"
                    >
                      Nuova Scocca
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdateExisting}
                      className="px-4 py-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400 text-sky-200 font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 font-mono"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Aggiorna Scocca</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleSaveNew}
                  className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 font-mono cursor-pointer ${
                    saveValidation.ok
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-slate-800 border border-rose-500/50 text-rose-300 hover:bg-slate-700'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salva Nuova Scocca</span>
                </button>
              </div>
            </div>

            {/* Motivi Blocco Salvataggio Espliciti */}
            {!saveValidation.ok && (
              <div className="rounded-lg border border-rose-500/50 bg-rose-950/35 p-3 space-y-1 font-mono text-xs">
                <div className="font-bold text-rose-300 uppercase text-[11px] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Salvataggio Bloccato:
                </div>
                <ul className="list-disc pl-5 text-rose-200/90 space-y-0.5 text-[11px]">
                  {saveValidation.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Lista Scocche Salvate (2.2) */}
          {bodyAeroList.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                  Scocche & Pacchetti Aero Omologati ({bodyAeroList.length})
                </h3>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      onClearSelectedBodyAero?.();
                    }}
                    className="text-[11px] font-mono text-cyan-400 hover:underline cursor-pointer"
                  >
                    + Nuova Bozza
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {bodyAeroList.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between gap-2 ${
                      editingId === item.id
                        ? 'bg-cyan-500/15 border-cyan-400'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setConfig({ ...item.config });
                      }}
                      className="text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="font-bold text-slate-100 truncate">{item.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {item.config.bodyStyle} • Cx {item.metrics.cxHighDownforce.toFixed(2)} •
                        DF200 {item.metrics.downforce200Kg.highDownforce}kg •{' '}
                        {item.metrics.euroNcapStars}★
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteBodyAero(item.id);
                        if (editingId === item.id) setEditingId(null);
                      }}
                      title="Elimina scocca"
                      className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
