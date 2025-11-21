import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CardControl, CardStatus } from './entities/card-control.entity';
import { EventsService } from '../events/events.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CardControlsService {
  constructor(
    @InjectRepository(CardControl)
    private readonly cardRepository: Repository<CardControl>,
    private readonly eventsService: EventsService,
    private readonly auditService: AuditService,
  ) {}

  async freeze(cardToken: string, reason: string) {
    const card = await this.findByToken(cardToken);
    card.status = CardStatus.FROZEN;
    await this.cardRepository.save(card);
    const eventPayload = { event: 'CARD_FROZEN', cardToken, reason };
    this.eventsService.emit('card_controls_events', eventPayload);
    await this.auditService.record('system', 'CARD_FROZEN', eventPayload);
    return card;
  }

  async unfreeze(cardToken: string) {
    const card = await this.findByToken(cardToken);
    card.status = CardStatus.ACTIVE;
    await this.cardRepository.save(card);
    const eventPayload = { event: 'CARD_UNFROZEN', cardToken };
    this.eventsService.emit('card_controls_events', eventPayload);
    await this.auditService.record('system', 'CARD_UNFROZEN', eventPayload);
    return card;
  }

  async updateLimits(cardToken: string, limits: Partial<CardControl>) {
    const card = await this.findByToken(cardToken);
    card.mccWhitelist = limits.mccWhitelist ?? card.mccWhitelist;
    card.geoWhitelist = limits.geoWhitelist ?? card.geoWhitelist;
    card.spendLimits = limits.spendLimits ?? card.spendLimits;
    const saved = await this.cardRepository.save(card);
    await this.auditService.record('system', 'CARD_LIMITS_UPDATED', {
      cardToken,
      limits,
    });
    this.eventsService.emit('card_controls_events', {
      event: 'CARD_LIMITS_UPDATED',
      cardToken,
      limits,
    });
    return saved;
  }

  async registerCard(accountId: number, cardToken: string) {
    const card = this.cardRepository.create({ accountId, cardToken });
    return this.cardRepository.save(card);
  }

  private async findByToken(cardToken: string) {
    const card = await this.cardRepository.findOne({ where: { cardToken } });
    if (!card) {
      throw new NotFoundException('Card not found');
    }
    return card;
  }
}
