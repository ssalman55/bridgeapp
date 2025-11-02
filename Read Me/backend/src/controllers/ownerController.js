const PaymentGatewayConfig = require('../models/PaymentGatewayConfig');
const crypto = require('crypto');

// Utility: encrypt/decrypt helpers (for demo, use env secret in real app)
const ENCRYPTION_KEY = process.env.PAYMENT_CONFIG_SECRET || 'changemechangemechangeme12'; // 32 chars
const IV_LENGTH = 16;
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// GET /api/payment-gateway-config?gateway=stripe
exports.getConfig = async (req, res) => {
  try {
    const { gateway } = req.query;
    const ownerId = req.user._id;
    const config = await PaymentGatewayConfig.findOne({ owner: ownerId, gateway });
    if (!config) return res.json({ config: null });
    // Mask sensitive fields
    const maskedConfig = { ...config.config };
    (config.encryptedFields || []).forEach(f => { if (maskedConfig[f]) maskedConfig[f] = '••••••••'; });
    res.json({ config: maskedConfig, gateway: config.gateway });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching config' });
  }
};

// POST /api/payment-gateway-config
exports.saveOrUpdateConfig = async (req, res) => {
  try {
    const { gateway, config } = req.body;
    const ownerId = req.user._id;
    // Define which fields to encrypt per gateway
    const sensitiveFields = {
      stripe: ['secretKey', 'webhookSecret'],
      cybersource: ['apiKey', 'sharedSecret', 'accessKey'],
      paypal: ['clientSecret'],
      square: ['accessToken'],
      razorpay: ['keySecret'],
    };
    const encryptedFields = sensitiveFields[gateway] || [];
    const configToSave = { ...config };
    encryptedFields.forEach(f => {
      if (configToSave[f]) configToSave[f] = encrypt(configToSave[f]);
    });
    let doc = await PaymentGatewayConfig.findOne({ owner: ownerId, gateway });
    if (!doc) {
      doc = new PaymentGatewayConfig({ owner: ownerId, gateway, config: configToSave, encryptedFields, updatedBy: ownerId });
    } else {
      doc.config = configToSave;
      doc.encryptedFields = encryptedFields;
      doc.updatedAt = new Date();
      doc.updatedBy = ownerId;
    }
    await doc.save();
    res.json({ message: 'Configuration saved.' });
  } catch (err) {
    res.status(500).json({ message: 'Error saving config' });
  }
};

// POST /api/payment-gateway-config/test
exports.testConnection = async (req, res) => {
  try {
    const { gateway, config } = req.body;
    // For demo: just check required fields exist
    let ok = false;
    if (gateway === 'stripe') ok = !!(config.publishableKey && config.secretKey);
    else if (gateway === 'cybersource') ok = !!(config.merchantId && config.apiKey);
    else if (gateway === 'paypal') ok = !!(config.clientId && config.clientSecret);
    else if (gateway === 'square') ok = !!(config.applicationId && config.accessToken);
    else if (gateway === 'razorpay') ok = !!(config.keyId && config.keySecret);
    else if (gateway === 'manual') ok = true;
    if (ok) res.json({ success: true, message: 'Connection test passed.' });
    else res.status(400).json({ success: false, message: 'Missing required fields.' });
  } catch (err) {
    res.status(500).json({ message: 'Error testing connection' });
  }
}; 