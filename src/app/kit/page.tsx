import type { Metadata } from 'next';
import { KitShowcase } from './KitShowcase';

export const metadata: Metadata = {
  title: 'Laboratório de interface · ADSClicker',
  description: 'Todas as peças do design system do ADSClicker, em todos os estados.',
};

export default function KitPage() {
  return <KitShowcase />;
}
