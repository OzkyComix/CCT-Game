import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  type PistonEngineConfigInput,
  getActiveTurboStages,
} from '../../math/engineMath';
import {
  type WankelEngineConfigInput,
  getActiveWankelTurboStages,
} from '../../math/wankelMath';
import type { DimensionsLWH } from '../../types/gameTypes';

export interface OverlaidChassisBayItem {
  id: string;
  name: string;
  codeName: string;
  bayDimensionsMm: DimensionsLWH;
  isCompatible: boolean;
  orientationConflict: boolean;
}

interface VolumeViewer3DProps {
  /** Dimensioni effettive del motore orientato nel vano (mm) */
  engineInBayDimensionsMm: DimensionsLWH;
  /** Dimensioni native del motore lungo il suo albero (mm) */
  rawEngineDimensionsMm: DimensionsLWH;
  /** Configurazione opzionale del motore a pistoni 1A */
  engineConfig?: PistonEngineConfigInput;
  /** Configurazione opzionale del motore rotativo Wankel 1B */
  wankelConfig?: WankelEngineConfigInput;
  /** Tipo di propulsore per scegliere il modello procedurale ('Piston' | 'Wankel') */
  engineType?: 'Piston' | 'Wankel';
  /** Lista di pianali selezionati con checkbox per la sovrapposizione simultanea 3D */
  overlaidChassisBays: OverlaidChassisBayItem[];
}

/** Crea uno Sprite 3D con testo nitido su Canvas per etichettare assi L/W/H e nomi pianali */
function createTextSprite(
  text: string,
  bgColor: string,
  borderColor: string,
  textColor: string,
  scaleWidth = 0.48,
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 80, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = 'bold 30px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 48);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scaleWidth, scaleWidth * (96 / 512), 1);
  return sprite;
}

/**
 * Modella una singola unità turbocompressore 3D realistica e separata:
 * - Lato Freddo: Chiocciola compressore in alluminio/argento con bocca d'aspirazione conica e condotto tangenziale
 * - CHRA centrale: Corpo cuscinetti in acciaio scuro
 * - Lato Caldo: Chiocciola turbina in ghisa / arancione termico con condotto downpipe
 * Il diametro 3D si ridimensiona dinamicamente in tempo reale in base ai millimetri effettivi (diamMm)!
 */
