import type { Metadata } from 'next';
import AppLayout from '@/components/AppLayout';
import DriveWithRaahiContent from './DriveWithRaahiContent';

export const metadata: Metadata = {
  title: 'Drive with Raahi',
  description: 'Join Raahi as a verified local Driver and choose the areas or Shared Ride corridors you want to serve.',
};

export default function DriveWithRaahiPage() {
  return <AppLayout showBottomNav={false}><DriveWithRaahiContent /></AppLayout>;
}
