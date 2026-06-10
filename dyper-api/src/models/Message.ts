import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../services/db/database.service';
import type { MessageKind, MessageRole } from '../types';

// Message d'une conversation : texte libre (user ou assistant) ou carte d'analyse (assistant).
interface MessageAttributes {
  id: string;
  conversation_id: string;
  // Dénormalisé : permet purge et cloisonnement en une requête, sans jointure.
  user_id: string;
  role: MessageRole;
  kind: MessageKind;
  content: string;
  attachment_name: string | null;
  analysis_request_id: string | null;
  // Ordre fiable dans la conversation (created_at peut entrer en collision à la milliseconde).
  seq: number;
  created_at: Date;
}

type MessageCreationAttributes = Optional<
  MessageAttributes,
  'id' | 'content' | 'attachment_name' | 'analysis_request_id' | 'created_at'
>;

class Message
  extends Model<MessageAttributes, MessageCreationAttributes>
  implements MessageAttributes
{
  declare id: string;
  declare conversation_id: string;
  declare user_id: string;
  declare role: MessageRole;
  declare kind: MessageKind;
  declare content: string;
  declare attachment_name: string | null;
  declare analysis_request_id: string | null;
  declare seq: number;
  declare created_at: Date;
}

Message.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    conversation_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false },
    role: { type: DataTypes.STRING, allowNull: false },
    kind: { type: DataTypes.STRING, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    attachment_name: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    analysis_request_id: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    seq: { type: DataTypes.INTEGER, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'message',
    timestamps: false,
    indexes: [
      { fields: ['conversation_id', 'seq'] },
      { fields: ['user_id'] },
      { fields: ['analysis_request_id'] },
    ],
  }
);

export default Message;
