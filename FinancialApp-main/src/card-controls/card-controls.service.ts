import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

  async registerCard(
    accountId: number,
    cardToken: string,
    panLast4?: string,
    panEncrypted?: string,
  ) {
    const card = this.cardRepository.create({
      accountId,
      cardToken,
      panLast4,
      panEncrypted,
    });
    return this.cardRepository.save(card);
  }

  async validateCardTransaction(
    cardToken: string,
    amount: number,
    mcc?: number,
    geoLocation?: string,
  ) {
    const card = await this.findByToken(cardToken);

    if (card.status === CardStatus.FROZEN) {
      await this.auditService.record('system', 'CARD_TRANSACTION_REJECTED', {
        cardToken,
        reason: 'CARD_FROZEN',
        amount,
        mcc,
        geoLocation,
      });
      throw new BadRequestException('Card is frozen. Transaction cannot be processed.');
    }

    if (mcc && card.mccWhitelist && card.mccWhitelist.length > 0) {
      if (!card.mccWhitelist.includes(mcc)) {
        await this.auditService.record('system', 'CARD_TRANSACTION_REJECTED', {
          cardToken,
          reason: 'MCC_NOT_ALLOWED',
          mcc,
          allowedMcc: card.mccWhitelist,
          amount,
          geoLocation,
        });
        throw new BadRequestException(
          `MCC ${mcc} is not allowed for this card. Allowed MCC codes: ${card.mccWhitelist.join(', ')}`,
        );
      }
    }

    if (geoLocation && card.geoWhitelist && card.geoWhitelist.length > 0) {
      if (!card.geoWhitelist.includes(geoLocation)) {
        await this.auditService.record('system', 'CARD_TRANSACTION_REJECTED', {
          cardToken,
          reason: 'GEO_NOT_ALLOWED',
          geoLocation,
          allowedGeo: card.geoWhitelist,
          amount,
          mcc,
        });
        throw new BadRequestException(
          `Geolocation ${geoLocation} is not allowed for this card. Allowed locations: ${card.geoWhitelist.join(', ')}`,
        );
      }
    }

    if (card.spendLimits && Object.keys(card.spendLimits).length > 0) {
      if (card.spendLimits.daily) {
        const dailyLimit = parseFloat(String(card.spendLimits.daily));
        if (amount > dailyLimit) {
          await this.auditService.record('system', 'CARD_TRANSACTION_REJECTED', {
            cardToken,
            reason: 'DAILY_LIMIT_EXCEEDED',
            amount,
            dailyLimit,
            mcc,
            geoLocation,
          });
          throw new BadRequestException(
            `Transaction amount ${amount} exceeds card daily limit ${dailyLimit}`,
          );
        }
      }

      if (card.spendLimits.monthly) {
        const monthlyLimit = parseFloat(String(card.spendLimits.monthly));
        if (amount > monthlyLimit) {
          await this.auditService.record('system', 'CARD_TRANSACTION_REJECTED', {
            cardToken,
            reason: 'MONTHLY_LIMIT_EXCEEDED',
            amount,
            monthlyLimit,
            mcc,
            geoLocation,
          });
          throw new BadRequestException(
            `Transaction amount ${amount} exceeds card monthly limit ${monthlyLimit}`,
          );
        }
      }
    }

    await this.auditService.record('system', 'CARD_TRANSACTION_VALIDATED', {
      cardToken,
      amount,
      mcc,
      geoLocation,
    });

    return {
      valid: true,
      cardId: card.id,
      accountId: card.accountId,
    };
  }

  private async findByToken(cardToken: string) {
    const card = await this.cardRepository.findOne({ where: { cardToken } });
    if (!card) {
      throw new NotFoundException('Card not found');
    }
    return card;
  }
}
