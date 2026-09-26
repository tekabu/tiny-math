import express, { type NextFunction, type Request, type Response } from 'express'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { makeQuestions } from '../src/generate.ts'
import type { Attempt, Question, Role, Test, TestType, User } from '../src/types.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '0.0.0.0'
const DATA_DIR = resolve(process.env.DATA_DIR ?? join(ROOT, 'data'))
// who may set X-Forwarded-For (for login throttling): 'loopback' fits cloudflared / a proxy on
// the same box; add 'uniquelocal' when Nginx Proxy Manager runs in Docker
const TRUST_PROXY = process.env.TRUST_PROXY ?? 'loopback'
const SESSION_DAYS = 30

// ---------- database ----------

mkdirSync(DATA_DIR, { recursive: true })
const db = new DatabaseSync(join(DATA_DIR, 'tiny-math.db'))
type Row = Record<string, unknown>

// AUTOINCREMENT so ids are never reused: a deleted kid's id must not pass their test
// assignments to a new kid, and a restarted attempt must not look like the old one
const TABLES: Record<string, string> = {
  users: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('parent', 'kid')),
    created_at INTEGER NOT NULL`,
  sessions: `
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL`,
  tests: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    min INTEGER NOT NULL,
    max INTEGER NOT NULL,
    count INTEGER NOT NULL,
    active INTEGER NOT NULL,
    show_counters INTEGER NOT NULL DEFAULT 0,
    kid_ids TEXT NOT NULL,
    created_at INTEGER NOT NULL`,
  attempts: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    kid_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    type TEXT,
    questions TEXT NOT NULL,
    score INTEGER NOT NULL`,
}

db.exec('PRAGMA journal_mode = WAL')
// node:sqlite turns foreign keys on by default; they must be off while tables are rebuilt,
// or dropping the old users table cascades and deletes every attempt
db.exec('PRAGMA foreign_keys = OFF')
migrate()
db.exec('PRAGMA foreign_keys = ON')
for (const [name, cols] of Object.entries(TABLES)) db.exec(`CREATE TABLE IF NOT EXISTS ${name} (${cols})`)
addAttemptType()
db.exec(`
  CREATE INDEX IF NOT EXISTS attempts_kid ON attempts(kid_id);
  CREATE INDEX IF NOT EXISTS attempts_test ON attempts(test_id);
