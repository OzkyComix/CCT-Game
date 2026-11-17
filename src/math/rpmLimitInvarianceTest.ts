import assert from 'node:assert/strict';
import {
  calculateMaxSafeMechanicalRpm,
  simulatePistonEngineDyno,
  type PistonEngineConfigInput,
} from './engineMath';
import { HISTORICAL_BENCHMARKS } from './historicalEngineBenchmark';

function assertRpmLimitInvariance(
  label: string,
  baseConfig: PistonEngineConfigInput,
  lowLimitRpm: number,
  highLimitRpm: number,
  expectSamePeakPower = true,
): void {
  const maxSafe = calculateMaxSafeMechanicalRpm(baseConfig);
  const simLow = simulatePistonEngineDyno({ ...baseConfig, manualRedlineRpm: lowLimitRpm });
  const simHigh = simulatePistonEngineDyno({ ...baseConfig, manualRedlineRpm: highLimitRpm });

  const overlapEnd = Math.min(simLow.redlineRpm, simHigh.redlineRpm);
  assert.ok(
    simHigh.redlineRpm > simLow.redlineRpm,
    `${label}: expected high redline (${simHigh.redlineRpm}) > low redline (${simLow.redlineRpm}), maxSafe=${maxSafe}`,
  );

  let maxTorqueDiff = 0;
  let maxPowerDiff = 0;
  let maxBmepDiff = 0;
  for (const pLow of simLow.curve) {
    if (pLow.rpm > overlapEnd) continue;
    const pHigh = simHigh.curve.find((p) => p.rpm === pLow.rpm);
    assert.ok(pHigh, `${label}: missing rpm ${pLow.rpm} in high-limit curve`);
    maxTorqueDiff = Math.max(maxTorqueDiff, Math.abs(pLow.torqueNm - pHigh.torqueNm));
    maxPowerDiff = Math.max(maxPowerDiff, Math.abs(pLow.powerHp - pHigh.powerHp));
    maxBmepDiff = Math.max(maxBmepDiff, Math.abs((pLow.bmepBar ?? 0) - (pHigh.bmepBar ?? 0)));
  }

  assert.equal(maxTorqueDiff, 0, `${label}: torqueNm changed when rpmLimit changed!`);
  assert.equal(maxPowerDiff, 0, `${label}: powerHp changed when rpmLimit changed!`);
  assert.equal(maxBmepDiff, 0, `${label}: bmepBar changed when rpmLimit changed!`);

  assert.ok(
    simHigh.reliabilityPercent <= simLow.reliabilityPercent,
    `${label}: expected reliabilityPercent at ${simHigh.redlineRpm} (${simHigh.reliabilityPercent}%) <= reliability at ${simLow.redlineRpm} (${simLow.reliabilityPercent}%)`,
  );

  if (expectSamePeakPower) {
    assert.equal(
      simHigh.peakPowerHp,
      simLow.peakPowerHp,
      `${label}: peakPowerHp jumped from ${simLow.peakPowerHp} HP @ ${simLow.peakPowerRpm} to ${simHigh.peakPowerHp} HP @ ${simHigh.peakPowerRpm} when raising rpmLimit!`,
    );
  }

  console.log(
    `[OK] ${label.padEnd(36)} | ${simLow.redlineRpm} vs ${simHigh.redlineRpm} rpm | maxΔNm=${maxTorqueDiff}, maxΔHP=${maxPowerDiff} | pkP: ${simLow.peakPowerHp}HP@${simLow.peakPowerRpm} vs ${simHigh.peakPowerHp}HP@${simHigh.peakPowerRpm} | Rel: ${simLow.reliabilityPercent}% -> ${simHigh.reliabilityPercent}%`,
  );
}

