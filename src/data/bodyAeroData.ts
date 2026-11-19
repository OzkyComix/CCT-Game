import type {
  ActiveAeroType,
  AirbagPackageId,
  BodyMaterialId,
  BodyStyle,
  FrontAeroType,
  PriceTier,
  RearAeroType,
  UnderbodyAeroType,
} from '../types/gameTypes';

export interface BodyStyleOption {
  id: BodyStyle;
  label: string;
  /** Fattore di forma per area frontale effettiva rispetto al rettangolo depurato da luce a terra */
  frontalShapeFactor: number;
  /** Superficie relativa pannelli esterni, vetrature e chiusure */
  panelSurfaceFactor: number;
  /** Cx di riferimento moderno della carrozzeria (prima dei modificatori epoca/raffreddamento/raffinatezza) */
  baseCx: number;
  /** Portanza aerodinamica naturale della forma superiore prima di fondo e appendici */
  baseUpperLiftCl: number;
  /** Distribuzione naturale anteriore della portanza superiore */
  baseFrontLiftShare: number;
  /** Fattore di pulizia flusso sulla scia per ala posteriore e canali Venturi */
  flowCleanlinessFactor: number;
  /** Tetto fisico massimo di CL totale raggiungibile dalla carrozzeria */
  maxPhysicalClCap: number;
  description: string;
}

export const BODY_STYLES: BodyStyleOption[] = [
  {
    id: 'Berlina',
    label: 'Berlina (Sedan 3 Volumi)',
    frontalShapeFactor: 0.885,
    panelSurfaceFactor: 1.0,
    baseCx: 0.272,
    baseUpperLiftCl: 0.04,
    baseFrontLiftShare: 0.45,
    flowCleanlinessFactor: 0.86,
    maxPhysicalClCap: 1.55,
    description: 'Coda rastremata a 3 volumi con flusso laminare lungo il padiglione e bassa scia posteriore.',
  },
  {
    id: 'Coupé',
    label: 'Coupé (Fastback 2+2)',
    frontalShapeFactor: 0.892,
    panelSurfaceFactor: 0.94,
    baseCx: 0.286,
    baseUpperLiftCl: 0.05,
    baseFrontLiftShare: 0.46,
    flowCleanlinessFactor: 0.94,
    maxPhysicalClCap: 1.85,
    description: 'Linea spiovente fastback con superficie frontale contenuta e buon compromesso tra estetica e Cx.',
  },
  {
    id: 'Hatchback',
    label: 'Hatchback (2 Volumi Compatta)',
    frontalShapeFactor: 0.875,
    panelSurfaceFactor: 0.88,
    baseCx: 0.312,
    baseUpperLiftCl: 0.07,
    baseFrontLiftShare: 0.48,
    flowCleanlinessFactor: 0.78,
    maxPhysicalClCap: 1.25,
    description: 'Portellone verticale posteriore: pratica e compatta ma soggetta a vortici di scia tronca.',
  },
  {
    id: 'Universale',
    label: 'Universale (Station Wagon)',
    frontalShapeFactor: 0.896,
    panelSurfaceFactor: 1.08,
    baseCx: 0.295,
    baseUpperLiftCl: 0.06,
    baseFrontLiftShare: 0.46,
    flowCleanlinessFactor: 0.78,
    maxPhysicalClCap: 1.25,
    description: 'Tetto prolungato fino in coda con ottima stabilità direzionale e superficie pannelli estesa.',
  },
  {
    id: 'Crossover',
    label: 'Crossover (CUV Profilato)',
    frontalShapeFactor: 0.878,
    panelSurfaceFactor: 1.05,
    baseCx: 0.302,
    baseUpperLiftCl: 0.08,
    baseFrontLiftShare: 0.50,
    flowCleanlinessFactor: 0.65,
    maxPhysicalClCap: 0.85,
    description: 'Assetto rialzato con raccordi smussati tra cofano, parabrezza e tetto per contenere il drag.',
  },
  {
    id: 'SUV',
    label: 'SUV (Fuoristrada / Utility)',
    frontalShapeFactor: 0.892,
    panelSurfaceFactor: 1.22,
    baseCx: 0.388,
    baseUpperLiftCl: 0.10,
    baseFrontLiftShare: 0.52,
    flowCleanlinessFactor: 0.48,
    maxPhysicalClCap: 0.60,
    description: 'Frontale verticale e sezione trasversale imponente con elevata resistenza aerodinamica.',
  },
  {
    id: 'Coupé Sportivo',
    label: 'Coupé Sportivo / Supercar',
    frontalShapeFactor: 0.895,
    panelSurfaceFactor: 0.91,
    baseCx: 0.296,
    baseUpperLiftCl: -0.02,
    baseFrontLiftShare: 0.42,
    flowCleanlinessFactor: 1.0,
    maxPhysicalClCap: 2.75,
    description: 'Padiglione ribassato, passaruota svasati e canali per flussi ad alta velocità.',
  },
  {
    id: 'Pickup',
    label: 'Pickup (Cabina + Cassone)',
    frontalShapeFactor: 0.885,
    panelSurfaceFactor: 1.16,
    baseCx: 0.410,
    baseUpperLiftCl: 0.11,
    baseFrontLiftShare: 0.55,
    flowCleanlinessFactor: 0.40,
    maxPhysicalClCap: 0.45,
    description: 'Cassone aperto posteriore con forte turbolenza dietro la cabina e sezione frontale elevata.',
  },
];

