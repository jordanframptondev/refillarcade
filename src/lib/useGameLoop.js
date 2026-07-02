import { useEffect, useRef } from 'react'

// requestAnimationFrame loop. Calls onFrame(dtSeconds) while `running` is true.
export function useGameLoop(running, onFrame) {
  const cbRef = useRef(onFrame)
  cbRef.current = onFrame

  useEffect(() => {
    if (!running) return
    let raf
    let last = performance.now()
    const step = (now) => {
      // Clamp dt so a background tab doesn't teleport the game state.
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      cbRef.current(dt)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [running])
}
