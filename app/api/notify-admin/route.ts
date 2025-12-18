import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// For server-side Firestore access, we'll use a different approach
// Since Admin SDK requires service account, let's use the client SDK with updated rules
// OR we can pass admin emails as environment variable for now

// Alternative: Use environment variable for admin emails
const getAdminEmails = (): string[] => {
  // Option 1: Get from environment variable (comma-separated)
  if (process.env.ADMIN_EMAILS) {
    return process.env.ADMIN_EMAILS.split(',').map(email => email.trim()).filter(Boolean);
  }
  return [];
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { booking } = body;

    console.log('Admin notification API called with booking:', booking);

    if (!booking) {
      console.error('Missing booking data');
      return NextResponse.json(
        { error: 'Missing required field: booking' },
        { status: 400 }
      );
    }

    // Validate email configuration
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('Email configuration missing');
      return NextResponse.json(
        { error: 'Email configuration not set up' },
        { status: 500 }
      );
    }

    // Get admin emails - prioritize environment variable (most reliable for deployment)
    let adminEmails: string[] = getAdminEmails();
    
    console.log(`Found ${adminEmails.length} admin email(s) from environment variable`);
    
    // If no admin emails from env, try to get from Firestore (may not work in serverless environment)
    if (adminEmails.length === 0) {
      console.log('No ADMIN_EMAILS env var found, attempting to fetch from Firestore...');
      try {
        // Try using client SDK - this may not work in serverless/edge environments
        const { collection, getDocs } = await import('firebase/firestore');
        const { db: clientDb } = await import('../../services/firebase');
        
        // Check if db is available (might be mock in SSR)
        if (!clientDb || typeof (clientDb as any).collection !== 'function') {
          throw new Error('Firestore not available in server environment');
        }
        
        const usersRef = collection(clientDb, 'users');
        const allUsersSnapshot = await getDocs(usersRef);
        
        allUsersSnapshot.forEach((doc) => {
          const userData = doc.data();
          if ((userData.role === 'admin' || userData.isAdmin === true) && userData.email) {
            adminEmails.push(userData.email);
          }
        });
        
        console.log(`Found ${adminEmails.length} admin email(s) from Firestore`);
      } catch (firestoreError: any) {
        console.error('Error fetching admins from Firestore:', firestoreError);
        // If Firestore access fails, provide helpful error message
        if (firestoreError.code === 'permission-denied' || firestoreError.message?.includes('not available')) {
          return NextResponse.json(
            { 
              error: 'Unable to fetch admin emails. Please set ADMIN_EMAILS environment variable in your deployment platform.',
              hint: 'In Vercel/Netlify/etc, add ADMIN_EMAILS=admin1@example.com,admin2@example.com to your environment variables',
              details: firestoreError.message || firestoreError.code
            },
            { status: 500 }
          );
        }
      }
    }

    console.log(`Found ${adminEmails.length} admin(s) to notify:`, adminEmails);

    if (adminEmails.length === 0) {
      console.warn('No admin emails found - neither from env var nor Firestore');
      return NextResponse.json(
        { 
          error: 'No admin emails found. Please set ADMIN_EMAILS environment variable in your deployment platform.',
          hint: 'In your deployment platform (Vercel/Netlify/etc), add: ADMIN_EMAILS=admin1@gmail.com,admin2@gmail.com',
          message: 'No admin users found to notify'
        },
        { status: 400 }
      );
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Format booking details
    const formatDate = (date: string | Date) => {
      try {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) {
          console.error('Invalid date:', date);
          return 'Invalid Date';
        }
        return d.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      } catch (error) {
        console.error('Error formatting date:', error);
        return 'Date not available';
      }
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

    // Email content for admin notification
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #FF6B35; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
            .section { margin-bottom: 20px; }
            .label { font-weight: bold; color: #555; }
            .value { margin-top: 5px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .alert-badge { display: inline-block; padding: 8px 20px; background-color: #FF6B35; color: white; border-radius: 20px; font-weight: bold; margin-bottom: 15px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #2563EB; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Booking Request</h1>
              <p>Provincial Government of Aurora</p>
            </div>
            <div class="content">
              <div class="alert-badge">⚠️ ACTION REQUIRED</div>
              
              <p>Dear Admin,</p>
              
              <p>A new booking request has been submitted and requires your review.</p>
              
              <div class="section">
                <h2>Booking Summary</h2>
                <p><span class="label">Venue:</span> <span class="value">${venueType}</span></p>
                ${booking.bookingReferenceNo ? `<p><span class="label">Booking Reference No.:</span> <span class="value">${booking.bookingReferenceNo}</span></p>` : ''}
                ${booking.eventTitle ? `<p><span class="label">Event Title:</span> <span class="value">${booking.eventTitle}</span></p>` : ''}
                <p><span class="label">Date:</span> <span class="value">${formatDate(booking.date)}</span></p>
                <p><span class="label">Time:</span> <span class="value">${booking.startTime} - ${booking.endTime}</span></p>
                ${booking.expectedNumberOfParticipants ? `<p><span class="label">Expected Participants:</span> <span class="value">${booking.expectedNumberOfParticipants}</span></p>` : ''}
              </div>

              ${booking.contactPerson || booking.requestingOffice ? `
              <div class="section">
                <h2>Contact Information</h2>
                ${booking.contactPerson ? `<p><span class="label">Contact Person:</span> <span class="value">${booking.contactPerson}</span></p>` : ''}
                ${booking.requestingOffice ? `<p><span class="label">Requesting Office:</span> <span class="value">${booking.requestingOffice}</span></p>` : ''}
                ${booking.mobileNo ? `<p><span class="label">Mobile No.:</span> <span class="value">${booking.mobileNo}</span></p>` : ''}
              </div>
              ` : ''}

              ${equipmentList !== 'None' ? `
              <div class="section">
                <h2>Equipment and Services Requested</h2>
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
                <p><strong>Please log in to the admin panel to review and process this booking request.</strong></p>
              </div>
            </div>
            <div class="footer">
              <p>Provincial Government of Aurora<br>Baler, Aurora</p>
              <p>This is an automated notification email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
New Booking Request - Provincial Government of Aurora

Dear Admin,

A new booking request has been submitted and requires your review.

Booking Summary:
Venue: ${venueType}
${booking.bookingReferenceNo ? `Booking Reference No.: ${booking.bookingReferenceNo}\n` : ''}${booking.eventTitle ? `Event Title: ${booking.eventTitle}\n` : ''}Date: ${formatDate(booking.date)}
Time: ${booking.startTime} - ${booking.endTime}
${booking.expectedNumberOfParticipants ? `Expected Participants: ${booking.expectedNumberOfParticipants}\n` : ''}
${booking.contactPerson ? `Contact Person: ${booking.contactPerson}\n` : ''}${booking.requestingOffice ? `Requesting Office: ${booking.requestingOffice}\n` : ''}${booking.mobileNo ? `Mobile No.: ${booking.mobileNo}\n` : ''}
${equipmentList !== 'None' ? `Equipment and Services: ${equipmentList}\n` : ''}
${booking.additionalNotes ? `Additional Notes: ${booking.additionalNotes}\n` : ''}

Please log in to the admin panel to review and process this booking request.

---
Provincial Government of Aurora
Baler, Aurora
This is an automated notification email.
    `;

    // Send email to all admins
    const emailPromises = adminEmails.map(async (email) => {
      try {
        const mailOptions = {
          from: `"Provincial Government of Aurora" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: `New Booking Request - ${booking.eventTitle || venueType} - ${formatDate(booking.date)}`,
          text: textContent,
          html: htmlContent,
        };

        console.log(`Sending email to admin: ${email}`);
        const result = await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${email}:`, result.messageId);
        return { success: true, email, messageId: result.messageId };
      } catch (emailError: any) {
        console.error(`Failed to send email to ${email}:`, emailError);
        return { success: false, email, error: emailError.message };
      }
    });

    const results = await Promise.all(emailPromises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Email sending complete: ${successful} successful, ${failed} failed`);

    return NextResponse.json(
      { 
        message: `Notification sent to ${successful} of ${adminEmails.length} admin(s)`, 
        adminEmails,
        results,
        successful,
        failed
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error sending admin notification:', error);
    return NextResponse.json(
      { error: 'Failed to send admin notification', details: error.message },
      { status: 500 }
    );
  }
}

