import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GameSave, GameSaveDocument } from '../schemas/game-save.schema';

import { AiService } from '../ai/ai.service';

@Injectable()
export class GameService {
    constructor(
        // MongoDB disabled until we have a valid cluster
        // @InjectModel(GameSave.name) private gameSaveModel: Model<GameSaveDocument>,
        private aiService: AiService
    ) { }

    // MongoDB endpoints temporarily disabled - will be re-enabled once we have a valid cluster
    // async saveGame(userId: string, saveData: Partial<GameSave> & { _id?: string }) {
    //     console.log(`[GameService] Saving game for user ${userId}. ID: ${saveData._id}`);
    //     if (saveData.currentImages) {
    //         console.log(`[GameService] Saving ${saveData.currentImages.length} cinematic images.`);
    //     }

    //     if (saveData._id) {
    //         console.log(`[GameService] Updating existing save ${saveData._id}`);
    //         return this.gameSaveModel.findByIdAndUpdate(
    //             saveData._id,
    //             { ...saveData, userId },
    //             { new: true }
    //         );
    //     } else {
    //         console.log(`[GameService] Creating new save`);
    //         const newSave = new this.gameSaveModel({ ...saveData, userId });
    //         const result = await newSave.save();
    //         console.log(`[GameService] Save complete. New ID: ${result._id}`);
    //         return result;
    //     }
    // }

    // async listGames(userId: string) {
    //     console.log(`[GameService] Listing games for user ${userId}`);
    //     const results = await this.gameSaveModel.find({ userId }).sort({ updatedAt: -1 }).select('_id genreKey updatedAt createdAt');
    //     console.log(`[GameService] Found ${results.length} games`);
    //     return results;
    // }

    // async loadGame(saveId: string, userId: string) {
    //     return this.gameSaveModel.findOne({ _id: saveId, userId });
    // }

    // async deleteSave(saveId: string, userId: string) {
    //     return this.gameSaveModel.findOneAndDelete({ _id: saveId, userId });
    // }

    // --- Streaming Logic ---
    streamTurn(prompt: string, history: any[], voice: string, genre: string, lang: string, gKey?: string, pKey?: string, oKey?: string): any {
        const { Observable } = require('rxjs');

        return new Observable((subscriber: any) => {
            (async () => {
                try {
                    // 1. Generate Structured Game Turn
                    subscriber.next({ type: 'status', message: 'Generating Scene...' });
                    
                    const onRetry = (strategy: string, attempt: number) => {
                        subscriber.next({ 
                            type: 'status', 
                            message: `Retrying ${strategy} (Attempt ${attempt})...`,
                            is_retry: true 
                        });
                    };

                    const turnData = await this.aiService.generateGameTurn(prompt, history, genre, gKey, pKey, onRetry);

                    const paragraphs = turnData.paragraphs || [];
                    const options = turnData.options || [];

                    // Emit Text Structure Immediately
                    subscriber.next({
                        type: 'text_structure',
                        paragraphs: paragraphs,
                        options: options,
                        inventory_changes: turnData.inventory_changes,
                        stats_update: turnData.stats_update
                    });

                    // 2. Process Each Paragraph in Parallel/Pipeline
                    const promises = paragraphs.map(async (paragraph: string, pIndex: number) => {
                        // Start Image Gen
                        const imgPromise = this.aiService.generateImage(`Scene: ${paragraph.substring(0, 100)}... Style: ${genre}`, gKey)
                            .then(img => {
                                subscriber.next({ type: 'image', index: pIndex, data: img });
                            })
                            .catch(e => {
                                console.warn(`Image failed for P${pIndex}`, e);
                                subscriber.next({ type: 'image_error', index: pIndex, error: e.message });
                            });

                        // Start Audio Gen (Split into sentences first)
                        const sentences = paragraph.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map(s => s.trim()) || [paragraph];

                        const audioPromises = sentences.map(async (sentence, sIndex) => {
                            try {
                                const audio = await this.aiService.generateAudio(sentence, voice, genre, lang, gKey, pKey, oKey);
                                subscriber.next({
                                    type: 'audio',
                                    pIndex: pIndex,
                                    sIndex: sIndex,
                                    text: sentence, // Key for cache
                                    data: audio
                                });
                            } catch (e) {
                                console.warn(`Audio failed P${pIndex} S${sIndex}`, e);
                            }
                        });

                        await Promise.all([imgPromise, ...audioPromises]);
                    });

                    await Promise.all(promises);

                    subscriber.next({ type: 'done' });
                    subscriber.complete();

                } catch (e: any) {
                    console.error("Stream Error", e);
                    subscriber.error(e);
                }
            })();
        });
    }
}
