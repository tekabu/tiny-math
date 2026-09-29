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

export function holds(left: number, symbol: string, right: number) {
  return symbol === '<' ? left < right : symbol === '>' ? left > right : left === right
}

/**
 * Grade a kid's choice: true / false, or null when it isn't a legal choice.
 * Place answers are "left,right" made of two different tiles; any pair that fits the symbol counts.
 */
export function checkAnswer(type: TestType, q: Question, choice: string): boolean | null {
  if (type !== 'place') return q.choices.includes(choice) ? choice === q.answer : null
  const parts = choice.split(',')
  if (parts.length !== 2) return null
  const pool = [...q.choices]
  for (const p of parts) {
    const i = pool.indexOf(p)
    if (i === -1) return null
    pool.splice(i, 1)
  }
  return holds(Number(parts[0]), q.answer, Number(parts[1]))
}

function build(type: TestType, a: number, b: number, min: number, max: number): Question {
  if (type === 'place') {
    const answer = a < b ? '<' : a > b ? '>' : '='
    // the fitting pair plus two extra tiles so there's something to choose
    const choices = shuffle([a, b, rand(min, max), rand(min, max)].map(String))
    return { a, b, answer, choices }
  }
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
  if ((type === 'compare' || type === 'place') && Math.random() < 1 / 3) b = a
  if (type === 'sub' && b > a) [a, b] = [b, a]
  return build(type, a, b, min, max)
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

export const SYMBOL: Record<TestType, string> = { add: '+', sub: '−', compare: '?', place: '?' }
export const TYPE_LABEL: Record<TestType, string> = {
  add: 'Addition',
  sub: 'Subtraction',
  compare: 'Less / Greater / Equal',
  place: 'Drag numbers to < > =',
}
