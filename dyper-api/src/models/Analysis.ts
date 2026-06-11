import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../services/db/database.service';
import type {
  AnalyzeType,
  Chapter,
  DetectedObject,
  FrameDetections,
  MusicInfo,
  TimelineEntry,
  TranscriptSegment,
} from '../types';

// Historique d'une analyse traitée par la passerelle (une ligne par requête /api/analyze*).
interface AnalysisAttributes {
  id: string;
  request_id: string;
  user_id: string | null;
  type: AnalyzeType;
  lang: string;
  model: string;
  processing_time_ms: number;
  description: string;
  scene_label: string;
  scene_confidence: number;
  indoor: boolean | null;
  objects_count: number;
  tags: string[];
  colors: string[];
  thumbnail_path: string | null;
  timeline: TimelineEntry[] | null;
  objects: DetectedObject[] | null;
  source_width: number | null;
  source_height: number | null;
  audio_transcript: string | null;
  video_path: string | null;
  frame_detections: FrameDetections[] | null;
  music: MusicInfo | null;
  transcript_segments: TranscriptSegment[] | null;
  chapters: Chapter[] | null;
  created_at: Date;
}

type AnalysisCreationAttributes = Optional<
  AnalysisAttributes,
  | 'id'
  | 'user_id'
  | 'indoor'
  | 'thumbnail_path'
  | 'timeline'
  | 'objects'
  | 'source_width'
  | 'source_height'
  | 'audio_transcript'
  | 'video_path'
  | 'frame_detections'
  | 'music'
  | 'transcript_segments'
  | 'chapters'
  | 'created_at'
>;

class Analysis
  extends Model<AnalysisAttributes, AnalysisCreationAttributes>
  implements AnalysisAttributes
{
  declare id: string;
  declare request_id: string;
  declare user_id: string | null;
  declare type: AnalyzeType;
  declare lang: string;
  declare model: string;
  declare processing_time_ms: number;
  declare description: string;
  declare scene_label: string;
  declare scene_confidence: number;
  declare indoor: boolean | null;
  declare objects_count: number;
  declare tags: string[];
  declare colors: string[];
  declare thumbnail_path: string | null;
  declare timeline: TimelineEntry[] | null;
  declare objects: DetectedObject[] | null;
  declare source_width: number | null;
  declare source_height: number | null;
  declare audio_transcript: string | null;
  declare video_path: string | null;
  declare frame_detections: FrameDetections[] | null;
  declare music: MusicInfo | null;
  declare transcript_segments: TranscriptSegment[] | null;
  declare chapters: Chapter[] | null;
  declare created_at: Date;
}

Analysis.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    request_id: { type: DataTypes.STRING, allowNull: false, unique: true },
    user_id: { type: DataTypes.UUID, allowNull: true, defaultValue: null },
    type: { type: DataTypes.STRING, allowNull: false },
    lang: { type: DataTypes.STRING, allowNull: false, defaultValue: 'fr' },
    model: { type: DataTypes.STRING, allowNull: false },
    processing_time_ms: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    description: { type: DataTypes.TEXT, allowNull: false },
    scene_label: { type: DataTypes.STRING, allowNull: false },
    scene_confidence: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    indoor: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: null },
    objects_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    tags: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    colors: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    thumbnail_path: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    timeline: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    objects: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    source_width: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    source_height: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    audio_transcript: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    video_path: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    frame_detections: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    music: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    transcript_segments: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    chapters: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'analysis',
    timestamps: false,
  }
);

export default Analysis;
