import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useIsAuthenticated } from "@refinedev/core";
import { LoadingState } from "./LoadingState";

export interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const { data, isLoading } = useIsAuthenticated();

  if (isLoading) {
    return <LoadingState message="Memverifikasi session autentikasi..." />;
  }

  if (!data?.authenticated) {
    const loginPath = location.pathname.startsWith("/committee")
      ? "/login/committee"
      : location.pathname.startsWith("/portal")
        ? "/login/ustadz"
        : "/login/admin";
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};
