// Metro selects .native.ts or .web.ts. This export supplies TypeScript's default resolution.
export { createLiveTransport } from './live-transport.native';
export type { ConnectionState, LiveTransport, LiveCallbacks, LiveConnectOptions } from './live-transport-core';