export interface BodyMaterialOption {
  id: BodyMaterialId;
  name: string;
  minYear: number;
  /** Densità relativa della massa pannelli esterni (1.0 = acciaio dolce stampato) */
  weightMultiplier: number;
  unitCost: number;
  devCapitalCost: number;
  devRdPoints: number;
  /** Fattore di resistenza a corrosione, fatica e micro-urti (usato per durabilità km) */
  corrosionResistanceFactor: number;
  priceTier: PriceTier;
  description: string;
}

export const BODY_MATERIALS: BodyMaterialOption[] = [
  {
    id: 'mat-steel',
    name: 'Acciaio Dolce Stampato',
    minYear: 1950,
    weightMultiplier: 1.0,
    unitCost: 850,
    devCapitalCost: 4_000_000,
    devRdPoints: 5,
    corrosionResistanceFactor: 0.82,
    priceTier: 'Economica',
    description: 'Lamiera tradizionale economica e riparabile, ma pesante e più esposta a ossidazione senza trattamenti.',
  },
  {
    id: 'mat-galvanized-hss',
    name: 'Acciaio Zincato Altoresistenziale (HSS)',
    minYear: 1986,
    weightMultiplier: 0.90,
    unitCost: 1_350,
    devCapitalCost: 8_500_000,
    devRdPoints: 15,
    corrosionResistanceFactor: 1.35,
    priceTier: 'Media',
    description: 'Spessori ridotti tramite acciai microlegati e zincatura a caldo anti-corrosione.',
  },
  {
    id: 'mat-grp-smc',
    name: 'Composito Vetroresina / SMC Termoindurente',
    minYear: 1965,
    weightMultiplier: 0.66,
    unitCost: 2_200,
    devCapitalCost: 9_500_000,
    devRdPoints: 25,
    corrosionResistanceFactor: 1.55,
    priceTier: 'Media',
    description: 'Pannelli immuni alla ruggine e leggeri, ideali per medie serie sportive o fuoristrada.',
  },
  {
    id: 'mat-aluminum',
    name: 'Lega di Alluminio Stampato',
    minYear: 1994,
    weightMultiplier: 0.55,
    unitCost: 3_800,
    devCapitalCost: 18_000_000,
    devRdPoints: 45,
    corrosionResistanceFactor: 1.48,
    priceTier: 'Premium',
    description: 'Abbatte la massa delle parti mobili (-45%) migliorando agilità e protezione alla corrosione.',
  },
  {
    id: 'mat-alu-composite',
    name: 'Ibrido Alluminio + Composito / Carbonio su Cofano e Tetto',
    minYear: 2008,
    weightMultiplier: 0.46,
    unitCost: 7_800,
    devCapitalCost: 28_000_000,
    devRdPoints: 85,
    corrosionResistanceFactor: 1.58,
    priceTier: 'Premium',
    description: 'Abbassa il baricentro con tetto/cofano in composito e porte in alluminio.',
  },
  {
    id: 'mat-carbon-prepreg',
    name: 'Fibra di Carbonio Autoclave (Pre-Preg CFRP)',
    minYear: 2004,
    weightMultiplier: 0.31,
    unitCost: 36_000,
    devCapitalCost: 45_000_000,
    devRdPoints: 180,
    corrosionResistanceFactor: 1.72,
    priceTier: 'Lusso',
    description: 'Massima leggerezza strutturale per hypercar, con finitura a vista o verniciatura ultra-sottile.',
  },
];

