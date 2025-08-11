// Type definitions for Next.js cacheLife configs

declare module 'next/cache' {
  export { unstable_cache } from 'next/dist/server/web/spec-extension/unstable-cache'
  export {
    revalidateTag,
    revalidatePath,
  } from 'next/dist/server/web/spec-extension/revalidate'
  export { unstable_noStore } from 'next/dist/server/web/spec-extension/unstable-no-store'

  import type { CacheLife } from 'next/dist/server/use-cache/cache-life'

  export function unstable_cacheLife(profile: "default" | CacheLife): void

  export { cacheTag as unstable_cacheTag } from 'next/dist/server/use-cache/cache-tag'
}
