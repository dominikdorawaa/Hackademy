import { Outlet, useLocation } from 'react-router-dom';
import GuidedTour from './tour/GuidedTour';
import Navbar from './Navbar';
import RealtimeGameNavigation from './RealtimeGameNavigation';
import RealtimeNotifications from './RealtimeNotifications';
import RateLimitNotice from './RateLimitNotice';
import Footer from './Footer';
import RoomChromeProvider from './room/RoomChromeProvider';
import { useRoomChrome } from './room/roomChrome';
import PageBackdrop from './PageBackdrop';
import { pageScene, sceneStyle } from '../lib/pageScenery';

function SiteShell() {
  const roomMode = Boolean(useRoomChrome()?.active);
  const scene = pageScene(useLocation().pathname);
  return (
    <div className={roomMode ? 'site-shell--room flex flex-col' : 'flex flex-col min-h-screen'}>
      <RealtimeGameNavigation />
      <RealtimeNotifications />
      <RateLimitNotice />
      <Navbar />
      <main className="site-canvas flex-grow" data-scene={scene} style={sceneStyle(scene)}>
        <PageBackdrop />
        <div className="site-page-content"><Outlet /></div>
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
