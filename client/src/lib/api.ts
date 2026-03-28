const BASE = "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Request failed" }));

    // 402 = billing suspended — redirect PM to settings billing tab
    if (res.status === 402 && (data.error === "billing_suspended" || data.error?.code === "billing_suspended")) {
      if (!window.location.pathname.includes("/portal/settings")) {
        window.location.href = "/portal/settings?tab=billing&locked=true";
      }
    }

    const errorMsg = typeof data.error === "string" ? data.error : data.error?.message || data.message || `Request failed with status ${res.status}`;
    const err: any = new Error(errorMsg);
    if (data.details) err.details = data.details;
    err.status = res.status;
    throw err;
  }

  return res.json();
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: any) =>
    request<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body?: any) =>
    request<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(url: string, body?: any) =>
    request<T>(url, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};
