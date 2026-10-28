import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { markIntroSeen, useGarage } from '../store'
import { fx } from '../scene/fx'

/** Short cinematic intro (shown once). A veil lifts while the studio lights come on; skip any time. */
export function Intro() {
  const root = useRef<HTMLDivElement>(null)
  const go = useGarage(s => s.go)
  const setView = useGarage(s => s.setView)

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (useGarage.getState().reduced) { gsap.set('.veil', { opacity: 0 }); return }
      gsap.set('.wordmark span', { opacity: 0, y: 24 })
      gsap.set('.hero .tag, .hero .btn', { opacity: 0, y: 10 })
      gsap.timeline()
        .to('.veil', { opacity: 0, duration: 2.4, ease: 'power2.inOut' }, 0.2)
        .to('.wordmark span', { opacity: 1, y: 0, duration: 0.9, stagger: 0.07, ease: 'power3.out' }, 2.2)
        .to('.hero .tag', { opacity: 1, y: 0, duration: 0.7 }, 3)
        .to('.hero .btn', { opacity: 1, y: 0, duration: 0.6, stagger: 0.08 }, 3.3)
    }, root)
    return () => ctx.revert()
  }, [])

  const enter = (skip: boolean) => {
    markIntroSeen()
    if (skip) { gsap.killTweensOf(fx); fx.lights = 1; fx.env = 1 }
    setView('three')
    const d = useGarage.getState().reduced || skip ? 0.25 : 0.7
    gsap.to(root.current, { opacity: 0, duration: d, ease: 'power2.in', onComplete: () => go('garage') })
  }
  return (
    <div className="layer" ref={root}>
      <div className="veil" aria-hidden />
      <div className="hero">
        <h1 className="wordmark" aria-label="GARAGE">{'GARAGE'.split('').map((c, i) => <span key={i} aria-hidden>{c}</span>)}</h1>
        <div className="tag">Built, not bought.</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary lg" onClick={() => enter(false)}>Войти в гараж</button>
          <button className="btn ghost lg" onClick={() => enter(true)}>Пропустить</button>
        </div>
      </div>
    </div>
  )
}
