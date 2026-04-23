# Arcade Football Feel Garden Design

Date: 2026-04-22
Repo: KeeperClash-1

## Purpose

The next milestone is to make the football game feel like a real-time arcade football game instead of a visualized play resolver. The player should understand what is happening, control one important player at a time, and see believable football interactions: routes, blocking, pursuit, throws, catches, tackles, and whistles.

This milestone is a "feel garden": a narrow, tuneable gameplay slice used to prove the core control and movement model before expanding the full playbook. It should make one run play, one pass play, one base defense, and one pressure defense feel good.

## Research Anchor

Retro Bowl works because it keeps the football fantasy readable and tactile: short sessions, simple input, clear offensive control, zoomed-in field framing, and immediate feedback. It abstracts away most defense. This game should borrow the readability and pace, not the assets, branding, or exact mechanics.

Game-feel research points to the same product direction: fluidity comes from low-latency input, continuous motion, stable frame stepping, readable response, tuned acceleration/deceleration, collision feedback, camera behavior, and animation polish. The simulation must run from live positions and interactions, not from a preselected result.

References:
- https://www.newstargames.com/retro-bowl
- https://apps.apple.com/us/app/retro-bowl/id1478902583
- https://retro-bowl.fandom.com/wiki/Gameplay
- https://gameprogrammingpatterns.com/game-loop.html
- https://gafferongames.com/post/fix_your_timestep/
- https://www.red3d.com/cwr/steer/
- https://www.gamedeveloper.com/design/game-feel-the-secret-ingredient

## Product Goals

1. Full-field visibility when needed, with a zoomed playable view when action starts.
2. Larger, readable players with clear labels, facing, active-player highlight, ball indicator, and contact state.
3. Real-time game clock and play clock driven by elapsed time, not simulated resolver chunks.
4. User controls exactly one player at a time.
5. On offense, the user controls the QB or ball carrier and can influence the play outcome.
6. On defense, the user can choose a defender pre-snap or during the play, move that defender, and attempt tackles or coverage actions.
7. Non-active players use assignment-driven AI: routes, blocking, pass rush, coverage drops, pursuit, and tackle support.
8. Outcomes are derived from live simulation state first. Existing resolver data may bias ratings and tendencies, but cannot override what visibly happened.

## Non-Goals

This milestone will not implement the entire playbook, multiplayer, custom whiteboard plays, franchise mode, injuries, substitutions, full penalties beyond delay-of-game handling, or perfect football strategy. It also will not attempt full manual control of all eleven players at once.

## Recommended Approach

Build an arcade real-time football core around the existing `playAnimation`, `playSim`, and `ui-contract` boundaries.

The current code already has useful scaffolding:
- `src/game/football/playAnimation/playAnimationMachine.ts` owns play phases and bridges the engine to field snapshots.
- `src/game/football/playSim/playWorldSimulation.ts` owns continuous player/ball movement.
- `src/game/football/playSim/playSimTypes.ts` defines player and ball runtime state.
- `src/game/football/ui-contract/useFootballGame.ts` owns the live UI contract and frame loop.
- `src/modes/football/FootballSim.tsx` owns rendering and input.
- Playbook and spatial helpers exist under `src/game/football/playbook` and `src/game/football/spatial`.

The next work should strengthen these boundaries instead of replacing them.

## Gameplay Slice

Implement and tune four concepts:

1. Run play: Inside Zone
2. Pass play: Stick or Quick Slants
3. Base defense: Cover 2 Zone
4. Pressure defense: All-Out Blitz or Cover 0 Pressure

Each concept must have real assignments:
- Offensive line blocks defined threats or zones.
- RB follows aiming points and can cut based on space.
- Receivers run timed routes with break points.
- QB has dropback, set, throw, scramble, and sack behavior.
- Defensive front rushes or fits run gaps.
- Linebackers react to run/pass and pursue.
- Defensive backs drop to zones or match receivers.

The goal is not a huge play menu. The goal is one small set that is physically understandable and fun.

## Simulation Model

