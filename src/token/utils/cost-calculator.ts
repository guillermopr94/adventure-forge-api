export class CostCalculator {
  static readonly TEXT_COST = 0.5;
  static readonly IMAGE_COST = 1.0;
  static readonly AUDIO_COST = 0.5;

  /**
   * Calculates the total cost of a game turn based on included media.
   * Text is always included in every turn.
   */
  static calculateTurnCost(options: {
    includeImage: boolean;
    includeAudio: boolean;
  }): number {
    let cost = this.TEXT_COST; // Text always included

    if (options.includeImage) {
      cost += this.IMAGE_COST;
    }

    if (options.includeAudio) {
      cost += this.AUDIO_COST;
    }

    return cost;
  }

  /**
   * Returns the individual cost for a specific action type.
   */
  static getActionCost(actionType: 'text' | 'image' | 'audio'): number {
    switch (actionType) {
      case 'text':
        return this.TEXT_COST;
      case 'image':
        return this.IMAGE_COST;
      case 'audio':
        return this.AUDIO_COST;
      default:
        return 0;
    }
  }
}
