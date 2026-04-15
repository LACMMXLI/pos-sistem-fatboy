import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ensureBackendRuntime } from './utils/backend-runtime';

async function bootstrap() {
  ensureBackendRuntime();

  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  // Set Global Prefix
  app.setGlobalPrefix('api');

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger Documentation Configuration
  const config = new DocumentBuilder()
    .setTitle('Fatboy Restaurant POS API')
    .setDescription('Documentación detallada de la API para el sistema POS de Fatboy Restaurant. Incluye gestión de usuarios, autenticación, productos y órdenes.')
    .setVersion('1.0')
    .addTag('Auth', 'Endpoints de autenticación y login')
    .addTag('Users', 'Gestión de usuarios del sistema')
    .addTag('Roles', 'Consulta de roles disponibles')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingrese el token JWT obtenido en el login',
        in: 'header',
      },
      'access-token', // This name must match the @ApiBearerAuth('access-token') decorator
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  // Swagger accessible at /api/docs or /api/docs-json
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: 'Fatboy POS API Documentation',
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://localhost:${port}/api`);
  console.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
}
bootstrap();
