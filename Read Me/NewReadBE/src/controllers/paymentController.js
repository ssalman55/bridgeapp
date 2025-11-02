const Organization = require('../models/Organization');
const PaymentGatewayConfig = require('../models/PaymentGatewayConfig');
const axios = require('axios');
const crypto = require('crypto');
const { generateAndStoreReceipt } = require('./organizationController');
const { sendPaymentConfirmationEmail } = require('../services/emailService');

// Utility: decrypt helper
const ENCRYPTION_KEY = process.env.PAYMENT_CONFIG_SECRET || 'changemechangemechangeme12';
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

// Get Airwallex configuration
async function getAirwallexConfig(ownerId) {
  const config = await PaymentGatewayConfig.findOne({ owner: ownerId, gateway: 'airwallex' });
  if (!config) {
    throw new Error('Airwallex not configured');
  }
  
  // Decrypt sensitive fields
  const decryptedConfig = { ...config.config };
  config.encryptedFields.forEach(field => {
    if (decryptedConfig[field]) {
      decryptedConfig[field] = decrypt(decryptedConfig[field]);
    }
  });
  
  return decryptedConfig;
}

// Get Airwallex access token
async function getAirwallexToken(config) {
  const baseUrl = config.environment === 'Live' 
    ? 'https://api.airwallex.com/api/v1' 
    : 'https://api.airwallex.com/api/v1';
  
  try {
    const response = await axios.post(`${baseUrl}/authentication/login`, {
      client_id: config.clientId,
      client_secret: config.apiKey
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': config.clientId
      }
    });
    
    return response.data.token;
  } catch (error) {
    console.error('Airwallex authentication error:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with Airwallex');
  }
}

// Create payment intent with Airwallex
exports.createPaymentIntent = async (req, res) => {
  try {
    const { amount, currency = 'USD', plan, organizationId } = req.body;
    
    if (!amount || !plan || !organizationId) {
      return res.status(400).json({ error: 'Amount, plan, and organization ID are required' });
    }

    // Get organization details
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get Airwallex configuration
    const config = await getAirwallexConfig(organization.owner);
    const token = await getAirwallexToken(config);
    
    const baseUrl = config.environment === 'Live' 
      ? 'https://api.airwallex.com/api/v1' 
      : 'https://api.airwallex.com/api/v1';

    // Create payment intent
    const paymentIntentData = {
      amount: amount * 100, // Convert to cents
      currency: currency,
      merchant_order_id: `SB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      descriptor: `StaffBridge ${plan} Plan`,
      metadata: {
        plan: plan,
        organization_id: organizationId,
        organization_name: organization.name
      }
    };

    const response = await axios.post(`${baseUrl}/payment_intents/create`, paymentIntentData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const paymentIntent = response.data;
    
    res.json({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: amount,
      currency: currency,
      plan: plan
    });

  } catch (error) {
    console.error('Error creating payment intent:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
};

// Confirm payment and update organization
exports.confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId, organizationId, plan } = req.body;
    
    if (!paymentIntentId || !organizationId || !plan) {
      return res.status(400).json({ error: 'Payment intent ID, organization ID, and plan are required' });
    }

    // Get organization
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get Airwallex configuration
    const config = await getAirwallexConfig(organization.owner);
    const token = await getAirwallexToken(config);
    
    const baseUrl = config.environment === 'Live' 
      ? 'https://api.airwallex.com/api/v1' 
      : 'https://api.airwallex.com/api/v1';

    // Get payment intent status
    const response = await axios.get(`${baseUrl}/payment_intents/${paymentIntentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const paymentIntent = response.data;
    
    if (paymentIntent.status !== 'SUCCEEDED') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Update organization subscription - per-staff pricing
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

    organization.plan = plan;
    organization.staffLimit = staffLimit;
    organization.subscriptionStartDate = now;
    organization.subscriptionEndDate = oneYearLater;
    organization.subscriptionStatus = 'active';
    
    // Add payment record
    organization.paymentHistory = organization.paymentHistory || [];
    
    // Create payment record
    const paymentRecord = {
      amount: annualAmount,
      plan,
      date: now,
      transactionId: paymentIntent.merchant_order_id,
      paymentMethod: 'Airwallex',
      currency: paymentIntent.currency,
      airwallexPaymentId: paymentIntent.id
    };
    
    organization.paymentHistory.push(paymentRecord);

    await organization.save();
    
    // Generate and store receipt PDF to S3
    try {
      await generateAndStoreReceipt(organization, paymentRecord);
      console.log(`Receipt generated for Airwallex payment ${paymentIntent.merchant_order_id} (${plan} plan)`);
    } catch (receiptError) {
      console.error('Error generating receipt for Airwallex payment:', receiptError);
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
      transactionId: paymentIntent.merchant_order_id
    });

  } catch (error) {
    console.error('Error confirming payment:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
};

// Handle Airwallex webhooks
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-airwallex-signature'];
    const payload = req.body;
    
    // Verify webhook signature (implement signature verification)
    // const config = await getAirwallexConfig(/* get owner ID from payload */);
    // const expectedSignature = crypto.createHmac('sha256', config.webhookSecret)
    //   .update(JSON.stringify(payload))
    //   .digest('hex');
    
    // if (signature !== expectedSignature) {
    //   return res.status(400).json({ error: 'Invalid signature' });
    // }

    const event = payload.event;
    
    switch (event) {
      case 'payment_intent.succeeded':
        // Handle successful payment
        console.log('Payment succeeded:', payload.data);
        break;
        
      case 'payment_intent.failed':
        // Handle failed payment
        console.log('Payment failed:', payload.data);
        break;
        
      default:
        console.log('Unhandled event:', event);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Get payment methods supported by Airwallex
exports.getPaymentMethods = async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const config = await getAirwallexConfig(organization.owner);
    const token = await getAirwallexToken(config);
    
    const baseUrl = config.environment === 'Live' 
      ? 'https://api.airwallex.com/api/v1' 
      : 'https://api.airwallex.com/api/v1';

    const response = await axios.get(`${baseUrl}/payment_methods/supported`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error getting payment methods:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get payment methods' });
  }
}; 