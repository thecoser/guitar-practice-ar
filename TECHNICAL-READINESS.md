# Guitar Practice AR technical readiness

Guitar Practice AR is a SPECS MVP for practicing guitar with chord diagrams, lyrics, and timing cues in view. The submitted project is designed to run in Lens Studio desktop Preview. The 1:32 demo shows the current build in that environment.

## How to verify

Open `Guitar Practice MVP.esproj` in Lens Studio 5.25 and use SPECS Interactive Preview with the Evening Room scene. Allow a few minutes for first-time asset processing and TypeScript compilation. Refresh Preview if it still shows **Preview is Not Ready** after those tasks finish. The animated logo gives way to **Choose a song**.

| Flow | Expected result |
| --- | --- |
| Place chart and cues | Move the chart beside the simulated guitar. The chart and neck cues can be positioned independently. The placement controls find clear space around the chord diagrams. |
| Play Home on the Range | After the count-in, current and upcoming chords, lyrics, and timing cues update as the backing track and wordless melody play. |
| Practice a chord change | Add G and C in **Chord practice**, adjust the tempo, then select **Play loop**. The sequence repeats. |
| Import and save a chart | From **Add my own**, open **Import chart**, choose **Use scanned page**, and review the included original **Morning Light** chart. Save it and confirm it appears in **My songs**. |

## Scope

Chart placement is manual. The guitar and hands are a fixed illustration in Preview. The neck overlays follow playback and are registered to that illustration. The included chart lets reviewers try import and save using the files in the repository. A separate macOS helper can prepare a chart from a scanned page.

## Verification status

The current working build was exercised in desktop Preview and captured for the demo. In a separate Lens Studio instance, a fresh extraction of the submission project compiled successfully and reached **Choose a song** after the launch animation. The fresh-extraction check covered startup. The feature walkthrough was verified in the working project.
