import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  requestId?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Gagal Memuat Data",
  message = "Terjadi kesalahan saat berkomunikasi dengan server.",
  requestId,
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-rose-50 border border-rose-200 rounded-xl my-4">
      <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-rose-950">{title}</h3>
      <p className="text-xs text-rose-800 max-w-md mt-1 mb-3">{message}</p>
      {requestId && (
        <span className="text-[10px] bg-rose-200 text-rose-900 px-2 py-0.5 rounded font-mono mb-4">
          Request ID: {requestId}
        </span>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Coba Lagi</span>
        </button>
      )}
    </div>
  );
};
