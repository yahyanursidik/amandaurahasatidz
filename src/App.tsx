import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Refine } from "@refinedev/core";
import { authProvider } from "./lib/refine/authProvider";
import { dataProvider } from "./lib/refine/dataProvider";
import { accessControlProvider } from "./lib/refine/accessControlProvider";

import { LoginPage } from "./pages/auth/LoginPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminAuditPage } from "./pages/admin/AdminAuditPage";

import { InstitutionDirectoryPage } from "./pages/admin/institutions/InstitutionDirectoryPage";
import { InstitutionCreateRealPage } from "./pages/admin/institutions/InstitutionCreateRealPage";
import { InstitutionEditRealPage } from "./pages/admin/institutions/InstitutionEditRealPage";
import { InstitutionDetailPage } from "./pages/admin/institutions/InstitutionDetailPage";

import { UstadzListPage } from "./pages/admin/ustadz/UstadzListPage";
import { UstadzCreatePage } from "./pages/admin/ustadz/UstadzCreatePage";
import { UstadzEditPage } from "./pages/admin/ustadz/UstadzEditPage";
import { UstadzShowPage } from "./pages/admin/ustadz/UstadzShowPage";
import { UstadzMergePage } from "./pages/admin/ustadz/UstadzMergePage";

import { EventListPage } from "./pages/admin/events/EventListPage";
import { EventCreatePage } from "./pages/admin/events/EventCreatePage";
import { EventEditPage } from "./pages/admin/events/EventEditPage";
import { EventShowPage } from "./pages/admin/events/EventShowPage";
import { EventRegistrationsPage } from "./pages/admin/events/EventRegistrationsPage";
import { EventOperationsPage } from "./pages/admin/events/EventOperationsPage";
import { CommitteeDirectoryPage } from "./pages/admin/committee/CommitteeDirectoryPage";
import { CommitteeCreatePage } from "./pages/admin/committee/CommitteeCreatePage";
import { CommitteeDetailPage } from "./pages/admin/committee/CommitteeDetailPage";

import { CommitteeDashboardPage } from "./pages/committee/CommitteeDashboardPage";
import { OnSiteCheckinPage } from "./pages/committee/OnSiteCheckinPage";
import { CommitteeQrDisplayPage } from "./pages/committee/CommitteeQrDisplayPage";
import { CommitteeSupportPage } from "./pages/committee/CommitteeSupportPage";
import { CommitteeParticipantsPage } from "./pages/committee/CommitteeParticipantsPage";
import { CommitteeAssignmentsPage } from "./pages/committee/CommitteeAssignmentsPage";
import { UstadzPortalPage } from "./pages/portal/UstadzPortalPage";
import { EventPublicPage } from "./pages/public/EventPublicPage";
import { InvitationPage } from "./pages/public/InvitationPage";
import { CheckInPublicPage } from "./pages/public/CheckInPublicPage";
import { ProtectedRoute } from "./components/common/ProtectedRoute";
import { CommitteeLayout } from "./components/layouts/CommitteeLayout";
import { NotFoundPage } from "./pages/NotFoundPage";

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
          { name: "committee", list: "/admin/committee", create: "/admin/committee/create", show: "/admin/committee/:id" },
        ]}
      >
        <Routes>
          {/* Root Redirect */}
          <Route path="/" element={<Navigate to="/admin" replace />} />

          {/* Public Unprotected Routes */}
          <Route path="/login" element={<Navigate to="/login/admin" replace />} />
          <Route path="/login/admin" element={<LoginPage />} />
          <Route path="/login/committee" element={<LoginPage />} />
          <Route path="/login/ustadz" element={<LoginPage />} />
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
            path="/admin/events/:id/registrations"
            element={
              <ProtectedRoute>
                <EventRegistrationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/events/:id/schedule"
            element={
              <ProtectedRoute>
                <EventShowPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/events/:id/team"
            element={
              <ProtectedRoute>
                <EventShowPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/events/:id/attendance"
            element={
              <ProtectedRoute>
                <EventOperationsPage mode="attendance" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/events/:id/communications"
            element={
              <ProtectedRoute>
                <EventOperationsPage mode="communications" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/events/:id/reports"
            element={
              <ProtectedRoute>
                <EventOperationsPage mode="reports" />
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
                <InstitutionDirectoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/institutions/create"
            element={
              <ProtectedRoute>
                <InstitutionCreateRealPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/institutions/:id/edit"
            element={
              <ProtectedRoute>
                <InstitutionEditRealPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/institutions/:id"
            element={
              <ProtectedRoute>
                <InstitutionDetailPage />
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
            path="/admin/audit-logs"
            element={
              <ProtectedRoute>
                <AdminAuditPage />
              </ProtectedRoute>
            }
          />

          <Route path="/admin/committee" element={<ProtectedRoute><CommitteeDirectoryPage /></ProtectedRoute>} />
          <Route path="/admin/committee/create" element={<ProtectedRoute><CommitteeCreatePage /></ProtectedRoute>} />
          <Route path="/admin/committee/:id" element={<ProtectedRoute><CommitteeDetailPage /></ProtectedRoute>} />

          <Route
            path="/admin/*"
            element={<NotFoundPage />}
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
            path="/committee/check-in"
            element={
              <ProtectedRoute>
                <CommitteeLayout>
                  <OnSiteCheckinPage />
                </CommitteeLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/committee/assignments" element={<ProtectedRoute><CommitteeAssignmentsPage /></ProtectedRoute>} />
          <Route
            path="/committee/location-qr"
            element={
              <ProtectedRoute>
                <CommitteeQrDisplayPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/committee/attendance"
            element={
              <ProtectedRoute>
                <CommitteeSupportPage mode="attendance" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/committee/participants"
            element={
              <ProtectedRoute>
                <CommitteeParticipantsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/committee/announcements"
            element={
              <ProtectedRoute>
                <CommitteeSupportPage mode="announcements" />
              </ProtectedRoute>
            }
          />
          <Route path="/committee/*" element={<NotFoundPage />} />

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
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Refine>
    </BrowserRouter>
  );
};

export default App;
