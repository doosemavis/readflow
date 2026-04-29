import { useAuth } from "../contexts/AuthContext";

export function useRoleGate() {
  const { role, permissions } = useAuth();
  return {
    isAdmin: role === "admin",
    isElevated: role === "elevated" || role === "admin",
    canManageUsers: permissions.canManageUsers,
    canBypassPaywall: permissions.canBypassPaywall,
    uploadLimit: permissions.uploadLimit,
  };
}
