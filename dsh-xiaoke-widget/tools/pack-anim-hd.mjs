// 打「动态小克 · 高清 512 档」的高清包（发到 GitHub Releases，不进仓库）：
//   node tools/pack-anim-hd.mjs <输出.zip> <xiaoke-anim-512.webp> <xiaoke-anim-cry-512.webp>
// zip 里的条目不压缩（stored）：WebP 本身已经压过，插件安装时也只认这种最简单的 zip。
// 打印每个文件的 SHA-256，要和 skin/xiaoke-features.mjs 里 HD_FILES 的值一致，插件只装核对得上的文件。
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { createHash } from 'node:crypto'

const [out, ...inputs] = process.argv.slice(2)
if (!out || !inputs.length) {
  console.error('用法：node tools/pack-anim-hd.mjs <输出.zip> <webp>...')
  process.exit(1)
}

const DOS_DATE = (1 << 5) | 1 // 1980-01-01，固定日期让同样的输入打出同样的 zip
const parts = []
const central = []
let offset = 0
for (const file of inputs) {
  const data = fs.readFileSync(file)
  const name = Buffer.from(path.basename(file), 'utf8')
  const crc = zlib.crc32(data)

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(10, 4) // 解压所需版本 1.0
  local.writeUInt16LE(0x0800, 6) // 文件名是 UTF-8
  local.writeUInt16LE(0, 8) // stored
  local.writeUInt16LE(0, 10)
  local.writeUInt16LE(DOS_DATE, 12)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(data.length, 18)
  local.writeUInt32LE(data.length, 22)
  local.writeUInt16LE(name.length, 26)
  local.writeUInt16LE(0, 28)

  const entry = Buffer.alloc(46)
  entry.writeUInt32LE(0x02014b50, 0)
  entry.writeUInt16LE(20, 4)
  entry.writeUInt16LE(10, 6)
  entry.writeUInt16LE(0x0800, 8)
  entry.writeUInt16LE(0, 10)
  entry.writeUInt16LE(0, 12)
  entry.writeUInt16LE(DOS_DATE, 14)
  entry.writeUInt32LE(crc, 16)
  entry.writeUInt32LE(data.length, 20)
  entry.writeUInt32LE(data.length, 24)
  entry.writeUInt16LE(name.length, 28)
  entry.writeUInt32LE(offset, 42)

  parts.push(local, name, data)
  central.push(entry, name)
  offset += local.length + name.length + data.length
  console.log(`${path.basename(file)}  ${(data.length / 1048576).toFixed(2)} MB  sha256 ${createHash('sha256').update(data).digest('hex')}`)
}

const dir = Buffer.concat(central)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0)
end.writeUInt16LE(inputs.length, 8)
end.writeUInt16LE(inputs.length, 10)
end.writeUInt32LE(dir.length, 12)
end.writeUInt32LE(offset, 16)
fs.writeFileSync(out, Buffer.concat([...parts, dir, end]))
console.log(`→ ${out}  ${(fs.statSync(out).size / 1048576).toFixed(2)} MB`)