function createDetailedTurboMesh(
  diamMm: number,
  isHotV: boolean,
): THREE.Group {
  const tGroup = new THREE.Group();

  // Scala dinamica visiva: 35mm -> raggio ~0.038, 90mm -> raggio ~0.068
  const compRadius = 0.024 + (Math.max(35, Math.min(95, diamMm)) / 1000) * 0.46;
  const turbRadius = compRadius * 0.92;
  const scrollThickness = compRadius * 0.52;
  const chraLength = compRadius * 0.38;

  const compMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.22,
    metalness: 0.88,
  });

  const chraMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.55,
    metalness: 0.75,
  });

  const turbMat = new THREE.MeshStandardMaterial({
    color: isHotV ? 0xea580c : 0x9a3412,
    emissive: isHotV ? 0x7c2d12 : 0x431407,
    roughness: 0.65,
    metalness: 0.45,
  });

  // 1. Chiocciola Fredda (Compressore Alluminio)
  const compScrollGeo = new THREE.CylinderGeometry(
    compRadius,
    compRadius * 0.88,
    scrollThickness,
    20,
  );
  compScrollGeo.rotateZ(Math.PI / 2);
  const compScrollMesh = new THREE.Mesh(compScrollGeo, compMat);
  compScrollMesh.position.set(chraLength / 2 + scrollThickness / 2, 0, 0);
  tGroup.add(compScrollMesh);

  // Bocca d'aspirazione conica frontale (Snout / Tromboncino)
  const compInletGeo = new THREE.CylinderGeometry(
    compRadius * 0.48,
    compRadius * 0.56,
    compRadius * 0.42,
    18,
  );
  compInletGeo.rotateZ(Math.PI / 2);
  const compInletMesh = new THREE.Mesh(compInletGeo, compMat);
  compInletMesh.position.set(
    chraLength / 2 + scrollThickness + (compRadius * 0.42) / 2,
    0,
    0,
  );
  tGroup.add(compInletMesh);

  // Beccuccio mandata aria compressa verso intercooler (Discharge nozzle tangenziale)
  const compOutletGeo = new THREE.CylinderGeometry(
    compRadius * 0.32,
    compRadius * 0.32,
    compRadius * 0.62,
    14,
  );
  const compOutletMesh = new THREE.Mesh(compOutletGeo, compMat);
  compOutletMesh.position.set(
    chraLength / 2 + scrollThickness / 2,
    compRadius * 0.82,
    0,
  );
  tGroup.add(compOutletMesh);

  // 2. CHRA (Centro cuscinetti)
  const chraGeo = new THREE.CylinderGeometry(
    compRadius * 0.36,
    compRadius * 0.36,
    chraLength,
    16,
  );
  chraGeo.rotateZ(Math.PI / 2);
  const chraMesh = new THREE.Mesh(chraGeo, chraMat);
  tGroup.add(chraMesh);

  // 3. Chiocciola Calda (Turbina Ghisa / Calore)
  const turbScrollGeo = new THREE.CylinderGeometry(
    turbRadius * 0.9,
    turbRadius,
    scrollThickness * 0.92,
    20,
  );
  turbScrollGeo.rotateZ(Math.PI / 2);
  const turbScrollMesh = new THREE.Mesh(turbScrollGeo, turbMat);
  turbScrollMesh.position.set(-(chraLength / 2 + (scrollThickness * 0.92) / 2), 0, 0);
  tGroup.add(turbScrollMesh);

  // Condotto scarico fumi (Downpipe flange)
  const turbExhaustGeo = new THREE.CylinderGeometry(
    turbRadius * 0.44,
    turbRadius * 0.48,
    turbRadius * 0.44,
    16,
  );
  turbExhaustGeo.rotateZ(Math.PI / 2);
  const turbExhaustMesh = new THREE.Mesh(turbExhaustGeo, turbMat);
  turbExhaustMesh.position.set(
    -(chraLength / 2 + scrollThickness * 0.92 + (turbRadius * 0.44) / 2),
    0,
    0,
  );
  tGroup.add(turbExhaustMesh);

  return tGroup;
}

/**
 * Costruisce il Modello 3D Procedurale del Motore (Monoblocco, Bancate inclinate,
 * Testate OHV/SOHC/DOHC, Cilindri, Collettori e Turbine Frontali/Laterali/Hot-V)
 */
