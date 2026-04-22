import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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

const TEAM_META = {
  home: {
    name: 'Blue Comets',
    abbr: 'COM',
    color: '#2f8cff',
    trim: '#fff25d',
  },
  away: {
    name: 'Red Vipers',
    abbr: 'VIP',
    color: '#ff3d4f',
    trim: '#ffffff',
  },
} satisfies Record<FootballTeamSide, {
  name: string
  abbr: string
  color: string
  trim: string
}>

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

  const userOnOffense = state.possessionTeamId === state.userTeamId
  const canSteer =
    userOnOffense &&
    (playAnimation.phase === 'snap' || playAnimation.phase === 'playInProgress') &&
    playAnimation.legal.canMoveBallCarrier

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!canSteer) return
      const key = e.key.toLowerCase()
      if (key === 'arrowleft' || key === 'a') {
        e.preventDefault()
        actions.setCarrierSteerInput(-1)
      }
      if (key === 'arrowright' || key === 'd') {
        e.preventDefault()
        actions.setCarrierSteerInput(1)
      }
      if (key === 'j') {
        e.preventDefault()
        actions.juke()
      }
      if (key === ' ' || key === 'k') {
        e.preventDefault()
        actions.dive()
      }
      if (key === 'r') {
        e.preventDefault()
        actions.selectReceiver()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (!canSteer) return
      if (['arrowleft', 'arrowright', 'a', 'd'].includes(e.key.toLowerCase())) {
        actions.setCarrierSteerInput(0)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [actions, canSteer])

  if (state.phase === 'not_started') {
    return (
      <TitleAndTeamSelect
        selected={userTeamId}
        onSelected={setUserTeamId}
        onStart={actions.startGame}
      />
    )
  }

  return (
    <main className="gb-shell">
      <Scoreboard state={state} />
      <section className="gb-play-area">
        <Field
          state={state}
          animation={playAnimation}
          onReceiverTarget={actions.setPassTargetReceiver}
        />
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
        onSteer={actions.setCarrierSteerInput}
        onJuke={actions.juke}
        onDive={actions.dive}
        onReceiver={actions.selectReceiver}
      />
    </main>
  )
}

function TitleAndTeamSelect({
  selected,
  onSelected,
  onStart,
}: {
  selected: FootballTeamSide
  onSelected: (side: FootballTeamSide) => void
  onStart: () => void
}) {
  return (
    <main className="gb-title">
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
            <button
              key={side}
              type="button"
              className={`gb-team-card ${selected === side ? 'is-selected' : ''}`}
              onClick={() => onSelected(side)}
            >
              <span
                className="gb-team-card__logo"
                style={{ background: TEAM_META[side].color, color: TEAM_META[side].trim }}
              >
                {TEAM_META[side].abbr}
              </span>
              <span>
                <strong>{TEAM_META[side].name}</strong>
                <small>{side === 'home' ? 'Home blues' : 'Away reds'}</small>
              </span>
            </button>
          ))}
        </div>
        <button type="button" className="gb-start" onClick={onStart}>
          Press Start
        </button>
      </section>
    </main>
  )
}

function Scoreboard({ state }: { state: FootballGameViewState }) {
  const possessionHome = state.possessionTeamId === 'home'
  return (
    <header className="gb-scoreboard" aria-label="Scoreboard">
      <TeamScore side="home" score={state.homeScore} hasBall={possessionHome} />
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
          <span>Down</span>
          <strong>
            {ordinal(state.down)} and {state.yardsToGo}
          </strong>
        </div>
        <div>
          <span>Ball</span>
          <strong>{ballSpot(state)}</strong>
        </div>
      </div>
      <TeamScore side="away" score={state.awayScore} hasBall={!possessionHome} />
    </header>
  )
}

function TeamScore({
  side,
  score,
  hasBall,
}: {
  side: FootballTeamSide
  score: number
  hasBall: boolean
}) {
  const meta = TEAM_META[side]
  return (
    <div className="gb-team-score">
      <span
        className="gb-team-score__logo"
        style={{ background: meta.color, color: meta.trim }}
      >
        {meta.abbr}
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
  onReceiverTarget,
}: {
  state: FootballGameViewState
  animation: PlayAnimationSnapshot
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
      </div>
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
  const side = player.teamId
  const role = roleLabel(player)
  const motion = playerMotionClass(player, animation.phase)
  const targetClass = canTarget ? 'can-target' : ''
  const marker = player.unit === 'offense' ? 'O' : 'D'

  return (
    <button
      type="button"
      className={`gb-player ${side} ${motion} ${facingClass(player)} ${hasBall ? 'has-ball' : ''} ${targetClass}`}
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
  onSteer,
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
  onSteer: (steer: number) => void
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
        <DPad onSteer={onSteer} />
        <div className="gb-live-hint">
          <strong>{animation.legal.canSelectReceiver ? 'Tap receiver or cycle target' : 'Run the lane'}</strong>
          <span>A/D or arrows steer. J jukes. Space dives.</span>
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

function DPad({ onSteer }: { onSteer: (steer: number) => void }) {
  const stop = useCallback(() => onSteer(0), [onSteer])
  const press = useCallback(
    (steer: number) => (event: PointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      onSteer(steer)
    },
    [onSteer],
  )
  return (
    <div className="gb-dpad" aria-label="Ball carrier steering">
      <button type="button" onPointerDown={press(-1)} onPointerUp={stop} onPointerCancel={stop}>
        Left
      </button>
      <button type="button" onPointerDown={press(1)} onPointerUp={stop} onPointerCancel={stop}>
        Right
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
