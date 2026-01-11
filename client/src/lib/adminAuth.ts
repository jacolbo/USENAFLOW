export function getAdminHeaders(role: string, userId: string): Record<string, string> {
  return {
    "X-Usena-Role": role,
    "X-Usena-User-Id": userId,
  };
}
