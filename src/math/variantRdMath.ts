import {
  BLOCK_MATERIALS,
  CAMSHAFT_TYPES,
  CONROD_TYPES,
  CRANKSHAFT_TYPES,
  EXHAUST_MANIFOLDS,
  FUEL_SYSTEMS,
  HEAD_MATERIALS,
  INTAKE_SYSTEMS,
  PISTON_TYPES,
} from '../data/historicalEras';
import type {
  BatteryPackEntity,
  BatteryPackSpec,
  ChassisEntity,
  DualCurrencyCost,
  ElectricMotorEntity,
  ElectricMotorSpec,
  EngineEntity,
} from '../types/gameTypes';
import type { PistonEngineConfigInput } from './engineMath';
import type { WankelEngineConfigInput } from './wankelMath';

const resolveBlockId = (val?: string) =>
  BLOCK_MATERIALS.find((b) => b.id === val || b.name === val)?.id ?? val;
const resolveHeadId = (val?: string) =>
  HEAD_MATERIALS.find((h) => h.id === val || h.name === val)?.id ?? val;
const resolvePistonId = (val?: string) =>
  PISTON_TYPES.find((p) => p.id === val || p.name === val)?.id ?? val;
const resolveConrodId = (val?: string) =>
  CONROD_TYPES.find((c) => c.id === val || c.name === val)?.id ?? val;
const resolveCrankId = (val?: string) =>
  CRANKSHAFT_TYPES.find((c) => c.id === val || c.name === val)?.id ?? val;
const resolveCamId = (val?: string) =>
  CAMSHAFT_TYPES.find((c) => c.id === val || c.name === val)?.id ?? val;
const resolveFuelSysId = (val?: string) =>
  FUEL_SYSTEMS.find((f) => f.id === val || f.name === val)?.id ?? val;
const resolveIntakeId = (val?: string) =>
  INTAKE_SYSTEMS.find((i) => i.id === val || i.name === val)?.id ?? val;
const resolveExhaustId = (val?: string) =>
  EXHAUST_MANIFOLDS.find((e) => e.id === val || e.name === val)?.id ?? val;

const getBlockName = (id?: string) =>
  BLOCK_MATERIALS.find((b) => b.id === id || b.name === id)?.name ?? id ?? '';
const getHeadName = (id?: string) =>
  HEAD_MATERIALS.find((h) => h.id === id || h.name === id)?.name ?? id ?? '';
const getCrankName = (id?: string) =>
  CRANKSHAFT_TYPES.find((c) => c.id === id || c.name === id)?.name ?? id ?? '';
const getCamName = (id?: string) =>
  CAMSHAFT_TYPES.find((c) => c.id === id || c.name === id)?.name ?? id ?? '';
const getFuelSysName = (id?: string) =>
  FUEL_SYSTEMS.find((f) => f.id === id || f.name === id)?.name ?? id ?? '';

export type VariantChangeCategory =
  | 'Fascia 1 — Adattamento Orientamento & Periferiche'
  | 'Fascia 2 — Evoluzione Meccanica Interna (Evo)'
  | 'Fascia 3 — Cambio Strutturale / Nuovi Stampi';

export interface VariantDeltaChange {
  category: VariantChangeCategory;
  label: string;
  rdPercentage: number;
  description: string;
}

export interface VariantRdCalculationResult {
  isVariant: boolean;
  parentId?: string;
  parentName?: string;
  parentCodeName?: string;
  baseDevelopmentCost: DualCurrencyCost;
  effectiveDevelopmentCost: DualCurrencyCost;
  totalRdPercentage: number; // 0 - 100%
  savingsPercentage: number; // 100 - totalRdPercentage
  capitalCost: number;
  rdPoints: number;
  detectedChanges: VariantDeltaChange[];
  hasStructuralMoldChange: boolean;
  structuralWarning?: string;
}

/**
 * Calcola l'R&D per differenza per un Motore Termico a Pistoni (Fase 1A).
 * Anti-Exploit: rileva se le modifiche toccano componenti periferici (5-12%),
 * parti interne rotanti (20-45%) o richiedono nuovi stampi di fonderia (90-100%).
 */
