import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Get sales history with filters' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'searchTerm', required: false, type: String, description: 'Search by order#, customer, or table' })
  @ApiQuery({ name: 'shiftId', required: false, type: Number, description: 'Filter by specific Shift ID' })
  @ApiResponse({ status: 200, description: 'Sales history retrieved successfully.' })
  getSales(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('searchTerm') searchTerm?: string,
    @Query('shiftId') shiftId?: number,
  ) {
    return this.reportsService.getSalesHistory({ startDate, endDate, searchTerm, shiftId });
  }

  @Get('summary')
  @Roles('ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Get a sales summary (Shift or Date)' })
  @ApiQuery({ name: 'date', required: false, type: String, description: 'Date for the summary (ISO 8601 format)' })
  @ApiQuery({ name: 'shiftId', required: false, type: Number, description: 'Specific Shift ID' })
  @ApiResponse({ status: 200, description: 'Daily summary retrieved successfully.' })
  getDailySummary(@Query('date') date?: string, @Query('shiftId') shiftId?: number) {
    return this.reportsService.getDailySummary({ date, shiftId });
  }
}
