import * as XLSX from 'xlsx'
import { Kind, Lesson, Target, targetKey } from '../src/lib/types'

/**
 * 학교 시간표 엑셀 읽기
 *
 * 나이스에서 내려받는 시간표는 한 시트 안에 "블록"이 세로로 반복되는 모양이다.
 *
 *   A1  수학08(차지영) 선생님  시간표      ← 블록 머리글 (A:F 병합)
 *   A2  (빈칸) | 월 | 화 | 수 | 목 | 금    ← 요일 줄
 *   A3  1교시  | ... 한 칸에 줄바꿈으로 여러 정보 ...
 *   ...
 *   A11 9교시
 *   A12 (빈 줄)
 *
 * 칸 안의 줄은 시간표 종류에 따라 다르다.
 *   교사 시간표 : 학급 / 교과            (예: "2-2" ⏎ "기하 A1")
 *   학급·학생   : 교과 / 과목교사          (예: "영어ⅡA" ⏎ "임별")
 *                 교실 / 교과 / 과목교사   (이동수업, 예: "2-7" 또는 "이동A" ⏎ "인공지능 기초 D1" ⏎ "안승진")
 * 어떤 줄이 오든 lines 에 원본을 그대로 담아 두어 화면에서 빠뜨리지 않는다.
 */

const DAY_NAMES = ['월', '화', '수', '목', '금']

export class ExcelError extends Error {}

