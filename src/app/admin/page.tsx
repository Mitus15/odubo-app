"use client";
import ScreenLayout from "@/components/ui/ScreenLayout";
import UserProvider, { useUser } from "./UserProvider";
import ScrollContainer from "@/components/ui/ScrollContainer";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TabContent from "./TabContent";

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Removed SW unregister to avoid reload loops

  useEffect(() => {
    const getCookieToken = () => {
      try {
        const all = typeof document !== 'undefined' ? document.cookie : '';
        const match = all.split(';').map(s => s.trim()).find(s => s.startsWith('token='));
        return match ? decodeURIComponent(match.split('=')[1]) : null;
      } catch { return null; }
    };

    const lsToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const token = lsToken || getCookieToken();

    if (!token) { setIsAdmin(false); router.replace('/login'); return; }

    try {
      const base64Url = token.split('.')[1] || '';
      const pad = (s: string) => s + '==='.slice((s.length + 3) % 4);
      const base64 = pad(base64Url.replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('utf-8'));
      const ok = !!payload?.is_admin || payload?.role === 'admin';
      setIsAdmin(ok);
      if (!ok) router.replace('/');
    } catch (e) {
      console.error('Token decode failed:', e);
      setIsAdmin(false);
      router.replace('/login');
    }
  }, [router]);

  const toggleExpand = (id: string, siblings: string[]) => {
    setExpandedItems(prev => {
      // Remove all siblings from expanded list (closing them)
      const withoutSiblings = prev.filter(i => !siblings.includes(i));
      
      // If it was already expanded, we just closed it (by removing it above if it's in siblings).
      // But we need to check if it WAS in prev to decide whether to toggle it off or on.
      const wasExpanded = prev.includes(id);
      
      if (wasExpanded) {
        return withoutSiblings; // It's already removed
      } else {
        return [...withoutSiblings, id]; // Add it back
      }
    });
  };

  const navItems = [
    { id: 'overview', label: 'Home', icon: '🏠' },
    { 
      id: 'cms', 
      label: 'CMS', 
      icon: '📚',
      children: [
        { id: 'content', label: 'Content', icon: '📝' },
        { id: 'music-library', label: 'Music', icon: '🎶' },
        { id: 'video-library', label: 'Videos', icon: '📹' },
        { id: 'moments', label: 'Moments', icon: '📸' },
      ]
    },
    { 
      id: 'analytics', 
      label: 'Analytics', 
      icon: '📊',
      children: [
        { id: 'analytics-overview', label: 'Web Analytics' },
        { id: 'analytics-music', label: 'Music' },
        { id: 'analytics-video', label: 'Video' },
        { id: 'analytics-moments', label: 'Moments' },
        { id: 'analytics-gallery', label: 'Gallery' },
        { id: 'analytics-users', label: 'Users' },
      ]
    },
    {
      id: 'apps',
      label: 'Apps',
      icon: '🔌',
      children: [
        { id: 'apps-installed', label: 'Installed Apps' },
        { id: 'apps-store', label: 'App Store' },
        { id: 'apps-api', label: 'API Keys' },
      ]
    },
  ];

  const renderNavItem = (item: any, depth = 0, siblings: string[] = []) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.id);
    const isActive = activeTab === item.id;

    return (
      <div key={item.id}>
        <button
          onClick={() => {
            setActiveTab(item.id);
            if (hasChildren) {
              toggleExpand(item.id, siblings);
            } else {
              setIsSidebarOpen(false);
            }
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive
              ? 'bg-[#302927] text-[#ede8df]'
              : 'text-[#b2a491] hover:bg-[#302927]/50 hover:text-[#ede8df]'
          }`}
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
        >
          <div className="flex items-center gap-3">
            {item.icon && <span>{item.icon}</span>}
            <span>{item.label}</span>
          </div>
          {hasChildren && (
            <span className="text-xs opacity-50">{isExpanded ? '▼' : '▶'}</span>
          )}
        </button>
        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {item.children.map((child: any) => renderNavItem(child, depth + 1, item.children.map((c: any) => c.id)))}
          </div>
        )}
      </div>
    );
  };

  if (isAdmin === null) {
    return (
      <div className="h-full w-full bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] flex items-center justify-center">
        <div className="text-[#ede8df]">Loading...</div>
      </div>
    );
  }

  return (
    <UserProvider>
      <ScreenLayout className="bg-[#171616] text-[#ede8df] flex flex-row">
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex flex-col w-64 bg-[#1c1a19] border-r border-[#502d26]/30 h-full flex-shrink-0">
        <div className="p-4 border-b border-[#502d26]/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#843c2d] rounded-lg flex items-center justify-center font-bold">O</div>
            <span className="font-bold text-lg">Odubo Admin</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {navItems.map((item) => renderNavItem(item, 0, navItems.map(i => i.id)))}
        </div>
        <AdminFooterStatus />
      </div>

      {/* Mobile Header & Drawer Overlay */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#1c1a19] border-b border-[#502d26]/30 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-[#ede8df]">
            ☰
          </button>
          <span className="font-bold">Odubo Admin</span>
        </div>
      </div>

      {isSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setIsSidebarOpen(false)}>
          <div className="absolute top-0 left-0 bottom-0 w-64 bg-[#1c1a19] p-4" onClick={e => e.stopPropagation()}>
             <div className="space-y-1 mt-12">
              {navItems.map((item) => renderNavItem(item, 0, navItems.map(i => i.id)))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden md:static pt-14 md:pt-0">
        <ScrollContainer>
          <div className="min-h-full">
            <TabContent activeTab={activeTab as any} />
          </div>
        </ScrollContainer>
      </div>
      </ScreenLayout>
    </UserProvider>
  );
}

function AdminFooterStatus() {
  const { user } = useUser();
  return (
    <div className="p-4 border-t border-[#502d26]/30">
      <div className="flex items-center justify-between text-sm text-[#b2a491]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Store is Live</span>
        </div>
        <div className="text-xs">
          {user ? (
            <span>Signed in as {user.email}{user.is_admin ? ' • Admin' : ''}</span>
          ) : (
            <span>Not signed in</span>
          )}
        </div>
      </div>
    </div>
  );
}
