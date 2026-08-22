import AppLayout from '@/components/AppLayout';
import DriverRouteSelectionContent from './components/DriverRouteSelectionContent';
import DriverDailySummary from './components/DriverDailySummary';

export default function DriverRouteSelectionPage() {
  return (
    <AppLayout showBottomNav={false}>
      <DriverDailySummary />
      <DriverRouteSelectionContent />
    </AppLayout>
  );
}