/** 줄바꿈·전각 공백·연속 공백을 정리한다 */
function clean(v: unknown): string {
  return String(v ?? '')
    .replace(/[\u00a0\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 한 칸을 줄 단위로 쪼갠다 */
function cellLines(v: unknown): string[] {
  return String(v ?? '')
    .replace(/[\u00a0\u3000]/g, ' ')
    .split(/\r?\n/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

const RE_CLASS_NAME = /^(\d{1,2})\s*[-–—]\s*(\d{1,2})$/

function isClassName(s: string): boolean {
  return RE_CLASS_NAME.test(s)
}

/** "2 - 2" 같은 표기를 "2-2"로 고른다 */
function normalizeClassName(s: string): string {
  const m = s.match(RE_CLASS_NAME)
  return m ? `${Number(m[1])}-${Number(m[2])}` : s
}

/** 교실처럼 생겼는지 — 숫자가 있거나 장소를 뜻하는 글자로 끝난다 */
function looksLikeRoom(s: string): boolean {
  return /\d/.test(s) || /(실|관|장|층|홀|동|관실|교실|센터|운동장|강당)$/.test(s)
}

/** 사람 이름처럼 생겼는지 — 숫자 없는 한글 2~4자 */
function looksLikeName(s: string): boolean {
  return /^[가-힣]{2,4}$/.test(s) && !looksLikeRoom(s)
}

export interface BlockHead {
  kind: Kind
  /** 교사: 교과코드(수학08) · 학생: 학번 · 학급: 빈 문자열 */
  id: string
  /** 교사·학생: 이름 · 학급: 2-2 */
  name: string
}

/**
 * 블록 머리글을 읽는다.
 *   "수학08(차지영) 선생님  시간표"  → 교사 / 수학08 / 차지영
 *   "20207 김민서 시간표"            → 학생 / 20207 / 김민서
 *   "2-2 시간표", "2학년 2반 시간표"  → 학급 / '' / 2-2
 */
export function readHead(raw: unknown): BlockHead | null {
  const text = clean(raw)
  if (!text || !text.includes('시간표')) return null
  const head = text.replace(/시간표\s*$/, '').trim()
  if (!head) return null

  // 1) 교사
  if (/선생님|교사|교원/.test(head)) {
    const body = head.replace(/(선생님|교사|교원)\s*$/, '').trim()
    const m = body.match(/^(.*?)\s*[(（]([^)）]+)[)）]\s*$/)
    if (m) return { kind: '교사', id: clean(m[1]), name: clean(m[2]) }
    return { kind: '교사', id: '', name: body }
  }

  // 2) 학생 — 5자리 안팎의 학번이 먼저 나온다
  let m = head.match(/(\d{4,6})\s*[)\].·\-]?\s*[(（]?\s*([가-힣]{2,5})/)
  if (m) return { kind: '학생', id: m[1], name: m[2] }

  // 3) 학급
  m = head.match(/(\d{1,2})\s*학년\s*(\d{1,2})\s*반/) || head.match(/(\d{1,2})\s*[-–—]\s*(\d{1,2})/)
  if (m) return { kind: '학급', id: '', name: `${Number(m[1])}-${Number(m[2])}` }

  return null
}

/**
 * 칸 하나를 교과·교실·교사·학급으로 나눈다.
 * 분류가 애매해도 lines 에 원본이 다 남으므로 정보가 사라지지 않는다.
 */
export function splitCell(lines: string[], kind: Kind): Omit<Lesson, 'kind' | 'id' | 'name' | 'day' | 'period'> {
  const out = { subject: '', room: '', teacher: '', className: '', lines }
  if (lines.length === 0) return out

  let rest = lines
  if (kind === '교사') {
    // 교사 시간표는 학급이 먼저 온다
    const idx = rest.findIndex(isClassName)
    if (idx >= 0) {
      out.className = normalizeClassName(rest[idx])
      rest = rest.filter((_, i) => i !== idx)
    }
  }
  if (rest.length === 0) return out

  // 학생·학급 시간표의 이동수업 칸: 교실(2-7, 이동A …) / 교과 / 과목 선생님
  if (kind !== '교사' && rest.length >= 3) {
    out.room = isClassName(rest[0]) ? normalizeClassName(rest[0]) : rest[0]
    out.subject = rest[1]
    out.teacher = rest[2]
    if (rest.length > 3) out.room = [out.room, ...rest.slice(3)].join(' ')
    return out
  }

  out.subject = rest[0]
  const tail = rest.slice(1)

  if (tail.length === 1) {
    // 한 줄만 더 있으면 이름처럼 생겼는지로 가른다
    if (looksLikeName(tail[0])) out.teacher = tail[0]
    else out.room = tail[0]
  } else if (tail.length >= 2) {
    // 학급·학생 시간표는 교과 / 교실 / 과목교사 순서
    out.room = tail[0]
    out.teacher = tail[1]
    // 순서가 뒤집혀 있으면 바로잡는다
    if (looksLikeName(out.room) && looksLikeRoom(out.teacher)) {
      const swap = out.room
      out.room = out.teacher
      out.teacher = swap
    }
    if (tail.length > 2) out.room = [out.room, ...tail.slice(2)].filter(Boolean).join(' ')
  }

  return out
}

interface ParseResult {
  lessons: Lesson[]
  targets: Target[]
  warnings: string[]
}

/** 시트를 2차원 배열로 읽는다 (빈 줄도 그대로 둔다 — 블록 경계를 알아야 하므로) */
function toGrid(sheet: XLSX.WorkSheet): string[][] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: true,
    defval: '',
    raw: false,
  })
  return rows.map((r) => (r ?? []).map((c) => String(c ?? '')))
}

export function parseWorkbook(buffer: Buffer, source = ''): ParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const lessons: Lesson[] = []
  const warnings: string[] = []
  let blockCount = 0

  for (const sheetName of wb.SheetNames) {
    const grid = toGrid(wb.Sheets[sheetName])

    // 머리글 줄의 위치를 먼저 모두 찾는다
    const heads: { row: number; head: BlockHead }[] = []
    grid.forEach((row, i) => {
      const head = readHead(row[0])
      if (head) heads.push({ row: i, head })
    })

    if (heads.length === 0) {
      warnings.push(`'${sheetName}' 시트에서 "○○ 시간표" 머리글을 찾지 못했습니다.`)
      continue
    }

    heads.forEach(({ row, head }, i) => {
      const end = i + 1 < heads.length ? heads[i + 1].row : grid.length
      const got = readBlock(grid, row, end, head, lessons)
      if (got === 0) {
        warnings.push(`'${head.name}' 시간표에서 수업을 읽지 못했습니다.`)
      } else {
        blockCount += 1
      }
    })
  }

  if (lessons.length === 0) {
    throw new ExcelError(
      '시간표를 한 칸도 읽지 못했습니다. "○○ 선생님 시간표" 머리글과 월~금 요일 줄, "1교시" 표시가 있는 파일인지 확인해 주세요.',
    )
  }

  for (const l of lessons) l.source = source
  // 교사 시간표로 학급 시간표를 만드는 일은 다른 파일과 합친 뒤에 한다 (rebuild)
  const targets = buildTargets(lessons)
  warnings.unshift(`시간표 ${blockCount}개를 읽었습니다.`)

  return { lessons, targets, warnings }
}

