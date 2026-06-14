import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../services/db/database.service';

// Vote (+1 / -1) d'un utilisateur sur une publication. Un seul vote par (publication, utilisateur).
interface PublicationVoteAttributes {
  id: string;
  publication_id: string;
  user_id: string;
  value: number;
  created_at: Date;
}

type PublicationVoteCreationAttributes = Optional<PublicationVoteAttributes, 'id' | 'created_at'>;

class PublicationVote
  extends Model<PublicationVoteAttributes, PublicationVoteCreationAttributes>
  implements PublicationVoteAttributes
{
  declare id: string;
  declare publication_id: string;
  declare user_id: string;
  declare value: number;
  declare created_at: Date;
}

PublicationVote.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    publication_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false },
    value: { type: DataTypes.INTEGER, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'publication_vote',
    timestamps: false,
    indexes: [{ unique: true, fields: ['publication_id', 'user_id'] }],
  }
);

export default PublicationVote;
