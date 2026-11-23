import { useState } from 'react'
import Sheet from './Sheet.jsx'
import { formatNumber, periodLabel, periodOf, today } from '../utils.js'

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

// 설정: 한 달 시작일, 한 달 예산, 구글 시트(열기·불러오기·연결 해제), 엑셀로 내보내기
export default function SettingsForm({ settings, cloud, onSave, onExport, onCancel }) {
  const [startDay, setStartDay] = useState(settings.startDay)
  const [budget, setBudget] = useState(settings.budget)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    try {
      await onSave({ ...settings, startDay, budget })
    } catch (err) {
      setError(err.message)
    }
  }

  const example = periodLabel(periodOf(today(), startDay), startDay)

  return (
    <Sheet title="설정" onDismiss={onCancel}>
      <form className="tx-form" onSubmit={submit}>
        <label>
          <span className="label">한 달 시작일</span>
          <select value={startDay} onChange={(e) => setStartDay(Number(e.target.value))}>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                매달 {d}일{d === 1 ? ' (달력 그대로)' : ''}
              </option>
            ))}
          </select>
          <span className="muted small">
            월급날로 맞추면 월급 기준으로 한 달을 봐요. 지금 기간: <strong>{example}</strong>
            {startDay > 28 && (
              <>
                <br />그 날짜가 없는 달은 마지막 날부터 시작해요.
              </>
            )}
          </span>
        </label>

        <div>
          <span className="label">한 달 예산</span>
          <label className="amount-field">
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={budget ? formatNumber(budget) : ''}
              onChange={(e) => setBudget(Number(e.target.value.replace(/\D/g, '').slice(0, 12)))}
              aria-label="예산 금액"
            />
            <span>원</span>
          </label>
          <span className="muted small">비워 두면 예산을 표시하지 않아요.</span>
        </div>

        {error && <p className="error small">{error}</p>}

        <div className="form-actions">
          <button type="submit" className="primary-btn">
            저장
          </button>
        </div>
      </form>

      {cloud && (
        <section className="settings-section">
          <h3>구글 시트</h3>
          <p className="muted small">
            가계부는 이 폰에 저장되고, ☁ 업로드를 누르면 구글 드라이브의 ‘가계부’ 시트가 폰 내용과 똑같이 바뀌어요.
          </p>
          <div className="settings-actions">
            {cloud.sheetLink && (
              <a className="chip" href={cloud.sheetLink} target="_blank" rel="noreferrer">
                📄 시트 열기
              </a>
            )}
            <button type="button" className="chip" onClick={cloud.onRestore} disabled={Boolean(cloud.busy)}>
              {cloud.busy === 'restore' ? '불러오는 중…' : '⬇ 시트에서 불러오기'}
            </button>
            {cloud.signedIn && (
              <button type="button" className="chip" onClick={cloud.onSignOut}>
                구글 연결 해제
              </button>
            )}
          </div>
          <p className="muted small">새 폰으로 바꾸거나 앱을 다시 설치했을 때 ‘시트에서 불러오기’로 복원하세요.</p>
        </section>
      )}

      <section className="settings-section">
        <h3>내보내기</h3>
        <button type="button" className="chip" onClick={onExport}>
          ⬇ 모든 내역을 엑셀(CSV) 파일로 받기
        </button>
      </section>
    </Sheet>
  )
}
