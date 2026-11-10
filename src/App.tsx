import React, { useState } from 'react';
import {
  Calendar,
  Coins,
  Cpu,
  Database,
  Flame,
  FlaskConical,
  Layers,
  RotateCw,
} from 'lucide-react';
import { PistonEngineDesigner1A } from './components/engine-lab/PistonEngineDesigner1A';
import { WankelEngineDesigner1B } from './components/engine-lab/WankelEngineDesigner1B';
import { useGameStore } from './store/useGameStore';

type ActiveSection = 'engine-lab-1a' | 'engine-lab-1b' | 'database-overview';

export const App: React.FC = () => {
  const {
    currentYear,
    currentMonth,
    resources,
    subBrands,
    engines,
    chassisList,
    components,
    vehicles,
    transactionLog,
    advanceMonth,
    setHistoricalYear,
    toggleComponentB2B,
  } = useGameStore();

  const [activeSection, setActiveSection] = useState<ActiveSection>('engine-lab-1a');

  const monthNames = [
    'Gennaio',
    'Febbraio',
    'Marzo',
    'Aprile',
    'Maggio',
    'Giugno',
    'Luglio',
    'Agosto',
    'Settembre',
    'Ottobre',
    'Novembre',
    'Dicembre',
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar: Navigazione, Doppia Valuta di Sviluppo & Calendario */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-30 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider uppercase text-slate-100">
                CCT Automotive Engineering Simulator
              </h1>
              <p className="text-[11px] text-slate-400 font-mono">
                macOS 27.2 ARM64 (Apple Silicon M1)
              </p>
            </div>
          </div>

          {/* Navigazione Principale */}
          <nav className="flex items-center gap-1.5 ml-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => setActiveSection('engine-lab-1a')}
              className={`px-3.5 py-2 rounded-lg border flex items-center gap-2 transition cursor-pointer ${
                activeSection === 'engine-lab-1a'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>Fase 1A: Banco Pistoni</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('engine-lab-1b')}
              className={`px-3.5 py-2 rounded-lg border flex items-center gap-2 transition cursor-pointer ${
                activeSection === 'engine-lab-1b'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <RotateCw className="w-4 h-4" />
              <span>Fase 1B: Banco Wankel</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('database-overview')}
              className={`px-3.5 py-2 rounded-lg border flex items-center gap-2 transition cursor-pointer ${
                activeSection === 'database-overview'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Database & Log ({engines.length} Motori)</span>
            </button>
          </nav>
        </div>

        {/* Risorse Doppia Valuta Separate + Selettore Epoca Storica */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-700/50">
            <Coins className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-emerald-400/80 font-mono">
                Capitale Finanziario
              </div>
              <div className="text-sm font-bold font-mono text-emerald-300">
                ${resources.financialCapital.toLocaleString('it-IT')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-sky-950/50 border border-sky-700/50">
            <FlaskConical className="w-4 h-4 text-sky-400" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-sky-400/80 font-mono">
                Punti R&D Dedicati
              </div>
              <div className="text-sm font-bold font-mono text-sky-300">
                {resources.rdPoints.toLocaleString('it-IT')} PTS
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 font-mono text-xs">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="font-semibold">
              {monthNames[(currentMonth - 1) % 12]} {currentYear}
            </span>
            <select
              value={currentYear}
              onChange={(e) => setHistoricalYear(Number(e.target.value))}
              aria-label="Seleziona epoca storica di test"
              className="ml-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-amber-300 text-xs"
            >
              <option value={1974}>Era 1974 (Anni ’70)</option>
              <option value={1986}>Era 1986 (Anni ’80)</option>
              <option value={1998}>Era 1998 (Anni ’90)</option>
              <option value={2006}>Era 2006 (Anni 2000)</option>
              <option value={2016}>Era 2016 (Euro 7)</option>
              <option value={2026}>Era 2026 (Moderna)</option>
            </select>
            <button
              type="button"
              onClick={advanceMonth}
              className="ml-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
            >
              +1 Mese
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto p-6">
        {activeSection === 'engine-lab-1a' ? (
          <PistonEngineDesigner1A onSwitchToWankel={() => setActiveSection('engine-lab-1b')} />
        ) : activeSection === 'engine-lab-1b' ? (
          <WankelEngineDesigner1B onSwitchToPiston={() => setActiveSection('engine-lab-1a')} />
        ) : (
          <div className="space-y-6">
            {/* Database Relazionale Modulare: Le 5 Entità Indipendenti */}
            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider">
                    Database Relazionale Modulare — 5 Entità Indipendenti
                  </h2>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Condivisione Gruppo • Multi-Generazione • Licenze B2B • Allestimenti Multipli
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs font-mono">
                {/* 1. Sotto-Brand */}
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-amber-400 font-bold uppercase flex justify-between">
                    <span>1. Sotto-Brand</span>
                    <span>({subBrands.length})</span>
                  </div>
                  {subBrands.map((sb) => (
                    <div
                      key={sb.id}
                      className="p-2 rounded bg-slate-900 border border-slate-800 space-y-1"
                    >
                      <div className="font-bold text-slate-100">{sb.name}</div>
                      <div className="text-[11px] text-slate-400">
                        Target: {sb.primaryPriceTier} / {sb.primaryTargetClass}
                      </div>
                      <div className="text-[11px] text-emerald-400">
                        Prestigio: {sb.prestige}/100 • Pool: {sb.groupSharingEnabled ? 'SÌ' : 'NO'}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 2. Pianali */}
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-sky-400 font-bold uppercase flex justify-between">
                    <span>2. Pianali</span>
                    <span>({chassisList.length})</span>
                  </div>
                  {chassisList.map((ch) => (
                    <div
                      key={ch.id}
                      className="p-2 rounded bg-slate-900 border border-slate-800 space-y-1"
                    >
                      <div className="font-bold text-slate-100">{ch.name}</div>
                      <div className="text-[11px] text-slate-400">
                        Vano: {ch.engineBayMaxDimensionsMm.lengthMm}×
                        {ch.engineBayMaxDimensionsMm.widthMm}×
                        {ch.engineBayMaxDimensionsMm.heightMm}mm
                      </div>
                      <div className="text-[11px] text-sky-300">
                        {ch.supportedEngineOrientations.join('/')} • Seg. {ch.calculatedSegment}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 3. Motori */}
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-emerald-400 font-bold uppercase flex justify-between">
                    <span>3. Motori</span>
                    <span>({engines.length})</span>
                  </div>
                  {engines.map((en) => (
                    <div
                      key={en.id}
                      className="p-2 rounded bg-slate-900 border border-slate-800 space-y-1"
                    >
                      <div className="font-bold text-slate-100">{en.name}</div>
                      <div className="text-[11px] text-slate-400">
                        LWH: {en.dimensionsMm.lengthMm}×{en.dimensionsMm.widthMm}×
                        {en.dimensionsMm.heightMm}mm
                      </div>
                      <div className="text-[11px] text-emerald-300">
                        {en.telemetry.peakPowerHp} CV / {en.telemetry.peakTorqueNm} Nm
                      </div>
                    </div>
                  ))}
                </div>

                {/* 4. Componenti */}
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-purple-400 font-bold uppercase flex justify-between">
                    <span>4. Componenti</span>
                    <span>({components.length})</span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {components.map((cmp) => (
                      <div
                        key={cmp.id}
                        className="p-2 rounded bg-slate-900 border border-slate-800 space-y-1"
                      >
                        <div className="font-bold text-slate-100">{cmp.name}</div>
                        <div className="text-[10px] text-slate-400">
                          [{cmp.category}] {cmp.taxonomy.priceTier} • {cmp.taxonomy.referenceClass}
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-amber-300">
                            {cmp.taxonomy.estimatedDurabilityKm.toLocaleString('it-IT')} km
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleComponentB2B(cmp.id)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                              cmp.b2bSaleEnabled
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {cmp.b2bSaleEnabled ? 'B2B ON' : 'B2B OFF'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Veicoli */}
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-rose-400 font-bold uppercase flex justify-between">
                    <span>5. Veicoli</span>
                    <span>({vehicles.length})</span>
                  </div>
                  {vehicles.map((vh) => (
                    <div
                      key={vh.id}
                      className="p-2 rounded bg-slate-900 border border-slate-800 space-y-1"
                    >
                      <div className="font-bold text-slate-100">{vh.modelName}</div>
                      <div className="text-[11px] text-slate-400">
                        {vh.generationCode} • {vh.trimType}
                      </div>
                      <div className="text-[11px] text-emerald-300">
                        Listino: ${vh.listPrice.toLocaleString('it-IT')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Log Transazioni Doppia Valuta */}
            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Layers className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  Storico Operazioni Doppia Valuta ($ + Punti R&D)
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs font-mono">
                {transactionLog.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1"
                  >
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>{tx.timestamp}</span>
                      <span>GATE VALIDATO</span>
                    </div>
                    <div className="font-semibold text-slate-200">{tx.actionName}</div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-emerald-400">
                        -${tx.capitalSpent.toLocaleString('it-IT')}
                      </span>
                      <span className="text-sky-400">-{tx.rdSpent} R&D</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
