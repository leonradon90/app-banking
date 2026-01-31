import { AppDataSource } from '../data-source';

AppDataSource.initialize()
  .then(async () => {
    await AppDataSource.runMigrations();
    await AppDataSource.destroy();
    console.log('Migrations executed successfully');
  })
  .catch(async (error) => {
    console.error('Migration run failed', error);
    await AppDataSource.destroy();
    process.exit(1);
  });
