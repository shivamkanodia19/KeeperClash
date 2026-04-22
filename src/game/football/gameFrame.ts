import { applyRealtimeClock } from './footballState'
import type { FootballGameState, GameClockMode } from './footballTypes'
import { advancePlaySimulationFrame } from './playAnimation'
import type { PlayAnimationCore } from './playAnimation'

export type GameFrameResult = {
  engine: FootballGameState
  core: PlayAnimationCore | null
}

export function clockModeForFrame(
  engine: FootballGameState,
  core: PlayAnimationCore | null,
): GameClockMode {
  if (engine.gameOver || engine.sessionPhase !== 'play_calling') return 'stopped'
  if (!core) return 'stopped'
  if (core.phase === 'snap' || core.phase === 'playInProgress') return 'live'
  if (core.phase === 'preSnap') {
    return engine.clockRunning ? 'pre_snap_running' : 'pre_snap_stopped'
  }
  return 'stopped'
}

export function advanceGameFrame(
  engine: FootballGameState,
  core: PlayAnimationCore | null,
  dtMs: number,
): GameFrameResult {
  const dtSeconds = Math.min(0.25, Math.max(0, dtMs) / 1000)
  const clockMode = clockModeForFrame(engine, core)
  const nextEngine = applyRealtimeClock(engine, dtSeconds, clockMode)

  if (
    core?.world &&
    !nextEngine.gameOver &&
    (core.phase === 'snap' || core.phase === 'playInProgress')
  ) {
    return {
      engine: nextEngine,
      core: advancePlaySimulationFrame(core, dtMs) ?? core,
    }
  }

  return { engine: nextEngine, core }
}
