import { skillsRequestSchema } from '@/shared/hackathonApi';
import { HACKATHON_RATES, hackathonPost } from '@/server/hackathon/http';
import { manageSkills } from '@/server/hackathon/manage';

export const dynamic = 'force-dynamic';

export const POST = hackathonPost(skillsRequestSchema, HACKATHON_RATES.manage, manageSkills);
