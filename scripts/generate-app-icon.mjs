import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = path.join(projectRoot, 'assets/app-icons/taronote.png')
const size = 1024
const pixels = new Uint8ClampedArray(size * size * 4)

const colors = {
  icon: [251, 251, 251],
  line: [8, 8, 10],
  shadow: [0, 0, 0]
}

// 将透明度覆盖率限制在 0 到 1，避免混色时溢出。
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))

// 使用 SDF 计算圆角矩形边缘覆盖率，保证透明外沿和圆角在小尺寸下也顺滑。
const roundedRectCoverage = (x, y, rectX, rectY, rectW, rectH, radius, feather = 1.2) => {
  const centerX = rectX + rectW / 2
  const centerY = rectY + rectH / 2
  const qx = Math.abs(x - centerX) - (rectW / 2 - radius)
  const qy = Math.abs(y - centerY) - (rectH / 2 - radius)
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  const inside = Math.min(Math.max(qx, qy), 0)
  const distance = outside + inside - radius

  return clamp(0.5 - distance / feather)
}

// 线条用胶囊 SDF 绘制，所有端点保持圆润，避免导出后出现生硬直角。
const capsuleCoverage = (x, y, x1, y1, x2, y2, radius, feather = 1.2) => {
  const vx = x2 - x1
  const vy = y2 - y1
  const wx = x - x1
  const wy = y - y1
  const lengthSq = vx * vx + vy * vy
  const t = lengthSq ? clamp((wx * vx + wy * vy) / lengthSq) : 0
  const px = x1 + vx * t
  const py = y1 + vy * t
  const distance = Math.hypot(x - px, y - py) - radius

  return clamp(0.5 - distance / feather)
}

// 按 alpha 合成单个像素，支持先画阴影再画主体。
const blendPixel = (index, rgb, alpha) => {
  if (alpha <= 0) {
    return
  }

  const dstAlpha = pixels[index + 3] / 255
  const outAlpha = alpha + dstAlpha * (1 - alpha)

  for (let channel = 0; channel < 3; channel += 1) {
    const dst = pixels[index + channel]
    pixels[index + channel] = outAlpha
      ? Math.round((rgb[channel] * alpha + dst * dstAlpha * (1 - alpha)) / outAlpha)
      : 0
  }

  pixels[index + 3] = Math.round(outAlpha * 255)
}

// 只遍历圆角矩形附近的像素，避免每个图形都扫描整张 1024 画布。
const drawRoundedRect = (rectX, rectY, rectW, rectH, radius, rgb, alpha = 1) => {
  const minX = Math.max(0, Math.floor(rectX - 2))
  const minY = Math.max(0, Math.floor(rectY - 2))
  const maxX = Math.min(size, Math.ceil(rectX + rectW + 2))
  const maxY = Math.min(size, Math.ceil(rectY + rectH + 2))

  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const coverage = roundedRectCoverage(x + 0.5, y + 0.5, rectX, rectY, rectW, rectH, radius)
      blendPixel((y * size + x) * 4, rgb, coverage * alpha)
    }
  }
}

// 胶囊线段同样裁剪到最小绘制区域，用于绘制 Note 图标里的横线和铅笔。
const drawCapsule = (x1, y1, x2, y2, radius, rgb, alpha = 1) => {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - radius - 2))
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - radius - 2))
  const maxX = Math.min(size, Math.ceil(Math.max(x1, x2) + radius + 2))
  const maxY = Math.min(size, Math.ceil(Math.max(y1, y2) + radius + 2))

  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const coverage = capsuleCoverage(x + 0.5, y + 0.5, x1, y1, x2, y2, radius)
      blendPixel((y * size + x) * 4, rgb, coverage * alpha)
    }
  }
}

// 轻微投影只贴着圆角底，不铺满画布，确保 Dock 中不会再出现白色方块。
for (let step = 18; step >= 1; step -= 1) {
  drawRoundedRect(104 - step * 0.7, 116 - step * 0.2, 816 + step * 1.4, 816 + step * 1.4, 176 + step * 0.4, colors.shadow, 0.0032)
}

drawRoundedRect(104, 104, 816, 816, 176, colors.icon)
drawCapsule(314, 392, 662, 392, 23, colors.line)
drawCapsule(314, 518, 706, 518, 23, colors.line)
drawCapsule(314, 646, 602, 646, 23, colors.line)
drawCapsule(674, 638, 736, 700, 23, colors.line)

const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i += 1) {
  let crc = i
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  crcTable[i] = crc >>> 0
}

// PNG chunk 需要 CRC32 校验，这里内置实现以避免额外安装图片库。
const crc32 = (buffer) => {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

// 组装 PNG 标准 chunk：长度、类型、数据和校验值依次写入。
const chunk = (type, data = Buffer.alloc(0)) => {
  const name = Buffer.from(type)
  const length = Buffer.alloc(4)
  const checksum = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])), 0)

  return Buffer.concat([length, name, data, checksum])
}

const raw = Buffer.alloc((size * 4 + 1) * size)
for (let y = 0; y < size; y += 1) {
  const rawOffset = y * (size * 4 + 1)
  raw[rawOffset] = 0
  Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, rawOffset + 1)
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(size, 0)
ihdr.writeUInt32BE(size, 4)
ihdr[8] = 8
ihdr[9] = 6
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

writeFileSync(
  outputPath,
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND')
  ])
)
