export type Role = 'parent' | 'kid'
export type TestType = 'add' | 'sub' | 'compare'

export interface User {
  id: number
  username: string
  displayName: string
  role: Role
}

export interface Test {
  id: number
  name: string
  type: TestType
  min: number
  max: number
  count: number
  active: boolean
  /** show apples under numbers (≤ 10) to help counting */
  showCounters: boolean
  /** empty array = assigned to every kid */
  kidIds: number[]
  createdAt: number
}

export interface Question {
  a: number
  b: number
  /** numeric answer for add/sub, or '<' | '>' | '=' for compare */
  answer: string
  choices: string[]
  given?: string
  correct?: boolean
}

export interface Attempt {
  id: number
  testId: number
  /** kind of test when the questions were made; the test itself may be edited later */
  type: TestType
  kidId: number
  startedAt: number
  finishedAt: number | null
  questions: Question[]
  score: number
}
