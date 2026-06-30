import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TibiaCharacter {
  name: string;
  sex: string;
  vocation: string;
  level: number;
  world: string;
}

interface TibiaResponse {
  character?: {
    character?: Partial<TibiaCharacter>;
  };
}

const DEFAULT_BASE_URL = 'https://api.tibiadata.com';
const REQUEST_TIMEOUT_MS = 8000;

@Injectable()
export class TibiaService {
  constructor(private readonly config: ConfigService) {}

  async fetchCharacter(name: string): Promise<TibiaCharacter> {
    const base =
      this.config.get<string>('TIBIADATA_BASE_URL') ?? DEFAULT_BASE_URL;
    const url = `${base}/v4/character/${encodeURIComponent(name)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch {
      throw new BadGatewayException('Tibia data source unavailable');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new BadGatewayException('Tibia data source unavailable');
    }

    const body = (await response.json()) as TibiaResponse;
    const char = body.character?.character;
    if (!char?.name) {
      throw new NotFoundException('Character not found on Tibia');
    }

    return {
      name: char.name,
      sex: char.sex ?? '',
      vocation: char.vocation ?? '',
      level: char.level ?? 0,
      world: char.world ?? '',
    };
  }
}
