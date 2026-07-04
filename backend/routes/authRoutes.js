const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware"); // sesuaikan path middleware kamu

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", verifyToken, authController.getMe);
router.post("/register-perusahaan", authController.registerPerusahaan);
module.exports = router;