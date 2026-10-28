# Competitor review research → GARAGE fix plan

**Sample (honest numbers):** 2 099 unique public App Store reviews pulled from Apple's official customer-reviews RSS feed (16 storefronts),
17 apps: 3DTuning (1 567), Cartomizer (347), Mods: AI Car Designer (56), WheelsVision (49), Holo Wheels (32), AutoStyle.AI (15) and 11 small AI-tuning apps (< 10 each).
824 are ≤ 3 stars. Google Play / Reddit / G2 were **not** read (no usable access in this session), so everything below is App Store only and
skewed to 3DTuning and Cartomizer. Raw review text is kept locally (not in the repo); script: `pull_apple.py`. Theme counts are keyword matches, not hand-coded — treat as indicative.

Average rating: Holo Wheels 4.69 (32), Cartomizer 4.37 (347), 3DTuning 3.42 (1 567), AutoStyle.AI 2.67 (15), Mods AI 1.25 (56), WheelsVision 1.22 (49).

## What they hate (keyword hits; low-rated ≤3★ in brackets)
1. **Paywall / pay per try / surprise charges** — 279 [231], 12 apps.
   «Scam — Says it is free but everything is locked until u get a subscription.» ([link](https://itunes.apple.com/ca/review?id=6754164821&type=Purple%20Software))
   «…now you have to pay just to add a bumper, takes the fun out of it.» ([link](https://itunes.apple.com/gb/review?id=898369939&type=Purple%20Software))
2. **Crashes / lost progress / ads breaking saving** — 176 [138], 9 apps.
   «…it cant even save any build without an error made by an ad» ([link](https://itunes.apple.com/pl/review?id=898369939&type=Purple%20Software))
3. **Ads, and ads promising what the app can't do** — 73 [50].
   «Nothing at all like the ads. Can't select wheels to change and is ai slop» ([link](https://itunes.apple.com/us/review?id=6755485822&type=Purple%20Software))
4. **Few options / small catalog** — 84 [30], 5 apps.
   «Very few options. — …you only have a few options to chose from, not like the advertising.» ([link](https://itunes.apple.com/us/review?id=6754164821&type=Purple%20Software))

## What is missing
- **Different colours per area + 360° view** — thin (37 / 46 hits, 2–4 apps):
  «…customize different colors to different area. Would have preferred to be able to view projects in 360 views» ([link](https://itunes.apple.com/us/review?id=6753362163&type=Purple%20Software)).
- **Saving / history / undo** — 58 [43], 7 apps (mostly "lost progress").
- **Control over AI output** — Mods AI 1★: «…randomizes what to generate on your uploaded image, not control as to what you want…» (see `reviews_all.csv`).
- **Own-car photo** is what Cartomizer wins on (4.37★): 72 reviews mention own car / photo upload.

## Unsolved
No competitor combines (a) an own-photo editor with manual mask correction, (b) a real rotatable 3D car, and (c) free, local, no-ads use.
Reviewers of AI apps repeatedly say the result cannot be controlled or corrected.

## Fix plan → GARAGE
| # | Fix | Evidence |
|---|-----|----------|
| 1 | No paywall, no ads, no pay-per-try; everything local | themes 1, 3 |
| 2 | Autosave + Undo/Redo + change history, restore last session | theme 2, saving |
| 3 | Manual mask correction on photos, never a black box | Mods AI complaint |
| 4 | Body + wheel colours independent, 360° orbit, hold-to-compare | missing theme |
| 5 | Honest scope: AI tab says "needs setup" instead of faking results | theme 3 |
| 6 | Adaptive graphics quality so weak phones never freeze | theme 2 |

Angle: *For people tired of paying per try-on and losing their build — a free, local 3D + photo tuning studio with undo, history and autosave.*
Reviewer words are research only; they are not used as testimonials.
