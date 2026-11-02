# Control Block Lab – מעבדת דיאגרמות בלוקים

Build control block diagrams (G, H, Σ, pick-offs), then watch them reduce **step by step with animation** to the overall transfer function G_T — with a bilingual (Hebrew/English) explanation and KaTeX equations for every step. Sister app of [Circuit Lab](https://circuit-lab-ofir.surge.sh).

## Features
- **Canvas editor**: input R, output C, forward blocks G, feedback blocks H (flipped), summing junctions with +/− per input, pick-off points. Drag, wire, flip, undo/redo, pinch/zoom, mobile layout.
- **Block names + expressions**: name = algebra symbol (`G1`, `H2`, `K`, `β`); optional expression (`10/(s+1)`, `K/(s*(s+2))`). Toggle results "by names" / "with expressions".
- **Successive reduction (core)**: series, parallel, feedback loop `G/(1±GH)`, unity feedback, splitting a multi-input sum, and — when loops interlock — moving pick-off points / sums past blocks (adds G or 1/G). Innermost loop first, so the board exercise produces G_T1 → G_T2 → G_T3.
- **Animated steps**: highlight the sub-diagram → collapse → new block pops in. Pause / step / jump with the player (⏮ ◀ ▶ ▶| ⏭, speed 0.5–2×) or by clicking any step in the sidebar (Start … Final). "Replay from here".
- **Every step explained**: rule name, why it is allowed (teaching tone), derivation for loops, equation before→after, and the same block expanded in the original symbols.
- **Solver check**: Mason's gain formula computed independently and compared with the reduction; a "Check your answer" box tests any candidate G_T for equivalence and shows a numeric counter-example if wrong; topology warnings (open path, unsigned sum input, block with 2 inputs, algebraic loop, loop without a sum, …) each with why + how to fix.
- **Presets**: the board exercise (3 nested loops, 3 sums), the same with one 4-input sum, single loop, parallel+series, interlocking loops, op-amp-as-loop.
- **Export**: PNG, SVG, Print/PDF (diagram + all steps + equations), JSON save/load.

The board exercise reduces to exactly
`G_T = G1·G2·G3 / (1 + G1·H1 + G1·G2·H2 + G1·G2·G3·H3)` (verified against Mason).

## Run locally
Open `index.html` in a browser — no build, no server needed. KaTeX loads from cdnjs; offline, equations fall back to plain text.

Editing the source: files live in `src/` (`head.html`, `engine.js`, `presets.js`, `link.js`, `app.js`). Rebuild the single file with:
```bash
./build.sh
```
`src/engine.js` is pure JS and can be tested in Node: `node -e "const E=require('./src/engine.js');console.log(E.rfText(E.parseExpr('G1G2/(1+G1H1)')))"`.

## Deploy (Surge)
```bash
npx --yes surge . control-block-lab-ofir.surge.sh
```
Deploy only `index.html` + `README.md` (the `src/` folder and `build.sh` are fine to include, they are not used at runtime).
If deploying from a Claude session fails (network blocked there), hand the files to Grok Bot / Ofir. **Never paste Surge secrets into chat** — ask Ofir to provide `surge.env` through a secure channel if a token is really needed.
Do **not** deploy over `circuit-lab-ofir.surge.sh` or `servo-amplifiers-ofir.surge.sh`.

## Link format shared with Circuit Lab — `ofir-lab-link/v1`
Both apps save/load the same envelope:
```json
{
  "schema": "ofir-lab-link/v1",
  "app": "control-block-lab",            // or "circuit-lab" (who created it)
  "kind": "block-diagram",                // or "circuit"
  "title": "…",
  "template": "non-inverting-amp",        // optional: non-inverting-amp | inverting-amp | voltage-follower
  "notes": { "he": "…", "en": "…" },       // optional, shown to the student
  "data": { "nodes": [...], "edges": [...] },   // circuit: { "parts": [...], "wires": [...] }
  "createdAt": "ISO date"
}
```
- **Deep link**: `https://control-block-lab-ofir.surge.sh/#link=<base64url(JSON)>` (and the same on `circuit-lab-ofir.surge.sh`). The hash is cleared after import.
- **Unknown fields are preserved**: extra top-level keys survive load → save, and the app tells the user how many were kept.
- **Wrong kind**: opening a `circuit` file here (or a `block-diagram` file in Circuit Lab) offers to open it in the other app instead of loading it.
- **Offline**: every link action also has "download link file"; the other app loads it via Load JSON.

Block diagram data: `nodes: [{id, type: R|C|G|S|P, x, y, name?, expr?, flip?}]`, `edges: [{id, from, to, port: in|W|N|S, sign: 1|-1}]` (`port`/`sign` matter for sums).

### Templates (analogy only, not a general translation)
| Circuit (one op-amp) | Block diagram |
|---|---|
| Non-inverting amp | R → Σ → A → C, feedback β = R1/(R1+Rf) with − |
| Voltage follower | same loop with unity feedback (β = 1) |
| Inverting amp | R → K = Rf/(Rin+Rf) → Σ(−) → A → C, feedback β = Rin/(Rin+Rf) with − |

From the block side, a single negative-feedback loop (R → Σ → G → C with feedback H) maps back to a non-inverting amp (or a follower when H = 1). Anything else shows a bilingual "no mapping yet" message.
