// backend/services/emailService.js
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// Debug: Check if credentials are loaded
console.log('=== AWS SES Configuration Check ===');
console.log('Access Key ID:', process.env.AWS_ACCESS_KEY_ID ? '✓ Loaded (length: ' + process.env.AWS_ACCESS_KEY_ID.length + ')' : '✗ Missing');
console.log('Secret Key:', process.env.AWS_SECRET_ACCESS_KEY ? '✓ Loaded (length: ' + process.env.AWS_SECRET_ACCESS_KEY.length + ')' : '✗ Missing');
console.log('Region:', process.env.AWS_REGION || 'us-east-1');
console.log('SES From Email:', process.env.SES_FROM_EMAIL || '✗ Missing');
console.log('Frontend URL:', process.env.FRONTEND_URL || '✗ Missing');
console.log('===================================');

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const sendPasswordResetEmail = async (toEmail, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  
  console.log('Attempting to send password reset email to:', toEmail);
  console.log('Reset URL:', resetUrl);
  
  const params = {
    Source: process.env.SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [toEmail],
    },
    Message: {
      Subject: {
        Data: 'Password Reset Request - MangaRead',
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #e50914; color: white; padding: 20px; text-align: center; }
                .content { background: #f4f4f4; padding: 30px; }
                .button { 
                  display: inline-block; 
                  padding: 12px 30px; 
                  background: #e50914; 
                  color: white; 
                  text-decoration: none; 
                  border-radius: 5px;
                  margin: 20px 0;
                }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1></h1>
                </div>
                <div class="content">
                  <h2>Password Reset Request</h2>
                  <p>You requested to reset your password. Click the button below to reset it:</p>
                  <a href="${resetUrl}" class="button">Reset Password</a>
                  <p>This link will expire in 1 hour.</p>
                  <p>If you didn't request this, please ignore this email.</p>
                  <p style="color: #666; font-size: 12px; margin-top: 30px;">
                    Or copy this link: ${resetUrl}
                  </p>
                </div>
                <div class="footer">
                  <p>&copy; 2025 MangaRead. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          Charset: 'UTF-8',
        },
      },
    },
  };

  try {
    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);
    console.log('✓ Email sent successfully! Message ID:', response.MessageId);
    return { success: true, messageId: response.MessageId };
  } catch (error) {
    console.error('✗ Error sending email:', error);
    return { success: false, error: error.message };
  }
};