import AppLayout from '@/components/AppLayout';
import DriverVerificationContent from './DriverVerificationContent';

export default function DriverVerificationPage(){
  return <AppLayout showBottomNav={false} headerTitle="Driver verification" headerBack><DriverVerificationContent/></AppLayout>;
}