export function calculatePistonVariantRdCost(
  current: PistonEngineConfigInput,
  parentEngine: EngineEntity | undefined,
  baseDevCost: DualCurrencyCost,
): VariantRdCalculationResult {
  if (!parentEngine || !parentEngine.pistonSpecs) {
    return {
      isVariant: false,
      baseDevelopmentCost: baseDevCost,
      effectiveDevelopmentCost: baseDevCost,
      totalRdPercentage: 100,
      savingsPercentage: 0,
      capitalCost: baseDevCost.capitalCost,
      rdPoints: baseDevCost.rdCost,
      detectedChanges: [],
      hasStructuralMoldChange: false,
    };
  }

  const p = parentEngine.pistonSpecs;
  const changes: VariantDeltaChange[] = [];
  let hasStructuralMoldChange = false;

  // =========================================================================
  // FASCIA 3: CAMBIO STRUTTURALE / NUOVI STAMPI (90% - 100% R&D — ZERO SCONTI)
  // =========================================================================
  if (current.architecture !== p.architecture) {
    hasStructuralMoldChange = true;
    changes.push({
      category: 'Fascia 3 — Cambio Strutturale / Nuovi Stampi',
      label: `Architettura Monoblocco (${p.architecture} → ${current.architecture})`,
      rdPercentage: 95,
      description: 'Cambio architettura fondamentale: richiede nuovi stampi completi di fusione e banco prova dedicato.',
    });
  }

  if (current.cylinders !== p.cylinders) {
    hasStructuralMoldChange = true;
    changes.push({
      category: 'Fascia 3 — Cambio Strutturale / Nuovi Stampi',
      label: `Numero Cilindri (${p.cylinders} → ${current.cylinders})`,
      rdPercentage: 95,
      description: 'Nuovo monoblocco a bancate ridisegnate: stampi e linea di lavorazione completamente nuovi.',
    });
  }

  if (
    (current.architecture === 'V' || current.architecture === 'W') &&
    p.bankAngleDeg !== undefined &&
    current.bankAngleDeg !== p.bankAngleDeg
  ) {
    hasStructuralMoldChange = true;
    changes.push({
      category: 'Fascia 3 — Cambio Strutturale / Nuovi Stampi',
      label: `Angolo Bancate (${p.bankAngleDeg}° → ${current.bankAngleDeg}°)`,
      rdPercentage: 90,
      description: 'Nuova geometria angolare della V: rifacimento totale degli stampi di fusione basamento.',
    });
  }

  if (Math.abs(current.boreMm - p.boreMm) > 0.05) {
    hasStructuralMoldChange = true;
    changes.push({
      category: 'Fascia 3 — Cambio Strutturale / Nuovi Stampi',
      label: `Alesaggio Cilindri (${p.boreMm} mm → ${current.boreMm} mm)`,
      rdPercentage: 90,
      description: 'Modifica canne cilindro e interasse: richiede nuovi stampi o alesatura incompatibile con stampo madre.',
    });
  }

  if (current.valvesPerCylinder !== p.valvesPerCylinder) {
    hasStructuralMoldChange = true;
    changes.push({
      category: 'Fascia 3 — Cambio Strutturale / Nuovi Stampi',
      label: `Valvole per Cilindro (${p.valvesPerCylinder}V → ${current.valvesPerCylinder}V)`,
      rdPercentage: 85,
      description: 'Riprogettazione completa camera di scoppio e testata cilindri in fonderia.',
    });
  }

  const parentBlockId = resolveBlockId(p.blockMaterialId ?? p.blockMaterial);
  if (current.blockMaterialId !== parentBlockId) {
    hasStructuralMoldChange = true;
    changes.push({
      category: 'Fascia 3 — Cambio Strutturale / Nuovi Stampi',
      label: `Materiale Monoblocco (${getBlockName(parentBlockId)} → ${getBlockName(current.blockMaterialId)})`,
      rdPercentage: 85,
      description: 'Cambio metallurgia di fusione (es. Ghisa vs Alluminio): diversi coefficienti di dilatazione e stampi dedicati.',
    });
  }

  // Se è scattato un cambio strutturale, lo sconto decade totalmente
  if (hasStructuralMoldChange) {
    const totalRdPct = 95;
    return {
      isVariant: true,
      parentId: parentEngine.id,
      parentName: parentEngine.name,
      parentCodeName: parentEngine.codeName,
      baseDevelopmentCost: baseDevCost,
      effectiveDevelopmentCost: {
        capitalCost: Math.round(baseDevCost.capitalCost * (totalRdPct / 100)),
        rdCost: Math.round(baseDevCost.rdCost * (totalRdPct / 100)),
        minYear: baseDevCost.minYear,
      },
      totalRdPercentage: totalRdPct,
      savingsPercentage: 100 - totalRdPct,
      capitalCost: Math.round(baseDevCost.capitalCost * (totalRdPct / 100)),
      rdPoints: Math.round(baseDevCost.rdCost * (totalRdPct / 100)),
      detectedChanges: changes,
      hasStructuralMoldChange: true,
      structuralWarning:
        'ATTENZIONE ANTI-EXPLOIT: Rilevate modifiche strutturali (Architettura, Cilindri, Alesaggio, Valvole o Materiale Blocco). Nuovi stampi di fonderia necessari: costo R&D al 95% rispetto a un motore da zero.',
    };
  }

  // =========================================================================
  // FASCIA 2: EVOLUZIONE MECCANICA INTERNA ("EVO") (12% - 22% R&D ciascuna)
  // =========================================================================
  if (Math.abs(current.strokeMm - p.strokeMm) > 0.05) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: `Corsa Albero Motore (${p.strokeMm} mm → ${current.strokeMm} mm)`,
      rdPercentage: 20,
      description: 'Stesso alesaggio ma corsa modificata: nuovo albero a gomiti e calibrazione dinamica manovellismo.',
    });
  }

  if (current.turboType !== p.turboType) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: `Schema Sovralimentazione (${p.turboType} → ${current.turboType})`,
      rdPercentage: 22,
      description: 'Riprogettazione completa impianto di sovralimentazione, intercooler e contropressioni.',
    });
  }

  const parentCamId = resolveCamId(p.camshaftTypeId ?? p.camshaftType);
  if (current.camshaftTypeId !== parentCamId) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: `Distribuzione e Alberi a Camme (${getCamName(parentCamId)} → ${getCamName(current.camshaftTypeId)})`,
      rdPercentage: 15,
      description: 'Nuovo profilo camme, fasatura VVT e test alzata valvole.',
    });
  }

  const parentHeadId = resolveHeadId(p.headMaterialId ?? p.headMaterial);
  if (current.headMaterialId !== parentHeadId) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: `Materiale Testata (${getHeadName(parentHeadId)} → ${getHeadName(current.headMaterialId)})`,
      rdPercentage: 14,
      description: 'Nuova lega per testata, tenuta guarnizioni e flussaggio termico.',
    });
  }

  const parentConrodId = resolveConrodId(p.conrodTypeId ?? p.conrodType);
  const parentPistonId = resolvePistonId(p.pistonTypeId ?? p.pistonType);
  if (current.conrodTypeId !== parentConrodId || current.pistonTypeId !== parentPistonId) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: 'Bielle e Pistoni Rinforzati/Forgiati',
      rdPercentage: 12,
      description: 'Aggiornamento componenti manovellismo interno per sopportare regimi o BMEP maggiori.',
    });
  }

  const parentCrankId = resolveCrankId(p.crankshaftTypeId ?? p.crankshaftType);
  if (current.crankshaftTypeId !== parentCrankId) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: `Albero a Gomiti (${getCrankName(parentCrankId)} → ${getCrankName(current.crankshaftTypeId)})`,
      rdPercentage: 12,
      description: 'Trattamento termico o forgiatura dell albero motore con bilanciatura contrappesi.',
    });
  }

  if (current.turboPosition !== p.turboPosition && current.turboType !== 'NaturallyAspirated') {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: `Posizionamento Turbine nel Vano (${p.turboPosition} → ${current.turboPosition})`,
      rdPercentage: 14,
      description: 'Riprogettazione layout termico turbine (Frontali/Laterali/Hot-V) e condotti olio.',
    });
  }

  // =========================================================================
  // FASCIA 1: ADATTAMENTO ORIENTAMENTO E PERIFERICHE (4% - 8% R&D ciascuna)
  // =========================================================================
  if (current.intendedOrientation !== p.intendedOrientation) {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: `Conversione Orientamento (${p.intendedOrientation} → ${current.intendedOrientation})`,
      rdPercentage: 8,
      description: 'Adattamento stile Mercedes M139 (A45 Trasv. → C43 Long.): riprogettazione coppa olio con paratie anti-G, supporti motore e ausiliari.',
    });
  }

  const pTurboAr = p.turboArRatio ?? 0.6;
  if (Math.abs(current.turboArRatio - pTurboAr) > 0.05 && current.turboType !== 'NaturallyAspirated') {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: `Calibrazione A/R Turbina (${pTurboAr} → ${current.turboArRatio})`,
      rdPercentage: 5,
      description: 'Ricalibrazione chiocciole turbina e mappa di contropressione.',
    });
  }

  const pBoost = p.boostPressureBar ?? 0;
  if (Math.abs(current.boostPressureBar - pBoost) > 0.06 && current.turboType !== 'NaturallyAspirated') {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: `Pressione Boost Turbo (${pBoost.toFixed(2)} bar → ${current.boostPressureBar.toFixed(2)} bar)`,
      rdPercentage: 4,
      description: 'Mappatura centralina wastegate e banco prova pressione sovralimentazione.',
    });
  }

  const pCr = p.compressionRatio ?? 10.0;
  if (Math.abs(current.compressionRatio - pCr) > 0.15) {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: `Rapporto di Compressione (${pCr.toFixed(1)}:1 → ${current.compressionRatio.toFixed(1)}:1)`,
      rdPercentage: 5,
      description: 'Ottimizzazione volume cielo pistone e tolleranza al battito in testa.',
    });
  }

  const pRedline = p.manualRedlineRpm ?? 6500;
  if (Math.abs(current.manualRedlineRpm - pRedline) > 150) {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: `Limitatore Regime Giri (${pRedline} RPM → ${current.manualRedlineRpm} RPM)`,
      rdPercentage: 4,
      description: 'Taratura elettronica limitatore giri e verifica molle valvole.',
    });
  }

  const parentFuelSysId = resolveFuelSysId(p.fuelSystemId ?? p.fuelSystem);
  if (current.fuelSystemId !== parentFuelSysId || current.fuelType !== p.fuelType) {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: `Sistema Iniezione ed Alimentazione (${getFuelSysName(parentFuelSysId)} → ${getFuelSysName(current.fuelSystemId)})`,
      rdPercentage: 6,
      description: 'Aggiornamento rail iniettori, pompa alta pressione e taratura miscela.',
    });
  }

  const parentIntakeId = resolveIntakeId(p.intakeSystemId ?? p.intakeSystem);
  const parentExhaustId = resolveExhaustId(p.exhaustManifoldId ?? p.exhaustManifold);
  if (current.intakeSystemId !== parentIntakeId || current.exhaustManifoldId !== parentExhaustId) {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: 'Collettori di Aspirazione / Scarico',
      rdPercentage: 5,
      description: 'Riprogettazione fluidodinamica condotti aria e flangia scarico.',
    });
  }

  if (current.catalystEra !== p.catalystEra) {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: 'Modulo Catalitico e Sistema Anti-Inquinamento',
      rdPercentage: 4,
      description: 'Omologazione conforme ai nuovi vincoli normativi sulle emissioni.',
    });
  }

  // Calcolo totale R&D percentuale:
  // Se non è cambiata nessuna componente tecnica (solo nome o cosmetica), minimo 5%
  const sumPct = changes.reduce((acc, c) => acc + c.rdPercentage, 0);
  const totalRdPercentage = Math.min(85, Math.max(5, sumPct));
  const savingsPercentage = 100 - totalRdPercentage;

  const effectiveDevelopmentCost: DualCurrencyCost = {
    capitalCost: Math.round(baseDevCost.capitalCost * (totalRdPercentage / 100)),
    rdCost: Math.max(10, Math.round(baseDevCost.rdCost * (totalRdPercentage / 100))),
    minYear: baseDevCost.minYear,
  };

  return {
    isVariant: true,
    parentId: parentEngine.id,
    parentName: parentEngine.name,
    parentCodeName: parentEngine.codeName,
    baseDevelopmentCost: baseDevCost,
    effectiveDevelopmentCost,
    totalRdPercentage,
    savingsPercentage,
    capitalCost: effectiveDevelopmentCost.capitalCost,
    rdPoints: effectiveDevelopmentCost.rdCost,
    detectedChanges: changes,
    hasStructuralMoldChange: false,
  };
}