export interface AirbagPackageOption {
  id: AirbagPackageId;
  name: string;
  minYear: number;
  weightKg: number;
  unitCost: number;
  devCapitalCost: number;
  devRdPoints: number;
  crashBonusPoints: number;
  description: string;
}

export const AIRBAG_PACKAGES: AirbagPackageOption[] = [
  {
    id: 'airbag-none',
    name: 'Nessun Airbag (Solo Cinture)',
    minYear: 1950,
    weightKg: 0,
    unitCost: 0,
    devCapitalCost: 0,
    devRdPoints: 0,
    crashBonusPoints: 0,
    description: 'Configurazione storica o da competizione priva di moduli pirotecnici.',
  },
  {
    id: 'airbag-driver',
    name: 'Single Airbag Guidatore',
    minYear: 1981,
    weightKg: 3,
    unitCost: 160,
    devCapitalCost: 1_500_000,
    devRdPoints: 10,
    crashBonusPoints: 7,
    description: 'Modulo frontale integrato nel volante per la protezione primaria del conducente.',
  },
  {
    id: 'airbag-dual-front',
    name: 'Doppio Airbag Frontale + Pretensionatori',
    minYear: 1990,
    weightKg: 6,
    unitCost: 390,
    devCapitalCost: 3_000_000,
    devRdPoints: 20,
    crashBonusPoints: 13,
    description: 'Protezione frontale simmetrica per guidatore e passeggero con pretensionatori cinture.',
  },
  {
    id: 'airbag-six-curtain',
    name: '6 Airbag (Frontali + Laterali + Tendina)',
    minYear: 1998,
    weightKg: 13,
    unitCost: 1_150,
    devCapitalCost: 6_500_000,
    devRdPoints: 45,
    crashBonusPoints: 20,
    description: 'Copertura completa contro impatti frontali e laterali su entrambe le file di sedili.',
  },
  {
    id: 'airbag-ten-precrash',
    name: '10 Airbag + Ginocchia + Radar/Pre-Crash Attivo',
    minYear: 2014,
    weightKg: 21,
    unitCost: 2_450,
    devCapitalCost: 12_000_000,
    devRdPoints: 95,
    crashBonusPoints: 25,
    description: 'Sistema completo con airbag centrale anti-collisione, ginocchia, radar e pretensionatori Pre-Crash.',
  },
];

export interface FrontAeroOption {
  id: FrontAeroType;
  name: string;
  minYear: number;
  weightKg: number;
  unitCost: number;
  devCapitalCost: number;
  devRdPoints: number;
  clBase: number;
  clPerDeg: number;
  cxBase: number;
  cxPerDeg: number;
  description: string;
}

export const FRONT_AERO_OPTIONS: FrontAeroOption[] = [
  {
    id: 'none',
    name: 'Paraurti Standard (Nessuno Splitter)',
    minYear: 1950,
    weightKg: 0,
    unitCost: 0,
    devCapitalCost: 0,
    devRdPoints: 0,
    clBase: 0,
    clPerDeg: 0,
    cxBase: 0,
    cxPerDeg: 0,
    description: 'Profilo stradale pulito senza appendici inferiori sporgenti.',
  },
  {
    id: 'road-lip',
    name: 'Labbro Inferiore Integrato (Road Lip)',
    minYear: 1978,
    weightKg: 3,
    unitCost: 280,
    devCapitalCost: 1_200_000,
    devRdPoints: 8,
    clBase: 0.025,
    clPerDeg: 0.003,
    cxBase: 0.003,
    cxPerDeg: 0.0005,
    description: 'Riduce il flusso d’aria sotto il muso limitando la portanza anteriore alle alte velocità.',
  },
  {
    id: 'track-splitter',
    name: 'Splitter Anteriore Regolabile',
    minYear: 1995,
    weightKg: 7,
    unitCost: 1_150,
    devCapitalCost: 3_200_000,
    devRdPoints: 25,
    clBase: 0.075,
    clPerDeg: 0.008,
    cxBase: 0.008,
    cxPerDeg: 0.0012,
    description: 'Lama orizzontale sporgente con tiranti per carico aerodinamico marcato sull’avantreno.',
  },
  {
    id: 'splitter-canards',
    name: 'Splitter + Canards & Louvers Passaruota',
    minYear: 2008,
    weightKg: 10,
    unitCost: 2_100,
    devCapitalCost: 5_500_000,
    devRdPoints: 45,
    clBase: 0.135,
    clPerDeg: 0.011,
    cxBase: 0.014,
    cxPerDeg: 0.0018,
    description: 'Pacchetto pista ad alto carico con sfoghi pressione passaruota e generatori di vortici.',
  },
];

