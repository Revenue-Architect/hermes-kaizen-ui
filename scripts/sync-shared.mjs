// Plugins can't import each other at runtime, so each package carries its own copy of packages/shared.
import { copyFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const targets = { a2ui: 'a2ui_core', openui: 'openui_core' }

for (const [name, core] of Object.entries(targets)) {
  const pkg = path.join(root, 'packages', name)
  mkdirSync(path.join(pkg, core), { recursive: true })
  mkdirSync(path.join(pkg, 'src/shared'), { recursive: true })
  copyFileSync(path.join(root, 'packages/shared/surface_runtime.py'), path.join(pkg, core, 'surface_runtime.py'))
  copyFileSync(path.join(root, 'packages/shared/surface-card.ts'), path.join(pkg, 'src/shared/surface-card.ts'))
}
console.log('Synced packages/shared')
