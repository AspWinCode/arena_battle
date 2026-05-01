import { createHash } from 'node:crypto'
import type { Strategy, Lang } from '@robocode/shared'
import { runJS } from './js-runner.js'
import { runPython } from './python-runner.js'
import { buildStrategy } from './build-strategy.js'

// ── Strategy cache (keyed by SHA-256 of lang:code) ─────────────────────────
const MAX_CACHE = 500
const strategyCache = new Map<string, Strategy>()

function cacheKey(code: string, lang: string): string {
  return createHash('sha256').update(`${lang}:${code}`).digest('hex')
}

function cacheGet(code: string, lang: string): Strategy | undefined {
  return strategyCache.get(cacheKey(code, lang))
}

function cachePut(code: string, lang: string, strategy: Strategy): void {
  if (strategyCache.size >= MAX_CACHE) {
    strategyCache.delete(strategyCache.keys().next().value!)
  }
  strategyCache.set(cacheKey(code, lang), strategy)
}

const IMAGES: Record<string, string> = {
  py:   process.env.SANDBOX_PYTHON_IMAGE ?? 'robocode/sandbox-python:latest',
  cpp:  process.env.SANDBOX_CPP_IMAGE    ?? 'robocode/sandbox-cpp:latest',
  java: process.env.SANDBOX_JAVA_IMAGE   ?? 'robocode/sandbox-java:latest',
}

const LIMITS = {
  memory:    32 * 1024 * 1024,
  cpuShares: 256,
  timeout:   5000,
}

const MAX_CODE_LENGTH = 5000

export async function runInSandbox(code: string, lang: Lang): Promise<Strategy> {
  if (code.length > MAX_CODE_LENGTH) {
    throw new Error('Code too long (max 5000 characters)')
  }

  const cached = cacheGet(code, lang)
  if (cached) {
    console.log(`[sandbox] cache hit ${lang} ${cacheKey(code, lang).slice(0, 8)}`)
    return cached
  }

  // Python strategies hold a live subprocess — cannot be shared across battles
  if (lang === 'py') {
    return runPython(code)
  }

  const strategy = lang === 'js' || lang === 'auto'
    ? await runJS(code)
    : await runDockerSandbox(code, lang)

  cachePut(code, lang, strategy)
  return strategy
}

async function runDockerSandbox(code: string, lang: string): Promise<Strategy> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let DockerConstructor: any
  try {
    const mod = await import('dockerode')
    DockerConstructor = mod.default ?? mod
  } catch {
    console.warn('[sandbox] dockerode not available, using fallback strategy')
    return buildStrategy([])
  }

  const docker = new DockerConstructor()

  const container = await docker.createContainer({
    Image: IMAGES[lang] ?? IMAGES['py'],
    AttachStdin:  true,
    AttachStdout: true,
    AttachStderr: true,
    OpenStdin:    true,
    StdinOnce:    true,
    NetworkDisabled: true,
    HostConfig: {
      Memory:         LIMITS.memory,
      CpuShares:      LIMITS.cpuShares,
      ReadonlyRootfs: true,
      CapDrop:        ['ALL'],
      SecurityOpt:    ['no-new-privileges:true'],
      PidsLimit:      50,
    },
  })

  const killTimer = setTimeout(async () => {
    await container.kill().catch(() => {})
  }, LIMITS.timeout)

  try {
    const stream = await container.attach({
      stream: true, stdin: true, stdout: true, stderr: true,
    })

    await container.start()
    stream.write(code)
    stream.end()

    const output = await readStream(stream)
    clearTimeout(killTimer)

    const lines = output.trim().split('\n')
    const result = JSON.parse(lines[lines.length - 1] ?? '{}') as {
      ok: boolean
      calls?: import('./build-strategy.js').ActionCall[]
      error?: string
    }

    if (!result.ok) throw new Error(result.error ?? 'Sandbox error')
    return buildStrategy(result.calls ?? [])
  } finally {
    clearTimeout(killTimer)
    await container.remove({ force: true }).catch(() => {})
  }
}

function readStream(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    stream.on('data', (chunk: Buffer) => { data += chunk.toString() })
    stream.on('end', () => resolve(data))
    stream.on('error', reject)
  })
}
