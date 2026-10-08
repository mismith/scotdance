/// <reference lib="dom" />
// The App Store's product page header (iOS 27): the dancer colours as one
// sheet of silk, softly folded, swaying a little on a seamless 20 s loop.
// Apple lays the app's icon, name and Get button over it and crops it to fit
// each device, so it carries no words or marks and its colour runs to every
// edge. Search results keep the first three screenshots (shots.ts).
//
//   node store/creative.ts          the loop, where upload.ts reads it
//   node store/creative.ts still    its first frame, as a PNG, to look at
//
// Apple's specs (its asset library's reference data): 3840 × 1646, 30 or 60
// fps, 10 to 30 s, no sound needed; a still must be a PNG with no alpha.
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

/** Where the creative assets go, a folder per language, as fastlane keeps screenshots. */
export const CREATIVE = new URL('../../ios/App/fastlane/creative/', import.meta.url)
  .pathname
const OUT = new URL('./out/creative/', import.meta.url).pathname
const W = 3840
const H = 1646
const SECONDS = 20
const FPS = 30

// The dancer colours (style.css), cool to warm, so every neighbour blends
// clean (green never meets orange): deep, and the luminous ones the app uses
// in dark mode, which the folds catch the light in.
const DEEP = ['#1d6a48', '#00707a', '#0065bd', '#6a3fa0', '#b0266e', '#b04a00']
const GLOW = ['#3fa676', '#3fc2c9', '#62aaf0', '#9b75d6', '#ec6fae', '#f28a3c']

/** How far the folds push the colours along (a share of the width), how much light they catch, and how many fit in the height. */
const SWAY = 0.16
const SHEEN = 1
const FOLDS = 1.45

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
/** A hex colour in OKLab, so the shader blends neighbours without going grey. */
function oklab(h: string) {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

const SHADER = `precision highp float;
uniform vec2 res;
uniform float t;
uniform vec3 deep[${DEEP.length}];
uniform vec3 glow[${DEEP.length}];
const int N = ${DEEP.length};
const float TAU = 6.2831853;

// Each wave's phase round the loop: a sway, so t = 1 is t = 0.
float ph(float k) { return 0.9 * sin(TAU * t + k); }

// The sheet's height: a few slow waves.
float h(vec2 p) {
  return 0.55 * sin(p.y * 2.3 + p.x * 1.1 + ph(0.0) + 0.4)
       + 0.30 * sin(p.y * 4.1 - p.x * 1.9 - ph(2.1) + 1.9)
       + 0.25 * sin(p.x * 3.3 + p.y * 1.4 + ph(4.2) + 4.2)
       + 0.12 * sin(p.x * 6.1 - p.y * 5.2 + ph(1.3) + 2.6);
}

vec3 ramp(float s, bool lit) {
  s = clamp(s, 0.0, 1.0) * float(N - 1);
  vec3 c = lit ? glow[0] : deep[0];
  for (int i = 0; i < N - 1; i++) {
    float k = smoothstep(0.0, 1.0, clamp(s - float(i), 0.0, 1.0));
    c = mix(c, lit ? glow[i + 1] : deep[i + 1], k);
  }
  return c;
}

vec3 srgb(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  vec3 c = clamp(vec3(
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s), 0.0, 1.0);
  return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  uv.y = 1.0 - uv.y;
  vec2 p = vec2(uv.x * res.x / res.y, uv.y) * ${FOLDS.toFixed(2)};
  float e = 0.003;
  float z = h(p);
  vec2 grad = vec2(h(p + vec2(e, 0.0)) - z, h(p + vec2(0.0, e)) - z) / e;
  float s = uv.x + ${SWAY.toFixed(2)} * z;
  // Light from the top left: folds facing it glow in their own bright
  // colour, folds turned away deepen a touch (never to mud).
  float lit = dot(normalize(vec3(-grad * 0.22, 1.0)), normalize(vec3(-0.5, 0.6, 0.62))) - 0.62;
  vec3 lab = mix(ramp(s, false), ramp(s, true), clamp(${SHEEN.toFixed(2)} * lit * 1.6, 0.0, 0.85));
  lab.x += ${SHEEN.toFixed(2)} * min(lit, 0.0) * 0.18;
  // Light from above overall, as the screenshots' fields fall off.
  lab.x += 0.05 * (0.45 - uv.y);
  gl_FragColor = vec4(srgb(lab), 1.0);
}`

// The screenshots' grain (compose.ts), which also keeps the gradients from banding.
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

const lab = (cs: string[]) => JSON.stringify(cs.map(oklab).flat())

/** The page: the silk on a canvas, the grain over it, and `frame(t)` to draw it at t (0 to 1) round the loop. */
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0}
#art{position:relative;width:${W}px;height:${H}px;overflow:hidden}
canvas{position:absolute;inset:0}
.grain{position:absolute;inset:0;background-image:${GRAIN};background-size:320px;opacity:.07;mix-blend-mode:overlay}
</style></head><body><div id="art"><canvas width="${W}" height="${H}"></canvas><div class="grain"></div></div>
<script>
const gl = document.querySelector('canvas').getContext('webgl', { preserveDrawingBuffer: true })
const sh = (type, src) => {
  const s = gl.createShader(type)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
  return s
}
const pr = gl.createProgram()
gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }'))
gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, ${JSON.stringify(SHADER)}))
gl.linkProgram(pr)
gl.useProgram(pr)
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
gl.enableVertexAttribArray(0)
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
const u = (k) => gl.getUniformLocation(pr, k)
gl.uniform2f(u('res'), ${W}, ${H})
gl.uniform3fv(u('deep'), new Float32Array(${lab(DEEP)}))
gl.uniform3fv(u('glow'), new Float32Array(${lab(GLOW)}))
window.frame = (t) => { gl.uniform1f(u('t'), t); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish() }
window.frame(0)
</script></body></html>`

/** Draw `frames` frames round the loop in Chrome, handing each to `take` as a PNG. */
async function draw(
  frames: number,
  take: (png: Buffer, i: number) => Promise<void> | void,
) {
  mkdirSync(OUT, { recursive: true })
  const page0 = `${OUT}header.html`
  writeFileSync(page0, html)
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } })
    await page.goto(`file://${page0}`)
    for (let i = 0; i < frames; i++) {
      await page.evaluate(
        (t) => (window as unknown as { frame: (t: number) => void }).frame(t),
        i / frames,
      )
      await take(await page.screenshot(), i)
    }
  } finally {
    await browser.close()
  }
}

