# Bundled model

`car.glb` — **Car Concept**, © 2024 Eric Chadwick / Darmstadt Graphics Group GmbH, licensed **CC BY 4.0**
(https://creativecommons.org/licenses/by/4.0/). Source: Khronos glTF-Sample-Assets,
https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept (file `glTF-Binary/CarConcept.glb`, 11.8 MB).
**Changes made (CC BY requires noting them):** re-encoded with gltf-transform — meshopt geometry compression, WebP textures, texture size capped
at 2048px (`car.glb`) / 1024px (`car-mobile.glb`). Geometry, node names and materials are otherwise unchanged. Source kept in `models-src/`.
The attribution must stay visible in the UI (configurator side panel) and in this repo.

How the app uses it (`src/scene/ModelCar.tsx`): paint = material `Paint 1 Carmine`; lamps = `Headlight` / `Brakelight`;
stock wheels = nodes `WheelFrontL/R`, `WheelRearL/R` (hidden when a custom wheel design is chosen); ride height moves the body node while
wheel nodes are counter-offset. If the file is missing, the procedural car in `src/scene/Car.tsx` is shown instead.

---
# Replacing it with another model

The bundled car (`src/scene/Car.tsx`) is a procedural demo — **not** a real production model.
To use a licensed glTF/GLB (check the license: CC0 / CC-BY / purchased with commercial rights), export it with
these separately named nodes so each customization is a real swap:

| Node name        | Purpose                                   |
|------------------|-------------------------------------------|
| `Body`           | paintable shell (single PBR material)     |
| `Glass`          | windows (kept out of repaint)             |
| `Headlight_L/R`, `Taillight_L/R` | emissive lamp meshes        |
| `Wheel_FL/FR/RL/RR` | wheel pivots at hub centre, axis = Z   |
| `Bumper_F_*`, `Bumper_R_*`, `Spoiler_*`, `Skirt_*` | optional aero variants (toggle visibility) |

Requirements: ≤ 150k triangles for mobile, textures ≤ 2048², KTX2/Basis or WebP, Draco/meshopt compressed
(`gltf-transform optimize`). Place under `public/models/` and load with drei `useGLTF`.
A single-mesh model (e.g. from photo reconstruction) can be shown and repainted only as a whole —
wheel / bodykit swapping is unavailable for it, and the UI must not offer it.


---
# Low-poly cars (`lowpoly/`)

`sedan`, `sedan-sports`, `hatchback-sports`, `suv-luxury`, `race`, `race-future` — **Kenney Car Kit 3.1**, © Kenney (www.kenney.nl),
**Creative Commons Zero (CC0 1.0)**, downloaded from https://kenney.nl/assets/car-kit (licence text kept as `lowpoly/LICENSE-Kenney-CC0.txt`).
Files are unchanged GLBs from the kit's `GLB format` folder plus its `Textures/colormap.png` palette. CC0 does not require credit; the UI credits Kenney anyway.
How the app uses them (`src/scene/LowPolyCar.tsx`): the cars have a single material with a palette texture, so the body colour is changed by repainting
the one palette cell that holds the paint (`CARS[].paint` in `src/lib/catalog.ts`), keeping its gradient. Wheels, lights, glass and aero are not separate swaps there.
