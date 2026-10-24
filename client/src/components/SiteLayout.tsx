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
import MobileTabBar, { showsMobileTabBar } from './MobileTabBar';
import { useAuth } from '../context/AuthContext';
import { pageScene, sceneStyle } from '../lib/pageScenery';

function SiteShell() {
  const roomMode = Boolean(useRoomChrome()?.active);
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const scene = pageScene(pathname);
  const tabBar = isAuthenticated && !roomMode && showsMobileTabBar(pathname);
  return (
    <div className={`${roomMode ? 'site-shell--room flex flex-col' : 'flex flex-col min-h-screen'}${tabBar ? ' site-shell--tabbar' : ''}`}>
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
      {tabBar && <MobileTabBar />}
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
