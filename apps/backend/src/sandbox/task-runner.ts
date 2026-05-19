/**
 * Task runner: runs user code against test cases and returns pass/fail results.
 * Used for the topic task system (not battle strategies).
 *
 * Protocol:
 *  - wrap user code to capture stdout
 *  - run each test case (feed stdin if needed)
 *  - compare stdout to expected_output
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { Language } from '@robocode/shared'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const TASK_RUNNER_PATH = process.env.PYTHON_RUNNER_PATH
  ? path.dirname(process.env.PYTHON_RUNNER_PATH)
  : path.resolve(__dirname, '../../../../docker/sandbox-python')

const TIMEOUT_MS = 5000

export interface TestCase {
  input: string | null
  expected_output: string
}

export interface TestCaseResult {
  input: string | null
  expected: string
  actual: string
  passed: boolean
}

export interface TaskRunResult {
  passed: boolean
  results: TestCaseResult[]
  error?: string
}

function normalise(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd()
}

async function runPythonCode(code: string, stdin: string | null, timeoutMs: number): Promise<{ stdout: string; error?: string }> {
  return new Promise((resolve) => {
    let proc: ReturnType<typeof spawn>
    try {
      proc = spawn('python3', ['-c', code], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      })
    } catch (err) {
      return resolve({ stdout: '', error: String(err) })
    }

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })

    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      resolve({ stdout, error: 'Timeout' })
    }, timeoutMs)

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0 && stderr) {
        resolve({ stdout, error: stderr.slice(0, 500) })
      } else {
        resolve({ stdout })
      }
    })

    if (stdin) {
      proc.stdin?.write(stdin)
    }
    proc.stdin?.end()
  })
}

async function runNodeCode(code: string, stdin: string | null, timeoutMs: number): Promise<{ stdout: string; error?: string }> {
  return new Promise((resolve) => {
    let proc: ReturnType<typeof spawn>
    try {
      proc = spawn('node', ['--input-type=module', '-e', code], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (e) {
      // fallback to CommonJS
      try {
        proc = spawn('node', ['-e', code], { stdio: ['pipe', 'pipe', 'pipe'] })
      } catch (err) {
        return resolve({ stdout: '', error: String(err) })
      }
    }

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })

    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      resolve({ stdout, error: 'Timeout' })
    }, timeoutMs)

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0 && stderr) {
        resolve({ stdout, error: stderr.slice(0, 500) })
      } else {
        resolve({ stdout })
      }
    })

    if (stdin) proc.stdin?.write(stdin)
    proc.stdin?.end()
  })
}

export async function runTaskCode(
  code: string,
  language: Language,
  testCases: TestCase[],
): Promise<TaskRunResult> {
  const results: TestCaseResult[] = []
  let firstError: string | undefined

  for (const tc of testCases) {
    let result: { stdout: string; error?: string }

    if (language === 'PYTHON') {
      result = await runPythonCode(code, tc.input, TIMEOUT_MS)
    } else if (language === 'JAVASCRIPT') {
      result = await runNodeCode(code, tc.input, TIMEOUT_MS)
    } else {
      // Java and C++ task running via docker — for now return a placeholder
      result = { stdout: '', error: `Task runner for ${language} not yet implemented` }
    }

    if (result.error && !firstError) firstError = result.error

    const actual = normalise(result.stdout)
    const expected = normalise(tc.expected_output)
    results.push({
      input: tc.input,
      expected,
      actual,
      passed: actual === expected && !result.error,
    })
  }

  const passed = results.every((r) => r.passed)
  return { passed, results, error: firstError }
}
