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

export interface Category {
  id: string;
  name?: string;
  _order?: number;
}

export interface Group {
  id: string;
  name?: string;
  categoryId?: string;
  _order?: number;
}

export interface EnrichedGroup extends Group {
  fullName: string;
  category?: Category;
}

export interface Dancer {
  id: string;
  firstName?: string;
  lastName?: string;
  number?: number;
  groupId?: string;
  location?: string;
  image?: string;
  _order?: number;
}

export interface EnrichedDancer extends Dancer {
  fullName: string;
  group?: EnrichedGroup;
}

export const dancerFullName = (d: Pick<Dancer, 'firstName' | 'lastName'>) =>
  `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim();

export const groupFullName = (g: Group, category?: Category) =>
  `${category?.name ?? ''} ${g.name ?? ''}`.trim();
