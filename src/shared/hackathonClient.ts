/** Typed calls to the Hackathon routes, for the browser. Like `api`, nothing here throws. */
import { call } from './apiClient';
import {
  profileOnlyResponseSchema,
  profileResponseSchema,
  runFinishResponseSchema,
  runStartResponseSchema,
} from './hackathonApi';
import type {
  CreateProfileRequest,
  EquipRequest,
  ItemsRequest,
  MentorRequest,
  RunFinishRequest,
  RunStartRequest,
  SkillsRequest,
} from './hackathonApi';

export const hackathonApi = {
  profile: () => call('GET', '/api/hackathon/profile', profileResponseSchema),
  createProfile: (body: CreateProfileRequest) => call('POST', '/api/hackathon/profile', profileOnlyResponseSchema, { body }),
  startRun: (body: RunStartRequest) => call('POST', '/api/hackathon/run/start', runStartResponseSchema, { body }),
  finishRun: (body: RunFinishRequest) => call('POST', '/api/hackathon/run/finish', runFinishResponseSchema, { body }),
  equip: (body: EquipRequest) => call('POST', '/api/hackathon/equip', profileOnlyResponseSchema, { body }),
  skills: (body: SkillsRequest) => call('POST', '/api/hackathon/skills', profileOnlyResponseSchema, { body }),
  mentor: (body: MentorRequest) => call('POST', '/api/hackathon/mentors', profileOnlyResponseSchema, { body }),
  items: (body: ItemsRequest) => call('POST', '/api/hackathon/items', profileOnlyResponseSchema, { body }),
};
