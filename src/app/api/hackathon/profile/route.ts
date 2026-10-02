import { createProfileRequestSchema } from '@/shared/hackathonApi';
import { HACKATHON_RATES, hackathonGet, hackathonPost } from '@/server/hackathon/http';
import { getProfile, saveProfile } from '@/server/hackathon/profile';

export const dynamic = 'force-dynamic';

export const GET = hackathonGet(HACKATHON_RATES.read, getProfile);
export const POST = hackathonPost(createProfileRequestSchema, HACKATHON_RATES.manage, saveProfile);
