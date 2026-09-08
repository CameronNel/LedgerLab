import {requireChatGPTUser} from './chatgpt-auth';
import {WorkspaceApp} from '@/components/ledgerlab/app';
export const dynamic='force-dynamic';
export default async function Home(){const user=await requireChatGPTUser('/');return <WorkspaceApp displayName={user.fullName??'Accountant'}/>;}
