import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../services/db/database.service';

// Titre par défaut d'une conversation nouvellement créée (remplacé par l'auto-titre).
export const DEFAULT_CONVERSATION_TITLE = 'Nouvelle conversation';

// Conversation persistante d'un utilisateur (fil de messages façon claude.ai).
interface ConversationAttributes {
  id: string;
  user_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
}

type ConversationCreationAttributes = Optional<
  ConversationAttributes,
  'id' | 'title' | 'created_at' | 'updated_at'
>;

class Conversation
  extends Model<ConversationAttributes, ConversationCreationAttributes>
  implements ConversationAttributes
{
  declare id: string;
  declare user_id: string;
  declare title: string;
  declare created_at: Date;
  declare updated_at: Date;

  // Représentation publique renvoyée au client.
  toPublic(): { id: string; title: string; createdAt: Date; updatedAt: Date } {
    return {
      id: this.id,
      title: this.title,
      createdAt: this.created_at,
      updatedAt: this.updated_at,
    };
  }
}

Conversation.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    user_id: { type: DataTypes.UUID, allowNull: false },
    title: {
      type: DataTypes.STRING(120),
      allowNull: false,
      defaultValue: DEFAULT_CONVERSATION_TITLE,
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    // updated_at est maintenu manuellement (convention timestamps:false du projet).
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'conversation',
    timestamps: false,
    indexes: [{ fields: ['user_id', 'updated_at'] }],
  }
);

export default Conversation;
