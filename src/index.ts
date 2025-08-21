import {
  ChildProcess,
  spawn as nodeSpawn,
  spawnSync as nodeSpawnSync,
  StdioOptions,
} from 'node:child_process'
import { EOL } from 'node:os'
import { Writable } from 'node:stream'
import { createAsyncGeneratorStream } from './stream'
import {
  ChildProcessError,
  Picospawn,
  PicospawnArgs,
  PicospawnOptions,
  PicospawnPromise,
  PicospawnSyncOptions,
  PicospawnSyncResult,
} from './types'

const isArray = Array.isArray as (value: unknown) => value is readonly unknown[]

// The function responsible for processing the spawn arguments before passing
// them to the native spawn function.
function run<TOptions, TResult>(
  spawn: (command: string, args: string[], options: TOptions) => TResult,
  command: string,
  args?: PicospawnArgs | TOptions,
  options?: TOptions,
  defaultOptions?: TOptions
): TResult {
  let stringArgs: string[] | undefined
  if (args) {
    if (isArray(args)) {
      stringArgs = args.flat(10).filter(Boolean) as string[]
    } else {
      options = args
    }
  }
  if (command.includes(' ')) {
    const args = command.split(' ')
    for (let i: number; (i = args.indexOf('%s')) >= 0; ) {
      args[i] = stringArgs?.shift() ?? ''
    }
    command = args.shift()!
    stringArgs = stringArgs ? [...args, ...stringArgs] : args
  }
  return spawn(command, stringArgs ?? [], {
    ...defaultOptions,
    ...options,
  } as TOptions)
}

function streamToString(stream: NodeJS.ReadableStream | null) {
  const chunks: Buffer[] = []
  stream?.on('data', chunk => chunks.push(chunk))
  return () => Buffer.concat(chunks).toString().trim()
}

function decorateError(
  error: ChildProcessError,
  proc: ChildProcess
): ChildProcessError {
  let message = `The command spawned as:${EOL}${EOL}`
  message += `  ${proc.spawnargs.join(' ')}${EOL}${EOL}`
  message += `exited with:${EOL}${EOL}`
  message += `  signal=${JSON.stringify(proc.signalCode)} code=${proc.exitCode}${EOL}${EOL}`
  message += `with the following trace:${EOL}`

  error.name = 'ChildProcessError'
  error.message = message
  Object.defineProperty(error, 'proc', {
    enumerable: true,
    value: proc,
  })

  return error
}

const defineOutputProperty = (
  obj: any,
  name: string,
  read: () => string,
  options?: { json?: boolean }
) =>
  Object.defineProperty(obj, name, {
    enumerable: true,
    get: () => (options?.json ? JSON.parse(read()) : read()),
  })

