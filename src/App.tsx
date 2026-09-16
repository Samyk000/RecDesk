import { lazy, Suspense } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";

const Jobs = lazy(() => import("./pages/Jobs").then((m) => ({ default: m.Jobs })));
const JobDetail = lazy(() => import("./pages/JobDetail").then((m) => ({ default: m.JobDetail })));
const Clients = lazy(() => import("./pages/Clients").then((m) => ({ default: m.Clients })));
const ClientDetail = lazy(() => import("./pages/ClientDetail").then((m) => ({ default: m.ClientDetail })));
const Candidates = lazy(() => import("./pages/Candidates").then((m) => ({ default: m.Candidates })));
const Calendar = lazy(() => import("./pages/Calendar").then((m) => ({ default: m.Calendar })));
const Settings = lazy(() => import("./pages/Settings").then((m) => ({ default: m.Settings })));

const PageFallback = () => (
  <div className="flex h-full w-full items-center justify-center py-24">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

function App() {

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/jobs"
          element={
            <Suspense fallback={<PageFallback />}>
              <Jobs />
            </Suspense>
          }
        />
        <Route
          path="/jobs/:id"
          element={
            <Suspense fallback={<PageFallback />}>
              <JobDetail />
            </Suspense>
          }
        />
        <Route
          path="/clients"
          element={
            <Suspense fallback={<PageFallback />}>
              <Clients />
            </Suspense>
          }
        />
        <Route
          path="/clients/:id"
          element={
            <Suspense fallback={<PageFallback />}>
              <ClientDetail />
            </Suspense>
          }
        />
        <Route
          path="/candidates"
          element={
            <Suspense fallback={<PageFallback />}>
              <Candidates />
            </Suspense>
          }
        />
        <Route
          path="/calendar"
          element={
            <Suspense fallback={<PageFallback />}>
              <Calendar />
            </Suspense>
          }
        />
        <Route
          path="/settings"
          element={
            <Suspense fallback={<PageFallback />}>
              <Settings />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;