/**
 * Calcola l'R&D per differenza per un Motore Rotativo Wankel (Fase 1B).
 */
export function calculateWankelVariantRdCost(
  current: WankelEngineConfigInput,
  parentEngine: EngineEntity | undefined,
  baseDevCost: DualCurrencyCost,
): VariantRdCalculationResult {
  if (!parentEngine || !parentEngine.wankelSpecs) {
    return {
      isVariant: false,
      baseDevelopmentCost: baseDevCost,
      effectiveDevelopmentCost: baseDevCost,
      totalRdPercentage: 100,
      savingsPercentage: 0,
      capitalCost: baseDevCost.capitalCost,
      rdPoints: baseDevCost.rdCost,
      detectedChanges: [],
      hasStructuralMoldChange: false,
    };
  }

  const p = parentEngine.wankelSpecs;
  const changes: VariantDeltaChange[] = [];
  let hasStructuralMoldChange = false;

  if (current.rotorCount !== p.rotorCount) {
    hasStructuralMoldChange = true;
    changes.push({
      category: 'Fascia 3 — Cambio Strutturale / Nuovi Stampi',
      label: `Numero Rotori (${p.rotorCount} → ${current.rotorCount})`,
      rdPercentage: 95,
      description: 'Cambio numero rotori: nuovo albero eccentrico monolitico e nuove piastre intermedie.',
    });
  }

  if (
    Math.abs(current.generatingRadiusMm - p.generatingRadiusMm) > 0.1 ||
    Math.abs(current.eccentricityMm - p.eccentricityMm) > 0.05
  ) {
    hasStructuralMoldChange = true;
    changes.push({
      category: 'Fascia 3 — Cambio Strutturale / Nuovi Stampi',
      label: 'Geometria Curva Epitrocoide (Raggio R / Eccentricità e)',
      rdPercentage: 95,
      description: 'Nuovo profilo trocoidale: rifacimento totale degli stampi statori rotativi.',
    });
  }

  if (current.housingMaterialId !== p.housingMaterialId) {
    hasStructuralMoldChange = true;
    changes.push({
      category: 'Fascia 3 — Cambio Strutturale / Nuovi Stampi',
      label: 'Materiale Alloggiamento Trocoide',
      rdPercentage: 85,
      description: 'Cambio metallurgia piastre e riporto cromo/ceramico interno.',
    });
  }

  if (hasStructuralMoldChange) {
    const totalRdPct = 95;
    return {
      isVariant: true,
      parentId: parentEngine.id,
      parentName: parentEngine.name,
      parentCodeName: parentEngine.codeName,
      baseDevelopmentCost: baseDevCost,
      effectiveDevelopmentCost: {
        capitalCost: Math.round(baseDevCost.capitalCost * (totalRdPct / 100)),
        rdCost: Math.round(baseDevCost.rdCost * (totalRdPct / 100)),
        minYear: baseDevCost.minYear,
      },
      totalRdPercentage: totalRdPct,
      savingsPercentage: 100 - totalRdPct,
      capitalCost: Math.round(baseDevCost.capitalCost * (totalRdPct / 100)),
      rdPoints: Math.round(baseDevCost.rdCost * (totalRdPct / 100)),
      detectedChanges: changes,
      hasStructuralMoldChange: true,
      structuralWarning:
        'ATTENZIONE ANTI-EXPLOIT: Rilevate modifiche strutturali Wankel (Rotori, Profilo Trocoide o Materiale Alloggiamento). Costo R&D al 95%.',
    };
  }

  // Fascia 2 Wankel
  if (Math.abs(current.rotorWidthMm - p.rotorWidthMm) > 0.1) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: `Spessore Rotore B (${p.rotorWidthMm} mm → ${current.rotorWidthMm} mm)`,
      rdPercentage: 22,
      description: 'Allargamento camera epitrocoide e nuovo rotore forgiato bilanciato.',
    });
  }

  if (current.portType !== p.portType) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: `Tipologia Luce d'Aspirazione (${p.portType} → ${current.portType})`,
      rdPercentage: 18,
      description: 'Lavorazione luci Side Port / Bridge Port / Peripheral Port e fasatura aspirazione.',
    });
  }

  if (
    current.apexSealMaterialId !== p.apexSealMaterialId ||
    current.apexSealThicknessMm !== p.apexSealThicknessMm
  ) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: 'Guarnizioni Apicali (Apex Seals) & Spessore',
      rdPercentage: 12,
      description: 'Nuova metallurgia guarnizioni apex in titanio/ceramica e tolleranze termiche.',
    });
  }

  if (current.turboType !== p.turboType) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: 'Impianto Sovralimentazione Turbo Wankel',
      rdPercentage: 22,
      description: 'Riprogettazione wastegate ad alta portata per temperature gas di scarico fino a 1050°C.',
    });
  }

  // Fascia 1 Wankel
  if (current.intendedOrientation !== p.intendedOrientation) {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: `Adattamento Orientamento (${p.intendedOrientation} → ${current.intendedOrientation})`,
      rdPercentage: 8,
      description: 'Adattamento coppa olio secca/umida e percorsi lubrificazione laterale.',
    });
  }

  if (Math.abs(current.compressionRatio - p.compressionRatio) > 0.15) {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: `Rapporto di Compressione Wankel (${p.compressionRatio}:1 → ${current.compressionRatio}:1)`,
      rdPercentage: 5,
      description: 'Lavorazione tasche rotore e ricalibrazione anticipo accensione.',
    });
  }

  if (Math.abs(current.boostPressureBar - (p.boostPressureBar ?? 0)) > 0.05 && current.turboType !== 'NaturallyAspirated') {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: 'Mappatura Pressione Boost Turbo',
      rdPercentage: 4,
      description: 'Calibrazione pressione al banco prova dinamometrico.',
    });
  }

  if (Math.abs(current.manualRedlineRpm - p.manualRedlineRpm) > 150) {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: 'Regime Massimo di Giri (Limitatore)',
      rdPercentage: 4,
      description: 'Taratura giri massimi e verifica oscillazione albero eccentrico.',
    });
  }

  if (current.oilMeteringSystemId !== p.oilMeteringSystemId) {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: 'Pompa Iniezione Olio (OMP)',
      rdPercentage: 5,
      description: 'Taratura elettronica portata lubrificazione trocoide.',
    });
  }

  const sumPct = changes.reduce((acc, c) => acc + c.rdPercentage, 0);
  const totalRdPercentage = Math.min(85, Math.max(5, sumPct));
  const savingsPercentage = 100 - totalRdPercentage;

  const effectiveDevelopmentCost: DualCurrencyCost = {
    capitalCost: Math.round(baseDevCost.capitalCost * (totalRdPercentage / 100)),
    rdCost: Math.max(10, Math.round(baseDevCost.rdCost * (totalRdPercentage / 100))),
    minYear: baseDevCost.minYear,
  };

  return {
    isVariant: true,
    parentId: parentEngine.id,
    parentName: parentEngine.name,
    parentCodeName: parentEngine.codeName,
    baseDevelopmentCost: baseDevCost,
    effectiveDevelopmentCost,
    totalRdPercentage,
    savingsPercentage,
    capitalCost: effectiveDevelopmentCost.capitalCost,
    rdPoints: effectiveDevelopmentCost.rdCost,
    detectedChanges: changes,
    hasStructuralMoldChange: false,
  };
}

