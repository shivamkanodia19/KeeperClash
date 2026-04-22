import { useCallback, useEffect, useRef, type MouseEvent } from 'react'
import { useFootballGameAdapter } from '../../game/football/ui-contract'

/** Minimal debug shell: consumes the public UI contract only (no direct engine imports). */
export default function FootballSim() {
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
    liveOptions: { autoStart: true, userTeamId: 'home' },
  })

  const fieldRef = useRef<SVGSVGElement | null>(null)

  const userOnOffense = state.possessionTeamId === state.userTeamId
  const steerLive =
    userOnOffense &&
    (playAnimation.phase === 'snap' || playAnimation.phase === 'playInProgress')

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!steerLive) return
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') actions.setCarrierSteerInput(-1)
      if (e.code === 'ArrowRight' || e.code === 'KeyD') actions.setCarrierSteerInput(1)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (!steerLive) return
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
        actions.setCarrierSteerInput(0)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [actions, steerLive])

  const onFieldClick = useCallback(
    (ev: MouseEvent<SVGSVGElement>) => {
      if (!playAnimation.legal.canSelectReceiver) return
      const el = fieldRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cam = playAnimation.cameraRecommendation
      const vw = cam.visibleXMax - cam.visibleXMin
      const vh = cam.visibleYMax - cam.visibleYMin
      const scrW = rect.width
      const scrH = rect.height
      const px = ev.clientX - rect.left
      const py = ev.clientY - rect.top
      const fx = cam.visibleXMin + (px / scrW) * vw
      const fy = cam.visibleYMin + ((scrH - py) / scrH) * vh
      const candidates = playAnimation.players.filter(
        (p) => p.unit === 'offense' && /wr|te|slot/i.test(p.id),
      )
      let best: (typeof candidates)[0] | null = null
      let bd = 2.8
      for (const c of candidates) {
        const d = Math.hypot(c.x - fx, c.y - fy)
        if (d < bd) {
          bd = d
          best = c
        }
      }
      if (best) actions.setPassTargetReceiver(best.id)
    },
    [actions, playAnimation.cameraRecommendation, playAnimation.legal.canSelectReceiver, playAnimation.players],
  )

  const possLabel = state.possessionTeamId === 'home' ? 'Home (you)' : 'Away (CPU O)'

  const hint =
    state.phase === 'not_started'
      ? 'Press Start game in a full UI; this demo uses autoStart.'
      : 'You are Home. When you have the ball, pick an offensive play. When Away has the ball, pick a defensive call, then Run Play.'

  const cam = playAnimation.cameraRecommendation
  const vw = Math.max(0.5, cam.visibleXMax - cam.visibleXMin)
  const vh = Math.max(0.5, cam.visibleYMax - cam.visibleYMin)
  const scrW = 580
  const scrH = Math.round(scrW * (vh / vw))
  const sx = (x: number) => ((x - cam.visibleXMin) / vw) * scrW
  const sy = (y: number) => scrH - ((y - cam.visibleYMin) / vh) * scrH
  const pr = (0.82 * scrW) / vw

  return (
    <main className="app-shell">
      <section className="hud">
        <h1>Keeper Clash — Football (sim)</h1>
        <p>
          Score: Home <strong>{state.homeScore}</strong> — Away{' '}
          <strong>{state.awayScore}</strong> | Q<strong>{state.quarter}</strong> |{' '}
          <strong>{Math.ceil(state.clockSeconds)}</strong>s | Possession:{' '}
          <strong>{possLabel}</strong>
        </p>
        <p>
          <strong>
            {state.down}&{state.yardsToGo}
          </strong>{' '}
          @ own <strong>{state.yardLine}</strong> yd line
          {state.gameOver ? ' | GAME OVER' : ''}
        </p>
        <p className="mode">
          Phase: <strong>{state.phase}</strong> | Contract: <strong>adapter/live</strong>
          {state.lastResultSummary ? (
            <>
              {' '}
              | Last: <strong>{state.lastResultSummary}</strong>
            </>
          ) : null}
        </p>
        <p className="mode">
          Animation: <strong>{playAnimation.phase}</strong> | players{' '}
          <strong>{playAnimation.players.length}</strong> | carrier{' '}
          <strong>{playAnimation.ball.carrierId ?? '—'}</strong>
          {playAnimation.ball.throwTargetId ? (
            <>
              {' '}
              | target <strong>{playAnimation.ball.throwTargetId}</strong>
            </>
          ) : null}
        </p>
        <p className="mode">{hint}</p>
        {steerLive ? (
          <p className="mode">
            <strong>Steer</strong>: hold ← / → or A / D while the play is live (offense). On pass plays,
            click a WR/TE dot to set the throw target.
          </p>
        ) : null}
      </section>

      {playAnimation.players.length > 0 ? (
        <section className="football-field-wrap" style={{ margin: '0 1rem' }}>
          <svg
            ref={fieldRef}
            role="img"
            aria-label="Play field"
            width={scrW}
            height={scrH}
            style={{
              background: '#0d3d1f',
              border: '2px solid #2a5c2a',
              display: 'block',
              cursor: playAnimation.legal.canSelectReceiver ? 'crosshair' : 'default',
            }}
            onClick={onFieldClick}
          >
            <rect
              x={0}
              y={0}
              width={scrW}
              height={scrH}
              fill="url(#grass)"
              opacity={0.35}
            />
            <defs>
              <pattern id="grass" width="8" height="8" patternUnits="userSpaceOnUse">
                <path d="M0 8 L8 0" stroke="#1a4d28" strokeWidth="1" />
              </pattern>
            </defs>
            <line
              x1={sx(playAnimation.lineOfScrimmageAtSnap)}
              y1={0}
              x2={sx(playAnimation.lineOfScrimmageAtSnap)}
              y2={scrH}
              stroke="#ffffff55"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
            {playAnimation.players.map((p) => {
              const ox = sx(p.x)
              const oy = sy(p.y)
              const isOff = p.unit === 'offense'
              const isTarget = p.id === playAnimation.ball.throwTargetId
              return (
                <circle
                  key={p.id}
                  cx={ox}
                  cy={oy}
                  r={pr * (isOff ? 1 : 0.92)}
                  fill={
                    isTarget
                      ? '#ffd54f'
                      : isOff
                        ? p.id === playAnimation.ball.carrierId
                          ? '#7ecbff'
                          : '#c8e6c9'
                        : '#ffcdd2'
                  }
                  stroke="#1118"
                  strokeWidth={1.5}
                />
              )
            })}
            <circle
              cx={sx(playAnimation.ball.x)}
              cy={sy(playAnimation.ball.y)}
              r={pr * 0.55}
              fill="#fff8e1"
              stroke="#333"
              strokeWidth={1.2}
            />
          </svg>
        </section>
      ) : null}

      <section className="football-panel">
        <div className="football-controls">
          <label>
            Offensive play (when Home has ball)
            <select
              value={selectedOffensivePlayId ?? ''}
              onChange={(e) => actions.setSelectedOffensivePlayId(e.target.value)}
              disabled={!state.interaction.canSelectOffensivePlay}
            >
              {playOptions.map((p) => (
                <option key={p.id} value={p.id} disabled={p.disabled}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Defensive call (when Away has ball)
            <select
              value={selectedDefensiveCallId ?? ''}
              onChange={(e) => actions.setSelectedDefensiveCallId(e.target.value)}
              disabled={!state.interaction.canSelectDefensiveCall}
            >
              {defensiveCallOptions.map((d) => (
                <option key={d.id} value={d.id} disabled={d.disabled}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <div className="football-actions">
            <button
              type="button"
              onClick={() => actions.runPlay()}
              disabled={!state.interaction.canCommitPlay || state.gameOver}
            >
              Run play (instant)
            </button>
            <button
              type="button"
              onClick={() => actions.snap()}
              disabled={!playAnimation.legal.canSnap || state.gameOver}
            >
              Snap
            </button>
            <button
              type="button"
              onClick={() => actions.moveBallCarrier()}
              disabled={!playAnimation.legal.canMoveBallCarrier || state.gameOver}
            >
              Move
            </button>
            <button
              type="button"
              onClick={() => actions.juke()}
              disabled={!playAnimation.legal.canJuke || state.gameOver}
            >
              Juke
            </button>
            <button
              type="button"
              onClick={() => actions.dive()}
              disabled={!playAnimation.legal.canDive || state.gameOver}
            >
              Dive
            </button>
            <button
              type="button"
              onClick={() => actions.selectReceiver()}
              disabled={!playAnimation.legal.canSelectReceiver || state.gameOver}
            >
              Receiver
            </button>
            <button
              type="button"
              onClick={() => actions.advanceResult()}
              disabled={!playAnimation.legal.canAdvanceResult || state.gameOver}
            >
              Advance result
            </button>
            <button type="button" onClick={() => actions.resetGame()}>
              New game
            </button>
          </div>
        </div>
        <p className="football-hint">
          Quarter length {state.quarterLengthSeconds}s (options {state.quarterLengthOptions.join(', ')}
          s). Opponent picks the other side of the matchup automatically.
        </p>
        <aside className="football-log">
          <strong>Play log</strong>
          <ul className="football-log-list">
            {state.recentPlays
              .slice()
              .reverse()
              .slice(0, 18)
              .map((line, idx) => (
                <li key={`${state.recentPlays.length - idx}-${line.slice(0, 32)}`}>
                  {line}
                </li>
              ))}
          </ul>
        </aside>
      </section>
    </main>
  )
}
