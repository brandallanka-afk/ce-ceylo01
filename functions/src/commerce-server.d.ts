declare module './commerce-server.mjs' {
  import type {Express} from 'express';
  export function createApp(): Express;
}
