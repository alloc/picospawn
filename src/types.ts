import {
  ChildProcess,
  SpawnOptions,
  SpawnSyncReturns,
} from 'node:child_process'

export interface ChildProcessError extends Error {
  name: 'ChildProcessError'
  proc: ChildProcess
}

export type PicospawnArgs = readonly (
  | string
  | false
  | null
  | undefined
  | PicospawnArgs
)[]

export interface PicospawnOptions extends SpawnOptions {
  /**
   * Set this to `true` to parse the stdout as JSON.
   */
  json?: boolean
  /**
   * Set this to `false` to prevent the promise from rejecting when the child
   * process exits unexpectedly. Instead, the `TinyspawnResult` will have an
   * `error` property.
   *
   * @default true
   */
  reject?: boolean
}

export interface PicospawnSyncOptions extends SpawnOptions {
  /**
   * Control the encoding of the stdout and stderr. Set to `null` or `"buffer"`
   * to return a Buffer.
   *
   * @default 'utf-8'
   */
  encoding?: BufferEncoding | 'buffer' | null
  /**
   * Set this to `false` to prevent the current process from exiting when the
   * child process exits unexpectedly.
   *
   * @default true
   */
  exit?: boolean
  /**
   * Set this to `false` to prevent the stdout from being trimmed. This option
   * does nothing if stdout is a Buffer.
   *
   * @default true
   */
  trimEnd?: boolean
}

export type PicospawnSyncResult<Options extends PicospawnSyncOptions> = (
  Options['encoding'] extends 'buffer' | null ? Buffer : string
) extends infer TStdout
  ? Options['exit'] extends false
    ? SpawnSyncReturns<TStdout>
    : TStdout
  : never

export interface PicospawnResult<Stdout = string>
  extends Omit<ChildProcess, 'stdout' | 'stderr'> {
  stdout: Stdout
  stderr: string
  /**
   * Only exists if `reject` was false and the child process exited with a
   * non-zero code.
   */
  error?: ChildProcessError
}

export interface PicospawnPromise<Stdout = string>
  extends Promise<PicospawnResult<Stdout>>,
    ChildProcess {}

export type Picospawn<StdoutDefault> = [StdoutDefault] extends [string]
  ? {
      (
        input: string,
        args?: (string | false | null | undefined)[],
        options?: PicospawnOptions & { json?: false | undefined }
      ): PicospawnPromise<string>

      (
        input: string,
        options?: PicospawnOptions & { json?: false | undefined }
      ): PicospawnPromise<string>

      <Stdout = unknown>(
        input: string,
        args: (string | false | null | undefined)[] | undefined,
        options: PicospawnOptions & { json: boolean }
      ): PicospawnPromise<Stdout>

      <Stdout = unknown>(
        input: string,
        options: PicospawnOptions & { json: boolean }
      ): PicospawnPromise<Stdout>
    }
  : {
      (
        input: string,
        args: (string | false | null | undefined)[] | undefined,
        options: PicospawnOptions & { json: false }
      ): PicospawnPromise<string>

      (
        input: string,
        options: PicospawnOptions & { json: false }
      ): PicospawnPromise<string>

      <Stdout = StdoutDefault>(
        input: string,
        args?: (string | false | null | undefined)[] | PicospawnOptions,
        options?: PicospawnOptions
      ): PicospawnPromise<Stdout>
    }
