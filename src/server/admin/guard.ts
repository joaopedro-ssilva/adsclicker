import { isAdmin } from '@/app/admin/auth';
import { ApiFailure } from '../http/errors';

/** Every /api/admin/** call checks the /admin login (cookie `adsclicker_admin`) first, before touching anything else. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new ApiFailure('unauthorized', 'Faça login no painel de administração.');
}
