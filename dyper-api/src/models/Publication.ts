import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../services/db/database.service';
import type { AnalyzeType, PublicationPayload, PublicVote } from '../types';

// Publication d'une analyse au feed public « Global ». Le contenu d'affichage est figé dans
// `payload` (snapshot indépendant de l'analyse privée et des questions de suivi/chat). Le média
// est servi publiquement par `public_slug` (mappé sur les fichiers disque via `request_id`).
interface PublicationAttributes {
  id: string;
  public_slug: string;
  request_id: string;
  analysis_id: string;
  user_id: string;
  author_name: string;
  author_avatar: string | null;
  caption: string | null;
  type: AnalyzeType;
  payload: PublicationPayload;
  has_thumbnail: boolean;
  has_video: boolean;
  moderation_rating: string;
  upvotes: number;
  downvotes: number;
  score: number;
  comment_count: number;
  hidden: boolean;
  created_at: Date;
}

type PublicationCreationAttributes = Optional<
  PublicationAttributes,
  | 'id'
  | 'author_avatar'
  | 'caption'
  | 'upvotes'
  | 'downvotes'
  | 'score'
  | 'comment_count'
  | 'hidden'
  | 'created_at'
>;

class Publication
  extends Model<PublicationAttributes, PublicationCreationAttributes>
  implements PublicationAttributes
{
  declare id: string;
  declare public_slug: string;
  declare request_id: string;
  declare analysis_id: string;
  declare user_id: string;
  declare author_name: string;
  declare author_avatar: string | null;
  declare caption: string | null;
  declare type: AnalyzeType;
  declare payload: PublicationPayload;
  declare has_thumbnail: boolean;
  declare has_video: boolean;
  declare moderation_rating: string;
  declare upvotes: number;
  declare downvotes: number;
  declare score: number;
  declare comment_count: number;
  declare hidden: boolean;
  declare created_at: Date;

  // Représentation publique (jamais d'identifiants internes : ni user_id, ni request_id).
  // Le média se charge via le slug public. `myVote` est le vote de l'utilisateur courant (0 si anonyme).
  toPublic(myVote: PublicVote = 0): {
    id: string;
    slug: string;
    type: AnalyzeType;
    caption: string | null;
    author: { name: string; avatar: string | null };
    payload: PublicationPayload;
    hasThumbnail: boolean;
    hasVideo: boolean;
    upvotes: number;
    downvotes: number;
    score: number;
    commentCount: number;
    myVote: PublicVote;
    createdAt: Date;
  } {
    return {
      id: this.id,
      slug: this.public_slug,
      type: this.type,
      caption: this.caption,
      author: { name: this.author_name, avatar: this.author_avatar },
      payload: this.payload,
      hasThumbnail: this.has_thumbnail,
      hasVideo: this.has_video,
      upvotes: this.upvotes,
      downvotes: this.downvotes,
      score: this.score,
      commentCount: this.comment_count,
      myVote,
      createdAt: this.created_at,
    };
  }
}

Publication.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    public_slug: { type: DataTypes.STRING, allowNull: false, unique: true },
    request_id: { type: DataTypes.STRING, allowNull: false },
    analysis_id: { type: DataTypes.UUID, allowNull: false, unique: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    author_name: { type: DataTypes.STRING, allowNull: false },
    author_avatar: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    caption: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    type: { type: DataTypes.STRING, allowNull: false },
    payload: { type: DataTypes.JSON, allowNull: false },
    has_thumbnail: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    has_video: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    moderation_rating: { type: DataTypes.STRING, allowNull: false, defaultValue: 'safe' },
    upvotes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    downvotes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    score: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    comment_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    hidden: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'publication',
    timestamps: false,
  }
);

export default Publication;