Each live player should have:
- Stable `id`, `teamId`, `unit`, `role`
- Position, velocity, facing, acceleration, max speed, agility, strength, awareness
- Assignment type and assignment target
- Current behavior phase
- Control eligibility
- Engagement state for blocking/contact
- Pursuit or route waypoint state
- Optional fatigue/recovery timers for later tuning

The play world should expose one advancement path:

```ts
advanceGameFrame(dtMs, input)
```

That path updates:
- Game clock and play clock
- Active-player input
- AI assignments
- Ball state
- Blocking and shedding
- Passing
- Catch and interception checks
- Tackles and broken tackles
- Whistle conditions
- Camera recommendation
- UI snapshot

Manual stepping helpers can remain as wrappers for tests or compatibility, but live gameplay should use the frame path.

## Movement And Control

Movement should be slower and more readable than the current version.

Recommended feel targets:
- Player acceleration should be visible over several frames.
- Players should not teleport to assignment points.
- Top speed should allow a play to develop for 3-7 real seconds.
- Lateral cuts should have inertia.
- Contact should visibly slow both players.
- Tackles should require proximity, angle, and rating checks.

Control model:
- WASD/arrow keys and mobile stick move the active player.
- `R` or Switch changes active player.
- Primary action is context sensitive: throw, catch attempt, tackle, dive.
- Secondary action is context sensitive: juke, swat, shed, switch target.
- Clicking/tapping an eligible player selects that player.

On offense:
- Start as QB on pass plays and ball carrier on designed runs after the handoff point.
- Let the user aim/move the QB before throwing.
- Receiver targeting should be explicit and visible.
- Control transfers to the receiver or runner when he has the ball.

On defense:
- The user can select one defender pre-snap or live.
- Direct defender control is enabled in this milestone.
- AI continues controlling the other ten defenders.
- Defensive user input affects live position, tackle angle, swat timing, and pursuit.

## Blocking And Contact

Blocking must be stateful instead of cosmetic.

Basic rules:
- Blockers seek their assigned threat or zone.
- Engagement begins when blocker and defender overlap within a contact radius.
- Engagement creates reduced speed for both players.
- Strength and angle determine whether the blocker holds, loses, or steers.
- Defenders can shed after a timer/rating check.
- Ball carrier collision with an engaged block should produce a small steering/slowdown response.

This can be arcade-simple, but it must be visible and deterministic enough to tune.

## Passing And Catching

Passing should use ball travel instead of instant results.

Basic rules:
- QB selects a receiver target.
- Throw creates an in-flight ball with travel time and arc.
- Catch window opens near the target.
- Catch success uses receiver proximity, receiver rating, throw quality, and defender proximity.
- Nearby defenders can swat or intercept.
- Incomplete passes stop the clock and set the ball dead at the previous spot.
- Completed catches transfer control to the receiver.

The first version only needs short throws to feel good. Deep throws can remain less tuned until the core loop works.

## Camera And Screen Sizing

The UI should be mobile-landscape first.

Layout rules:
- Gameplay uses `100dvh` and should not require vertical page scrolling.
- Top HUD stays compact, about 56-72px.
- Bottom controls stay compact, about 96-132px.
- Field fills the remaining height.
- Pre-snap camera frames all 22 players around the line of scrimmage.
- Post-snap camera follows the ball and nearby blockers/defenders.
- If the user asks to "see the whole field," provide a full-field tactical camera toggle, but default gameplay should be closer and more readable.

Player sizing:
- Increase player visual size enough that roles, active selection, and ball possession are obvious.
- Avoid rendering huge empty grass during live action.
- Keep all 22 visible pre-snap, but let live action crop around the ball.

## UI Feedback

The player needs to know what they can do at all times.

Required feedback:
- Active player highlight
- Eligible player rings
- Ball carrier icon
- Throw target indicator
- Route/zone preview before snap
- Compact live status text: "Control QB", "Control RB", "Control Defender"
- Result toast after whistle, not a giant blocking banner
- Defensive possession indicator when the user is controlling defense
- Clear snap/play/whistle/result phases

