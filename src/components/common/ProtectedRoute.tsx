import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useGetIdentity, useIsAuthenticated } from "@refinedev/core";
import { AuthIdentity } from "@/lib/refine/authProvider";
import { LoadingState } from "./LoadingState";
import { isCommitteeOrganizerOnly } from "@/lib/committeeOrganizerAccess";
import { LOCATION_CHECKIN_PATH, locationCheckinHash, parseLocationCheckinHash } from "@/lib/locationCheckin";
import { hasPortalAccess, PORTAL_LOGIN_PATHS, PORTAL_ROLES, type PortalCode } from "@/config/portalAccess";

export type PortalAccess = PortalCode;

export const PORTAL_ROLE_ACCESS = PORTAL_ROLES;

export const portalForPath = (pathname: string): PortalAccess =>
  pathname.startsWith("/committee") ? "committee" : pathname.startsWith("/portal") ? "ustadz" : "admin";

export const canAccessPortal = (assignments: AuthIdentity["assignments"], portal: PortalAccess) =>
  hasPortalAccess(portal, assignments);

export const homeForAssignments = (assignments: AuthIdentity["assignments"]) => {
  if (canAccessPortal(assignments, "admin")) return isCommitteeOrganizerOnly(assignments) ? "/admin/events" : "/admin";
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
    const loginPath = PORTAL_LOGIN_PATHS[portal];
    const scan = location.pathname === LOCATION_CHECKIN_PATH ? parseLocationCheckinHash(location.hash) : null;
    return <Navigate to={loginPath} replace state={{ from: location.pathname + (scan ? locationCheckinHash(scan) : "") }} />;
  }

  const assignments = identity?.assignments || [];
  if (!canAccessPortal(assignments, portal)) {
    return <Navigate to={homeForAssignments(assignments)} replace />;
  }

  if (location.pathname === "/admin" && isCommitteeOrganizerOnly(assignments)) {
    return <Navigate to="/admin/events" replace />;
  }

  return <>{children}</>;
};
