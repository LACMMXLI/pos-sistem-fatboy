import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AddonSharedTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const configuredToken = this.configService.get<string>('WHATSAPP_ADDON_SHARED_TOKEN');

    if (!configuredToken) {
      throw new UnauthorizedException('No hay token compartido configurado para el addon.');
    }

    const headerToken = request.headers['x-addon-shared-token'];
    const bearerHeader = request.headers.authorization;
    const bearerToken =
      typeof bearerHeader === 'string' && bearerHeader.startsWith('Bearer ')
        ? bearerHeader.slice('Bearer '.length).trim()
        : null;

    const providedToken =
      typeof headerToken === 'string' && headerToken.trim().length > 0
        ? headerToken.trim()
        : bearerToken;

    if (!providedToken || providedToken !== configuredToken) {
      throw new UnauthorizedException('Token del addon inválido.');
    }

    request.user = {
      id: 0,
      email: 'whatsapp-addon@system.local',
      role: 'WHATSAPP_DISPATCHER',
      clientType: 'whatsapp-addon',
    };

    return true;
  }
}
