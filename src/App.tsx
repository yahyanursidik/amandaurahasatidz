import React, { lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Refine } from "@refinedev/core";
import { authProvider } from "./lib/refine/authProvider";
import { dataProvider } from "./lib/refine/dataProvider";
import { accessControlProvider } from "./lib/refine/accessControlProvider";

import { ProtectedRoute } from "./components/common/ProtectedRoute";
import { RouteLoadingBoundary } from "./components/common/RouteLoadingBoundary";

// Keep loaders at module scope: React caches each page, and Vite can split the
// literal dynamic imports without eagerly loading other portals or their UI.
const LoginPage = lazy(() => import("./pages/auth/LoginPage").then((module) => ({ default: module.LoginPage })));
const UkhuwahPage = lazy(() => import("./pages/shared/UkhuwahPage").then((module) => ({ default: module.UkhuwahPage })));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage").then((module) => ({ default: module.AdminDashboardPage })));
const AdminAuditPage = lazy(() => import("./pages/admin/AdminAuditPage").then((module) => ({ default: module.AdminAuditPage })));
const AdminEmailJobsPage = lazy(() => import("./pages/admin/AdminEmailJobsPage").then((module) => ({ default: module.AdminEmailJobsPage })));

const InstitutionDirectoryPage = lazy(() => import("./pages/admin/institutions/InstitutionDirectoryPage").then((module) => ({ default: module.InstitutionDirectoryPage })));
const InstitutionCreateRealPage = lazy(() => import("./pages/admin/institutions/InstitutionCreateRealPage").then((module) => ({ default: module.InstitutionCreateRealPage })));
const InstitutionEditRealPage = lazy(() => import("./pages/admin/institutions/InstitutionEditRealPage").then((module) => ({ default: module.InstitutionEditRealPage })));
const InstitutionDetailPage = lazy(() => import("./pages/admin/institutions/InstitutionDetailPage").then((module) => ({ default: module.InstitutionDetailPage })));

const UstadzListPage = lazy(() => import("./pages/admin/ustadz/UstadzListPage").then((module) => ({ default: module.UstadzListPage })));
const UstadzCreatePage = lazy(() => import("./pages/admin/ustadz/UstadzCreatePage").then((module) => ({ default: module.UstadzCreatePage })));
const UstadzEditPage = lazy(() => import("./pages/admin/ustadz/UstadzEditPage").then((module) => ({ default: module.UstadzEditPage })));
const UstadzShowPage = lazy(() => import("./pages/admin/ustadz/UstadzShowPage").then((module) => ({ default: module.UstadzShowPage })));
const UstadzMergePage = lazy(() => import("./pages/admin/ustadz/UstadzMergePage").then((module) => ({ default: module.UstadzMergePage })));

const EventListPage = lazy(() => import("./pages/admin/events/EventListPage").then((module) => ({ default: module.EventListPage })));
const EventCreatePage = lazy(() => import("./pages/admin/events/EventCreatePage").then((module) => ({ default: module.EventCreatePage })));
const EventEditPage = lazy(() => import("./pages/admin/events/EventEditPage").then((module) => ({ default: module.EventEditPage })));
const EventShowPage = lazy(() => import("./pages/admin/events/EventShowPage").then((module) => ({ default: module.EventShowPage })));
const EventRegistrationsPage = lazy(() => import("./pages/admin/events/EventRegistrationsPage").then((module) => ({ default: module.EventRegistrationsPage })));
const EventOperationsPage = lazy(() => import("./pages/admin/events/EventOperationsPage").then((module) => ({ default: module.EventOperationsPage })));
const AttendanceReportPage = lazy(() => import("./pages/admin/events/AttendanceReportPage").then((module) => ({ default: module.AttendanceReportPage })));
const CommitteeDirectoryPage = lazy(() => import("./pages/admin/committee/CommitteeDirectoryPage").then((module) => ({ default: module.CommitteeDirectoryPage })));
const CommitteeCreatePage = lazy(() => import("./pages/admin/committee/CommitteeCreatePage").then((module) => ({ default: module.CommitteeCreatePage })));
const CommitteeDetailPage = lazy(() => import("./pages/admin/committee/CommitteeDetailPage").then((module) => ({ default: module.CommitteeDetailPage })));

