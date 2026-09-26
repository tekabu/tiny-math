import type { Question, TestType } from './types.ts'

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** 4 distinct, non-negative choices clustered around the answer. */
function numberChoices(answer: number) {
  const set = new Set([answer])
  let spread = 2
  while (set.size < 4) {
    const c = answer + rand(-spread, spread)
    if (c >= 0) set.add(c)
    spread++
  }
  return shuffle([...set].map(String))
}

function build(type: TestType, a: number, b: number): Question {
  if (type === 'compare') {
    const answer = a < b ? '<' : a > b ? '>' : '='
    return { a, b, answer, choices: ['<', '=', '>'] }
  }
  const answer = type === 'add' ? a + b : a - b
  return { a, b, answer: String(answer), choices: numberChoices(answer) }
}

export function makeQuestion(type: TestType, min: number, max: number): Question {
  let a = rand(min, max)
  let b = rand(min, max)
  // plain random rarely lands on equal; give it a fair share
  if (type === 'compare' && Math.random() < 1 / 3) b = a
  if (type === 'sub' && b > a) [a, b] = [b, a]
  return build(type, a, b)
}

/** How many different questions a range has (subtraction keeps a ≥ b). */
export function distinctQuestions(type: TestType, min: number, max: number) {
  const n = max - min + 1
  return type === 'sub' ? (n * (n + 1)) / 2 : n * n
}

/**
 * A fresh random set for each kid's attempt with no question repeated inside it.
 * Only if the range is too small for the count do repeats happen (never back to back).
 */
export function makeQuestions(type: TestType, min: number, max: number, count: number) {
  const seen = new Set<string>()
  const out: Question[] = []
  while (out.length < count) {
    const prev = out.at(-1)
    let q = makeQuestion(type, min, max)
    for (let tries = 0; tries < 1000 && seen.has(`${q.a},${q.b}`); tries++) q = makeQuestion(type, min, max)
    for (let tries = 0; tries < 100 && prev && prev.a === q.a && prev.b === q.b; tries++) q = makeQuestion(type, min, max)
    seen.add(`${q.a},${q.b}`)
    out.push(q)
  }
  return out
}

export const SYMBOL: Record<TestType, string> = { add: '+', sub: '−', compare: '?' }
export const TYPE_LABEL: Record<TestType, string> = {
  add: 'Addition',
  sub: 'Subtraction',
  compare: 'Less / Greater / Equal',
}
