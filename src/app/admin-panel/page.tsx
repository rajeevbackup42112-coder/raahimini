import React from 'react';
import AdminPanelContent from './components/AdminPanelContent';

// Admin panel uses its own minimal layout (no bottom nav)
export default function AdminPanelPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminPanelContent />
    </div>
  );
}