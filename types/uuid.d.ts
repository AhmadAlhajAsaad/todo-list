declare module 'uuid' {
  export function v4(): string;
  export function v1(): string;
  export function v5(namespace: string | Uint8Array, name: string): string;
  export function v3(namespace: string | Uint8Array, name: string): string;
}
