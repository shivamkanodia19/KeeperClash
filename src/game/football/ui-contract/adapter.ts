import { useMemo } from 'react'
import type { UseFootballGameOptions } from './useFootballGame'
import { useFootballGame } from './useFootballGame'
import { useFootballGameStub } from './useFootballGameStub'
import type { UseFootballGameResult } from './types'

/**
 * Stable UI adapter contract for football integration.
 * UI layers should consume this shape and avoid direct engine imports.
 */
export type FootballUiAdapter = Pick<
  UseFootballGameResult,
  | 'state'
  | 'playAnimation'
  | 'playOptions'
  | 'defensiveCallOptions'
  | 'selectedOffensivePlayId'
  | 'selectedDefensiveCallId'
  | 'actions'
>

export type FootballUiAdapterSource = 'live' | 'stub'

/**
 * Single equivalent adapter for UI: choose live engine or stub data.
 * This keeps UI surface stable even if internals change.
 */
export function useFootballGameAdapter(opts?: {
  source?: FootballUiAdapterSource
  liveOptions?: UseFootballGameOptions
}): FootballUiAdapter {
  const live = useFootballGame(opts?.liveOptions)
  const stub = useFootballGameStub()
  const source = opts?.source ?? 'live'

  return useMemo(() => {
    const selected = source === 'stub' ? stub : live
    return {
      state: selected.state,
      playAnimation: selected.playAnimation,
      playOptions: selected.playOptions,
      defensiveCallOptions: selected.defensiveCallOptions,
      selectedOffensivePlayId: selected.selectedOffensivePlayId,
      selectedDefensiveCallId: selected.selectedDefensiveCallId,
      actions: selected.actions,
    }
  }, [live, source, stub])
}
