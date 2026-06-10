import sequelize, { ensureColumn } from '../../../src/services/db/database.service';

// Liste les noms de colonnes d'une table SQLite.
async function columns(table: string): Promise<string[]> {
  const [rows] = await sequelize.query(`PRAGMA table_info(\`${table}\`)`);
  return (rows as Array<{ name: string }>).map((c) => c.name);
}

describe('ensureColumn (migration additive SQLite)', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    await sequelize.query('CREATE TABLE IF NOT EXISTS test_ensure (id INTEGER PRIMARY KEY)');
  });

  afterAll(async () => {
    await sequelize.query('DROP TABLE IF EXISTS test_ensure');
  });

  it('ajoute une colonne absente', async () => {
    await ensureColumn('test_ensure', 'extra', 'VARCHAR(50) DEFAULT NULL');
    expect(await columns('test_ensure')).toContain('extra');
  });

  it('est idempotente (deuxième appel sans erreur ni doublon)', async () => {
    await ensureColumn('test_ensure', 'extra', 'VARCHAR(50) DEFAULT NULL');
    const cols = await columns('test_ensure');
    expect(cols.filter((c) => c === 'extra')).toHaveLength(1);
  });

  it("ne fait rien si la table n'existe pas", async () => {
    await expect(ensureColumn('table_inconnue', 'x', 'TEXT')).resolves.toBeUndefined();
    expect(await columns('table_inconnue')).toHaveLength(0);
  });
});
