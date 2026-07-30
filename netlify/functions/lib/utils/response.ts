export interface ApiResponseMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  pageCount?: number;
  [key: string]: unknown;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  data: T | null;
  meta: ApiResponseMeta | null;
  error: ApiErrorDetail | null;
  requestId: string;
}

export function buildSuccessResponse<T>(
  data: T,
  requestId: string,
  meta: ApiResponseMeta | null = null,
  statusCode = 200
) {
  const body: ApiResponse<T> = {
    data,
    meta,
    error: null,
    requestId,
  };
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
    },
    body: JSON.stringify(body),
  };
}

export function buildErrorResponse(
  code: string,
  message: string,
  requestId: string,
  statusCode = 400,
  details?: Record<string, unknown>
) {
  const body: ApiResponse<null> = {
    data: null,
    meta: null,
    error: {
      code,
      message,
      details,
    },
    requestId,
  };
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
    },
    body: JSON.stringify(body),
  };
}
