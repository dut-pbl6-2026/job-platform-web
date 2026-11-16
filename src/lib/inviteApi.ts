import { api } from "./api";

/**
 * An issued recruiter invite code. `code` is shown once and is bound to one email address
 * (SRS AUTH-01-09, AUTH-01-15); the server keeps only its hash. `email` is the address the code
 * was issued to, echoed back so the creator can send the code to the right person.
 */
export type IssuedInviteCode = { id: string; code: string; email: string; expiresAt: string };

/**
 * Creator-only. The server answers 403 when the caller did not create the company and
 * 422 INVITE_EMAIL_INVALID for a missing or malformed address.
 */
export async function createInviteCode(companyId: string, email: string): Promise<IssuedInviteCode> {
  const { data } = await api.post(`/companies/${companyId}/invite-codes`, { email });
  return data as IssuedInviteCode;
}
