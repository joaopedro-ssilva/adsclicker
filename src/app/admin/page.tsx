import type { Metadata } from 'next';
import { AdminPanel } from './AdminPanel';
import { isAdmin } from './auth';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'ADSClicker · Admin',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  return (await isAdmin()) ? <AdminPanel /> : <LoginForm />;
}
