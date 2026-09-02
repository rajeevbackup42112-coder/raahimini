import type { Metadata } from 'next';
import DemoExperience from './DemoExperience';

export const metadata: Metadata = {
  title: 'Raahi Demo — Scenario simulator',
  description: 'A simulated Raahi marketplace walkthrough for Passenger, Driver and Admin scenarios. No real rides or verification records are created.',
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

export default function DemoPage() {
  return <DemoExperience />;
}
