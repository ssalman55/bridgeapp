const { sendContactSalesEmail } = require('../services/emailService');

/**
 * Handle contact sales form submissions
 */
exports.submitContactSales = async (req, res) => {
  try {
    const {
      name,
      workEmail,
      company,
      teamSize,
      country,
      modulesOfInterest,
      message,
      plan,
      timestamp
    } = req.body;

    // Validate required fields
    if (!name || !workEmail || !company || !teamSize || !country) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(workEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    console.log('[Contact Sales] New submission received:', {
      name,
      workEmail,
      company,
      teamSize,
      country,
      plan: plan || 'Custom',
      timestamp: timestamp || new Date().toISOString()
    });

    // Send email notification using existing email service
    try {
      await sendContactSalesEmail({
        name,
        workEmail,
        company,
        teamSize,
        country,
        modulesOfInterest: modulesOfInterest || [],
        message: message || '',
        plan: plan || 'Custom',
        submittedAt: timestamp || new Date().toISOString()
      });

      console.log('[Contact Sales] Email notification sent successfully to support@stfbridge.com');
    } catch (emailError) {
      console.error('[Contact Sales] Error sending email notification:', emailError);
      // Don't fail the request if email fails
    }

    // TODO: Save to database if needed
    // const contactLead = new ContactLead({
    //   name,
    //   workEmail,
    //   company,
    //   teamSize,
    //   country,
    //   modulesOfInterest,
    //   message,
    //   plan: plan || 'Custom',
    //   submittedAt: new Date(),
    //   source: 'pricing_page'
    // });
    // await contactLead.save();

    res.status(200).json({
      success: true,
      message: 'Thank you for your interest! Our team will reach out within 1 business day.'
    });

  } catch (error) {
    console.error('[Contact Sales] Error processing submission:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to process your request at this time. Please email support@stfbridge.com directly.'
    });
  }
};

/**
 * Health check endpoint for contact service
 */
exports.healthCheck = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Contact service is operational',
    timestamp: new Date().toISOString()
  });
};
