# ROADMAP DI SVILUPPO — Simulatore Gestionale & Ingegneristico Automotive

> **Target Platform:** macOS 27.2 (ARM64 — Apple Silicon M1)  
> **Tech Stack:** React, TypeScript, Tailwind CSS, Canvas 2D / Three.js (Web/Desktop)  
> **Stato Progetto:** In Sviluppo (usa le checkbox `[ ]` / `[x]` per tracciare l'avanzamento)

---

## Architettura Target del Repository (`src/`)

```text
src/
├── types/
│   └── gameTypes.ts           # Entità indipendenti (Motore, Pianale, Sotto-Brand, Componenti, Veicolo), Tassonomia, Valute
├── math/
│   ├── engineMath.ts          # Cilindrata, S/B, ingombro LWH (mm), curve coppia/potenza, emissioni, affidabilità motore
│   ├── chassisMath.ts         # Telemetria completa veicolo (accelerazione, frenata, staccate, G laterali, aero, consumi)
│   ├── volumeMath.ts          # Calcolo volumetrico sottrattivo abitacolo/bagagliaio e collision check vano motore (mm)
│   └── economyMath.ts         # Prezzi (1.8x-4.0x), garanzia, curva qualità operai, R&D passivo, dazi, multe CO2/PM
├── data/
│   ├── historicalEras.ts      # Standard segmenti per anno, 4 ere catalizzatori, complessità storica auto/dipendenti
│   ├── techTreeData.ts        # Nodi R&D dal 1970 al futuro (Sci-Fi), spell passive componenti, fornitori terzi
│   └── nationsAndBrands.ts    # Nazioni (IT, DE, JP, US, CN), sussidi, Tech Giants, archetipi aziendali
├── store/
│   └── useGameStore.ts        # Stato globale: Doppia Valuta ($ + R&D), Calendario, Holding, Fabbriche, Deposito Prototipi
└── components/
    ├── engine-lab/            # Fase 1: Configuratore 1A (Pistoni), 1B (Wankel), 1C (EV/Hybrid) + Vista Laterale Pianali
    ├── chassis-lab/           # Fase 2: Pianale, Scocca, Rapporti cambio, AWD, Assetto, Allestimenti/Generazioni, Piste
    ├── tech-tree/             # Fase 3: Albero R&D, Componenti In-House vs Terzisti, Livellamento Spell, Test Muletto
    ├── corporate/             # Fase 4: Holding/Sotto-Brand, HR/Boss, Fabbriche, Automazione, Prima Ondata, B2B, Calendario
    ├── market-finance/        # Fase 5: Prezzi Slider, Garanzia (Anni/Km), Logistica/Dazi, Borsa (IPO), Cinema
    └── motorsport/            # Fase 6: Gestione "Toto Wolff", F1 Zone Grigie, Tech Transfer, Spionaggio e Sabotaggio
```

---

## FASE 0: Setup Infrastruttura, Core Types e Doppia Valuta
**Obiettivo:** Inizializzare l'ambiente macOS ARM64 e modellare il database relazionale modulare in TypeScript.

### 0.1 Scaffolding & Stack Tecnico
- [x] Inizializzare il progetto React + TypeScript + Tailwind CSS ottimizzato per macOS 27.2 (ARM64 Apple Silicon M1).
- [x] Configurare i moduli di rendering per grafici telemetrici (**Canvas 2D**) e visualizzazione volumi/ingombri (**Three.js**).

### 0.2 Architettura Dati Modulare (`src/types/gameTypes.ts`)
- [x] Definire la **Tassonomia Universale Componenti**:
  - `PriceTier`: `'Economica' | 'Media' | 'Premium' | 'Lusso'`
  - `ReferenceClass`: `'Normale' | 'Comfort' | 'Sport' | 'Corsa' | 'Fuoristrada'`
  - `estimatedDurabilityKm`: campo calcolato automaticamente da materiali e stress meccanico.
- [x] Definire le 5 entità indipendenti del database (collegate tramite ID per condivisione di gruppo, riutilizzo multi-generazionale, licenze B2B e allestimenti multipli):
  - [x] `Engine` (Motore)
  - [x] `Chassis` (Pianale)
  - [x] `SubBrand` (Sotto-Brand)
  - [x] `Component` (Componente singolo / custom / terzista)
  - [x] `Vehicle` (Veicolo finito / Allestimento / Generazione / Prototipo)
- [x] Implementare il sistema a **Doppia Valuta di Sviluppo** nello stato globale:
  - [x] `financialCapital` (Capitale Finanziario)
  - [x] `rdPoints` (Punti R&D dedicati)
  - [x] Gate di validazione: ogni sblocco o progettazione deve verificare e scalare entrambe le risorse separatamente.

---

## FASE 1: Banco Prova Motori e R&D Propulsori
**Obiettivo:** Costruire il progettatore di propulsori (Endotermici, Wankel, Elettrici/Ibridi) con verifica fisica in tempo reale sui pianali e banco prova telemetrico.

### 1.1 Modulo 1A — Endotermici a Pistoni (`src/math/engineMath.ts`)
- [x] **Geometria e Architettura**:
  - [x] Selettore architettura: `In linea`, `V` (con configurazione angolo bancate), `Boxer`, `W`.
  - [x] Input numero cilindri, alesaggio ($\text{mm}$) e corsa ($\text{mm}$).
  - [x] Calcolo automatico di: cilindrata unitaria, cilindrata totale, rapporto corsa/alesaggio e **ingombro fisico 3D in millimetri (LWH)**.
- [x] **Componentistica Base Motore**:
  - [x] Sistema di sblocco e selezione per: materiale del motore, materiale della testa del cilindro, pistoni, bielle, albero a gomiti, albero a camme e numero di valvole.
- [x] **Alimentazione e Sovralimentazione**:
  - [x] Selezione tipo di carburante, sistema di alimentazione, sistema di aspirazione e collettore di scarico.
  - [x] Configuratore turbocompressione: Single-Scroll, Twin-Scroll, Geometria Variabile (VGT), cuscinetti su bronzine o a sfera, diametro girante A/R, compressore volumetrico, Twincharged, E-Turbo.
  - [x] Selettore posizionamento turbine: `Laterali`, `Frontali`, `Hot-V` (con ricalcolo immediato dell'ingombro LWH).
- [x] **Evoluzione Storica e Catalizzatori (4 Ere)**:
  - [x] Progressione storica dei sistemi di alimentazione (es. Diesel da precamera fino al Common Rail).
  - [x] Implementazione dei 4 stadi di catalizzatori spalmati nei decenni per rientrare nelle soglie di legge crescenti:
    - [x] Stadio 1 (Anni '70): Catalizzatore Ossidante.
    - [x] Stadio 2 (Anni '80–'90): Catalizzatore a Tre vie Lambda.
    - [x] Stadio 3 (Anni 2000): Sistema Multi-stadio DPF/SCR.
    - [x] Stadio 4 (Euro 7): Sistema attivo + filtro particolato globale.

### 1.2 Verifica Ingombro Vano Motore in Tempo Reale (`src/math/volumeMath.ts`)
- [x] Creare la **Vista Laterale Real-Time** all'interno del progettatore motore che elenca tutti i Pianali aziendali.
- [x] Implementare l'algoritmo di collisione geometrica: confrontare dimensioni LWH del motore + posizione turbine + orientamento con il vano motore di ciascun pianale.
- [x] Colorare la piattaforma in **ROSSO** in caso di conflitto d'orientamento o superamento limiti, mostrando il delta esatto di incompatibilità fisica in millimetri ($\text{mm}$).

### 1.3 Modulo 1B — Motori Rotativi (Wankel) (`src/components/engine-lab/WankelEngineDesigner1B.tsx`, `src/math/wankelMath.ts`)
- [x] Costruire il modulo dedicato Wankel con parametri geometrici e meccanici:
  - [x] Numero di rotori (1, 2, 3, 4 rotori), raggio generazione $R$, eccentricità $e$, larghezza camera $B$, e calcolo cilindrata geometrica unitaria $V_k = 3\sqrt{3} \cdot e \cdot R \cdot B$ ed equivalente ($2\times$ per ciclo 4T).
  - [x] Tipologie di porting luci: `Side Ports`, `Street Port`, `Bridgeport` (con regime minimo zoppicante caratteristico "brap-brap"), `Semi-Peripheral Port`, `Peripheral Port` (respirazione ad altissimi regimi fino a 13.000 RPM).
  - [x] Materiali rotore, statore/trocoide e sigilli Apex Seal (Ghisa sferoidale, Carbonio-Alluminio, Ceramica Silicio Si3N4) con tasso di usura oraria ($\mu\text{m/1000h}$) e sensibilità estrema alla detonazione.
  - [x] Sistema di iniezione olio OMP (Oil Metering Pump) meccanica o elettronica, consumo olio ($\text{L}/1000\text{ km}$) e miscelazione carburante premix.
- [x] Integrare il calcolo di ingombro 3D procedurale, erogazione (coppia con formula percorsa $T = \frac{\text{BMEP} \cdot V_{\text{geom}} \cdot 100}{2\pi}$), emissioni HC e usura apex seal nella telemetria del banco prova e verifica collisione col vano motore dei pianali.

### 1.4 Modulo 1C — Elettrici e Ibridi
- [ ] Configuratore per: tipo di elettromotore, batteria elettromotore e raffreddamento elettromotore.
- [ ] Logica di integrazione nei powertrain: **MHEV**, **Full Hybrid**, **PHEV** e **Range Extender**.

### 1.5 Telemetria Banco Prova
- [x] Calcolo istantaneo e grafico Canvas per:
  - [x] Curve di coppia ($\text{Nm}$) e potenza ($\text{CV/kW}$).
  - [x] Peso a secco e peso coi fluidi ($\text{kg}$).
  - [x] Efficienza energetica ed emissioni ($\text{g/km}$).
  - [x] Affidabilità espressa sia in percentuale ($\%$) sia in $\text{km}$ di vita stimata.
  - [x] Costo unitario di produzione del propulsore.

---

## FASE 2: Pianali, Dinamica Veicolo, Rapportatura, Allestimenti e Generazioni
**Obiettivo:** Sviluppare l'ingegneria telaistica, la trasmissione personalizzabile, il motore fisico-telemetrico completo (`chassisMath.ts`) e la gestione delle stirpi di modelli.

### 2.1 Creazione Pianale e Layout Motore
- [ ] Configuratore Pianale riutilizzabile ed evolubile (stile Piattaforma Giorgio):
  - [ ] Dimensioni esterne, passo, carreggiata, altezza da terra.
  - [ ] Rigidità torsionale ($\text{Nm/grado}$) e struttura di sicurezza.
  - [ ] Posizione motore (`Anteriore`, `Anteriore-Centrale`, `Centrale-Posteriore`, `Posteriore`), orientamento (`Trasversale` o `Longitudinale`) e grado di arretramento verso l'abitacolo.
  - [ ] Predisposizione trazione.
- [ ] Algoritmo di calcolo automatico del **Segmento dell'auto** confrontando le dimensioni del pianale con gli standard dell'anno corrente (con soglie dimensionali che crescono a scaglioni ogni $X$ anni).

### 2.2 Scocca e Sicurezza
- [ ] **Configuratore Aerodinamico (Downforce vs Drag)**: selezione e regolazione incidenza (gradi) di Splitter/Canard anteriori, Ala posteriore, Fondo piatto/Diffusore ad effetto suolo (sensibile all'altezza da terra) e Aerodinamica Attiva (DRS/Flap mobili che riducono il Cx in rettilineo e massimizzano il carico in curva e staccata).
- [ ] Selettore delle 8 carrozzerie: `Berlina`, `Coupé`, `Hatchback`, `SUV`, `Crossover`, `Universale`, `Coupé Sportivo`, `Pickup`.
- [ ] Configurazione materiale della carrozzeria, sicurezza passiva e airbag.

### 2.3 Trasmissione, Regolazione Rapporti e 4 Schemi AWD
- [ ] Selezione di: guida, cambio, numero di marce, sospensione, differenziale, sistema di stabilizzazione (con **soglia di intervento regolabile**) e pinza freno anteriore e posteriore.
- [ ] **Slider Rapportatura Veicolo**: permettere la modifica e il riadattamento dei singoli rapporti del cambio e del rapporto finale sul singolo veicolo anche senza progettare un cambio da zero.
- [ ] Calcolo matematico della **Perdita di Trasmissione (Drivetrain Loss %)** tra potenza all'albero e potenza effettiva alle ruote.
- [ ] Implementazione dei **4 Schemi di Trazione Integrale**:
  - [ ] 1. `AWD Anteriore On-Demand (Haldex)`
  - [ ] 2. `AWD Trasversale Performance` ("Finta Posteriore" stile RS3/A45S con Torque Splitter)
  - [ ] 3. `AWD Longitudinale Permanente`
  - [ ] 4. `4WD Heavy-Duty con ridotte`

### 2.4 Assetto Avanzato, Polveri Sottili e Penalità Fisiche
- [ ] Sblocco e montaggio di: barre antirollio, gabbie roll-cage (in vari materiali) e sospensioni idrauliche, ad aria o attive.
- [ ] Calcolo emissione **polveri sottili** generate da attrito di freni e gomme (stile Euro 7).
- [ ] **Sistema Penalità Fisiche**:
  - [ ] Trigger **Wheelspin (perdita di trazione)** quando potenza/coppia alle ruote supera il limite di grip degli pneumatici/trazione.
  - [ ] Trigger **Fading** per freni sottodimensionati quando massa del veicolo e velocità generano un carico termico superiore alla capacità di dissipazione dell'impianto frenante.

### 2.5 Abitacolo, Spazi e Alleggerimento
- [ ] Selettore di: interno, materiale interno, funzioni interne, multimedia e acustica.
- [ ] Opzione dedicata per **interni spogli/alleggeriti** destinata alle auto da corsa.
- [ ] **Calcolo Volumetrico Sottrattivo**: determinare in automatico numero posti, abitabilità e litri di bagagliaio sottraendo al volume interno della scocca gli ingombri fisici di motore, trasmissione, sospensioni e serbatoio/batteria.

### 2.6 Allestimenti, Generazioni ("Seguiti") e Piste di Prova
- [ ] Sistema di creazione rapida **Allestimenti** (`Base`, `Premium`, `Sport`, `Pista`) condividendo lo stesso pianale.
- [ ] Sistema genealogico delle **Generazioni storiche** (es. Golf I $\to$ II $\to$ III, M3 E30 $\to$ E36 $\to$ E46, F40 $\to$ F50 $\to$ Enzo $\to$ LaFerrari $\to$ F80) che trasferisce reputazione e aspettative della stirpe al nuovo modello.
- [ ] Modulo **Galleria del Vento e Piste di Prova**: opzione tra affitto di circuiti terzi o costruzione di piste proprietarie specializzate (che azzerano i costi di test e aumentano la precisione di misurazione dei parametri dinamici).

### 2.7 Motore Telemetrico Completo (`src/math/chassisMath.ts`)
- [ ] **Accelerazione, Intertempi e Ripresa**:
  - [ ] Calcolo diretto degli intertempi: $0\text{--}100$, $100\text{--}200$, $200\text{--}300$, $300\text{--}400\text{ km/h}$ (e fasce superiori se la velocità massima lo consente).
  - [ ] Ricavo matematico dei tempi cumulativi ($0\text{--}200$, $0\text{--}300$, $0\text{--}400+\text{ km/h}$) tramite somma esatta dei rispettivi intertempi.
  - [ ] Calcolo di: $1/4$ di miglio ($400\text{ m}$), $1.000\text{ m}$ da fermo, ripresa $80\text{--}120\text{ km/h}$ in marcia alta e Velocità Massima.
- [ ] **Frenata d'Arresto e Staccate da Ingresso Curva**:
  - [ ] Calcolo spazi (in metri) e tempi di arresto completo: $100\text{--}0$, $200\text{--}0$, $300\text{--}0$ e $400\text{--}0+\text{ km/h}$ (sbloccati dinamicamente in base alla velocità massima effettiva del mezzo).
  - [ ] Calcolo ciclo combinato: $0\text{--}100\text{--}0$, $0\text{--}200\text{--}0$, $0\text{--}300\text{--}0$ e $0\text{--}400\text{--}0\text{ km/h}$.
  - [ ] Simulazione delle **staccate parziali da pista** (ingresso curva senza fermarsi): $200\text{--}100\text{ km/h}$ (curva veloce/media) e $300\text{--}80\text{ km/h}$ (staccata violenta da rettilineo a chicane/tornante), modellate su deportanza aerodinamica ad alta velocità, trasferimento di carico e resistenza al fading delle pinze freno.
- [ ] **Dinamica Laterale e Telaio**:
  - [ ] Calcolo G laterali massimi in curva, bilanciamento Sottosterzo/Sovrasterzo, angolo di rollio e beccheggio, altezza baricentro, peso totale (a secco e coi fluidi), rapporto peso/potenza e distribuzione dei pesi ($\%$ Ant / $\%$ Post).
- [ ] **Aerodinamica e Termica**:
  - [ ] Calcolo Coefficiente $C_x$, Sezione Frontale ($\text{m}^2$), $SC_x$ effettivo, Downforce ($\text{kg}$ a $200$ e $300\text{ km/h}$), bilanciamento aerodinamico ($\%$ Ant/Post) ed efficienza di raffreddamento (bilanciamento Cooling $\%$ vs penetrazione aerodinamica).
- [ ] **Strada, Praticità e Sicurezza**:
  - [ ] Calcolo consumo combinato reale ($\text{L/100km}$ o $\text{kWh/100km}$), autonomia con un pieno/carica ($\text{km}$), emissioni totali ($\text{CO}_2$ + polveri sottili da freni e gomme), indice Comfort/NVH (decibel in abitacolo e assorbimento asperità), punteggio Off-Road (angoli caratteristici e motricità) e valutazione Crash Test.

---

## FASE 3: Albero Tecnologico, Componenti Fai-da-Te e Sci-Fi
**Obiettivo:** Implementare la progressione R&D dal 1970 al futuro, la progettazione in-house di sottosistemi e il collaudo su muletti.

### 3.1 Albero Tecnologico e Componenti Custom
- [ ] Costruire il grafo dell'Albero Tecnologico dove ogni nodo richiede: **Anno storico minimo** (dal 1970 in poi), **Punti R&D** e **Budget in milioni**.
- [ ] Implementare il doppio canale di approvvigionamento (**Progettazione in-house** con la stessa gerarchia dei veicoli vs **Acquisto da fornitori terzi/partner**) per:
  - [ ] Cambi
  - [ ] Differenziali
  - [ ] Pinze freno
  - [ ] Gomme
  - [ ] Carburanti da gara

### 3.2 Livellamento, "Spell" Passive e Veicolo Muletto
- [ ] Sistema di studio/livellamento per ogni componente che assegna **Punti Miglioramento** ad ogni livello raggiunto.
- [ ] Interfaccia per applicare o rimuovere **"spell" passive** sulla componente usando i Punti Miglioramento.
- [ ] Meccanica di **Test su Muletto**: possibilità di montare e collaudare la componente sviluppata su un veicolo muletto esistente.

### 3.3 Tecnologie Futuristiche (Sci-Fi)
- [ ] Estendere i rami dell'Albero R&D oltre il presente includendo tecnologie sperimentali o ipotetiche.

---

## FASE 4: Gruppi Multi-Brand, Personale, Fabbriche, B2B e Lanci Pianificati
**Obiettivo:** Gestire la struttura societaria multi-marca, la forza lavoro, le linee produttive, le forniture B2B e il calendario lanci.

### 4.1 Holding e Sotto-Brand con DNA Proprio
- [ ] Sistema di creazione o acquisizione di **Sotto-Brand** (stile Fiat-Abarth-Lancia, Alfa-Maserati-Ferrari, VW-Audi-Porsche-Lamborghini).
- [ ] Attribuzione di caratteristiche proprie di prestigio e target a ciascun sotto-brand.
- [ ] Abilitare la condivisione libera di tecnologie, pianali e componenti tra tutti i marchi del gruppo.
- [ ] Funzione di cessione/vendita futura di un sotto-brand.

### 4.2 Personale, Esperienza e R&D Passivo
- [ ] **Motore di Generazione R&D**:
  - [ ] Capi Reparto ("Boss") con produzione fissa mensile propria (es. $30\text{--}50\text{ R\&D/mese}$) e sblocco di spell di reparto.
  - [ ] Bonus organico: $+0,3\%$ R&D ogni $1.000$ dipendenti totali.
  - [ ] Ingressi R&D aggiuntivi derivanti dai piazzamenti nelle corse e dalla produzione mensile delle aziende acquisite.
- [ ] **Curva Qualità Assunzioni**:
  - [ ] Scelta del livello di esperienza iniziale in fase di assunzione operai (con costo salariale/d'ingresso superiore per evitare il crollo della qualità).
  - [ ] Algoritmo di recupero mensile della qualità costruttiva variabile da $0,1\%$ a $4\%$ al mese in funzione del rapporto tra operai esperti e neoassunti.

### 4.3 Capacità Produttiva, Prima Ondata e Automazione
- [ ] Configurare il tetto produttivo iniziale a $10.000$ auto (minimo obbligatorio $1.000$ per le auto standard; nessun vincolo minimo per le Serie Limitate).
- [ ] Scalare storicamente il rapporto auto/dipendenti da $10\text{--}20$ fino a $3\text{--}4$ con l'aumentare della complessità storica dei veicoli.
- [ ] Implementare l'**Automazione** di fabbrica per compensare il calo del rapporto auto/dipendenti (aggiungendo costi di manutenzione fissi e **senza** generare il bonus R&D dei dipendenti umani).
- [ ] **Flusso di Produzione e Ciclo Vita**:
  - [ ] Produzione della **Prima Ondata** durante la fase di pre-lancio.
  - [ ] Regolazione della produzione mensile successiva (fino a un massimo di $1/10$ della Prima Ondata) guidata dalla **Barra dell'Appeal**.
  - [ ] Funzione di **Restyling / Facelift** per prolungare la vita commerciale del modello.

### 4.4 Lancio Post-Creazione e Calendario
- [ ] Creare il **Deposito Prototipi**: l'auto ultimata non esce obbligatoriamente subito sul mercato ma può essere parcheggiata e lanciata manualmente in seguito.
- [ ] Integrare lo **Scheduler Calendario**: possibilità di programmare una data precisa sul calendario per il lancio automatico del modello.

### 4.5 Ingegneria Fabbriche, B2B e Tech Giants
- [ ] Fabbriche motori con vincoli fisici di **litraggio minimo e massimo** supportato dalla linea.
- [ ] **Pannello Componenti B2B**:
  - [ ] Toggle `Check On/Off` per abilitare o bloccare la vendita B2B di ciascun componente.
  - [ ] Contatore in tempo reale dei pezzi venduti a terzi.
  - [ ] Switch tra produzione interna e affidamento a terzisti.
- [ ] Sistema di contratti commerciali, **Joint Venture** (es. Common Rail Fiat) e acquisizione di progetti da colossi tech (**Apple Car, Dyson, Samsung, Xiaomi**).

---

## FASE 5: Prezzi, Garanzia (Anni/Km), Finanza, Logistica e Geopolitica
**Obiettivo:** Implementare il modello macroeconomico, il posizionamento prezzi, la gestione post-vendita (garanzie/richiami) e la finanza globale.

### 5.1 Inizio Carriera Configurabile
- [ ] Schermata di avvio carriera con selezione di:
  - [ ] Decennio storico di partenza.
  - [ ] Nazione di origine (`Italia`, `Germania`, `Giappone`, `USA`, `Cina`) con sistema di **sussidi statali temporanei legati al merito**.
  - [ ] Archetipo aziendale.
  - [ ] Livello di **Difficoltà** (`Facile`, `Media`, `Difficile`) che governa severità dei critici, generazione R&D dei rivali ($90\%$ o $100\%$) e intelligenza AI.

### 5.2 Matematica dei Prezzi e Valutazione Archetipi (`src/math/economyMath.ts`)
- [ ] **Controllo Prezzo di Listino**:
  - [ ] Formula range: $\text{Prezzo Base} = 1,8 \times \text{Costo}$; $\text{Prezzo Max} = 4,0 \times \text{Costo}$.
  - [ ] UI con slider a step dello $0,1\%$, effetto calamita sullo `"0"` finale e campo di input manuale.
- [ ] **Allineamento al Prezzo Medio di Mercato**:
  - [ ] Calcolo del "Prezzo Medio" annuo del mercato.
  - [ ] Tetto per gli allestimenti fissato fino a $2 \times \text{Prezzo Medio}$.
  - [ ] Tetti di valutazione estesi per le **Serie Limitate**: Economica $3\times$, Media $5\times$, Premium $8\times$, Lusso senza limiti.
- [ ] **Algoritmo di Voto e Critica**:
  - [ ] Calcolo punteggi basato sulle specifiche richieste dall'archetipo del veicolo (es. dotazioni interne superiori premiate sulle Medie; leggerezza e interni spogli premiati sulle auto da Corsa), modulato dalla Difficoltà scelta.

### 5.3 Garanzia in Anni e Chilometri
- [ ] Confronto tra la durata stimata in $\text{km}$ del veicolo (calcolata automaticamente dai componenti montati) e la **Garanzia ufficiale in Anni e Km** impostata dal giocatore (es. $2\text{ anni} / 60.000\text{ km}$ oppure $7\text{ anni} / 150.000\text{ km}$).
- [ ] Addebito mensile automatico dei costi per guasti in garanzia e gestione economica/reputazionale di eventuali **richiami**.

### 5.4 Logistica Globale, Finanza e Cinema
- [ ] Calcolo **dazi doganali** e **costi di trasporto** per l'esportazione, azzerabili costruendo fabbriche locali nei mercati esteri.
- [ ] Modulo finanziario con **linee di credito bancarie** e **quotazione in Borsa (IPO)**.
- [ ] Sistema di **Product Placement nei film**: a pagamento agli inizi della carriera, remunerato quando il brand diventa iconico.
- [ ] Norme ambientali basate esclusivamente su **multe proporzionali per $\text{CO}_2$ e polveri sottili** (senza alcun divieto assoluto di vendita).

---

## FASE 6: Motorsport Delegato ("Toto Wolff"), F1, Politica e Spionaggio
**Obiettivo:** Costruire la divisione corse/F1 con gestione delegata al muretto, politica regolamentare, trasferimento tecnologico e spionaggio.

### 6.1 Gestione Stile "Toto Wolff"
- [ ] **Compiti del Giocatore**:
  - [ ] Progettazione dell'auto da corsa, dei motori da gara e dei carburanti speciali.
  - [ ] Scelta degli sponsor.
  - [ ] Opzione di fornitura gomme e/o motori all'intero campionato.
- [ ] **Delega Operativa**:
  - [ ] Simulazione della gara e delle strategie interamente delegata al Team Principal ("Toto Wolff"), al muretto e ai piloti assunti.

### 6.2 Affidabilità, Incidenti, Zone Grigie F1 e Tech Transfer
- [ ] Motore di gara probabilistico che combina per ogni evento la **probabilità di rottura meccanica di ciascun componente** con il **rischio di incidente del pilota**.
- [ ] Meccaniche per sfruttare **zone grigie regolamentari** ed esercitare **peso politico** in federazione.
- [ ] Sistema di **Tech Transfer F1 $\to$ Strada**: trasferimento delle tecnologie sviluppate in F1 sulle hypercar stradali (stile AMG One / F80).

### 6.3 Spionaggio e Sabotaggio
- [ ] Generazione automatica di **stime post-gara gratuite** sulle prestazioni avversarie.
- [ ] Opzione a pagamento per sbloccare e visualizzare le **specifiche esatte** delle auto avversarie (prima o dopo la gara).
- [ ] Azioni operative di **sabotaggio industriale** contro i team/costruttori rivali.

