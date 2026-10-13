// Puts the creative assets (creative.ts) on the App Store version being
// prepared: the product page header, and a search results asset if there's
// one, for each language with a folder in ios/App/fastlane/creative/. Only
// when that version is this checkout's (package.json), so a v4 header can't
// land on a v3 release being prepared. fastlane can't do
// these yet, so this talks to App Store Connect's asset library directly:
// reserve, upload, commit, wait for processing, then place the asset on the
// version's localization in place of whatever was there.
//
// Each upload is named for its file's hash, so a re-run with unchanged files
// changes nothing, and a replaced upload of ours is deleted once it's off the
// page (Apple only lets an asset be deleted before it's been reviewed). Like
// the screenshots, they show once the version is released.
//
//   node store/upload.ts           upload and place
//   node store/upload.ts --plan    only say what it would do
//
// Key: the App Store Connect API key in the login keychain
// (docs/store-screenshots.md › Keys).
import { execFileSync } from 'node:child_process'
import { createHash, sign } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { CREATIVE } from './creative.ts'

const ROOT = new URL('../../', import.meta.url).pathname
const VERSION = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8')).version
const BUNDLE = 'info.mismith.scotdance'
const API = 'https://api.appstoreconnect.apple.com'

/** Each creative asset's file name, and where it goes. */
const PLACEMENTS = {
  header: 'PRODUCT_PAGE_HEADER_ASSET',
  search: 'APP_STORE_SEARCH_RESULTS_ASSET',
} as const

/** Versions whose page can still change. */
const EDITABLE = [
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
]

const plan = process.argv.includes('--plan')

