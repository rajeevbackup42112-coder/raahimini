import React from 'react';
import AdminPanelContent from './components/AdminPanelContent';
import AdminQuickActions from './components/AdminQuickActions';
import AdminEntryLink from './components/AdminEntryLink';

export default function AdminPanelPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminEntryLink />
      <AdminQuickActions />
      <AdminPanelContent />
    </div>
  );
}