/** The loop, as H.264 (Apple's app preview codec), into the en-CA folder upload.ts reads. */
export async function header(file = `${CREATIVE}en-CA/header.mp4`) {
  mkdirSync(file.slice(0, file.lastIndexOf('/')), { recursive: true })
  const ffmpeg = spawn(
    'ffmpeg',
    // A low CRF and aq-mode 3: ordinary settings band smooth colour.
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'image2pipe',
      '-framerate',
      String(FPS),
      '-i',
      '-',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '12',
      '-x264-params',
      'aq-mode=3',
      '-profile:v',
      'high',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-an',
      file,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  )
  const done = new Promise<void>((ok, fail) =>
    ffmpeg.on('close', (code) =>
      code ? fail(new Error(`ffmpeg exited ${code}`)) : ok(),
    ),
  )
  await draw(SECONDS * FPS, async (png, i) => {
    if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once('drain', r))
    if (i % FPS === 0) process.stdout.write(`\r  header: ${i / FPS} of ${SECONDS} s`)
  })
  ffmpeg.stdin.end()
  await done
  console.log(`\r  header: ${file.slice(file.indexOf('ios/'))}`)
}

/** The first frame, flattened to RGB (a screenshot's PNG carries alpha). */
async function still(file = `${OUT}header.png`) {
  await draw(1, (png) => {
    writeFileSync(`${OUT}raw.png`, png)
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      `${OUT}raw.png`,
      '-pix_fmt',
      'rgb24',
      file,
    ])
    rmSync(`${OUT}raw.png`)
  })
  console.log(`  header still: ${file}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await (process.argv[2] === 'still' ? still() : header())
}
