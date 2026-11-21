export interface VerifiedGym {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export const VERIFIED_GYMS: VerifiedGym[] = [
  {
    id: 'partner_axioms_fitness_anaheim',
    name: 'Axioms Fitness',
    address: '5628 E La Palma Ave, Anaheim, CA 92807',
    latitude: 33.85877397760535,
    longitude: -117.79206834908676,
  },
  {
    id: 'manual_vim_vigor_lompoc',
    name: 'Vim + Vigor Fitness',
    address: '501 W Central Ave, Lompoc, CA 93436',
    latitude: 34.66268,
    longitude: -120.46341,
  },
];
