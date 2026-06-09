// Définit les associations entre modèles et expose les modèles initialisés.
// Importé par server.ts avant le démarrage afin que toutes les définitions soient enregistrées.
import Analysis from './Analysis';
import ChatExchange from './ChatExchange';
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

export { Analysis, ChatExchange, User };
