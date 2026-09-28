import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useGetIdentity, useIsAuthenticated } from "@refinedev/core";
import { AuthIdentity } from "@/lib/refine/authProvider";
import { LoadingState } from "./LoadingState";

export type PortalAccess = "admin" | "committee" | "ustadz";

export const PORTAL_ROLE_ACCESS: Record<PortalAccess, string[]> = {
  admin: ["SUPER_ADMIN", "SYSTEM_ADMIN", "DATA_STEWARD", "REPORT_VIEWER", "EVENT_ADMIN"],
  committee: ["COMMITTEE_LEAD", "REGISTRATION_OFFICER", "CHECKIN_OFFICER", "INFORMATION_OFFICER", "EVENT_VIEWER"],
  ustadz: ["USTADZ"],
};

export const portalForPath = (pathname: string): PortalAccess =>
  pathname.startsWith("/committee") ? "committee" : pathname.startsWith("/portal") ? "ustadz" : "admin";

export const canAccessPortal = (assignments: AuthIdentity["assignments"], portal: PortalAccess) =>
  assignments.some((assignment) => PORTAL_ROLE_ACCESS[portal].includes(assignment.roleCode));

export const homeForAssignments = (assignments: AuthIdentity["assignments"]) => {
  if (canAccessPortal(assignments, "admin")) return "/admin";
  if (canAccessPortal(assignments, "committee")) return "/committee";
  if (canAccessPortal(assignments, "ustadz")) return "/portal";
  return "/login";
};

export interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const { data, isLoading } = useIsAuthenticated();
  const { data: identity, isLoading: identityLoading } = useGetIdentity<AuthIdentity>();
  const portal = portalForPath(location.pathname);

  if (isLoading || (data?.authenticated && identityLoading)) {
    return <LoadingState message="Memverifikasi sesi dan hak akses…" />;
  }

  if (!data?.authenticated) {
    const loginPath = portal === "committee" ? "/login/committee" : portal === "ustadz" ? "/login/ustadz" : "/login/admin";
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  }

  const assignments = identity?.assignments || [];
  if (!canAccessPortal(assignments, portal)) {
    return <Navigate to={homeForAssignments(assignments)} replace />;
  }

  return <>{children}</>;
};
