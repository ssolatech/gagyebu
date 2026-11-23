import { useEffect, useRef, useSyncExternalStore } from 'react'

// 브라우저 기본 confirm/alert 대신 쓰는 앱 디자인 안내창.
// 어디서든 부를 수 있다:  if (await confirmDialog({ title, message })) { ... }
//                         await alertDialog({ title, message })
// 화면에는 <DialogHost /> 하나만 두면 된다. (main.jsx)

let current = null // { kind, title, message, confirmText, cancelText, tone, icon, resolve }
const listeners = new Set()

function show(options) {
  return new Promise((resolve) => {
    current?.resolve(false) // 이미 떠 있는 창이 있으면 취소로 닫는다
    current = { ...options, resolve }
    listeners.forEach((l) => l())
  })
}

function close(result) {
  if (!current) return
  const { resolve } = current
  current = null
  listeners.forEach((l) => l())
  resolve(result)
}

/**
 * 확인 창. 확인 → true, 취소/바깥/Esc → false
 * tone: 'default' | 'danger' (삭제처럼 되돌릴 수 없는 일은 빨간 버튼)
 */
export function confirmDialog({ title, message, confirmText = '확인', cancelText = '취소', tone = 'default', icon }) {
  return show({ kind: 'confirm', title, message, confirmText, cancelText, tone, icon })
}

/** 알림 창. 확인 버튼 하나. */
export function alertDialog({ title, message, confirmText = '확인', tone = 'default', icon }) {
  return show({ kind: 'alert', title, message, confirmText, tone, icon })
}

const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

const DEFAULT_ICON = { default: '💬', danger: '🗑️', warn: '⚠️' }

export function DialogHost() {
  const dialog = useSyncExternalStore(subscribe, () => current)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!dialog) return
    document.documentElement.classList.add('dialog-open')
    // 버튼이 아니라 창 자체에 포커스를 둔다. (엔터 한 번에 삭제 같은 일이 실행되지 않게)
    boxRef.current?.focus()
    // 캡처 단계에서 먼저 받아서, 뒤에 열린 시트의 Esc 닫기가 같이 실행되지 않게 막는다.
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.documentElement.classList.remove('dialog-open')
    }
  }, [dialog])

  if (!dialog) return null
  const isConfirm = dialog.kind === 'confirm'
  const icon = dialog.icon ?? DEFAULT_ICON[dialog.tone] ?? DEFAULT_ICON.default

  return (
    <div className="dialog-dim" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
      <div
        ref={boxRef}
        tabIndex={-1}
        className={`dialog dialog-${dialog.tone}`}
        role={isConfirm ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-message"
      >
        <div className="dialog-icon" aria-hidden>
          {icon}
        </div>
        <h2 id="dialog-title">{dialog.title}</h2>
        {dialog.message && (
          <p id="dialog-message" className="dialog-message">
            {dialog.message}
          </p>
        )}
        <div className="dialog-actions">
          {isConfirm && (
            <button type="button" className="dialog-btn cancel" onClick={() => close(false)}>
              {dialog.cancelText}
            </button>
          )}
          <button type="button" className={`dialog-btn ok ${dialog.tone}`} onClick={() => close(true)}>
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
