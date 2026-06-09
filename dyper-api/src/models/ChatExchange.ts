import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../services/db/database.service';

// Historique d'un échange de chat LLM lié (optionnellement) à une analyse via request_id.
interface ChatExchangeAttributes {
  id: string;
  analysis_request_id: string | null;
  question: string;
  answer: string;
  lang: string;
  model: string;
  created_at: Date;
}

type ChatExchangeCreationAttributes = Optional<
  ChatExchangeAttributes,
  'id' | 'analysis_request_id' | 'created_at'
>;

class ChatExchange
  extends Model<ChatExchangeAttributes, ChatExchangeCreationAttributes>
  implements ChatExchangeAttributes
{
  declare id: string;
  declare analysis_request_id: string | null;
  declare question: string;
  declare answer: string;
  declare lang: string;
  declare model: string;
  declare created_at: Date;
}

ChatExchange.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    analysis_request_id: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    question: { type: DataTypes.TEXT, allowNull: false },
    answer: { type: DataTypes.TEXT, allowNull: false },
    lang: { type: DataTypes.STRING, allowNull: false, defaultValue: 'fr' },
    model: { type: DataTypes.STRING, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'chat_exchange',
    timestamps: false,
  }
);

export default ChatExchange;
