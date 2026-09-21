import { useEffect, useMemo, useRef, useState } from 'react'
import { Target } from '../lib/types'

interface Props {
  /** 학급 시간표 목록 */
  classes: Target[]
  /** 지금 보고 있는 학급 (없으면 null) */
  current: Target | null
  onSelect: (target: Target) => void
}

/** "학반" 버튼 — 누르면 학년별로 반 번호가 펼쳐진다 */
export default function ClassPicker({ classes, current, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // 학년 → 반 목록 (반 번호 순)
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

  return (
    <div className="picker" ref={wrapRef}>
      <button
        type="button"
        className={`seg${current ? ' is-on' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {current ? current.name : '학반'}
      </button>
      {open && (
        <div className="picker-pop" role="dialog" aria-label="학반 고르기">
          {grades.length === 0 && <p className="picker-empty">설정에서 시간표 엑셀을 먼저 불러와 주세요.</p>}
          {grades.map(({ grade, list }) => (
            <div key={grade} className="picker-row">
              <span className="picker-grade">{grade}학년</span>
              <div className="picker-nums">
                {list.map(({ no, target }) => (
                  <button
                    key={target.key}
                    type="button"
                    className={`picker-num${current?.key === target.key ? ' is-on' : ''}`}
                    onClick={() => {
                      onSelect(target)
                      setOpen(false)
                    }}
                  >
                    {no}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
