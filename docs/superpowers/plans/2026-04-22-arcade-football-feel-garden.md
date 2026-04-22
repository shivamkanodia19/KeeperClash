# Arcade Football Feel Garden Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a slower, readable, real-time arcade football slice where the user can control one offensive or defensive player and visible live simulation drives the result.

**Architecture:** Strengthen the existing football boundaries instead of replacing them: `playSim` owns continuous player/ball physics, `playAnimation` owns snap/result phase transitions, `ui-contract` owns clock/control state, and `FootballSim.tsx`/`index.css` own rendering/input. The old resolver remains only as a snap-time tendency source; live positions, contact, pass state, and whistle state decide the final result.

**Tech Stack:** React, TypeScript, Vite, Vitest, CSS, existing football engine modules under `src/game/football`.

---

## Scope Check

This plan implements one vertical slice from the approved spec:

- Inside Zone run
- Quick Slants or Stick pass
- Cover 2 Zone base defense
- Cover 0 or Run Blitz pressure defense
- Slower live movement
- Player control on offense and defense
- Camera/sizing fixes
- Tests proving that controls and live interactions affect outcomes

Do not add multiplayer, custom whiteboard plays, franchise features, a full playbook, or new UI frameworks in this plan.

## File Structure

- Modify: `src/game/football/playSim/playSimTypes.ts`
  - Extend runtime player/ball state with assignment, input, contact, and action timing fields.
- Create: `src/game/football/playSim/playFeelConfig.ts`
  - Central tuning constants for speed, acceleration, camera, tackle radii, pass timing, and control strength.
- Modify: `src/game/football/playSim/playWorldSimulation.ts`
  - Use assignment-driven movement, slower acceleration, controlled player input, stateful contact, passing, tackles, and whistle conditions.
- Modify: `src/game/football/playSim/playWorldSimulation.test.ts`
  - Add focused tests for movement speed, control influence, blocking, tackling, passing, and live result conditions.
- Modify: `src/game/football/playAnimation/playAnimationMachine.ts`
  - Ensure active-player control, primary/secondary actions, pass target selection, and live resolution are wired to the sim state.
- Modify: `src/game/football/playAnimation/playAnimationMachine.test.ts`
  - Add active offensive and defensive control tests at the animation layer.
- Modify: `src/game/football/spatial/cameraContract.ts`
  - Return all-22 pre-snap camera and closer ball-follow live camera.
- Modify: `src/game/football/spatial/geometryTypes.ts`
  - Add `tactical_full` focus mode for a future full-field toggle.
- Modify: `src/game/football/ui-contract/types.ts`
  - Keep action names stable; only add fields if the UI cannot derive state from `PlayAnimationSnapshot`.
- Modify: `src/game/football/ui-contract/useFootballGame.ts`
  - Keep `requestAnimationFrame` loop as the only live advancement path and route play-clock expiration explicitly.
- Modify: `src/game/football/ui-contract/useFootballGame.test.ts`
  - Add commit tests for live tackle/gain and defensive-control-influenced result.
- Modify: `src/modes/football/FootballSim.tsx`
  - Improve field scaling, camera transform, active-player selection, control hints, DPad/keyboard input, and result toast behavior.
- Modify: `src/index.css`
  - Make gameplay fit `100dvh`, remove vertical gameplay scroll, enlarge players, compact HUD/controls, and add camera viewport styling.

---

### Task 1: Add Feel Configuration And Runtime State

**Files:**
- Create: `src/game/football/playSim/playFeelConfig.ts`
- Modify: `src/game/football/playSim/playSimTypes.ts`
- Test: `src/game/football/playSim/playWorldSimulation.test.ts`

- [ ] **Step 1: Write the failing tests for slower movement and active control influence**

Add these tests to `src/game/football/playSim/playWorldSimulation.test.ts` inside the existing `describe('playWorldSimulation', () => { ... })` block:

