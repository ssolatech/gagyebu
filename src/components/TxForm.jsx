import { useCallback, useState } from 'react'
import Sheet from './Sheet.jsx'
import { confirmDialog } from './Dialog.jsx'
import { CATEGORIES, METHODS } from '../categories.js'
import { formatNumber, today } from '../utils.js'

const QUICK = [10000, 50000, 100000]

// 내역 추가·수정 시트
export default function TxForm({ initial, defaultDate, saving, onSave, onDelete, onCancel }) {
  const isEdit = Boolean(initial.id)
  const [form, setForm] = useState(() => ({
    type: 'expense',
    amount: 0,
    category: '',
    method: '카드',
    memo: '',
    date: defaultDate || today(),
    ...initial,
  }))
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)

  function set(patch) {
    setForm((f) => ({ ...f, ...patch }))
    setDirty(true)
  }

  function changeType(type) {
    if (type === form.type) return
    set({ type, category: '', method: type === 'income' ? '계좌이체' : '카드' })
  }

  function changeAmount(text) {
    const digits = text.replace(/\D/g, '').slice(0, 12)
    set({ amount: Number(digits) })
  }

  const dismiss = useCallback(async () => {
    if (saving) return
    if (
      dirty &&
      !(await confirmDialog({
        title: '작성을 그만둘까요?',
        message: '입력한 내용은 저장되지 않아요.',
        confirmText: '그만두기',
        cancelText: '계속 쓰기',
        tone: 'warn',
        icon: '✏️',
      }))
    )
      return
    onCancel()
  }, [dirty, saving, onCancel])

  async function submit(e) {
    e.preventDefault()
    if (!form.amount) return setError('금액을 입력해 주세요.')
    if (!form.category) return setError('분류를 골라 주세요.')
    setError('')
    try {
      await onSave({ ...form, memo: form.memo.trim() })
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove() {
    const ok = await confirmDialog({
      title: '이 내역을 삭제할까요?',
      message: `${initial.memo || initial.category} · ${formatNumber(initial.amount)}원\n삭제하면 되돌릴 수 없어요.`,
      confirmText: '삭제',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await onDelete(initial.id)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Sheet title={isEdit ? '내역 수정' : '내역 추가'} onDismiss={dismiss}>
      <form className="tx-form" onSubmit={submit}>
        <div className="segment">
          <button type="button" className={form.type === 'expense' ? 'active expense' : ''} onClick={() => changeType('expense')}>
            지출
          </button>
          <button type="button" className={form.type === 'income' ? 'active income' : ''} onClick={() => changeType('income')}>
            수입
          </button>
        </div>

        <label className="amount-field">
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={form.amount ? formatNumber(form.amount) : ''}
            onChange={(e) => changeAmount(e.target.value)}
            autoFocus={!isEdit}
            aria-label="금액"
          />
          <span>원</span>
        </label>
        <div className="quick">
          {QUICK.map((q) => (
            <button key={q} type="button" className="chip" onClick={() => set({ amount: form.amount + q })}>
              +{q / 10000}만
            </button>
          ))}
          {form.amount > 0 && (
            <button type="button" className="chip" onClick={() => set({ amount: 0 })}>
              지우기
            </button>
          )}
        </div>

        <fieldset>
          <legend>분류</legend>
          <div className="cat-grid">
            {CATEGORIES[form.type].map((c) => (
              <button
                key={c.name}
                type="button"
                className={`cat-btn ${form.category === c.name ? 'active' : ''}`}
                style={form.category === c.name ? { borderColor: c.color, background: `${c.color}1f` } : undefined}
                onClick={() => set({ category: c.name })}
              >
                <span>{c.icon}</span>
                {c.name}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="form-row">
          <label>
            <span className="label">날짜</span>
            <input type="date" value={form.date} required onChange={(e) => set({ date: e.target.value })} />
          </label>
          <label>
            <span className="label">결제수단</span>
            <select value={form.method} onChange={(e) => set({ method: e.target.value })}>
              {METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <span className="label">메모</span>
          <input
            type="text"
            placeholder={form.type === 'expense' ? '예: 점심 김치찌개' : '예: 11월 급여'}
            value={form.memo}
            maxLength={60}
            onChange={(e) => set({ memo: e.target.value })}
          />
        </label>

        {error && <p className="error small">{error}</p>}

        <div className="form-actions">
          {isEdit && (
            <button type="button" className="danger-btn" onClick={remove} disabled={saving}>
              삭제
            </button>
          )}
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
