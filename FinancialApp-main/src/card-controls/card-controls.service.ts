import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Account } from '../accounts/entities/account.entity';
import { AuditService } from '../audit/audit.service';
import { hasPrivilegedRole } from '../common/utils/roles';
import { EventsService } from '../events/events.service';

import { CardControl, CardStatus } from './entities/card-control.entity';

@Injectable()
export class CardControlsService {
  constructor(
    @InjectRepository(CardControl)
    private readonly cardRepository: Repository<CardControl>,
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
    private readonly eventsService: EventsService,
    private readonly auditService: AuditService,
  ) {}

  async listCards(userId: number, roles?: string[]) {
    if (hasPrivilegedRole(roles)) {
      return this.cardRepository.find({
        order: { updatedAt: 'DESC' },
      });
    }

    const accounts = await this.accountsRepository.find({
      where: { userId },
      select: ['id'],
    });
    const accountIds = accounts.map((account) => account.id);
    if (accountIds.length === 0) {
      return [];
    }

    return this.cardRepository.find({
      where: accountIds.map((accountId) => ({ accountId })),
      order: { updatedAt: 'DESC' },
    });
  }

  async freeze(cardToken: string, reason: string, userId: number, roles?: string[]) {
    const card = await this.findAccessibleCard(cardToken, userId, roles);
    card.status = CardStatus.FROZEN;
    await this.cardRepository.save(card);
    const eventPayload = { event: 'CARD_FROZEN', cardToken, reason };
    this.eventsService.emit('card_controls_events', eventPayload);
    await this.auditService.record(`user_${userId}`, 'CARD_FROZEN', eventPayload);
    return card;
  }

  async unfreeze(cardToken: string, userId: number, roles?: string[]) {
    const card = await this.findAccessibleCard(cardToken, userId, roles);
    card.status = CardStatus.ACTIVE;
    await this.cardRepository.save(card);
    const eventPayload = { event: 'CARD_UNFROZEN', cardToken };
    this.eventsService.emit('card_controls_events', eventPayload);
    await this.auditService.record(`user_${userId}`, 'CARD_UNFROZEN', eventPayload);
    return card;
  }

  async updateLimits(
    cardToken: string,
    limits: Partial<CardControl>,
    userId: number,
    roles?: string[],
  ) {
    const card = await this.findAccessibleCard(cardToken, userId, roles);
    card.mccWhitelist = limits.mccWhitelist ?? card.mccWhitelist;
    card.geoWhitelist = limits.geoWhitelist ?? card.geoWhitelist;
    card.spendLimits = limits.spendLimits ?? card.spendLimits;
    const saved = await this.cardRepository.save(card);
    await this.auditService.record(`user_${userId}`, 'CARD_LIMITS_UPDATED', {
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
    userId: number,
    roles?: string[],
    panLast4?: string,
    panEncrypted?: string,
  ) {
    await this.assertAccountAccess(accountId, userId, roles);
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
    userId?: number,
    roles?: string[],
    expectedAccountId?: number,
  ) {
    const card =
      userId !== undefined
        ? await this.findAccessibleCard(cardToken, userId, roles)
        : await this.findByToken(cardToken);

    if (expectedAccountId !== undefined && card.accountId !== expectedAccountId) {
      throw new BadRequestException('Card token does not belong to the selected account.');
    }

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

  private async findAccessibleCard(cardToken: string, userId: number, roles?: string[]) {
    const card = await this.findByToken(cardToken);
    await this.assertAccountAccess(card.accountId, userId, roles);
    return card;
  }

  private async assertAccountAccess(accountId: number, userId: number, roles?: string[]) {
    const account = await this.accountsRepository.findOne({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    if (account.userId !== userId && !hasPrivilegedRole(roles)) {
      throw new ForbiddenException('You do not have access to this card');
    }
  }
}
