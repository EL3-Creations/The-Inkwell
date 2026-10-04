// Generates placeholder PWA icons (black square, white polka dots, rose ink drop)
// without any image libraries. Run: npm run icons
// Replace the output files in /public with your real logo whenever you like.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const ROSE = [214, 142, 158]

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y)
      const i = y * (size * 3 + 1) + 1 + x * 3
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function icon(size) {
  const s = size
  const cx = s / 2, cy = s * 0.56
  const dropR = s * 0.22
  const dots = []
  const step = s / 6
  for (let gy = 0; gy < 6; gy++) for (let gx = 0; gx < 6; gx++) {
    dots.push([step * (gx + 0.5) + (gy % 2 ? step / 2 : 0), step * (gy + 0.5)])
  }
  return png(s, (x, y) => {
    // ink drop: circle + a point on top
    const dx = x - cx, dy = y - cy
    const inCircle = dx * dx + dy * dy <= dropR * dropR
    const tipH = dropR * 1.3
    const ty = cy - dropR * 0.2 - y
    const inTip = ty > 0 && ty < tipH && Math.abs(dx) <= dropR * (1 - ty / tipH) * 0.95
    if (inCircle || inTip) return ROSE
    // inner well ring (white) inside the drop? no: keep the drop solid
    for (const [px, py] of dots) {
      const ddx = x - px, ddy = y - py
      if (ddx * ddx + ddy * ddy <= (s * 0.028) ** 2) return [255, 255, 255]
    }
    return [0, 0, 0]
  })
}

mkdirSync('public', { recursive: true })
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(`public/${name}`, icon(size))
  console.log('wrote public/' + name)
}
