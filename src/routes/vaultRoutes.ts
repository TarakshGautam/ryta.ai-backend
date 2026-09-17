import { Router } from "express";
import { VaultController } from "../controllers/vaultController";
import { requireIdentity } from "../middleware/auth";

const router = Router();

router.use(requireIdentity);

router.post("/", VaultController.createVaultEntry);
router.get("/", VaultController.getVaultEntries);
router.get("/:id", VaultController.getVaultEntry);
router.patch("/:id", VaultController.updateVaultEntry);
router.delete("/:id", VaultController.deleteVaultEntry);

export default router;