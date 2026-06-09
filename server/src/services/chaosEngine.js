import { setDbChaosMode } from '../db/database.js';
import { triggerKioskDisconnectStorm } from './socket.js';

let solverChaosModeEnabled = false;

export function getChaosState() {
  return {
    solverChaosMode: solverChaosModeEnabled
  };
}

export function setSolverChaosMode(enabled) {
  solverChaosModeEnabled = enabled;
  console.log(`⚠️ Solver Chaos Mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

export function triggerChaos(type, enabled = true) {
  switch (type) {
    case 'db_drop':
      setDbChaosMode(enabled);
      return { success: true, message: `Database chaos mode set to ${enabled}` };
    case 'solver_timeout':
      setSolverChaosMode(enabled);
      return { success: true, message: `Solver chaos mode set to ${enabled}` };
    case 'socket_storm':
      triggerKioskDisconnectStorm();
      return { success: true, message: 'Kiosk disconnect storm triggered' };
    default:
      throw new Error(`Unknown chaos injection type: ${type}`);
  }
}
