import {
  Body,
  Controller,
  Get,
  Param,
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
import { CreatePrintJobDto, UpdatePrintJobStatusDto } from './dto/print-job.dto';
import { PrintJobsService } from './print-jobs.service';

@ApiTags('Print Jobs')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('print-jobs')
export class PrintJobsController {
  constructor(private readonly printJobsService: PrintJobsService) {}

  @Get()
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'COCINA')
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'documentType', required: false })
  findAll(@Query('status') status?: string, @Query('documentType') documentType?: string) {
    return this.printJobsService.findAll({ status, documentType });
  }

  @Get(':id')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'COCINA')
  findOne(@Param('id') id: string) {
    return this.printJobsService.findOne(id);
  }

  @Get(':id/status')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'MESERO', 'COCINA')
  async getStatus(@Param('id') id: string) {
    const job = await this.printJobsService.findOne(id);
    return {
      id: job.id,
      status: job.status,
      attempts: job.attempts,
      lastError: job.lastError,
      updatedAt: job.updatedAt,
    };
  }

  @Post()
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'MESERO', 'COCINA')
  @ApiBody({ type: CreatePrintJobDto })
  @ApiOperation({ summary: 'Solicita un trabajo de impresión formal en cola' })
  create(@Body() body: CreatePrintJobDto, @Req() req: any) {
    return this.printJobsService.createJob(body, req.user);
  }

  @Post(':id/claim')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'COCINA')
  claim(@Param('id') id: string, @Req() req: any) {
    return this.printJobsService.claimJob(id, req.user);
  }

  @Post(':id/reprint')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO')
  reprint(@Param('id') id: string, @Req() req: any) {
    return this.printJobsService.reprint(id, req.user);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'COCINA')
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdatePrintJobStatusDto,
    @Req() req: any,
  ) {
    return this.printJobsService.updateStatus(id, body, req.user);
  }
}
