import { runFinishRequestSchema } from '@/shared/hackathonApi';
import { FINISH_BODY_BYTES, HACKATHON_RATES, hackathonPost } from '@/server/hackathon/http';
import { finishRun } from '@/server/hackathon/run';

export const dynamic = 'force-dynamic';

export const POST = hackathonPost(runFinishRequestSchema, HACKATHON_RATES.runFinish, finishRun, FINISH_BODY_BYTES);
