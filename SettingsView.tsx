import { useState } from 'react'
import { AppState, Block, Settings, findMine } from '../lib/types'
import { DAY_LABELS } from '../lib/schedule'
import { SIZE_LABELS, SizeStep, THEMES } from '../lib/themes'

interface Props {
  state: AppState
  onPatch: (partial: Partial<AppState>) => void
  onClose: () => void
}

type Tab = 'basic' | 'look'

const STEPS: SizeStep[] = ['small', 'medium', 'large']

export default function SettingsView({ state, onPatch, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('basic')
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [periodsOpen, setPeriodsOpen] = useState(false)

  const s = state.settings
  const mine = findMine(state.targets, s.myName)
  const set = (next: Partial<Settings>) => onPatch({ settings: { ...s, ...next } })

  async function importExcel() {
    setBusy(true)
    setNotice(null)
    try {
      const res = await window.bear.importExcel()
      if (res.canceled) return
      if (res.error) {
        setNotice({ tone: 'bad', text: res.error })
        return
      }
      if (res.state) {
        onPatch(res.state)
        setNotice({ tone: 'ok', text: res.warnings?.join(' ') ?? '시간표를 불러왔습니다.' })
      }
    } finally {
      setBusy(false)
    }
  }

  async function clearExcel() {
    setBusy(true)
    try {
      const next = await window.bear.clearExcel()
      onPatch(next)
      setNotice({ tone: 'ok', text: '불러온 시간표를 모두 지웠습니다.' })
    } finally {
      setBusy(false)
    }
  }

  async function removeFile(name: string) {
    setBusy(true)
    try {
      const next = await window.bear.removeExcel(name)
      onPatch(next)
      setNotice({ tone: 'ok', text: `${name}을(를) 지웠습니다.` })
    } finally {
      setBusy(false)
    }
  }

  /** 파일 하나에서 무엇을 읽었는지 한 줄로 */
  function describeFile(name: string): string {
    const mine = state.targets.filter((t) => t.source === name)
    const n = (k: string, derived = false) => mine.filter((t) => t.kind === k && !!t.derived === derived).length
    const parts = [
      n('교사') && `선생님 ${n('교사')}명`,
      n('학급') && `학급 ${n('학급')}개`,
      n('학생') && `학생 ${n('학생')}명`,
      n('학급', true) && `학급 ${n('학급', true)}개 자동`,
    ].filter(Boolean)
    return parts.length ? parts.join(' · ') : '다시 불러오면 내용이 표시됩니다'
  }

  function setBlock(index: number, next: Partial<Block>) {
    const blocks = state.blocks.map((b, i) => (i === index ? { ...b, ...next } : b))
    onPatch({ blocks })
  }

  function toggleDay(index: number, day: number) {
    const block = state.blocks[index]
    const days = block.days.includes(day) ? block.days.filter((d) => d !== day) : [...block.days, day].sort()
    setBlock(index, { days })
  }


  const classBlocks = state.blocks.filter((b) => b.type === 'class')
  const periodSummary = classBlocks.length
    ? `${classBlocks[0].start} 시작 · ${classBlocks.length}교시까지 · ${classBlocks[classBlocks.length - 1].end} 끝`
    : ''

  return (
    <div className="settings">
      <header className="settings-head">
        <div className="settings-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'basic'}
            className={`seg${tab === 'basic' ? ' is-on' : ''}`}
            onClick={() => setTab('basic')}
          >
            기본 설정
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'look'}
            className={`seg${tab === 'look' ? ' is-on' : ''}`}
            onClick={() => setTab('look')}
          >
            화면
          </button>
        </div>
        <button type="button" className="ghost-button" onClick={onClose}>
          시간표로 돌아가기
        </button>
      </header>

      {tab === 'basic' ? (
        <>
          <section className="settings-block">
            <h2 className="settings-heading">내 이름</h2>
            <div className="settings-row">
              <input
                className="settings-input"
                type="text"
                value={s.myName}
                placeholder="선생님은 이름, 학생은 학번"
                onChange={(e) => set({ myName: e.target.value })}
                aria-label="내 이름 또는 학번"
              />
              <p className="settings-note">
                {!s.myName.trim()
                  ? '입력하면 위젯을 열 때 내 시간표가 가장 먼저 나옵니다.'
                  : mine
                    ? `${mine.kind === '교사' ? `${mine.name} 선생님` : mine.label} 시간표를 찾았습니다. 위젯을 열면 이 시간표부터 보여 줍니다.`
                    : '불러온 시간표에서 이 이름을 찾지 못했습니다.'}
              </p>
            </div>
          </section>

          <section className="settings-block">
            <h2 className="settings-heading">시간표 파일</h2>
            <div className="settings-row">
              <button type="button" className="solid-button" onClick={importExcel} disabled={busy}>
                {busy ? '읽는 중…' : '엑셀 불러오기'}
              </button>
              {state.sources.length > 0 && (
                <button type="button" className="ghost-button is-danger" onClick={clearExcel} disabled={busy}>
                  모두 지우기
                </button>
              )}
            </div>
            {state.sources.length > 0 ? (
              <ul className="files">
                {state.sources.map((f) => (
                  <li key={f} className="file">
                    <span className="file-name">{f}</span>
                    <span className="file-meta">{describeFile(f)}</span>
                    <button
                      type="button"
                      className="file-x"
                      aria-label={`${f} 지우기`}
                      title="이 파일만 지우기"
                      disabled={busy}
                      onClick={() => removeFile(f)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="settings-note">
                나이스에서 내려받은 시간표 엑셀을 그대로 올리면 됩니다. 선생님·학급·학생 파일을 따로 올려도 합쳐집니다.
              </p>
            )}
            {notice && <p className={`settings-notice is-${notice.tone}`}>{notice.text}</p>}
          </section>

          <section className="settings-block">
            <h2 className="settings-heading">실행 방식</h2>
            <label className="settings-check">
              <input type="checkbox" checked={s.alwaysOnTop} onChange={(e) => set({ alwaysOnTop: e.target.checked })} />
              <span>다른 창 위에 항상 띄우기</span>
            </label>
            <label className="settings-check">
              <input type="checkbox" checked={s.autoLaunch} onChange={(e) => set({ autoLaunch: e.target.checked })} />
              <span>Windows 켤 때 자동으로 실행하기</span>
            </label>
          </section>

          <section className="settings-block">
            <button
              type="button"
              className="fold-head"
              aria-expanded={periodsOpen}
              onClick={() => setPeriodsOpen((v) => !v)}
            >
              <span className="settings-heading">수업 시간</span>
              <span className="fold-summary">{periodSummary}</span>
              <span className={`fold-caret${periodsOpen ? ' is-open' : ''}`} aria-hidden="true">
                ›
              </span>
            </button>
            {periodsOpen && (
              <>
                <p className="settings-note">
                  학교 시정이 바뀌면 여기서 고치면 됩니다. 요일을 끄면 그 요일에는 없는 시간이 됩니다.
                </p>
                <ul className="periods">
                  {state.blocks.map((b, i) => (
                    <li key={`${b.type}-${b.period}-${i}`} className="period-row">
                      <span className="period-name">
                        {b.type === 'class' ? `${b.period}교시` : (b.label ?? '쉬는 시간')}
                      </span>
                      <input
                        type="time"
                        className="period-time"
                        value={b.start}
                        onChange={(e) => setBlock(i, { start: e.target.value })}
                        aria-label="시작 시각"
                      />
                      <span className="period-dash">–</span>
                      <input
                        type="time"
                        className="period-time"
                        value={b.end}
                        onChange={(e) => setBlock(i, { end: e.target.value })}
                        aria-label="끝 시각"
                      />
                      <span className="period-days">
                        {DAY_LABELS.map((d, day) => (
                          <button
                            key={d}
                            type="button"
                            className={`day-chip${b.days.includes(day) ? ' is-on' : ''}`}
                            onClick={() => toggleDay(i, day)}
                            aria-pressed={b.days.includes(day)}
                          >
                            {d}
                          </button>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <footer className="settings-foot">
            <button type="button" className="ghost-button" onClick={() => window.bear.openDataFolder()}>
              저장 폴더 열기
            </button>
            <button type="button" className="ghost-button is-danger" onClick={() => window.bear.quit()}>
              위젯 끄기
            </button>
          </footer>
        </>
      ) : (
        <>
          <section className="settings-block">
            <h2 className="settings-heading">테마색</h2>
            <div className="themes" role="radiogroup" aria-label="테마색">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={s.theme === t.id}
                  aria-label={t.name}
                  title={t.name}
                  className={`theme${s.theme === t.id ? ' is-on' : ''}`}
                  style={{ background: t.color }}
                  onClick={() => set({ theme: t.id })}
                />
              ))}
            </div>
            <p className="settings-note">선택한 색은 버튼, 지금 교시 칸, 학반·학생 시간표 칸에 쓰입니다.</p>
          </section>

          <section className="settings-block">
            <h2 className="settings-heading">위젯 크기</h2>
            <StepPicker value={s.widgetSize} onChange={(v) => set({ widgetSize: v })} />
            <p className="settings-note">설정 화면은 늘 같은 크기이고, 시간표로 돌아가면 고른 크기로 보입니다.</p>
          </section>

          <section className="settings-block">
            <h2 className="settings-heading">글씨 크기</h2>
            <StepPicker value={s.fontSize} onChange={(v) => set({ fontSize: v })} />
          </section>

          <section className="settings-block">
            <h2 className="settings-heading">투명도</h2>
            <label className="settings-slider">
              <span>카드 진하기</span>
              <input
                type="range"
                min={50}
                max={100}
                step={2}
                value={Math.round(s.opacity * 100)}
                onChange={(e) => set({ opacity: Number(e.target.value) / 100 })}
              />
              <span className="settings-value">{Math.round(s.opacity * 100)}%</span>
            </label>
          </section>
        </>
      )}
    </div>
  )
}

function StepPicker({ value, onChange }: { value: SizeStep; onChange: (v: SizeStep) => void }) {
  return (
    <div className="segs" role="radiogroup">
      {STEPS.map((step) => (
        <button
          key={step}
          type="button"
          role="radio"
          aria-checked={value === step}
          className={`seg${value === step ? ' is-on' : ''}`}
          onClick={() => onChange(step)}
        >
          {SIZE_LABELS[step]}
        </button>
      ))}
    </div>
  )
}