## Data Flow

1. User selects team and starts game.
2. Opening kickoff sets possession and field position.
3. Pre-snap UI selects offensive play or defensive call based on possession.
4. Play preview builds assignments and shows routes/shells.
5. Snap initializes `PlayWorldSimulation`.
6. `advanceGameFrame(dtMs, input)` updates live play.
7. `FootballSim.tsx` renders the latest snapshot and sends input actions.
8. Whistle derives a `PlayResolution` from live state.
9. Engine applies the resolution to score, down, distance, possession, clock, and quarter.
10. UI returns to play calling or game over.

## Testing

Unit tests:
- `advanceGameFrame` advances on normal 16ms frames.
- Game clock uses elapsed time during live play.
- Play clock expiration triggers delay-of-game handling or an auto-snap fallback, with the chosen behavior made explicit in tests.
- Active-player switching only selects legal players.
- Active-player input changes position over time.
- Ball carrier control changes final live spot.
- Defender control can change tackle timing or angle.
- Blocks engage, persist, and shed.
- Pass catch/interception checks use proximity.
- Whistle resolution is derived from live final state.

Integration/manual tests:
- Mobile landscape viewport has no vertical scroll.
- Pre-snap camera shows all 22 players.
- Post-snap camera follows the ball without losing nearby action.
- User can select and control a defender.
- User can control QB/ball carrier on offense.
- A run play takes several real seconds and remains readable.
- A short pass has target, ball flight, catch window, and result.
- Three consecutive plays advance without crashing.

Regression checks:
- `npm run lint`
- `npm run build`
- `npm test`

## Implementation Boundaries

Keep implementation changes scoped to:
- `src/game/football/playSim`
- `src/game/football/playAnimation`
- `src/game/football/ui-contract`
- `src/game/football/spatial`
- `src/game/football/playbook`
- `src/modes/football/FootballSim.tsx`
- `src/index.css`
- Tests beside changed modules

Avoid broad app rewrites, new frameworks, unrelated menu work, and visual-only Lovable changes until the mechanics are playable.

## Lovable Versus Codex

Use Codex for this milestone. The hard work is simulation, input, camera, tests, and integration with existing code. Lovable can help later with visual polish once the mechanics contract is stable.

Lovable should not own:
- Physics or player movement
- Control state
- Clock behavior
- Possession/down logic
- Animation state machine
- Test coverage

Lovable can later own:
- Pixel art polish
- Menu visual treatments
- HUD styling variations
- Team select presentation
- Optional help overlays

## Acceptance Criteria

1. The field fits the viewport without vertical gameplay scrolling.
2. Pre-snap shows all 22 players around the line of scrimmage.
3. Live play uses a closer camera where player movement is readable.
4. User can select and control a defender during defensive plays.
5. User can control the QB or ball carrier during offensive plays.
6. Players move continuously with acceleration and no teleporting during live play.
7. Blocking changes player movement and can visibly hold or lose leverage.
8. Tackles happen from live contact/proximity, not just scripted endpoints.
9. Passing has visible target, ball flight, catch/interception window, and control transfer.
10. Game clock advances from real elapsed time.
11. Whistle/result derives from the live play state.
12. Existing football game flow continues to support score, quarter, clock, possession, yard line, down, and distance.

## Risks And Mitigations

Risk: Trying to implement too many plays will make tuning impossible.
Mitigation: Tune the four-concept feel garden first.

Risk: Full-field visibility conflicts with player readability.
Mitigation: Use two camera modes: all-22 pre-snap and tighter ball-follow live camera.

Risk: Real football logic can become too complex.
Mitigation: Start with assignment-driven arcade approximations and expose constants for tuning.

Risk: Controls can feel unresponsive if input only changes intent but AI overrides it.
Mitigation: Active-player input must directly influence velocity every frame and tests must prove it changes live position/outcome.

Risk: Lovable visual edits can disturb mechanics.
Mitigation: Keep mechanics in Codex-controlled modules and give Lovable only stable UI contracts later.
