// Builds desktop/plugin.js: one standalone file with the CSS and the OFL font embedded.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const read = (file, encoding) => readFile(path.join(root, file), encoding)
const font = await read('assets/hanken-grotesk-variable.ttf')
const css = await read('src/theme.css', 'utf8')
const entry = await read('src/plugin.mjs', 'utf8')
const fontCSS = `@font-face { font-family: "Kaizen Hanken"; font-style: normal; font-weight: 100 900; font-display: swap; src: url("data:font/ttf;base64,${font.toString('base64')}") format("truetype"); }\n`

const marker = "/* EMBED_CSS */ ''"
if (!entry.includes(marker)) throw new Error('src/plugin.mjs lost its CSS marker')

const output = entry.replace(marker, () => JSON.stringify(fontCSS + css))
await mkdir(path.join(root, 'desktop'), { recursive: true })
await writeFile(path.join(root, 'desktop/plugin.js'), output)
console.log(`Built desktop/plugin.js (${Buffer.byteLength(output)} bytes)`)
