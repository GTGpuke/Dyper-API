// Clé d'API d'un développeur (accès programmatique à l'API publique Dyper).
// Le secret n'est JAMAIS stocké en clair : on conserve son empreinte SHA-256 (`key_hash`) et un
// préfixe affichable (`key_prefix`) pour l'identifier dans l'interface. Le secret complet n'est
// montré qu'une seule fois, à la création.
import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../services/db/database.service';
import type { ApiKeyView } from '../types';

interface ApiKeyAttributes {
  id: string;
  user_id: string;
  name: string;
  /** Préfixe affichable (ex. « dyk_live_a1b2c3d4 »). */
  key_prefix: string;
  /** Empreinte SHA-256 (hex) de la clé complète — sert à l'authentification. */
  key_hash: string;
  last_used_at: Date | null;
  /** Date de révocation ; une clé révoquée n'authentifie plus. */
  revoked_at: Date | null;
  created_at: Date;
}

type ApiKeyCreationAttributes = Optional<
  ApiKeyAttributes,
  'id' | 'last_used_at' | 'revoked_at' | 'created_at'
>;

class ApiKey extends Model<ApiKeyAttributes, ApiKeyCreationAttributes> implements ApiKeyAttributes {
  declare id: string;
  declare user_id: string;
  declare name: string;
  declare key_prefix: string;
  declare key_hash: string;
  declare last_used_at: Date | null;
  declare revoked_at: Date | null;
  declare created_at: Date;

  /** Vue publique : jamais le hash ni le secret. */
  toPublic(): ApiKeyView {
    return {
      id: this.id,
      name: this.name,
      prefix: this.key_prefix,
      lastUsedAt: this.last_used_at ? this.last_used_at.toISOString() : null,
      createdAt: this.created_at.toISOString(),
    };
  }
}

ApiKey.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    user_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(80), allowNull: false },
    key_prefix: { type: DataTypes.STRING(40), allowNull: false },
    key_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    last_used_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    revoked_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'api_key',
    timestamps: false,
  }
);

export default ApiKey;
