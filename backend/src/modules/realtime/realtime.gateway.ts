import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

const AUTHENTICATED_ROOM = 'authenticated';
const PRINT_DISPATCHERS_ROOM = 'print-dispatchers';
const WHATSAPP_DISPATCHERS_ROOM = 'whatsapp-dispatchers';

@WebSocketGateway({
  path: '/socket.io',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  @WebSocketServer()
  server: Server;

  private readonly jwtService: JwtService;

  constructor(private readonly configService: ConfigService) {
    this.jwtService = new JwtService({
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async handleConnection(client: Socket) {
    try {
      const addonToken = this.extractAddonToken(client);
      const configuredAddonToken =
        this.configService.get<string>('WHATSAPP_ADDON_SHARED_TOKEN')?.trim() || '';
      const clientType = String(client.handshake.auth?.clientType ?? 'app');

      if (
        clientType === 'whatsapp-addon' &&
        configuredAddonToken &&
        addonToken === configuredAddonToken
      ) {
        client.data.user = {
          id: 0,
          email: 'whatsapp-addon@system.local',
          role: 'WHATSAPP_DISPATCHER',
          clientType,
        };
        client.join(WHATSAPP_DISPATCHERS_ROOM);
        return;
      }

      const token = this.extractToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<any>(token);
      const role = String(payload.role ?? '').toUpperCase();

      client.data.user = {
        id: Number(payload.sub),
        email: payload.email,
        role,
        clientType,
      };

      client.join(AUTHENTICATED_ROOM);
      client.join(`user:${payload.sub}`);
      if (role) {
        client.join(`role:${role}`);
      }
      if (clientType === 'desktop') {
        client.join(PRINT_DISPATCHERS_ROOM);
      }
    } catch (error: any) {
      this.logger.warn(`Socket rejected: ${error?.message ?? 'invalid token'}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) {}

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken.trim();
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim();
    }

    return null;
  }

  private extractAddonToken(client: Socket) {
    const authToken = client.handshake.auth?.sharedToken;
    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken.trim();
    }

    const headerToken = client.handshake.headers['x-addon-shared-token'];
    if (typeof headerToken === 'string' && headerToken.trim().length > 0) {
      return headerToken.trim();
    }

    return null;
  }

  emitOrderCreated(payload: unknown) {
    this.server.to(AUTHENTICATED_ROOM).emit('order.created', payload);
  }

  emitOrderUpdated(payload: unknown) {
    this.server.to(AUTHENTICATED_ROOM).emit('order.updated', payload);
  }

  emitPaymentCreated(payload: unknown) {
    this.server.to(AUTHENTICATED_ROOM).emit('payment.created', payload);
  }

  emitTableUpdated(payload: unknown) {
    this.server.to(AUTHENTICATED_ROOM).emit('table.updated', payload);
  }

  emitPrintJob(payload: unknown) {
    this.server.to(PRINT_DISPATCHERS_ROOM).emit('print.job', payload);
  }

  emitNotificationDispatch(payload: unknown) {
    this.server.to(WHATSAPP_DISPATCHERS_ROOM).emit('notification.dispatch', payload);
  }
}
