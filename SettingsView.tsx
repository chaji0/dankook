import { useState } from 'react'
import { AppState, Block } from '../lib/types'
import { DAY_LABELS } from '../lib/schedule'

interface Props {
  state: AppState
  onPatch: (partial: Partial<AppState>) => void
  onClose: () => void
}

export default function SettingsView({ state, onPatch, onClose }: Props) {
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

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

  function setBlock(index: number, next: Partial<Block>) {
    const blocks = state.blocks.map((b, i) => (i === index ? { ...b, ...next } : b))
    onPatch({ blocks })
  }

  function toggleDay(index: number, day: number) {
    const block = state.blocks[index]
    const days = block.days.includes(day) ? block.days.filter((d) => d !== day) : [...block.days, day].sort()
    setBlock(index, { days })
  }

  const counts = {
    교사: state.targets.filter((t) => t.kind === '교사').length,
    학급: state.targets.filter((t) => t.kind === '학급').length,
    학생: state.targets.filter((t) => t.kind === '학생').length,
  }

  const s = state.settings

  return (
    <div className="settings">
      <header className="settings-head">
        <h1 className="settings-title">설정</h1>
        <button type="button" className="ghost-button" onClick={onClose}>
          시간표로 돌아가기
        </button>
      </header>

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
        <p className="settings-note">
          {state.sources.length > 0
            ? `${state.sources.join(', ')} · 선생님 ${counts.교사}명 · 학급 ${counts.학급}개 · 학생 ${counts.학생}명`
            : '나이스에서 내려받은 시간표 엑셀을 그대로 올리면 됩니다. 선생님·학급·학생 파일을 따로 올려도 합쳐집니다.'}
        </p>
        {notice && <p className={`settings-notice is-${notice.tone}`}>{notice.text}</p>}
      </section>

      <section className="settings-block">
        <h2 className="settings-heading">실행 방식</h2>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={s.alwaysOnTop}
            onChange={(e) => onPatch({ settings: { ...s, alwaysOnTop: e.target.checked } })}
          />
          <span>다른 창 위에 항상 띄우기</span>
        </label>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={s.autoLaunch}
            onChange={(e) => onPatch({ settings: { ...s, autoLaunch: e.target.checked } })}
          />
          <span>Windows 켤 때 자동으로 실행하기</span>
        </label>
        <label className="settings-slider">
          <span>카드 진하기</span>
          <input
            type="range"
            min={50}
            max={100}
            step={2}
            value={Math.round(s.opacity * 100)}
            onChange={(e) => onPatch({ settings: { ...s, opacity: Number(e.target.value) / 100 } })}
          />
          <span className="settings-value">{Math.round(s.opacity * 100)}%</span>
        </label>
      </section>

      <section className="settings-block">
        <h2 className="settings-heading">수업 시간</h2>
        <p className="settings-note">학교 시정이 바뀌면 여기서 고치면 됩니다. 요일을 끄면 그 요일에는 없는 시간이 됩니다.</p>
        <ul className="periods">
          {state.blocks.map((b, i) => (
            <li key={`${b.type}-${b.period}-${b.start}`} className="period-row">
              <span className="period-name">{b.type === 'class' ? `${b.period}교시` : b.label ?? '쉬는 시간'}</span>
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
      </section>

      <footer className="settings-foot">
        <button type="button" className="ghost-button" onClick={() => window.bear.openDataFolder()}>
          저장 폴더 열기
        </button>
        <button type="button" className="ghost-button is-danger" onClick={() => window.bear.quit()}>
          위젯 끄기
        </button>
      </footer>
    </div>
  )
}
