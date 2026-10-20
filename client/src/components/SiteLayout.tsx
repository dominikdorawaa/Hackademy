import { Outlet } from 'react-router-dom';
import GuidedTour from './tour/GuidedTour';
import Navbar from './Navbar';
import RealtimeGameNavigation from './RealtimeGameNavigation';
import RealtimeNotifications from './RealtimeNotifications';
import Footer from './Footer';
import RoomChromeProvider from './room/RoomChromeProvider';
import { useRoomChrome } from './room/roomChrome';

function SiteShell() {
  const roomMode = Boolean(useRoomChrome()?.active);
  return (
    <div className={roomMode ? 'site-shell--room flex flex-col' : 'flex flex-col min-h-screen'}>
      <RealtimeGameNavigation />
      <RealtimeNotifications />
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
      <GuidedTour />
      {!roomMode && <Footer />}
    </div>
  );
}

export default function SiteLayout() {
  return (
    <RoomChromeProvider>
      <SiteShell />
    </RoomChromeProvider>
  );
}
