/** job-svc CompanyDetailDto. Every field except id and name can be absent. */
export interface CompanyDetail {
  id: string;
  name: string;
  taxCode?: string | null;
  verified: boolean;
  logoUrl?: string | null;
  website?: string | null;
  description?: string | null;
  address?: string | null;
  industry?: string | null;
  size?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** job-svc GET /api/companies/mine: the signed-in recruiter's company plus the company role flag. */
export interface MyCompany {
  company: CompanyDetail;
  isCompanyAdmin: boolean;
}

/** Body of PUT /api/companies/{id} (job-svc CompanyUpdateDto). */
export interface CompanyUpdate {
  name: string;
  taxCode?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  description?: string | null;
  address?: string | null;
  industry?: string | null;
  size?: string | null;
}
