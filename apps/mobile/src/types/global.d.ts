declare global {
  // eslint-disable-next-line no-var
  var apiToken: string | null;
}

declare module globalThis {
  // eslint-disable-next-line no-var
  var apiToken: string | null;
}

export { };
