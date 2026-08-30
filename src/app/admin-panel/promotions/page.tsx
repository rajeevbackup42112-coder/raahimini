import AdminPrimaryNav from '../components/AdminPrimaryNav';
import AdminLocalPromotions from './AdminLocalPromotions';

export default function AdminPromotionsPage(){
  return <div className="min-h-screen bg-background pb-8"><AdminPrimaryNav active="operations"/><AdminLocalPromotions/></div>;
}
