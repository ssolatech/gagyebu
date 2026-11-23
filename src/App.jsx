import { useEffect, useRef, useState } from 'react'
import Summary from './components/Summary.jsx'
import TxList from './components/TxList.jsx'
import Calendar from './components/Calendar.jsx'
import Stats from './components/Stats.jsx'
import TxForm from './components/TxForm.jsx'
import SettingsForm from './components/SettingsForm.jsx'
import { confirmDialog } from './components/Dialog.jsx'
import {
  cloudEnabled,
  loadLedger,
  loadSync,
  newId,
  requestPersistentStorage,
  saveLedger,
  saveSync,
} from './storage.js'
import { AuthError, isSignedIn, prepareSignIn, signIn, signOut } from './google.js'
import { download, sheetUrl, upload } from './sheets.js'
import { downloadCsv, inRange, periodLabel, periodOf, periodRange, shiftMonth, today } from './utils.js'

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'expense', label: '지출' },
  { key: 'income', label: '수입' },
]

const timeText = (ms) =>
  new Date(ms).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function App() {
  const [ledger, setLedger] = useState(loadLedger)
  const [sync, setSyncState] = useState(loadSync)
  const syncRef = useRef(sync)
  const startDay = ledger.settings.startDay

  // 보고 있는 기간. 시작하는 달 'YYYY-MM' 으로 부른다. (시작일 25 → '2026-11' = 11/25 ~ 12/24)
  const [period, setPeriod] = useState(() => periodOf(today(), startDay))
  const [tab, setTab] = useState('list') // list | calendar | stats
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(null) // null | 새 내역({}) | 수정할 내역
  const [editingSettings, setEditingSettings] = useState(false)
  const [cloudBusy, setCloudBusy] = useState(null) // null | 'upload' | 'restore'
  const [notice, setNotice] = useState(null) // { kind: 'ok' | 'error', text }

  function setSync(next) {
    syncRef.current = typeof next === 'function' ? next(syncRef.current) : next
    setSyncState(syncRef.current)
    saveSync(syncRef.current)
  }

  useEffect(() => {
    requestPersistentStorage()
    if (cloudEnabled) prepareSignIn().catch(() => {})
  }, [])

  const sheetOpen = Boolean(editing || editingSettings)
  useEffect(() => {
    document.documentElement.classList.toggle('locked', sheetOpen)
  }, [sheetOpen])

  // 기기에 먼저 저장하고, 성공하면 화면에 반영한다.
  function persist(next) {
    saveLedger(next)
    setLedger(next)
    setSync((s) => ({ ...s, changes: s.changes + 1 }))
  }

  async function handleSaveTx(tx) {
    const isNew = !tx.id
    const saved = isNew ? { ...tx, id: newId(), createdAt: Date.now() } : tx
    const transactions = isNew
      ? [...ledger.transactions, saved]
      : ledger.transactions.map((t) => (t.id === saved.id ? saved : t))
    persist({ ...ledger, transactions })
    setEditing(null)
    setPeriod(periodOf(saved.date, startDay)) // 다른 기간 날짜로 저장했으면 그 기간으로 이동
  }

  async function handleDeleteTx(id) {
    persist({ ...ledger, transactions: ledger.transactions.filter((t) => t.id !== id) })
    setEditing(null)
  }

  async function handleSaveSettings(settings) {
    persist({ ...ledger, settings })
    setEditingSettings(false)
    if (settings.startDay !== startDay) setPeriod(periodOf(today(), settings.startDay))
  }

  // ---- 구글 시트 ----

  // 로그인 창은 버튼을 누른 직후에 열려야 차단되지 않아서, 다른 await 보다 먼저 부른다.
  async function withGoogle(kind, task) {
    if (cloudBusy) return
    setNotice(null)
    if (!navigator.onLine) {
      setNotice({ kind: 'error', text: '인터넷에 연결되어 있지 않아요. 연결된 뒤 다시 눌러 주세요.' })
      return
    }
    setCloudBusy(kind)
    try {
      if (!isSignedIn()) await signIn()
      await task()
    } catch (err) {
      const text = err instanceof AuthError ? '구글 로그인이 만료됐어요. 한 번 더 눌러 주세요.' : err.message
      setNotice({ kind: 'error', text })
    } finally {
      setCloudBusy(null)
    }
  }

  function handleUpload() {
    withGoogle('upload', async () => {
      const before = syncRef.current.changes
      // 이 기기에서 처음 올리는데 시트에 이미 내역이 있으면, 덮어쓰기 전에 물어본다.
      const ask = syncRef.current.uploadedAt
        ? null
        : (n) =>
            confirmDialog({
              title: '시트에 이미 내역이 있어요',
              message:
                `구글 시트 '가계부'에 내역이 ${n}건 있어요.\n` +
                '업로드하면 시트가 이 폰의 내용으로 바뀌고, 시트에만 있던 내역은 사라져요.\n\n' +
                '시트 내용을 이 폰으로 가져오려면 취소하고\n설정 → 시트에서 불러오기를 눌러 주세요.',
              confirmText: '덮어쓰기',
              tone: 'danger',
              icon: '☁️',
            })
      const sheetId = await upload(ledger, syncRef.current.sheetId, ask)
      if (!sheetId) return
      // 업로드하는 동안 새로 쓴 내역은 '업로드 안 됨'으로 남겨 둔다.
      setSync((s) => ({ sheetId, uploadedAt: Date.now(), changes: Math.max(0, s.changes - before) }))
      setNotice({ kind: 'ok', text: '구글 시트에 올렸어요.', link: sheetUrl(sheetId) })
    })
  }

  async function handleRestore() {
    const ok = await confirmDialog({
      title: '시트에서 불러올까요?',
      message:
        '이 폰의 가계부가 구글 시트 내용으로 바뀌어요.' +
        (sync.changes > 0 ? `\n아직 업로드하지 않은 변경 ${sync.changes}건은 사라져요.` : ''),
      confirmText: '불러오기',
      tone: sync.changes > 0 ? 'danger' : 'default',
      icon: '⬇️',
    })
    if (!ok) return
    withGoogle('restore', async () => {
      const result = await download(syncRef.current.sheetId)
      if (!result) {
        setNotice({ kind: 'error', text: "구글 드라이브에서 '가계부' 시트를 찾지 못했어요. 먼저 업로드해 주세요." })
        return
      }
      saveLedger(result.ledger)
      setLedger(result.ledger)
      setSync({ sheetId: result.id, uploadedAt: Date.now(), changes: 0 })
      setPeriod(periodOf(today(), result.ledger.settings.startDay))
      setEditingSettings(false)
      setNotice({ kind: 'ok', text: `시트에서 내역 ${result.ledger.transactions.length}건을 불러왔어요.` })
    })
  }

  function handleSignOut() {
    signOut()
    setNotice({ kind: 'ok', text: '구글 연결을 해제했어요. 폰의 가계부는 그대로예요.' })
  }

  function handleExport() {
    downloadCsv(ledger.transactions, `가계부_${today()}.csv`)
  }

  const range = periodRange(period, startDay)
  const periodTx = ledger.transactions.filter((t) => inRange(t.date, range))
  const visibleTx = filter === 'all' ? periodTx : periodTx.filter((t) => t.type === filter)
  const isCurrent = inRange(today(), range)
  const newDate = isCurrent ? today() : range.start

  let syncText = '폰에 저장돼요'
  if (cloudEnabled) {
    if (!sync.uploadedAt) syncText = ledger.transactions.length ? '아직 구글 시트에 올리지 않았어요' : '폰에 저장돼요'
    else if (sync.changes > 0) syncText = `업로드 안 된 변경 ${sync.changes}건`
    else syncText = `☁ ${timeText(sync.uploadedAt)} 업로드됨`
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>가계부</h1>
          <p className={`muted small ${sync.changes > 0 && sync.uploadedAt ? 'pending' : ''}`}>{syncText}</p>
        </div>
        <div className="top-actions">
          {cloudEnabled && (
            <button type="button" className="upload-btn" onClick={handleUpload} disabled={Boolean(cloudBusy)}>
              {cloudBusy === 'upload' ? '올리는 중…' : '☁ 업로드'}
              {sync.changes > 0 && !cloudBusy && <span className="badge">{sync.changes > 99 ? '99+' : sync.changes}</span>}
            </button>
          )}
          <button type="button" className="icon-btn settings-btn" aria-label="설정" onClick={() => setEditingSettings(true)}>
            ⚙
          </button>
        </div>
      </header>

      {notice && (
        <div className={`banner ${notice.kind === 'error' ? 'banner-error' : ''}`}>
          <span>
            {notice.kind === 'ok' ? '✓ ' : '⚠ '}
            {notice.text}
            {notice.link && (
              <>
                {' '}
                <a href={notice.link} target="_blank" rel="noreferrer">
                  시트 열기
                </a>
              </>
            )}
          </span>
          <button type="button" className="icon-btn" aria-label="닫기" onClick={() => setNotice(null)}>
            ✕
          </button>
        </div>
      )}

      <nav className="month-nav">
        <button type="button" className="icon-btn" aria-label="이전 기간" onClick={() => setPeriod(shiftMonth(period, -1))}>
          ‹
        </button>
        <div className="period-title">
          <strong>{periodLabel(period, startDay)}</strong>
          {startDay !== 1 && (
            <span className="muted tiny">
              {period.slice(0, 4)}년 · 매달 {startDay}일 시작
            </span>
          )}
        </div>
        <button type="button" className="icon-btn" aria-label="다음 기간" onClick={() => setPeriod(shiftMonth(period, 1))}>
          ›
        </button>
        {!isCurrent && (
          <button type="button" className="chip today-btn" onClick={() => setPeriod(periodOf(today(), startDay))}>
            오늘로
          </button>
        )}
      </nav>

      <Summary transactions={periodTx} budget={ledger.settings.budget} onEditBudget={() => setEditingSettings(true)} />

      <nav className="tabs">
        <button type="button" className={tab === 'list' ? 'active' : ''} onClick={() => setTab('list')}>
          내역
        </button>
        <button type="button" className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')}>
          달력
        </button>
        <button type="button" className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}>
          통계
        </button>
      </nav>

      <main>
        {tab === 'list' && (
          <>
            <div className="filters">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`chip ${filter === f.key ? 'active' : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
              <span className="muted small">{visibleTx.length}건</span>
            </div>
            <TxList
              transactions={visibleTx}
              onOpen={setEditing}
              emptyText={
                periodTx.length === 0
                  ? '이 기간에는 아직 내역이 없어요. 아래 ＋ 버튼으로 추가해 보세요.'
                  : '해당하는 내역이 없어요.'
              }
            />
          </>
        )}
        {tab === 'calendar' && (
          <Calendar key={period + startDay} range={range} transactions={periodTx} onOpen={setEditing} />
        )}
        {tab === 'stats' && (
          <Stats period={period} startDay={startDay} periodTx={periodTx} allTx={ledger.transactions} />
        )}
      </main>

      <button type="button" className="fab" aria-label="내역 추가" onClick={() => setEditing({})}>
        ＋
      </button>

      {editing && (
        <TxForm
          initial={editing}
          defaultDate={newDate}
          saving={false}
          onSave={handleSaveTx}
          onDelete={handleDeleteTx}
          onCancel={() => setEditing(null)}
        />
      )}

      {editingSettings && (
        <SettingsForm
          settings={ledger.settings}
          cloud={
            cloudEnabled && {
              sheetLink: sync.sheetId && sheetUrl(sync.sheetId),
              busy: cloudBusy,
              signedIn: isSignedIn(),
              onRestore: handleRestore,
              onSignOut: handleSignOut,
            }
          }
          onSave={handleSaveSettings}
          onExport={handleExport}
          onCancel={() => setEditingSettings(false)}
        />
      )}
    </div>
  )
}
