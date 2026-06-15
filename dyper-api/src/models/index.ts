// Définit les associations entre modèles et expose les modèles initialisés.
// Importé par server.ts avant le démarrage afin que toutes les définitions soient enregistrées.
import Analysis from './Analysis';
import ApiKey from './ApiKey';
import ChatExchange from './ChatExchange';
import Conversation from './Conversation';
import Message from './Message';
import Publication from './Publication';
import PublicationComment from './PublicationComment';
import PublicationReport from './PublicationReport';
import PublicationVote from './PublicationVote';
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

// Clés d'API d'un utilisateur (accès programmatique), lien souple sans FK stricte.
User.hasMany(ApiKey, { foreignKey: 'user_id', constraints: false, as: 'apiKeys' });
ApiKey.belongsTo(User, { foreignKey: 'user_id', constraints: false, as: 'user' });

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

// Feed public « Global » : publications, votes, commentaires, signalements (liens souples sans FK).
User.hasMany(Publication, { foreignKey: 'user_id', constraints: false, as: 'publications' });
Publication.belongsTo(User, { foreignKey: 'user_id', constraints: false, as: 'user' });
Analysis.hasOne(Publication, {
  foreignKey: 'analysis_id',
  sourceKey: 'id',
  constraints: false,
  as: 'publication',
});
Publication.belongsTo(Analysis, {
  foreignKey: 'analysis_id',
  targetKey: 'id',
  constraints: false,
  as: 'analysis',
});
Publication.hasMany(PublicationComment, {
  foreignKey: 'publication_id',
  constraints: false,
  as: 'comments',
});
Publication.hasMany(PublicationVote, {
  foreignKey: 'publication_id',
  constraints: false,
  as: 'votes',
});

export {
  Analysis,
  ApiKey,
  ChatExchange,
  Conversation,
  Message,
  Publication,
  PublicationComment,
  PublicationReport,
  PublicationVote,
  User,
};
