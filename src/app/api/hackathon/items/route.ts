import { itemsRequestSchema } from '@/shared/hackathonApi';
import { HACKATHON_RATES, hackathonPost } from '@/server/hackathon/http';
import { manageItems } from '@/server/hackathon/manage';

export const dynamic = 'force-dynamic';

export const POST = hackathonPost(itemsRequestSchema, HACKATHON_RATES.manage, manageItems);