`)

/**
 * Attempts remember which kind of test made their questions. Older rows didn't, so work it
 * out from the stored answers (a test edited from + to − left those rows mismatched).
 */
function addAttemptType() {
  const cols = (db.prepare('PRAGMA table_info(attempts)').all() as Row[]).map((c) => c.name)
  if (!cols.includes('type')) db.exec('ALTER TABLE attempts ADD COLUMN type TEXT')
  const rows = db
    .prepare('SELECT a.id, a.questions, t.type AS test_type FROM attempts a JOIN tests t ON t.id = a.test_id WHERE a.type IS NULL')
    .all() as Row[]
  const set = db.prepare('UPDATE attempts SET type = ? WHERE id = ?')
  for (const r of rows) {
    const qs = JSON.parse(String(r.questions)) as Question[]
    let type = String(r.test_type) as TestType
    if (qs.some((q) => ['<', '>', '='].includes(q.answer))) type = 'compare'
    else {
      const q = qs.find((x) => x.b !== 0) // with b = 0, + and − give the same answer
      if (q) type = Number(q.answer) === q.a + q.b ? 'add' : 'sub'
    }
    set.run(type, Number(r.id))
  }
}

/** Bring databases made by older versions up to the current TABLES shape. */
function migrate() {
  const columns = (table: string) => (db.prepare(`PRAGMA table_info(${table})`).all() as Row[]).map((c) => String(c.name))
  const sqlOf = (table: string) =>
    (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as Row | undefined)?.sql as
      | string
      | undefined

  const needsRebuild = Object.entries(TABLES).filter(([name, cols]) => {
    const sql = sqlOf(name)
    return sql && cols.includes('AUTOINCREMENT') && !sql.includes('AUTOINCREMENT')
  })
  if (needsRebuild.length === 0) return

  const backup = join(DATA_DIR, `tiny-math.before-migration-${Date.now()}.db`)
  db.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`)
  console.log(`Upgrading database (backup: ${backup})`)

  db.exec('BEGIN')
  try {
    for (const [name, cols] of needsRebuild) {
      // rebuild: new table, copy shared columns, swap (foreign keys are off here)
      const old = columns(name)
      db.exec(`CREATE TABLE ${name}_new (${cols})`)
      const shared = columns(`${name}_new`).filter((c) => old.includes(c)).join(', ')
      db.exec(`INSERT INTO ${name}_new (${shared}) SELECT ${shared} FROM ${name}`)
      db.exec(`DROP TABLE ${name}`)
      db.exec(`ALTER TABLE ${name}_new RENAME TO ${name}`)
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}


const toUser = (r: Row): User => ({
  id: Number(r.id),
  username: String(r.username),
  displayName: String(r.display_name),
  role: r.role as Role,
})

const toTest = (r: Row): Test => ({
  id: Number(r.id),
  name: String(r.name),
  type: r.type as TestType,
  min: Number(r.min),
  max: Number(r.max),
  count: Number(r.count),
  active: Boolean(r.active),
  showCounters: Boolean(r.show_counters),
  kidIds: JSON.parse(String(r.kid_ids)),
  createdAt: Number(r.created_at),
})

const toAttempt = (r: Row): Attempt => ({
  id: Number(r.id),
  testId: Number(r.test_id),
  kidId: Number(r.kid_id),
  type: r.type as TestType,
  startedAt: Number(r.started_at),
  finishedAt: r.finished_at == null ? null : Number(r.finished_at),
  questions: JSON.parse(String(r.questions)),
  score: Number(r.score),
})

const getTest = (id: number) => {
  const r = db.prepare('SELECT * FROM tests WHERE id = ?').get(id) as Row | undefined
  return r && toTest(r)
}
const getAttempt = (id: number) => {
  const r = db.prepare('SELECT * FROM attempts WHERE id = ?').get(id) as Row | undefined
  return r && toAttempt(r)
}

// ---------- passwords & sessions ----------

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString('hex')
}

function passwordMatches(row: Row, password: string) {
  const a = Buffer.from(hashPassword(password, String(row.salt)), 'hex')
  const b = Buffer.from(String(row.password_hash), 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

function setPassword(userId: number, password: string) {
  const salt = randomBytes(16).toString('hex')
  db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hashPassword(password, salt), salt, userId)
}

function createSession(userId: number) {
  const token = randomBytes(32).toString('hex')
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    Date.now() + SESSION_DAYS * 86_400_000,
  )
  return token
}

// ---------- validation helpers ----------

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function str(v: unknown, field: string, max = 50) {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `${field} required`)
  if (v.length > max) throw new HttpError(400, `${field} too long`)
  return v.trim()
}

function password(v: unknown, min = 1) {
  if (typeof v !== 'string' || v.length < min) throw new HttpError(400, `Password must be at least ${min} characters`)
  if (v.length > 200) throw new HttpError(400, 'Password too long')
  return v
}

function int(v: unknown, field: string, min: number, max: number) {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    throw new HttpError(400, `${field} must be a whole number ${min}–${max}`)
  }
  return v
}

function createUser(username: unknown, displayName: unknown, pw: unknown, role: Role, minPw: number) {
  const name = str(username, 'Username', 30).toLowerCase()
  if (!/^[a-z0-9._-]+$/.test(name)) throw new HttpError(400, 'Username: letters, numbers, . _ - only')
  const pass = password(pw, minPw)
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(name)) throw new HttpError(409, 'Username already taken')
  const display = typeof displayName === 'string' && displayName.trim() ? str(displayName, 'Name') : name
  const salt = randomBytes(16).toString('hex')
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (username, display_name, password_hash, salt, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, display, hashPassword(pass, salt), salt, role, Date.now())
  return Number(lastInsertRowid)
}

