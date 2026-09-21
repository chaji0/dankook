import { useCallback, useEffect, useMemo, useState } from 'react'
import BearButton from './components/BearButton'
import SearchBar from './components/SearchBar'
import SettingsView from './components/SettingsView'
import TimetableGrid from './components/TimetableGrid'
import { AppState, KINDS, Kind, Target, emptyState } from './lib/types'
import { NowInfo, computeNow, currentLessonText } from './lib/schedule'

type Mode = 'collapsed' | 'expanded' | 'settings'

export default function App() {
  const [state, setState] = useState<AppState>(emptyState)
  const [mode, setMode] = useState<Mode>('collapsed')
  const [kind, setKind] = useState<Kind>('학급')
  const [selectedKey, setSelectedKey] = useState('')
  const [now, setNow] = useState<NowInfo>(() => computeNow(emptyState().blocks))

  // 저장된 상태 불러오기
  useEffect(() => {
    window.bear.getState().then((s) => {
      setState(s)
      setKind(s.settings.lastKind)
      setSelectedKey(s.settings.lastTargetKey)
    })
    return window.bear.onMode(setMode)
  }, [])

  // 30초마다 현재 교시를 다시 계산한다
  useEffect(() => {
    const tick = () => setNow(computeNow(state.blocks))
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [state.blocks])

  // 카드 진하기
  useEffect(() => {
    document.documentElement.style.setProperty('--surface-alpha', String(state.settings.opacity))
  }, [state.settings.opacity])

  const patch = useCallback((partial: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...partial, settings: { ...prev.settings, ...(partial.settings ?? {}) } }))
    window.bear.patchState(partial)
  }, [])

  const go = useCallback((next: Mode) => {
    setMode(next)
    window.bear.setMode(next)
  }, [])

  const targetsOfKind = useMemo(() => state.targets.filter((t) => t.kind === kind), [state.targets, kind])

  const selected = useMemo(
    () => state.targets.find((t) => t.key === selectedKey) ?? targetsOfKind[0] ?? null,
    [state.targets, selectedKey, targetsOfKind],
  )

  const lessons = useMemo(() => {
    if (!selected) return []
    return state.lessons.filter((l) => l.kind === selected.kind && (l.id || l.name) === (selected.id || selected.name))
  }, [state.lessons, selected])

  const pick = useCallback(
    (t: Target) => {
      setKind(t.kind)
      setSelectedKey(t.key)
      patch({ settings: { ...state.settings, lastKind: t.kind, lastTargetKey: t.key } })
    },
    [patch, state.settings],
  )

  const statusText = currentLessonText(lessons, now)
  const hint = selected ? statusText : ''

  return (
    <div className={`app is-${mode}`}>
      {mode !== 'collapsed' && (
        <div className="card">
          {mode === 'settings' ? (
            <SettingsView state={state} onPatch={patch} onClose={() => go('expanded')} />
          ) : (
            <div className="panel">
              <header className="panel-head">
                <div className="status">
                  <p className="status-now">{statusText}</p>
                  <p className="status-meta">
                    {now.phase === '주말'
                      ? '오늘은 수업이 없습니다'
                      : now.phase === '수업중'
                        ? `${now.minutesLeft}분 남음`
                        : now.phase === '쉬는시간'
                          ? `${now.breakLabel} · ${now.minutesLeft}분 남음`
                          : now.phase === '수업전'
                            ? '아직 1교시 전입니다'
                            : '오늘 수업이 모두 끝났습니다'}
                  </p>
                </div>
                <button type="button" className="ghost-button" onClick={() => go('settings')}>
                  설정
                </button>
              </header>

              <div className="panel-controls">
                <div className="tabs" role="tablist">
                  {KINDS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      aria-selected={k === kind}
                      className={`tab${k === kind ? ' is-on' : ''}`}
                      onClick={() => {
                        setKind(k)
                        const first = state.targets.find((t) => t.kind === k)
                        if (first) pick(first)
                      }}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <SearchBar
                  targets={state.targets}
                  lessons={state.lessons}
                  now={now}
                  selectedKey={selected?.key ?? ''}
                  onSelect={pick}
                />
              </div>

              {selected ? (
                <>
                  <p className="panel-subject">{selected.label}</p>
                  <TimetableGrid lessons={lessons} blocks={state.blocks} now={now} />
                </>
              ) : (
                <div className="empty">
                  <p className="empty-title">아직 시간표가 없습니다</p>
                  <p className="empty-body">
                    곰돌이를 오른쪽 클릭하거나 위의 설정에서 엑셀 파일을 올리면 여기에 주간 시간표가 나옵니다.
                  </p>
                  <button type="button" className="solid-button" onClick={() => go('settings')}>
                    엑셀 불러오기
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <BearButton
        open={mode !== 'collapsed'}
        hint={hint}
        onToggle={() => go(mode === 'collapsed' ? 'expanded' : 'collapsed')}
        onSettings={() => go('settings')}
      />
    </div>
  )
}
