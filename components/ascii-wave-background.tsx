"use client"

import { useEffect, useRef, memo } from "react"

const CONFIG = {
  BRIGHTNESS_THRESHOLD: 30,
  MOUSE_DITHER_RADIUS: 15,
  MOUSE_DITHER_INTENSITY: 1,
  CHARACTER_SPACING: 1.5,
  RENDER_SCALE: 1,
  ADAPTIVE_QUALITY: true,
  TARGET_FPS_LOW: 50,
  TARGET_FPS_HIGH: 70,
  QUALITY_CHANGE_COOLDOWN: 15000,
  FPS_SAMPLE_SIZE: 30,
  QUALITY_SETTLING_PERIOD: 3000,
  MOUSE_DEBOUNCE_MS: 16,
}

const AsciiWaveBackground = memo(function AsciiWaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const mousePos = useRef({ x: -1000, y: -1000 })
  const mouseMoveScheduled = useRef(false)
  const lastMouseUpdateRef = useRef(0)
  const isInteractingRef = useRef(false)
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const frameTimesRef = useRef<number[]>([])
  const lastFrameTimeRef = useRef(performance.now())
  const currentSpacingRef = useRef(CONFIG.CHARACTER_SPACING)
  const lastQualityChangeRef = useRef(0)

  const gridDimensionsRef = useRef({ cols: 0, rows: 0, centerX: 0, centerY: 0, maxDistance: 0 })
  const resizeScheduledRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    })
    if (!ctx) return

    offscreenCanvasRef.current = document.createElement("canvas")
    offscreenCtxRef.current = offscreenCanvasRef.current.getContext("2d", {
      alpha: false,
      desynchronized: true,
    })
    if (!offscreenCtxRef.current) return

    const darkChars = [
      "*",
      "#",
      "░",
      "∷",
      "~",
      "▲",
      "⇔",
      "␄",
      "␙",
      "␃",
      "␄",
      "␗",
      "␅",
      "␛",
      "␜",
      "␌",
      "␝",
      "␉",
      "␊",
      "␕",
      "␤",
      "␀",
      "␞",
      "␏",
      "␎",
      "␠",
      "␁",
      "␂",
      "␚",
      "␖",
      "␟",
      "␋",
      "₀",
    ]
    const chars = [" ", ...darkChars.slice(0, 10), "░", "░", "▒", "▒", "▒", "▓", "▓", "▓", "█"]
    const glitchChars = [...darkChars.slice(0, 8), "░", "▒", "▓", "▀", "▄"]

    let animationFrameId: number
    let time = 0

    let xOffsetPhase = 0
    let yOffsetPhase = 0
    let frequencyBase = 1
    let phaseShiftX = 0
    let phaseShiftY = 0
    let distortionIntensity = 1

    const fontSize = 7
    const charWidth = fontSize * 0.7
    const charHeight = fontSize * 0.9

    const resizeCanvas = () => {
      const scale = CONFIG.RENDER_SCALE

      ctx.setTransform(1, 0, 0, 1, 0, 0)

      canvas.width = window.innerWidth * scale
      canvas.height = window.innerHeight * scale
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`

      if (offscreenCanvasRef.current && offscreenCtxRef.current) {
        offscreenCanvasRef.current.width = canvas.width
        offscreenCanvasRef.current.height = canvas.height
        offscreenCtxRef.current.font = `${fontSize}px 'JetBrains Mono', monospace`
        offscreenCtxRef.current.textBaseline = "top"
      }

      const cols = Math.floor(canvas.width / charWidth)
      const rows = Math.floor(canvas.height / charHeight)

      const centerX = cols / 2
      const centerY = rows / 2
      const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY)

      gridDimensionsRef.current = { cols, rows, centerX, centerY, maxDistance }

      ctx.font = `${fontSize}px 'JetBrains Mono', monospace`
      ctx.textBaseline = "top"
    }

    const handleResize = () => {
      if (!resizeScheduledRef.current) {
        resizeScheduledRef.current = true
        requestAnimationFrame(() => {
          resizeCanvas()
          resizeScheduledRef.current = false
        })
      }
    }

    resizeCanvas()
    window.addEventListener("resize", handleResize)

    const ditherLookup = new Array(4)
    for (let y = 0; y < 4; y++) {
      ditherLookup[y] = new Array(4)
      const pattern = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5],
      ]
      for (let x = 0; x < 4; x++) {
        ditherLookup[y][x] = pattern[y][x] / 75
      }
    }

    const ditherPattern = (x: number, y: number): number => {
      return ditherLookup[y & 3][x & 3]
    }

    const computeDynamicOffset = (col: number, row: number, time: number) => {
      const baseFreqX = 0.06 * frequencyBase
      const baseFreqY = 2.025 * frequencyBase

      const xWave1 = Math.sin(row * baseFreqX + xOffsetPhase + phaseShiftX) * 2
      const xWave2 = Math.cos(col * baseFreqX * 0.3 - xOffsetPhase * 0.2) * 1

      const yWave1 = Math.cos(col * baseFreqY + yOffsetPhase - phaseShiftY) * 3
      const yWave2 = Math.sin(row * baseFreqY * 0.8 + yOffsetPhase * 0.3) * 3

      const totalXOffset = (xWave1 + xWave2) * distortionIntensity
      const totalYOffset = (yWave1 + yWave2) * distortionIntensity

      return {
        xOffset: totalXOffset,
        yOffset: totalYOffset,
      }
    }

    const updateFrameRate = () => {
      if (!CONFIG.ADAPTIVE_QUALITY) return

      const now = performance.now()
      const frameTime = now - lastFrameTimeRef.current
      lastFrameTimeRef.current = now

      frameTimesRef.current.push(frameTime)
      if (frameTimesRef.current.length > CONFIG.FPS_SAMPLE_SIZE) {
        frameTimesRef.current.shift()
      }

      const timeSinceLastChange = now - lastQualityChangeRef.current
      if (timeSinceLastChange < CONFIG.QUALITY_SETTLING_PERIOD) {
        return
      }

      if (frameTimesRef.current.length === CONFIG.FPS_SAMPLE_SIZE) {
        const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / CONFIG.FPS_SAMPLE_SIZE
        const currentFPS = 1000 / avgFrameTime

        if (timeSinceLastChange < CONFIG.QUALITY_CHANGE_COOLDOWN) {
          return
        }

        if (currentFPS < CONFIG.TARGET_FPS_LOW && currentSpacingRef.current < 4) {
          currentSpacingRef.current = Math.min(4, currentSpacingRef.current + 0.5)
          lastQualityChangeRef.current = now
          frameTimesRef.current = []
        } else if (currentFPS > CONFIG.TARGET_FPS_HIGH && currentSpacingRef.current > CONFIG.CHARACTER_SPACING) {
          currentSpacingRef.current = Math.max(CONFIG.CHARACTER_SPACING, currentSpacingRef.current - 0.5)
          lastQualityChangeRef.current = now
          frameTimesRef.current = []
        }
      }
    }

    const animate = () => {
      updateFrameRate()

      const renderCtx = offscreenCtxRef.current
      if (!renderCtx || !offscreenCanvasRef.current) return

      renderCtx.fillStyle = "#000000"
      renderCtx.fillRect(0, 0, offscreenCanvasRef.current.width, offscreenCanvasRef.current.height)

      const complexityMultiplier = isInteractingRef.current ? 0.5 : 1

      frequencyBase = 2.5 + Math.sin(time * 0.008) * 0.4

      phaseShiftX = Math.sin(time * 0.015) * Math.PI
      phaseShiftY = Math.cos(time * 0.013) * Math.PI

      distortionIntensity = (0.3 + Math.sin(time * 0.02) * 1) * complexityMultiplier

      xOffsetPhase += 0.045 * complexityMultiplier
      yOffsetPhase += 0.038 * complexityMultiplier

      const mouseColPos = mousePos.current.x / charWidth
      const mouseRowPos = mousePos.current.y / charHeight

      const mouseInRange = mousePos.current.x > -100 && mousePos.current.y > -100

      const spacing = currentSpacingRef.current

      const { cols, rows, centerX, centerY, maxDistance } = gridDimensionsRef.current

      let lastFillStyle = ""

      for (let row = 0; row < rows; row += spacing) {
        for (let col = 0; col < cols; col += spacing) {
          const { xOffset, yOffset } = computeDynamicOffset(col, row, time)

          const distortedCol = col + xOffset * 0.6
          const distortedRow = row + yOffset * 0.6

          const wave1 = Math.sin(distortedCol * 0.04 + time * 0.03 + distortedRow * 0.04) * 5
          const wave2 = Math.sin(distortedCol * 0.02 - time * 0.02 + distortedRow * 0.06) * 4

          const combinedWave = wave1 + wave2

          const dx = col - centerX
          const dy = row - centerY
          const distanceFromCenter = Math.sqrt(dx * dx + dy * dy) / maxDistance

          const auroraFlow = Math.sin(distanceFromCenter * 15 - time * 0.08) * 3

          let ditherOffsetX = 0
          let ditherOffsetY = 0

          if (mouseInRange) {
            const dx2 = col - mouseColPos
            const dy2 = row - mouseRowPos
            const distanceFromMouse = Math.sqrt(dx2 * dx2 + dy2 * dy2)

            if (distanceFromMouse < CONFIG.MOUSE_DITHER_RADIUS) {
              const mouseInfluence = 1 - distanceFromMouse / CONFIG.MOUSE_DITHER_RADIUS
              if (mouseInfluence > 0.1) {
                ditherOffsetX = Math.floor(mouseInfluence * CONFIG.MOUSE_DITHER_INTENSITY * 3)
                ditherOffsetY = Math.floor(mouseInfluence * CONFIG.MOUSE_DITHER_INTENSITY * 3)
              }
            }
          }

          const dither = ditherPattern(col + ditherOffsetX, row + ditherOffsetY)

          const waveValue = (combinedWave + auroraFlow + 10 + dither * 2) / 22

          const renderCol = col
          const renderRow = row

          const offsetMagnitude = xOffset * xOffset + yOffset * yOffset
          const useGlitchChar = offsetMagnitude > 64 && Math.random() > 0.7

          const charIndex = Math.floor(waveValue * (chars.length - 1))
          const char = useGlitchChar
            ? glitchChars[Math.floor(Math.random() * glitchChars.length)]
            : chars[Math.max(0, Math.min(chars.length - 1, charIndex))]

          const intensity = Math.floor(waveValue * 255)
          const radialFade = 1 - distanceFromCenter * 0.4
          const finalIntensity = Math.floor(intensity * radialFade)

          if (finalIntensity > CONFIG.BRIGHTNESS_THRESHOLD) {
            const newFillStyle = `rgb(${finalIntensity}, ${finalIntensity}, ${finalIntensity})`

            if (newFillStyle !== lastFillStyle) {
              renderCtx.fillStyle = newFillStyle
              lastFillStyle = newFillStyle
            }

            renderCtx.fillText(char, renderCol * charWidth, renderRow * charHeight)
          }
        }
      }

      ctx.drawImage(offscreenCanvasRef.current, 0, 0)

      time += 0.35
      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    const handleMouseMove = (e: MouseEvent) => {
      const now = performance.now()

      if (!mouseMoveScheduled.current && now - lastMouseUpdateRef.current >= CONFIG.MOUSE_DEBOUNCE_MS) {
        mouseMoveScheduled.current = true
        lastMouseUpdateRef.current = now

        requestAnimationFrame(() => {
          const rect = canvas.getBoundingClientRect()
          mousePos.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          }
          mouseMoveScheduled.current = false
        })
      }

      isInteractingRef.current = true
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current)
      }
      interactionTimeoutRef.current = setTimeout(() => {
        isInteractingRef.current = false
      }, 150)
    }

    canvas.addEventListener("mousemove", handleMouseMove, { passive: true })

    return () => {
      window.removeEventListener("resize", handleResize)
      canvas.removeEventListener("mousemove", handleMouseMove)
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current)
      }
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 h-full w-full cursor-crosshair"
      style={{
        willChange: "transform",
        transform: "translate3d(0, 0, 0)",
        contain: "layout style paint",
        isolation: "isolate",
        zIndex: -1,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    />
  )
})

export default AsciiWaveBackground