/**
 * Calcola l'R&D per differenza per un Motore Elettrico Singolo (Fase 1C - Pannello 1).
 */
export function calculateElectricMotorVariantRdCost(
  current: ElectricMotorSpec,
  parentMotor: ElectricMotorEntity | undefined,
  baseDevCost: DualCurrencyCost,
): VariantRdCalculationResult {
  if (!parentMotor) {
    return {
      isVariant: false,
      baseDevelopmentCost: baseDevCost,
      effectiveDevelopmentCost: baseDevCost,
      totalRdPercentage: 100,
      savingsPercentage: 0,
      capitalCost: baseDevCost.capitalCost,
      rdPoints: baseDevCost.rdCost,
      detectedChanges: [],
      hasStructuralMoldChange: false,
    };
  }

  const p = parentMotor.spec;
  const changes: VariantDeltaChange[] = [];
  let hasStructuralMoldChange = false;

  if (current.electricMotorType !== p.electricMotorType) {
    hasStructuralMoldChange = true;
    changes.push({
      category: 'Fascia 3 — Cambio Strutturale / Nuovi Stampi',
      label: `Tipologia Macchina Elettrica (${p.electricMotorType} → ${current.electricMotorType})`,
      rdPercentage: 90,
      description: 'Cambio principio elettromagnetico (ASM / PSM / IPM-SynRM / Flusso Assiale): riprogettazione da zero.',
    });
  }

  if (Math.abs(current.statorDiameterMm - p.statorDiameterMm) > 2) {
    hasStructuralMoldChange = true;
    changes.push({
      category: 'Fascia 3 — Cambio Strutturale / Nuovi Stampi',
      label: `Diametro Statore (${p.statorDiameterMm} mm → ${current.statorDiameterMm} mm)`,
      rdPercentage: 85,
      description: 'Nuovi stampi di tranciatura lamierini magnetici dello statore.',
    });
  }

  if (hasStructuralMoldChange) {
    const totalRdPct = 90;
    return {
      isVariant: true,
      parentId: parentMotor.id,
      parentName: parentMotor.name,
      parentCodeName: parentMotor.codeName,
      baseDevelopmentCost: baseDevCost,
      effectiveDevelopmentCost: {
        capitalCost: Math.round(baseDevCost.capitalCost * (totalRdPct / 100)),
        rdCost: Math.round(baseDevCost.rdCost * (totalRdPct / 100)),
        minYear: baseDevCost.minYear,
      },
      totalRdPercentage: totalRdPct,
      savingsPercentage: 100 - totalRdPct,
      capitalCost: Math.round(baseDevCost.capitalCost * (totalRdPct / 100)),
      rdPoints: Math.round(baseDevCost.rdCost * (totalRdPct / 100)),
      detectedChanges: changes,
      hasStructuralMoldChange: true,
      structuralWarning:
        'ATTENZIONE ANTI-EXPLOIT: Rilevata modifica tipologia elettromagnetica o diametro statore. Nuovi stampi tranciatura: costo R&D al 90%.',
    };
  }

  // Fascia 2 Elettrico
  if (Math.abs(current.rotorLengthMm - p.rotorLengthMm) > 2) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: `Allungamento Pacco Rotore (${p.rotorLengthMm} mm → ${current.rotorLengthMm} mm)`,
      rdPercentage: 18,
      description: 'Stesso diametro statore ma rotore allungato: calibrazione torsionale e alloggiamento.',
    });
  }

  if (current.inverterPowerElectronics !== p.inverterPowerElectronics) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: 'Elettronica Inverter (IGBT / SiC / GaN)',
      rdPercentage: 12,
      description: 'Nuovo stadio di potenza a semiconduttore e calibrazione frequenza di commutazione.',
    });
  }

  if (current.statorWinding !== p.statorWinding) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: 'Tecnologia Avvolgimenti Statore (Hairpin / Litz)',
      rdPercentage: 12,
      description: 'Nuovo schema barre piatte o filo litz con isolamento alta frequenza.',
    });
  }

  if (current.rotorMagnetMaterial !== p.rotorMagnetMaterial) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: 'Materiale Magneti / Gabbia Rotore',
      rdPercentage: 10,
      description: 'Aggiornamento lega terre rare (NdFeB-UH / SmCo) o gabbia alluminio per alte temperature.',
    });
  }

  if (current.rotorSleeveBearing !== p.rotorSleeveBearing) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: 'Camicia Rotore e Cuscinetti Ceramici',
      rdPercentage: 10,
      description: 'Fasciatura in fibra di carbonio o inconel per regimi fino a 24.000 RPM.',
    });
  }

  // Fascia 1 Elettrico
  if (current.voltageArchitecture !== p.voltageArchitecture) {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: `Tensione di Sistema (${p.voltageArchitecture}V → ${current.voltageArchitecture}V)`,
      rdPercentage: 8,
      description: 'Adeguamento isolamenti galvanici e busbar di potenza.',
    });
  }

  if (current.coolingSystem !== p.coolingSystem) {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: `Sistema Raffreddamento Motore (${p.coolingSystem} → ${current.coolingSystem})`,
      rdPercentage: 7,
      description: 'Integrazione camicia a liquido statore o immersione dielettrica.',
    });
  }

  if (current.motorHousing !== p.motorHousing) {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: 'Carcassa Esterna e Supporti NVH',
      rdPercentage: 6,
      description: 'Lavorazione guscio alleggerito magnesio/carbonio o isolamento acustico attivo.',
    });
  }

  const sumPct = changes.reduce((acc, c) => acc + c.rdPercentage, 0);
  const totalRdPercentage = Math.min(85, Math.max(5, sumPct));
  const savingsPercentage = 100 - totalRdPercentage;

  const effectiveDevelopmentCost: DualCurrencyCost = {
    capitalCost: Math.round(baseDevCost.capitalCost * (totalRdPercentage / 100)),
    rdCost: Math.max(10, Math.round(baseDevCost.rdCost * (totalRdPercentage / 100))),
    minYear: baseDevCost.minYear,
  };

  return {
    isVariant: true,
    parentId: parentMotor.id,
    parentName: parentMotor.name,
    parentCodeName: parentMotor.codeName,
    baseDevelopmentCost: baseDevCost,
    effectiveDevelopmentCost,
    totalRdPercentage,
    savingsPercentage,
    capitalCost: effectiveDevelopmentCost.capitalCost,
    rdPoints: effectiveDevelopmentCost.rdCost,
    detectedChanges: changes,
    hasStructuralMoldChange: false,
  };
}

