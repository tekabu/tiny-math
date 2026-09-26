import confetti from 'canvas-confetti'
import { useEffect, useState, type CSSProperties } from 'react'
import { playFanfare, playPop } from '../sound'

type Stage = 'swing' | 'hit' | 'burst'

const CONES = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7']

const CANDY = ['🍬', '🍭', '🍫', '⭐', '🍬', '🍭']

// emoji confetti (shapeFromText) draws white boxes in Safari, so candy is plain DOM + CSS
const makeDrops = (n: number, width: number) =>
  Array.from({ length: n }, (_, i) => ({
    emoji: CANDY[i % CANDY.length],
    x: Math.round((Math.random() - 0.5) * width),
    delay: Math.random() * 0.4,
    spin: Math.round((Math.random() - 0.5) * 720),
  }))
const BIG_DROPS = makeDrops(28, 700)
const SMALL_DROPS = makeDrops(12, 400)

const shapes: confetti.Shape[] = ['circle', 'square', 'star']

function burstConfetti() {
  confetti({ particleCount: 90, angle: 60, spread: 70, origin: { x: 0.3, y: 0.35 }, shapes, scalar: 1.4 })
  confetti({ particleCount: 90, angle: 120, spread: 70, origin: { x: 0.7, y: 0.35 }, shapes, scalar: 1.4 })
  confetti({ particleCount: 150, spread: 140, startVelocity: 40, origin: { y: 0.35 }, ticks: 300 })
}

function burstConfettiSmall() {
  confetti({ particleCount: 60, spread: 90, startVelocity: 30, origin: { y: 0.2 }, shapes, scalar: 1.1 })
}

/**
 * A star piñata that swings, gets whacked, and bursts into candy.
 * `small` is the quick one shown after each right answer; the big one is for 100%.
 */
export default function Pinata({ small = false }: { small?: boolean }) {
  const [stage, setStage] = useState<Stage>('swing')

  useEffect(() => {
    const t1 = setTimeout(() => setStage('hit'), small ? 600 : 2200)
    const t2 = setTimeout(
      () => {
        setStage('burst')
        if (small) {
          playPop()
          burstConfettiSmall()
        } else {
          playFanfare()
          burstConfetti()
        }
      },
      small ? 1000 : 2800,
    )
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      confetti.reset()
    }
  }, [small])

  const drops = small ? SMALL_DROPS : BIG_DROPS
  const bodyClass = stage === 'swing' ? 'anim-swing' : stage === 'hit' ? 'anim-wobble' : 'anim-pop'

  return (
    <div className={`relative mx-auto select-none ${small ? 'h-40 w-40' : 'h-64 w-64'}`} aria-label="piñata">
      <div className={`absolute inset-x-0 top-0 flex flex-col items-center ${bodyClass}`} style={{ transformOrigin: stage === 'burst' ? '50% 60%' : '50% 0' }}>
        <div className={`w-1 bg-amber-800 ${small ? 'h-6' : 'h-10'}`} />
        <svg viewBox="-100 -100 200 200" className={`drop-shadow-lg ${small ? 'h-28 w-28' : 'h-48 w-48'}`}>
          {CONES.map((c, i) => {
            const a = ((i * 72 - 90) * Math.PI) / 180
            const l = ((i * 72 - 90 - 22) * Math.PI) / 180
            const r = ((i * 72 - 90 + 22) * Math.PI) / 180
            return (
              <g key={i}>
                <polygon points={`${Math.cos(l) * 45},${Math.sin(l) * 45} ${Math.cos(a) * 95},${Math.sin(a) * 95} ${Math.cos(r) * 45},${Math.sin(r) * 45}`} fill={c} />
                <line x1={Math.cos(a) * 95} y1={Math.sin(a) * 95} x2={Math.cos(a) * 95} y2={Math.sin(a) * 95 + 18} stroke={c} strokeWidth="4" strokeLinecap="round" />
              </g>
            )
          })}
          <circle r="52" fill="#fde047" />
          {[-30, -10, 10, 30].map((y, i) => (
            <rect key={y} x="-52" y={y - 5} width="104" height="10" fill={CONES[i]} opacity="0.85" clipPath="url(#body)" />
          ))}
          <clipPath id="body">
            <circle r="52" />
          </clipPath>
          <circle cx="-17" cy="-8" r="6" fill="#1e293b" />
          <circle cx="17" cy="-8" r="6" fill="#1e293b" />
          <path d="M -16 14 Q 0 30 16 14" stroke="#1e293b" strokeWidth="5" fill="none" strokeLinecap="round" />
        </svg>
      </div>
      {stage !== 'burst' && (
        <div className={`anim-bat absolute right-0 bottom-0 ${small ? 'text-4xl' : 'text-6xl'}`} aria-hidden>
          🏏
        </div>
      )}
      {stage === 'burst' &&
        drops.map((d, i) => (
          <span
            key={i}
            className={`candy-drop pointer-events-none absolute left-1/2 ${small ? 'top-14 text-3xl' : 'top-24 text-5xl'}`}
            style={{ '--x': `${d.x}px`, '--spin': `${d.spin}deg`, animationDelay: `${d.delay}s` } as CSSProperties}
          >
            {d.emoji}
          </span>
        ))}
    </div>
  )
}
