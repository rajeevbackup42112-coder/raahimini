import AppLayout from '@/components/AppLayout';
import DriverRoleGate from '@/components/DriverRoleGate';
import DriverOutstationContent from './DriverOutstationContent';

export default function DriverOutstationPage(){
  return <AppLayout showBottomNav={false} headerTitle="Outstation" headerBack><DriverRoleGate><DriverOutstationContent/></DriverRoleGate></AppLayout>;
}
