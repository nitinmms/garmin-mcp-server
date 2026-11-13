import type { FetchLike } from '../garmin/mcpClient';

/** The one place the app reaches the network. Tests replace this with a fake. */
export const appFetch: FetchLike = (url, init) => fetch(url, init);