function readTestBody(body: Row) {
  if (!['add', 'sub', 'compare'].includes(body.type as string)) throw new HttpError(400, 'Unknown test type')
  const type = body.type as TestType
  const min = int(body.min, 'Min', 0, 1000)
  const max = int(body.max, 'Max', 0, 1000)
  if (min > max) throw new HttpError(400, 'Min must be ≤ max')
  const count = int(body.count, 'How many', 1, 100)
  const kidIds = Array.isArray(body.kidIds) ? body.kidIds.filter((k): k is number => Number.isInteger(k)) : []
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : ''
  return { name, type, min, max, count, active: body.active !== false, showCounters: body.showCounters === true, kidIds }
}

// ---------- login throttle (per IP + username) ----------

const failures = new Map<string, { count: number; until: number }>()
function checkThrottle(key: string) {
  const f = failures.get(key)
  if (f && f.until > Date.now()) throw new HttpError(429, 'Too many tries. Wait a minute.')
}
function recordFailure(key: string) {
  const f = failures.get(key) ?? { count: 0, until: 0 }
  f.count++
  if (f.count >= 5) {
    f.until = Date.now() + 60_000
    f.count = 0
  }
  failures.set(key, f)
}

// ---------- app ----------

const app = express()
app.set('trust proxy', TRUST_PROXY)
app.disable('x-powered-by')
app.use(express.json({ limit: '20kb' }))
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'same-origin')
  next()
})

declare module 'express-serve-static-core' {
  interface Request {
    user?: User
    token?: string
  }
}

const api = express.Router()

// session lookup
api.use((req, _res, next) => {
  const token = req.get('authorization')?.replace(/^Bearer /, '')
  if (token) {
    const r = db
      .prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?')
      .get(token, Date.now()) as Row | undefined
    if (r) {
      req.user = toUser(r)
      req.token = token
    }
  }
  next()
})

const needUser = (req: Request) => {
  if (!req.user) throw new HttpError(401, 'Please log in')
  return req.user
}
const needParent = (req: Request) => {
  const u = needUser(req)
  if (u.role !== 'parent') throw new HttpError(403, 'Parents only')
  return u
}
const idParam = (req: Request) => int(Number(req.params.id), 'id', 1, Number.MAX_SAFE_INTEGER)
const parentExists = () => Boolean(db.prepare("SELECT 1 FROM users WHERE role = 'parent'").get())

api.get('/status', (_req, res) => {
  res.json({ hasParent: parentExists() })
})

api.post('/setup', (req, res) => {
  if (parentExists()) throw new HttpError(409, 'Already set up')
  const id = createUser(req.body.username, req.body.displayName, req.body.password, 'parent', 4)
  const user = toUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row)
  res.json({ token: createSession(id), user })
})

api.post('/login', (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : ''
  const key = `${req.ip}|${username}`
  checkThrottle(key)
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as Row | undefined
  if (!row || typeof req.body.password !== 'string' || !passwordMatches(row, req.body.password)) {
    recordFailure(key)
    throw new HttpError(401, 'Wrong username or password')
  }
  failures.delete(key)
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now())
  res.json({ token: createSession(Number(row.id)), user: toUser(row) })
})

api.post('/logout', (req, res) => {
  if (req.token) db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token)
  res.json({ ok: true })
})

api.get('/me', (req, res) => {
  res.json(needUser(req))
})

api.put('/me/password', (req, res) => {
  const u = needParent(req)
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id) as Row
  if (typeof req.body.current !== 'string' || !passwordMatches(row, req.body.current)) {
    throw new HttpError(400, 'Current password is wrong')
  }
  setPassword(u.id, password(req.body.next, 4))
  // log out every other device
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(u.id, req.token!)
  res.json({ ok: true })
})

// --- parent: kids ---

api.get('/kids', (req, res) => {
  needParent(req)
  res.json((db.prepare("SELECT * FROM users WHERE role = 'kid' ORDER BY id").all() as Row[]).map(toUser))
})

api.post('/kids', (req, res) => {
  needParent(req)
  const id = createUser(req.body.username, req.body.displayName, req.body.password, 'kid', 1)
  res.json(toUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row))
})

