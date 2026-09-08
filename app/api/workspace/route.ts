import { headers } from 'next/headers';
import { getDatabase } from '@/db/raw';
import { createWorkspaceHandlers } from '@/lib/workspace/service';

export const dynamic = 'force-dynamic';
const handlers = createWorkspaceHandlers({
  owner: async () => (await headers()).get('oai-authenticated-user-id'),
  database: getDatabase,
  onError: (message, cause) => console.error(message, cause),
});
export async function GET() { return handlers.GET(); }
export async function POST(request: Request) { return handlers.POST(request); }
