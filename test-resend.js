import dotenv from "dotenv";
dotenv.config();
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "");
const email = process.env.RESEND_TEST_EMAIL || process.env.RESEND_FROM_EMAIL || "";

async function main() {
  if (!email) {
    console.error("No test email address set. Please set RESEND_TEST_EMAIL or RESEND_FROM_EMAIL in your .env file.");
    process.exit(1);
  }
  try {
    const result = await resend.emails.send({
      from: `Odubo <${process.env.RESEND_FROM_EMAIL}>`,
      to: [email],
      subject: "hello world",
      html: "<p>it works!</p>",
    });
    console.log("Resend test result:", result);
  } catch (err) {
    console.error("Resend test error:", err);
  }
}

main();
