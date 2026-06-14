import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../services/db/database.service';

// Signalement par un utilisateur d'une publication ou d'un commentaire. Un seul signalement par
// (cible, utilisateur) ; au-delà d'un seuil, la cible est auto-masquée.
interface PublicationReportAttributes {
  id: string;
  target_type: 'publication' | 'comment';
  target_id: string;
  user_id: string;
  reason: string;
  created_at: Date;
}

type PublicationReportCreationAttributes = Optional<
  PublicationReportAttributes,
  'id' | 'created_at'
>;

class PublicationReport
  extends Model<PublicationReportAttributes, PublicationReportCreationAttributes>
  implements PublicationReportAttributes
{
  declare id: string;
  declare target_type: 'publication' | 'comment';
  declare target_id: string;
  declare user_id: string;
  declare reason: string;
  declare created_at: Date;
}

PublicationReport.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    target_type: { type: DataTypes.STRING, allowNull: false },
    target_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false },
    reason: { type: DataTypes.STRING, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'publication_report',
    timestamps: false,
    indexes: [{ unique: true, fields: ['target_type', 'target_id', 'user_id'] }],
  }
);

export default PublicationReport;
