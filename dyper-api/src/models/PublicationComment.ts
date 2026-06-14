import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../services/db/database.service';

// Commentaire en fil sur une publication (`parent_id` non nul = réponse). `hidden` masque un
// commentaire signalé sans le supprimer (auto-masquage au-delà d'un seuil de signalements).
interface PublicationCommentAttributes {
  id: string;
  publication_id: string;
  user_id: string;
  parent_id: string | null;
  author_name: string;
  author_avatar: string | null;
  body: string;
  hidden: boolean;
  created_at: Date;
}

type PublicationCommentCreationAttributes = Optional<
  PublicationCommentAttributes,
  'id' | 'parent_id' | 'author_avatar' | 'hidden' | 'created_at'
>;

class PublicationComment
  extends Model<PublicationCommentAttributes, PublicationCommentCreationAttributes>
  implements PublicationCommentAttributes
{
  declare id: string;
  declare publication_id: string;
  declare user_id: string;
  declare parent_id: string | null;
  declare author_name: string;
  declare author_avatar: string | null;
  declare body: string;
  declare hidden: boolean;
  declare created_at: Date;

  // Représentation publique (jamais d'identifiant utilisateur).
  toPublic(): {
    id: string;
    parentId: string | null;
    author: { name: string; avatar: string | null };
    body: string;
    createdAt: Date;
  } {
    return {
      id: this.id,
      parentId: this.parent_id,
      author: { name: this.author_name, avatar: this.author_avatar },
      body: this.body,
      createdAt: this.created_at,
    };
  }
}

PublicationComment.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    publication_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false },
    parent_id: { type: DataTypes.UUID, allowNull: true, defaultValue: null },
    author_name: { type: DataTypes.STRING, allowNull: false },
    author_avatar: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    body: { type: DataTypes.TEXT, allowNull: false },
    hidden: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'publication_comment',
    timestamps: false,
    indexes: [{ fields: ['publication_id'] }],
  }
);

export default PublicationComment;