```ts
it('live tuning keeps players readable over one second', () => {
  const engine = createTestScrimmageState()
  const rng = createSeededRng(15)
  const { resolution, committedPlayIds } = advanceDrive(
    engine,
    { userOffensePlayId: 'inside_zone' },
    rng,
  )
  const off = getOffensivePlay('inside_zone')!
  const def = getDefensiveCall(committedPlayIds.defenseCallId)
  const { players, ball } = layoutPlayersAtLos(
    engine.possession,
    engine.yardLine,
    off.formationId,
    def?.visualTemplateId ?? 'four_three_base',
  )
  let world = createPlayWorldFromSnap({
    offenseTeam: engine.possession,
    yardLineAtSnap: engine.yardLine,
    signedTargetYards: resolution.yardsGained,
    offensePlayId: 'inside_zone',
    defenseCallId: committedPlayIds.defenseCallId,
    layoutPlayers: players,
    ball,
    resolution,
  })
  const startX = world.ball.x

  for (let i = 0; i < 60; i++) {
    world = stepPlayWorld(world, SUBSTEP_DT, { carrierSteer: 0 }, resolution)
  }

  expect(world.ball.x - startX).toBeGreaterThan(0.75)
  expect(world.ball.x - startX).toBeLessThan(7)
})

it('active ball carrier input creates a different lateral lane', () => {
  const engine = createTestScrimmageState()
  const rng = createSeededRng(16)
  const { resolution, committedPlayIds } = advanceDrive(
    engine,
    { userOffensePlayId: 'inside_zone' },
    rng,
  )
  const off = getOffensivePlay('inside_zone')!
  const def = getDefensiveCall(committedPlayIds.defenseCallId)
  const setup = layoutPlayersAtLos(
    engine.possession,
    engine.yardLine,
    off.formationId,
    def?.visualTemplateId ?? 'four_three_base',
  )
  const baseParams = {
    offenseTeam: engine.possession,
    yardLineAtSnap: engine.yardLine,
    signedTargetYards: Math.max(5, resolution.yardsGained),
    offensePlayId: 'inside_zone',
    defenseCallId: committedPlayIds.defenseCallId,
    layoutPlayers: setup.players,
    ball: setup.ball,
    resolution,
  }
  let left = createPlayWorldFromSnap(baseParams)
  let right = createPlayWorldFromSnap(baseParams)
  const carrierId = left.ball.carrierId
  expect(carrierId).not.toBeNull()

  for (let i = 0; i < 45; i++) {
    left = stepPlayWorld(left, SUBSTEP_DT, {
      carrierSteer: 0,
      activePlayerId: carrierId,
      moveX: 0,
      moveY: -1,
    }, resolution)
    right = stepPlayWorld(right, SUBSTEP_DT, {
      carrierSteer: 0,
      activePlayerId: carrierId,
      moveX: 0,
      moveY: 1,
    }, resolution)
  }

  expect(right.ball.y - left.ball.y).toBeGreaterThan(3)
})
```

- [ ] **Step 2: Run the targeted test and verify failure**

Run:

```bash
npm test -- src/game/football/playSim/playWorldSimulation.test.ts
```

Expected: FAIL because no central feel constants exist yet and current tuning may be too fast or not input-sensitive enough.

- [ ] **Step 3: Create the feel config**

Create `src/game/football/playSim/playFeelConfig.ts`:

```ts
export const PLAY_FEEL = {
  playbackTimeScale: 0.34,
  substepDt: 1 / 60,
  maxFrameDtSeconds: 0.25,
  readableRunMinSeconds: 3.2,
  readableRunMaxSeconds: 7.5,
  player: {
    globalSpeedMultiplier: 0.68,
    controlledSpeedMultiplier: 1.05,
    controlledAccelerationMultiplier: 1.1,
    lateralControlYards: 9,
    forwardControlYards: 6,
    maxFieldY: 26,
    minFieldX: 1,
    maxFieldX: 99,
  },
  contact: {
    engageRadius: 1.25,
    tackleRadius: 0.62,
    tackleSecureRadius: 0.42,
    blockSlowMultiplier: 0.42,
    shedBaseSeconds: 0.95,
  },
  pass: {
    qbAutoThrowSeconds: 0.74,
    minFlightSeconds: 0.42,
    maxFlightSeconds: 0.78,
    flightSecondsPerYard: 0.065,
    catchRadius: 1.18,
    swatRadius: 1.45,
    interceptRadius: 1.05,
  },
  action: {
    tackleLungeSeconds: 0.28,
    tackleLungeBoost: 2.3,
    jukeBoostY: 3.0,
    diveBoostX: 2.0,
    shedBoostSeconds: 0.35,
  },
} as const
```

- [ ] **Step 4: Extend runtime state types**

In `src/game/football/playSim/playSimTypes.ts`, update `SimPlayer` and `PlayWorldSimulation` by adding these fields:

```ts
  assignmentTargetId: string | null
  controlled: boolean
  actionCooldown: number
  tackleIntentTimer: number
  shedBoostTimer: number
```

and:

```ts
  lastWhistleReason: 'tackle' | 'score' | 'incomplete' | 'interception' | 'script_limit' | null
```

`SimPlayer` should keep existing fields; add the new fields after `assignment` and before `phase` for readability. `PlayWorldSimulation.lastWhistleReason` should live next to `finished`.

- [ ] **Step 5: Initialize the new fields**

In `layoutToSimPlayers()` inside `src/game/football/playSim/playWorldSimulation.ts`, add these properties to the returned `SimPlayer` object:

```ts
      assignmentTargetId: null,
      controlled: false,
      actionCooldown: 0,
      tackleIntentTimer: 0,
      shedBoostTimer: 0,
```

In `createPlayWorldFromSnap()`, add this to the returned world object:

```ts
    lastWhistleReason: null,
```

- [ ] **Step 6: Import and use the feel config for constants**

At the top of `src/game/football/playSim/playWorldSimulation.ts`, add:

```ts
import { PLAY_FEEL } from './playFeelConfig'
```

Replace the local constants:

```ts
const ENGAGE_RADIUS = 1.15
const CATCH_RADIUS = 1.05
const SUBSTEP_DT = 1 / 60
```

with:

```ts
const ENGAGE_RADIUS = PLAY_FEEL.contact.engageRadius
const CATCH_RADIUS = PLAY_FEEL.pass.catchRadius
const SUBSTEP_DT = PLAY_FEEL.substepDt
```

In `integrateVelocity()`, change the cap calculation to:

