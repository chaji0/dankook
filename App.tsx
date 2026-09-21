import { useCallback, useEffect, useMemo, useState } from 'react'
import BearButton from './components/BearButton'
import ClassPicker from './components/ClassPicker'
import SearchBar from './components/SearchBar'
import SettingsView from './components/SettingsView'
import TimetableGrid from './components/TimetableGrid'
import { AppState, Target, emptyState, findMine } from './lib/types'
import { NowInfo, computeNow, currentLessonText } from './lib/schedule'
import { applyLook } from './lib/themes'

type Mode = 'collapsed' | 'expanded' | 'settings'

export default function App() {
  const [state, setState] = useState<AppState>(emptyState)
  const [mode, setMode] = useState<Mode>('collapsed')
  const [selectedKey, setSelectedKey] = useState('')
  const [now, setNow] = useState<NowInfo>(() => computeNow(emptyState().blocks))

  // 저장된 상태 불러오기 — 처음엔 "내 시간표"부터 보여 준다
  useEffect(() => {
    window.bear.getState().then((s) => {
      setState(s)
      const mine = findMine(s.targets, s.settings.myName)
      setSelectedKey(mine?.key ?? s.settings.lastTargetKey)
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

  // 화면 설정 (테마색 · 칸 높이 · 글씨 크기 · 카드 진하기)
  const { theme, widgetSize, fontSize, opacity } = state.settings
  useEffect(() => {
    applyLook({ theme, widgetSize, fontSize, opacity })
  }, [theme, widgetSize, fontSize, opacity])

  const patch = useCallback((partial: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...partial, settings: { ...prev.settings, ...(partial.settings ?? {}) } }))
    window.bear.patchState(partial)
  }, [])

  const go = useCallback((next: Mode) => {
    setMode(next)
    window.bear.setMode(next)
  }, [])

  const mine = useMemo(() => findMine(state.targets, state.settings.myName), [state.targets, state.settings.myName])
  const classes = useMemo(() => state.targets.filter((t) => t.kind === '학급'), [state.targets])

  const selected = useMemo(
    () => state.targets.find((t) => t.key === selectedKey) ?? mine ?? state.targets[0] ?? null,
    [state.targets, selectedKey, mine],
  )

  const lessons = useMemo(() => {
    if (!selected) return []
    return state.lessons.filter((l) => l.kind === selected.kind && (l.id || l.name) === (selected.id || selected.name))
  }, [state.lessons, selected])

  const pick = useCallback(
    (t: Target) => {
      setSelectedKey(t.key)
      patch({ settings: { ...state.settings, lastKind: t.kind, lastTargetKey: t.key } })
    },
    [patch, state.settings],
  )

  const isMine = !!mine && selected?.key === mine.key
  const statusText = selected ? currentLessonText(lessons, now) : ''

  const timeText =
    now.phase === '주말'
      ? '오늘은 수업이 없습니다'
      : now.phase === '수업중'
        ? `${now.minutesLeft}분 남음`
        : now.phase === '쉬는시간'
          ? `${now.breakLabel} · ${now.minutesLeft}분 남음`
          : now.phase === '수업전'
            ? '아직 1교시 전입니다'
            : '오늘 수업이 모두 끝났습니다'

  // 상태 줄 맨 앞에 붙는 이름: 차지영 · 4교시 ...
  const whoText = selected ? (selected.kind === '학생' ? selected.label : selected.name) : ''
  const whoMeta = selected
    ? selected.kind === '교사'
      ? '선생님 시간표'
      : selected.kind === '학급'
        ? '학반 시간표'
        : '학생 시간표'
    : ''

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
                  <p className="status-now">
                    {whoText && <span className="status-who">{whoText}</span>}
                    {whoText && <span className="status-dot"> · </span>}
                    {statusText || '시간표를 골라 주세요'}
                  </p>
                  <p className="status-meta">
                    {whoMeta && `${whoMeta} · `}
                    {timeText}
                  </p>
                </div>

                <div className="toolbar">
                  <div className="segs">
                    <button
                      type="button"
                      className={`seg${isMine ? ' is-on' : ''}`}
                      title={mine ? `${mine.label} 시간표` : '설정에서 내 이름을 입력하면 내 시간표가 열립니다'}
                      onClick={() => (mine ? pick(mine) : go('settings'))}
                    >
                      나
                    </button>
                    <ClassPicker
                      classes={classes}
                      current={selected?.kind === '학급' ? selected : null}
                      onSelect={pick}
                    />
                  </div>
                  <SearchBar
                    targets={state.targets}
                    lessons={state.lessons}
                    now={now}
                    selectedKey={selected?.key ?? ''}
                    onSelect={pick}
                  />
                  <button type="button" className="ghost-button" onClick={() => go('settings')}>
                    설정
                  </button>
                </div>
              </header>

              {selected ? (
                <div className="grid-wrap">
                  <TimetableGrid lessons={lessons} blocks={state.blocks} now={now} />
                </div>
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
        hint={mine ? currentLessonText(state.lessons.filter((l) => `${l.kind}:${l.id || l.name}` === mine.key), now) : statusText}
        onToggle={() => go(mode === 'collapsed' ? 'expanded' : 'collapsed')}
        onSettings={() => go('settings')}
      />
    </div>
  )
}
