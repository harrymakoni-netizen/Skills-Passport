import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Logger } from '@sp/adapters';
import { IllegalTransitionError } from '@sp/core';
import type { Request, Response } from 'express';

/** Consistent JSON errors; never leaks stack traces or personal data. */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  constructor(private readonly log: Logger) {}
  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<Request & { id?: string }>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = { message: 'Something went wrong. Please try again.' };
    if (err instanceof HttpException) {
      status = err.getStatus();
      const r = err.getResponse();
      body = typeof r === 'string' ? { message: r } : (r as Record<string, unknown>);
    } else if (err instanceof IllegalTransitionError) {
      status = HttpStatus.CONFLICT;
      body = { message: 'This job has already moved on.' };
    } else if (err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number') {
      status = (err as { status: number }).status;
      body = { message: (err as unknown as Error).message };
    } else if ((err as { code?: string })?.code === 'P2025') {
      status = HttpStatus.NOT_FOUND;
      body = { message: 'Not found' };
    }
    if (status >= 500) this.log.error({ reqId: req.id, path: req.path, err: (err as Error)?.message, stack: (err as Error)?.stack?.split('\n').slice(0, 5).join(' | ') }, 'request failed');
    res.status(status).json({ ...body, statusCode: status, requestId: req.id });
  }
}
