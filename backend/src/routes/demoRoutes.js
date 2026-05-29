const express = require("express");
const router = express.Router();
const { Resend } = require("resend");

const pool = require("../config/db");

const authMiddleware = require("../middleware/authMiddleware");
const demoController = require("../controllers/demoController");
const resend = new Resend(process.env.RESEND_API_KEY);

router.post("/seed", authMiddleware, demoController.seedDemoData);

router.post("/demo-request", async (req, res) => {

    try {

        const {
            fullName,
            companyName,
            email,
            phone,
            message,
        } = req.body;

        // Basic validation
        if (!fullName || !companyName || !email) {

            return res.status(400).json({
                success: false,
                message: "Required fields missing",
            });

        }

        console.log("NEW DEMO REQUEST:");

        console.log({
            fullName,
            companyName,
            email,
            phone,
            message,
        });

        await pool.query(
            `
    INSERT INTO demo_requests
    (
      full_name,
      company_name,
      email,
      phone,
      message
    )
    VALUES ($1, $2, $3, $4, $5)
  `,
            [
                fullName,
                companyName,
                email,
                phone,
                message,
            ]
        );

        console.log("✅ Demo request saved to PostgreSQL");

        // EMAIL TO ADMIN

        await resend.emails.send({

            from: "Maltech VAT Pro <noreply@maltechenterprises.com>",

            to: "malcolm@maltechenterprises.com",

            subject: "New Demo Request",

            html: `
    <h2>New Demo Request</h2>

    <p><strong>Full Name:</strong> ${fullName}</p>

    <p><strong>Company:</strong> ${companyName}</p>

    <p><strong>Email:</strong> ${email}</p>

    <p><strong>Phone:</strong> ${phone}</p>

    <p><strong>Message:</strong></p>

    <p>${message}</p>
  `,
        });

        // EMAIL TO CUSTOMER

        await resend.emails.send({

            from: "Maltech VAT Pro <noreply@maltechenterprises.com>",

            to: email,

            subject: "Thank You for Contacting Maltech VAT Pro",

            html: `
    <h2>Thank You</h2>

    <p>Hi ${fullName},</p>

    <p>
      Thank you for requesting a demo of Maltech VAT Pro.
    </p>

    <p>
      Our team will contact you shortly.
    </p>

    <p>
      Regards,<br />
      Maltech VAT Pro
    </p>
  `,
        });

        // SUCCESS RESPONSE

        return res.status(200).json({
            success: true,
            message: "Demo request submitted successfully",
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Server error",
        });

    }

});

module.exports = router;