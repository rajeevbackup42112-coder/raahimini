import AdminPrimaryNav from './components/AdminPrimaryNav';
import AdminDashboardOverview from './components/AdminDashboardOverview';
import AdminRouteHealthOverview from './components/AdminRouteHealthOverview';
import AdminSupportInbox from './components/AdminSupportInbox';
import AdminDashboardSecondary from './components/AdminDashboardSecondary';

export default function AdminPanelPage() {
  return (
    <div className="min-h-screen bg-background pb-8">
      <AdminPrimaryNav active="dashboard" />
      <AdminDashboardOverview />
      <AdminRouteHealthOverview />
      <AdminSupportInbox />
      <AdminDashboardSecondary />
    </div>
  );
}