```ts
  const controlMul = p.controlled ? PLAY_FEEL.player.controlledSpeedMultiplier : 1
  const cap =
    p.maxSpeed *
    PLAY_FEEL.player.globalSpeedMultiplier *
    maxMul *
    controlMul *
    (engaged ? PLAY_FEEL.contact.blockSlowMultiplier : 1)
```

Change `maxDv` to:

```ts
  const accelMul = p.controlled ? PLAY_FEEL.player.controlledAccelerationMultiplier : 1
  const maxDv = p.acceleration * accelMul * dt
```

- [ ] **Step 7: Mark controlled players each frame**

At the start of `stepPlayWorld()` after copying `world.players`, add:

```ts
  w.players = w.players.map((p) => ({
    ...p,
    controlled: input.activePlayerId === p.id,
    actionCooldown: Math.max(0, p.actionCooldown - dt),
    tackleIntentTimer: Math.max(0, p.tackleIntentTimer - dt),
    shedBoostTimer: Math.max(0, p.shedBoostTimer - dt),
  }))
```

- [ ] **Step 8: Run tests and commit**

Run:

```bash
npm test -- src/game/football/playSim/playWorldSimulation.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/game/football/playSim/playFeelConfig.ts src/game/football/playSim/playSimTypes.ts src/game/football/playSim/playWorldSimulation.ts src/game/football/playSim/playWorldSimulation.test.ts
git commit -m "Add football feel tuning state"
```

---

### Task 2: Make Blocking And Tackling Live-State Driven

**Files:**
- Modify: `src/game/football/playSim/playWorldSimulation.ts`
- Modify: `src/game/football/playSim/playWorldSimulation.test.ts`

- [ ] **Step 1: Write failing blocking and tackling tests**

Add these tests to `src/game/football/playSim/playWorldSimulation.test.ts`:

```ts
it('offensive linemen engage and slow defensive rushers', () => {
  const engine = createTestScrimmageState()
  const rng = createSeededRng(21)
  const { resolution, committedPlayIds } = advanceDrive(
    engine,
    { userOffensePlayId: 'inside_zone' },
    rng,
  )
  const off = getOffensivePlay('inside_zone')!
  const def = getDefensiveCall(committedPlayIds.defenseCallId)
  const { players, ball } = layoutPlayersAtLos(
    engine.possession,
    engine.yardLine,
    off.formationId,
    def?.visualTemplateId ?? 'four_three_base',
  )
  let world = createPlayWorldFromSnap({
    offenseTeam: engine.possession,
    yardLineAtSnap: engine.yardLine,
    signedTargetYards: Math.max(4, resolution.yardsGained),
    offensePlayId: 'inside_zone',
    defenseCallId: 'cover_2_zone',
    layoutPlayers: players,
    ball,
    resolution,
  })

  for (let i = 0; i < 120 && !world.players.some((p) => p.phase === 'blockEngaged'); i++) {
    world = stepPlayWorld(world, SUBSTEP_DT, { carrierSteer: 0 }, resolution)
  }

  const engaged = world.players.filter((p) => p.phase === 'blockEngaged')
  expect(engaged.length).toBeGreaterThanOrEqual(2)
  expect(engaged.every((p) => Math.hypot(p.vx, p.vy) < p.maxSpeed)).toBe(true)
})

it('controlled defender tackle can end a run before the scripted target', () => {
  const engine = createTestScrimmageState()
  const rng = createSeededRng(22)
  const { resolution, committedPlayIds } = advanceDrive(
    engine,
    { userOffensePlayId: 'inside_zone' },
    rng,
  )
  const off = getOffensivePlay('inside_zone')!
  const def = getDefensiveCall(committedPlayIds.defenseCallId)
  const setup = layoutPlayersAtLos(
    engine.possession,
    engine.yardLine,
    off.formationId,
    def?.visualTemplateId ?? 'four_three_base',
  )
  let world = createPlayWorldFromSnap({
    offenseTeam: engine.possession,
    yardLineAtSnap: engine.yardLine,
    signedTargetYards: 12,
    offensePlayId: 'inside_zone',
    defenseCallId: 'cover_2_zone',
    layoutPlayers: setup.players,
    ball: setup.ball,
    resolution,
  })
  const defender = world.players.find((p) => p.unit === 'defense' && p.role === 'LB')!
  const carrier = world.players.find((p) => p.id === world.ball.carrierId)!
  world = {
    ...world,
    players: world.players.map((p) =>
      p.id === defender.id
        ? { ...p, x: carrier.x + 0.35, y: carrier.y + 0.3, tackleIntentTimer: 0.25 }
        : p,
    ),
  }

  world = stepPlayWorld(world, SUBSTEP_DT, {
    carrierSteer: 0,
    activePlayerId: defender.id,
    moveX: -1,
    moveY: 0,
  }, resolution)

  expect(world.finished).toBe(true)
  expect(world.lastWhistleReason).toBe('tackle')
  expect(world.ball.x - world.yardLineAtSnap).toBeLessThan(12)
})
```

- [ ] **Step 2: Run targeted test and verify failure**

Run:

```bash
npm test -- src/game/football/playSim/playWorldSimulation.test.ts
```

Expected: FAIL if engagement is too rare or tackle intent does not influence the whistle.

