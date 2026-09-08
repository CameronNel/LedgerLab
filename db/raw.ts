import { env } from 'cloudflare:workers';
export function getDatabase(){if(!env.DB)throw new Error('Workspace storage is temporarily unavailable.');return env.DB;}