function keys() {
  let item: string
  try {
    item = execFileSync('security', ['find-generic-password', '-s', 'scotdance-asc', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    throw new Error("scotdance-asc isn't in the login keychain: see docs/store-screenshots.md (Keys).")
  }
  const { key_id, issuer_id, key } = JSON.parse(item)
  return { id: key_id as string, issuer: issuer_id as string, pem: key as string }
}
const KEY = keys()

const b64 = (v: object | Buffer) =>
  (Buffer.isBuffer(v) ? v : Buffer.from(JSON.stringify(v))).toString('base64url')

/** A fresh token each request: processing can outlast one. */
function token() {
  const now = Math.floor(Date.now() / 1000)
  const head = `${b64({ alg: 'ES256', kid: KEY.id, typ: 'JWT' })}.${b64({ iss: KEY.issuer, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' })}`
  return `${head}.${b64(sign('sha256', Buffer.from(head), { key: KEY.pem, dsaEncoding: 'ieee-p1363' }))}`
}

// JSON:API documents, read loosely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any

async function api(method: string, path: string, body?: object): Promise<Doc> {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** An image or a video in the library: their resources differ only in name. */
const kind = (file: string) =>
  /\.(mp4|mov|m4v)$/i.test(file)
    ? ({ type: 'appAssetLibraryVideos', rel: 'video' } as const)
    : ({ type: 'appAssetLibraryImages', rel: 'image' } as const)

/** Reserve, upload, commit, and wait for processing. */
async function upload(library: string, file: string, name: string) {
  const { type } = kind(file)
  const bytes = readFileSync(file)
  const res = await api('POST', `/v1/${type}`, {
    data: {
      type,
      attributes: {
        fileName: file.split('/').pop(),
        fileSize: bytes.length,
        category: 'CREATIVE_ASSETS',
        referenceName: name,
        // A video's still, wherever it shows before it plays: the loop's first frame.
        ...(type === 'appAssetLibraryVideos'
          ? { previewFrameTimeCode: '00:00:00:00' }
          : {}),
      },
      relationships: {
        assetLibrary: { data: { type: 'appAssetLibraries', id: library } },
      },
    },
  })
  const id = res.data.id
  await Promise.all(
    res.data.attributes.uploadOperations.map(async (op: Doc) => {
      const put = await fetch(op.url, {
        method: op.method,
        headers: Object.fromEntries(op.requestHeaders.map((h: Doc) => [h.name, h.value])),
        body: bytes.subarray(op.offset, op.offset + op.length),
      })
      if (!put.ok) throw new Error(`Uploading ${file}: ${put.status} ${await put.text()}`)
    }),
  )
  await api('PATCH', `/v1/${type}/${id}`, {
    data: { type, id, attributes: { uploaded: true } },
  })
  for (let i = 0; ; i++) {
    const { data } = await api('GET', `/v1/${type}/${id}`)
    const state = data.attributes.state
    if (state === 'FAILED')
      throw new Error(
        `App Store Connect couldn't process ${file}: ${JSON.stringify(data.attributes.stateDetails)}`,
      )
    if (!['AWAITING_UPLOAD', 'UPLOAD_COMPLETE'].includes(state)) return data
    if (i > 90) throw new Error(`${file} is still processing after 15 minutes`)
    await sleep(10_000)
  }
}

const say = (s: string) => console.log(`  ${s}`)

const { data: apps } = await api('GET', `/v1/apps?filter[bundleId]=${BUNDLE}`)
const app = apps.find((a: Doc) => a.attributes.bundleId === BUNDLE)
const { data: versions } = await api(
  'GET',
  `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&fields[appStoreVersions]=versionString,appVersionState&limit=10`,
)
const version = versions.find((v: Doc) => EDITABLE.includes(v.attributes.appVersionState))
if (!version)
  throw new Error('No version being prepared in App Store Connect: create it first.')
if (version.attributes.versionString !== VERSION) {
  console.log(
    `App Store Connect is preparing ${version.attributes.versionString}, not ${VERSION}: creative assets left alone.`,
  )
  process.exit(0)
}
console.log(
  `ScotDance ${VERSION} (${version.attributes.appVersionState})${plan ? ', plan only' : ''}`,
)

const { data: library } = await api('GET', `/v1/apps/${app.id}/assetLibrary`)
const ref = (await api('GET', '/v1/appAssetLibraryRefData')).data[0].attributes
const { data: localizations } = await api(
  'GET',
  `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale`,
)

const locales = existsSync(CREATIVE)
  ? readdirSync(CREATIVE).filter((l) => !l.startsWith('.'))
  : []
if (!locales.length) console.log(`Nothing in ${CREATIVE}: run \`npm run store:header\` first.`)

for (const locale of locales) {
  const loc = localizations.find((l: Doc) => l.attributes.locale === locale)
  if (!loc) {
    say(`${locale}: the version has no such language, skipped`)
    continue
  }
  const files = readdirSync(CREATIVE + locale)
  for (const [name, placementType] of Object.entries(PLACEMENTS)) {
    // A video wins over a still of the same name.
    const file = ['mp4', 'mov', 'png', 'jpg']
      .map((ext) => `${name}.${ext}`)
      .find((f) => files.includes(f))
    if (!file) continue
    const path = `${CREATIVE}${locale}/${file}`
    const { type, rel } = kind(path)
    const hash = createHash('sha256')
      .update(readFileSync(path))
      .digest('hex')
      .slice(0, 12)
    const refName = `store ${name} ${hash}`

    const placed = await api(
      'GET',
      `/v1/appStoreVersionLocalizations/${loc.id}/placements?filter[placementType]=${placementType}&include=image,video`,
    )
    const assetOf = (p: Doc) => {
      const link = p.relationships?.image?.data ?? p.relationships?.video?.data
      return (
        link &&
        placed.included?.find((x: Doc) => x.type === link.type && x.id === link.id)
      )
    }
    if (placed.data.some((p: Doc) => assetOf(p)?.attributes.referenceName === refName)) {
      say(`${locale} ${name}: already up (${file})`)
      continue
    }
    if (plan) {
      say(
        `${locale} ${name}: would upload ${file} and replace ${placed.data.length} placement(s)`,
      )
      continue
    }

    // The same file may already be in the library (another language, or a run that stopped short).
    const found = await api(
      'GET',
      `/v1/appAssetLibraries/${library.id}/${rel}s?filter[referenceName]=${encodeURIComponent(refName)}`,
    )
    const ready = found.data.find(
      (a: Doc) =>
        !['AWAITING_UPLOAD', 'UPLOAD_COMPLETE', 'FAILED'].includes(a.attributes.state),
    )
    say(`${locale} ${name}: ${ready ? 'reusing' : 'uploading'} ${file}`)
    const asset = ready ?? (await upload(library.id, path, refName))

    const mapping = ref.placementTypes
      .find((t: Doc) => t.placementTypeId === placementType)
      ?.specMappings.find((m: Doc) => m.specs.includes(asset.attributes.specId))
    if (!mapping) {
      const spec = [...ref.imageSpecs, ...(ref.videoSpecs ?? [])].find(
        (s: Doc) => s.specId === asset.attributes.specId,
      )
      throw new Error(
        `${file} matched ${spec?.shortName ?? asset.attributes.specId}, which a ${name} doesn't take`,
      )
    }

    // One per group: take the old one off the page, then put the new one on.
    for (const p of placed.data) {
      await api('DELETE', `/v1/appAssetLibraryPlacements/${p.id}`)
      const old = assetOf(p)
      if (
        old?.attributes.referenceName?.startsWith(`store ${name} `) &&
        old.attributes.state === 'PREPARE_FOR_SUBMISSION'
      )
        await api('DELETE', `/v1/${old.type}/${old.id}`).catch(() => {}) // still placed elsewhere: keep it
    }
    await api('POST', '/v1/appAssetLibraryPlacements', {
      data: {
        type: 'appAssetLibraryPlacements',
        attributes: { placementType, placementGroup: mapping.placementGroupId },
        relationships: {
          [rel]: { data: { type, id: asset.id } },
          appStoreVersionLocalization: {
            data: { type: 'appStoreVersionLocalizations', id: loc.id },
          },
        },
      },
    })
    say(`${locale} ${name}: placed (${mapping.placementGroupId})`)
  }
}