/**
 * Calcola l'R&D per differenza per un Pacco Batteria (Fase 1C - Pannello 2).
 */
export function calculateBatteryPackVariantRdCost(
  current: BatteryPackSpec,
  parentBattery: BatteryPackEntity | undefined,
  baseDevCost: DualCurrencyCost,
): VariantRdCalculationResult {
  if (!parentBattery) {
    return {
      isVariant: false,
      baseDevelopmentCost: baseDevCost,
      effectiveDevelopmentCost: baseDevCost,
      totalRdPercentage: 100,
      savingsPercentage: 0,
      capitalCost: baseDevCost.capitalCost,
      rdPoints: baseDevCost.rdCost,
      detectedChanges: [],
      hasStructuralMoldChange: false,
    };
  }

  const p = parentBattery.spec;
  const changes: VariantDeltaChange[] = [];
  let hasStructuralMoldChange = false;

  if (current.batteryChemistry !== p.batteryChemistry) {
    hasStructuralMoldChange = true;
    changes.push({
      category: 'Fascia 3 — Cambio Strutturale / Nuovi Stampi',
      label: `Chimica Elettrochimica Celle (${p.batteryChemistry} → ${current.batteryChemistry})`,
      rdPercentage: 90,
      description: 'Cambio formulazione celle (LFP / NMC811 / Solid State): richiede nuova certificazione di sicurezza e crash test.',
    });
  }

  if (current.packStructure !== p.packStructure) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: `Architettura Strutturale Pacco (${p.packStructure ?? 'Modular'} → ${current.packStructure ?? 'Modular'})`,
      rdPercentage: 25,
      description: 'Passaggio tra moduli tradizionali, Cell-to-Pack (CTP) o Cell-to-Chassis (CTC).',
    });
  }

  if (Math.abs(current.batteryCapacityKwh - p.batteryCapacityKwh) > 1.5) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: `Capacità Accumulo (${p.batteryCapacityKwh} kWh → ${current.batteryCapacityKwh} kWh)`,
      rdPercentage: 20,
      description: 'Rimodulazione numero di stringhe in serie/parallelo e bilanciamento termico.',
    });
  }

  if (current.bmsCalibration !== p.bmsCalibration) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: 'Taratura BMS e Profilo di Scarica (C-Rate)',
      rdPercentage: 12,
      description: 'Ricalibrazione algoritmi State-of-Charge (SoC) e correnti di picco qualifica.',
    });
  }

  if (current.underbodyShield !== p.underbodyShield) {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: 'Protezione Sottoscocca Pacco',
      rdPercentage: 8,
      description: 'Piastra balistica titanio/kevlar o lamiera standard per uso gravoso.',
    });
  }

  if (current.voltageArchitecture !== p.voltageArchitecture) {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: `Tensione Pacco Batteria (${p.voltageArchitecture}V → ${current.voltageArchitecture}V)`,
      rdPercentage: 8,
      description: 'Adeguamento isolamenti contattori pirotecnici e linee BMS.',
    });
  }

  if (hasStructuralMoldChange) {
    const totalRdPct = 90;
    return {
      isVariant: true,
      parentId: parentBattery.id,
      parentName: parentBattery.name,
      parentCodeName: parentBattery.codeName,
      baseDevelopmentCost: baseDevCost,
      effectiveDevelopmentCost: {
        capitalCost: Math.round(baseDevCost.capitalCost * (totalRdPct / 100)),
        rdCost: Math.round(baseDevCost.rdCost * (totalRdPct / 100)),
        minYear: baseDevCost.minYear,
      },
      totalRdPercentage: totalRdPct,
      savingsPercentage: 100 - totalRdPct,
      capitalCost: Math.round(baseDevCost.capitalCost * (totalRdPct / 100)),
      rdPoints: Math.round(baseDevCost.rdCost * (totalRdPct / 100)),
      detectedChanges: changes,
      hasStructuralMoldChange: true,
      structuralWarning:
        'ATTENZIONE: Rilevata modifica radicale chimica della batteria. Richiede nuovi test di sicurezza termica: costo R&D al 90%.',
    };
  }

  const sumPct = changes.reduce((acc, c) => acc + c.rdPercentage, 0);
  const totalRdPercentage = Math.min(85, Math.max(5, sumPct));
  const savingsPercentage = 100 - totalRdPercentage;

  const effectiveDevelopmentCost: DualCurrencyCost = {
    capitalCost: Math.round(baseDevCost.capitalCost * (totalRdPercentage / 100)),
    rdCost: Math.max(10, Math.round(baseDevCost.rdCost * (totalRdPercentage / 100))),
    minYear: baseDevCost.minYear,
  };

  return {
    isVariant: true,
    parentId: parentBattery.id,
    parentName: parentBattery.name,
    parentCodeName: parentBattery.codeName,
    baseDevelopmentCost: baseDevCost,
    effectiveDevelopmentCost,
    totalRdPercentage,
    savingsPercentage,
    capitalCost: effectiveDevelopmentCost.capitalCost,
    rdPoints: effectiveDevelopmentCost.rdCost,
    detectedChanges: changes,
    hasStructuralMoldChange: false,
  };
}

