import { CostCalculator } from './cost-calculator';

describe('CostCalculator', () => {
  describe('calculateTurnCost', () => {
    it('should return TEXT_COST when no image or audio is requested', () => {
      const cost = CostCalculator.calculateTurnCost({
        includeImage: false,
        includeAudio: false,
      });
      expect(cost).toBe(CostCalculator.TEXT_COST);
    });

    it('should add IMAGE_COST when image is requested', () => {
      const cost = CostCalculator.calculateTurnCost({
        includeImage: true,
        includeAudio: false,
      });
      expect(cost).toBe(CostCalculator.TEXT_COST + CostCalculator.IMAGE_COST);
    });

    it('should add AUDIO_COST when audio is requested', () => {
      const cost = CostCalculator.calculateTurnCost({
        includeImage: false,
        includeAudio: true,
      });
      expect(cost).toBe(CostCalculator.TEXT_COST + CostCalculator.AUDIO_COST);
    });

    it('should add both IMAGE_COST and AUDIO_COST when both are requested', () => {
      const cost = CostCalculator.calculateTurnCost({
        includeImage: true,
        includeAudio: true,
      });
      expect(cost).toBe(
        CostCalculator.TEXT_COST +
          CostCalculator.IMAGE_COST +
          CostCalculator.AUDIO_COST
      );
    });
  });

  describe('getActionCost', () => {
    it('should return TEXT_COST for "text" action', () => {
      expect(CostCalculator.getActionCost('text')).toBe(CostCalculator.TEXT_COST);
    });

    it('should return IMAGE_COST for "image" action', () => {
      expect(CostCalculator.getActionCost('image')).toBe(CostCalculator.IMAGE_COST);
    });

    it('should return AUDIO_COST for "audio" action', () => {
      expect(CostCalculator.getActionCost('audio')).toBe(CostCalculator.AUDIO_COST);
    });

    it('should return 0 for unknown action type', () => {
      // @ts-ignore
      expect(CostCalculator.getActionCost('unknown')).toBe(0);
    });
  });
});
