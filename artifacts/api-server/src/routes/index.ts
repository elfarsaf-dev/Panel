import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cfProxyRouter from "./cf-proxy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cfProxyRouter);

export default router;
