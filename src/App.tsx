import { useEffect, useRef, useState } from 'react'
import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'

type Ball = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  spawnedAt: number
}

type Blocker = {
  x: number
  y: number
  radius: number
}

type MatchStats = {
  saves: number
  goalsAllowed: number
  streak: number
  bestStreak: number
  avgReactionMs: number
}

const MATCH_SECONDS = 60
const CANVAS_WIDTH = 960
const CANVAS_HEIGHT = 540
const GOAL = { x: 260, y: 24, width: 440, height: 130 }

const createInitialStats = (): MatchStats => ({
  saves: 0,
  goalsAllowed: 0,
  streak: 0,
  bestStreak: 0,
  avgReactionMs: 0,
})

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  const lastTimeRef = useRef(0)
  const shotCooldownRef = useRef(0)
  const nextBallIdRef = useRef(1)
  const ballsRef = useRef<Ball[]>([])
  const blockersRef = useRef<Blocker[]>([])
  const reactionSamplesRef = useRef<number[]>([])
  const hudAccumulatorRef = useRef(0)

  const [timeLeft, setTimeLeft] = useState(MATCH_SECONDS)
  const [stats, setStats] = useState<MatchStats>(createInitialStats)
  const [isReady, setIsReady] = useState(false)
  const [isMatchOver, setIsMatchOver] = useState(false)
  const [cameraError, setCameraError] = useState<string>('')
  const [trackingMode, setTrackingMode] = useState<'mediapipe' | 'fallback'>(
    'fallback',
  )

  useEffect(() => {
    let mounted = true

    const start = async () => {
      const video = videoRef.current
      if (!video) return

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
            frameRate: { ideal: 60, max: 60 },
          },
          audio: false,
        })
        streamRef.current = stream
        video.srcObject = stream
        await video.play()
      } catch {
        if (mounted) {
          setCameraError('Webcam access was denied. Please allow camera and reload.')
        }
        return
      }

      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
        )
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.4,
            minTrackingConfidence: 0.4,
          },
        )
        if (mounted) {
          setTrackingMode('mediapipe')
        }
      } catch {
        if (mounted) {
          setTrackingMode('fallback')
        }
      }

      if (!mounted) return
      setIsReady(true)
      startLoop()
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (trackingMode === 'mediapipe') return
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH
      const y = ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT
      blockersRef.current = [
        {
          x: Math.max(0, Math.min(CANVAS_WIDTH, x)),
          y: Math.max(0, Math.min(CANVAS_HEIGHT, y)),
          radius: 48,
        },
      ]
    }

    window.addEventListener('pointermove', handlePointerMove)
    void start()

    return () => {
      mounted = false
      window.removeEventListener('pointermove', handlePointerMove)
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      handLandmarkerRef.current?.close()
    }
  }, [trackingMode])

  const resetMatch = () => {
    ballsRef.current = []
    blockersRef.current = []
    reactionSamplesRef.current = []
    shotCooldownRef.current = 0
    nextBallIdRef.current = 1
    hudAccumulatorRef.current = 0
    lastTimeRef.current = 0
    setStats(createInitialStats())
    setTimeLeft(MATCH_SECONDS)
    setIsMatchOver(false)
    if (isReady) {
      startLoop()
    }
  }

  const startLoop = () => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current)
    }
    const loop = (now: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = now
      }
      const deltaSeconds = Math.min((now - lastTimeRef.current) / 1000, 0.04)
      lastTimeRef.current = now
      updateGame(now, deltaSeconds)
      renderGame()
      if (!isMatchOver) {
        animationRef.current = requestAnimationFrame(loop)
      }
    }
    animationRef.current = requestAnimationFrame(loop)
  }

  const updateBlockersFromMediaPipe = (now: number) => {
    const video = videoRef.current
    const handLandmarker = handLandmarkerRef.current
    if (!video || !handLandmarker) return
    const result = handLandmarker.detectForVideo(video, now)
    if (!result.landmarks.length) {
      blockersRef.current = []
      return
    }
    blockersRef.current = result.landmarks.map((landmarks) =>
      handToBlocker(landmarks),
    )
  }

  const handToBlocker = (landmarks: NormalizedLandmark[]): Blocker => {
    const center = landmarks.reduce(
      (acc, point) => {
        acc.x += point.x
        acc.y += point.y
        return acc
      },
      { x: 0, y: 0 },
    )
    center.x /= landmarks.length
    center.y /= landmarks.length

    const wrist = landmarks[0]
    const middleMcp = landmarks[9]
    const span = Math.hypot(wrist.x - middleMcp.x, wrist.y - middleMcp.y)
    const radius = Math.max(28, Math.min(70, span * CANVAS_WIDTH * 1.7))

    return {
      x: (1 - center.x) * CANVAS_WIDTH,
      y: center.y * CANVAS_HEIGHT,
      radius,
    }
  }

  const spawnBall = (now: number) => {
    const targetX = GOAL.x + 24 + Math.random() * (GOAL.width - 48)
    const targetY = GOAL.y + 18 + Math.random() * (GOAL.height - 30)
    const originX = CANVAS_WIDTH * 0.5 + (Math.random() * 90 - 45)
    const originY = CANVAS_HEIGHT - 60
    const speed = 380 + Math.random() * 120
    const dx = targetX - originX
    const dy = targetY - originY
    const distance = Math.max(1, Math.hypot(dx, dy))
    ballsRef.current.push({
      id: nextBallIdRef.current++,
      x: originX,
      y: originY,
      vx: (dx / distance) * speed,
      vy: (dy / distance) * speed,
      radius: 15,
      spawnedAt: now,
    })
  }

  const updateGame = (now: number, deltaSeconds: number) => {
    if (isMatchOver) return

    if (trackingMode === 'mediapipe') {
      updateBlockersFromMediaPipe(now)
    }

    shotCooldownRef.current -= deltaSeconds
    if (shotCooldownRef.current <= 0) {
      spawnBall(now)
      shotCooldownRef.current = 0.55 + Math.random() * 0.35
    }

    const statsPatch = { ...stats }
    let statsChanged = false

    ballsRef.current = ballsRef.current.filter((ball) => {
      ball.x += ball.vx * deltaSeconds
      ball.y += ball.vy * deltaSeconds

      const blocked = blockersRef.current.some((blocker) => {
        const distance = Math.hypot(ball.x - blocker.x, ball.y - blocker.y)
        return distance <= ball.radius + blocker.radius
      })

      if (blocked) {
        const reaction = now - ball.spawnedAt
        reactionSamplesRef.current.push(reaction)
        statsPatch.saves += 1
        statsPatch.streak += 1
        statsPatch.bestStreak = Math.max(statsPatch.bestStreak, statsPatch.streak)
        statsPatch.avgReactionMs =
          reactionSamplesRef.current.reduce((sum, v) => sum + v, 0) /
          reactionSamplesRef.current.length
        statsChanged = true
        return false
      }

      const inGoalHorizontal =
        ball.x >= GOAL.x + ball.radius && ball.x <= GOAL.x + GOAL.width - ball.radius
      const inGoalDepth = ball.y - ball.radius <= GOAL.y + GOAL.height
      if (inGoalHorizontal && inGoalDepth) {
        statsPatch.goalsAllowed += 1
        statsPatch.streak = 0
        statsChanged = true
        return false
      }

      const outOfBounds =
        ball.x < -80 ||
        ball.x > CANVAS_WIDTH + 80 ||
        ball.y < -100 ||
        ball.y > CANVAS_HEIGHT + 80
      return !outOfBounds
    })

    const nextTime = Math.max(0, timeLeft - deltaSeconds)
    hudAccumulatorRef.current += deltaSeconds
    if (statsChanged) {
      setStats(statsPatch)
    }
    if (hudAccumulatorRef.current >= 0.1) {
      setTimeLeft(nextTime)
      hudAccumulatorRef.current = 0
    }
    if (nextTime <= 0) {
      setTimeLeft(0)
      setIsMatchOver(true)
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }

  const renderGame = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
    gradient.addColorStop(0, '#0d2d6b')
    gradient.addColorStop(1, '#19894f')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 3
    ctx.strokeRect(12, 12, CANVAS_WIDTH - 24, CANVAS_HEIGHT - 24)
    ctx.beginPath()
    ctx.arc(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 80, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = '#f8f8f8'
    ctx.fillRect(GOAL.x, GOAL.y, GOAL.width, GOAL.height)
    ctx.strokeStyle = '#d8d8d8'
    ctx.lineWidth = 4
    ctx.strokeRect(GOAL.x, GOAL.y, GOAL.width, GOAL.height)

    ctx.fillStyle = '#101820'
    ctx.fillRect(CANVAS_WIDTH / 2 - 26, CANVAS_HEIGHT - 38, 52, 24)
    ctx.fillStyle = '#f2f2f2'
    ctx.font = 'bold 12px system-ui, sans-serif'
    ctx.fillText('AI', CANVAS_WIDTH / 2 - 9, CANVAS_HEIGHT - 21)

    for (const blocker of blockersRef.current) {
      ctx.beginPath()
      ctx.arc(blocker.x, blocker.y, blocker.radius, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(99, 212, 255, 0.18)'
      ctx.fill()
      ctx.lineWidth = 4
      ctx.strokeStyle = '#63d4ff'
      ctx.stroke()
    }

    for (const ball of ballsRef.current) {
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#222'
      ctx.stroke()
    }
  }

  return (
    <main className="app-shell">
      <section className="hud">
        <h1>Keeper Clash</h1>
        <p>
          Timer: <strong>{Math.ceil(timeLeft)}s</strong> | Saves:{' '}
          <strong>{stats.saves}</strong> | Goals Allowed:{' '}
          <strong>{stats.goalsAllowed}</strong> | Streak:{' '}
          <strong>{stats.streak}</strong> | Avg Reaction:{' '}
          <strong>{Math.round(stats.avgReactionMs || 0)}ms</strong>
        </p>
        <p className="mode">
          Tracking: {trackingMode === 'mediapipe' ? 'MediaPipe Hands' : 'Mouse fallback'}
        </p>
        {cameraError ? <p className="error">{cameraError}</p> : null}
      </section>

      <section className="game-wrap">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="game-canvas"
        />
        <video ref={videoRef} className="video-feed" playsInline muted />
        {isMatchOver ? (
          <div className="overlay">
            <h2>Match Over</h2>
            <p>Final Saves: {stats.saves}</p>
            <p>Goals Allowed: {stats.goalsAllowed}</p>
            <p>Best Streak: {stats.bestStreak}</p>
            <p>Avg Reaction: {Math.round(stats.avgReactionMs || 0)}ms</p>
            <button onClick={resetMatch}>Replay</button>
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default App
