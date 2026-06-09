/**
 * C7 — Chaos engine DISABLED for production.
 * This file intentionally exports safe no-ops so that existing imports
 * in examCycles.js (getChaosState) continue to compile without errors,
 * but chaos injection is permanently disabled.
 */

export function getChaosState() {
  return { solverChaosMode: false };
}

export function setSolverChaosMode(_enabled) {
  // No-op: chaos injection is disabled in production
}

export function triggerChaos(_type, _enabled) {
  // No-op: chaos injection is disabled in production
  throw new Error('Chaos injection is not available in production.');
}
