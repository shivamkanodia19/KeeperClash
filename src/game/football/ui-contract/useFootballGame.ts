import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { advanceGameFrame } from '../gameFrame'
import { advanceDrive, createLiveStateAfterOpeningKickoff } from '../footballState'
import type { FootballGameState } from '../footballTypes'
import {
  createPlayAnimationCore,
  advanceResult,
  dive,
  idlePlayAnimationSnapshot,
  juke,
  moveBallCarrier,
  selectReceiver,
  setCarrierSteerInput,
  setPassTargetReceiver,
  setPlayerMoveVector,
  snap,
  switchActivePlayer,
  toPlayAnimationSnapshot,
} from '../playAnimation'
import type { PlayAnimationCore } from '../playAnimation'
import {
  FOOTBALL_DEFENSIVE_CALL_OPTIONS,
  FOOTBALL_PLAY_OPTIONS,
} from './catalog'
import type {
  FootballGameActions,
  FootballTeamSide,
  UseFootballGameResult,
} from './types'
import { toFootballGameViewState } from './viewState'

const DEFAULT_OFFENSE_ID = 'inside_zone'
const DEFAULT_DEFENSE_ID = 'cover_2_zone'

export type UseFootballGameOptions = {
  /** Team the human coaches; drives which picker is active. Default `home`. */
  userTeamId?: FootballTeamSide
  /**
   * When true, calls `startGame` once on mount so the sim matches prior “always running” demos.
   * When false (default), UI starts in `not_started` until `actions.startGame()`.
   */
  autoStart?: boolean
}

function isValidPlayId(id: string): boolean {
  return FOOTBALL_PLAY_OPTIONS.some((p) => p.id === id)
}

function isValidDefenseId(id: string): boolean {
  return FOOTBALL_DEFENSIVE_CALL_OPTIONS.some((d) => d.id === id)
}

function openingKickoffParams(userTeamId: FootballTeamSide) {
  return {
    receivingTeam: userTeamId === 'home' ? ('away' as const) : ('home' as const),
    userControlledTeam: userTeamId,
    openingKickIsHome: userTeamId === 'home',
  }
}

/**
 * Live hook: Milestone 2 engine behind the UI contract. UI should depend only on returned types, not on `advanceDrive` / resolver.
 */
