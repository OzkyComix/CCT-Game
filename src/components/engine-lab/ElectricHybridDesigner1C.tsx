import React, { useMemo, useState } from 'react';
import {
  Activity,
  Battery,
  BatteryCharging,
  Box,
  CheckCircle2,
  Cpu,
  Flame,
  Gauge,
  RotateCw,
  Save,
  ShieldAlert,
  Wind,
  Zap,
} from 'lucide-react';
import {
  BATTERY_CHEMISTRIES,
  ELECTRIC_COOLING_SYSTEMS,
  ELECTRIC_MOTOR_TYPES,
  HYBRID_SYSTEM_TYPES,
  INVERTER_TECHNOLOGIES,
  MOTOR_LAYOUT_CONFIGS,
} from '../../data/electricHybridData';
import { getLegalEmissionLimitForYear } from '../../data/historicalEras';
import {
  calculateElectricHybridCosts,
  calculateElectricHybridGeometryAndDimensions,
  simulateElectricHybridDyno,
} from '../../math/electricHybridMath';
import { evaluateEngineBayCompatibility } from '../../math/volumeMath';
import { useGameStore } from '../../store/useGameStore';
import type {
  ElectricHybridEngineConfigInput,
  EngineEntity,
  EngineOrientation,
  HybridSystemType,
  PriceTier,
  ReferenceClass,
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
    saveEngineToDatabase,
  } = useGameStore();

  // Stato configurazione Powertrain Elettrico/Ibrido
  const [config, setConfig] = useState<ElectricHybridEngineConfigInput>({
    systemType: 'PureEV',
    electricMotorType: 'PermanentMagnetSync',
    motorLayout: 'DualMotor_eAWD',
    statorDiameterMm: 230,
    rotorLengthMm: 175,
    batteryChemistry: 'NMC811',
    batteryCapacityKwh: 75,
    voltageArchitecture: 800,
    coolingSystem: 'LiquidGlycol',
    inverterTech: 'SiliconCarbide_SiC',
    gearboxType: 'SingleSpeedDirect',
    gearRatio: 9.2,
    maxMotorRpm: 18000,
    priceTier: 'Premium',
    referenceClass: 'Sport',
    iceArchitecture: 'Inline',
    iceCylindersOrRotors: 4,
    iceDisplacementCc: 1998,
    iceFuelType: 'Benzina',
    iceTurbocharged: true,
  });

  const [intendedOrientation, setIntendedOrientation] =
    useState<EngineOrientation>('Trasversale');
  const [selectedSubBrandId, setSelectedSubBrandId] = useState<string>(
    subBrands[0]?.id ?? 'sb-officine-milano',
  );
  const [engineName, setEngineName] = useState<string>('Volta Performance 800V');
  const [codeName, setCodeName] = useState<string>('EV-EAXLE-DUAL-800');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);

  // Pianali selezionati per sovrapposizione simultanea 3D
  const [selectedChassisIds, setSelectedChassisIds] = useState<string[]>(() =>
    chassisList.slice(0, 3).map((c) => c.id),
  );

  // Calcoli Matematici e Telemetrici Real-Time
  const geometry = useMemo(
    () => calculateElectricHybridGeometryAndDimensions(config),
    [config],
  );

  const costs = useMemo(
    () => calculateElectricHybridCosts(config),
    [config],
  );

  const telemetry = useMemo(
    () => simulateElectricHybridDyno(config),
    [config],
  );

  const currentLegalEmissionLimit = useMemo(
    () => getLegalEmissionLimitForYear(currentYear),
    [currentYear],
  );

  // Specifiche selezionate correnti
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
          materialName: `${motorSpec.name} + ${batterySpec.name}`,
          materialResistanceFactor: motorSpec.powerDensityKwPerKg / 3.0,
          mechanicalStressFactor: 1.05,
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
        msg: `Powertrain "${newEngine.name}" (${newEngine.codeName}) omologato con successo!`,
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
            <Zap className="w-4 h-4 animate-pulse" />
            <span>1C — Elettrici & Ibridi (Fase 1.4 Attiva)</span>
          </div>
        </div>

        {/* Badge Sintetici Powertrain Elettrico/Ibrido */}
        <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
          <span className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-sky-300 font-bold flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-sky-400" />
            <span>
              {systemSpec.badge} • {layoutSpec.motorCount} {layoutSpec.motorCount === 1 ? 'Motore' : 'Motori'} ({layoutSpec.drivetrainType})
            </span>
          </span>
          <span className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-emerald-300 font-bold flex items-center gap-1.5">
            <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {config.batteryCapacityKwh} kWh ({batterySpec.id}) • {telemetry.specs.estimatedRangeKm} km WLTP
            </span>
          </span>
          <span className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-amber-300 font-bold">
            Vano: {geometry.engineBayDimensionsMm.lengthMm}×{geometry.engineBayDimensionsMm.widthMm}×
            {geometry.engineBayDimensionsMm.heightMm} mm
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
            className="text-xs opacity-75 hover:opacity-100"
          >
            Chiudi
          </button>
        </div>
      )}

      {/* Layout Principale a Due Colonne: Sinistra Configurazione / Destra Banco Prova & 3D */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ================================================================= */}
        {/* COLONNA SINISTRA: CONFIGURATORE ELETTRO-MECCANICO (7 Colonne)    */}
        {/* ================================================================= */}
        <div className="lg:col-span-7 space-y-6">
          {/* SEZIONE 1: TIPOLOGIA TOPOLOGIA POWERTRAIN */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-sky-400" />
                <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                  1. Tipologia Powertrain Elettrificato (BEV / Ibrido)
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Architettura e grado di elettrificazione
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {HYBRID_SYSTEM_TYPES.map((sys) => {
                const isSelected = config.systemType === sys.id;
                const isLocked = currentYear < sys.minYear;
                return (
                  <button
                    key={sys.id}
                    type="button"
                    disabled={isLocked}
                    onClick={() => handleSystemTypeChange(sys.id)}
                    className={`p-3 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-sky-950/60 border-sky-500 shadow-md shadow-sky-500/10'
                        : isLocked
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-50 cursor-not-allowed'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-xs text-slate-100">{sys.name}</div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                        {sys.minYear}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {sys.description}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono border-t border-slate-800/80 pt-1.5 text-slate-400">
                      <span>Taglio CO2: -{sys.emissionsReductionPercent}%</span>
                      <span className="text-amber-400 font-semibold">
                        Batt: {sys.minBatteryKwh}-{sys.maxBatteryKwh} kWh
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* SEZIONE 2: MOTORE ELETTRICO & GEOMETRIA STATORE/ROTORE */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-sky-400" />
                <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                  2. Tecnologia e Dimensionamento Macchina Elettrica
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Formula di Coppia: T ∝ D_s² · L_r · B_gap
              </span>
            </div>

            {/* Tipologia Motore Elettrico */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider">
                Tipologia Macchina Elettrica (Stator/Rotor Tech)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ELECTRIC_MOTOR_TYPES.map((mot) => {
                  const isSelected = config.electricMotorType === mot.id;
                  const isLocked = currentYear < mot.minYear;
                  return (
                    <button
                      key={mot.id}
                      type="button"
                      disabled={isLocked}
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          electricMotorType: mot.id,
                          maxMotorRpm: Math.min(prev.maxMotorRpm, mot.maxSafeRpm),
                        }))
                      }
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-sky-950/60 border-sky-500 text-sky-200'
                          : isLocked
                          ? 'bg-slate-950/40 border-slate-800/60 opacity-50 cursor-not-allowed'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span>{mot.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{mot.minYear}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                        {mot.description}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-emerald-400">
                        <span>Resa: {mot.peakEfficiencyPercent}%</span>
                        <span>{mot.powerDensityKwPerKg} kW/kg</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Layout e Numero Motori */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider">
                Configurazione e Numero Motori (e-Axle Drivetrain)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {MOTOR_LAYOUT_CONFIGS.map((lay) => {
                  const isSelected = config.motorLayout === lay.id;
                  return (
                    <button
                      key={lay.id}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, motorLayout: lay.id }))}
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-sky-950/60 border-sky-500 text-sky-200'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-xs">{lay.name}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{lay.description}</div>
                      <div className="mt-2 text-[10px] font-mono text-amber-400">
                        {lay.motorCount}× E-Motor • {lay.torqueVectoring ? 'Torque Vectoring' : 'Diff Std'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dimensionamento Statore e Rotore (Ds e Lr) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-300 font-semibold">
                    Diametro Statore (D_s):
                  </span>
                  <span className="text-amber-400 font-bold">{config.statorDiameterMm} mm</span>
                </div>
                <input
                  type="range"
                  min={160}
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
                  <span>Ø 160 mm (Compatto/Giri)</span>
                  <span>Ø 340 mm (Coppia Monstre)</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-300 font-semibold">
                    Lunghezza Rotore (L_r):
                  </span>
                  <span className="text-amber-400 font-bold">{config.rotorLengthMm} mm</span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={300}
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
                  <span>80 mm (Leggero)</span>
                  <span>300 mm (Alta Potenza)</span>
                </div>
              </div>
            </div>

            {/* Regime Massimo Giri Motore Elettrico e Riduzione */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-300 font-semibold">
                    Regime Max E-Motor (Limitatore):
                  </span>
                  <span className="text-sky-400 font-bold">{config.maxMotorRpm} RPM</span>
                </div>
                <input
                  type="range"
                  min={12000}
                  max={motorSpec.maxSafeRpm}
                  step={500}
                  value={config.maxMotorRpm}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      maxMotorRpm: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>12.000 RPM</span>
                  <span>{motorSpec.maxSafeRpm} RPM Max Sicuro</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-300 font-semibold">
                    Rapporto Riduzione Finale:
                  </span>
                  <span className="text-sky-400 font-bold">{config.gearRatio.toFixed(1)}:1</span>
                </div>
                <input
                  type="range"
                  min={6.5}
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
                  <span>6.5:1 (Allungo/Autostrada)</span>
                  <span>13.5:1 (Accelerazione Brutale)</span>
                </div>
              </div>
            </div>
          </section>

          {/* SEZIONE 3: PACCO BATTERIE & ALTA TENSIONE */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Battery className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                  3. Accumulatore Elettrochimico & Alta Tensione
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Densità Cella, BMS e Cicli di Vita
              </span>
            </div>

            {/* Chimica Batterie */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider">
                Chimica Celle Elettrochimiche
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {BATTERY_CHEMISTRIES.map((bat) => {
                  const isSelected = config.batteryChemistry === bat.id;
                  const isLocked = currentYear < bat.minYear;
                  return (
                    <button
                      key={bat.id}
                      type="button"
                      disabled={isLocked}
                      onClick={() => setConfig((prev) => ({ ...prev, batteryChemistry: bat.id }))}
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                          : isLocked
                          ? 'bg-slate-950/40 border-slate-800/60 opacity-50 cursor-not-allowed'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span>{bat.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{bat.minYear}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                        {bat.description}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-emerald-400">
                        <span>{bat.cellDensityWhPerKg} Wh/kg</span>
                        <span>{bat.cycleLife} Cicli</span>
                        <span>${bat.costPerKwh}/kWh</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slider Capacità Batteria (kWh) */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-300 font-semibold">Capacità Pacco Batteria:</span>
                <span className="text-emerald-400 font-bold">
                  {config.batteryCapacityKwh} kWh (Usabili: {(config.batteryCapacityKwh * 0.92).toFixed(1)} kWh)
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
                <span>{systemSpec.minBatteryKwh} kWh Minimo</span>
                <span>{systemSpec.maxBatteryKwh} kWh Massimo</span>
              </div>
            </div>

            {/* Tensione di Sistema: 400V vs 800V */}
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, voltageArchitecture: 400 }))}
                className={`p-3 rounded-lg border text-left cursor-pointer transition ${
                  config.voltageArchitecture === 400
                    ? 'bg-sky-950/60 border-sky-500 text-sky-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-sky-400" />
                  <span>Architettura 400 Volt</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Standard economico, cavi in rame più spessi, ricarica max 150 kW.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, voltageArchitecture: 800 }))}
                className={`p-3 rounded-lg border text-left cursor-pointer transition ${
                  config.voltageArchitecture === 800
                    ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Architettura 800 Volt (Ultra-Fast)</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Corrente dimezzata, cablaggi leggeri (-14 kg), ricarica rapida fino a 350 kW.
                </div>
              </button>
            </div>
          </section>

          {/* SEZIONE 4: INVERTER & RAFFREDDAMENTO */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-sky-400" />
                <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                  4. Elettronica di Potenza & Gestione Termica
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Inverter SiC / GaN e Derating Termico
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Semiconduttore Inverter */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider">
                  Tecnologia Semiconduttore Inverter
                </label>
                {INVERTER_TECHNOLOGIES.map((inv) => {
                  const isSelected = config.inverterTech === inv.id;
                  const isLocked = currentYear < inv.minYear;
                  return (
                    <button
                      key={inv.id}
                      type="button"
                      disabled={isLocked}
                      onClick={() => setConfig((prev) => ({ ...prev, inverterTech: inv.id }))}
                      className={`w-full p-2 rounded-lg border text-left transition cursor-pointer mb-1.5 ${
                        isSelected
                          ? 'bg-sky-950/60 border-sky-500 text-sky-200'
                          : isLocked
                          ? 'bg-slate-950/40 border-slate-800/60 opacity-50 cursor-not-allowed'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span>{inv.name}</span>
                        <span className="text-[10px] font-mono text-emerald-400">
                          Resa: {inv.efficiencyPercent}%
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {inv.switchingFrequencyKhz} kHz • ${inv.costPerInverter}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Sistema di Raffreddamento */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider">
                  Raffreddamento Elettrico / Batteria
                </label>
                {ELECTRIC_COOLING_SYSTEMS.map((cool) => {
                  const isSelected = config.coolingSystem === cool.id;
                  const isLocked = currentYear < cool.minYear;
                  return (
                    <button
                      key={cool.id}
                      type="button"
                      disabled={isLocked}
                      onClick={() => setConfig((prev) => ({ ...prev, coolingSystem: cool.id }))}
                      className={`w-full p-2 rounded-lg border text-left transition cursor-pointer mb-1.5 ${
                        isSelected
                          ? 'bg-sky-950/60 border-sky-500 text-sky-200'
                          : isLocked
                          ? 'bg-slate-950/40 border-slate-800/60 opacity-50 cursor-not-allowed'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span>{cool.name}</span>
                        <span className="text-[10px] font-mono text-sky-400">
                          {Math.round(cool.continuousPowerRatio * 100)}% Cont.
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        +{cool.weightKg} kg • Derating: {cool.thermalDeratingMarginPercent}%
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SEZIONE 5: MOTORE TERMICO ACCOPPIATO (VISIBILE SOLO PER IBRIDI) */}
          {systemSpec.hasIceEngine && (
            <section className="rounded-xl border border-amber-800/70 bg-amber-950/20 p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-amber-800/60 pb-2">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-amber-200">
                    5. Unità Termica Accoppiata (ICE Sinergico)
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-amber-300/80">
                  {config.systemType === 'RangeExtender'
                    ? 'Generatore di Bordo'
                    : 'Trazione Ibrida Parallela'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-300 font-semibold">Cilindrata Termico (ICE):</span>
                    <span className="text-amber-400 font-bold">
                      {config.iceDisplacementCc} cc (
                      {((config.iceDisplacementCc ?? 1998) / 1000).toFixed(1)}L)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={800}
                    max={4500}
                    step={100}
                    value={config.iceDisplacementCc ?? 1998}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        iceDisplacementCc: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>800 cc (Downsized)</span>
                    <span>4.500 cc (V8 Hybrid)</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-2">
                  <label className="text-xs font-mono text-slate-300 font-semibold">
                    Aspirazione & Carburante ICE:
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          iceTurbocharged: !prev.iceTurbocharged,
                        }))
                      }
                      className={`flex-1 py-1.5 px-2 rounded border text-xs font-mono cursor-pointer transition ${
                        config.iceTurbocharged
                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      {config.iceTurbocharged ? 'Turbo Compresso' : 'Aspirato Naturale'}
                    </button>
                    <select
                      value={config.iceFuelType ?? 'Benzina'}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          iceFuelType: e.target.value as any,
                        }))
                      }
                      className="px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-amber-300 text-xs font-mono"
                    >
                      <option value="Benzina">Benzina</option>
                      <option value="Diesel">Diesel</option>
                      <option value="BioFuel">Bio-Etanolo</option>
                    </select>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    Resa termica potenziata da recupero rigenerativo in frenata.
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SEZIONE 6: INTESTAZIONE COMMERCIALE, PREZZI & OMOLOGAZIONE */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                  6. Assegnazione Marchio, Mercato & Omologazione
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Gate Doppia Valuta & Scheda Tecnica
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
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

              <div className="space-y-1">
                <label className="text-slate-400">Fascia di Prezzo:</label>
                <select
                  value={config.priceTier}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, priceTier: e.target.value as PriceTier }))
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-100"
                >
                  {PRICE_TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">Classe Veicolo:</label>
                <select
                  value={config.referenceClass}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      referenceClass: e.target.value as ReferenceClass,
                    }))
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-100"
                >
                  {REFERENCE_CLASSES.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Banner Costo di Sviluppo & Omologazione */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
              <div className="space-y-0.5">
                <div className="text-slate-400 uppercase text-[10px]">Costo Sviluppo Omologazione:</div>
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
                <div className="text-slate-400 uppercase text-[10px]">Costo Produzione Unitario:</div>
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
          {/* BANCO PROVA GRAFICO 2D */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                  Banco Prova Elettrico / Ibrido (1C)
                </h3>
              </div>
              <span className="text-[11px] font-mono text-sky-400 font-semibold">
                {telemetry.peakPowerHp} CV • {telemetry.peakTorqueNm} Nm
              </span>
            </div>

            <TelemetryCanvas2D
              curve={telemetry.curve}
              redlineRpm={telemetry.redlineRpm}
              engineName={engineName}
              displacementLiters={
                systemSpec.hasIceEngine
                  ? Number(((config.iceDisplacementCc ?? 1998) / 1000).toFixed(1))
                  : 0
              }
              architectureLabel={systemSpec.badge}
            />

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
                <span>Coppia (Nm) da 0 RPM</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                <span>Potenza (CV)</span>
              </span>
              <span>Regime Max: {telemetry.redlineRpm} RPM</span>
            </div>
          </section>

          {/* TELEMETRIA SINTETICA DETTAGLIATA */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 font-mono text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Parametri Telemetrici & Ciclo WLTP</span>
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Potenza Elettrica Picco:</div>
                <div className="text-sky-300 font-bold text-sm">
                  {telemetry.specs.peakElectricPowerKw} kW ({Math.round(telemetry.specs.peakElectricPowerKw * 1.3596)} CV)
                </div>
                <div className="text-[10px] text-slate-500">
                  Continua: {telemetry.specs.continuousPowerKw} kW
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Coppia Massima Asse:</div>
                <div className="text-sky-300 font-bold text-sm">
                  {telemetry.peakTorqueNm} Nm
                </div>
                <div className="text-[10px] text-slate-500">
                  a {telemetry.peakTorqueRpm} RPM (Istantanea)
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Consumo Medio WLTP:</div>
                <div className="text-emerald-300 font-bold text-sm">
                  {telemetry.specs.efficiencyWhPerKm} Wh/km
                </div>
                <div className="text-[10px] text-slate-500">
                  Autonomia: {telemetry.specs.estimatedRangeKm} km
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Peso Powertrain Complessivo:</div>
                <div className="text-amber-300 font-bold text-sm">
                  {telemetry.wetWeightKg} kg
                </div>
                <div className="text-[10px] text-slate-500">
                  Batt: {telemetry.specs.batteryWeightKg} kg • Motori: {telemetry.specs.motorWeightKg} kg
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
                <div className="text-[10px] text-slate-500">
                  Soglia Legale {currentYear}: {currentLegalEmissionLimit} g/km
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Affidabilità & Vita Utile:</div>
                <div className="text-emerald-300 font-bold text-sm">
                  {telemetry.reliabilityPercent}%
                </div>
                <div className="text-[10px] text-slate-500">
                  {telemetry.estimatedLifespanKm.toLocaleString('it-IT')} km / {telemetry.specs.batteryLifespanCycles} cicli
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
              electricConfig={config}
              engineType="ElectricHybrid"
              overlaidChassisBays={overlaidChassisBays}
            />

            {/* Selezione Multi-Pianale per Sovrapposizione 3D */}
            <div className="space-y-2 font-mono text-xs">
              <div className="text-[11px] text-slate-400 uppercase">
                Seleziona Pianali da Sovrapporre nel 3D:
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
                        <span className="text-[10px] text-slate-400">({item.chassis.codeName})</span>
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
