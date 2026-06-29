import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import { loginSchema, refreshSchema, registerSchema } from './dto/auth.dto';
import type { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @UsePipes(new ZodValidationPipe(registerSchema))
  register(@Body() body: RegisterDto) {
    return this.auth.register(body.email, body.password, body.displayName);
  }

  @Post('login')
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Post('refresh')
  @UsePipes(new ZodValidationPipe(refreshSchema))
  refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @UsePipes(new ZodValidationPipe(refreshSchema))
  logout(@Body() body: RefreshDto) {
    return this.auth.logout(body.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.userId);
  }
}
