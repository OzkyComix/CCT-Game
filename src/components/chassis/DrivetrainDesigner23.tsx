import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Coins,
  Compass,
  Disc,
  FlaskConical,
  Gauge,
  Layers,
  Save,
  Settings2,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  ABS_MODULE_OPTIONS,
  AWD_SCHEME_OPTIONS,
  BRAKE_CALIPER_OPTIONS,
  BRAKE_DISC_OPTIONS,
  DIFFERENTIAL_OPTIONS,
  DRIVE_MODE_SELECTOR_SPEC,
  ESC_MODULE_OPTIONS,
  GEARBOX_STRENGTH_TIERS,
  STABILITY_DRIVE_MODE_PRESETS,
  STEERING_OPTIONS,
  SUSPENSION_OPTIONS,
  TCS_MODULE_OPTIONS,
  TRANSMISSION_OPTIONS,
} from '../../data/drivetrainData';
import {
  calculateDrivetrainMetrics,
  clampGearRatio,
  extractPowertrainSpecs,
  generateDefaultGearRatios,
} from '../../math/drivetrainMath';
import { evaluateEngineBayCompatibility } from '../../math/volumeMath';
import {
  getIncrementalDrivetrainCost,
  isDrivetrainTuningOnly,
  useGameStore,
  validateDrivetrainSetupSave,
} from '../../store/useGameStore';
import type {
  AbsModuleType,
  AwdScheme23,
  BrakeCaliperType,
  BrakeDiscType,
  ChassisEntity,
  DifferentialType,
  DrivetrainSetupConfig,
  ElectricMotorEntity,
  EngineEntity,
  EscModuleType,
  GearboxStrengthTier,
  StabilityDriveMode,
  SteeringType,
  SuspensionType,
  TcsModuleType,
  TransmissionType,
} from '../../types/gameTypes';
import { GearRatioChart } from './GearRatioChart';

interface DrivetrainDesigner23Props {
  selectedDrivetrainId?: string | null;
  onClearSelectedDrivetrain?: () => void;
  onNavigateToChassis21?: () => void;
  onNavigateToEngines?: () => void;
}

function buildInitialConfig(
  chassis: ChassisEntity | undefined,
  powertrain: EngineEntity | ElectricMotorEntity | undefined,
  currentYear: number,
): DrivetrainSetupConfig {
  const specs = powertrain ? extractPowertrainSpecs(powertrain) : null;
  const isEv = specs?.isEv ?? false;
  const supported = chassis?.supportedDrivetrains ?? ['FWD'];
  const defaultDrivetrain: 'FWD' | 'RWD' | 'AWD' = supported.includes('RWD')
    ? 'RWD'
    : supported.includes('FWD')
      ? 'FWD'
      : 'AWD';
  const orientations = chassis?.supportedEngineOrientations ?? ['Longitudinale'];
  const defaultAwd: AwdScheme23 = orientations.includes('Trasversale')
    ? currentYear >= 2015
      ? 'awd-transverse-perf'
      : 'awd-fwd-haldex'
    : 'awd-longitudinal-perm';

  const transType: TransmissionType = isEv
    ? 'ev-single-speed'
    : currentYear >= 2010
      ? 'dct-wet'
      : currentYear >= 1995
        ? 'manual-h'
        : 'manual-h';
  const gearCount = isEv ? 1 : currentYear >= 2010 ? 7 : currentYear >= 1990 ? 6 : 5;

  return {
    id: `drivetrain-${Date.now()}`,
    name:
      chassis && powertrain
        ? `${chassis.codeName} + ${powertrain.codeName}`
        : 'Nuovo Setup Trasmissione',
    year: currentYear,
    chassisId: chassis?.id ?? '',
    engineId: powertrain?.id ?? '',
    drivetrainType: defaultDrivetrain,
    awdScheme: defaultDrivetrain === 'AWD' ? defaultAwd : null,
    transmissionType: transType,
    gearboxStrengthTier: 'standard',
    gearCount,
    gearRatios: generateDefaultGearRatios(gearCount, transType, 'balanced'),
    finalDriveRatio: isEv ? 9.0 : 3.55,
    staggeredWheels: false,
    rimDiameterInch: 18,
    tireSidewallMm: 100,
    frontRimDiameterInch: 18,
    frontTireSidewallMm: 100,
    rearRimDiameterInch: 18,
    rearTireSidewallMm: 100,
    tireRadiusMm: Math.round((18 * 25.4) / 2 + 100),
    differentialType: currentYear >= 2000 ? 'torsen-helical' : 'open',
    steeringType:
      currentYear >= 2012 ? 'electric-eps' : currentYear >= 1975 ? 'hydraulic-hps' : 'manual-rack',
    rearWheelSteering: false,
    steeringRatio: 14.5,
    progressiveSteering: false,
    speedSensitiveSteering: currentYear >= 1998,
    rwsMaxAngleDeg: 3.0,
    rwsCrossoverSpeedKmh: 60,
    frontSuspension: currentYear >= 1990 ? 'double-wishbone' : 'macpherson',
    rearSuspension: currentYear >= 1995 ? 'multi-link' : 'torsion-beam',
    stabilityControlType:
      currentYear >= 2005 ? 'esc-standard' : currentYear >= 1985 ? 'abs-only' : 'none',
    absType: currentYear >= 1985 ? 'abs-road' : 'none',
    tcsType: currentYear >= 2000 ? 'tcs-standard' : 'none',
    escType: currentYear >= 2005 ? 'esc-standard' : 'none',
    hasDriveModeSelector: currentYear >= 2012,
    stabilityControlThresholdPercent: 60,
    stabilityDriveMode: 'road',
    absSlipThresholdPercent: 80,
    tcsSlipThresholdPercent: 80,
    escYawThresholdPercent: 85,
    frontCaliper: currentYear >= 2000 ? 'fixed-4p' : 'floating-1p',
    frontDiscType: currentYear >= 1980 ? 'vented-iron' : 'solid-iron',
    frontDiscMm: currentYear >= 2005 ? 340 : 280,
    rearCaliper: currentYear >= 2005 ? 'floating-2p' : 'floating-1p',
    rearDiscType: currentYear >= 1995 ? 'vented-iron' : 'solid-iron',
    rearDiscMm: currentYear >= 2005 ? 310 : 260,
  };
}

