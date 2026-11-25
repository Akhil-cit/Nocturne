import { create } from 'zustand';
import type { SearchResults } from '../services/music/types';

export type AppPage = 'home' | 'search' | 'library' | 'settings' | 'now-playing';

export type VisualizationMode =
  | 'constellation'
  | 'cinematic'
  | 'floating'
  | 'karaoke'
  | 'minimal'
  | 'orbit'
  | 'particle'
  | 'wave'
  | 'spectrum'
  | 'waveform'
  | 'none';

export type BackgroundMode =
  | 'starfield'
  | 'nebula'
  | 'aurora'
  | 'fluid'
  | 'clouds'
  | 'fog'
  | 'particles'
  | 'waves'
  | 'album-blur'
  | 'custom-image'
  | 'custom-video'
  | 'black'
  | 'solid';

export type OverlayMode = 'none' | 'queue' | 'lyrics';

export interface UIState {
  currentPage: AppPage;
  sidebarOpen: boolean;
  nowPlayingExpanded: boolean;
  visualizationMode: VisualizationMode;
  backgroundMode: BackgroundMode;
  immersiveMode: boolean;
  overlayMode: OverlayMode;
  searchQuery: string;
  searchResults: SearchResults | null;
  isSearching: boolean;

  setCurrentPage: (page: AppPage) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setNowPlayingExpanded: (expanded: boolean) => void;
  toggleNowPlaying: () => void;
  setVisualizationMode: (mode: VisualizationMode) => void;
  setBackgroundMode: (mode: BackgroundMode) => void;
  setImmersiveMode: (immersive: boolean) => void;
  toggleImmersiveMode: () => void;
  setOverlayMode: (mode: OverlayMode) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: SearchResults | null) => void;
  setIsSearching: (searching: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  currentPage: 'home',
  sidebarOpen: true,
  nowPlayingExpanded: false,
  visualizationMode: 'constellation',
  backgroundMode: 'starfield',
  immersiveMode: false,
  overlayMode: 'none',
  searchQuery: '',
  searchResults: null,
  isSearching: false,

  setCurrentPage: (page) => set({ currentPage: page }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setNowPlayingExpanded: (expanded) => set({ nowPlayingExpanded: expanded }),
  toggleNowPlaying: () =>
    set((state) => ({ nowPlayingExpanded: !state.nowPlayingExpanded })),
  setVisualizationMode: (mode) => set({ visualizationMode: mode }),
  setBackgroundMode: (mode) => set({ backgroundMode: mode }),
  setImmersiveMode: (immersive) => set({ immersiveMode: immersive }),
  toggleImmersiveMode: () =>
    set((state) => ({ immersiveMode: !state.immersiveMode })),
  setOverlayMode: (mode) => set({ overlayMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  setIsSearching: (searching) => set({ isSearching: searching }),
}));
