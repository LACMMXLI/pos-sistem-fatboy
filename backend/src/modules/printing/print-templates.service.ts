import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePrintTemplateDto, UpdatePrintTemplateDto } from './dto/print-template.dto';
import {
  PRINT_DOCUMENT_TYPES,
  PRINT_PAPER_WIDTHS,
  PrintTemplateConfig,
  PrintTemplateSection,
} from './print-documents';
import { getDefaultTemplateConfigs } from './print-defaults';

@Injectable()
export class PrintTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeSections(sections: PrintTemplateSection[]) {
    const keys = new Set<string>();

    const normalized = sections
      .map((section, index) => ({
        ...section,
        order: Number(section.order ?? index),
        spacing: Number(section.spacing ?? 0),
        options: section.options ?? {},
      }))
      .sort((a, b) => a.order - b.order);

    for (const section of normalized) {
      if (keys.has(section.key)) {
        throw new BadRequestException(`El bloque ${section.key} está duplicado en la plantilla`);
      }
      keys.add(section.key);
    }

    if (!normalized.some((section) => section.key === 'items' && section.enabled)) {
      throw new BadRequestException('La plantilla debe incluir el bloque items habilitado');
    }

    return normalized;
  }

  private serializeTemplate(template: any) {
    return {
      ...template,
      warnings: Array.isArray(template.warnings) ? template.warnings : [],
      sections: Array.isArray(template.sections) ? template.sections : [],
      fixedTexts: template.fixedTexts ?? {},
      metadata: template.metadata ?? {},
      printerRouting: template.printerRouting ?? {},
    };
  }

  async ensureDefaultTemplates() {
    const prisma = this.prisma as any;
    const count = await prisma.printTemplate.count();
    if (count > 0) {
      return;
    }

    const defaults = getDefaultTemplateConfigs();
    await this.prisma.$transaction(
      defaults.map((template) =>
        prisma.printTemplate.create({
          data: {
            templateKey: template.templateKey,
            name: template.name,
            documentType: template.documentType,
            paperWidth: template.paperWidth,
            version: template.version,
            isActive: template.isActive,
            isDefault: template.isDefault,
            sections: template.sections as any,
            printerRouting: template.printerRouting as any,
            fixedTexts: template.fixedTexts as any,
            metadata: template.metadata as any,
            warnings: template.warnings as any,
          },
        }),
      ),
    );
  }

  async getDocumentTypes() {
    await this.ensureDefaultTemplates();

    return PRINT_DOCUMENT_TYPES.map((documentType) => ({
      documentType,
      supportedPaperWidths: [...PRINT_PAPER_WIDTHS],
    }));
  }

  async findAll(filters?: { documentType?: string; paperWidth?: string; activeOnly?: boolean }) {
    await this.ensureDefaultTemplates();

    const prisma = this.prisma as any;
    const templates = await prisma.printTemplate.findMany({
      where: {
        ...(filters?.documentType ? { documentType: filters.documentType } : {}),
        ...(filters?.paperWidth ? { paperWidth: filters.paperWidth } : {}),
        ...(filters?.activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ documentType: 'asc' }, { paperWidth: 'asc' }, { version: 'desc' }],
      include: {
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        activatedBy: { select: { id: true, name: true } },
      },
    });

    return templates.map((template: any) => this.serializeTemplate(template));
  }

  async findOne(id: number) {
    await this.ensureDefaultTemplates();

    const prisma = this.prisma as any;
    const template = await prisma.printTemplate.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        activatedBy: { select: { id: true, name: true } },
      },
    });

    if (!template) {
      throw new NotFoundException('Plantilla no encontrada');
    }

    return this.serializeTemplate(template);
  }

  async getActiveTemplate(documentType: string, paperWidth: string) {
    await this.ensureDefaultTemplates();

    const template =
      (await (this.prisma as any).printTemplate.findFirst({
        where: {
          documentType,
          paperWidth,
          isActive: true,
        },
        orderBy: [{ isDefault: 'desc' }, { version: 'desc' }],
      })) ||
      (await (this.prisma as any).printTemplate.findFirst({
        where: {
          documentType,
          paperWidth,
        },
        orderBy: [{ isDefault: 'desc' }, { version: 'desc' }],
      }));

    if (!template) {
      throw new NotFoundException(
        `No existe plantilla para ${documentType} en ${paperWidth}mm`,
      );
    }

    return this.serializeTemplate(template);
  }

  async create(dto: CreatePrintTemplateDto, actor?: { id: number }) {
    await this.ensureDefaultTemplates();

    const prisma = this.prisma as any;
    const latestVersion = await prisma.printTemplate.findFirst({
      where: {
        documentType: dto.documentType,
        paperWidth: dto.paperWidth,
      },
      orderBy: { version: 'desc' },
    });

    const created = await prisma.printTemplate.create({
      data: {
        templateKey:
          dto.templateKey?.trim() ||
          `${dto.documentType}_${dto.paperWidth}_V${(latestVersion?.version ?? 0) + 1}`,
        name: dto.name.trim(),
        documentType: dto.documentType,
        paperWidth: dto.paperWidth,
        version: (latestVersion?.version ?? 0) + 1,
        isActive: Boolean(dto.isActive),
        isDefault: Boolean(dto.isDefault),
        sections: this.normalizeSections(dto.sections as PrintTemplateSection[]) as any,
        printerRouting: (dto.printerRouting ?? {}) as any,
        fixedTexts: (dto.fixedTexts ?? {}) as any,
        metadata: (dto.metadata ?? {}) as any,
        createdById: actor?.id,
        updatedById: actor?.id,
        activatedById: dto.isActive ? actor?.id : undefined,
        activatedAt: dto.isActive ? new Date() : undefined,
      },
    });

    if (dto.isActive) {
      await this.activate(created.id, actor);
    }

    return this.findOne(created.id);
  }

  async update(id: number, dto: UpdatePrintTemplateDto, actor?: { id: number }) {
    await this.findOne(id);

    await (this.prisma as any).printTemplate.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.sections
          ? { sections: this.normalizeSections(dto.sections as PrintTemplateSection[]) as any }
          : {}),
        ...(dto.printerRouting ? { printerRouting: dto.printerRouting as any } : {}),
        ...(dto.fixedTexts ? { fixedTexts: dto.fixedTexts as any } : {}),
        ...(dto.metadata ? { metadata: dto.metadata as any } : {}),
        updatedById: actor?.id,
      },
    });

    return this.findOne(id);
  }

  async duplicate(id: number, actor?: { id: number }) {
    const template = await this.findOne(id);

    return this.create(
      {
        name: `${template.name} copia`,
        documentType: template.documentType,
        paperWidth: template.paperWidth,
        sections: template.sections,
        printerRouting: template.printerRouting,
        fixedTexts: template.fixedTexts,
        metadata: template.metadata,
        isActive: false,
      },
      actor,
    );
  }

  async activate(id: number, actor?: { id: number }) {
    const template = await this.findOne(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.printTemplate.updateMany({
        where: {
          documentType: template.documentType,
          paperWidth: template.paperWidth,
        },
        data: {
          isActive: false,
        },
      });

      await tx.printTemplate.update({
        where: { id },
        data: {
          isActive: true,
          activatedById: actor?.id,
          activatedAt: new Date(),
          updatedById: actor?.id,
        },
      });
    });

    return this.findOne(id);
  }

  async restoreDefault(documentType: string, paperWidth: string, actor?: { id: number }) {
    await this.ensureDefaultTemplates();

    const defaultTemplate = await (this.prisma as any).printTemplate.findFirst({
      where: {
        documentType,
        paperWidth,
        isDefault: true,
      },
      orderBy: { version: 'asc' },
    });

    if (!defaultTemplate) {
      throw new NotFoundException('No existe plantilla por defecto para restaurar');
    }

    return this.activate(defaultTemplate.id, actor);
  }
}
