/**
 * Issues a development token for an existing user.
 *
 *   npm run token:dev -- demo_admin
 *   npm run token:dev -- demo_dev_market 86400
 *
 * V1 has no Pi login yet; this script plays the role of the trusted issuer.
 * Never use it to hand out tokens in production.
 */
import { disconnectPrisma, getPrisma, loadDotEnv } from '@pi/database';
import { signToken } from '../src/auth/jwt';
import { loadEnv } from '../src/config/env';

const [username, ttlArg] = process.argv.slice(2);
if (!username) {
  console.error('Usage: npm run token:dev -- <piUsername> [ttlSeconds]');
  process.exit(1);
}

loadDotEnv();
const env = loadEnv();
if (env.NODE_ENV === 'production') {
  console.error('Refusing to issue development tokens with NODE_ENV=production.');
  process.exit(1);
}

const user = await getPrisma().user.findUnique({ where: { piUsername: username } });
await disconnectPrisma();
if (!user) {
  console.error(`No user "${username}". Demo users: demo_admin, demo_dev_market, demo_user_01 …`);
  process.exit(1);
}
console.log(signToken(user.id, env.JWT_SECRET, env.JWT_ISSUER, Number(ttlArg ?? 3600)));