export function runRpmLimitInvarianceTests(): void {
  // 1. Test principale Sport N/A ad alti giri: 8.800 vs 11.400 rpm a parità di componenti
  const lfaBenchmark = HISTORICAL_BENCHMARKS.find((b) => b.name.includes('F458') || b.name.includes('12Cilindri') || b.name.includes('S2000'));
  assert.ok(lfaBenchmark, 'Expected Sport N/A benchmark');

  const highRevSportNa: PistonEngineConfigInput = {
    ...lfaBenchmark.config,
    boreMm: 88,
    strokeMm: 62,
    cylinders: 8,
    conrodTypeId: 'rod-titanium-cnc',
    pistonTypeId: 'pst-al-li-racing',
    crankshaftTypeId: 'crk-flatplane-billet',
    blockMaterialId: 'blk-alu-forged-nikasil',
    headMaterialId: 'hd-alu-t6',
    camshaftTypeId: 'cam-dohc-vvl',
    intakeSystemId: 'int-itb-carbon',
    exhaustManifoldId: 'exh-inconel',
    fuelSystemId: 'fs-mpi-electronic',
    fuelType: 'Benzina',
  };
  assertRpmLimitInvariance('Sport N/A ITB V8 62mm (8800 vs 11400)', highRevSportNa, 8800, 11400, false);
  assertRpmLimitInvariance('Sport N/A ITB V8 62mm (10500 vs 12500)', highRevSportNa, 10500, 12500, true);

  // Also test the exact S2000 F20C config boosted with Ti/Al-Li to check 8800 vs 11400 and 9500 vs 11400
  const s2kBenchmark = HISTORICAL_BENCHMARKS.find((b) => b.name.includes('Honda S2000'))!;
  const s2kForged: PistonEngineConfigInput = {
    ...s2kBenchmark.config,
    conrodTypeId: 'rod-titanium-cnc',
    pistonTypeId: 'pst-al-li-racing',
    crankshaftTypeId: 'crk-flatplane-billet',
  };
  assertRpmLimitInvariance('Honda S2000 Forged (8800 vs 11400)', s2kForged, 8800, 11400, false);
  assertRpmLimitInvariance('Honda S2000 Forged (9500 vs 11400)', s2kForged, 9500, 11400, true);

  // 2. Test Sport Turbo (2.0L M139 Forged: picco a 6900 rpm)
  const m139Benchmark = HISTORICAL_BENCHMARKS.find((b) => b.name.includes('A45 S'))!;
  const m139Forged: PistonEngineConfigInput = {
    ...m139Benchmark.config,
    conrodTypeId: 'rod-titanium-cnc',
    pistonTypeId: 'pst-al-li-racing',
  };
  assertRpmLimitInvariance('Sport Turbo GDI (6500 vs 8500)', m139Forged, 6500, 8500, false);
  assertRpmLimitInvariance('Sport Turbo GDI (7200 vs 9200)', m139Forged, 7200, 9200, true);

  // 3. Test Corsa Turbo (Ferrari F40 / DTM)
  const f40Benchmark = HISTORICAL_BENCHMARKS.find((b) => b.name.includes('Ferrari F40'))!;
  assertRpmLimitInvariance(
    'Corsa TwinTurbo F40 (7200 vs 9200)',
    {
      ...f40Benchmark.config,
      conrodTypeId: 'rod-titanium-cnc',
      pistonTypeId: 'pst-al-li-racing',
    },
    7200,
    9200,
    true,
  );

  // 4. Test Corsa N/A F1 (Cosworth DFV)
  const dfvBenchmark = HISTORICAL_BENCHMARKS.find((b) => b.name.includes('Cosworth DFV'))!;
  assertRpmLimitInvariance(
    'Corsa N/A DFV (9500 vs 11800)',
    dfvBenchmark.config,
    9500,
    11800,
    false,
  );

  // 5. Test Normale Stradale N/A (BMW 320i E36)
  const bmw320iBenchmark = HISTORICAL_BENCHMARKS.find((b) => b.name.includes('320i E36'))!;
  assertRpmLimitInvariance(
    'Normale N/A 320i E36 (5800 vs 7200)',
    bmw320iBenchmark.config,
    5800,
    7200,
    false,
  );

  // 6. Test Diesel VGT / Common Rail (da HISTORICAL_BENCHMARKS)
  const dieselBenchmark = HISTORICAL_BENCHMARKS.find((b) => b.config.fuelType === 'Diesel')!;
  assertRpmLimitInvariance(
    `Diesel ${dieselBenchmark.name.slice(0, 18)} (4000 vs 5200)`,
    {
      ...dieselBenchmark.config,
      conrodTypeId: 'rod-titanium-cnc',
      pistonTypeId: 'pst-al-li-racing',
    },
    4000,
    5200,
    true,
  );

  // 7. Verifica curvatura organica sul plateau turbo (nessun righello piatto costante) e assenza di spigoli C0
  const simM139 = simulatePistonEngineDyno(m139Benchmark.config);
  const plateauPts = simM139.curve.filter((p) => p.rpm >= 2600 && p.rpm <= 4800);
  const uniquePlateauTorques = new Set(plateauPts.map((p) => p.torqueNm));
  assert.ok(
    uniquePlateauTorques.size >= 4,
    `Expected organic turbo plateau variation, got only ${uniquePlateauTorques.size} distinct values`,
  );

  let maxSecondDiffRatio = 0;
  for (let i = 1; i < simM139.curve.length - 1; i++) {
    const prev = simM139.curve[i - 1].torqueNm;
    const curr = simM139.curve[i].torqueNm;
    const next = simM139.curve[i + 1].torqueNm;
    if (simM139.curve[i].rpm >= 3000) {
      const d2 = Math.abs(next - 2 * curr + prev);
      maxSecondDiffRatio = Math.max(maxSecondDiffRatio, d2 / simM139.peakTorqueNm);
    }
  }
  assert.ok(
    maxSecondDiffRatio < 0.025,
    `Expected C1 smooth post-spool curve, max |Δ²T|/Tpeak = ${maxSecondDiffRatio.toFixed(4)}`,
  );
  console.log(
    `[OK] Smoothness & Organic Turbo Crown  | distinct plateau Nm=${uniquePlateauTorques.size} | max post-spool |Δ²T|/Tpeak=${(maxSecondDiffRatio * 100).toFixed(2)}%`,
  );
}

runRpmLimitInvarianceTests();
