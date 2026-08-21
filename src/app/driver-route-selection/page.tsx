import AppLayout from '@/components/AppLayout';
import DriverRouteSelectionContent from './components/DriverRouteSelectionContent';

export default function DriverRouteSelectionPage() {
  return (
    <AppLayout showBottomNav={false}>
      <DriverRouteSelectionContent />
    </AppLayout>
  );
}
