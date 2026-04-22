import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react'
import {
  useFootballGameAdapter,
  type DefensiveCallOption,
  type FootballGameViewState,
  type FootballTeamSide,
  type PlayAnimationSnapshot,
  type PlayerFieldPosition,
  type PlayOption,
} from '../../game/football/ui-contract'

type TeamMeta = {
  name: string
  abbr: string
  color: string
  trim: string
  note: string
}

const TEAM_OPTIONS = {
  home: [
    { name: 'Lovable Lions', abbr: 'LIO', color: '#2f8cff', trim: '#fff25d', note: 'Home blues' },
    { name: 'Pixel Panthers', abbr: 'PNT', color: '#8b5cf6', trim: '#fff25d', note: 'Purple speed' },
    { name: 'Cyber Sharks', abbr: 'SHK', color: '#09d5ff', trim: '#061014', note: 'Neon attack' },
  ],
  away: [
    { name: 'Vite Vipers', abbr: 'VIP', color: '#ff3d4f', trim: '#ffffff', note: 'Away reds' },
    { name: 'Retro Rockets', abbr: 'RKT', color: '#ff8a1f', trim: '#101010', note: 'Arcade orange' },
    { name: 'Neon Knights', abbr: 'KNT', color: '#f23fb4', trim: '#ffffff', note: 'Pink blitz' },
  ],
} satisfies Record<FootballTeamSide, TeamMeta[]>

type KickoffIntroState = {
  phase: 'lineup' | 'kick' | 'return' | 'tackle'
  kickingTeam: FootballTeamSide
  receivingTeam: FootballTeamSide
}

function otherSide(side: FootballTeamSide): FootballTeamSide {
  return side === 'home' ? 'away' : 'home'
}

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function ordinal(n: number): string {
  return ['1st', '2nd', '3rd', '4th'][n - 1] ?? `${n}th`
}

function ballSpot(state: FootballGameViewState): string {
  if (state.yardLine === 50) return '50'
  return state.yardLine < 50
    ? `Own ${state.yardLine}`
    : `Opp ${100 - state.yardLine}`
}

function roleLabel(p: PlayerFieldPosition): string {
  if (p.role) return p.role
  const key = p.id.slice(p.id.indexOf('_') + 1).toUpperCase()
  if (key.startsWith('WR')) return 'WR'
  if (key.startsWith('TE')) return 'TE'
  if (key.startsWith('RB') || key.startsWith('FB')) return 'RB'
  if (key.startsWith('QB')) return 'QB'
  if (key.startsWith('CB')) return 'CB'
  if (key === 'FS' || key === 'SS' || key.startsWith('S')) return 'S'
  if (key.includes('MIKE') || key.includes('SAM') || key.includes('WILL')) return 'LB'
  if (key.startsWith('DE') || key.startsWith('DT') || key.startsWith('DL')) return 'DL'
  return key.slice(0, 2)
}

function playerMotionClass(p: PlayerFieldPosition, phase: PlayAnimationSnapshot['phase']) {
  if (phase === 'tackleOrScore' && p.simPhase === 'tackled') return 'is-tackled'
  if (p.simPhase === 'blockEngaged') return 'is-blocking'
  const speed = Math.hypot(p.vx ?? 0, p.vy ?? 0)
  if (
    speed > 0.45 ||
    p.simPhase === 'routeRun' ||
    p.simPhase === 'coverageDrop' ||
    p.simPhase === 'pursueBall' ||
    p.simPhase === 'carryBall'
  ) {
    return 'is-running'
  }
  return 'is-idle'
}

function facingClass(p: PlayerFieldPosition) {
  if (typeof p.facingDeg === 'number') {
    return Math.cos((p.facingDeg * Math.PI) / 180) < 0 ? 'face-left' : 'face-right'
  }
  return (p.vx ?? 0) < 0 ? 'face-left' : 'face-right'
}