/**
 * Predisposizione Fase 2: Calcolo Delta R&D Anti-Exploit per Varianti Pianale (Chassis).
 * - Variare passo o carreggiate su stessa piattaforma: 15% - 25% R&D.
 * - Cambiare materiale telaio o posizione vano motore: 90% - 100% R&D (stampi scocca azzerati).
 */
export function calculatePlatformVariantRdCost(
  current: ChassisEntity,
  parentChassis: ChassisEntity | undefined,
  baseDevCost: DualCurrencyCost,
): VariantRdCalculationResult {
  if (!parentChassis) {
    return {
      isVariant: false,
      baseDevelopmentCost: baseDevCost,
      effectiveDevelopmentCost: baseDevCost,
      totalRdPercentage: 100,
      savingsPercentage: 0,
      capitalCost: baseDevCost.capitalCost,
      rdPoints: baseDevCost.rdCost,
      detectedChanges: [],
      hasStructuralMoldChange: false,
    };
  }

  const changes: VariantDeltaChange[] = [];
  let hasStructuralMoldChange = false;

  // Modifica posizione vano motore (Anteriore vs Posteriore vs Centrale)
  const posA = current.supportedEnginePositions.sort().join(',');
  const posB = parentChassis.supportedEnginePositions.sort().join(',');
  if (posA !== posB) {
    hasStructuralMoldChange = true;
    changes.push({
      category: 'Fascia 3 — Cambio Strutturale / Nuovi Stampi',
      label: 'Posizione Montaggio Propulsore nel Telaio',
      rdPercentage: 95,
      description: 'Riconfigurazione completa pianale anteriore/posteriore: azzeramento stampi e linee robotizzate.',
    });
  }

  // Modifica materiale scocca principale
  if (current.taxonomy.materialStress.materialName !== parentChassis.taxonomy.materialStress.materialName) {
    hasStructuralMoldChange = true;
    changes.push({
      category: 'Fascia 3 — Cambio Strutturale / Nuovi Stampi',
      label: 'Materiale Struttura Portante Scocca',
      rdPercentage: 90,
      description: 'Cambiamento tecnologia telaio (es. Acciaio vs Carbonio vs Alluminio estruso).',
    });
  }

  if (hasStructuralMoldChange) {
    const totalRdPct = 95;
    return {
      isVariant: true,
      parentId: parentChassis.id,
      parentName: parentChassis.name,
      parentCodeName: parentChassis.codeName,
      baseDevelopmentCost: baseDevCost,
      effectiveDevelopmentCost: {
        capitalCost: Math.round(baseDevCost.capitalCost * (totalRdPct / 100)),
        rdCost: Math.round(baseDevCost.rdCost * (totalRdPct / 100)),
        minYear: baseDevCost.minYear,
      },
      totalRdPercentage: totalRdPct,
      savingsPercentage: 100 - totalRdPct,
      capitalCost: Math.round(baseDevCost.capitalCost * (totalRdPct / 100)),
      rdPoints: Math.round(baseDevCost.rdCost * (totalRdPct / 100)),
      detectedChanges: changes,
      hasStructuralMoldChange: true,
      structuralWarning:
        'ATTENZIONE: Modificata posizione motore o materiale telaio. Necessari nuovi stampi scocca: costo R&D al 95%.',
    };
  }

  // Fascia 2 Pianale: Variazione Passo (Wheelbase) o Carreggiata (Track)
  if (Math.abs(current.wheelbaseMm - parentChassis.wheelbaseMm) > 10) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: `Variazione Passo Ruote (${parentChassis.wheelbaseMm} mm → ${current.wheelbaseMm} mm)`,
      rdPercentage: 18,
      description: 'Allungamento pavimento pianale modulare ed estrusi tunnel centrale.',
    });
  }

  if (
    Math.abs(current.frontTrackMm - parentChassis.frontTrackMm) > 10 ||
    Math.abs(current.rearTrackMm - parentChassis.rearTrackMm) > 10
  ) {
    changes.push({
      category: 'Fascia 2 — Evoluzione Meccanica Interna (Evo)',
      label: 'Variazione Carreggiate Anteriore/Posteriore',
      rdPercentage: 15,
      description: 'Nuovi bracci sospensione, semiassi allungati e duomi passaruota.',
    });
  }

  // Fascia 1 Pianale: Taratura altezza da terra o orientamento motore
  if (Math.abs(current.groundClearanceMm - parentChassis.groundClearanceMm) > 5) {
    changes.push({
      category: 'Fascia 1 — Adattamento Orientamento & Periferiche',
      label: 'Altezza da Terra e Assetto Sospensivo',
      rdPercentage: 8,
      description: 'Taratura molle, ammortizzatori e angoli caratteristici ruota.',
    });
  }

  const sumPct = changes.reduce((acc, c) => acc + c.rdPercentage, 0);
  const totalRdPercentage = Math.min(85, Math.max(10, sumPct));
  const savingsPercentage = 100 - totalRdPercentage;

  const effectiveDevelopmentCost: DualCurrencyCost = {
    capitalCost: Math.round(baseDevCost.capitalCost * (totalRdPercentage / 100)),
    rdCost: Math.max(20, Math.round(baseDevCost.rdCost * (totalRdPercentage / 100))),
    minYear: baseDevCost.minYear,
  };

  return {
    isVariant: true,
    parentId: parentChassis.id,
    parentName: parentChassis.name,
    parentCodeName: parentChassis.codeName,
    baseDevelopmentCost: baseDevCost,
    effectiveDevelopmentCost,
    totalRdPercentage,
    savingsPercentage,
    capitalCost: effectiveDevelopmentCost.capitalCost,
    rdPoints: effectiveDevelopmentCost.rdCost,
    detectedChanges: changes,
    hasStructuralMoldChange: false,
  };
}
