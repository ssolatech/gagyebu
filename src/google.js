// 구글 로그인(Google Identity Services) + 구글 드라이브 REST API.
// 서버 없이 브라우저에서 바로 호출한다. 클라이언트 ID는 .env.local 의 VITE_GOOGLE_CLIENT_ID.
// 권한은 drive.file: 이 앱이 만든 파일만 보고 쓸 수 있다. (드라이브의 다른 파일은 접근 불가)
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const API = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
const TOKEN_KEY = 'google-token'

export const hasGoogleClient = Boolean(CLIENT_ID)

export class AuthError extends Error {}

// ---- 로그인 ----

let tokenClient = null
let token = readToken()

function readToken() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY))
    return saved && saved.expiresAt > Date.now() + 60_000 ? saved : null
  } catch {
    return null
  }
}

function writeToken(value) {
  token = value
  try {
    if (value) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(value))
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // 저장이 막혀 있으면 이번 페이지에서만 로그인 유지
  }
}

export function isSignedIn() {
  return Boolean(token && token.expiresAt > Date.now())
}

let gisLoading = null
function loadGis() {
  gisLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = resolve
    script.onerror = () => {
      gisLoading = null
      reject(new Error('구글 로그인 스크립트를 불러오지 못했어요.'))
    }
    document.head.appendChild(script)
  })
  return gisLoading
}

// 로그인 팝업은 버튼 클릭 직후에 바로 열어야 차단되지 않아서, 스크립트는 미리 불러 둔다.
export async function prepareSignIn() {
  await loadGis()
  tokenClient ??= window.google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPE, callback: () => {} })
}

export async function signIn() {
  if (!tokenClient) await prepareSignIn()
  return new Promise((resolve, reject) => {
    tokenClient.callback = (res) => {
      if (res.error) return reject(new Error(res.error_description || res.error))
      writeToken({ value: res.access_token, expiresAt: Date.now() + res.expires_in * 1000 })
      resolve()
    }
    tokenClient.error_callback = (err) =>
      reject(new Error(err.type === 'popup_closed' ? '로그인 창이 닫혔어요.' : '로그인하지 못했어요.'))
    tokenClient.requestAccessToken({ prompt: '' })
  })
}

export function signOut() {
  if (token) window.google?.accounts.oauth2.revoke(token.value)
  writeToken(null)
}

// ---- 드라이브 ----

async function driveFetch(url, options = {}) {
  if (!isSignedIn()) throw new AuthError('로그인이 필요해요.')
  const res = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token.value}` },
  })
  if (res.status === 401) {
    writeToken(null)
    throw new AuthError('로그인이 만료됐어요.')
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err =
      res.status === 403 && /SERVICE_DISABLED|has not been used|is disabled/.test(text)
        ? new Error('Google Cloud에서 Google Sheets API가 꺼져 있어요. 설정에서 켜 주세요.')
        : new Error(`구글 요청 실패 (${res.status})`)
    err.status = res.status
    throw err
  }
  return res
}

// ---- 구글 시트 ----
// drive.file 권한으로도 이 앱이 만든 스프레드시트는 Sheets API로 읽고 쓸 수 있다.
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets'
export const SHEET_MIME = 'application/vnd.google-apps.spreadsheet'

export async function sheets(path, { method = 'GET', body } = {}) {
  const res = await driveFetch(`${SHEETS}${path}`, { method, ...(body && json(body)) })
  return res.json()
}

const json = (body) => ({ body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })

export async function findFile(name, parentId, mimeType) {
  const q = [`name = '${name.replace(/'/g, "\\'")}'`, 'trashed = false']
  if (parentId) q.push(`'${parentId}' in parents`)
  if (mimeType) q.push(`mimeType = '${mimeType}'`)
  const res = await driveFetch(`${API}?q=${encodeURIComponent(q.join(' and '))}&fields=files(id)&spaces=drive`)
  const { files } = await res.json()
  return files[0]?.id ?? null
}

const FOLDER = 'application/vnd.google-apps.folder'

export async function ensureFolder(name, parentId) {
  const found = await findFile(name, parentId, FOLDER)
  if (found) return found
  const res = await driveFetch(`${API}?fields=id`, {
    method: 'POST',
    ...json({ name, mimeType: FOLDER, ...(parentId && { parents: [parentId] }) }),
  })
  return (await res.json()).id
}

// 메타데이터와 내용을 한 번에 올려 새 파일을 만든다.
export async function createFile(name, parentId, blob) {
  const boundary = `gagyebu-${Date.now()}`
  const meta = JSON.stringify({ name, parents: [parentId] })
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
    `--${boundary}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ])
  const res = await driveFetch(`${UPLOAD}?uploadType=multipart&fields=id`, {
    method: 'POST',
    body,
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
  })
  return (await res.json()).id
}

export async function updateFile(id, blob) {
  await driveFetch(`${UPLOAD}/${id}?uploadType=media`, {
    method: 'PATCH',
    body: blob,
    headers: { 'Content-Type': blob.type || 'application/octet-stream' },
  })
}

export async function readFile(id) {
  return driveFetch(`${API}/${id}?alt=media`)
}

// 완전 삭제 대신 휴지통으로 보낸다. (드라이브에서 30일 안에 복구 가능)
export async function trashFile(id) {
  await driveFetch(`${API}/${id}`, { method: 'PATCH', ...json({ trashed: true }) })
}
