import React from 'react';
import AdminPanelContent from './components/AdminPanelContent';
import AdminQuickActions from './components/AdminQuickActions';

export default function AdminPanelPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminQuickActions />
      <AdminPanelContent />
    </div>
  );
}
