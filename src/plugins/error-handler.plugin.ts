import type { FastifyInstance } from 'fastify';

export async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error, _request, reply) => {
    const statusCode = error.statusCode ?? 500;

    if (statusCode >= 500) {
      app.log.error(error);
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
