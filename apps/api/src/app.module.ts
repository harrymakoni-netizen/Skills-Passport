import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AdminController } from './controllers/admin.controller';
import { AgentController } from './controllers/agent.controller';
import { AuthController } from './controllers/auth.controller';
import { BuyerController } from './controllers/buyer.controller';
import { DevController } from './controllers/dev.controller';
import { HealthController } from './controllers/health.controller';
import { MediaController } from './controllers/media.controller';
import { PublicController } from './controllers/public.controller';
import { VerifierController } from './controllers/verifier.controller';
import { WebhookController } from './controllers/webhook.controller';
import { AuthGuard } from './infra/auth';

export function createAppModule(providers: { provide: symbol; useValue: unknown }[], opts: { devTools: boolean }) {
  @Module({
    controllers: [
      HealthController,
      WebhookController,
      PublicController,
      MediaController,
      AuthController,
      VerifierController,
      AgentController,
      BuyerController,
      AdminController,
      ...(opts.devTools ? [DevController] : []),
    ],
    providers: [...providers, { provide: APP_GUARD, useClass: AuthGuard }],
  })
  class AppModule {}
  return AppModule;
}
