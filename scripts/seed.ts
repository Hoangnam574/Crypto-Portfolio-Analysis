import { getDb, closeDb } from '../src/db/client';
import { seedDatabase } from '../src/db/seed';

async function main() {
  console.log('Running manual database seed...');
  const db = await getDb();
  await seedDatabase(db, true);
  await closeDb();
  console.log('Manual seed completed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
