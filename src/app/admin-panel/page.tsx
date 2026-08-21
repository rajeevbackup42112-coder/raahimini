import React from 'react';
import AdminPanelContent from './components/AdminPanelContent';
import AdminQuickActions from './components/AdminQuickActions';
import AdminEntryLink from './components/AdminEntryLink';
import AdminDemandOverview from './components/AdminDemandOverview';

export default function AdminPanelPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminEntryLink />
      <AdminQuickActions />
      <AdminDemandOverview />
      <AdminPanelContent />
    </div>
  );
}
