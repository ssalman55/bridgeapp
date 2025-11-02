const Organization = require('../models/Organization');
const PaymentGatewayConfig = require('../models/PaymentGatewayConfig');
const Stripe = require('stripe');
const crypto = require('crypto');
const { generateAndStoreReceipt } = require('./organizationController');
const { sendPaymentConfirmationEmail } = require('../services/emailService');
const ENCRYPTION_KEY = process.env.PAYMENT_CONFIG_SECRET || 'changemechangemechangeme12'; // 32 chars
const IV_LENGTH = 16;

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Get Stripe config for the super user (admin@sb.com)
async function getStripeConfig() {
  const User = require('../models/User');
  const superUser = await User.findOne({ email: 'admin@sb.com' });
  if (!superUser) throw new Error('Super user not found');
  const config = await PaymentGatewayConfig.findOne({ owner: superUser._id, gateway: 'stripe' });
  if (!config) throw new Error('Stripe not configured');
  // Decrypt sensitive fields
  const decryptedConfig = { ...config.config };
  (config.encryptedFields || []).forEach(field => {
    if (decryptedConfig[field]) {
      decryptedConfig[field] = decrypt(decryptedConfig[field]);
    }
  });
  return {
    secretKey: decryptedConfig.secretKey,
    publishableKey: decryptedConfig.publishableKey,
    webhookSecret: decryptedConfig.webhookSecret,
    mode: decryptedConfig.mode || 'Test',
  };
}

