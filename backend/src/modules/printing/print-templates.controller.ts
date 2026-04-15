import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreatePrintTemplateDto,
  PrintTemplatePreviewDto,
  UpdatePrintTemplateDto,
} from './dto/print-template.dto';
import { PrintDataService } from './print-data.service';
import { PrintRenderService } from './print-render.service';
import { PrintTemplatesService } from './print-templates.service';

@ApiTags('Print Templates')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('print-templates')
export class PrintTemplatesController {
  constructor(
    private readonly templatesService: PrintTemplatesService,
    private readonly printDataService: PrintDataService,
    private readonly printRenderService: PrintRenderService,
  ) {}

  @Get('types')
  @Roles('ADMIN', 'SUPERVISOR')
  getTypes() {
    return this.templatesService.getDocumentTypes();
  }

  @Get()
  @Roles('ADMIN', 'SUPERVISOR')
  @ApiQuery({ name: 'documentType', required: false })
  @ApiQuery({ name: 'paperWidth', required: false })
  @ApiQuery({ name: 'activeOnly', required: false })
  findAll(
    @Query('documentType') documentType?: string,
    @Query('paperWidth') paperWidth?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.templatesService.findAll({
      documentType,
      paperWidth,
      activeOnly: activeOnly === 'true',
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'SUPERVISOR')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.templatesService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() body: CreatePrintTemplateDto, @Req() req: any) {
    return this.templatesService.create(body, req.user);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdatePrintTemplateDto,
    @Req() req: any,
  ) {
    return this.templatesService.update(id, body, req.user);
  }

  @Post(':id/duplicate')
  @Roles('ADMIN')
  duplicate(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.templatesService.duplicate(id, req.user);
  }

  @Post(':id/activate')
  @Roles('ADMIN')
  activate(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.templatesService.activate(id, req.user);
  }

  @Post('restore-default')
  @Roles('ADMIN')
  restoreDefault(
    @Body() body: { documentType: string; paperWidth: string },
    @Req() req: any,
  ) {
    return this.templatesService.restoreDefault(body.documentType, body.paperWidth, req.user);
  }

  @Post('preview')
  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Genera una vista previa con datos reales o mock' })
  @ApiBody({ type: PrintTemplatePreviewDto })
  async preview(@Body() body: PrintTemplatePreviewDto) {
    const template = body.templateId
      ? await this.templatesService.findOne(body.templateId)
      : await this.templatesService.getActiveTemplate(body.documentType, body.paperWidth);

    let entityType = 'ORDER';
    let entityId = String(body.orderId ?? 1);

    if (body.shiftId) {
      entityType = 'CASH_SHIFT';
      entityId = String(body.shiftId);
    } else if (body.cashMovementId) {
      entityType = 'CASH_MOVEMENT';
      entityId = String(body.cashMovementId);
    }

    const data = await this.printDataService.getDocumentData(
      body.documentType as any,
      entityType,
      entityId,
    );

    return {
      template,
      rendered: this.printRenderService.render(template, data),
    };
  }
}
