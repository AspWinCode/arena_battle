/**
 * Java sandbox: compile with javac then run as persistent subprocess.
 *
 * User writes:
 *   public class Strategy {
 *     public static String strategy(java.util.Map<String,Double> ctx) { ... }
 *   }
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

// Main harness wraps the user's Strategy class
const HARNESS_TEMPLATE = `
import java.util.*;
import java.io.*;

// ---- USER CODE START ----
{{USER_CODE}}
// ---- USER CODE END ----

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line;
        while ((line = reader.readLine()) != null) {
            if (line.trim().isEmpty()) { System.out.println("attack"); System.out.flush(); continue; }
            Map<String,Double> ctx = new HashMap<>();
            for (String token : line.split("\\\\|")) {
                String[] kv = token.split(":", 2);
                if (kv.length == 2) {
                    try { ctx.put(kv[0], Double.parseDouble(kv[1])); } catch (NumberFormatException e) {}
                }
            }
            String result = "attack";
            try { result = Strategy.strategy(ctx); } catch (Exception e) { result = "attack"; }
            if (result == null || result.isEmpty()) result = "attack";
            System.out.println(result);
            System.out.flush();
        }
    }
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

export async function runJava(code: string): Promise<Strategy> {
  const dir      = mkdtempSync(join(tmpdir(), 'robocode-java-'))
  const mainPath = join(dir, 'Main.java')

  const fullCode = HARNESS_TEMPLATE.replace('{{USER_CODE}}', code)
  writeFileSync(mainPath, fullCode, 'utf8')

  // Compile
  try {
    execSync(`javac "${mainPath}"`, { cwd: dir, timeout: 15000, stdio: 'pipe' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Java compile error: ${msg}`)
  }

  let proc: ChildProcess
  try {
    proc = spawn('java', ['-cp', dir, 'Main'], { stdio: ['pipe', 'pipe', 'pipe'] })
  } catch (e) {
    throw new Error(`Java spawn error: ${e}`)
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
    if (msg) console.warn('[java-sandbox]', msg)
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