export interface RearAeroOption {
  id: RearAeroType;
  name: string;
  minYear: number;
  weightKg: number;
  unitCost: number;
  devCapitalCost: number;
  devRdPoints: number;
  clBase: number;
  clPerDeg: number;
  cxBase: number;
  cxPerDeg: number;
  stallAngleDeg: number;
  description: string;
}

export const REAR_AERO_OPTIONS: RearAeroOption[] = [
  {
    id: 'none',
    name: 'Coda Pulita (Nessuno Spoiler)',
    minYear: 1950,
    weightKg: 0,
    unitCost: 0,
    devCapitalCost: 0,
    devRdPoints: 0,
    clBase: 0,
    clPerDeg: 0,
    cxBase: 0,
    cxPerDeg: 0,
    stallAngleDeg: 25,
    description: 'Linea filante senza appendici posteriori per la massima pulizia visiva e minimo drag parassita.',
  },
  {
    id: 'ducktail-lip',
    name: 'Spoiler Integrato / Ducktail',
    minYear: 1973,
    weightKg: 3,
    unitCost: 350,
    devCapitalCost: 1_400_000,
    devRdPoints: 8,
    clBase: 0.035,
    clPerDeg: 0.004,
    cxBase: 0.004,
    cxPerDeg: 0.0007,
    stallAngleDeg: 22,
    description: 'Profilo rialzato sul bordo bagagliaio: stabilizza il retrotreno con resistenza contenuta.',
  },
  {
    id: 'gt-wing',
    name: 'Ala Posteriore Fissa (GT Wing)',
    minYear: 1987,
    weightKg: 11,
    unitCost: 2_800,
    devCapitalCost: 4_800_000,
    devRdPoints: 40,
    clBase: 0.12,
    clPerDeg: 0.014,
    cxBase: 0.024,
    cxPerDeg: 0.0032,
    stallAngleDeg: 20,
    description: 'Profilo alare rialzato con paratie laterali ad alto carico per uso sportivo e circuito.',
  },
  {
    id: 'swan-neck-wing',
    name: 'Ala Collo di Cigno (Swan-Neck)',
    minYear: 2016,
    weightKg: 13,
    unitCost: 5_400,
    devCapitalCost: 8_500_000,
    devRdPoints: 80,
    clBase: 0.18,
    clPerDeg: 0.016,
    cxBase: 0.022,
    cxPerDeg: 0.0028,
    stallAngleDeg: 20,
    description: 'Attacchi superiori che lasciano pulito il lato in depressione massimizzando efficienza L/D.',
  },
];

export interface UnderbodyAeroOption {
  id: UnderbodyAeroType;
  name: string;
  minYear: number;
  weightKg: number;
  unitCost: number;
  devCapitalCost: number;
  devRdPoints: number;
  /** Contributo di base alla portanza (- negativo = lift, + positivo = downforce a efficienza suolo 1.0) */
  clPotential: number;
  /** Fattore di sensibilità all'altezza da terra (0 = nessuna sensibilità, 1 = totale) */
  groundEffectSensitivity: number;
  /** Ripartizione anteriore della downforce generata dal fondo */
  frontShare: number;
  cxDelta: number;
  description: string;
}

