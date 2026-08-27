import AdminPrimaryNav from '../components/AdminPrimaryNav';
import AdminUsersDirectory from '../components/AdminUsersDirectory';

export default function AdminUsersPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminPrimaryNav active="users" />
      <AdminUsersDirectory />
    </div>
  );
}