/** 블록 하나를 읽어 lessons 에 넣고, 읽은 칸 수를 돌려준다 */
function readBlock(grid: string[][], start: number, end: number, head: BlockHead, out: Lesson[]): number {
  // 머리글 바로 아래 3줄 안에서 요일 줄을 찾는다
  let dayRow = -1
  const dayCol: Record<number, number> = {}
  for (let r = start + 1; r < Math.min(start + 4, end); r++) {
    const row = grid[r] ?? []
    const found: Record<number, number> = {}
    row.forEach((cell, c) => {
      if (c === 0) return
      const s = clean(cell).replace('요일', '')
      const d = DAY_NAMES.indexOf(s)
      if (d >= 0 && found[d] === undefined) found[d] = c
    })
    if (Object.keys(found).length >= 3) {
      dayRow = r
      Object.assign(dayCol, found)
      break
    }
  }
  if (dayRow < 0) return 0

  let count = 0
  for (let r = dayRow + 1; r < end; r++) {
    const row = grid[r] ?? []
    const m = clean(row[0]).match(/^(\d{1,2})\s*교시/)
    if (!m) continue
    const period = Number(m[1])
    if (!Number.isFinite(period) || period < 1 || period > 12) continue

    for (const [dayStr, col] of Object.entries(dayCol)) {
      const lines = cellLines(row[col])
      if (lines.length === 0) continue
      out.push({
        kind: head.kind,
        id: head.id,
        name: head.name,
        day: Number(dayStr),
        period,
        ...splitCell(lines, head.kind),
      })
      count += 1
    }
  }
  return count
}

/**
 * 교사 시간표 칸에는 "어느 학급"인지가 들어 있다.
 * 그 학급의 시간표가 파일에 따로 없으면 여기서 뒤집어서 만들어 준다.
 * (교과는 칸에서, 과목 선생님은 블록 머리글에서 가져온다)
 */
export function deriveClassTimetables(lessons: Lesson[]): Lesson[] {
  const already = new Set(lessons.filter((l) => l.kind === '학급').map((l) => l.name))
  const seen = new Set<string>()
  const made: Lesson[] = []

  for (const l of lessons) {
    if (l.kind !== '교사' || !l.className) continue
    if (already.has(l.className)) continue
    const slot = `${l.className}|${l.day}|${l.period}`
    if (seen.has(slot)) continue
    seen.add(slot)
    made.push({
      kind: '학급',
      id: '',
      name: l.className,
      day: l.day,
      period: l.period,
      subject: l.subject,
      room: l.room,
      teacher: l.name,
      className: l.className,
      lines: [l.subject, l.room, l.name].filter(Boolean),
      derived: true,
      source: l.source,
    })
  }
  return made
}

/** 검색 목록을 만든다 */
export function buildTargets(lessons: Lesson[]): Target[] {
  const map = new Map<string, Target>()
  for (const l of lessons) {
    const key = targetKey(l.kind, l.id, l.name)
    if (map.has(key)) continue
    const label = l.kind === '학생' && l.id ? `${l.id} ${l.name}` : l.name || l.id
    const sub = l.kind === '교사' ? l.id : l.kind === '학생' ? l.className : ''
    map.set(key, { key, kind: l.kind, id: l.id, name: l.name, label, sub, derived: l.derived, source: l.source })
  }
  return [...map.values()].sort((a, b) => {
    // 학급은 학년·반 숫자 순으로
    const na = a.name.match(RE_CLASS_NAME)
    const nb = b.name.match(RE_CLASS_NAME)
    if (na && nb) return Number(na[1]) - Number(nb[1]) || Number(na[2]) - Number(nb[2])
    return a.label.localeCompare(b.label, 'ko')
  })
}

export { DAY_NAMES }
