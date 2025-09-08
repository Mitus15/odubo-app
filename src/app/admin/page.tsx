"use client";
import ScreenLayout from "@/components/ui/ScreenLayout";
import ScrollContainer from "@/components/ui/ScrollContainer";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TabContent from "./TabContent";

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'music-library' | 'video-library' | 'analytics'>('overview');

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) { setIsAdmin(false); router.replace("/login"); return; }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const ok = !!payload.is_admin || payload.role === 'admin';
      setIsAdmin(ok);
      if (!ok) router.replace("/");
    } catch {
      setIsAdmin(false);
      router.replace("/login");
    }
  }, [router]);

  if (isAdmin === null) {
    return (
      <div className="h-full w-full bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] flex items-center justify-center">
        <div className="text-[#ede8df]">Loading...</div>
      </div>
    );
  }
  if (!isAdmin) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'music-library', label: 'Music Library', icon: '🎶' },
    { id: 'video-library', label: 'Video Library', icon: '📹' },
    { id: 'analytics', label: 'Analytics', icon: '📈' }
  ];

  return (
    <ScreenLayout className="bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] text-[#ede8df]">
      {/* FIXED HEADER SECTION - Never scrolls */}
      <div className="flex-shrink-0">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] backdrop-blur-sm border-b border-[#502d26]/40">
          <div className="px-3 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#ede8df]">Admin Studio</h1>
                <p className="text-[#b2a491] text-xs sm:text-sm">Manage your content and platform</p>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-[#b2a491] text-xs sm:text-sm">Live</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="px-3 sm:px-6 pb-3">
            <div className="flex space-x-2 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'overview' | 'music-library' | 'video-library' | 'analytics')}
                  className={`px-3 sm:px-4 py-2 rounded-2xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex items-center space-x-1 sm:space-x-2 flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-[#ede8df] text-[#171616] shadow-lg'
                      : 'bg-[#302927]/50 border border-[#502d26]/40 text-[#b2a491] hover:bg-[#502d26]/40 hover:text-[#ede8df]'
                  }`}
                >
                  <span className="text-sm sm:text-base">{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden text-xs">{tab.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SCROLLABLE CONTENT AREA - Only this section scrolls */}
      <ScrollContainer>
        <TabContent activeTab={activeTab} />
      </ScrollContainer>
    </ScreenLayout>
  );
}
