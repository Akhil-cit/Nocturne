import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import ImportDialog from '@/components/playlist/ImportDialog';
import QueueDrawer from '@/components/player/QueueDrawer';
import HomePage from '@/components/pages/HomePage';
import LibraryPage from '@/components/pages/LibraryPage';
import PlaylistDetailPage from '@/components/pages/PlaylistDetailPage';
import SearchPage from '@/components/pages/SearchPage';
import { PageErrorBoundary } from '@/components/ui/PageErrorBoundary';
import NowPlaying from '@/components/player/NowPlaying';
import SettingsPage from '@/components/pages/SettingsPage';
import StudioPage from '@/components/pages/StudioPage';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useLibraryStore } from '@/stores/libraryStore';

export default function App() {
  useKeyboardShortcuts();

  useEffect(() => {
    void useLibraryStore.getState().hydrate();
  }, []);

  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/search"
            element={
              <PageErrorBoundary pageName="Search">
                <SearchPage />
              </PageErrorBoundary>
            }
          />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/playlist/:id" element={<PlaylistDetailPage />} />
          <Route path="/now-playing" element={<NowPlaying />} />
          <Route path="/studio" element={<StudioPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell>
      <QueueDrawer />
      <ImportDialog />
    </HashRouter>
  );
}
