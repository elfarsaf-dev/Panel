import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];
const parsedPort = rawPort ? Number(rawPort) : 3000;
const port = !Number.isNaN(parsedPort) && parsedPort > 0 ? parsedPort : 3000;

app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "Server listening on 0.0.0.0");
});
