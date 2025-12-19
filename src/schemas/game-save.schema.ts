import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GameSaveDocument = GameSave & Document;

@Schema({ timestamps: true })
export class GameSave {
    @Prop({ required: true, index: true })
    userId: string; // Corresponds to user.googleId

    @Prop({ required: true })
    genreKey: string;

    @Prop({ type: Array, required: true })
    gameHistory: Record<string, any>[]; // Array of { role: string, parts: [...] }

    @Prop({ type: [String], required: true })
    gameContent: string[];

    @Prop({ type: [String], default: [] })
    currentOptions: string[];

    @Prop()
    currentImage: string;
}

export const GameSaveSchema = SchemaFactory.createForClass(GameSave);