function buildProceduralEngineMeshGroup(
  config: PistonEngineConfigInput,
  rawDimsMm: DimensionsLWH,
  anyCollision: boolean,
): THREE.Group {
  const engineRoot = new THREE.Group();

  // Scala: 1000 mm = 1.0 unità Three.js
  const L = rawDimsMm.lengthMm / 1000;
  const W = rawDimsMm.widthMm / 1000;
  const H = rawDimsMm.heightMm / 1000;

  const isIron = config.blockMaterialId.includes('iron');
  const blockMat = new THREE.MeshStandardMaterial({
    color: anyCollision ? 0xb91c1c : isIron ? 0x475569 : 0x94a3b8,
    roughness: 0.45,
    metalness: 0.72,
  });

  const headMat = new THREE.MeshStandardMaterial({
    color: anyCollision ? 0xdc2626 : 0xcbd5e1,
    roughness: 0.32,
    metalness: 0.8,
  });

  const camCoverMat = new THREE.MeshStandardMaterial({
    color: anyCollision
      ? 0xef4444
      : config.referenceClass === 'Corsa' || config.referenceClass === 'Sport'
        ? 0xdc2626 // Coperchi punterie rossi stile Testa Rossa / Competizione
        : 0x1e293b,
    roughness: 0.28,
    metalness: 0.55,
  });

  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.6,
    metalness: 0.5,
  });

  // 1. Coppa dell'olio + Basamento inferiore (Crankcase)
  const blockCoreLength = Math.max(0.24, L * 0.78);
  const crankcaseWidth = Math.min(0.32, W * 0.45);
  const crankcaseHeight = Math.min(0.22, H * 0.34);

  const sumpGeo = new THREE.BoxGeometry(blockCoreLength, crankcaseHeight, crankcaseWidth);
  const sumpMesh = new THREE.Mesh(sumpGeo, blockMat);
  sumpMesh.position.set(0, -H * 0.26, 0);
  engineRoot.add(sumpMesh);

  // Puleggia anteriore (+X è Fronte motore) e Volano posteriore (-X)
  const pulleyGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.03, 20);
  pulleyGeo.rotateZ(Math.PI / 2);
  const pulleyMesh = new THREE.Mesh(pulleyGeo, darkMetalMat);
  pulleyMesh.position.set(blockCoreLength / 2 + 0.02, -H * 0.25, 0);
  engineRoot.add(pulleyMesh);

  const flywheelGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.035, 24);
  flywheelGeo.rotateZ(Math.PI / 2);
  const flywheelMesh = new THREE.Mesh(flywheelGeo, darkMetalMat);
  flywheelMesh.position.set(-blockCoreLength / 2 - 0.02, -H * 0.24, 0);
  engineRoot.add(flywheelMesh);

  // 2. Costruzione Bancate e Cilindri in base ad Architettura (Inline, V, Boxer, W)
  const boreScale = (config.boreMm / 1000) * 0.52;
  const bankRadialLen = Math.max(0.18, (config.strokeMm / 1000) * 2.1 + 0.08);
  const camCoverHeight =
    config.camshaftTypeId === 'cam-ohv'
      ? 0.035
      : config.camshaftTypeId === 'cam-sohc'
        ? 0.055
        : 0.075;
  const camCoverWidth =
    config.camshaftTypeId === 'cam-ohv'
      ? boreScale * 1.6
      : config.camshaftTypeId === 'cam-sohc'
        ? boreScale * 2.0
        : boreScale * 2.55;

  const buildBank = (
    angleRad: number,
    cylCountInBank: number,
    axialStaggerOffset: number,
    zLateralOffset = 0,
  ) => {
    const bankGroup = new THREE.Group();
    bankGroup.position.set(axialStaggerOffset, -H * 0.2, zLateralOffset);
    bankGroup.rotation.x = angleRad;

    const bankLen = Math.max(0.2, blockCoreLength * 0.92);

    // Cilindri individuali lungo la bancata
    for (let i = 0; i < cylCountInBank; i++) {
      const frac = cylCountInBank === 1 ? 0 : i / (cylCountInBank - 1) - 0.5;
      const xPos = frac * (bankLen - boreScale * 2.1);
      const cylGeo = new THREE.CylinderGeometry(
        boreScale,
        boreScale * 0.96,
        bankRadialLen,
        16,
      );
      const cylMesh = new THREE.Mesh(cylGeo, blockMat);
      cylMesh.position.set(xPos, bankRadialLen * 0.52, 0);
      bankGroup.add(cylMesh);
    }

    // Testata sopra i cilindri
    const headGeo = new THREE.BoxGeometry(bankLen, 0.065, camCoverWidth * 0.92);
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.set(0, bankRadialLen + 0.03, 0);
    bankGroup.add(headMesh);

    // Coperchio alberi a camme (OHV / SOHC / DOHC)
    const coverGeo = new THREE.BoxGeometry(
      bankLen * 0.96,
      camCoverHeight,
      camCoverWidth,
    );
    const coverMesh = new THREE.Mesh(coverGeo, camCoverMat);
    coverMesh.position.set(0, bankRadialLen + 0.065 + camCoverHeight / 2, 0);
    bankGroup.add(coverMesh);

    engineRoot.add(bankGroup);
  };

  if (config.architecture === 'Inline') {
    buildBank(0, config.cylinders, 0, 0);
  } else if (config.architecture === 'V') {
    const cylPerBank = Math.ceil(config.cylinders / 2);
    const halfAngleRad = ((config.bankAngleDeg || 90) / 2) * (Math.PI / 180);
    // In un V (anche V180° Flat-V) le bielle condividono il perno di manovella (sfalsamento minimo 18mm)
    buildBank(halfAngleRad, cylPerBank, 0.009, 0);
    buildBank(-halfAngleRad, cylPerBank, -0.009, 0);
  } else if (config.architecture === 'Boxer') {
    // Nel Boxer puro ogni cilindro ha il suo perno dedicato: sfalsamento assiale e laterale netto!
    const cylPerBank = Math.ceil(config.cylinders / 2);
    buildBank(Math.PI / 2, cylPerBank, 0.032, 0.025);
    buildBank(-Math.PI / 2, cylPerBank, -0.032, -0.025);
  } else {
    // Architettura W (4 bancate)
    const cylPerRow = Math.max(2, Math.ceil(config.cylinders / 4));
    const outerRad = (((config.bankAngleDeg || 72) / 2) + 12) * (Math.PI / 180);
    const innerRad = (((config.bankAngleDeg || 72) / 2) - 14) * (Math.PI / 180);
    buildBank(outerRad, cylPerRow, 0.015, 0.02);
    buildBank(innerRad, cylPerRow, -0.015, 0.008);
    buildBank(-innerRad, cylPerRow, 0.015, -0.008);
    buildBank(-outerRad, cylPerRow, -0.015, -0.02);
  }

  // 3. Turbocompressori Procedurali Dettagliati (separati fisicamente, con diametro mm reale per ciascuno)
  if (config.turboType !== 'NaturallyAspirated') {
    const activeStages = getActiveTurboStages(config);
    const count = activeStages.length;
    const isHotV = config.turboPosition === 'HotV';

    if (config.turboPosition === 'Front') {
      const spacingZ = Math.max(0.18, (W * 0.55) / Math.max(1, count - 1));
      for (let i = 0; i < count; i++) {
        const zOff = count === 1 ? 0 : (i - (count - 1) / 2) * spacingZ;
        const tMesh = createDetailedTurboMesh(activeStages[i].diamMm, false);
        tMesh.position.set(blockCoreLength / 2 + 0.08, -H * 0.05, zOff);
        engineRoot.add(tMesh);
      }
    } else if (config.turboPosition === 'HotV') {
      // Dentro la V centrale: separate fisicamente lungo l'asse X per evitare qualunque sovrapposizione
      const spacingX = Math.max(0.16, (blockCoreLength * 0.6) / Math.max(1, count - 1));
      for (let i = 0; i < count; i++) {
        const xOff = count === 1 ? 0 : (i - (count - 1) / 2) * spacingX;
        const zOff = count >= 2 ? (i % 2 === 0 ? -0.028 : 0.028) : 0;
        const tMesh = createDetailedTurboMesh(activeStages[i].diamMm, isHotV);
        tMesh.position.set(xOff, H * 0.17, zOff);
        engineRoot.add(tMesh);
      }
    } else {
      // Laterali esterne sui fianchi W:
      // Se V o Boxer con 2 turbine: una per bancata (fianco sinistro +Z, fianco destro -Z)
      // Se Inline con 2 turbine: entrambe sul fianco scarico ma distanziate lungo X di almeno 0.22m
      // Se Quad-Turbo (4 turbine): 2 a sinistra e 2 a destra distanziate lungo X
      const isVOrBoxer =
        config.architecture === 'V' ||
        config.architecture === 'Boxer' ||
        config.architecture === 'W';

      for (let i = 0; i < count; i++) {
        let side = 1;
        let xOff = 0;
        if (isVOrBoxer && count === 2) {
          side = i === 0 ? 1 : -1;
          xOff = 0;
        } else if (count === 4) {
          side = i < 2 ? 1 : -1;
          xOff = (i % 2 === 0 ? -1 : 1) * 0.12;
        } else {
          side = -1;
          const spacingX = Math.max(0.2, (blockCoreLength * 0.72) / Math.max(1, count - 1));
          xOff = count === 1 ? 0 : (i - (count - 1) / 2) * spacingX;
        }
        const tMesh = createDetailedTurboMesh(activeStages[i].diamMm, false);
        tMesh.position.set(xOff, -H * 0.07, side * (W * 0.44));
        engineRoot.add(tMesh);
      }
    }
  }

  // Se il motore è predisposto per montaggio Trasversale, ruota di 90° rispetto alla direzione di marcia!
  if (config.intendedOrientation === 'Trasversale') {
    engineRoot.rotation.y = Math.PI / 2;
  }

  return engineRoot;
}

