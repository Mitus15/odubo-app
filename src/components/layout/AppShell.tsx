'use client';

import MusicPlayerLayout from "@/app/components/MusicPlayerLayout";
import { AudioProvider } from "@/contexts/AudioContext";
import { MusicPlayerProvider } from "@/contexts/MusicPlayerContext";
import { OmniShopProvider } from "@/contexts/OmniShopContext";
import { StoreProvider } from "@/contexts/StoreContext";
import StoreOrchestrator from "@/components/store/StoreOrchestrator";
import OmniShopOrchestrator from "@/components/shop/OmniShopOrchestrator";
import { UnifiedMediaProvider } from "@/contexts/UnifiedMediaContext";
import OmniMediaOrchestrator from "@/components/media/OmniMediaOrchestrator";
import MediaPriorityBridge from "@/components/player/MediaPriorityBridge";
import DesktopSidebar from "@/components/layout/DesktopSidebar";
import MainContentWrapper from "@/components/layout/MainContentWrapper";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import OfflineIndicator from "@/components/OfflineIndicator";
import { PWAProvider } from "@/components/PWAProvider";
import { QuickShopProvider } from "@/contexts/QuickShopContext";
import QuickShopModal from "@/components/shop/QuickShopModal";

/**
 * The rest of the site's machinery, as the root layout held it before the
 * rooms: the clips, store, music and media providers, their orchestrators and
 * modals, the music player, the desktop sidebar and the service worker.
 * SiteFrame fetches it only for pages outside the rooms (app/(room)), so a
 * room never waits for it. Analytics, the email capture and the cookie bar
 * stay in the root layout, shared with the rooms.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PWAProvider>
      <AudioProvider>
        <MusicPlayerProvider>
          {/* Media priority bridge - connects AudioContext and MusicPlayerContext */}
          <MediaPriorityBridge />
          <OmniShopProvider>
            <StoreProvider>
              <QuickShopProvider>
                <UnifiedMediaProvider>
                  <ServiceWorkerRegistration />
                  <OfflineIndicator />

                  {/* Desktop sidebar - persistent navigation on lg+ */}
                  <DesktopSidebar />
                  {/* Main content wrapper - conditionally applies sidebar margin */}
                  <MainContentWrapper>
                    {/* Main content - full height, accounts for mini-bar dynamically */}
                    <main className="flex-1 min-h-0 safe-area-top safe-area-bottom minibar-aware overflow-y-auto">
                      {children}
                    </main>
                    {/* Music player - renders modal via VinylMiniPlayer */}
                    <MusicPlayerLayout />
                  </MainContentWrapper>
                  {/* Modal orchestrators - rendered at root level */}
                  <StoreOrchestrator />
                  <OmniShopOrchestrator />
                  <OmniMediaOrchestrator />
                  {/* Quick shop modal for clip-to-purchase */}
                  <QuickShopModal />
                </UnifiedMediaProvider>
              </QuickShopProvider>
            </StoreProvider>
          </OmniShopProvider>
        </MusicPlayerProvider>
      </AudioProvider>
    </PWAProvider>
  );
}
