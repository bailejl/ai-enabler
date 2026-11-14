const HEX_COLOR = /^#[0-9a-f]{6}$/i
const CHANNEL_LINEAR_THRESHOLD = 0.04045
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722]
const LUMINANCE_OFFSET = 0.05

const toLinearChannel = (channel) => {
  const scaled = channel / 255
  return scaled <= CHANNEL_LINEAR_THRESHOLD ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
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
  const [lighter, darker] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort((a, b) => b - a)
  return (lighter + LUMINANCE_OFFSET) / (darker + LUMINANCE_OFFSET)
}
