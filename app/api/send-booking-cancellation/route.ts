import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, booking, rejectionReason, kind } = body as {
      to?: string;
      booking?: Record<string, unknown>;
      rejectionReason?: string;
      kind?: 'reject_pending' | 'cancel_confirmed';
    };

    if (!to || !booking || typeof rejectionReason !== 'string' || !rejectionReason.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields: to, booking, and rejectionReason' },
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

    const formatDate = (date: string | Date) => {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const venueType = booking.type === 'dome-tent' ? 'Dome Tent' : 'Training Hall';
    const contact = (booking.contactPerson as string) || 'Valued Customer';
    const reasonSafe = escapeHtml(rejectionReason.trim());
    const isCancelConfirmed = kind === 'cancel_confirmed';

    const intro = isCancelConfirmed
      ? `Your <strong>confirmed</strong> booking has been <strong style="color:#dc2626;">cancelled</strong> by the administrator.`
      : `Your booking request could not be approved and has been <strong style="color:#dc2626;">declined</strong>.`;

    const subject = isCancelConfirmed
      ? `Booking Cancelled - ${(booking.eventTitle as string) || venueType} - ${formatDate(booking.date as string | Date)}`
      : `Booking Not Approved - ${(booking.eventTitle as string) || venueType} - ${formatDate(booking.date as string | Date)}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9f9f9; padding: 24px; border: 1px solid #ddd; border-top: none; }
            .reason-box { background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .label { font-weight: bold; color: #555; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0;font-size:22px;">${isCancelConfirmed ? 'Booking Cancelled' : 'Booking Update'}</h1>
              <p style="margin:8px 0 0;opacity:0.95;font-size:14px;">Provincial Government of Aurora</p>
            </div>
            <div class="content">
              <p>Dear ${escapeHtml(contact)},</p>
              <p>${intro}</p>
              <div class="reason-box">
                <p class="label" style="margin:0 0 8px;color:#991b1b;">Reason provided by the office:</p>
                <p style="margin:0;white-space:pre-wrap;color:#1f2937;">${reasonSafe}</p>
              </div>
              <p><span class="label">Venue:</span> ${venueType}</p>
              ${booking.bookingReferenceNo ? `<p><span class="label">Reference:</span> ${escapeHtml(String(booking.bookingReferenceNo))}</p>` : ''}
              ${booking.eventTitle ? `<p><span class="label">Event:</span> ${escapeHtml(String(booking.eventTitle))}</p>` : ''}
              <p><span class="label">Date:</span> ${formatDate(booking.date as string | Date)}</p>
              <p><span class="label">Time:</span> ${booking.startTime} - ${booking.endTime}</p>
              <p style="margin-top:20px;">If you have questions, please contact the office.</p>
            </div>
            <div class="footer">
              <p>Provincial Government of Aurora · Baler, Aurora</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textPlain = `
${isCancelConfirmed ? 'Booking cancelled' : 'Booking not approved'} - Provincial Government of Aurora

Dear ${contact},

${isCancelConfirmed ? 'Your confirmed booking has been cancelled by the administrator.' : 'Your booking request could not be approved.'}

Reason provided by the office:
${rejectionReason.trim()}

Venue: ${venueType}
${booking.bookingReferenceNo ? `Reference: ${booking.bookingReferenceNo}\n` : ''}${booking.eventTitle ? `Event: ${booking.eventTitle}\n` : ''}Date: ${formatDate(booking.date as string | Date)}
Time: ${booking.startTime} - ${booking.endTime}

If you have questions, please contact the office.

---
Provincial Government of Aurora
`;

    await transporter.sendMail({
      from: `"Provincial Government of Aurora" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: textPlain,
      html: htmlContent,
    });

    return NextResponse.json({ message: 'Cancellation email sent successfully' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending cancellation email:', error);
    return NextResponse.json(
      { error: 'Failed to send email', details: message },
      { status: 500 }
    );
  }
}