function buildProceduralWankelMeshGroup(
  config: WankelEngineConfigInput,
  rawDimsMm: DimensionsLWH,
  anyCollision: boolean,
): THREE.Group {
  const root = new THREE.Group();
  const W = rawDimsMm.widthMm / 1000;

  const housingMat = new THREE.MeshStandardMaterial({
    color: anyCollision ? 0xb91c1c : 0xa1a1aa,
    roughness: 0.35,
    metalness: 0.75,
  });

  const ironPlateMat = new THREE.MeshStandardMaterial({
    color: anyCollision ? 0x991b1b : 0x334155,
    roughness: 0.55,
    metalness: 0.6,
  });

  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.8,
  });

  const intakeMat = new THREE.MeshStandardMaterial({
    color: config.referenceClass === 'Corsa' ? 0xd97706 : 0x0284c7,
    roughness: 0.3,
    metalness: 0.6,
  });

  // 1. Sandwich dei Rotori e delle Piastre Intermedie Wankel
  const rotorThickness = config.rotorWidthMm / 1000;
  const plateThickness = 0.022;
  const R = config.generatingRadiusMm / 1000;
  const e = config.eccentricityMm / 1000;

  const totalSandwichLen =
    config.rotorCount * rotorThickness + (config.rotorCount + 1) * plateThickness;
  const startX = -totalSandwichLen / 2;

  // Piastre fisse in ghisa (Front iron, intermediate iron, rear iron)
  for (let i = 0; i <= config.rotorCount; i++) {
    const xPos = startX + i * (rotorThickness + plateThickness) + plateThickness / 2;
    const plateGeo = new THREE.BoxGeometry(plateThickness, (R + e) * 2.1, (R + e) * 2.05);
    const plateMesh = new THREE.Mesh(plateGeo, ironPlateMat);
    plateMesh.position.set(xPos, 0, 0);
    root.add(plateMesh);
  }

  // Casse trocoidi dei rotori (Alluminio con profilo trocoide)
  for (let i = 0; i < config.rotorCount; i++) {
    const xPos =
      startX + plateThickness + i * (rotorThickness + plateThickness) + rotorThickness / 2;
    const trochoidGeo = new THREE.CylinderGeometry(
      (R + e) * 0.96,
      (R + e) * 0.96,
      rotorThickness,
      24,
    );
    trochoidGeo.rotateZ(Math.PI / 2);
    const trochoidMesh = new THREE.Mesh(trochoidGeo, housingMat);
    trochoidMesh.position.set(xPos, 0, 0);
    root.add(trochoidMesh);

    // Candele doppie per rotore sul fianco (Leading e Trailing)
    const plugGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.04, 12);
    plugGeo.rotateX(Math.PI / 2);
    const plug1 = new THREE.Mesh(plugGeo, shaftMat);
    plug1.position.set(xPos, 0.045, (R + e) * 0.92);
    const plug2 = new THREE.Mesh(plugGeo, shaftMat);
    plug2.position.set(xPos, -0.045, (R + e) * 0.92);
    root.add(plug1);
    root.add(plug2);
  }

  // Albero eccentrico passante, puleggia anteriore (+X) e volano posteriore (-X)
  const shaftGeo = new THREE.CylinderGeometry(0.042, 0.042, totalSandwichLen + 0.12, 16);
  shaftGeo.rotateZ(Math.PI / 2);
  const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
  shaftMesh.position.set(0, 0, 0);
  root.add(shaftMesh);

  const pulleyGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.035, 20);
  pulleyGeo.rotateZ(Math.PI / 2);
  const pulleyMesh = new THREE.Mesh(pulleyGeo, shaftMat);
  pulleyMesh.position.set(totalSandwichLen / 2 + 0.045, 0, 0);
  root.add(pulleyMesh);

  const flywheelGeo = new THREE.CylinderGeometry(0.145, 0.145, 0.038, 24);
  flywheelGeo.rotateZ(Math.PI / 2);
  const flywheelMesh = new THREE.Mesh(flywheelGeo, shaftMat);
  flywheelMesh.position.set(-totalSandwichLen / 2 - 0.045, 0, 0);
  root.add(flywheelMesh);

  // 2. Collettore di Aspirazione Superiore
  const intakeGeo = new THREE.BoxGeometry(totalSandwichLen * 0.88, 0.055, 0.16);
  const intakeMesh = new THREE.Mesh(intakeGeo, intakeMat);
  intakeMesh.position.set(0, (R + e) * 1.05 + 0.04, -0.05);
  root.add(intakeMesh);

  // 3. Coppa Olio Inferiore
  const sumpGeo = new THREE.BoxGeometry(totalSandwichLen * 0.92, 0.075, (R + e) * 1.25);
  const sumpMesh = new THREE.Mesh(sumpGeo, ironPlateMat);
  sumpMesh.position.set(0, -(R + e) * 1.05 - 0.03, 0);
  root.add(sumpMesh);

  // 4. Turbocompressori Wankel Procedurali Dettagliati (separati nello spazio 3D)
  if (config.turboType !== 'NaturallyAspirated') {
    const activeStages = getActiveWankelTurboStages(config);
    const count = activeStages.length;
    const exhaustFlankZ = (R + e) * 1.08 + 0.05;

    if (config.turboPosition === 'Front') {
      const spacingZ = Math.max(0.18, (W * 0.52) / Math.max(1, count - 1));
      for (let i = 0; i < count; i++) {
        const zOff = count === 1 ? 0 : (i - (count - 1) / 2) * spacingZ;
        const tMesh = createDetailedTurboMesh(activeStages[i].diamMm, false);
        tMesh.position.set(totalSandwichLen / 2 + 0.075, -0.015, zOff);
        root.add(tMesh);
      }
    } else {
      // Posizionamento laterale sul fianco di scarico:
      // SEPARAZIONE FISICA REALE: le turbine sono distanziate di almeno 200 mm lungo X
      // e con quote Y/Z sfalsate (layout stile Sequential Twin-Turbo), senza MAI toccarsi o fondersi in un unico tubo
      const spacingX = Math.max(0.2, (totalSandwichLen * 0.95) / Math.max(1, count - 1));
      for (let i = 0; i < count; i++) {
        const xOff = count === 1 ? 0 : (i - (count - 1) / 2) * spacingX;
        const yOff = count >= 2 ? (i % 2 === 0 ? -0.03 : 0.03) : 0;
        const zOff = count >= 2 ? exhaustFlankZ + (i % 2 === 0 ? -0.015 : 0.02) : exhaustFlankZ;
        const tMesh = createDetailedTurboMesh(activeStages[i].diamMm, false);
        tMesh.position.set(xOff, yOff, zOff);
        root.add(tMesh);
      }
    }
  }

  if (config.intendedOrientation === 'Trasversale') {
    root.rotation.y = Math.PI / 2;
  }

  return root;
}

