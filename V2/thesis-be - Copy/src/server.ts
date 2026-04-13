import app from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";

app.listen(env.PORT, () => {
  logger.info(`🚀 Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  logger.info(`📚 API Documentation: http://localhost:${env.PORT}/api-docs`);
  logger.info(`🏥 Health Check: http://localhost:${env.PORT}/health`);
});
