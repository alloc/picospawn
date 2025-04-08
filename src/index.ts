import { ChildProcess, spawn } from 'node:child_process'
import { EOL } from 'node:os'
import {
  ChildProcessError,
  Tinyspawn,
  TinyspawnOptions,
  TinyspawnPromise,
} from './types'

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
  message += `  \`${proc.spawnfile} ${proc.spawnargs.join(' ')}\`${EOL}${EOL}`
  message += `exited with:${EOL}${EOL}`
  message += `  \`{ signal: '${proc.signalCode}', code: ${proc.exitCode} }\` ${EOL}${EOL}`
  message += `with the following trace:${EOL}`

  error.name = 'ChildProcessError'
  error.message = message
  error.proc = proc

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

type Args = (string | false | null | undefined)[]

const extend =
  (defaultOptions?: TinyspawnOptions) =>
  (
    input: string,
    args?: Args | TinyspawnOptions,
    options?: TinyspawnOptions
  ) => {
    if (!Array.isArray(args)) {
      options = args as TinyspawnOptions
      args = undefined
    }
    if (defaultOptions) {
      options = {
        ...defaultOptions,
        ...options,
      }
    }

    const [command, ...filteredArgs] = (input.split(' ') as Args)
      .concat((args as Args) || [])
      .filter(Boolean) as string[]

    let proc: ChildProcess & { error?: Error }

    const trace = new Error()
    const promise = new Promise<ChildProcess>((resolve, reject) => {
      proc = spawn(command, filteredArgs, options ?? {})

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
    }) as TinyspawnPromise
  }

const $: any = extend()
$.extend = extend
$.json = $.extend({ json: true })

export default $ as Tinyspawn<string> & {
  extend(
    defaults?: TinyspawnOptions & { json?: false | undefined }
  ): Tinyspawn<string>
  extend(defaults: TinyspawnOptions & { json: boolean }): Tinyspawn<unknown>
  json: Tinyspawn<unknown>
}

export type * from './types'
