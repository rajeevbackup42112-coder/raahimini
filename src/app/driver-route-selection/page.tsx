import AppLayout from '@/components/AppLayout';
import DriverRoleGate from '@/components/DriverRoleGate';
import DriverRouteSelectionContent from './components/DriverRouteSelectionContent';
import DriverDailySummary from './components/DriverDailySummary';

export default function DriverRouteSelectionPage() {
  return (
    <AppLayout showBottomNav={false}>
      <DriverRoleGate>
        <DriverRouteSelectionContent />
        <DriverDailySummary />
      </DriverRoleGate>
    </AppLayout>
  );
}
