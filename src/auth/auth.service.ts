import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { StringValue } from 'ms';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

interface JwtPayload {
  sub: string;
  email: string;
}

interface DecodedRefreshToken {
  exp: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(email: string, password: string, displayName: string) {
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await argon2.hash(password);
    const user = await this.users.create({ email, passwordHash, displayName });
    const tokens = await this.issueTokens(user.id, user.email);

    return { ...tokens, user: this.publicUser(user) };
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user.id, user.email);
    return { ...tokens, user: this.publicUser(user) };
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const token = await this.findMatchingRefreshToken(
      payload.sub,
      refreshToken,
    );
    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(payload.sub, payload.email);
  }

  async logout(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.verifyRefreshToken(refreshToken);
    } catch {
      return { success: true };
    }

    const token = await this.findMatchingRefreshToken(
      payload.sub,
      refreshToken,
    );
    if (token) {
      await this.prisma.refreshToken.update({
        where: { id: token.id },
        data: { revokedAt: new Date() },
      });
    }

    return { success: true };
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.publicUser(user);
  }

  private async issueTokens(userId: string, email: string) {
    const payload: JwtPayload = { sub: userId, email };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.getOrThrow<StringValue>('JWT_ACCESS_EXPIRES'),
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.getOrThrow<StringValue>('JWT_REFRESH_EXPIRES'),
    });
    const decoded = this.jwt.decode<DecodedRefreshToken>(refreshToken);
    if (!decoded?.exp) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: await argon2.hash(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(refreshToken: string): Promise<JwtPayload> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async findMatchingRefreshToken(userId: string, refreshToken: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    for (const token of tokens) {
      if (await argon2.verify(token.tokenHash, refreshToken)) {
        return token;
      }
    }

    return null;
  }

  private publicUser(user: {
    id: string;
    email: string;
    displayName: string;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    };
  }
}
