import AdminPrimaryNav from '../components/AdminPrimaryNav';
import AdminOutstationMarketplace from './AdminOutstationMarketplace';

export default function AdminOutstationPage(){
  return <div className="min-h-screen bg-background pb-8"><AdminPrimaryNav active="operations"/><AdminOutstationMarketplace/></div>;
}
