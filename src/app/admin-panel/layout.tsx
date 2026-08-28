import type { ReactNode } from 'react';
import AdminRoleGate from '@/components/AdminRoleGate';

export default function AdminPanelLayout({ children }: { children: ReactNode }) {
  return <AdminRoleGate>{children}</AdminRoleGate>;
}
