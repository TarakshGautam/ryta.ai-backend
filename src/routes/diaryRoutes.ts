import { Router } from "express";
import { DiaryController } from "../controllers/diaryController";
import { requireIdentity } from "../middleware/auth";

const router = Router();

router.use(requireIdentity);

router.post("/", DiaryController.createDiaryEntry);
router.get("/", DiaryController.getDiaryEntries);
router.get("/:id", DiaryController.getDiaryEntry);
router.patch("/:id", DiaryController.updateDiaryEntry);
router.delete("/:id", DiaryController.deleteDiaryEntry);

export default router;