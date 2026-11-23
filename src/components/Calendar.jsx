import { useState } from 'react'
import TxList from './TxList.jsx'
import { WEEKDAY_NAMES, addDays, formatCompact, formatWon, inRange, sumBy, today, weekdayOf } from '../utils.js'

// 기간 전체를 달력으로 보여 주고, 날짜마다 쓴 돈(지출)과 들어온 돈(수입)을 적는다.
// 많이 쓴 날일수록 칸 색이 진해진다. 날짜를 누르면 아래에 그날 내역이 나온다.
export default function Calendar({ range, transactions, onOpen }) {
  const now = today()
  const [selected, setSelected] = useState(() => (inRange(now, range) ? now : null))
  const current = selected && inRange(selected, range) ? selected : null

  const byDate = new Map()
  for (const t of transactions) {
    const day = byDate.get(t.date) ?? { income: 0, expense: 0 }
    day[t.type] += t.amount
    byDate.set(t.date, day)
  }

  const days = []
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) days.push(d)
  const blanks = weekdayOf(range.start)
  const maxExpense = Math.max(1, ...[...byDate.values()].map((v) => v.expense))

  const totalExpense = sumBy(transactions, 'expense')
  const passedDays = days.filter((d) => d <= now).length || days.length
  const selectedTx = current ? transactions.filter((t) => t.date === current) : []
  const selectedDay = current && byDate.get(current)

  return (
    <div className="calendar-wrap">
      <section className="card calendar">
        <div className="cal-grid cal-week">
          {WEEKDAY_NAMES.map((w, i) => (
            <span key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>
              {w}
            </span>
          ))}
        </div>
        <div className="cal-grid">
          {Array.from({ length: blanks }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {days.map((d, i) => {
            const v = byDate.get(d)
            const dayNum = Number(d.slice(8))
            const wd = weekdayOf(d)
            const showMonth = i === 0 || dayNum === 1
            const heat = v?.expense ? 0.12 + (v.expense / maxExpense) * 0.5 : 0
            return (
              <button
                key={d}
                type="button"
                className={`cal-cell ${d === current ? 'selected' : ''} ${d === now ? 'today' : ''} ${d > now ? 'future' : ''}`}
                style={heat ? { '--heat': heat } : undefined}
                onClick={() => setSelected(d === current ? null : d)}
              >
                <span className={`cal-day ${wd === 0 ? 'sun' : wd === 6 ? 'sat' : ''}`}>
                  {showMonth ? `${Number(d.slice(5, 7))}/${dayNum}` : dayNum}
                </span>
                {v?.expense > 0 && <span className="cal-exp">{formatCompact(v.expense)}</span>}
                {v?.income > 0 && <span className="cal-inc">+{formatCompact(v.income)}</span>}
              </button>
            )
          })}
        </div>
        <p className="cal-foot small muted">
          하루 평균 지출 <strong>{formatWon(totalExpense / passedDays)}</strong>
          <span> · 칸 색이 진할수록 많이 쓴 날</span>
        </p>
      </section>

      {current && (
        <div className="cal-detail">
          <div className="filters">
            <strong>
              {Number(current.slice(5, 7))}월 {Number(current.slice(8))}일
            </strong>
            <span className="muted small">
              {selectedDay?.income > 0 && <span className="income">+{formatWon(selectedDay.income)} </span>}
              지출 {formatWon(selectedDay?.expense ?? 0)}
            </span>
          </div>
          <TxList transactions={selectedTx} onOpen={onOpen} emptyText="이날은 내역이 없어요." />
        </div>
      )}
    </div>
  )
}