export default function FootballSim() {
  const [userTeamId, setUserTeamId] = useState<FootballTeamSide>('home')
  const [homeTeamIndex, setHomeTeamIndex] = useState(0)
  const [awayTeamIndex, setAwayTeamIndex] = useState(0)
  const [kickoffIntro, setKickoffIntro] = useState<KickoffIntroState | null>(null)
  const kickoffTimersRef = useRef<number[]>([])
  const [shake, setShake] = useState(false)
  const [flash, setFlash] = useState<'none' | 'good' | 'bad'>('none')
  const lastImpactRef = useRef<string | null>(null)
  const {
    state,
    playAnimation,
    playOptions,
    defensiveCallOptions,
    selectedOffensivePlayId,
    selectedDefensiveCallId,
    actions,
  } = useFootballGameAdapter({
    source: 'live',
    liveOptions: { autoStart: false, userTeamId },
  })
  const teams = useMemo(
    () => ({
      home: TEAM_OPTIONS.home[homeTeamIndex]!,
      away: TEAM_OPTIONS.away[awayTeamIndex]!,
    }),
    [awayTeamIndex, homeTeamIndex],
  )
  const actionsRef = useRef(actions)
  const heldKeysRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    actionsRef.current = actions
  }, [actions])

  useEffect(
    () => () => {
      kickoffTimersRef.current.forEach((timer) => window.clearTimeout(timer))
      kickoffTimersRef.current = []
    },
    [],
  )

  const startWithKickoff = useCallback(() => {
    kickoffTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    kickoffTimersRef.current = []
    const kickingTeam = userTeamId
    const receivingTeam = otherSide(userTeamId)
    setKickoffIntro({ phase: 'lineup', kickingTeam, receivingTeam })
    kickoffTimersRef.current = [
      window.setTimeout(
        () => setKickoffIntro({ phase: 'kick', kickingTeam, receivingTeam }),
        700,
      ),
      window.setTimeout(
        () => setKickoffIntro({ phase: 'return', kickingTeam, receivingTeam }),
        1450,
      ),
      window.setTimeout(
        () => setKickoffIntro({ phase: 'tackle', kickingTeam, receivingTeam }),
        2400,
      ),
      window.setTimeout(() => {
        setKickoffIntro(null)
        actionsRef.current.startGame()
      }, 3150),
    ]
  }, [userTeamId])

  const cycleTeam = useCallback((side: FootballTeamSide, direction: 1 | -1) => {
    const pool = TEAM_OPTIONS[side]
    if (side === 'home') {
      setHomeTeamIndex((index) => (index + direction + pool.length) % pool.length)
      return
    }
    setAwayTeamIndex((index) => (index + direction + pool.length) % pool.length)
  }, [])

  const userOnOffense = state.possessionTeamId === state.userTeamId
  const canSteer =
    userOnOffense &&
    (playAnimation.phase === 'snap' || playAnimation.phase === 'playInProgress') &&
    playAnimation.controlMode === 'offense'

  useEffect(() => {
    const held = heldKeysRef.current
    const emitMove = () => {
      const x = (held.has('arrowright') || held.has('d') ? 1 : 0) -
        (held.has('arrowleft') || held.has('a') ? 1 : 0)
      const y = (held.has('arrowdown') || held.has('s') ? 1 : 0) -
        (held.has('arrowup') || held.has('w') ? 1 : 0)
      actionsRef.current.setMoveVector(x, y)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (!canSteer) return
      const key = e.key.toLowerCase()
      if (
        key === 'arrowleft' ||
        key === 'arrowright' ||
        key === 'arrowup' ||
        key === 'arrowdown' ||
        key === 'a' ||
        key === 'd' ||
        key === 'w' ||
        key === 's'
      ) {
        e.preventDefault()
        held.add(key)
        emitMove()
      }
      if (key === 'j') {
        e.preventDefault()
        actionsRef.current.secondaryAction()
      }
      if (key === ' ' || key === 'k') {
        e.preventDefault()
        actionsRef.current.primaryAction()
      }
      if (key === 'r' || key === 'tab') {
        e.preventDefault()
        actionsRef.current.switchPlayer()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (!canSteer) return
      const key = e.key.toLowerCase()
      if (
        [
          'arrowleft',
          'arrowright',
          'arrowup',
          'arrowdown',
          'a',
          'd',
          'w',
          's',
        ].includes(key)
      ) {
        held.delete(key)
        emitMove()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      held.clear()
      actionsRef.current.setMoveVector(0, 0)
    }
  }, [canSteer])

  useEffect(() => {
    const key = `${state.lastResultSummary ?? ''}-${playAnimation.phase}`
    if (!state.lastResultSummary || key === lastImpactRef.current) return
    if (playAnimation.phase !== 'result' && playAnimation.phase !== 'tackleOrScore') return
    lastImpactRef.current = key
    const text = state.lastResultSummary.toLowerCase()
    const bad = /intercept|fumble|sack|loss|miss|turnover|incomplete/.test(text)
    const good = /touchdown|field goal|first down|gain|complete|\+\d/.test(text)
    if (!bad && !good) return
    const t0 = window.setTimeout(() => {
      setFlash(bad ? 'bad' : 'good')
      setShake(true)
    }, 0)
    const t1 = window.setTimeout(() => setShake(false), 360)
    const t2 = window.setTimeout(() => setFlash('none'), 360)
    return () => {
      window.clearTimeout(t0)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [playAnimation.phase, state.lastResultSummary])

  if (state.phase === 'not_started') {
    if (kickoffIntro) {
      return <KickoffIntro kickoff={kickoffIntro} teams={teams} />
    }
    return (
      <TitleAndTeamSelect
        selected={userTeamId}
        teams={teams}
        onSelected={setUserTeamId}
        onCycleTeam={cycleTeam}
        onStart={startWithKickoff}
      />
    )
  }

  return (
    <main
      className="gb-shell"
      style={{
        '--home': teams.home.color,
        '--home-trim': teams.home.trim,
        '--away': teams.away.color,
        '--away-trim': teams.away.trim,
      } as CSSProperties}
    >
      <Scoreboard state={state} teams={teams} />
      <section className={`gb-play-area ${shake ? 'screen-shake' : ''}`}>
        <Field
          state={state}
          animation={playAnimation}
          flash={flash}
          onReceiverTarget={actions.throwTo}
        />
        <PhaseBanner state={state} animation={playAnimation} />
        {state.lastResultSummary ? (
          <ResultBanner text={state.lastResultSummary} />
        ) : null}
      </section>
      <ControlDeck
        state={state}
        animation={playAnimation}
        playOptions={playOptions}
        defensiveCallOptions={defensiveCallOptions}
        selectedOffensivePlayId={selectedOffensivePlayId}
        selectedDefensiveCallId={selectedDefensiveCallId}
        onSelectOffense={actions.setSelectedOffensivePlayId}
        onSelectDefense={actions.setSelectedDefensiveCallId}
        onSnap={actions.snap}
        onAdvanceResult={actions.advanceResult}
        onReset={actions.resetGame}
        onMoveVector={actions.setMoveVector}
        onJuke={actions.secondaryAction}
        onDive={actions.primaryAction}
        onReceiver={() => actions.switchPlayer()}
      />
    </main>
  )
}

function KickoffIntro({
  kickoff,
  teams,
}: {
  kickoff: KickoffIntroState
  teams: Record<FootballTeamSide, TeamMeta>
}) {
  const dir = kickoff.kickingTeam === 'home' ? 1 : -1
  const ballXBase =
    kickoff.phase === 'lineup'
      ? 35
      : kickoff.phase === 'kick'
        ? 50
        : kickoff.phase === 'return'
          ? 70
          : 78
  const ballX = dir === 1 ? ballXBase : 100 - ballXBase
  const ballY =
    kickoff.phase === 'lineup'
      ? 50
      : kickoff.phase === 'kick'
        ? 27
        : kickoff.phase === 'return'
          ? 60
          : 62
  const returnerX =
    kickoff.phase === 'lineup' || kickoff.phase === 'kick'
      ? dir === 1
        ? 80
        : 20
      : kickoff.phase === 'return'
        ? dir === 1
          ? 65
          : 35
        : dir === 1
          ? 55
          : 45

  return (
    <main
      className="gb-kickoff crt-scanlines"
      style={{
        '--home': teams.home.color,
        '--home-trim': teams.home.trim,
        '--away': teams.away.color,
        '--away-trim': teams.away.trim,
      } as CSSProperties}
    >
      <header className="gb-kickoff__hud">
        <strong>Kickoff</strong>
        <span>
          {teams[kickoff.kickingTeam].abbr} kicks to{' '}
          {teams[kickoff.receivingTeam].abbr}
        </span>
      </header>
      <section className="gb-kickoff__field">
        <div className="gb-kickoff__endzone gb-kickoff__endzone--home">HOME</div>
        <div className="gb-kickoff__endzone gb-kickoff__endzone--away">AWAY</div>

        {Array.from({ length: 11 }).map((_, index) => {
          const x = (dir === 1 ? 30 : 70) + (index - 5) * 0.8
          const y = 18 + index * 6
          return (
            <KickoffPlayer
              key={`kick-${index}`}
              side={kickoff.kickingTeam}
              x={x}
              y={y}
              running={kickoff.phase !== 'lineup'}
              facing={dir === 1 ? 'right' : 'left'}
            />
          )
        })}

        {Array.from({ length: 10 }).map((_, index) => {
          const x = (dir === 1 ? 75 : 25) + (index - 5) * 0.5
          const y = 22 + index * 6
          return (
            <KickoffPlayer
              key={`recv-${index}`}
              side={kickoff.receivingTeam}
              x={x}
              y={y}
              running={kickoff.phase === 'return' || kickoff.phase === 'tackle'}
              facing={dir === 1 ? 'left' : 'right'}
            />
          )
        })}

        <KickoffPlayer
          side={kickoff.receivingTeam}
          x={returnerX}
          y={kickoff.phase === 'lineup' || kickoff.phase === 'kick' ? 50 : 60}
          running={kickoff.phase === 'return'}
          tackled={kickoff.phase === 'tackle'}
          hasBall={kickoff.phase === 'return' || kickoff.phase === 'tackle'}
          facing={dir === 1 ? 'left' : 'right'}
        />

        {kickoff.phase !== 'lineup' ? (
          <span
            className="gb-kickoff-ball"
            style={{
              left: `${ballX}%`,
              top: `${ballY}%`,
            }}
          />
        ) : null}

        <div className="gb-kickoff__banner">
          {kickoff.phase === 'lineup' && 'Lining up...'}
          {kickoff.phase === 'kick' && 'Kick!'}
          {kickoff.phase === 'return' && 'Return!'}
          {kickoff.phase === 'tackle' && 'Tackled!'}
        </div>
      </section>
      <footer className="gb-kickoff__footer">
        Get ready: {teams[kickoff.receivingTeam].abbr} ball at the 25
      </footer>
    </main>
  )
}

function KickoffPlayer({
  side,
  x,
  y,
  facing,
  running,
  tackled,
  hasBall,
}: {
  side: FootballTeamSide
  x: number
  y: number
  facing: 'left' | 'right'
  running?: boolean
  tackled?: boolean
  hasBall?: boolean
}) {
  return (
    <span
      className={`gb-kickoff-player ${side} ${facing === 'left' ? 'face-left' : 'face-right'} ${running ? 'is-running' : ''} ${tackled ? 'is-tackled' : ''}`}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <span className="gb-player__shadow" />
      <span className="gb-player__body">
        <span className="gb-player__helmet" />
        <span className="gb-player__torso" />
        <span className="gb-player__legs" />
        {hasBall ? <span className="gb-player__ball" /> : null}
      </span>
    </span>
  )
}

function TitleAndTeamSelect({
  selected,
  teams,
  onSelected,
  onCycleTeam,
  onStart,
}: {
  selected: FootballTeamSide
  teams: Record<FootballTeamSide, TeamMeta>
  onSelected: (side: FootballTeamSide) => void
  onCycleTeam: (side: FootballTeamSide, direction: 1 | -1) => void
  onStart: () => void
}) {
  return (
    <main
      className="gb-title"
      style={{
        '--home': teams.home.color,
        '--home-trim': teams.home.trim,
        '--away': teams.away.color,
        '--away-trim': teams.away.trim,
      } as CSSProperties}
    >
      <div className="gb-title__field" />
      <section className="gb-title__panel">
        <p className="gb-kicker">Insert Coin</p>
        <h1>
          Gridiron
          <span>Blitz</span>
        </h1>
        <p className="gb-subtitle">Retro arcade football. Real plays. Fast drives.</p>
        <div className="gb-team-select" aria-label="Team selection">
          {(['home', 'away'] as const).map((side) => (
            <div
              key={side}
              className={`gb-team-card ${selected === side ? 'is-selected' : ''}`}
            >
              <span
                className="gb-team-card__logo"
                style={{ background: teams[side].color, color: teams[side].trim }}
              >
                {teams[side].abbr}
              </span>
              <span>
                <strong>{teams[side].name}</strong>
                <small>{teams[side].note}</small>
              </span>
              <div className="gb-team-card__controls">
                <button
                  type="button"
                  onClick={() => onCycleTeam(side, -1)}
                  aria-label={`Previous ${side} team`}
                >
                  &lt;
                </button>
                <button
                  type="button"
                  onClick={() => onSelected(side)}
                  disabled={selected === side}
                >
                  {selected === side ? 'You' : 'Pick'}
                </button>
                <button
                  type="button"
                  onClick={() => onCycleTeam(side, 1)}
                  aria-label={`Next ${side} team`}
                >
                  &gt;
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="gb-start" onClick={onStart}>
          Press Start
        </button>
      </section>
    </main>
  )
}

function Scoreboard({
  state,
  teams,
}: {
  state: FootballGameViewState
  teams: Record<FootballTeamSide, TeamMeta>
}) {
  const possessionHome = state.possessionTeamId === 'home'
  return (
    <header className="gb-scoreboard" aria-label="Scoreboard">
      <TeamScore
        side="home"
        score={state.homeScore}
        hasBall={possessionHome}
        team={teams.home}
      />
      <div className="gb-scoreboard__middle">
        <div>
          <span>Qtr</span>
          <strong>Q{state.quarter}</strong>
        </div>
        <div>
          <span>Time</span>
          <strong>{formatClock(state.clockSeconds)}</strong>
        </div>
        <div>
          <span>Play</span>
          <strong>{Math.ceil(state.playClockSeconds).toString().padStart(2, '0')}</strong>
        </div>
        <div>
          <span>Down</span>
          <strong>
            {ordinal(state.down)} and {state.yardsToGo}
          </strong>
        </div>
        <div>
          <span>Ball</span>
          <strong>{ballSpot(state)}</strong>
        </div>
        <div>
          <span>Clock</span>
          <strong>{state.clockRunning ? 'Run' : 'Stop'}</strong>
        </div>
      </div>
      <TeamScore
        side="away"
        score={state.awayScore}
        hasBall={!possessionHome}
        team={teams.away}
      />
    </header>
  )
}

function TeamScore({
  side,
  score,
  hasBall,
  team,
}: {
  side: FootballTeamSide
  score: number
  hasBall: boolean
  team: TeamMeta
}) {
  return (
    <div className="gb-team-score">
      <span
        className="gb-team-score__logo"
        style={{ background: team.color, color: team.trim }}
      >
        {team.abbr}
      </span>
      <span>
        <small>{side}</small>
        <strong>{score.toString().padStart(2, '0')}</strong>
      </span>
      {hasBall ? <i aria-label="possession" /> : null}
    </div>
  )
}

function Field({
  state,
  animation,
  flash,
  onReceiverTarget,
}: {
  state: FootballGameViewState
  animation: PlayAnimationSnapshot
  flash: 'none' | 'good' | 'bad'
  onReceiverTarget: (receiverId: string) => void
}) {
  const fieldRef = useRef<HTMLDivElement | null>(null)
  const cam = animation.cameraRecommendation
  const vw = Math.max(0.01, cam.visibleXMax - cam.visibleXMin)
  const vh = Math.max(0.01, cam.visibleYMax - cam.visibleYMin)
  const xPct = useCallback(
    (x: number) => ((x - cam.visibleXMin) / vw) * 100,
    [cam.visibleXMin, vw],
  )
  const yPct = useCallback(
    (y: number) => ((y - cam.visibleYMin) / vh) * 100,
    [cam.visibleYMin, vh],
  )

  const yardTicks: number[] = []
  for (let i = 0; i <= 100; i += 5) {
    if (i >= cam.visibleXMin - 1 && i <= cam.visibleXMax + 1) {
      yardTicks.push(i)
    }
  }

  const receiverIds = useMemo(
    () =>
      animation.players
        .filter((p) => p.unit === 'offense' && /wr|slot|te/i.test(p.id))
        .map((p) => p.id),
    [animation.players],
  )

  const canChooseReceiver =
    state.possessionTeamId === state.userTeamId && animation.legal.canSelectReceiver

  return (
    <div className="gb-field-frame" ref={fieldRef}>
      <div className="gb-crowd" />
      <div className="gb-field" aria-label="Football field">
        {yardTicks.map((tick) => {
          const left = xPct(tick)
          const label = tick <= 50 ? tick : 100 - tick
          return (
            <div
              key={tick}
              className={`gb-yard-line ${tick % 10 === 0 ? 'is-major' : ''}`}
              style={{ left: `${left}%` }}
            >
              {tick % 10 === 0 && tick !== 0 && tick !== 100 ? (
                <>
                  <span className="top">{label}</span>
                  <span className="bottom">{label}</span>
                </>
              ) : null}
            </div>
          )
        })}

        <div className="gb-hash gb-hash--top" />
        <div className="gb-hash gb-hash--bottom" />
        <div
          className="gb-los"
          style={{ left: `${xPct(animation.lineOfScrimmageAtSnap)}%` }}
        />
        {animation.preSnapPreview?.firstDownX != null ? (
          <div
            className="gb-first-down"
            style={{ left: `${xPct(animation.preSnapPreview.firstDownX)}%` }}
          />
        ) : null}

        <PreviewSvg animation={animation} xPct={xPct} yPct={yPct} />

        {animation.passTrajectory ? (
          <PassArc
            animation={animation}
            xPct={xPct}
            yPct={yPct}
          />
        ) : null}

        {animation.players.map((player) => (
          <PlayerToken
            key={player.id}
            player={player}
            animation={animation}
            xPct={xPct}
            yPct={yPct}
            canTarget={canChooseReceiver && receiverIds.includes(player.id)}
            onTarget={() => onReceiverTarget(player.id)}
          />
        ))}

        <BallToken animation={animation} xPct={xPct} yPct={yPct} />

        {animation.playResultMarkers.map((marker, index) => (
          <div
            key={`${marker.kind}-${index}`}
            className={`gb-impact gb-impact--${marker.kind}`}
            style={{
              left: `${xPct(marker.position.x)}%`,
              top: `${yPct(marker.position.y)}%`,
            }}
          />
        ))}

        <div className="gb-field-marquee">
          {state.possessionTeamId === state.userTeamId
            ? 'Your offense'
            : 'Your defense'}{' '}
          | {animation.phase} | {animation.preSnapPreview?.labels.offense ?? 'Pick a play'}
          {animation.preSnapPreview?.labels.defense
            ? ` vs ${animation.preSnapPreview.labels.defense}`
            : ''}
        </div>
        {flash !== 'none' ? <div className={`gb-impact-flash gb-impact-flash--${flash}`} /> : null}
      </div>
    </div>
  )
}

function PhaseBanner({
  state,
  animation,
}: {
  state: FootballGameViewState
  animation: PlayAnimationSnapshot
}) {
  let label: string | null = null
  let tone: 'info' | 'good' | 'bad' | 'neutral' = 'info'

  if (animation.phase === 'preSnap') {
    label =
      state.possessionTeamId === state.userTeamId
        ? `Offense: ${animation.preSnapPreview?.labels.offense ?? 'pick a play'}`
        : `Defense: ${animation.preSnapPreview?.labels.defense ?? 'call the D'}`
  } else if (animation.phase === 'snap') {
    label = 'Hut! Hut!'
  } else if (animation.phase === 'playInProgress') {
    label = state.possessionTeamId === state.userTeamId ? 'Go!' : 'Ball is live'
  } else if (animation.phase === 'tackleOrScore') {
    label = 'Whistle'
    tone = 'neutral'
  } else if (animation.phase === 'result' && state.lastResultSummary) {
    const text = state.lastResultSummary.toLowerCase()
    label = state.lastResultSummary
    tone = /touchdown|field goal|first down|gain|complete|\+\d/.test(text)
      ? 'good'
      : /turnover|intercept|fumble|sack|loss|miss/.test(text)
        ? 'bad'
        : 'neutral'
  }

  if (!label) return null

  return (
    <div className={`gb-phase-banner gb-phase-banner--${tone}`} role="status">
      {label}
    </div>
  )
}

function PreviewSvg({
  animation,
  xPct,
  yPct,
}: {
  animation: PlayAnimationSnapshot
  xPct: (x: number) => number
  yPct: (y: number) => number
}) {
  const preview = animation.preSnapPreview
  if (!preview) return null
  const polylinePoints = (pts: readonly { x: number; y: number }[]) =>
    pts.map((p) => `${xPct(p.x)},${yPct(p.y)}`).join(' ')
  return (
    <svg className="gb-preview-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
      {preview.zoneHulls.map((zone) => (
        <polygon
          key={zone.id}
          points={polylinePoints(zone.corners)}
          className={`gb-zone gb-zone--${zone.depth}`}
        />
      ))}
      {preview.offensePolylines
        .filter((line) => line.kind !== 'los' && line.kind !== 'fd')
        .map((line) => (
          <polyline
            key={line.id}
            points={polylinePoints(line.points)}
            className={`gb-route gb-route--${line.kind}`}
          />
        ))}
      {preview.manEdges.map((edge) => (
        <polyline
          key={`${edge.defenderSlot}-${edge.to.x}-${edge.to.y}`}
          points={polylinePoints([edge.from, edge.to])}
          className="gb-route gb-route--man"
        />
      ))}
      {preview.blitzArrows.map((arrow) => (
        <polyline
          key={`${arrow.rusherSlot}-${arrow.to.x}-${arrow.to.y}`}
          points={polylinePoints([arrow.from, arrow.to])}
          className="gb-route gb-route--blitz"
        />
      ))}
      {preview.runFits.map((fit) => (
        <circle
          key={`${fit.gap}-${fit.position.x}-${fit.position.y}`}
          cx={xPct(fit.position.x)}
          cy={yPct(fit.position.y)}
          r="1.3"
          className="gb-run-fit"
        />
      ))}
    </svg>
  )
}

function PassArc({
  animation,
  xPct,
  yPct,
}: {
  animation: PlayAnimationSnapshot
  xPct: (x: number) => number
  yPct: (y: number) => number
}) {
  const pass = animation.passTrajectory
  if (!pass) return null
  const sx = xPct(pass.fromX)
  const sy = yPct(pass.fromY)
  const ex = xPct(pass.toX)
  const ey = yPct(pass.toY)
  const mx = (sx + ex) / 2
  const my = Math.min(sy, ey) - 14
  return (
    <svg className="gb-preview-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path d={`M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`} className="gb-pass-arc" />
    </svg>
  )
}

function PlayerToken({
  player,
  animation,
  xPct,
  yPct,
  canTarget,
  onTarget,
}: {
  player: PlayerFieldPosition
  animation: PlayAnimationSnapshot
  xPct: (x: number) => number
  yPct: (y: number) => number
  canTarget: boolean
  onTarget: () => void
}) {
  const hasBall = animation.ball.carrierId === player.id
  const isActive = animation.activePlayerId === player.id
  const side = player.teamId
  const role = roleLabel(player)
  const motion = playerMotionClass(player, animation.phase)
  const targetClass = canTarget ? 'can-target' : ''
  const marker = player.unit === 'offense' ? 'O' : 'D'

  return (
    <button
      type="button"
      className={`gb-player ${side} ${motion} ${facingClass(player)} ${hasBall ? 'has-ball' : ''} ${isActive ? 'is-active' : ''} ${targetClass}`}
      style={{
        left: `${xPct(player.x)}%`,
        top: `${yPct(player.y)}%`,
      }}
      onClick={canTarget ? onTarget : undefined}
      disabled={!canTarget}
      title={`${side} ${role}`}
    >
      <span className="gb-player__shadow" />
      <span className="gb-player__body">
        <span className="gb-player__helmet" />
        <span className="gb-player__torso">
          <small>{role}</small>
        </span>
        <span className="gb-player__legs" />
        {hasBall ? <span className="gb-player__ball" /> : null}
      </span>
      <span className="gb-player__unit">{marker}</span>
    </button>
  )
}

function BallToken({
  animation,
  xPct,
  yPct,
}: {
  animation: PlayAnimationSnapshot
  xPct: (x: number) => number
  yPct: (y: number) => number
}) {
  const carried = Boolean(animation.ball.carrierId)
  if (carried && animation.ball.mode !== 'thrown') return null
  return (
    <span
      className="gb-ball"
      style={{
        left: `${xPct(animation.ball.x)}%`,
        top: `${yPct(animation.ball.y)}%`,
        transform: `translate(-50%, -50%) translateY(${-(animation.ball.z ?? 0) * 8}px) rotate(-12deg)`,
      }}
    />
  )
}

function ControlDeck({
  state,
  animation,
  playOptions,
  defensiveCallOptions,
  selectedOffensivePlayId,
  selectedDefensiveCallId,
  onSelectOffense,
  onSelectDefense,
  onSnap,
  onAdvanceResult,
  onReset,
  onMoveVector,
  onJuke,
  onDive,
  onReceiver,
}: {
  state: FootballGameViewState
  animation: PlayAnimationSnapshot
  playOptions: readonly PlayOption[]
  defensiveCallOptions: readonly DefensiveCallOption[]
  selectedOffensivePlayId: string | null
  selectedDefensiveCallId: string | null
  onSelectOffense: (playId: string) => void
  onSelectDefense: (callId: string) => void
  onSnap: () => void
  onAdvanceResult: () => void
  onReset: () => void
  onMoveVector: (x: number, y: number) => void
  onJuke: () => void
  onDive: () => void
  onReceiver: () => void
}) {
  const userOnOffense = state.possessionTeamId === state.userTeamId
  const live =
    animation.phase === 'snap' || animation.phase === 'playInProgress'
  const canAdvance = animation.legal.canAdvanceResult

  if (live && userOnOffense) {
    return (
      <section className="gb-controls gb-controls--live">
        <DPad onMoveVector={onMoveVector} />
        <div className="gb-live-hint">
          <strong>{animation.legal.canSelectReceiver ? 'Target, move, throw' : 'Run the lane'}</strong>
          <span>WASD moves. R switches. J jukes. Space dives.</span>
          <small>Active: {animation.activePlayerId ?? 'none'}</small>
        </div>
        <div className="gb-action-cluster">
          <button type="button" onClick={onReceiver} disabled={!animation.legal.canSelectReceiver}>
            Receiver
          </button>
          <button type="button" onClick={onJuke} disabled={!animation.legal.canJuke}>
            Juke
          </button>
          <button type="button" onClick={onDive} disabled={!animation.legal.canDive}>
            Dive
          </button>
        </div>
      </section>
    )
  }

  if (live && !userOnOffense) {
    return (
      <section className="gb-controls gb-controls--watching">
        <strong>AI offense</strong>
        <span>
          Watching the play. Your call:{' '}
          {animation.selectedDefensiveCallId ?? selectedDefensiveCallId ?? 'defense'}
        </span>
      </section>
    )
  }

  if (canAdvance) {
    return (
      <section className="gb-controls gb-controls--result">
        <div>
          <strong>{animation.phase === 'tackleOrScore' ? 'Whistle' : 'Ready'}</strong>
          <span>{state.lastResultSummary ?? 'Apply the play result.'}</span>
        </div>
        <button type="button" className="gb-snap" onClick={onAdvanceResult}>
          {animation.phase === 'tackleOrScore' ? 'Apply Result' : 'Next Down'}
        </button>
      </section>
    )
  }

  return (
    <section className="gb-controls">
      {userOnOffense ? (
        <PlayPicker
          title="Offense"
          subtitle="Pick a real concept"
          options={playOptions.filter((p) => p.category !== 'special')}
          selectedId={selectedOffensivePlayId}
          onSelect={onSelectOffense}
          disabled={!state.interaction.canSelectOffensivePlay}
        />
      ) : (
        <PlayPicker
          title="Defense"
          subtitle="Call the shell"
          options={defensiveCallOptions}
          selectedId={selectedDefensiveCallId}
          onSelect={onSelectDefense}
          disabled={!state.interaction.canSelectDefensiveCall}
        />
      )}
      <div className="gb-snap-stack">
        <button
          type="button"
          className="gb-snap"
          onClick={onSnap}
          disabled={!animation.legal.canSnap || state.gameOver}
        >
          Snap
        </button>
        <button type="button" className="gb-reset" onClick={onReset}>
          Reset
        </button>
      </div>
    </section>
  )
}

function PlayPicker({
  title,
  subtitle,
  options,
  selectedId,
  onSelect,
  disabled,
}: {
  title: string
  subtitle: string
  options: readonly (PlayOption | DefensiveCallOption)[]
  selectedId: string | null
  onSelect: (id: string) => void
  disabled: boolean
}) {
  return (
    <div className="gb-picker">
      <header>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </header>
      <div className="gb-picker__grid">
        {options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            className={selectedId === option.id ? 'is-selected' : ''}
            disabled={disabled || option.disabled}
            onClick={() => onSelect(option.id)}
          >
            <small>{index + 1}</small>
            <span>{option.label}</span>
            {'category' in option ? <em>{option.category}</em> : null}
          </button>
        ))}
      </div>
    </div>
  )
}

function DPad({ onMoveVector }: { onMoveVector: (x: number, y: number) => void }) {
  const stop = useCallback(() => onMoveVector(0, 0), [onMoveVector])
  const press = useCallback(
    (x: number, y: number) => (event: PointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      onMoveVector(x, y)
    },
    [onMoveVector],
  )
  return (
    <div className="gb-dpad" aria-label="Active player movement">
      <button type="button" className="gb-dpad__up" onPointerDown={press(0, -1)} onPointerUp={stop} onPointerCancel={stop}>
        W
      </button>
      <button type="button" className="gb-dpad__left" onPointerDown={press(-1, 0)} onPointerUp={stop} onPointerCancel={stop}>
        A
      </button>
      <button type="button" className="gb-dpad__right" onPointerDown={press(1, 0)} onPointerUp={stop} onPointerCancel={stop}>
        D
      </button>
      <button type="button" className="gb-dpad__down" onPointerDown={press(0, 1)} onPointerUp={stop} onPointerCancel={stop}>
        S
      </button>
    </div>
  )
}

function ResultBanner({ text }: { text: string }) {
  return (
    <div className="gb-result-banner" role="status">
      {text}
    </div>
  )
}
