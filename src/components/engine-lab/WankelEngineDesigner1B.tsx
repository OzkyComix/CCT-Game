import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Box,
  CheckCircle2,
  Droplets,
  Flame,
  Lock,
  RotateCw,
  Save,
  Settings2,
  ShieldAlert,
  Sparkles,
  Unlock,
  Wind,
} from 'lucide-react';
import {
  APEX_SEAL_MATERIALS,
  CATALYST_ERAS,
  OIL_METERING_SYSTEMS,
  TURBO_COUNT_CONFIGS,
  TURBO_SYSTEMS,
  WANKEL_HOUSING_MATERIALS,
  WANKEL_PORTING_TYPES,
  getLegalEmissionLimitForYear,
} from '../../data/historicalEras';
import { evaluateEngineBayCompatibility } from '../../math/volumeMath';
import {
  type WankelEngineConfigInput,
  calculateMaxSafeWankelRpm,
  calculateWankelCosts,
  calculateWankelGeometryAndDimensions,
  getActiveWankelTurboStagesAr,
  simulateWankelEngineDyno,
} from '../../math/wankelMath';
import { useGameStore } from '../../store/useGameStore';
import type {
  CatalystEra,
  EngineEntity,
  EngineOrientation,
  PriceTier,
  ReferenceClass,
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

interface WankelEngineDesignerProps {
  onSwitchToPiston?: () => void;
}

export const WankelEngineDesigner1B: React.FC<WankelEngineDesignerProps> = ({
  onSwitchToPiston,
}) => {
  const {
    currentYear,
    subBrands,
    chassisList,
    unlockedEnginePartIds,
    unlockEnginePart,
    saveEngineToDatabase,
  } = useGameStore();

  // Metadati Wankel
  const [engineName, setEngineName] = useState('1.3L Twin-Rotor Sequential Biturbo');
  const [codeName, setCodeName] = useState('ROT-13B-REW');
  const [ownerSubBrandId, setOwnerSubBrandId] = useState(
    subBrands[0]?.id ?? 'sb-officine-milano',
  );

  // Configurazione Wankel 1B
  const [config, setConfig] = useState<WankelEngineConfigInput>({
    rotorCount: 2,
    generatingRadiusMm: 105,
    eccentricityMm: 15,
    rotorWidthMm: 80,
    portType: 'StreetPort',
    apexSealMaterialId: 'seal-tool-steel-dlc',
    apexSealThicknessMm: 2.0,
    housingMaterialId: 'whs-alu-cermet-nikasil',
    oilMeteringSystemId: 'omp-electronic-mikuni',
    compressionRatio: 9.0,
    fuelType: 'Benzina',
    turboType: 'TwinScroll',
    turboCountConfig: 'TwinTurbo',
    turboBearingType: 'BallBearing',
    turboArRatio: 0.65,
    turboStagesArRatios: [0.65, 0.65],
    boostPressureBar: 0.85,
    turboPosition: 'Lateral',
    manualRedlineRpm: 8200,
    intendedOrientation: 'Longitudinale',
    catalystEra: 'Era2_ThreeWayLambda_80s90s',
    priceTier: 'Premium',
    referenceClass: 'Sport',
  });

  const [selectedChassisIds, setSelectedChassisIds] = useState<string[]>(() =>
    chassisList.slice(0, 2).map((c) => c.id),
  );

  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);

  const maxSafeMechanicalRpm = useMemo(
    () => calculateMaxSafeWankelRpm(config),
    [config],
  );

  const geometry = useMemo(
    () => calculateWankelGeometryAndDimensions(config),
    [config],
  );

  const costs = useMemo(() => calculateWankelCosts(config), [config]);
  const telemetry = useMemo(() => simulateWankelEngineDyno(config), [config]);

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

  const legalEmissionLimit = getLegalEmissionLimitForYear(currentYear);
  const exceedsEmissionLaw = telemetry.emissionsGPerKm > legalEmissionLimit;

  // Sblocco o selezione componente con Gate Doppia Valuta
  const handleSelectOrUnlockPart = (
    field: keyof WankelEngineConfigInput,
    part: {
      id: string;
      name: string;
      unlockCost: { capitalCost: number; rdCost: number; minYear?: number };
    },
  ) => {
    const isUnlocked = unlockedEnginePartIds.includes(part.id);
    if (isUnlocked) {
      setConfig((prev) => ({ ...prev, [field]: part.id }));
      return;
    }

    const res = unlockEnginePart(part.id, part.name, part.unlockCost);
    if (!res.allowed) {
      setFeedbackBanner({
        type: 'err',
        msg: res.reason ?? 'Impossibile sbloccare componente Wankel.',
      });
    } else {
      setConfig((prev) => ({ ...prev, [field]: part.id }));
      setFeedbackBanner({
        type: 'ok',
        msg: `Componente Wankel sbloccata: ${part.name} (-$${part.unlockCost.capitalCost.toLocaleString('it-IT')} / -${part.unlockCost.rdCost} R&D)`,
      });
    }
  };

  const handleSaveEngine = () => {
    const sealSpec =
      APEX_SEAL_MATERIALS.find((s) => s.id === config.apexSealMaterialId) ??
      APEX_SEAL_MATERIALS[0];
    const housingSpec =
      WANKEL_HOUSING_MATERIALS.find((h) => h.id === config.housingMaterialId) ??
      WANKEL_HOUSING_MATERIALS[0];

    const newEngine: EngineEntity = {
      id: `eng-wankel-${Date.now()}`,
      name:
        engineName.trim() ||
        `${geometry.displacementLiters}L ${config.rotorCount}-Rotori Wankel`,
      codeName: codeName.trim() || `ROT-${config.rotorCount}R`,
      ownerSubBrandId,
      createdYear: currentYear,
      propulsionType: 'Wankel_1B',
      taxonomy: {
        priceTier: config.priceTier,
        referenceClass: config.referenceClass,
        materialStress: {
          materialName: `${housingSpec.name} + ${sealSpec.name}`,
          materialResistanceFactor: (housingSpec.wearResistance + sealSpec.shatterResistance) / 2,
          mechanicalStressFactor: 1.15,
        },
        estimatedDurabilityKm: telemetry.estimatedLifespanKm,
      },
      dimensionsMm: geometry.dimensionsMm,
      wankelSpecs: {
        rotorCount: config.rotorCount,
        generatingRadiusMm: config.generatingRadiusMm,
        eccentricityMm: config.eccentricityMm,
        rotorWidthMm: config.rotorWidthMm,
        unitDisplacementCc: geometry.unitDisplacementCc,
        totalDisplacementCc: geometry.totalDisplacementCc,
        equivalentDisplacementCc: geometry.equivalentDisplacementCc,
        portType: config.portType,
        apexSealMaterialId: config.apexSealMaterialId,
        apexSealMaterialName: sealSpec.name,
        apexSealThicknessMm: config.apexSealThicknessMm,
        housingMaterialId: config.housingMaterialId,
        oilMeteringSystemId: config.oilMeteringSystemId,
        compressionRatio: config.compressionRatio,
        fuelType: config.fuelType,
        turboType: config.turboType,
        turboCountConfig: config.turboCountConfig,
        turboBearingType: config.turboBearingType,
        turboArRatio: config.turboArRatio,
        turboStagesArRatios: getActiveWankelTurboStagesAr(config),
        boostPressureBar: config.boostPressureBar,
        manualRedlineRpm: telemetry.redlineRpm,
        intendedOrientation: config.intendedOrientation,
        turboPosition: config.turboPosition,
        catalystEra: config.catalystEra,
        oilConsumptionLPer1000Km: telemetry.oilConsumptionLPer1000Km ?? 0.8,
        apexSealWearRatePercentPer10kKm: telemetry.apexSealWearRate ?? 3.5,
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
        msg: res.reason ?? 'Risorse insufficienti per omologare il motore Wankel.',
      });
    } else {
      setFeedbackBanner({
        type: 'ok',
        msg: `Motore Rotativo "${newEngine.name}" (${newEngine.codeName}) omologato con successo!`,
      });
    }
  };

  const clampedManualRpm = Math.min(maxSafeMechanicalRpm, config.manualRedlineRpm);
  const safeRpmThreshold = Math.min(11000, maxSafeMechanicalRpm);
  const rpmSafetyBuffer = safeRpmThreshold - clampedManualRpm;

  return (
    <div className="space-y-6">
      {/* Selettore Sotto-Moduli Fase 1 (1A / 1B Attivi) */}
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

          <div className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-amber-500/10">
            <RotateCw className="w-4 h-4 animate-spin-slow" />
            <span>1B — Rotativi Wankel (Fase 1.3 Attiva)</span>
          </div>

          <div className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-600 text-xs font-mono flex items-center gap-1.5 cursor-not-allowed">
            <Lock className="w-3.5 h-3.5" />
            <span>1C — Elettrici & Ibridi (Fase 1.4)</span>
          </div>
        </div>

        {/* Badge Sintetici Wankel */}
        <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
          <span className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-amber-300 font-bold flex items-center gap-1.5">
            <RotateCw className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {geometry.totalDisplacementCc} cc ({geometry.displacementLiters}L) •{' '}
              {config.rotorCount} Rotori (Equiv. FIA {geometry.equivalentDisplacementCc} cc)
            </span>
          </span>
          <span className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-emerald-300 font-bold">
            Usura Apex: {telemetry.apexSealWearRate}% / 10k km
          </span>
          <span className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-sky-300 font-bold">
            Ingombro: {geometry.dimensionsMm.lengthMm}×{geometry.dimensionsMm.widthMm}×
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

      {/* Griglia Principale Progettatore Wankel (7 col sinistra, 5 col destra) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* COLONNA SINISTRA */}
        <div className="xl:col-span-7 space-y-6">
          {/* Sezione 1: Identità, Tassonomia & Packaging */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  1. Identità Progetto Rotativo & Packaging Vano
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-400">Anno R&D: {currentYear}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">Nome Propulsore Wankel</label>
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
                  Fascia di Prezzo (Tolleranze Lavorazione Trocoide)
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
                <label className="block text-slate-400 mb-1">Classe di Riferimento</label>
                <div className="grid grid-cols-5 gap-1">
                  {REFERENCE_CLASSES.map((cls) => (
                    <button
                      type="button"
                      key={cls}
                      onClick={() => setConfig((p) => ({ ...p, referenceClass: cls }))}
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

            <div className="pt-2 border-t border-slate-800 text-xs font-mono">
              <label className="block text-slate-400 mb-1.5 uppercase text-[11px]">
                Orientamento di Montaggio nel Vano
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {[
                  {
                    id: 'Longitudinale' as EngineOrientation,
                    title: 'Montaggio Longitudinale',
                    desc: 'Albero eccentrico lungo l’asse vettura • Ideale per trasmissioni RWD sportive a tunnel basso.',
                  },
                  {
                    id: 'Trasversale' as EngineOrientation,
                    title: 'Montaggio Trasversale (+8% R&D)',
                    desc: 'Estremamente compatto in lunghezza • Libera spazio enorme per l’abitacolo/sospensioni.',
                  },
                ].map((item) => (
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

          {/* Sezione 2: Geometria Wankel (Rotori, R, e, B, Compressione & Giri) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <RotateCw className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  2. Geometria Wankel (Epitrocoide, Camere & Limitatore)
                </h2>
              </div>
              <span className="text-xs font-mono text-amber-300 font-bold">
                Fattore K (R/e): {geometry.kFactor}
              </span>
            </div>

            {/* Numero di Rotori */}
            <div className="space-y-1.5 font-mono text-xs">
              <label className="block text-slate-400 uppercase text-[11px]">
                Numero di Rotori Wankel
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  {
                    count: 1,
                    label: '1 Rotore (Ultracompatto)',
                    desc: 'Leggerissimo, ideale per citycar o range extender.',
                  },
                  {
                    count: 2,
                    label: '2 Rotori (Twin-Rotor / 13B)',
                    desc: 'Equilibrio perfetto di rotazione, lo standard delle sportive.',
                  },
                  {
                    count: 3,
                    label: '3 Rotori (Tri-Rotor / 20B)',
                    desc: 'Fluidità simile a un V12, suono cupo e coppia corposa.',
                  },
                  {
                    count: 4,
                    label: '4 Rotori (Quad-Rotor / 26B Le Mans)',
                    desc: 'Architettura da leggenda motorsport, urlo stratosferico.',
                  },
                ].map((r) => (
                  <button
                    type="button"
                    key={r.count}
                    onClick={() => setConfig((p) => ({ ...p, rotorCount: r.count }))}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition ${
                      config.rotorCount === r.count
                        ? 'bg-amber-500/20 border-amber-500 text-amber-200 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{r.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Slider Geometria Trocoide: Raggio R, Eccentricità e, Larghezza B */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Raggio Generatore (R)</span>
                  <span className="text-amber-300 font-bold">
                    {config.generatingRadiusMm} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={95}
                  max={120}
                  step={1}
                  value={config.generatingRadiusMm}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      generatingRadiusMm: Number(e.target.value),
                    }))
                  }
                  className="w-full"
                />
                <div className="text-[10px] text-slate-500 flex justify-between">
                  <span>95 mm (Compatto)</span>
                  <span>120 mm (Grande)</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Eccentricità Albero (e)</span>
                  <span className="text-sky-300 font-bold">
                    {config.eccentricityMm.toFixed(1)} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={12.0}
                  max={18.0}
                  step={0.5}
                  value={config.eccentricityMm}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      eccentricityMm: Number(e.target.value),
                    }))
                  }
                  className="w-full"
                />
                <div className="text-[10px] text-slate-500 flex justify-between">
                  <span>12 mm (Alto RPM)</span>
                  <span>18 mm (Più Coppia)</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Larghezza Rotore (B)</span>
                  <span className="text-emerald-300 font-bold">
                    {config.rotorWidthMm} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={95}
                  step={1}
                  value={config.rotorWidthMm}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      rotorWidthMm: Number(e.target.value),
                    }))
                  }
                  className="w-full"
                />
                <div className="text-[10px] text-slate-500 flex justify-between">
                  <span>60 mm (Stretto)</span>
                  <span>95 mm (Largo)</span>
                </div>
              </div>
            </div>

            {/* Rapporto di Compressione Wankel & Alert Knock */}
            <div
              className={`p-3 rounded-lg bg-slate-950 border space-y-1.5 font-mono text-xs ${
                telemetry.knockWarning?.isKnocking
                  ? 'border-red-500 bg-red-950/30'
                  : 'border-slate-800'
              }`}
            >
              <div className="flex justify-between">
                <span className="text-slate-400">Rapporto di Compressione Wankel</span>
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
                min={8.0}
                max={11.5}
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
                <span className="text-slate-500">8.0:1 (Alto Boost)</span>
                <span
                  className={
                    telemetry.knockWarning?.isKnocking
                      ? 'text-red-400 font-bold'
                      : 'text-emerald-400'
                  }
                >
                  Max sicuro: {telemetry.knockWarning?.maxSafeCr ?? 10.4}:1
                </span>
              </div>
            </div>

            {telemetry.knockWarning?.isKnocking && (
              <div className="p-3 rounded-xl bg-red-950/85 border border-red-500 text-red-100 text-xs font-mono flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <div>
                    <div className="font-bold text-red-300">
                      ALLARME DETONAZIONE ROTATIVO — CR {config.compressionRatio.toFixed(1)}
                      :1 oltre limite sicuro ({telemetry.knockWarning.maxSafeCr}:1)
                    </div>
                    <div className="text-[11px] text-red-200">
                      Rischio frantumazione immediata Apex Seal! Taglio: -
                      {telemetry.knockWarning.powerPenaltyPercent}% Potenza e -
                      {telemetry.knockWarning.reliabilityPenaltyPercent}% Affidabilità.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Slider Limitatore di Giri Wankel */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-slate-300 font-bold uppercase">
                    Limitatore Manuale Wankel:{' '}
                  </span>
                  <span className="text-rose-400 font-bold text-sm">
                    {telemetry.redlineRpm} rpm
                  </span>
                </div>
                <div className="text-[11px]">
                  <span className="text-slate-400">Limite Fisico Meccanico: </span>
                  <span className="text-amber-300 font-bold">
                    {maxSafeMechanicalRpm} rpm
                  </span>
                  <span
                    className={`ml-2 px-2 py-0.5 rounded font-bold ${
                      rpmSafetyBuffer >= 600
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : rpmSafetyBuffer >= 200
                          ? 'bg-amber-950 text-amber-300 border border-amber-700'
                          : rpmSafetyBuffer < 0
                            ? 'bg-red-950 text-red-300 border border-red-600'
                            : 'bg-amber-950 text-amber-300 border border-amber-600'
                    }`}
                  >
                    {rpmSafetyBuffer >= 600
                      ? `Margine Sicuro (-${rpmSafetyBuffer} rpm)`
                      : rpmSafetyBuffer >= 200
                        ? `Margine Sportivo (-${rpmSafetyBuffer} rpm)`
                        : rpmSafetyBuffer < 0
                          ? `Oltre Soglia 11k (+${Math.abs(rpmSafetyBuffer)} rpm = -Affidabilità)`
                          : 'Al Limite Critico'}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={4500}
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
                <span>4.500 rpm</span>
                <span>Limite Fisico Attuale: {maxSafeMechanicalRpm} rpm</span>
              </div>
            </div>
          </div>

          {/* Sezione 3: Apex Seal, Casse Trocoidi & Lubrificazione OMP */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  3. Apex Seal, Trocoide & Lubrificazione OMP
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Sblocco Doppia Valuta ($ + R&D)
              </span>
            </div>

            {/* Materiale Apex Seal */}
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-[11px] uppercase tracking-wider text-slate-400">
                <span>Materiale Guarnizioni Apicali (Apex Seal)</span>
                <span>Spessore: {config.apexSealThicknessMm.toFixed(1)} mm</span>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                {APEX_SEAL_MATERIALS.map((seal) => {
                  const isUnlocked = unlockedEnginePartIds.includes(seal.id);
                  const isSelected = config.apexSealMaterialId === seal.id;
                  const yearLocked = currentYear < seal.minYear;

                  return (
                    <button
                      type="button"
                      key={seal.id}
                      onClick={() => handleSelectOrUnlockPart('apexSealMaterialId', seal)}
                      className={`w-full text-left p-2.5 rounded-lg border font-mono text-xs transition cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-slate-100'
                          : isUnlocked
                            ? 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                            : yearLocked
                              ? 'bg-slate-950/40 border-slate-900 text-slate-500 opacity-60'
                              : 'bg-slate-950/80 border-sky-900/60 text-slate-300'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          {isUnlocked ? (
                            <Unlock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          )}
                          <span className="font-bold">{seal.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-slate-400">
                            {seal.minYear}+
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 pl-5">{seal.description}</p>
                      </div>

                      <div className="text-right shrink-0 text-[10px] space-y-0.5">
                        {isUnlocked ? (
                          <>
                            <div className="text-emerald-400 font-semibold">
                              ${seal.unitCostPerRotor}/rotore • +{seal.rpmDelta} rpm
                            </div>
                            <div className="text-slate-400">
                              Resistenza Detonazione: {seal.shatterResistance}x
                            </div>
                          </>
                        ) : (
                          <div className="px-2 py-1 rounded bg-sky-950 border border-sky-700 text-sky-200 font-bold">
                            SBLOCCA: ${(seal.unlockCost.capitalCost / 1_000_000).toFixed(1)}M +{' '}
                            {seal.unlockCost.rdCost} R&D
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selettore Spessore Apex Seal (2mm vs 3mm) */}
              <div className="flex items-center justify-between p-2.5 rounded bg-slate-950 border border-slate-800 mt-2">
                <span className="text-slate-400 text-[11px]">
                  Spessore Apex Seal: 2.0 mm (Giri Elevati) vs 3.0 mm (Carico / Durata Boost)
                </span>
                <div className="flex gap-1.5">
                  {[2.0, 3.0].map((th) => (
                    <button
                      type="button"
                      key={th}
                      onClick={() =>
                        setConfig((p) => ({
                          ...p,
                          apexSealThicknessMm: th as 2.0 | 3.0,
                        }))
                      }
                      className={`px-3 py-1 rounded text-xs font-bold cursor-pointer transition ${
                        config.apexSealThicknessMm === th
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-900 border border-slate-700 text-slate-300'
                      }`}
                    >
                      {th.toFixed(1)} mm
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Materiale Casse Trocoidi */}
            <div className="space-y-1.5 font-mono text-xs">
              <label className="block text-slate-400 uppercase text-[11px]">
                Materiale Casse Trocoidi (Rotor Housings)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {WANKEL_HOUSING_MATERIALS.map((h) => {
                  const isUnlocked = unlockedEnginePartIds.includes(h.id);
                  const isSelected = config.housingMaterialId === h.id;
                  return (
                    <button
                      type="button"
                      key={h.id}
                      onClick={() => handleSelectOrUnlockPart('housingMaterialId', h)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition ${
                        isSelected
                          ? 'bg-sky-500/15 border-sky-400 text-slate-100'
                          : isUnlocked
                            ? 'bg-slate-950 border-slate-800 text-slate-300'
                            : 'bg-slate-950/60 border-sky-900/60 text-slate-400'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        {!isUnlocked && <Lock className="w-3 h-3 text-sky-400" />}
                        <span>{h.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">{h.description}</div>
                      <div className="text-[10px] text-emerald-400 font-semibold mt-1">
                        ${h.costPerRotor}/rotore • Conducibilità {h.thermalConductivity}x
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sistema Lubrificazione OMP */}
            <div className="space-y-1.5 font-mono text-xs">
              <label className="block text-slate-400 uppercase text-[11px] flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-sky-400" />
                <span>Sistema di Dosaggio Olio Apicale (OMP / Premix)</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {OIL_METERING_SYSTEMS.map((omp) => {
                  const isUnlocked = unlockedEnginePartIds.includes(omp.id);
                  const isSelected = config.oilMeteringSystemId === omp.id;
                  return (
                    <button
                      type="button"
                      key={omp.id}
                      onClick={() => handleSelectOrUnlockPart('oilMeteringSystemId', omp)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-400 text-slate-100'
                          : isUnlocked
                            ? 'bg-slate-950 border-slate-800 text-slate-300'
                            : 'bg-slate-950/60 border-sky-900/60 text-slate-400'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        {!isUnlocked && <Lock className="w-3 h-3 text-sky-400" />}
                        <span>{omp.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">{omp.description}</div>
                      <div className="text-[10px] text-amber-300 font-semibold mt-1">
                        Consumo: {omp.oilConsumptionLPer1000Km} L/1000km • Vita Seal +
                        {omp.sealDurabilityBonusPercent}%
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sezione 4: Porting Wankel, Sovralimentazione & Catalizzatori */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  4. Porting Luci, Sovralimentazione & Scarico
                </h2>
              </div>
              <span className="text-xs font-mono text-amber-300 font-bold">
                Carattere Minimo: {WANKEL_PORTING_TYPES.find((p) => p.id === config.portType)?.idleCharacter}
              </span>
            </div>

            {/* Tipologia Porting (Side vs Street vs Bridgeport vs Peripheral) */}
            <div className="space-y-1.5 font-mono text-xs">
              <label className="block text-slate-400 uppercase text-[11px]">
                Tipologia Luci di Aspirazione/Scarico (Porting Wankel)
              </label>
              <div className="grid grid-cols-1 gap-2">
                {WANKEL_PORTING_TYPES.map((port) => {
                  const isUnlocked = unlockedEnginePartIds.includes(port.id);
                  const isSelected = config.portType === port.id;
                  return (
                    <button
                      type="button"
                      key={port.id}
                      onClick={() => handleSelectOrUnlockPart('portType', port)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-slate-100'
                          : isUnlocked
                            ? 'bg-slate-950 border-slate-800 text-slate-300'
                            : 'bg-slate-950/60 border-sky-900/60 text-slate-400'
                      }`}
                    >
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          {!isUnlocked && <Lock className="w-3 h-3 text-sky-400" />}
                          <span>{port.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {port.description}
                        </div>
                      </div>
                      <div className="text-right shrink-0 text-[10px] space-y-0.5">
                        <div className="text-emerald-400 font-bold">
                          +{port.rpmLimitBonus} rpm • BMEP +{port.bmepDeltaBar.toFixed(2)} bar
                        </div>
                        <div className="text-slate-400">Minimo: {port.idleRpm} rpm</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Carburante e Sovralimentazione Wankel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              <div>
                <label className="block text-slate-400 mb-1.5 uppercase text-[11px]">
                  Tipo di Carburante
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Benzina', 'BioFuel', 'RaceFuel'] as const).map((fuel) => (
                    <button
                      type="button"
                      key={fuel}
                      onClick={() => setConfig((p) => ({ ...p, fuelType: fuel }))}
                      className={`py-2 px-2 rounded border font-bold cursor-pointer transition ${
                        config.fuelType === fuel
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {fuel === 'BioFuel' ? 'E85' : fuel === 'RaceFuel' ? '102 RON' : fuel}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 uppercase text-[11px]">
                  Sovralimentazione
                </label>
                <select
                  value={config.turboType}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, turboType: e.target.value as TurboType }))
                  }
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100 font-mono text-xs"
                >
                  {TURBO_SYSTEMS.map((tb) => (
                    <option key={tb.id} value={tb.id}>
                      {tb.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Parametri Turbo Wankel se attivo */}
            {config.turboType !== 'NaturallyAspirated' && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4 font-mono text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {TURBO_COUNT_CONFIGS.map((tc) => (
                    <button
                      type="button"
                      key={tc.id}
                      onClick={() => setConfig((p) => ({ ...p, turboCountConfig: tc.id }))}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition ${
                        config.turboCountConfig === tc.id
                          ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex justify-between">
                        <span>{tc.label}</span>
                        <span className="text-[10px] text-amber-300">
                          {tc.turbineCount}x
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{tc.description}</div>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Cuscinetti</label>
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
                        Bronzine
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfig((p) => ({ ...p, turboBearingType: 'BallBearing' }))
                        }
                        className={`py-2 px-2 rounded border text-[11px] cursor-pointer ${
                          config.turboBearingType === 'BallBearing'
                            ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        Sfere
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-400 text-[11px]">Diametro A/R</span>
                      <span className="text-amber-300 font-bold">
                        {config.turboArRatio.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.35}
                      max={1.4}
                      step={0.05}
                      value={config.turboArRatio}
                      onChange={(e) =>
                        setConfig((p) => ({
                          ...p,
                          turboArRatio: Number(e.target.value),
                        }))
                      }
                      className="w-full"
                    />
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
                      max={2.5}
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
                  </div>
                </div>
              </div>
            )}

            {/* Catalizzatori Wankel */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800 font-mono text-xs">
              <div className="flex items-center justify-between">
                <label className="text-slate-400 uppercase text-[11px]">
                  Filtro Anti-Inquinamento (Il Wankel produce più idrocarburi HC)
                </label>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    exceedsEmissionLaw
                      ? 'bg-red-950/90 border border-red-500 text-red-300'
                      : 'bg-emerald-950/80 border border-emerald-600 text-emerald-300'
                  }`}
                >
                  Emissioni: {telemetry.emissionsGPerKm} g/km (Soglia: {legalEmissionLimit} g/km)
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {CATALYST_ERAS.map((cat) => (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() =>
                      setConfig((p) => ({ ...p, catalystEra: cat.id as CatalystEra }))
                    }
                    className={`p-2.5 rounded-lg border text-left cursor-pointer flex items-center justify-between gap-3 ${
                      config.catalystEra === cat.id
                        ? 'bg-emerald-500/15 border-emerald-500 text-slate-100'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold">
                        {cat.label}{' '}
                        <span className="text-[10px] text-amber-400">
                          ({cat.decadeLabel})
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">{cat.description}</div>
                    </div>
                    <div className="text-right shrink-0 text-[10px]">
                      <span className="text-emerald-400 font-bold">
                        -{cat.emissionsReductionPercent}% g/km • ${cat.unitCost}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* COLONNA DESTRA (STICKY): BANCO PROVA WANKEL & CAD 3D */}
        <div className="xl:col-span-5 space-y-6 xl:sticky xl:top-20">
          {/* Card 1: Telemetria Banco Prova Wankel */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  Banco Prova Rotativo Wankel (1B)
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
              architectureLabel={`${config.rotorCount}-Rotori Wankel`}
            />

            {/* Metriche Wankel */}
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
                <div className="text-[10px] text-slate-400">USURA APEX SEAL</div>
                <div className="text-sm font-bold text-emerald-400">
                  {telemetry.apexSealWearRate}% / 10k km
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">CONSUMO OLIO OMP</div>
                <div className="text-sm font-bold text-amber-300">
                  {telemetry.oilConsumptionLPer1000Km} L / 1000km
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 col-span-2">
                <div className="text-[10px] text-slate-400">
                  AFFIDABILITÀ & VITA STIMATA KM
                </div>
                <div className="text-sm font-bold text-sky-300">
                  {telemetry.reliabilityPercent}% •{' '}
                  {telemetry.estimatedLifespanKm.toLocaleString('it-IT')} km stimati
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">COSTO PRODUZIONE</div>
                <div className="text-sm font-bold text-emerald-300">
                  ${telemetry.unitProductionCost.toLocaleString('it-IT')}
                </div>
              </div>
            </div>

            {/* Pulsante Omologazione Wankel */}
            <button
              type="button"
              onClick={handleSaveEngine}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-amber-500/10"
            >
              <Save className="w-4 h-4" />
              <span>
                Omologa Wankel (-$
                {(costs.developmentCost.capitalCost / 1_000_000).toFixed(2)}M / -
                {costs.developmentCost.rdCost} R&D)
              </span>
            </button>
          </div>

          {/* Card 2: CAD 3D Three.js & Sovrapposizione Multi-Pianale */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  CAD 3D & Ingombro Vano Wankel
                </h2>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setSelectedChassisIds(chassisList.map((c) => c.id))}
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
              wankelConfig={config}
              engineType="Wankel"
              overlaidChassisBays={overlaidChassisBays}
            />

            {/* Elenco Pianali con Checkbox Multiple */}
            <div className="space-y-2 font-mono text-xs">
              <div className="text-[11px] text-slate-400 uppercase">
                Verifica compatibilità vano motore Wankel:
              </div>
              {chassisCompatibilityList.map(({ chassis, result }) => {
                const isChecked = selectedChassisIds.includes(chassis.id);
                return (
                  <label
                    key={chassis.id}
                    className={`block p-3 rounded-xl border transition cursor-pointer ${
                      !result.isCompatible
                        ? 'bg-red-950/85 border-red-500 text-red-100'
                        : isChecked
                          ? 'bg-slate-900 border-emerald-500/80 text-slate-100'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            setSelectedChassisIds((prev) =>
                              prev.includes(chassis.id)
                                ? prev.filter((id) => id !== chassis.id)
                                : [...prev, chassis.id],
                            )
                          }
                          className="w-4 h-4 rounded cursor-pointer"
                        />
                        <span>{chassis.name}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-black/30 border border-white/10">
                        L{chassis.engineBayMaxDimensionsMm.lengthMm}×W
                        {chassis.engineBayMaxDimensionsMm.widthMm}×H
                        {chassis.engineBayMaxDimensionsMm.heightMm}
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
                        <span>Compatibile con vano</span>
                        <span className="text-slate-400">
                          Margine: L{result.clearanceMm.lengthMm} / W{result.clearanceMm.widthMm} /
                          H{result.clearanceMm.heightMm} mm
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
    </div>
  );
};
