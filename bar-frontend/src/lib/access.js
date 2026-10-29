import navigation from "./accessNavigation.json";
export function canAccess(user, permission) {
  if (!permission) return true;
  if (!user) return false;
  if (user.master) return true;
  if (user.support)
    return /\.(view|read|menu|report|export|ranking|financial|print)$/.test(
      permission,
    );
  if (user.access?.mode !== "restricted") return true;
  return user.access.permissions.includes(permission);
}
export function canNavigate(user, path) {
  const p = path.replace(/\/$/, "") || "/";
  return !navigation[p] || canAccess(user, navigation[p]);
}