- [ ] **Step 3: Tune engagement and shed behavior**

In `tryEngagements()`, include linebackers in defender targets for run plays by changing:

```ts
  const dl = ps.filter((p) => p.role === 'DL' && p.unit === 'defense')
```

to:

```ts
  const dl = ps.filter((p) => p.unit === 'defense' && (p.role === 'DL' || p.role === 'LB'))
```

In `applyEngagementPhysics()`, change the shed threshold block to:

```ts
    const shedBoost = p.shedBoostTimer > 0 ? 0.3 : 0
    if (p.unit === 'defense' && shedTimer > PLAY_FEEL.contact.shedBaseSeconds + oth.awareness * 0.25 - shedBoost) {
      engagedWith = null
      shedTimer = 0
      phase = 'passRush'
    }
```

- [ ] **Step 4: Replace tackle radius literals**

In `stepPlayWorld()`, replace the run tackle check:

```ts
      if (dist < 0.52) {
```

with:

```ts
      if (dist < PLAY_FEEL.contact.tackleRadius || d.tackleIntentTimer > 0) {
```

Replace:

```ts
        if (dist < 0.38 || breakTackle < 0.22) {
```

with:

```ts
        const intentBonus = d.tackleIntentTimer > 0 ? 0.18 : 0
        if (dist < PLAY_FEEL.contact.tackleSecureRadius || breakTackle < 0.22 + intentBonus) {
```

Inside that block, set:

```ts
          w.lastWhistleReason = 'tackle'
```

immediately before `w.finished = true`.

Make the same `lastWhistleReason = 'tackle'` assignment in the pass-completion tackle block.

- [ ] **Step 5: Add action helpers for defender tackle and shed**

Add exports near `applyCarrierDive()` in `src/game/football/playSim/playWorldSimulation.ts`:

```ts
export function applyDefenderTackleIntent(
  world: PlayWorldSimulation,
  defenderId: string | null,
): PlayWorldSimulation {
  if (!defenderId) return world
  return {
    ...world,
    players: world.players.map((p) =>
      p.id === defenderId && p.unit === 'defense'
        ? {
            ...p,
            tackleIntentTimer: PLAY_FEEL.action.tackleLungeSeconds,
            actionCooldown: 0.35,
            vx: p.vx + Math.cos(p.facingRad) * PLAY_FEEL.action.tackleLungeBoost,
            vy: p.vy + Math.sin(p.facingRad) * PLAY_FEEL.action.tackleLungeBoost,
          }
        : p,
    ),
  }
}

export function applyDefenderShedIntent(
  world: PlayWorldSimulation,
  defenderId: string | null,
): PlayWorldSimulation {
  if (!defenderId) return world
  return {
    ...world,
    players: world.players.map((p) =>
      p.id === defenderId && p.unit === 'defense'
        ? { ...p, shedBoostTimer: PLAY_FEEL.action.shedBoostSeconds }
        : p,
    ),
  }
}
```

- [ ] **Step 6: Set whistle reason for non-tackle endings**

In `passStep()`, set `w.lastWhistleReason = 'incomplete'` before finished incompletions, `w.lastWhistleReason = 'interception'` before interceptions, and leave completed passes alive.

In the target-yard finish blocks, set:

```ts
      w.lastWhistleReason = w.ball.x >= 100 ? 'score' : 'script_limit'
```

before setting `finished`.

- [ ] **Step 7: Run tests and commit**

Run:

```bash
npm test -- src/game/football/playSim/playWorldSimulation.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/game/football/playSim/playWorldSimulation.ts src/game/football/playSim/playWorldSimulation.test.ts
git commit -m "Make football contact live-state driven"
```

---

### Task 3: Make Passing Visible And Controllable

**Files:**
- Modify: `src/game/football/playSim/playWorldSimulation.ts`
- Modify: `src/game/football/playSim/playWorldSimulation.test.ts`
- Modify: `src/game/football/playAnimation/playAnimationMachine.ts`
- Modify: `src/game/football/playAnimation/playAnimationMachine.test.ts`

- [ ] **Step 1: Add failing tests for target selection and catch window**

Add to `src/game/football/playSim/playWorldSimulation.test.ts`:

```ts
it('pass target selection changes the receiver who can catch the ball', () => {
  const engine = createTestScrimmageState()
  const rng = createSeededRng(31)
  const { resolution, committedPlayIds } = advanceDrive(
    engine,
    { userOffensePlayId: 'quick_slants' },
    rng,
  )
  const off = getOffensivePlay('quick_slants')!
  const def = getDefensiveCall(committedPlayIds.defenseCallId)
  const setup = layoutPlayersAtLos(
    engine.possession,
    engine.yardLine,
    off.formationId,
    def?.visualTemplateId ?? 'four_three_base',
  )
  let world = createPlayWorldFromSnap({
    offenseTeam: engine.possession,
    yardLineAtSnap: engine.yardLine,
    signedTargetYards: Math.max(5, resolution.yardsGained),
    offensePlayId: 'quick_slants',
    defenseCallId: 'cover_2_zone',
    layoutPlayers: setup.players,
    ball: setup.ball,
    resolution: { ...resolution, outcome: 'normal', yardsGained: 6 },
  })
  const targets = world.players.filter((p) => p.unit === 'offense' && (p.role === 'WR' || p.role === 'TE'))
  expect(targets.length).toBeGreaterThan(1)
  world = setWorldPrimaryTarget(world, targets[1]!.id)

  for (let i = 0; i < 160 && !world.finished && world.ball.carrierId !== targets[1]!.id; i++) {
    world = stepPlayWorld(world, SUBSTEP_DT, { carrierSteer: 0 }, {
      ...resolution,
      outcome: 'normal',
      yardsGained: 6,
    })
  }

  expect(world.ball.carrierId).toBe(targets[1]!.id)
  expect(world.passStage).toBe('received')
})
```