// Create payment intent
exports.createPaymentIntent = async (req, res) => {
  try {
    const { amount, currency = 'USD', plan, organizationId } = req.body;
    if (!amount || !plan || !organizationId) {
      return res.status(400).json({ error: 'Amount, plan, and organization ID are required' });
    }
    const organization = await Organization.findById(organizationId);
    if (!organization) return res.status(404).json({ error: 'Organization not found' });
    const config = await getStripeConfig();
    const stripe = new Stripe(config.secretKey, { apiVersion: '2022-11-15' });
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // cents
      currency,
      metadata: {
        plan,
        organizationId,
        organizationName: organization.name
      },
      description: `StaffBridge ${plan} Plan Subscription`,
      receipt_email: organization.email
    });
    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      publishableKey: config.publishableKey,
      amount,
      currency,
      plan
    });
  } catch (err) {
    console.error('Stripe createPaymentIntent error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Confirm payment (optional, Stripe handles this via webhooks)
exports.confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId, organizationId, plan } = req.body;
    if (!paymentIntentId || !organizationId || !plan) {
      return res.status(400).json({ error: 'Payment intent ID, organization ID, and plan are required' });
    }
    const organization = await Organization.findById(organizationId);
    if (!organization) return res.status(404).json({ error: 'Organization not found' });
    const config = await getStripeConfig();
    const stripe = new Stripe(config.secretKey, { apiVersion: '2022-11-15' });
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }
    // Special handling for test plan
    if (plan === 'test') {
      organization.paymentHistory = organization.paymentHistory || [];
      
      // Create payment record for test plan
      const paymentRecord = {
        amount: paymentIntent.amount / 100, // Stripe amount is in cents
        plan: 'test',
        date: new Date(),
        transactionId: paymentIntent.id,
        paymentMethod: 'Stripe',
        currency: paymentIntent.currency,
        test: true
      };
      
      organization.paymentHistory.push(paymentRecord);
      await organization.save();
      
      // Generate and store receipt PDF to S3 for test payments too
      try {
        await generateAndStoreReceipt(organization, paymentRecord);
        console.log(`Receipt generated for test payment ${paymentIntent.id}`);
      } catch (receiptError) {
        console.error('Error generating receipt for test payment:', receiptError);
        // Don't fail the entire operation if receipt generation fails
      }
      
      return res.json({ success: true, message: 'Test payment recorded' });
    }
    // Existing logic for real plans - per-staff pricing
    const planPricesPerStaff = { basic: 1.99, professional: 3.99, enterprise: 6.99 };
    
    // Get staff count from metadata or calculate from organization
    const User = require('../models/User');
    const staffCount = await User.countDocuments({
      organization: organization._id,
      status: { $ne: 'archived' }
    });
    
    const pricePerStaff = planPricesPerStaff[plan] || 1.99;
    const monthlyAmount = pricePerStaff * Math.max(staffCount, 1);
    const annualAmount = monthlyAmount * 12;
    let staffLimit = 10;
    if (plan === 'professional') staffLimit = 100;
    if (plan === 'enterprise') staffLimit = 1000000;
    const now = new Date();
    const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    organization.plan = plan;
    organization.staffLimit = staffLimit;
    organization.subscriptionStartDate = now;
    organization.subscriptionEndDate = oneYearLater;
    organization.subscriptionStatus = 'active';
    organization.paymentHistory = organization.paymentHistory || [];
    
    // Create payment record
    const paymentRecord = {
      amount: annualAmount,
      plan,
      date: now,
      transactionId: paymentIntent.id,
      paymentMethod: 'Stripe',
      currency: paymentIntent.currency
    };
    
    organization.paymentHistory.push(paymentRecord);
    await organization.save();
    
    // Generate and store receipt PDF to S3
    try {
      await generateAndStoreReceipt(organization, paymentRecord);
      console.log(`Receipt generated for payment ${paymentIntent.id} (${plan} plan)`);
    } catch (receiptError) {
      console.error('Error generating receipt:', receiptError);
      // Don't fail the entire operation if receipt generation fails
    }
    
    // Send payment confirmation email
    try {
      // Get the admin user for the organization
      const User = require('../models/User');
      const admin = await User.findOne({ organization: organization._id, role: 'admin' });
      
      if (admin) {
        // Generate receipt URL for the email
        const receiptUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/billing`;
        
        await sendPaymentConfirmationEmail({
          organization,
          admin,
          payment: paymentRecord,
          receiptUrl
        });
        console.log(`Payment confirmation email sent to ${admin.email}`);
      } else {
        console.log('No admin user found for organization, skipping payment confirmation email');
      }
    } catch (emailError) {
      console.error('Error sending payment confirmation email:', emailError);
      // Don't fail the entire operation if email sending fails
    }
    
    res.json({
      success: true,
      message: 'Payment confirmed and subscription updated',
      plan: organization.plan,
      subscriptionEndDate: organization.subscriptionEndDate,
      transactionId: paymentIntent.id
    });
  } catch (err) {
    console.error('Stripe confirmPayment error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Stripe webhook handler
exports.handleWebhook = async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const ownerId = req.query.ownerId; // Pass ownerId as query param for config lookup
    if (!ownerId) return res.status(400).json({ error: 'Missing ownerId for webhook' });
    const config = await getStripeConfig();
    const stripe = new Stripe(config.secretKey, { apiVersion: '2022-11-15' });
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, config.webhookSecret);
    } catch (err) {
      console.error('Stripe webhook signature error:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    // Handle event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      // Find organization by metadata
      const { organizationId, plan } = paymentIntent.metadata;
      if (organizationId && plan) {
        const organization = await Organization.findById(organizationId);
        if (organization) {
          // Update subscription as in confirmPayment - per-staff pricing
          const planPricesPerStaff = { basic: 1.99, professional: 3.99, enterprise: 6.99 };
          
          // Get staff count
          const User = require('../models/User');
          const staffCount = await User.countDocuments({
            organization: organization._id,
            status: { $ne: 'archived' }
          });
          
          const pricePerStaff = planPricesPerStaff[plan] || 1.99;
          const monthlyAmount = pricePerStaff * Math.max(staffCount, 1);
          const annualAmount = monthlyAmount * 12;
          
          let staffLimit = 10;
          if (plan === 'professional') staffLimit = 100;
          if (plan === 'enterprise') staffLimit = 1000000;
          const now = new Date();
          const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          
          // Special handling for test plan
          if (plan === 'test') {
            organization.paymentHistory = organization.paymentHistory || [];
            
            // Create payment record for test plan
            const paymentRecord = {
              amount: paymentIntent.amount / 100, // Stripe amount is in cents
              plan: 'test',
              date: now,
              transactionId: paymentIntent.id,
              paymentMethod: 'Stripe',
              currency: paymentIntent.currency,
              test: true
            };
            
            organization.paymentHistory.push(paymentRecord);
            await organization.save();
            
            // Generate and store receipt PDF to S3 for test payments too
            try {
              await generateAndStoreReceipt(organization, paymentRecord);
              console.log(`Receipt generated via webhook for test payment ${paymentIntent.id}`);
            } catch (receiptError) {
              console.error('Error generating receipt via webhook for test payment:', receiptError);
              // Don't fail the entire operation if receipt generation fails
            }
          } else {
            // Regular plan handling
            organization.plan = plan;
            organization.staffLimit = staffLimit;
            organization.subscriptionStartDate = now;
            organization.subscriptionEndDate = oneYearLater;
            organization.subscriptionStatus = 'active';
            organization.paymentHistory = organization.paymentHistory || [];
            
            // Create payment record
            const paymentRecord = {
              amount: annualAmount,
              plan,
              date: now,
              transactionId: paymentIntent.id,
              paymentMethod: 'Stripe',
              currency: paymentIntent.currency
            };
            
            organization.paymentHistory.push(paymentRecord);
            await organization.save();
            
            // Generate and store receipt PDF to S3
            try {
              await generateAndStoreReceipt(organization, paymentRecord);
              console.log(`Receipt generated via webhook for payment ${paymentIntent.id} (${plan} plan)`);
            } catch (receiptError) {
              console.error('Error generating receipt via webhook:', receiptError);
              // Don't fail the entire operation if receipt generation fails
            }
            
            // Send payment confirmation email
            try {
              // Get the admin user for the organization
              const User = require('../models/User');
              const admin = await User.findOne({ organization: organization._id, role: 'admin' });
              
              if (admin) {
                // Generate receipt URL for the email
                const receiptUrl = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/billing`;
                
                await sendPaymentConfirmationEmail({
                  organization,
                  admin,
                  payment: paymentRecord,
                  receiptUrl
                });
                console.log(`Payment confirmation email sent via webhook to ${admin.email}`);
              } else {
                console.log('No admin user found for organization, skipping payment confirmation email via webhook');
              }
            } catch (emailError) {
              console.error('Error sending payment confirmation email via webhook:', emailError);
              // Don't fail the entire operation if email sending fails
            }
          }
        }
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook error:', err);
    res.status(500).json({ error: err.message });
  }
}; 