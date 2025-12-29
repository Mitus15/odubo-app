'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type PanelId =
  | 'music-distribution'
  | 'video-distribution'
  | 'analytics-dashboard'
  | 'discography'
  | 'social-distribution';

export type PanelSize = 'small' | 'medium' | 'large' | 'full';

export type PanelState = 'closed' | 'open' | 'minimized' | 'expanded';

export interface Panel {
  id: PanelId;
  state: PanelState;
  size: PanelSize;
  position: number;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  panels: { id: PanelId; position: number; size: PanelSize }[];
  panelLayout: 'grid' | 'stack' | 'focus';
  isSystem?: boolean;
}

// Exclusive panel groups - opening one closes the others in the group
const EXCLUSIVE_GROUPS: PanelId[][] = [
  ['music-distribution', 'video-distribution'],
];

// Default panel configuration
const DEFAULT_PANELS: Panel[] = [
  { id: 'music-distribution', state: 'closed', size: 'medium', position: 0 },
  { id: 'video-distribution', state: 'closed', size: 'medium', position: 1 },
  { id: 'analytics-dashboard', state: 'closed', size: 'medium', position: 2 },
  { id: 'discography', state: 'closed', size: 'small', position: 3 },
  { id: 'social-distribution', state: 'closed', size: 'medium', position: 4 },
];

// System workspaces
const SYSTEM_WORKSPACES: Workspace[] = [
  {
    id: 'ws-distribution',
    name: 'Distribution',
    description: 'Focus on releasing music',
    icon: '🚀',
    panels: [
      { id: 'music-distribution', position: 0, size: 'large' },
      { id: 'discography', position: 1, size: 'small' },
    ],
    panelLayout: 'grid',
    isSystem: true,
  },
  {
    id: 'ws-analytics',
    name: 'Analytics',
    description: 'Monitor streaming performance',
    icon: '📊',
    panels: [
      { id: 'analytics-dashboard', position: 0, size: 'large' },
      { id: 'discography', position: 1, size: 'small' },
    ],
    panelLayout: 'grid',
    isSystem: true,
  },
  {
    id: 'ws-video',
    name: 'Video',
    description: 'Manage video releases',
    icon: '🎬',
    panels: [
      { id: 'video-distribution', position: 0, size: 'large' },
      { id: 'social-distribution', position: 1, size: 'medium' },
    ],
    panelLayout: 'grid',
    isSystem: true,
  },
  {
    id: 'ws-social',
    name: 'Social',
    description: 'Plan and schedule social posts',
    icon: '📱',
    panels: [{ id: 'social-distribution', position: 0, size: 'large' }],
    panelLayout: 'focus',
    isSystem: true,
  },
  {
    id: 'ws-full',
    name: 'Command Center',
    description: 'Full control panel',
    icon: '🎛️',
    panels: [
      { id: 'music-distribution', position: 0, size: 'medium' },
      { id: 'video-distribution', position: 1, size: 'medium' },
      { id: 'analytics-dashboard', position: 2, size: 'medium' },
      { id: 'social-distribution', position: 3, size: 'medium' },
    ],
    panelLayout: 'grid',
    isSystem: true,
  },
];

// ============================================================================
// CONTEXT
// ============================================================================

interface CommandCenterContextValue {
  // Panel state
  panels: Panel[];
  openPanel: (id: PanelId) => void;
  closePanel: (id: PanelId) => void;
  minimizePanel: (id: PanelId) => void;
  expandPanel: (id: PanelId) => void;
  collapsePanel: () => void;
  togglePanel: (id: PanelId) => void;
  setPanelSize: (id: PanelId, size: PanelSize) => void;
  reorderPanels: (fromIndex: number, toIndex: number) => void;

  // Expanded panel (modal mode)
  expandedPanel: PanelId | null;

  // Active/focused panel
  activePanel: PanelId | null;
  setActivePanel: (id: PanelId | null) => void;

  // Workspace
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setWorkspace: (workspaceId: string) => void;
  createWorkspace: (workspace: Omit<Workspace, 'id'>) => void;
  deleteWorkspace: (workspaceId: string) => void;

  // Layout
  panelLayout: 'grid' | 'stack' | 'focus';
  setPanelLayout: (layout: 'grid' | 'stack' | 'focus') => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Utility
  getOpenPanels: () => Panel[];
  isPanelOpen: (id: PanelId) => boolean;
  resetPanels: () => void;
}

