import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import vm from 'node:vm'
const require = createRequire(import.meta.url)
const swc = require('next/dist/build/swc')
await swc.loadBindings()
export async function loadSource(path, mocks = {}, environment = process.env) {
  const filename = resolve(path)
  const { code } = await swc.transform(readFileSync(filename, 'utf8'), {
    filename,
    jsc: { parser: { syntax: 'typescript', tsx: path.endsWith('.tsx') }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  })
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => name in mocks ? mocks[name] : require(name), process: { env: environment }, URL, console })
  return exports
}
