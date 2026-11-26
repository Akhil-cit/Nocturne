import { create } from 'zustand';
import type { SearchCategory, SearchResults } from '../services/music/types';

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
  | 'spotify'
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

export type LyricsDisplayMode = 'normal' | 'spotify';

export interface UIState {
  currentPage: AppPage;
  sidebarOpen: boolean;
  nowPlayingExpanded: boolean;
  visualizationMode: VisualizationMode;
  backgroundMode: BackgroundMode;
  immersiveMode: boolean;
  overlayMode: OverlayMode;
  lyricsDisplayMode: LyricsDisplayMode;
  searchQuery: string;
  searchCategory: SearchCategory;
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
  setLyricsDisplayMode: (mode: LyricsDisplayMode) => void;
  setSearchQuery: (query: string) => void;
  setSearchCategory: (category: SearchCategory) => void;
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
  lyricsDisplayMode: (typeof localStorage !== 'undefined' ? localStorage.getItem('nocturne-lyrics-display-mode') as 'normal' | 'spotify' : null) || 'normal',
  searchQuery: '',
  searchCategory: 'all',
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
  setLyricsDisplayMode: (mode) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('nocturne-lyrics-display-mode', mode);
    set({ lyricsDisplayMode: mode });
  },
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchCategory: (category) => set({ searchCategory: category }),
  setSearchResults: (results) => set({ searchResults: results }),
  setIsSearching: (searching) => set({ isSearching: searching }),
}));
