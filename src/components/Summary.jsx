import { formatWon, sumBy } from '../utils.js'

// 이번 달 수입·지출·남은 돈, 예산 진행도
export default function Summary({ transactions, budget, onEditBudget }) {
  const income = sumBy(transactions, 'income')
  const expense = sumBy(transactions, 'expense')
  const balance = income - expense
  const ratio = budget > 0 ? expense / budget : 0

  return (
    <section className="summary">
      <div className="summary-main">
        <span className="muted small">남은 돈</span>
        <strong className={`balance ${balance < 0 ? 'minus' : ''}`}>
          {balance < 0 ? '−' : ''}
          {formatWon(Math.abs(balance))}
        </strong>
      </div>
      <div className="summary-row">
        <div>
          <span className="muted small">수입</span>
          <strong className="income">{formatWon(income)}</strong>
        </div>
        <div>
          <span className="muted small">지출</span>
          <strong className="expense">{formatWon(expense)}</strong>
        </div>
      </div>

      <button type="button" className="budget" onClick={onEditBudget}>
        {budget > 0 ? (
          <>
            <div className="budget-text small">
              <span>
                예산 {formatWon(budget)} 중 <strong>{Math.round(ratio * 100)}%</strong> 사용
              </span>
              <span className={ratio > 1 ? 'expense' : 'muted'}>
                {ratio > 1 ? `${formatWon(expense - budget)} 초과` : `${formatWon(budget - expense)} 남음`}
              </span>
            </div>
            <div className="bar">
              <div
                className={`bar-fill ${ratio > 1 ? 'over' : ratio > 0.8 ? 'warn' : ''}`}
                style={{ width: `${Math.min(ratio, 1) * 100}%` }}
              />
            </div>
          </>
        ) : (
          <span className="muted small">＋ 한 달 예산을 정해 보세요</span>
        )}
      </button>
    </section>
  )
}
