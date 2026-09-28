import React from "react";
import { Link } from "react-router-dom";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  breadcrumbs,
}) => {
  return (
    <div className="border-b border-slate-200 pb-4 mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span>/</span>}
              {crumb.href ? (
                <Link
                  to={crumb.href}
                  className="rounded-sm font-medium hover:text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-slate-800 font-medium">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="min-w-0 text-xl font-bold leading-tight text-slate-900 [overflow-wrap:anywhere] sm:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex max-w-full flex-wrap items-center gap-2 lg:justify-end">{actions}</div>}
      </div>
    </div>
  );
};