const CommandCenterContext = createContext<CommandCenterContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export function CommandCenterProvider({ children }: { children: ReactNode }) {
  // Panel state
  const [panels, setPanels] = useState<Panel[]>(DEFAULT_PANELS);
  const [expandedPanel, setExpandedPanel] = useState<PanelId | null>(null);
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);

  // Workspace state
  const [workspaces, setWorkspaces] = useState<Workspace[]>(SYSTEM_WORKSPACES);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  // Layout state
  const [panelLayout, setPanelLayout] = useState<'grid' | 'stack' | 'focus'>('grid');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load saved state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('command-center-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.panels) setPanels(parsed.panels);
        if (parsed.panelLayout) setPanelLayout(parsed.panelLayout);
        if (parsed.sidebarCollapsed !== undefined) setSidebarCollapsed(parsed.sidebarCollapsed);
        if (parsed.activeWorkspaceId) setActiveWorkspaceId(parsed.activeWorkspaceId);
      }

      // Load custom workspaces
      const savedWorkspaces = localStorage.getItem('command-center-workspaces');
      if (savedWorkspaces) {
        const customWorkspaces = JSON.parse(savedWorkspaces);
        setWorkspaces([...SYSTEM_WORKSPACES, ...customWorkspaces]);
      }
    } catch {}
  }, []);

  // Save state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        'command-center-state',
        JSON.stringify({
          panels,
          panelLayout,
          sidebarCollapsed,
          activeWorkspaceId,
        })
      );
    } catch {}
  }, [panels, panelLayout, sidebarCollapsed, activeWorkspaceId]);

  // Handle exclusive panel groups
  const closeExclusivePanels = useCallback((openingId: PanelId) => {
    const group = EXCLUSIVE_GROUPS.find(g => g.includes(openingId));
    if (!group) return;

    setPanels(prev =>
      prev.map(p =>
        group.includes(p.id) && p.id !== openingId ? { ...p, state: 'closed' } : p
      )
    );
  }, []);

  // Panel actions
  const openPanel = useCallback(
    (id: PanelId) => {
      closeExclusivePanels(id);
      setPanels(prev => prev.map(p => (p.id === id ? { ...p, state: 'open' } : p)));
      setActivePanel(id);
    },
    [closeExclusivePanels]
  );

  const closePanel = useCallback((id: PanelId) => {
    setPanels(prev => prev.map(p => (p.id === id ? { ...p, state: 'closed' } : p)));
    if (expandedPanel === id) setExpandedPanel(null);
    if (activePanel === id) setActivePanel(null);
  }, [expandedPanel, activePanel]);

  const minimizePanel = useCallback((id: PanelId) => {
    setPanels(prev => prev.map(p => (p.id === id ? { ...p, state: 'minimized' } : p)));
    if (expandedPanel === id) setExpandedPanel(null);
  }, [expandedPanel]);

  const expandPanel = useCallback((id: PanelId) => {
    setExpandedPanel(id);
    setPanels(prev => prev.map(p => (p.id === id ? { ...p, state: 'expanded' } : p)));
    setActivePanel(id);
  }, []);

  const collapsePanel = useCallback(() => {
    if (expandedPanel) {
      setPanels(prev =>
        prev.map(p => (p.id === expandedPanel ? { ...p, state: 'open' } : p))
      );
      setExpandedPanel(null);
    }
  }, [expandedPanel]);

  const togglePanel = useCallback(
    (id: PanelId) => {
      const panel = panels.find(p => p.id === id);
      if (!panel) return;

      if (panel.state === 'closed' || panel.state === 'minimized') {
        openPanel(id);
      } else {
        closePanel(id);
      }
    },
    [panels, openPanel, closePanel]
  );

  const setPanelSize = useCallback((id: PanelId, size: PanelSize) => {
    setPanels(prev => prev.map(p => (p.id === id ? { ...p, size } : p)));
  }, []);

  const reorderPanels = useCallback((fromIndex: number, toIndex: number) => {
    setPanels(prev => {
      const result = [...prev];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      return result.map((p, i) => ({ ...p, position: i }));
    });
  }, []);

  // Workspace actions
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || null;

  const setWorkspace = useCallback(
    (workspaceId: string) => {
      const workspace = workspaces.find(w => w.id === workspaceId);
      if (!workspace) return;

      setActiveWorkspaceId(workspaceId);
      setPanelLayout(workspace.panelLayout);

      // Reset all panels first
      setPanels(prev =>
        prev.map(p => ({
          ...p,
          state: 'closed',
          position: DEFAULT_PANELS.find(dp => dp.id === p.id)?.position ?? p.position,
        }))
      );

      // Apply workspace panels
      setPanels(prev =>
        prev.map(p => {
          const workspacePanel = workspace.panels.find(wp => wp.id === p.id);
          if (workspacePanel) {
            return {
              ...p,
              state: 'open',
              size: workspacePanel.size,
              position: workspacePanel.position,
            };
          }
          return p;
        })
      );

      // Set first panel as active
      if (workspace.panels.length > 0) {
        setActivePanel(workspace.panels[0].id);
      }
    },
    [workspaces]
  );

  const createWorkspace = useCallback((workspace: Omit<Workspace, 'id'>) => {
    const newWorkspace: Workspace = {
      ...workspace,
      id: `ws-custom-${Date.now()}`,
      isSystem: false,
    };

    setWorkspaces(prev => {
      const updated = [...prev, newWorkspace];
      // Save custom workspaces
      const custom = updated.filter(w => !w.isSystem);
      try {
        localStorage.setItem('command-center-workspaces', JSON.stringify(custom));
      } catch {}
      return updated;
    });
  }, []);

  const deleteWorkspace = useCallback((workspaceId: string) => {
    setWorkspaces(prev => {
      const updated = prev.filter(w => w.id !== workspaceId || w.isSystem);
      const custom = updated.filter(w => !w.isSystem);
      try {
        localStorage.setItem('command-center-workspaces', JSON.stringify(custom));
      } catch {}
      return updated;
    });

    if (activeWorkspaceId === workspaceId) {
      setActiveWorkspaceId(null);
    }
  }, [activeWorkspaceId]);

  // Layout actions
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  // Utility functions
  const getOpenPanels = useCallback(() => {
    return panels
      .filter(p => p.state === 'open' || p.state === 'expanded')
      .sort((a, b) => a.position - b.position);
  }, [panels]);

  const isPanelOpen = useCallback(
    (id: PanelId) => {
      const panel = panels.find(p => p.id === id);
      return panel?.state === 'open' || panel?.state === 'expanded';
    },
    [panels]
  );

  const resetPanels = useCallback(() => {
    setPanels(DEFAULT_PANELS);
    setExpandedPanel(null);
    setActivePanel(null);
    setActiveWorkspaceId(null);
    setPanelLayout('grid');
  }, []);

  return (
    <CommandCenterContext.Provider
      value={{
        panels,
        openPanel,
        closePanel,
        minimizePanel,
        expandPanel,
        collapsePanel,
        togglePanel,
        setPanelSize,
        reorderPanels,
        expandedPanel,
        activePanel,
        setActivePanel,
        workspaces,
        activeWorkspace,
        setWorkspace,
        createWorkspace,
        deleteWorkspace,
        panelLayout,
        setPanelLayout,
        sidebarCollapsed,
        toggleSidebar,
        getOpenPanels,
        isPanelOpen,
        resetPanels,
      }}
    >
      {children}
    </CommandCenterContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useCommandCenter() {
  const context = useContext(CommandCenterContext);
  if (!context) {
    throw new Error('useCommandCenter must be used within a CommandCenterProvider');
  }
  return context;
}

// Panel metadata helper
export const PANEL_META: Record<PanelId, { name: string; icon: string; description: string }> = {
  'music-distribution': {
    name: 'Music Distribution',
    icon: '🎵',
    description: 'Release music to streaming platforms',
  },
  'video-distribution': {
    name: 'Video Distribution',
    icon: '🎬',
    description: 'Publish videos to YouTube, Vevo',
  },
  'analytics-dashboard': {
    name: 'Analytics',
    icon: '📊',
    description: 'Streaming stats and insights',
  },
  'discography': {
    name: 'Discography',
    icon: '💿',
    description: 'Your catalog on streaming platforms',
  },
  'social-distribution': {
    name: 'Social',
    icon: '📱',
    description: 'Schedule and post to social media',
  },
};