export function useFootballGame(
  options: UseFootballGameOptions = {},
): UseFootballGameResult {
  const userTeamId = options.userTeamId ?? 'home'
  const autoStart = options.autoStart ?? false

  const initialEngine = autoStart
    ? createLiveStateAfterOpeningKickoff(openingKickoffParams(userTeamId))
    : null
  const [hasSession, setHasSession] = useState(() => autoStart)
  const [engine, setEngine] = useState<FootballGameState | null>(() => initialEngine)
  const [animCore, setAnimCore] = useState<PlayAnimationCore | null>(() =>
    initialEngine ? createPlayAnimationCore(initialEngine) : null,
  )
  const [lastPlaySummary, setLastPlaySummary] = useState<string | null>(null)
  const [offensePick, setOffensePick] = useState<string | null>(DEFAULT_OFFENSE_ID)
  const [defensePick, setDefensePick] = useState<string | null>(DEFAULT_DEFENSE_ID)
  const frameRef = useRef<number | null>(null)
  const lastFrameAtRef = useRef<number | null>(null)
  const engineRef = useRef<FootballGameState | null>(initialEngine)
  const animCoreRef = useRef<PlayAnimationCore | null>(
    initialEngine ? createPlayAnimationCore(initialEngine) : null,
  )

  useEffect(() => {
    engineRef.current = engine
  }, [engine])

  useEffect(() => {
    animCoreRef.current = animCore
  }, [animCore])

  const frameActive =
    Boolean(hasSession && engine && animCore && !engine.gameOver) &&
    engine?.sessionPhase === 'play_calling' &&
    (animCore?.phase === 'preSnap' ||
      animCore?.phase === 'snap' ||
      animCore?.phase === 'playInProgress')

  useEffect(() => {
    if (!frameActive) {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      lastFrameAtRef.current = null
      return
    }

    lastFrameAtRef.current = performance.now()

    const tick = (now: number) => {
      const prev = lastFrameAtRef.current ?? now
      const dtMs = now - prev
      lastFrameAtRef.current = now

      const currentEngine = engineRef.current
      const currentCore = animCoreRef.current
      if (currentEngine) {
        const next = advanceGameFrame(currentEngine, currentCore, dtMs)
        engineRef.current = next.engine
        animCoreRef.current = next.core
        setEngine(next.engine)
        setAnimCore(next.core)
      }

      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      lastFrameAtRef.current = null
    }
  }, [frameActive])

  const startGame = useCallback(() => {
    const e = createLiveStateAfterOpeningKickoff(openingKickoffParams(userTeamId))
    const c = createPlayAnimationCore(e)
    engineRef.current = e
    animCoreRef.current = c
    setEngine(e)
    setHasSession(true)
    setAnimCore(c)
    setLastPlaySummary(null)
    setOffensePick(DEFAULT_OFFENSE_ID)
    setDefensePick(DEFAULT_DEFENSE_ID)
  }, [userTeamId])

  const resetGame = useCallback(() => {
    const e = createLiveStateAfterOpeningKickoff(openingKickoffParams(userTeamId))
    const c = createPlayAnimationCore(e)
    engineRef.current = e
    animCoreRef.current = c
    setEngine(e)
    setHasSession(true)
    setAnimCore(c)
    setLastPlaySummary(null)
    setOffensePick(DEFAULT_OFFENSE_ID)
    setDefensePick(DEFAULT_DEFENSE_ID)
  }, [userTeamId])

  const setSelectedOffensivePlayId = useCallback((playId: string) => {
    if (!isValidPlayId(playId)) return
    setOffensePick(playId)
  }, [])

  const setSelectedDefensiveCallId = useCallback((callId: string) => {
    if (!isValidDefenseId(callId)) return
    setDefensePick(callId)
  }, [])

  const runPlay = useCallback(() => {
    if (!engine || !animCore || animCore.phase !== 'preSnap') return
    const offId = offensePick ?? DEFAULT_OFFENSE_ID
    const defId = defensePick ?? DEFAULT_DEFENSE_ID
    if (!isValidPlayId(offId) || !isValidDefenseId(defId)) return
    try {
      const { next, resolution } = advanceDrive(
        engine,
        engine.possession === 'home'
          ? { userOffensePlayId: offId }
          : { userDefenseCallId: defId },
        Math.random,
      )
      const c = createPlayAnimationCore(next)
      engineRef.current = next
      animCoreRef.current = c
      setEngine(next)
      setAnimCore(c)
      setLastPlaySummary(resolution.commentary)
    } catch {
      setLastPlaySummary('Play could not be resolved.')
    }
  }, [animCore, engine, defensePick, offensePick])

  const snapAction = useCallback(() => {
    if (!engine || !animCore) return
    const offId = offensePick ?? DEFAULT_OFFENSE_ID
    const defId = defensePick ?? DEFAULT_DEFENSE_ID
    if (!isValidPlayId(offId) || !isValidDefenseId(defId)) return
    const out = snap(animCore, engine, offId, defId)
    if (out) {
      animCoreRef.current = out.core
      setAnimCore(out.core)
    }
  }, [animCore, engine, defensePick, offensePick])

  const moveBallCarrierAction = useCallback(() => {
    if (!animCore) return
    const next = moveBallCarrier(animCore)
    if (next) {
      animCoreRef.current = next
      setAnimCore(next)
    }
  }, [animCore])

  const jukeAction = useCallback(() => {
    if (!animCore) return
    const next = juke(animCore)
    if (next) {
      animCoreRef.current = next
      setAnimCore(next)
    }
  }, [animCore])

  const diveAction = useCallback(() => {
    if (!animCore) return
    const next = dive(animCore)
    if (next) {
      animCoreRef.current = next
      setAnimCore(next)
    }
  }, [animCore])

  const selectReceiverAction = useCallback(() => {
    if (!animCore) return
    const next = selectReceiver(animCore)
    if (next) {
      animCoreRef.current = next
      setAnimCore(next)
    }
  }, [animCore])

  const setCarrierSteerInputAction = useCallback((steer: number) => {
    setAnimCore((c) => {
      const next = c ? setCarrierSteerInput(c, steer) : c
      animCoreRef.current = next
      return next
    })
  }, [])

  const setMoveVectorAction = useCallback((x: number, y: number) => {
    setAnimCore((c) => {
      const next = c ? setPlayerMoveVector(c, x, y) : c
      animCoreRef.current = next
      return next
    })
  }, [])

  const switchPlayerAction = useCallback((target?: string | number) => {
    setAnimCore((c) => {
      if (!c) return c
      const next = switchActivePlayer(c, target) ?? c
      animCoreRef.current = next
      return next
    })
  }, [])

  const setPassTargetReceiverAction = useCallback((receiverId: string) => {
    setAnimCore((c) => {
      if (!c) return c
      const n = setPassTargetReceiver(c, receiverId)
      const next = n ?? c
      animCoreRef.current = next
      return next
    })
  }, [])

  const primaryAction = useCallback(() => {
    diveAction()
  }, [diveAction])

  const secondaryAction = useCallback(() => {
    jukeAction()
  }, [jukeAction])

  const advanceResultAction = useCallback(() => {
    if (!animCore || !engine) return
    if (animCore.phase === 'tackleOrScore' && animCore.pendingNext) {
      const applied: FootballGameState = {
        ...animCore.pendingNext,
        quarter: engine.quarter,
        clockSeconds: engine.clockSeconds,
        gameOver: engine.gameOver,
        sessionPhase: engine.gameOver ? 'game_over' : animCore.pendingNext.sessionPhase,
        clockRunning: engine.gameOver ? false : animCore.pendingNext.clockRunning,
        clockMode: engine.gameOver ? 'stopped' : animCore.pendingNext.clockMode,
        lastClockEvent: engine.gameOver
          ? engine.lastClockEvent
          : animCore.pendingNext.lastClockEvent,
      }
      setEngine(applied)
      engineRef.current = applied
      setLastPlaySummary(animCore.pendingResolution?.commentary ?? null)
      const nu = advanceResult(animCore, applied)
      if (nu) {
        animCoreRef.current = nu
        setAnimCore(nu)
      }
      return
    }
    if (animCore.phase === 'result') {
      const nu = advanceResult(animCore, engine)
      if (nu) {
        animCoreRef.current = nu
        setAnimCore(nu)
      }
    }
  }, [animCore, engine])

  const view = useMemo(
    () =>
      toFootballGameViewState(engine, {
        userTeamId,
        hasSession,
        lastPlaySummary,
        playAnimationPhase: animCore?.phase ?? null,
      }),
    [animCore, engine, hasSession, lastPlaySummary, userTeamId],
  )

  const playAnimation = useMemo(() => {
    if (!hasSession || !engine || !animCore) return idlePlayAnimationSnapshot()
    return toPlayAnimationSnapshot(
      animCore,
      engine,
      userTeamId,
      offensePick,
      defensePick,
    )
  }, [animCore, defensePick, engine, hasSession, offensePick, userTeamId])

  const actions: FootballGameActions = useMemo(
    () => ({
      startGame,
      resetGame,
      setSelectedOffensivePlayId,
      setSelectedDefensiveCallId,
      runPlay,
      snap: snapAction,
      moveBallCarrier: moveBallCarrierAction,
      juke: jukeAction,
      dive: diveAction,
      selectReceiver: selectReceiverAction,
      advanceResult: advanceResultAction,
      setCarrierSteerInput: setCarrierSteerInputAction,
      setMoveVector: setMoveVectorAction,
      switchPlayer: switchPlayerAction,
      primaryAction,
      secondaryAction,
      throwTo: setPassTargetReceiverAction,
      setPassTargetReceiver: setPassTargetReceiverAction,
    }),
    [
      advanceResultAction,
      diveAction,
      jukeAction,
      moveBallCarrierAction,
      primaryAction,
      resetGame,
      runPlay,
      secondaryAction,
      selectReceiverAction,
      setCarrierSteerInputAction,
      setMoveVectorAction,
      setPassTargetReceiverAction,
      setSelectedDefensiveCallId,
      setSelectedOffensivePlayId,
      snapAction,
      startGame,
      switchPlayerAction,
    ],
  )

  return {
    state: view,
    playAnimation,
    playOptions: FOOTBALL_PLAY_OPTIONS,
    defensiveCallOptions: FOOTBALL_DEFENSIVE_CALL_OPTIONS,
    selectedOffensivePlayId: offensePick,
    selectedDefensiveCallId: defensePick,
    actions,
    source: 'live',
  }
}
