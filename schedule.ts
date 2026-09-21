import { Block, Lesson } from './types'

export const DAY_LABELS = ['월', '화', '수', '목', '금']

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export type NowPhase = '수업중' | '쉬는시간' | '수업전' | '수업끝' | '주말'

export interface NowInfo {
  phase: NowPhase
  /** 0=월 ... 4=금, 주말이면 -1 */
  day: number
  /** 수업중일 때의 교시 */
  period: number | null
  /** 다음 교시 (쉬는 시간·수업 전에 쓰인다) */
  nextPeriod: number | null
  /** 쉬는 시간 이름(점심시간 등) */
  breakLabel: string | null
  /** 지금 구간이 끝날 때까지 남은 분 */
  minutesLeft: number | null
}

/** 요일별로 실제 운영되는 블록만 추린다 */
export function blocksOfDay(blocks: Block[], day: number): Block[] {
  return blocks
    .filter((b) => b.days.includes(day))
    .slice()
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
}

export function computeNow(blocks: Block[], at: Date = new Date()): NowInfo {
  const jsDay = at.getDay() // 0=일
  const day = jsDay >= 1 && jsDay <= 5 ? jsDay - 1 : -1
  if (day < 0) {
    return { phase: '주말', day: -1, period: null, nextPeriod: null, breakLabel: null, minutesLeft: null }
  }

  const today = blocksOfDay(blocks, day)
  if (today.length === 0) {
    return { phase: '수업끝', day, period: null, nextPeriod: null, breakLabel: null, minutesLeft: null }
  }

  const now = at.getHours() * 60 + at.getMinutes()
  const first = today[0]
  const last = today[today.length - 1]

  const nextClassAfter = (t: number) => today.find((b) => b.type === 'class' && toMinutes(b.start) > t) ?? null

  if (now < toMinutes(first.start)) {
    return {
      phase: '수업전',
      day,
      period: null,
      nextPeriod: nextClassAfter(now)?.period ?? null,
      breakLabel: null,
      minutesLeft: toMinutes(first.start) - now,
    }
  }
  if (now >= toMinutes(last.end)) {
    return { phase: '수업끝', day, period: null, nextPeriod: null, breakLabel: null, minutesLeft: null }
  }

  for (const b of today) {
    const s = toMinutes(b.start)
    const e = toMinutes(b.end)
    if (now >= s && now < e) {
      if (b.type === 'class') {
        return {
          phase: '수업중',
          day,
          period: b.period,
          nextPeriod: nextClassAfter(now)?.period ?? null,
          breakLabel: null,
          minutesLeft: e - now,
        }
      }
      return {
        phase: '쉬는시간',
        day,
        period: null,
        nextPeriod: nextClassAfter(now)?.period ?? null,
        breakLabel: b.label ?? '쉬는 시간',
        minutesLeft: e - now,
      }
    }
  }

  // 블록 사이 틈(시정을 직접 고쳤을 때)
  return {
    phase: '쉬는시간',
    day,
    period: null,
    nextPeriod: nextClassAfter(now)?.period ?? null,
    breakLabel: '쉬는 시간',
    minutesLeft: null,
  }
}

/** 이 시간표에 실제로 등장하는 교시 목록 */
export function periodsOf(blocks: Block[]): number[] {
  const set = new Set<number>()
  blocks.forEach((b) => b.type === 'class' && set.add(b.period))
  return [...set].sort((a, b) => a - b)
}

export function blockOf(blocks: Block[], day: number, period: number): Block | null {
  return blocks.find((b) => b.type === 'class' && b.period === period && b.days.includes(day)) ?? null
}

/** 한 대상의 수업을 [교시][요일] 격자로 정리 */
export function toGrid(lessons: Lesson[], periods: number[]): Record<number, Record<number, Lesson | undefined>> {
  const grid: Record<number, Record<number, Lesson | undefined>> = {}
  periods.forEach((p) => (grid[p] = {}))
  for (const l of lessons) {
    if (!grid[l.period]) grid[l.period] = {}
    grid[l.period][l.day] = l
  }
  return grid
}

/** 칸 하나를 한 줄로 요약한다 — 교사 시간표는 학급이, 학급·학생 시간표는 교실·선생님이 붙는다 */
export function lessonSummary(l: Lesson): string {
  const head = l.kind === '교사' && l.className ? `${l.className} ${l.subject}` : l.subject
  const tail = [l.room, l.kind === '교사' ? '' : l.teacher].filter(Boolean)
  return tail.length ? `${head} · ${tail.join(' · ')}` : head
}

/** 지금 이 대상이 듣고 있는(또는 곧 들을) 수업 한 줄 요약 */
export function currentLessonText(lessons: Lesson[], now: NowInfo): string {
  if (now.phase === '주말') return '주말'
  const pick = (period: number | null) =>
    period == null ? undefined : lessons.find((l) => l.day === now.day && l.period === period)

  if (now.phase === '수업중') {
    const l = pick(now.period)
    if (!l) return `${now.period}교시 · 수업 없음`
    return `${now.period}교시 ${lessonSummary(l)}`
  }
  const l = pick(now.nextPeriod)
  if (!l) return now.phase === '수업끝' ? '오늘 수업 끝' : '다음 수업 없음'
  return `다음 ${now.nextPeriod}교시 ${lessonSummary(l)}`
}
