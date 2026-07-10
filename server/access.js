// Pure access-decision logic, kept separate from the Discord API calls and
// route wiring so the rule itself ("who is let in") is easy to read and test
// in isolation: PP Holder role, or either optional bypass role (Admin/Team).
export function decideAccess(memberRoleIds, { ppHolderRoleId, adminRoleId, teamRoleId }) {
  const roleIds = Array.isArray(memberRoleIds) ? memberRoleIds : []

  if (ppHolderRoleId && roleIds.includes(ppHolderRoleId)) {
    return { granted: true, reason: 'granted' }
  }
  if (adminRoleId && roleIds.includes(adminRoleId)) {
    return { granted: true, reason: 'granted' }
  }
  if (teamRoleId && roleIds.includes(teamRoleId)) {
    return { granted: true, reason: 'granted' }
  }

  return { granted: false, reason: 'missing_role' }
}
