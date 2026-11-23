// 구글 시트 업로드·불러오기.
// 폰에 있는 가계부가 원본이고, 시트는 보기·백업용이다. 업로드하면 시트를 폰 내용과 똑같이 덮어쓴다.
// 스프레드시트 이름은 '가계부'이고 탭은 내역 / 기간별 요약 / 설정 세 개다.
import * as google from './google.js'
import { inRange, periodOf, periodRange, sumBy } from './utils.js'

const TITLE = '가계부'
const TABS = ['내역', '기간별 요약', '설정']
const HEAD = ['날짜', '구분', '분류', '금액', '결제수단', '메모', 'ID']
const q = (tab) => `'${tab}'`

export const sheetUrl = (id) => `https://docs.google.com/spreadsheets/d/${id}/edit`

async function getTabs(id) {
  const data = await google.sheets(`/${id}?fields=sheets.properties(sheetId,title)`)
  return new Map(data.sheets.map((s) => [s.properties.title, s.properties.sheetId]))
}

// 저장해 둔 ID → 드라이브에서 이름으로 찾기 순서로 찾는다. 없으면 null.
async function findSpreadsheet(savedId) {
  if (savedId) {
    try {
      return { id: savedId, tabs: await getTabs(savedId) }
    } catch (err) {
      if (err.status !== 404 && err.status !== 403) throw err // 지워졌거나 접근 불가면 다시 찾는다
    }
  }
  const found = await google.findFile(TITLE, null, google.SHEET_MIME)
  return found ? { id: found, tabs: await getTabs(found) } : null
}

async function createSpreadsheet() {
  const data = await google.sheets('?fields=spreadsheetId', {
    method: 'POST',
    body: { properties: { title: TITLE, locale: 'ko_KR' }, sheets: [{ properties: { title: TABS[0] } }] },
  })
  return { id: data.spreadsheetId, tabs: await getTabs(data.spreadsheetId) }
}

// 빠진 탭을 만들고 머리글·숫자 서식을 맞춘다. (사용자가 탭을 지웠어도 다시 생긴다)
async function prepareTabs(sheet) {
  const missing = TABS.filter((t) => !sheet.tabs.has(t))
  if (missing.length) {
    await google.sheets(`/${sheet.id}:batchUpdate`, {
      method: 'POST',
      body: { requests: missing.map((title) => ({ addSheet: { properties: { title } } })) },
    })
    sheet.tabs = await getTabs(sheet.id)
  }
  const id = (t) => sheet.tabs.get(t)
  const money = (sheetId, from, to) => ({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: from, endColumnIndex: to },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0' } } },
      fields: 'userEnteredFormat.numberFormat',
    },
  })
  const requests = TABS.flatMap((t) => [
    {
      updateSheetProperties: {
        properties: { sheetId: id(t), gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    {
      repeatCell: {
        range: { sheetId: id(t), startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.88, green: 0.95, blue: 0.91 } } },
        fields: 'userEnteredFormat(textFormat,backgroundColor)',
      },
    },
  ])
  requests.push(money(id('내역'), 3, 4), money(id('기간별 요약'), 1, 4), money(id('설정'), 1, 2))
  await google.sheets(`/${sheet.id}:batchUpdate`, { method: 'POST', body: { requests } })
}

function buildRows({ transactions, settings }) {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? 0) - (b.createdAt ?? 0))
  const list = sorted.map((t) => [t.date, t.type === 'income' ? '수입' : '지출', t.category, t.amount, t.method ?? '', t.memo ?? '', t.id])

  const periods = [...new Set(transactions.map((t) => periodOf(t.date, settings.startDay)))].sort().reverse()
  const summary = periods.map((p) => {
    const range = periodRange(p, settings.startDay)
    const tx = transactions.filter((t) => inRange(t.date, range))
    const income = sumBy(tx, 'income')
    const expense = sumBy(tx, 'expense')
    return [`${range.start} ~ ${range.end}`, income, expense, income - expense]
  })

  return [
    { range: `${q('내역')}!A1`, values: [HEAD, ...list] },
    { range: `${q('기간별 요약')}!A1`, values: [['기간', '수입', '지출', '남은 돈'], ...summary] },
    {
      range: `${q('설정')}!A1`,
      values: [
        ['항목', '값'],
        ['한 달 시작일', settings.startDay],
        ['한 달 예산', settings.budget],
        ['마지막 업로드', new Date().toLocaleString('ko-KR')],
        ['안내', '폰의 가계부 앱에서 업로드하면 이 시트 전체가 덮어써져요. 여기서 고친 내용은 다음 업로드 때 사라져요.'],
      ],
    },
  ]
}

async function countRows(id) {
  const data = await google.sheets(`/${id}/values/${encodeURIComponent(`${q('내역')}!A2:A`)}`)
  return data.values?.length ?? 0
}

/**
 * 폰의 가계부로 시트를 덮어쓴다. 시트 ID를 돌려준다.
 * askOverwrite(n): 이 폰에서 처음 올리는데 시트에 이미 내역이 n건 있을 때 물어본다. false면 취소(null).
 */
export async function upload(ledger, savedId, askOverwrite) {
  let sheet = await findSpreadsheet(savedId)
  if (sheet && askOverwrite) {
    const n = sheet.tabs.has('내역') ? await countRows(sheet.id) : 0
    if (n > 0 && !askOverwrite(n)) return null
  }
  sheet ??= await createSpreadsheet()
  await prepareTabs(sheet)
  await google.sheets(`/${sheet.id}/values:batchClear`, { method: 'POST', body: { ranges: TABS.map(q) } })
  await google.sheets(`/${sheet.id}/values:batchUpdate`, {
    method: 'POST',
    // RAW: 메모가 '='로 시작해도 수식이 되지 않고 글자 그대로 들어간다.
    body: { valueInputOption: 'RAW', data: buildRows(ledger) },
  })
  return sheet.id
}

/** 시트에서 가계부를 읽어 온다. 시트가 없으면 null. */
export async function download(savedId) {
  const sheet = await findSpreadsheet(savedId)
  if (!sheet) return null
  const ranges = [`${q('내역')}!A2:G`, `${q('설정')}!A2:B3`]
  const params = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&')
  const data = await google.sheets(`/${sheet.id}/values:batchGet?${params}&valueRenderOption=UNFORMATTED_VALUE`)
  const [rows = [], settingRows = []] = data.valueRanges.map((v) => v.values ?? [])

  const transactions = rows
    .filter(([date, , , amount]) => /^\d{4}-\d{2}-\d{2}$/.test(String(date)) && Number(amount) > 0)
    .map(([date, type, category, amount, method, memo, id], i) => ({
      id: id ? String(id) : crypto.randomUUID(),
      date: String(date),
      type: type === '수입' ? 'income' : 'expense',
      category: String(category ?? '기타') || '기타',
      amount: Math.round(Number(amount)),
      method: String(method ?? ''),
      memo: String(memo ?? ''),
      createdAt: i,
    }))
  const setting = Object.fromEntries(settingRows)
  const startDay = Math.min(31, Math.max(1, Math.round(Number(setting['한 달 시작일'])) || 1))
  const budget = Math.max(0, Math.round(Number(setting['한 달 예산'])) || 0)

  return { id: sheet.id, ledger: { transactions, settings: { startDay, budget } } }
}

