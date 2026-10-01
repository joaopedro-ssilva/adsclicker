'use server';

import { redirect } from 'next/navigation';
import { adminConfigured, checkLogin, endSession, startSession } from './auth';

export interface LoginState {
  error: string | null;
}

/** Slows down guessing: every failed attempt costs this long. */
const FAILED_LOGIN_DELAY_MS = 800;

export async function login(_previous: LoginState, form: FormData): Promise<LoginState> {
  if (!adminConfigured()) {
    return { error: 'Admin não configurado: defina ADMIN_USER e ADMIN_PASSWORD no ambiente.' };
  }
  const user = String(form.get('user') ?? '');
  const password = String(form.get('password') ?? '');
  if (!checkLogin(user, password)) {
    await new Promise((resolve) => setTimeout(resolve, FAILED_LOGIN_DELAY_MS));
    return { error: 'Usuário ou senha incorretos.' };
  }
  await startSession();
  redirect('/admin');
}

export async function logout(): Promise<void> {
  await endSession();
  redirect('/admin');
}
