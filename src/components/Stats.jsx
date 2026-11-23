import { useState } from 'react'
import { categoryInfo } from '../categories.js'
import { formatShort, formatWon, inRange, periodRange, periodShort, shiftMonth, sumBy } from '../utils.js'

// 분류별 비율과 최근 6개 기간 흐름
export default function Stats({ period, startDay, periodTx, allTx }) {
  const [type, setType] = useState('expense')

  const txOf = (p) => {
    const range = periodRange(p, startDay)
    return allTx.filter((t) => inRange(t.date, range))
  }

  const total = sumBy(periodTx, type)
  const byCategory = new Map()
  for (const t of periodTx) {
    if (t.type === type) byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount)
  }
  const rows = [...byCategory].sort((a, b) => b[1] - a[1])

  const prevTotal = sumBy(txOf(shiftMonth(period, -1)), type)
  const diff = total - prevTotal

  const trend = Array.from({ length: 6 }, (_, i) => {
    const p = shiftMonth(period, i - 5)
    const list = txOf(p)
    return { period: p, income: sumBy(list, 'income'), expense: sumBy(list, 'expense') }
  })
  const max = Math.max(1, ...trend.flatMap((t) => [t.income, t.expense]))

  const word = type === 'expense' ? '지출' : '수입'

  return (
    <div className="stats">
      <div className="segment">
        <button type="button" className={type === 'expense' ? 'active' : ''} onClick={() => setType('expense')}>
          지출
        </button>
        <button type="button" className={type === 'income' ? 'active' : ''} onClick={() => setType('income')}>
          수입
        </button>
      </div>

      <section className="card">
        <div className="stat-total">
          <span className="muted small">이번 기간 {word}</span>
          <strong className={type}>{formatWon(total)}</strong>
          {prevTotal > 0 && (
            <span className="muted small">
              지난 기간보다 {formatWon(Math.abs(diff))} {diff >= 0 ? '더' : '덜'} {type === 'expense' ? '썼어요' : '벌었어요'}
            </span>
          )}
        </div>

        {rows.length > 0 ? (
          <>
            <div className="stack" aria-hidden>
              {rows.map(([name, amount]) => (
                <span
                  key={name}
                  style={{ width: `${(amount / total) * 100}%`, background: categoryInfo(type, name).color }}
                />
              ))}
            </div>
            <ul className="cat-rows">
              {rows.map(([name, amount]) => {
                const cat = categoryInfo(type, name)
                return (
                  <li key={name}>
                    <span className="dot" style={{ background: cat.color }} />
                    <span className="cat-name">
                      {cat.icon} {name}
                    </span>
                    <span className="muted small">{Math.round((amount / total) * 100)}%</span>
                    <strong>{formatWon(amount)}</strong>
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <p className="empty muted">이번 기간 {word} 내역이 없어요.</p>
        )}
      </section>

      <section className="card">
        <h3>최근 6개 기간</h3>
        <div className="trend">
          {trend.map((t) => (
            <div key={t.period} className={`trend-col ${t.period === period ? 'current' : ''}`}>
              <div className="trend-bars">
                <span className="b-income" style={{ height: `${(t.income / max) * 100}%` }} title={`수입 ${formatWon(t.income)}`} />
                <span className="b-expense" style={{ height: `${(t.expense / max) * 100}%` }} title={`지출 ${formatWon(t.expense)}`} />
              </div>
              <span className="small">{periodShort(t.period, startDay)}</span>
              <span className="muted tiny">{t.expense ? formatShort(t.expense) : '-'}</span>
            </div>
          ))}
        </div>
        <div className="legend small muted">
          <span>
            <i className="b-income" /> 수입
          </span>
          <span>
            <i className="b-expense" /> 지출 (아래 숫자)
          </span>
        </div>
      </section>
    </div>
  )
}
