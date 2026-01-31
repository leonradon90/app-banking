import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      callback(null, true);
    },
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    const enabled = this.configService.get<boolean>('notifications.websocketEnabled') ?? true;
    if (!enabled) {
      client.disconnect();
      return;
    }

    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.toString()?.replace('Bearer ', '');
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);
      const userId = payload?.sub ?? payload?.userId;
      if (!userId) {
        client.disconnect();
        return;
      }

      client.join(`user_${userId}`);
      this.logger.log(`Socket connected for user_${userId}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Socket auth failed: ${message}`);
      client.disconnect();
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.logger.log(`Socket disconnected ${client.id}`);
  }

  emitToUser(userId: number, payload: Record<string, unknown>) {
    this.server.to(`user_${userId}`).emit('notification', payload);
  }
}
