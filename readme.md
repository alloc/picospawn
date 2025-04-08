# picospawn

Minimalist `spawn` replacement with a focus on simplicity and ease of use.

```
pnpm add picospawn
```

## Usage

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

### Features

- Pass a single string or an array of arguments to the command.
- Return a promise that resolves to a `ChildProcess` object.
- Parse the stdout as JSON with `json: true` or `$.json()`.
- Throw an error if the command exits with a non-zero code. Opt-out with `reject: false`.
- Set default options with `$.extend()`.
- Excellent TypeScript support.
- ESM and CommonJS compatible.
- …and more!

## Prior Art

- [tinyspawn](https://github.com/microlinkhq/tinyspawn)