const CommitteeDashboardPage = lazy(() => import("./pages/committee/CommitteeDashboardPage").then((module) => ({ default: module.CommitteeDashboardPage })));
const OnSiteCheckinPage = lazy(() => import("./pages/committee/OnSiteCheckinPage").then((module) => ({ default: module.OnSiteCheckinPage })));
const CommitteeQrDisplayPage = lazy(() => import("./pages/committee/CommitteeQrDisplayPage").then((module) => ({ default: module.CommitteeQrDisplayPage })));
const CommitteeOperationsPage = lazy(() => import("./pages/committee/CommitteeOperationsPage").then((module) => ({ default: module.CommitteeOperationsPage })));
const CommitteeParticipantsPage = lazy(() => import("./pages/committee/CommitteeParticipantsPage").then((module) => ({ default: module.CommitteeParticipantsPage })));
const CommitteeAssignmentsPage = lazy(() => import("./pages/committee/CommitteeAssignmentsPage").then((module) => ({ default: module.CommitteeAssignmentsPage })));
const ParticipantPortalPage = lazy(() => import("./pages/portal/ParticipantPortalPage").then((module) => ({ default: module.ParticipantPortalPage })));
const RuangAsatidzPage = lazy(() => import("./pages/portal/RuangAsatidzPage").then((module) => ({ default: module.RuangAsatidzPage })));
const RuangAsatidzAdminPage = lazy(() => import("./pages/admin/RuangAsatidzAdminPage").then((module) => ({ default: module.RuangAsatidzAdminPage })));
const EventPublicPage = lazy(() => import("./pages/public/EventPublicPage").then((module) => ({ default: module.EventPublicPage })));
const PublicProgramsPage = lazy(() => import("./pages/public/PublicProgramsPage").then((module) => ({ default: module.PublicProgramsPage })));
const RuangAsatidzPublicPage = lazy(() => import("./pages/public/RuangAsatidzPublicPage").then((module) => ({ default: module.RuangAsatidzPublicPage })));
const PublicEventRegistrationPage = lazy(() => import("./pages/public/PublicEventRegistrationPage").then((module) => ({ default: module.PublicEventRegistrationPage })));
const InvitationRegistrationPage = lazy(() => import("./pages/public/InvitationRegistrationPage").then((module) => ({ default: module.InvitationRegistrationPage })));
const CheckInPublicPage = lazy(() => import("./pages/public/CheckInPublicPage").then((module) => ({ default: module.CheckInPublicPage })));
const ParticipantCardPage = lazy(() => import("./pages/public/ParticipantCardPage").then((module) => ({ default: module.ParticipantCardPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));
const CommitteeLayout = lazy(() => import("./components/layouts/CommitteeLayout").then((module) => ({ default: module.CommitteeLayout })));

export const App: React.FC = () => {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
        <RouteLoadingBoundary>
        <Routes>
          {/* Root Redirect */}
          <Route path="/" element={<PublicProgramsPage />} />
          <Route path="/programs" element={<PublicProgramsPage />} />
          <Route path="/ruang-asatidz" element={<RuangAsatidzPublicPage />} />

          {/* Public Unprotected Routes */}
          <Route path="/login" element={<Navigate to="/login/admin" replace />} />
          <Route path="/login/admin" element={<LoginPage />} />
          <Route path="/login/committee" element={<LoginPage />} />
          <Route path="/login/ustadz" element={<LoginPage />} />
          <Route path="/events/:slug" element={<EventPublicPage />} />
          <Route path="/events/:slug/register" element={<PublicEventRegistrationPage />} />
          <Route path="/invitation/:token" element={<InvitationRegistrationPage />} />
          <Route path="/invitation/institution/:institutionSlug/:token" element={<InvitationRegistrationPage />} />
          <Route path="/invitation/institution/:token" element={<InvitationRegistrationPage />} />
          <Route path="/invitation/individual/:token" element={<InvitationRegistrationPage />} />
          <Route path="/check-in/:eventSlug" element={<CheckInPublicPage />} />
          <Route path="/check-in" element={<CheckInPublicPage />} />
          <Route path="/card" element={<ParticipantCardPage />} />
          <Route path="/gate" element={<CheckInPublicPage />} />
          <Route path="/gate/:eventSlug" element={<CheckInPublicPage />} />

          {/* Portal 1: Super Admin & Panitia (Protected) */}
          <Route path="/admin/peta-ukhuwah/*" element={<ProtectedRoute><UkhuwahPage admin /></ProtectedRoute>} />
          <Route path="/portal/peta-ukhuwah/*" element={<ProtectedRoute><UkhuwahPage /></ProtectedRoute>} />
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
            path="/admin/events/:id/attendance/:participantId/report"
            element={
              <ProtectedRoute>
                <AttendanceReportPage />
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
          <Route path="/admin/email-jobs" element={<ProtectedRoute><AdminEmailJobsPage /></ProtectedRoute>} />
          <Route path="/admin/broadcast" element={<ProtectedRoute><AdminEmailJobsPage mode="broadcast" /></ProtectedRoute>} />

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
            path="/committee/attendance/:id/:participantId/report"
            element={
              <ProtectedRoute>
                <AttendanceReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/committee/attendance"
            element={
              <ProtectedRoute>
                <CommitteeOperationsPage mode="attendance" />
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
                <CommitteeOperationsPage mode="announcements" />
              </ProtectedRoute>
            }
          />
          <Route path="/committee/*" element={<NotFoundPage />} />

          {/* Portal 3: Ustadz (Protected) */}
          <Route path="/admin/ruang-asatidz/*" element={<ProtectedRoute><RuangAsatidzAdminPage /></ProtectedRoute>} />
          <Route path="/portal/ruang-asatidz/*" element={<ProtectedRoute><RuangAsatidzPage /></ProtectedRoute>} />
          <Route
            path="/portal"
            element={
              <ProtectedRoute>
                <ParticipantPortalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/portal/*"
            element={
              <ProtectedRoute>
                <ParticipantPortalPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback Catch-All */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </RouteLoadingBoundary>
      </Refine>
    </BrowserRouter>
  );
};

export default App;
