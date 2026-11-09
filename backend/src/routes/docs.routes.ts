import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import especificacion from "../docs/openapi.json" with { type: "json" };

/** `/api/docs`: Swagger UI y la especificación OpenAPI cruda (para importarla en Postman). */
export function crearDocsRouter(): Router {
  const router = Router();
  router.get("/openapi.json", (_req, res) => {
    res.json(especificacion);
  });
  router.use("/", swaggerUi.serve, swaggerUi.setup(especificacion, { customSiteTitle: "AI Ticket It API" }));
  return router;
}
