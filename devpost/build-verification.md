# Build and verification

## Toolchain smoke test

Nov. 19, 2026. Lens Studio 5.25.0.26111423, fresh Base Template, SPECS 27 Interactive Preview. Installed the organizer’s `plan-lens` pack and Snap’s `ls-clad` 1.1.0. Used CLAD scene construction and preview verification guidance with Lens Studio MCP. Captured the original preview, created a temporary Text preset, placed it in view, changed the visible text to “CLAD,” and confirmed it in the running panel. Removed the object via MCP. Scene snapshots returned to 119 objects and 55 assets, matching baseline. V1 work starts in a fresh conversation.

## Milestones (target dates)

| By | Evidence |
|---|---|
| Nov. 23 | Full 60 BPM loop in preview with four verified charts, audible count-in and metronome, synchronized chord changes and D→Em. |
| Nov. 27 | Verify 45 BPM, Stop and restart, world placement or documented preset fallback, same-view stacked and side-by-side captures, light/dark contrast. |
| Dec. 2 | LEAF, manual QA, README preview instructions, clean-checkout rehearsal and fixes. Use available glasses and a beginner or record the remaining tests as pending. |
| Dec. 4 | Record the rehearsed candidate. Confirm a first-time viewer can explain the problem, what happened and why it helps. |
| Dec. 7 before 5 p.m. Eastern | Entrant verifies repository and video links, completes Devpost submission, and confirms receipt. |

## Timing acceptance

Use one beat index derived from one timing source. Compute phase from an absolute epoch to avoid accumulating timer delays. For a frame-driven implementation, derive state from the latest beat after a stall and avoid firing a backlog of clicks. Alternatively, prototype exact-duration original click audio and use the playback cursor for visual timing. Verify cursor and loop seam before committing. Audio expected at every beat, including bar starts and wrap. [Snap AudioComponent API](https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.AudioComponent.html)

| From first count-in click | 60 BPM | 45 BPM |
|---|---:|---:|
| Beat interval | 1.000 s | 1⅓ s |
| First Em | 4.000 s | 5⅓ s |
| G | 8.000 s | 10⅔ s |
| C | 12.000 s | 16.000 s |
| D | 16.000 s | 21⅓ s |
| Back to Em | 20.000 s | 26⅔ s |
| Length of one loop | 16.000 s | 21⅓ s |

## Preview QA

1. Start from the README’s reproducible Lens Studio entry point in SPECS Interactive Preview. Start from reset and compare every diagram and open or skipped string indicator to the brief. Capture setup and at least one D→Em transition.
2. Run three uninterrupted loops at 60 BPM, then Stop, pick 45, and run three more. Record preview with audio and compare clicks to beat cues and change frames. Check counts and intervals, one audible click per beat and no seam hiccup or accumulating lead or lag. Working capture target is a visual onset within two video frames of the corresponding click, allowing for measured capture offset (default). Report measured offset, any drift and capture frame rate.
3. Move the panel twice and begin from the second pose. Verify fixed world transform and changed projection under downward pitch and lateral movement. Verify the fretting hand and first three frets are clear at the intended playing pose. Run the reverse tempo change and refresh. Check that no setup input or stale click survives Stop or refresh.
4. Add and run LEAF scenarios for setup/placement, both tempos and chord sequence, Next and beat cues, and Stop/restart. Cover unautomatable assertions with manual evidence. Use recording for audibility, screenshots for layout and contrast, and runtime state for anchoring. Report exact repro from reset, BPM, beat or pose, expected and observed behavior, severity, and smallest correction. Fix and rerun affected checks.
5. **One-minute beginner test.** Let a seated beginner read the legend and place the panel, then play with one down-strum per bar for one minute. Ask which shape goes down now and which is next. Observe whether they find both at a glance, keep their fretting hand visible, and prepare through G→C and C→D. Repeat at 45 if 60 is too fast. Note missed shapes, head movements, comfort and lighting. Desktop review covers framing and timing. Real beginner feedback and actual glasses readability, comfort and playability remain pending until tested.

## Planning reviews

- **SPECS engineering, high.** Separate timers risk drift. Verify one beat source with captured audio and video. The template uses World device tracking. Check an unchanged world pose under camera pitch and translation.
- **Wearable UX, high.** Additive display weakens contrast against bright and busy backgrounds. Same-view A/B, clear hand area, readable finger numbers and non-color cues are the smallest useful checks.
- **Guitar review, moderate.** G→C and C→D move three fingers. Keep Next visible for the full bar, use one down-strum and allow the 45 BPM preset. The fingerings were verified against Fender.
- **QA review pending running build.** Give the reviewer the README entry point and this protocol once the loop runs. Capture audible evidence, both tempos, repeated loops, reset and reposition.
- **Submission review, high.** Show a continuous native-audio 60 BPM count-in through wrap and replay at 45. Label footage “Lens Studio preview” and verify repo access separately from clean checkout.

## Praxais accent

Use **#E17342** (sRGB 225, 115, 66), the exact Praxais orange confirmed by the user. Use the hex directly so the project can travel without a private source asset.