export const UNDERBODY_AERO_OPTIONS: UnderbodyAeroOption[] = [
  {
    id: 'exposed',
    name: 'Fondo Esposto (Meccanica a Vista)',
    minYear: 1950,
    weightKg: 0,
    unitCost: 0,
    devCapitalCost: 0,
    devRdPoints: 0,
    clPotential: -0.02,
    groundEffectSensitivity: 0,
    frontShare: 0.45,
    cxDelta: 0.018,
    description: 'Sottoscocca non carenato con forti turbolenze su scarico e bracci sospensione.',
  },
  {
    id: 'road-faired',
    name: 'Fondo Stradale Carenato (Pannelli Fonoassorbenti)',
    minYear: 1995,
    weightKg: 9,
    unitCost: 450,
    devCapitalCost: 2_200_000,
    devRdPoints: 12,
    clPotential: 0.04,
    groundEffectSensitivity: 0.35,
    frontShare: 0.45,
    cxDelta: -0.018,
    description: 'Pannellatura chiusa sotto motore e abitacolo che riduce il Cx stradale.',
  },
  {
    id: 'flat-floor-diffuser',
    name: 'Fondo Piatto + Estrattore Posteriore',
    minYear: 2002,
    weightKg: 16,
    unitCost: 2_600,
    devCapitalCost: 7_500_000,
    devRdPoints: 55,
    clPotential: 0.30,
    groundEffectSensitivity: 0.78,
    frontShare: 0.43,
    cxDelta: -0.006,
    description: 'Accelera il flusso sotto la scocca ed espande l’aria in coda generando carico senza ali invasive.',
  },
  {
    id: 'venturi-ground-effect',
    name: 'Canali Venturi Integrali (Effetto Suolo Estremo)',
    minYear: 2018,
    weightKg: 26,
    unitCost: 12_500,
    devCapitalCost: 22_000_000,
    devRdPoints: 160,
    clPotential: 1.38,
    groundEffectSensitivity: 0.96,
    frontShare: 0.46,
    cxDelta: 0.012,
    description: 'Tunnel Venturi a tutta lunghezza stile hypercar/LMP: downforce enorme ma richiede luce a terra minima.',
  },
];

export interface ActiveAeroOption {
  id: ActiveAeroType;
  name: string;
  minYear: number;
  weightKg: number;
  unitCost: number;
  devCapitalCost: number;
  devRdPoints: number;
  /** CL aggiuntivo in modalità High-Downforce */
  clHighBonus: number;
  /** Distribuzione anteriore del bonus High-Downforce */
  frontShare: number;
  /** Riduzione Cx percentuale sul pacchetto aero in modalità Low-Drag / DRS */
  lowDragCxReduction: number;
  /** Frazione di riduzione del CL del pacchetto attivo/posteriore in Low-Drag */
  lowDragClReductionShare: number;
  /** Incremento netto di Cx in frenata Airbrake */
  airbrakeCxBoost: number;
  description: string;
}

export const ACTIVE_AERO_OPTIONS: ActiveAeroOption[] = [
  {
    id: 'none',
    name: 'Aerodinamica Fissa / Passiva',
    minYear: 1950,
    weightKg: 0,
    unitCost: 0,
    devCapitalCost: 0,
    devRdPoints: 0,
    clHighBonus: 0,
    frontShare: 0.3,
    lowDragCxReduction: 0,
    lowDragClReductionShare: 0,
    airbrakeCxBoost: 0,
    description: 'Assetto aerodinamico fisso privo di attuatori mobili.',
  },
  {
    id: 'retractable-spoiler',
    name: 'Attiva — Spoiler Retrattile',
    minYear: 1989,
    weightKg: 9,
    unitCost: 1_900,
    devCapitalCost: 4_500_000,
    devRdPoints: 55,
    clHighBonus: 0.05,
    frontShare: 0.25,
    lowDragCxReduction: 0.025,
    lowDragClReductionShare: 0.35,
    airbrakeCxBoost: 0.04,
    description: 'Attuatore elettrico retrattile che fuoriesce ad alta velocità riducendo drag e portanza.',
  },
  {
    id: 'drs-active-wing',
    name: 'Attiva — DRS & Flap Mobili',
    minYear: 2013,
    weightKg: 16,
    unitCost: 5_800,
    devCapitalCost: 9_500_000,
    devRdPoints: 125,
    clHighBonus: 0.11,
    frontShare: 0.38,
    lowDragCxReduction: 0.072,
    lowDragClReductionShare: 0.58,
    airbrakeCxBoost: 0.11,
    description: 'Apre ala e flap anteriori in rettilineo per abbattere il Cx recuperando velocità di punta.',
  },
  {
    id: 'full-active-airbrake',
    name: 'Attiva — Full Active + Airbrake Idraulico',
    minYear: 2015,
    weightKg: 24,
    unitCost: 11_500,
    devCapitalCost: 16_000_000,
    devRdPoints: 210,
    clHighBonus: 0.085,
    frontShare: 0.34,
    lowDragCxReduction: 0.032,
    lowDragClReductionShare: 0.45,
    airbrakeCxBoost: 0.22,
    description: 'Attuazione idraulica continua di ala e flap con apertura verticale istantanea in frenata.',
  },
];
