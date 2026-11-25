---
status: draft
---

# Design brief — Guitar Chord Loop (working title)

## The one spatial moment

A seated beginner glances just above and beside the fretting hand to see which fingers go down next. A steady click tells them when to change while both hands stay on the guitar.

## Why it belongs on glasses

The panel occupies a fixed spot in the room next to the task. Both hands stay available after setup. The beginner can glance between the diagrams and the first three frets without turning to a distant screen.

## Product or overlay

An instrument-adjacent practice aid. V1 uses standard SPECS world tracking and manually placed virtual content. Interactive Preview uses an original or cleared seated guitar and fretting-hand reference at a fixed pose. The reference gives the panel a spatial context and supports a repeatable framing comparison.

## Where things live

- Place the open-background panel above and slightly beside the neck, clear of the fretting hand and first three frets. Start around 100–110 cm from the eyes (default), near the downward seated sight line. Start with a roughly 13 × 21 cm stacked layout or 22 × 12 cm side-by-side layout (defaults), then size to fit from the actual preview pose.
- Compare stacked first and side by side second over the same seated camera pose, guitar, hand, depth, text scale, and backgrounds. Capture Em→G and D→Em. Inspect at the playing pose, a downward glance, and a small lean. Choose the layout that keeps both diagrams legible and fully in view while leaving the hand clear. Record the screenshots and rationale. Stacked is the starting hypothesis.
- Use the Snap OS UI Kit default sans serif, bold names, flat grids, white finger dots with readable numbers, and short **Now** and **Next** labels. Keep Now larger and give Next enough size to identify a fingering. Compare bright, dark and busy backgrounds in additive preview. Try the exact Praxais orange (#E17342) on Next and the beat-four cue. Keep a legible label, size hierarchy and visible shape or size pulse when color is removed. If digits disappear against white dots in additive preview, put bright digits just beside their dots. Preserve the open background.
- Commit the panel under a world-space root at confirmation. Position and orientation stay fixed after placement even when the camera pitches or translates. Positioning is session-only. Study the instrument-adjacent cue placement from Snap’s Drum Kit showcase. [Drum Kit](https://newsroom.snap.com/spectacles-drum-kit-paradiddle) · [UI Design](https://developers.snap.com/spectacles/best-practices/design-for-spectacles/ui-design) · [Positioning and Sizing](https://developers.snap.com/spectacles/best-practices/design-for-spectacles/positioning-sizing-content)

## Hands and input

Preview Em untimed. Use standard SIK and UI Kit pinch buttons with hover feedback and generous colliders. Place or Move gates panel manipulation, then confirm and release before pressing Start. Use indirect input at the playing distance. Expose a single Stop affordance outside the chart and away from the hand (default). Hide all setup controls while running. Stop returns to Em setup at the selected tempo and placement. Change tempo or reposition from setup, then Start gets a fresh count-in (default).

## When things show

Setup offers Em, a brief chart legend, Place or Move, a 60 BPM default and a 45 BPM preset. During count-in, show Em and a distinct 1–4 count with one audible click per beat. During play, show the current chord and full-bar Next, with an extra visual cue on beat four. D previews Em. The metronome continues if the panel leaves the view. One down-strum on each bar’s first beat is the default instruction.

### Verified open-position shapes

Standard tuning, columns from low E to high e. A cell gives fret and finger. O means open and X means skip. Finger 1 is index, 2 middle, 3 ring. Use the same orientation in both charts.

| Chord | Low E | A | D | G | B | High e |
|---|---|---|---|---|---|---|
| Em | O | 2 (2) | 2 (3) | O | O | O |
| G | 3 (2) | 2 (1) | O | O | O | 3 (3) |
| C | X | 3 (3) | 2 (2) | O | 1 (1) | O |
| D | X | X | O | 2 (1) | 3 (3) | 2 (2) |

[Fender Em](https://www.fender.com/articles/chords/learn-how-to-play-e-minor-chord) · [Fender G, C and D](https://www.fender.com/articles/chords/essential-beginner-chords-g-c-d) · [Chart notation](https://www.fender.com/articles/chords/how-to-read-a-chord-chart)

## Done criteria

1. Open Interactive Preview and see accurate Em before audio begins. Place and reposition beside the neck with standard preview input. After confirmation, look down and translate. World pose stays constant and the panel moves in screen coordinates.
2. Start at 60 BPM. Hear and see four count-in beats, then four beats each for Em, G, C and D. Hear one click per beat and reach Em again without a gap or extra count-in. Repeat at 45 BPM.
3. Now and Next are correct throughout, including D→Em. Next is visible starting on beat one. Beat four visibly emphasizes the upcoming change. Both layouts are assessed from the same seated pose and the chosen layout preserves the hand view.
4. Stop, change tempo, move, and restart. Verify clicks stop promptly, Em returns, the committed placement holds, and the next run starts with four fresh count-in clicks at the new tempo. Refresh returns to the initial setup and default tempo.

## Out of scope

V1.1 candidates are guitar-following marker tracking and a drum-and-bass groove. Chord recognition, song catalogs, recording in the Lens, and other platforms are outside V1.

## Risks and open questions

- Preview provides logic, framing and a contrast proxy. Glasses readability, comfort, pinch ergonomics, tracking stability, audio latency and beginner playability are pending. Use the one-minute protocol in [Build and verification](build-verification.md).
- Praxais accent source is documented in [Build and verification](build-verification.md).
- Timebox adjustable placement to one focused session (default 90 minutes). If blocked, retain a fixed preset world-space position for preview, log the exact blocker, mark adjustable placement unmet and describe the implemented behavior in the README and demo.
- Prototype one timing source early. Use a monotonic elapsed-time beat index for both visuals and click dispatch, or derive the visuals from a verified audio playback cursor. Confirm real audible playback and visual sync across the seam. Details are in [Build and verification](build-verification.md).

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources

Use the official rules and [Submission package](submission.md) for private repository options. Launching the fresh build conversation with this brief is the scope approval.