api.put('/kids/:id/password', (req, res) => {
  needParent(req)
  const id = idParam(req)
  if (!db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'kid'").get(id)) throw new HttpError(404, 'No such kid')
  setPassword(id, password(req.body.password))
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id)
  res.json({ ok: true })
})

api.delete('/kids/:id', (req, res) => {
  needParent(req)
  db.prepare("DELETE FROM users WHERE id = ? AND role = 'kid'").run(idParam(req))
  res.json({ ok: true })
})

// --- parent: tests & results ---

const canTake = (t: Test, kidId: number) => t.active && (t.kidIds.length === 0 || t.kidIds.includes(kidId))

const isPerfect = (a: Attempt) => a.finishedAt !== null && a.score === a.questions.length

function newAttempt(test: Test, kidId: number) {
  const questions = makeQuestions(test.type, test.min, test.max, test.count)
  const { lastInsertRowid } = db
    .prepare(
      'INSERT INTO attempts (test_id, kid_id, type, started_at, finished_at, questions, score) VALUES (?, ?, ?, ?, NULL, ?, 0)',
    )
    .run(test.id, kidId, test.type, Date.now(), JSON.stringify(questions))
  return Number(lastInsertRowid)
}

api.get('/tests', (req, res) => {
  needParent(req)
  res.json((db.prepare('SELECT * FROM tests ORDER BY id DESC').all() as Row[]).map(toTest))
})

