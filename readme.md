# picospawn

Minimalist `spawn` replacement with a focus on simplicity and ease of use.

```
pnpm add picospawn
```

## Usage

### Asynchronous (`spawn`)

```ts
import $ from 'picospawn'

const proc = $('ls -l /', {
  // These are the default options.
  cwd: process.cwd(),
  env: process.env,
  stdio: 'pipe',
  reject: true,
  json: false,
  // …and any other `spawn` option.
})
proc.stdout // ReadableStream | null
proc.stderr // ReadableStream | null

const result = await proc
result.stdout // string
result.stderr // string
```

### Synchronous (`spawnSync`)

The `spawnSync` function is purpose-built for replacing Shell scripts with Node.js by providing a simple way to block on a child process, exit if it fails, and return its output as a string.

I recommend importing it like this: `{ spawnSync as $ }`

```ts
import { spawnSync as $ } from 'picospawn'

// By default, spawnSync exits the parent process if the child fails.
// Stdout is returned directly.
const stdout = $('echo "hello world"')
console.log(stdout) // Output: hello world

// To prevent exiting on failure and get the full result object:
const result = $('exit 1', { exit: false })
console.log(result.status) // Output: 1
```

## Features

- Pass a single string or an array of arguments to the command.
- Asynchronous `spawn`: Returns a promise that resolves to a `PicospawnResult` object, which also behaves like the underlying `ChildProcess`.
- Synchronous `spawnSync`: Blocks until the process completes, ideal for scripting. Exits the parent process on error by default.
- Parse the stdout as JSON with `json: true` or `$.json()`.
- Throw an error if the command exits with a non-zero code (async only). Opt-out with `reject: false`.
- Set default options with `$.extend()`.
- Excellent TypeScript support.
- ESM and CommonJS compatible.
- …and more!

## Prior Art

- [tinyspawn](https://github.com/microlinkhq/tinyspawn)
