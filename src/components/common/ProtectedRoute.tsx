import React from "react";
import { Navigate } from "react-router-dom";
import { useIsAuthenticated } from "@refinedev/core";
import { LoadingState } from "./LoadingState";

export interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { data, isLoading } = useIsAuthenticated();

  if (isLoading) {
    return <LoadingState message="Memverifikasi session autentikasi..." />;
  }

  if (!data?.authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