Update the import list in the same test file:

```ts
  setWorldPrimaryTarget,
```

- [ ] **Step 2: Run targeted test and verify failure**

Run:

```bash
npm test -- src/game/football/playSim/playWorldSimulation.test.ts
```

Expected: FAIL if target selection, ball flight, or catch transfer is still too scripted.

- [ ] **Step 3: Use feel config for pass timing**

In `passStep()`, replace:

```ts
    if (w.passTimer > 0.32 && tgt) {
```

with:

```ts
    if (w.passTimer > PLAY_FEEL.pass.qbAutoThrowSeconds && tgt) {
```

Replace:

```ts
      const flight = clamp(dist * 0.055, 0.38, 0.62)
```

with:

```ts
      const flight = clamp(
        dist * PLAY_FEEL.pass.flightSecondsPerYard,
        PLAY_FEEL.pass.minFlightSeconds,
        PLAY_FEEL.pass.maxFlightSeconds,
      )
```

Replace interception proximity:

```ts
      if (outcome === 'interception' && nearestDef && nd < CATCH_RADIUS + 1.1) {
```

with:

```ts
      if (outcome === 'interception' && nearestDef && nd < PLAY_FEEL.pass.interceptRadius + 0.7) {
```

Replace catch proximity:

```ts
      if (distTgt < CATCH_RADIUS + 0.35 && tgt) {
```

with:

```ts
      if (distTgt < CATCH_RADIUS + 0.45 && tgt) {
```

- [ ] **Step 4: Expose receiver-targeting in animation tests**

Add to `src/game/football/playAnimation/playAnimationMachine.test.ts`:

```ts
it('throwTo target keeps QB control until the selected receiver catches', () => {
  const engine = createTestScrimmageState()
  let core = createPlayAnimationCore(engine)
  const s0 = snap(core, engine, 'quick_slants', 'cover_2_zone')
  expect(s0).not.toBeNull()
  core = s0!.core
  const target = core.players.find(
    (p) => p.unit === 'offense' && p.role === 'WR' && p.id !== core.ball.throwTargetId,
  )
  expect(target).toBeDefined()

  core = switchActivePlayer(core, target!.id, 'offense')!
  expect(core.ball.throwTargetId).toBe(target!.id)
  expect(core.activePlayerId).toBe(core.ball.carrierId)

  for (let i = 0; i < 180 && core.ball.carrierId !== target!.id && core.phase !== 'tackleOrScore'; i++) {
    core = advancePlaySimulationFrame(core, 33)!
  }

  expect(core.ball.carrierId).toBe(target!.id)
  expect(core.activePlayerId).toBe(target!.id)
})
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- src/game/football/playSim/playWorldSimulation.test.ts src/game/football/playAnimation/playAnimationMachine.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/game/football/playSim/playWorldSimulation.ts src/game/football/playSim/playWorldSimulation.test.ts src/game/football/playAnimation/playAnimationMachine.ts src/game/football/playAnimation/playAnimationMachine.test.ts
git commit -m "Tune visible passing control"
```

---

### Task 4: Wire Offensive And Defensive Actions Through The Animation Layer

**Files:**
- Modify: `src/game/football/playAnimation/playAnimationMachine.ts`
- Modify: `src/game/football/playAnimation/index.ts`
- Modify: `src/game/football/playAnimation/playAnimationMachine.test.ts`
- Modify: `src/game/football/ui-contract/useFootballGame.ts`
- Modify: `src/game/football/ui-contract/useFootballGame.test.ts`

- [ ] **Step 1: Add failing action tests**

Add to `src/game/football/playAnimation/playAnimationMachine.test.ts`:

```ts
it('primary action performs a defensive tackle intent when controlling defense', () => {
  const engine = {
    ...createTestScrimmageState(),
    possession: 'away' as const,
    userControlledTeam: 'home' as const,
  }
  let core = createPlayAnimationCore(engine)
  const s0 = snap(core, engine, 'inside_zone', 'cover_2_zone')
  expect(s0).not.toBeNull()
  core = switchActivePlayer(s0!.core, 'home_mike', 'defense')!
  const acted = dive(core)
  expect(acted).not.toBeNull()
  expect(acted!.world?.players.find((p) => p.id === 'home_mike')?.tackleIntentTimer).toBeGreaterThan(0)
})

it('secondary action performs a defender shed intent when controlling defense', () => {
  const engine = {
    ...createTestScrimmageState(),
    possession: 'away' as const,
    userControlledTeam: 'home' as const,
  }
  let core = createPlayAnimationCore(engine)
  const s0 = snap(core, engine, 'inside_zone', 'cover_2_zone')
  expect(s0).not.toBeNull()
  core = switchActivePlayer(s0!.core, 'home_mike', 'defense')!
  const acted = juke(core)
  expect(acted).not.toBeNull()
  expect(acted!.world?.players.find((p) => p.id === 'home_mike')?.shedBoostTimer).toBeGreaterThan(0)
})
```

