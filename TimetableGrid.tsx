import { Block, Lesson } from '../lib/types'
import { DAY_LABELS, NowInfo, blockOf, lessonSummary, periodsOf, toGrid } from '../lib/schedule'

interface Props {
  lessons: Lesson[]
  blocks: Block[]
  now: NowInfo
}

export default function TimetableGrid({ lessons, blocks, now }: Props) {
  const periods = periodsOf(blocks)
  const grid = toGrid(lessons, periods)

  return (
    <table className="grid">
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
                const cls = ['grid-cell', !runs ? 'is-off' : '', isNow ? 'is-now' : '', isNext ? 'is-next' : '']
                  .filter(Boolean)
                  .join(' ')
                return (
                  <td key={day} className={cls} title={lesson ? lessonSummary(lesson) : undefined}>
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
