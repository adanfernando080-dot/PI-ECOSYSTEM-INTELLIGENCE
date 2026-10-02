/**
 * Category taxonomy: a shared classification of applications, NOT demo data.
 * Single source of truth for the DEMO seed and for `db:bootstrap`. Slugs must
 * cover every category referenced by the discovery intents
 * (packages/shared/src/intents.ts).
 */
export interface TaxonomyCategory {
  name: string;
  slug: string;
  description: string;
}

export const TAXONOMY_CATEGORIES: readonly TaxonomyCategory[] = [
  { name: 'Marketplace', slug: 'marketplace', description: 'Buy and sell goods between Pioneers.' },
  { name: 'Jobs', slug: 'jobs', description: 'Find work or hire Pioneers.' },
  { name: 'Education', slug: 'education', description: 'Courses and learning resources.' },
  { name: 'Games', slug: 'games', description: 'Games and entertainment.' },
  { name: 'Services', slug: 'services', description: 'Professional and personal services.' },
  { name: 'AI', slug: 'ai', description: 'AI-powered tools.' },
  { name: 'Travel', slug: 'travel', description: 'Travel booking and experiences.' },
  { name: 'Shopping', slug: 'shopping', description: 'Online stores.' },
  { name: 'Tools', slug: 'tools', description: 'Utilities for Pioneers.' },
  { name: 'Social', slug: 'social', description: 'Social networks and communities.' },
  { name: 'Payments', slug: 'payments', description: 'Payment utilities.' },
  { name: 'Creator', slug: 'creator', description: 'Tools for content creators.' },
];
