import { mentorRequestSchema } from '@/shared/hackathonApi';
import { HACKATHON_RATES, hackathonPost } from '@/server/hackathon/http';
import { buyMentorLevel } from '@/server/hackathon/manage';

export const dynamic = 'force-dynamic';

export const POST = hackathonPost(mentorRequestSchema, HACKATHON_RATES.manage, buyMentorLevel);
