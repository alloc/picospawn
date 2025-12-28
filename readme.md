# picospawn

Minimalist `spawn` and `spawnSync` replacements with a focus on simplicity and ease of use.

- ESM and CommonJS compatible.
- Excellent TypeScript support.
- …and a list of [features](#features) below.

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

The `spawnSync` function is purpose-built for replacing Shell scripts with Node.js by providing a simple way to block on a child process and exit with the same signal or non-zero status code as the child process.

Notably, `spawnSync` defaults to using `stdio: "inherit"` and `encoding: "utf-8"`. You can override these by passing an options object.

I recommend importing it like this: `{ spawnSync as $ }`

```ts
import { spawnSync as $ } from 'picospawn'

// By default, spawnSync exits the parent process if the child fails.
// Stdout is returned directly.
const stdout = $('echo', ['hello world'], { stdio: 'pipe' })
console.log(stdout) // Output: hello world

// To prevent exiting on failure and get the full result object:
const result = $('exit 1', { exit: false })
console.log(result.status) // Output: 1

// Parse stdout as JSON.
type Result = { foo: 'bar' }
const data = $.json<Result>(`echo {"foo": "bar"}`)
console.log(data.foo) // Output: bar
```

When using `spawnSync`, it can sometimes be difficult to determine which command failed. If you set `PICOSPAWN_TRACE=1` in your environment, the stack trace will be printed to the console.

## Features

#### The argument array is optional.

You can pass a single string or an array of arguments to the command.

```ts
import $ from 'picospawn'

const proc = $('echo "hello world"')
```

You can even use `%s` placeholders if only one or a few arguments need to be interpolated. This is especially useful for arguments that could contain spaces or special characters.

```ts
import $ from 'picospawn'

await $('echo %s baz', ['foo bar'], { stdio: 'inherit' })
// Output: foo bar baz
```

Note that placeholders are unnecessary at the end of the command string.

Any extra arguments are included at the end of the command. In other words, you can specify arguments within the command string _and_ pass an array of extra arguments too.

#### Await the result or process the output stream.

You can either wait for the child process to exit and get the result, or process the output stream as it's received.

```ts
import $ from 'picospawn'

// Process the output stream as it's received.
const proc = $('ls -l /')
proc.stdout?.on('data', chunk => console.log(chunk))

// Wait for the child process to exit and get the result.
const result = await proc
result.stdout // string
result.stderr // string
```

#### Parse the stdout as JSON.

You can parse the stdout as JSON by setting `json: true` or by calling `$.json()`.

```ts
import $ from 'picospawn'

type Result = { foo: 'bar' }

const { stdout } = await $<Result>(`echo '{"foo": "bar"}'`, {
  json: true,
})

console.log(stdout.foo) // Output: bar

// Alternative syntax.
const { stdout } = await $.json<Result>(`echo '{"foo": "bar"}'`)

console.log(stdout.foo) // Output: bar
```

For synchronous usage, `spawnSync.json()` (or `$.json()` when aliasing `spawnSync`) returns the parsed value.

#### Create specialized spawn functions.

You can create specialized spawn functions with `createSpawn()`.

```ts
import { createSpawn } from 'picospawn'

const $ = createSpawn({
  cwd: '/tmp',
  env: { ...process.env, FOO: 'bar' },
  shell: true,
})

const { stdout } = await $('echo $PWD $FOO')
console.log(stdout) // Output: /tmp bar
```

#### Prevent rejection on error.

By default, `spawn` will reject its promise if the command exits unexpectedly. You can opt-out by setting `reject: false`.

```ts
import $ from 'picospawn'

const proc = $('exit 1', { reject: false })
proc.on('exit', code => {
  console.log(code) // Output: 1
})

const { exitCode } = await proc
console.log(exitCode) // Output: 1
```

#### Argument arrays can be nested.

Especially useful for conditional arguments, since you can do `condition && ['foo', 'bar']` where the arguments won't be used if the condition is false.

```ts
import $ from 'picospawn'

const { stdout } = await $('echo %s baz', ['foo bar', ['qux']])
console.log(stdout) // Output: foo bar baz qux
```

#### Transform stdio streams.

You can pass functions in the `stdio` array to transform the data as it streams.

```ts
import $ from 'picospawn'

async function* addPrefix(stream) {
  for await (const chunk of stream) {
    yield '>> ' + chunk
  }
}

// Pipe stdout through the addPrefix transformer.
await $('echo hello world', {
  stdio: ['inherit', addPrefix, 'inherit'],
})
// Output: >> hello world
```

## Prior Art

- [tinyspawn](https://github.com/microlinkhq/tinyspawn)
