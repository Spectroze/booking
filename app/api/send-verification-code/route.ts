import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Store verification codes in memory (in production, use Redis or database)
const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email configuration
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return NextResponse.json(
        { error: 'Email configuration not set up' },
        { status: 500 }
      );
    }

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store verification code
    verificationCodes.set(email, { code, expiresAt });

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563EB; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
            .code-box { background-color: #EFF6FF; border: 2px dashed #2563EB; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }
            .code { font-size: 32px; font-weight: bold; color: #2563EB; letter-spacing: 5px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Verification Code</h1>
              <p>Provincial Government of Aurora</p>
            </div>
            <div class="content">
              <p>Dear User,</p>
              
              <p>Your verification code for signing in to the booking system is:</p>
              
              <div class="code-box">
                <div class="code">${code}</div>
              </div>
              
              <p>This code will expire in 10 minutes.</p>
              
              <p>If you did not request this code, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>Provincial Government of Aurora<br>Baler, Aurora</p>
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
Verification Code - Provincial Government of Aurora

Dear User,

Your verification code for signing in to the booking system is:

${code}

This code will expire in 10 minutes.

If you did not request this code, please ignore this email.

---
Provincial Government of Aurora
Baler, Aurora
This is an automated email. Please do not reply.
    `;

    // Send email
    const mailOptions = {
      from: `"Provincial Government of Aurora" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Verification Code - Booking System',
      text: textContent,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);

    // Clean up expired codes
    cleanupExpiredCodes();

    return NextResponse.json(
      { message: 'Verification code sent successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error sending verification code:', error);
    return NextResponse.json(
      { error: 'Failed to send verification code', details: error.message },
      { status: 500 }
    );
  }
}

// Verify code endpoint
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and code are required' },
        { status: 400 }
      );
    }

    const stored = verificationCodes.get(email);

    if (!stored) {
      return NextResponse.json(
        { error: 'No verification code found for this email. Please request a new code.' },
        { status: 404 }
      );
    }

    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete(email);
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new code.' },
        { status: 410 }
      );
    }

    if (stored.code !== code) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 401 }
      );
    }

    // Code is valid - remove it so it can't be reused
    verificationCodes.delete(email);

    return NextResponse.json(
      { message: 'Verification code is valid' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error verifying code:', error);
    return NextResponse.json(
      { error: 'Failed to verify code', details: error.message },
      { status: 500 }
    );
  }
}

// Cleanup expired codes
function cleanupExpiredCodes() {
  const now = Date.now();
  for (const [email, data] of verificationCodes.entries()) {
    if (now > data.expiresAt) {
      verificationCodes.delete(email);
    }
  }
}

