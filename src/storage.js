// 데이터 저장 담당. 가계부는 이 기기(브라우저)의 localStorage에 저장한다.
// 인터넷이 없어도 쓰고, 구글 시트에는 사용자가 '업로드'를 누를 때만 올린다. (sheets.js)
import { hasGoogleClient } from './google.js'

export const cloudEnabled = hasGoogleClient

const LEDGER_KEY = 'gagyebu-ledger'
const SYNC_KEY = 'gagyebu-sync'

// startDay: 한 달 시작일 (1~31). 25면 25일 ~ 다음 달 24일을 한 달로 본다.
export const emptyLedger = () => ({ transactions: [], settings: { budget: 0, startDay: 1 } })

// sheetId: 업로드한 스프레드시트, uploadedAt: 마지막 업로드 시각, changes: 그 뒤로 바뀐 횟수
export const emptySync = () => ({ sheetId: null, uploadedAt: null, changes: 0 })

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key))
  } catch {
    return null
  }
}

export function loadLedger() {
  const data = read(LEDGER_KEY)
  if (!data) return emptyLedger()
  return { transactions: data.transactions ?? [], settings: { ...emptyLedger().settings, ...data.settings } }
}

// 저장 공간이 꽉 찼거나 막혀 있으면 에러를 던진다. (화면에 반영하기 전에 먼저 저장한다)
export function saveLedger(ledger) {
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify({ version: 1, ...ledger }))
  } catch {
    throw new Error('이 기기에 저장하지 못했어요. 저장 공간을 확인해 주세요.')
  }
}

export const loadSync = () => ({ ...emptySync(), ...read(SYNC_KEY) })

export function saveSync(sync) {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(sync))
  } catch {
    // 업로드 기록은 못 남겨도 가계부 자체에는 영향 없음
  }
}

// 브라우저가 공간이 부족할 때 이 앱 데이터를 지우지 않도록 요청한다. (홈 화면에 설치하면 대부분 허용)
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {})
}

export function newId() {
  return crypto.randomUUID()
}
