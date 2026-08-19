'use client';
import Link from 'next/link';
import { ShieldCheck, UserPlus, SlidersHorizontal, Route, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminQuickActions(){
  const { profile } = useAuth();
  if(profile?.role!=='admin') return null;
  return <div className="max-w-screen-2xl mx-auto px-4 pt-4 flex flex-wrap gap-2">
    <Link href="/admin-driver-onboarding" className="btn-primary inline-flex"><UserPlus size={16}/>Onboard Driver</Link>
    <Link href="/admin-panel/support" className="btn-outline inline-flex"><MessageCircle size={16}/>Support Inbox</Link>
    <Link href="/admin-panel/admins" className="btn-outline inline-flex"><ShieldCheck size={16}/>Manage Admins</Link>
    <Link href="/admin-panel/operations" className="btn-outline inline-flex"><SlidersHorizontal size={16}/>Safe Operations</Link>
    <Link href="/admin-panel/route-settings" className="btn-outline inline-flex"><Route size={16}/>Route Settings</Link>
  </div>;
}
