import { useEffect, useState } from 'react'
import { Block, Lesson } from '../lib/types'
import { DAY_LABELS, NowInfo, blockOf, lessonSummary, periodsOf, toGrid } from '../lib/schedule'

interface Props {
  lessons: Lesson[]
  blocks: Block[]
  now: NowInfo
}

/**
 * 교사 시간표: 같은 반 · 같은 과목은 같은 색 (파스텔).
 * 학반·학생 시간표: 모든 칸을 테마색으로 옅게 칠한다.
 * 어느 시간표든 과목을 누르면 같은 과목 칸만 진하게 남고 나머지는 흐려진다.
 * 파스텔은 연한 색만 골라서, 테마색으로 꽉 찬 지금 교시가 가장 먼저 눈에 띄게 한다.
 */
const PALETTE = [
  '#F3E7BE', // 버터
  '#DDEBCB', // 새싹
  '#D2E4EF', // 하늘
  '#E7DCF0', // 라벤더
  '#F3D9D6', // 복숭아
  '#D2EBE1', // 민트
  '#EADFCB', // 모래
  '#DBDEF2', // 수국
  '#F0DDE7', // 벚꽃
  '#E3E9C7', // 올리브
  '#D5E7E7', // 청자
  '#EEE1D2', // 우유차
]

/** 교사 시간표는 "학급+과목", 학급·학생 시간표는 "과목"이 같으면 같은 색 */
function colorKey(l: Lesson): string {
  return l.kind === '교사' ? `${l.className}|${l.subject}` : l.subject
}

/** 월요일 1교시부터 차례로 나오는 순서대로 색을 나눠 준다 (겹치지 않게) */
function buildColors(lessons: Lesson[]): Map<string, string> {
  const ordered = [...lessons].sort((a, b) => a.day - b.day || a.period - b.period)
  const map = new Map<string, string>()
  for (const l of ordered) {
    const k = colorKey(l)
    if (!map.has(k)) map.set(k, PALETTE[map.size % PALETTE.length])
  }
  return map
}

export default function TimetableGrid({ lessons, blocks, now }: Props) {
  const periods = periodsOf(blocks)
  const grid = toGrid(lessons, periods)
  const isTeacher = lessons.some((l) => l.kind === '교사')
  const colors = isTeacher ? buildColors(lessons) : null

  // 누른 과목 — 다른 사람 시간표로 바뀌면 풀린다
  const [focus, setFocus] = useState<string | null>(null)
  useEffect(() => setFocus(null), [lessons])

  return (
    <table className={`grid${focus ? ' has-focus' : ''}`}>
      <thead>
        <tr>
          <th scope="col" className="grid-corner">
            <span className="visually-hidden">교시</span>
          </th>
          {DAY_LABELS.map((d, i) => (
            <th scope="col" key={d} className={`grid-day${i === now.day ? ' is-today' : ''}`}>
              {d}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {periods.map((p) => {
          const time = blocks.find((b) => b.type === 'class' && b.period === p)
          return (
            <tr key={p}>
              <th scope="row" className="grid-period">
                <span className="grid-period-no">{p}</span>
                {time && <span className="grid-period-time">{time.start}</span>}
              </th>
              {DAY_LABELS.map((_, day) => {
                const runs = blockOf(blocks, day, p) !== null
                const lesson = grid[p]?.[day]
                const isNow = now.phase === '수업중' && now.day === day && now.period === p
                const isNext = now.phase !== '수업중' && now.day === day && now.nextPeriod === p
                const isMatch = !!lesson && focus === lesson.subject
                const cls = [
                  'grid-cell',
                  !runs ? 'is-off' : '',
                  isNow ? 'is-now' : '',
                  isNext ? 'is-next' : '',
                  lesson ? 'has-lesson' : '',
                  lesson && !isTeacher ? 'is-tint' : '',
                  isMatch ? 'is-match' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <td
                    key={day}
                    className={cls}
                    title={lesson ? lessonSummary(lesson) : undefined}
                    style={lesson && colors && !isNow ? { background: colors.get(colorKey(lesson)) } : undefined}
                    onClick={() => setFocus(lesson && focus !== lesson.subject ? lesson.subject : null)}
                  >
                    {lesson ? (
                      <>
                        {lesson.className && lesson.kind === '교사' && (
                          <span className="cell-class">{lesson.className}</span>
                        )}
                        <span className="cell-subject">{lesson.subject}</span>
                        {lesson.room && <span className="cell-room">{lesson.room}</span>}
                        {lesson.teacher && lesson.kind !== '교사' && (
                          <span className="cell-teacher">{lesson.teacher}</span>
                        )}
                      </>
                    ) : null}
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
