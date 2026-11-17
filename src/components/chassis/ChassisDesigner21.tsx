import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Gauge,
  Layers,
  Lock,
  Ruler,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Unlock,
  Wrench,
} from 'lucide-react';
import { CHASSIS_STRUCTURES } from '../../data/chassisData';
import {
  type ChassisConfigInput,
  calculateChassisMetrics,
  resolveChassisLayoutRules,
} from '../../math/chassisMath';
import { calculatePlatformVariantRdCost } from '../../math/variantRdMath';
import { evaluateEngineBayCompatibility } from '../../math/volumeMath';
import { useGameStore } from '../../store/useGameStore';
import type {
  ChassisDrivetrainMode,
  ChassisEntity,
  EngineMountingPosition,
  EngineOrientation,
  GearboxLayoutType,
} from '../../types/gameTypes';
import { Chassis3DViewport } from './Chassis3DViewport';

const ENGINE_POSITIONS: EngineMountingPosition[] = [
  'Anteriore',
  'Anteriore-Centrale',
  'Centrale-Posteriore',
  'Posteriore',
];

const ENGINE_ORIENTATIONS: EngineOrientation[] = ['Longitudinale', 'Trasversale'];

export const ChassisDesigner21: React.FC = () => {
  const {
    currentYear,
    subBrands,
    chassisList,
    engines,
    unlockedEnginePartIds,
    unlockEnginePart,
    saveChassisToDatabase,
    activeVariantParent,
    startVariant,
    clearVariant,
  } = useGameStore();

  const [chassisName, setChassisName] = useState('Piattaforma Modulare Nuova Era');
  const [codeName, setCodeName] = useState('PLT-200');
  const [ownerSubBrandId, setOwnerSubBrandId] = useState(
    subBrands[0]?.id ?? 'sb-officine-milano',
  );
  const [generationNumber, setGenerationNumber] = useState(1);

  const [config, setConfig] = useState<ChassisConfigInput>({
    structureId: 'str-steel-stamped',
    overallDimensionsMm: { lengthMm: 4480, widthMm: 1830, heightMm: 1445 },
    wheelbaseMm: 2710,
    frontTrackMm: 1560,
    rearTrackMm: 1570,
    groundClearanceMm: 135,
    rigidityReinforcementPercent: 35,
    safetyStructurePercent: 45,
    supportedEnginePositions: ['Anteriore'],
    supportedEngineOrientations: ['Longitudinale'],
    engineSetbackPercent: 45,
    drivetrainMode: 'RWD_AWD_Ready',
    allowLongitudinalFwd: false,
    gearboxLayout: 'InBlockWithEngine',
    supportedDrivetrains: ['RWD', 'AWD'],
    engineBayExtraLengthMm: 0,
    engineBayExtraWidthMm: 0,
    engineBayExtraHeightMm: 0,
  });

  const [previewAwdAsset, setPreviewAwdAsset] = useState(false);

  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);

  // Sincronizza quando viene attivata la Modalità Variante Pianale
  useEffect(() => {
    if (activeVariantParent && activeVariantParent.type === 'chassis') {
      const parent = activeVariantParent.entity as ChassisEntity;
      setChassisName(`${parent.name} Evo`);
      setCodeName(`${parent.codeName}-EVO`);
      setOwnerSubBrandId(parent.ownerSubBrandId);
      setGenerationNumber((parent.generationNumber ?? 1) + 1);

      const matchedStructure =
        CHASSIS_STRUCTURES.find(
          (s) => s.name === parent.taxonomy.materialStress.materialName,
        ) ?? CHASSIS_STRUCTURES[0];

      const primaryPos = parent.supportedEnginePositions[0] ?? 'Anteriore';
      const primaryOri = parent.supportedEngineOrientations[0] ?? 'Longitudinale';
      const hasAwd = parent.supportedDrivetrains.includes('AWD');
      const isFwdNative = parent.supportedDrivetrains.includes('FWD') && !parent.supportedDrivetrains.includes('RWD');
      const derivedDrivetrainMode: ChassisDrivetrainMode =
        parent.drivetrainMode ??
        (isFwdNative
          ? hasAwd
            ? 'FWD_AWD_Ready'
            : 'FWD_Only'
          : hasAwd
            ? 'RWD_AWD_Ready'
            : 'RWD_Only');

      setConfig({
        structureId: matchedStructure.id,
        overallDimensionsMm: { ...parent.overallDimensionsMm },
        wheelbaseMm: parent.wheelbaseMm,
        frontTrackMm: parent.frontTrackMm,
        rearTrackMm: parent.rearTrackMm,
        groundClearanceMm: parent.groundClearanceMm,
        rigidityReinforcementPercent: 40,
        safetyStructurePercent: 50,
        supportedEnginePositions: [primaryPos],
        supportedEngineOrientations: [primaryOri],
        engineSetbackPercent: parent.engineSetbackPercent,
        drivetrainMode: derivedDrivetrainMode,
        allowLongitudinalFwd: parent.allowLongitudinalFwd ?? false,
        gearboxLayout: parent.gearboxLayout ?? 'InBlockWithEngine',
        supportedDrivetrains: [...parent.supportedDrivetrains],
        engineBayExtraLengthMm: 0,
        engineBayExtraWidthMm: 0,
        engineBayExtraHeightMm: 0,
      });
    }
  }, [activeVariantParent]);

  // Vincoli geometrici coerenti tra Lunghezza <-> Passo e Larghezza <-> Carreggiata
  const maxWheelbase = Math.max(2000, config.overallDimensionsMm.lengthMm - 720);
  const clampedWheelbase = Math.min(maxWheelbase, Math.max(2000, config.wheelbaseMm));
  const maxTrack = Math.max(1320, config.overallDimensionsMm.widthMm - 140);
  const clampedFrontTrack = Math.min(maxTrack, Math.max(1320, config.frontTrackMm));
  const clampedRearTrack = Math.min(maxTrack, Math.max(1320, config.rearTrackMm));

  const effectiveConfig: ChassisConfigInput = useMemo(
    () => ({
      ...config,
      wheelbaseMm: clampedWheelbase,
      frontTrackMm: clampedFrontTrack,
      rearTrackMm: clampedRearTrack,
    }),
    [config, clampedWheelbase, clampedFrontTrack, clampedRearTrack],
  );

  const metrics = useMemo(
    () => calculateChassisMetrics(effectiveConfig, currentYear),
    [effectiveConfig, currentYear],
  );

  const selectedStructure = useMemo(
    () => CHASSIS_STRUCTURES.find((s) => s.id === config.structureId) ?? CHASSIS_STRUCTURES[0],
    [config.structureId],
  );

  const layoutRules = useMemo(
    () =>
      resolveChassisLayoutRules({
        position: effectiveConfig.supportedEnginePositions[0] ?? 'Anteriore',
        orientation: effectiveConfig.supportedEngineOrientations[0] ?? 'Longitudinale',
        engineSetbackPercent: effectiveConfig.engineSetbackPercent,
        drivetrainMode: effectiveConfig.drivetrainMode,
        allowLongitudinalFwd: effectiveConfig.allowLongitudinalFwd,
        gearboxLayout: effectiveConfig.gearboxLayout,
      }),
    [effectiveConfig],
  );

  // Costruzione bozza ChassisEntity per valutazione Delta R&D e Compatibilità Motori
  const draftChassisEntity: ChassisEntity = useMemo(() => {
    const parent =
      activeVariantParent?.type === 'chassis'
        ? (activeVariantParent.entity as ChassisEntity)
        : undefined;

    return {
      id: 'draft-chassis-21',
      name: chassisName || 'Nuovo Pianale',
      codeName: codeName || 'PLT-NEW',
      ownerSubBrandId,
      createdYear: currentYear,
      generationNumber,
      parentChassisId: parent?.id,
      parentPlatformId: parent?.id,
      taxonomy: metrics.taxonomy,
      overallDimensionsMm: effectiveConfig.overallDimensionsMm,
      wheelbaseMm: effectiveConfig.wheelbaseMm,
      frontTrackMm: effectiveConfig.frontTrackMm,
      rearTrackMm: effectiveConfig.rearTrackMm,
      groundClearanceMm: effectiveConfig.groundClearanceMm,
      torsionalRigidityNmPerDeg: metrics.torsionalRigidityNmPerDeg,
      structuralSafetyScore: metrics.structuralSafetyScore,
      engineBayMaxDimensionsMm: metrics.engineBayMaxDimensionsMm,
      supportedEnginePositions: effectiveConfig.supportedEnginePositions,
      supportedEngineOrientations: effectiveConfig.supportedEngineOrientations,
      engineSetbackPercent: effectiveConfig.engineSetbackPercent,
      supportedDrivetrains: metrics.resolvedDrivetrains,
      drivetrainMode: effectiveConfig.drivetrainMode,
      allowLongitudinalFwd: effectiveConfig.allowLongitudinalFwd,
      gearboxLayout: metrics.effectiveGearboxLayout,
      estimatedWeightDistribution2WD: metrics.estimatedWeightDistribution2WD,
      estimatedWeightDistributionAWD: metrics.estimatedWeightDistributionAWD ?? undefined,
      cargoVolumeDeltaLiters: metrics.cargoVolumeDeltaLiters,
      centerOfGravityDeltaMm: metrics.centerOfGravityDeltaMm,
      maxSupportedEngineTorqueNm: selectedStructure.maxSupportedTorqueNm,
      maxSupportedEngineWeightKg: selectedStructure.maxSupportedEngineWeightKg,
      calculatedSegment: metrics.segmentInfo.segment,
      baseWeightKg: metrics.baseWeightKg,
      unitManufacturingCost: metrics.unitManufacturingCost,
      developmentCost: metrics.developmentCost,
    };
  }, [
    activeVariantParent,
    chassisName,
    codeName,
    ownerSubBrandId,
    currentYear,
    generationNumber,
    metrics,
    effectiveConfig,
  ]);

  // Calcolo Delta R&D Anti-Exploit per Varianti Pianale
  const variantRdResult = useMemo(() => {
    if (activeVariantParent && activeVariantParent.type === 'chassis') {
      return calculatePlatformVariantRdCost(
        draftChassisEntity,
        activeVariantParent.entity as ChassisEntity,
        metrics.developmentCost,
      );
    }
    return null;
  }, [activeVariantParent, draftChassisEntity, metrics.developmentCost]);

  // Verifica compatibilità in tempo reale con i motori omologati nel Database
  const engineCompatibilityList = useMemo(() => {
    return engines.map((eng) => {
      const orientation: EngineOrientation =
        eng.pistonSpecs?.intendedOrientation ??
        eng.wankelSpecs?.intendedOrientation ??
        'Longitudinale';
      const result = evaluateEngineBayCompatibility(
        eng.dimensionsMm,
        orientation,
        draftChassisEntity,
      );
      return { engine: eng, orientation, result };
    });
  }, [engines, draftChassisEntity]);

  const handleSelectOrUnlockStructure = (struct: (typeof CHASSIS_STRUCTURES)[number]) => {
    const isUnlocked = unlockedEnginePartIds.includes(struct.id);
    if (isUnlocked) {
      setConfig((prev) => ({ ...prev, structureId: struct.id }));
      return;
    }

    const res = unlockEnginePart(struct.id, struct.name, struct.unlockCost);
    if (!res.allowed) {
      setFeedbackBanner({
        type: 'err',
        msg: res.reason ?? 'Risorse o anno storico insufficienti per sbloccare questa struttura telaio.',
      });
    } else {
      setConfig((prev) => ({ ...prev, structureId: struct.id }));
      setFeedbackBanner({
        type: 'ok',
        msg: `Architettura telaio sbloccata: ${struct.name} (-$${(struct.unlockCost.capitalCost / 1_000_000).toFixed(1)}M / -${struct.unlockCost.rdCost} R&D)`,
      });
    }
  };

  const syncLayoutWith = (
    pos: EngineMountingPosition,
    ori: EngineOrientation,
    setback: number,
    allowLongFwd: boolean,
    wantAwd: boolean,
    gearbox: GearboxLayoutType,
  ) => {
    const canLongFwd = pos === 'Anteriore' && ori === 'Longitudinale' && setback <= 35;
    const effectiveLongFwd = canLongFwd ? allowLongFwd : false;
    const isFwd =
      ((pos === 'Anteriore' || pos === 'Anteriore-Centrale') && ori === 'Trasversale') ||
      effectiveLongFwd;
    const drivetrainMode: ChassisDrivetrainMode = isFwd
      ? wantAwd
        ? 'FWD_AWD_Ready'
        : 'FWD_Only'
      : wantAwd
        ? 'RWD_AWD_Ready'
        : 'RWD_Only';
    const rules = resolveChassisLayoutRules({
      position: pos,
      orientation: ori,
      engineSetbackPercent: setback,
      drivetrainMode,
      allowLongitudinalFwd: effectiveLongFwd,
      gearboxLayout: gearbox,
    });
    return {
      supportedEnginePositions: [pos] as EngineMountingPosition[],
      supportedEngineOrientations: [ori] as EngineOrientation[],
      engineSetbackPercent: setback,
      allowLongitudinalFwd: effectiveLongFwd,
      drivetrainMode: rules.effectiveDrivetrainMode,
      gearboxLayout: rules.effectiveGearboxLayout,
      supportedDrivetrains: rules.resolvedDrivetrains,
    };
  };

  const selectPosition = (pos: EngineMountingPosition) => {
    setConfig((prev) => {
      const ori = prev.supportedEngineOrientations[0] ?? 'Longitudinale';
      const wantAwd = prev.drivetrainMode === 'FWD_AWD_Ready' || prev.drivetrainMode === 'RWD_AWD_Ready';
      // Centrale-Posteriore / Posteriore forzano orientamento Longitudinale di default se compatibile o mantengono
      return {
        ...prev,
        ...syncLayoutWith(
          pos,
          ori,
          prev.engineSetbackPercent,
          Boolean(prev.allowLongitudinalFwd),
          wantAwd,
          prev.gearboxLayout,
        ),
      };
    });
  };

  const selectOrientation = (ori: EngineOrientation) => {
    setConfig((prev) => {
      const pos = prev.supportedEnginePositions[0] ?? 'Anteriore';
      const wantAwd = prev.drivetrainMode === 'FWD_AWD_Ready' || prev.drivetrainMode === 'RWD_AWD_Ready';
      return {
        ...prev,
        ...syncLayoutWith(
          pos,
          ori,
          prev.engineSetbackPercent,
          Boolean(prev.allowLongitudinalFwd),
          wantAwd,
          prev.gearboxLayout,
        ),
      };
    });
  };

  const selectDrivetrainOption = (wantAwd: boolean, allowLongFwd?: boolean) => {
    setConfig((prev) => {
      const pos = prev.supportedEnginePositions[0] ?? 'Anteriore';
      const ori = prev.supportedEngineOrientations[0] ?? 'Longitudinale';
      return {
        ...prev,
        ...syncLayoutWith(
          pos,
          ori,
          prev.engineSetbackPercent,
          allowLongFwd ?? Boolean(prev.allowLongitudinalFwd),
          wantAwd,
          prev.gearboxLayout,
        ),
      };
    });
  };

  const handleSaveChassis = () => {
    const finalChassis: ChassisEntity = {
      ...draftChassisEntity,
      id: `chs-${Date.now()}`,
      name: chassisName.trim() || `Pianale Seg.${metrics.segmentInfo.segment}`,
      codeName: codeName.trim() || `PLT-${Math.floor(100 + Math.random() * 899)}`,
      developmentCost: variantRdResult
        ? variantRdResult.effectiveDevelopmentCost
        : metrics.developmentCost,
      isPlatformVariant: Boolean(variantRdResult),
      platformVariantRdSavingsPercent: variantRdResult?.savingsPercentage,
      platformModifiedSpecs: variantRdResult?.detectedChanges.map((c) => c.label),
    };

    const res = saveChassisToDatabase(finalChassis);
    if (!res.allowed) {
      setFeedbackBanner({
        type: 'err',
        msg: res.reason ?? 'Risorse insufficienti per omologare la piattaforma.',
      });
    } else {
      if (variantRdResult) {
        clearVariant();
      }
      setFeedbackBanner({
        type: 'ok',
        msg: `Pianale "${finalChassis.name}" (${finalChassis.codeName}) omologato! Ora è disponibile per i controlli di ingombro e per la progettazione veicoli.`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Fase 2.1 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold uppercase tracking-wider text-slate-100">
              Fase 2.1 — Configuratore Pianale & Layout Motore
            </h2>
            <p className="text-xs font-mono text-slate-400">
              Piattaforma modulare riutilizzabile ed evolubile • Calcolo automatico Segmento per Epoca Storica ({currentYear})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-bold">
            {metrics.segmentInfo.segmentLabel}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            Gen. {generationNumber}
          </span>
        </div>
      </div>

      {/* Banner Modalità Variante Attiva */}
      {activeVariantParent && activeVariantParent.type === 'chassis' && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-2 text-amber-300">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Modalità Variante Pianale Attiva da:</strong> {activeVariantParent.name} (
              {activeVariantParent.codeName}) — Calcolo Delta R&D Anti-Exploit
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              clearVariant();
              setGenerationNumber(1);
            }}
            className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer text-[11px]"
          >
            Annulla Modalità Variante
          </button>
        </div>
      )}

      {/* Banner Feedback */}
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
            className="text-[10px] underline cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      )}

      {/* Griglia Principale: Sinistra Configurazione | Destra Blueprint & Telemetria */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLONNA SINISTRA (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Metadati Pianale */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Wrench className="w-4 h-4 text-amber-400" />
              <span>1. Identità Piattaforma & Sotto-Brand</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Nome Piattaforma</label>
                <input
                  type="text"
                  value={chassisName}
                  onChange={(e) => setChassisName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-amber-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Codice Progetto</label>
                <input
                  type="text"
                  value={codeName}
                  onChange={(e) => setCodeName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-amber-300 focus:border-amber-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400">Marchio Proprietario</label>
                <select
                  value={ownerSubBrandId}
                  onChange={(e) => setOwnerSubBrandId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-amber-500 outline-none"
                >
                  {subBrands.map((sb) => (
                    <option key={sb.id} value={sb.id}>
                      {sb.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Materiale e Architettura Strutturale */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                <span>2. Struttura Portante & Materiali Scocca</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Gate Storico: {currentYear}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 font-mono text-xs">
              {CHASSIS_STRUCTURES.map((struct) => {
                const isUnlocked = unlockedEnginePartIds.includes(struct.id);
                const isSelected = config.structureId === struct.id;
                const yearLocked = currentYear < struct.minYear;

                return (
                  <button
                    key={struct.id}
                    type="button"
                    onClick={() => handleSelectOrUnlockStructure(struct)}
                    className={`text-left p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500 text-slate-100'
                        : isUnlocked
                          ? 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                          : yearLocked
                            ? 'bg-slate-950/40 border-slate-900 text-slate-500 opacity-65'
                            : 'bg-slate-950/80 border-sky-900/60 hover:border-sky-500/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold">
                        {isUnlocked ? (
                          <Unlock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        )}
                        <span className="leading-tight">{struct.name}</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 shrink-0">
                        {struct.minYear}+
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-snug">
                      {struct.description}
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[10px]">
                      <span className="text-sky-300">
                        Rig. {(struct.baseRigidityNmPerDeg / 1000).toFixed(1)}k • Peso ×
                        {struct.weightMultiplier.toFixed(2)} • ${struct.baseManufacturingCost.toLocaleString('it-IT')}
                      </span>
                      {!isUnlocked && (
                        <span className="text-amber-300 font-bold">
                          -${(struct.unlockCost.capitalCost / 1_000_000).toFixed(1)}M / -
                          {struct.unlockCost.rdCost} R&D
                        </span>
                      )}
                    </div>
                    {struct.maxSupportedTorqueNm && (
                      <div className="text-[10px] text-amber-300/90">
                        Limite telaio: max {struct.maxSupportedTorqueNm} Nm • max{' '}
                        {struct.maxSupportedEngineWeightKg} kg motore
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Slider Rinforzi Torsionali & Sicurezza */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800 font-mono text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-300">Rinforzi Torsionali & Traverse</span>
                  <span className="text-emerald-400 font-bold">
                    {config.rigidityReinforcementPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={config.rigidityReinforcementPercent}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      rigidityReinforcementPercent: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="text-[10px] text-slate-500">
                  {selectedStructure.usesDiminishingReinforcement
                    ? 'Spaceframe Alu: rendimenti decrescenti (curva logaritmica) oltre il 35%'
                    : 'Aumenta rigidità fino a +42% con leggero incremento di massa'}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-300">Cellula Sicurezza & Assorbimento Urti</span>
                  <span className="text-sky-400 font-bold">
                    {config.safetyStructurePercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={config.safetyStructurePercent}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      safetyStructurePercent: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
                <div className="text-[10px] text-slate-500">
                  Barre anti-intrusione e zone a deformazione programmata
                </div>
              </div>
            </div>
          </div>

          {/* 3. Dimensioni Esterne, Passo, Carreggiata e Altezza da Terra */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Ruler className="w-4 h-4 text-amber-400" />
              <span>3. Quote Dimensionali Pianale (mm)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              {/* Lunghezza */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">Lunghezza Totale</span>
                  <span className="text-amber-300 font-bold">
                    {config.overallDimensionsMm.lengthMm} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={3200}
                  max={5500}
                  step={10}
                  value={config.overallDimensionsMm.lengthMm}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      overallDimensionsMm: {
                        ...prev.overallDimensionsMm,
                        lengthMm: Number(e.target.value),
                      },
                    }))
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Passo */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">Passo Ruote (Wheelbase)</span>
                  <span className="text-amber-300 font-bold">{clampedWheelbase} mm</span>
                </div>
                <input
                  type="range"
                  min={2000}
                  max={maxWheelbase}
                  step={5}
                  value={clampedWheelbase}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, wheelbaseMm: Number(e.target.value) }))
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Larghezza */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">Larghezza Totale</span>
                  <span className="text-sky-300 font-bold">
                    {config.overallDimensionsMm.widthMm} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={1550}
                  max={2150}
                  step={5}
                  value={config.overallDimensionsMm.widthMm}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      overallDimensionsMm: {
                        ...prev.overallDimensionsMm,
                        widthMm: Number(e.target.value),
                      },
                    }))
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              {/* Altezza Totale */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">Altezza Padiglione</span>
                  <span className="text-sky-300 font-bold">
                    {config.overallDimensionsMm.heightMm} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={1050}
                  max={2000}
                  step={5}
                  value={config.overallDimensionsMm.heightMm}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      overallDimensionsMm: {
                        ...prev.overallDimensionsMm,
                        heightMm: Number(e.target.value),
                      },
                    }))
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              {/* Carreggiata Anteriore */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">Carreggiata Anteriore</span>
                  <span className="text-emerald-300 font-bold">{clampedFrontTrack} mm</span>
                </div>
                <input
                  type="range"
                  min={1320}
                  max={maxTrack}
                  step={5}
                  value={clampedFrontTrack}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, frontTrackMm: Number(e.target.value) }))
                  }
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Carreggiata Posteriore */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">Carreggiata Posteriore</span>
                  <span className="text-emerald-300 font-bold">{clampedRearTrack} mm</span>
                </div>
                <input
                  type="range"
                  min={1320}
                  max={maxTrack}
                  step={5}
                  value={clampedRearTrack}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, rearTrackMm: Number(e.target.value) }))
                  }
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Altezza da Terra */}
              <div className="space-y-1 sm:col-span-2">
                <div className="flex justify-between">
                  <span className="text-slate-300">Altezza da Terra (Ground Clearance)</span>
                  <span className="text-amber-300 font-bold">{config.groundClearanceMm} mm</span>
                </div>
                <input
                  type="range"
                  min={75}
                  max={260}
                  step={5}
                  value={config.groundClearanceMm}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      groundClearanceMm: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* 4. Layout Motore, Arretramento & Predisposizione Trazione */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Compass className="w-4 h-4 text-emerald-400" />
              <span>4. Layout Motore, Arretramento & Predisposizione Trazione</span>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div>
                <div className="text-[10px] uppercase text-slate-400 mb-1.5">
                  Posizione Motore nel Telaio (Selezione Singola Esclusiva)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ENGINE_POSITIONS.map((pos) => {
                    const active = config.supportedEnginePositions[0] === pos;
                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => selectPosition(pos)}
                        className={`px-2.5 py-2 rounded-lg border text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          active
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            active ? 'bg-emerald-400' : 'bg-slate-600'
                          }`}
                        />
                        <span>{pos}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] uppercase text-slate-400 mb-1.5">
                    Orientamento Motore (Selezione Singola Esclusiva)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {ENGINE_ORIENTATIONS.map((ori) => {
                      const active = config.supportedEngineOrientations[0] === ori;
                      return (
                        <button
                          key={ori}
                          type="button"
                          onClick={() => selectOrientation(ori)}
                          className={`px-2.5 py-2 rounded-lg border text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                            active
                              ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              active ? 'bg-sky-400' : 'bg-slate-600'
                            }`}
                          />
                          <span>{ori}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] uppercase text-slate-400 mb-1.5">
                    <span>Trazione Nativa & Predisposizione AWD</span>
                    <span className="text-amber-300 font-bold">
                      Base {layoutRules.nativePrimaryAxle}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => selectDrivetrainOption(false)}
                      className={`px-2.5 py-2 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                        !layoutRules.hasAwdReady
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      Solo {layoutRules.nativePrimaryAxle} (Pura)
                    </button>
                    <button
                      type="button"
                      onClick={() => selectDrivetrainOption(true)}
                      className={`px-2.5 py-2 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                        layoutRules.hasAwdReady
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {layoutRules.nativePrimaryAxle} + AWD
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {layoutRules.hasAwdReady
                      ? layoutRules.nativePrimaryAxle === 'FWD'
                        ? 'Tunnel PTU/albero stile Haldex/4Motion (+8% R&D, -18L tunnel)'
                        : 'Tunnel Transfer Case/semiasse ant stile Giorgio Q4/xDrive (+10% R&D, -22L tunnel)'
                      : `Nessun tunnel integrale: asse primario ${layoutRules.nativePrimaryAxle} puro`}
                  </div>
                  {layoutRules.canUseLongitudinalFwd && (
                    <label className="mt-1.5 flex items-center gap-2 text-[10px] text-sky-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(config.allowLongitudinalFwd)}
                        onChange={(e) =>
                          selectDrivetrainOption(layoutRules.hasAwdReady, e.target.checked)
                        }
                        className="accent-sky-500"
                      />
                      <span>Usa Base FWD Longitudinale a sbalzo (stile Audi)</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Schema Scatola Cambio */}
              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <div className="text-[10px] uppercase text-slate-400">
                  Schema Scatola Cambio (Impatto su Bilanciamento Pesi & Rigidità)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({ ...prev, gearboxLayout: 'InBlockWithEngine' }))
                    }
                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                      layoutRules.effectiveGearboxLayout === 'InBlockWithEngine'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-[11px]">In Blocco col Motore</div>
                    <div className="text-[10px] text-slate-400">Schema standard (+$0)</div>
                  </button>

                  <button
                    type="button"
                    disabled={!layoutRules.canUseTransaxle}
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        gearboxLayout: 'RearTransaxleTorqueTube',
                      }))
                    }
                    className={`p-2 rounded-lg border text-left transition ${
                      !layoutRules.canUseTransaxle
                        ? 'bg-slate-950/40 border-slate-900 text-slate-600 cursor-not-allowed'
                        : layoutRules.effectiveGearboxLayout === 'RearTransaxleTorqueTube'
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-200 cursor-pointer'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 cursor-pointer'
                    }`}
                  >
                    <div className="font-bold text-[11px]">Transaxle Post. + Torque Tube</div>
                    <div className="text-[10px] text-slate-400">
                      -6% Ant/+6% Post • +8% rig. • +$1.150 • -35L
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={!layoutRules.canUseMidTunnel}
                    onClick={() =>
                      setConfig((prev) => ({ ...prev, gearboxLayout: 'MidCentralTunnel' }))
                    }
                    className={`p-2 rounded-lg border text-left transition ${
                      !layoutRules.canUseMidTunnel
                        ? 'bg-slate-950/40 border-slate-900 text-slate-600 cursor-not-allowed'
                        : layoutRules.effectiveGearboxLayout === 'MidCentralTunnel'
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-200 cursor-pointer'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 cursor-pointer'
                    }`}
                  >
                    <div className="font-bold text-[11px]">Cambio Centrale Tunnel</div>
                    <div className="text-[10px] text-slate-400">
                      +3.5% bilanciamento al centro • +$800
                    </div>
                  </button>
                </div>
              </div>

              {/* Arretramento Motore */}
              <div className="space-y-1 pt-2 border-t border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-300">
                    Arretramento Motore verso l’Abitacolo (Setback)
                  </span>
                  <span className="text-emerald-400 font-bold">
                    {config.engineSetbackPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={config.engineSetbackPercent}
                  onChange={(e) => {
                    const nextSetback = Number(e.target.value);
                    setConfig((prev) => ({
                      ...prev,
                      ...syncLayoutWith(
                        prev.supportedEnginePositions[0] ?? 'Anteriore',
                        prev.supportedEngineOrientations[0] ?? 'Longitudinale',
                        nextSetback,
                        Boolean(prev.allowLongitudinalFwd),
                        prev.drivetrainMode === 'FWD_AWD_Ready' ||
                          prev.drivetrainMode === 'RWD_AWD_Ready',
                        prev.gearboxLayout,
                      ),
                    }));
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0% (Sbalzo sull’asse)</span>
                  <span>50% (Bilanciato)</span>
                  <span>100% (Arretrato dietro l’asse)</span>
                </div>
              </div>

              {/* Fine-tuning Vano Motore */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Tolleranza Vano L</span>
                      <span className="text-slate-200">
                        {config.engineBayExtraLengthMm && config.engineBayExtraLengthMm >= 0
                          ? `+${config.engineBayExtraLengthMm}`
                          : config.engineBayExtraLengthMm ?? 0}
                        mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={150}
                      step={10}
                      value={config.engineBayExtraLengthMm ?? 0}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          engineBayExtraLengthMm: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-slate-400 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Tolleranza Vano W</span>
                      <span className="text-slate-200">
                        {config.engineBayExtraWidthMm && config.engineBayExtraWidthMm >= 0
                          ? `+${config.engineBayExtraWidthMm}`
                          : config.engineBayExtraWidthMm ?? 0}
                        mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-80}
                      max={120}
                      step={10}
                      value={config.engineBayExtraWidthMm ?? 0}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          engineBayExtraWidthMm: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-slate-400 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Tolleranza Vano H</span>
                      <span className="text-slate-200">
                        {config.engineBayExtraHeightMm && config.engineBayExtraHeightMm >= 0
                          ? `+${config.engineBayExtraHeightMm}`
                          : config.engineBayExtraHeightMm ?? 0}
                        mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-80}
                      max={120}
                      step={10}
                      value={config.engineBayExtraHeightMm ?? 0}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          engineBayExtraHeightMm: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-slate-400 cursor-pointer"
                    />
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[10px] flex flex-wrap gap-x-3 gap-y-1 text-slate-300">
                  <span>
                    Abitacolo/Bagagliaio:{' '}
                    <strong className="text-amber-300">
                      {metrics.bayToleranceImpact.cargoVolumeDeltaLiters >= 0 ? '+' : ''}
                      {metrics.bayToleranceImpact.cargoVolumeDeltaLiters} L
                    </strong>
                  </span>
                  <span>
                    Peso:{' '}
                    <strong className="text-sky-300">
                      {metrics.bayToleranceImpact.weightDeltaKg >= 0 ? '+' : ''}
                      {metrics.bayToleranceImpact.weightDeltaKg} kg
                    </strong>
                  </span>
                  <span>
                    Rigidità:{' '}
                    <strong className="text-rose-300">
                      {metrics.bayToleranceImpact.rigidityDeltaPercent >= 0 ? '+' : ''}
                      {metrics.bayToleranceImpact.rigidityDeltaPercent}%
                    </strong>
                  </span>
                  <span>
                    Baricentro:{' '}
                    <strong className="text-emerald-300">
                      {metrics.bayToleranceImpact.centerOfGravityDeltaMm >= 0 ? '+' : ''}
                      {metrics.bayToleranceImpact.centerOfGravityDeltaMm} mm
                    </strong>
                  </span>
                  <span>
                    Costo:{' '}
                    <strong className="text-amber-200">
                      {metrics.bayToleranceImpact.unitCostDelta >= 0 ? '+' : '-'}$
                      {Math.abs(metrics.bayToleranceImpact.unitCostDelta)}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLONNA DESTRA (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card Segmento Automatico & Soglie Epoca */}
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-bold">
                Classificazione Segmento Automatica
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[10px]">
                {metrics.segmentInfo.thresholds.eraLabel}
              </span>
            </div>

            <div className="text-lg font-bold text-slate-100">
              {metrics.segmentInfo.segmentLabel}
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {metrics.segmentInfo.reasoning}
            </p>

            <div className="pt-2 border-t border-emerald-500/20 grid grid-cols-3 gap-1.5 text-[10px] text-slate-400">
              <div>A ≤ {metrics.segmentInfo.thresholds.maxLengthA} mm</div>
              <div>B ≤ {metrics.segmentInfo.thresholds.maxLengthB} mm</div>
              <div>C ≤ {metrics.segmentInfo.thresholds.maxLengthC} mm</div>
              <div>D ≤ {metrics.segmentInfo.thresholds.maxLengthD} mm</div>
              <div>E ≤ {metrics.segmentInfo.thresholds.maxLengthE} mm</div>
              <div>SUV H ≥ {metrics.segmentInfo.thresholds.suvMinHeightMm} mm</div>
            </div>
          </div>

          {/* Card Visualizzatore 3D CAD / Blueprint Tecnico Interattivo */}
          <Chassis3DViewport
            config={effectiveConfig}
            metrics={metrics}
            layoutRules={layoutRules}
            previewAwdAsset={previewAwdAsset}
            onTogglePreviewAwd={() => setPreviewAwdAsset((v) => !v)}
          />

          {/* Card Telemetria Strutturale & Omologazione */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-slate-300">
                <Gauge className="w-4 h-4 text-amber-400" />
                <span>Specifiche Strutturali & Costi</span>
              </div>
              {metrics.hasAwdReady && metrics.estimatedWeightDistributionAWD && (
                <div className="flex rounded-lg border border-slate-700 bg-slate-950 p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setPreviewAwdAsset(false)}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      !previewAwdAsset
                        ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    Assetto 2WD Base
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewAwdAsset(true)}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      previewAwdAsset
                        ? 'bg-amber-500/20 text-amber-300 font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    AWD Completo (+85kg)
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Rigidità Torsionale</div>
                <div className="text-sm font-bold text-emerald-400">
                  {metrics.torsionalRigidityNmPerDeg.toLocaleString('it-IT')} Nm/°
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Sicurezza Passiva</div>
                <div className="text-sm font-bold text-sky-400">
                  {metrics.structuralSafetyScore}/100
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">
                  {metrics.hasAwdReady && previewAwdAsset ? 'Peso Scocca + AWD' : 'Peso Base Scocca'}
                </div>
                <div className="text-sm font-bold text-slate-100">
                  {metrics.hasAwdReady && previewAwdAsset
                    ? metrics.baseWeightKg + metrics.awdSystemWeightKg
                    : metrics.baseWeightKg}{' '}
                  kg
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">
                  Bilanciamento Ant / Post{' '}
                  {metrics.hasAwdReady && previewAwdAsset ? '(AWD)' : '(2WD)'}
                </div>
                <div className="text-sm font-bold text-amber-300">
                  {metrics.hasAwdReady && previewAwdAsset && metrics.estimatedWeightDistributionAWD
                    ? `${metrics.estimatedWeightDistributionAWD.frontPercent}% / ${metrics.estimatedWeightDistributionAWD.rearPercent}%`
                    : `${metrics.estimatedWeightDistribution2WD.frontPercent}% / ${metrics.estimatedWeightDistribution2WD.rearPercent}%`}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 col-span-2 flex justify-between items-center text-[11px]">
                <span className="text-slate-400">
                  Delta Abitacolo/Bagagliaio:{' '}
                  <strong className="text-slate-200">
                    {metrics.cargoVolumeDeltaLiters >= 0 ? '+' : ''}
                    {metrics.cargoVolumeDeltaLiters} L
                  </strong>
                </span>
                <span className="text-slate-400">
                  Baricentro:{' '}
                  <strong className="text-slate-200">
                    {metrics.centerOfGravityDeltaMm >= 0 ? '+' : ''}
                    {metrics.centerOfGravityDeltaMm} mm
                  </strong>
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 col-span-2 flex justify-between items-center">
                <span className="text-[10px] text-slate-400">Costo Produzione Scocca:</span>
                <span className="text-sm font-bold text-emerald-300">
                  ${metrics.unitManufacturingCost.toLocaleString('it-IT')} / unità
                </span>
              </div>
            </div>

            {/* Riepilogo Delta R&D se Variante */}
            {variantRdResult && (
              <div className="p-3 rounded-xl border border-amber-500/40 bg-slate-950 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-300">
                    Variante da: {variantRdResult.parentName}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      variantRdResult.hasStructuralMoldChange
                        ? 'bg-red-950 border border-red-500 text-red-300'
                        : 'bg-emerald-950 border border-emerald-500 text-emerald-300'
                    }`}
                  >
                    {variantRdResult.hasStructuralMoldChange
                      ? 'Nuovi Stampi (95% R&D)'
                      : `-${variantRdResult.savingsPercentage}% R&D`}
                  </span>
                </div>
                {variantRdResult.structuralWarning && (
                  <div className="text-[10px] text-red-300">
                    ⚠️ {variantRdResult.structuralWarning}
                  </div>
                )}
                {variantRdResult.detectedChanges.length > 0 && (
                  <div className="text-[10px] text-slate-300 space-y-0.5 pt-1 border-t border-slate-800">
                    {variantRdResult.detectedChanges.map((c, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>• {c.label}</span>
                        <span className="text-amber-400">+{c.rdPercentage}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveChassis}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-500/10"
            >
              <Save className="w-4 h-4" />
              <span>
                {variantRdResult ? 'Omologa Evoluzione Pianale' : 'Omologa Nuovo Pianale'} (-$
                {(
                  (variantRdResult
                    ? variantRdResult.effectiveDevelopmentCost.capitalCost
                    : metrics.developmentCost.capitalCost) / 1_000_000
                ).toFixed(2)}
                M / -
                {variantRdResult
                  ? variantRdResult.effectiveDevelopmentCost.rdCost
                  : metrics.developmentCost.rdCost}{' '}
                R&D)
              </span>
            </button>
          </div>

          {/* Compatibilità Live Motori Aziendali */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 space-y-2.5 font-mono text-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Verifica Compatibilità Motori in Database ({engines.length})
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {engineCompatibilityList.map(({ engine, orientation, result }) => (
                <div
                  key={engine.id}
                  className={`p-2 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${
                    result.isCompatible
                      ? 'bg-slate-950 border-emerald-500/30 text-slate-200'
                      : 'bg-red-950/40 border-red-500/40 text-red-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-bold truncate">{engine.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {orientation} • {engine.dimensionsMm.lengthMm}×{engine.dimensionsMm.widthMm}×
                      {engine.dimensionsMm.heightMm} mm
                    </div>
                  </div>
                  {result.isCompatible ? (
                    <span className="text-emerald-400 font-bold shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> OK
                    </span>
                  ) : (
                    <span className="text-red-300 font-bold shrink-0 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> NO
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Archivio Pianali Aziendali Omologati */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider">
              Database Pianali Aziendali Omologati ({chassisList.length})
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Riutilizzabili per Modelli, Allestimenti e Generazioni
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
          {chassisList.map((chs) => (
            <div
              key={chs.id}
              className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 flex flex-col justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-100">{chs.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 shrink-0">
                    Seg. {chs.calculatedSegment}
                  </span>
                </div>
                <div className="text-[10px] text-amber-300">{chs.codeName}</div>
                <div className="text-[11px] text-slate-400">
                  {chs.overallDimensionsMm.lengthMm}×{chs.overallDimensionsMm.widthMm}×
                  {chs.overallDimensionsMm.heightMm} mm • Passo {chs.wheelbaseMm} mm
                </div>
                <div className="text-[11px] text-sky-300">
                  Vano: {chs.engineBayMaxDimensionsMm.lengthMm}×
                  {chs.engineBayMaxDimensionsMm.widthMm}×{chs.engineBayMaxDimensionsMm.heightMm} mm
                </div>
                <div className="text-[10px] text-slate-400">
                  {chs.supportedEnginePositions.join('/')} •{' '}
                  {chs.supportedEngineOrientations.join('/')} • {chs.supportedDrivetrains.join('/')}
                </div>
                <div className="text-[10px] text-emerald-400">
                  Rig. {(chs.torsionalRigidityNmPerDeg / 1000).toFixed(1)}k Nm/° • {chs.baseWeightKg}
                  kg • Sic. {chs.structuralSafetyScore}/100
                </div>
              </div>

              <div className="pt-2 border-t border-slate-900 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    startVariant({
                      type: 'chassis',
                      id: chs.id,
                      name: chs.name,
                      codeName: chs.codeName,
                      entity: chs,
                    });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-2 py-1 rounded text-[10px] font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 cursor-pointer"
                >
                  Crea Variante / Evo
                </button>
                <span className="text-[10px] text-slate-500">Gen. {chs.generationNumber}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

