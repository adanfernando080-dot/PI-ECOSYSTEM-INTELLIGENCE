/** Politique de sécurité du contenu de l'application : tout est local ; aucun script/ressource externe ; pas d'eval. */
export const CSP = [
  "default-src 'none'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self'",
  "connect-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'", "worker-src 'self' blob:",
].join('; ');
