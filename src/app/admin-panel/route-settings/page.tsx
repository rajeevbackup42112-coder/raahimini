'use client';

import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AdminPrimaryNav from '../components/AdminPrimaryNav';
import RouteManagementContent from '../components/RouteManagementContent';

export default function RouteSettingsPage() {
  const { profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (profile?.role !== 'admin') return <div className="min-h-screen flex items-center justify-center gap-2"><ShieldAlert size={18}/>Admin access required.</div>;
  return <div className="min-h-screen bg-background"><AdminPrimaryNav active="routes"/><RouteManagementContent/></div>;
}
