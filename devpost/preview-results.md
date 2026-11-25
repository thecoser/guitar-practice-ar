# Preview verification

Lens Studio 5.25.0.26111423, SPECS 27 stereo Interactive Preview. The project uses an original procedural guitar and fretting-hand reference and an original 80 ms metronome click. The fixture is enabled only in editor Preview.

## Playback

| Tempo | First return to Em | Second return | Third return | Contiguous beat dispatches through third return |
|---|---:|---:|---:|---:|
| 60 BPM | 20.022 s | 36.003 s | 52.018 s | 53 of 53 |
| 45 BPM | 26.811 s | 48.021 s | 69.348 s | 53 of 53 |

Times are elapsed Preview runtime at the beat dispatch. Each run started with four count-in beats and used the same clock for the visual cue and native AudioComponent call. There were no skipped indices, duplicate dispatches, or extra count-ins. The worst single dispatch was 44 ms late at 60 BPM and 144 ms late at 45 BPM. The final wraps were 18 ms and 14 ms late respectively, consistent with frame scheduling and without a growing offset in these runs. The AudioComponent reported playing for every dispatch. This evidence measures code and engine state. Speaker audibility, audio-to-video offset, and capture frame rate remain unmeasured because macOS denied the system-audio capture attempt.

## Layout and contrast

Both layouts used Evening Room, the same fixture, chart text scale and depth, with the camera at the origin pitched 12° down. The downward glance was 18° down. The lean added a 7 cm translation to the right at that pitch.

| View | Stacked | Side-by-side |
|---|---|---|
| Em with G next | [Capture](evidence/stacked-em-to-g.png) | [Capture](evidence/side-by-side-em-to-g.png) |
| D with Em next on beat four | [Capture](evidence/stacked-d-to-em.png) | [Capture](evidence/side-by-side-d-to-em.png) |
| Downward glance | [Capture](evidence/stacked-downward-glance.png) | [Capture](evidence/side-by-side-downward-glance.png) |
| Downward glance and lean | [Capture](evidence/stacked-small-lean.png) | [Capture](evidence/side-by-side-small-lean.png) |

Both layouts clear the fretting hand and first three frets at the seated pose. The stacked Now heading disappeared during the downward glance and lean. Side-by-side kept both names and grids visible and is the saved default. The grids and adjacent finger digits are white. Next and the enlarged fourth-beat cue use Praxais orange `#E17342`, with labels and size differences carrying the same information.

The charts remained readable at capture scale in [Sunlit Room](evidence/contrast-bright.png) and [Colorful Home](evidence/contrast-busy.png). The orange label and thin white lines had less contrast on bright surfaces. The default recording scene is Evening Room. [Untimed Em setup](evidence/setup-em.png)

## Room-fixed placement

Using Preview pinches, two placements were committed at approximately (4.962, −11.909, −104.204) and (7.919, −8.927, −104.149) cm. The second world position and quaternion (−0.042500, −0.047415, −0.002019, 0.997969) were identical before and after the camera pitched down and moved laterally. The chart moved in the projected view. Start issued a fresh count-in at the second committed pose.

[Second placement](evidence/placement-second-committed.png) · [After pitch and lean](evidence/placement-after-pitch-and-lean.png)

## LEAF

All four scenarios passed in Preview. Setup/placement covers Em defaults, Place, Confirm and the committed transform. The 60 and 45 BPM tests check all 21 beat indices through the first return to Em, chart labels and fingering, full-bar Next, the beat-four emphasis, and one native click dispatch per beat. Stop/restart checks that dispatch stops, tempo and pose persist, and a fresh count-in starts after a tempo change. Audibility, the camera's projected view, and layout contrast use separate Preview checks.

CLAD's synthetic right-hand Start pinch was intermittent with pinch-only targeting. Left-hand simulation and LEAF's indirect input exercised Start, Stop, and placement. Physical pinch ergonomics, readability on glasses, the one-minute beginner trial, and first-time viewer feedback remain pending.

## Clean-checkout rehearsal

Candidate commit `54009ab2a32aaf27e1f518a4782000934d17913a` was created in a temporary local repository and cloned to a separate checkout. Lens Studio opened the clean path with the original closed, compiled the project, and reached Em setup from the README steps. The project, assets, and packages contained no references to the original workspace path. Lens Studio added its generated ignore rules on open.

One complete loop at each tempo passed from the checkout. The 60 BPM return to Em was at 20.014 s and the 45 BPM return was at 26.669 s. Both runs had the expected chord order, full-bar Next and 21 consecutive native audio dispatches through the wrap. [Clean-checkout playback](evidence/clean-checkout-playback.png)

## 60 BPM recording rehearsal

The supplied 52.23 s screen recording contains a 48 kHz stereo audio track and 38 distinct metronome transients at roughly one-second intervals. It shows the four-beat count-in, all four chords, and the first return to Em at about 28.74 s of the clip. The captured click for that return follows the visible cue by about 49 ms. Across the clip, the click generally follows the cue by roughly 30–65 ms, with no evident accumulating drift. The nominal video rate is 50.8 fps and frame spacing varies. The raw offset exceeds the two-frame target at some beats. The audio capture path has not been calibrated separately, so this measures the recorded result.

## 45 BPM recording rehearsal

The supplied 38.20 s clip contains 28 distinct metronome transients at approximately 1.33 s intervals. The first four are the count-in. The visual return to Em is at approximately 28.40 s in the clip, 26.64 s after the first visual count-in cue. The corresponding click is at about 28.44 s, around 42 ms after the visual cue. Frame spacing varies and the nominal video rate is 45.4 fps. The recorded offsets were similar throughout the first loop, without evident accumulating drift. The wrap offset is about two nominal frame intervals, and some individual beats exceed that target before any capture-offset correction.
