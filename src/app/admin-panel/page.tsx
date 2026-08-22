import React from 'react';
import AdminPanelContent from './components/AdminPanelContent';
import AdminQuickActions from './components/AdminQuickActions';
import AdminEntryLink from './components/AdminEntryLink';
import AdminRouteHealthOverview from './components/AdminRouteHealthOverview';
import AdminSupportInbox from './components/AdminSupportInbox';

export default function AdminPanelPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminEntryLink />
      <AdminRouteHealthOverview />
      <AdminSupportInbox />
      <AdminQuickActions />
      <section className="mx-auto max-w-screen-2xl px-4 pt-6">
        <div className="mb-2">
          <p className="section-label">Detailed management</p>
          <p className="mt-1 text-xs text-muted-foreground">Open these views when you need route, driver, queue, trip or behaviour detail.</p>
        </div>
      </section>
      <AdminPanelContent />
    </div>
  );
}