Update imports in this test file to include `juke`.

- [ ] **Step 2: Run action tests and verify failure**

Run:

```bash
npm test -- src/game/football/playAnimation/playAnimationMachine.test.ts
```

Expected: FAIL because `dive()` and `juke()` currently map primarily to ball-carrier behavior.

- [ ] **Step 3: Import defender action helpers**

In `src/game/football/playAnimation/playAnimationMachine.ts`, extend the play sim imports:

```ts
  applyDefenderShedIntent,
  applyDefenderTackleIntent,
```

- [ ] **Step 4: Branch `juke()` and `dive()` by controlled unit**

Inside `juke(core)`, before the ball-carrier juke branch, add:

```ts
  const active = core.world?.players.find((p) => p.id === core.activePlayerId)
  if (core.world && active?.unit === 'defense') {
    const world = applyDefenderShedIntent(core.world, active.id)
    const synced = syncWorldToField(world)
    return {
      ...core,
      world,
      players: synced.players,
      ball: synced.ball,
      animatedYards: synced.animatedYards,
    }
  }
```

Inside `dive(core)`, before the ball-carrier dive branch, add:

```ts
  const active = core.world?.players.find((p) => p.id === core.activePlayerId)
  if (core.world && active?.unit === 'defense') {
    const world = applyDefenderTackleIntent(core.world, active.id)
    const synced = syncWorldToField(world)
    return {
      ...core,
      world,
      players: synced.players,
      ball: synced.ball,
      animatedYards: synced.animatedYards,
    }
  }
```

- [ ] **Step 5: Ensure exports are available**

In `src/game/football/playAnimation/index.ts`, keep this export line. Add it only when the file does not already contain it:

```ts
export * from './playAnimationMachine'
```

If it does not, add that line.

- [ ] **Step 6: Add UI-contract result test for live controlled tackle**

Add to `src/game/football/ui-contract/useFootballGame.test.ts`:

```ts
it('commitLivePlayResult uses the live controlled tackle spot', () => {
  const engine = {
    ...createTestScrimmageState(),
    possession: 'away' as const,
    userControlledTeam: 'home' as const,
  }
  const core0 = createPlayAnimationCore(engine)
  const s0 = snap(core0, engine, 'inside_zone', 'cover_2_zone')
  expect(s0).not.toBeNull()
  const tackledAt = s0!.core.yardLineAtSnap + 1
  const core = {
    ...s0!.core,
    phase: 'tackleOrScore' as const,
    ball: {
      ...s0!.core.ball,
      mode: 'dead' as const,
      x: tackledAt,
    },
  }

  const committed = commitLivePlayResult(engine, core)
  expect(committed).not.toBeNull()
  expect(committed!.resultCore.pendingResolution?.yardsGained).toBe(1)
})
```

- [ ] **Step 7: Run tests and commit**

Run:

```bash
npm test -- src/game/football/playAnimation/playAnimationMachine.test.ts src/game/football/ui-contract/useFootballGame.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/game/football/playAnimation/playAnimationMachine.ts src/game/football/playAnimation/index.ts src/game/football/playAnimation/playAnimationMachine.test.ts src/game/football/ui-contract/useFootballGame.ts src/game/football/ui-contract/useFootballGame.test.ts
git commit -m "Wire live football control actions"
```

---

### Task 5: Fix Camera Contract For All-22 Pre-Snap And Zoomed Live Play

**Files:**
- Modify: `src/game/football/spatial/geometryTypes.ts`
- Modify: `src/game/football/spatial/cameraContract.ts`
- Test: `src/game/football/spatial/cameraContract.test.ts`

- [ ] **Step 1: Create failing camera tests**

Create `src/game/football/spatial/cameraContract.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { deriveCameraRecommendation } from './cameraContract'

describe('deriveCameraRecommendation', () => {
  it('shows the full tactical field pre-snap', () => {
    const cam = deriveCameraRecommendation({
      phase: 'preSnap',
      lineOfScrimmageX: 25,
      ball: { x: 25, y: 0 },
      playProgress01: 0,
    })

    expect(cam.focusMode).toBe('full_field')
    expect(cam.visibleXMin).toBe(0)
    expect(cam.visibleXMax).toBe(100)
    expect(cam.visibleYMin).toBeLessThanOrEqual(-26)
    expect(cam.visibleYMax).toBeGreaterThanOrEqual(26)
  })

  it('zooms around the ball during live play while preserving nearby action', () => {
    const cam = deriveCameraRecommendation({
      phase: 'playInProgress',
      lineOfScrimmageX: 37,
      ball: { x: 42, y: 8 },
      playProgress01: 0.4,
    })

    expect(cam.focusMode).toBe('ball_follow')
    expect(cam.visibleXMin).toBeLessThanOrEqual(30)
    expect(cam.visibleXMax).toBeGreaterThanOrEqual(54)
    expect(cam.visibleXMax - cam.visibleXMin).toBeLessThan(60)
    expect(cam.visibleYMin).toBeLessThanOrEqual(-18)
    expect(cam.visibleYMax).toBeGreaterThanOrEqual(26)
  })
})
```

