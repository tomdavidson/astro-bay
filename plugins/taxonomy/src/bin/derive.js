#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const entry = join(dirname(fileURLToPath(import.meta.url)), 'derive.ts')
const args = process.argv.slice(2)

const hasBun = (() => {
  try {
    execFileSync('bun', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

execFileSync(hasBun ? 'bun' : 'tsx', [entry, ...args], { stdio: 'inherit' })
