import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Box,
  CheckCircle2,
  Flame,
  Gauge,
  Layers,
  Lock,
  RotateCw,
  Save,
  Settings2,
  ShieldAlert,
  Sparkles,
  Unlock,
  Wind,
  Zap,
} from 'lucide-react';
import {
  BLOCK_MATERIALS,
  CAMSHAFT_TYPES,
  CATALYST_ERAS,
  CONROD_TYPES,
  CRANKSHAFT_TYPES,
  EXHAUST_MANIFOLDS,
  FUEL_SYSTEMS,
  HEAD_MATERIALS,
  INTAKE_SYSTEMS,
  PISTON_ARCHITECTURES,
  PISTON_TYPES,
  TURBO_COUNT_CONFIGS,
  TURBO_POSITIONS,
  TURBO_SYSTEMS,
  type EnginePartOption,
  getLegalEmissionLimitForYear,
} from '../../data/historicalEras';
import {
  type PistonEngineConfigInput,
  arRatioToImpellerMm,
  calculateEngineCosts,
  calculateMaxSafeMechanicalRpm,
  calculatePistonGeometryAndDimensions,
  getActiveTurboStagesAr,
  simulatePistonEngineDyno,
} from '../../math/engineMath';
import { evaluateEngineBayCompatibility } from '../../math/volumeMath';
import { useGameStore } from '../../store/useGameStore';
import type {
  CatalystEra,
  EngineEntity,
  EngineOrientation,
  PistonArchitecture,
  PriceTier,
  ReferenceClass,
  TurboCountConfig,
  TurboPosition,
  TurboType,
} from '../../types/gameTypes';
import { TelemetryCanvas2D } from '../common/TelemetryCanvas2D';
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

export interface PistonEngineDesigner1AProps {
  onSwitchToWankel?: () => void;
  onSwitchToElectricHybrid?: () => void;
}

