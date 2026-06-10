// Définit les associations entre modèles et expose les modèles initialisés.
// Importé par server.ts avant le démarrage afin que toutes les définitions soient enregistrées.
import Analysis from './Analysis';
import ChatExchange from './ChatExchange';
import Conversation from './Conversation';
import Message from './Message';
import User from './User';

// Un échange de chat est rattaché à une analyse par son request_id (lien souple, sans contrainte FK
// stricte pour rester compatible avec sync({ alter: true }) sous SQLite).
Analysis.hasMany(ChatExchange, {
  foreignKey: 'analysis_request_id',
  sourceKey: 'request_id',
  constraints: false,
  as: 'chatExchanges',
});
ChatExchange.belongsTo(Analysis, {
  foreignKey: 'analysis_request_id',
  targetKey: 'request_id',
  constraints: false,
  as: 'analysis',
});

// Un utilisateur possède ses analyses et ses échanges de chat (lien souple, sans contrainte FK
// stricte pour rester compatible avec sync({ alter: true }) sous SQLite).
User.hasMany(Analysis, { foreignKey: 'user_id', constraints: false, as: 'analyses' });
Analysis.belongsTo(User, { foreignKey: 'user_id', constraints: false, as: 'user' });
User.hasMany(ChatExchange, { foreignKey: 'user_id', constraints: false, as: 'chatExchanges' });
ChatExchange.belongsTo(User, { foreignKey: 'user_id', constraints: false, as: 'user' });

// Conversations et messages (fil de discussion façon claude.ai), liens souples sans FK stricte.
User.hasMany(Conversation, { foreignKey: 'user_id', constraints: false, as: 'conversations' });
Conversation.belongsTo(User, { foreignKey: 'user_id', constraints: false, as: 'user' });
Conversation.hasMany(Message, {
  foreignKey: 'conversation_id',
  constraints: false,
  as: 'messages',
});
Message.belongsTo(Conversation, {
  foreignKey: 'conversation_id',
  constraints: false,
  as: 'conversation',
});
Message.belongsTo(Analysis, {
  foreignKey: 'analysis_request_id',
  targetKey: 'request_id',
  constraints: false,
  as: 'analysis',
});
Analysis.hasMany(Message, {
  foreignKey: 'analysis_request_id',
  sourceKey: 'request_id',
  constraints: false,
  as: 'messages',
});

export { Analysis, ChatExchange, Conversation, Message, User };
