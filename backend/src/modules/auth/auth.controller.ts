import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, WaiterPinLoginDto } from './dto/login.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión en el sistema' })
  @ApiResponse({ status: 200, description: 'Login exitoso, retorna el token JWT.' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas.' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('waiter-pin-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión rápida de mesero con PIN operativo' })
  @ApiResponse({ status: 200, description: 'Login de mesero exitoso, retorna el token JWT.' })
  @ApiResponse({ status: 401, description: 'PIN inválido o usuario no autorizado.' })
  async waiterPinLogin(@Body() waiterPinLoginDto: WaiterPinLoginDto) {
    return this.authService.waiterPinLogin(waiterPinLoginDto);
  }
}
