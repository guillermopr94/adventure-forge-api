import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PurchaseTokensDto {
  @ApiProperty({
    description: 'Token package to purchase',
    enum: ['starter', 'explorer', 'hero', 'legend'],
    example: 'starter',
  })
  @IsIn(['starter', 'explorer', 'hero', 'legend'])
  package: 'starter' | 'explorer' | 'hero' | 'legend';
}
