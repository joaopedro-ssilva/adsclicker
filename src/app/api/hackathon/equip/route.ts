import { equipRequestSchema } from '@/shared/hackathonApi';
import { HACKATHON_RATES, hackathonPost } from '@/server/hackathon/http';
import { equipItem } from '@/server/hackathon/manage';

export const dynamic = 'force-dynamic';

export const POST = hackathonPost(equipRequestSchema, HACKATHON_RATES.manage, equipItem);
