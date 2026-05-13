/**
 * C++ sandbox: compile with g++ then run as persistent subprocess.
 * Protocol identical to python-runner: JSON lines over stdin/stdout.
 *
 * User writes a strategy() function:
 *   #include <map>
 *   #include <string>
 *   std::string strategy(std::map<std::string,double> ctx) { ... }
 */
import { spawn, execSync, type ChildProcess } from 'node:child_process'
import { createInterface, type Interface } from 'node:readline'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Strategy, StrategyContext, ActionName } from '@robocode/shared'
import { buildStrategy } from './build-strategy.js'

const VALID_ACTIONS = new Set<ActionName>([
  'attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special',
  'combo', 'overcharge', 'reflect', 'adaptive_shield', 'trap',
  'hack', 'sacrifice', 'reboot', 'transfer', 'analyze',
])

const PER_TURN_TIMEOUT_MS = 80

// Harness wraps user code: reads JSON ctx lines, calls strategy(), prints action
const HARNESS_TEMPLATE = `
#include <iostream>
#include <string>
#include <map>
#include <sstream>
#include <stdexcept>

// ---- USER CODE START ----
{{USER_CODE}}
// ---- USER CODE END ----

int main() {
    std::string line;
    while (std::getline(std::cin, line)) {
        if (line.empty()) { std::cout << "attack" << std::endl; continue; }
        // Parse "key:val|key:val|..."
        std::map<std::string,double> ctx;
        std::istringstream ss(line);
        std::string token;
        while (std::getline(ss, token, '|')) {
            auto sep = token.find(':');
            if (sep != std::string::npos) {
                std::string k = token.substr(0, sep);
                try { ctx[k] = std::stod(token.substr(sep + 1)); } catch(...) {}
            }
        }
        std::string result = "attack";
        try { result = strategy(ctx); } catch(...) { result = "attack"; }
        if (result.empty()) result = "attack";
        std::cout << result << std::endl;
        std::cout.flush();
    }
    return 0;
}
`

function serializeCtx(ctx: StrategyContext): string {
  return [
    `myHp:${ctx.myHp}`, `myMaxHp:${ctx.myMaxHp}`,
    `myStamina:${ctx.myStamina}`, `myRage:${ctx.myRage}`,
    `enemyHp:${ctx.enemyHp}`, `enemyStamina:${ctx.enemyStamina}`, `enemyRage:${ctx.enemyRage}`,
    `turn:${ctx.turn}`, `myRepeatCount:${ctx.myRepeatCount}`,
  ].join('|')
}

export async function runCpp(code: string): Promise<Strategy> {
  const dir     = mkdtempSync(join(tmpdir(), 'robocode-cpp-'))
  const srcPath = join(dir, 'strategy.cpp')
  const binPath = join(dir, 'strategy')

  const fullCode = HARNESS_TEMPLATE.replace('{{USER_CODE}}', code)
  writeFileSync(srcPath, fullCode, 'utf8')

  // Compile
  try {
    execSync(`g++ -O2 -std=c++17 -o "${binPath}" "${srcPath}"`, { timeout: 12000, stdio: 'pipe' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`C++ compile error: ${msg}`)
  }

  let proc: ChildProcess
  try {
    proc = spawn(binPath, [], { stdio: ['pipe', 'pipe', 'pipe'] })
  } catch (e) {
    throw new Error(`C++ spawn error: ${e}`)
  }

  let disposed = false
  type PendingResolver = (action: ActionName) => void
  let pendingResolver: PendingResolver | null = null

  const rl: Interface = createInterface({ input: proc.stdout! })

  const dispose = () => {
    if (disposed) return
    disposed = true
    pendingResolver?.('attack')
    pendingResolver = null
    rl.close()
    proc.kill('SIGKILL')
  }

  rl.on('line', (line) => {
    const action = line.trim() as ActionName
    pendingResolver?.(VALID_ACTIONS.has(action) ? action : 'attack')
    pendingResolver = null
  })

  proc.stderr?.on('data', (chunk: Buffer) => {
    const msg = chunk.toString().trim()
    if (msg) console.warn('[cpp-sandbox]', msg)
  })

  proc.on('exit', () => {
    pendingResolver?.('attack')
    pendingResolver = null
  })

  const asyncFn = async (ctx: StrategyContext): Promise<ActionName> => {
    if (disposed) return 'attack'
    return new Promise<ActionName>((resolve) => {
      const timer = setTimeout(() => {
        pendingResolver = null
        resolve('attack')
      }, PER_TURN_TIMEOUT_MS)

      pendingResolver = (action: ActionName) => {
        clearTimeout(timer)
        pendingResolver = null
        resolve(action)
      }

      try {
        proc.stdin!.write(serializeCtx(ctx) + '\n')
      } catch {
        clearTimeout(timer)
        pendingResolver = null
        resolve('attack')
      }
    })
  }

  return { primary: 'attack', lowHp: 'repair', onHit: 'dodge', style: 'Standard', position: 'mid', asyncFn, dispose }
}
