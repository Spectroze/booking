import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, booking } = body;

    // Validate required fields
    if (!to || !booking) {
      return NextResponse.json(
        { error: 'Missing required fields: to and booking' },
        { status: 400 }
      );
    }

    // Create transporter - configure with your email service
    // For Gmail, you'll need to use an App Password
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // Your Gmail address
        pass: process.env.EMAIL_PASSWORD, // Your Gmail App Password
      },
    });

    // Format booking details
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
    
    let equipmentList = '';
    if (booking.equipmentNeeded) {
      const equipment = [];
      if (booking.equipmentNeeded.projectorAndScreen) equipment.push('Projector and Screen');
      if (booking.equipmentNeeded.lectern) equipment.push('Lectern');
      if (booking.equipmentNeeded.tables) {
        equipment.push(`Tables${booking.equipmentNeeded.tablesQuantity ? ` (${booking.equipmentNeeded.tablesQuantity})` : ''}`);
      }
      if (booking.equipmentNeeded.whiteboard) equipment.push('Whiteboard');
      if (booking.equipmentNeeded.soundSystem) equipment.push('Sound System');
      if (booking.equipmentNeeded.flagStand) equipment.push('Flag Stand');
      if (booking.equipmentNeeded.chairs) {
        equipment.push(`Chairs${booking.equipmentNeeded.chairsQuantity ? ` (${booking.equipmentNeeded.chairsQuantity})` : ''}`);
      }
      if (booking.equipmentNeeded.others) equipment.push(booking.equipmentNeeded.others);
      equipmentList = equipment.length > 0 ? equipment.join(', ') : 'None';
    }

    // Email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
            .section { margin-bottom: 20px; }
            .label { font-weight: bold; color: #555; }
            .value { margin-top: 5px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .status-badge { display: inline-block; padding: 5px 15px; background-color: #4CAF50; color: white; border-radius: 20px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Booking Confirmation</h1>
              <p>Provincial Government of Aurora</p>
            </div>
            <div class="content">
              <p>Dear ${booking.contactPerson || 'Valued Customer'},</p>
              
              <p>We are pleased to inform you that your booking request has been <span class="status-badge">CONFIRMED</span>.</p>
              
              <div class="section">
                <h2>Booking Details</h2>
                <p><span class="label">Venue:</span> <span class="value">${venueType}</span></p>
                ${booking.bookingReferenceNo ? `<p><span class="label">Booking Reference No.:</span> <span class="value">${booking.bookingReferenceNo}</span></p>` : ''}
                ${booking.eventTitle ? `<p><span class="label">Event Title:</span> <span class="value">${booking.eventTitle}</span></p>` : ''}
                <p><span class="label">Date:</span> <span class="value">${formatDate(booking.date)}</span></p>
                <p><span class="label">Time:</span> <span class="value">${booking.startTime} - ${booking.endTime}</span></p>
                ${booking.expectedNumberOfParticipants ? `<p><span class="label">Expected Participants:</span> <span class="value">${booking.expectedNumberOfParticipants}</span></p>` : ''}
              </div>

              ${booking.requestingOffice ? `
              <div class="section">
                <h2>Contact Information</h2>
                <p><span class="label">Requesting Office:</span> <span class="value">${booking.requestingOffice}</span></p>
                ${booking.mobileNo ? `<p><span class="label">Mobile No.:</span> <span class="value">${booking.mobileNo}</span></p>` : ''}
              </div>
              ` : ''}

              ${equipmentList !== 'None' ? `
              <div class="section">
                <h2>Equipment and Services</h2>
                <p class="value">${equipmentList}</p>
              </div>
              ` : ''}

              ${booking.additionalNotes ? `
              <div class="section">
                <h2>Additional Notes</h2>
                <p class="value">${booking.additionalNotes}</p>
              </div>
              ` : ''}

              <div class="section">
                <p>Please arrive on time for your scheduled event. If you have any questions or need to make changes, please contact us as soon as possible.</p>
                <p>Thank you for choosing our facilities!</p>
              </div>
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
Booking Confirmation - Provincial Government of Aurora

Dear ${booking.contactPerson || 'Valued Customer'},

We are pleased to inform you that your booking request has been CONFIRMED.

Booking Details:
Venue: ${venueType}
${booking.bookingReferenceNo ? `Booking Reference No.: ${booking.bookingReferenceNo}\n` : ''}${booking.eventTitle ? `Event Title: ${booking.eventTitle}\n` : ''}Date: ${formatDate(booking.date)}
Time: ${booking.startTime} - ${booking.endTime}
${booking.expectedNumberOfParticipants ? `Expected Participants: ${booking.expectedNumberOfParticipants}\n` : ''}
${booking.requestingOffice ? `Requesting Office: ${booking.requestingOffice}\n` : ''}${booking.mobileNo ? `Mobile No.: ${booking.mobileNo}\n` : ''}
${equipmentList !== 'None' ? `Equipment and Services: ${equipmentList}\n` : ''}
${booking.additionalNotes ? `Additional Notes: ${booking.additionalNotes}\n` : ''}

Please arrive on time for your scheduled event. If you have any questions or need to make changes, please contact us as soon as possible.

Thank you for choosing our facilities!

---
Provincial Government of Aurora
Baler, Aurora
This is an automated email. Please do not reply.
    `;

    // Send email
    const mailOptions = {
      from: `"Provincial Government of Aurora" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: `Booking Confirmed - ${booking.eventTitle || venueType} - ${formatDate(booking.date)}`,
      text: textContent,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json(
      { message: 'Email sent successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Failed to send email', details: error.message },
      { status: 500 }
    );
  }
}

