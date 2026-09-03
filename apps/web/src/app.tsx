import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Layout } from "@/components/Layout";
import { Spinner } from "@/components/ui";
import { applyTheme, settingsStore } from "@/lib/settings";
import { AboutPage } from "@/routes/About";
import { CommunityPage } from "@/routes/Community";
import { ContributePage } from "@/routes/Contribute";
import { ExplorePage } from "@/routes/Explore";
import { FavoritesPage } from "@/routes/Favorites";
import { LegalPage } from "@/routes/Legal";
import { LivePage } from "@/routes/Live";
import { RadarPage } from "@/routes/Radar";
import { SettingsPage } from "@/routes/Settings";
import { StatusPage } from "@/routes/Status";
import { StreamerPage } from "@/routes/Streamer";
import { WatchPage } from "@/routes/Watch";

const AdminPage = lazy(() => import("@/routes/Admin").then((m) => ({ default: m.AdminPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: true, retry: 1, gcTime: 10 * 60_000 }
  }
});

function ThemeSync() {
  const settings = settingsStore.use();
  useEffect(() => {
    applyTheme(settings);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme(settings);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [settings]);
  return null;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<RadarPage />} />
            <Route path="radar" element={<Navigate to="/" replace />} />
            <Route path="live" element={<LivePage />} />
            <Route path="favorites" element={<FavoritesPage />} />
            <Route path="streamers" element={<ExplorePage />} />
            <Route path="streamers/:login" element={<StreamerPage />} />
            <Route path="streamers/:login/watch" element={<WatchPage />} />
            <Route path="community" element={<CommunityPage />} />
            <Route path="contribute" element={<ContributePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="status" element={<StatusPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="legal" element={<LegalPage />} />
            <Route
              path="admin"
              element={
                <Suspense fallback={<Spinner />}>
                  <AdminPage />
                </Suspense>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
