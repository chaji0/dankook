import { useRef } from 'react'
import bearUrl from '../assets/bear.png'

interface Props {
  open: boolean
  /** 지금 수업 한 줄 (곰돌이에 마우스를 올리면 보인다) */
  hint: string
  onToggle: () => void
  onSettings: () => void
}

const DRAG_THRESHOLD = 4

export default function BearButton({ open, hint, onToggle, onSettings }: Props) {
  const moved = useRef(false)
  const startPoint = useRef({ x: 0, y: 0 })

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button === 2) return
    e.preventDefault()
    moved.current = false
    startPoint.current = { x: e.screenX, y: e.screenY }
    // 창 안쪽 좌표를 그대로 넘긴다 (메인에서 화면 좌표 - 이 값 = 창 위치)
    window.bear.dragStart({ x: e.clientX, y: e.clientY })
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const dx = Math.abs(e.screenX - startPoint.current.x)
    const dy = Math.abs(e.screenY - startPoint.current.y)
    if (!moved.current && dx + dy < DRAG_THRESHOLD) return
    moved.current = true
    window.bear.dragMove({ x: e.screenX, y: e.screenY })
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (!moved.current) onToggle()
  }

  return (
    <div className="bear-slot">
      <button
        type="button"
        className={`bear${open ? ' is-open' : ''}`}
        title={hint || '곰돌이 시간표 — 왼쪽 클릭으로 열고 닫기, 오른쪽 클릭으로 설정'}
        aria-label={open ? '시간표 숨기기' : '시간표 보기'}
        aria-pressed={open}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={(e) => {
          e.preventDefault()
          onSettings()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
      >
        <img src={bearUrl} alt="" className="bear-face" draggable={false} />
      </button>
    </div>
  )
}
