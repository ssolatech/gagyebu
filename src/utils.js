// 날짜는 'YYYY-MM-DD', 월은 'YYYY-MM' 문자열로 다룬다. (시간대 때문에 날짜가 밀리지 않게 로컬 기준)
const pad = (n) => String(n).padStart(2, '0')

export function today() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const monthOf = (date) => date.slice(0, 7)

export function shiftMonth(month, diff) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + diff, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function monthLabel(month, withYear = true) {
  const [y, m] = month.split('-').map(Number)
  return withYear ? `${y}년 ${m}월` : `${m}월`
}

// ---- 기간 (한 달 시작일) ----
// 기간은 시작하는 달의 'YYYY-MM' 으로 부른다. 시작일 25 → '2026-11' 은 11월 25일 ~ 12월 24일.
// 시작일이 그 달에 없으면(예: 31일인데 11월) 그 달 마지막 날부터 시작한다.
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parts = (date) => date.split('-').map(Number)

export function addDays(date, n) {
  const [y, m, d] = parts(date)
  return fmt(new Date(y, m - 1, d + n))
}

function periodStart(month, startDay) {
  const [y, m] = parts(month)
  const last = new Date(y, m, 0).getDate()
  return `${month}-${pad(Math.min(startDay, last))}`
}

export function periodRange(month, startDay = 1) {
  return { start: periodStart(month, startDay), end: addDays(periodStart(shiftMonth(month, 1), startDay), -1) }
}

export function periodOf(date, startDay = 1) {
  const month = monthOf(date)
  return date >= periodStart(month, startDay) ? month : shiftMonth(month, -1)
}

export const inRange = (date, { start, end }) => date >= start && date <= end

const md = (date) => {
  const [, m, d] = parts(date)
  return { m, d }
}

// 시작일 1 → '2026년 11월', 그 외 → '11월 25일 ~ 12월 24일'
export function periodLabel(month, startDay = 1) {
  if (startDay === 1) return monthLabel(month)
  const { start, end } = periodRange(month, startDay)
  const s = md(start)
  const e = md(end)
  return `${s.m}월 ${s.d}일 ~ ${e.m}월 ${e.d}일`
}

// 그래프용 짧은 이름: '11월' 또는 '11.25~'
export function periodShort(month, startDay = 1) {
  if (startDay === 1) return monthLabel(month, false)
  const { m, d } = md(periodRange(month, startDay).start)
  return `${m}.${d}~`
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
export const WEEKDAY_NAMES = WEEKDAYS

export function weekdayOf(date) {
  const [y, m, d] = parts(date)
  return new Date(y, m - 1, d).getDay()
}

export function dayLabel(date) {
  const [y, m, d] = date.split('-').map(Number)
  const wd = new Date(y, m - 1, d).getDay()
  return { text: `${m}월 ${d}일 ${WEEKDAYS[wd]}요일`, weekday: wd }
}

export const formatNumber = (n) => Math.round(n).toLocaleString('ko-KR')
export const formatWon = (n) => `${formatNumber(n)}원`

// 짧게 표시 (그래프 축 등): 1,234,000 → 123만
export function formatShort(n) {
  if (n >= 100_000_000) return `${+(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`
  return formatNumber(n)
}

// 달력 칸용: 9,000 / 1.2만 / 15만
export function formatCompact(n) {
  if (n < 10_000) return formatNumber(n)
  if (n < 100_000) return `${+(n / 10_000).toFixed(1)}만`
  return formatShort(n)
}

export function sumBy(list, type) {
  return list.reduce((sum, t) => (t.type === type ? sum + t.amount : sum), 0)
}

// 최신 날짜가 위로, 같은 날짜는 나중에 쓴 것이 위로
export function sortTransactions(list) {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

// 엑셀에서 한글이 깨지지 않게 BOM을 붙인 CSV로 내려받는다.
export function downloadCsv(transactions, filename) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = [
    ['날짜', '구분', '분류', '금액', '결제수단', '메모'],
    ...sortTransactions(transactions)
      .reverse()
      .map((t) => [t.date, t.type === 'income' ? '수입' : '지출', t.category, t.amount, t.method, t.memo]),
  ]
  const csv = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
