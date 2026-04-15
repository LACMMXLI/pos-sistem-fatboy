import { Body, Controller, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrintOrderReceiptDto } from './dto/print-order-receipt.dto';
import { PrintingService } from './printing.service';

@ApiTags('Printing')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('printing')
export class PrintingController {
  constructor(private readonly printingService: PrintingService) {}

  @Post('orders/:id/receipt')
  @Roles('ADMIN', 'SUPERVISOR', 'CAJERO', 'MESERO', 'COCINA')
  @ApiOperation({ summary: 'Imprime un ticket RAW ESC/POS directo a una impresora de Windows' })
  @ApiBody({ type: PrintOrderReceiptDto, required: false })
  @ApiResponse({ status: 201, description: 'Ticket enviado a la impresora.' })
  printOrderReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PrintOrderReceiptDto,
    @Req() req: any,
  ) {
    return this.printingService.printOrderReceipt(id, body, req.user);
  }
}
