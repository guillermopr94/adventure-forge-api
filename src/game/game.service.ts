import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GameSave, GameSaveDocument } from '../schemas/game-save.schema';

@Injectable()
export class GameService {
    constructor(@InjectModel(GameSave.name) private gameSaveModel: Model<GameSaveDocument>) { }

    async saveGame(userId: string, saveData: Partial<GameSave> & { _id?: string }) {
        console.log(`[GameService] Saving game for user ${userId}. ID: ${saveData._id}`);
        console.log(`[GameService] Data Payload:`, JSON.stringify(saveData).substring(0, 200) + "...");

        if (saveData._id) {
            // Update existing save
            console.log(`[GameService] Updating existing save ${saveData._id}`);
            return this.gameSaveModel.findByIdAndUpdate(
                saveData._id,
                { ...saveData, userId }, // Ensure userId is preserved/set
                { new: true }
            );
        } else {
            // Create new save
            console.log(`[GameService] Creating new save`);
            const newSave = new this.gameSaveModel({ ...saveData, userId });
            const result = await newSave.save();
            console.log(`[GameService] Save complete. New ID: ${result._id}`);
            return result;
        }
    }

    async listGames(userId: string) {
        console.log(`[GameService] Listing games for user ${userId}`);
        const results = await this.gameSaveModel.find({ userId }).sort({ updatedAt: -1 }).select('_id genreKey updatedAt createdAt');
        console.log(`[GameService] Found ${results.length} games`);
        return results;
    }

    async loadGame(saveId: string, userId: string) {
        return this.gameSaveModel.findOne({ _id: saveId, userId });
    }

    async deleteSave(saveId: string, userId: string) {
        return this.gameSaveModel.findOneAndDelete({ _id: saveId, userId });
    }
}