- [ ] **Step 2: Run targeted camera test and verify failure**

Run:

```bash
npm test -- src/game/football/spatial/cameraContract.test.ts
```

Expected: FAIL because current live camera remains full-field.

- [ ] **Step 3: Update camera focus modes**

In `src/game/football/spatial/geometryTypes.ts`, change:

```ts
  focusMode: 'los_wide' | 'ball_follow' | 'full_field' | 'full_field_live'
```

to:

```ts
  focusMode: 'los_wide' | 'ball_follow' | 'full_field' | 'full_field_live' | 'tactical_full'
```

- [ ] **Step 4: Implement ball-follow camera**

Replace `deriveCameraRecommendation()` in `src/game/football/spatial/cameraContract.ts` with:

```ts
import type { CameraRecommendation } from './geometryTypes'
import type { PlayAnimationPhase } from '../playAnimation/types'

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

export function deriveCameraRecommendation(opts: {
  phase: PlayAnimationPhase
  lineOfScrimmageX: number
  ball: { x: number; y: number }
  /** 0-1 play progress while live. */
  playProgress01: number
}): CameraRecommendation {
  if (opts.phase === 'preSnap') {
    return {
      viewportCenterX: 50,
      viewportCenterY: 0,
      zoom: 0.72,
      visibleXMin: 0,
      visibleXMax: 100,
      visibleYMin: -32,
      visibleYMax: 32,
      focusMode: 'full_field',
    }
  }

  if (opts.phase === 'result' || opts.phase === 'tackleOrScore') {
    const cx = clamp(opts.ball.x, 20, 80)
    return {
      viewportCenterX: cx,
      viewportCenterY: clamp(opts.ball.y, -10, 10),
      zoom: 1.22,
      visibleXMin: clamp(cx - 25, 0, 52),
      visibleXMax: clamp(cx + 25, 48, 100),
      visibleYMin: -28,
      visibleYMax: 28,
      focusMode: 'ball_follow',
    }
  }

  const centerX = clamp(opts.ball.x + 8, 18, 82)
  const centerY = clamp(opts.ball.y, -12, 12)
  const halfWidth = 24
  return {
    viewportCenterX: centerX,
    viewportCenterY: centerY,
    zoom: 1.32,
    visibleXMin: clamp(centerX - halfWidth, 0, 100 - halfWidth * 2),
    visibleXMax: clamp(centerX + halfWidth, halfWidth * 2, 100),
    visibleYMin: clamp(centerY - 28, -32, 0),
    visibleYMax: clamp(centerY + 28, 0, 32),
    focusMode: 'ball_follow',
  }
}
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- src/game/football/spatial/cameraContract.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/game/football/spatial/geometryTypes.ts src/game/football/spatial/cameraContract.ts src/game/football/spatial/cameraContract.test.ts
git commit -m "Add football live camera contract"
```

---

### Task 6: Apply Camera And Viewport In The React Surface

**Files:**
- Modify: `src/modes/football/FootballSim.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Verify where field coordinates are mapped**

Open `src/modes/football/FootballSim.tsx` around `FieldDisplay`. Confirm `xPct()` and `yPct()` are derived from `animation.cameraRecommendation`. Preserve those helpers.

- [ ] **Step 2: Add camera CSS variables to the field frame**

In `FieldDisplay`, change:

```tsx
    <div className="gb-field-frame" ref={fieldRef}>
```

to:

```tsx
    <div
      className={`gb-field-frame gb-field-frame--${cam.focusMode}`}
      ref={fieldRef}
      style={{
        '--gb-camera-zoom': cam.zoom,
      } as CSSProperties}
    >
```

This reuses the existing `CSSProperties` import at the top of the file.

- [ ] **Step 3: Keep field labels sparse during live zoom**

In the yard-line render loop, if the code maps every 5-yard tick, keep every 10-yard major tick visible but hide minor labels in live `ball_follow` mode:

```tsx
              {tick % 10 === 0 || cam.focusMode !== 'ball_follow' ? (
                <>
                  <span className="top">{label}</span>
                  <span className="bottom">{label}</span>
                </>
              ) : null}
```

- [ ] **Step 4: Tighten the gameplay shell sizing**

In `src/index.css`, update these rules:

```css
.gb-shell {
  min-height: 100dvh;
  height: 100dvh;
  overflow: hidden;
}

.gb-scoreboard {
  min-height: 62px;
  height: 62px;
}

.gb-play-area {
  min-height: 0;
  height: calc(100dvh - 62px);
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
}

