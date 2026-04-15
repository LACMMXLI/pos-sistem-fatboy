import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { 
    findByEmail: jest.Mock; 
    findByTabletPin: jest.Mock;
    findAll: jest.Mock;
    findOneWithPassword: jest.Mock;
    resetLoginAttempts: jest.Mock;
    incrementLoginAttempts: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: { 
            findByEmail: jest.fn(), 
            findByTabletPin: jest.fn(),
            findAll: jest.fn(),
            findOneWithPassword: jest.fn(),
            resetLoginAttempts: jest.fn(),
            incrementLoginAttempts: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('logs in a waiter by tablet pin', async () => {
    const waiter = {
      id: 9,
      name: 'Mesero 1',
      email: 'mesero@fatboy.com',
      isActive: true,
      tabletPin: 'hashed_pin',
      roleId: 2,
      role: { name: 'MESERO' },
      lockoutUntil: null,
    };

    usersService.findAll.mockResolvedValue([{ id: 9, name: 'Mesero 1' }]);
    usersService.findOneWithPassword.mockResolvedValue(waiter);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    jwtService.signAsync.mockResolvedValue('token-waiter');

    const result = await service.waiterPinLogin({ pin: '1024' });

    expect(result.access_token).toBe('token-waiter');
    expect(result.user.role).toBe('MESERO');
    expect(usersService.resetLoginAttempts).toHaveBeenCalledWith(9);
  });

  it('rejects invalid waiter pin login', async () => {
    usersService.findAll.mockResolvedValue([{ id: 9, name: 'Mesero 1' }]);
    usersService.findOneWithPassword.mockResolvedValue({
      id: 9,
      tabletPin: 'hashed_pin',
      role: { name: 'MESERO' },
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.waiterPinLogin({ pin: '9999' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects locked out user', async () => {
    const futureDate = new Date(Date.now() + 100000);
    usersService.findAll.mockResolvedValue([{ id: 9, name: 'Mesero 1' }]);
    usersService.findOneWithPassword.mockResolvedValue({
      id: 9,
      roleId: 2,
      role: { name: 'MESERO' },
      lockoutUntil: futureDate,
    });

    await expect(service.waiterPinLogin({ pin: '1024' })).rejects.toThrow(
      /Usuario bloqueado/,
    );
  });
});
