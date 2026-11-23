import { useEffect } from 'react'

// 아래에서 올라오는 시트. 바깥(어두운 영역)을 누르거나 Esc를 누르면 onDismiss.
export default function Sheet({ title, onDismiss, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onDismiss()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div className="dim" onMouseDown={(e) => e.target === e.currentTarget && onDismiss()}>
      <section className="sheet" role="dialog" aria-label={title}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="닫기" onClick={onDismiss}>
            ✕
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}
