import { runStartRequestSchema } from '@/shared/hackathonApi';
import { HACKATHON_RATES, hackathonPost } from '@/server/hackathon/http';
import { startRun } from '@/server/hackathon/run';

export const dynamic = 'force-dynamic';

export const POST = hackathonPost(runStartRequestSchema, HACKATHON_RATES.runStart, startRun);
