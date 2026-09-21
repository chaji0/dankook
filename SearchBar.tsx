import { useEffect, useMemo, useRef, useState } from 'react'
import { Lesson, Target } from '../lib/types'
import { NowInfo, currentLessonText } from '../lib/schedule'

interface Props {
  targets: Target[]
  lessons: Lesson[]
  now: NowInfo
  selectedKey: string
  onSelect: (target: Target) => void
}

const MAX_RESULTS = 8

export default function SearchBar({ targets, lessons, now, selectedKey, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '')
    if (!q) return []
    // 선생님은 이름으로, 학생은 학번으로 찾는다 (학반은 옆의 "학반" 버튼으로 고른다)
    const score = (t: Target): number => {
      if (t.kind === '교사') {
        const name = t.name.replace(/\s+/g, '')
        if (name === q) return 0
        if (name.startsWith(q)) return 1
        if (name.includes(q)) return 3
        return -1
      }
      if (t.kind === '학생') {
        if (t.id === q) return 0
        if (t.id.startsWith(q)) return 2
        return -1
      }
      return -1
    }
    return targets
      .map((t) => ({ t, s: score(t) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => a.s - b.s || a.t.label.localeCompare(b.t.label, 'ko'))
      .slice(0, MAX_RESULTS)
      .map((r) => r.t)
  }, [query, targets])

  useEffect(() => setCursor(0), [query])

  function choose(t: Target | undefined) {
    if (!t) return
    onSelect(t)
    setQuery('')
    setFocused(false)
    inputRef.current?.blur()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(results[cursor])
    } else if (e.key === 'Escape') {
      setQuery('')
      inputRef.current?.blur()
    }
  }

  const open = focused && query.trim().length > 0

  return (
    <div className="search">
      <input
        ref={inputRef}
        className="search-input"
        type="text"
        value={query}
        placeholder="선생님 이름 · 학생 학번"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        onKeyDown={handleKeyDown}
        aria-label="시간표 검색"
        autoComplete="off"
      />
      {open && (
        <ul className="search-results" role="listbox">
          {results.length === 0 && <li className="search-empty">맞는 선생님·학번이 없습니다.</li>}
          {results.map((t, i) => {
            const mine = lessons.filter((l) => l.kind === t.kind && (l.id || l.name) === (t.id || t.name))
            return (
              <li key={t.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={t.key === selectedKey}
                  className={`search-item${i === cursor ? ' is-cursor' : ''}`}
                  onMouseEnter={() => setCursor(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(t)}
                >
                  <span className="search-item-kind">{t.kind}</span>
                  <span className="search-item-label">
                    {t.label}
                    {t.sub && <em className="search-item-sub">{t.sub}</em>}
                  </span>
                  <span className="search-item-now">{currentLessonText(mine, now)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