api.post('/tests', (req, res) => {
  needParent(req)
  const t = readTestBody(req.body)
  const name = t.name || defaultName(t.type, t.min, t.max)
  const { lastInsertRowid } = db
    .prepare(
      'INSERT INTO tests (name, type, min, max, count, active, show_counters, kid_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(name, t.type, t.min, t.max, t.count, t.active ? 1 : 0, t.showCounters ? 1 : 0, JSON.stringify(t.kidIds), Date.now())
  res.json(getTest(Number(lastInsertRowid)))
})

api.put('/tests/:id', (req, res) => {
  needParent(req)
  const id = idParam(req)
  const before = getTest(id)
  if (!before) throw new HttpError(404, 'No such test')
  const t = readTestBody(req.body)
  // questions already made for the old settings no longer fit: unfinished tries start over
  // with the new ones (finished results are kept as they were taken)
  if (t.type !== before.type || t.min !== before.min || t.max !== before.max || t.count !== before.count) {
    db.prepare('DELETE FROM attempts WHERE test_id = ? AND finished_at IS NULL').run(id)
  }
  db.prepare(
    'UPDATE tests SET name = ?, type = ?, min = ?, max = ?, count = ?, active = ?, show_counters = ?, kid_ids = ? WHERE id = ?',
  ).run(
    t.name || defaultName(t.type, t.min, t.max),
    t.type,
    t.min,
    t.max,
    t.count,
    t.active ? 1 : 0,
    t.showCounters ? 1 : 0,
    JSON.stringify(t.kidIds),
    id,
  )
  res.json(getTest(id))
})

api.delete('/tests/:id', (req, res) => {
  needParent(req)
  db.prepare('DELETE FROM tests WHERE id = ?').run(idParam(req))
  res.json({ ok: true })
})

// parent gives a kid a fresh try: throws away any unfinished attempt, starts at question 1
api.post('/kids/:id/tests/:testId/restart', (req, res) => {
  needParent(req)
  const kidId = idParam(req)
  if (!db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'kid'").get(kidId)) throw new HttpError(404, 'No such kid')
  const test = getTest(int(Number(req.params.testId), 'testId', 1, Number.MAX_SAFE_INTEGER))
  if (!test) throw new HttpError(404, 'No such test')
  if (!canTake(test, kidId)) throw new HttpError(400, 'Turn the test on and assign it to this kid first')
  db.prepare('DELETE FROM attempts WHERE test_id = ? AND kid_id = ? AND finished_at IS NULL').run(test.id, kidId)
  res.json({ id: newAttempt(test, kidId) })
})

api.get('/attempts', (req, res) => {
  needParent(req)
  res.json((db.prepare('SELECT * FROM attempts ORDER BY id DESC').all() as Row[]).map(toAttempt))
})


api.get('/kid/home', (req, res) => {
  const u = needUser(req)
  if (u.role !== 'kid') throw new HttpError(403, 'Kids only')
  const tests = (db.prepare('SELECT * FROM tests WHERE active = 1 ORDER BY id').all() as Row[])
    .map(toTest)
    .filter((t) => canTake(t, u.id))
  const attempts = (db.prepare('SELECT * FROM attempts WHERE kid_id = ?').all(u.id) as Row[]).map(toAttempt)
  res.json({ tests, attempts })
})

api.post('/kid/tests/:id/start', (req, res) => {
  const u = needUser(req)
  if (u.role !== 'kid') throw new HttpError(403, 'Kids only')
  const test = getTest(idParam(req))
  if (!test || !canTake(test, u.id)) throw new HttpError(404, 'Test not available')
  const latest = db
    .prepare('SELECT * FROM attempts WHERE test_id = ? AND kid_id = ? ORDER BY id DESC')
    .get(test.id, u.id) as Row | undefined
  const last = latest && toAttempt(latest)
  // "Keep going": resume, never reroll questions mid-test
  if (last && last.finishedAt === null) return void res.json({ id: last.id })
  // 100% closes the test for this kid; only a parent's Retest reopens it
  if (last && isPerfect(last)) throw new HttpError(403, 'All done! Ask a grown-up for a retest.')
  // first try, or "Try again" after a miss: brand-new random questions
  res.json({ id: newAttempt(test, u.id) })
})

const ownAttempt = (req: Request) => {
  const u = needUser(req)
  const a = getAttempt(idParam(req))
  if (!a || (u.role === 'kid' && a.kidId !== u.id)) throw new HttpError(404, 'No such attempt')
  return a
}

api.get('/attempts/:id', (req, res) => {
  const attempt = ownAttempt(req)
  res.json({ attempt, test: getTest(attempt.testId) })
})

api.post('/attempts/:id/answer', (req, res) => {
  const a = ownAttempt(req)
  if (req.user!.role !== 'kid') throw new HttpError(403, 'Kids only')
  const index = a.questions.findIndex((q) => q.given === undefined)
  // no going back: only the first unanswered question can be answered, once
  if (index === -1 || req.body.index !== index) throw new HttpError(409, 'Already answered')
  const q: Question = a.questions[index]
  const choice = req.body.choice
  if (typeof choice !== 'string' || !q.choices.includes(choice)) throw new HttpError(400, 'Bad choice')
  q.given = choice
  q.correct = choice === q.answer
  const score = a.questions.filter((x) => x.correct).length
  const finishedAt = index === a.questions.length - 1 ? Date.now() : null
  db.prepare('UPDATE attempts SET questions = ?, score = ?, finished_at = ? WHERE id = ?').run(
    JSON.stringify(a.questions),
    score,
    finishedAt,
    a.id,
  )
  res.json({ ...a, score, finishedAt })
})

const TYPE_NAME: Record<TestType, string> = { add: 'Addition', sub: 'Subtraction', compare: 'Less / Greater / Equal' }
function defaultName(type: TestType, min: number, max: number) {
  return `${TYPE_NAME[type]} ${min}–${max}`
}

app.use('/api', api)
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// built frontend (npm run build) + SPA fallback
const DIST = join(ROOT, 'dist')
if (existsSync(DIST)) {
  app.use(express.static(DIST, { index: false, maxAge: '1h' }))
  app.get(/.*/, (_req, res) => res.sendFile(join(DIST, 'index.html')))
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message })
  console.error(err)
  res.status(500).json({ error: 'Server error' })
})

app.listen(PORT, HOST, (err?: Error) => {
  if (err) {
    console.error(`Cannot listen on ${HOST}:${PORT}: ${err.message}`)
    process.exit(1)
  }
  console.log(`Tiny Math on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}  (data: ${DATA_DIR})`)
})
