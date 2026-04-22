import type { FootballGameState, GameSessionPhase } from './footballTypes'
import type { PlayAnimationLegalActions, PlayAnimationPhase } from './playAnimation/types'

/**
 * Unified lifecycle phases for HUD / routing (combines session + animation micro-state).
 */
export type GameFlowPhase =
  | 'teamSelect'
  | 'kickoff'
  | 'playSelect'
  | 'preSnap'
  | 'snap'
  | 'playInProgress'
  | 'tackleOrScore'
  | 'result'
  | 'quarterTransition'
  | 'gameOver'

export function deriveGameFlowPhase(
  engine: FootballGameState | null,
  hasSession: boolean,
  animPhase: PlayAnimationPhase | null,
  legal: PlayAnimationLegalActions | null,
  /** True immediately after a play consumed clock that rolled the quarter (arcade banner). */
  quarterJustAdvanced: boolean,
): GameFlowPhase {
  if (!hasSession || !engine) return 'teamSelect'
  if (engine.gameOver) return 'gameOver'
  if (quarterJustAdvanced) return 'quarterTransition'
  const sess = engine.sessionPhase as GameSessionPhase
  if (sess === 'team_selection') return 'teamSelect'
  if (sess === 'kickoff') return 'kickoff'
  if (sess === 'game_over') return 'gameOver'
  const pick =
    Boolean(legal?.canSelectOffensivePlay || legal?.canSelectDefensiveCall)
  if (sess === 'play_calling' && (animPhase === 'preSnap' || !animPhase) && pick) {
    return 'playSelect'
  }
  if (sess === 'play_calling' && (animPhase === 'preSnap' || !animPhase)) {
    return 'preSnap'
  }
  if (animPhase === 'snap') return 'snap'
  if (animPhase === 'playInProgress') return 'playInProgress'
  if (animPhase === 'tackleOrScore') return 'tackleOrScore'
  if (animPhase === 'result') return 'result'
  return 'playSelect'
}