export const VolumeViewer3D: React.FC<VolumeViewer3DProps> = ({
  engineInBayDimensionsMm,
  rawEngineDimensionsMm,
  engineConfig,
  wankelConfig,
  engineType = 'Piston',
  overlaidChassisBays,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [viewMode, setViewMode] = useState<'procedural-3d' | 'bounding-box'>('procedural-3d');
  const [autoRotate, setAutoRotate] = useState(false);

  const sceneRef = useRef<{
    group: THREE.Group;
    engineContainer: THREE.Group;
    baysContainer: THREE.Group;
    axesContainer: THREE.Group;
    camera: THREE.PerspectiveCamera;
  } | null>(null);

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const anyCollision = overlaidChassisBays.some((b) => !b.isCompatible);

  // 1. Inizializzazione unica della scena Three.js (non resetta mai la rotazione quando muovi gli slider!)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 520;
    const height = container.clientHeight || 310;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a12);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(1.85, 1.35, 2.05);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const grid = new THREE.GridHelper(2.8, 14, 0x334155, 0x1e293b);
    grid.position.y = -0.48;
    scene.add(grid);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.25);
    dirLight1.position.set(3, 4.5, 2.5);
    scene.add(dirLight1);
    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.45);
    dirLight2.position.set(-3, 2, -2);
    scene.add(dirLight2);

    const group = new THREE.Group();
    group.rotation.y = -0.62;
    group.rotation.x = 0.12;
    scene.add(group);

    const engineContainer = new THREE.Group();
    const baysContainer = new THREE.Group();
    const axesContainer = new THREE.Group();

    group.add(engineContainer);
    group.add(baysContainer);
    group.add(axesContainer);

    // Costruzione Assi Tecnici L (Lunghezza + Freccia Marcia), W (Larghezza), H (Altezza)
    const frontArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-0.62, -0.46, 0.62),
      1.24,
      0xf59e0b,
      0.14,
      0.08,
    );
    axesContainer.add(frontArrow);

    const spriteL = createTextSprite(
      'ASSE L (LUNGHEZZA) ➔ FRONTE MARCIA',
      'rgba(15, 23, 42, 0.92)',
      '#f59e0b',
      '#fde68a',
      0.66,
    );
    spriteL.position.set(0.05, -0.38, 0.65);
    axesContainer.add(spriteL);

    const widthArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(-0.62, -0.46, -0.58),
      1.16,
      0x38bdf8,
      0.11,
      0.06,
    );
    axesContainer.add(widthArrow);

    const spriteW = createTextSprite(
      'ASSE W (LARGHEZZA VANO)',
      'rgba(15, 23, 42, 0.92)',
      '#38bdf8',
      '#bae6fd',
      0.52,
    );
    spriteW.position.set(-0.65, -0.38, 0.0);
    axesContainer.add(spriteW);

    const heightArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(-0.62, -0.46, -0.58),
      0.92,
      0x34d399,
      0.11,
      0.06,
    );
    axesContainer.add(heightArrow);

    const spriteH = createTextSprite(
      'ASSE H (ALTEZZA)',
      'rgba(15, 23, 42, 0.92)',
      '#34d399',
      '#a7f3d0',
      0.44,
    );
    spriteH.position.set(-0.62, 0.54, -0.58);
    axesContainer.add(spriteH);

    sceneRef.current = {
      group,
      engineContainer,
      baysContainer,
      axesContainer,
      camera,
    };

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (autoRotateRef.current && !isDraggingRef.current) {
        group.rotation.y += 0.0035;
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      sceneRef.current = null;
    };
  }, []);

  // 2. Aggiornamento reattivo del Motore (Bounding Box vs Modello 3D Procedurale) e Multi-Pianale Sovrapposto
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;

    // Pulisci geometrie precedenti del motore
    while (sc.engineContainer.children.length > 0) {
      const child = sc.engineContainer.children[0];
      sc.engineContainer.remove(child);
    }

    if (viewMode === 'bounding-box') {
      const boxGeo = new THREE.BoxGeometry(
        engineInBayDimensionsMm.lengthMm / 1000,
        engineInBayDimensionsMm.heightMm / 1000,
        engineInBayDimensionsMm.widthMm / 1000,
      );
      const boxMat = new THREE.MeshStandardMaterial({
        color: anyCollision ? 0xdc2626 : 0xf59e0b,
        roughness: 0.35,
        metalness: 0.6,
        transparent: true,
        opacity: 0.82,
      });
      const mesh = new THREE.Mesh(boxGeo, boxMat);
      sc.engineContainer.add(mesh);
    } else {
      // Modello 3D Procedurale del Motore (Pistoni 1A o Wankel 1B) + sottile contorno bounding box
      let procGroup: THREE.Group;
      if (engineType === 'Wankel' && wankelConfig) {
        procGroup = buildProceduralWankelMeshGroup(
          wankelConfig,
          rawEngineDimensionsMm,
          anyCollision,
        );
      } else if (engineConfig) {
        procGroup = buildProceduralEngineMeshGroup(
          engineConfig,
          rawEngineDimensionsMm,
          anyCollision,
        );
      } else {
        procGroup = new THREE.Group();
      }
      sc.engineContainer.add(procGroup);

      const envGeo = new THREE.BoxGeometry(
        engineInBayDimensionsMm.lengthMm / 1000,
        engineInBayDimensionsMm.heightMm / 1000,
        engineInBayDimensionsMm.widthMm / 1000,
      );
      const envEdges = new THREE.EdgesGeometry(envGeo);
      const envMat = new THREE.LineDashedMaterial({
        color: anyCollision ? 0xf87171 : 0xfbbf24,
        dashSize: 0.04,
        gapSize: 0.025,
      });
      const envLines = new THREE.LineSegments(envEdges, envMat);
      envLines.computeLineDistances();
      sc.engineContainer.add(envLines);
    }

    // Pulisci e ridisegna tutti i Vani Motore selezionati (Multi-Pianale Sovrapposto)
    while (sc.baysContainer.children.length > 0) {
      const child = sc.baysContainer.children[0];
      sc.baysContainer.remove(child);
    }

    overlaidChassisBays.forEach((bayItem, idx) => {
      const bL = bayItem.bayDimensionsMm.lengthMm / 1000;
      const bH = bayItem.bayDimensionsMm.heightMm / 1000;
      const bW = bayItem.bayDimensionsMm.widthMm / 1000;

      const bayGeo = new THREE.BoxGeometry(bL, bH, bW);
      const bayEdges = new THREE.EdgesGeometry(bayGeo);
      const colorHex = bayItem.isCompatible ? 0x10b981 : 0xef4444;

      const lineMat = new THREE.LineBasicMaterial({
        color: colorHex,
      });
      const wireframe = new THREE.LineSegments(bayEdges, lineMat);
      sc.baysContainer.add(wireframe);

      // Superficie semitrasparente del vano
      const surfaceMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: bayItem.isCompatible ? 0.07 : 0.14,
        depthWrite: false,
      });
      const surfaceMesh = new THREE.Mesh(bayGeo, surfaceMat);
      sc.baysContainer.add(surfaceMesh);

      // Etichetta 3D col nome del pianale sovrapposto
      const labelSprite = createTextSprite(
        `${bayItem.isCompatible ? '✓' : '✗'} ${bayItem.name.toUpperCase()}`,
        bayItem.isCompatible ? 'rgba(6, 78, 59, 0.92)' : 'rgba(127, 29, 29, 0.94)',
        bayItem.isCompatible ? '#10b981' : '#ef4444',
        bayItem.isCompatible ? '#a7f3d0' : '#fecaca',
        0.54,
      );
      labelSprite.position.set(
        bL / 2 - 0.12,
        bH / 2 + 0.07 + idx * 0.09,
        -bW / 2 + 0.1,
      );
      sc.baysContainer.add(labelSprite);
    });
  }, [
    viewMode,
    engineInBayDimensionsMm,
    rawEngineDimensionsMm,
    engineConfig,
    wankelConfig,
    engineType,
    overlaidChassisBays,
    anyCollision,
  ]);

  const handleResetView = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sceneRef.current) return;
    sceneRef.current.group.rotation.set(0.12, -0.62, 0);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !sceneRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    sceneRef.current.group.rotation.y += dx * 0.01;
    sceneRef.current.group.rotation.x = Math.max(
      -0.75,
      Math.min(0.75, sceneRef.current.group.rotation.x + dy * 0.008),
    );
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className="space-y-2">
      {/* Barra Controlli Superiore CAD 3D: Switch Modalità + Reset Visuale + Auto-Rotate */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode('procedural-3d')}
            className={`px-2.5 py-1 rounded border cursor-pointer transition ${
              viewMode === 'procedural-3d'
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            Modello 3D Motore
          </button>
          <button
            type="button"
            onClick={() => setViewMode('bounding-box')}
            className={`px-2.5 py-1 rounded border cursor-pointer transition ${
              viewMode === 'bounding-box'
                ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-bold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            Bounding Box LWH
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleResetView}
            className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 cursor-pointer"
          >
            Reset Visuale
          </button>
          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            className={`px-2.5 py-1 rounded border cursor-pointer ${
              autoRotate
                ? 'bg-emerald-950/70 border-emerald-600 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            {autoRotate ? 'Auto-Rot: ON' : 'Auto-Rot: OFF'}
          </button>
        </div>
      </div>

      {/* Viewport WebGL Three.js */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative w-full h-72 rounded-lg border border-slate-800 bg-slate-950 overflow-hidden cursor-grab active:cursor-grabbing select-none"
      >
        <div ref={mountRef} className="w-full h-full" />

        {/* Overlay Info Ingombri L / W / H nel Vano */}
        <div className="absolute top-2.5 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none text-[11px] font-mono">
          <span className="px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-slate-200">
            Nel Vano (
            {wankelConfig
              ? wankelConfig.intendedOrientation
              : (engineConfig?.intendedOrientation ?? 'Longitudinale')}
            ): L={engineInBayDimensionsMm.lengthMm}mm • W=
            {engineInBayDimensionsMm.widthMm}mm • H=
            {engineInBayDimensionsMm.heightMm}mm
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-amber-300">
            Pianali Sovrapposti: {overlaidChassisBays.length}
          </span>
        </div>

        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between pointer-events-none text-[10px] font-mono text-slate-400">
          <span>
            <strong className="text-amber-300">L</strong>=Fronte/Retro •{' '}
            <strong className="text-sky-300">W</strong>=Larghezza •{' '}
            <strong className="text-emerald-300">H</strong>=Altezza
          </span>
          <span>Trascina col mouse per ruotare</span>
        </div>
      </div>
    </div>
  );
};
