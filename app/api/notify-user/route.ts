import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, displayName, status, role } = body;

    if (!to || (!status && !role)) {
      return NextResponse.json(
        { error: 'Missing required fields: to and status or role' },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const name = displayName || 'User';

    // Build email based on type (status update or role update)
    let subject = '';
    let headerColor = '#6366f1';
    let headerTitle = '';
    let bodyContent = '';

    if (status) {
      if (status === 'approved') {
        subject = '✅ Your Account Has Been Approved';
        headerColor = '#10b981';
        headerTitle = 'Account Approved';
        bodyContent = `
          <p>Dear <strong>${name}</strong>,</p>
          <p>Great news! Your account has been <strong style="color:#10b981;">approved</strong> by the administrator.</p>
          <p>You can now sign in and access the booking system.</p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://gso-booking.vercel.app/'}" 
               style="background:#10b981;color:white;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
              Sign In Now
            </a>
          </div>
          <p>If you have any questions, please contact the administrator.</p>
        `;
      } else if (status === 'declined') {
        subject = '❌ Your Account Access Request';
        headerColor = '#ef4444';
        headerTitle = 'Account Access Declined';
        bodyContent = `
          <p>Dear <strong>${name}</strong>,</p>
          <p>We regret to inform you that your account access request has been <strong style="color:#ef4444;">declined</strong> by the administrator.</p>
          <p>If you believe this is a mistake, please reach out to the administrator for assistance.</p>
          <p>Thank you for your understanding.</p>
        `;
      } else if (status === 'pending') {
        subject = '⏳ Your Account Has Been Reset to Pending';
        headerColor = '#f59e0b';
        headerTitle = 'Account Status Update';
        bodyContent = `
          <p>Dear <strong>${name}</strong>,</p>
          <p>Your account status has been reset to <strong style="color:#f59e0b;">pending review</strong>.</p>
          <p>An administrator will review your account shortly.</p>
        `;
      }
    } else if (role) {
      const roleLabels: Record<string, string> = {
        admin: 'General Administrator',
        'admin-training': 'Training Hall Administrator',
        'admin-dome': 'Dome Tent Administrator',
        user: 'Regular User',
      };
      const roleLabel = roleLabels[role] || role;
      subject = `🔄 Your Account Role Has Been Updated`;
      headerColor = '#6366f1';
      headerTitle = 'Role Updated';
      bodyContent = `
        <p>Dear <strong>${name}</strong>,</p>
        <p>Your account role in the booking system has been updated to:</p>
        <div style="text-align:center;margin:20px 0;">
          <span style="background:#6366f1;color:white;padding:8px 24px;border-radius:8px;font-weight:bold;font-size:16px;">
            ${roleLabel}
          </span>
        </div>
        <p>This change takes effect immediately. Please sign in again if you are currently logged in.</p>
      `;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background:#f4f4f4; margin:0; padding:0; }
            .wrapper { max-width: 600px; margin: 30px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
            .header { background: ${headerColor}; color: white; padding: 30px 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 6px 0 0; opacity: 0.85; font-size: 14px; }
            .body { padding: 30px; }
            .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="header">
              <h1>${headerTitle}</h1>
              <p>Provincial Government of Aurora – Booking System</p>
            </div>
            <div class="body">
              ${bodyContent}
            </div>
            <div class="footer">
              <p>Provincial Government of Aurora &bull; Baler, Aurora</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"Provincial Government of Aurora" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
    });

    return NextResponse.json({ message: 'Notification sent successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error sending user notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification', details: error.message },
      { status: 500 }
    );
  }
}
