import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import { LoginDto, WaiterPinLoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) { }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuario desactivado');
    }

    return this.buildAuthResponse(user);
  }

  async waiterPinLogin(waiterPinLoginDto: WaiterPinLoginDto) {
    const { pin } = waiterPinLoginDto;

    // Fetch all active users with a PIN
    const usersWithPin = await this.usersService.findAll(undefined, { includeTabletPin: true });
    
    fs.appendFileSync('pin-login-log.txt', `[${new Date().toISOString()}] Login attempt. Users with PIN potential: ${usersWithPin.length}\n`);

    for (const userSummary of usersWithPin) {
      if (!userSummary.tabletPin) continue;

      // Fetch full user to get lockout info and verify details
      const user = await this.usersService.findOneWithPassword(userSummary.id);

      const isMatch = user.tabletPin ? await bcrypt.compare(pin, user.tabletPin) : false;
      fs.appendFileSync('pin-login-log.txt', `Checking user ${user.name} (ID: ${user.id}). Has tabletPin: ${!!user.tabletPin}. Match: ${isMatch}\n`);

      if (isMatch) {
        if (!user.isActive) {
          fs.appendFileSync('pin-login-log.txt', `User ${user.name} is INACTIVE. Denying.\n`);
          throw new UnauthorizedException('Usuario desactivado');
        }

        fs.appendFileSync('pin-login-log.txt', `SUCCESS for ${user.name}\n`);
        // Reset attempts on success
        await this.usersService.resetLoginAttempts(user.id);
        return this.buildAuthResponse(user);
      }
    }
    // Artificial delay to prevent brute force
    await new Promise((resolve) => setTimeout(resolve, 1000));
    throw new UnauthorizedException('PIN inválido');
  }

  private async buildAuthResponse(user: {
    id: number;
    name: string;
    email: string;
    role: { name: string };
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role.name,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
      },
    };
  }
}