export const DrivetrainDesigner23: React.FC<DrivetrainDesigner23Props> = ({
  selectedDrivetrainId,
  onClearSelectedDrivetrain,
  onNavigateToChassis21,
  onNavigateToEngines,
}) => {
  const {
    currentYear,
    resources,
    chassisList,
    engines,
    savedElectricMotors,
    drivetrainSetups,
    addDrivetrainSetup,
    updateDrivetrainSetup,
    deleteDrivetrainSetup,
  } = useGameStore();

  const allPowertrains = useMemo<Array<{ id: string; label: string; isEv: boolean; entity: EngineEntity | ElectricMotorEntity }>>(() => {
    const ice = engines.map((e) => {
      const specs = extractPowertrainSpecs(e);
      return {
        id: e.id,
        label: `${e.name} (${e.codeName}) — ${specs.peakPowerHp} CV • ${specs.peakTorqueNm} Nm • ${specs.redlineRpm} rpm`,
        isEv: specs.isEv,
        entity: e,
      };
    });
    const ev = savedElectricMotors.map((m) => {
      const specs = extractPowertrainSpecs(m);
      return {
        id: m.id,
        label: `${m.name} (${m.codeName}) — ${specs.peakPowerHp} CV EV • ${specs.peakTorqueNm} Nm • ${specs.redlineRpm} rpm`,
        isEv: true,
        entity: m,
      };
    });
    return [...ice, ...ev];
  }, [engines, savedElectricMotors]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);

  const [config, setConfig] = useState<DrivetrainSetupConfig>(() =>
    buildInitialConfig(chassisList[0], allPowertrains[0]?.entity, currentYear),
  );

  // Sync selezione pianale/propulsore se inizialmente vuoti o appena aggiunti
  useEffect(() => {
    setConfig((prev) => {
      const nextChassis =
        prev.chassisId && chassisList.some((c) => c.id === prev.chassisId)
          ? prev.chassisId
          : chassisList[0]?.id ?? '';
      const nextEngine =
        prev.engineId && allPowertrains.some((p) => p.id === prev.engineId)
          ? prev.engineId
          : allPowertrains[0]?.id ?? '';
      if (nextChassis === prev.chassisId && nextEngine === prev.engineId) return prev;
      return { ...prev, chassisId: nextChassis, engineId: nextEngine };
    });
  }, [chassisList, allPowertrains]);

  // Carica setup esistente cliccato dalla sidebar
  useEffect(() => {
    if (!selectedDrivetrainId) return;
    const found = drivetrainSetups.find((s) => s.id === selectedDrivetrainId);
    if (found) {
      setEditingId(found.id);
      setConfig({
        ...found.config,
        gearRatios: [...found.config.gearRatios],
      });
      setFeedbackBanner(null);
    }
  }, [selectedDrivetrainId, drivetrainSetups]);

  const selectedChassis = useMemo(
    () => chassisList.find((c) => c.id === config.chassisId) ?? chassisList[0],
    [chassisList, config.chassisId],
  );

  const selectedPowertrainEntry = useMemo(
    () => allPowertrains.find((p) => p.id === config.engineId) ?? allPowertrains[0],
    [allPowertrains, config.engineId],
  );

  const powertrainSpecs = useMemo(
    () =>
      selectedPowertrainEntry
        ? extractPowertrainSpecs(selectedPowertrainEntry.entity)
        : null,
    [selectedPowertrainEntry],
  );

  const metrics = useMemo(() => {
    if (!selectedChassis || !powertrainSpecs) return null;
    return calculateDrivetrainMetrics(config, selectedChassis, powertrainSpecs);
  }, [config, selectedChassis, powertrainSpecs]);

  const activeTransOpt = useMemo(
    () =>
      TRANSMISSION_OPTIONS.find((t) => t.id === config.transmissionType) ??
      TRANSMISSION_OPTIONS[0],
    [config.transmissionType],
  );

  const existingSaved = useMemo(
    () => (editingId ? drivetrainSetups.find((s) => s.id === editingId) : undefined),
    [editingId, drivetrainSetups],
  );

  const existingPaid = useMemo(
    () =>
      existingSaved
        ? {
            paidCapitalCost:
              existingSaved.paidCapitalCost ?? existingSaved.metrics.developmentCost.capitalCost,
            paidRdCost: existingSaved.paidRdCost ?? existingSaved.metrics.developmentCost.rdCost,
          }
        : undefined,
    [existingSaved],
  );

  const isTuningOnly = useMemo(
    () => Boolean(existingSaved && isDrivetrainTuningOnly(config, existingSaved.config)),
    [config, existingSaved],
  );

  const requiredCost = useMemo(() => {
    if (!metrics) return null;
    return getIncrementalDrivetrainCost(
      config,
      metrics.developmentCost,
      existingPaid,
      existingSaved?.config,
    );
  }, [config, metrics, existingPaid, existingSaved]);

  const saveValidation = useMemo(() => {
    if (!metrics) {
      return {
        ok: false,
        reasons: ['Selezionare un Pianale (2.1) e un Propulsore (Fase 1) validi.'],
      };
    }
    return validateDrivetrainSetupSave(
      config,
      metrics,
      {
        currentYear,
        resources,
        chassisList,
        engines,
        savedElectricMotors,
      },
      existingPaid,
      existingSaved?.config,
    );
  }, [
    config,
    metrics,
    currentYear,
    resources,
    chassisList,
    engines,
    savedElectricMotors,
    existingPaid,
    existingSaved,
  ]);

  const handleEngineChange = (newEngineId: string) => {
    const entry = allPowertrains.find((p) => p.id === newEngineId);
    const isEv = entry?.isEv ?? false;
    setConfig((prev) => {
      const currentTrans = TRANSMISSION_OPTIONS.find((t) => t.id === prev.transmissionType);
      const needsSwitch = (isEv && !currentTrans?.isEvOnly) || (!isEv && currentTrans?.isEvOnly);
      if (!needsSwitch) {
        return { ...prev, engineId: newEngineId };
      }
      const nextTrans: TransmissionType = isEv ? 'ev-single-speed' : 'manual-h';
      const nextGears = isEv ? 1 : 6;
      return {
        ...prev,
        engineId: newEngineId,
        transmissionType: nextTrans,
        gearCount: nextGears,
        gearRatios: generateDefaultGearRatios(nextGears, nextTrans, 'balanced'),
        finalDriveRatio: isEv ? 9.0 : 3.55,
      };
    });
  };

  const handleTransmissionChange = (newTransId: TransmissionType) => {
    const opt = TRANSMISSION_OPTIONS.find((t) => t.id === newTransId) ?? TRANSMISSION_OPTIONS[0];
    setConfig((prev) => {
      const clampedGears = Math.max(opt.minGears, Math.min(opt.maxGears, prev.gearCount));
      const nextFinalDrive = opt.isEvOnly
        ? Math.max(5.0, Math.min(12.0, prev.finalDriveRatio < 5 ? 9.0 : prev.finalDriveRatio))
        : Math.max(2.2, Math.min(5.8, prev.finalDriveRatio > 5.8 ? 3.55 : prev.finalDriveRatio));
      return {
        ...prev,
        transmissionType: newTransId,
        gearCount: clampedGears,
        gearRatios: generateDefaultGearRatios(clampedGears, newTransId, 'balanced'),
        finalDriveRatio: nextFinalDrive,
      };
    });
  };

  const handleGearCountChange = (newCount: number) => {
    const clamped = Math.max(
      activeTransOpt.minGears,
      Math.min(activeTransOpt.maxGears, newCount),
    );
    setConfig((prev) => ({
      ...prev,
      gearCount: clamped,
      gearRatios: generateDefaultGearRatios(clamped, prev.transmissionType, 'balanced'),
    }));
  };

  const handleApplyRatioPreset = (profile: 'short' | 'balanced' | 'long') => {
    setConfig((prev) => ({
      ...prev,
      gearRatios: generateDefaultGearRatios(prev.gearCount, prev.transmissionType, profile),
    }));
  };

  const handleSingleGearChange = (index: number, value: number) => {
    setConfig((prev) => ({
      ...prev,
      gearRatios: clampGearRatio(prev.gearRatios, index, value),
    }));
  };

  const handleResetNew = () => {
    setEditingId(null);
    onClearSelectedDrivetrain?.();
    setConfig(
      buildInitialConfig(selectedChassis, selectedPowertrainEntry?.entity, currentYear),
    );
    setFeedbackBanner(null);
  };

  const handleSave = () => {
    if (!metrics) return;
    if (editingId && existingSaved) {
      const res = updateDrivetrainSetup(editingId, config, metrics);
      if (res.allowed) {
        setFeedbackBanner({
          type: 'ok',
          msg: `Setup "${config.name}" aggiornato con successo!`,
        });
      } else {
        setFeedbackBanner({
          type: 'err',
          msg: res.reason ?? 'Aggiornamento bloccato.',
        });
      }
      return;
    }

    const newId = `drivetrain-${Date.now()}`;
    const configToSave = { ...config, id: newId };
    const res = addDrivetrainSetup({
      id: newId,
      name: configToSave.name.trim(),
      chassisId: configToSave.chassisId,
      engineId: configToSave.engineId,
      createdYear: configToSave.year,
      config: configToSave,
      metrics,
    });
    if (res.allowed) {
      setEditingId(newId);
      setConfig(configToSave);
      setFeedbackBanner({
        type: 'ok',
        msg: `Setup "${configToSave.name}" omologato e salvato nel database!`,
      });
    } else {
      setFeedbackBanner({
        type: 'err',
        msg: res.reason ?? 'Salvataggio bloccato.',
      });
    }
  };

  const checkPowertrainBayFit = (
    entity: EngineEntity | ElectricMotorEntity,
    chassis: ChassisEntity | undefined,
  ): { fits: boolean; reason: string | null } => {
    if (!chassis) return { fits: true, reason: null };
    const specs = extractPowertrainSpecs(entity);
    if (specs.isEv) return { fits: true, reason: null };
    const orientations = chassis.supportedEngineOrientations ?? ['Longitudinale'];
    if (specs.nativeOrientation && !orientations.includes(specs.nativeOrientation)) {
      return {
        fits: false,
        reason: `Orientamento nativo ${specs.nativeOrientation} incompatibile (crea variante in Fase 1)`,
      };
    }
    if (!specs.dimensionsMm) return { fits: true, reason: null };
    const targetOri = specs.nativeOrientation ?? orientations[0] ?? 'Longitudinale';
    const check = evaluateEngineBayCompatibility(specs.dimensionsMm, targetOri, chassis, {
      isPureEV: false,
    });
    if (check.isCompatible) return { fits: true, reason: null };
    return {
      fits: false,
      reason: check.conflictReasons[0] ?? 'Non entra nel vano motore',
    };
  };

  const selectedBayFit = useMemo(
    () =>
      selectedPowertrainEntry
        ? checkPowertrainBayFit(selectedPowertrainEntry.entity, selectedChassis)
        : { fits: true, reason: null },
    [selectedPowertrainEntry, selectedChassis],
  );

  const filteredTransmissions = useMemo(() => {
    const isEv = powertrainSpecs?.isEv ?? false;
    return TRANSMISSION_OPTIONS.filter((t) => (isEv ? t.isEvOnly : !t.isEvOnly));
  }, [powertrainSpecs]);

  if (chassisList.length === 0 || allPowertrains.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-3 text-amber-400">
          <AlertTriangle className="w-6 h-6" />
          <h2 className="text-lg font-bold">
            Prerequisiti mancanti per Fase 2.3 (Trasmissione & Dinamica)
          </h2>
        </div>
        <p className="text-sm text-slate-300">
          Per progettare trasmissione, rapporti cambio, trazione AWD e assetto servono almeno un{' '}
          <strong className="text-cyan-300">Pianale (Fase 2.1)</strong> e un{' '}
          <strong className="text-amber-300">Propulsore (Fase 1)</strong> salvati nel database.
        </p>
        <div className="flex flex-wrap gap-3">
          {chassisList.length === 0 && onNavigateToChassis21 && (
            <button
              type="button"
              onClick={onNavigateToChassis21}
              className="px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500 text-cyan-200 text-sm font-bold flex items-center gap-2 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>Vai a Fase 2.1: Pianali</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {allPowertrains.length === 0 && onNavigateToEngines && (
            <button
              type="button"
              onClick={onNavigateToEngines}
              className="px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500 text-amber-200 text-sm font-bold flex items-center gap-2 cursor-pointer"
            >
              <Gauge className="w-4 h-4" />
              <span>Vai a Fase 1: Propulsori</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Fase 2.3 + Doppia Valuta sempre visibile */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/40 text-indigo-300">
            <Settings2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Fase 2.3 — Trasmissione, Rapporti Cambio, AWD, Assetto & Freni
            </h2>
            <p className="text-xs text-slate-400">
              Integrazione fisica tra Pianale 2.1 e Propulsore Fase 1 • Anno di progetto:{' '}
              <span className="text-slate-200 font-mono font-bold">{currentYear}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-emerald-500/30 text-emerald-300">
            <Coins className="w-4 h-4" />
            <span>Capitale: ${resources.financialCapital.toLocaleString('it-IT')}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-purple-500/30 text-purple-300">
            <FlaskConical className="w-4 h-4" />
            <span>Punti R&D: {resources.rdPoints.toLocaleString('it-IT')}</span>
          </div>
          <button
            type="button"
            onClick={handleResetNew}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold transition cursor-pointer"
          >
            + Nuovo Setup
          </button>
        </div>
      </div>

      {/* Selezione Base Veicolo (Pianale 2.1 + Propulsore Fase 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300">
              Pianale Base (Fase 2.1)
            </label>
            {selectedChassis && (
              <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-200">
                  {(selectedChassis.supportedEngineOrientations ?? ['Longitudinale']).join(' / ')}
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                  {(selectedChassis.supportedDrivetrains ?? []).join(' • ')}
                </span>
              </div>
            )}
          </div>
          <select
            value={config.chassisId}
            onChange={(e) => setConfig((prev) => ({ ...prev, chassisId: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
          >
            {chassisList.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name} ({ch.codeName}) — Passo {ch.wheelbaseMm}mm •{' '}
                {(ch.supportedDrivetrains ?? []).join('/')}
              </option>
            ))}
          </select>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Propulsore (Fase 1A / 1B / 1C)
            </label>
            {powertrainSpecs && (
              <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
                  {powertrainSpecs.peakPowerHp} CV @ {powertrainSpecs.peakPowerRpm} rpm
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-200">
                  {powertrainSpecs.peakTorqueNm} Nm • Redline {powertrainSpecs.redlineRpm}
                </span>
                <span className="px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/40 text-indigo-200">
                  {powertrainSpecs.isEv
                    ? 'EV'
                    : `Nativo ${powertrainSpecs.nativeOrientation ?? 'N/D'}`}
                </span>
                <span
                  className={`px-2 py-0.5 rounded border font-bold ${
                    selectedBayFit.fits
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-red-500/20 border-red-500/60 text-red-300'
                  }`}
                >
                  {selectedBayFit.fits ? 'OK Vano/Orient.' : selectedBayFit.reason}
                </span>
              </div>
            )}
          </div>
          <select
            value={config.engineId}
            onChange={(e) => handleEngineChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
          >
            {engines.length > 0 && (
              <optgroup label="Motori Termici, Wankel & Ibridi (Fase 1)">
                {engines.map((e) => {
                  const s = extractPowertrainSpecs(e);
                  const fit = checkPowertrainBayFit(e, selectedChassis);
                  return (
                    <option key={e.id} value={e.id}>
                      {fit.fits ? '[OK]' : '[INCOMPATIBILE]'} {e.name} ({s.nativeOrientation ?? 'Long.'}) — {s.peakPowerHp}{' '}
                      CV • {s.peakTorqueNm} Nm
                    </option>
                  );
                })}
              </optgroup>
            )}
            {savedElectricMotors.length > 0 && (
              <optgroup label="Motori Elettrici Dedicati (Fase 1C)">
                {savedElectricMotors.map((m) => {
                  const s = extractPowertrainSpecs(m);
                  return (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.codeName}) — {s.peakPowerHp} CV EV • {s.peakTorqueNm} Nm •{' '}
                      {s.redlineRpm} rpm
                    </option>
                  );
                })}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      {/* Layout Principale: Sinistra Controlli (3 Blocchi) | Destra Grafico & Telemetria */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* COLONNA CONTROLLI */}
        <div className="xl:col-span-7 space-y-5">
          {/* Nome & Anno */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                Nome Setup Trasmissione & Assetto
              </label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                Anno Tecnologico
              </label>
              <input
                type="number"
                min={1950}
                max={2035}
                value={config.year}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    year: Math.max(1950, Math.min(2035, Number(e.target.value) || currentYear)),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* BLOC 1 — Trazione, 4 Schemi AWD & Cambio */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-indigo-300">
              <Wrench className="w-4 h-4" />
              <span>1. Trazione, Schemi AWD, Cambio & Differenziale</span>
            </div>

            {/* Trazione FWD / RWD / AWD */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase text-slate-400">
                Layout Trazione
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {(['FWD', 'RWD', 'AWD'] as const).map((dt) => {
                  const supported = (selectedChassis?.supportedDrivetrains ?? []).includes(dt);
                  const active = config.drivetrainType === dt;
                  return (
                    <button
                      key={dt}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          drivetrainType: dt,
                          awdScheme:
                            dt === 'AWD' ? prev.awdScheme ?? 'awd-longitudinal-perm' : null,
                        }))
                      }
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        active
                          ? supported
                            ? 'bg-indigo-500/20 border-indigo-400 text-indigo-100'
                            : 'bg-red-500/20 border-red-500 text-red-200'
                          : supported
                            ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                            : 'bg-red-950/20 border-red-900/60 text-red-400/80 hover:border-red-700'
                      }`}
                    >
                      <div className="font-bold text-sm">{dt}</div>
                      <div className="text-[10px] font-mono">
                        {supported ? 'Supportato' : 'Non ammesso dal pianale'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4 Schemi AWD quando AWD è attivo */}
            {config.drivetrainType === 'AWD' && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="text-[11px] font-bold uppercase text-cyan-300">
                  4 Schemi AWD (Compatibilità Orientamento Pianale)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {AWD_SCHEME_OPTIONS.map((awd) => {
                    const chassisOrientations =
                      selectedChassis?.supportedEngineOrientations ?? ['Longitudinale'];
                    const compatible = awd.allowedOrientations.some((o) =>
                      chassisOrientations.includes(o),
                    );
                    const active = config.awdScheme === awd.id;
                    return (
                      <button
                        key={awd.id}
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({ ...prev, awdScheme: awd.id }))
                        }
                        className={`p-3 rounded-xl border text-left transition cursor-pointer space-y-1 ${
                          active
                            ? compatible
                              ? 'bg-cyan-500/15 border-cyan-400 text-cyan-100'
                              : 'bg-red-500/20 border-red-500 text-red-200'
                            : compatible
                              ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                              : 'bg-red-950/15 border-red-900/50 text-red-300/75'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs">{awd.name}</span>
                          {!compatible && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/25 text-red-200 font-mono">
                              Incompatibile
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          Orientamento: {awd.allowedOrientations.join('/')} • Loss base{' '}
                          {awd.lossPercent}% • +{awd.weightKg} kg • Split{' '}
                          {awd.defaultFrontSplit}/{100 - awd.defaultFrontSplit}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tipo Cambio, Numero Marce & Differenziale */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                  Tipo Cambio ({powertrainSpecs?.isEv ? 'Riduttori EV' : 'Cambi ICE/Wankel'})
                </label>
                <select
                  value={config.transmissionType}
                  onChange={(e) => handleTransmissionChange(e.target.value as TransmissionType)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                >
                  {filteredTransmissions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (dal {t.minYear} • {t.shiftTimeMs}ms • max {t.baseTorqueCapacityNm}{' '}
                      Nm)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase text-slate-400">
                    Marce ({activeTransOpt.minGears}..{activeTransOpt.maxGears})
                  </label>
                  {metrics && (
                    <span className="text-[10px] font-mono text-indigo-300">
                      $
                      {Math.round(
                        (activeTransOpt.unitCost +
                          Math.max(0, config.gearCount - activeTransOpt.minGears) *
                            activeTransOpt.perExtraGearCost) *
                          (GEARBOX_STRENGTH_TIERS.find(
                            (g) => g.id === (config.gearboxStrengthTier ?? 'standard'),
                          )?.unitCostMultiplier ?? 1),
                      ).toLocaleString('it-IT')}{' '}
                      • {metrics.weightBreakdownKg.gearboxKg} kg
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {Array.from(
                    { length: activeTransOpt.maxGears - activeTransOpt.minGears + 1 },
                    (_, i) => activeTransOpt.minGears + i,
                  ).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleGearCountChange(n)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold cursor-pointer ${
                        config.gearCount === n
                          ? 'bg-indigo-500/25 border-indigo-400 text-indigo-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Dimensionamento Cambio (Ponte Fase 3.1) + Barra Coppia vs Capacità */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase text-slate-400">
                  Dimensionamento Cambio
                </span>
                <span className="text-[10px] text-slate-400 italic">
                  Dimensionamento base; i materiali ingranaggi custom si sbloccheranno in Fase 3.1
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {GEARBOX_STRENGTH_TIERS.map((tier) => {
                  const active = (config.gearboxStrengthTier ?? 'standard') === tier.id;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          gearboxStrengthTier: tier.id as GearboxStrengthTier,
                        }))
                      }
                      className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                        active
                          ? 'bg-indigo-500/20 border-indigo-400 text-indigo-100'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-bold text-[11px] truncate">{tier.name.split(' ')[0]}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {tier.torqueMultiplier.toFixed(2)}x Nm • {tier.weightMultiplier.toFixed(2)}x kg
                      </div>
                    </button>
                  );
                })}
              </div>
              {metrics && powertrainSpecs && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-300">
                      Coppia Motore: <strong>{powertrainSpecs.peakTorqueNm} Nm</strong>
                    </span>
                    <span
                      className={
                        metrics.torqueOverloadRatio > 1.0
                          ? 'text-red-300 font-bold'
                          : 'text-emerald-300 font-bold'
                      }
                    >
                      Capacità Cambio: {metrics.gearboxTorqueCapacityNm} Nm (
                      {(metrics.torqueOverloadRatio * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        metrics.torqueOverloadRatio > 1.0
                          ? 'bg-red-500'
                          : metrics.torqueOverloadRatio > 0.85
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.min(100, metrics.torqueOverloadRatio * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                Differenziale Principale
              </label>
              <select
                value={config.differentialType}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    differentialType: e.target.value as DifferentialType,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                {DIFFERENTIAL_OPTIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} (dal {d.minYear} • +{d.lossDeltaPercent}% loss • +${d.unitCost})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* BLOC 2 — Slider Rapportatura Veicolo */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                <Gauge className="w-4 h-4" />
                <span>2. Rapportatura Cambio, Rapporto Finale & Ruota</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleApplyRatioPreset('short')}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 text-[11px] font-bold cursor-pointer"
                >
                  Rapporti Corti (Pista)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyRatioPreset('balanced')}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-200 text-[11px] font-bold cursor-pointer"
                >
                  Bilanciati
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyRatioPreset('long')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-200 text-[11px] font-bold cursor-pointer"
                >
                  Lunghi (Autostrada)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300 font-semibold">Rapporto Finale (Final Drive)</span>
                  <span className="text-amber-300 font-bold">
                    {config.finalDriveRatio.toFixed(2)}:1
                  </span>
                </div>
                <input
                  type="range"
                  min={activeTransOpt.isEvOnly ? 5.0 : 2.2}
                  max={activeTransOpt.isEvOnly ? 12.0 : 5.8}
                  step={activeTransOpt.isEvOnly ? 0.05 : 0.01}
                  value={config.finalDriveRatio}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      finalDriveRatio: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-amber-400"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase text-slate-400">
                    Cerchi &amp; Spalle
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((prev) => {
                        const nextStaggered = !prev.staggeredWheels;
                        const fRim = prev.frontRimDiameterInch ?? prev.rimDiameterInch ?? 18;
                        const fSw = prev.frontTireSidewallMm ?? prev.tireSidewallMm ?? 100;
                        return {
                          ...prev,
                          staggeredWheels: nextStaggered,
                          frontRimDiameterInch: fRim,
                          frontTireSidewallMm: fSw,
                          rearRimDiameterInch: nextStaggered
                            ? prev.rearRimDiameterInch ?? fRim
                            : fRim,
                          rearTireSidewallMm: nextStaggered
                            ? prev.rearTireSidewallMm ?? fSw
                            : fSw,
                        };
                      })
                    }
                    className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold cursor-pointer ${
                      config.staggeredWheels
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    {config.staggeredWheels ? 'Differenziati (Staggered)' : 'Uguali Ant/Post'}
                  </button>
                </div>

                {!config.staggeredWheels ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-300 font-semibold">Cerchio</span>
                        <span className="text-cyan-300 font-bold">
                          {config.frontRimDiameterInch ?? config.rimDiameterInch ?? 18}&quot;
                        </span>
                      </div>
                      <input
                        type="range"
                        min={13}
                        max={23}
                        step={1}
                        value={config.frontRimDiameterInch ?? config.rimDiameterInch ?? 18}
                        onChange={(e) => {
                          const rim = Number(e.target.value);
                          setConfig((prev) => {
                            const sw = prev.frontTireSidewallMm ?? prev.tireSidewallMm ?? 100;
                            return {
                              ...prev,
                              rimDiameterInch: rim,
                              frontRimDiameterInch: rim,
                              rearRimDiameterInch: rim,
                              tireSidewallMm: sw,
                              frontTireSidewallMm: sw,
                              rearTireSidewallMm: sw,
                              tireRadiusMm: Math.round((rim * 25.4) / 2 + sw),
                            };
                          });
                        }}
                        className="w-full accent-cyan-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-300 font-semibold">Spalla</span>
                        <span className="text-indigo-300 font-bold">
                          {config.frontTireSidewallMm ?? config.tireSidewallMm ?? 100} mm
                        </span>
                      </div>
                      <input
                        type="range"
                        min={55}
                        max={190}
                        step={5}
                        value={config.frontTireSidewallMm ?? config.tireSidewallMm ?? 100}
                        onChange={(e) => {
                          const sw = Number(e.target.value);
                          setConfig((prev) => {
                            const rim = prev.frontRimDiameterInch ?? prev.rimDiameterInch ?? 18;
                            return {
                              ...prev,
                              rimDiameterInch: rim,
                              frontRimDiameterInch: rim,
                              rearRimDiameterInch: rim,
                              tireSidewallMm: sw,
                              frontTireSidewallMm: sw,
                              rearTireSidewallMm: sw,
                              tireRadiusMm: Math.round((rim * 25.4) / 2 + sw),
                            };
                          });
                        }}
                        className="w-full accent-indigo-400"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
                    <div className="space-y-1.5 p-2 rounded-lg bg-slate-900/70 border border-slate-800">
                      <div className="text-rose-300 font-bold">Anteriore</div>
                      <div className="flex justify-between">
                        <span>Cerchio</span>
                        <span>{config.frontRimDiameterInch ?? 18}&quot;</span>
                      </div>
                      <input
                        type="range"
                        min={13}
                        max={23}
                        step={1}
                        value={config.frontRimDiameterInch ?? 18}
                        onChange={(e) => {
                          const rim = Number(e.target.value);
                          setConfig((prev) => ({
                            ...prev,
                            rimDiameterInch: rim,
                            frontRimDiameterInch: rim,
                          }));
                        }}
                        className="w-full accent-rose-400"
                      />
                      <div className="flex justify-between">
                        <span>Spalla</span>
                        <span>{config.frontTireSidewallMm ?? 100} mm</span>
                      </div>
                      <input
                        type="range"
                        min={55}
                        max={190}
                        step={5}
                        value={config.frontTireSidewallMm ?? 100}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            frontTireSidewallMm: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-rose-400"
                      />
                    </div>
                    <div className="space-y-1.5 p-2 rounded-lg bg-slate-900/70 border border-slate-800">
                      <div className="text-orange-300 font-bold">Posteriore</div>
                      <div className="flex justify-between">
                        <span>Cerchio</span>
                        <span>{config.rearRimDiameterInch ?? 19}&quot;</span>
                      </div>
                      <input
                        type="range"
                        min={13}
                        max={23}
                        step={1}
                        value={config.rearRimDiameterInch ?? 19}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            rearRimDiameterInch: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-orange-400"
                      />
                      <div className="flex justify-between">
                        <span>Spalla</span>
                        <span>{config.rearTireSidewallMm ?? 95} mm</span>
                      </div>
                      <input
                        type="range"
                        min={55}
                        max={190}
                        step={5}
                        value={config.rearTireSidewallMm ?? 95}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            rearTireSidewallMm: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-orange-400"
                      />
                    </div>
                  </div>
                )}

                <div className="text-[10px] font-mono text-slate-400">
                  Raggio Ant/Post:{' '}
                  <strong className="text-cyan-300">
                    {metrics?.frontTireRadiusMm ?? config.tireRadiusMm}/
                    {metrics?.rearTireRadiusMm ?? config.tireRadiusMm} mm
                  </strong>{' '}
                  · Max disco Ant:{' '}
                  <strong className="text-rose-300">{metrics?.maxFrontDiscMm ?? '—'} mm</strong> /
                  Post:{' '}
                  <strong className="text-orange-300">{metrics?.maxRearDiscMm ?? '—'} mm</strong>
                </div>
              </div>
            </div>

            {/* Slider individuali per ogni marcia con anti-inversione dinamica */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {config.gearRatios.map((ratio, idx) => {
                const minGear =
                  idx < config.gearRatios.length - 1
                    ? Math.round((config.gearRatios[idx + 1] + 0.02) * 100) / 100
                    : 0.45;
                const maxGear =
                  idx > 0
                    ? Math.round((config.gearRatios[idx - 1] - 0.02) * 100) / 100
                    : 6.0;
                return (
                  <div
                    key={`gear-${idx + 1}`}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-300 font-bold">{idx + 1}ª Marcia</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step={0.01}
                          min={minGear}
                          max={maxGear}
                          value={ratio.toFixed(2)}
                          onChange={(e) =>
                            handleSingleGearChange(idx, Number(e.target.value) || ratio)
                          }
                          className="w-16 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-right text-cyan-300 text-xs"
                        />
                        <span className="text-slate-500">:1</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={minGear}
                      max={maxGear}
                      step={0.01}
                      value={ratio}
                      onChange={(e) => handleSingleGearChange(idx, Number(e.target.value))}
                      className="w-full accent-indigo-400"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* BLOC 3 — Sterzo, Sospensioni, Stabilità & Impianto Frenante */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
              <Compass className="w-4 h-4" />
              <span>3. Sterzo, Sospensioni, ESC/TCS & Impianto Frenante Indipendente</span>
            </div>

            {/* Sterzo + Prontezza + Progressivo + RWS Configurabile */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    Sistema Sterzante
                  </label>
                  <select
                    value={config.steeringType}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        steeringType: e.target.value as SteeringType,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                  >
                    {STEERING_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (dal {s.minYear} • Precisione {s.precisionScore}/100)
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-semibold text-slate-200">
                    Asse Post. Sterzante (RWS)
                  </span>
                  <input
                    type="checkbox"
                    checked={config.rearWheelSteering}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, rearWheelSteering: e.target.checked }))
                    }
                    className="accent-emerald-400 w-4 h-4"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-300 font-semibold">Rapporto Sterzo</span>
                    <span className="text-emerald-300 font-bold">
                      {(config.steeringRatio ?? 14.5).toFixed(1)}:1
                    </span>
                  </div>
                  <input
                    type="range"
                    min={config.steeringType === 'steer-by-wire' ? 8.5 : 10.5}
                    max={19.0}
                    step={0.5}
                    value={config.steeringRatio ?? 14.5}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, steeringRatio: Number(e.target.value) }))
                    }
                    className="w-full accent-emerald-400"
                  />
                </div>
                <label className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/70 border border-slate-800 cursor-pointer text-xs">
                  <span className="text-slate-200">Sterzo Progressivo (2003, +$420)</span>
                  <input
                    type="checkbox"
                    checked={Boolean(config.progressiveSteering)}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, progressiveSteering: e.target.checked }))
                    }
                    className="accent-emerald-400 w-4 h-4"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/70 border border-slate-800 cursor-pointer text-xs">
                  <span className="text-slate-200">Carico Sens. Velocità (1992, +$220)</span>
                  <input
                    type="checkbox"
                    checked={Boolean(config.speedSensitiveSteering)}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        speedSensitiveSteering: e.target.checked,
                      }))
                    }
                    className="accent-emerald-400 w-4 h-4"
                  />
                </label>
              </div>

              {config.rearWheelSteering && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2.5 rounded-xl bg-slate-950 border border-emerald-500/30">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-slate-300 font-semibold">
                        Angolo Max Sterzata Posteriore
                      </span>
                      <span className="text-emerald-300 font-bold">
                        {(config.rwsMaxAngleDeg ?? 3.0).toFixed(1)}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1.5}
                      max={10.0}
                      step={0.5}
                      value={config.rwsMaxAngleDeg ?? 3.0}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, rwsMaxAngleDeg: Number(e.target.value) }))
                      }
                      className="w-full accent-emerald-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-slate-300 font-semibold">
                        Velocità Soglia Inversione
                      </span>
                      <span className="text-cyan-300 font-bold">
                        {config.rwsCrossoverSpeedKmh ?? 60} km/h
                      </span>
                    </div>
                    <input
                      type="range"
                      min={30}
                      max={110}
                      step={5}
                      value={config.rwsCrossoverSpeedKmh ?? 60}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          rwsCrossoverSpeedKmh: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sospensioni Indipendenti per Asse */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                  Sospensione Anteriore
                </label>
                <select
                  value={config.frontSuspension}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      frontSuspension: e.target.value as SuspensionType,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                >
                  {SUSPENSION_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.id === 'torsion-beam'}>
                      {s.name} (Grip {s.gripGeometryScore} • +${s.unitCost})
                      {s.id === 'torsion-beam' ? ' [Non montabile su asse sterzante]' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                  Sospensione Posteriore
                </label>
                <select
                  value={config.rearSuspension}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      rearSuspension: e.target.value as SuspensionType,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                >
                  {SUSPENSION_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Grip {s.gripGeometryScore} • +${s.unitCost})
                      {s.id === 'torsion-beam' && config.drivetrainType !== 'FWD'
                        ? ' [Incompatibile RWD/AWD]'
                        : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sinergia Sospensioni Ant/Post/Trazione */}
            {metrics && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-semibold">
                    Coerenza Assetto Ant/Post/Trazione:
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono font-bold border ${
                      metrics.suspensionPairingScore >= 85
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : metrics.suspensionPairingScore >= 70
                          ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                          : 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                    }`}
                  >
                    {metrics.suspensionPairingScore}/100
                  </span>
                </div>
                {metrics.suspensionPairingNote && (
                  <span className="text-[11px] text-slate-300">
                    {metrics.suspensionPairingNote}
                  </span>
                )}
              </div>
            )}

            {/* Elettronica ABS / TCS / ESC a Pulsanti Modulari + Selettore Mappe */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              {/* Riga 1: ABS */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase text-amber-300">
                  ABS (Antibloccaggio)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {ABS_MODULE_OPTIONS.map((opt) => {
                    const active = (config.absType ?? 'abs-road') === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            absType: opt.id as AbsModuleType,
                          }))
                        }
                        className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                          active
                            ? 'bg-amber-500/20 border-amber-400 text-amber-100'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="text-[11px] font-bold truncate">{opt.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {opt.minYear} • ${opt.unitCost.toLocaleString('it-IT')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Riga 2: TCS */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase text-emerald-300">
                  TCS (Controllo Trazione)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TCS_MODULE_OPTIONS.map((opt) => {
                    const active = (config.tcsType ?? 'none') === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            tcsType: opt.id as TcsModuleType,
                          }))
                        }
                        className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                          active
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="text-[11px] font-bold truncate">{opt.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {opt.minYear} • ${opt.unitCost.toLocaleString('it-IT')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Riga 3: ESC */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase text-cyan-300">
                  ESC (Controllo Stabilità)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ESC_MODULE_OPTIONS.map((opt) => {
                    const active = (config.escType ?? 'none') === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            escType: opt.id as EscModuleType,
                          }))
                        }
                        className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                          active
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="text-[11px] font-bold truncate">{opt.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {opt.minYear} • ${opt.unitCost.toLocaleString('it-IT')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggle Selettore Modalità di Guida (Mappe Pilota dal 2004) */}
              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(config.hasDriveModeSelector)}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        hasDriveModeSelector: e.target.checked,
                      }))
                    }
                    className="accent-emerald-400 w-4 h-4"
                  />
                  <span className="font-semibold text-slate-200">
                    Selettore Modalità di Guida (Mappe Pilota)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    (dal {DRIVE_MODE_SELECTOR_SPEC.minYear} • +${DRIVE_MODE_SELECTOR_SPEC.unitCost} •{' '}
                    +{DRIVE_MODE_SELECTOR_SPEC.rdCost} R&amp;D)
                  </span>
                </label>

                {!config.hasDriveModeSelector ? (
                  <span className="text-[11px] font-mono text-amber-300/90">
                    Taratura fissa di fabbrica
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(['road', 'sport', 'track', 'offroad', 'custom'] as StabilityDriveMode[]).map(
                      (mode) => {
                        const active = (config.stabilityDriveMode ?? 'road') === mode;
                        const preset = STABILITY_DRIVE_MODE_PRESETS[mode];
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() =>
                              setConfig((prev) => ({
                                ...prev,
                                stabilityDriveMode: mode,
                                tcsSlipThresholdPercent: preset.tcsSlipPercent,
                                escYawThresholdPercent: preset.escYawPercent,
                                stabilityControlThresholdPercent: Math.round(
                                  (preset.tcsSlipPercent + preset.escYawPercent) / 2,
                                ),
                              }))
                            }
                            className={`px-2 py-1 rounded border text-[11px] font-semibold transition cursor-pointer ${
                              active
                                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            {preset.label.split(' ')[0]}
                          </button>
                        );
                      },
                    )}
                  </div>
                )}
              </div>

              {/* 3 Slider Soglie sempre attive quando il modulo è !== 'none' */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-300 font-semibold">Soglia Intervento ABS</span>
                    <span className="text-amber-300 font-bold">
                      {(config.absType ?? 'abs-road') !== 'none'
                        ? `${config.absSlipThresholdPercent ?? 80}%`
                        : 'Off'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    disabled={(config.absType ?? 'abs-road') === 'none'}
                    value={config.absSlipThresholdPercent ?? 80}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        absSlipThresholdPercent: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-amber-400 disabled:opacity-40"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-300 font-semibold">Soglia TCS Trazione</span>
                    <span className="text-emerald-300 font-bold">
                      {(config.tcsType ?? 'none') !== 'none'
                        ? `${config.tcsSlipThresholdPercent ?? 80}%`
                        : 'Off'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    disabled={(config.tcsType ?? 'none') === 'none'}
                    value={config.tcsSlipThresholdPercent ?? 80}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setConfig((prev) => ({
                        ...prev,
                        stabilityDriveMode: 'custom',
                        tcsSlipThresholdPercent: val,
                        stabilityControlThresholdPercent: Math.round(
                          (val + (prev.escYawThresholdPercent ?? val)) / 2,
                        ),
                      }));
                    }}
                    className="w-full accent-emerald-400 disabled:opacity-40"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-300 font-semibold">Soglia ESC Imbardata</span>
                    <span className="text-cyan-300 font-bold">
                      {(config.escType ?? 'none') !== 'none'
                        ? `${config.escYawThresholdPercent ?? 85}%`
                        : 'Off'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    disabled={(config.escType ?? 'none') === 'none'}
                    value={config.escYawThresholdPercent ?? 85}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setConfig((prev) => ({
                        ...prev,
                        stabilityDriveMode: 'custom',
                        escYawThresholdPercent: val,
                        stabilityControlThresholdPercent: Math.round(
                          ((prev.tcsSlipThresholdPercent ?? val) + val) / 2,
                        ),
                      }));
                    }}
                    className="w-full accent-cyan-400 disabled:opacity-40"
                  />
                </div>
              </div>
            </div>

            {/* Impianto Frenante Indipendente Ant / Post */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Anteriore */}
              <div
                className={`p-3 rounded-xl bg-slate-950 border space-y-2.5 ${
                  metrics && config.frontDiscMm > metrics.maxFrontDiscMm
                    ? 'border-red-500/80'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold text-rose-300 uppercase">
                  <div className="flex items-center gap-1.5">
                    <Disc className="w-3.5 h-3.5" />
                    <span>Freni Anteriori</span>
                  </div>
                  {metrics && (
                    <span className="text-[10px] font-mono text-slate-400 normal-case">
                      max {metrics.maxFrontDiscMm} mm
                    </span>
                  )}
                </div>
                <select
                  value={config.frontCaliper}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      frontCaliper: e.target.value as BrakeCaliperType,
                    }))
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
                >
                  {BRAKE_CALIPER_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (dal {c.minYear})
                    </option>
                  ))}
                </select>
                <select
                  value={config.frontDiscType}
                  disabled={config.frontCaliper === 'drum'}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      frontDiscType: e.target.value as BrakeDiscType,
                    }))
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 disabled:opacity-40"
                >
                  {BRAKE_DISC_OPTIONS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} (dal {d.minYear} • +${d.unitCostPerAxle.toLocaleString('it-IT')})
                    </option>
                  ))}
                </select>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400">
                      Diametro Ant. {metrics ? `(max ${metrics.maxFrontDiscMm} mm)` : ''}
                    </span>
                    <span
                      className={`font-bold ${
                        metrics && config.frontDiscMm > metrics.maxFrontDiscMm
                          ? 'text-red-400'
                          : 'text-rose-300'
                      }`}
                    >
                      {config.frontDiscMm} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min={220}
                    max={440}
                    step={5}
                    value={config.frontDiscMm}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, frontDiscMm: Number(e.target.value) }))
                    }
                    className={`w-full ${
                      metrics && config.frontDiscMm > metrics.maxFrontDiscMm
                        ? 'accent-red-500'
                        : 'accent-rose-400'
                    }`}
                  />
                </div>
              </div>

              {/* Posteriore */}
              <div
                className={`p-3 rounded-xl bg-slate-950 border space-y-2.5 ${
                  metrics && config.rearDiscMm > metrics.maxRearDiscMm
                    ? 'border-red-500/80'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold text-orange-300 uppercase">
                  <div className="flex items-center gap-1.5">
                    <Disc className="w-3.5 h-3.5" />
                    <span>Freni Posteriori</span>
                  </div>
                  {metrics && (
                    <span className="text-[10px] font-mono text-slate-400 normal-case">
                      max {metrics.maxRearDiscMm} mm
                    </span>
                  )}
                </div>
                <select
                  value={config.rearCaliper}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      rearCaliper: e.target.value as BrakeCaliperType,
                    }))
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
                >
                  {BRAKE_CALIPER_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (dal {c.minYear})
                    </option>
                  ))}
                </select>
                <select
                  value={config.rearDiscType}
                  disabled={config.rearCaliper === 'drum'}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      rearDiscType: e.target.value as BrakeDiscType,
                    }))
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 disabled:opacity-40"
                >
                  {BRAKE_DISC_OPTIONS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} (dal {d.minYear} • +${d.unitCostPerAxle.toLocaleString('it-IT')})
                    </option>
                  ))}
                </select>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400">
                      Diametro Post. {metrics ? `(max ${metrics.maxRearDiscMm} mm)` : ''}
                    </span>
                    <span
                      className={`font-bold ${
                        metrics && config.rearDiscMm > metrics.maxRearDiscMm
                          ? 'text-red-400'
                          : 'text-orange-300'
                      }`}
                    >
                      {config.rearDiscMm} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={410}
                    step={5}
                    value={config.rearDiscMm}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, rearDiscMm: Number(e.target.value) }))
                    }
                    className={`w-full ${
                      metrics && config.rearDiscMm > metrics.maxRearDiscMm
                        ? 'accent-red-500'
                        : 'accent-orange-400'
                    }`}
                  />
                </div>
              </div>
            </div>

            {metrics && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300">
                    Ripartizione Frenata: <strong className="text-rose-300">{metrics.brakeBiasFrontPercent.toFixed(1)}% Ant</strong> /{' '}
                    <strong className="text-orange-300">{(100 - metrics.brakeBiasFrontPercent).toFixed(1)}% Post</strong>
                  </span>
                  <span className="text-cyan-300">
                    Capacità Termica: <strong>{metrics.brakeThermalCapacityKj.toLocaleString('it-IT')} kJ</strong> ({metrics.brakeCoolingRateKw.toFixed(1)} kW)
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden flex">
                  <div
                    className="bg-rose-500 h-full transition-all"
                    style={{ width: `${metrics.brakeBiasFrontPercent}%` }}
                  />
                  <div
                    className="bg-orange-400 h-full transition-all"
                    style={{ width: `${100 - metrics.brakeBiasFrontPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLONNA TELEMETRIA, GRAFICO & SALVATAGGIO */}
        <div className="xl:col-span-5 space-y-5">
          {metrics && powertrainSpecs && (
            <>
              {/* Grafico Rapportatura */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-cyan-300">
                    Telemetria Rapporti Cambio (Denti di Sega)
                  </h3>
                  <span className="text-xs font-mono text-slate-400">
                    Vmax teorica: <strong className="text-cyan-200">{metrics.theoreticalTopSpeedKmh.toFixed(0)} km/h</strong>
                  </span>
                </div>
                <GearRatioChart
                  gearsTelemetry={metrics.gearsTelemetry}
                  peakTorqueRpm={powertrainSpecs.peakTorqueNm > 0 ? Math.round(powertrainSpecs.peakPowerRpm * 0.65) : 3500}
                  peakPowerRpm={powertrainSpecs.peakPowerRpm}
                  redlineRpm={powertrainSpecs.redlineRpm}
                  theoreticalTopSpeedKmh={metrics.theoreticalTopSpeedKmh}
                  cruisingRpmAt130Kmh={metrics.cruisingRpmAt130Kmh}
                />
              </div>

              {/* Card Telemetria Chiave */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-slate-100">
                  Telemetria Trasmissione, Meccatronica & Costi
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Drivetrain Loss</div>
                    <div className="text-base font-bold text-amber-300">
                      {metrics.drivetrainLossPercent.toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Potenza Ruote (WHP)</div>
                    <div className="text-base font-bold text-emerald-300">
                      {metrics.wheelPeakPowerHp} CV
                    </div>
                    <div className="text-[10px] text-slate-500">
                      vs {powertrainSpecs.peakPowerHp} CV albero
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Coppia Ruote</div>
                    <div className="text-base font-bold text-cyan-300">
                      {metrics.wheelPeakTorqueNm} Nm
                    </div>
                    <div className="text-[10px] text-slate-500">
                      1ª: {metrics.maxWheelTorqueFirstGearNm.toLocaleString('it-IT')} Nm
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Tempo Cambiata</div>
                    <div className="text-base font-bold text-slate-100">{metrics.shiftTimeMs} ms</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">RPM @ 130 km/h</div>
                    <div className="text-base font-bold text-sky-300">
                      {metrics.cruisingRpmAt130Kmh}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Sterzo / Diametro</div>
                    <div className="text-sm font-bold text-indigo-300">
                      {metrics.steeringPrecisionScore}/100 • {metrics.turningCircleM}m
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Comfort / Off-Road</div>
                    <div className="text-sm font-bold text-teal-300">
                      {metrics.rideComfortScore} / {metrics.offRoadArticulationScore}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Costo Unitario</div>
                    <div className="text-sm font-bold text-emerald-200">
                      ${metrics.unitManufacturingCost.toLocaleString('it-IT')}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Durabilità</div>
                    <div className="text-sm font-bold text-slate-200">
                      {metrics.estimatedDurabilityKm.toLocaleString('it-IT')} km
                    </div>
                  </div>
                </div>

                {/* Breakdown Pesi */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-1">
                  <div className="flex justify-between text-slate-300 font-bold">
                    <span>Breakdown Pesi Meccatronica</span>
                    <span className="text-cyan-300">
                      {metrics.weightBreakdownKg.totalMechatronicsKg} kg totali
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Cambio {metrics.weightBreakdownKg.gearboxKg} + AWD{' '}
                    {metrics.weightBreakdownKg.awdHardwareKg} + Diff{' '}
                    {metrics.weightBreakdownKg.differentialKg} + Sterzo{' '}
                    {metrics.weightBreakdownKg.steeringKg} + Sosp.{' '}
                    {metrics.weightBreakdownKg.suspensionKg} + Freni{' '}
                    {metrics.weightBreakdownKg.brakesKg} kg
                  </div>
                </div>

                {/* Errori Compatibilità Pianale */}
                {metrics.compatibilityErrors.length > 0 && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/60 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-red-300 uppercase">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Errori Compatibilità Pianale / Motore</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-xs text-red-200">
                      {metrics.compatibilityErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Avvisi Meccanici */}
                {metrics.warnings.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/50 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Avvisi Meccanici ({metrics.warnings.length})</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-xs text-amber-200">
                      {metrics.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Salvataggio & Costo Incrementale */}
                <div className="pt-2 border-t border-slate-800 space-y-3">
                  {requiredCost && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400">
                        {editingId
                          ? isTuningOnly
                            ? 'Ritaratura (solo rapporti/cerchi/soglie):'
                            : 'Costo Aggiornamento (Delta + 5% rev.):'
                          : 'Costo Integrazione & Omologazione:'}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-300 font-bold">
                          ${requiredCost.capitalCost.toLocaleString('it-IT')}
                        </span>
                        <span className="text-purple-300 font-bold">
                          {requiredCost.rdCost} Punti R&D
                        </span>
                      </div>
                    </div>
                  )}

                  {!saveValidation.ok && (
                    <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-500/40 text-xs text-red-200 space-y-1">
                      <div className="font-bold text-red-300">Motivi blocco salvataggio:</div>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {saveValidation.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {feedbackBanner && (
                    <div
                      className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                        feedbackBanner.type === 'ok'
                          ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                          : 'bg-red-950/40 border-red-500/50 text-red-200'
                      }`}
                    >
                      {feedbackBanner.type === 'ok' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{feedbackBanner.msg}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!saveValidation.ok}
                      onClick={handleSave}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Save className="w-4 h-4" />
                      <span>{editingId ? 'Aggiorna Setup' : 'Salva Setup 2.3'}</span>
                    </button>

                    {editingId && (
                      <button
                        type="button"
                        onClick={() => {
                          deleteDrivetrainSetup(editingId);
                          handleResetNew();
                        }}
                        className="p-2.5 rounded-xl bg-red-950/50 hover:bg-red-900/60 border border-red-500/40 text-red-300 transition cursor-pointer"
                        title="Elimina setup"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lista Setup Salvati in basso (quick access) */}
      {drivetrainSetups.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
            <Sparkles className="w-4 h-4" />
            <span>Setup Trasmissione & Dinamica Salvati ({drivetrainSetups.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {drivetrainSetups.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setEditingId(item.id);
                  setConfig({
                    ...item.config,
                    gearRatios: [...item.config.gearRatios],
                  });
                  setFeedbackBanner(null);
                }}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  editingId === item.id
                    ? 'bg-indigo-500/15 border-indigo-400 text-indigo-100'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="font-bold text-xs truncate">{item.name}</div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  {item.config.drivetrainType} • {item.config.gearCount}M • Loss{' '}
                  {item.metrics.drivetrainLossPercent.toFixed(1)}% • {item.metrics.wheelPeakPowerHp}{' '}
                  WHP
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
