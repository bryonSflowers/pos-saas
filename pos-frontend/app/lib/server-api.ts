// Server-side API base (used in Route Handlers and Server Actions)
export const SERVER_API_BASE =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";
