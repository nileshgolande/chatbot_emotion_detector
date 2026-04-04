/**
 * Display name for greetings: username, email local-part, or fallback.
 * @param {object | null | undefined} user
 * @returns {string}
 */
export function greetingName(user) {
  if (!user) return "there";
  const raw =
    (typeof user.username === "string" && user.username.trim()) ||
    (typeof user.email === "string" && user.email.split("@")[0]?.trim()) ||
    "";
  if (!raw) return "there";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