// MIT – https://github.com/xxorax/node-shell-escape/blob/ebdb90e58050d74dbda9b8177f7de11cbb355d94/shell-escape.js
function shellEscape(args: string[]) {
  const escaped: string[] = []

  args.forEach(arg => {
    if (/[^A-Za-z0-9_\/:=-]/.test(arg)) {
      arg = "'" + arg.replace(/'/g, "'\\''") + "'"

      // unduplicate single-quote at the beginning
      arg = arg.replace(/^(?:'')+/g, '')

      // remove non-escaped single-quote if there are enclosed between 2 escaped
      arg = arg.replace(/\\'''/g, "\\'")
    }
    escaped.push(arg)
  })

  return escaped.join(' ')
}

// Handle custom options for stdio.
function wrappedNodeSpawn(
  command: string,
  args: string[],
  options: PicospawnOptions
) {
  let streams: Writable[] | undefined
  let stdio: StdioOptions | undefined
  if (isArray(options.stdio)) {
    stdio = options.stdio.map((option, index) => {
      if (typeof option === 'function') {
        streams ||= []
        streams[index] = createAsyncGeneratorStream(
          option,
          [process.stdin, process.stdout, process.stderr][index]
        )
        return 'pipe'
      }
      return option
    })
  } else {
    stdio = options.stdio
  }

  // Avoid DEP0190 warning from Node.js
  if (options.shell && args.length) {
    command = `${command} ${shellEscape(args)}`
    args = []
  }

  const proc = args.length
    ? nodeSpawn(command, args, { ...options, stdio })
    : nodeSpawn(command, { ...options, stdio })

  streams?.forEach((stream, index) => {
    proc.stdio[index]!.pipe(stream)
  })

  return proc
}

export const createSpawn: {
  (
    defaults?: PicospawnOptions & { json?: false | undefined }
  ): Picospawn<string>
  (defaults: PicospawnOptions & { json: boolean }): Picospawn<unknown>
} =
  (defaultOptions?: PicospawnOptions) =>
  (
    command: string,
    args?: PicospawnArgs | PicospawnOptions,
    options?: PicospawnOptions
  ) => {
    const proc = run(
      wrappedNodeSpawn,
      command,
      args,
      options,
      defaultOptions
    ) as ChildProcess & {
      error?: Error
    }

    const trace = new Error()
    const promise = new Promise<ChildProcess>((resolve, reject) => {
      const stdout = streamToString(proc.stdout)
      const stderr = streamToString(proc.stderr)

      proc.on('error', reject)
      proc.on('exit', (exitCode: number | null) => {
        defineOutputProperty(proc, 'stdout', stdout, options)
        defineOutputProperty(proc, 'stderr', stderr)

        if (exitCode !== 0) {
          const error = decorateError(trace as ChildProcessError, proc)
          if (options?.reject !== false) {
            proc.error = error
            return reject(error)
          }
        }
        return resolve(proc)
      })
    })

    return new Proxy(promise, {
      get(target: any, prop: string | symbol) {
        const resolve = (obj: any, prop: string | symbol, value = obj[prop]) =>
          typeof value === 'function' ? value.bind(obj) : value

        const value = resolve(proc, prop)
        return value !== undefined ? value : resolve(target, prop)
      },
    }) as PicospawnPromise
  }

const spawn = createSpawn() as Picospawn<string> & {
  json: Picospawn<unknown>
}

spawn.json = createSpawn({ json: true })

export type * from './types'

export default spawn

type SyncDefaults = {
  encoding: 'utf-8'
  stdio: 'inherit'
}

function wrappedNodeSpawnSync(
  command: string,
  args: string[],
  options: PicospawnSyncOptions
) {
  // Avoid DEP0190 warning from Node.js
  if (options.shell && args.length) {
    command = `${command} ${shellEscape(args)}`
    args = []
  }

  return args.length
    ? nodeSpawnSync(command, args, options)
    : nodeSpawnSync(command, options)
}

/**
 * The `spawnSync` function is purpose-built for replacing Shell scripts with
 * Node.js by providing a simple way to block on a child process and exit with
 * the same signal or non-zero status code as the child process.
 *
 * Its call signature is identical to picospawn's `spawn` functions.
 *
 * I recommend importing it like this: `{ spawnSync as $ }`
 *
 * ### Options
 *
 * Pass `stdio: "pipe"` to get the stdout and stderr as strings. Pass `encoding:
 * null` to get a Buffer.
 *
 * Pass `exit: false` to prevent the current process from exiting when the child
 * process fails. This also changes the return type to a `SpawnSyncReturns`
 * object.
 *
 * Pass `trimEnd: false` to prevent the stdout from being trimmed. This option
 * does nothing if stdout is a Buffer.
 */
export function spawnSync<Options extends PicospawnSyncOptions = SyncDefaults>(
  command: string,
  options?: Options & PicospawnSyncOptions
): PicospawnSyncResult<Options>

export function spawnSync<Options extends PicospawnSyncOptions = SyncDefaults>(
  command: string,
  args?: PicospawnArgs,
  options?: Options & PicospawnSyncOptions
): PicospawnSyncResult<Options>

export function spawnSync(
  command: string,
  args?: PicospawnArgs | PicospawnSyncOptions,
  options?: PicospawnSyncOptions
): PicospawnSyncResult<PicospawnSyncOptions> {
  const result = run(wrappedNodeSpawnSync, command, args, options, {
    stdio: 'inherit',
    encoding: 'utf-8',
  })
  if (!options && !isArray(args)) {
    options = args
  }
  if (options?.trimEnd !== false && typeof result.stdout === 'string') {
    result.stdout = result.stdout.trimEnd()
  }
  if (options?.exit !== false) {
    if (result.stderr?.length) {
      console.error(result.stderr.toString())
    }
    const code = result.signal ?? result.status
    if (code) {
      if (process.env.PICOSPAWN_TRACE) {
        console.trace()
      }
      process.exit(code)
    }
    return result.stdout
  }
  return result
}

if (typeof module !== 'undefined') {
  module.exports = spawn
  module.exports.default = spawn
  module.exports.spawnSync = spawnSync
  module.exports.createSpawn = createSpawn
}
