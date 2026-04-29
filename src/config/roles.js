export const ROLES = {
  user:     { label: "User",     uploadLimit: 3,        canManageUsers: false, canBypassPaywall: false },
  elevated: { label: "Elevated", uploadLimit: 10,       canManageUsers: false, canBypassPaywall: false },
  admin:    { label: "Admin",    uploadLimit: Infinity,  canManageUsers: true,  canBypassPaywall: true  },
};

export function getRolePermissions(role) {
  return ROLES[role] ?? ROLES.user;
}
