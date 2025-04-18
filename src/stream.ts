import { Writable } from 'node:stream'

export function createAsyncGeneratorStream(
  init: (chunk: unknown) => AsyncGenerator<unknown, void, void>,
  sink: Writable
): Writable {
  let generator: AsyncGenerator<unknown, void, void> | undefined

  return new Writable({
    async write(chunk, encoding, callback) {
      try {
        const data = chunk.toString('utf8')
        const result = await (generator ??= init(data)).next(data)
        if (!result.done && result.value !== undefined) {
          sink.write(result.value)
        }
        callback()
      } catch (error: any) {
        callback(error)
      }
    },
    async final(callback) {
      try {
        await generator?.return()
        callback()
      } catch (error: any) {
        callback(error)
      }
    },
  })
}
