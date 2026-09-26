import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Pinata from '../../components/Pinata'
import { api, ApiError } from '../../api'
import { SYMBOL } from '../../generate'
import type { Attempt, Question, Test, TestType } from '../../types'
import { playCorrect, playWrong } from '../../sound'

/** ask → (right → tap → next) | (wrong → tap → reveal → tap → next) */
type Phase = 'ask' | 'right' | 'wrong' | 'reveal' | 'done'

const firstUnanswered = (a: Attempt) => a.questions.findIndex((q) => q.given === undefined)

/** Little apples under each number so small kids can count. */
function Counters({ n }: { n: number }) {
  if (n > 10) return null
  return (
    <div className="mt-1 flex max-w-[7.5rem] flex-wrap justify-center text-lg leading-none">
      {Array.from({ length: n }, (_, i) => (
        <span key={i}>🍎</span>
      ))}
    </div>
  )
}

function Problem({ q, test, phase, type }: { q: Question; test: Test; phase: Phase; type: TestType }) {
  const showAnswer = phase === 'right' || phase === 'reveal'
  const slot = showAnswer ? q.answer : phase === 'wrong' ? q.given : '?'
  const slotStyle =
    phase === 'wrong' ? 'bg-red-500 text-white anim-wobble' : showAnswer ? 'bg-blue-600 text-white' : 'bg-white text-slate-300 border-4 border-dashed border-slate-300'
  const box = <span className={`inline-grid min-w-[1.4em] place-items-center rounded-2xl px-2 transition ${slotStyle}`}>{slot}</span>
  const num = (n: number) => (
    <span className="flex flex-col items-center">
      {n}
      {test.showCounters && <Counters n={n} />}
    </span>
  )

  return (
    <div className="flex items-start justify-center gap-3 text-7xl font-extrabold sm:gap-5 sm:text-8xl">
      {type === 'compare' ? (
        <>
          {num(q.a)} {box} {num(q.b)}
        </>
      ) : (
        <>
          {num(q.a)} <span className="text-violet-600">{SYMBOL[type]}</span> {num(q.b)} <span>=</span> {box}
        </>
      )}
    </div>
  )
}

function ScoreScreen({ attempt, onAgain, onHome }: { attempt: Attempt; onAgain: () => void; onHome: () => void }) {
  // 100% = test is done for this kid, so no retry button; a miss gets "Try again" with new questions
  const total = attempt.questions.length
  const perfect = attempt.score === total
  const pct = Math.round((attempt.score / total) * 100)
  const message = perfect ? 'PERFECT! 🎉' : pct >= 70 ? 'Great job! 🌟' : 'Good try! Keep going 💪'

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
      {perfect && <Pinata />}
      <div className="anim-bounce-in text-4xl font-extrabold text-violet-700 sm:text-5xl">{message}</div>
      <div className="anim-bounce-in text-8xl font-extrabold">
        <span className="text-blue-600">{attempt.score}</span>
        <span className="text-slate-300"> / </span>
        <span>{total}</span>
      </div>
      <div className="text-3xl font-bold text-slate-500">{pct}%</div>
      <div className="flex flex-wrap justify-center gap-2">
        {attempt.questions.map((q, i) => (
          <span key={i} className={`size-6 rounded-full ${q.correct ? 'bg-blue-600' : 'bg-red-500'}`} />
        ))}
      </div>
      <div className="mt-4 flex gap-3">
        {!perfect && (
          <button className="btn-primary px-8 py-4 text-2xl" onClick={onAgain}>
            🔁 Try again
          </button>
        )}
        <button className="btn-ghost px-8 py-4 text-2xl" onClick={onHome}>
          🏠 Home
        </button>
      </div>
    </div>
  )
}

