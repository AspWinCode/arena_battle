/**
 * Python sandbox: persistent child_process approach.
 *
 * Protocol:
 *  1. Node spawns python3 with sandbox-runner.py
 *  2. Node sends JSON line: {"type":"init","code":"..."}
 *  3. Python executes user code, runs test scenarios, prints:
 *       {"type":"calls","calls":[...]}   (for static strategy extraction)
 *       {"type":"ready"}                 (signals ready for per-turn calls)
 *  4. For each battle turn, Node sends: {"type":"turn","ctx":{...}}
 *  5. Python calls strategy(ctx) and responds: {"action":"attack"}
 *  6. On battle end, Node calls strategy.dispose() → kills the process
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface, type Interface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { Strategy, StrategyContext, ActionName } from '@robocode/shared'
import { buildStrategy } from './build-strategy.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// In production Docker: runner.py is copied to /app/sandbox-runner.py
// In development: it's in docker/sandbox-python/runner.py
const RUNNER_PATH = process.env.PYTHON_RUNNER_PATH
  ?? path.resolve(__dirname, '../../../../docker/sandbox-python/runner.py')

const VALID = new Set<ActionName>(['attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special'])
const PER_TURN_TIMEOUT_MS = 60  // 60ms per turn

function isValidAction(v: unknown): v is ActionName {
  return typeof v === 'string' && VALID.has(v as ActionName)
}

/** Pending per-turn promise resolver, resolved when Python sends the next action line */
type PendingResolver = (action: ActionName) => void

export async function runPython(code: string): Promise<Strategy> {
  let proc: ChildProcess
  try {
    proc = spawn('python3', [RUNNER_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (err) {
    console.warn('[python-runner] failed to spawn python3:', err)
    return buildStrategy([])
  }

  return new Promise<Strategy>((resolve) => {
    let resolved = false
    let staticStrategy = buildStrategy([])
    let pendingResolver: PendingResolver | null = null
    let disposed = false

    const rl: Interface = createInterface({ input: proc.stdout! })

    const done = (s: Strategy) => {
      if (!resolved) { resolved = true; resolve(s) }
    }

    // Kill process and clean up
    const dispose = () => {
      if (disposed) return
      disposed = true
      pendingResolver?.('attack')
      pendingResolver = null
      rl.close()
      proc.kill('SIGKILL')
    }

    // Send init message with user code
    try {
      proc.stdin!.write(JSON.stringify({ type: 'init', code }) + '\n')
    } catch {
      done(buildStrategy([]))
      return
    }

    // Process stderr (errors / warnings from Python)
    proc.stderr?.on('data', (chunk: Buffer) => {
      const msg = chunk.toString().trim()
      if (msg) console.warn('[python-sandbox]', msg)
    })

    rl.on('line', (rawLine) => {
      const line = rawLine.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').trim()
      if (!line) return

      let msg: Record<string, unknown>
      try { msg = JSON.parse(line) as Record<string, unknown> }
      catch { return }

      if (msg.type === 'calls') {
        // Static strategy extraction from test runs
        const calls = (msg.calls as import('./build-strategy.js').ActionCall[] | undefined) ?? []
        staticStrategy = buildStrategy(calls)
      } else if (msg.type === 'ready') {
        // Process is ready; build final strategy with asyncFn wired to the process
        const asyncFn = async (ctx: StrategyContext): Promise<ActionName> => {
          if (disposed) return staticStrategy.primary
          return new Promise<ActionName>((res) => {
            const timer = setTimeout(() => {
              pendingResolver = null
              res(staticStrategy.primary)
            }, PER_TURN_TIMEOUT_MS)

            pendingResolver = (action: ActionName) => {
              clearTimeout(timer)
              pendingResolver = null
              res(action)
            }

            try {
              proc.stdin!.write(JSON.stringify({ type: 'turn', ctx }) + '\n')
            } catch {
              clearTimeout(timer)
              pendingResolver = null
              res(staticStrategy.primary)
            }
          })
        }

        staticStrategy.asyncFn = asyncFn
        staticStrategy.dispose = dispose
        done(staticStrategy)
      } else if (msg.type === 'action' && pendingResolver) {
        // Per-turn response
        const action = msg.action as string
        pendingResolver(isValidAction(action) ? action : staticStrategy.primary)
      } else if (msg.type === 'error') {
        console.warn('[python-sandbox] user code error:', msg.message)
        if (!resolved) done(buildStrategy([]))
      }
    })

    proc.on('error', (err) => {
      console.warn('[python-runner] process error:', err)
      done(buildStrategy([]))
    })

    proc.on('exit', (code) => {
      if (code !== 0 && !disposed) {
        console.warn(`[python-runner] process exited with code ${code}`)
      }
      pendingResolver?.(staticStrategy.primary)
      pendingResolver = null
      if (!resolved) done(buildStrategy([]))
    })

    // Global timeout for init phase
    setTimeout(() => {
      if (!resolved) {
        console.warn('[python-runner] init timeout')
        dispose()
        done(buildStrategy([]))
      }
    }, 5000)
  })
}
