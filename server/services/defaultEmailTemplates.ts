import type { IStorage } from '../storage';
import type { InsertEmailTemplate } from '@shared/schema';

export const DEFAULT_EMAIL_TEMPLATES: InsertEmailTemplate[] = [
  {
    templateKey: "delivery_estimate",
    name: "Delivery Estimate",
    subject: "Your Photo Delivery Estimate - {{clientName}}",
    htmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  {{emailHeader}}
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Dear {{clientName}},</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Thank you for your session with us on <strong>{{shootDate}}</strong>!</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">We wanted to let you know that your beautifully retouched photos are scheduled to be ready during the <strong>{{deliveryWeek}}</strong>.</p>
  <div style="background: #f8f8f8; border-left: 4px solid #e91e63; padding: 15px 20px; margin: 25px 0;">
    <p style="color: #333; font-size: 14px; margin: 0;">
      <strong>Shoot Date:</strong> {{shootDate}}<br>
      <strong>Expected Delivery:</strong> {{deliveryWeek}}
    </p>
  </div>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">This estimate accounts for 20 working days (excluding weekends and public holidays). If any changes occur, we'll keep you updated.</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">We can't wait to share the final results with you!</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Warm regards,<br><strong>The Jepson Myles Studio Team</strong></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">This is an automated message from Jepson Myles Studio.</p>
</div>`,
    availableVariables: ["clientName", "shootDate", "deliveryWeek", "emailHeader"],
    isCustomized: false,
  },
  {
    templateKey: "project_added",
    name: "Photo Selection Confirmation",
    subject: "Your Photo Selection Confirmation - {{clientName}}",
    htmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  {{emailHeader}}
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Dear {{clientName}},</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Your photo project has been added to our workflow system. Here are the details:</p>
  <div style="background: #f8f8f8; border-radius: 8px; padding: 20px; margin: 25px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #666;">Package Photos:</td>
        <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right;">{{packageCount}}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Photos Selected:</td>
        <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right;">{{selectedCount}}</td>
      </tr>
    </table>
  </div>
  {{extrasSection}}
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Our talented retouchers will begin working on your photos shortly. You'll receive an update when they're ready for delivery.</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Warm regards,<br><strong>The Jepson Myles Studio Team</strong></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">This is an automated message from Jepson Myles Studio.</p>
</div>`,
    availableVariables: ["clientName", "packageCount", "selectedCount", "extras", "extrasSection", "emailHeader"],
    isCustomized: false,
  },
  {
    templateKey: "chat_link",
    name: "Chat Link",
    subject: "Connect with Your Retoucher - {{clientName}}",
    htmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  {{emailHeader}}
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Dear {{clientName}},</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">You now have a direct line to communicate with <strong>{{retoucherName}}</strong>, the talented retoucher assigned to your project!</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Use the link below to chat about your photos, provide feedback, or ask questions:</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{chatUrl}}" style="display: inline-block; background: #25d366; color: white; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-weight: bold; font-size: 16px;">Chat with your retoucher</a>
  </div>
  <div style="background: #e8f5e9; border-radius: 8px; padding: 15px 20px; margin: 25px 0; text-align: center;">
    <p style="color: #333; font-size: 15px; font-weight: bold; margin: 0 0 5px 0;">Your direct line to the team editor for faster response</p>
    <p style="color: #666; font-size: 14px; margin: 0;">Monday to Friday 9AM–4PM</p>
  </div>
  <div style="background: #f0f0f0; border-radius: 8px; padding: 15px 20px; margin: 25px 0;">
    <p style="color: #666; font-size: 14px; margin: 0;"><strong>How it works:</strong><br>Simply enter your email address ({{clientEmail}}) to verify your identity and start chatting.</p>
  </div>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">We're excited to collaborate with you on creating the perfect final images!</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Warm regards,<br><strong>The Jepson Myles Studio Team</strong></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">This is an automated message from Jepson Myles Studio.</p>
</div>`,
    availableVariables: ["clientName", "retoucherName", "chatUrl", "clientEmail", "emailHeader"],
    isCustomized: false,
  },
  {
    templateKey: "message_notification",
    name: "New Message Notification",
    subject: "New Message from {{retoucherName}} - Jepson Myles Studio",
    htmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  {{emailHeader}}
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Hi {{clientName}},</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;"><strong>{{retoucherName}}</strong> has sent you a new message about your project:</p>
  <div style="background: #e8f5e9; border-left: 4px solid #25d366; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
    <div style="margin-bottom: 8px;">
      <span style="font-weight: bold; color: #333; font-size: 14px;">{{retoucherName}}</span>
      <span style="color: #999; font-size: 12px; margin-left: 10px;">Just now</span>
    </div>
    <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0;">{{newMessage}}</p>
  </div>
  {{threadHtml}}
  <div style="background: #f0f7ff; border-radius: 8px; padding: 15px 20px; margin: 25px 0;">
    <p style="color: #333; font-size: 14px; margin: 0 0 10px 0;"><strong>How to reply:</strong></p>
    <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0;">Reply to this email - Your message will be delivered directly<br>Use the button below - Open the chat for a real-time conversation</p>
  </div>
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{chatUrl}}" style="display: inline-block; background: #25d366; color: white; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-weight: bold; font-size: 16px;">Chat with your retoucher</a>
  </div>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Best,<br><strong>The Jepson Myles Studio Team</strong></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">This is an automated message from Jepson Myles Studio.</p>
</div>`,
    availableVariables: ["clientName", "retoucherName", "newMessage", "chatUrl", "threadHtml", "emailHeader"],
    isCustomized: false,
  },
  {
    templateKey: "delay_notification",
    name: "Delay Notification",
    subject: "Update on Your Photo Delivery - {{clientName}}",
    htmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  {{emailHeader}}
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Dear {{clientName}},</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">We wanted to reach out to give you an update on your photo delivery.</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Due to high demand, your photos have been rescheduled. We apologize for any inconvenience this may cause.</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">We truly appreciate your patience and understanding. Rest assured, your photos are in our queue and we will deliver them as soon as possible.</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">If you have any questions or concerns, please don't hesitate to reply to this email.</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Thank you for your continued trust in us.</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Warm regards,<br><strong>The Jepson Myles Studio Team</strong></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">This is an automated message from Jepson Myles Studio.</p>
</div>`,
    availableVariables: ["clientName", "emailHeader"],
    isCustomized: false,
  },
  {
    templateKey: "sneak_peek",
    name: "Sneak Peek Preview",
    subject: "A Special Preview of Your Photos! - Jepson Myles Studio",
    htmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  {{emailHeader}}
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Dear {{clientName}},</p>
  <div style="background: linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%); border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;">
    <p style="color: #c2185b; font-size: 18px; line-height: 1.6; margin: 0; font-weight: bold;">✨ Sneak Peek!</p>
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 10px 0 0 0;">We're still working on your full set, but we couldn't wait to share this with you!</p>
  </div>
  {{sneakPeekHtml}}
  <p style="color: #333; font-size: 16px; line-height: 1.6;">We hope this little preview gets you excited for the full set! We're putting our best work into every single photo.</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Stay tuned for the complete delivery coming soon!</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Warm regards,<br><strong>The Jepson Myles Studio Team</strong></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">This is an automated message from Jepson Myles Studio.</p>
</div>`,
    availableVariables: ["clientName", "retoucherName", "sneakPeekHtml", "emailHeader"],
    isCustomized: false,
  },
  {
    templateKey: "gallery_delivery",
    name: "Gallery Delivery",
    subject: "Your Photos Are Ready! - Jepson Myles Studio",
    htmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  {{emailHeader}}
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Dear {{clientName}},</p>
  <div style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;">
    <p style="color: #2e7d32; font-size: 20px; line-height: 1.6; margin: 0; font-weight: bold;">Congratulations!</p>
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 10px 0 0 0;">Your beautifully retouched photos are ready for you to view and download.</p>
  </div>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">We've put a lot of care and attention into every photo, and we hope you love the results as much as we do!</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{galleryLink}}" style="display: inline-block; background: #e91e63; color: white; text-decoration: none; padding: 16px 48px; border-radius: 30px; font-weight: bold; font-size: 18px; letter-spacing: 0.5px;">View Your Gallery</a>
  </div>
  <div style="background: #f8f8f8; border-radius: 8px; padding: 15px 20px; margin: 25px 0;">
    <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0;"><strong>Gallery Link:</strong><br><a href="{{galleryLink}}" style="color: #e91e63; word-break: break-all;">{{galleryLink}}</a></p>
  </div>
  {{referralSection}}
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Thank you for choosing Jepson Myles Studio. It's been a pleasure working on your photos, and we look forward to capturing more special moments with you in the future!</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Warm regards,<br><strong>The Jepson Myles Studio Team</strong></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">This is an automated message from Jepson Myles Studio.<br>If you have any questions, please reply to this email.</p>
</div>`,
    availableVariables: ["clientName", "galleryLink", "referralSection", "emailHeader"],
    isCustomized: false,
  },
  {
    templateKey: "satisfaction_survey",
    name: "Satisfaction Survey",
    subject: "How Was Your Experience? - Jepson Myles Studio",
    htmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  {{emailHeader}}
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Dear {{clientName}},</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">We hope you're enjoying your beautiful photos! We'd love to hear about your experience with Jepson Myles Studio.</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Your feedback helps us improve and continue delivering the best possible service. It only takes a minute!</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{surveyUrl}}" style="display: inline-block; background: #e91e63; color: white; text-decoration: none; padding: 16px 48px; border-radius: 30px; font-weight: bold; font-size: 18px; letter-spacing: 0.5px;">Share Your Feedback</a>
  </div>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Thank you for being a valued client. We truly appreciate your time and your trust in us.</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Warm regards,<br><strong>The Jepson Myles Studio Team</strong></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">This is an automated message from Jepson Myles Studio.</p>
</div>`,
    availableVariables: ["clientName", "surveyUrl", "emailHeader"],
    isCustomized: false,
  },
  {
    templateKey: "scheduling_notification",
    name: "Scheduling Notification",
    subject: "Your Photos Are Scheduled! - Jepson Myles Studio",
    htmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  {{emailHeader}}
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Dear {{clientName}},</p>
  <div style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;">
    <p style="color: #2e7d32; font-size: 20px; line-height: 1.6; margin: 0; font-weight: bold;">Great News!</p>
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 10px 0 0 0;">Your photos have been scheduled for delivery during the week of</p>
    <p style="color: #2e7d32; font-size: 18px; font-weight: bold; margin: 10px 0 0 0;">{{weekStartText}} - {{weekEndText}}</p>
  </div>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Our team is working hard to ensure your photos are beautifully retouched and ready for you. We're looking forward to sharing them with you!</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">If you have any questions in the meantime, please don't hesitate to reach out.</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Warm regards,<br><strong>The Jepson Myles Studio Team</strong></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">This is an automated message from Jepson Myles Studio.</p>
</div>`,
    availableVariables: ["clientName", "weekStartText", "weekEndText", "emailHeader"],
    isCustomized: false,
  },
  {
    templateKey: "manual_delay_notice",
    name: "Manual Delay Notice",
    subject: "Update on Your Photos - Jepson Myles Studio",
    htmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  {{emailHeader}}
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Dear {{clientName}},</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">We wanted to let you know that your photos are taking a bit longer than expected. We sincerely apologize for any inconvenience.</p>
  <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px 20px; margin: 25px 0;">
    <p style="color: #333; font-size: 14px; margin: 0;">
      <strong>Your photos are now scheduled for delivery during the week of:</strong><br>
      <span style="font-size: 16px; color: #856404; font-weight: bold;">{{weekStartText}} - {{weekEndText}}</span>
    </p>
  </div>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">We want you to know that our team is putting extra care and attention into every detail of your photos. Quality is our top priority, and we want to make sure you receive nothing but the best.</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Thank you for your patience and understanding. If you have any questions, please don't hesitate to reach out.</p>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Warm regards,<br><strong>The Jepson Myles Studio Team</strong></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">This is an automated message from Jepson Myles Studio.</p>
</div>`,
    availableVariables: ["clientName", "weekStartText", "weekEndText", "emailHeader"],
    isCustomized: false,
  },
];

export async function seedDefaultTemplates(storage: IStorage) {
  const existing = await storage.getAllEmailTemplates();
  const existingKeys = new Set(existing.map(t => t.templateKey));
  for (const tmpl of DEFAULT_EMAIL_TEMPLATES) {
    if (!existingKeys.has(tmpl.templateKey)) {
      await storage.upsertEmailTemplate(tmpl);
    }
  }
}
