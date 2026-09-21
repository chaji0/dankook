import { useEffect, useMemo, useRef, useState } from 'react'
import { Target } from '../lib/types'

interface Props {
  /** 학급 시간표 목록 */
  classes: Target[]
  /** 저장해 둔 "내 학반" (없으면 null) */
  saved: Target | null
  /** 지금 학반 시간표를 보고 있는지 */
  active: boolean
  /** 학반 시간표 열기 */
  onOpen: (target: Target) => void
  /** 목록에서 다른 반을 골랐을 때 — 저장까지 한다 */
  onChoose: (target: Target) => void
}

/**
 * [2-2][▼] 버튼
 *   2-2 → 저장해 둔 반 시간표 열기
 *   ▼   → 1-1 ~ 3-13 목록을 스크롤해서 고르기 (고른 반은 껐다 켜도 기억)
 */
export default function ClassPicker({ classes, saved, active, onOpen, onChoose }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // 학년 → 반 (반 번호 순)
  const grades = useMemo(() => {
    const map = new Map<number, { no: number; target: Target }[]>()
    for (const t of classes) {
      const m = t.name.match(/^(\d+)-(\d+)$/)
      if (!m) continue
      const g = Number(m[1])
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push({ no: Number(m[2]), target: t })
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([grade, list]) => ({ grade, list: list.sort((a, b) => a.no - b.no) }))
  }, [classes])

  // 바깥을 누르거나 Esc를 누르면 닫는다
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  // 목록을 열면 저장된 반이 보이도록 스크롤
  useEffect(() => {
    if (!open || !listRef.current) return
    const on = listRef.current.querySelector<HTMLElement>('.is-on')
    if (on) listRef.current.scrollTop = on.offsetTop - 72
  }, [open])

  return (
    <div className="picker" ref={wrapRef}>
      <div className="split">
        <button
          type="button"
          className={`seg split-main${active ? ' is-on' : ''}`}
          onClick={() => (saved ? onOpen(saved) : setOpen(true))}
          title={saved ? `${saved.name} 시간표` : '학반 고르기'}
        >
          {saved ? saved.name : '학반'}
        </button>
        <button
          type="button"
          className={`seg split-caret${active ? ' is-on' : ''}`}
          aria-label="다른 학반 고르기"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          ▼
        </button>
      </div>
      {open && (
        <div className="picker-list" ref={listRef} role="listbox" aria-label="학반 고르기">
          {grades.length === 0 && <p className="picker-empty">설정에서 시간표 엑셀을 먼저 불러와 주세요.</p>}
          {grades.map(({ grade, list }) => (
            <div key={grade}>
              <p className="picker-grade">{grade}학년</p>
              {list.map(({ target }) => (
                <button
                  key={target.key}
                  type="button"
                  role="option"
                  aria-selected={saved?.key === target.key}
                  className={`picker-item${saved?.key === target.key ? ' is-on' : ''}`}
                  onClick={() => {
                    onChoose(target)
                    setOpen(false)
                  }}
                >
                  {target.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