export default function Quiz() {
  const { attemptId } = useParams()
  const navigate = useNavigate()
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [test, setTest] = useState<Test | null>(null)
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('ask')
  const [error, setError] = useState('')
  const busy = useRef(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await api<{ attempt: Attempt; test: Test }>(`/attempts/${attemptId}`).catch(() => null)
      if (cancelled) return
      if (!res?.test) return navigate('/kid', { replace: true })
      const { attempt: a, test: t } = res
      const i = firstUnanswered(a)
      setAttempt(a)
      setTest(t)
      setIdx(i === -1 ? 0 : i)
      setPhase(i === -1 ? 'done' : 'ask')
      busy.current = false
    })()
    return () => {
      cancelled = true
    }
  }, [attemptId, navigate])

  if (!attempt || !test) return null

  const q = attempt.questions[idx]
  const last = idx === attempt.questions.length - 1

  const next = () => {
    if (last) setPhase('done')
    else {
      setIdx(idx + 1)
      setPhase('ask')
    }
    busy.current = false
  }

  const answer = async (choice: string) => {
    if (busy.current || phase !== 'ask') return
    busy.current = true
    let saved: Attempt
    try {
      // server grades and locks the answer: refreshing or going back can't reopen it
      saved = await api<Attempt>(`/attempts/${attempt.id}/answer`, 'POST', { index: idx, choice })
    } catch (err) {
      busy.current = false
      // parent restarted this test from another device: go pick up the fresh one
      if (err instanceof ApiError && (err.status === 404 || err.status === 409)) return navigate('/kid', { replace: true })
      return setError((err as Error).message)
    }
    setError('')
    setAttempt(saved)

    if (saved.questions[idx].correct) {
      playCorrect()
      setPhase('right')
    } else {
      playWrong()
      setPhase('wrong')
    }
  }

  const tapScreen = () => {
    if (phase === 'wrong') setPhase('reveal')
    else if (phase === 'right' || phase === 'reveal') next()
  }

  const again = async () => {
    const { id } = await api<{ id: number }>(`/kid/tests/${test.id}/start`, 'POST', {})
    navigate(`/kid/attempt/${id}`, { replace: true })
  }

  if (phase === 'done') return <ScoreScreen attempt={attempt} onAgain={again} onHome={() => navigate('/kid')} />

  const choiceStyle = (c: string) => {
    if (phase === 'ask') return 'bg-white text-slate-800 ring-4 ring-violet-200 shadow-[0_6px_0_#c4b5fd]'
    if (c === q.given && phase === 'right') return 'bg-blue-600 text-white ring-4 ring-blue-300 scale-110'
    if (c === q.given) return 'bg-red-500 text-white ring-4 ring-red-300'
    if (c === q.answer && phase === 'reveal') return 'bg-blue-600 text-white ring-4 ring-blue-300 scale-110'
    return 'bg-white text-slate-300 ring-4 ring-slate-100'
  }

  const hint =
    phase === 'wrong'
      ? 'Oops! Tap to see the answer 👆'
      : phase === 'right'
        ? 'Yay! Tap for next ➡️'
        : phase === 'reveal'
          ? 'Tap for next ➡️'
          : ' '

  return (
    <div className="flex min-h-dvh flex-col p-4" onClick={tapScreen}>
      {phase === 'right' && (
        <div className="pointer-events-none fixed inset-x-0 top-10 z-10">
          <Pinata small key={idx} />
        </div>
      )}
      <header className="flex items-center gap-3">
        <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); navigate('/kid') }}>
          🏠
        </button>
        <div className="flex flex-1 flex-wrap justify-center gap-1.5">
          {attempt.questions.map((x, i) => (
            <span
              key={i}
              className={`size-4 rounded-full ${
                x.given === undefined ? (i === idx ? 'bg-violet-400 ring-2 ring-violet-600' : 'bg-slate-200') : x.correct ? 'bg-blue-600' : 'bg-red-500'
              }`}
            />
          ))}
        </div>
        <span className="text-xl font-bold text-slate-400">
          {idx + 1}/{attempt.questions.length}
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-10">
        <Problem key={idx} q={q} test={test} phase={phase} type={attempt.type} />
        <div className={`grid w-full max-w-xl gap-4 ${q.choices.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {q.choices.map((c) => (
            <button
              key={c}
              aria-disabled={phase !== 'ask'}
              onClick={() => answer(c)}
              className={`rounded-3xl py-6 text-6xl font-extrabold transition active:translate-y-1 sm:text-7xl ${choiceStyle(c)}`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className={`h-10 text-2xl font-bold ${phase === 'wrong' || error ? 'text-red-500' : 'text-blue-600'}`}>{error || hint}</div>
      </main>
    </div>
  )
}
