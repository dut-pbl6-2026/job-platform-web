import { api } from "./api";

/** An issued recruiter invite code. `code` is shown once; the server keeps only its hash (SRS AUTH-01-09). */
export type IssuedInviteCode = { id: string; code: string; expiresAt: string };

/** Creator-only. The server answers 403 when the caller did not create the company. */
export async function createInviteCode(companyId: string): Promise<IssuedInviteCode> {
  const { data } = await api.post(`/companies/${companyId}/invite-codes`);
  return data as IssuedInviteCode;
}