.gb-field-frame {
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.gb-controls {
  min-height: 104px;
  max-height: 132px;
}

.gb-field-frame--ball_follow .gb-player {
  width: 34px;
  height: 34px;
}

.gb-field-frame--full_field .gb-player {
  width: 26px;
  height: 26px;
}

.gb-field-frame--ball_follow .gb-ball {
  transform: translate(-50%, -50%) scale(1.18);
}
```

If existing selectors already exist, edit those existing blocks instead of duplicating them.

- [ ] **Step 5: Manual viewport check**

Run:

```bash
npm run build
npm run dev -- --host 127.0.0.1
```

Open the local URL in desktop responsive mode and verify:

- 1365x768: no vertical page scroll during gameplay.
- 932x430 mobile landscape: scoreboard, field, and controls all visible.
- Pre-snap: all 22 players visible.
- Live play: camera is closer and players are readable.

- [ ] **Step 6: Commit**

Commit:

```bash
git add src/modes/football/FootballSim.tsx src/index.css
git commit -m "Fit football gameplay viewport"
```

---

### Task 7: Make Play Clock Expiration Explicit

**Files:**
- Modify: `src/game/football/footballState.ts`
- Modify: `src/game/football/footballState.test.ts`
- Modify: `src/game/football/ui-contract/useFootballGame.ts`

- [ ] **Step 1: Add failing play-clock test**

Add to `src/game/football/footballState.test.ts`:

```ts
it('play clock expiration is explicit and does not silently advance the play', () => {
  const state = {
    ...createTestScrimmageState(),
    playClockSeconds: 0.1,
    clockMode: 'pre_snap_stopped' as const,
  }

  const next = applyRealtimeClock(state, 0.2, 'pre_snap_stopped')

  expect(next.playClockSeconds).toBe(0)
  expect(next.lastClockEvent).toBe('Play clock expired.')
  expect(next.sessionPhase).toBe('play_calling')
  expect(next.down).toBe(state.down)
  expect(next.yardLine).toBe(state.yardLine)
})
```

- [ ] **Step 2: Run test and verify behavior**

Run:

```bash
npm test -- src/game/football/footballState.test.ts
```

Expected: PASS when current behavior already matches the explicit contract. If it fails, update `applyRealtimeClock()` so expiration sets `playClockSeconds` to `0`, `lastClockEvent` to `Play clock expired.`, and leaves `sessionPhase`, `down`, and `yardLine` unchanged.

- [ ] **Step 3: Guard snap after expired play clock**

In `src/game/football/ui-contract/useFootballGame.ts`, inside `runPlay` and `snap`, add an early guard after checking engine/core:

```ts
    if (engine.playClockSeconds <= 0) {
      setLastPlaySummary('Delay of game. Resetting play clock.')
      setEngine((current) =>
        current
          ? {
              ...current,
              playClockSeconds: current.playClockSeconds <= 0 ? 25 : current.playClockSeconds,
              lastClockEvent: 'Delay of game handled.',
            }
          : current,
      )
      return
    }
```

Import `DEFAULT_PLAY_CLOCK_SECONDS` from `../footballTypes` at the top of `src/game/football/ui-contract/useFootballGame.ts` and use it instead of hard-coded `25`.

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm test -- src/game/football/footballState.test.ts src/game/football/ui-contract/useFootballGame.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/game/football/footballState.ts src/game/football/footballState.test.ts src/game/football/ui-contract/useFootballGame.ts
git commit -m "Make football play clock expiration explicit"
```

---

### Task 8: Full Regression And Push-Ready Polish

**Files:**
- Modify only files needed to fix failures from this task.

- [ ] **Step 1: Run TypeScript**

Run:

```bash
npm exec tsc -- --noEmit
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Run all tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Manual gameplay smoke test**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Manual checklist:

- Start a game from team select.
- Confirm kickoff intro completes.
- On offense, choose Inside Zone, snap, move the ball carrier with WASD/DPad, use primary/secondary, and see the live spot affect the result.
- On offense, choose Quick Slants or Stick, switch target receiver, snap, see ball flight, catch transfer, and control the receiver after catch.
- On defense, choose Cover 2 or pressure, select a defender before snap, control him after snap, and use primary to attempt tackle.
- Confirm the field fits without vertical page scroll at desktop landscape and mobile landscape dimensions.
- Confirm live play is slower and readable.

- [ ] **Step 6: Final cleanup commit**

When Task 8 changes files, run:

```bash
git add src/game/football src/modes/football/FootballSim.tsx src/index.css
git commit -m "Polish football feel garden integration"
```

When Task 8 changes no files, skip this commit.

---

## Self-Review Notes

Spec coverage:
- Real-time elapsed clock: Task 7 and Task 8.
- Slower continuous movement: Task 1 and Task 2.
- Offensive control: Task 1, Task 3, Task 4.
- Defensive control: Task 2 and Task 4.
- Blocking/contact: Task 2.
- Passing/catching: Task 3.
- Camera/sizing: Task 5 and Task 6.
- Live result derivation: Task 2, Task 4, existing `deriveLivePlayResolution`, and Task 8 smoke tests.

Placeholder scan:
- No placeholder-token language is used as an instruction.
- The only manual items are explicit smoke checks and viewport checks.

Type consistency:
- New helper names are `applyDefenderTackleIntent` and `applyDefenderShedIntent`.
- New config object is `PLAY_FEEL`.
- Existing public action names remain stable: `setMoveVector`, `switchPlayer`, `primaryAction`, `secondaryAction`, `throwTo`, `setPassTargetReceiver`.
