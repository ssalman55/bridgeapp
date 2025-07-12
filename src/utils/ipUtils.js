// Validate IP address format (IPv4)
exports.isValidIpAddress = (ip) => {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;

  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
};

// Validate IP range format (CIDR notation)
exports.isValidIpRange = (range) => {
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
  if (!cidrRegex.test(range)) return false;

  const [ip, prefix] = range.split('/');
  const prefixNum = parseInt(prefix, 10);
  if (prefixNum < 0 || prefixNum > 32) return false;

  return exports.isValidIpAddress(ip);
};

// Check if an IP address falls within a CIDR range
exports.isIpInRange = (ip, range) => {
  if (!exports.isValidIpAddress(ip) || !exports.isValidIpRange(range)) {
    return false;
  }

  const [rangeIp, prefix] = range.split('/');
  const mask = parseInt(prefix, 10);
  const ipLong = ipToLong(ip);
  const rangeLong = ipToLong(rangeIp);
  const maskLong = ~((1 << (32 - mask)) - 1);

  return (ipLong & maskLong) === (rangeLong & maskLong);
};

// Helper function to convert IP to long integer
function ipToLong(ip) {
  return ip.split('.')
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
} 