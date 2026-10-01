import type { Metadata } from 'next';
import { AdminPanel } from './AdminPanel';

export const metadata: Metadata = {
  title: 'ADSClicker · Admin',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminPanel />;
}
