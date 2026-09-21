import type { SizeStep } from './themes'

export type Kind = '교사' | '학급' | '학생'

export const KINDS: Kind[] = ['교사', '학급', '학생']

/** 시간표 한 칸 */
export interface Lesson {
  kind: Kind
  /** 학번 · 교과코드(수학08) · 학급코드 (없으면 빈 문자열) */
  id: string
  /** 이름 · 학급명 */
  name: string
  /** 0=월 ... 4=금 */
  day: number
  /** 1~7 교시 */
  period: number
  /** 교과 (예: 미적분ⅠA) */
  subject: string
  /** 교실 (예: 수학실1) */
  room: string
  /** 과목 선생님 (학급·학생 시간표에서) */
  teacher: string
  /** 학급 (예: 2-2, 교사 시간표에서) */
  className: string
  /** 엑셀 칸에 있던 줄 그대로 — 빠뜨리는 정보가 없게 보관한다 */
  lines: string[]
  /** 교사 시간표에서 자동으로 만들어 낸 학급 시간표이면 true */
  derived?: boolean
  /** 이 칸을 읽어 온 엑셀 파일 이름 (파일별로 지울 때 쓴다) */
  source?: string
}

/** 검색 대상 한 명(한 반) */
export interface Target {
  key: string
  kind: Kind
  id: string
  name: string
  /** 화면에 보이는 이름: 학생은 "20201 김건우" */
  label: string
  /** 이름 옆 작은 글씨: 교사는 교과코드, 학생은 학급 */
  sub: string
  /** 교사 시간표에서 자동으로 만들어 낸 학급이면 true */
  derived?: boolean
  /** 읽어 온 엑셀 파일 이름 */
  source?: string
}

/** 시정(수업 시간) 한 블록 */
export interface Block {
  type: 'class' | 'break'
  /** type이 class일 때만 */
  period: number
  /** "08:30" */
  start: string
  /** "09:20" */
  end: string
  /** 이 블록이 있는 요일 0~4 */
  days: number[]
  /** 쉬는 시간 이름 (점심시간 등) */
  label?: string
}

export interface Settings {
  /** 내 이름(교사) 또는 학번(학생) — "나" 버튼이 이 시간표를 연다 */
  myName: string
  /** 저장해 둔 학반 (Target.key) — 학반 버튼이 이 반을 연다 */
  myClass: string
  /** 테마색 id (themes.ts) */
  theme: string
  /** 위젯(창) 크기 */
  widgetSize: SizeStep
  /** 글씨 크기 */
  fontSize: SizeStep
  alwaysOnTop: boolean
  autoLaunch: boolean
  /** 카드 불투명도 0.5 ~ 1 */
  opacity: number
  /** 마지막으로 보던 대상 */
  lastTargetKey: string
  lastKind: Kind
}

export interface AppState {
  settings: Settings
  blocks: Block[]
  lessons: Lesson[]
  targets: Target[]
  /** 마지막으로 불러온 엑셀 파일 이름 */
  sourceFile: string
  /** 지금까지 불러온 파일 목록 (교사·학급·학생 파일을 나눠 올릴 수 있다) */
  sources: string[]
  importedAt: string
}

export const DEFAULT_BLOCKS: Block[] = [
  { type: 'class', period: 1, start: '08:30', end: '09:20', days: [0, 1, 2, 3, 4] },
  { type: 'break', period: 0, start: '09:20', end: '09:30', days: [0, 1, 2, 3, 4] },
  { type: 'class', period: 2, start: '09:30', end: '10:20', days: [0, 1, 2, 3, 4] },
  { type: 'break', period: 0, start: '10:20', end: '10:30', days: [0, 1, 2, 3, 4] },
  { type: 'class', period: 3, start: '10:30', end: '11:20', days: [0, 1, 2, 3, 4] },
  { type: 'break', period: 0, start: '11:20', end: '11:30', days: [0, 1, 2, 3, 4] },
  { type: 'class', period: 4, start: '11:30', end: '12:20', days: [0, 1, 2, 3, 4] },
  { type: 'break', period: 0, start: '12:20', end: '13:10', days: [0, 1, 2, 3, 4], label: '점심시간' },
  { type: 'class', period: 5, start: '13:10', end: '14:00', days: [0, 1, 2, 3, 4] },
  { type: 'break', period: 0, start: '14:00', end: '14:10', days: [0, 1, 2, 3, 4] },
  { type: 'class', period: 6, start: '14:10', end: '15:00', days: [0, 1, 2, 3, 4] },
  { type: 'break', period: 0, start: '15:00', end: '15:10', days: [2, 3] },
  { type: 'class', period: 7, start: '15:10', end: '16:00', days: [2, 3] },
]

export const DEFAULT_SETTINGS: Settings = {
  myName: '',
  myClass: '',
  theme: 'blue',
  widgetSize: 'medium',
  fontSize: 'medium',
  alwaysOnTop: true,
  autoLaunch: false,
  opacity: 0.94,
  lastTargetKey: '',
  lastKind: '학급',
}

export function emptyState(): AppState {
  return {
    settings: { ...DEFAULT_SETTINGS },
    blocks: DEFAULT_BLOCKS.map((b) => ({ ...b, days: [...b.days] })),
    lessons: [],
    targets: [],
    sourceFile: '',
    sources: [],
    importedAt: '',
  }
}

export function targetKey(kind: Kind, id: string, name: string): string {
  return `${kind}:${id || name}`
}

/** 설정의 "내 이름"과 맞는 시간표 — 교사는 이름, 학생은 학번으로 찾는다 */
export function findMine(targets: Target[], myName: string): Target | null {
  const q = myName.trim()
  if (!q) return null
  return (
    targets.find((t) => t.kind === '교사' && t.name === q) ??
    targets.find((t) => t.kind === '학생' && t.id === q) ??
    null
  )
}
