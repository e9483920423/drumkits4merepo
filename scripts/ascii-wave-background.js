// ASCII Wave Background - Vanilla JavaScript Implementation
// Converted from React component to work with static HTML

const CONFIG = {
  BRIGHTNESS_THRESHOLD: 30,
  MOUSE_DITHER_RADIUS: 20,
  MOUSE_DITHER_INTENSITY: 1,
  CHARACTER_SPACING: 1.5,
  RENDER_SCALE: 1,
  ADAPTIVE_QUALITY: false,
  TARGET_FPS_LOW: 50,
  TARGET_FPS_HIGH: 70,
  QUALITY_CHANGE_COOLDOWN: 15000,
  FPS_SAMPLE_SIZE: 30,
  QUALITY_SETTLING_PERIOD: 3000,
}

class AsciiWaveBackground {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId)
    if (!this.canvas) {
      console.error("[v0] ASCII Wave Background: Canvas element not found")
      return
    }

    this.ctx = this.canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    })

    if (!this.ctx) {
      console.error("[v0] ASCII Wave Background: Could not get 2D context")
      return
    }

    this.mousePos = { x: -1000, y: -1000 }
    this.mouseMoveScheduled = false
    this.frameTimes = []
    this.lastFrameTime = performance.now()
    this.currentSpacing = CONFIG.CHARACTER_SPACING
    this.lastQualityChange = 0
    this.gridDimensions = { cols: 0, rows: 0, centerX: 0, centerY: 0, maxDistance: 0 }
    this.resizeScheduled = false
    this.animationFrameId = null
    this.time = 0

    this.xOffsetPhase = 0
    this.yOffsetPhase = 0
    this.frequencyBase = 1
    this.phaseShiftX = 0
    this.phaseShiftY = 0
    this.distortionIntensity = 1

    this.fontSize = 7
    this.charWidth = this.fontSize * 0.7
    this.charHeight = this.fontSize * 0.9

    this.darkChars = [
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
    this.chars = [" ", ...this.darkChars.slice(0, 10), "░", "░", "▒", "▒", "▒", "▓", "▓", "▓", "█"]
    this.glitchChars = [...this.darkChars.slice(0, 8), "░", "▒", "▓", "▀", "▄"]

    this.ditherLookup = this.createDitherLookup()

    this.init()
  }

  createDitherLookup() {
    const lookup = new Array(4)
    const pattern = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ]
    for (let y = 0; y < 4; y++) {
      lookup[y] = new Array(4)
      for (let x = 0; x < 4; x++) {
        lookup[y][x] = pattern[y][x] / 75
      }
    }
    return lookup
  }

  ditherPattern(x, y) {
    return this.ditherLookup[y & 3][x & 3]
  }

  resizeCanvas() {
    const scale = CONFIG.RENDER_SCALE

    this.ctx.setTransform(1, 0, 0, 1, 0, 0)

    this.canvas.width = window.innerWidth * scale
    this.canvas.height = window.innerHeight * scale
    this.canvas.style.width = `${window.innerWidth}px`
    this.canvas.style.height = `${window.innerHeight}px`

    const cols = Math.floor(this.canvas.width / this.charWidth)
    const rows = Math.floor(this.canvas.height / this.charHeight)

    const centerX = cols / 2
    const centerY = rows / 2
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY)

    this.gridDimensions = { cols, rows, centerX, centerY, maxDistance }

    this.ctx.font = `${this.fontSize}px 'JetBrains Mono', monospace`
    this.ctx.textBaseline = "top"
  }

  handleResize() {
    if (!this.resizeScheduled) {
      this.resizeScheduled = true
      requestAnimationFrame(() => {
        this.resizeCanvas()
        this.resizeScheduled = false
      })
    }
  }

  handleMouseMove(e) {
    if (!this.mouseMoveScheduled) {
      this.mouseMoveScheduled = true
      requestAnimationFrame(() => {
        const rect = this.canvas.getBoundingClientRect()
        this.mousePos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        }
        this.mouseMoveScheduled = false
      })
    }
  }

  computeDynamicOffset(col, row) {
    const baseFreqX = 0.06 * this.frequencyBase
    const baseFreqY = 2.025 * this.frequencyBase

    const xWave1 = Math.sin(row * baseFreqX + this.xOffsetPhase + this.phaseShiftX) * 2
    const xWave2 = Math.cos(col * baseFreqX * 0.3 - this.xOffsetPhase * 0.2) * 1

    const yWave1 = Math.cos(col * baseFreqY + this.yOffsetPhase - this.phaseShiftY) * 3
    const yWave2 = Math.sin(row * baseFreqY * 0.8 + this.yOffsetPhase * 0.3) * 3

    const totalXOffset = (xWave1 + xWave2) * this.distortionIntensity
    const totalYOffset = (yWave1 + yWave2) * this.distortionIntensity

    return {
      xOffset: totalXOffset,
      yOffset: totalYOffset,
    }
  }

  updateFrameRate() {
    if (!CONFIG.ADAPTIVE_QUALITY) return

    const now = performance.now()
    const frameTime = now - this.lastFrameTime
    this.lastFrameTime = now

    this.frameTimes.push(frameTime)
    if (this.frameTimes.length > CONFIG.FPS_SAMPLE_SIZE) {
      this.frameTimes.shift()
    }

    const timeSinceLastChange = now - this.lastQualityChange
    if (timeSinceLastChange < CONFIG.QUALITY_SETTLING_PERIOD) {
      return
    }

    if (this.frameTimes.length === CONFIG.FPS_SAMPLE_SIZE) {
      const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / CONFIG.FPS_SAMPLE_SIZE
      const currentFPS = 1000 / avgFrameTime

      if (timeSinceLastChange < CONFIG.QUALITY_CHANGE_COOLDOWN) {
        return
      }

      if (currentFPS < CONFIG.TARGET_FPS_LOW && this.currentSpacing < 4) {
        this.currentSpacing = Math.min(4, this.currentSpacing + 0.5)
        this.lastQualityChange = now
        this.frameTimes = []
      } else if (currentFPS > CONFIG.TARGET_FPS_HIGH && this.currentSpacing > CONFIG.CHARACTER_SPACING) {
        this.currentSpacing = Math.max(CONFIG.CHARACTER_SPACING, this.currentSpacing - 0.5)
        this.lastQualityChange = now
        this.frameTimes = []
      }
    }
  }

  animate() {
    this.updateFrameRate()

    this.ctx.fillStyle = "#000000"
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    this.frequencyBase = 2.5 + Math.sin(this.time * 0.008) * 0.4
    this.phaseShiftX = Math.sin(this.time * 0.015) * Math.PI
    this.phaseShiftY = Math.cos(this.time * 0.013) * Math.PI
    this.distortionIntensity = 0.3 + Math.sin(this.time * 0.02) * 1

    this.xOffsetPhase += 0.045
    this.yOffsetPhase += 0.038

    const mouseColPos = this.mousePos.x / this.charWidth
    const mouseRowPos = this.mousePos.y / this.charHeight
    const mouseInRange = this.mousePos.x > -100 && this.mousePos.y > -100

    const spacing = this.currentSpacing
    const { cols, rows, centerX, centerY, maxDistance } = this.gridDimensions

    let lastFillStyle = ""

    for (let row = 0; row < rows; row += spacing) {
      for (let col = 0; col < cols; col += spacing) {
        const { xOffset, yOffset } = this.computeDynamicOffset(col, row)

        const distortedCol = col + xOffset * 0.6
        const distortedRow = row + yOffset * 0.6

        const wave1 = Math.sin(distortedCol * 0.04 + this.time * 0.03 + distortedRow * 0.04) * 5
        const wave2 = Math.sin(distortedCol * 0.02 - this.time * 0.02 + distortedRow * 0.06) * 4
        const combinedWave = wave1 + wave2

        const dx = col - centerX
        const dy = row - centerY
        const distanceFromCenter = Math.sqrt(dx * dx + dy * dy) / maxDistance

        const auroraFlow = Math.sin(distanceFromCenter * 15 - this.time * 0.08) * 3

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

        const dither = this.ditherPattern(col + ditherOffsetX, row + ditherOffsetY)
        const waveValue = (combinedWave + auroraFlow + 10 + dither * 2) / 22

        const offsetMagnitude = xOffset * xOffset + yOffset * yOffset
        const useGlitchChar = offsetMagnitude > 64 && Math.random() > 0.7

        const charIndex = Math.floor(waveValue * (this.chars.length - 1))
        const char = useGlitchChar
          ? this.glitchChars[Math.floor(Math.random() * this.glitchChars.length)]
          : this.chars[Math.max(0, Math.min(this.chars.length - 1, charIndex))]

        const intensity = Math.floor(waveValue * 255)
        const radialFade = 1 - distanceFromCenter * 0.4
        const finalIntensity = Math.floor(intensity * radialFade)

        if (finalIntensity > CONFIG.BRIGHTNESS_THRESHOLD) {
          const newFillStyle = `rgb(${finalIntensity}, ${finalIntensity}, ${finalIntensity})`

          if (newFillStyle !== lastFillStyle) {
            this.ctx.fillStyle = newFillStyle
            lastFillStyle = newFillStyle
          }

          this.ctx.fillText(char, col * this.charWidth, row * this.charHeight)
        }
      }
    }

    this.time += 0.35
    this.animationFrameId = requestAnimationFrame(() => this.animate())
  }

  init() {
    this.resizeCanvas()
    window.addEventListener("resize", () => this.handleResize())
    this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e), { passive: true })
    this.animate()
  }

  destroy() {
    window.removeEventListener("resize", () => this.handleResize())
    this.canvas.removeEventListener("mousemove", (e) => this.handleMouseMove(e))
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }
  }
}

function initAsciiBackground() {
  const canvas = document.getElementById("ascii-wave-canvas")
  if (canvas) {
    new AsciiWaveBackground("ascii-wave-canvas")
  } else {
    // Silently fail - canvas might not exist on this page
    // This prevents errors on pages that don't have the canvas element
  }
}

// Wait for DOM to be fully loaded before initializing
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAsciiBackground)
} else {
  // DOM is already loaded, but add a small delay to ensure canvas is parsed
  setTimeout(initAsciiBackground, 0)
}
