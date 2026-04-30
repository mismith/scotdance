export interface CompetitionLink {
  name?: string;
  url: string;
}

export interface Competition {
  name?: string;
  date?: number;
  description?: string;
  image?: string;
  venue?: string;
  address?: string;
  location?: string;
  registrationURL?: string;
  registrationStart?: number;
  registrationEnd?: number;
  links?: CompetitionLink[];
  sobhd?: string;
  listed?: boolean;
  published?: boolean;
}

export interface StaffMember {
  id: string;
  firstName?: string;
  lastName?: string;
  type?: string;
  image?: string;
  description?: string;
  location?: string;
  website?: string;
  _order?: number;
}

export const staffMemberName = (m: StaffMember) =>
  `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim();
