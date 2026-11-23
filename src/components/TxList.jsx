import { categoryInfo } from '../categories.js'
import { dayLabel, formatWon, sortTransactions, sumBy } from '../utils.js'

// 날짜별로 묶은 내역 목록
export default function TxList({ transactions, onOpen, emptyText }) {
  if (transactions.length === 0) return <p className="empty muted">{emptyText}</p>

  const groups = []
  for (const t of sortTransactions(transactions)) {
    const last = groups.at(-1)
    if (last?.date === t.date) last.items.push(t)
    else groups.push({ date: t.date, items: [t] })
  }

  return (
    <div className="tx-list">
      {groups.map(({ date, items }) => {
        const { text, weekday } = dayLabel(date)
        const income = sumBy(items, 'income')
        const expense = sumBy(items, 'expense')
        return (
          <section key={date} className="day">
            <header className="day-head small">
              <span className={weekday === 0 ? 'sun' : weekday === 6 ? 'sat' : ''}>{text}</span>
              <span className="muted">
                {income > 0 && <span className="income">+{formatWon(income)}</span>}
                {income > 0 && expense > 0 && ' · '}
                {expense > 0 && <span>−{formatWon(expense)}</span>}
              </span>
            </header>
            <ul>
              {items.map((t) => {
                const cat = categoryInfo(t.type, t.category)
                return (
                  <li key={t.id}>
                    <button type="button" className="tx" onClick={() => onOpen(t)}>
                      <span className="tx-icon" style={{ background: `${cat.color}22` }}>
                        {cat.icon}
                      </span>
                      <span className="tx-body">
                        <span className="tx-title">{t.memo || t.category}</span>
                        <span className="muted small">
                          {t.category}
                          {t.method && ` · ${t.method}`}
                        </span>
                      </span>
                      <span className={`tx-amount ${t.type}`}>
                        {t.type === 'income' ? '+' : '−'}
                        {formatWon(t.amount)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
