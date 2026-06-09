import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../services/db/database.service';
import { DEFAULT_USER_SETTINGS, type UserSettings } from '../types';

// Compte utilisateur. Les préférences sont stockées dans une unique colonne JSON `settings`
// (cohérent avec l'usage de DataTypes.JSON ailleurs, et sans friction de migration).
interface UserAttributes {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  token_version: number;
  settings: UserSettings;
  created_at: Date;
}

type UserCreationAttributes = Optional<
  UserAttributes,
  'id' | 'display_name' | 'avatar_url' | 'bio' | 'token_version' | 'settings' | 'created_at'
>;

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: string;
  declare email: string;
  declare password_hash: string;
  declare display_name: string | null;
  declare avatar_url: string | null;
  declare bio: string | null;
  declare token_version: number;
  declare settings: UserSettings;
  declare created_at: Date;

  // Représentation publique : ne fuite jamais le hash du mot de passe.
  toPublic(): {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    createdAt: Date;
  } {
    return {
      id: this.id,
      email: this.email,
      displayName: this.display_name,
      avatarUrl: this.avatar_url,
      bio: this.bio,
      createdAt: this.created_at,
    };
  }

  // Préférences fusionnées avec les valeurs par défaut (forward-compatible).
  resolvedSettings(): UserSettings {
    return {
      appearance: { ...DEFAULT_USER_SETTINGS.appearance, ...this.settings?.appearance },
      analysis: { ...DEFAULT_USER_SETTINGS.analysis, ...this.settings?.analysis },
    };
  }
}

User.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING, allowNull: false },
    display_name: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    avatar_url: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    bio: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    token_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    settings: { type: DataTypes.JSON, allowNull: false, defaultValue: DEFAULT_USER_SETTINGS },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'user',
    timestamps: false,
  }
);

export default User;
