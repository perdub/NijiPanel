export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v1.0.0';
export const COMMIT_HASH = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : '0545f41';
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';

export function getShortCommit(hash: string = COMMIT_HASH): string {
  return hash ? hash.slice(0, 7) : 'unknown';
}

export function getCommitUrl(hash: string = COMMIT_HASH): string {
  return `https://github.com/perdub/NijiPanel/commit/${hash}`;
}
