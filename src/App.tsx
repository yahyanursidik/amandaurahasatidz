import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Refine } from "@refinedev/core";
import { authProvider } from "./lib/refine/authProvider";
import { dataProvider } from "./lib/refine/dataProvider";
import { accessControlProvider } from "./lib/refine/accessControlProvider";

import { LoginPage } from "./pages/auth/LoginPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";

import { InstitutionListPage } from "./pages/admin/institutions/InstitutionListPage";
import { InstitutionCreatePage } from "./pages/admin/institutions/InstitutionCreatePage";
import { InstitutionEditPage } from "./pages/admin/institutions/InstitutionEditPage";
import { InstitutionShowPage } from "./pages/admin/institutions/InstitutionShowPage";

import { UstadzListPage } from "./pages/admin/ustadz/UstadzListPage";
import { UstadzCreatePage } from "./pages/admin/ustadz/UstadzCreatePage";
import { UstadzEditPage } from "./pages/admin/ustadz/UstadzEditPage";
import { UstadzShowPage } from "./pages/admin/ustadz/UstadzShowPage";
import { UstadzMergePage } from "./pages/admin/ustadz/UstadzMergePage";

import { EventListPage } from "./pages/admin/events/EventListPage";
import { EventCreatePage } from "./pages/admin/events/EventCreatePage";
import { EventEditPage } from "./pages/admin/events/EventEditPage";
import { EventShowPage } from "./pages/admin/events/EventShowPage";

import { CommitteeDashboardPage } from "./pages/committee/CommitteeDashboardPage";
import { UstadzPortalPage } from "./pages/portal/UstadzPortalPage";
import { EventPublicPage } from "./pages/public/EventPublicPage";
import { InvitationPage } from "./pages/public/InvitationPage";
import { CheckInPublicPage } from "./pages/public/CheckInPublicPage";
import { ProtectedRoute } from "./components/common/ProtectedRoute";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Refine
        authProvider={authProvider}
        dataProvider={dataProvider}
        accessControlProvider={accessControlProvider}
        resources={[
          {
            name: "events",
            list: "/admin/events",
            create: "/admin/events/create",
            edit: "/admin/events/:id/edit",
            show: "/admin/events/:id",
          },
          {
            name: "institutions",
            list: "/admin/institutions",
            create: "/admin/institutions/create",
            edit: "/admin/institutions/:id/edit",
            show: "/admin/institutions/:id",
          },
          {
            name: "ustadz",
            list: "/admin/ustadz",
            create: "/admin/ustadz/create",
            edit: "/admin/ustadz/:id/edit",
            show: "/admin/ustadz/:id",
          },
          { name: "audit-logs", list: "/admin/audit-logs" },
        ]}
      >
        <Routes>
          {/* Root Redirect */}
          <Route path="/" element={<Navigate to="/admin" replace />} />

          {/* Public Unprotected Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/events/:slug" element={<EventPublicPage />} />
          <Route path="/invitation/:token" element={<InvitationPage />} />
          <Route path="/invitation/institution/:token" element={<InvitationPage />} />
          <Route path="/invitation/individual/:token" element={<InvitationPage />} />
          <Route path="/check-in/:eventSlug" element={<CheckInPublicPage />} />
          <Route path="/check-in" element={<CheckInPublicPage />} />

          {/* Portal 1: Super Admin & Panitia (Protected) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Events Management */}
          <Route
            path="/admin/events"
            element={
              <ProtectedRoute>
                <EventListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/events/create"
            element={
              <ProtectedRoute>
                <EventCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/events/:id/edit"
            element={
              <ProtectedRoute>
                <EventEditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/events/:id"
            element={
              <ProtectedRoute>
                <EventShowPage />
              </ProtectedRoute>
            }
          />

          {/* Master Institutions */}
          <Route
            path="/admin/institutions"
            element={
              <ProtectedRoute>
                <InstitutionListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/institutions/create"
            element={
              <ProtectedRoute>
                <InstitutionCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/institutions/:id/edit"
            element={
              <ProtectedRoute>
                <InstitutionEditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/institutions/:id"
            element={
              <ProtectedRoute>
                <InstitutionShowPage />
              </ProtectedRoute>
            }
          />

          {/* Master Ustadz */}
          <Route
            path="/admin/ustadz"
            element={
              <ProtectedRoute>
                <UstadzListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ustadz/create"
            element={
              <ProtectedRoute>
                <UstadzCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ustadz/merge"
            element={
              <ProtectedRoute>
                <UstadzMergePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ustadz/:id/edit"
            element={
              <ProtectedRoute>
                <UstadzEditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ustadz/:id"
            element={
              <ProtectedRoute>
                <UstadzShowPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/*"
            element={
              <ProtectedRoute>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Portal 2: Committee (Protected) */}
          <Route
            path="/committee"
            element={
              <ProtectedRoute>
                <CommitteeDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/committee/*"
            element={
              <ProtectedRoute>
                <CommitteeDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Portal 3: Ustadz (Protected) */}
          <Route
            path="/portal"
            element={
              <ProtectedRoute>
                <UstadzPortalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/portal/*"
            element={
              <ProtectedRoute>
                <UstadzPortalPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback Catch-All */}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Refine>
    </BrowserRouter>
  );
};

export default App;
