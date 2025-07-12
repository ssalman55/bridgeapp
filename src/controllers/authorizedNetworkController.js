const AuthorizedNetwork = require('../models/AuthorizedNetwork');
const { isValidIpAddress, isValidIpRange, isIpInRange } = require('../utils/ipUtils');
const { validateIpAddress, validateIpRange } = require('../utils/networkValidation');

// Get authorized networks
exports.getAuthorizedNetworks = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const networks = await AuthorizedNetwork.find({ organizationId });
    res.json(networks);
  } catch (err) {
    console.error('Error fetching authorized networks:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Create authorized network
exports.createAuthorizedNetwork = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { ssid, ipAddresses, ipRanges, authorized } = req.body;

    // Validate IP addresses and ranges
    const invalidIps = ipAddresses?.filter(ip => !isValidIpAddress(ip)) || [];
    const invalidRanges = ipRanges?.filter(range => !isValidIpRange(range)) || [];

    if (invalidIps.length > 0 || invalidRanges.length > 0) {
      return res.status(400).json({
        message: 'Invalid IP addresses or ranges provided',
        invalidIps,
        invalidRanges,
      });
    }

    const network = new AuthorizedNetwork({
      ssid,
      ipAddresses,
      ipRanges,
      authorized,
      organizationId,
    });

    await network.save();
    res.status(201).json(network);
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ message: 'A network with this SSID already exists for your organization' });
    } else {
      console.error('Error creating authorized network:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
};

// Update authorized network
exports.updateAuthorizedNetwork = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { id } = req.params;
    const { ssid, ipAddresses, ipRanges, authorized } = req.body;

    // Validate IP addresses and ranges
    const invalidIps = ipAddresses?.filter(ip => !isValidIpAddress(ip)) || [];
    const invalidRanges = ipRanges?.filter(range => !isValidIpRange(range)) || [];

    if (invalidIps.length > 0 || invalidRanges.length > 0) {
      return res.status(400).json({
        message: 'Invalid IP addresses or ranges provided',
        invalidIps,
        invalidRanges,
      });
    }

    const network = await AuthorizedNetwork.findOneAndUpdate(
      { _id: id, organizationId },
      { ssid, ipAddresses, ipRanges, authorized },
      { new: true, runValidators: true }
    );

    if (!network) {
      return res.status(404).json({ message: 'Authorized network not found' });
    }

    res.json(network);
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ message: 'A network with this SSID already exists for your organization' });
    } else {
      console.error('Error updating authorized network:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
};

// Delete authorized network
exports.deleteAuthorizedNetwork = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { id } = req.params;

    const network = await AuthorizedNetwork.findOneAndDelete({ _id: id, organizationId });

    if (!network) {
      return res.status(404).json({ message: 'Authorized network not found' });
    }

    res.json({ message: 'Authorized network deleted successfully' });
  } catch (err) {
    console.error('Error deleting authorized network:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Validate IP address
exports.validateIpAddress = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { ipAddress } = req.body;

    if (!ipAddress || !isValidIpAddress(ipAddress)) {
      return res.status(400).json({ message: 'Invalid IP address provided' });
    }

    const networks = await AuthorizedNetwork.find({
      organizationId,
      authorized: true,
    });

    const isAuthorized = networks.some(network => {
      // Check if the IP is in the list of allowed IPs
      if (network.ipAddresses.includes(ipAddress)) {
        return true;
      }

      // Check if the IP falls within any of the allowed ranges
      return network.ipRanges.some(range => isIpInRange(ipAddress, range));
    });

    res.json({ isAuthorized });
  } catch (err) {
    console.error('Error validating IP address:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get all authorized networks for the organization
exports.getNetworks = async (req, res) => {
  try {
    const networks = await AuthorizedNetwork.find({ organization: req.user.organization });
    res.json(networks);
  } catch (error) {
    console.error('Error fetching networks:', error);
    res.status(500).json({ message: 'Failed to fetch networks' });
  }
};

// Create a new authorized network
exports.createNetwork = async (req, res) => {
  try {
    const { ssid, ipAddresses, ipRanges, authorized } = req.body;

    // Validate SSID
    if (!ssid || typeof ssid !== 'string') {
      return res.status(400).json({ message: 'Valid SSID is required' });
    }

    // Validate IP addresses if provided
    if (ipAddresses && Array.isArray(ipAddresses)) {
      for (const ip of ipAddresses) {
        if (!validateIpAddress(ip)) {
          return res.status(400).json({ message: `Invalid IP address: ${ip}` });
        }
      }
    }

    // Validate IP ranges if provided
    if (ipRanges && Array.isArray(ipRanges)) {
      for (const range of ipRanges) {
        if (!validateIpRange(range)) {
          return res.status(400).json({ message: `Invalid IP range: ${range}` });
        }
      }
    }

    const network = new AuthorizedNetwork({
      ssid,
      ipAddresses: ipAddresses || [],
      ipRanges: ipRanges || [],
      authorized: authorized !== undefined ? authorized : true,
      organization: req.user.organization
    });

    await network.save();
    res.status(201).json(network);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'A network with this SSID already exists in your organization' });
    } else {
      console.error('Error creating network:', error);
      res.status(500).json({ message: 'Failed to create network' });
    }
  }
};

// Update an authorized network
exports.updateNetwork = async (req, res) => {
  try {
    const { id } = req.params;
    const { ssid, ipAddresses, ipRanges, authorized } = req.body;

    const network = await AuthorizedNetwork.findOne({
      _id: id,
      organization: req.user.organization
    });

    if (!network) {
      return res.status(404).json({ message: 'Network not found' });
    }

    // Validate IP addresses if provided
    if (ipAddresses && Array.isArray(ipAddresses)) {
      for (const ip of ipAddresses) {
        if (!validateIpAddress(ip)) {
          return res.status(400).json({ message: `Invalid IP address: ${ip}` });
        }
      }
    }

    // Validate IP ranges if provided
    if (ipRanges && Array.isArray(ipRanges)) {
      for (const range of ipRanges) {
        if (!validateIpRange(range)) {
          return res.status(400).json({ message: `Invalid IP range: ${range}` });
        }
      }
    }

    // Update fields if provided
    if (ssid) network.ssid = ssid;
    if (ipAddresses) network.ipAddresses = ipAddresses;
    if (ipRanges) network.ipRanges = ipRanges;
    if (authorized !== undefined) network.authorized = authorized;

    await network.save();
    res.json(network);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'A network with this SSID already exists in your organization' });
    } else {
      console.error('Error updating network:', error);
      res.status(500).json({ message: 'Failed to update network' });
    }
  }
};

// Delete an authorized network
exports.deleteNetwork = async (req, res) => {
  try {
    const { id } = req.params;
    const network = await AuthorizedNetwork.findOneAndDelete({
      _id: id,
      organization: req.user.organization
    });

    if (!network) {
      return res.status(404).json({ message: 'Network not found' });
    }

    res.json({ message: 'Network deleted successfully' });
  } catch (error) {
    console.error('Error deleting network:', error);
    res.status(500).json({ message: 'Failed to delete network' });
  }
}; 