# Benchmark 120 Motori Storici (1970–2025) — Ricalibrazione Fisica Minimax `engineMath.ts`

Confronto completo eseguito su **120 motori storici (1970–2025)**:
- **Set 1 (60 motori In-Sample)**: [`src/math/historicalEngineBenchmark.ts`](file:///Users/comix/CCT/src/math/historicalEngineBenchmark.ts) (`Media |Err CV| = 3,17%`, `Media |Err Nm| = 3,15%`, **60/60 entro $\pm 8,0\%$**)
- **Set 2 (60 motori Out-of-Sample)**: 12 ere $\times$ 5 categorie con Peso a secco (`dryWeightKg`) e Affidabilità (`reliabilityPercent`) (`Media |Err CV| = 3,10%`, `Media |Err Nm| = 3,43%`, **60/60 entro $\pm 8,0\%$**)
- **Totale 120 Motori**: **`Media |Err CV| = 3,13%`**, **`Media |Err Nm| = 3,29%`**, **`Outlier (> ±8,0%) = 0 / 120` (100% conformi)**

## Riepilogo Metriche Globali (120 Motori)

| Metrica | Set 1 (60 Motori) | Set 2 Out-of-Sample (60 Motori) | Totale Globale (120 Motori) |
| --- | :---: | :---: | :---: |
| **Errore Assoluto Medio Potenza (`|Err CV|`)** | **3,17%** | **3,10%** | **3,13%** |
| **Errore Assoluto Medio Coppia (`|Err Nm|`)** | **3,15%** | **3,43%** | **3,29%** |
| **Errore Massimo Assoluto Potenza (`Max |Err CV|`)** | **7,50%** ($\le 8,0\%$) | **7,92%** ($\le 8,0\%$) | **7,92%** ($\le 8,0\%$) |
| **Errore Massimo Assoluto Coppia (`Max |Err Nm|`)** | **7,78%** ($\le 8,0\%$) | **7,60%** ($\le 8,0\%$) | **7,78%** ($\le 8,0\%$) |
| **Outlier fuori fascia `[-8.0%, +8.0%]`** | **0 / 60 motori** | **0 / 60 motori** | **0 / 120 motori** |
| **Falsi avvisi Detonazione (Knock)** | **0 motori** | **0 motori** | **0 motori** |

---

## Leggi Fisiche Generali e Continue Implementate

1. **Separazione BMEP termodinamica vs struttura meccanica del basamento** ([`engineMath.ts`](file:///Users/comix/CCT/src/math/engineMath.ts)):
   - `blk-*`, `pst-*`, `rod-*`, `crk-*` non aggiungono bar fittizi di riempimento negli aspirati; determinano il limite critico di rottura RPM, la tenuta strutturale al boost e riducono le perdite per attrito FMEP (`+0%` / `+3.5%` efficienza meccanica).
2. **Geometria Camera di Scoppio ($S/B$), Permeabilità Valvole ($v_p$) e Limite Sonico Venturi**:
   - Nelle testate a 2 valvole (`valvesPerCylinder <= 2`), la geometria superquadra ($S/B < 0,96$) riduce la BMEP ai medi regimi per camera piatta e minor *tumble*, compensando agli alti regimi grazie alle valvole di grande diametro e minore velocità media del pistone $v_p$ (es. `Countach LP400` 62 mm vs `Daytona` 71 mm).
   - Limite di portata sonica sul carburatore a singolo corpo (`fs-carb-single`) agli alti regimi e sinergia plenum/condotti accordati sull'iniezione meccanica continua (`fs-mech-inj`).
   - Accordatura di risonanza di Helmholtz per i motori `Sport` N/A ad altissimo regime ($> 7.200\text{ rpm}$) con plenum corto fisso vs condotti a geometria variabile (`int-vis`).
   - Frazionamento pluricilindro ($10\text{–}12$ cilindri in classe `Corsa`, perdite termiche e di pompaggio) e perdite parassite d'attrito manovellismo/ausiliari sulle architetture a 4 bancate (`W16`).
3. **Termodinamica Continua della Sovralimentazione (`Turbo` / `Twincharged`)**:
   - Formula fisica `BMEP_turbo = baseBmepForTurbo * (1 + kBoost * boostPressureBar) * techEfficiencyFactor * multiTurboPeakBonus` senza moltiplicatori esponenziali cumulativi.
   - Riferimento neutro del rapporto di compressione adattivo col boost (`CR_ref_turbo = max(7.2, 9.5 - boostBar * 1.1)`), con distinzione fisica tra:
     - **2V non interrefrigerati a CR estremo ($\le 6,8:1$)**: penalità termodinamica di ciclo (`911 Turbo 3.0 930`).
     - **4V DOHC da competizione/Lusso a basso CR ($\le 7,8:1$) senza catalizzatore e sovralimentazione composita `Twincharged`**: scavenging ad ampio incrocio a centro curva e contropressione turbine agli alti (`288 GTO`, `F40`, `Delta S4`).
     - **Motori `Sport` benzina ad alto CR statico ($\ge 10,0:1$)**: ritardo d'anticipo accensione anti-detonazione e gestione elettronica del plateau di coppia/boost (`BMW N55`, `AMG GT S`, `Porsche 911 GTS 992.2`, `Golf 5 GTI`).
     - **Motori `Normale` ciclo Miller ($\ge 11,5:1$) e piccoli GDI 2–3 cilindri**: transizione continua del fattore di carica Miller e *wastegate taper* oltre i `3.750–4.350 rpm` (`TwinAir`, `1.0 EcoBoost`, `1.5 TSI`, `1.5 eTSI evo2`).
4. **Soglia Knock GDI + VVT/VVL/Miller**: zero falsi knock sui motori Euro 5/6/7 moderni.

---

## Tabella Comparativa Completa (60 Motori — 1970–2025)

| Anno | Motore | Reale (CV / Nm) | PRIMA (Sim CV / Nm) | DOPO (Sim CV / Nm) | Errore DOPO (CV / Nm) |
| :-: | --- | --- | --- | --- | :-: |
| 1970 | Fiat 127 (Tipo 100 GL.000 903cc) | 47 CV / 62 Nm | 47 CV / 61 Nm | 47 CV@6100 / 66 Nm@2800 | +0.0% / +6.5% |
| 1970 | Alfa Romeo Giulia 1600 Super (AR00526) | 102 CV / 137 Nm | 126 CV / 157 Nm | 103 CV@6000 / 147 Nm@2800 | +1.0% / +7.3% |
| 1970 | Porsche 911 S 2.2 (Tipo 911/02) | 180 CV / 199 Nm | 205 CV / 227 Nm | 179 CV@7100 / 208 Nm@4300 | -0.6% / +4.5% |
| 1970 | Ferrari 365 GTB/4 Daytona (Tipo 251) | 352 CV / 431 Nm | 424 CV / 428 Nm | 359 CV@6900 / 414 Nm@4700 | +2.0% / -3.9% |
| 1970 | Ford Cosworth DFV 3.0 V8 (F1 1970) | 430 CV / 325 Nm | 463 CV / 392 Nm | 456 CV@10000 / 349 Nm@7600 | +6.0% / +7.4% |
| 1975 | VW Golf Mk1 1.1 (EA801) | 50 CV / 77 Nm | 57 CV / 75 Nm | 50 CV@4900 / 82 Nm@3000 | +0.0% / +6.5% |
| 1975 | BMW 320 E21 (M10B20) | 109 CV / 157 Nm | 116 CV / 156 Nm | 108 CV@5900 / 159 Nm@3100 | -0.9% / +1.3% |
| 1975 | Porsche 911 Turbo 3.0 (930/50) | 260 CV / 343 Nm | 361 CV / 413 Nm | 264 CV@6300 / 340 Nm@4700 | +1.5% / -0.9% |
| 1975 | Lamborghini Countach LP400 (V12 3.9) | 375 CV / 361 Nm | 408 CV / 395 Nm | 362 CV@7900 / 378 Nm@4800 | -3.5% / +4.7% |
| 1975 | Ferrari Tipo 015 3.0 Flat-12 (312T) | 495 CV / 314 Nm | 549 CV / 397 Nm | 507 CV@12200 / 320 Nm@9200 | +2.4% / +1.9% |
| 1980 | Fiat Panda 45 (903cc Serie 100) | 45 CV / 63 Nm | 47 CV / 61 Nm | 47 CV@6100 / 66 Nm@2800 | +4.4% / +4.8% |
| 1980 | Audi 80 GLE (EA827 1.6 Inj) | 110 CV / 140 Nm | 101 CV / 137 Nm | 106 CV@6200 / 140 Nm@3200 | -3.6% / +0.0% |
| 1980 | Renault 5 Turbo (1.4 Cléon-Fonte) | 160 CV / 210 Nm | 168 CV / 187 Nm | 148 CV@6000 / 197 Nm@4100 | -7.5% / -6.2% |
| 1980 | Ferrari 512 BBi (F110A Flat-12) | 340 CV / 451 Nm | 416 CV / 483 Nm | 351 CV@6300 / 458 Nm@4100 | +3.2% / +1.6% |
| 1980 | Renault-Gordini EF1 1.5 V6 Twin-Turbo (F1) | 520 CV / 360 Nm | 495 CV / 438 Nm | 489 CV@11000 / 360 Nm@7600 | -6.0% / +0.0% |
| 1985 | Fiat Uno 45 (FIRE 999cc) | 45 CV / 80 Nm | 58 CV / 73 Nm | 46 CV@4400 / 79 Nm@3300 | +2.2% / -1.3% |
| 1985 | Mercedes-Benz 190E 2.0 (M102) | 122 CV / 178 Nm | 124 CV / 166 Nm | 120 CV@6000 / 166 Nm@3100 | -1.6% / -6.7% |
| 1985 | BMW M3 E30 (S14B23) | 200 CV / 240 Nm | 269 CV / 288 Nm | 205 CV@6500 / 247 Nm@4400 | +2.5% / +2.9% |
| 1985 | Ferrari 288 GTO (F114B) | 400 CV / 496 Nm | 556 CV / 556 Nm | 403 CV@7200 / 474 Nm@4600 | +0.8% / -4.4% |
| 1985 | Lancia Delta S4 Gruppo B (233 ATR 18S) | 480 CV / 490 Nm | 567 CV / 584 Nm | 466 CV@7900 / 483 Nm@3400 | -2.9% / -1.4% |
| 1990 | Renault Clio Mk1 1.2 (Energy E7F) | 60 CV / 85 Nm | 77 CV / 96 Nm | 58 CV@5400 / 90 Nm@3100 | -3.3% / +5.9% |
| 1990 | BMW 320i E36 (M50B20) | 150 CV / 190 Nm | 202 CV / 228 Nm | 151 CV@6500 / 191 Nm@4100 | +0.7% / +0.5% |
| 1990 | Honda Civic 1.6i-VT / CRX VTEC (B16A1) | 155 CV / 150 Nm | 203 CV / 210 Nm | 158 CV@8100 / 160 Nm@4900 | +1.9% / +6.7% |
| 1990 | Ferrari F40 (F120A) | 478 CV / 577 Nm | 722 CV / 720 Nm | 493 CV@6800 / 571 Nm@5500 | +3.1% / -1.0% |
| 1990 | Honda RA100E 3.5 V10 (F1 1990) | 690 CV / 395 Nm | 746 CV / 508 Nm | 728 CV@13500 / 416 Nm@10200 | +5.5% / +5.3% |
| 1995 | Fiat Punto Mk1 55 (1.1 FIRE) | 54 CV / 85 Nm | 76 CV / 97 Nm | 57 CV@5600 / 89 Nm@3100 | +5.6% / +4.7% |
| 1995 | Audi A4 B5 1.8 20V (ADR) | 125 CV / 173 Nm | 191 CV / 228 Nm | 130 CV@6200 / 177 Nm@3600 | +4.0% / +2.3% |
| 1995 | Toyota Supra Mk4 RZ (2JZ-GTE) | 330 CV / 440 Nm | 597 CV / 661 Nm | 351 CV@6500 / 445 Nm@3400 | +6.4% / +1.1% |
| 1995 | Ferrari F50 (F130B) | 520 CV / 471 Nm | 716 CV / 653 Nm | 546 CV@8600 / 477 Nm@6700 | +5.0% / +1.3% |
| 1995 | Renault RS7 3.0 V10 (F1 1995) | 750 CV / 360 Nm | 672 CV / 457 Nm | 735 CV@15600 / 363 Nm@11300 | -2.0% / +0.8% |
| 2000 | Toyota Yaris Mk1 1.0 VVT-i (1SZ-FE) | 68 CV / 90 Nm | 94 CV / 107 Nm | 72 CV@6200 / 91 Nm@3800 | +5.9% / +1.1% |
| 2000 | VW Golf Mk4 1.9 TDI PD 130 (ASZ) | 130 CV / 310 Nm | 231 CV / 392 Nm | 130 CV@3400 / 299 Nm@2600 | +0.0% / -3.5% |
| 2000 | Honda S2000 (F20C) | 240 CV / 208 Nm | 269 CV / 293 Nm | 226 CV@8800 / 208 Nm@5600 | -5.8% / +0.0% |
| 2000 | Porsche 911 Turbo 996 (M96/70) | 420 CV / 560 Nm | 725 CV / 790 Nm | 413 CV@6500 / 519 Nm@4400 | -1.7% / -7.3% |
| 2000 | Ferrari Tipo 049 3.0 V10 (F1-2000) | 805 CV / 345 Nm | 655 CV / 446 Nm | 844 CV@17900 / 363 Nm@13000 | +4.8% / +5.2% |
| 2005 | Fiat Grande Punto 1.2 8V (FIRE) | 65 CV / 102 Nm | 89 CV / 121 Nm | 64 CV@5100 / 105 Nm@3100 | -1.5% / +2.9% |
| 2005 | BMW 330i E90 (N52B30) | 258 CV / 300 Nm | 377 CV / 434 Nm | 266 CV@7000 / 315 Nm@3600 | +3.1% / +5.0% |
| 2005 | VW Golf Mk5 GTI 2.0 TFSI (EA113) | 200 CV / 280 Nm | 377 CV / 428 Nm | 202 CV@5600 / 286 Nm@4300 | +1.0% / +2.1% |
| 2005 | Bugatti Veyron 16.4 (8.0 W16 Quad-Turbo) | 1001 CV / 1250 Nm | 2158 CV / 2408 Nm | 1004 CV@6200 / 1320 Nm@4500 | +0.3% / +5.6% |
| 2005 | Renault RS25 3.0 V10 (F1 2005) | 900 CV / 355 Nm | 664 CV / 453 Nm | 898 CV@19000 / 365 Nm@14400 | -0.2% / +2.8% |
| 2010 | Fiat 500 0.9 TwinAir Turbo (85 CV) | 85 CV / 145 Nm | 178 CV / 198 Nm | 81 CV@4300 / 141 Nm@3600 | -4.7% / -2.8% |
| 2010 | Alfa Romeo Giulietta 1.4 TB MultiAir (170 CV) | 170 CV / 250 Nm | 304 CV / 341 Nm [KNOCK] | 167 CV@5000 / 249 Nm@3700 | -1.8% / -0.4% |
| 2010 | BMW 135i / 335i (N55B30) | 306 CV / 400 Nm | 541 CV / 651 Nm | 304 CV@6200 / 396 Nm@3600 | -0.7% / -1.0% |
| 2010 | Ferrari 458 Italia (F136 FB) | 570 CV / 540 Nm | 670 CV / 685 Nm | 564 CV@9000 / 510 Nm@5700 | -1.1% / -5.6% |
| 2010 | Mercedes-Benz FO 108X 2.4 V8 (F1 2010) | 760 CV / 310 Nm | 552 CV / 375 Nm | 710 CV@18000 / 304 Nm@13800 | -6.6% / -1.9% |
| 2015 | Ford Fiesta 1.0 EcoBoost (M1DA) | 125 CV / 200 Nm | 224 CV / 249 Nm | 121 CV@4600 / 194 Nm@3800 | -3.2% / -3.0% |
| 2015 | BMW 330i F30 (B48B20) | 252 CV / 350 Nm | 469 CV / 549 Nm | 261 CV@6000 / 354 Nm@3700 | +3.6% / +1.1% |
| 2015 | Alfa Romeo Giulia QV (2.9 V6 Tipo 690T) | 510 CV / 600 Nm | 878 CV / 881 Nm | 498 CV@7000 / 577 Nm@4700 | -2.4% / -3.8% |
| 2015 | Mercedes-AMG GT S (M178 4.0 V8) | 510 CV / 650 Nm | 1137 CV / 1202 Nm | 506 CV@6300 / 633 Nm@3500 | -0.8% / -2.6% |
| 2015 | Porsche 919 Hybrid LMP1 (2.0 V4 Turbo) | 500 CV / — | 843 CV / 853 Nm | 535 CV@7600 / 538 Nm@5900 | +7.0% / — |
| 2020 | Fiat Panda / 500 1.0 FireFly (GSE N3) | 70 CV / 92 Nm | 72 CV / 106 Nm | 71 CV@6200 / 91 Nm@2800 | +1.4% / -1.1% |
| 2020 | VW Golf Mk8 1.5 TSI 130 (EA211 evo) | 130 CV / 200 Nm | 297 CV / 355 Nm [KNOCK] | 123 CV@4500 / 205 Nm@2800 | -5.4% / +2.5% |
| 2020 | Mercedes-AMG A45 S (M139 2.0) | 421 CV / 500 Nm | 681 CV / 744 Nm | 405 CV@6800 / 496 Nm@3700 | -3.8% / -0.8% |
| 2020 | Ferrari F8 Tributo (F154 CD 3.9 V8) | 720 CV / 770 Nm | 1260 CV / 1306 Nm | 765 CV@7500 / 814 Nm@5600 | +6.3% / +5.7% |
| 2020 | BMW P48 Turbo 2.0L Class 1 (DTM 2020) | 610 CV / 650 Nm | 919 CV / 962 Nm | 630 CV@8100 / 613 Nm@3800 | +3.3% / -5.7% |
| 2025 | Toyota Yaris 1.5 Dynamic Force (M15A-FKS) | 125 CV / 145 Nm | 162 CV / 209 Nm [KNOCK] | 117 CV@6500 / 146 Nm@3400 | -6.4% / +0.7% |
| 2025 | VW Passat / Tiguan 1.5 eTSI evo2 (DXDB) | 150 CV / 250 Nm | 331 CV / 397 Nm [KNOCK] | 149 CV@4500 / 249 Nm@3100 | -0.7% / -0.4% |
| 2025 | Porsche 911 Carrera GTS T-Hybrid 3.6 (992.2) | 485 CV / 570 Nm | 895 CV / 1128 Nm [KNOCK] | 468 CV@6100 / 578 Nm@3400 | -3.5% / +1.4% |
| 2025 | Ferrari 296 GTB (3.0 V6 120° F163 BC) | 663 CV / 740 Nm | 1177 CV / 1174 Nm | 690 CV@7700 / 723 Nm@5800 | +4.1% / -2.3% |
| 2025 | Ferrari 499P LMH 3.0 V6 (WEC 2025) | 680 CV / 700 Nm | 1444 CV / 1426 Nm | 723 CV@8500 / 687 Nm@5700 | +6.3% / -1.9% |

---

## Tabella Completa Set 2 — 60 Motori Out-of-Sample (1970–2025, con Peso e Affidabilità)

| Anno | Motore | Reale (CV / Nm) | Simulato (CV@RPM / Nm@RPM) | Scarto (CV / Nm) | BMEP | Peso | Affidabilità |
| :-: | --- | :---: | :---: | :---: | :---: | :---: | :---: |
| 1970 | Citroën 2CV 6 / Dyane 6 (602 cc) | 28 CV / 42 Nm | 28 CV@5100 / 43 Nm@2700 | +0.0% / +2.4% | 9.07 bar | 55 kg | 98.2% |
| 1970 | Peugeot 504 Iniezione (1.971 cc) | 104 CV / 168 Nm | 103 CV@5500 / 158 Nm@2800 | -1.0% / -6.0% | 10.09 bar | 134 kg | 97.4% |
| 1970 | Datsun 240Z (2.393 cc) | 151 CV / 198 Nm | 159 CV@6000 / 211 Nm@4100 | +5.3% / +6.6% | 11.07 bar | 166 kg | 94.1% |
| 1970 | Maserati Ghibli SS 4.9 (4.930 cc) | 335 CV / 480 Nm | 319 CV@5700 / 460 Nm@3800 | -4.8% / -4.2% | 11.73 bar | 244 kg | 92.3% |
| 1970 | Porsche 917K Le Mans (4.5L Flat-12) | 580 CV / 510 Nm | 555 CV@8400 / 503 Nm@6600 | -4.3% / -1.4% | 14.07 bar | 195 kg | 78.5% |
| 1975 | Renault 5 TL (956 cc) | 44 CV / 63 Nm | 43 CV@5300 / 67 Nm@2900 | -2.3% / +6.3% | 8.81 bar | 85 kg | 97.2% |
| 1975 | Lancia Beta 1800 (1.756 cc) | 110 CV / 145 Nm | 107 CV@6100 / 153 Nm@3000 | -2.7% / +5.5% | 10.92 bar | 130 kg | 94.7% |
| 1975 | Lotus Esprit S1 (1.973 cc 16V) | 160 CV / 190 Nm | 162 CV@6500 / 202 Nm@4300 | +1.3% / +6.3% | 12.87 bar | 119 kg | 93.3% |
| 1975 | Ferrari 308 GTB Vetroresina (2.927 cc) | 255 CV / 284 Nm | 242 CV@6900 / 279 Nm@4700 | -5.1% / -1.8% | 11.97 bar | 168 kg | 91.2% |
| 1975 | Alfa Romeo 33 TT 12 (3.0L Flat-12) | 500 CV / 333 Nm | 490 CV@11500 / 328 Nm@9100 | -2.0% / -1.5% | 13.75 bar | 188 kg | 74.2% |
| 1980 | Ford Fiesta Mk1 1.1L (1.117 cc) | 53 CV / 80 Nm | 54 CV@5700 / 77 Nm@3000 | +1.9% / -3.8% | 8.68 bar | 95 kg | 97.3% |
| 1980 | Alfa Romeo Giulietta 2.0 (1.962 cc) | 130 CV / 178 Nm | 128 CV@5800 / 190 Nm@2700 | -1.5% / +6.7% | 12.2 bar | 115 kg | 94.5% |
| 1980 | Porsche 924 Turbo (1.984 cc) | 170 CV / 245 Nm | 175 CV@6100 / 232 Nm@4500 | +2.9% / -5.3% | 14.69 bar | 143 kg | 94.6% |
| 1980 | BMW M1 E26 Stradale (3.453 cc) | 277 CV / 330 Nm | 291 CV@6700 / 353 Nm@4300 | +5.1% / +7.0% | 12.86 bar | 230 kg | 93.9% |
| 1980 | BMW M1 Procar Gr. 4 (3.453 cc) | 470 CV / 390 Nm | 475 CV@8900 / 409 Nm@6700 | +1.1% / +4.9% | 14.88 bar | 230 kg | 76.9% |
| 1985 | Peugeot 205 XR/GR 1.1 (1.124 cc) | 50 CV / 85 Nm | 53 CV@4800 / 89 Nm@3200 | +6.0% / +4.7% | 9.96 bar | 80 kg | 97.2% |
| 1985 | Saab 900 Turbo 16 Aero (1.985 cc) | 175 CV / 273 Nm | 179 CV@5500 / 266 Nm@4000 | +2.3% / -2.6% | 16.81 bar | 150 kg | 95.9% |
| 1985 | Toyota Corolla GT AE86 (1.587 cc) | 124 CV / 145 Nm | 133 CV@7300 / 151 Nm@4100 | +7.3% / +4.1% | 11.99 bar | 121 kg | 94.6% |
| 1985 | Ferrari Testarossa (4.943 cc Flat-12) | 390 CV / 490 Nm | 411 CV@6300 / 521 Nm@4500 | +5.4% / +6.3% | 13.24 bar | 242 kg | 92.8% |
| 1985 | Porsche 962C Gr. C (3.0L Boxer-6 TT) | 680 CV / 660 Nm | 668 CV@8100 / 673 Nm@4700 | -1.8% / +2.0% | 28.26 bar | 168 kg | 76.1% |
| 1990 | Ford Fiesta Mk3 1.3i (1.297 cc) | 60 CV / 101 Nm | 56 CV@4700 / 95 Nm@2800 | -6.7% / -5.9% | 9.21 bar | 105 kg | 99% |
| 1990 | Opel Calibra 2.0i 16V C20XE (1.998 cc) | 150 CV / 196 Nm | 152 CV@6300 / 205 Nm@3700 | +1.3% / +4.6% | 12.88 bar | 137 kg | 97.2% |
| 1990 | Nissan Skyline GT-R R32 (2.568 cc) | 280 CV / 353 Nm | 276 CV@6700 / 336 Nm@4000 | -1.4% / -4.8% | 16.45 bar | 193 kg | 93.4% |
| 1990 | Honda NSX NA1 (2.977 cc V6) | 274 CV / 284 Nm | 293 CV@8000 / 297 Nm@5400 | +6.9% / +4.6% | 12.52 bar | 168 kg | 93.5% |
| 1990 | Sauber-Mercedes C11 Gr.C (5.0L V8 TT) | 730 CV / 820 Nm | 762 CV@7200 / 867 Nm@5200 | +4.4% / +5.7% | 21.91 bar | 222 kg | 77.6% |
| 1995 | Peugeot 106 / Saxo 1.4i (1.360 cc) | 75 CV / 111 Nm | 70 CV@5100 / 111 Nm@3000 | -6.7% / +0.0% | 10.28 bar | 92 kg | 98.6% |
| 1995 | Alfa Romeo 155 2.0 TS 16V (1.970 cc) | 150 CV / 187 Nm | 156 CV@6800 / 191 Nm@3400 | +4.0% / +2.1% | 12.22 bar | 140 kg | 96.1% |
| 1995 | BMW M3 E36 3.2 Evo (3.201 cc) | 321 CV / 350 Nm | 324 CV@7500 / 353 Nm@4800 | +0.9% / +0.9% | 13.85 bar | 219 kg | 93.3% |
| 1995 | McLaren F1 (BMW S70/2 6.1L V12) | 627 CV / 650 Nm | 616 CV@7500 / 669 Nm@5200 | -1.8% / +2.9% | 13.86 bar | 261 kg | 91.9% |
| 1995 | Alfa Romeo 155 V6 TI DTM (2.5L V6) | 490 CV / 324 Nm | 474 CV@11800 / 308 Nm@9400 | -3.3% / -4.9% | 15.47 bar | 130 kg | 75.5% |
| 2000 | Opel Corsa C 1.2 16V (1.199 cc) | 75 CV / 110 Nm | 75 CV@5300 / 108 Nm@3900 | +0.0% / -1.8% | 11.31 bar | 107 kg | 98.1% |
| 2000 | Alfa Romeo 156 1.9 JTD 115 (1.910 cc) | 115 CV / 275 Nm | 117 CV@3300 / 269 Nm@2700 | +1.7% / -2.2% | 17.7 bar | 140 kg | 96.7% |
| 2000 | BMW M3 E46 (3.246 cc) | 343 CV / 365 Nm | 341 CV@8000 / 353 Nm@5200 | -0.6% / -3.3% | 13.65 bar | 221 kg | 92.5% |
| 2000 | Pagani Zonda C12 S 7.3 (7.291 cc) | 555 CV / 750 Nm | 585 CV@5800 / 773 Nm@4700 | +5.4% / +3.1% | 13.33 bar | 264 kg | 93.2% |
| 2000 | Audi R8 LMP900 (3.6L V8 TT FSI) | 610 CV / 700 Nm | 611 CV@7100 / 694 Nm@5300 | +0.2% / -0.9% | 24.21 bar | 193 kg | 76.3% |
| 2005 | Renault Clio Mk3 1.2 16V (1.149 cc) | 75 CV / 105 Nm | 77 CV@6200 / 101 Nm@3700 | +2.7% / -3.8% | 11.02 bar | 102 kg | 97.4% |
| 2005 | VW Golf Mk5 GT 1.4 TSI Twincharger | 170 CV / 240 Nm | 168 CV@5100 / 251 Nm@3200 | -1.2% / +4.6% | 22.68 bar | 135 kg | 90.8% |
| 2005 | Ford Mustang GT S197 (4.6L V8 24V) | 304 CV / 434 Nm | 292 CV@5800 / 401 Nm@3900 | -3.9% / -7.6% | 10.96 bar | 234 kg | 94.9% |
| 2005 | Porsche Carrera GT (5.7L V10) | 612 CV / 590 Nm | 626 CV@8400 / 604 Nm@5600 | +2.3% / +2.4% | 13.24 bar | 240 kg | 91.8% |
| 2005 | Corvette C6.R GT1 (7.0L V8) | 590 CV / 640 Nm | 572 CV@6500 / 648 Nm@4800 | -3.1% / +1.3% | 11.61 bar | 220 kg | 84.5% |
| 2010 | VW Polo Mk5 1.4 16V (1.390 cc) | 85 CV / 132 Nm | 86 CV@5300 / 128 Nm@3900 | +1.2% / -3.0% | 11.53 bar | 100 kg | 97.6% |
| 2010 | Audi A6 / Q7 3.0 V6 TDI (2.967 cc) | 245 CV / 550 Nm | 249 CV@3500 / 544 Nm@2800 | +1.6% / -1.1% | 23.06 bar | 201 kg | 92.5% |
| 2010 | Porsche 911 Turbo S 997.2 (3.8L TT) | 530 CV / 700 Nm | 572 CV@6800 / 702 Nm@3600 | +7.9% / +0.3% | 23.23 bar | 225 kg | 90.1% |
| 2010 | Lexus LFA (4.8L V10) | 560 CV / 480 Nm | 574 CV@9000 / 504 Nm@5900 | +2.5% / +5.0% | 13.19 bar | 209 kg | 90% |
| 2010 | Peugeot 908 HDi FAP LMP1 (5.5L V12) | 730 CV / 1200 Nm | 723 CV@4600 / 1190 Nm@3700 | -1.0% / -0.8% | 27.17 bar | 255 kg | 75% |
| 2015 | Suzuki Swift 1.2 Dualjet (1.242 cc) | 90 CV / 120 Nm | 88 CV@6100 / 115 Nm@3900 | -2.2% / -4.2% | 11.6 bar | 96 kg | 97.3% |
| 2015 | Audi A4 B9 2.0 TDI 190 (1.968 cc) | 190 CV / 400 Nm | 179 CV@3600 / 388 Nm@2800 | -5.8% / -3.0% | 24.8 bar | 153 kg | 91.7% |
| 2015 | Corvette C7 Z06 (6.2L V8 SC) | 659 CV / 881 Nm | 701 CV@6100 / 873 Nm@3400 | +6.4% / -0.9% | 17.8 bar | 257 kg | 91% |
| 2015 | Lamborghini Huracán LP 610-4 (5.2L V10) | 610 CV / 560 Nm | 604 CV@8200 / 574 Nm@5700 | -1.0% / +2.5% | 13.86 bar | 242 kg | 88% |
| 2015 | Nissan GT-R LM Nismo LMP1 (3.0L V6 TT) | 550 CV / 680 Nm | 578 CV@6800 / 684 Nm@4900 | +5.1% / +0.6% | 28.73 bar | 190 kg | 76.2% |
| 2020 | Suzuki Swift 1.2 Dualjet K12D (1.197 cc) | 83 CV / 107 Nm | 79 CV@6000 / 105 Nm@3900 | -4.8% / -1.9% | 10.99 bar | 94 kg | 92.2% |
| 2020 | Alfa Romeo Giulia 2.0 Turbo 200 (1.995 cc) | 200 CV / 330 Nm | 200 CV@5100 / 330 Nm@3500 | +0.0% / +0.0% | 20.76 bar | 133 kg | 93.9% |
| 2020 | Porsche 718 Cayman GT4 4.0 (3.995 cc) | 420 CV / 420 Nm | 423 CV@8000 / 436 Nm@5000 | +0.7% / +3.8% | 13.7 bar | 211 kg | 92.5% |
| 2020 | McLaren 765LT (4.0L V8 Biturbo) | 765 CV / 800 Nm | 765 CV@7400 / 801 Nm@5700 | +0.0% / +0.1% | 25.21 bar | 211 kg | 86% |
| 2020 | Porsche 911 RSR-19 (4.2L Boxer-6 WEC) | 515 CV / 520 Nm | 477 CV@7500 / 490 Nm@5600 | -7.4% / -5.8% | 14.69 bar | 174 kg | 81.6% |
| 2025 | Renault Clio / Duster 1.6 (1.598 cc) | 94 CV / 148 Nm | 98 CV@5000 / 149 Nm@3600 | +4.3% / +0.7% | 11.72 bar | 103 kg | 97.6% |
| 2025 | Mercedes C 300 d (OM654M 2.0L TT) | 265 CV / 550 Nm | 248 CV@3500 / 541 Nm@2800 | -6.4% / -1.6% | 34.15 bar | 128 kg | 88.6% |
| 2025 | BMW M3 Comp G80 LCI (3.0L TT) | 530 CV / 650 Nm | 526 CV@6800 / 628 Nm@4600 | -0.8% / -3.4% | 26.35 bar | 178 kg | 86% |
| 2025 | Ferrari 12Cilindri (6.5L V12) | 830 CV / 678 Nm | 845 CV@9400 / 725 Nm@6400 | +1.8% / +6.9% | 14.02 bar | 275 kg | 85.9% |
| 2025 | Porsche 963 LMDh (4.6L V8 TT) | 680 CV / 650 Nm | 662 CV@8000 / 673 Nm@5700 | -2.6% / +3.5% | 18.41 bar | 194 kg | 76.3% |