export const PistonEngineDesigner1A: React.FC<PistonEngineDesigner1AProps> = ({
  onSwitchToWankel,
  onSwitchToElectricHybrid,
}) => {
  const {
    currentYear,
    subBrands,
    chassisList,
    engines,
    unlockedEnginePartIds,
    unlockEnginePart,
    saveEngineToDatabase,
    toggleEngineB2B,
    setLivePistonDraft,
  } = useGameStore();

  // Metadati motore
  const [engineName, setEngineName] = useState('2.9L V6 90° Bi-Turbo Stradale');
  const [codeName, setCodeName] = useState('Tipo 690-QV');
  const [ownerSubBrandId, setOwnerSubBrandId] = useState(
    subBrands[0]?.id ?? 'sb-officine-milano',
  );

  // Configurazione completa 1A (Endotermici a Pistoni) con i 16 fix ingegneristici
  const [config, setConfig] = useState<PistonEngineConfigInput>({
    architecture: 'V',
    bankAngleDeg: 90,
    cylinders: 6,
    boreMm: 86.5,
    strokeMm: 82.0,
    valvesPerCylinder: 4,
    compressionRatio: 9.3,
    manualRedlineRpm: 6800,
    blockMaterialId: 'blk-alu-forged-nikasil',
    headMaterialId: 'hd-alu-t6',
    pistonTypeId: 'pst-forged-oiljet',
    conrodTypeId: 'rod-c70-fractured',
    crankshaftTypeId: 'crk-forged-nitrided',
    camshaftTypeId: 'cam-dohc-vvt',
    fuelType: 'Benzina',
    fuelSystemId: 'fs-gdi-350bar',
    intakeSystemId: 'int-plenum-short',
    exhaustManifoldId: 'exh-inconel',
    turboType: 'TwinScroll',
    turboCountConfig: 'TwinTurbo',
    turboBearingType: 'BallBearing',
    turboArRatio: 0.65,
    turboStagesArRatios: [0.65, 0.65, 0.65, 0.65],
    boostPressureBar: 1.35,
    turboPosition: 'HotV',
    catalystEra: 'Era4_ActiveGlobalFilter_Euro7',
    intendedOrientation: 'Longitudinale',
    priceTier: 'Premium',
    referenceClass: 'Sport',
  });

  // Punto 11: Checkbox multiple per sovrapporre più pianali contemporaneamente nel CAD 3D
  const [selectedChassisIds, setSelectedChassisIds] = useState<string[]>(() =>
    chassisList.slice(0, 2).map((c) => c.id),
  );

  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);

  const archSpec =
    PISTON_ARCHITECTURES.find((a) => a.id === config.architecture) ?? PISTON_ARCHITECTURES[0];
  const currentCamSpec =
    CAMSHAFT_TYPES.find((c) => c.id === config.camshaftTypeId) ?? CAMSHAFT_TYPES[2];

  // Limite critico fisico di rotazione (Punto 10)
  const maxSafeMechanicalRpm = useMemo(
    () => calculateMaxSafeMechanicalRpm(config),
    [config],
  );

  // Calcolo istantaneo geometria (cilindrata unitaria/totale, S/B, ingombro 3D LWH in mm)
  const geometry = useMemo(
    () => calculatePistonGeometryAndDimensions(config),
    [config],
  );

  // Calcolo istantaneo costi unitari, costo sistema turbo e costo sviluppo R&D + Capitale
  const costs = useMemo(() => calculateEngineCosts(config), [config]);

  // Calcolo istantaneo telemetria Banco Prova (basata su BMEP reale)
  const telemetry = useMemo(() => simulatePistonEngineDyno(config), [config]);

  // Sincronizza la bozza live della Tab 1A con lo store per il test dei sistemi Ibridi nella Tab 1C
  useEffect(() => {
    setLivePistonDraft({
      id: 'live-piston-1a',
      sourceKind: 'LivePiston1A',
      name: `${engineName} (Tab 1A Live)`,
      codeName: codeName || 'PRJ-1A',
      propulsionType: 'Piston_1A',
      architectureLabel: `${geometry.displacementLiters}L ${config.architecture}${config.cylinders} (${config.fuelType})`,
      displacementCc: geometry.totalDisplacementCc,
      displacementLiters: geometry.displacementLiters,
      cylindersOrRotors: config.cylinders,
      fuelType: config.fuelType,
      isTurbo: config.turboType !== 'NaturallyAspirated',
      peakPowerHp: telemetry.peakPowerHp,
      peakPowerRpm: telemetry.peakPowerRpm,
      peakTorqueNm: telemetry.peakTorqueNm,
      peakTorqueRpm: telemetry.peakTorqueRpm,
      redlineRpm: telemetry.redlineRpm,
      dryWeightKg: telemetry.dryWeightKg,
      wetWeightKg: telemetry.wetWeightKg,
      dimensionsMm: geometry.dimensionsMm,
      emissionsGPerKm: telemetry.emissionsGPerKm,
      reliabilityPercent: telemetry.reliabilityPercent,
      estimatedLifespanKm: telemetry.estimatedLifespanKm,
      unitProductionCost: telemetry.unitProductionCost,
      curve: telemetry.curve,
    });
  }, [
    engineName,
    codeName,
    config.architecture,
    config.cylinders,
    config.fuelType,
    config.turboType,
    geometry,
    telemetry,
    setLivePistonDraft,
  ]);

  // Verifica ingombro in tempo reale su tutti i Pianali aziendali
  const chassisCompatibilityList = useMemo(
    () =>
      chassisList.map((ch) => ({
        chassis: ch,
        result: evaluateEngineBayCompatibility(
          geometry.dimensionsMm,
          config.intendedOrientation,
          ch,
        ),
      })),
    [chassisList, geometry.dimensionsMm, config.intendedOrientation],
  );

  // Pianali attualmente spuntati per la sovrapposizione nel visualizzatore Three.js
  const overlaidChassisBays: OverlaidChassisBayItem[] = useMemo(
    () =>
      chassisCompatibilityList
        .filter((item) => selectedChassisIds.includes(item.chassis.id))
        .map(({ chassis, result }) => ({
          id: chassis.id,
          name: chassis.name,
          codeName: chassis.codeName,
          bayDimensionsMm: chassis.engineBayMaxDimensionsMm,
          isCompatible: result.isCompatible,
          orientationConflict: result.orientationConflict,
        })),
    [chassisCompatibilityList, selectedChassisIds],
  );

  // Dimensioni effettive del motore orientato nel vano (scambia L e W se Trasversale)
  const effectiveEngineInBayMm = useMemo(
    () =>
      config.intendedOrientation === 'Trasversale'
        ? {
            lengthMm: geometry.dimensionsMm.widthMm,
            widthMm: geometry.dimensionsMm.lengthMm,
            heightMm: geometry.dimensionsMm.heightMm,
          }
        : geometry.dimensionsMm,
    [config.intendedOrientation, geometry.dimensionsMm],
  );

  // Soglia emissioni legale per l'anno corrente
  const legalEmissionLimit = getLegalEmissionLimitForYear(currentYear);
  const exceedsEmissionLaw = telemetry.emissionsGPerKm > legalEmissionLimit;

  // Verifica se Hot-V è fisicamente possibile (richiede V o W con angolo compreso tra 60° e 120°)
  const canUseHotV =
    (config.architecture === 'V' || config.architecture === 'W') &&
    config.bankAngleDeg >= 60 &&
    config.bankAngleDeg <= 120;

  // Cambio architettura con adeguamento automatico di cilindri, angolo bancate, numero turbine e Hot-V
  const handleArchitectureChange = (newArch: PistonArchitecture) => {
    const spec =
      PISTON_ARCHITECTURES.find((a) => a.id === newArch) ?? PISTON_ARCHITECTURES[0];
    const validCyl = spec.supportedCylinders.includes(config.cylinders)
      ? config.cylinders
      : spec.supportedCylinders[Math.min(2, spec.supportedCylinders.length - 1)];
    const validAngle = spec.supportedBankAnglesDeg.includes(config.bankAngleDeg)
      ? config.bankAngleDeg
      : spec.supportedBankAnglesDeg[0];
    const hotVAllowed =
      (newArch === 'V' || newArch === 'W') && validAngle >= 60 && validAngle <= 120;
    const validTurboPos: TurboPosition =
      config.turboPosition === 'HotV' && !hotVAllowed
        ? 'Lateral'
        : config.turboPosition;

    const currentTurboCountSpec = TURBO_COUNT_CONFIGS.find(
      (tc) => tc.id === config.turboCountConfig,
    );
    const validTurboCount: TurboCountConfig =
      currentTurboCountSpec && validCyl >= currentTurboCountSpec.minCylinders
        ? config.turboCountConfig
        : 'SingleTurbo';

    setConfig((prev) => ({
      ...prev,
      architecture: newArch,
      cylinders: validCyl,
      bankAngleDeg: validAngle,
      turboPosition: validTurboPos,
      turboCountConfig: validTurboCount,
    }));
  };

  // Cambio numero cilindri con validazione numero turbine (Punto 2)
  const handleCylinderChange = (cyl: number) => {
    const currentTurboCountSpec = TURBO_COUNT_CONFIGS.find(
      (tc) => tc.id === config.turboCountConfig,
    );
    const validTurboCount: TurboCountConfig =
      currentTurboCountSpec && cyl >= currentTurboCountSpec.minCylinders
        ? config.turboCountConfig
        : 'SingleTurbo';

    setConfig((prev) => ({
      ...prev,
      cylinders: cyl,
      turboCountConfig: validTurboCount,
    }));
  };

  // Cambio angolo bancate con controllo Hot-V (un V180° Flat-V o V15° non può ospitare turbine dentro la V)
  const handleBankAngleChange = (deg: number) => {
    const hotVAllowed = deg >= 60 && deg <= 120;
    setConfig((prev) => ({
      ...prev,
      bankAngleDeg: deg,
      turboPosition:
        prev.turboPosition === 'HotV' && !hotVAllowed ? 'Lateral' : prev.turboPosition,
    }));
  };

  // Cambio carburante con selezione automatica di un sistema di alimentazione compatibile
  const handleFuelTypeChange = (newFuel: PistonEngineConfigInput['fuelType']) => {
    const compatibleSystems = FUEL_SYSTEMS.filter((fs) =>
      fs.supportedFuels.includes(newFuel),
    );
    const currentStillValid = compatibleSystems.some(
      (fs) => fs.id === config.fuelSystemId,
    );
    const nextFuelSysId = currentStillValid
      ? config.fuelSystemId
      : (compatibleSystems[0]?.id ?? FUEL_SYSTEMS[0].id);

    const nextCompression =
      newFuel === 'Diesel'
        ? Math.max(15.5, config.compressionRatio)
        : Math.min(
            12.5,
            config.compressionRatio > 14 ? 9.5 : config.compressionRatio,
          );

    const nextManualRpm =
      newFuel === 'Diesel'
        ? Math.min(4600, config.manualRedlineRpm)
        : config.manualRedlineRpm < 5000
          ? 6500
          : config.manualRedlineRpm;

    setConfig((prev) => ({
      ...prev,
      fuelType: newFuel,
      fuelSystemId: nextFuelSysId,
      compressionRatio: nextCompression,
      manualRedlineRpm: nextManualRpm,
    }));
  };

  // Helper per sbloccare o selezionare una componente base motore (con vincolo valvole Punto 3)
  const handleSelectOrUnlockPart = (
    field: keyof PistonEngineConfigInput,
    part: {
      id: string;
      name: string;
      unlockCost: { capitalCost: number; rdCost: number; minYear?: number };
    },
  ) => {
    const applySelection = () => {
      setConfig((prev) => {
        const next = { ...prev, [field]: part.id };
        // Punto 3: Se cambia l'albero a camme (OHV / SOHC / DOHC), applica il vincolo meccanico sulle valvole!
        if (field === 'camshaftTypeId') {
          const camObj = CAMSHAFT_TYPES.find((c) => c.id === part.id);
          if (
            camObj &&
            !camObj.supportedValvesPerCylinder.includes(prev.valvesPerCylinder)
          ) {
            next.valvesPerCylinder =
              camObj.supportedValvesPerCylinder[
                camObj.supportedValvesPerCylinder.length - 1
              ];
          }
        }
        return next;
      });
    };

    const isUnlocked = unlockedEnginePartIds.includes(part.id);
    if (isUnlocked) {
      applySelection();
      return;
    }

    const res = unlockEnginePart(part.id, part.name, part.unlockCost);
    if (!res.allowed) {
      setFeedbackBanner({
        type: 'err',
        msg: res.reason ?? 'Impossibile sbloccare la componente motore.',
      });
    } else {
      applySelection();
      setFeedbackBanner({
        type: 'ok',
        msg: `Componente sbloccata: ${part.name} (-$${part.unlockCost.capitalCost.toLocaleString('it-IT')} / -${part.unlockCost.rdCost} R&D)`,
      });
    }
  };

  const toggleChassisOverlay = (chassisId: string) => {
    setSelectedChassisIds((prev) =>
      prev.includes(chassisId)
        ? prev.filter((id) => id !== chassisId)
        : [...prev, chassisId],
    );
  };

  // Salvataggio ed omologazione del motore nel database
  const handleSaveEngine = () => {
    const blockObj =
      BLOCK_MATERIALS.find((b) => b.id === config.blockMaterialId) ?? BLOCK_MATERIALS[0];
    const headObj =
      HEAD_MATERIALS.find((h) => h.id === config.headMaterialId) ?? HEAD_MATERIALS[0];
    const pistonObj =
      PISTON_TYPES.find((p) => p.id === config.pistonTypeId) ?? PISTON_TYPES[0];
    const conrodObj =
      CONROD_TYPES.find((r) => r.id === config.conrodTypeId) ?? CONROD_TYPES[0];
    const crankObj =
      CRANKSHAFT_TYPES.find((c) => c.id === config.crankshaftTypeId) ??
      CRANKSHAFT_TYPES[0];
    const camObj =
      CAMSHAFT_TYPES.find((c) => c.id === config.camshaftTypeId) ?? CAMSHAFT_TYPES[0];
    const fuelSysObj =
      FUEL_SYSTEMS.find((f) => f.id === config.fuelSystemId) ?? FUEL_SYSTEMS[0];
    const intakeObj =
      INTAKE_SYSTEMS.find((i) => i.id === config.intakeSystemId) ?? INTAKE_SYSTEMS[0];
    const exhaustObj =
      EXHAUST_MANIFOLDS.find((e) => e.id === config.exhaustManifoldId) ??
      EXHAUST_MANIFOLDS[0];

    const newEngine: EngineEntity = {
      id: `eng-${Date.now()}`,
      name:
        engineName.trim() ||
        `${geometry.displacementLiters}L ${config.architecture}${config.cylinders}`,
      codeName: codeName.trim() || `PRJ-${config.cylinders}${config.boreMm}`,
      ownerSubBrandId,
      createdYear: currentYear,
      propulsionType: 'Piston_1A',
      taxonomy: {
        priceTier: config.priceTier,
        referenceClass: config.referenceClass,
        materialStress: {
          materialName: `${blockObj.name} + ${pistonObj.name}`,
          materialResistanceFactor: blockObj.materialResistance,
          mechanicalStressFactor: blockObj.stressFactor,
        },
        estimatedDurabilityKm: telemetry.estimatedLifespanKm,
      },
      dimensionsMm: geometry.dimensionsMm,
      pistonSpecs: {
        architecture: config.architecture,
        bankAngleDeg: config.bankAngleDeg,
        cylinders: config.cylinders,
        boreMm: config.boreMm,
        strokeMm: config.strokeMm,
        unitDisplacementCc: geometry.unitDisplacementCc,
        totalDisplacementCc: geometry.totalDisplacementCc,
        strokeBoreRatio: geometry.strokeBoreRatio,
        blockMaterial: blockObj.name,
        headMaterial: headObj.name,
        pistonType: pistonObj.name,
        conrodType: conrodObj.name,
        crankshaftType: crankObj.name,
        camshaftType: camObj.name,
        valvesPerCylinder: config.valvesPerCylinder,
        fuelType: config.fuelType,
        fuelSystem: fuelSysObj.name,
        intakeSystem: intakeObj.name,
        exhaustManifold: exhaustObj.name,
        turboType: config.turboType,
        turboCountConfig: config.turboCountConfig,
        turboBearingType: config.turboBearingType,
        turboArRatio: config.turboArRatio,
        turboStagesArRatios: getActiveTurboStagesAr(config),
        boostPressureBar: config.boostPressureBar,
        compressionRatio: config.compressionRatio,
        manualRedlineRpm: telemetry.redlineRpm,
        intendedOrientation: config.intendedOrientation,
        turboPosition: config.turboPosition,
        catalystEra: config.catalystEra,
      },
      telemetry,
      b2bSaleEnabled: true,
      b2bUnitsSold: 0,
      developmentCost: costs.developmentCost,
    };

    const res = saveEngineToDatabase(newEngine);
    if (!res.allowed) {
      setFeedbackBanner({
        type: 'err',
        msg: res.reason ?? 'Risorse insufficienti per omologare il motore.',
      });
    } else {
      setFeedbackBanner({
        type: 'ok',
        msg: `Motore "${newEngine.name}" (${newEngine.codeName}) omologato e registrato nel Database aziendale!`,
      });
    }
  };

  const renderPartSelector = (
    label: string,
    field: keyof PistonEngineConfigInput,
    selectedId: string,
    options: EnginePartOption[],
  ) => (
    <div className="space-y-1.5">
      <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {options.map((opt) => {
          const isUnlocked = unlockedEnginePartIds.includes(opt.id);
          const isSelected = selectedId === opt.id;
          const yearLocked = currentYear < opt.minYear;

          return (
            <button
              type="button"
              key={opt.id}
              onClick={() => handleSelectOrUnlockPart(field, opt)}
              className={`w-full text-left p-2.5 rounded-lg border font-mono text-xs transition cursor-pointer flex items-center justify-between gap-2 ${
                isSelected
                  ? 'bg-amber-500/15 border-amber-500 text-slate-100'
                  : isUnlocked
                    ? 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                    : yearLocked
                      ? 'bg-slate-950/40 border-slate-900 text-slate-500 opacity-65'
                      : 'bg-slate-950/80 border-sky-900/60 hover:border-sky-500/60 text-slate-300'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  {isUnlocked ? (
                    <Unlock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  )}
                  <span className="font-bold">{opt.name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-slate-400">
                    {opt.minYear}+
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 pl-5">{opt.description}</p>
              </div>

              <div className="text-right shrink-0 text-[10px] space-y-0.5">
                {isUnlocked ? (
                  <>
                    <div className="text-emerald-400 font-semibold">
                      Base ${opt.unitCost} •{' '}
                      {opt.bmepDeltaBar >= 0
                        ? `+${opt.bmepDeltaBar.toFixed(1)}`
                        : opt.bmepDeltaBar.toFixed(1)}{' '}
                      bar
                    </div>
                    <div className="text-slate-400">
                      {opt.rpmDelta >= 0 ? `+${opt.rpmDelta}` : opt.rpmDelta} rpm
                    </div>
                  </>
                ) : (
                  <div className="px-2 py-1 rounded bg-sky-950 border border-sky-700 text-sky-200 font-bold">
                    SBLOCCA: ${(opt.unlockCost.capitalCost / 1_000_000).toFixed(1)}M +{' '}
                    {opt.unlockCost.rdCost} R&D
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const compatibleFuelSystems = FUEL_SYSTEMS.filter((fs) =>
    fs.supportedFuels.includes(config.fuelType),
  );

  const clampedManualRpm = Math.min(maxSafeMechanicalRpm, config.manualRedlineRpm);
  const safeRpmReference = Math.min(
    config.fuelType === 'Diesel' ? 5800 : 11000,
    maxSafeMechanicalRpm,
  );
  const rpmSafetyBuffer = safeRpmReference - clampedManualRpm;

  return (
    <div className="space-y-6">
      {/* Selettore Sotto-Moduli Fase 1 (1A Attivo, 1B e 1C programmati) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-2">
            <Flame className="w-4 h-4" />
            <span>1A — Endotermici a Pistoni (Fisica BMEP Reale)</span>
          </div>
          {onSwitchToWankel ? (
            <button
              type="button"
              onClick={onSwitchToWankel}
              className="px-3.5 py-2 rounded-lg bg-slate-900 border border-amber-500/40 text-amber-300 hover:text-amber-200 hover:bg-slate-800 text-xs font-mono flex items-center gap-1.5 cursor-pointer transition shadow-sm"
            >
              <RotateCw className="w-3.5 h-3.5 text-amber-400" />
              <span>1B — Rotativi Wankel (Fase 1.3 Attiva)</span>
            </button>
          ) : (
            <div className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 text-xs font-mono flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>1B — Rotativi Wankel (Fase 1.3 Attiva)</span>
            </div>
          )}
          {onSwitchToElectricHybrid ? (
            <button
              type="button"
              onClick={onSwitchToElectricHybrid}
              className="px-3.5 py-2 rounded-lg bg-slate-900 border border-sky-500/40 text-sky-300 hover:text-sky-200 hover:bg-slate-800 text-xs font-mono flex items-center gap-1.5 cursor-pointer transition shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 text-sky-400" />
              <span>1C — Elettrici & Ibridi (Fase 1.4 Attiva)</span>
            </button>
          ) : (
            <div className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 text-xs font-mono flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>1C — Elettrici & Ibridi (Fase 1.4 Attiva)</span>
            </div>
          )}
        </div>

        {/* Riepilogo sintetico cilindrata, BMEP e ingombro */}
        <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
          <span className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-amber-300 font-bold">
            {geometry.totalDisplacementCc.toLocaleString('it-IT')} cc ({geometry.displacementLiters}
            L) • {config.architecture}
            {config.cylinders}
          </span>
          <span className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-emerald-300 font-bold">
            BMEP Max: {telemetry.peakBmepBar} bar
          </span>
          <span className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-sky-300 font-bold">
            LWH Motore: {geometry.dimensionsMm.lengthMm}×{geometry.dimensionsMm.widthMm}×
            {geometry.dimensionsMm.heightMm} mm
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
            className="text-[10px] underline cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      )}

      {/* Griglia Principale: Sinistra Configuratore Ingegneristico (7 col), Destra Banco Prova + CAD 3D Multi-Pianale (5 col) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* COLONNA SINISTRA: PROGETTAZIONE MECCANICA 1A */}
        <div className="xl:col-span-7 space-y-6">
          {/* Blocco 1: Identità, Tassonomia (Lusso > Premium) & Packaging Longitudinale vs Trasversale */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  1. Identità Progetto, Tassonomia & Packaging Vano
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-400">Anno R&D: {currentYear}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">Nome Commerciale Motore</label>
                <input
                  type="text"
                  value={engineName}
                  onChange={(e) => setEngineName(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Sigla Tecnica / Progetto</label>
                <input
                  type="text"
                  value={codeName}
                  onChange={(e) => setCodeName(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Sotto-Brand Proprietario</label>
                <select
                  value={ownerSubBrandId}
                  onChange={(e) => setOwnerSubBrandId(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100"
                >
                  {subBrands.map((sb) => (
                    <option key={sb.id} value={sb.id}>
                      {sb.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">
                  Fascia di Prezzo (Tolleranze: Economica &lt; Media &lt; Premium &lt; Lusso)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {PRICE_TIERS.map((tier) => (
                    <button
                      type="button"
                      key={tier}
                      onClick={() => setConfig((p) => ({ ...p, priceTier: tier }))}
                      className={`py-2 px-2 rounded border text-[11px] cursor-pointer transition ${
                        config.priceTier === tier
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">
                  Classe di Riferimento (&apos;Corsa&apos; sblocca 44 bar BMEP ma abbatte i km)
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {REFERENCE_CLASSES.map((cls) => (
                    <button
                      type="button"
                      key={cls}
                      onClick={() =>
                        setConfig((p) => ({ ...p, referenceClass: cls }))
                      }
                      className={`py-2 px-1 rounded border text-[11px] cursor-pointer transition ${
                        config.referenceClass === cls
                          ? cls === 'Corsa'
                            ? 'bg-rose-500/25 border-rose-500 text-rose-300 font-bold'
                            : 'bg-sky-500/20 border-sky-400 text-sky-200 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Punto 6: Predisposizione Montaggio Longitudinale vs Trasversale */}
            <div className="pt-2 border-t border-slate-800 text-xs font-mono">
              <label className="block text-slate-400 mb-1.5 uppercase text-[11px]">
                Predisposizione e Packaging di Montaggio nel Vano Motore
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {(
                  [
                    {
                      id: 'Longitudinale' as EngineOrientation,
                      title: 'Montaggio Longitudinale',
                      desc: 'Costo R&D Base (1.0x) • Ausiliari stretti (-15mm W, +18mm L) • Per pianali RWD/AWD longitudinali.',
                    },
                    {
                      id: 'Trasversale' as EngineOrientation,
                      title: 'Montaggio Trasversale (+8% R&D)',
                      desc: 'Costo R&D Packaging +8% • Cinghie compattate (-15mm L, +22mm W) • Ruota il motore di 90° nel vano.',
                    },
                  ]
                ).map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() =>
                      setConfig((p) => ({ ...p, intendedOrientation: item.id }))
                    }
                    className={`p-3 rounded-lg border text-left cursor-pointer transition ${
                      config.intendedOrientation === item.id
                        ? 'bg-sky-500/20 border-sky-400 text-slate-100'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-sky-300">{item.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Blocco 2: Architettura (In linea, V 15°-180° Flat-V, Boxer Puro, W), Alesaggio, Corsa & Limitatore Manuale RPM */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  2. Geometria 3D Reale, Alesaggio/Corsa & Limitatore RPM
                </h2>
              </div>
              <span className="text-xs font-mono text-amber-300 font-bold">
                {geometry.geometryTypeLabel} (S/B: {geometry.strokeBoreRatio})
              </span>
            </div>

            {/* Selettore Architettura: In linea, V (15°-180°), Boxer Puro, W */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs font-mono">
              {PISTON_ARCHITECTURES.map((arch) => (
                <button
                  type="button"
                  key={arch.id}
                  onClick={() => handleArchitectureChange(arch.id)}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                    config.architecture === arch.id
                      ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>{arch.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                      Costo Prod. {arch.productionComplexityMultiplier}x • R&D{' '}
                      {arch.rdComplexityMultiplier}x
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">{arch.description}</div>
                </button>
              ))}
            </div>

            {/* Numero Cilindri e Angolo Bancate (incluso 180° Flat-V per architettura V!) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1.5">
                  Numero Cilindri ({archSpec.label})
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {archSpec.supportedCylinders.map((cyl) => (
                    <button
                      type="button"
                      key={cyl}
                      onClick={() => handleCylinderChange(cyl)}
                      className={`px-3 py-1.5 rounded border font-bold cursor-pointer ${
                        config.cylinders === cyl
                          ? 'bg-sky-500 text-slate-950 border-sky-400'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {cyl} Cil.
                    </button>
                  ))}
                </div>
              </div>

              {(config.architecture === 'V' || config.architecture === 'W') && (
                <div>
                  <label className="block text-slate-400 mb-1.5">
                    Angolo Bancate (Proiezione $\sin/\cos$ su Larghezza W e Altezza H)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {archSpec.supportedBankAnglesDeg.map((deg) => (
                      <button
                        type="button"
                        key={deg}
                        onClick={() => handleBankAngleChange(deg)}
                        className={`px-2.5 py-1.5 rounded border font-bold cursor-pointer ${
                          config.bankAngleDeg === deg
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {deg === 180
                          ? '180° (Flat-V)'
                          : deg === 15
                            ? '15° (VR)'
                            : `${deg}°`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Slider Alesaggio, Corsa e Rapporto di Compressione */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Alesaggio (Bore)</span>
                  <span className="text-amber-300 font-bold">
                    {config.boreMm.toFixed(1)} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={62}
                  max={112}
                  step={0.5}
                  value={config.boreMm}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, boreMm: Number(e.target.value) }))
                  }
                  className="w-full"
                />
                <div className="text-[10px] text-slate-500 flex justify-between">
                  <span>62 mm</span>
                  <span>112 mm</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Corsa (Stroke)</span>
                  <span className="text-sky-300 font-bold">
                    {config.strokeMm.toFixed(1)} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={52}
                  max={120}
                  step={0.5}
                  value={config.strokeMm}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, strokeMm: Number(e.target.value) }))
                  }
                  className="w-full"
                />
                <div className="text-[10px] text-slate-500 flex justify-between">
                  <span>52 mm (Corsa Corta)</span>
                  <span>120 mm (Corsa Lunga)</span>
                </div>
              </div>

              <div
                className={`p-3 rounded-lg bg-slate-950 border space-y-1.5 ${
                  telemetry.knockWarning?.isKnocking
                    ? 'border-red-500 bg-red-950/30'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex justify-between">
                  <span className="text-slate-400">Rapp. Compressione</span>
                  <span
                    className={`font-bold ${
                      telemetry.knockWarning?.isKnocking
                        ? 'text-red-400'
                        : 'text-emerald-300'
                    }`}
                  >
                    {config.compressionRatio.toFixed(1)}:1
                  </span>
                </div>
                <input
                  type="range"
                  min={config.fuelType === 'Diesel' ? 14.0 : 7.0}
                  max={config.fuelType === 'Diesel' ? 22.0 : 16.0}
                  step={0.1}
                  value={config.compressionRatio}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      compressionRatio: Number(e.target.value),
                    }))
                  }
                  className="w-full"
                />
                <div className="text-[10px] flex justify-between">
                  <span className="text-slate-500">
                    {config.fuelType === 'Diesel' ? '14.0:1' : '7.0:1 (Alto Boost)'}
                  </span>
                  <span
                    className={
                      telemetry.knockWarning?.isKnocking
                        ? 'text-red-400 font-bold'
                        : 'text-emerald-400'
                    }
                  >
                    Max sicuro: {telemetry.knockWarning?.maxSafeCr ?? 11.0}:1
                  </span>
                </div>
              </div>
            </div>

            {/* Avviso Detonazione / Battito in Testa (Knock) se il Rapporto di Compressione supera la soglia anti-knock */}
            {telemetry.knockWarning?.isKnocking && (
              <div className="p-3 rounded-xl bg-red-950/85 border border-red-500 text-red-100 text-xs font-mono flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <div>
                    <div className="font-bold text-red-300">
                      ALLARME DETONAZIONE (KNOCK / BATTITO IN TESTA) — CR{' '}
                      {config.compressionRatio.toFixed(1)}:1 oltre limite sicuro (
                      {telemetry.knockWarning.maxSafeCr}:1)
                    </div>
                    <div className="text-[11px] text-red-200">
                      Taglio centralina: -{telemetry.knockWarning.powerPenaltyPercent}% Potenza/Coppia e -
                      {telemetry.knockWarning.reliabilityPenaltyPercent}% Affidabilità! Riduci il
                      Rapporto di Compressione, abbassa il Boost o usa BioFuel/Carburante Gara.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Punto 4 (Fix): Caratteristica fisica di erogazione, inerzia e attriti dell'Architettura selezionata */}
            <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-400">
                Caratteristica Erogazione Architettura{' '}
                <strong className="text-amber-300">
                  {config.architecture === 'V' && config.bankAngleDeg === 15
                    ? 'VR (V Stretta 15° — Testata Unica)'
                    : config.architecture === 'V' && config.bankAngleDeg === 180
                      ? 'V 180° (Flat-V — Perni Condivisi)'
                      : archSpec.label}
                </strong>
                :
              </span>
              <span className="text-sky-300 font-semibold">
                {config.architecture === 'Inline' &&
                  (config.cylinders <= 6
                    ? 'Condotti pari lunghezza (+1.8% schiena ai medi • Ottima fluidodinamica)'
                    : 'Albero lungo (>6 cil.): -350 rpm limite torsionale • Ottima coppia ai medi')}
                {config.architecture === 'Boxer' &&
                  'Equilibratura perfetta 1°/2° ordine: +300 rpm sicuri, +2.2% affidabilità, baricentro bassissimo'}
                {config.architecture === 'V' &&
                  config.bankAngleDeg === 15 &&
                  'Testata unica compatta con condotti disuguali: +2.5% coppia ai bassi, -3.5% VE agli alti RPM'}
                {config.architecture === 'V' &&
                  config.bankAngleDeg !== 15 &&
                  'Albero corto e rigido: +150 rpm sicuri e +2.2% potenza di picco agli alti regimi'}
                {config.architecture === 'W' &&
                  '4 bancate ultra-compatte: maggiori attriti e calore interno (-3.0% efficienza termica e alti RPM)'}
              </span>
            </div>

            {/* Punto 10: Slider Limitatore di Giri (RPM) Manuale */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-slate-300 font-bold uppercase">
                    Limitatore di Giri Manuale (RPM):{' '}
                  </span>
                  <span className="text-rose-400 font-bold text-sm">
                    {telemetry.redlineRpm} rpm
                  </span>
                </div>
                <div className="text-[11px]">
                  <span className="text-slate-400">
                    Limite Critico Rottura Meccanica:{' '}
                  </span>
                  <span className="text-amber-300 font-bold">
                    {maxSafeMechanicalRpm} rpm
                  </span>
                  <span
                    className={`ml-2 px-2 py-0.5 rounded font-bold ${
                      rpmSafetyBuffer >= 600
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : rpmSafetyBuffer >= 200
                          ? 'bg-amber-950 text-amber-300 border border-amber-700'
                          : 'bg-red-950 text-red-300 border border-red-600'
                    }`}
                  >
                    {rpmSafetyBuffer >= 600
                      ? `Margine Sicuro (-${rpmSafetyBuffer} rpm = +Vita km)`
                      : rpmSafetyBuffer >= 200
                        ? `Margine Sportivo (-${rpmSafetyBuffer} rpm)`
                        : rpmSafetyBuffer < 0
                          ? `Oltre Soglia 11k (+${Math.abs(rpmSafetyBuffer)} rpm = -Affidabilità)`
                          : 'Al Limite Critico (-Affidabilità)'}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={3200}
                max={maxSafeMechanicalRpm}
                step={100}
                value={clampedManualRpm}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    manualRedlineRpm: Number(e.target.value),
                  }))
                }
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>3.200 rpm (Conservativo / Lunga Durata)</span>
                <span>
                  Limite Fisico Attuale: {maxSafeMechanicalRpm} rpm (calcolato da corsa e
                  masse alterne)
                </span>
              </div>
            </div>

            {/* Riepilogo Calcoli Geometrici e Ingombro LWH */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1 font-mono text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">CILINDRATA UNITARIA</div>
                <div className="text-sm font-bold text-slate-100">
                  {geometry.unitDisplacementCc} cm³ / cil.
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">CILINDRATA TOTALE</div>
                <div className="text-sm font-bold text-amber-400">
                  {geometry.totalDisplacementCc.toLocaleString('it-IT')} cm³ (
                  {geometry.displacementLiters}L)
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">CORSA / ALESAGGIO</div>
                <div className="text-sm font-bold text-sky-300">
                  {geometry.strokeBoreRatio} (
                  {geometry.strokeBoreRatio < 0.95
                    ? 'Superquadro'
                    : geometry.strokeBoreRatio > 1.05
                      ? 'Sottoquadro'
                      : 'Quadro'}
                  )
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">
                  INGOMBRO NATIVO 3D (L×W×H)
                </div>
                <div className="text-sm font-bold text-emerald-300">
                  {geometry.dimensionsMm.lengthMm}×{geometry.dimensionsMm.widthMm}×
                  {geometry.dimensionsMm.heightMm} mm
                </div>
              </div>
            </div>
          </div>

          {/* Blocco 3: Componentistica Base Motore & Vincolo Meccanico Valvole vs Camme (Punto 3) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  3. Componentistica Base Motore & Vincolo Valvole/Camme
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Sblocco Doppia Valuta ($ + R&D)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {renderPartSelector(
                'Materiale Monoblocco',
                'blockMaterialId',
                config.blockMaterialId,
                BLOCK_MATERIALS,
              )}
              {renderPartSelector(
                'Materiale Testa Cilindro',
                'headMaterialId',
                config.headMaterialId,
                HEAD_MATERIALS,
              )}
              {renderPartSelector(
                'Pistoni',
                'pistonTypeId',
                config.pistonTypeId,
                PISTON_TYPES,
              )}
              {renderPartSelector(
                'Bielle',
                'conrodTypeId',
                config.conrodTypeId,
                CONROD_TYPES,
              )}
              {renderPartSelector(
                'Albero a Gomiti',
                'crankshaftTypeId',
                config.crankshaftTypeId,
                CRANKSHAFT_TYPES,
              )}
              {renderPartSelector(
                'Albero a Camme & Distribuzione (Governa Valvole Max)',
                'camshaftTypeId',
                config.camshaftTypeId,
                CAMSHAFT_TYPES,
              )}
            </div>

            {/* Punto 3: Vincolo Meccanico Valvole per Cilindro in funzione di OHV / SOHC / DOHC */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
              <div className="space-y-0.5">
                <div className="text-slate-200 font-bold uppercase">
                  Numero Valvole per Cilindro (Totale:{' '}
                  {config.valvesPerCylinder * config.cylinders} Valvole)
                </div>
                <div className="text-[10px] text-slate-400">
                  Vincolo {currentCamSpec.name}: supporta{' '}
                  <strong className="text-amber-300">
                    {currentCamSpec.supportedValvesPerCylinder.join(', ')} valvole/cil.
                  </strong>{' '}
                  • Più valvole aumentano massa testata (+kg) e ingombro H/W.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[2, 3, 4, 5].map((vCount) => {
                  const allowed =
                    currentCamSpec.supportedValvesPerCylinder.includes(vCount);
                  const active = config.valvesPerCylinder === vCount;
                  return (
                    <button
                      type="button"
                      key={vCount}
                      disabled={!allowed}
                      onClick={() =>
                        setConfig((p) => ({ ...p, valvesPerCylinder: vCount }))
                      }
                      title={
                        !allowed
                          ? `Combinazione meccanicamente impossibile con ${currentCamSpec.name}`
                          : `${vCount} valvole per cilindro`
                      }
                      className={`px-3.5 py-2 rounded-lg border font-bold transition ${
                        !allowed
                          ? 'bg-slate-900/40 border-slate-900 text-slate-600 cursor-not-allowed line-through'
                          : active
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 cursor-pointer'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500 cursor-pointer'
                      }`}
                    >
                      {vCount}V / cil.
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Blocco 4: Alimentazione, Sovralimentazione (Numero Turbine, E-Turbo, Hot-V) e 4 Ere Catalizzatori */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  4. Alimentazione, Numero Turbine & 4 Ere Anti-Inquinamento
                </h2>
              </div>
              {config.turboType !== 'NaturallyAspirated' && (
                <span className="text-xs font-mono text-amber-300 font-bold">
                  Costo Sistema Turbo: ${costs.turboSystemUnitCost.toLocaleString('it-IT')}
                </span>
              )}
            </div>

            {/* Scelta Carburante */}
            <div className="space-y-1.5 font-mono text-xs">
              <label className="block text-slate-400 uppercase text-[11px]">
                Tipo di Carburante
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(['Benzina', 'Diesel', 'BioFuel', 'RaceFuel'] as const).map((fuel) => (
                  <button
                    type="button"
                    key={fuel}
                    onClick={() => handleFuelTypeChange(fuel)}
                    className={`py-2 px-3 rounded-lg border font-bold cursor-pointer ${
                      config.fuelType === fuel
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {fuel === 'BioFuel'
                      ? 'BioFuel (E85)'
                      : fuel === 'RaceFuel'
                        ? 'Carburante Gara 102 RON'
                        : fuel}
                  </button>
                ))}
              </div>
            </div>

            {/* Sistema di Alimentazione */}
            <div className="space-y-1.5 font-mono text-xs">
              <label className="block text-slate-400 uppercase text-[11px]">
                Sistema di Alimentazione ({config.fuelType}) — Evoluzione Storica
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {compatibleFuelSystems.map((fs) => {
                  const isUnlocked = unlockedEnginePartIds.includes(fs.id);
                  const isSelected = config.fuelSystemId === fs.id;
                  return (
                    <button
                      type="button"
                      key={fs.id}
                      onClick={() => handleSelectOrUnlockPart('fuelSystemId', fs)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-sky-500/15 border-sky-400 text-slate-100'
                          : isUnlocked
                            ? 'bg-slate-950 border-slate-800 text-slate-300'
                            : 'bg-slate-950/70 border-sky-900/60 text-slate-400'
                      }`}
                    >
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          {!isUnlocked && <Lock className="w-3 h-3 text-sky-400" />}
                          <span>{fs.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {fs.eraLabel} •{' '}
                          {fs.bmepDeltaBar >= 0
                            ? `+${fs.bmepDeltaBar} bar BMEP`
                            : `${fs.bmepDeltaBar} bar BMEP`}{' '}
                          • ${fs.unitCost}
                        </div>
                      </div>
                      {!isUnlocked && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-sky-950 border border-sky-700 text-sky-200 font-bold shrink-0">
                          ${(fs.unlockCost.capitalCost / 1_000_000).toFixed(1)}M +{' '}
                          {fs.unlockCost.rdCost} R&D
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sistema di Aspirazione e Collettore di Scarico */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              <div>
                <label className="block text-slate-400 mb-1 uppercase text-[11px]">
                  Sistema di Aspirazione
                </label>
                <select
                  value={config.intakeSystemId}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, intakeSystemId: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100"
                >
                  {INTAKE_SYSTEMS.map((intk) => (
                    <option key={intk.id} value={intk.id}>
                      {intk.name} (+{intk.heightAddMm}mm H, ${intk.cost})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 uppercase text-[11px]">
                  Collettore di Scarico
                </label>
                <select
                  value={config.exhaustManifoldId}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, exhaustManifoldId: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100"
                >
                  {EXHAUST_MANIFOLDS.map((exh) => (
                    <option key={exh.id} value={exh.id}>
                      {exh.name} ({exh.weightKg}kg, +{exh.widthAddMm}mm W, ${exh.cost})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Turbocompressione e Sovralimentazione */}
            <div className="space-y-3 pt-2 border-t border-slate-800 font-mono text-xs">
              <label className="block text-slate-400 uppercase text-[11px]">
                Tecnologia di Sovralimentazione
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {TURBO_SYSTEMS.map((tb) => (
                  <button
                    type="button"
                    key={tb.id}
                    onClick={() =>
                      setConfig((p) => ({ ...p, turboType: tb.id as TurboType }))
                    }
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition ${
                      config.turboType === tb.id
                        ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between font-bold">
                      <span>{tb.label}</span>
                      <span className="text-[10px] text-slate-400">
                        {tb.id === 'NaturallyAspirated'
                          ? '$0'
                          : `Base $${tb.baseUnitCost} • ${tb.minYear}+`}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{tb.description}</div>
                  </button>
                ))}
              </div>

              {/* Parametri dedicati Turbina: Numero Turbine (Single/Twin/Triple/Quad), Cuscinetti, A/R, Boost, Posizione */}
              {config.turboType !== 'NaturallyAspirated' && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                  {/* Punto 2: Selettore Configurazione e Numero Turbine */}
                  <div>
                    <label className="block text-slate-400 mb-1.5 text-[11px] uppercase">
                      Configurazione e Numero di Turbine (Vincolato al numero di cilindri:{' '}
                      {config.cylinders})
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {TURBO_COUNT_CONFIGS.map((tc) => {
                        const allowed = config.cylinders >= tc.minCylinders;
                        const active = config.turboCountConfig === tc.id;
                        return (
                          <button
                            type="button"
                            key={tc.id}
                            disabled={!allowed}
                            onClick={() =>
                              setConfig((p) => ({ ...p, turboCountConfig: tc.id }))
                            }
                            className={`p-2.5 rounded-lg border text-left transition ${
                              !allowed
                                ? 'bg-slate-900/40 border-slate-900 text-slate-600 cursor-not-allowed'
                                : active
                                  ? 'bg-sky-500/20 border-sky-400 text-sky-200 cursor-pointer'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 cursor-pointer'
                            }`}
                          >
                            <div className="flex justify-between font-bold">
                              <span>{tc.label}</span>
                              <span className="text-[10px] text-amber-300">
                                Costo {tc.costMultiplier}x • Min {tc.minCylinders} cil.
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {tc.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 text-[11px]">
                        Cuscinetti Girante
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setConfig((p) => ({ ...p, turboBearingType: 'Journal' }))
                          }
                          className={`py-2 px-2 rounded border text-[11px] cursor-pointer ${
                            config.turboBearingType === 'Journal'
                              ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          Bronzine (1.0x)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfig((p) => ({
                              ...p,
                              turboBearingType: 'BallBearing',
                            }))
                          }
                          className={`py-2 px-2 rounded border text-[11px] cursor-pointer ${
                            config.turboBearingType === 'BallBearing'
                              ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          Sfera (1.48x)
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-400 text-[11px]">Pressione Boost</span>
                        <span className="text-emerald-300 font-bold">
                          {config.boostPressureBar.toFixed(2)} bar
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={2.8}
                        step={0.05}
                        value={config.boostPressureBar}
                        onChange={(e) =>
                          setConfig((p) => ({
                            ...p,
                            boostPressureBar: Number(e.target.value),
                          }))
                        }
                        className="w-full"
                      />
                      <div className="text-[10px] text-slate-500 flex justify-between">
                        <span>0.2 bar (Soft)</span>
                        <span>2.8 bar (Max)</span>
                      </div>
                    </div>
                  </div>

                  {/* Punto 5 (Fix): Dimensionamento Individuale di Ciascuna Turbina (Multi-Turbo Simmetrico o Asimmetrico/Sequenziale) */}
                  <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-bold uppercase text-amber-300">
                          Dimensione Girante per Singola Turbina (
                          {getActiveTurboStagesAr(config).length}{' '}
                          {getActiveTurboStagesAr(config).length === 1
                            ? 'Turbina attiva'
                            : 'Turbine attive'}
                          )
                        </span>
                        <p className="text-[10px] text-slate-400">
                          Puoi configurare turbine tutte uguali oppure stadi asimmetrici (es.
                          Turbina #1 piccola per risposta immediata ai bassi + Turbina #2 grande per
                          potenza agli alti).
                        </p>
                      </div>

                      {getActiveTurboStagesAr(config).length >= 2 && (
                        <div className="flex flex-wrap gap-1.5 text-[10px]">
                          <button
                            type="button"
                            onClick={() =>
                              setConfig((p) => ({
                                ...p,
                                turboArRatio: 0.65,
                                turboStagesArRatios: [0.65, 0.65, 0.65, 0.65],
                              }))
                            }
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 cursor-pointer"
                          >
                            Preset: Simmetriche (50mm)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfig((p) => ({
                                ...p,
                                turboArRatio: 0.72,
                                turboStagesArRatios: [0.42, 1.0, 0.45, 1.05],
                              }))
                            }
                            className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/60 text-amber-200 font-bold cursor-pointer"
                          >
                            Preset: Sequenziale Asimmetrico (40mm + 67mm)
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {getActiveTurboStagesAr(config).map((stageAr, idx) => {
                        const diamMm = arRatioToImpellerMm(stageAr);
                        const roleDesc =
                          stageAr <= 0.5
                            ? 'Piccola (Spool istantaneo ai bassi)'
                            : stageAr <= 0.85
                              ? 'Media (Erogazione bilanciata)'
                              : 'Grande (Alto flusso agli alti RPM)';
                        return (
                          <div
                            key={idx}
                            className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-sky-300">
                                Turbina #{idx + 1}{' '}
                                <span className="text-[10px] font-normal text-slate-400">
                                  ({roleDesc})
                                </span>
                              </span>
                              <span className="font-bold text-amber-300">
                                Ø {diamMm} mm (A/R {stageAr.toFixed(2)})
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0.35}
                              max={1.4}
                              step={0.05}
                              value={stageAr}
                              onChange={(e) => {
                                const newVal = Number(e.target.value);
                                setConfig((p) => {
                                  const nextArr = [...(p.turboStagesArRatios ?? [0.65, 0.65, 0.65, 0.65])];
                                  nextArr[idx] = newVal;
                                  const activeCount =
                                    TURBO_COUNT_CONFIGS.find((tc) => tc.id === p.turboCountConfig)
                                      ?.turbineCount ?? 1;
                                  const avgAr =
                                    nextArr
                                      .slice(0, activeCount)
                                      .reduce((s, v) => s + v, 0) / activeCount;
                                  return {
                                    ...p,
                                    turboArRatio: Number(avgAr.toFixed(2)),
                                    turboStagesArRatios: nextArr,
                                  };
                                });
                              }}
                              className="w-full"
                            />
                            <div className="flex justify-between text-[10px] text-slate-500">
                              <span>Ø 36mm (0.35 A/R)</span>
                              <span>Ø 86mm (1.40 A/R)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Punto 9: Posizione Turbine (Frontali, Laterali, Hot-V con impatto costi e affidabilità) */}
                  <div>
                    <label className="block text-slate-400 mb-1.5 text-[11px]">
                      Posizionamento Turbine nel Vano (Impatto su Ingombro LWH, Costo Turbo e
                      Affidabilità Termica)
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {TURBO_POSITIONS.map((pos) => {
                        const disabled = pos.requiresVOrW && !canUseHotV;
                        const active = config.turboPosition === pos.id;
                        return (
                          <button
                            type="button"
                            key={pos.id}
                            disabled={disabled}
                            onClick={() =>
                              setConfig((p) => ({ ...p, turboPosition: pos.id }))
                            }
                            className={`p-2.5 rounded-lg border text-left transition ${
                              disabled
                                ? 'bg-slate-900/40 border-slate-900 text-slate-600 cursor-not-allowed'
                                : active
                                  ? 'bg-amber-500/20 border-amber-500 text-amber-200 cursor-pointer'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 cursor-pointer'
                            }`}
                          >
                            <div className="font-bold">{pos.label}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {pos.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Punto 8: 4 Stadi di Catalizzatori con penalità affidabilità DPF/EGR/SCR (specialmente sui Diesel) */}
            <div className="space-y-2 pt-2 border-t border-slate-800 font-mono text-xs">
              <div className="flex items-center justify-between">
                <label className="text-slate-400 uppercase text-[11px]">
                  4 Stadi Anti-Inquinamento (DPF/SCR riducono affidabilità, spec. Diesel)
                </label>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    exceedsEmissionLaw
                      ? 'bg-red-950/90 border border-red-500 text-red-300'
                      : 'bg-emerald-950/80 border border-emerald-600 text-emerald-300'
                  }`}
                >
                  Emissioni: {telemetry.emissionsGPerKm} g/km (Soglia {currentYear}:{' '}
                  {legalEmissionLimit} g/km)
                </span>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                {CATALYST_ERAS.map((cat) => {
                  const relPenalty =
                    config.fuelType === 'Diesel'
                      ? cat.reliabilityPenaltyDieselPercent
                      : cat.reliabilityPenaltyPetrolPercent;
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() =>
                        setConfig((p) => ({
                          ...p,
                          catalystEra: cat.id as CatalystEra,
                        }))
                      }
                      className={`p-2.5 rounded-lg border text-left cursor-pointer flex items-center justify-between gap-3 ${
                        config.catalystEra === cat.id
                          ? 'bg-emerald-500/15 border-emerald-500 text-slate-100'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-bold">
                          {cat.label}{' '}
                          <span className="text-[10px] text-amber-400">
                            ({cat.decadeLabel})
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {cat.description}
                        </div>
                      </div>
                      <div className="text-right shrink-0 text-[10px] space-y-0.5">
                        <div className="text-emerald-400 font-bold">
                          -{cat.emissionsReductionPercent}% g/km • ${cat.unitCost}
                        </div>
                        <div className={relPenalty > 3 ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                          Affidabilità -{relPenalty}% • +{cat.weightAddKg}kg • -
                          {cat.powerPenaltyPercent}% CV
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* COLONNA DESTRA (STICKY): TELEMETRIA BANCO PROVA + CAD 3D MULTI-PIANALE SOVRAPPOSTO */}
        <div className="xl:col-span-5 space-y-6 xl:sticky xl:top-20">
          {/* Card 1: Telemetria Banco Prova */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  Telemetria Banco Prova (BMEP Reale)
                </h2>
              </div>
              <span className="text-xs font-mono text-amber-300 font-bold">
                {(
                  telemetry.peakPowerHp / Math.max(0.1, geometry.displacementLiters)
                ).toFixed(1)}{' '}
                CV/L • {telemetry.peakBmepBar} bar
              </span>
            </div>

            <TelemetryCanvas2D
              curve={telemetry.curve}
              redlineRpm={telemetry.redlineRpm}
              engineName={engineName}
              displacementLiters={geometry.displacementLiters}
              architectureLabel={`${
                config.architecture === 'V' && config.bankAngleDeg === 15
                  ? 'VR'
                  : config.architecture
              }${config.cylinders}`}
            />

            {/* Metriche Istantanee Banco Prova */}
            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">POTENZA MAX</div>
                <div className="text-sm font-bold text-amber-400">
                  {telemetry.peakPowerHp} CV @ {telemetry.peakPowerRpm}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">COPPIA MAX</div>
                <div className="text-sm font-bold text-sky-300">
                  {telemetry.peakTorqueNm} Nm @ {telemetry.peakTorqueRpm}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">LIMITATORE / MAX</div>
                <div className="text-sm font-bold text-rose-400">
                  {telemetry.redlineRpm} / {maxSafeMechanicalRpm}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">PESO SECCO / FLUIDI</div>
                <div className="text-sm font-bold text-slate-200">
                  {telemetry.dryWeightKg} / {telemetry.wetWeightKg} kg
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">EFFICIENZA TERMICA</div>
                <div className="text-sm font-bold text-emerald-400">
                  {telemetry.thermalEfficiencyPercent}%
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">EMISSIONI</div>
                <div
                  className={`text-sm font-bold ${
                    exceedsEmissionLaw ? 'text-red-400' : 'text-emerald-300'
                  }`}
                >
                  {telemetry.emissionsGPerKm} g/km
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 col-span-2">
                <div className="text-[10px] text-slate-400">
                  AFFIDABILITÀ (% E VITA STIMATA IN KM)
                </div>
                <div className="text-sm font-bold text-sky-300">
                  {telemetry.reliabilityPercent}% •{' '}
                  {telemetry.estimatedLifespanKm.toLocaleString('it-IT')} km stimati
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">COSTO UNITARIO</div>
                <div className="text-sm font-bold text-emerald-300">
                  ${telemetry.unitProductionCost.toLocaleString('it-IT')}
                </div>
              </div>
            </div>

            {/* Pulsante Omologazione Motore con Gate Doppia Valuta */}
            <button
              type="button"
              onClick={handleSaveEngine}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-amber-500/10"
            >
              <Save className="w-4 h-4" />
              <span>
                Omologa Propulsore (-$
                {(costs.developmentCost.capitalCost / 1_000_000).toFixed(2)}M / -
                {costs.developmentCost.rdCost} R&D)
              </span>
            </button>
          </div>

          {/* Card 2: Punto 11 — CAD 3D (Modello 3D Procedurale, Assi L/W/H e Multi-Pianale Sovrapposto) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  CAD 3D & Sovrapposizione Multi-Pianale
                </h2>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedChassisIds(chassisList.map((c) => c.id))
                  }
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  Tutti ({chassisList.length})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedChassisIds(
                      chassisCompatibilityList
                        .filter((c) => c.result.isCompatible)
                        .map((c) => c.chassis.id),
                    )
                  }
                  className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 cursor-pointer"
                >
                  Solo Compatibili
                </button>
              </div>
            </div>

            <VolumeViewer3D
              engineInBayDimensionsMm={effectiveEngineInBayMm}
              rawEngineDimensionsMm={geometry.dimensionsMm}
              engineConfig={config}
              overlaidChassisBays={overlaidChassisBays}
            />

            {/* Elenco Pianali Aziendali con Checkbox Multiple: diventa ROSSO se incompatibile */}
            <div className="space-y-2 font-mono text-xs">
              <div className="text-[11px] text-slate-400 uppercase">
                Spunta più Pianali per sovrapporli contemporaneamente nel CAD 3D:
              </div>
              {chassisCompatibilityList.map(({ chassis, result }) => {
                const isChecked = selectedChassisIds.includes(chassis.id);
                return (
                  <label
                    key={chassis.id}
                    className={`block p-3 rounded-xl border transition cursor-pointer ${
                      !result.isCompatible
                        ? 'bg-red-950/85 border-red-500 text-red-100 shadow-md shadow-red-950/50'
                        : isChecked
                          ? 'bg-slate-900 border-emerald-500/80 text-slate-100'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleChassisOverlay(chassis.id)}
                          className="w-4 h-4 rounded cursor-pointer"
                        />
                        {!result.isCompatible ? (
                          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                        <span>{chassis.name}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-black/30 border border-white/10">
                        Vano: L{chassis.engineBayMaxDimensionsMm.lengthMm}×W
                        {chassis.engineBayMaxDimensionsMm.widthMm}×H
                        {chassis.engineBayMaxDimensionsMm.heightMm} mm
                      </span>
                    </div>

                    {!result.isCompatible ? (
                      <div className="mt-1.5 pl-7 text-[11px] text-red-300 font-semibold space-y-0.5">
                        {result.conflictReasons.map((reason, idx) => (
                          <div key={idx}>• INCOMPATIBILE: {reason}</div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1 pl-7 text-[11px] text-emerald-400 flex justify-between">
                        <span>
                          Compatibile ({chassis.supportedEnginePositions.join('/')} •{' '}
                          {chassis.supportedEngineOrientations.join('/')})
                        </span>
                        <span className="text-slate-400">
                          Margine L:{result.clearanceMm.lengthMm} / W:
                          {result.clearanceMm.widthMm} / H:{result.clearanceMm.heightMm} mm
                        </span>
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Archivio Motori Omologati nel Database Aziendale */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider">
              Database Propulsori Aziendali Omologati ({engines.length})
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Disponibili per Veicoli del Gruppo e Forniture B2B
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
          {engines.map((eng) => (
            <div
              key={eng.id}
              className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-100">{eng.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300">
                  {eng.codeName}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Ingombro: {eng.dimensionsMm.lengthMm}×{eng.dimensionsMm.widthMm}×
                {eng.dimensionsMm.heightMm} mm • Peso: {eng.telemetry.dryWeightKg}kg
              </div>
              <div className="text-[11px] text-emerald-400 font-bold">
                {eng.telemetry.peakPowerHp} CV @ {eng.telemetry.peakPowerRpm} rpm •{' '}
                {eng.telemetry.peakTorqueNm} Nm
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[11px]">
                <span className="text-sky-300">
                  Vita: {eng.telemetry.estimatedLifespanKm.toLocaleString('it-IT')} km (
                  {eng.telemetry.reliabilityPercent}%)
                </span>
                <button
                  type="button"
                  onClick={() => toggleEngineB2B(eng.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                    eng.b2bSaleEnabled
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800 border border-slate-700 text-slate-400'
                  }`}
                >
                  {eng.b2bSaleEnabled ? `B2B ON (${eng.b2bUnitsSold} pz)` : 'B2B OFF'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
