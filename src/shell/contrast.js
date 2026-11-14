const HEX_COLOR = /^#[0-9a-f]{6}$/i
const CHANNEL_LINEAR_THRESHOLD = 0.04045
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722]
const LUMINANCE_OFFSET = 0.05
const LINEAR_SEGMENT_DIVISOR = 12.92
const GAMMA_OFFSET = 0.055
const GAMMA_DIVISOR = 1.055
const GAMMA_EXPONENT = 2.4

const toLinearChannel = (channel) => {
  const scaled = channel / 255
  return scaled <= CHANNEL_LINEAR_THRESHOLD
    ? scaled / LINEAR_SEGMENT_DIVISOR
    : ((scaled + GAMMA_OFFSET) / GAMMA_DIVISOR) ** GAMMA_EXPONENT
}

const relativeLuminance = (hex) => {
  if (!HEX_COLOR.test(hex)) throw new Error(`Expected a #rrggbb color, got "${hex}"`)
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
  return channels.reduce(
    (sum, channel, index) => sum + LUMINANCE_WEIGHTS[index] * toLinearChannel(channel),
    0,
  )
}

export const contrastRatio = (hexA, hexB) => {
  const luminanceA = relativeLuminance(hexA)
  const luminanceB = relativeLuminance(hexB)
  const lighter = Math.max(luminanceA, luminanceB)
  const darker = Math.min(luminanceA, luminanceB)
  return (lighter + LUMINANCE_OFFSET) / (darker + LUMINANCE_OFFSET)
}
