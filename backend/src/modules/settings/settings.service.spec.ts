import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: {
    systemConfig: {
      findUnique: jest.Mock;
      create: jest.Mock;
      upsert: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      systemConfig: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('preserves the stored SMTP password when a blank value is submitted', async () => {
    prisma.systemConfig.upsert.mockResolvedValue({
      id: 1,
      taxEnabled: true,
      taxRate: 16,
      shiftEmailEnabled: true,
      shiftEmailHost: 'smtp.test.local',
      shiftEmailPort: 587,
      shiftEmailSecure: false,
      shiftEmailUser: 'mailer@test.local',
      shiftEmailPassword: 'stored-secret',
      shiftEmailFrom: 'cortes@test.local',
      shiftEmailTo: 'gerencia@test.local',
      shiftEmailCc: null,
      whatsappAddonEnabled: false,
    });

    await service.updateSettings({
      shiftEmailEnabled: true,
      shiftEmailHost: 'smtp.test.local',
      shiftEmailPassword: '',
    });

    expect(prisma.systemConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.not.objectContaining({
          shiftEmailPassword: expect.anything(),
        }),
      }),
    );
  });
});
