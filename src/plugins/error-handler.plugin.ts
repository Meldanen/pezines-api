import type { FastifyInstance, FastifyError } from 'fastify';

export async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode = error.statusCode ?? 500;

    // 5xx: log everything server-side, return a generic body so we don't leak
    // SQL fragments, file paths, or stack hints. 4xx messages stay verbose so
    // callers can diagnose their own request.
    if (statusCode >= 500) {
      app.log.error(error);
      reply.status(statusCode).send({ error: 'Internal Server Error', statusCode });
      return;
    }

    reply.status(statusCode).send({
      error: error.name ?? 'Error',
      message: error.message,
      statusCode,
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      error: 'Not Found',
      message: 'The requested resource does not exist',
      statusCode: 404,
    });
  });
}
