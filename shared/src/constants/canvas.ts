export const PRESET_COLORS = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
  '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#88ff00',
  '#0088ff', '#ff0088',
] as const

export const WIDTH_PRESETS = {
  thin: 2,
  medium: 4,
  thick: 8,
} as const

export const ERASER_COLOR = '#ffffff'
export const ERASER_WIDTH_MULTIPLIER = 3
export const EMIT_INTERVAL_MS = 16
export const STROKE_SIMPLIFY_TOLERANCE = 2
export const STROKE_MIN_POINTS = 10
export const CANVAS_ASPECT_RATIO = 4 / 3
