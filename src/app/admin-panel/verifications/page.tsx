import AdminPrimaryNav from '../components/AdminPrimaryNav';
import AdminDriverVerificationReview from './AdminDriverVerificationReview';

export default function AdminDriverVerificationsPage(){
  return <div className="min-h-screen bg-background">
    <AdminPrimaryNav active="users" />
    <AdminDriverVerificationReview />
  </div>;
}
